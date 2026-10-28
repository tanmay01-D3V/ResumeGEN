# Sample job descriptions

Fictional postings for demos and manual QA. They are not copied from real companies.

| File | Role | What it demonstrates |
| --- | --- | --- |
| `machine-learning-engineer.txt` | ML Engineer, Northstar Analytics | Strong ML/skill evidence, some partial deployment gaps, an unearned AWS certification preference. |
| `full-stack-developer.txt` | Full-Stack Developer, Bluewave Labs | Web evidence, database/API requirements, preferred testing/Docker gaps. |
| `data-analyst.txt` | Data Analyst, Meridian Retail Insights | SQL/Excel/pandas analysis, reporting and communication; BI/pipeline preferences. |

Use **Job Analyzer → New job description**, paste the text (including or excluding the footer), and
save. Without a Gemini key the deterministic analyzer labels the result **Heuristic**; that is
expected.

The first two are also embedded in `Backend/src/services/seedService.ts` and created by `npm run seed`.
The data-analyst posting is manual-only so you can demonstrate job creation live.
