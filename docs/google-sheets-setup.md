# Google Sheets setup

ResumeGEN can mirror the portfolio into a spreadsheet and preview spreadsheet edits before importing
them. **Firestore (or the local demo store) is authoritative.** Sheets is a projection and a review
surface, not a second source of truth.

> Live Sheets calls were **not verified** in this environment because no Google service account or
> spreadsheet was available. The workbook serializer, upsert logic, row parser, missing-configuration
> behavior and import-conflict rules are covered by unit/API tests.

## 1. Create the Google Cloud resources

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a project.
2. Enable **Google Sheets API** for that project.
3. Go to **IAM & Admin → Service Accounts → Create service account**.
4. Create a JSON key for the service account and download it.
5. Put it outside version control, for example:

   ```text
   ResumeGEN/credentials/service-account.json
   ```

   `credentials/` and `service-account*.json` are already in `.gitignore`.

The service account email looks like
`resumegen-sheets@your-project.iam.gserviceaccount.com`.

## 2. Create and share a spreadsheet

1. Create a blank Google Sheet.
2. Click **Share**, paste the service-account email, and grant **Editor**.
   The service account must be able to create tabs and write rows.
3. Copy the spreadsheet ID from the URL:

   ```text
   https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit
                                           ^---------------- spreadsheet ID ----------------^
   ```

## 3. Configure the API

In the root `.env`:

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json
GOOGLE_SHEETS_SPREADSHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

The same service account can also be used for Firebase Admin (`firebase-admin` reads the same
`GOOGLE_APPLICATION_CREDENTIALS` path). Restart `npm run dev` after changing `.env`.

Alternatively, provide Firebase credentials inline:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=resumegen-sheets@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The Sheets client requests the scope `https://www.googleapis.com/auth/spreadsheets`.

Verify the server:

```bash
curl -s http://localhost:5050/api/health | jq '.data | {authMode, sheetsConfigured}'
```

`sheetsConfigured` is true when Google credentials and a spreadsheet ID are present in the
environment. You can also set the spreadsheet ID per user from the **Google Sheets** page; that ID is
stored in `users/{uid}/integrations/google_sheets` regardless of the environment value.

## 4. Configure in the app

1. Sign in and open **Google Sheets**.
2. Enter the spreadsheet ID or full URL under **Spreadsheet** and click **Save spreadsheet**.
3. Optionally enable **Auto-sync after edits**. This records pending changes and attempts a sync
   after portfolio create/update/delete/import. Failures are stored in `lastError` and surfaced in
   the UI; they are never silently ignored.
4. Click **Sync to Sheets** for the first full sync.
5. Click **Import preview** to review spreadsheet edits.

Without credentials, the page still shows the **Export preview** generated locally from the
portfolio, and sync/import buttons remain disabled.

## Worksheet layout

Worksheets are created automatically with a frozen header row:

| Worksheet | Portfolio categories |
| --- | --- |
| `PersonalInfo` | `personal_info` |
| `Summary` | `summary` |
| `Education` | `education` |
| `Skills` | `technical_skills`, `soft_skills`, `competencies` |
| `Certifications` | `certifications` |
| `Projects` | `projects` |
| `Experience` | `experience` |
| `Achievements` | `achievements` |
| `Publications` | `publications` |
| `Activities` | `extracurriculars` |
| `Languages` | `languages` |
| `Metadata` | Application name, schema version, record count, generation time, source of truth |

Every data row starts with:

| Column | Meaning |
| --- | --- |
| `Record ID` | Stable ResumeGEN ID; the upsert key. **Do not edit.** |
| `Record Type` | Canonical category, for example `projects`. |
| `Title` | Display title. |
| `Tags` | Semicolon-separated tags. |
| `Source Type` | `manual`, `ai_structured`, `seed`, `sheets_import`. |
| `Verification Status` | `verified`, `needs_review`, `unverified`. |
| `Created At` / `Updated At` | ISO timestamps. |

Then come category-specific columns derived from `shared/categories.ts` (for example project name,
description, technologies, responsibilities, metrics, URLs). Lists are serialized with `; `;
booleans use `Yes`/`No`.

## Sync behavior

- Existing rows are matched by **`Record ID`**, not by row number or title.
- Existing column order is respected by matching headers; new columns are appended when the schema
  adds fields.
- New records append rows. Updated records update their row. Records deleted in the app are removed
  from the sheet.
- Rows without a recognizable `Record ID` are treated as user-added rows and preserved.
- Re-running a sync when nothing changed does not duplicate rows.
- If the sheet has more rows than the new data, trailing rows are cleared.
- Each tab reports `updated`, `appended` and `removed` counts.
- Sync failures are stored as `status: "error"` with a sanitized `lastError`.

## Import behavior

**Import preview** reads the sheet and compares each row with the current store using the record ID
and `Updated At` values.

| Action | Meaning |
| --- | --- |
| `new` | A row with a new ID (or a user row) that can be created. |
| `update` | The sheet is newer than the store. |
| `conflict` | Both sides changed since the last sync; review before importing. |
| `unchanged` | No effective change; import would be a no-op. |
| `invalid` | The row fails category validation; `issues` explains why. |

The UI shows proposals for review. **Import selected** sends only the chosen record IDs. Rows that
fail validation are skipped with a reason.

Imported/updated records are saved with **`verificationStatus: "needs_review"`**. This is deliberate:
spreadsheet edits are untrusted input, so they cannot enter a tailored resume until the user reviews
and re-verifies them in the portfolio. Firestore remains authoritative if the sheet is lost or
corrupted.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `403 The caller does not have permission` | Share the spreadsheet with the service-account email as **Editor**. Confirm the spreadsheet ID. |
| `Google Sheets API has not been used...` | Enable the Sheets API in the correct Cloud project; wait a minute and retry. |
| `sheetsConfigured: false` | `GOOGLE_APPLICATION_CREDENTIALS` path must exist **and** `GOOGLE_SHEETS_SPREADSHEET_ID` must be set (or set the ID in the UI). |
| `Unable to parse range` | The tab is missing; ResumeGEN creates missing tabs on sync. Re-run **Sync to Sheets**. |
| Import shows `unchanged` for everything | The sheet has no newer `Updated At` value, or the row content is identical. |
| A row is rejected | Open `issues` in the import preview; required category fields are missing or invalid. |
| Auto-sync did nothing | Auto-sync is disabled, Sheets is not configured, or the last sync failed (see **Last sync error**). |

## Security notes

- The service-account JSON is server-side only. Never add it to `Frontend/.env` or commit it.
- The spreadsheet ID is not a secret, but editing rights are. Share only with the service account
  and intended collaborators.
- Spreadsheet data is not trusted. Import validation and `needs_review` status prevent sheet edits
  from silently becoming verified resume claims.
- Google API errors are sanitized before being written to `lastError`; tokens and full job text are
  never logged.
