// Quick smoke used while building: loads a variant, captures console errors, screenshots.
import { expect, test } from '@playwright/test';

const variant = process.env.SMOKE_VARIANT ?? 'desk';

test(`smoke ${variant}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`/#/${variant}/contact/lina`);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await expect(page.getByTestId('record').or(page.getByTestId('console-root')).or(page.getByTestId('strata-root')).first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/smoke-${variant}.png`, fullPage: false });
  expect(errors, errors.join('\n')).toEqual([]);
});
