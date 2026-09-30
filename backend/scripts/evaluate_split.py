"""Check that the service reproduces training exactly, using the prepared AIDA manifest.

1. Preprocessing parity: every ORIGINAL image, prepared by the service's `prepare`, must give the same
   pixels (SHA-256) as the image the model was trained and tested on.
2. Model parity: the confusion matrix on the chosen split must match the notebook's reported figures.

Run from backend/:
    .venv\\Scripts\\python.exe scripts\\evaluate_split.py --split test --expect 79,3,6,210
(79/3/6/210 = TN/FP/FN/TP for the 512 checkpoint in Model Training/analysis/aida/test_report.)
"""
import argparse
import csv
import hashlib
from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config  # noqa: E402
from app.classifier import ScreeningModel, prepare  # noqa: E402

TRAINING = config.PROJECT.parent / 'Model Training'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--split', default='test', choices=['train', 'validation', 'test'])
    parser.add_argument('--data', type=Path, default=TRAINING / 'prepared' / 'aida_binary_512')
    parser.add_argument('--originals', type=Path, default=TRAINING / 'aida_project_database')
    parser.add_argument('--expect', help='TN,FP,FN,TP reported by the notebook')
    args = parser.parse_args()
    model = ScreeningModel(config.MODEL_PATH)
    with (args.data / f'{args.split}.csv').open(newline='', encoding='utf-8') as file:
        rows = list(csv.DictReader(file))
    mismatched_pixels, counts = [], {'tn': 0, 'fp': 0, 'fn': 0, 'tp': 0}
    for start in range(0, len(rows), 16):
        chunk = rows[start:start + 16]
        images = []
        for row in chunk:
            with Image.open(args.originals / row['filename']) as original:
                original.load()
                if hashlib.sha256(prepare(original, model.resolution).tobytes()).hexdigest() != row['pixel_sha256']:
                    mismatched_pixels.append(row['filename'])
                images.append(original.copy())
        for row, prediction in zip(chunk, model.predict(images)):
            truth, called = int(row['target']) == 1, prediction.call == 'positive'
            counts[('t' if truth == called else 'f') + ('p' if called else 'n')] += 1
        print(f'{min(start + 16, len(rows))}/{len(rows)}', end='\r', flush=True)
    print(f'\n{args.split}: {len(rows)} images · model {model.info["label"]} · {model.info["sha256"]}')
    print(f'Preprocessing parity: {len(rows) - len(mismatched_pixels)}/{len(rows)} identical pixels'
          + (f'; differ: {mismatched_pixels[:5]}' if mismatched_pixels else ''))
    print('Confusion: TN {tn} · FP {fp} · FN {fn} · TP {tp}'.format(**counts))
    ok = not mismatched_pixels
    if args.expect:
        expected = dict(zip(('tn', 'fp', 'fn', 'tp'), map(int, args.expect.split(','))))
        ok &= expected == counts
        print('Matches the notebook.' if expected == counts else f'DOES NOT MATCH the notebook: expected {expected}')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
