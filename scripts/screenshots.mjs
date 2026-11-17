// Manual UI check helper (Task #07). Usage: npm run build && npx vite preview --port 4173 & node scripts/screenshots.mjs <outDir>
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'screenshots';
const url = process.env.APP_URL ?? 'http://localhost:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox'] });

const scenarios = [
  ['available', '2099-01-15T11:00', '2099-01-15T12:00'],
  ['overlap', '2099-01-15T09:30', '2099-01-15T10:30'],
  ['past', '2020-01-15T11:00', '2020-01-15T12:00'],
  ['too-short', '2099-01-15T11:00', '2099-01-15T11:10'],
  ['reversed', '2099-01-15T12:00', '2099-01-15T11:00'],
];
for (const [label, w, h] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url);
  await page.screenshot({ path: `${out}/${label}-initial.png`, fullPage: true });
  for (const [name, s, e] of scenarios) {
    await page.fill('input >> nth=0', s);
    await page.fill('input >> nth=1', e);
    await page.click('button');
    await page.screenshot({ path: `${out}/${label}-${name}.png`, fullPage: true });
    console.log(label, name, '->', (await page.textContent('[role=status]'))?.trim());
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(label, 'horizontal overflow:', overflow);
}
await browser.close();
