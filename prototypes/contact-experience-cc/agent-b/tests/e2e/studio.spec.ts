import { test, expect, type Page } from '@playwright/test';
import { LINA, NORTE, openVariant, openSecondTab, watchConsole, expectLightDefault } from './helpers';

async function demo(page: Page) {
  await page.locator('#st-demo-btn').click();
  await expect(page.locator('#st-demo')).toBeVisible();
}
async function closeDemo(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#st-demo')).toHaveCount(0);
}
async function persona(page: Page, name: RegExp) {
  await demo(page);
  await page.getByLabel(name).check();
  await closeDemo(page);
}
const row = (page: Page, text: string) => page.locator('button.st-row', { hasText: text });
const pending = (page: Page) => page.getByRole('region', { name: 'Pending changes' });

test.describe('Studio', () => {
  test('starts light despite dark OS preference and persists the explicit choice', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'studio');
    await expectLightDefault(page);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('[data-variant-root]')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await page.waitForSelector('[data-variant-root]');
    await expect(page.locator('[data-variant-root]')).toHaveAttribute('data-theme', 'dark');
    expect(con.errors).toEqual([]);
  });

  test('small edit through the inspector: extension, validation, make primary, one Save', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'studio');
    await expect(page.getByRole('heading', { name: 'Lina Torres' })).toBeVisible();
    await page.getByRole('toolbar').getByRole('button', { name: 'Edit' }).click();
    // add invalid email
    const emailsGroup = page.locator('.st-group', { hasText: 'Emails' });
    await emailsGroup.getByRole('button', { name: 'Add' }).click();
    await page.getByLabel('Email address').fill('nope');
    await page.getByRole('button', { name: 'Add to draft' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'not a valid email' })).toBeVisible();
    // office phone extension
    await row(page, '+52 55 5254 0800').click();
    await page.getByLabel('Extension').fill('25');
    await expect(page.getByText(/Saved as \+525552540800/)).toBeVisible();
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    await expect(pending(page)).toContainText('extension 22 → 25');
    // personal email primary
    await row(page, 'linatorres.ag@mail.example').click();
    await page.getByRole('button', { name: 'Make primary' }).click();
    await expect(pending(page)).toContainText('2 pending');
    await page.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.st-card--ok')).toContainText('Saved together as revision 8');
    await page.getByRole('button', { name: 'Compare with revision 7' }).click();
    await expect(page.locator('.st-inspector')).toContainText('differences');
    await expect(page.locator('.st-inspector')).toContainText('Position');
    expect(con.errors).toEqual([]);
  });

  test('combined edit: profile, phone and address in one revision', async ({ page }) => {
    await openVariant(page, 'studio');
    await page.getByRole('toolbar').getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Display name').fill('Lina T.');
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    await row(page, '+52 777 312 3456').click();
    await page.getByLabel('Number', { exact: true }).fill('312-3457');
    await expect(page.getByText(/area code 777/)).toBeVisible();
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    await row(page, 'Calle Morrow').click();
    await page.getByLabel('Ext. number').fill('14');
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    await expect(pending(page)).toContainText('3 pending');
    await page.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.st-card--ok')).toContainText('Saved together as revision 8');
    await page.getByRole('button', { name: 'Compare with revision 7' }).click();
    await expect(page.locator('.st-action')).toHaveCount(3);
  });

  test('timeline and compare: empty diff with actions, historical values, scrubber keys, coverage', async ({ page }) => {
    await openVariant(page, 'studio', `/contact/${LINA}?mode=compare&rev=5&pin=4`);
    await expect(page.locator('.st-inspector')).toContainText('No net difference');
    await expect(page.locator('.st-action')).toHaveCount(2);
    await page.goto(`/#/studio/contact/${LINA}?mode=timeline&rev=2`);
    await expect(page.locator('.st-sheet--hist')).toContainText('lina.torres@verticedemo.mx');
    await expect(page.locator('.st-sheet--hist')).toContainText('read only');
    await page.getByRole('slider').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.st-inspector')).toContainText('Revision 3');
    await page.getByRole('button', { name: 'Compare with 2' }).click();
    await expect(page.locator('.st-inspector')).toContainText('Position');
    // restore identity
    await page.goto(`/#/studio/contact/${LINA}?mode=compare&rev=7&pin=6`);
    await expect(page.locator('.st-inspector')).toContainText('restored');
    await expect(page.locator('.st-inspector')).toContainText('ord 1');
    // coverage
    await demo(page);
    await page.getByLabel('Historical coverage').selectOption('4');
    await closeDemo(page);
    await page.goto(`/#/studio/contact/${LINA}?mode=timeline&rev=2`);
    await expect(page.getByText('history_unavailable')).toBeVisible();
  });

  test('activity: denial, token filters, inspector detail, evidence navigation, preserved context', async ({ page }) => {
    await openVariant(page, 'studio', '/activity');
    await expect(page.getByText('403 · forbidden')).toBeVisible();
    await persona(page, /Sofía Reyes/);
    await page.locator('#sa-actor').click();
    await page.getByRole('menuitemradio', { name: 'Bruno Castañeda' }).click();
    await page.locator('#sa-family').click();
    await page.getByRole('menuitemradio', { name: 'Phone' }).click();
    await expect(page.locator('.st-unit')).toHaveCount(3);
    await page.locator('#sa-q').fill('warehouse');
    await expect(page.locator('.st-unit')).toHaveCount(1);
    await page.locator('#sa-q').fill('zzz-nothing');
    await expect(page.getByText('No activity matches')).toBeVisible();
    await page.locator('#sa-q').fill('');
    await page.locator('.st-unit').first().click();
    await expect(page.locator('.st-inspector')).toContainText('Activity entry');
    await page.getByRole('button', { name: 'open in timeline' }).click();
    await expect(page.locator('.st-sheet--hist').first()).toBeVisible();
    await page.goBack();
    await expect(page.locator('.st-token', { hasText: 'actor:Bruno' })).toBeVisible();
    await expect(page.locator('.st-token', { hasText: 'family:phone' })).toBeVisible();
    await page.locator('.st-token', { hasText: 'actor:Bruno' }).getByRole('button').click();
    await page.locator('.st-token', { hasText: 'family:phone' }).getByRole('button').click();
    await page.locator('#sa-source').click();
    await page.getByRole('menuitemradio', { name: 'Operational (not audit)' }).click();
    await expect(page.locator('.st-unit')).toHaveCount(2);
    await page.locator('.st-unit').first().click();
    await expect(page.locator('.st-inspector')).toContainText('Not part of the business audit');
  });

  test('palette: grounded summary, evidence, staged proposal, bounded reply, filter navigation', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'studio');
    await page.locator('#st-ask-btn').click();
    const ask = page.getByLabel('Ask the sidekick');
    await ask.fill("What changed in Lina's contact this week?");
    await ask.press('Enter');
    await expect(page.locator('.st-result')).toHaveCount(6);
    await page.locator('.st-result', { hasText: 'Revision 4 · compared with 3' }).click();
    await expect(page.locator('.st-inspector')).toContainText('4 differences');
    await page.keyboard.press('Control+k');
    await ask.fill('Change this extension to 25 and make the work email primary');
    await ask.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Staged in your draft');
    await page.getByRole('button', { name: 'Adjust in the inspector' }).click();
    await expect(pending(page)).toContainText('extension 22 → 25');
    await expect(pending(page)).toContainText('Staged by the sidekick');
    await page.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.st-card--ok')).toContainText('Saved together as revision 8');
    await page.locator('#st-ask-btn').click();
    await ask.fill('What is the weather in Cuernavaca?');
    await ask.press('Enter');
    await expect(page.locator('.st-answer--bounded')).toBeVisible();
    await page.keyboard.press('Escape');
    await persona(page, /Sofía Reyes/);
    await page.locator('#st-ask-btn').click();
    await ask.fill("Show Bruno's phone changes");
    await ask.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.locator('.st-token', { hasText: 'actor:Bruno' })).toBeVisible();
    await expect(page.locator('.st-unit')).toHaveCount(3);
    expect(con.errors).toEqual([]);
  });

  test('personas: auditor read only, directory projection of Norte Taller', async ({ page }) => {
    await openVariant(page, 'studio');
    await persona(page, /Diego Lara/);
    await expect(page.getByRole('toolbar').getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await page.goto(`/#/studio/contact/${NORTE}`);
    await expect(page.getByText('Directory view · public only')).toBeVisible();
    await expect(page.getByText('facturacion@nortetaller.example')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'View' })).toHaveCount(0);
  });

  test('conflict rehearsal: stale Save rejected, reconcile onto revision 4, save as 5', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'studio');
    await demo(page);
    await page.getByRole('button', { name: 'Rewind: Mariana edits revision 3' }).click();
    await closeDemo(page);
    await expect(pending(page)).toContainText('on revision 3');
    await demo(page);
    await page.getByRole('button', { name: 'Simulate Bruno’s update' }).click();
    await closeDemo(page);
    await expect(pending(page)).toContainText('Bruno saved revision 4');
    await page.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('409 conflict');
    await expect(page.getByRole('alertdialog')).toContainText('overlaps');
    await page.getByRole('button', { name: 'Keep my draft on revision 4' }).click();
    await expect(pending(page)).toContainText('on revision 4');
    await page.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.st-card--ok')).toContainText('Saved together as revision 5');
    expect(con.errors).toEqual([]);
  });

  test('two tabs: Bruno saves in tab B while Mariana drafts in tab A', async ({ page, context }) => {
    await openVariant(page, 'studio');
    await page.getByRole('toolbar').getByRole('button', { name: 'Edit' }).click();
    await row(page, '+52 55 5254 0800').click();
    await page.getByLabel('Extension').fill('30');
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    const tabB = await openSecondTab(context, 'studio');
    await persona(tabB, /Bruno Castañeda/);
    await tabB.getByRole('toolbar').getByRole('button', { name: 'Edit' }).click();
    await row(tabB, 'linatorres.ag@mail.example').click();
    await tabB.getByRole('button', { name: 'Make primary' }).click();
    await tabB.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(tabB.locator('.st-card--ok')).toContainText('Saved together as revision 8');
    await expect(pending(page)).toContainText('Bruno saved revision 8');
    await expect(page.locator('.st-sidebar')).toContainText('Bruno');
    await page.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('409 conflict');
    await page.getByRole('button', { name: 'Discard my draft' }).click();
    await expect(pending(page)).toHaveCount(0);
    await expect(page.locator('.st-toolbar__title')).toContainText('Revision 8');
  });

  test('demo outcomes: 403, uncertain commit investigation, reset', async ({ page }) => {
    await openVariant(page, 'studio');
    await demo(page);
    await page.getByLabel('Next Save outcome').selectOption('forbidden');
    await closeDemo(page);
    await page.getByRole('toolbar').getByRole('button', { name: 'Edit' }).click();
    await row(page, 'linatorres.ag@mail.example').click();
    await page.getByRole('button', { name: 'Make primary' }).click();
    await page.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('403 forbidden');
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await demo(page);
    await page.getByLabel('Next Save outcome').selectOption('uncertain');
    await closeDemo(page);
    await page.getByRole('toolbar').getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Save outcome unknown');
    await page.getByRole('button', { name: 'Check the current revision' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('The Save did commit');
    await page.getByRole('button', { name: 'It committed · drop my draft' }).click();
    await expect(page.locator('.st-toolbar__title')).toContainText('Revision 8');
    await demo(page);
    await page.getByRole('button', { name: 'Reset demo' }).click();
    await closeDemo(page);
    await expect(page.locator('.st-toolbar__title')).toContainText('Revision 7');
  });

  test('narrow layout keeps the record usable', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 860 });
    await openVariant(page, 'studio');
    await expect(page.getByRole('heading', { name: 'Lina Torres' })).toBeVisible();
    await page.getByRole('toolbar').getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('.st-inspector')).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(420);
  });
});
