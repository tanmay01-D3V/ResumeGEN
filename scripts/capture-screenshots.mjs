import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();

async function shot(name) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(`captured ${name}.png`);
}

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await shot('login');

await page.getByLabel('Email address').fill('demo@example.com');
await page.getByRole('button', { name: /Enter workspace/ }).click();
await page.waitForURL('**/dashboard');
await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor();
await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
await shot('dashboard');

await page.getByRole('link', { name: 'Portfolio' }).first().click();
await page.waitForURL('**/portfolio');
await page.getByRole('heading', { name: 'Portfolio', level: 1 }).waitFor();
await shot('portfolio');

await page.getByRole('link', { name: 'Job Analyzer' }).first().click();
await page.waitForURL('**/jobs');
await page.getByRole('button', { name: /Machine Learning Engineer/ }).click();
await page.waitForURL(/\/jobs\/[^/]+$/);
await page.getByRole('heading', { name: 'Machine Learning Engineer', level: 1 }).waitFor();
await page.getByRole('button', { name: /Match portfolio/ }).click();
await page.getByText('Requirement-by-requirement evidence').waitFor({ timeout: 20000 });
await shot('job-match');

await page.getByRole('link', { name: 'Resume Builder' }).first().click();
await page.waitForURL('**/resume-builder');
await page.getByRole('heading', { name: 'Resume Builder', level: 1 }).waitFor();
await shot('builder-role');

await page.getByRole('button', { name: /Machine Learning Engineer/ }).click();
await page.getByRole('button', { name: /^Match portfolio/ }).click();
await page.getByText('Requirement map').waitFor({ timeout: 20000 });
await page.getByRole('button', { name: /^Continue/ }).click();
await page.getByText('Recommended evidence').waitFor();
await shot('builder-evidence');

await page.getByRole('button', { name: /^Continue/ }).click();
await page.getByRole('heading', { name: /Version details/ }).waitFor();
await page.getByRole('button', { name: /^Continue|Generate preview/ }).click().catch(() => {});
await page.waitForTimeout(300);

// Continue from customize to preview if the click above only advanced one step.
if (await page.getByTestId('resume-preview').count() === 0) {
  await page.getByRole('button', { name: /Generate preview/ }).click();
}
await page.getByTestId('resume-preview').waitFor({ timeout: 30000 });
await page.getByTestId('resume-preview').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -110));
await shot('builder-preview');

await page.goto('http://localhost:5173/resumes', { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Saved Resumes', level: 1 }).waitFor();
await shot('saved-resumes');

await page
  .getByRole('article')
  .filter({ hasText: 'Machine Learning Engineer — tailored' })
  .getByRole('button', { name: 'Open snapshot' })
  .click();
await page.waitForURL(/\/resumes\/[^/]+$/);
await page.getByRole('heading', { name: /Machine Learning Engineer/ }).waitFor();
await shot('saved-resume-detail');

await page.getByRole('link', { name: 'Google Sheets' }).first().click();
await page.waitForURL('**/sheets');
await page.getByRole('heading', { name: 'Google Sheets', level: 1 }).waitFor();
await shot('sheets-offline');

await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor();
await shot('mobile-dashboard');

await browser.close();
