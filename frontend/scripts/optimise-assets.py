"""Convert source artwork in assets-source/ into web-sized WebP files in public/assets/.

Run from frontend/:  python scripts/optimise-assets.py   (requires Pillow and NumPy)
"""
from pathlib import Path
import numpy as np
from PIL import Image

SOURCE = Path('assets-source')
TARGET = Path('public/assets')
# Longest edge in px. Fields are shown full-screen in the viewer; illustrations are decorative.
MAX_EDGE = {'field-': 1536, 'screen-': 720, 'analysis-field': 1280, 'empty-slide': 1280, 'cell-etching': 1200}
# Artwork drawn on ivory paper that is laid over varying backgrounds, so it needs real transparency.
TRANSPARENT = {'cell-etching'}


def paper_to_alpha(image: Image.Image) -> Image.Image:
    """Turn the ivory paper into transparency and un-blend the ink, so no box or blend mode is needed."""
    rgb = np.asarray(image, dtype=np.float32) / 255
    paper = rgb[2, 2]
    ink = np.array([0.08, 0.235, 0.486], dtype=np.float32)  # Deepest cobalt in the etching (0.5th percentile).
    # How far each pixel has moved from the paper towards the ink, per channel; the largest wins.
    alpha = np.clip(((paper - rgb) / (paper - ink)).max(axis=2), 0, 1)
    alpha[alpha < 0.02] = 0
    safe = np.where(alpha > 0, alpha, 1)[..., None]
    colour = np.clip((rgb - (1 - alpha[..., None]) * paper) / safe, 0, 1)
    rgba = np.dstack([colour, alpha]) * 255
    return Image.fromarray(rgba.round().astype(np.uint8))  # H×W×4 uint8 is read as RGBA


for source in sorted(SOURCE.glob('*.png')):
    edge = next((size for prefix, size in MAX_EDGE.items() if source.stem.startswith(prefix)), None)
    if edge is None:
        continue
    image = Image.open(source).convert('RGB')
    image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    if source.stem in TRANSPARENT:
        image = paper_to_alpha(image)
    elif not source.stem.startswith('field-'):
        # Map the ivory paper colour to pure white so `mix-blend-mode: multiply` leaves no visible box.
        paper = image.getpixel((2, 2))
        image = Image.merge('RGB', [band.point(lambda value, ref=ref: min(255, round(value * 255 / ref))) for band, ref in zip(image.split(), paper)])
    target = TARGET / f'{source.stem}.webp'
    image.save(target, 'WEBP', quality=82, method=6)
    print(f'{target}  {image.width}x{image.height}  {target.stat().st_size // 1024} KB')
