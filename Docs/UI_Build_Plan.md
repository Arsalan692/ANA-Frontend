# ANA / LAB — Frontend UI build plan

Scope: **frontend UI only**. There is no backend or API work in this plan.

**Current priority: ANA positive vs negative.** On **Friday 2 October 2026** the team presents a model that classifies a sample as positive or negative. The UI therefore first delivers a complete positive/negative workflow. Pattern classification (AC codes) and the other screens come after Friday.

Visual reference: `UI Concepts/D-Scientific-Editorial.png`, adapted for a positive/negative result. The pattern name and pattern-reference areas are left out until pattern classification exists. Product context: `ANA_Project_Context_Handoff.pdf` and `FYP-I_Project_Proposal_updated.docx`.

We build one phase at a time. A phase is done only when `npm.cmd run build`, `lint`, `test` and `test:e2e` all pass and the screens have been checked at 1440, 1280, 768 and 390 px. After that, update the status table.

## Status

| # | Phase | Track | Status |
| --- | --- | --- | --- |
| 0 | Foundation and sample preparation | — | Done (existing code) |
| 1 | Positive/negative data and UI building blocks | Friday | Done (29 Sep 2026) |
| 2 | Sample review screen (pos/neg) | Friday | Done (29 Sep 2026) |
| 3 | Simulated analysis flow and simple image viewer | Friday | Done (29 Sep 2026) |
| 4 | Friday demo readiness | Friday | Done (29 Sep 2026) |
| 5 | Pattern classification UI | Later | Not started |
| 6 | Full image viewer | Later | Not started |
| 7 | Sample history | Later | Not started |
| 8 | Research view | Later | Not started |
| 9 | Polish and final UI pass | Later | Not started |

## UI rules (every phase)

- The result is a screening output, **not a diagnosis**. "Decision support, not a diagnosis." appears on every result screen.
- Result values are demo data until a model is connected, and are visibly labelled as such ("Demo data" badge, "Simulated" on results). No invented model versions or metrics.
- Neither positive nor negative gets "good/bad" colours: no green tick for negative, no red alarm for positive. Status is always written in words, never shown by colour alone.
- Confidence is shown only when the data has it, and never called "certainty". The sample-level result and confidence come from the data; the UI does not calculate them.
- Keep the result data behind small hooks (`useSample(id)`), so a real model's output can replace the demo data without changing screens.
- No patient-identifying fields. Samples use neutral references such as `S-0248`.
- Keep D's look: warm ivory, navy and cobalt, Newsreader serif headings, IBM Plex Sans UI text, fine rules, etched blue artwork, and calm motion that respects reduced-motion.

## Frontend structure

- `src/types/`: sample, image, image result, sample result, review state.
- `src/demo/`: demo samples and synthetic demo images (in memory), read through hooks.
- `src/features/{workspace,samples,viewer}/` now; `history/` and `research/` later.
- `src/components/ui/`: shared pieces (badge, result status, confidence bar, field agreement, meta row, empty state).

---

# Friday track — positive vs negative

## Phase 0 — Foundation and sample preparation (done)

This phase covers the shell, routing, tokens and fonts, the motion system, the help dialog, the mobile drawer, and the `/workspace` upload screen (drop or pick, validation, previews, remove, clear).

## Phase 1 — Positive/negative data and UI building blocks

- Types: each image gets `positive | negative` and an optional confidence. The sample result holds status, optional confidence, field agreement (for example 3 of 4 fields positive) and a needs-review flag.
- Demo samples:
  - all fields positive
  - all fields negative
  - fields disagree (needs review)
  - no confidence available
- Synthetic fluorescence-style demo images: bright staining for positive, dim for negative. Each is captioned "Synthetic illustration".
- Shared components: `Badge`, `ResultStatus`, `ConfidenceBar`, `FieldAgreement`, `MetaRow`.
- Remove phase numbers from in-app copy (Help dialog, workspace note, placeholder pages), and update the Help text to describe positive/negative screening.

**Done when:** every component renders all four demo states, and unit tests cover the demo data shape.

