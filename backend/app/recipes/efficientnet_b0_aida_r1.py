"""EfficientNet-B0 field screening, AIDA cross-validation round 1 (`Second Model Training/`), temperature-calibrated.

Files: models/efficientnet-b0-aida-r1/best.pt (a plain state_dict).

The steps, constants and their order come from the training project's reference implementation and must
not change: RGB, shorter side resized to 512 with Lanczos (aspect ratio kept), centre 512 x 512 crop,
0..1 scaling, ImageNet normalisation. No contrast stretching, equalisation or brightness adjustment:
brightness is the signal, so a dark image stays dark. Changing any step silently changes the predictions.
"""
import math
from pathlib import Path

import numpy as np
import timm
import torch
from PIL import Image

from .base import CheckReport, Detail, FieldPrediction, ScreeningRecipe, imagenet_tensor

IMAGE_SIZE = 512
TEMPERATURE = 1.754  # Calibrated confidence: probability = sigmoid(logit / TEMPERATURE).
THRESHOLD = 0.5      # Probability at or above this is ANA positive.
SIXTEEN_BIT = 65535.0


def to_rgb(image: Image.Image) -> Image.Image:
    """RGB conversion. 16-bit and float images are first scaled to 8-bit by their full range, never
    by their own minimum and maximum (that would be a contrast stretch). PIL's convert() clips them."""
    if image.mode.startswith('I;16') or image.mode in ('I', 'F'):
        values = np.asarray(image, dtype=np.float64)
        if image.mode == 'F' and values.max(initial=0) <= 1.0:
            values = values * 255.0  # A 0..1 float image.
        elif image.mode != 'F' or values.max(initial=0) > 255.0:
            values = values * (255.0 / SIXTEEN_BIT)  # 16-bit data, whatever container holds it.
        image = Image.fromarray(np.clip(np.rint(values), 0, 255).astype(np.uint8))
    return image.convert('RGB')


def centre_crop(image: Image.Image) -> Image.Image:
    left, top = int(round((image.width - IMAGE_SIZE) / 2.0)), int(round((image.height - IMAGE_SIZE) / 2.0))
    return image.crop((left, top, left + IMAGE_SIZE, top + IMAGE_SIZE))


class EfficientNetB0AidaRound1(ScreeningRecipe):
    id = 'efficientnet-b0-aida-r1'
    label = 'EfficientNet-B0 · AIDA · 512 px'
    summary = 'Calibrated confidence. Looks at the centre square of each field. Trained on the public AIDA dataset.'
    files = ('best.pt',)

    def load(self, folder: Path, device: torch.device):
        # pretrained=False: the weights come from the file and nothing is downloaded.
        model = timm.create_model('efficientnet_b0', pretrained=False, num_classes=1)
        # weights_only: the file is a plain state_dict, so no arbitrary pickle code runs.
        model.load_state_dict(torch.load(folder / 'best.pt', map_location=device, weights_only=True))  # Strict.
        return model.to(device).eval(), []

    def preprocess(self, image: Image.Image) -> torch.Tensor:
        im = to_rgb(image)
        scale = IMAGE_SIZE / min(im.size)  # Shorter side -> 512, aspect ratio kept. Smaller images are upscaled.
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
        return imagenet_tensor(centre_crop(im))  # The model sees the centre square.

    def decide(self, output: torch.Tensor) -> FieldPrediction:
        p_positive = 1.0 / (1.0 + math.exp(-output.item() / TEMPERATURE))
        return FieldPrediction('positive' if p_positive >= THRESHOLD else 'negative', p_positive)

    def details(self) -> list[Detail]:
        return [
            {'label': 'Training', 'value': 'AIDA HEp-2 public dataset · cross-validation round 1 (fold 1 held out as its test set)'},
            {'label': 'Input', 'value': f'Shorter side resized to {IMAGE_SIZE} px, then the centre {IMAGE_SIZE} × {IMAGE_SIZE} px square'},
            {'label': 'Confidence', 'value': f'Temperature-scaled probability (T = {TEMPERATURE}); positive from {THRESHOLD:.0%}'},
        ]

    def check(self, model, folder: Path) -> CheckReport:
        """Fold 1 of `Second Model Training/`, the test fold of round 1. Training read processed PNGs
        (shorter side 512) and centre-cropped them; the reported round-1 result is sensitivity 0.900 and
        specificity 0.983 on 300 positives and 116 negatives, i.e. TN 114, FP 2, FN 30, TP 270."""
        from .checks import ROOT, read_csv, screening_parity
        project = ROOT / 'Second Model Training' / 'data'
        raw_file = {row['image_path']: row['raw_file'] for row in read_csv(project / 'aida_file_map.csv')}

        def trained_on(row):
            with Image.open(project / 'processed' / row['image_path']) as image:
                return imagenet_tensor(centre_crop(image.convert('RGB')))

        rows = [(ROOT / 'Model Training' / 'aida_project_database' / raw_file[row['image_path']], row['label'] == '1', lambda row=row: trained_on(row))
                for row in read_csv(project / 'manifest.csv') if row['fold'] == '1']
        return screening_parity(self, model, next(model.parameters()).device, rows, (114, 2, 30, 270), 'Second Model Training/Docs/Phase_Plan_ANA_PosNeg.md, round 1')


RECIPE = EfficientNetB0AidaRound1()
