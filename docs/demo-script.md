# Demo script — two customized resumes

A repeatable 12–15 minute walkthrough for a reviewer, class presentation or recording. It produces
two genuinely different snapshots from the same verified portfolio:

1. **ML Engineer — Northstar (demo)** — ML evidence, Modern template, two-page preference.
2. **Full-Stack Developer — Bluewave (demo)** — web evidence only, Compact template, one page,
   Projects moved above Experience.

Everything is fictional. No live AI key is required.

## Before you present

```bash
npm run install:all
cp .env.example .env          # DEMO_MODE=auto is fine
npm run seed                  # 42 portfolio records, 2 analysed jobs
npm run dev                   # API :5050, web :5173
```

Open <http://localhost:5173> and confirm:

- The health badge / login notice says **Demo workspace**.
- `GET http://localhost:5050/api/health` reports `aiConfigured: false` and
  `sheetsConfigured: false` in this environment. Say so; do not imply live AI is running.
- The seeded jobs carry a **Heuristic** badge, not **Gemini**.
- If earlier demo snapshots exist, keep them. The steps below use distinct titles so the new ones are
  easy to find and delete afterwards.

## Scene 1 — Login and dashboard (1 min)

1. On **Welcome back**, the email field is prefilled with `demo@example.com`.
2. Click **Enter workspace**.
3. On the dashboard, point out:
   - portfolio record count and verification state;
   - analysed jobs and saved resume count;
   - the integration notice, which says Gemini and Sheets are not configured.

**Say:** “The prototype works end-to-end without external keys. Where an integration is missing, the
UI says so and falls back to deterministic logic instead of pretending an AI call happened.”

## Scene 2 — The evidence base (2 min)

1. Open **Portfolio**.
2. Type `Python` in **Search portfolio** and show the filtered skill/project/experience records.
3. Clear the search. Filter by **Projects**.
4. Open or expand **Churn Prediction Pipeline** and show:
   - technologies, responsibilities, metrics;
   - `verificationStatus: verified`;
   - `sample-data` tag.
5. Point out that personal info and summary are singletons and are not selectable evidence.

**Say:** “Every claim in a resume has to point back to a verified record. Metrics are stored with the
record, not invented at generation time.”

## Scene 3 — Job analysis and honest matching (3 min)

1. Open **Job Analyzer** → **Machine Learning Engineer**.
2. The job is already analysed from the seed. Show the **Heuristic** provenance badge and the
   extracted sections: required skills, preferred skills, qualifications, responsibilities, keywords.
3. Click **Match portfolio** (or **Re-match**).
4. Scroll to **Requirement-by-requirement evidence**. Show the three counts and the **Honest gaps**
   panel.
5. Open a **Strong** item and a **Partial** item. Read the explanation aloud.
6. Find a **Not evidenced** requirement (for example the AWS certification/deployment preference) and
   point out that it is shown as a gap and is not in the builder selection.

**Say:** “A keyword in the posting is never treated as proof. Strong means a verified record names or
demonstrates it. Partial means related evidence exists but the exact claim still needs your judgement.
Missing stays missing.”

## Scene 4 — Resume 1: Machine Learning Engineer (4 min)

1. Open **Resume Builder**.
2. On **Target role**, select **Machine Learning Engineer**. Confirm the card says **Heuristic**.
3. Click **Match portfolio** and wait for **Requirement map**.
4. Review the three status cards and the gaps. Click **Continue**.
5. On **Select evidence**, note the counter: the current seed preselects the strongest verified
   records (18 records).
6. In **Search evidence**, type `TensorFlow`.
7. Uncheck **TensorFlow**. Its stored evidence is “course exercise only; no production use”, so it
   does not belong in an ML-engineer resume that implies production experience.
8. Optional: search `Excel` and uncheck **Microsoft Excel** to keep the resume focused. Leave the
   ML projects, skills, education, certification, publication and data internship selected.
