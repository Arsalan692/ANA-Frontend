# ANA / LAB

The website for the FYP *Automated Classification of ANA Immunofluorescence Patterns Using Deep Learning* (FAST-NUCES Karachi). It runs the project's trained models on HEp-2 microscopy images:

- **Workspace:** a sample's fields → ANA positive or negative, per field and for the sample.
- **Cell patterns:** single cropped cells → a pattern family (Homogeneous, Speckled, Nucleolar).

Several models can sit side by side for each task; the user picks one. Results are for research and demonstration, not for diagnosis.

## Folders

| Folder | What it holds |
| --- | --- |
| `frontend/` | The website: React, TypeScript, Vite |
| `backend/` | The local service that runs the models: FastAPI, PyTorch. One recipe file per model |
| `models/` | The trained models, one folder per model. Not in git; see `models/README.md` |
| `demo-images/` | Images for demonstrations, copied from the datasets. Not in git |
| `Docs/` | Build plan and status, demo script, FYP proposal and project context |
| `UI Concepts/` | Design references (D is the chosen one) and screenshots of the app |

## Run it

Once: install the frontend (`cd frontend`, `npm.cmd install`), set up the backend (see `backend/README.md`), and copy the model folders into `models/`.

Then, in two terminals in `frontend/`:

```powershell
npm.cmd run api     # the model service, http://127.0.0.1:8000
npm.cmd run dev     # the website, http://127.0.0.1:5173
```

## Add a new model

1. Copy its files into `models/<id>/`.
2. Copy a template in `backend/app/recipes/` and fill it in. The preprocessing must be copied from the training code.
3. Run `backend\.venv\Scripts\python.exe backend\scripts\check_models.py --model <id>` until it passes.
4. Restart the service. The website lists the model automatically.

Details: `backend/README.md`, section "Adding a model".

## Checks

| What | Command (from the folder named) |
| --- | --- |
| Website build, lint, unit tests | `frontend/`: `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd test` |
| Website in a browser | `frontend/`: `$env:PLAYWRIGHT_CHANNEL='msedge'; npm.cmd run test:e2e` |
| Website with the real models | `frontend/`, service running: `$env:MODEL_E2E='1'; npx.cmd playwright test model` |
| Service tests | `backend/`: `.venv\Scripts\python.exe -m pytest` |
| Models reproduce training | `backend/`: `.venv\Scripts\python.exe scripts\check_models.py` |
