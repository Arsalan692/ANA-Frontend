"""Helpers for recipe parity checks: does the website reproduce what the training project reported?

Used only by scripts/check_models.py, never by the running service. Checks read the training projects
and datasets outside this repository (read-only); see each recipe's `check`.
"""
import csv
from pathlib import Path
from typing import Callable, Iterable

import torch
from PIL import Image

from .base import CheckReport, ScreeningRecipe

ROOT = Path(__file__).resolve().parents[3].parent  # The folder that holds Project Code and the training projects.


def read_csv(path: Path) -> list[dict]:
    with path.open(newline='', encoding='utf-8') as file:
        return list(csv.DictReader(file))


def screening_parity(recipe: ScreeningRecipe, model, device: torch.device,
                     rows: Iterable[tuple[Path, bool, Callable[[], torch.Tensor]]],
                     expected: tuple[int, int, int, int], source: str) -> CheckReport:
    """For every held-out test image (original file, true label, tensor training fed the model):
    the recipe's tensor must be identical, and the confusion matrix must equal the reported TN, FP, FN, TP."""
    rows = list(rows)
    counts, different = {'tn': 0, 'fp': 0, 'fn': 0, 'tp': 0}, []
    for index, (path, truth, trained_on) in enumerate(rows, 1):
        with Image.open(path) as original:
            original.load()
            if not torch.equal(recipe.preprocess(original), trained_on()):
                different.append(path.name)
            called = recipe.predict(model, original, device).call == 'positive'
        counts[('t' if truth == called else 'f') + ('p' if called else 'n')] += 1
        print(f'  {index}/{len(rows)}', end='\r', flush=True)
    matches = tuple(counts.values()) == expected
    sensitivity, specificity = counts['tp'] / max(counts['tp'] + counts['fn'], 1), counts['tn'] / max(counts['tn'] + counts['fp'], 1)
    return CheckReport(matches and not different, [
        f'{len(rows)} held-out test images',
        f'Preprocessing parity: {len(rows) - len(different)}/{len(rows)} identical to training' + (f'; differ: {different[:5]}' if different else ''),
        'Confusion: TN {tn} · FP {fp} · FN {fn} · TP {tp}'.format(**counts) + f' · sensitivity {sensitivity:.3f} · specificity {specificity:.3f}',
        (f'Matches the reported figures ({source}).' if matches else f'DOES NOT MATCH the reported TN, FP, FN, TP {expected} ({source}).'),
    ])
