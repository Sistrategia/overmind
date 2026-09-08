import { expect, type Page, type BrowserContext } from '@playwright/test';

export const LINA = 'c0a1e2d3-4b5c-4d6e-8f70-1a2b3c4d5e01';
export const NORTE = 'c0a1e2d3-4b5c-4d6e-8f70-1a2b3c4d5e02';

export type VariantId = 'casefile' | 'studio' | 'thread';

export interface ConsoleWatch {
  errors: string[];
}

export function watchConsole(page: Page): ConsoleWatch {
  const w: ConsoleWatch = { errors: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') w.errors.push(m.text());
  });
  page.on('pageerror', (e) => w.errors.push(`pageerror: ${e.message}`));
  return w;
}

/** Fresh browser state per test: clear the simulated server so every test starts from the seeded story. */
export async function openVariant(page: Page, variant: VariantId, route = '') {
  await page.goto(`/#/${variant}${route}`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`/#/${variant}${route}`);
  await page.reload();
  await page.waitForSelector('[data-variant-root]');
}

export async function openSecondTab(context: BrowserContext, variant: VariantId, route = '') {
  const page = await context.newPage();
  await page.goto(`/#/${variant}${route}`);
  await page.waitForSelector('[data-variant-root]');
  return page;
}

export async function expectLightDefault(page: Page) {
  await expect(page.locator('[data-variant-root]')).toHaveAttribute('data-theme', 'light');
}
