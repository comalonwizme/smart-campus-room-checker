// Practice #11 UI check for the "Explain availability" feature (Task #05).
// Usage: npm run build && npx vite preview --port 4173 &  node scripts/p11-screenshots.mjs <outDir>
// For every scenario it records the rule-check text BEFORE and AFTER the explanation
// and fails if they differ (the UI must never change the deterministic decision).
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'screenshots/p11';
const base = process.env.APP_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox'] });

// [name, start, end, ?mock mode]
const scenarios = [
  ['01-available', '2099-01-15T11:00', '2099-01-15T12:00', 'ok'],
  ['02-overlap', '2099-01-15T09:30', '2099-01-15T10:30', 'ok'],
  ['03-past', '2020-01-15T11:00', '2020-01-15T12:00', 'ok'],
  ['04-invalid-reversed', '2099-01-15T12:00', '2099-01-15T11:00', 'ok'],
  ['05-empty-input', '', '', 'ok'],
  ['06-too-short', '2099-01-15T11:00', '2099-01-15T11:10', 'ok'],
  ['07-timeout', '2099-01-15T09:30', '2099-01-15T10:30', 'slow'],
  ['08-api-failure', '2099-01-15T09:30', '2099-01-15T10:30', 'error'],
  ['09-contradicting-output', '2099-01-15T11:00', '2099-01-15T12:00', 'contradict'],
  ['10-malformed-output', '2099-01-15T09:30', '2099-01-15T10:30', 'malformed'],
];

let failures = 0;
const viewports = [['desktop', 1280, 900], ['mobile', 390, 844]];
for (const [label, w, h] of viewports) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const [name, s, e, mode] of scenarios) {
    if (label === 'mobile' && !['01-available', '02-overlap', '07-timeout'].includes(name)) continue;
    await page.goto(mode === 'ok' ? base : `${base}?mock=${mode}`);
    await page.fill('input >> nth=0', s);
    await page.fill('input >> nth=1', e);
    await page.click('button[type=submit]');
    const before = (await page.textContent('[data-testid=decision]'))?.trim();
    const t0 = Date.now();
    await page.click('[data-testid=explain-btn]');
    await page.waitForSelector('[data-testid=explanation]', { timeout: 10_000 });
    const ms = Date.now() - t0;
    const after = (await page.textContent('[data-testid=decision]'))?.trim();
    const expl = (await page.textContent('[data-testid=explanation]'))?.replace(/\s+/g, ' ').trim();
    await page.screenshot({ path: `${out}/${label}-${name}.png`, fullPage: true });
    const same = before === after;
    if (!same) failures++;
    console.log(`${label} ${name} [mock=${mode}] ${ms}ms\n  decision: ${before}\n  decision unchanged after explain: ${same}\n  panel: ${expl}`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(label, 'horizontal overflow:', overflow);
  if (overflow) failures++;
}
await browser.close();
console.log(failures ? `FAILURES: ${failures}` : 'ALL UI CHECKS PASSED');
process.exit(failures ? 1 : 0);
