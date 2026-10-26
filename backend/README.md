# ANA / LAB screening service

A local FastAPI service that runs the trained models for the website. It has two tasks, and each task can have any number of models; the website lets the user choose one.

| Task | Input | Answer | Website page |
| --- | --- | --- | --- |
| `screening` | a sample's microscopy fields (1–12) | ANA positive or negative per field, and one result for the sample | Workspace |
| `cells` | single cropped cells (1–24) | per cell, a pattern family and/or a yes/no answer (Homogeneous or not); cells are never combined | Cell patterns |

Images are analysed in memory and never written to disk. Results are for research and demonstration, not for diagnosis.

## Setup (once)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
```

Then copy each model's files into `models/<model id>/` in the project folder (see `models/README.md`). Nothing is downloaded at startup.

## Run

From `frontend/`: `npm.cmd run api`, or from `backend/`:

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The default screening model is loaded at startup; every other model is loaded the first time it is chosen.

| Setting (environment variable) | Default | Meaning |
| --- | --- | --- |
| `ANA_MODELS_DIR` | `models/` | Folder with one sub-folder per model |
| `ANA_DEFAULT_SCREENING_MODEL` | `efficientnet-b0-aida-r1` | Screening model used when the website names none |
| `ANA_DEFAULT_CELL_MODEL` | `cells-resnet18-adjusted` | Cell model used when the website names none |
| `ANA_MAX_LOADED_MODELS` | `3` | Models kept in memory at once; the least recently used is dropped |

## API

- `GET /api/models`: every model of both tasks, with `task`, `label`, `summary`, `available` (are its files present?), `default` and `details`. Cell models also give `classes`, `minConfidence` and `limits`.
- `POST /api/screen`: multipart `images` and an optional `model` id. Returns the model used, per field `call`, `confidence` (the model's probability for its call) and `probabilityPositive`, and the sample result.
- `POST /api/cells`: multipart `images` (each ONE cropped cell) and an optional `model` id. Returns, per cell, `family`, `confidence`, `uncertain`, `probabilities` for every class, the image size, `oversized` (probably not one cell) and, when the model provides them, `modelView` (the cell as the model sees it, for display), `question` (a yes/no answer: `probability`, `cutoff`, `answer`, `strictCutoff`, `strictAnswer`), `warnings` and `facts`. `family` and `confidence` are null for a model that names no pattern. `GET /api/models` gives each cell model's `uncertainRule`.
- `GET /api/health`: the default models and which models are loaded.

Uploads: JPEG, PNG, BMP or TIFF, detected from the contents, up to 20 MB and 40 MP each. If any file cannot be read, nothing is analysed and the answer (422) names each file and the reason. An unknown model gives 404; a model whose files are missing gives 409.

## How it is organised

```
app/
  main.py            the routes
  uploads.py         turns uploads into decoded images, or one clear error
  registry.py        finds every recipe, reports which are installed, loads models on first use
  aggregation.py     the provisional sample rule for screening (majority; a tie is positive)
  config.py          service settings only; nothing about a particular model
  recipes/           ONE FILE PER MODEL
    base.py          what a recipe must provide (ScreeningRecipe, CellRecipe)
    checks.py        helpers for parity checks
    _template_screening.py, _template_cells.py    starting points for a new model
    efficientnet_b0_aida_r1.py, resnet18_aida_512.py, cells_resnet18_adjusted.py,
    homogeneous_6class_resnet18.py, homogeneous_ovr_resnet18.py   (shared code: homogeneous_shared.py), swin_tiny.py
    vendor/          inference scripts copied UNCHANGED from training projects (predict_pattern.py, predict_homogeneous.py)
scripts/
  check_models.py    proves each model reproduces its training project
  copy_demo_images.py
