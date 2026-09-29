# ANA frontend implementation plan

Status: Phase 1 implemented and verified, 27 September 2026. `Frontend_Build_Phases.md` is the current execution breakdown and completion record; later phases remain pending.

## 1. Outcome and design direction

Build a working React frontend for laboratory sample analysis and FYP demonstrations. The user has selected `UI Concepts/D-Scientific-Editorial.png` as the primary design reference. Preserve D's illustrated sidebar, warm ivory canvas, navy/cobalt palette, editorial hierarchy, four-image contact sheet, and separated interpretation panel. The generated concept is a reference, not a pixel-perfect specification or scientifically validated reference image.

Confirmed experience requirement: the application should feel alive, polished, and professionally animated. Motion is part of the initial component design and implementation, not an optional finishing task.

Working product wordmark: ANA / LAB. Preserve the formal project title in the About/project information view. Branding remains easy to change.

Design principles:

- Make microscopy images and sample interpretation the centre of the interface.
- Use editorial serif typography only for page headings and selected pattern titles; use a clear sans-serif for navigation, controls, captions, metadata, and results.
- Give the application its own visual identity through original scientific illustrations, careful proportions, and consistent interaction details.
- Keep clinical workflow and research demonstration distinct, reachable through the same navigation.
- Treat a sample as the primary entity, containing one or more images. Four images is a common example, not a fixed limit.
- Every visible control must work or explain why it is unavailable.
- Give navigation, upload, image inspection, and result changes a coherent motion language, while keeping imagery and reading surfaces steady during review.

## 2. Technical stack

| Area | Choice | Purpose |
| --- | --- | --- |
| Application | React with TypeScript and Vite | Component architecture, explicit data contracts, fast local development |
| Styling | Tailwind CSS with CSS custom properties | Shared tokens and responsive layouts, with custom CSS where useful |
| Accessible controls | Radix primitives | Dialogs, menus, tooltips, tabs, and focus management with custom styling |
| Navigation | React Router | Bookmarkable workspace, sample, history, and research routes |
| Animation | Motion for React plus CSS transitions | Shared motion tokens, coordinated page/state transitions, viewer expansion, and responsive microinteractions |
| Icons | Lucide React | Consistent small functional icons; original wordmark/emblem separately |
| Data fetching | TanStack Query | Loading, errors, caching, and eventual job status polling |
| Demo service | Mock Service Worker with deterministic fixtures | Exercise the same request contract before FastAPI exists |
| Verification | Vitest, React Testing Library, Playwright | Behaviour tests and complete workflow/browser checks |

Use React state for local controls and a reducer for upload/analysis lifecycle. Introduce an additional global state library only if actual cross-screen requirements justify it. Use npm and a committed lockfile. Check installed Node compatibility before scaffolding; use compatible stable package versions at implementation time.

Official references checked for this plan:

- https://vite.dev/guide/
- https://tailwindcss.com/docs/installation/using-vite
- https://www.radix-ui.com/primitives/docs/overview/introduction
- https://motion.dev/docs/react

## 3. Visual system

Initial tokens, subject to browser contrast checks:

- Canvas: warm ivory `#F7F7F2`; surface: `#FFFFFF`.
- Primary ink: midnight navy `#14213D`; secondary text: `#586477`.
- Interaction accent: cobalt `#245DD8`; border: `#DCE1E7`.
- Typography candidate: locally bundled Newsreader for display and IBM Plex Sans for interface text, retaining license files.
- Body text: approximately 15–16 px; secondary labels: 13–14 px; page headings: 32–40 px. Use tabular numerals for scores and counts.
- Spacing: a consistent 4 px scale; modest 4–8 px corner radii; dividers rather than excessive boxed cards.
- Colour communicates interaction and review state. Do not represent an ANA-positive result with a green success checkmark.

Create standalone assets during implementation using the imagegen skill:

1. Blue etched cell illustration for the lower sidebar, with an appropriate transparent or matching background. Generate separable layers if useful for a brief entrance reveal; preserve D's composition when static.
2. A related illustration for the empty upload state, with separable layers for subtle ambient motion before images are loaded.
3. Optional schematic artwork for pattern education only after its content is checked with the clinical collaborator.

Use a clean SVG for the simple product emblem and existing icon components for controls. Do not crop interface elements out of the generated concept and use them as working UI. Store assets locally, optimise dimensions, and give decorative artwork empty alt text. Never use generated microscopy as clinical evidence; any illustrative demo fields must be marked as synthetic. A pattern-reference panel stays optional until its content is validated.

