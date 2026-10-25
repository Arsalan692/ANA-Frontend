"""
Phase 9: is this HEp-2 cell Homogeneous (AC-1)? Calibrated probability from the 5-round 6-class model.

Research use only, not a diagnosis.

Input: one or more cell images (files or folders). Two kinds are accepted:
  qi     - a greyscale single-cell crop like the Qi dataset (longest side <= 100 px). Used as is.
  photo  - anything else, e.g. a green FITC immunofluorescence image of one cell (RGB). Converted:
           1. colour -> greyscale: the green channel carries the FITC signal (red/blue are only noise);
              if the image is not green-dominant, ordinary luminance is used instead.
           2. find the cell: smooth, Otsu threshold, keep the largest bright region (preferring the centre).
           3. crop the cell's bounding box with a small margin.
           4. rescale so its longest side is 75 px (the median Qi crop), because the network learned at
              that scale. Cell size carries no class information in Qi (Phase 3), so nothing is lost.
  --mode auto (default) picks: greyscale and <= 100 px -> qi, otherwise photo.

Then exactly the training pipeline: centred on a 100x100 black canvas, per-cell brightness stretch
(5th percentile -> black, 99.5th -> white), centre 88x88 enlarged to 176x176, each round's normalisation.
Each round model's output is calibrated with its own temperature (Phase 7); the 5 probabilities are averaged.

Output columns:
  prob_homogeneous     calibrated probability (assumes ~23% Homogeneous cells, as in Qi; see --prior)
  homogeneous          prob >= cut-off (best balanced accuracy on validation)
  homogeneous_strict   prob >= strict cut-off (~95% specificity on validation)
  uncertain            0.2 < prob < 0.8: worth a human look
  named_pattern        the 6-class model's most likely pattern, and its probability
  round_spread         highest minus lowest Homogeneous probability among the 5 round models. Large values
                       (e.g. > 0.4) mean the models disagree: typical for images unlike the training data.
                       Informational only; not validated, because every Qi cell was seen by 3 of the 5 models.
  mode                 qi / photo (how the image was prepared)

Needs (default --models outputs/runs/6class_strong_aug):
  round_0..4/best.pt and round_0..4/metrics.json   (from Drive runs/6class_strong_aug/)
  outputs/phase7/calibration.json                    (or --calibration)

Examples (from the project folder):
  python scripts/predict_homogeneous.py my_cells/ --out predictions.csv --preview preview.png
  python scripts/predict_homogeneous.py cell1.png cell2.png
  python scripts/predict_homogeneous.py --self-test          # checks against the saved test scores
  python scripts/predict_homogeneous.py --preview-only my_cells/ --preview preview.png   # no weights needed
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

PROJECT = Path(__file__).resolve().parent.parent
DEFAULT_MODELS = PROJECT / "outputs" / "runs" / "6class_strong_aug"
DEFAULT_CALIB = PROJECT / "outputs" / "phase7" / "calibration.json"
RUN_NAME = "6class_strong_aug"
CLASS_NAMES = ["Homogeneous", "Speckled", "Nucleolar", "Centromere", "NuclearMembrane", "Golgi"]
CANVAS, CROP, INPUT_SIZE = 100, 88, 176
QI_MAX_SIDE = 100
TARGET_SIDE = 75                 # median longest side of a Qi cell crop
MARGIN = 0.04                    # margin around the found cell, share of its size
TRAIN_SHARE_HOMOGENEOUS = 14367 / 63445
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}


# ------------------------------------------------------------------ image preparation
def to_grey(img):
    """PIL image -> 2-D float array (0..255) plus a note on how it was converted."""
    a = np.asarray(img)
    if a.dtype == np.uint16 or a.max() > 255:                    # 16-bit microscope images
        a = a.astype(np.float64) / max(1, a.max()) * 255
    a = a.astype(np.float64)
    if a.ndim == 2:
        return a, "grey"
    rgb = a[..., :3]
    r, g, b = (rgb[..., c].mean() for c in range(3))
    if g > 1.5 * max(r, b, 1e-6):
        return rgb[..., 1], "green channel"
    return rgb @ np.array([0.299, 0.587, 0.114]), "luminance"


def otsu(x):
    hist, edges = np.histogram(x, bins=256)
    p = hist / hist.sum()
    w = np.cumsum(p)
    mu = np.cumsum(p * edges[:-1])
    between = (mu[-1] * w - mu) ** 2 / np.maximum(w * (1 - w), 1e-12)
    return edges[int(np.argmax(between))]


def find_cell(grey):
    """Bounding box (top, bottom, left, right) of the main bright region."""
    smooth = ndimage.gaussian_filter(grey, sigma=max(1.0, min(grey.shape) / 60))
    mask = ndimage.binary_fill_holes(smooth > otsu(smooth))
    lab, n = ndimage.label(mask)
    if n == 0:
        return 0, grey.shape[0], 0, grey.shape[1]
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    centre = lab[grey.shape[0] // 2, grey.shape[1] // 2]
    keep = centre if centre > 0 and sizes[centre - 1] >= 0.25 * sizes.max() else int(np.argmax(sizes)) + 1
    rows, cols = np.where(lab == keep)
    t, b, l, r = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
    m = int(round(MARGIN * max(b - t, r - l)))
    return max(0, t - m), min(grey.shape[0], b + m), max(0, l - m), min(grey.shape[1], r + m)


def prepare(path, mode="auto"):
    """Image file -> (uint8 cell crop at Qi scale, mode used, conversion note)."""
    img = Image.open(path)
    grey, note = to_grey(img)
    if mode == "auto":
        mode = "qi" if note == "grey" and max(grey.shape) <= QI_MAX_SIDE else "photo"
    if mode == "qi":
        if max(grey.shape) > QI_MAX_SIDE:
            raise ValueError(f"{path}: {grey.shape} is larger than a Qi crop; use --mode photo")
        return np.clip(np.round(grey), 0, 255).astype(np.uint8), mode, note
    t, b, l, r = find_cell(grey)
    cell = grey[t:b, l:r]
    scale = TARGET_SIDE / max(cell.shape)
    size = (max(1, round(cell.shape[1] * scale)), max(1, round(cell.shape[0] * scale)))   # PIL: (width, height)
    cell = Image.fromarray(np.clip(cell, 0, 255).astype(np.float32)).resize(size, Image.BILINEAR if scale > 1 else Image.LANCZOS)
    return np.clip(np.round(np.asarray(cell)), 0, 255).astype(np.uint8), mode, note


def to_canvas(cell):
    """Centre the crop on the 100x100 black canvas exactly as Phase 2 did, then the brightness stretch."""
    h, w = cell.shape
    top, left = (CANVAS - h) // 2, (CANVAS - w) // 2
    a = cell.astype(np.float32)
    lo, hi = np.percentile(a, [5, 99.5])
    hi = max(hi, lo + 8)
    out = np.zeros((CANVAS, CANVAS), np.uint8)
    out[top:top + h, left:left + w] = np.clip((a - lo) / (hi - lo), 0, 1) * 255   # truncated to uint8, as in training
    return out


# ------------------------------------------------------------------ model
def load_models(models_dir, calib_path):
    import timm
    import torch
    calib = json.loads(Path(calib_path).read_text())["models"][RUN_NAME]
    models = []
    for k in range(5):
        rd = Path(models_dir) / f"round_{k}"
        missing = [f for f in ["best.pt", "metrics.json"] if not (rd / f).exists()]
        if missing:
            sys.exit(f"missing {', '.join(missing)} in {rd}\nDownload them from Drive: runs/{RUN_NAME}/round_{k}/")
        m = json.loads((rd / "metrics.json").read_text())
        net = timm.create_model(m["model"], pretrained=False, num_classes=6, in_chans=1)
        net.load_state_dict(torch.load(rd / "best.pt", map_location="cpu"))
        models.append({"net": net.eval(), "mean": m["mean"], "std": m["std"],
                       "T": calib["temperature_per_round"][str(k)]})
    return models, calib


def network_input(canvases, mean, std):
    """Same as training make_batch() without augmentation: centre 88x88 -> 176x176, then normalise."""
    import torch
    import torch.nn.functional as F
    x = torch.from_numpy(np.stack(canvases)).float().div(255).unsqueeze(1)
    b = x.shape[0]
    theta = torch.zeros(b, 2, 3)
    theta[:, 0, 0] = theta[:, 1, 1] = CROP / CANVAS
    grid = F.affine_grid(theta, (b, 1, INPUT_SIZE, INPUT_SIZE), align_corners=False)
    x = F.grid_sample(x, grid, mode="bilinear", padding_mode="zeros", align_corners=False)
    return (x - mean) / std


def predict_canvases(canvases, models, temperature=True):
    """Per round: probabilities of all 6 patterns (calibrated if temperature=True). Returns (5, N, 6)."""
    import torch
    out = []
    with torch.no_grad():
        for m in models:
            probs = []
            for s in range(0, len(canvases), 256):
                logits = m["net"](network_input(canvases[s:s + 256], m["mean"], m["std"])).double()
                probs.append(torch.softmax(logits / (m["T"] if temperature else 1.0), 1).numpy())
            out.append(np.concatenate(probs))
    return np.stack(out)


def prior_adjust(p, prior):
    """Re-weight the Homogeneous probability for a setting where a share `prior` of cells is Homogeneous."""
    odds = p / np.clip(1 - p, 1e-9, None)
    k = (prior / (1 - prior)) / (TRAIN_SHARE_HOMOGENEOUS / (1 - TRAIN_SHARE_HOMOGENEOUS))
    return odds * k / (1 + odds * k)


# ------------------------------------------------------------------ outputs
def save_preview(paths, cells, canvases, notes, out_png):
    """Original | prepared crop | what the network sees, one row per image (max 12)."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    n = min(12, len(paths))
    fig, axes = plt.subplots(n, 3, figsize=(6.6, 2.2 * n), squeeze=False)
    for i in range(n):
        orig = Image.open(paths[i])
        axes[i, 0].imshow(orig if orig.mode in ("RGB", "RGBA") else np.asarray(orig), cmap="gray")
        axes[i, 1].imshow(cells[i], cmap="gray")
        axes[i, 2].imshow(canvases[i][6:94, 6:94], cmap="gray", vmin=0, vmax=255)
        axes[i, 0].set_title(Path(paths[i]).name[:22], fontsize=7)
        axes[i, 1].set_title(f"{notes[i]} {cells[i].shape[1]}x{cells[i].shape[0]}", fontsize=7)
        axes[i, 2].set_title("network sees (stretched)", fontsize=7)
        for ax in axes[i]:
            ax.axis("off")
    fig.tight_layout()
    fig.savefig(out_png, dpi=110)
    plt.close(fig)
    print("preview saved:", out_png)


