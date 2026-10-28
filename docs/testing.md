# Testing and verification

This document records what is actually covered, how to run it, and what could not be verified
without live credentials.

Last full run: **2026-10-28**, demo mode, macOS, Node.js 22+, ports `5050`/`5173`.

| Suite | Command | Result |
| --- | --- | --- |
| Backend unit + API tests | `npm --prefix Backend test` | **72 / 72 passing** |
| Frontend unit + component tests | `npm --prefix Frontend test` | **20 / 20 passing** |
| TypeScript (both apps) | `npm run typecheck` | Passing |
| ESLint (frontend) | `npm run lint` | Passing |
| Production builds | `npm run build` | Passing |
| Playwright browser flow | `npm run test:e2e` | **17 / 17 checks passing** |

> The test projects use Vitest. Backend tests run in Node with a Supertest instance of the Express
> app; frontend tests run in jsdom with Testing Library. No test calls Gemini, Firebase or Google
> Sheets over the network.

## Run everything

```bash
npm run install:all
cp .env.example .env        # keep DEMO_MODE=auto or set DEMO_MODE=true
npm run typecheck
npm run lint
npm run test
npm run build
```

Each app can also be tested alone:

```bash
npm --prefix Backend test
npm --prefix Frontend test
npm --prefix Backend test -- --reporter=verbose
npm --prefix Frontend test -- --reporter=verbose
```

Backend tests set `DB_FILE=:memory:` and `DEMO_MODE=true`, so they never read or overwrite the demo
workspace at `Backend/.data/db.json`.

## Backend coverage (72 tests)

| File | Tests | What it protects |
| --- | ---: | --- |
| `api.test.ts` | 9 | Public health, missing/tampered tokens, uid spoofing, portfolio CRUD, validation errors, singleton duplicates, job create/analyze/edit invalidation, seed idempotency and dashboard counts. |
| `geminiService.test.ts` | 8 | JSON parsing, markdown-fenced JSON, one retry, schema-invalid output rejection, not-configured behavior, upstream failure propagation, JSON-schema request. |
| `heuristicJd.test.ts` | 5 | Required vs preferred split, responsibilities/qualifications/experience/certifications, full-stack extraction, no invented skills, prompt-injection text treated as data. |
| `matching.test.ts` | 9 | `strong`/`partial`/`not_evidenced`, aliases, narrative requirements, exclusion of personal info/summary, bounded evidence, Gemini merge guardrails (fabricated IDs, no upgrades, no textual overlap). |
| `pdf.test.ts` | 6 | Valid PDF output, multipage flow, every template, unsafe link suppression, safe filenames. |
| `resumeAssembler.test.ts` | 11 | Selection-only output, empty-section omission, section order, summary handling, template/layout/warnings, deterministic summary, AI summary grounding (numbers, skills, certifications, years). |
| `resumeFlow.test.ts` | 8 | Verified-evidence-only matching, analysis required before generation, server assembly + snapshot + staleness, rejected unverified/removed records, preview/saved PDF parity, improvement suggestions. |
| `schemas.test.ts` | 8 | Form normalisation, required fields, URL scheme safety, numeric/boolean coercion, resume settings defaults, unsupported-number detection. |
| `sheetsWorkbook.test.ts` | 8 | Tab-per-category export, stable IDs and metadata, list/boolean serialisation, upsert/append/remove behavior, no duplicate rows, header reordering, row round-trip, unknown headers. |

Important guardrail examples:

- A client-supplied `uid` is ignored; the bearer token decides the workspace.
- Cross-user record IDs return `404`, not another user's document.
- An unverified or deleted record cannot be smuggled into a resume by ID.
- Gemini cannot add record IDs that do not exist, and cannot upgrade a `partial` match to `strong`.
- A generated summary is rejected if it contains numbers, skills, certifications or years that are
  not grounded in the selected records.
- Google Sheets import proposals downgrade changed rows to `needs_review`.

## Frontend coverage (20 tests)

| File | Tests | What it protects |
| --- | ---: | --- |
| `Frontend/src/lib/builder.test.ts` | 11 | Selection de-duplication/order, exclusion of singleton categories, strong-only preselection, fallback ranking, 24-record cap, toggle behavior, search/category filtering, preview invalidation signatures. |
| `Frontend/src/components/resume/ResumePreview.test.tsx` | 5 | Header/contact/summary rendering, bullets and empty-section omission, safe links, compact template, placeholder name. |
| `Frontend/src/components/resume/PdfViewer.test.tsx` | 4 | Loading state, iframe + open link, rejected request, non-Error rejection. |

