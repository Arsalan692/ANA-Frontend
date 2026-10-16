# ANA / LAB — website

React 19, TypeScript and Vite. The visual reference is **D — Scientific Editorial** in `../UI Concepts`. The models run in the local service in `../backend`; this app reaches it through Vite's `/api` proxy. See `../README.md` for the whole project.

## Run

Developed with Node 24. On Windows, `npm.cmd` avoids PowerShell execution-policy problems with `npm.ps1`.

```powershell
npm.cmd install
npm.cmd run api      # the model service (needs ../backend set up), in its own terminal
npm.cmd run dev      # http://127.0.0.1:5173
```

| Command | What it does |
| --- | --- |
| `npm.cmd run build` | Type check and production build |
| `npm.cmd run lint` | ESLint |
| `npm.cmd test` | Unit tests (Vitest) |
| `$env:PLAYWRIGHT_CHANNEL='msedge'; npm.cmd run test:e2e` | Browser tests with the installed Edge; the service is replaced by `e2e/serviceMock.ts` |
| `$env:MODEL_E2E='1'; npx.cmd playwright test model` | Browser tests through the real models (service running, `../demo-images` present) |
| `$env:CAPTURE='1'; npx.cmd playwright test screens` | Regenerates the screenshots in `../UI Concepts` (service running) |

## Structure

| Path | What it holds |
| --- | --- |
| `src/app/` | Routing, the persistent shell, and the session state (draft, analysed samples, model choice, cells) |
| `src/api/` | The service client: `service.ts` (shared, model list), `screening.ts`, `cells.ts` |
| `src/lib/images.ts` | Checks for chosen images (type, size, duplicates, decoding), used by both pages |
| `src/features/workspace/` | Preparing a sample and running the analysis |
| `src/features/samples/` | The sample review screen |
| `src/features/cells/` | The Cell patterns page |
| `src/features/viewer/` | The full-screen field viewer |
| `src/components/` | Layout and shared UI, including the model picker |
| `src/demo/` | The built-in demo samples (synthetic images, hand-written values, labelled as such) |
| `src/styles/global.css` | Design tokens and component styles |
| `public/assets/` | Generated artwork; originals in `assets-source/` (`scripts/optimise-assets.py`) |

Nothing in the frontend names a particular model: the list of models, their names, descriptions, limits and details all come from the service. A new model appears in the model picker without any change here.

Images stay in browser memory and are sent only to the local service. Only the reduced-motion preference is stored in localStorage.
