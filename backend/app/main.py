"""Local web service that screens one sample's microscopy fields as ANA positive or negative.

Images are processed in memory and never written to disk. Run from backend/:
    .venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from . import config
from .aggregation import aggregate
from .classifier import ScreeningModel

Image.MAX_IMAGE_PIXELS = config.MAX_PIXELS  # Pillow refuses anything larger before decoding it.


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not config.MODEL_PATH.is_file():
        raise RuntimeError(f'Model checkpoint not found: {config.MODEL_PATH}. Set ANA_MODEL_PATH to the .pt file.')
    app.state.model = ScreeningModel(config.MODEL_PATH)
    yield


app = FastAPI(title='ANA / LAB screening service', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.FRONTEND_ORIGINS, allow_methods=['GET', 'POST'], allow_headers=['*'])


def open_image(upload: UploadFile) -> Image.Image:
    """Decodes one upload fully, or raises ValueError with a message for the user."""
    data = upload.file.read(config.MAX_BYTES + 1)
    if not data:
        raise ValueError('this file is empty.')
    if len(data) > config.MAX_BYTES:
        raise ValueError('the file exceeds the 20 MB limit.')
    try:
        image = Image.open(BytesIO(data))
        if image.format not in config.FORMATS:
            raise ValueError('use a JPEG, PNG, BMP or TIFF image.')
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        if isinstance(error, Image.DecompressionBombError):
            raise ValueError('the image exceeds the 40 megapixel limit.') from error
        raise ValueError('this image could not be opened.') from error
    return image


@app.get('/api/health')
def health(request: Request):
    return {'status': 'ok', 'model': request.app.state.model.info}


@app.post('/api/screen')
def screen(request: Request, images: list[UploadFile] = File(...)):
    if len(images) > config.MAX_FILES:
        raise HTTPException(413, {'message': f'A sample can contain up to {config.MAX_FILES} images.', 'files': []})
    decoded, problems = [], []
    for upload in images:
        try:
            decoded.append(open_image(upload))
        except ValueError as error:
            problems.append({'name': upload.filename, 'error': str(error)})
    if problems:
        # A partial sample would give a misleading sample-level result, so nothing is screened.
        raise HTTPException(422, {'message': 'Some images could not be screened.', 'files': problems})
    model: ScreeningModel = request.app.state.model
    predictions = model.predict(decoded)
    return {
        'model': model.info,
        'analysedAt': datetime.now(timezone.utc).isoformat(),
        'fields': [{'name': upload.filename, 'call': prediction.call, 'confidence': prediction.confidence,
                    'probabilityPositive': prediction.probability_positive}
                   for upload, prediction in zip(images, predictions)],
        'sample': aggregate([prediction.call for prediction in predictions]),
    }
