
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

- `frontend/` — the React/TypeScript/Vite app (the only code in the repo). Run all commands from here.
- `Docs/` — `UI_Build_Plan.md` is the phase plan, status table, product rules and architecture decisions; read it before starting a phase. `ANA_Project_Context_Handoff.pdf` and `FYP-I_Project_Proposal_updated.docx` hold the FYP/clinical context.
- `UI Concepts/` — design references. **D-Scientific-Editorial.png is the chosen visual reference**; `Screen-{Desktop,Mobile}-*.png` are current screenshots of the app (regenerate with `$env:CAPTURE='1'; npx.cmd playwright test screens`), `Phase-1-*.png` are older. `Docs/Friday_Demo_Script.md` is the presentation walkthrough.

## Commands (from `frontend/`)

On Windows PowerShell use `npm.cmd` / `npx.cmd` to avoid execution-policy issues with `npm.ps1`.

```powershell
npm.cmd run dev            # Vite dev server at http://127.0.0.1:5173
npm.cmd run build          # tsc -b && vite build (type check + production build)
npm.cmd run lint           # ESLint
npm.cmd test               # Vitest unit tests (src/**/*.test.ts)
npx.cmd vitest run src/features/workspace/filePolicy.test.ts   # single unit test file
npx.cmd vitest run -t "name fragment"                          # single test by name

$env:PLAYWRIGHT_CHANNEL='msedge'; npm.cmd run test:e2e          # E2E using installed Edge
npx.cmd playwright test -g "mobile"                             # single E2E test by name
```

Playwright auto-starts the dev server on port 5173 (reuses an existing one outside CI). Without `PLAYWRIGHT_CHANNEL`, run `npx.cmd playwright install chromium` once. Screenshots land in `test-results/`.

## Project status and scope

ANA / LAB is a frontend for ANA immunofluorescence pattern classification (FYP). **Phases 0–4 are implemented (the Friday track is complete)** (shell, routing, motion system, in-memory image selection/validation; pos/neg types, demo samples, shared result components; the D-style sample review screen; simulated analysis flow and field viewer; demo polish, journey tests, demo script). Current priority is the **ANA positive/negative** workflow (Phases 1–4, "Friday track"); pattern classification, history and research come later (Phases 5–9). Pending phases are tracked — see the status table in `Docs/UI_Build_Plan.md`. Work phase by phase, implement only the phase the user authorises, and update the status table only after verification (build, lint, unit, e2e pass).

Hard product rules from the plan:
- No fabricated predictions, metrics, history, or model versions. Any mock/demo value must be visibly labelled as simulated/illustrative. Unimplemented features show honest "later phase" states (`features/FuturePage.tsx`) or disabled controls with an explanation — every visible control must work or explain why not.
- No backend, auth, or image persistence yet. Draft images live only in memory; never store image data in localStorage (only the motion preference `ana-reduced-motion` is persisted).
- No patient-identifying inputs. Don't represent ANA-positive with green/success styling. Confidence is not "clinical certainty"; don't compute sample confidence in the frontend.
- Clinical/model rules (pattern set, limits, aggregation) must stay configurable, not hard-coded guesses.

## Architecture

- `src/main.tsx` → `BrowserRouter` → `app/App.tsx`. `App` wraps `MotionProvider` → `DraftProvider` → `SessionProvider` → `Shell`. `SessionProvider` (`useSession()`) holds samples analysed this session and review completions; it owns (and revokes on unmount) the object URLs of analysed images. The shell (sidebar) is persistent; routes animate inside `AnimatePresence` keyed by pathname, and on route change the shell scrolls to top and focuses `<main>`.
- Routes: `/` → `/workspace`; `/samples/:sampleId` → `features/samples/SampleReview`; `/samples` and `/research` render `FuturePage`; `*` renders the missing state. There is no top bar (concept D): each page renders `components/layout/PageHeader` (breadcrumb + optional badge), and the motion switch and help live in the sidebar footer. The sidebar marks Workspace active for `/samples/:id`.
- **Draft state** (`app/Providers.tsx`, `DraftProvider`): holds selected images above the router so drafts survive navigation. Uses an `imagesRef` mirror plus a `generation` counter so `clearDraft` cancels in‑flight async `addFiles` runs, and a `locked` ref to prevent concurrent adds. Every image gets an object URL that must be revoked on remove/clear/unmount — preserve this when changing lifecycle code.
- **Validation** (`features/workspace/filePolicy.ts`): pure functions and `LIMITS` (12 images, 20 MB, 40 MP). Metadata checks run first, then `createImageBitmap` decodes to verify the file and get dimensions. Duplicates are keyed by name:size:lastModified. This is the unit-tested module.
- **Contexts** live in `app/contexts.ts` (separate from providers for react-refresh); consume via `useDraft()` / `useMotionPreference()`, which throw if the provider is missing.
- **Motion**: `MotionProvider` combines system `prefers-reduced-motion` (always wins) with a manual toggle, sets `data-motion` and `data-visibility` on `<html>` (CSS uses these to stop ambient animation), and configures Motion's `MotionConfig`. Shared durations/easing/presets are in `src/motion/presets.ts`; reuse them rather than inlining timings. Keep motion to transform/opacity, small movements, and no motion on microscopy imagery.
- **Styling**: Tailwind v4 via `@tailwindcss/vite`, with tokens in `@theme` and `:root` in `src/styles/global.css`; most component styling is semantic classes in that file rather than utility classes. Fonts are local via Fontsource (Newsreader for display headings, IBM Plex Sans for UI); keep the OFL files in `public/licenses/`.
- Accessible primitives come from Radix (Dialog, Switch); icons from lucide-react.

- **Sample data**: types in `src/types/sample.ts` (`ScreeningCall` is `'positive' | 'negative'`; confidence is an optional 0–1 fraction; the sample-level `result` is supplied by data, never derived in the UI). Demo samples live in `src/demo/samples.ts` (positive, negative, disagreement, no-confidence). Screens must read samples only via `useSample(id)` / `useSamples()` in `features/samples/useSamples.ts` so real classifier output can replace demo data later. Display helpers are in `features/samples/format.ts`.
- **Shared result components** in `components/ui/`: `Badge`, `ResultStatus` (words plus filled/hollow marker, no good/bad colour), `ConfidenceBar` (`role="meter"`, "Not provided" when missing), `FieldAgreement`, `MetaRow`. Component tests render with `react-dom/server` in `*.test.tsx`; there is no jsdom/RTL.
- **Images**: full-size originals in `frontend/assets-source/`; web copies are generated into `public/assets/*.webp` by `python scripts/optimise-assets.py` (needs Pillow). All artwork and demo fields are synthetic; see `public/assets/README.md`.

Current scope is **UI only** (no backend/API work). Still to come (see `Docs/UI_Build_Plan.md`): `features/{samples,viewer,history,research}/` screens and, after Friday, `config/patterns.ts`.
- **Simulated analysis** (`features/workspace/useSimulatedAnalysis.ts` + `AnalysisDialog.tsx`): runs preparing → screening → finalising with a run token so cancel/unmount/retry never attach stale results. Only on success does it call `takeDraft()` (hands images over without revoking URLs) and `addSample()`, then navigates to `/samples/s-03xx`. The per-field call comes from `demo/simulateAnalysis.ts`, a brightness threshold that is **not a model** and reports no confidence; replace it when the real classifier is connected.
- **Viewer** (`features/viewer/FieldViewer.tsx`): controlled Radix dialog opened from `FieldGrid` tiles; arrow keys/prev/next, Esc closes and focus returns to the last-shown field's tile. Zoom/pan are Phase 6.
