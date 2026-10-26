"""Four cell patterns with one Swin-Tiny vision transformer, trained in the Colab notebook
HEp2_Notebook_ViT.ipynb (the notebook also trains ResNet-50 and ViT-B/16; only Swin-Tiny is used here) on the
Qi et al. ("XianBio") single-cell set, classes 1-4.

File: models/swin-tiny/best_swin_tiny_patch4_window7_224.pth, the state dict the notebook saved (Cell 8).

Preprocessing is the notebook's, line by line (there is no inference script to vendor):
- Cell 7's test transform `val_tf`: Resize((224, 224)) -> ToTensor() -> Normalize(ImageNet mean, std);
- torchvision ImageFolder's loader, which opens each image and converts it to RGB (a grey cell becomes three
  equal channels);
- the class order is ImageFolder's (folder names sorted): Centromere, Homogeneous, Nucleolar, Speckled.

The model was trained on greyscale cells only. Green images are given to it as their green channel:
- a green false-colour copy of a grey cell (red and blue all zero) gives back exactly the grey cell, so the
  model sees what it was trained on;
- any other colour image (e.g. a FITC photo) is a conversion the model was never tested on: experimental.
"""
import base64
import hashlib
from io import BytesIO
from pathlib import Path

import numpy as np
import timm
import torch
from PIL import Image
from torchvision import transforms

from .base import CellPrediction, CellRecipe, CheckReport, Detail

ARCH = 'swin_tiny_patch4_window7_224'
WEIGHTS = f'best_{ARCH}.pth'
MODEL_ORDER = ('Centromere', 'Homogeneous', 'Nucleolar', 'Speckled')  # The network's outputs (ImageFolder order).
CLASSES = ('Homogeneous', 'Speckled', 'Nucleolar', 'Centromere')     # As the website shows them (dataset order).
CLASS_MAP = {1: 'Homogeneous', 2: 'Speckled', 3: 'Nucleolar', 4: 'Centromere'}  # Notebook Cell 4.

# Notebook Cell 7, unchanged.
mean = [0.485, 0.456, 0.406]
std = [0.229, 0.224, 0.225]
val_tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean, std),
])
model_input = transforms.Resize((224, 224))  # The same resize, kept as a picture for display (model view).


def as_training_input(image: Image.Image) -> tuple[Image.Image, str]:
    """The image as ImageFolder would have loaded a training cell: RGB with three equal channels.
    Returns the image and how it was prepared: 'grey', 'green' (exact false colour) or 'colour' (experimental)."""
    rgb = image.convert('RGB')  # torchvision's pil_loader.
    pixels = np.asarray(rgb)
    if (pixels[..., 0] == pixels[..., 1]).all() and (pixels[..., 1] == pixels[..., 2]).all():
        return rgb, 'grey'
    mode = 'green' if not pixels[..., 0].any() and not pixels[..., 2].any() else 'colour'
    return Image.fromarray(pixels[..., 1]).convert('RGB'), mode


def green(cell: Image.Image) -> Image.Image:
    """A grey cell as a green false-colour image (grey value in the green channel, red and blue zero), the way a
    FITC image looks. as_training_input() turns it back into exactly the grey cell."""
    grey = np.asarray(cell.convert('L'))
    return Image.fromarray(np.dstack([np.zeros_like(grey), grey, np.zeros_like(grey)]))


