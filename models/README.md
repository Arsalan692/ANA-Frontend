# Trained models

One folder per model, named by the model's id. The service (`backend/`) reads each folder through the recipe of the same name in `backend/app/recipes/`. Only this README is in git: weights are large, and the datasets' licences forbid redistributing anything derived from them, so copy the folders from the training projects onto each computer.

| Folder | Task | Files | Copied from |
| --- | --- | --- | --- |
| `efficientnet-b0-aida-r1/` | screening | `best.pt` | `Second Model Training/` (cross-validation round 1) |
| `resnet18-aida-512/` | screening | `aida_binary_resnet18_512_best.pt` | `Model Training/` (Colab results) |
| `cells-resnet18-adjusted/` | cells | `round_0` … `round_4` (each `best.pt`, `metrics.json`), `calibration/temperatures.json` | `Code Part/Model Training on Basic Classes/outputs/resnet18_adjusted/` |

Keep the training project's file names and layout. Each recipe lists the files it needs in `files`; a model whose files are missing is shown in the website as unavailable.

To add a model, see "Adding a model" in `backend/README.md`. To check that the files here reproduce training:

```powershell
cd backend
.venv\Scripts\python.exe scripts\check_models.py
```
