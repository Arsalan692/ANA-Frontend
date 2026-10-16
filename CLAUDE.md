
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

- `frontend/` — the React/TypeScript/Vite website. Run npm commands from here.
- `backend/` — the local FastAPI service that runs the trained models (see `backend/README.md`). Two tasks: `screening` (fields → ANA positive/negative, per field and per sample) and `cells` (single cropped cells → pattern family). One recipe file per model in `backend/app/recipes/`.
- `models/` — trained models, one folder per model id (`models/<id>/`). Only `models/README.md` is in git; weights are large and the datasets' licences forbid redistribution. `backend/.venv/` (CPU PyTorch + timm) and `demo-images/` are git-ignored too; never commit dataset images.
- The training projects are outside this repo and read-only: `../Second Model Training/` (EfficientNet-B0), `../Model Training/` (ResNet18), `../Code Part/Model Training on Basic Classes/` (cell patterns). Datasets: `../Model Training/aida_project_database/` (AIDA), `../datasets/cells/` (Qi et al. cells).
- `Docs/` — `UI_Build_Plan.md` is the phase plan, status table, product rules and architecture decisions; read it before starting a phase. `Demo_Script.md` is the presentation walkthrough. `ANA_Project_Context_Handoff.pdf` and `FYP-I_Project_Proposal_updated.docx` hold the FYP/clinical context.
- `UI Concepts/` — design references. **D-Scientific-Editorial.png is the chosen visual reference**; A–C are the rejected concepts; `Screen-{Desktop,Mobile}-*.png` are current screenshots (regenerate with `$env:CAPTURE='1'; npx.cmd playwright test screens`, service running).

## Commands

On Windows PowerShell use `npm.cmd` / `npx.cmd` to avoid execution-policy issues with `npm.ps1`. From `frontend/`:

```powershell
npm.cmd run api            # model service at http://127.0.0.1:8000 (Vite proxies /api to it)
npm.cmd run dev            # website at http://127.0.0.1:5173
npm.cmd run build          # tsc -b && vite build
npm.cmd run lint
npm.cmd test               # Vitest unit tests (src/**/*.test.ts[x])
npx.cmd vitest run src/lib/images.test.ts      # one file;  -t "name fragment" for one test
$env:PLAYWRIGHT_CHANNEL='msedge'; npm.cmd run test:e2e      # browser tests; the service is mocked
npx.cmd playwright test -g "mobile"                         # one browser test by name
$env:MODEL_E2E='1'; npx.cmd playwright test model           # through the real models (service running)
```

From `backend/`: `.venv\Scripts\python.exe -m pytest`; `.venv\Scripts\python.exe scripts\check_models.py` (every model reproduces its training project; `--model <id>` for one, `--quick` to only load and run one image); `scripts\copy_demo_images.py` refreshes `demo-images/`.

Playwright starts the dev server on port 5173 (reuses one outside CI) but not the service: browser tests mock `/api/*` with `e2e/serviceMock.ts` (two screening models, one cell model); `model.spec.ts` and `screens.spec.ts` need the real service. Without `PLAYWRIGHT_CHANNEL`, run `npx.cmd playwright install chromium` once.

## Project status and scope

ANA / LAB is the website for the FYP on ANA immunofluorescence pattern classification. **Phases 0–4 and M1–M5 are implemented**: the D-style shell, workspace, sample review and viewer; trained screening models chosen in the workspace; cell-level pattern families on the Cell patterns page; and (M5) the one-folder, one-recipe-per-model structure. Pattern classification for a whole sample, history and research are later phases (5–9). The status table is in `Docs/UI_Build_Plan.md`. Work phase by phase, implement only what the user authorises, and update the status table only after verification (build, lint, unit, e2e, backend tests, and `check_models.py` for any model change).

