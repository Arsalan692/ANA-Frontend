"""ResNet18 field screening (frozen ImageNet backbone, trained 2-class head), AIDA binary split (`Model Training/`).

Files: models/resnet18-aida-512/aida_binary_resnet18_512_best.pt (a checkpoint dict with model_state_dict,
classes, epoch and configuration).

Repeats `Model Training/scripts/prepare_aida_resolution.py` and `notebooks/AIDA_Binary_Baseline_512.ipynb`
exactly: RGB, aspect-preserving Lanczos resize with black padding to 512 x 512 (nothing is cropped),
0..1 scaling, ImageNet normalisation, no brightness equalisation. The call is the argmax, as in the
notebook's validation. Changing any step silently changes the predictions.
"""
from pathlib import Path

import torch
from PIL import Image, ImageOps
from torch import nn
from torchvision import models

from .base import CheckReport, Detail, FieldPrediction, ScreeningRecipe, imagenet_tensor

WEIGHTS = 'aida_binary_resnet18_512_best.pt'
IMAGE_SIZE = 512
POSITIVE = 1  # Index of 'Positive' in the checkpoint's classes; verified when the file is loaded.


class ResNet18Aida512(ScreeningRecipe):
    id = 'resnet18-aida-512'
    label = 'ResNet18 · AIDA · 512 px'
    summary = 'Earlier baseline. Looks at the whole field (padded, not cropped). Confidence is not calibrated.'
    files = (WEIGHTS,)

    def load(self, folder: Path, device: torch.device):
        # weights_only: the checkpoint holds tensors and plain metadata, so no arbitrary pickle code runs.
        checkpoint = torch.load(folder / WEIGHTS, map_location=device, weights_only=True)
        config, classes = checkpoint['configuration'], list(checkpoint['classes'])
        if config['architecture'] != 'resnet18' or int(config['resolution']) != IMAGE_SIZE or classes.index('Positive') != POSITIVE:
            raise ValueError(f'Unexpected checkpoint: {config["architecture"]} at {config["resolution"]} px with classes {classes}')
        model = models.resnet18(weights=None)  # No download: every weight comes from the file.
        model.fc = nn.Linear(model.fc.in_features, len(classes))
        model.load_state_dict(checkpoint['model_state_dict'])  # Strict.
        return model.to(device).eval(), [{'label': 'Epoch', 'value': str(int(checkpoint['epoch']))}]

    def preprocess(self, image: Image.Image) -> torch.Tensor:
        return imagenet_tensor(ImageOps.pad(image.convert('RGB'), (IMAGE_SIZE, IMAGE_SIZE), method=Image.Resampling.LANCZOS, color=(0, 0, 0)))

    def decide(self, output: torch.Tensor) -> FieldPrediction:
        p_positive = output.softmax(1)[0, POSITIVE].item()
        return FieldPrediction('positive' if output.argmax(1).item() == POSITIVE else 'negative', p_positive)

    def details(self) -> list[Detail]:
        return [
            {'label': 'Training', 'value': 'AIDA public dataset (2,000 images) · fixed train / validation / test split · only the final layer trained'},
            {'label': 'Input', 'value': f'Whole field padded with black to {IMAGE_SIZE} × {IMAGE_SIZE} px'},
            {'label': 'Confidence', 'value': 'Softmax probability, not calibrated'},
        ]

    def check(self, model, folder: Path) -> CheckReport:
        """The reserved test split of `Model Training/` (298 images). Training read prepared 512 x 512
        padded PNGs; the notebook reported TN 79, FP 3, FN 6, TP 210 (analysis/aida/test_report)."""
        from .checks import ROOT, read_csv, screening_parity
        prepared = ROOT / 'Model Training' / 'prepared' / 'aida_binary_512'

        def trained_on(row):
            with Image.open(prepared / row['image_path']) as image:
                return imagenet_tensor(image.convert('RGB'))

        rows = [(ROOT / 'Model Training' / 'aida_project_database' / row['filename'], row['target'] == '1', lambda row=row: trained_on(row))
                for row in read_csv(prepared / 'test.csv')]
        return screening_parity(self, model, next(model.parameters()).device, rows, (79, 3, 6, 210), 'Model Training/analysis/aida/test_report')


RECIPE = ResNet18Aida512()
