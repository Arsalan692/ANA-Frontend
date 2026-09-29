"""Convert source artwork in assets-source/ into web-sized WebP files in public/assets/.

Run from frontend/:  python scripts/optimise-assets.py   (requires Pillow)
"""
from pathlib import Path
from PIL import Image

SOURCE = Path('assets-source')
TARGET = Path('public/assets')
# Longest edge in px. Fields are shown full-screen in the viewer; illustrations are decorative.
MAX_EDGE = {'field-': 1536, 'screen-': 720, 'analysis-field': 1280, 'empty-slide': 1280}

for source in sorted(SOURCE.glob('*.png')):
    edge = next((size for prefix, size in MAX_EDGE.items() if source.stem.startswith(prefix)), None)
    if edge is None:
        continue
    image = Image.open(source).convert('RGB')
    image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    if not source.stem.startswith('field-'):
        # Map the ivory paper colour to pure white so `mix-blend-mode: multiply` leaves no visible box.
        paper = image.getpixel((2, 2))
        image = Image.merge('RGB', [band.point(lambda value, ref=ref: min(255, round(value * 255 / ref))) for band, ref in zip(image.split(), paper)])
    target = TARGET / f'{source.stem}.webp'
    image.save(target, 'WEBP', quality=82, method=6)
    print(f'{target}  {image.width}x{image.height}  {target.stat().st_size // 1024} KB')
