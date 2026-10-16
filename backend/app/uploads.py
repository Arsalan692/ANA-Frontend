"""Turns uploaded files into decoded images, or into one clear error naming every file that cannot be used."""
from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from . import config

Image.MAX_IMAGE_PIXELS = config.MAX_PIXELS  # Pillow refuses anything larger before decoding it.


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
    except Image.DecompressionBombError as error:
        raise ValueError('the image exceeds the 40 megapixel limit.') from error
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError('this image could not be opened.') from error
    return image


def decode_all(uploads: list[UploadFile], limit: int, what: str) -> list[Image.Image]:
    """Every upload decoded. If any file is unusable, nothing is analysed (a partial sample would mislead)."""
    if len(uploads) > limit:
        raise HTTPException(413, {'message': f'{what} can contain up to {limit} images.', 'files': []})
    decoded, problems = [], []
    for upload in uploads:
        try:
            decoded.append(open_image(upload))
        except ValueError as error:
            problems.append({'name': upload.filename, 'error': str(error)})
    if problems:
        raise HTTPException(422, {'message': 'Some images could not be read.', 'files': problems})
    return decoded
