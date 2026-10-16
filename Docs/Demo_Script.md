# Demo script — ANA / LAB

Written for the presentation on 2 October 2026 and kept up to date. About 5–7 minutes for the UI part.

## Before the presentation

1. Two terminals in `frontend/`:
   - `npm.cmd run api` — the screening service with the trained model. Wait for "Application startup complete".
   - `npm.cmd run dev` — the website.
2. Open **http://127.0.0.1:5173** in Edge or Chrome, full screen (F11). Refresh once so the session is clean.
3. Open `demo-images\` (in the project folder) in File Explorer. It holds three samples from **fold 1, the model's held-out test fold**, which it never saw in training:
   - `1-positive-sample-40` (3 PNG fields)
   - `2-negative-sample-866` (3 BMP fields)
   - `3-fields-disagree-sample-137` (3 PNG fields)
   If the folder is missing: `backend\.venv\Scripts\python.exe backend\scripts\copy_demo_images.py`.
4. Check **Reduce motion** (sidebar footer) is off, unless the projector stutters.

## Flow

| # | Do | Say |
| --- | --- | --- |
| 1 | Open the **Workspace**. | "A clinician prepares one patient sample at a time. A sample is three to four microscopy fields." |
| 2 | Drag in the three images from `1-positive-sample-40`. | "Files are checked (format, size, corrupt, duplicate). They go only to the model running on this computer and are not stored." |
| 3 | Point at **Screening model** (leave the default), then click **Analyse sample**. | "Our EfficientNet-B0, trained on the AIDA dataset at 512 pixels, screens each field. The fields are then combined by majority into one sample result." |
| 4 | On the review screen, go top to bottom through the right panel. | "ANA positive, three of three fields agree. Each field shows the model's calibrated confidence for its call. The screen always says *decision support, not a diagnosis*." |
| 5 | Open **Analysis details**. | "Every result names the exact weights file and its hash, the training round, and how the image was prepared, so it can be traced to the model that produced it." |
| 6 | Click a field, then use ← → and Esc. | "Every field can be inspected full screen. The image is never cropped or filtered." |
| 7 | **View field results**, then **Complete review**. | "The clinician confirms they have looked at it. This records when; it does not change the model output." |
| 8 | **New sample**, drag in `2-negative-sample-866`, analyse. | "A negative sample: all three fields negative." |
| 9 | **New sample**, drag in `3-fields-disagree-sample-137`, analyse. | "Here the fields disagree: two positive, one negative at only 63% confidence. The sample is reported positive but flagged *needs a closer look*." |
| 10 | *(Optional)* Open demo **S-0251** from the Workspace. | "The built-in demo samples use drawn artwork and hand-written values, and are labelled as demo data." |

## Be clear about what is what

- **Uploaded samples (S-0301 onward)** are real model output from `models/efficientnet-b0-aida-r1/best.pt` (EfficientNet-B0, cross-validation round 1). On its held-out fold the website reproduces the training result exactly: 416 images, TN 114 · FP 2 · FN 30 · TP 270 (sensitivity 0.900, specificity 0.983). It is a research model trained on public AIDA data only; the UI says *Not clinically validated*.
- **The sample-level rule** (majority, a tie counts as positive) is provisional and will be agreed with the clinical collaborator. There is no sample-level confidence, because the model scores single images.
- **Known weakness:** at the 0.5 cut-off the model misses about 1 in 10 positive fields (it leans negative), and it looks only at the centre square of each image.
- **Demo samples (S-0248 … S-0270)** use generated images and hand-written results, labelled **Demo data** and **Synthetic illustration**. Do not demo the model on the synthetic images from `assets-source`: they are drawn artwork, not real microscopy.

## If something goes wrong

- "The screening service on this computer is not responding": the `npm.cmd run api` terminal was closed. Start it again and press **Retry**; the images are kept.
- A blank or odd screen: refresh. Session samples are lost, but demo samples are always there.
- A rejected upload: JPEG, PNG and BMP up to 20 MB and 12 images are accepted.
- The **Screening model** list says the service is not running: start `npm.cmd run api` and press **Check again**.
- Slow projector: switch on **Reduce motion**.
- Backup: screenshots of every screen are in `UI Concepts/Screen-Desktop-*.png` and `Screen-Mobile-*.png` (screens 2–4 show the real model on sample 40).

## Optional: show two models on the same sample

After step 9, press **New sample**, choose **ResNet18 · AIDA · 512 px** under **Screening model**, drag in `3-fields-disagree-sample-137` again and analyse. Say: "The same fields, a different model with different preprocessing. This one sees the whole field padded with black; the other sees the centre square. Each result names the model that produced it." Sample 137 is held out for both models. Do not present the two models' test figures as a comparison: they were tested on different splits.

## Optional: cell-level patterns

Open **Cell patterns** in the sidebar and drag in the four images from `demo-images\cells\`, then press **Classify cells**.

- Say: "This is the next stage. It takes one cropped cell, not a whole field, and places it in one of three pattern families. It shows the probability of all three, and it tells you when it is not sure."
- Point at `uncertain-true-nucleolar-37499.png`: "This cell is really nucleolar. The model says homogeneous at 60%, and flags it as uncertain, so a person checks it."
- Be clear about three things: the model knows only these three families (anything else still gets one of the three names); these demo cells come from the dataset the model was trained on, so they are not a held-out test; and the thumbnail shows the cell as the model sees it, with the original one click away.
