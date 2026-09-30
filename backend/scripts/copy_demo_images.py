"""Copy three held-out AIDA test samples into demo-images/ for the presentation.

All three come from the reserved TEST split, so the model never saw them during training or model
selection. The folder is git-ignored: AIDA images are not redistributed with this repository.
Run from backend/:  .venv\\Scripts\\python.exe scripts\\copy_demo_images.py
"""
import csv
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config  # noqa: E402

TRAINING = config.PROJECT.parent / 'Model Training'
TARGET = config.PROJECT / 'demo-images'
# sample_id -> folder name. Chosen from the model's test-split predictions (30 Sep 2026).
SAMPLES = {'39': '1-positive-sample-39', '869': '2-negative-sample-869', '137': '3-fields-disagree-sample-137'}


def main():
    with (TRAINING / 'prepared' / 'aida_binary_512' / 'manifest.csv').open(newline='', encoding='utf-8') as file:
        rows = [row for row in csv.DictReader(file) if row['sample_id'] in SAMPLES]
    assert all(row['split'] == 'test' for row in rows), 'Demo samples must come from the reserved test split.'
    for row in rows:
        folder = TARGET / SAMPLES[row['sample_id']]
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copy2(TRAINING / 'aida_project_database' / row['filename'], folder / row['filename'])
        print(f'{folder.name}/{row["filename"]}  (label: {row["label"]})')


if __name__ == '__main__':
    main()
