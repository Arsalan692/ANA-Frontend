"""ResNet18 ANA positive/negative screening model, with the exact preprocessing used in training.

Training images were produced by `Model Training/scripts/prepare_aida_resolution.py` and read by
`notebooks/AIDA_Binary_Baseline_512.ipynb`. Inference repeats those steps exactly: RGB conversion,
aspect-preserving Lanczos resize with black padding to a square, no brightness equalisation, then
ToTensor and ImageNet normalisation. Changing any step silently changes the predictions.
"""
from dataclasses import dataclass
import hashlib
from pathlib import Path

import torch
from PIL import Image, ImageOps
from torch import nn
from torchvision import models, transforms

TO_TENSOR = transforms.Compose([transforms.ToTensor(), transforms.Normalize([.485, .456, .406], [.229, .224, .225])])


def prepare(image: Image.Image, size: int) -> Image.Image:
    """Same as prepare_aida_resolution.py: RGB, Lanczos, preserved aspect ratio, black padding."""
    return ImageOps.pad(image.convert('RGB'), (size, size), method=Image.Resampling.LANCZOS, color=(0, 0, 0))


@dataclass(frozen=True)
class FieldPrediction:
    call: str  # 'positive' | 'negative'
    probability_positive: float

    @property
    def confidence(self) -> float:
        """Softmax probability of the predicted class. Not calibrated; not clinical certainty."""
        return self.probability_positive if self.call == 'positive' else 1 - self.probability_positive


class ScreeningModel:
    def __init__(self, path: Path):
        # weights_only: the checkpoint holds tensors and plain metadata, so no arbitrary pickle code runs.
        checkpoint = torch.load(path, map_location='cpu', weights_only=True)
        config = checkpoint['configuration']
        classes = list(checkpoint['classes'])
        if config['architecture'] != 'resnet18' or sorted(classes) != ['Negative', 'Positive']:
            raise ValueError(f'Unexpected checkpoint: {config["architecture"]} with classes {classes}')
        self.resolution = int(config['resolution'])
        self.positive_index = classes.index('Positive')
        model = models.resnet18(weights=None)
        model.fc = nn.Linear(model.fc.in_features, len(classes))
        model.load_state_dict(checkpoint['model_state_dict'])
        self.model = model.eval()
        images = config.get('dataset_summary', {}).get('included_images')
        self.info = {
            'label': f'ResNet18 · AIDA binary · {self.resolution} px',
            'checkpoint': path.name,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()[:12],
            'epoch': int(checkpoint['epoch']),
            'resolution': self.resolution,
            'trainingData': f'AIDA public dataset ({images:,} images)' if images else 'AIDA public dataset',
        }

    @torch.inference_mode()
    def predict(self, images: list[Image.Image]) -> list[FieldPrediction]:
        batch = torch.stack([TO_TENSOR(prepare(image, self.resolution)) for image in images])
        logits = self.model(batch)
        probabilities = logits.softmax(1)[:, self.positive_index].tolist()
        # argmax, as in the training notebook's validation.
        calls = ['positive' if index == self.positive_index else 'negative' for index in logits.argmax(1).tolist()]
        return [FieldPrediction(call, probability) for call, probability in zip(calls, probabilities)]