## 4. Navigation and screen responsibilities

### Workspace — `/workspace`

- Default landing screen with a focused upload area, original scientific illustration, a short explanation of the sample workflow, and a clear New sample action.
- Drag/drop and file-picker inputs for multiple images belonging to one sample.
- Generate a non-identifying sample reference; no patient name, phone, or medical record fields.
- Show filename, thumbnail, size, remove action, and per-file validation feedback.
- Initial accepted formats: JPEG and PNG. Document configurable size/count limits before implementing validation. TIFF support depends on actual lab exports and decoding support.
- Validate that files decode as images, not only their filename extension. Handle duplicates deliberately and retain valid files if another file fails.
- Offer Load demo sample, visibly separate from uploading a user's own images.
- A clear Analyse sample action, unavailable when there are no valid images.

### Analysis and review — `/samples/:sampleId`

- Lifecycle: draft → uploading → queued → analysing → ready or failed. Review status is a separate property.
- Show genuine progress only when reported by the service; otherwise show a labelled indeterminate state.
- A responsive image grid: one large image for one field, two columns for common multi-image samples, scrolling for larger sets.
- A right-hand sample summary on wide screens, with sample status, supported pattern label/code, model confidence when available, and field agreement.
- Distinguish ANA-negative, ANA-positive, and incomplete/needs-review states. Disagreement is a review flag, not a new predicted ANA class.
- Preserve backend aggregation results; do not invent sample confidence by averaging image scores in the frontend.
- Display confidence only when available and with its documented meaning. Do not call it clinical certainty.
- Per-image predictions expandable below or alongside images.
- Mark reviewed records an acknowledgement and time; it does not imply clinical certification or change the model prediction.
- Show analysis timestamp and model version in a compact details area. Never invent a real model version in demo fixtures.
- Retain existing input images on recoverable failures and offer retry.

### Image viewer

- Open any field into a spacious dark viewing overlay while retaining the light application outside it.
- Zoom, pan, fit-to-view, reset, previous/next image, filename, and field prediction.
- Keyboard operation: Escape to close, arrow navigation, labelled zoom controls, and correct focus return.
- Preserve image aspect ratio and avoid cropping or colour alteration of source microscopy.
- Initial version has no heatmaps, segmentation overlays, fabricated scale bars, or diagnostic image enhancement controls.

### Sample history — `/samples`

- Search by sample reference; filter by date, analysis state, and positive/negative status.
- Compact, readable table showing sample reference, date, image count, result, and review state.
- Open a result directly and support sorting and pagination when needed.
- Design empty, no-match, loading, and error states explicitly.
- Demo fixtures can reload deterministically. User-uploaded files remain session-scoped until an approved persistent backend exists; clearly explain this behaviour. Do not silently store clinical images in localStorage.

### Research — `/research`

- A separate, restrained FYP demonstration view explaining flat and staged designs using small code-native diagrams.
- Compare metrics only when experiments share a documented evaluation setup; record class set, data split, evaluation level, model version, and experiment reference.
- Support macro/per-class F1, sensitivity, specificity, confusion matrix, and expert agreement when supplied by actual experiment results.
- Initially show a clear no-experiments state. Any demonstration metrics must be visibly labelled illustrative and must never resemble claims of achieved performance.
- Model comparison controls remain here; the clinical result view shows the model that produced its stored result.

### Supporting controls

- Small About/help view with the formal FYP title, workflow guidance, and decision-support scope.
- Display preferences and reduced-motion support; no nonfunctional settings menu.
- A subtle persistent demo banner when connected to the mock service.
- Authentication and clinical access controls belong to backend integration; do not build a cosmetic login that implies security.

## 5. Interaction and responsive behaviour

### Motion direction and tokens

- Use one shared motion configuration for durations, easing, spring presets, and reduced-motion behaviour. Prefer soft deceleration and critically damped spring movement without visible bounce.
- Immediate interaction feedback: 100–160 ms. Menus and local changes: 160–220 ms. Route/panel transitions: 220–300 ms. Image expansion: 260–360 ms. These are starting ranges to tune in-browser.
- Route content enters with a short opacity transition and at most 6–10 px movement; the navigation shell remains stable. Keep overlapping exits brief, avoid blank frames, and restore scroll/focus appropriately.
- Small groups may enter with 30–45 ms stagger, capped so useful content appears promptly. Do not stagger long tables or replay entrances on every data refresh.
- Controls remain responsive during transitions. Fast navigation, repeated clicks, and Escape must cancel or interrupt motion cleanly without duplicate overlays or stale content.