def collect(inputs):
    paths = []
    for s in inputs:
        p = Path(s)
        paths += sorted(q for q in p.rglob("*") if q.suffix.lower() in IMAGE_EXT) if p.is_dir() else [p]
    return paths


def self_test(models_dir, calib_path, n_per_round=40):
    """Each round model on its own test cells (from the original PNGs) must reproduce the saved scores."""
    import pandas as pd
    sys.path.insert(0, str(PROJECT / "scripts"))
    import config
    models, _ = load_models(models_dir, calib_path)
    # Training ran in half precision on a GPU (logits saved in ~0.004 steps); here full precision on a CPU.
    # A preprocessing or weight error would shift every cell; precision only moves a few mid-range scores.
    med_all, worst = [], 0.0
    for k, m in enumerate(models):
        s = pd.read_csv(Path(models_dir) / f"round_{k}" / "image_scores.csv")
        s = s[s.split == "test"].sample(n_per_round, random_state=k)
        canv = [to_canvas(prepare(config.CELLS_IMG_DIR / f"{fi}.png", "qi")[0]) for fi in s.file_index]
        p = predict_canvases(canv, [m], temperature=False)[0][:, 0]
        err = np.abs(p - s.score.values)
        med_all.append(np.median(err)); worst = max(worst, err.max())
        print(f"round {k}: {n_per_round} test cells, difference from the saved score: typical {np.median(err):.5f}, largest {err.max():.4f}")
    ok = max(med_all) < 0.001 and worst < 0.05
    print("SELF-TEST", "PASSED" if ok else "FAILED",
          f"(typical difference {max(med_all):.5f}, allowed 0.001; largest {worst:.4f}, allowed 0.05)")
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("inputs", nargs="*", help="image files or folders")
    ap.add_argument("--mode", choices=["auto", "qi", "photo"], default="auto")
    ap.add_argument("--models", default=str(DEFAULT_MODELS))
    ap.add_argument("--calibration", default=str(DEFAULT_CALIB))
    ap.add_argument("--prior", type=float, default=None,
                    help=f"share of Homogeneous cells expected in your setting (default: Qi's {TRAIN_SHARE_HOMOGENEOUS:.3f})")
    ap.add_argument("--out", default=None, help="CSV file for the results")
    ap.add_argument("--preview", default=None, help="PNG showing how each image was prepared")
    ap.add_argument("--preview-only", action="store_true", help="only prepare the images and save the preview")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()

    if a.self_test:
        sys.exit(0 if self_test(a.models, a.calibration) else 1)
    paths = collect(a.inputs)
    if not paths:
        ap.error("no images given")

    prepared = [prepare(p, a.mode) for p in paths]
    cells = [c for c, _, _ in prepared]
    canvases = [to_canvas(c) for c in cells]
    notes = [f"{m}, {n}" for _, m, n in prepared]
    if a.preview:
        save_preview(paths, cells, canvases, notes, a.preview)
    if a.preview_only:
        return

    import pandas as pd
    models, calib = load_models(a.models, a.calibration)
    per_round = predict_canvases(canvases, models)                     # (5, N, 6)
    probs = per_round.mean(0)                                          # average of the 5 calibrated models
    p = probs[:, 0] if a.prior is None else prior_adjust(probs[:, 0], a.prior)
    lo, hi = json.loads(Path(a.calibration).read_text())["uncertain_band"]
    res = pd.DataFrame({
        "file": [str(x) for x in paths],
        "prob_homogeneous": p.round(4),
        "homogeneous": p >= calib["cutoff"],
        "homogeneous_strict": p >= calib["cutoff_95spec"],
        "uncertain": (p > lo) & (p < hi),
        "named_pattern": [CLASS_NAMES[i] for i in probs.argmax(1)],
        "named_pattern_prob": probs.max(1).round(4),
        "round_spread": (per_round[:, :, 0].max(0) - per_round[:, :, 0].min(0)).round(3),
        "mode": notes,
    })
    pd.set_option("display.width", 200)
    print(res.drop(columns="file").assign(file=[Path(x).name for x in res.file]).to_string(index=False))
    print(f"cut-off {calib['cutoff']:.3f} | strict cut-off {calib['cutoff_95spec']:.3f} | uncertain band {lo}-{hi}"
          + (f" | prior adjusted to {a.prior}" if a.prior is not None else ""))
    print("Research use only, not a diagnosis.")
    if a.out:
        res.to_csv(a.out, index=False)
        print("saved", a.out)


if __name__ == "__main__":
    main()
