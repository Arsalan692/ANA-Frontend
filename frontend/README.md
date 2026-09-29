# ANA / LAB — frontend

Phase 1 of the ANA immunofluorescence classification frontend. The visual reference is **D — Scientific Editorial** in the project's `UI Concepts` folder.

## Run locally

Requires a Node version supported by the installed Vite release. Developed with Node 24.

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. On Windows, `npm.cmd` avoids PowerShell execution-policy restrictions on `npm.ps1`. On other shells, `npm` works normally.

```powershell
npm.cmd run build
npm.cmd run preview
npm.cmd run lint
npm.cmd test
```

## What Phase 1 does

- Responsive D-inspired shell with original blue cell artwork, local Newsreader/IBM Plex Sans fonts, and custom navigation.
- New-sample entry, drag/drop and file selection, image previews, removal, and confirmed draft clearing.
- JPEG/PNG type and decode validation; limits of 12 images, 20 MB per file, and 40 megapixels per decoded image. Duplicate detection uses filename, size, and last-modified metadata; it is not content hashing.
- Valid images survive a mixed invalid selection and navigation between routes.
- Guide dialog, accessible mobile drawer, motion preferences, keyboard focus, and reduced-motion support.
- Honest later-phase states for History and Research.

**No model, prediction, backend request, authentication, or image persistence is implemented.** The analysis action is disabled and explained. Draft files live only in memory and disappear on reload. Only the motion preference is stored in localStorage.

## Verification

Unit tests cover file/dimension policy. Browser tests cover preparation across navigation, corruption/duplicate handling, draft clearing, dialog focus, reduced motion, and responsive layouts.

```powershell
# Use an existing Microsoft Edge installation on Windows:
$env:PLAYWRIGHT_CHANNEL='msedge'
npm.cmd run test:e2e

# Alternatively, install Playwright's Chromium once:
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Browser screenshots are produced under `test-results/`; the test server starts automatically when needed. Dependencies are locked in `package-lock.json`.

## Structure

- `src/app/`: providers, routing, persistent shell, in-memory draft lifecycle.
- `src/components/`: custom layout and accessible controls.
- `src/features/workspace/`: sample preparation and file policy.
- `src/features/FuturePage.tsx`: explicit later-phase and unknown-route views.
- `src/motion/`: shared transition presets.
- `src/styles/`: Tailwind entry, design tokens, responsive and motion styling.
- `public/assets/`: original decorative artwork and its provenance.

The modern browser `createImageBitmap` API verifies image decoding; browser format/MIME limitations apply. Pixel limits are checked after decoding, so the per-file byte cap is also important. These are prototype limits awaiting actual lab exports. Image object URLs are revoked on removal, clearing, or provider disposal.

## Design and animation

Warm ivory, blue etched nuclei, midnight ink, fine rules, and an editorial serif/sans pairing. Local fonts are bundled by Vite through Fontsource; their OFL license files are retained in `public/licenses/`.

Motion includes active-navigation travel, short route transitions, upload-state changes, image-grid layout updates, button feedback, and dialog/drawer entrances. Empty-state art moves by only 4 px; it stops when images are loaded, when the tab is hidden, or when reduced motion is enabled. The sidebar artwork remains static during use.

Use the on-screen Reduce motion switch to pause spatial and ambient effects. A system reduced-motion setting takes precedence and cannot be overridden by this switch.

## Later phases

See `../Docs/UI_Build_Plan.md` for the phase plan and current status.
