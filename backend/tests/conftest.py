from io import BytesIO

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import config
from app.main import app
from app.recipes.base import IMAGENET_MEAN, IMAGENET_STD
from app.registry import discover

RECIPES = {recipe.id: recipe for recipe in discover()}


def installed(model_id: str) -> bool:
    return model_id in RECIPES and RECIPES[model_id].installed(config.MODELS)


def needs(*model_ids: str):
    """Skip a test when the weights it needs are not on this computer (they are not in git)."""
    missing = [model_id for model_id in model_ids if not installed(model_id)]
    return pytest.mark.skipif(bool(missing), reason=f'model files not present: {", ".join(missing)}')


def encoded(image: Image.Image, fmt='PNG') -> bytes:
    buffer = BytesIO()
    image.save(buffer, fmt)
    return buffer.getvalue()


def blob(size=(80, 72), colour=True) -> Image.Image:
    """A bright blob on a dark background: green on black as a microscope exports it, or greyscale."""
    rows, columns = np.mgrid[0:size[1], 0:size[0]]
    grey = (200 * np.exp(-(((columns - size[0] / 2) / (size[0] / 3.6)) ** 2 + ((rows - size[1] / 2) / (size[1] / 4)) ** 2)) + 12).astype(np.uint8)
    return Image.fromarray(np.dstack([np.zeros_like(grey), grey, np.zeros_like(grey)]) if colour else grey)


def pixels(tensor):
    """Undo ImageNet normalisation: back to 0..255 RGB values, shape (H, W, 3)."""
    return ((tensor[0] * IMAGENET_STD + IMAGENET_MEAN) * 255).round().permute(1, 2, 0).numpy().astype(int)


@pytest.fixture(scope='session')
def client():
    with TestClient(app) as test_client:
        yield test_client