Hard product rules:
- No fabricated predictions, metrics, history, or model versions. Any mock/demo value must be visibly labelled as simulated/illustrative. Unimplemented features show honest "later phase" states (`features/FuturePage.tsx`) or disabled controls with an explanation — every visible control must work or explain why not.
- No auth or image persistence. The only backend is the local model service, which analyses images in memory and never writes them to disk. Images live only in browser memory; never store image data in localStorage (only the motion preference `ana-reduced-motion` is persisted).
- No patient-identifying inputs. Don't represent ANA-positive with green/success styling. Confidence is not "clinical certainty"; don't compute sample confidence in the frontend.
- Clinical/model rules (pattern set, limits, aggregation) must stay configurable, not hard-coded guesses. The frontend never names a model: names, descriptions, classes, limits and details come from the service.
- A model's preprocessing must be copied from its training code, never rewritten from memory; a training project's own inference script is vendored unchanged. Every model must pass its parity check before use.

## Backend architecture (`backend/app/`)

- `main.py` holds only the routes: `GET /api/models` (every model of both tasks; cell models add `classes`, `minConfidence`, `limits`), `POST /api/screen` and `POST /api/cells` (multipart `images` plus optional `model` id; without one, the task's default), `GET /api/health`. `uploads.py` decodes uploads (format from contents, size and pixel limits) and refuses the whole request with a reason per file (422). Unknown or wrong-task model → 404; files missing → 409.
- **Recipes** (`recipes/`): one module per model exposing `RECIPE`, a subclass of `base.py`'s `ScreeningRecipe` (`preprocess` → tensor, `decide` → `FieldPrediction`) or `CellRecipe` (`classify` → `CellPrediction`; `classes`, `min_confidence`, `limits`, `oversized_side`). Every recipe sets `id` (also its `models/<id>/` folder), `label`, `summary`, `files` (globs that must exist), `load` (build, load weights with `weights_only=True`, `eval()`, no downloads; may return facts read from the files), `details` (plain-language facts shown in the UI) and `check` (parity against the training project; helpers in `checks.py`). Files starting with `_` are templates and are not loaded; `vendor/` holds unchanged training scripts.
- **Current models**: `efficientnet_b0_aida_r1` (default screening; timm, one logit; RGB → shorter side to 512 Lanczos → centre crop → ImageNet norm; sigmoid(logit / 1.754) ≥ 0.5), `resnet18_aida_512` (torchvision 2-class head; whole field padded to 512; argmax), `cells_resnet18_adjusted` (default cells; calls `vendor/predict_pattern.py`, five ResNet18 averaged, uncertain below 0.70, returns a display-only `modelView`).
- `registry.py` discovers recipes, reports which are installed, picks a default per task (`config.DEFAULT_MODELS`, else the first installed), loads models on first use with a lock and an LRU cap (`ANA_MAX_LOADED_MODELS`), and fingerprints weights (SHA-256 prefix shown with every result). The default screening model loads at startup. `aggregation.py` holds the provisional sample rule (majority; a tie is positive; disagreement sets `needsReview`). `config.py` holds service settings only.
- To add a model: files in `models/<id>/`, copy `recipes/_template_screening.py` or `_template_cells.py`, fill in every TODO, run `scripts/check_models.py --model <id>` until it passes, restart. No frontend change. Tests fail if a recipe is incomplete or lacks a parity check.

## Frontend architecture (`frontend/src/`)

- `main.tsx` → `BrowserRouter` → `app/App.tsx`: `MotionProvider` → `DraftProvider` → `SessionProvider` → `ModelsProvider` → `CellsProvider` → `Shell`. The sidebar is persistent; routes animate inside `AnimatePresence` keyed by pathname; on route change the shell scrolls to top and focuses `<main>`.
- Routes: `/` → `/workspace`; `/cells` → `features/cells/CellPatterns`; `/samples/:sampleId` → `features/samples/SampleReview`; `/samples` and `/research` render `FuturePage`; `*` the missing state. No top bar (concept D): each page renders `components/layout/PageHeader`; motion switch and help live in the sidebar footer. The sidebar marks Workspace active for `/samples/:id`.
- **State** (`app/Providers.tsx`, contexts in `app/contexts.ts`, consumed via `useDraft()`, `useSession()`, `useModels(task)`, `useCells()`, `useMotionPreference()`, which throw without their provider). Draft and cell images live above the router; every image has an object URL that must be revoked on remove/clear/unmount (`takeDraft()` hands URLs to the new sample without revoking). The draft uses an `imagesRef` mirror, a `generation` counter (clearing cancels in-flight adds) and a `locked` ref. `SessionProvider` holds samples analysed this session and review completions. `ModelsProvider` fetches `/api/models` once and keeps the chosen model per task for the session; it re-fetches on "Check again", on window focus while the service is down, and after a successful analysis.
- **Service client** (`api/`): `service.ts` (`callService`, `ServiceError` kinds unreachable / rejected / failed, `imagesForm`, `listModels`, the `ModelOption` and `ModelInfo` types), `screening.ts` (`screenSample`), `cells.ts` (`classifyCells`).
- **Images** (`lib/images.ts`): `validateFile` (JPEG/PNG/BMP, 20 MB, duplicates by name:size:lastModified, 12 fields or 24 cells per batch), `validateDimensions` (40 MP), `inspectImage` (both, plus decoding with `createImageBitmap`). Unit-tested.
- **Analysis** (`features/workspace/useAnalysis.ts` + `AnalysisDialog.tsx`): preparing → screening → finalising with a run token and AbortController so cancel/unmount/retry never attach stale results; sends the chosen model id; only on success calls `takeDraft()` and `addSample()`, then navigates to `/samples/s-03xx`. Per-field `confidence` is the model's probability for its call; there is no sample-level confidence. Model facts come from the service as `model.details` and are shown as-is.
- **Cell patterns** (`features/cells/CellPatterns.tsx`): each image is ONE cropped cell with its own answer (family, confidence, all probabilities in the model's class order, `uncertain`, `oversized`); cells are never combined. Each cell remembers which model classified it. Limits and details come from the chosen model. Thumbnails show the service's `modelView` when present, with a toggle to the original; never add a CSS filter to microscopy.
- `components/ui/ModelPicker.tsx` (native `<select>`, one per task; models with missing files are listed but disabled). Shared result components: `Badge`, `ResultStatus` (words plus filled/hollow marker, no good/bad colour), `ConfidenceBar` (`role="meter"`), `FieldAgreement`, `MetaRow`. Component tests render with `react-dom/server`; there is no jsdom/RTL.
- **Samples**: types in `types/sample.ts` (`ScreeningCall` is `'positive' | 'negative'`; the sample `result` is supplied by data, never derived in the UI). Demo samples in `demo/samples.ts`. Screens read samples only via `useSample(id)` / `useSamples()` in `features/samples/useSamples.ts`. Display helpers in `features/samples/format.ts` (confidence never shows 100%). Viewer: `features/viewer/FieldViewer.tsx` (arrow keys, Esc returns focus to the last-shown tile; zoom/pan are Phase 6).
- **Motion**: `MotionProvider` combines system `prefers-reduced-motion` (always wins) with a manual toggle and sets `data-motion` / `data-visibility` on `<html>`. Shared timings in `motion/presets.ts`. Transform/opacity only, small movements, no motion on microscopy.
- **Styling**: Tailwind v4 via `@tailwindcss/vite`; tokens in `@theme` and `:root` and most styles as semantic classes in `styles/global.css`. Fonts via Fontsource (Newsreader display, IBM Plex Sans UI); keep the OFL files in `public/licenses/`. Radix (Dialog, Switch) for accessible primitives, lucide-react for icons.
- **Artwork**: originals in `frontend/assets-source/`; web copies in `public/assets/` generated by `python scripts/optimise-assets.py` (Pillow, NumPy). All artwork and demo fields are synthetic; see `public/assets/README.md`.
