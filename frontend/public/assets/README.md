# Artwork and demo images

All images here are **generated artwork**. None of them is real microscopy, an ANA reference pattern, or clinical evidence. Decorative images use empty alternative text. Wherever a demo field is shown, the UI marks it as a synthetic illustration.

## Decorative illustrations (etched cobalt style)

| File | Use |
| --- | --- |
| `cell-etching.webp` | Sidebar, upload empty state, placeholder pages. Transparent background (the ivory paper is converted to alpha by the script), so it sits on any surface with no box. `cell-etching.png` is the opaque original, kept here as an upload fixture for the e2e tests |
| `screen-positive.webp` / `screen-negative.webp` | Result panel art for ANA positive / negative |
| `analysis-field.webp` | Analysis-in-progress screen |
| `empty-slide.webp` | Empty and not-found states |

`cell-etching.png` prompt: Premium scientific editorial illustration for an ANA laboratory application; portrait composition of five overlapping elongated oval nuclei; translucent cobalt/indigo blue; fine stippled and etched contour texture; asymmetrical diagonal cluster; warm ivory background approximately #F7F7F2; no text, labels, arrows, shadows, or frame. Decorative scientific branding, not a diagnostic diagram.

## Synthetic fluorescence fields (demo samples only)

`field-positive-01…04`, `field-negative-01…04` and `field-weak-01…02` imitate HEp-2 IIF fields for the demo samples in `src/demo/samples.ts`. They were generated with an image model from prompts describing bright, dim and weak green nuclei on black.

## Source files

The full-size PNG originals are in `frontend/assets-source/`. To regenerate the WebP files here, run `python scripts/optimise-assets.py` from `frontend/` (requires Pillow).
