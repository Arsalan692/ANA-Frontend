"""Homogeneous (AC-1) or not: the COMPARISON model of `Code Part/Model Training one vs rest/` (run
ovr_strong_aug). Five one-vs-rest ResNet18 round models (timm, one greyscale input channel, one logit), each
calibrated with its own temperature: p = sigmoid(logit / T_k), averaged. It names no pattern.

The training script (vendor/predict_homogeneous.py) only loads the 6-class run, so build() repeats its
load_models() with one output, and round_probabilities() its predict_canvases() with a sigmoid. All image
preparation is the script's own code. Shared code and the parity check: homogeneous_shared.py.
"""
import json
from pathlib import Path

import numpy as np
import torch

from .base import Detail
from .homogeneous_shared import ROUNDS, HomogeneousRecipe
from .vendor import predict_homogeneous as script


class HomogeneousOneVsRest(HomogeneousRecipe):
    id = 'homogeneous-ovr-resnet18'
    label = 'ResNet18 ensemble · Homogeneous vs rest'
    summary = 'Comparison model: only says whether the cell is Homogeneous (AC-1). Five calibrated one-vs-rest models averaged; trained on the Qi et al. cell set.'
    run, head = 'ovr_strong_aug', 'ovr'
    classes = ()
    limits = (
        'Upload one cell per image. Greyscale crops like the training cells (up to 100 px) are used as they are.',
        'Other images, such as green FITC photos, are converted automatically. That is experimental: untested, and the five models often disagree on them.',
        'It only says whether a cell is Homogeneous; it does not name other patterns.',
        'For research and demonstration only, not for diagnosis.',
    )

    def build(self, folder: Path):
        import timm
        calibration = json.loads((folder / 'calibration.json').read_text())['models'][self.run]
        members = []
        for k in ROUNDS:
            metrics = json.loads((folder / f'round_{k}' / 'metrics.json').read_text())
            net = timm.create_model(metrics['model'], pretrained=False, num_classes=1, in_chans=1)
            net.load_state_dict(torch.load(folder / f'round_{k}' / 'best.pt', map_location='cpu', weights_only=True))
            members.append({'net': net.eval(), 'mean': metrics['mean'], 'std': metrics['std'],
                            'T': calibration['temperature_per_round'][str(k)]})
        return members, calibration

    def round_probabilities(self, canvases, members, temperature=True) -> np.ndarray:
        out = []
        with torch.no_grad():
            for member in members:
                probabilities = []
                for start in range(0, len(canvases), 256):
                    logits = member['net'](script.network_input(canvases[start:start + 256], member['mean'], member['std'])).double()
                    probabilities.append(torch.sigmoid(logits / (member['T'] if temperature else 1.0)).numpy())
                out.append(np.concatenate(probabilities))
        return np.stack(out)  # (rounds, cells, 1)

    def details(self) -> list[Detail]:
        return [
            {'label': 'Models', 'value': 'ResNet18 one-vs-rest, one per cross-validation round (5); each calibrated with its own temperature, then averaged'},
            {'label': 'Training', 'value': 'Qi et al. HEp-2 single-cell set: Homogeneous against the five other patterns; folds split by slide blocks'},
            {'label': 'Input', 'value': 'Greyscale cell on a 100 × 100 px canvas, brightness stretch, centre 88 px enlarged to 176 px, as in training'},
            {'label': 'Answer', 'value': 'Homogeneous or not at the validation cut-off (best balanced accuracy) and at a strict cut-off (95% validation specificity)'},
            {'label': 'Test result', 'value': 'Per round model: AUC 0.964 ± 0.026, balanced accuracy 0.897 (the 6-class model is slightly ahead)'},
        ]


RECIPE = HomogeneousOneVsRest()
