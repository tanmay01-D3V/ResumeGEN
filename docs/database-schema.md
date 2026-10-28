# Database schema

ResumeGEN stores each workspace under the authenticated user's UID. The API derives that UID from
the verified bearer token; it never accepts a client-supplied UID for data access.

Two repository implementations share the same contract:

| Mode | Selected when | Location |
| --- | --- | --- |
| Firestore | Firebase Admin credentials exist and `DEMO_MODE` is `auto`/`false` | `users/{uid}/...` |
| Local JSON | No Admin credentials, `DEMO_MODE=true`, or tests | `DB_FILE` (default `Backend/.data/db.json`) |

The local store is a demo adapter, not a second production database. It mirrors the nested
Firestore shape and persists atomically to disk. `DB_FILE=:memory:` is used by tests.

## Firestore layout

```text
users/{uid}
  email: string
  displayName: string
  createdAt: ISO-8601 string
  lastLoginAt: ISO-8601 string
  authMode: "firebase" | "demo"

  portfolio/{recordId}
  jobDescriptions/{jobId}
  resumes/{resumeId}
  integrations/google_sheets
```

All documents use ISO-8601 UTC strings for timestamps. Record IDs are generated server-side with a
prefix (`seed_`, `jd_`, `res_`, `gen_`) and are stable across exports/syncs. No sequence numbers or
title-based identities are used.

### `users/{uid}` — profile

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | Verified token email; lower-cased for demo accounts. |
| `displayName` | string | Shown in the UI and used in default resume titles. |
| `createdAt` | ISO string | Set once, preserved on login. |
| `lastLoginAt` | ISO string | Updated on `/api/me` and demo login. |
| `authMode` | `"firebase" \| "demo"` | Makes demo data visible as demo data. |

### `users/{uid}/portfolio/{recordId}` — verified evidence

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable server-generated ID; also stored as the document ID. |
| `category` | enum | One of the 13 portfolio categories. |
| `title` | string | Display title; not required to be unique except for singletons. |
| `data` | object | Category-specific fields, validated by the matching Zod schema. |
| `tags` | string[] | Free-form tags; `sample-data` marks seeded records. |
| `sourceType` | enum | `manual`, `ai_structured`, `seed`, `sheets_import`. |
| `verificationStatus` | enum | `verified`, `needs_review`, `unverified`. |
| `createdAt` / `updatedAt` | ISO strings | `updatedAt` changes on edits and sheet imports. |

Categories (`shared/categories.ts` is the canonical source):

`personal_info`, `summary`, `education`, `technical_skills`, `soft_skills`, `certifications`,
`projects`, `experience`, `achievements`, `publications`, `extracurriculars`, `languages`,
`competencies`.

`personal_info` and `summary` are singleton categories: the service rejects duplicates. Only
`verificationStatus: "verified"` records can be selected into a resume; sheet edits are downgraded to
`needs_review` until the user re-verifies them.

Example project record:

```json
{
  "id": "seed_01J...",
  "category": "projects",
  "title": "Churn Prediction Pipeline",
  "data": {
    "name": "Churn Prediction Pipeline",
    "role": "Solo project",
    "description": "Built an end-to-end churn prediction pipeline...",
    "technologies": ["Python", "scikit-learn", "pandas"],
    "responsibilities": ["Profiled and cleaned 7,000 synthetic customer records."],
    "achievements": ["Improved ROC-AUC to 0.89 on a held-out test set."],
    "metrics": ["0.89 ROC-AUC", "Reduced cleaning steps from 11 to 4"],
    "startDate": "2023-09",
    "endDate": "2023-12",
    "repoUrl": "https://github.com/example/churn-pipeline",
    "demoUrl": "https://example.com/churn-demo"
  },
  "tags": ["sample-data", "ml"],
  "sourceType": "seed",
  "verificationStatus": "verified",
  "createdAt": "2026-10-28T16:00:00.000Z",
  "updatedAt": "2026-10-28T16:00:00.000Z"
}
```

### `users/{uid}/jobDescriptions/{jobId}` — role requirements

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `jd_...`; document ID. |
| `jobTitle` / `company` | string | Required title; company may be blank. |
| `jobUrl` | string? | Optional, validated as HTTP(S). |
| `rawText` | string | Up to 30,000 characters, sanitized. |
| `analysis` | object? | Extracted requirement map. |
| `analysisTimestamp` | ISO string? | When the current analysis was produced. |
| `analysisEngine` | `"gemini" \| "heuristic"`? | Honest provenance label. |
| `schemaVersion` | `1` | Literal schema marker. |
| `createdAt` / `updatedAt` | ISO strings | |

`analysis` contains `jobTitle`, `company`, `requiredSkills`, `preferredSkills`, `technologies`,
`qualifications`, `preferredQualifications`, `experienceRequirements`, `responsibilities`,
`keywords`, `relevantProjectTypes`, `requestedCertifications`.

