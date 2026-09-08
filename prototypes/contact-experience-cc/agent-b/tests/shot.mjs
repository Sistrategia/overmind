// Quick visual probe (development only; evidence captures live in tests/e2e/evidence.spec.ts).
// node tests/shot.mjs <out.png> <variant> <path-without-hash> [k=v ...] [--w=1440] [--h=900] [--dark] [--persona=sofia]
// Avoids '#' and '?' in arguments because the Windows shell wrapper drops them.
import { chromium } from '@playwright/test';

const raw = process.argv.slice(2);
const flags = raw.filter((a) => a.startsWith('--'));
const args = raw.filter((a) => !a.startsWith('--'));
const out = args.shift() ?? 'shot.png';
const variant = args.shift() ?? 'casefile';
const path = args.shift() ?? '';
args.push(...flags);
let w = 1440;
let h = 900;
let dark = false;
let persona = '';
const pairs = [];
for (const a of args) {
  if (a.startsWith('--w=')) w = Number(a.slice(4));
  else if (a.startsWith('--h=')) h = Number(a.slice(4));
  else if (a === '--dark') dark = true;
  else if (a.startsWith('--persona=')) persona = a.slice(10);
  else pairs.push(a);
}
const url = `http://localhost:5178/#/${variant}${path ? `/${path}` : ''}${pairs.length ? `?${pairs.join('&')}` : ''}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
if (persona || dark) {
  await page.evaluate(
    ({ variant, persona, dark }) => {
      if (persona) sessionStorage.setItem(`omb:v1:${variant}:persona`, persona);
      if (dark) localStorage.setItem(`omb:v1:${variant}:theme`, 'dark');
    },
    { variant, persona, dark },
  );
  await page.reload();
}
await page.waitForTimeout(1000);
await page.screenshot({ path: out, fullPage: false });
console.log(`saved ${out} <- ${url}`);
console.log(logs.length ? logs.join('\n') : 'no console errors/warnings');
await browser.close();
