"""Local web service for ANA / LAB. Two tasks, each with any number of models (one recipe per model):

- screening: a sample's microscopy fields -> ANA positive or negative, one result per field plus one per sample.
- cells: single cropped cells -> pattern family, one result per cell; cells are never combined.

Images are processed in memory and never written to disk. Run from backend/:
    .venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .aggregation import aggregate
from .registry import LoadedModel, ModelUnavailable, Registry, UnknownModel
from .uploads import decode_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry = Registry(config.MODELS, config.DEFAULT_MODELS, config.MAX_LOADED_MODELS)
    if not any(registry.defaults.values()):
        expected = ', '.join(f'models/{model_id}/' for model_id in registry.recipes)
        raise RuntimeError(f'No model files found in {config.MODELS}. Expected at least one of: {expected}')
    # Load the default screening model now, so a broken file fails at startup; other models load on first use.
    if registry.defaults['screening']:
        registry.get(None, 'screening')
    app.state.registry = registry
    yield


app = FastAPI(title='ANA / LAB screening service', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.FRONTEND_ORIGINS, allow_methods=['GET', 'POST'], allow_headers=['*'])


def chosen(request: Request, model: str | None, task: str) -> LoadedModel:
    """The requested model (or the task's default), checked before any image is read."""
    registry: Registry = request.app.state.registry
    try:
        return registry.get(model, task)
    except UnknownModel:
        if model is None:
            raise HTTPException(409, {'message': f'No {task} model is installed. Add one to the models folder and restart the service.', 'files': []})
        raise HTTPException(404, {'message': f'There is no {task} model called “{model}”. Choose another model.', 'files': []})
    except ModelUnavailable:
        raise HTTPException(409, {'message': f'The files for “{model}” are not in models/{model}/.', 'files': []})


@app.get('/api/health')
def health(request: Request):
    registry: Registry = request.app.state.registry
    return {'status': 'ok', 'defaults': registry.defaults, 'loaded': registry.loaded()}


@app.get('/api/models')
def models(request: Request):
    """Every model the website can choose from, for both tasks. Ones whose files are missing are listed as unavailable."""
    registry: Registry = request.app.state.registry
    return {'defaults': registry.defaults, 'models': registry.describe()}


@app.post('/api/screen')
def screen(request: Request, images: list[UploadFile] = File(...), model: str | None = Form(None)):
    loaded = chosen(request, model, 'screening')
    predictions = loaded.screen(decode_all(images, config.MAX_FIELDS, 'A sample'))
    return {
        'model': loaded.info,
        'analysedAt': datetime.now(timezone.utc).isoformat(),
        'fields': [{'name': upload.filename, 'call': prediction.call, 'confidence': prediction.confidence,
                    'probabilityPositive': prediction.probability_positive}
                   for upload, prediction in zip(images, predictions)],
        'sample': aggregate([prediction.call for prediction in predictions]),
    }


@app.post('/api/cells')
def cells(request: Request, images: list[UploadFile] = File(...), model: str | None = Form(None)):
    loaded = chosen(request, model, 'cells')
    decoded = decode_all(images, config.MAX_CELLS, 'One request')
    oversized = loaded.recipe.oversized_side
    return {
        'model': loaded.info,
        'analysedAt': datetime.now(timezone.utc).isoformat(),
        'cells': [{'name': upload.filename, 'width': image.width, 'height': image.height, 'oversized': max(image.size) > oversized,
                   'family': result.family, 'confidence': result.confidence, 'uncertain': result.uncertain,
                   'probabilities': result.probabilities, 'modelView': result.model_view, **result.extra}
                  for upload, image, result in zip(images, decoded, loaded.classify(decoded))],
    }