class SwinTiny(CellRecipe):
    id = 'swin-tiny'
    label = 'Swin-Tiny transformer · 4 patterns'
    summary = 'Names the most likely of four patterns. One Swin-Tiny vision transformer trained on greyscale cells of the Qi et al. set; green images use their green channel.'
    files = (WEIGHTS,)
    classes = CLASSES
    min_confidence = None
    oversized_side = 200  # Training cells were 62 to 100 px across.
    limits = (
        'Upload one cropped cell per image, not a whole microscope field.',
        'Trained on greyscale cells. Green images are read from their green channel: exact for a green copy of a greyscale cell, experimental for other colour photos.',
        'It knows four patterns: Homogeneous, Speckled, Nucleolar and Centromere. Any other pattern, or a negative cell, still gets one of these names.',
        'For research and demonstration only, not for diagnosis.',
    )

    def uncertain_rule(self) -> str:
        return 'never: the probabilities are not calibrated and there is no validated uncertainty rule yet'

    def load(self, folder: Path, device: torch.device):
        model = timm.create_model(ARCH, pretrained=False, num_classes=len(MODEL_ORDER))
        model.load_state_dict(torch.load(folder / WEIGHTS, map_location=device, weights_only=True))  # Strict.
        return model.to(device).eval(), []

    @torch.inference_mode()
    def probabilities(self, model, images: list[Image.Image]) -> np.ndarray:
        """(cells, 4) softmax probabilities in MODEL_ORDER, for images already prepared by as_training_input()."""
        x = torch.stack([val_tf(image) for image in images]).to(next(model.parameters()).device)
        return model(x).softmax(1).cpu().numpy()

    def classify(self, model, image: Image.Image) -> CellPrediction:
        prepared, mode = as_training_input(image)
        by_name = dict(zip(MODEL_ORDER, self.probabilities(model, [prepared])[0].tolist()))
        named = {name: by_name[name] for name in CLASSES}
        family = max(named, key=named.get)
        warnings = []
        if mode == 'colour':
            warnings.append({'title': 'Experimental', 'text': 'This is a colour image, not a greyscale cell like the training cells, so the model was given its green channel. It is untested on such images.'})
        prepared_as = {'grey': 'greyscale cell, used as is',
                       'green': 'green image: its green channel, which is exactly the greyscale cell',
                       'colour': 'colour image: its green channel only (experimental)'}[mode]
        return CellPrediction(family, named[family], False, named, model_view=model_view(prepared), warnings=warnings,
                              facts=[{'label': 'Prepared as', 'value': prepared_as}], extra={'preparation': mode})

    def details(self) -> list[Detail]:
        return [
            {'label': 'Model', 'value': 'Swin-Tiny vision transformer (timm swin_tiny_patch4_window7_224), ImageNet-pretrained, fine-tuned for 7 epochs'},
            {'label': 'Training', 'value': 'Qi et al. HEp-2 single-cell set, four patterns (56,016 cells); random 70 / 15 / 15 split, stratified by pattern'},
            {'label': 'Input', 'value': 'Greyscale cell resized to 224 × 224 px, ImageNet normalisation, as in training; green images use their green channel'},
            {'label': 'Answer', 'value': 'The most likely of the four patterns, with all four probabilities (not calibrated)'},
            {'label': 'Uncertainty', 'value': 'Not flagged: there is no validated rule yet. Read the four probabilities'},
            {'label': 'Test result', 'value': 'Accuracy 0.960, Cohen’s κ 0.947 on 8,403 test cells. The split is random, so cells from one slide are in both training and test: likely optimistic, and not comparable with the other cell models'},
        ]

    def check(self, model, folder: Path) -> CheckReport:
        """The notebook saved no predictions, only its test report (Cell 11). So: rebuild its test set exactly
        (Cells 4-5: cells2.txt order, classes 1-4, train_test_split with random_state=42, stratified), run all
        8,403 test cells through this recipe and compare with the report. The notebook ran on a GPU, so a few
        near-tie answers may differ: accuracy, κ and every per-class precision and recall must be within 0.003.
        Also: a green false-colour copy of a test cell must give exactly the grey cell's probabilities."""
        from sklearn.metrics import cohen_kappa_score, precision_recall_fscore_support
        te_p, te_l = test_split()
        lines = [f'Weights {WEIGHTS} sha256 {hashlib.sha256((folder / WEIGHTS).read_bytes()).hexdigest()[:16]} (the notebook kept the original on Google Drive)',
                 f'Test set rebuilt as in the notebook: {len(te_p)} cells (notebook: 8403)']
        predicted, modes = [], set()
        for start in range(0, len(te_p), 64):
            batch = []
            for path in te_p[start:start + 64]:
                with Image.open(path) as image:
                    prepared, mode = as_training_input(image)
                batch.append(prepared)
                modes.add(mode)
            predicted += [MODEL_ORDER[i] for i in self.probabilities(model, batch).argmax(1)]
        precision, recall, _, support = precision_recall_fscore_support(te_l, predicted, labels=list(MODEL_ORDER))
        accuracy = float(np.mean(np.array(predicted) == np.array(te_l)))
        kappa = cohen_kappa_score(te_l, predicted)
        reported = {'accuracy': 0.960, 'kappa': 0.9468, 'precision': (0.989, 0.941, 0.979, 0.936), 'recall': (0.989, 0.948, 0.961, 0.944),
                    'support': (2061, 2155, 1988, 2199)}  # Notebook Cell 11 output, in MODEL_ORDER.
        worst = max(abs(accuracy - reported['accuracy']), abs(kappa - reported['kappa']),
                    *np.abs(precision - reported['precision']), *np.abs(recall - reported['recall']))
        lines.append(f'All cells read as greyscale: {modes == {"grey"}}')
        lines.append(f'accuracy {accuracy:.4f} (notebook 0.960) · kappa {kappa:.4f} (notebook 0.9468)')
        for name, p, r, n, rp, rr in zip(MODEL_ORDER, precision, recall, support, reported['precision'], reported['recall']):
            lines.append(f'{name}: precision {p:.3f} (notebook {rp:.3f}) · recall {r:.3f} (notebook {rr:.3f}) · {n} cells')
        lines.append(f'largest difference from the notebook report: {worst:.4f} (tolerance 0.003)')
        with Image.open(te_p[0]) as a, Image.open(te_p[1]) as b:
            greys, greens = [as_training_input(a)[0], as_training_input(b)[0]], [as_training_input(green(a)), as_training_input(green(b))]
        same_green = all(mode == 'green' for _, mode in greens) and np.array_equal(
            self.probabilities(model, greys), self.probabilities(model, [image for image, _ in greens]))
        lines.append(f'Green false-colour copies give exactly the grey probabilities: {same_green}')
        passed = (len(te_p) == 8403 and tuple(support) == reported['support'] and modes == {'grey'} and worst <= 0.003 and same_green)
        return CheckReport(passed, lines)


