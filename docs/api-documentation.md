# API documentation

Base URL: `http://localhost:5050/api` (development). The Vite dev server proxies `/api` from
`http://localhost:5173`.

All JSON responses use a `data` envelope. Errors use an `error` envelope.

```json
{ "data": { "...": "..." } }
```

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please check the highlighted fields.",
    "details": [{ "path": "rawText", "message": "Paste at least a few sentences..." }]
  }
}
```

## Authentication

Every endpoint except the four public endpoints requires:

```http
Authorization: Bearer <firebase-id-token-or-demo-token>
```

The server derives the user from the token. A `uid` in a request body/query is ignored.

### Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Process status, auth mode, store kind, AI/Sheets configuration. |
| `GET` | `/config` | Public config used by the UI. |
| `POST` | `/auth/demo` | Create/sign in a local demo account. Only available in demo mode. |

#### `POST /auth/demo`

```json
{ "email": "demo@example.com", "name": "Aarav Mehta", "intent": "signin" }
```

Returns `{ token, user, config, notice }`. The token is an HMAC-signed demo token; it is not a
Firebase token and must not be used in production.

In Firebase mode this endpoint returns `403 forbidden`.

## Current user, dashboard and seeding

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/me` | Refreshes and returns the profile plus public config. |
| `PATCH` | `/me` | Body: `{ "displayName": "Ada Lovelace" }`. |
| `POST` | `/demo/seed` | Seeds the fictional demo portfolio/jobs; idempotent. Returns counts. |
| `GET` | `/dashboard` | Counts, recent records, recent resumes, Sheets status and checklist booleans. |

`GET /dashboard` data:

```json
{
  "counts": {
    "portfolioEntries": 42,
    "projects": 3,
    "technicalSkills": 19,
    "certifications": 1,
    "experiences": 2,
    "savedResumes": 2,
    "jobDescriptions": 2
  },
  "categoryCounts": { "projects": 3, "technical_skills": 19 },
  "recentRecords": [{ "id": "seed_...", "title": "Python", "category": "technical_skills", "updatedAt": "..." }],
  "recentResumes": [{ "id": "res_...", "title": "...", "jobTitle": "Machine Learning Engineer", "company": "...", "updatedAt": "..." }],
  "sheets": { "configured": false, "autoSync": false, "status": "never_synced", "pendingChanges": 0, "missingCredentials": ["..."] },
  "hasPersonalInfo": true,
  "hasSummary": true
}
```

## Portfolio

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/portfolio` | List the user's records, newest first. |
| `POST` | `/portfolio` | Create a validated record. |
| `GET` | `/portfolio/:id` | Get one record. |
| `PATCH` | `/portfolio/:id` | Partial update (`category`, `title`, `data`, `tags`, `verificationStatus`). |
| `DELETE` | `/portfolio/:id` | Delete; `{ id, deleted: true }`. |
| `POST` | `/portfolio/structure-text` | AI-structure pasted text into candidate records. |
| `POST` | `/portfolio/import-preview` | Alias of `structure-text`. |
| `POST` | `/portfolio/import-confirm` | Validate and save reviewed candidates. |

### Create a record

```json
{
  "category": "projects",
  "title": "Churn Prediction Pipeline",
  "data": {
    "name": "Churn Prediction Pipeline",
    "description": "Built an end-to-end churn pipeline with Python and scikit-learn.",
    "technologies": ["Python", "scikit-learn"],
    "metrics": ["0.89 ROC-AUC"]
  },
  "tags": ["ml"],
  "sourceType": "manual",
  "verificationStatus": "verified"
}
```

Response `201`: `{ "data": { "record": { "...": "..." } } }`.

`personal_info` and `summary` are singletons; a duplicate returns
`409 conflict`. Invalid data returns `400 validation_error` with field paths.

### AI structuring

```json
{ "text": "Paste a project description, resume bullets or notes here." }
```

`structure-text` requires Gemini; without configuration it returns `503 not_configured`. The
response is `{ records, notes, engine: "gemini" }`. Each candidate includes `category`, `title`,
`data`, `sourceExcerpt`, `confidence`, `missingInformation`, `warnings` and `validationIssues`.
Nothing is saved until `import-confirm`:

```json
{
  "records": [
    {
      "category": "projects",
      "title": "Churn Prediction Pipeline",
      "data": { "name": "Churn Prediction Pipeline", "description": "..." },
      "tags": ["ml"]
    }
  ]
}
```

Response `201`: `{ "created": [...], "skipped": [{ "title": "...", "reason": "..." }] }`. If every
record fails validation, the endpoint returns `400` with `details.skipped`.

## Job descriptions

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/job-descriptions` | List saved jobs. |
| `POST` | `/job-descriptions` | Create a job. |
| `GET` | `/job-descriptions/:id` | Get one job. |
| `PATCH` | `/job-descriptions/:id` | Edit title/company/URL/text. |
| `DELETE` | `/job-descriptions/:id` | Delete. |
| `POST` | `/job-descriptions/:id/analyze` | Run Gemini extraction or the heuristic fallback. |

