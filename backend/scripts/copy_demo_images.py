r"""Copy demonstration images into demo-images/ for the presentation.

Fields (positive/negative screening): three AIDA samples from fold 1 of `Second Model Training/`, the
test fold of the default EfficientNet-B0 model, which never saw them in training or model selection.

Cells (pattern families): four single cells from the Qi et al. HEp-2 cell set. They are NOT held out for
the pattern model: it averages five cross-validation models and every cell in the set was a training
cell for three of them. Say so when demonstrating. One of the four is a cell the model marks uncertain
and gets wrong.

The folder is git-ignored: neither dataset may be redistributed.
Run from backend/:  .venv\Scripts\python.exe scripts\copy_demo_images.py
"""
import csv
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config  # noqa: E402

TRAINING = config.PROJECT.parent / 'Second Model Training'
ORIGINALS = config.PROJECT.parent / 'Model Training' / 'aida_project_database'
TARGET = config.PROJECT / 'demo-images'
TEST_FOLD = '1'
# sample_id -> folder name. Chosen from the model's fold-1 predictions (1 Oct 2026).
SAMPLES = {'AIDA_40': '1-positive-sample-40', 'AIDA_866': '2-negative-sample-866', 'AIDA_137': '3-fields-disagree-sample-137'}

CELLS = config.PROJECT.parent / 'datasets' / 'cells' / 'cells'
# file index -> demo file name. From round 0's test fold; labels are the dataset's (9 Oct 2026).
DEMO_CELLS = {'4622': 'homogeneous-4622.png', '18745': 'speckled-18745.png', '33535': 'nucleolar-33535.png',
              '37499': 'uncertain-true-nucleolar-37499.png'}


def main():
    with (TRAINING / 'data' / 'aida_file_map.csv').open(newline='', encoding='utf-8') as file:
        raw_file = {row['image_path']: row['raw_file'] for row in csv.DictReader(file)}
    with (TRAINING / 'data' / 'manifest.csv').open(newline='', encoding='utf-8') as file:
        rows = [row for row in csv.DictReader(file) if row['sample_id'] in SAMPLES]
    assert all(row['fold'] == TEST_FOLD for row in rows), 'Demo samples must come from the held-out test fold.'
    if TARGET.exists():
        shutil.rmtree(TARGET)  # Earlier demo samples may not be held out for this checkpoint.
    for row in rows:
        folder = TARGET / SAMPLES[row['sample_id']]
        folder.mkdir(parents=True, exist_ok=True)
        name = raw_file[row['image_path']]
        shutil.copy2(ORIGINALS / name, folder / name)
        print(f'{folder.name}/{name}  (label: {"Positive" if row["label"] == "1" else "Negative"})')
    cells = TARGET / 'cells'
    cells.mkdir(parents=True, exist_ok=True)
    for index, name in DEMO_CELLS.items():
        shutil.copy2(CELLS / f'{index}.png', cells / name)
        print(f'cells/{name}')


if __name__ == '__main__':
    main()