9. Click **Continue**.
10. On **Customize**:
    - **Resume title**: `ML Engineer — Northstar (demo)`
    - **Template**: **Modern**
    - **Layout**: **Allow two pages**
    - Leave the summary blank to use the deterministic, evidence-based summary. (With a real Gemini
      key, the **Draft summary with Gemini** control appears; it is grounded in selected records and
      rejected if it invents facts.)
    - Optional contact override: set **Location** to `Pune, India`.
11. Click **Generate preview**. Show the live document: header, summary, skills, experience, projects,
    education, certifications, achievements, publication.
12. Click the **Exact PDF** tab. This is the server renderer used by download, not a browser print.
13. Click **Continue to save**.
14. On **Save & export**, click **Save snapshot** and wait for **Version saved**.
15. Click **Download PDF**. Open the downloaded file and show that it matches the preview content and
    has clickable links.
16. Click **Open saved resume** to show the immutable snapshot view.

**Say:** “The snapshot stores the document, the selected record IDs and the settings. If the portfolio
changes later, this version is marked outdated rather than silently rewritten.”

## Scene 5 — Resume 2: Full-Stack Developer (4 min)

1. Go back to **Resume Builder** (the builder starts fresh; use the sidebar link).
2. Select **Full-Stack Developer** → **Match portfolio** → review the map → **Continue**.
3. On **Select evidence**, remove ML-only material so the two resumes are visibly different:
   - search `Churn` and uncheck **Churn Prediction Pipeline**;
   - search `Support Ticket` and uncheck **Support Ticket Classifier**;
   - search `scikit-learn`, `pandas`, `NumPy` and `TensorFlow`, and uncheck each;
   - keep **CampusConnect Event Platform**, both internships, web skills, education, the front-end
     certificate, languages and competencies.
4. Click **Continue**.
5. On **Customize**:
   - **Resume title**: `Full-Stack Developer — Bluewave (demo)`
   - **Template**: **Compact**
   - **Layout**: **Prefer one page**
   - Summary: leave blank for the deterministic summary.
   - In **Section order**, click the up arrow on **Projects** once so it sits above **Experience**.
6. Click **Generate preview** and compare with Resume 1: different title, selection, template, density
   and section order.
7. Open **Exact PDF**, then **Continue to save** → **Save snapshot** → **Download PDF**.
8. Return to **Saved Resumes**. Both new snapshots are listed alongside any earlier sample snapshots.
   Open each and use **Download PDF** to show that each snapshot exports its own stored document.

**Say:** “Two roles, one portfolio, two different resumes. Neither one claims the other's evidence.”

## Scene 6 — Sheets and settings (1 min)

1. Open **Google Sheets**. Show the offline/not-configured state, the export preview generated from
   the local store, and the setup checklist.
2. Explain the intended live flow: each category tab carries stable record IDs; sync updates by ID;
   imports produce a reviewable proposal and changed rows become `needs_review`.
3. Open **Settings** and show the account, demo-mode notice, integration status and data/export
   controls.

**Say:** “Sheets is a review surface, not the source of truth. Firestore/local storage remains
authoritative, and imported edits cannot enter a resume until re-verified.”

## Clean up after the demo

On **Saved Resumes**, use the row actions menu (⋯) → **Delete** for the two titles ending in
`(demo)`, then confirm. The seeded workspace keeps its earlier snapshots and the next demo starts
clean. To reset everything:

```bash
rm Backend/.data/db.json
npm run seed
```

## Fallbacks if something goes wrong

| Symptom | Recovery |
| --- | --- |
| API not reachable | Check `npm run dev`; confirm API on `:5050`, not `:5000` (macOS AirPlay may use 5000). |
| Login rejects the email | Demo mode accepts any valid email; make sure `DEMO_MODE` is not `false` without Firebase credentials. |
| No jobs in the builder | Run `npm run seed`, then refresh. The seed is idempotent. |
| **Gemini is not configured** notice | Expected in this environment. Continue with heuristic matching and deterministic summaries. |
| PDF tab is blank | Wait for the iframe; if it still fails, use **Download PDF** and check the API logs. |
| Saved resume says **Outdated** | Expected after portfolio edits. The snapshot and its PDF are unchanged by design. |
