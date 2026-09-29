# Frontend build phases

Design reference: **D — Scientific Editorial**. Implementation follows `Frontend_Implementation_Plan.md`.

**Status: Phase 1 implemented and verified. Phases 2–5 have not been implemented.**

| Phase | Scope | Completion gate |
| --- | --- | --- |
| **1. Visual foundation and sample preparation** | React/TypeScript app; local fonts and scientific artwork; D-inspired responsive shell; routing; shared controls and motion; accessible help and motion preferences; image selection, validation, previews, removal, and clear draft | App runs locally; real image selection works; keyboard/mobile/reduced-motion checks and production build pass |
| **2. Sample review and image viewer** | Labelled demo result; four-field/adaptive grid; interpretation panel; image predictions; expandable dark viewer with zoom/pan and keyboard navigation | Review screen matches D's visual standard and handles positive, negative, disagreement, and missing-confidence fixtures |
| **3. Analysis workflow and service boundary** | Typed service contracts; deterministic mock service; upload/job lifecycle; retries; simulated analysis; review acknowledgement | Full sample journey works, failed jobs recover, mock values remain explicit, no stale results between samples |
| **4. History and research** | Search/filter sample history; research diagrams; experiment comparison/empty states; supporting project information | Direct sample links, history navigation, and research presentation work with documented evaluation context |
| **5. Integration readiness and final polish** | Broader workflow tests; accessibility/performance audit; responsive refinement; frontend/backend contract documentation | Production build and complete workflow checks pass; remaining clinical/backend dependencies are documented |

## Current authorised scope

Implement **Phase 1 only** in this iteration. Later phases are explicitly deferred. Phase 1 includes enough real interaction to assess design and motion without inventing model results.

## Phase 1 behaviour

- Default route opens the new-sample workspace.
- Users can choose or drop JPEG/PNG images from one sample, see previews, remove individual images, and clear the draft.
- Initial configurable limits: 12 images, 20 MB per file, 40 megapixels per image. These are frontend prototype limits pending actual laboratory export details.
- Reject unsupported, corrupt, duplicate, or excessive files with readable messages; keep valid files from mixed selections.
- Files stay in memory for this session and are not uploaded or persisted. State survives navigation within the app; refreshing clears the draft.
- History and Research routes show designed, honest future-phase states. No fake history, metrics, or predictions.
- Help explains the project, current capabilities, and later workflow. Motion preferences persist locally; image data does not.
- The analysis control states that analysis arrives in Phase 3 and is unavailable in this build.

## Phase 1 handoff

See `frontend/README.md` for setup, commands, architecture, verification, and known limits. Update phase status only after verification. No backend, authentication, or clinical deployment is included in this phase.

### Verification completed

- TypeScript/production build: passed.
- ESLint: passed.
- File-policy unit tests: 4 passed.
- Headless Microsoft Edge workflow tests: 4 passed.
- Screenshots inspected at 1440 px and 390 px; automated horizontal-overflow checks passed at 1440, 1280, 768, and 390 px.
- Verified draft persistence across navigation, file corruption/duplicate rejection, removal/clearing, dialog focus restoration, persisted motion preference, and live system reduced-motion updates.
- Actual implemented-screen previews saved in `UI Concepts/Phase-1-Desktop.png` and `UI Concepts/Phase-1-Mobile.png`.

The main remaining limitations are intentional: no analysis, prediction, backend storage, history records, experiment results, or expanded image viewer yet.
