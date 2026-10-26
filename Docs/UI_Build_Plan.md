# ANA / LAB — Frontend UI build plan

Scope: the frontend UI, plus (from M1) a small local screening service in `backend/` that runs the trained positive/negative model. There is no other backend work in this plan.

**Current priority: ANA positive vs negative.** On **Friday 2 October 2026** the team presents a model that classifies a sample as positive or negative. The UI therefore first delivers a complete positive/negative workflow. Pattern classification (AC codes) and the other screens come after Friday.

Visual reference: `UI Concepts/D-Scientific-Editorial.png`, adapted for a positive/negative result. The pattern name and pattern-reference areas are left out until pattern classification exists. Product context: `ANA_Project_Context_Handoff.pdf` and `FYP-I_Project_Proposal_updated.docx`.

We build one phase at a time. A phase is done only when `npm.cmd run build`, `lint`, `test` and `test:e2e` all pass and the screens have been checked at 1440, 1280, 768 and 390 px. After that, update the status table.

## Status

| # | Phase | Track | Status |
| --- | --- | --- | --- |
| 0 | Foundation and sample preparation | — | Done (existing code) |
| 1 | Positive/negative data and UI building blocks | Friday | Done (29 Sep 2026) |
| 2 | Sample review screen (pos/neg) | Friday | Done (29 Sep 2026) |
| 3 | Simulated analysis flow and simple image viewer | Friday | Done (29 Sep 2026) |
| 4 | Friday demo readiness | Friday | Done (29 Sep 2026) |
| M1 | Connect the trained ResNet18 pos/neg model | Friday | Done (30 Sep 2026) |
| M2 | Replace it with the calibrated EfficientNet-B0 model | Friday | Done (1 Oct 2026) |
| M3 | Several models, chosen in the workspace | Later | Done (9 Oct 2026) |
| M4 | Cell-level pattern families (Cell patterns page) | Later | Done (9 Oct 2026) |
| M5 | Project reorganised: one folder and one recipe per model, for both tasks | Later | Done (16 Oct 2026) |
| M6 | Two Homogeneous (AC-1) cell models: 6-class (main) and one-vs-rest (comparison) | Later | Done (16 Oct 2026) |
| M7 | Swin-Tiny cell model (four patterns); green images read from their green channel | Later | Done (26 Oct 2026) |
| 5 | Pattern classification UI | Later | Not started |
| 6 | Full image viewer | Later | Not started |
| 7 | Sample history | Later | Not started |
| 8 | Research view | Later | Not started |
| 9 | Polish and final UI pass | Later | Not started |

## UI rules (every phase)

- The result is a screening output, **not a diagnosis**. "Decision support, not a diagnosis." appears on every result screen.
- Demo samples are labelled "Demo data". Uploaded samples are screened by the research model and labelled "Research model" and "Not clinically validated". Model facts shown in the UI come from the checkpoint itself. No invented model versions or metrics.
- Neither positive nor negative gets "good/bad" colours: no green tick for negative, no red alarm for positive. Status is always written in words, never shown by colour alone.
- Confidence is shown only when the data has it, and never called "certainty". The sample-level result and confidence come from the data; the UI does not calculate them.
- Keep the result data behind small hooks (`useSample(id)`), so a real model's output can replace the demo data without changing screens.
- No patient-identifying fields. Samples use neutral references such as `S-0248`.
- Keep D's look: warm ivory, navy and cobalt, Newsreader serif headings, IBM Plex Sans UI text, fine rules, etched blue artwork, and calm motion that respects reduced-motion.

## Frontend structure

- `src/types/`: sample, image, image result, sample result, review state.
- `src/demo/`: demo samples and synthetic demo images (in memory), read through hooks.
- `src/features/{workspace,samples,viewer}/` now; `history/` and `research/` later.
- `src/components/ui/`: shared pieces (badge, result status, confidence bar, field agreement, meta row, empty state).

---

# Friday track — positive vs negative

## Phase 0 — Foundation and sample preparation (done)

This phase covers the shell, routing, tokens and fonts, the motion system, the help dialog, the mobile drawer, and the `/workspace` upload screen (drop or pick, validation, previews, remove, clear).

## Phase 1 — Positive/negative data and UI building blocks

- Types: each image gets `positive | negative` and an optional confidence. The sample result holds status, optional confidence, field agreement (for example 3 of 4 fields positive) and a needs-review flag.
- Demo samples:
  - all fields positive
  - all fields negative
  - fields disagree (needs review)
  - no confidence available
