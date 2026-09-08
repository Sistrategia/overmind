import { expect, type BrowserContext, type Page } from '@playwright/test';

export type VariantId = 'desk' | 'console' | 'strata';

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Download the React DevTools/i.test(m.text())) errors.push(`console: ${m.text()}`); });
  return errors;
}

/** Fresh story: clears this origin's storage, then opens the route. */
export async function fresh(page: Page, hash: string): Promise<void> {
  await page.goto('/#/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`/${hash}`);
  await page.waitForTimeout(150);
}

export async function setPersona(page: Page, key: string): Promise<void> {
  const drawerOpen = await page.getByTestId('persona-select').isVisible().catch(() => false);
  if (!drawerOpen) await page.getByTestId('demo-toggle').click();
  await page.getByTestId('persona-select').selectOption(key);
  await page.getByRole('button', { name: 'Close demo controls' }).click();
  await page.waitForTimeout(350);
}

export async function demoAction(page: Page, testId: string): Promise<void> {
  const drawerOpen = await page.getByTestId(testId).isVisible().catch(() => false);
  if (!drawerOpen) await page.getByTestId('demo-toggle').click();
  await page.getByTestId(testId).click();
  await page.getByRole('button', { name: 'Close demo controls' }).click();
  await page.waitForTimeout(350);
}

export async function setSaveOutcome(page: Page, value: string): Promise<void> {
  const drawerOpen = await page.getByTestId('save-outcome-select').isVisible().catch(() => false);
  if (!drawerOpen) await page.getByTestId('demo-toggle').click();
  await page.getByTestId('save-outcome-select').selectOption(value);
  await page.getByRole('button', { name: 'Close demo controls' }).click();
}

export async function secondTab(context: BrowserContext, hash: string, persona: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/${hash}`);
  await page.waitForTimeout(200);
  await setPersona(page, persona);
  return page;
}

export async function expectNoErrors(errors: string[]): Promise<void> {
  expect(errors, errors.join('\n')).toEqual([]);
}