def test_split() -> tuple[list[Path], list[str]]:
    """The notebook's test cells and their labels, rebuilt exactly as Cells 4-5 made them: cells2.txt order,
    classes 1-4 only, then train_test_split 70 / 30 and 15 / 15, random_state=42, stratified by pattern."""
    import scipy.io
    from sklearn.model_selection import train_test_split
    from .checks import ROOT
    raw = ROOT / 'datasets' / 'cells'
    labels_raw = scipy.io.loadmat(str(raw / 'labels.mat'))['labels'].flatten()
    with open(raw / 'cells2.txt') as f:
        filenames = [Path(line.strip()).name for line in f if line.strip()]
    pairs = [(raw / 'cells' / name, CLASS_MAP[int(label)]) for name, label in zip(filenames, labels_raw)
             if int(label) <= 4 and (raw / 'cells' / name).exists()]
    all_paths, all_labels = [p[0] for p in pairs], [p[1] for p in pairs]
    _, tmp_p, _, tmp_l = train_test_split(all_paths, all_labels, test_size=0.30, random_state=42, stratify=all_labels)
    _, te_p, _, te_l = train_test_split(tmp_p, tmp_l, test_size=0.50, random_state=42, stratify=tmp_l)
    return te_p, te_l


def model_view(prepared: Image.Image) -> str:
    """What the network is given, before normalisation: the 224 × 224 px cell (grey; a green image's green
    channel). Display only; the prediction never uses this copy."""
    buffer = BytesIO()
    model_input(prepared).convert('L').save(buffer, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')


RECIPE = SwinTiny()