### Effects by interaction

| Element or event | Planned behaviour |
| --- | --- |
| Sidebar navigation | Active marker moves smoothly; icon and text colour transition together; keyboard focus remains distinct |
| Buttons | Gentle surface/shadow change on hover; 1 px press feedback; a small arrow translation on primary actions; no layout movement |
| Upload drop zone | Border and background respond when files enter; illustration briefly settles into an active state |
| Added/removed images | Short fade and position transition; the grid closes gaps smoothly while retaining the user's focus |
| Image tile | Fine border emphasis and expand-control reveal on hover/focus; microscopy content itself remains unchanged |
| Expanded viewer | Animate from the selected tile's bounds into the dark viewer where feasible, then settle at correct aspect ratio; use a fade fallback across incompatible layouts |
| Viewer navigation | Brief image crossfade and immediate caption update; zoom/pan tracks input directly without floaty lag |
| Analysis state | A contained indeterminate indicator and stable stage labels; transition to results when the service finishes |
| Interpretation panel | Coordinated short reveal of result and supporting fields; show exact confidence immediately rather than counting through invented intermediate values |
| Accordions and menus | Smooth height/opacity changes, anchored to their trigger, with correct focus and keyboard handling |
| Review acknowledgement | Subtle icon and label change; no celebratory animation for clinical results |
| Research diagrams | User-triggered highlighting of stages and connections to explain the pipeline during demonstrations |

### Scientific artwork and atmosphere

- Preserve the etched blue scientific artwork as D's signature. A short layered reveal can accompany first entry; keep the sidebar illustration static during sample inspection.
- In the empty upload state only, allow a very slow 2–4 px drift of decorative layers. Provide a pause/display preference, stop it once images are loaded, and suspend it off-screen or when the tab is hidden.
- Use fine border highlights, modest elevation for overlays, and carefully composed surface contrast. The dark viewer backdrop may fade in, but image pixels must stay sharp and unaffected.
- Keep browser-native scrolling. Avoid scroll hijacking, custom cursors, pointer-following spotlights, distracting particles, or perpetual movement behind results.

### Accessibility and performance

- Respect system reduced-motion settings and offer a persisted interface preference to reduce motion further. In reduced mode, remove decorative loops, spatial movement, and stagger; make essential changes immediate or use a brief fade.
- Decorative layers never intercept pointer input or enter the accessibility tree. Hover effects have keyboard equivalents and do not hide essential information from touch users.
- Prefer transform and opacity animation. Limit layout animation to small regions, avoid large animated blur/filter effects, and pause hidden animations.
- Aim for smooth 60 fps on the target laptop and verify using browser performance tools; simplify effects when profiling reveals dropped frames. Do not add artificial network delays to make animations visible.
- Skeletons preserve layout during data loading. Inline errors explain how to recover. Status updates are announced accessibly.

### Responsive layout

- Desktop around 1440 px: approximately 208 px sidebar, flexible image area, and 320–360 px interpretation panel.
- Smaller laptops: narrower navigation and a results section that can move below the grid rather than squeeze images.
- Tablet: navigation drawer and stacked panels; narrow phones: one image per row and full-width summary.
- Check 1280, 1440, and 1920 px desktop widths, tablet, narrow mobile, and browser zoom. Maintain readable text, visible keyboard focus, and accessible touch targets.
- Browser back/forward and direct sample links must behave predictably.

## 6. Frontend architecture and backend boundary

Create the application in `frontend/`:

```text
frontend/
  public/assets/           # Optimised illustrations and local fonts
  src/
    app/                  # Providers, routing, application shell
    components/ui/        # Shared controls and feedback components
    components/layout/    # Navigation, headers, responsive shell
    features/workspace/   # Upload and analysis lifecycle
    features/samples/     # Result view and history
    features/viewer/      # Image viewer
    features/research/    # Experiment presentation
    services/             # Typed client and response handling
    mocks/                # Demo service handlers and fixtures
    types/                # Sample, image, job, prediction contracts
    styles/               # Tokens, typography, global rules
    motion/               # Shared presets, reduced-motion policy, transition helpers
    test/                 # Behaviour fixtures and setup
  e2e/
```

