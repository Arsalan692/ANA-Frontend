import importlib

import pytest
from fastapi import HTTPException
from PIL import Image

from app import config
from app.recipes.base import CellRecipe, Recipe, ScreeningRecipe
from app.registry import ModelUnavailable, Registry, UnknownModel, discover
from app.uploads import decode_all
from conftest import RECIPES, encoded, needs

EFFICIENTNET, RESNET, CELLS = RECIPES['efficientnet-b0-aida-r1'], RECIPES['resnet18-aida-512'], RECIPES['cells-resnet18-adjusted']


def test_every_recipe_is_found_complete_and_unique():
    found = discover()
    assert {recipe.id for recipe in found} >= {EFFICIENTNET.id, RESNET.id, CELLS.id}
    for recipe in found:
        assert recipe.task in ('screening', 'cells') and recipe.label and recipe.summary and recipe.files
        assert recipe.id == recipe.id.lower() and ' ' not in recipe.id  # Also a folder name and a URL value.
        assert all(detail.keys() == {'label', 'value'} for detail in recipe.details())


@pytest.mark.parametrize('name, kind', [('_template_screening', ScreeningRecipe), ('_template_cells', CellRecipe)])
def test_templates_are_valid_recipes_but_never_listed(name, kind):
    """A template must import and be a complete recipe, so copying it gives a working starting point."""
    recipe = importlib.import_module(f'app.recipes.{name}').RECIPE
    assert isinstance(recipe, kind) and recipe.id not in RECIPES


def test_registry_reports_missing_files_and_never_defaults_to_them(tmp_path):
    (tmp_path / RESNET.id).mkdir()
    (tmp_path / RESNET.id / RESNET.files[0]).write_bytes(b'placeholder')
    registry = Registry(tmp_path, {'screening': EFFICIENTNET.id, 'cells': CELLS.id}, max_loaded=3, found=[EFFICIENTNET, RESNET, CELLS])
    assert registry.defaults == {'screening': RESNET.id, 'cells': None}  # The configured defaults have no files.
    listed = {model['id']: model for model in registry.describe()}
    assert (listed[EFFICIENTNET.id]['available'], listed[RESNET.id]['available'], listed[RESNET.id]['default']) == (False, True, True)
    assert listed[CELLS.id]['task'] == 'cells' and listed[CELLS.id]['classes'] == list(CELLS.classes) and listed[CELLS.id]['limits']
    with pytest.raises(ModelUnavailable):
        registry.get(EFFICIENTNET.id, 'screening')
    with pytest.raises(UnknownModel):
        registry.get('no-such-model', 'screening')
    with pytest.raises(UnknownModel):  # A model is only ever used for its own task.
        registry.get(RESNET.id, 'cells')


def test_a_recipe_needs_every_file_it_declares(tmp_path):
    folder = tmp_path / CELLS.id
    (folder / 'round_0').mkdir(parents=True)
    (folder / 'round_0' / 'best.pt').write_bytes(b'x')
    assert not CELLS.installed(tmp_path)  # metrics.json and calibration/temperatures.json are missing.


@needs('efficientnet-b0-aida-r1', 'resnet18-aida-512')
def test_registry_keeps_at_most_the_configured_number_of_models_in_memory():
    registry = Registry(config.MODELS, config.DEFAULT_MODELS, max_loaded=1, found=[EFFICIENTNET, RESNET])
    first = registry.get(EFFICIENTNET.id, 'screening')
    assert registry.get(None, 'screening') is first  # The default, loaded once, then reused.
    registry.get(RESNET.id, 'screening')
    assert registry.loaded() == [RESNET.id]


class Upload:
    def __init__(self, name, data):
        self.filename = name
        self.file = __import__('io').BytesIO(data)


def test_uploads_are_refused_with_a_reason_per_file():
    good = encoded(Image.new('RGB', (32, 32)))
    with pytest.raises(HTTPException) as refused:
        decode_all([Upload('good.png', good), Upload('empty.png', b''), Upload('notes.png', b'not an image'),
                    Upload('a.gif', encoded(Image.new('RGB', (8, 8)), 'GIF'))], limit=12, what='A sample')
    assert refused.value.status_code == 422
    assert refused.value.detail['files'] == [
        {'name': 'empty.png', 'error': 'this file is empty.'},
        {'name': 'notes.png', 'error': 'this image could not be opened.'},
        {'name': 'a.gif', 'error': 'use a JPEG, PNG, BMP or TIFF image.'},
    ]
    with pytest.raises(HTTPException) as too_many:
        decode_all([Upload(f'{i}.png', good) for i in range(3)], limit=2, what='A sample')
    assert too_many.value.status_code == 413
    image = Image.new('RGB', (16, 12))
    assert [im.format for im in decode_all([Upload('a.bmp', encoded(image, 'BMP')), Upload('b.tif', encoded(image, 'TIFF'))], 12, 'A sample')] == ['BMP', 'TIFF']


def test_every_recipe_has_a_parity_check():
    """Adding a model without a way to prove it matches training is not allowed."""
    for recipe in RECIPES.values():
        assert type(recipe).check is not Recipe.check, f'{recipe.id} has no parity check'
