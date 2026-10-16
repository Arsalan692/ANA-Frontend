"""Cell pattern families: five ResNet18 models (one per cross-validation round), "adjusted" brightness mode,
trained in `Code Part/Model Training on Basic Classes/` on the Qi et al. HEp-2 single-cell set.

Files: models/cells-resnet18-adjusted/round_k/best.pt and round_k/metrics.json for each round, and
calibration/temperatures.json, laid out exactly as the training project wrote them.

All preprocessing and prediction live in vendor/predict_pattern.py, copied UNCHANGED from the training
project's scripts/. This recipe only creates the predictor and passes it each uploaded image untouched.
Never edit the vendored script or resize, convert or adjust an image here; replace the script with a new
copy from the training project instead, then run scripts/check_models.py.
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

from .base import CellPrediction, CellRecipe, CheckReport, Detail
from .vendor.predict_pattern import CANVAS, CLASS_NAMES, MIN_CONFIDENCE, PatternPredictor, to_canvas, to_grey

TRAINING = 'Code Part/Model Training on Basic Classes'


class CellsResNet18Adjusted(CellRecipe):
    id = 'cells-resnet18-adjusted'
    label = 'ResNet18 ensemble · 3 pattern families'
    summary = 'Five models averaged, calibrated. Trained on single greyscale cells from the Qi et al. HEp-2 cell set.'
    files = ('round_*/best.pt', 'round_*/metrics.json', 'calibration/temperatures.json')
    classes = tuple(CLASS_NAMES)
    min_confidence = MIN_CONFIDENCE
    oversized_side = 200  # Training cells were 62 to 100 px across.
    limits = (
        'Upload one cropped cell per image, not a whole microscope field.',
        f'The model knows only {", ".join(CLASS_NAMES[:-1])} and {CLASS_NAMES[-1]}. Any other pattern, or a negative cell, still gets one of these names.',
        f'Cells should be roughly 60 to {CANVAS} pixels across. Larger images are shrunk to {CANVAS} pixels; very different scales reduce accuracy.',
        'For research and demonstration only, not for diagnosis.',
    )

    def load(self, folder: Path, device: torch.device):
        predictor = PatternPredictor(model_dir=folder, device=str(device))  # Every round found: probabilities averaged.
        facts = json.loads(next(folder.glob('round_*/metrics.json')).read_text())
        rounds = ', '.join(str(member['round']) for member in predictor.members)
        return predictor, [{'label': 'Loaded', 'value': f'{len(predictor.members)} models (rounds {rounds}); centre {facts["crop"]} px enlarged to {facts["input_size"]} px'}]

    def details(self) -> list[Detail]:
        return [
            {'label': 'Models', 'value': 'ResNet18, one per cross-validation round; their probabilities are averaged'},
            {'label': 'Training', 'value': 'Qi et al. HEp-2 single-cell set (greyscale cells cut from I3A specimen images)'},
            {'label': 'Input', 'value': f'One cell, greyscale, centred on a {CANVAS} × {CANVAS} px canvas with a brightness stretch, as in training'},
            {'label': 'Confidence', 'value': f'Temperature-calibrated probability; below {MIN_CONFIDENCE:.0%} the answer is marked uncertain'},
        ]

    def classify(self, model: PatternPredictor, image: Image.Image) -> CellPrediction:
        result = model.predict(image)  # The training project's code, given the image exactly as uploaded.
        return CellPrediction(result['family'], result['confidence'], result['uncertain'], result['probabilities'],
                              model_view=model_view(image), extra={'modelsUsed': result['models_used']})

    def check(self, model, folder: Path) -> CheckReport:
        """The vendored script and the weights must be byte-identical to the training project's. Then, per round,
        200 test-fold cells from the original dataset go through the website's copy and are compared with the
        raw outputs training saved (image_logits.csv). Those came from a GPU in mixed precision, so differences
        up to 0.1 are expected; answers must match except near-ties (top two saved outputs closer together than
        twice that cell's own numeric difference), where either answer is noise."""
        from .checks import ROOT, read_csv
        training = ROOT / TRAINING
        digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()  # noqa: E731
        vendored = Path(__file__).parent / 'vendor' / 'predict_pattern.py'
        same_files = digest(vendored) == digest(training / 'scripts' / 'predict_pattern.py')
        lines = [f'predict_pattern.py identical to the training project: {same_files}']
        rng, worst, agree, ties, total = random.Random(42), 0.0, 0, 0, 0
        for weights in sorted(folder.glob('round_*/best.pt')):
            k = int(weights.parent.name.split('_')[1])
            original = training / 'outputs' / 'resnet18_adjusted' / f'round_{k}'
            same_weights = digest(weights) == digest(original / 'best.pt')
            saved = rng.sample([row for row in read_csv(original / 'image_logits.csv') if row['split'] == 'test'], 200)
            one_round = PatternPredictor(model_dir=folder, rounds=[k])
            new = one_round.logits([to_canvas(to_grey(Image.open(ROOT / 'datasets' / 'cells' / 'cells' / f'{row["file_index"]}.png'))) for row in saved])[0]
            old = np.array([[float(row[f'logit_{name}']) for name in CLASS_NAMES] for row in saved])
            per_cell, top_two, differs = np.abs(new - old).max(axis=1), np.sort(old, axis=1)[:, -2:], new.argmax(1) != old.argmax(1)
            tied = int((differs & ((top_two[:, 1] - top_two[:, 0]) < 2 * per_cell)).sum())
            same = int((~differs).sum())
            worst, agree, ties, total = max(worst, float(per_cell.max())), agree + same, ties + tied, total + len(saved)
            same_files &= same_weights
            lines.append(f'round {k}: weights identical {same_weights} · largest raw-output difference {per_cell.max():.4f} · same answer {same}/{len(saved)}'
                         + (f' · {tied} near-tie' if tied else '') + (f' · {int(differs.sum()) - tied} REAL MISMATCH' if differs.sum() > tied else ''))
        lines.append(f'{agree}/{total} answers identical, {ties} near-tie, {total - agree - ties} real mismatch; largest raw-output difference {worst:.4f} (tolerance 0.1)')
        return CheckReport(same_files and worst < 0.1 and agree + ties == total, lines)


def model_view(image: Image.Image) -> str:
    """What the model is given, as a PNG data URL: the training script's own grey, centred, brightness-stretched
    canvas. For display only (raw cell crops are too dark to see); the prediction never uses this copy."""
    buffer = BytesIO()
    Image.fromarray(to_canvas(to_grey(image))).save(buffer, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')


RECIPE = CellsResNet18Adjusted()