Core records: Sample, SampleImage, AnalysisJob, ImagePrediction, SamplePrediction, ReviewState, and ExperimentSummary. Separate binary status, pattern label/code, confidence, image agreement, and review flags. Allow missing/unsupported ICAP mappings without forcing a fabricated code.

Provisional service operations: create sample, upload images, start analysis, get analysis status, retrieve sample result, list samples, and mark reviewed. Agree request/response schemas with FastAPI integration. Keep the service boundary separate from components so switching off the mock service does not require rewriting screens.

Mock results are deterministic fixtures selected for demos, never actual inference on uploaded images. Uploading a user-selected image in demo mode must explicitly state that any returned prediction is simulated. Mock failure and delay scenarios must be reproducible.

## 7. Build order and reviewable milestones

The detailed execution split in `Frontend_Build_Phases.md` refines this sequence: Phase 1 includes browser-only image selection and validation so the foundation can be meaningfully tested; complete analysis and service integration remain in Phase 3.

1. **Foundation and assets:** scaffold the React app; define visual and motion tokens and fonts; create original asset files; build the responsive shell, animated controls, and routing. Deliverable: navigable visual foundation with local assets and reduced-motion support.
2. **Polished sample review:** implement D's four-image review screen and expanded viewer first, using a fixed labelled demo sample. Include navigation transitions, tile-to-viewer motion, and interpretation-panel transitions. Review typography, spacing, hierarchy, responsiveness, and interaction feel against D before spreading the design across screens.
3. **Complete sample workflow:** implement upload validation, service contracts, mock job lifecycle, real preview handling, result scenarios, retry, and review acknowledgement. Deliverable: a complete demonstrable workflow.
4. **History and research:** connect history to demo records, implement search/filter/detail navigation, add research diagrams and honest empty/illustrative experiment states.
5. **Hardening and handoff:** verify accessibility, responsive layouts, failure recovery, browser memory cleanup, tests, and production build. Profile transitions, test rapid interruptions and reduced motion, and refine the timing on a real laptop. Document local start/build commands, mock limitations, data contracts, and the FastAPI connection points.

Backend authentication, secure storage, actual model inference, scientific reference approval, and real experiment reporting remain explicitly tracked integration dependencies. The frontend can be complete as a demo before these exist, but is not thereby ready for clinical deployment.

## 8. Verification and completion criteria

- A user can load a demo or select images, analyse in visibly simulated mode, inspect every image, review a sample result, mark it reviewed, and return to it through history within the supported session.
- Positive, negative, conflicting-field, missing-confidence, invalid-file, empty-history, failed-job, and missing-sample states are all handled.
- Retrying or switching samples cannot attach stale predictions to the wrong images. Repeated clicks cannot start unintended duplicate jobs.
- Keyboard-only upload/review flow works, dialogs restore focus, status is not conveyed by colour alone, and reduced motion is respected.
- D's visual identity is recognisable in the implemented screen. Motion remains consistent across navigation, uploads, viewer transitions, and results; review imagery stays steady and readable.
- Rapid route changes, repeated viewer open/close, and result arrivals during navigation leave no stuck overlays or mismatched content. Reduced-motion mode removes ambient loops and spatial transitions. Hidden tabs suspend decorative animation.
- Uploaded-image object URLs are released when no longer needed. Large images do not distort the page or leave unreleased previews.
- Behaviour tests cover validation and lifecycle transitions; end-to-end tests cover the main workflow, history navigation, and failure recovery. Avoid tests that merely repeat component markup.
- Type checking, linting, tests, and production build pass. Inspect screenshots at target screen sizes and verify no runtime console errors.
- Every mock value is identified, custom visuals are stored in the repository, font licenses are retained, and no patient-identifying input is requested.

## 9. Boundaries for the first release

Deliver a polished light application with a dark expanded image viewer. Defer a full alternate theme, live collaboration, account administration, PDF clinical reports, image annotations, heatmaps, mixed-pattern classification, and titre prediction. These are separate additions with their own data and validation needs.

Outstanding clinical inputs do not block the frontend shell: final supported pattern set, actual image formats/sizes, confidence semantics, sample aggregation rules, and retention/access requirements. Model and clinical rules must remain configurable rather than being guessed inside interface code.
