import numpy as np
import pytest

from app.recipes.swin_tiny import CLASSES, MODEL_ORDER, as_training_input, green
from conftest import RECIPES, blob, encoded, needs

SWIN = RECIPES['swin-tiny']


def test_a_grey_cell_reaches_the_model_as_imagefolder_loaded_it():
    grey = blob(colour=False)
    prepared, mode = as_training_input(grey)
    assert mode == 'grey' and prepared.mode == 'RGB' and np.array_equal(np.asarray(prepared), np.asarray(grey.convert('RGB')))


def test_a_green_false_colour_copy_comes_back_as_exactly_the_grey_cell():
    grey = blob(colour=False)
    prepared, mode = as_training_input(green(grey))
    assert mode == 'green' and np.array_equal(np.asarray(prepared), np.asarray(grey.convert('RGB')))


def test_other_colour_images_use_the_green_channel_and_are_experimental():
    photo = np.asarray(blob(colour=True)).copy()
    photo[..., 0] = 9  # A little red, as in a real FITC photo.
    from PIL import Image
    prepared, mode = as_training_input(Image.fromarray(photo))
    assert mode == 'colour' and np.array_equal(np.asarray(prepared)[..., 0], photo[..., 1])


def test_the_website_order_holds_every_output_once():
    assert sorted(CLASSES) == sorted(MODEL_ORDER) and SWIN.classes == CLASSES


def cell(client, image):
    body = client.post('/api/cells', files=[('images', ('cell.png', encoded(image), 'image/png'))], data={'model': SWIN.id}).json()
    assert body['model']['id'] == SWIN.id
    return body['cells'][0]


@needs('swin-tiny')
def test_grey_and_green_copies_of_a_cell_get_the_same_answer_without_notes(client):
    grey, false_colour = cell(client, blob(colour=False)), cell(client, green(blob(colour=False)))
    for answer in (grey, false_colour):
        assert answer['family'] in CLASSES and answer['uncertain'] is False and answer['question'] is None
        assert list(answer['probabilities']) == list(CLASSES) and sum(answer['probabilities'].values()) == pytest.approx(1)
        assert answer['confidence'] == max(answer['probabilities'].values()) and answer['warnings'] == []
        assert answer['modelView'].startswith('data:image/png;base64,')
    assert grey['preparation'] == 'grey' and false_colour['preparation'] == 'green'
    assert grey['probabilities'] == pytest.approx(false_colour['probabilities'], abs=1e-6)


@needs('swin-tiny')
def test_a_colour_photo_is_marked_experimental(client):
    photo = np.asarray(blob(colour=True)).copy()
    photo[..., 2] = 5
    from PIL import Image
    answer = cell(client, Image.fromarray(photo))
    assert answer['preparation'] == 'colour' and answer['warnings'][0]['title'] == 'Experimental'


@needs('swin-tiny')
def test_models_endpoint_lists_swin_tiny_without_an_uncertainty_flag(client):
    listed = {model['id']: model for model in client.get('/api/models').json()['models']}[SWIN.id]
    assert listed['classes'] == list(CLASSES) and listed['minConfidence'] is None
    assert listed['uncertainRule'].startswith('never') and any('green' in limit.lower() for limit in listed['limits'])