- Synthetic fluorescence-style demo images: bright staining for positive, dim for negative. Each is captioned "Synthetic illustration".
- Shared components: `Badge`, `ResultStatus`, `ConfidenceBar`, `FieldAgreement`, `MetaRow`.
- Remove phase numbers from in-app copy (Help dialog, workspace note, placeholder pages), and update the Help text to describe positive/negative screening.

**Done when:** every component renders all four demo states, and unit tests cover the demo data shape.

## Phase 2 — Sample review screen (pos/neg)

**Route `/samples/:sampleId`, laid out like D:**
- **Header:** breadcrumb, "Demo data" badge, serif "Sample review" title, subtitle, and a meta row (reference · image count · status) with **New sample**.
- **Field grid:** 2×2 dark image tiles with captions (Field 01 · Positive · 95.1%) and an expand icon. One image shows large; more than 4 scroll.
- **Interpretation panel:**
  - SAMPLE SCREENING eyebrow and a large **ANA positive / ANA negative** result.
  - Confidence bar and field agreement squares (for example "4 of 4 fields positive").
  - A needs-review note when fields disagree.
  - **Complete review** and **View field results** buttons.
  - Analysis details (demo), and a quiet note that pattern classification comes in a later version.
  - The disclaimer.
- **States:** positive, negative, disagreement, no confidence, sample not found.
- **Shell:** D has no top bar. Move the breadcrumb and badge into the page header, and move the motion switch and help into the sidebar footer.
- **Responsive:** the panel drops below the grid on smaller screens, with one tile per row on phones.

**Done when:** it is recognisably D at 1440 px and every state renders.

## Phase 3 — Simulated analysis flow and simple image viewer

- Enable **Analyse sample** in the workspace. It shows staged progress (preparing → screening → ready) labelled "Simulated analysis", then opens the review screen for the uploaded images with a demo result.
- A demo failure state with **Retry** that keeps the images.
- **Complete review:** marks the sample reviewed with a time and a quiet confirmation.
- **New sample:** returns to a clean workspace, confirming first if a draft would be lost.
- **Simple viewer:** clicking a tile opens a dark full-screen view of that field with previous/next, its result, and Esc to close with focus returned. Zoom and pan come later.
- Guards against double clicks and against showing a result for the wrong sample.

**Done when:** upload → analyse → review → complete works end to end.

_As built (superseded by M1, which connects the real model):_ uploaded fields were screened by a labelled brightness simulation (`src/demo/simulateAnalysis.ts`, not a model; no confidence reported). The failure is triggered by a "Simulate a failed analysis (demo)" checkbox. On success the draft images move into a session sample (S-0301 onward), so **New sample** never discards work and needs no confirmation. Complete review was built in Phase 2.

## Phase 4 — Friday demo readiness

- Compare the review screen against D and polish spacing, type and motion.
- Browser tests for the full journey, plus the positive, negative and disagreement states.
- Responsive and keyboard check, and no console errors.
- A one-click route to each demo sample for the presentation, and a short demo script in `Docs/`.
- Updated screenshots in `UI Concepts/`.

**Done when:** the Friday demo runs start to finish without issues.

_As built:_ demo script in `Docs/Demo_Script.md`; presentation screenshots in `UI Concepts/Screen-{Desktop,Mobile}-*.png` (regenerate with `$env:CAPTURE='1'; npx.cmd playwright test screens`); full-journey tests fail on any console error; phones get a pinned "Analyse sample" bar.

## M1 — Connect the trained model

- Local FastAPI service (`backend/`) loads `Results/aida_binary_resnet18_512_best.pt` (ResNet18, ImageNet weights, frozen backbone, 2-class head, epoch 20) and repeats the training preprocessing exactly: RGB, aspect-preserving Lanczos pad to 512 × 512 with black, ImageNet normalisation, no brightness equalisation.
- `POST /api/screen` returns a call and probability per field, plus the sample result from the provisional rule: majority of fields, a tie reported as positive, disagreement flagged for review. There is no sample-level confidence.
- The workspace sends the draft to the service (Vite proxies `/api`); the brightness simulation and the "simulate a failure" checkbox are removed. Real failures (service not running, rejected files) keep the images and offer Retry. BMP uploads are accepted.

**Done when:** the service reproduces the notebook on the reserved test split and the full journey runs through the real model.

_As built:_ `backend/scripts/evaluate_split.py` gives 298/298 pixel-identical preprocessed images and TN 79 · FP 3 · FN 6 · TP 210, matching `Model Training/analysis/aida/test_report`. With the majority rule, 143 of 146 test samples are correct at sample level. The model calls the synthetic demo artwork positive (out of distribution), so the demo uses three held-out test samples copied to `demo-images/`. Browser tests stub the service; `e2e/model.spec.ts` runs the real model.

