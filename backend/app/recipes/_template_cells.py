"""TEMPLATE for a new CELL PATTERN model (one cropped cell -> a pattern family).

Files starting with _ are ignored by the service. To add a model:

1. Put its files in models/<your-id>/, laid out as the training project wrote them.
2. If the training project provides a self-contained inference script (like predict_pattern.py), copy it
   UNCHANGED into vendor/ under a new name and call it from here, as cells_resnet18_adjusted.py does.
   Otherwise copy the preprocessing from the TRAINING code, line by line; never rewrite it from memory.
3. Copy this file to a new name in this folder, fill in every TODO, then run from backend/:
       .venv\\Scripts\\python.exe scripts\\check_models.py --model <your-id>
   It must pass before the model is used. Restart the service: the Cell patterns page lists it.

cells_resnet18_adjusted.py is a complete example.
"""
from pathlib import Path

import timm
import torch
from PIL import Image

from .base import CellPrediction, CellRecipe, CheckReport, Detail, imagenet_tensor

CLASSES = ('Homogeneous', 'Speckled', 'Nucleolar')  # TODO: the model's output order.


class TemplateCells(CellRecipe):
    id = 'my-new-cell-model'               # TODO: URL-safe and unique; also the folder name in models/.
    label = 'Architecture · N pattern families'  # TODO
    summary = 'One line: what it was trained on and how it behaves.'  # TODO
    files = ('best.pt',)                   # TODO: every file it needs, relative to models/<id>/; globs allowed.
    classes = CLASSES
    min_confidence = 0.7                   # TODO: below this an answer is marked uncertain.
    oversized_side = 200                   # TODO: about twice the largest training cell, in pixels.
    limits = (                             # TODO: what the user must know; shown next to the upload.
        'Upload one cropped cell per image, not a whole microscope field.',
        'The model knows only these families; any other pattern still gets one of these names.',
        'For research and demonstration only, not for diagnosis.',
    )

    def load(self, folder: Path, device: torch.device):
        model = timm.create_model('resnet18', pretrained=False, num_classes=len(CLASSES))  # TODO: as in training.
        model.load_state_dict(torch.load(folder / 'best.pt', map_location=device, weights_only=True))  # Strict.
        return model.to(device).eval(), []

    @torch.inference_mode()
    def classify(self, model, image: Image.Image) -> CellPrediction:
        # TODO: exactly the training preprocessing, then softmax (divide by the temperature if calibrated).
        x = imagenet_tensor(image.convert('RGB').resize((224, 224), Image.Resampling.BILINEAR))
        probabilities = model(x.to(next(model.parameters()).device)).softmax(1)[0].tolist()
        best = max(range(len(CLASSES)), key=probabilities.__getitem__)
        return CellPrediction(CLASSES[best], probabilities[best], probabilities[best] < self.min_confidence,
                              dict(zip(CLASSES, probabilities)))  # model_view=... is optional (display only).

    def details(self) -> list[Detail]:
        return [  # TODO
            {'label': 'Training', 'value': 'Dataset · split'},
            {'label': 'Confidence', 'value': 'Calibrated or not; the uncertainty cut-off'},
        ]

    def check(self, model, folder: Path) -> CheckReport:
        # TODO: reproduce the training project's saved test outputs (see cells_resnet18_adjusted.py).
        return CheckReport(False, ['No parity check written for this model yet.'])


RECIPE = TemplateCells()
