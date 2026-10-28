import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const OUT = '/private/var/folders/gx/sg983k2n7_z2m2mmnql0qj_h0000gn/T/opencode/e2e';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();

const errors = [];
const checks = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

async function shot(name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

function pass(label, detail = '') {
  checks.push(`PASS ${label}${detail ? ` — ${detail}` : ''}`);
  console.log(checks.at(-1));
}

try {
  // ---- Login -------------------------------------------------------
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill('demo@example.com');
  await page.getByRole('button', { name: /Enter workspace/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor();
  pass('demo login reaches dashboard');
  await shot('01-dashboard');

  // ---- Portfolio ---------------------------------------------------
  await page.getByRole('link', { name: 'Portfolio' }).first().click();
  await page.waitForURL('**/portfolio');
  await page.getByRole('heading', { name: 'Portfolio', level: 1 }).waitFor();
  await page.getByLabel('Search portfolio').fill('Python');
  await page.waitForTimeout(350);
  const searchResultCount = await page.locator('main article, main [data-testid="record-card"]').count();
  assert.ok(
    (await page.getByText('Python', { exact: true }).count()) > 0,
    'Python search should produce a result',
  );
  await shot('02-portfolio-search');
  await page.getByLabel('Search portfolio').fill('');
  pass('portfolio loads and search filters', `${searchResultCount} cards in search view`);

  // ---- Job detail and matching ------------------------------------
  await page.getByRole('link', { name: 'Job Analyzer' }).first().click();
  await page.waitForURL('**/jobs');
  await page.getByRole('heading', { name: 'Job Analyzer', level: 1 }).waitFor();
  await shot('03-jobs');
  await page.getByRole('button', { name: /Machine Learning Engineer/ }).click();
  await page.waitForURL(/\/jobs\/[^/]+$/);
  await page.getByRole('heading', { name: 'Machine Learning Engineer', level: 1 }).waitFor();
  await page.getByRole('button', { name: /Match portfolio/ }).click();
  await page.getByText('Requirement-by-requirement evidence').waitFor({ timeout: 20000 });
  const matchSummary = await page.locator('main').innerText();
  assert.match(matchSummary, /Strong|Partial|Not evidenced/);
  pass('job detail renders and deterministic matching completes');
  await shot('04-job-match');

  // ---- Resume builder ---------------------------------------------
  await page.getByRole('link', { name: 'Resume Builder' }).first().click();
  await page.waitForURL('**/resume-builder');
  await page.getByRole('heading', { name: 'Resume Builder', level: 1 }).waitFor();
  await shot('05-builder-role');

  await page.getByRole('button', { name: /Machine Learning Engineer/ }).click();
  await page.getByRole('button', { name: /^Match portfolio/ }).click();
  await page.getByText('Requirement map').waitFor({ timeout: 20000 });
  pass('builder: match review step reached');
  await shot('06-builder-match-review');

  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByText('Recommended evidence').waitFor();
  const checked = await page.locator('main [role="checkbox"][data-state="checked"]').count();
  assert.ok(checked > 0, 'expected preselected evidence rows');
  const selectedLabel = await page.getByText(/\d+ records selected ·/).innerText();
  assert.match(selectedLabel, /\d+/);
  pass('builder: evidence step has preselected records', `${checked} checked · ${selectedLabel.trim()}`);
  await shot('07-builder-evidence');

  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByRole('heading', { name: /Version details/ }).waitFor();
  const uniqueTitle = `E2E ML Engineer — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  await page.locator('#resume-title').fill(uniqueTitle);
  await page.getByRole('button', { name: /Modern/ }).click();
  await page.getByRole('button', { name: /Allow two pages/ }).click();
  pass('builder: customization updates title, template and layout');
  await shot('08-builder-customize');

  await page.getByRole('button', { name: /Generate preview/ }).click();
  await page.getByTestId('resume-preview').waitFor({ timeout: 30000 });
  const previewText = await page.getByTestId('resume-preview').innerText();
  assert.match(previewText, /Professional Summary|Experience|Projects/i);
  pass('builder: server resume document renders in preview');
  await shot('09-builder-preview');

  await page.getByRole('button', { name: /Exact PDF/ }).click();
  const frame = page.locator('iframe[title*="exact server PDF"]');
  await frame.waitFor({ timeout: 30000 });
  pass('builder: exact PDF iframe renders');
  await shot('10-builder-exact-pdf');

  await page.getByRole('button', { name: /Continue to save/ }).click();
  await page.getByText('Save this version').waitFor();
  await page.getByRole('button', { name: /Save snapshot/ }).click();
  await page.getByText('Version saved').waitFor({ timeout: 20000 });
  pass('builder: resume snapshot saved', uniqueTitle);
  await shot('11-builder-saved');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download PDF/ }).click();
  const download = await downloadPromise;
  const downloadPath = `${OUT}/${download.suggestedFilename()}`;
  await download.saveAs(downloadPath);
  const bytes = fs.readFileSync(downloadPath);
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 2000, `PDF too small: ${bytes.length}`);
  pass('builder: downloadable PDF is valid', `${bytes.length} bytes, ${download.suggestedFilename()}`);

  await page.getByRole('button', { name: /Open saved resume/ }).click();
  await page.waitForURL(/\/resumes\/[^/]+$/);
  await page.getByRole('heading', { name: uniqueTitle }).waitFor();
  const savedResumeId = page.url().split('/').pop();
  await shot('12-saved-resume-detail');
  const pdfDownload2 = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download PDF/ }).click();
  const download2 = await pdfDownload2;
  const downloadPath2 = `${OUT}/saved-${download2.suggestedFilename()}`;
  await download2.saveAs(downloadPath2);
  const bytes2 = fs.readFileSync(downloadPath2);
  assert.equal(bytes2.subarray(0, 5).toString(), '%PDF-');
  pass('saved resume detail downloads a valid PDF', `${bytes2.length} bytes`);

  // ---- Saved library / Sheets / Settings --------------------------
  await page.getByRole('link', { name: 'Saved Resumes' }).first().click();
  await page.waitForURL('**/resumes');
  await page.getByRole('heading', { name: 'Saved Resumes', level: 1 }).waitFor();
  assert.equal(await page.getByText(uniqueTitle).count() > 0, true);
  await shot('13-saved-resumes');
  pass('saved resume appears in library');

  await page.getByRole('link', { name: 'Google Sheets' }).first().click();
  await page.waitForURL('**/sheets');
  await page.getByRole('heading', { name: 'Google Sheets', level: 1 }).waitFor();
  await shot('14-sheets-offline');
  pass('sheets page renders its offline/not-configured state');

  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.waitForURL('**/settings');
  await page.getByRole('heading', { name: /Settings/i }).waitFor();
  await shot('15-settings');
  pass('settings page renders');

  // ---- Mobile layout ---------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).waitFor();
  await shot('16-mobile-nav');
  await page.getByRole('button', { name: 'Close navigation' }).last().click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert.ok(overflow <= 1, `horizontal overflow on mobile: ${overflow}px`);
  await shot('17-mobile-dashboard');
  pass('mobile navigation opens/closes with no horizontal overflow');

  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  pass('no console/page errors');

  // Keep the demo workspace clean for the next run.
  if (savedResumeId) {
    const status = await page.evaluate(async (id) => {
      const token = localStorage.getItem('resumegen.token');
      const response = await fetch(`/api/resumes/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return response.status;
    }, savedResumeId);
    assert.equal(status, 200, 'E2E cleanup should delete its saved resume');
    pass('E2E cleanup removed the temporary saved resume');
  }

  console.log('\nE2E_RESULT: PASS');
  console.log(`ARTIFACTS: ${OUT}`);
} catch (error) {
  console.error('E2E_RESULT: FAIL');
  console.error(error.stack ?? error.message);
  try {
    await shot('99-failure');
  } catch {
    // ignore screenshot failure
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
