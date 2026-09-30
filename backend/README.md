# ANA / LAB screening service

A local FastAPI service that screens one sample's microscopy fields as ANA positive or negative with the trained ResNet18 checkpoint. The website reaches it through Vite's `/api` proxy. Images are analysed in memory and never written to disk.

## Setup (once)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
```

The checkpoint is expected at `Results/aida_binary_resnet18_512_best.pt` in the project folder. Set `ANA_MODEL_PATH` to use another file.

## Run

From `frontend/`: `npm.cmd run api`, or from `backend/`:

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- `GET /api/health` returns the loaded model (label, checkpoint, epoch, SHA-256 prefix, training data).
- `POST /api/screen` takes multipart `images` (1–12 JPEG, PNG, BMP or TIFF files, up to 20 MB and 40 MP each). It returns, per field, `call`, `confidence` (softmax probability of the call; not calibrated) and `probabilityPositive`, plus the sample result. If any file cannot be read, the whole sample is refused with a reason per file (422).

## How a field is screened

This repeats `Model Training/scripts/prepare_aida_resolution.py` and `notebooks/AIDA_Binary_Baseline_512.ipynb` exactly (`app/classifier.py`):

1. Convert to RGB.
2. `ImageOps.pad` to 512 × 512: aspect ratio kept, Lanczos, black padding. No brightness equalisation.
3. `ToTensor()` and ImageNet normalisation.
4. ResNet18 with a 2-class head; softmax; the call is the argmax (index 1 = Positive).

The sample result comes from `app/aggregation.py`: majority of fields, a tie reported as positive, and any disagreement flagged for review. This rule is provisional until it is agreed with the clinical collaborator.

## Checks

```powershell
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe scripts\evaluate_split.py --split test --expect 79,3,6,210
```

`evaluate_split.py` prepares every original test image with the service's code and checks that the pixels are identical to the training data (SHA-256 against the manifest). It then checks that the confusion matrix matches the notebook's reported test result. Re-run it after any change to preprocessing or the checkpoint. On 30 Sep 2026: 298/298 identical, TN 79 · FP 3 · FN 6 · TP 210.

`scripts/copy_demo_images.py` copies three reserved test samples (39 positive, 869 negative, 137 fields disagree) into `demo-images/` for the presentation.

## Limits

- Trained on the public AIDA dataset only and not validated on clinical samples. The UI labels results "Research model" and "Not clinically validated".
- Out of distribution on non-microscopy images: it calls the synthetic demo artwork in `frontend/assets-source` positive.
- CPU only; about a second for a 3–4 field sample.
