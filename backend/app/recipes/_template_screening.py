"""TEMPLATE for a new FIELD SCREENING model (whole microscopy field -> ANA positive / negative).

Files starting with _ are ignored by the service. To add a model:

1. Put its files in models/<your-id>/ (for example models/convnext-tiny-aida-r2/best.pt).
2. Copy this file to a new name in this folder (for example convnext_tiny_aida_r2.py) and fill in every
   TODO. Copy the preprocessing from the TRAINING code, line by line; never rewrite it from memory.
3. Run from backend/:  .venv\\Scripts\\python.exe scripts\\check_models.py --model <your-id>
   It must pass before the model is used. Then restart the service: the website lists it automatically.

efficientnet_b0_aida_r1.py (one logit, calibrated) and resnet18_aida_512.py (two classes, argmax) are
complete examples to compare with.
"""
import math
from pathlib import Path

import timm
import torch
from PIL import Image

from .base import CheckReport, Detail, FieldPrediction, ScreeningRecipe, imagenet_tensor

IMAGE_SIZE = 512   # TODO: the training input size.
THRESHOLD = 0.5    # TODO: probability at or above which a field is positive.


class TemplateScreening(ScreeningRecipe):
    id = 'my-new-model'                 # TODO: URL-safe and unique; also the folder name in models/.
    label = 'Architecture · Data · Size'  # TODO: shown in the model picker and on every result.
    summary = 'One line: what it was trained on and how it behaves.'  # TODO
    files = ('best.pt',)                 # TODO: every file the model needs, relative to models/<id>/.

    def load(self, folder: Path, device: torch.device):
        # TODO: build the same architecture as training, with pretrained weights OFF (nothing may be downloaded).
        model = timm.create_model('efficientnet_b0', pretrained=False, num_classes=1)
        # weights_only=True for a plain state_dict or a checkpoint dict of tensors and simple values.
        model.load_state_dict(torch.load(folder / 'best.pt', map_location=device, weights_only=True))  # Strict.
        return model.to(device).eval(), []  # eval() is required. The list may hold facts read from the file.

    def preprocess(self, image: Image.Image) -> torch.Tensor:
        # TODO: exactly the training steps, in the same order (colour mode, resize, crop or pad, normalisation).
        return imagenet_tensor(image.convert('RGB').resize((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.LANCZOS))

    def decide(self, output: torch.Tensor) -> FieldPrediction:
        # TODO: one logit -> sigmoid (divide by the temperature if calibrated); two classes -> softmax / argmax.
        p_positive = 1.0 / (1.0 + math.exp(-output.item()))
        return FieldPrediction('positive' if p_positive >= THRESHOLD else 'negative', p_positive)

    def details(self) -> list[Detail]:
        return [  # TODO: plain words, shown under "Analysis details".
            {'label': 'Training', 'value': 'Dataset · split · which part was held out'},
            {'label': 'Input', 'value': f'How a field becomes a {IMAGE_SIZE} × {IMAGE_SIZE} px input'},
            {'label': 'Confidence', 'value': 'Calibrated or not; the cut-off'},
        ]

    def check(self, model, folder: Path) -> CheckReport:
        # TODO: reproduce the training project's reported test result. With original test images, their labels
        # and the tensors training fed the model, use checks.screening_parity (see the two complete recipes).
        return CheckReport(False, ['No parity check written for this model yet.'])


RECIPE = TemplateScreening()