Create body:

```json
{
  "jobTitle": "Machine Learning Engineer",
  "company": "Northstar Analytics (fictional)",
  "jobUrl": "https://example.com/jobs/ml-engineer",
  "rawText": "Responsibilities ... Required qualifications ... Preferred qualifications ..."
}
```

`rawText` must be 40–30,000 characters. Create and update responses use the key
**`jobDescription`**:

```json
{ "data": { "jobDescription": { "id": "jd_...", "jobTitle": "...", "analysis": {}, "analysisEngine": "heuristic" } } }
```

The list response uses `jobDescriptions`. Analyze returns:

```json
{
  "data": {
    "job": { "...": "..." },
    "warning": "Gemini is not configured. Analysis used the local heuristic engine."
  }
}
```

`warning` is present when the heuristic fallback ran. It is omitted when Gemini succeeded. Editing
`rawText` clears `analysis`/`analysisTimestamp`/`analysisEngine`.

## Matching

`POST /resumes/match`

```json
{ "jobDescriptionId": "jd_...", "useAi": true }
```

Response `data`:

```json
{
  "jobDescriptionId": "jd_...",
  "matches": [
    {
      "requirement": "Python",
      "requirementType": "required_skill",
      "status": "strong",
      "matchKind": "exact",
      "recordIds": ["seed_..."],
      "evidence": [{ "recordId": "seed_...", "excerpt": "Python — Advanced" }],
      "explanation": "The portfolio explicitly names Python."
    }
  ],
  "missingRequirements": ["Kubernetes"],
  "rankedRecords": [{ "recordId": "seed_...", "relevance": 98, "reason": "...", "matchedRequirements": ["Python"] }],
  "engine": "deterministic",
  "notes": "Gemini is not configured; deterministic evidence rules were used.",
  "generatedAt": "2026-10-28T16:00:00.000Z"
}
```

Statuses: `strong`, `partial`, `not_evidenced`. `engine` is `gemini+deterministic` only when Gemini
was configured and its output passed merging guardrails. AI may not upgrade a match to `strong`
without explicit verified evidence, and fabricated record IDs are discarded.

## Resume generation and PDFs

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/resumes/generate` | Assemble a resume document server-side. |
| `POST` | `/resumes/pdf` | Render a preview PDF from the same request. Returns `application/pdf`. |
| `POST` | `/resumes/suggestions` | Deterministic/AI improvement suggestions. |
| `GET` | `/resumes` | List saved snapshots with computed `outdated`. |
| `POST` | `/resumes` | Save an immutable snapshot. |
| `GET` | `/resumes/:id` | Get a snapshot. |
| `PATCH` | `/resumes/:id` | Rename: `{ "title": "..." }`. |
| `DELETE` | `/resumes/:id` | Delete. |
| `GET` | `/resumes/:id/pdf` | Render the stored snapshot. Returns `application/pdf`. |

Generate/PDF body:

```json
{
  "jobDescriptionId": "jd_...",
  "selectedRecordIds": ["seed_...", "seed_..."],
  "title": "Machine Learning Engineer — tailored",
  "settings": {
    "summary": "Optional. Omit to use the verified portfolio summary.",
    "sectionOrder": ["summary", "skills", "experience", "projects", "education", "certifications"],
    "template": "classic",
    "layout": "one_page",
    "contactOverrides": {}
  },
  "useAiSummary": false
}
```

`template`: `classic`, `modern`, `compact`. `layout`: `one_page`, `two_page`.
Selected records must be verified and owned by the user; otherwise the request fails instead of
silently dropping evidence. Generate response:

```json
{
  "data": {
    "document": { "...": "..." },
    "generationVersion": "gen_...",
    "portfolioFingerprint": "sha256:..."
  }
}
```

PDF requests ignore `useAiSummary` and render the already-approved summary deterministically, so the
downloaded file cannot drift from what was reviewed. Filenames look like
`Aarav_Mehta_Machine_Learning_Engineer_Resume.pdf`; unsafe characters are removed and a UTF-8
filename is also sent.

Save body is the same as generate, plus `title` is required and `aiAssisted` is a boolean. Response
`201`: `{ "data": { "resume": { "...": "..." } } }`. The server regenerates and stores the document;
it does not accept a client-supplied document.

Suggestions body:

```json
{
  "jobDescriptionId": "jd_...",
  "selectedRecordIds": ["seed_..."],
  "summary": "Optional current summary"
}
```

Response: `{ "suggestions": [...], "disclaimer": "..." }`. Suggestions are advisory; they never edit
the portfolio or resume automatically.

## Google Sheets

Base path: `/integrations/google-sheets`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/status` | Configuration and sync state. |
| `PATCH` | `/config` | Body: `{ "spreadsheetId": "1AbC...", "autoSync": true }`. Both fields optional, at least one required. |
| `POST` | `/sync` | Push Firestore records to the spreadsheet. |
| `GET` | `/preview` | Build the workbook locally without calling Google. |
| `POST` | `/import` | Read the sheet and return import proposals. |
| `POST` | `/import/confirm` | Body: `{ "recordIds": ["..."] }`. Apply selected proposals. |

