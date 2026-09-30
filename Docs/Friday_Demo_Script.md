# Friday demo script — ANA positive / negative screening

Presentation: **Friday 2 October 2026**. About 5–7 minutes for the UI part.

## Before the presentation

1. Two terminals in `frontend/`:
   - `npm.cmd run api` — the screening service with the trained model. Wait for "Application startup complete".
   - `npm.cmd run dev` — the website.
2. Open **http://127.0.0.1:5173** in Edge or Chrome, full screen (F11). Refresh once so the session is clean.
3. Open `demo-images\` (in the project folder) in File Explorer. It holds three samples from the **reserved AIDA test split**, which the model never saw in training:
   - `1-positive-sample-39` (3 JPG fields)
   - `2-negative-sample-869` (3 BMP fields)
   - `3-fields-disagree-sample-137` (3 PNG fields)
   If the folder is missing: `backend\.venv\Scripts\python.exe backend\scripts\copy_demo_images.py`.
4. Check **Reduce motion** (sidebar footer) is off, unless the projector stutters.

## Flow

| # | Do | Say |
| --- | --- | --- |
| 1 | Open the **Workspace**. | "A clinician prepares one patient sample at a time. A sample is three to four microscopy fields." |
| 2 | Drag in the three images from `1-positive-sample-39`. | "Files are checked (format, size, corrupt, duplicate). They go only to the model running on this computer and are not stored." |
| 3 | Click **Analyse sample**. | "Our ResNet18, trained on the AIDA dataset at 512 pixels, screens each field. The fields are then combined by majority into one sample result." |
| 4 | On the review screen, go top to bottom through the right panel. | "ANA positive, three of three fields agree. Each field shows the model's probability for its call. The screen always says *decision support, not a diagnosis*." |
| 5 | Open **Analysis details**. | "Every result names the exact checkpoint: file, epoch and a hash, so it can be traced to the model that produced it." |
| 6 | Click a field, then use ← → and Esc. | "Every field can be inspected full screen. The image is never cropped or filtered." |
| 7 | **View field results**, then **Complete review**. | "The clinician confirms they have looked at it. This records when; it does not change the model output." |
| 8 | **New sample**, drag in `2-negative-sample-869`, analyse. | "A negative sample: all three fields negative." |
| 9 | **New sample**, drag in `3-fields-disagree-sample-137`, analyse. | "Here the fields disagree: two positive, one negative. The sample is reported positive but flagged *needs a closer look*." |
| 10 | *(Optional)* Open demo **S-0251** from the Workspace. | "The built-in demo samples use drawn artwork and hand-written values, and are labelled as demo data." |

## Be clear about what is what

- **Uploaded samples (S-0301 onward)** are real model output from `aida_binary_resnet18_512_best.pt`. On the reserved test split it reproduces the notebook exactly: 298 images, TN 79 · FP 3 · FN 6 · TP 210. It is a research model trained on public AIDA data only; the UI says *Not clinically validated*.
- **The sample-level rule** (majority, a tie counts as positive) is provisional and will be agreed with the clinical collaborator. There is no sample-level confidence, because the model scores single images.
- **Demo samples (S-0248 … S-0270)** use generated images and hand-written results, labelled **Demo data** and **Synthetic illustration**. Do not upload the synthetic images from `assets-source` to the model: they are not real microscopy, and the model calls all of them positive.

## If something goes wrong

- "The screening service on this computer is not responding": the `npm.cmd run api` terminal was closed. Start it again and press **Retry**; the images are kept.
- A blank or odd screen: refresh. Session samples are lost, but demo samples are always there.
- A rejected upload: JPEG, PNG and BMP up to 20 MB and 12 images are accepted.
- Slow projector: switch on **Reduce motion**.
- Backup: screenshots of every screen are in `UI Concepts/Screen-Desktop-*.png` and `Screen-Mobile-*.png` (screens 2–4 show the real model on sample 39).
