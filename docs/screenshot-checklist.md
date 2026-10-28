# Screenshot checklist

The committed images live in `docs/screenshots/`. They are referenced by `README.md` and the
documentation. Regenerate them only against the seeded demo workspace so the content stays
consistent.

## Capture

```bash
npm run seed
npm run dev            # leave running
npm run screenshots    # second terminal
```

The script (`scripts/capture-screenshots.mjs`) logs in as `demo@example.com`, walks the seeded ML job
and builder, and hides the toast container on the dashboard. It does **not** create or delete records.
It requires the seeded snapshot `Machine Learning Engineer — tailored` to open the saved-detail view.

After capturing, inspect `git status` and review each image before committing.

## Required files

| File | Size | What it must show | Must not show |
| --- | --- | --- | --- |
| `login.png` | 1440×950 | Split login, **Demo workspace**, prefilled `demo@example.com`, “Example match” panel. | Real email, real password, error toast. |
| `dashboard.png` | 1440×950 | Greeting heading, portfolio/job/resume counts, integration notice, sidebar. | Toasts, skeleton loaders, browser chrome. |
| `portfolio.png` | 1440×950 | Category filters, verified records, search field, project/skill cards. | Empty state, error banner. |
| `job-match.png` | 1440×950 | ML job detail with **Heuristic** badge, summary stats, requirement map, **Honest gaps**. | Gemini badge when AI is not configured. |
| `builder-role.png` | 1440×950 | Step 1 **Target role**, both seeded jobs, six-step progress indicator. | Stale error notice. |
| `builder-evidence.png` | 1440×950 | Step 3, selected count, checkboxes, category/search controls. | Zero selected records. |
| `builder-preview.png` | 1440×950 | Step 5, resume sheet visible, **Exact PDF** tab available, document content legible. | Clipped sheet, loading spinner, “Generate preview” still required. |
| `saved-resumes.png` | 1440×950 | Library cards, search, snapshot title, **Current/Outdated** badge, actions. | Demo-run titles ending in `(demo)`. |
| `saved-resume-detail.png` | 1440×950 | ML snapshot detail, document preview or PDF, download/delete actions, metadata. | A different role's title. |
| `sheets-offline.png` | 1440×950 | **Google Sheets** heading, offline/not-configured notice, export preview tabs, setup checklist. | A fake “Synced” success state. |
| `mobile-dashboard.png` | 390×844 | Mobile dashboard with hamburger, single-column stat cards, no horizontal clipping. | Sidebar overlay left open, desktop layout. |

## Visual quality gate

- [ ] No toast, dropdown, dialog or hover tooltip is captured.
- [ ] No “Loading…”, skeleton shimmer or empty-state placeholder.
- [ ] The demo banner / integration notice is visible where relevant.
- [ ] Job provenance reads **Heuristic** unless a real Gemini key was used.
- [ ] Counts are plausible for the seed (42 portfolio records, 2 jobs); no contradictory numbers.
- [ ] Resume sheet is fully visible, not cut at the right edge, at 1440 px.
- [ ] No real personal data, secrets, API keys or spreadsheet IDs appear.
- [ ] Mobile image has no horizontal scrollbar or clipped cards.
- [ ] Text is crisp; capture at device scale factor 1 with no browser zoom.
- [ ] `README.md` image paths still resolve.

## If you change the UI

1. Re-run `npm run screenshots`.
2. Compare the new images with the previous versions.
3. Update this checklist only if the screen's purpose changed.
4. Keep the filenames stable so documentation links do not break.
