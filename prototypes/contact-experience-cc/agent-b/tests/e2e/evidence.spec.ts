// Visual evidence captured from the running prototypes into ./evidence (run: npm run evidence).
import { test, expect, type Page } from '@playwright/test';
import { LINA } from './helpers';

const OUT = 'evidence';
const DESKTOP = { width: 1440, height: 900 };
const NARROW = { width: 420, height: 860 };

async function fresh(page: Page, route: string, opts: { persona?: string; dark?: boolean; variant?: string } = {}) {
  await page.goto(`/${route}`);
  await page.evaluate(
    ({ persona, dark, variant }) => {
      localStorage.clear();
      sessionStorage.clear();
      if (variant && persona) sessionStorage.setItem(`omb:v1:${variant}:persona`, persona);
      if (variant && dark) localStorage.setItem(`omb:v1:${variant}:theme`, 'dark');
    },
    opts,
  );
  await page.goto(`/${route}`);
  await page.reload();
  await page.waitForTimeout(700);
}

test.describe('@evidence captures', () => {
  test('gallery', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await fresh(page, '#/');
    await page.screenshot({ path: `${OUT}/gallery.png` });
  });

  test('casefile', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await fresh(page, '#/casefile', { variant: 'casefile' });
    await page.getByRole('button', { name: 'Edit record' }).click();
    const phones = page.locator('section', { has: page.getByRole('heading', { name: /^Phones/ }) });
    await phones.getByRole('button', { name: /Edit \+52 55 5254 0800/ }).click();
    await page.getByLabel('Extension').fill('25');
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    await page.getByLabel('Ask the sidekick').fill("What changed in Lina's contact this week?");
    await page.getByLabel('Ask the sidekick').press('Enter');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/casefile-contact-light.png` });
    await fresh(page, `#/casefile/contact/${LINA}?tab=history&rev=4&compare=3`, { variant: 'casefile' });
    await page.screenshot({ path: `${OUT}/casefile-history-light.png` });
    await fresh(page, '#/casefile/activity?actor=bruno&family=phone', { variant: 'casefile', persona: 'sofia' });
    await page.locator('tr.cf-unit').first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/casefile-activity-light.png` });
    await fresh(page, `#/casefile/contact/${LINA}?tab=history&rev=5&compare=4&mode=actions`, { variant: 'casefile', dark: true });
    await page.screenshot({ path: `${OUT}/casefile-dark.png` });
    await page.setViewportSize(NARROW);
    await fresh(page, '#/casefile', { variant: 'casefile' });
    await page.getByRole('button', { name: 'Edit record' }).click();
    await page.screenshot({ path: `${OUT}/casefile-narrow.png` });
    expect(true).toBe(true);
  });

  test('studio', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await fresh(page, '#/studio', { variant: 'studio' });
    await page.getByRole('toolbar').getByRole('button', { name: 'Edit' }).click();
    await page.locator('button.st-row', { hasText: '+52 55 5254 0800' }).click();
    await page.getByLabel('Extension').fill('25');
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/studio-contact-light.png` });
    await fresh(page, `#/studio/contact/${LINA}?mode=compare&rev=4&pin=3`, { variant: 'studio' });
    await page.screenshot({ path: `${OUT}/studio-history-light.png` });
    await fresh(page, '#/studio/activity?actor=bruno&family=phone', { variant: 'studio', persona: 'sofia' });
    await page.locator('.st-unit').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/studio-activity-light.png` });
    await fresh(page, `#/studio/contact/${LINA}?mode=timeline&rev=4`, { variant: 'studio', dark: true });
    await page.locator('#st-ask-btn').click();
    await page.getByLabel('Ask the sidekick').fill('Who changed the home address?');
    await page.getByLabel('Ask the sidekick').press('Enter');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/studio-dark.png` });
    await page.setViewportSize(NARROW);
    await fresh(page, `#/studio/contact/${LINA}?mode=timeline&rev=4`, { variant: 'studio' });
    await page.screenshot({ path: `${OUT}/studio-narrow.png` });
    expect(true).toBe(true);
  });

  test('thread', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await fresh(page, `#/thread/case/${LINA}?card=rev:4`, { variant: 'thread' });
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByLabel('Ask the sidekick').fill('Change this extension to 25 and make the work email primary');
    await page.getByLabel('Ask the sidekick').press('Enter');
    await page.waitForTimeout(400);
    await page.locator('#th-card-proposal').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/thread-contact-light.png` });
    await fresh(page, `#/thread/case/${LINA}?card=rev:5`, { variant: 'thread' });
    await page.screenshot({ path: `${OUT}/thread-history-light.png` });
    await fresh(page, '#/thread/activity?actor=bruno&family=phone', { variant: 'thread', persona: 'sofia' });
    await page.locator('.th-result').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/thread-activity-light.png` });
    await fresh(page, `#/thread/case/${LINA}?card=rev:3`, { variant: 'thread', dark: true });
    await page.screenshot({ path: `${OUT}/thread-dark.png` });
    await page.setViewportSize(NARROW);
    await fresh(page, '#/thread', { variant: 'thread' });
    await page.getByRole('button', { name: 'Edit contact' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/thread-narrow.png` });
    expect(true).toBe(true);
  });
});
