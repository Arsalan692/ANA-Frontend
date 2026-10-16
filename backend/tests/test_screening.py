import numpy as np
import pytest
import torch
from PIL import Image

from app import config
from app.aggregation import aggregate
from app.recipes.efficientnet_b0_aida_r1 import to_rgb
from conftest import RECIPES, encoded, needs, pixels

EFFICIENTNET, RESNET = RECIPES['efficientnet-b0-aida-r1'], RECIPES['resnet18-aida-512']
ASSETS = config.PROJECT / 'frontend' / 'assets-source'


@pytest.mark.parametrize('calls, call, review', [
    (['positive'] * 4, 'positive', False),
    (['negative'] * 3, 'negative', False),
    (['positive', 'positive', 'positive', 'negative'], 'positive', True),
    (['negative', 'negative', 'positive'], 'negative', True),
    (['positive', 'negative'], 'positive', True),  # A tie leans positive.
])
def test_majority_rule(calls, call, review):
    result = aggregate(calls)
    assert (result['call'], result['needsReview'], result['totalFields']) == (call, review, len(calls))


def striped():
    """A wide image: red left third, green middle, blue right third."""
    image = Image.new('RGB', (300, 100), (0, 200, 0))
    image.paste((200, 0, 0), (0, 0, 100, 100))
    image.paste((0, 0, 200), (200, 0, 300, 100))
    return image


def test_efficientnet_resizes_the_shorter_side_and_takes_the_centre_square():
    tensor = EFFICIENTNET.preprocess(striped())
    assert tuple(tensor.shape) == (1, 3, 512, 512) and tensor.dtype == torch.float32
    # The centre 512 of a 1536-wide resize spans the green third exactly; red and blue are cropped away.
    assert (pixels(tensor)[:, 20:492] == [0, 200, 0]).all()


def test_resnet_pads_the_whole_field_onto_a_black_square_without_cropping():
    seen = pixels(RESNET.preprocess(striped()))
    assert (seen[5, 256] == [0, 0, 0]).all()  # Black padding above the field.
    assert (seen[256, 40] == [200, 0, 0]).all() and (seen[256, 256] == [0, 200, 0]).all() and (seen[256, 470] == [0, 0, 200]).all()


@pytest.mark.parametrize('recipe', [EFFICIENTNET, RESNET], ids=lambda recipe: recipe.id)
def test_brightness_is_never_changed(recipe):
    seen = pixels(recipe.preprocess(Image.new('L', (40, 40), 9)))
    assert seen.shape == (512, 512, 3) and (seen == 9).all()  # A dark image stays dark.


def test_sixteen_bit_images_are_scaled_by_full_range_not_clipped_or_stretched():
    dim = Image.fromarray(np.full((8, 8), 6425, dtype=np.uint16))  # 6425 / 65535 of full scale = 25 / 255
    assert dim.mode.startswith('I;16') and to_rgb(dim).getpixel((0, 0)) == (25, 25, 25)
    assert to_rgb(Image.fromarray(np.full((8, 8), 65535, dtype=np.uint16))).getpixel((0, 0)) == (255, 255, 255)
    assert to_rgb(Image.fromarray(np.full((8, 8), 0.5, dtype=np.float32))).getpixel((0, 0)) == (128, 128, 128)


def screen(client, files, model=None):
    return client.post('/api/screen', files=[('images', file) for file in files], data={'model': model} if model else None)


@needs('efficientnet-b0-aida-r1')
def test_models_endpoint_lists_both_tasks_with_their_defaults(client):
    body = client.get('/api/models').json()
    assert body['defaults']['screening'] == EFFICIENTNET.id
    listed = {model['id']: model for model in body['models']}
    assert listed[EFFICIENTNET.id]['task'] == 'screening' and listed[EFFICIENTNET.id]['default'] and listed[EFFICIENTNET.id]['folder'] == f'models/{EFFICIENTNET.id}'
    assert listed[EFFICIENTNET.id]['label'] == 'EfficientNet-B0 · AIDA · 512 px' and listed[RESNET.id]['summary']


@needs('efficientnet-b0-aida-r1')
def test_screen_returns_a_result_per_field_and_one_sample_result(client):
    names = ['field-positive-01.png', 'field-negative-01.png', 'field-negative-02.png']
    body = screen(client, [(name, (ASSETS / name).read_bytes(), 'image/png') for name in names]).json()
    assert body['model']['id'] == EFFICIENTNET.id and body['model']['task'] == 'screening'  # No model named: the default.
    assert [detail['label'] for detail in body['model']['details']] == ['Checkpoint', 'Training', 'Input', 'Confidence']
    assert [field['name'] for field in body['fields']] == names
    for field in body['fields']:
        assert field['call'] in ('positive', 'negative') and 0.5 <= field['confidence'] <= 1
        assert field['confidence'] == pytest.approx(field['probabilityPositive'] if field['call'] == 'positive' else 1 - field['probabilityPositive'])
    assert body['sample'] == aggregate([field['call'] for field in body['fields']])


@needs('efficientnet-b0-aida-r1', 'resnet18-aida-512')
def test_the_chosen_model_screens_with_its_own_pipeline(client):
    files = [('field-weak-01.png', (ASSETS / 'field-weak-01.png').read_bytes(), 'image/png')]
    by_model = {model_id: screen(client, files, model_id).json() for model_id in (EFFICIENTNET.id, RESNET.id)}
    assert by_model[RESNET.id]['model']['checkpoint'] == 'aida_binary_resnet18_512_best.pt'
    assert [detail['label'] for detail in by_model[RESNET.id]['model']['details']] == ['Checkpoint', 'Epoch', 'Training', 'Input', 'Confidence']
    assert by_model[EFFICIENTNET.id]['fields'][0]['probabilityPositive'] != by_model[RESNET.id]['fields'][0]['probabilityPositive']


@needs('efficientnet-b0-aida-r1')
def test_unknown_or_wrong_task_models_are_refused_before_any_image_is_read(client):
    for name in ('no-such-model', 'cells-resnet18-adjusted'):
        response = screen(client, [('a.png', b'not an image', 'image/png')], name)
        assert response.status_code == 404 and name in response.json()['detail']['message']


@needs('efficientnet-b0-aida-r1')
def test_the_same_image_always_gets_the_same_result(client):
    files = [('a.png', (ASSETS / 'field-weak-01.png').read_bytes(), 'image/png')]
    first, second = (screen(client, files).json()['fields'][0] for _ in range(2))
    assert first['probabilityPositive'] == second['probabilityPositive']


@needs('efficientnet-b0-aida-r1')
def test_too_many_fields_are_refused(client):
    one = encoded(Image.new('RGB', (8, 8)))
    assert screen(client, [(f'{i}.png', one, 'image/png') for i in range(config.MAX_FIELDS + 1)]).status_code == 413