## Phase 2 — Sample review screen (pos/neg)

**Route `/samples/:sampleId`, laid out like D:**
- **Header:** breadcrumb, "Demo data" badge, serif "Sample review" title, subtitle, and a meta row (reference · image count · status) with **New sample**.
- **Field grid:** 2×2 dark image tiles with captions (Field 01 · Positive · 95.1%) and an expand icon. One image shows large; more than 4 scroll.
- **Interpretation panel:**
  - SAMPLE SCREENING eyebrow and a large **ANA positive / ANA negative** result.
  - Confidence bar and field agreement squares (for example "4 of 4 fields positive").
  - A needs-review note when fields disagree.
  - **Complete review** and **View field results** buttons.
  - Analysis details (demo), and a quiet note that pattern classification comes in a later version.
  - The disclaimer.
- **States:** positive, negative, disagreement, no confidence, sample not found.
- **Shell:** D has no top bar. Move the breadcrumb and badge into the page header, and move the motion switch and help into the sidebar footer.
- **Responsive:** the panel drops below the grid on smaller screens, with one tile per row on phones.

**Done when:** it is recognisably D at 1440 px and every state renders.

## Phase 3 — Simulated analysis flow and simple image viewer

- Enable **Analyse sample** in the workspace. It shows staged progress (preparing → screening → ready) labelled "Simulated analysis", then opens the review screen for the uploaded images with a demo result.
- A demo failure state with **Retry** that keeps the images.
- **Complete review:** marks the sample reviewed with a time and a quiet confirmation.
- **New sample:** returns to a clean workspace, confirming first if a draft would be lost.
- **Simple viewer:** clicking a tile opens a dark full-screen view of that field with previous/next, its result, and Esc to close with focus returned. Zoom and pan come later.
- Guards against double clicks and against showing a result for the wrong sample.

**Done when:** upload → analyse → review → complete works end to end.

_As built:_ uploaded fields are screened by a labelled brightness simulation (`src/demo/simulateAnalysis.ts`, not a model; no confidence reported). The failure is triggered by a "Simulate a failed analysis (demo)" checkbox. On success the draft images move into a session sample (S-0301 onward), so **New sample** never discards work and needs no confirmation. Complete review was built in Phase 2.

## Phase 4 — Friday demo readiness

- Compare the review screen against D and polish spacing, type and motion.
- Browser tests for the full journey, plus the positive, negative and disagreement states.
- Responsive and keyboard check, and no console errors.
- A one-click route to each demo sample for the presentation, and a short demo script in `Docs/`.
- Updated screenshots in `UI Concepts/`.

**Done when:** the Friday demo runs start to finish without issues.

_As built:_ demo script in `Docs/Friday_Demo_Script.md`; presentation screenshots in `UI Concepts/Screen-{Desktop,Mobile}-*.png` (regenerate with `$env:CAPTURE='1'; npx.cmd playwright test screens`); full-journey tests fail on any console error; phones get a pinned "Analyse sample" bar.

---

# Later track — after Friday

## Phase 5 — Pattern classification UI
Add the pattern config (AC-1, speckled AC-2/4/5, nucleolar AC-8/9/10), pattern name and AC code in the panel and tile captions, the pattern-reference card, and pattern demo states. Keep a positive result without a pattern valid.

## Phase 6 — Full image viewer
Zoom, pan, fit and reset, keyboard zoom, and a tile-to-viewer expand animation.

## Phase 7 — Sample history
Route `/samples`: a table with search, filters, sorting, and empty and no-match states, linked to the review screen.

## Phase 8 — Research view
Route `/research`: flat vs staged diagrams in general *k*-group form, metric explainers, an honest "no experiments yet" state, and a project panel.

## Phase 9 — Polish and final UI pass
A full check against D, motion tuning, accessibility, responsive checks and browser zoom, and complete browser tests.

## Open inputs

- How the Friday model's output will be shown (per-image result and confidence, and the sample-level rule): needed to replace the demo data
- Supervisor name for the project panel: the proposal says Ubaid Chawla, the handoff says Dr. Muhammad Shahzad
