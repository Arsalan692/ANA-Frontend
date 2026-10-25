"""Shared by the two Homogeneous (AC-1) models from `Code Part/Model Training one vs rest/`: one cell -> is it
Homogeneous? Both average five ResNet18 round models, each calibrated with its own temperature (Phase 7).

- homogeneous_6class_resnet18.py: the main model, a 6-pattern classifier; the website shows only the named
  pattern and the six probabilities (no uncertainty flag: no validated rule for the named pattern yet).
- homogeneous_ovr_resnet18.py: the comparison model, one-vs-rest (one logit); it only answers the question.

All image preparation is the training project's own code, vendor/predict_homogeneous.py, copied UNCHANGED:
prepare() (greyscale crops used as is; other images, e.g. green FITC photos, converted and the cell found),
to_canvas() and network_input(). This module never resizes or adjusts an image itself.

Files in models/<id>/: round_0..4/{best.pt, metrics.json} from outputs/runs/<run>/ and calibration.json from
outputs/phase7/, unchanged.
"""
import base64
import hashlib
from io import BytesIO
import json
from pathlib import Path
import random

import numpy as np
import torch
from PIL import Image

from .base import CellPrediction, CellRecipe, CheckReport, Detail, Question
from .vendor import predict_homogeneous as script

TRAINING = 'Code Part/Model Training one vs rest'
ROUNDS = range(5)
UNCERTAIN_BAND = (0.2, 0.8)  # Fixed before calibration; load() checks calibration.json says the same.
SPREAD_WARNING = 0.4         # The script's guidance: above this the round models disagree.
DISPLAY = {'NuclearMembrane': 'Nuclear membrane'}  # Class names as the website shows them.


def as_file(image: Image.Image) -> BytesIO:
    """script.prepare() opens a file. Give it the upload as a lossless in-memory TIFF, so it reads exactly the
    pixels (and bit depth) the service decoded. Nothing is written to disk."""
    buffer = BytesIO()
    image.save(buffer, 'TIFF')
    buffer.seek(0)
    return buffer


