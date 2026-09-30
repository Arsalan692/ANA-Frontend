from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import config
from app.aggregation import aggregate
from app.classifier import prepare
from app.main import app

ASSETS = config.PROJECT / 'frontend' / 'assets-source'


def png(image: Image.Image, fmt='PNG') -> bytes:
    buffer = BytesIO()
    image.save(buffer, fmt)
    return buffer.getvalue()


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


def test_prepare_pads_to_a_black_square_without_cropping():
    image = prepare(Image.new('RGB', (300, 100), (0, 200, 0)), 512)
    assert image.size == (512, 512) and image.mode == 'RGB'
    assert image.getpixel((256, 5)) == (0, 0, 0) and image.getpixel((256, 256)) == (0, 200, 0)
    assert prepare(Image.new('L', (40, 40), 90), 512).getpixel((256, 256)) == (90, 90, 90)


needs_model = pytest.mark.skipif(not config.MODEL_PATH.is_file(), reason='model checkpoint not present')


@pytest.fixture(scope='module')
def client():
    with TestClient(app) as test_client:
        yield test_client


@needs_model
def test_health_describes_the_checkpoint(client):
    model = client.get('/api/health').json()['model']
    assert model['label'] == 'ResNet18 · AIDA binary · 512 px' and model['epoch'] == 20 and len(model['sha256']) == 12


@needs_model
def test_screen_returns_a_result_per_field_and_one_sample_result(client):
    names = ['field-positive-01.png', 'field-negative-01.png', 'field-negative-02.png']
    files = [('images', (name, (ASSETS / name).read_bytes(), 'image/png')) for name in names]
    body = client.post('/api/screen', files=files).json()
    assert [field['name'] for field in body['fields']] == names
    for field in body['fields']:
        assert field['call'] in ('positive', 'negative') and 0.5 <= field['confidence'] <= 1
        assert field['confidence'] == pytest.approx(field['probabilityPositive'] if field['call'] == 'positive' else 1 - field['probabilityPositive'])
    calls = [field['call'] for field in body['fields']]
    assert body['sample'] == aggregate(calls)


@needs_model
def test_the_same_image_always_gets_the_same_result(client):
    data = (ASSETS / 'field-weak-01.png').read_bytes()
    first, second = (client.post('/api/screen', files=[('images', ('a.png', data, 'image/png'))]).json()['fields'][0] for _ in range(2))
    assert first['probabilityPositive'] == second['probabilityPositive']


@needs_model
def test_bmp_and_tiff_are_accepted(client):
    image = Image.new('RGB', (64, 48), (0, 30, 0))
    files = [('images', ('a.bmp', png(image, 'BMP'), 'image/bmp')), ('images', ('b.tif', png(image, 'TIFF'), 'image/tiff'))]
    assert client.post('/api/screen', files=files).status_code == 200


@needs_model
def test_bad_files_reject_the_whole_sample_with_reasons(client):
    good = png(Image.new('RGB', (32, 32)))
    files = [('images', ('good.png', good, 'image/png')), ('images', ('empty.png', b'', 'image/png')),
             ('images', ('notes.png', b'not an image', 'image/png')), ('images', ('a.gif', png(Image.new('RGB', (8, 8)), 'GIF'), 'image/gif'))]
    response = client.post('/api/screen', files=files)
    assert response.status_code == 422
    assert response.json()['detail']['files'] == [
        {'name': 'empty.png', 'error': 'this file is empty.'},
        {'name': 'notes.png', 'error': 'this image could not be opened.'},
        {'name': 'a.gif', 'error': 'use a JPEG, PNG, BMP or TIFF image.'},
    ]


@needs_model
def test_too_many_images_are_refused(client):
    one = png(Image.new('RGB', (8, 8)))
    response = client.post('/api/screen', files=[('images', (f'{i}.png', one, 'image/png')) for i in range(13)])
    assert response.status_code == 413