## M2 — Calibrated EfficientNet-B0 model

- The service now loads `Results/best.pt`: EfficientNet-B0 (timm), one logit, from cross-validation round 1 of `Second Model Training/`. It replaces the ResNet18 checkpoint of M1; the endpoint is unchanged.
- Preprocessing follows that project's reference implementation exactly: RGB, shorter side to 512 px (Lanczos), centre 512 × 512 crop, ImageNet normalisation, no brightness or contrast change.
- Confidence is calibrated by temperature scaling (T = 1.754); a probability of 0.5 or more is ANA positive.
- Model facts shown in the UI come from the service, and UI copy no longer names a model, so the next model swap needs no frontend change.

**Done when:** the service reproduces the reported round-1 test result on fold 1 and the journey runs through the real model.

_As built:_ `backend/scripts/evaluate_split.py` gives 416/416 fold-1 images identical to the training tensors and TN 114 · FP 2 · FN 30 · TP 270 (sensitivity 0.900, specificity 0.983), matching the phase plan. With the majority rule, 189 of 200 fold-1 samples are correct at sample level. Demo samples are now 40, 866 and 137, all from fold 1 (samples 39 and 869 used for M1 were in this model's training folds).

## M3 — Several models, chosen in the workspace

- Each model is a recipe in `backend/app/recipes/`: its weights file, architecture, exact training preprocessing, output rule and plain-language details. Models trained on different data with different preprocessing sit side by side.
- The service lists the models (`GET /api/models`) and loads each the first time it is chosen; `POST /api/screen` takes the chosen model id.
- The workspace has a **Screening model** picker above **Analyse sample**. It shows each model's description, disables models whose weights file is missing, and explains when the service is not running. The choice lasts for the session.
- Every result names the model that produced it, in the review panel and in the "Analysed this session" list.
- Adding a model needs no frontend change: weights file, recipe module, parity check.

**Done when:** both existing models can be chosen in the UI and each reproduces its own training project's reported test result through the service.

_As built:_ two recipes, `efficientnet-b0-aida-r1` (default) and `resnet18-aida-512`. `backend/scripts/evaluate_split.py` checks every model on its own held-out test set: EfficientNet-B0 416/416 identical inputs and TN 114 · FP 2 · FN 30 · TP 270; ResNet18 298/298 and TN 79 · FP 3 · FN 6 · TP 210. The two were tested on different splits, so these figures are not a head-to-head comparison.

## M4 — Cell-level pattern families

- A new **Cell patterns** page (`/cells`) for a different task: one cropped cell in, one of three pattern families out (Homogeneous, Speckled, Nucleolar). It is separate from sample screening because the input and the answer are different; cells are never combined into a sample result.
- The service calls the training project's own inference script, copied unchanged, with the uploaded image untouched. Five ResNet18 models (one per cross-validation round) are averaged after temperature calibration.
- Each cell card shows the family, the confidence, the probability of all three families, a clear warning when the model is uncertain (below 70%), and a question when the image is far larger than one cell.
- The limits are stated next to the upload: one cell per image, three families only, expected cell size, research use.
- Thumbnails show the cell as the model sees it (the script's own brightness-stretched canvas), with a toggle to the original, because raw crops are too dark to see.

**Done when:** the copied script reproduces the outputs saved in training, and cells can be classified end to end in the browser.

_As built:_ `backend/scripts/check_cell_patterns.py` gives 998 of 1,000 test-fold answers identical and 2 near-ties, with the script and weights byte-identical to the training project. Demo cells in `demo-images/cells/` are not held out for the five-model average. This covers part of Phase 5 at cell level; a pattern for a whole sample (AC codes, reference card) is still Phase 5.

## M5 — Project reorganised for adding models

- `models/` (was `Results/`) holds one folder per model, named by its id. `backend/app/recipes/` holds one file per model, for both tasks: the cell model is a recipe like the screening models, with its training script copied unchanged into `recipes/vendor/`.
- Each recipe carries its own parity check; `backend/scripts/check_models.py` runs them all (it replaces `evaluate_split.py` and `check_cell_patterns.py`). `_template_screening.py` and `_template_cells.py` are the starting points for a new model.
- `GET /api/models` lists the models of both tasks; `POST /api/cells` (was `/api/patterns`) takes a `model` id like `/api/screen`. The Cell patterns page has the same model picker as the workspace.
- Frontend: one service client (`src/api/service.ts`), one image check shared by both pages (`src/lib/images.ts`), one browser-test mock (`e2e/serviceMock.ts`).
- Removed: superseded scripts, the old Phase 1 screenshots, a 2.2 MB image that only a test needed but every build shipped, and build/test caches.

**Done when:** all three models pass `check_models.py` from their new folders and every check passes.

_As built:_ the three models reproduce their training projects exactly as before (see `backend/README.md`). Paths in the M1–M4 notes above describe the layout before this reorganisation.

## M6 — Homogeneous (AC-1) cell models

- Two cell models from `Code Part/Model Training one vs rest/`, each five ResNet18 round models with their own temperatures, averaged: `homogeneous-6class-resnet18` (main; names the most likely of six patterns) and `homogeneous-ovr-resnet18` (comparison; one-vs-rest, answers only the question). Neither is the default cell model.
- The training project's `scripts/predict_homogeneous.py` is vendored unchanged; both recipes use its `prepare`, `to_canvas` and `network_input` (the 6-class one also its `load_models` and `predict_canvases`). Greyscale crops up to 100 px are used as is; other images (e.g. green FITC photos) are converted by the script and labelled **experimental**.
- The 6-class card shows only the named pattern and the six probabilities, with **no uncertainty flag** (the 0.2–0.8 band was calibrated for the Homogeneous probability, not the named pattern; a rule derived from validation data may come later). The one-vs-rest card answers Homogeneous or not at the cut-off (≈ 0.22) and the strict cut-off (≈ 0.38), uncertain when 0.2 < p < 0.8.
- Notes (experimental photo; round spread above 0.4, of the answer shown) and facts are folded into a **Details** toggle on each card (user decision, 17 Oct 2026). The website shows a model's yes/no `question`, `warnings` and `facts` generically; a model's uncertainty rule comes from the service (`uncertainRule`).

**Done when:** both models pass `check_models.py`; the API reproduces `examples_predictions.csv` and the training script's own output.

_As built:_ model files and the vendored script byte-identical to the training project; per round, 40 test cells match the saved scores (typical difference ≤ 0.00016, largest 0.021, as the script's own self-test); the phase 9 examples match `examples_predictions.csv` 2/2, and the training script run on the examples plus 20 test cells matches the recipe 22/22. The script's `--self-test` still passes in the training project.

## M7 — Swin-Tiny cell model

- One Swin-Tiny vision transformer (`swin-tiny`), trained in the Colab notebook `HEp2_Notebook_ViT.ipynb` on the Qi et al. cells, classes 1–4 (Homogeneous, Speckled, Nucleolar, Centromere). The notebook also trains ResNet-50 and ViT-B/16; only Swin-Tiny is integrated. Not the default cell model.
- There is no inference script, so the recipe copies the notebook's test transform (`val_tf`: resize to 224 × 224, ImageNet normalisation) and ImageFolder's RGB loader, with the model's class order (folders sorted).
- **Green images:** the model was trained on greyscale cells only. Every colour image is given to it as its green channel. A green false-colour copy of a grey cell (red and blue zero) comes back exactly as the grey cell; any other colour image is labelled experimental. `copy_demo_images.py` makes green false-colour copies of held-out test cells for demonstrations.
- No uncertainty flag (probabilities not calibrated), as for the 6-class model.

**Done when:** `check_models.py` reproduces the notebook's test report on its own test split.

_As built:_ the notebook's split rebuilt exactly (8,403 test cells, same per-pattern counts); accuracy 0.9601 and κ 0.9468 (notebook 0.960 and 0.9468); every per-pattern precision and recall identical to 3 decimals; green copies give exactly the grey probabilities. The notebook's split is random, not by slide, so its test figures are likely optimistic.

---

# Later track — after Friday

## Phase 5 — Pattern classification UI
_Cell-level families are done in M4. What remains here is the pattern of a whole sample._
Add the pattern config (AC-1, speckled AC-2/4/5, nucleolar AC-8/9/10), pattern name and AC code in the panel and tile captions, the pattern-reference card, and pattern demo states. Keep a positive result without a pattern valid.

## Phase 6 — Full image viewer
Zoom, pan, fit and reset, keyboard zoom, and a tile-to-viewer expand animation.

## Phase 7 — Sample history
Route `/samples`: a table with search, filters, sorting, and empty and no-match states, linked to the review screen.

## Phase 8 — Research view
Route `/research`: flat vs staged diagrams in general *k*-group form, metric explainers, an honest "no experiments yet" state, and a project panel.

## Phase 9 — Polish and final UI pass
A full check against D, motion tuning, accessibility, responsive checks and browser zoom, and complete browser tests.

## Open inputs

- The final image-to-sample rule, to be fixed with the clinical collaborator (the majority rule in `backend/app/aggregation.py` is provisional)
- Supervisor name for the project panel: the proposal says Ubaid Chawla, the handoff says Dr. Muhammad Shahzad