def model_view(canvas: np.ndarray) -> str:
    """The centre 88 × 88 of the training canvas (what the network is given, before enlarging), as a PNG data URL.
    The same picture as the script's --preview column "network sees". Display only."""
    edge = (script.CANVAS - script.CROP) // 2
    buffer = BytesIO()
    Image.fromarray(canvas[edge:edge + script.CROP, edge:edge + script.CROP]).save(buffer, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')


class HomogeneousRecipe(CellRecipe):
    run: str      # The run name in the training project (outputs/runs/<run>/, key in calibration.json).
    head: str     # metrics.json "head": '6class' or 'ovr'.
    files = ('round_*/best.pt', 'round_*/metrics.json', 'calibration.json')
    min_confidence = None
    oversized_side = 600  # Photos of one cell are converted, so larger images are fine up to a point.

    def uncertain_rule(self) -> str:
        if self.classes:
            return 'never: there is no validated uncertainty rule for the named pattern yet'
        return f'the Homogeneous probability is between {UNCERTAIN_BAND[0]:.0%} and {UNCERTAIN_BAND[1]:.0%}'

    # ------------------------------------------------------------------ per model
    def build(self, folder: Path) -> tuple[list[dict], dict]:
        """The five round models as the script's load_models() returns them, and this run's calibration."""
        raise NotImplementedError

    def round_probabilities(self, canvases: list[np.ndarray], members: list[dict], temperature=True) -> np.ndarray:
        """(rounds, cells, outputs) probabilities; output 0 is Homogeneous."""
        raise NotImplementedError

    # ------------------------------------------------------------------ shared
    def load(self, folder: Path, device: torch.device):
        band = tuple(json.loads((folder / 'calibration.json').read_text())['uncertain_band'])
        if band != UNCERTAIN_BAND:
            raise RuntimeError(f'{folder}/calibration.json has uncertain band {band}, this recipe expects {UNCERTAIN_BAND}')
        for k in ROUNDS:
            head = json.loads((folder / f'round_{k}' / 'metrics.json').read_text())['head']
            if head != self.head:
                raise RuntimeError(f'{folder}/round_{k} is a {head!r} model, expected {self.head!r}')
        members, calibration = self.build(folder)  # On the CPU, as the script runs them.
        facts = [{'label': 'Loaded', 'value': f'{len(members)} models (rounds {", ".join(str(k) for k in ROUNDS)}); '
                  f'cut-off {calibration["cutoff"]:.1%}, strict cut-off {calibration["cutoff_95spec"]:.1%}'}]
        return {'members': members, 'calibration': calibration}, facts

    def predict(self, model: dict, image: Image.Image) -> tuple[np.ndarray, np.ndarray, str, str, np.ndarray]:
        """Averaged probabilities, per-round probabilities, mode (qi / photo), the conversion note and the canvas."""
        cell, mode, note = script.prepare(as_file(image))
        canvas = script.to_canvas(cell)
        per_round = self.round_probabilities([canvas], model['members'])[:, 0, :]  # (rounds, outputs)
        return per_round.mean(0), per_round, mode, note, canvas

    def classify(self, model: dict, image: Image.Image) -> CellPrediction:
        """6-class: the named pattern and all six probabilities, with no uncertainty flag (no validated rule for the
        named pattern yet). One-vs-rest: Homogeneous or not at the calibrated cut-offs, uncertain in the band."""
        probabilities, per_round, mode, note, canvas = self.predict(model, image)
        calibration = model['calibration']
        if self.classes:
            named = {DISPLAY.get(name, name): float(value) for name, value in zip(script.CLASS_NAMES, probabilities)}
            best = int(np.argmax(probabilities))
            family, confidence, uncertain, question = DISPLAY.get(script.CLASS_NAMES[best], script.CLASS_NAMES[best]), float(probabilities[best]), False, None
        else:
            p = float(probabilities[0])
            named, family, confidence, best = {}, None, None, 0
            uncertain = UNCERTAIN_BAND[0] < p < UNCERTAIN_BAND[1]
            question = Question('Homogeneous (AC-1)', 'Homogeneous', 'Not homogeneous', p, calibration['cutoff'], calibration['cutoff_95spec'])
        what = family or 'Homogeneous'
        spread = float(per_round[:, best].max() - per_round[:, best].min())  # Of the answer shown.
        warnings = []
        if mode == 'photo':
            warnings.append({'title': 'Experimental', 'text': f'This is not a greyscale single-cell crop like the training cells, so it was converted automatically ({note}, cell found and rescaled). These models are untested on such images and often disagree on them.'})
        if spread > SPREAD_WARNING:
            warnings.append({'title': 'The five models disagree', 'text': f'Their {what} probabilities differ by up to {spread:.0%}. The image is probably unlike the training cells.'})
        return CellPrediction(
            family, confidence, uncertain, named, model_view=model_view(canvas), question=question, warnings=warnings,
            facts=[{'label': 'Prepared as', 'value': 'greyscale cell crop, used as is' if mode == 'qi' else f'photo: {note}, cell found, longest side {script.TARGET_SIDE} px'},
                   {'label': 'Round spread', 'value': f'{spread:.3f} (highest minus lowest {what} probability of the 5 models)'}],
            extra={'modelsUsed': len(model['members']), 'roundSpread': spread, 'preparation': mode})

    # ------------------------------------------------------------------ parity
    def check(self, model: dict, folder: Path) -> CheckReport:
        """1. The vendored script and every model file are byte-identical to the training project's.
        2. As the script's --self-test: per round, 40 of its test cells (the same ones) through this recipe's
           models, uncalibrated, against the scores training saved (GPU half precision, so: typical difference
           below 0.001, largest below 0.05).
        Then extra_checks() (the 6-class model also compares with the script's own output)."""
        import pandas as pd
        from .checks import ROOT
        training = ROOT / TRAINING
        digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()  # noqa: E731
        same = digest(Path(script.__file__)) == digest(training / 'scripts' / 'predict_homogeneous.py')
        lines = [f'predict_homogeneous.py identical to the training project: {same}']
        originals = {folder / 'calibration.json': training / 'outputs' / 'phase7' / 'calibration.json'}
        for k in ROUNDS:
            for name in ('best.pt', 'metrics.json'):
                originals[folder / f'round_{k}' / name] = training / 'outputs' / 'runs' / self.run / f'round_{k}' / name
        different = [str(ours.relative_to(folder)) for ours, theirs in originals.items() if digest(ours) != digest(theirs)]
        lines.append(f'Model files identical to the training project: {len(originals) - len(different)}/{len(originals)}' + (f'; differ: {different}' if different else ''))
        cells = ROOT / 'datasets' / 'cells' / 'cells'
        typical, largest = 0.0, 0.0
        for k, member in zip(ROUNDS, model['members']):
            scores = pd.read_csv(training / 'outputs' / 'runs' / self.run / f'round_{k}' / 'image_scores.csv')
            scores = scores[scores.split == 'test'].sample(40, random_state=k)  # The script's self-test cells.
            canvases = [script.to_canvas(script.prepare(cells / f'{index}.png', 'qi')[0]) for index in scores.file_index]
            error = np.abs(self.round_probabilities(canvases, [member], temperature=False)[0][:, 0] - scores.score.values)
            typical, largest = max(typical, float(np.median(error))), max(largest, float(error.max()))
            lines.append(f'round {k}: 40 test cells, difference from the saved score: typical {np.median(error):.5f}, largest {error.max():.4f}')
        passed = same and not different and typical < 0.001 and largest < 0.05
        more_passed, more = self.extra_checks(model, training)
        return CheckReport(passed and more_passed, lines + more)

    def extra_checks(self, model: dict, training: Path) -> tuple[bool, list[str]]:
        return True, []


def demo_table(recipe: HomogeneousRecipe, model: dict, paths: list[Path]) -> list[dict]:
    """The script's output columns for each file, computed from the recipe's predictions (as the service makes them)."""
    rows = []
    calibration = model['calibration']
    for path in paths:
        with Image.open(path) as image:
            image.load()
            probabilities, per_round, mode, _, _ = recipe.predict(model, image)
        p = float(probabilities[0])
        rows.append({'file': path.name, 'prob_homogeneous': p, 'homogeneous': p >= calibration['cutoff'],
                     'homogeneous_strict': p >= calibration['cutoff_95spec'], 'uncertain': UNCERTAIN_BAND[0] < p < UNCERTAIN_BAND[1],
                     'named_pattern': script.CLASS_NAMES[int(np.argmax(probabilities))], 'named_pattern_prob': float(probabilities.max()),
                     'round_spread': float(per_round[:, 0].max() - per_round[:, 0].min()), 'mode': mode})
    return rows


def sample_test_cells(run: str, training: Path, per_round: int, seed: int) -> list[int]:
    """A few test-fold cells from each round (file indices into datasets/cells/cells/)."""
    from .checks import read_csv
    rng, chosen = random.Random(seed), []
    for k in ROUNDS:
        rows = [row for row in read_csv(training / 'outputs' / 'runs' / run / f'round_{k}' / 'image_scores.csv') if row['split'] == 'test']
        chosen += [int(row['file_index']) for row in rng.sample(rows, per_round)]
    return chosen
