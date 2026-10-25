"""The most likely of six patterns for one cell: the MAIN model of
`Code Part/Model Training one vs rest/` (run 6class_strong_aug). Five ResNet18 round models (timm, one
greyscale input channel, six outputs), each calibrated with its own temperature, probabilities averaged.

Exactly the training project's scripts/predict_homogeneous.py (vendored unchanged): its load_models() builds
the models and its predict_canvases() runs them. Shared code and the parity check: homogeneous_shared.py.
"""
import csv
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np

from .base import Detail
from .homogeneous_shared import DISPLAY, HomogeneousRecipe, demo_table, sample_test_cells
from .vendor import predict_homogeneous as script


class Homogeneous6Class(HomogeneousRecipe):
    id = 'homogeneous-6class-resnet18'
    label = 'ResNet18 ensemble · 6 patterns'
    summary = 'Names the most likely of six patterns. Five calibrated models averaged; trained on the Qi et al. cell set (as the Homogeneous-vs-rest project).'
    run, head = script.RUN_NAME, '6class'
    classes = tuple(DISPLAY.get(name, name) for name in script.CLASS_NAMES)
    limits = (
        'Upload one cell per image. Greyscale crops like the training cells (up to 100 px) are used as they are.',
        'Other images, such as green FITC photos, are converted automatically. That is experimental: untested, and the five models often disagree on them.',
        'It knows six patterns: Homogeneous, Speckled, Nucleolar, Centromere, Nuclear membrane and Golgi. Any other pattern, or a negative cell, still gets one of these names.',
        'For research and demonstration only, not for diagnosis.',
    )

    def build(self, folder: Path):
        return script.load_models(folder, folder / 'calibration.json')

    def round_probabilities(self, canvases, members, temperature=True) -> np.ndarray:
        return script.predict_canvases(canvases, members, temperature=temperature)

    def details(self) -> list[Detail]:
        return [
            {'label': 'Models', 'value': 'ResNet18, one per cross-validation round (5); each calibrated with its own temperature, then averaged'},
            {'label': 'Training', 'value': 'Qi et al. HEp-2 single-cell set, all six patterns; folds split by slide blocks'},
            {'label': 'Input', 'value': 'Greyscale cell on a 100 × 100 px canvas, brightness stretch, centre 88 px enlarged to 176 px, as in training'},
            {'label': 'Answer', 'value': 'The most likely of the six patterns, with all six calibrated probabilities'},
            {'label': 'Uncertainty', 'value': 'Not flagged: there is no validated rule for the named pattern yet. Read the six probabilities'},
            {'label': 'Test result', 'value': 'Six patterns: balanced accuracy 0.856 (test folds, Phase 6); Homogeneous ↔ Speckled are confused in 13–14% of cells'},
        ]

    def extra_checks(self, model, training: Path) -> tuple[bool, list[str]]:
        """3. outputs/phase9/examples/ through the recipe give examples_predictions.csv.
        4. The training script itself, run on the examples and 20 test-fold cells, gives the same output as the recipe."""
        examples = sorted((training / 'outputs' / 'phase9' / 'examples').glob('*.png'))
        with (training / 'outputs' / 'phase9' / 'examples_predictions.csv').open(newline='', encoding='utf-8') as file:
            saved = {Path(row['file'].replace('\\', '/')).name: row for row in csv.DictReader(file)}
        ok_saved, lines = compare(demo_table(self, model, examples), saved)
        lines = [f'phase9 examples vs examples_predictions.csv: {line}' for line in lines]
        cells = [Path(__file__).resolve().parents[3].parent / 'datasets' / 'cells' / 'cells' / f'{index}.png'
                 for index in sample_test_cells(self.run, training, per_round=4, seed=9)]
        with tempfile.TemporaryDirectory() as scratch:
            out = Path(scratch) / 'script.csv'
            # The training project's own script, on its own files; nothing is written in that folder.
            subprocess.run([sys.executable, 'scripts/predict_homogeneous.py', *map(str, examples + cells), '--out', str(out)],
                           cwd=training, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}, check=True, capture_output=True)
            with out.open(newline='', encoding='utf-8') as file:
                by_script = {Path(row['file']).name: row for row in csv.DictReader(file)}
        ok_script, more = compare(demo_table(self, model, examples + cells), by_script)
        return ok_saved and ok_script, lines + [f'training script on 2 examples + 20 test cells: {line}' for line in more]


def compare(ours: list[dict], theirs: dict[str, dict]) -> tuple[bool, list[str]]:
    """The script's columns, rounded as it rounds them. Probabilities may differ by 1 in the 4th decimal
    (the script runs cells in batches, the service one at a time); everything else must be equal."""
    bad = []
    for row in ours:
        other = theirs[row['file']]
        same = (abs(row['prob_homogeneous'] - float(other['prob_homogeneous'])) <= 1.5e-4
                and abs(row['named_pattern_prob'] - float(other['named_pattern_prob'])) <= 1.5e-4
                and abs(row['round_spread'] - float(other['round_spread'])) <= 1.5e-3
                and all(str(row[key]) == other[key] for key in ('homogeneous', 'homogeneous_strict', 'uncertain', 'named_pattern'))
                and other['mode'].startswith(row['mode']))
        if not same:
            bad.append(row['file'])
    return not bad, [f'{len(ours) - len(bad)}/{len(ours)} identical' + (f'; DIFFER: {bad}' if bad else '')]


RECIPE = Homogeneous6Class()
