"""Finds every model recipe and loads each model the first time it is chosen."""
from collections import OrderedDict
import hashlib
import importlib
from pathlib import Path
import pkgutil
import threading

import torch
from PIL import Image

from . import recipes
from .recipes.base import CellPrediction, CellRecipe, FieldPrediction, Recipe, ScreeningRecipe

TASKS = ('screening', 'cells')


class UnknownModel(LookupError):
    """No recipe has this id for this task."""


class ModelUnavailable(LookupError):
    """The recipe exists but its files are not in models/<id>/."""


def fingerprint(folder: Path, recipe: Recipe) -> tuple[str, str]:
    """A short SHA-256 over every weights file, so any result can be traced to the exact files that made it."""
    paths = sorted({path for pattern in recipe.files for path in folder.glob(pattern) if path.suffix in ('.pt', '.pth', '.safetensors')})
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.read_bytes())
    name = paths[0].relative_to(folder).as_posix() if len(paths) == 1 else f'{len(paths)} weights files'
    return name, digest.hexdigest()[:12]


class LoadedModel:
    def __init__(self, recipe: Recipe, folder: Path, device: torch.device):
        self.recipe, self.device = recipe, device
        self.model, file_facts = recipe.load(folder, device)
        checkpoint, sha256 = fingerprint(folder, recipe)
        self.info = {'id': recipe.id, 'task': recipe.task, 'label': recipe.label, 'checkpoint': checkpoint, 'sha256': sha256,
                     'details': [{'label': 'Checkpoint', 'value': f'{recipe.id}/{checkpoint} · {sha256}'}, *file_facts, *recipe.details()]}

    def screen(self, images: list[Image.Image]) -> list[FieldPrediction]:
        assert isinstance(self.recipe, ScreeningRecipe)
        # One image at a time: models may take different input sizes, and results never depend on the batch.
        return [self.recipe.predict(self.model, image, self.device) for image in images]

    def classify(self, images: list[Image.Image]) -> list[CellPrediction]:
        assert isinstance(self.recipe, CellRecipe)
        return [self.recipe.classify(self.model, image) for image in images]


def discover() -> list[Recipe]:
    """Every module in app/recipes/ that defines RECIPE, in file-name order. Files starting with _ are templates."""
    found = []
    for module in sorted(pkgutil.iter_modules(recipes.__path__), key=lambda item: item.name):
        if module.name.startswith('_') or module.ispkg:
            continue
        recipe = getattr(importlib.import_module(f'{recipes.__name__}.{module.name}'), 'RECIPE', None)
        if recipe is not None:
            found.append(recipe)
    ids = [recipe.id for recipe in found]
    if len(ids) != len(set(ids)):
        raise RuntimeError(f'Two recipes share an id: {ids}')
    if unknown := [recipe.id for recipe in found if recipe.task not in TASKS]:
        raise RuntimeError(f'Recipes with an unknown task: {unknown}')
    return found


class Registry:
    def __init__(self, models: Path, defaults: dict[str, str], max_loaded: int, found: list[Recipe] | None = None):
        self.models, self.max_loaded = models, max_loaded
        self.recipes = {recipe.id: recipe for recipe in (found if found is not None else discover())}
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self._loaded: OrderedDict[str, LoadedModel] = OrderedDict()
        self._lock = threading.Lock()
        # Per task: the configured default, or the first model whose files are present.
        self.defaults: dict[str, str | None] = {}
        for task in TASKS:
            available = [recipe.id for recipe in self.recipes.values() if recipe.task == task and self.available(recipe.id)]
            self.defaults[task] = defaults.get(task) if defaults.get(task) in available else (available[0] if available else None)

    def available(self, model_id: str) -> bool:
        return self.recipes[model_id].installed(self.models)

    def describe(self) -> list[dict]:
        """What the website shows before any image is sent. Does not load any weights."""
        return [{'id': recipe.id, 'task': recipe.task, 'label': recipe.label, 'summary': recipe.summary,
                 'available': self.available(recipe.id), 'default': self.defaults[recipe.task] == recipe.id,
                 'folder': f'models/{recipe.id}', 'details': recipe.details(), **recipe.describe()} for recipe in self.recipes.values()]

    def get(self, model_id: str | None, task: str) -> LoadedModel:
        model_id = model_id or self.defaults.get(task)
        if model_id not in self.recipes or self.recipes[model_id].task != task:
            raise UnknownModel(model_id)
        if not self.available(model_id):
            raise ModelUnavailable(model_id)
        with self._lock:  # Two requests for a new model must not load it twice.
            if model_id not in self._loaded:
                recipe = self.recipes[model_id]
                self._loaded[model_id] = LoadedModel(recipe, recipe.folder(self.models), self.device)
                while len(self._loaded) > self.max_loaded:  # Keep memory bounded: drop the least recently used.
                    self._loaded.popitem(last=False)
            self._loaded.move_to_end(model_id)
            return self._loaded[model_id]

    def loaded(self) -> list[str]:
        return list(self._loaded)

