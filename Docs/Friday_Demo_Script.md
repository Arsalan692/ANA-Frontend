# Friday demo script — ANA positive / negative screening UI

Presentation: **Friday 2 October 2026**. About 5–7 minutes for the UI part.

## Before the presentation

1. In `frontend/`, run `npm.cmd run dev` and open **http://127.0.0.1:5173** in Edge or Chrome, full screen (F11).
2. Refresh once so the session is clean (no "Analysed this session" samples).
3. Keep `frontend\assets-source\` open in File Explorer; you will drag images from it.
   - Positive: `field-positive-01…04.png`
   - Negative: `field-negative-01…04.png`
   - Weak: `field-weak-01…02.png`
4. Check **Reduce motion** (sidebar footer) is off, unless the projector stutters.

## Flow

| # | Do | Say |
| --- | --- | --- |
| 1 | Open the **Workspace**. | "A clinician prepares one patient sample at a time. A sample is three to four microscopy fields." |
| 2 | Drag in `field-positive-01…04`. Point at the draft grid. | "Files are checked (JPEG/PNG, size, corrupt, duplicate) and stay in the browser. Nothing is uploaded." |
| 3 | Click **Analyse sample**. | "Each field is screened, then the fields are brought together into one sample-level result." |
| 4 | On the review screen, go top to bottom through the right panel. | "ANA positive. Field agreement shows how many fields support the result. The screen always says *decision support, not a diagnosis*." |
| 5 | Click a field, then use ← → and Esc. | "Every field can be inspected full screen. The image is never cropped or filtered." |
| 6 | **View field results**, then **Complete review**. | "The clinician confirms they have looked at it. This records when; it does not change the model output." |
| 7 | **New sample**. Drag `field-weak-01` and `field-negative-01`, then analyse. | "When fields disagree or staining is weak, the sample is flagged *needs a closer look*." |
| 8 | Back on the Workspace, open demo **S-0251**. | "A negative sample, with the model's confidence per field." |
| 9 | Open demo **S-0263**. | "A disagreement case with confidence values: 2 of 4 fields agree." |
| 10 | *(Optional)* Tick **Simulate a failed analysis (demo)**, analyse, then **Retry**. | "If analysis fails, the images are kept and the user can retry." |

## Be clear about what is simulated

- **Demo samples (S-0248 … S-0270)** use generated images and hand-written results, labelled **Demo data** and **Synthetic illustration**.
- **Uploaded samples (S-0301 onward)** are screened by a **brightness rule**, not the trained model. They are labelled **Simulated analysis**, and no confidence is shown for them.
- The review screen is built to show the real model's output: a per-field result with optional confidence, plus the sample-level result. Connecting the model replaces `frontend/src/demo/simulateAnalysis.ts`; the screens stay the same.

## If something goes wrong

- A blank or odd screen: refresh. Session samples are lost, but demo samples are always there.
- A rejected upload: only JPEG/PNG up to 20 MB and 12 images are accepted. Use the PNGs in `assets-source`.
- Slow projector: switch on **Reduce motion**.
- Backup: screenshots of every screen are in `UI Concepts/Screen-Desktop-*.png` and `Screen-Mobile-*.png`.
