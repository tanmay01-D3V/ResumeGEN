# Video script — ResumeGEN walkthrough

Target length: **6–7 minutes**. Screen recording at 1440×900, browser at 100% zoom, notifications
off. Record against a freshly seeded workspace. Speak at a normal pace; the timings are guides.

## Pre-record checklist

- [ ] `rm Backend/.data/db.json && npm run seed` (optional clean slate; removes old demo snapshots).
- [ ] `npm run dev` running; API on `:5050`, web on `:5173`.
- [ ] Browser profile has no extensions or password prompts.
- [ ] Toast notifications are visible but not mid-animation when you cut.
- [ ] Terminal tab ready for `curl http://localhost:5050/api/health`.
- [ ] One downloaded PDF ready to open, or download it on camera.

---

## 0:00–0:35 — Cold open

**Screen:** Login page.

**Narration:**

> “Most resume tools start with a blank page and a model that is happy to invent. ResumeGEN starts
> with evidence. You keep a portfolio of real work, match it against a specific job, and generate a
> resume only from records you have verified. I'll build two different resumes for two roles from the
> same portfolio.”

**Action:** Click **Enter workspace** with `demo@example.com`.

---

## 0:35–1:20 — Dashboard and honest state

**Screen:** Dashboard.

**Narration:**

> “This is a local demo workspace. The banner is deliberate: Gemini and Google Sheets are not
> configured here, and the app says so. Matching falls back to deterministic rules, labelled
> Heuristic, instead of pretending an AI call succeeded. The data is fictional and tagged sample
> data.”

**Action:** Hover the portfolio/job/resume stat cards. Show the sidebar.

**Optional cut:** Terminal — `curl -s localhost:5050/api/health` shows `authMode`, `aiConfigured`,
`sheetsConfigured`.

---

## 1:20–2:10 — Portfolio as the source of truth

**Screen:** Portfolio.

**Narration:**

> “Thirteen record types: profile, education, skills, projects, experience, certifications,
> achievements, publications, languages and more. Each record has a verification state. Only verified
> records can enter a resume.”

**Action:**

1. Search `Python`.
2. Clear search, filter **Projects**.
3. Expand **Churn Prediction Pipeline**; scroll its technologies, responsibilities and metrics.
4. Point at the verified badge and `sample-data` tag.

**Narration:**

> “The metric lives with the project record. The generator can rephrase structure, but it cannot
> invent a number that is not here.”

---

## 2:10–3:05 — Job analysis and evidence matching

**Screen:** Job Analyzer → Machine Learning Engineer.

**Narration:**

> “Paste a posting and the analyzer extracts required and preferred skills, qualifications,
> responsibilities, experience and keywords. This seeded job was analysed with the heuristic engine,
> so it is labelled Heuristic, not Gemini.”

**Action:** Click **Match portfolio**. Wait for the requirement map. Scroll through counts and open
one **Strong** and one **Partial** row. Point at **Honest gaps**.

**Narration:**

> “Strong means a verified record directly names or demonstrates the requirement. Partial means
> related evidence exists but the exact claim is still your call. Not evidenced stays visible as a gap
> and is never auto-added. A keyword in the posting is not proof.”

---

## 3:05–4:25 — Resume one: ML Engineer

**Screen:** Resume Builder.

**Narration:**

> “The builder is six steps. Pick the role, review the match, choose evidence, customize, preview,
> then save and export.”

**Action:**

1. Select **Machine Learning Engineer** → **Match portfolio** → **Continue**.
2. On evidence, show the selected count. Search `TensorFlow` and uncheck it.
3. **Continue** to customize. Set title `ML Engineer — Northstar (demo)`, template **Modern**, layout
   **Allow two pages**.
4. **Generate preview**; scroll the resume.
5. Open **Exact PDF**; point out it is the server renderer used for download.
6. **Continue to save** → **Save snapshot**.
7. **Download PDF**, open it briefly.

**Narration:**

> “TensorFlow is in the portfolio, but its evidence is course-only. Leaving it off is the honest
> choice for a role that implies production ML. The snapshot stores the document, the selected record
> IDs and the settings. If the portfolio changes later, this version is marked outdated instead of
> being silently rewritten. The preview and the downloaded PDF come from the same server document;
> they are different renderers, so typography can differ slightly.”

---

## 4:25–5:30 — Resume two: Full-Stack Developer

**Screen:** Resume Builder (fresh).

**Narration:**

> “Same evidence base, different role. This time I'll remove ML-only material so the two resumes do
> not blur together.”

**Action:**

1. Select **Full-Stack Developer** → **Match portfolio** → **Continue**.
2. Search and uncheck: **Churn Prediction Pipeline**, **Support Ticket Classifier**, **scikit-learn**,
   **pandas**, **NumPy**, **TensorFlow**.
3. **Continue** to customize. Title `Full-Stack Developer — Bluewave (demo)`, template **Compact**,
   layout **Prefer one page**.
4. In **Section order**, move **Projects** above **Experience**.
5. **Generate preview**, then **Exact PDF** → **Continue to save** → **Save snapshot**.

**Narration:**

> “Different selection, different template, different order, different story. Neither resume claims
> the other's evidence.”

---

## 5:30–6:15 — Saved snapshots, Sheets and security

**Screen:** Saved Resumes → open one snapshot → Google Sheets.

**Narration:**

> “Saved versions are reproducible. Each row can be renamed, downloaded or deleted, and the detail
> view exports the stored snapshot rather than the current portfolio.”

**Action:** Download a saved PDF. Then open **Google Sheets**.

**Narration:**

> “Sheets is a review surface. Each category tab carries stable record IDs; sync updates by ID;
> imports are proposed first, and changed rows become needs-review until re-verified. Firestore, or
> the local store in demo mode, remains authoritative. The client never holds a Gemini key or a
> service-account key, and every API query is scoped to the verified user ID.”

---

## 6:15–6:40 — Close

**Screen:** Dashboard or README.

**Narration:**

> “That is ResumeGEN: a verified portfolio, an honest match, and a resume you can defend line by
> line. The repository includes the API, the React app, tests, schema and API docs, Sheets setup, and
> this demo script. Live Gemini, Firebase and Sheets calls still need real credentials; the demo
> shows exactly which parts are deterministic.”

**Action:** Fade out or show the README architecture diagram.

---

## Editing notes

- Cut loading waits; keep one visible match/render to prove it is real.
- Do not speed up the honesty explanation; it is the product's differentiator.
- If a live Gemini key is added later, show the **Gemini** badge and a grounded summary, and update
  the narration. Do not reuse the heuristic wording.
- Keep the PDF download on screen long enough to read the filename.
- Captions: add them for the requirement statuses (`strong`, `partial`, `not_evidenced`).