tests/
```

A recipe holds everything about one model: its id (also its folder in `models/`), the name and description shown in the website, the files it needs, how to build and load it, its exact training preprocessing, how its output becomes an answer, plain-language details, and a parity check against its training project.

## Adding a model

1. **Files.** Copy the model's files into `models/<id>/`, keeping the training project's names and layout. Choose an id like `convnext-tiny-aida-r2`: lower case, no spaces.
2. **Recipe.** Copy `app/recipes/_template_screening.py` (fields → positive/negative) or `_template_cells.py` (cells → pattern family) to a new file in `app/recipes/`, and fill in every TODO.
   - Copy the preprocessing from the **training code**, line by line. If preprocessing differs from training, the model still answers but its answers are silently wrong.
   - If the training project ships a self-contained inference script, copy it **unchanged** into `app/recipes/vendor/` and call it, as `cells_resnet18_adjusted.py` does.
   - Write `check`: run the model's held-out test images through the recipe and compare with the figures the training project reported. `checks.screening_parity` does this for screening models.
3. **Check.** From `backend/`: `.venv\Scripts\python.exe scripts\check_models.py --model <id>`. It must print PASSED. `--quick` only loads the model and runs one image.
4. **Restart the service.** The model appears in the website's model picker for its task. No frontend change is needed.

The tests (`.venv\Scripts\python.exe -m pytest`) also fail if a recipe is incomplete or has no parity check.

## Models now installed

| Model id | Task | Preprocessing | Confidence |
| --- | --- | --- | --- |
| `efficientnet-b0-aida-r1` (default) | screening | RGB → shorter side to 512 px (Lanczos) → centre 512 × 512 crop → ImageNet normalisation; 16-bit images scaled by full range | sigmoid(logit / 1.754), calibrated; positive from 0.5 |
| `resnet18-aida-512` | screening | RGB → whole field padded with black to 512 × 512 (Lanczos) → ImageNet normalisation | softmax, not calibrated; the call is the argmax |
| `homogeneous-6class-resnet18` | cells | `vendor/predict_homogeneous.py`: greyscale crop ≤ 100 px used as is; otherwise (e.g. a green photo, experimental) green channel or luminance → cell found (blur, Otsu, largest central region) → 4% margin → longest side 75 px; then 100 × 100 canvas → brightness stretch on the cell → centre 88 px enlarged to 176 px → each round's normalisation; five models averaged | per-round temperature, averaged; the most likely of six patterns; no uncertainty flag (no validated rule for the named pattern yet) |
| `homogeneous-ovr-resnet18` | cells | the same, one-vs-rest (one logit, sigmoid) | per-round temperature, averaged; Homogeneous from 0.218 (strict 0.382); uncertain for 0.2–0.8 |
| `swin-tiny` | cells | the notebook's `val_tf`, copied: image → RGB (ImageFolder's loader) → 224 × 224 (bilinear) → ImageNet normalisation; a colour image is first reduced to its green channel (exact for a green false-colour copy of a grey cell, experimental otherwise) | softmax, not calibrated; the most likely of four patterns; no uncertainty flag |
| `cells-resnet18-adjusted` (default) | cells | `vendor/predict_pattern.py`: brightest channel → shrink to fit 100 px → centre on a 100 × 100 canvas → brightness stretch → centre 88 px enlarged to 176 px → normalise; five models averaged | per-model temperature, averaged; uncertain below 0.70 |

No screening recipe stretches contrast or changes brightness: brightness is the positive/negative signal. The cell model's brightness stretch is part of its training pipeline.

`scripts/check_models.py` on 16 Oct 2026:

| Model | Held-out test data | Result |
| --- | --- | --- |
| `efficientnet-b0-aida-r1` | fold 1 of `Second Model Training/` (416 images) | 416/416 inputs identical to training; TN 114 · FP 2 · FN 30 · TP 270, as reported |
| `resnet18-aida-512` | test split of `Model Training/` (298 images) | 298/298 identical; TN 79 · FP 3 · FN 6 · TP 210, as reported |
| `homogeneous-6class-resnet18` | 40 test-fold cells per round (the script's self-test cells); phase 9 examples; the training script itself on 22 images | files byte-identical; typical difference ≤ 0.00016, largest 0.021; `examples_predictions.csv` 2/2; script output 22/22 identical |
| `homogeneous-ovr-resnet18` | 40 test-fold cells per round | files byte-identical; typical difference ≤ 0.00005, largest 0.016 |
| `swin-tiny` | the notebook's test split, rebuilt exactly (8,403 cells; random 15 %, stratified) | accuracy 0.9601 and κ 0.9468 (notebook 0.960 and 0.9468); every per-pattern precision and recall identical to 3 decimals; green false-colour copies give exactly the grey probabilities |
| `cells-resnet18-adjusted` | 200 test-fold cells per round (1,000) | script and weights byte-identical; 998 answers identical, 2 near-ties, 0 mismatches |

The two screening models were tested on different splits, so their figures are not a head-to-head comparison. The cell model's five-model average has no held-out test figure of its own; its reported test balanced accuracy is 0.890 ± 0.028 per single model.

`scripts/copy_demo_images.py` copies demo images into `demo-images/`: three AIDA samples (40 positive, 866 negative, 137 fields disagree), held out for the default screening model, four single cells, which are not held out for the cell model (every cell was a training cell for three of its five models), the two green example photos of the Homogeneous project (`cell-photos/`), and two cells per pattern from the Swin-Tiny test split, each greyscale and as a green false-colour copy made by the script (`cells-swin-test/`; say they are false colour).

## Limits

- All models were trained on public research datasets only and are not validated on clinical samples. The website labels results "Research model" and "Not clinically validated".
- The Swin-Tiny model's notebook split the cells at random, so cells from one slide are in both training and test: its 0.960 test accuracy is likely optimistic and not comparable with the other cell models, which were split by slide blocks. Its probabilities are not calibrated.
- The 3-family cell model knows three families only: any other pattern, or a negative cell, still gets one of the three names.
- The Homogeneous models were trained on greyscale Qi crops only. Green or other microscope photos are converted by the training script but are untested (the five round models often disagree on them); the website labels them experimental. The round spread is informational and not validated, because every Qi cell was seen by three of the five models.
- EfficientNet-B0 sees only the centre square of each field and under-calls positives at the 0.5 cut-off (sensitivity 0.900).
- CPU is enough; CUDA is used when available.
