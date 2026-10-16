import base64
from io import BytesIO

import pytest
from PIL import Image

from app import config
from conftest import RECIPES, blob, encoded, needs

CELLS = RECIPES['cells-resnet18-adjusted']
FAMILIES = ['Homogeneous', 'Speckled', 'Nucleolar']


def test_the_image_reaches_the_training_code_exactly_as_uploaded():
    """The recipe must not resize, convert or adjust anything before the vendored predict()."""
    received = []

    class Recorder:
        def predict(self, image):
            received.append(image)
            return {'family': 'Speckled', 'confidence': 0.9, 'uncertain': False, 'probabilities': {}, 'models_used': 5}

    image = blob(size=(640, 480))
    before = image.tobytes()
    CELLS.classify(Recorder(), image)
    assert received[0] is image and image.size == (640, 480) and image.mode == 'RGB' and image.tobytes() == before


def test_the_vendored_script_is_untouched_by_this_project():
    from app.recipes.vendor import predict_pattern
    assert 'Phase 9: predict the ANA pattern family of ONE cropped cell image.' in predict_pattern.__doc__


def classify(client, files, model=None):
    return client.post('/api/cells', files=[('images', file) for file in files], data={'model': model} if model else None)


@needs('cells-resnet18-adjusted')
def test_models_endpoint_describes_the_cell_model_and_its_limits(client):
    body = client.get('/api/models').json()
    assert body['defaults']['cells'] == CELLS.id
    model = next(model for model in body['models'] if model['id'] == CELLS.id)
    assert model['task'] == 'cells' and model['available'] and model['classes'] == FAMILIES and model['minConfidence'] == 0.7
    assert 'one cropped cell' in model['limits'][0] and 'not for diagnosis' in model['limits'][-1]


@needs('cells-resnet18-adjusted')
def test_greyscale_and_green_cells_each_get_a_family_with_three_probabilities(client):
    body = classify(client, [('grey.png', encoded(blob(colour=False)), 'image/png'), ('green.png', encoded(blob(colour=True)), 'image/png')]).json()
    assert body['model']['id'] == CELLS.id and body['model']['task'] == 'cells' and body['model']['details'][1]['value'].startswith('5 models (rounds 0, 1, 2, 3, 4)')
    assert [result['name'] for result in body['cells']] == ['grey.png', 'green.png']
    for result in body['cells']:
        assert result['family'] in FAMILIES and list(result['probabilities']) == FAMILIES and result['modelsUsed'] == 5
        assert sum(result['probabilities'].values()) == pytest.approx(1, abs=1e-5)
        assert result['confidence'] == pytest.approx(result['probabilities'][result['family']]) == max(result['probabilities'].values())
        assert result['uncertain'] == (result['confidence'] < 0.7)
        assert (result['width'], result['height'], result['oversized']) == (80, 72, False)
        view = Image.open(BytesIO(base64.b64decode(result['modelView'].removeprefix('data:image/png;base64,'))))
        assert view.size == (100, 100) and view.mode == 'L'  # The training script's canvas, for display only.
    # The brightest channel of a green image is the image itself, so both versions must agree exactly.
    assert body['cells'][0]['probabilities'] == body['cells'][1]['probabilities']


@needs('cells-resnet18-adjusted')
def test_cells_are_independent_and_large_images_are_flagged(client):
    one, other = encoded(blob(colour=False)), encoded(blob(size=(64, 90), colour=False))
    alone = classify(client, [('a.png', one, 'image/png')]).json()['cells'][0]
    together = classify(client, [('b.png', other, 'image/png'), ('a.png', one, 'image/png')]).json()['cells'][1]
    assert alone['probabilities'] == together['probabilities']
    field = classify(client, [('field.jpg', encoded(blob(size=(1200, 900)), 'JPEG'), 'image/jpeg')]).json()['cells'][0]
    assert field['oversized'] is True and (field['width'], field['height']) == (1200, 900)


@needs('cells-resnet18-adjusted')
def test_a_screening_model_cannot_classify_cells_and_limits_apply(client):
    assert classify(client, [('a.png', encoded(blob()), 'image/png')], 'efficientnet-b0-aida-r1').status_code == 404
    one = encoded(blob())
    assert classify(client, [(f'{i}.png', one, 'image/png') for i in range(config.MAX_CELLS + 1)]).status_code == 413