These are deliberately pure/component-level. Full routing, auth and API behavior are exercised by
the Playwright flow below instead of shallow page mocks.

## Browser end-to-end verification (17 checks)

The Playwright script drives a real Chromium browser against the running dev servers. It asserts
visible text and downloads, not just HTTP status codes.

### Prerequisites

```bash
npm run install:all
npm run seed
npm run dev            # leave running in another terminal
```

In a second terminal:

```bash
npm run test:e2e
```

The script:

1. Signs in with `demo@example.com` and reaches the dashboard.
2. Opens Portfolio and verifies search filtering (`Python`).
3. Opens the seeded Machine Learning Engineer job, runs deterministic matching, and checks the
   requirement-level evidence view.
4. Walks all six builder steps: target role → match review → evidence → customize → preview → save.
5. Confirms preselected evidence, edits the title, switches template and layout.
6. Renders the server document in the HTML preview, then loads the **Exact PDF** iframe.
7. Saves a snapshot, downloads the PDF, and asserts the file starts with `%PDF-` and is non-trivial
   in size.
8. Opens the saved snapshot, downloads its stored PDF, and verifies it appears in the library.
9. Visits Google Sheets (honest not-configured state) and Settings.
10. Switches to a 390 px viewport, opens/closes mobile navigation, and asserts no horizontal overflow.
11. Fails on any browser `console.error` or uncaught page error.
12. Deletes the resume it created so the sample workspace still contains exactly the two seeded
    snapshots.

Artifacts (screenshots and downloaded PDFs) are written to
`/private/var/folders/gx/sg983k2n7_z2m2mmnql0qj_h0000gn/T/opencode/e2e` on this machine. The path is
declared at the top of `scripts/e2e.mjs`; change it if you run on another machine.

### Screenshot regeneration

With the servers running and the seeded workspace selected:

```bash
npm run screenshots
```

This writes the 11 committed images in `docs/screenshots/`. See
[screenshot-checklist.md](screenshot-checklist.md) for what each image should show.

## What is mocked, and what that means

| External system | Test strategy | Consequence |
| --- | --- | --- |
| Gemini | Client injected; returns crafted JSON, invalid JSON, schema-invalid JSON, or throws. | Prompt-building, retry, parsing, Zod validation and grounding are tested. Actual model quality/latency/quota is **not** verified. |
| Firebase Admin / Firestore | Not used in tests; local repository is selected. | Local repository CRUD/ownership is tested. Firestore adapter and rules are **not** emulator-tested. |
| Google Sheets API | Workbook and row logic tested as pure functions; API transport is stubbed by configuration absence. | Export/upsert/import logic is tested. Live OAuth/service-account access, quotas and real sheet formatting are **not** verified. |
| PDF | Real PDFKit rendering in Node; assertions inspect bytes/page counts. | PDF validity, multipage flow and link safety are tested. Pixel-level visual comparison against the HTML preview is not. |
| Browser | Real Chromium via Playwright. | Layout, routing, downloads and console errors are verified in demo mode. |

## Manual checks worth repeating after changes

- `GET /api/health` reports `authMode`, `aiConfigured`, `sheetsConfigured` truthfully.
- A portfolio edit after saving a resume marks the snapshot **outdated**; the PDF still renders the
  stored snapshot.
- Selecting zero evidence blocks the builder; unverified records never appear as selectable.
- A job with no analysis cannot be matched or used to generate.
- Long resumes (many experience/project bullets) flow to page 2 instead of clipping, and the PDF
  filename contains no path separators or header-breaking characters.
- With `DEMO_MODE=false` and no Firebase credentials, the API refuses to start or refuses auth
  instead of silently falling back.

## Known testing gaps

- No live smoke test of Gemini, Firestore, Firebase Auth or Google Sheets.
- `firestore.rules` has not been deployed or run against the Firestore emulator.
- No visual regression snapshots of the resume templates.
- No load/performance or multi-instance rate-limit tests.
- The Playwright script assumes the seeded job titles and demo account; it is a verification script,
  not a general-purpose CI suite.
