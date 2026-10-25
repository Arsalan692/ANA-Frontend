r"""Check every installed model, or one: does the website reproduce what its training project reported?

For each model it (1) loads the files in models/<id>/, (2) runs one synthetic image through it to prove
the recipe works end to end, and (3) runs the recipe's own parity check (`check` in its recipe file),
which compares preprocessing and results with the training project on the model's held-out test data.

Run from backend/ before relying on a new model, and after any change to a recipe or a weights file:
    .venv\Scripts\python.exe scripts\check_models.py
    .venv\Scripts\python.exe scripts\check_models.py --model cells-resnet18-adjusted
    .venv\Scripts\python.exe scripts\check_models.py --quick        (steps 1 and 2 only, seconds)
"""
import argparse
from pathlib import Path
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config  # noqa: E402
from app.registry import Registry  # noqa: E402


def synthetic(task: str) -> Image.Image:
    """A bright green blob on black: a field-sized image for screening, a cell-sized one for cells."""
    size = (640, 480) if task == 'screening' else (80, 72)
    rows, columns = np.mgrid[0:size[1], 0:size[0]]
    blob = (200 * np.exp(-(((columns - size[0] / 2) / (size[0] / 4)) ** 2 + ((rows - size[1] / 2) / (size[1] / 4)) ** 2))).astype(np.uint8)
    return Image.fromarray(np.dstack([np.zeros_like(blob), blob, np.zeros_like(blob)]))


def main():
    parser = argparse.ArgumentParser(description='Check the models against their training projects.')
    parser.add_argument('--model', help='One model id; default: every model whose files are present')
    parser.add_argument('--quick', action='store_true', help='Only load each model and run one synthetic image')
    args = parser.parse_args()
    registry = Registry(config.MODELS, config.DEFAULT_MODELS, max_loaded=1)
    if args.model and args.model not in registry.recipes:
        parser.error(f'unknown model {args.model!r}; known: {", ".join(registry.recipes)}')
    chosen = [args.model] if args.model else list(registry.recipes)
    results = []
    for model_id in chosen:
        recipe = registry.recipes[model_id]
        print(f'\n{model_id}  ({recipe.task}: {recipe.label})')
        if not registry.available(model_id):
            print(f'  NOT INSTALLED: expected {", ".join(recipe.files)} in models/{model_id}/')
            results.append(bool(not args.model))  # Skipping a missing model is fine unless it was asked for.
            continue
        started = time.perf_counter()
        loaded = registry.get(model_id, recipe.task)
        image = synthetic(recipe.task)
        if recipe.task == 'screening':
            field = loaded.screen([image])[0]
            answer = f'{field.call} (P positive {field.probability_positive:.3f})'
        else:
            cell = loaded.classify([image])[0]
            answer = ' · '.join(filter(None, [
                cell.family and f'{cell.family} {cell.confidence:.1%}',
                cell.question and f'{cell.question.label} {cell.question.probability:.1%}'])) + (' uncertain' if cell.uncertain else '')
        print(f'  Loaded {loaded.info["checkpoint"]} · {loaded.info["sha256"]} in {time.perf_counter() - started:.1f} s; synthetic image -> {answer}')
        if args.quick:
            results.append(True)
            continue
        report = recipe.check(loaded.model, recipe.folder(config.MODELS))
        for line in report.lines:
            print(f'  {line}')
        print(f'  {"PASSED" if report.passed else "FAILED"}')
        results.append(report.passed)
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
