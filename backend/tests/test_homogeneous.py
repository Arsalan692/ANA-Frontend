import csv

import numpy as np
import pytest
from PIL import Image

from app.recipes.checks import ROOT
from app.recipes.homogeneous_shared import as_file
from conftest import RECIPES, blob, encoded, needs

MAIN, COMPARISON = RECIPES['homogeneous-6class-resnet18'], RECIPES['homogeneous-ovr-resnet18']
PHASE9 = ROOT / 'Code Part' / 'Model Training one vs rest' / 'outputs' / 'phase9'
has_examples = pytest.mark.skipif(not (PHASE9 / 'examples_predictions.csv').exists(), reason='training project not on this computer')


@pytest.mark.parametrize('mode', ['L', 'RGB', 'RGBA', 'I;16', 'I', 'P'])
def test_the_training_script_reads_exactly_the_decoded_pixels(mode):
    """The vendored prepare() opens a file, so the service hands it a lossless in-memory copy of the upload."""
    image = Image.fromarray((np.arange(30 * 40).reshape(30, 40) * 37 % 65000).astype(np.uint16)).convert(mode) if mode in ('I;16', 'I') else blob().convert(mode)
    with Image.open(as_file(image)) as copy:
        assert copy.mode == image.mode and np.array_equal(np.asarray(copy), np.asarray(image))


def cells(client, files, model):
    return client.post('/api/cells', files=[('images', file) for file in files], data={'model': model}).json()


@has_examples
@needs('homogeneous-6class-resnet18')
def test_the_api_gives_the_numbers_of_examples_predictions_csv(client):
    with (PHASE9 / 'examples_predictions.csv').open(newline='', encoding='utf-8') as file:
        saved = list(csv.DictReader(file))
    files = [(name, (PHASE9 / 'examples' / name).read_bytes(), 'image/png') for name in ('green_homogeneous.png', 'green_speckled.png')]
    body = cells(client, files, MAIN.id)
    assert body['model']['id'] == MAIN.id
    for row, cell in zip(saved, body['cells']):
        assert row['file'].endswith(cell['name'])
        # The 6-class card names the pattern only; the CSV's Homogeneous probability is its first probability.
        assert cell['question'] is None and cell['uncertain'] is False
        assert cell['probabilities']['Homogeneous'] == pytest.approx(float(row['prob_homogeneous']), abs=5e-5)
        assert cell['family'] == row['named_pattern'] and cell['confidence'] == pytest.approx(float(row['named_pattern_prob']), abs=5e-5)
        assert len(cell['probabilities']) == 6 and sum(cell['probabilities'].values()) == pytest.approx(1)
        # Green photos are converted by the script: experimental (shown behind the card's Details toggle).
        assert cell['preparation'] == 'photo' and cell['warnings'][0]['title'] == 'Experimental'


@needs('homogeneous-6class-resnet18', 'homogeneous-ovr-resnet18')
def test_the_6class_model_names_a_pattern_and_the_comparison_model_answers_homogeneous(client):
    grey = ('grey.png', encoded(blob(colour=False)), 'image/png')  # Greyscale, under 100 px: used as is, no warning.
    main, comparison = cells(client, [grey], MAIN.id)['cells'][0], cells(client, [grey], COMPARISON.id)['cells'][0]
    for cell in (main, comparison):
        assert cell['preparation'] == 'qi' and cell['modelsUsed'] == 5
        assert all(w['title'] != 'Experimental' for w in cell['warnings']) and cell['modelView'].startswith('data:image/png;base64,')
    question = comparison['question']
    assert question['label'] == 'Homogeneous (AC-1)' and 0 <= question['probability'] <= 1
    assert question['answer'] == (question['probability'] >= question['cutoff']) and 0.2 < question['cutoff'] < question['strictCutoff'] < 0.5
    assert comparison['uncertain'] == (0.2 < question['probability'] < 0.8)
    assert comparison['family'] is None and comparison['confidence'] is None and comparison['probabilities'] == {}
    assert main['question'] is None and main['uncertain'] is False and main['family'] in MAIN.classes
    assert main['confidence'] == max(main['probabilities'].values())


@needs('homogeneous-ovr-resnet18')
def test_models_endpoint_explains_the_uncertainty_rule(client):
    listed = {model['id']: model for model in client.get('/api/models').json()['models']}
    assert listed[COMPARISON.id]['classes'] == [] and listed[COMPARISON.id]['minConfidence'] is None
    assert listed[COMPARISON.id]['uncertainRule'] == 'the Homogeneous probability is between 20% and 80%'
    assert listed['cells-resnet18-adjusted']['uncertainRule'] == "the model's confidence is below 70%"
    assert any('experimental' in limit for limit in listed[MAIN.id]['limits'])