`status` shape:

```json
{
  "status": {
    "configured": true,
    "spreadsheetId": "1AbC...",
    "spreadsheetIdMasked": "1AbC…xyz",
    "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/1AbC...",
    "autoSync": false,
    "status": "synced",
    "lastSyncAt": "2026-10-28T16:00:00.000Z",
    "pendingChanges": 0,
    "missingCredentials": []
  }
}
```

Preview returns `{ preview: { tabs: [{ name, headers, rows, recordIds }], generatedAt, recordCount } }`.
This works without Google credentials.

Sync returns `{ status, tabs: [{ name, updated, appended, removed }] }`. Without a service account,
spreadsheet ID or shared sheet it returns `503 not_configured` with `details.missing`.

Import returns `{ proposals, summary, spreadsheetIdMasked }`. Each proposal has `recordId`,
`category`, `title`, `action` (`new`, `update`, `conflict`, `unchanged`, `invalid`),
`sheetUpdatedAt`, `firestoreUpdatedAt`, `data` and `issues`. Confirm returns
`{ applied, skipped: [{ recordId, reason }] }`. Imported edits are saved with
`verificationStatus: "needs_review"` and cannot enter a resume until re-verified.

## Status codes

| Code | Meaning |
| --- | --- |
| `200` | Success. |
| `201` | Created. |
| `400` | Validation, duplicate singleton, or no importable records. |
| `401` | Missing, malformed or expired bearer token. |
| `403` | Authenticated but not allowed (for example demo login on a Firebase server). |
| `404` | Missing resource **or a resource owned by another user**. |
| `409` | Conflict (duplicate singleton, stale/concurrent state). |
| `413` | Body larger than 1 MB or a limit exceeded. |
| `429` | Rate limited. AI routes: 12/minute per user. General API: 240/minute. |
| `500` | Unexpected server error (no internals leaked). |
| `502` | Gemini/Google upstream failure. |
| `503` | Integration not configured. |

## curl examples

```bash
# Demo login
TOKEN=$(curl -s -X POST http://localhost:5050/api/auth/demo \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","name":"Aarav Mehta"}' | jq -r '.data.token')

# Dashboard
curl -s http://localhost:5050/api/dashboard -H "Authorization: Bearer $TOKEN" | jq

# Job list
curl -s http://localhost:5050/api/job-descriptions -H "Authorization: Bearer $TOKEN" | jq

# Generate a PDF
curl -s -X POST http://localhost:5050/api/resumes/pdf \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "jobDescriptionId": "jd_REPLACE_ME",
    "selectedRecordIds": ["seed_REPLACE_ME"],
    "settings": {
      "sectionOrder": ["summary", "skills", "projects", "education"],
      "template": "classic",
      "layout": "one_page",
      "contactOverrides": {}
    }
  }' --output resume.pdf
```

## Notes and limits

- JSON request bodies are limited to 1 MB.
- The API does not use cookies, so CSRF tokens are not required; bearer tokens must be kept out of
  URLs and logs.
- The in-memory rate limiter is per process. A multi-instance deployment should use a shared store.
- Response schemas are defined in `shared/schemas.ts`; that file is the source of truth if this
  document and the code ever disagree.
