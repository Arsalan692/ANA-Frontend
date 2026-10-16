"""What every model must provide: a recipe.

A recipe is one Python file in this folder. It ties one model folder in `models/` to the exact code
that built and fed the model in training, so models trained on different data with different
preprocessing sit side by side. There are two kinds, one per task:

- ScreeningRecipe: one microscopy FIELD -> ANA positive or negative. Fields of a sample are combined
  into one sample result by app/aggregation.py.
- CellRecipe: one cropped CELL -> a pattern family. Cells are never combined.

To add a model: put its files in models/<id>/, copy _template_screening.py or _template_cells.py to a
new file here, fill it in, and run scripts/check_models.py --model <id>. Restart the service; the
website lists it automatically. Never rewrite preprocessing from memory: copy it from the training code.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, ClassVar, Literal

import numpy as np
import torch
from PIL import Image

Detail = dict[str, str]  # {'label': ..., 'value': ...}, shown as-is under "Model details" in the website.

IMAGENET_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
IMAGENET_STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)


def imagenet_tensor(image: Image.Image) -> torch.Tensor:
    """An RGB image to a (1, 3, H, W) tensor: 0..1 scaling, then ImageNet normalisation."""
    x = torch.from_numpy(np.asarray(image, dtype=np.float32) / 255.0).permute(2, 0, 1)  # HWC -> CHW
    return ((x - IMAGENET_MEAN) / IMAGENET_STD).unsqueeze(0)


@dataclass
class CheckReport:
    """Result of a recipe's parity check against its training project (scripts/check_models.py)."""
    passed: bool
    lines: list[str] = field(default_factory=list)


class Recipe(ABC):
    task: ClassVar[Literal['screening', 'cells']]
    id: str        # Stable, URL-safe; also the folder name in models/.
    label: str     # Name shown in the model picker and on every result.
    summary: str   # One line under the picker: what it was trained on and how it behaves.
    files: tuple[str, ...]  # Paths inside models/<id>/ that must exist; globs allowed (e.g. 'round_*/best.pt').

    def folder(self, models: Path) -> Path:
        return models / self.id

    def installed(self, models: Path) -> bool:
        folder = self.folder(models)
        return all(any(folder.glob(pattern)) for pattern in self.files)

    @abstractmethod
    def load(self, folder: Path, device: torch.device) -> tuple[Any, list[Detail]]:
        """Build the model from models/<id>/ and return it ready for inference (eval mode), with any facts
        read from its files (for example the epoch). Nothing may be downloaded."""

    @abstractmethod
    def details(self) -> list[Detail]:
        """Facts about training, input and confidence, in plain words."""

    def describe(self) -> dict:
        """Extra facts the website needs before any image is sent. Override to add some."""
        return {}

    def check(self, model: Any, folder: Path) -> CheckReport:
        """Reproduce the training project's reported result through this recipe. See scripts/check_models.py."""
        return CheckReport(False, ['No parity check written for this model yet.'])


@dataclass(frozen=True)
class FieldPrediction:
    call: Literal['positive', 'negative']
    probability_positive: float

    @property
    def confidence(self) -> float:
        """The model's probability for its call, 0.5 to 1. Not clinical certainty."""
        return self.probability_positive if self.call == 'positive' else 1 - self.probability_positive


class ScreeningRecipe(Recipe):
    task = 'screening'

    @abstractmethod
    def preprocess(self, image: Image.Image) -> torch.Tensor:
        """One decoded field to the (1, C, H, W) tensor the model was trained on."""

    @abstractmethod
    def decide(self, output: torch.Tensor) -> FieldPrediction:
        """The model's raw output for one field to a call and a probability of positive."""

    @torch.inference_mode()
    def predict(self, model: Any, image: Image.Image, device: torch.device) -> FieldPrediction:
        return self.decide(model(self.preprocess(image).to(device)))


@dataclass(frozen=True)
class CellPrediction:
    family: str
    confidence: float  # Probability of `family`, 0..1. Not clinical certainty.
    uncertain: bool
    probabilities: dict[str, float]  # One entry per class, in `classes` order.
    model_view: str | None = None  # Optional PNG data URL of the image as the model is given it (display only).
    extra: dict = field(default_factory=dict)  # Anything else worth returning, e.g. {'modelsUsed': 5}.


class CellRecipe(Recipe):
    task = 'cells'
    classes: tuple[str, ...]  # Pattern families the model can name, in output order.
    min_confidence: float     # Below this an answer is marked uncertain.
    limits: tuple[str, ...]   # What the user must know before trusting a result; shown next to the upload.
    # Cells far larger than the training cells are probably not one cropped cell; the website warns.
    oversized_side: int = 200

    @abstractmethod
    def classify(self, model: Any, image: Image.Image) -> CellPrediction:
        """One decoded cell image, exactly as uploaded, to a pattern family."""

    def describe(self) -> dict:
        return {'classes': list(self.classes), 'minConfidence': self.min_confidence, 'limits': list(self.limits)}