Editing `rawText` clears the previous analysis, preventing stale requirements from being reused.
Matching and generation fail if the job has no analysis.

### `users/{uid}/resumes/{resumeId}` — immutable snapshot

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `res_...`; document ID. |
| `title` | string | User-facing version title. |
| `jobDescriptionId`, `jobTitle`, `company` | string | Role context. |
| `selectedRecordIds` | string[] | Ordered evidence selection. |
| `settings` | object | `summary?`, `sectionOrder`, `template`, `layout`, `contactOverrides`. |
| `document` | object | Full generated resume document (header, summary, sections, template, warnings). |
| `generationVersion` | string | `gen_...`; identifies the generation. |
| `portfolioFingerprint` | string | Hash of selected records + job + settings. |
| `aiAssisted` | boolean | Whether a Gemini-grounded summary was used. |
| `createdAt` / `updatedAt` | ISO strings | |

`outdated` is **computed on read**, not stored: it becomes true when a selected record, the job, or a
referenced contact field changes. This keeps historical snapshots reproducible. PDF export for a
saved resume renders the stored document, not the current portfolio.

`document` shape:

```json
{
  "name": "Aarav Mehta",
  "headline": "Computer Science Graduate | ML",
  "contact": { "email": "...", "phone": "...", "location": "...", "links": [] },
  "summary": "...",
  "sections": [
    {
      "key": "projects",
      "title": "Projects",
      "items": [
        {
          "recordId": "seed_...",
          "heading": "Churn Prediction Pipeline",
          "subheading": "Solo project",
          "meta": "2023-09 – 2023-12",
          "bullets": ["..."],
          "links": [{ "label": "Repository", "url": "https://..." }]
        }
      ]
    }
  ],
  "template": "classic",
  "layout": "one_page",
  "generatedAt": "2026-10-28T16:00:00.000Z",
  "engine": "deterministic",
  "warnings": []
}
```

### `users/{uid}/integrations/google_sheets` — sync state

| Field | Type | Notes |
| --- | --- | --- |
| `spreadsheetId` | string | Spreadsheet configured by the user. |
| `autoSync` | boolean | Queue a sync marker after portfolio changes. |
| `status` | enum | `never_synced`, `synced`, `pending`, `error`. |
| `lastSyncAt` | ISO string? | Last successful sync. |
| `lastError` | string? | Sanitized error message. |
| `pendingChanges` | number | Incremented on portfolio changes until sync. |
| `updatedAt` | ISO string | |

## Ownership and access control

1. The client sends a Firebase ID token (or a signed demo token) as `Authorization: Bearer ...`.
2. `requireAuth` verifies it server-side and attaches `{ uid, email, name, authMode }` to the request.
3. Every repository call receives that `uid` as the first argument and scopes its query/path to it.
4. No route reads a UID from the body, query string or a client-provided field.
5. Cross-user record IDs return `404`, not another user's data.

### Firestore rules

The React client uses Firebase only for authentication; it does not use the Firestore SDK. Therefore
`firestore.rules` denies **all** direct client reads and writes:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The Express API uses the Admin SDK, which bypasses these rules after performing its own auth,
validation, ownership and grounding checks. This is stricter than allowing `request.auth.uid == uid`
writes and prevents a browser from skipping server-side validation. If a future feature needs direct
client reads, scope them to `users/{uid}` and keep writes disabled or move them behind the API.

Deployment (requires Firebase CLI and a selected project):

```bash
firebase deploy --only firestore:rules
```

The rules are checked in but **were not deployed or emulator-tested in this environment**.

## Indexes

Queries are simple per-subcollection reads scoped by UID; no composite indexes are required. If you
add sorting/filtering server-side, create indexes for the relevant subcollection fields
(`category`, `updatedAt`, `verificationStatus`).

## Local demo store

`Backend/.data/db.json`:

```json
{
  "schemaVersion": 1,
  "users": {
    "demo_demoexamplecom": {
      "profile": { "...": "..." },
      "portfolio": [],
      "jobDescriptions": [],
      "resumes": [],
      "integration": null
    }
  }
}
```

It is ignored by git and safe to delete to reset the demo. `npm run seed` recreates the fictional
portfolio and sample jobs for `demo@example.com` only when the server is in demo mode.

## Google Sheets mapping

Each category is projected into a tab. Base columns are always:

`Record ID`, `Record Type`, `Title`, `Tags`, `Source Type`, `Verification Status`, `Created At`,
`Updated At`

Category-specific columns follow, derived from `CATEGORY_META` field labels. `Record ID` is the
upsert key; sheet rows without an ID are preserved rather than deleted. See
[google-sheets-setup.md](google-sheets-setup.md).
