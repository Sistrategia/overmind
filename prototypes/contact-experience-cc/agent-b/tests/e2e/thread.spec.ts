import { test, expect, type Page } from '@playwright/test';
import { LINA, NORTE, openVariant, openSecondTab, watchConsole, expectLightDefault } from './helpers';

async function demo(page: Page) {
  await page.locator('#th-demo-btn').click();
  await expect(page.locator('#th-demo')).toBeVisible();
}
async function closeDemo(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#th-demo')).toHaveCount(0);
}
async function persona(page: Page, name: RegExp) {
  await demo(page);
  await page.getByLabel(name).check();
  await closeDemo(page);
}
const proposal = (page: Page) => page.getByRole('region', { name: 'Pending changes' });
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Edit contact' });
async function askSidekick(page: Page, q: string) {
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const input = page.getByLabel('Ask the sidekick');
  await input.fill(q);
  await input.press('Enter');
}

test.describe('Thread', () => {
  test('starts light despite dark OS preference and persists the explicit choice', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'thread');
    await expectLightDefault(page);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('[data-variant-root]')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await page.waitForSelector('[data-variant-root]');
    await expect(page.locator('[data-variant-root]')).toHaveAttribute('data-theme', 'dark');
    expect(con.errors).toEqual([]);
  });

  test('small edit in the edit sheet: extension, validation, make primary, one Save, evidence card', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'thread');
    await expect(page.getByRole('heading', { name: 'Lina Torres' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit contact' }).click();
    const s = sheet(page);
    await expect(s).toBeVisible();
    const emails = s.locator('section[aria-labelledby="th-es-email"]');
    await emails.getByRole('button', { name: 'Add' }).click();
    await s.getByLabel('Email address').fill('nope');
    await s.getByRole('button', { name: 'Add to draft' }).click();
    await expect(s.getByRole('alert').filter({ hasText: 'not a valid email' })).toBeVisible();
    await s.getByRole('button', { name: 'Cancel' }).first().click();
    await s.getByRole('button', { name: /Edit \+52 55 5254 0800/ }).click();
    await s.getByLabel('Extension').fill('25');
    await expect(s.getByText(/Saved as \+525552540800/)).toBeVisible();
    await s.getByRole('button', { name: 'Apply to draft' }).click();
    await expect(s).toContainText('extension 22 → 25');
    await s.getByRole('button', { name: 'Make linatorres.ag@mail.example primary' }).click();
    await expect(s).toContainText('2 changes');
    await s.getByRole('button', { name: 'Save as one revision' }).click();
    await expect(page.locator('#th-card-saved')).toContainText('Saved together as revision 8');
    await page.getByRole('button', { name: 'Open revision 8' }).click();
    await expect(page.locator('#th-card-rev-8')).toContainText('field differences');
    await page.locator('#th-card-rev-8').getByRole('tab', { name: /Actions/ }).click();
    await expect(page.locator('#th-card-rev-8 .th-action')).toHaveCount(2);
    expect(con.errors).toEqual([]);
  });

  test('combined edit: profile, phone and address as one revision', async ({ page }) => {
    await openVariant(page, 'thread');
    await page.getByRole('button', { name: 'Edit contact' }).click();
    const s = sheet(page);
    await s.getByLabel('Display name').fill('Lina T.');
    await s.getByRole('button', { name: 'Apply profile to draft' }).click();
    await s.getByRole('button', { name: /Edit \+52 777 312 3456/ }).click();
    await s.getByLabel('Number', { exact: true }).fill('312-3457');
    await expect(s.getByText(/area code 777/)).toBeVisible();
    await s.getByRole('button', { name: 'Apply to draft' }).click();
    await s.getByRole('button', { name: /Edit Calle Morrow/ }).click();
    await s.getByLabel('Ext. number').fill('14');
    await s.getByRole('button', { name: 'Apply to draft' }).click();
    await expect(s).toContainText('3 changes');
    await s.getByRole('button', { name: 'Save as one revision' }).click();
    await expect(page.locator('#th-card-saved')).toContainText('Saved together as revision 8');
    await page.getByRole('button', { name: 'Open revision 8' }).click();
    await page.locator('#th-card-rev-8').getByRole('tab', { name: /Actions/ }).click();
    await expect(page.locator('#th-card-rev-8 .th-action')).toHaveCount(3);
  });

  test('revision cards: empty diff keeps its two actions, historical values, restore identity, coverage', async ({ page }) => {
    await openVariant(page, 'thread', `/case/${LINA}?card=rev:5`);
    await expect(page.locator('#th-card-rev-5')).toContainText('No net difference');
    await page.locator('#th-card-rev-5').getByRole('tab', { name: /Actions/ }).click();
    await expect(page.locator('#th-card-rev-5 .th-action')).toHaveCount(2);
    await page.goto(`/#/thread/case/${LINA}?card=rev:2`);
    await page.locator('#th-card-rev-2').getByRole('tab', { name: 'As it was' }).click();
    await expect(page.locator('#th-card-rev-2')).toContainText('lina.torres@verticedemo.mx');
    await expect(page.locator('#th-card-rev-2')).toContainText('read only');
    await page.goto(`/#/thread/case/${LINA}?card=rev:7`);
    await expect(page.locator('#th-card-rev-7')).toContainText('restored');
    await expect(page.locator('#th-card-rev-7')).toContainText('ordinal 1');
    await demo(page);
    await page.getByLabel('Historical coverage').selectOption('4');
    await closeDemo(page);
    await page.goto(`/#/thread/case/${LINA}?card=rev:2`);
    await expect(page.locator('#th-card-rev-2')).toContainText('history_unavailable');
  });

  test('activity thread: denial, filters, unit card, evidence navigation and preserved context', async ({ page }) => {
    await openVariant(page, 'thread', '/activity');
    await expect(page.getByText('403 · forbidden')).toBeVisible();
    await persona(page, /Sofía Reyes/);
    await page.locator('#tq-actor').selectOption('bruno');
    await page.locator('#tq-family').selectOption('phone');
    await expect(page.locator('.th-result')).toHaveCount(3);
    await page.locator('#tq-q').fill('warehouse');
    await expect(page.locator('.th-result')).toHaveCount(1);
    await page.locator('#tq-q').fill('zzz-nothing');
    await expect(page.getByText('No activity matches these filters.')).toBeVisible();
    await page.locator('#tq-q').fill('');
    await page.locator('.th-result').first().click();
    await expect(page.locator('.th-card--unit')).toBeVisible();
    await page.getByRole('button', { name: 'Open Lina Torres at revision 4' }).click();
    await expect(page.locator('#th-card-rev-4')).toContainText('field differences');
    await page.goBack();
    await expect(page.locator('#tq-actor')).toHaveValue('bruno');
    await expect(page.locator('#tq-family')).toHaveValue('phone');
    await expect(page.locator('.th-card--unit')).toBeVisible();
    await page.locator('#tq-actor').selectOption('all');
    await page.locator('#tq-family').selectOption('all');
    await page.locator('#tq-source').selectOption('operational');
    await expect(page.locator('.th-result')).toHaveCount(2);
    await page.locator('.th-result').first().click();
    await expect(page.locator('.th-card--unit')).toContainText('Not part of the business audit');
  });

  test('sidekick in the thread: grounded summary, staged proposal card, bounded reply, query card', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'thread');
    await askSidekick(page, "What changed in Lina's contact this week?");
    await expect(page.locator('.th-card--sk .th-ref')).toHaveCount(6);
    await page.locator('.th-ref', { hasText: 'Revision 4 vs 3' }).click();
    await expect(page.locator('#th-card-rev-4')).toContainText('field differences');
    await askSidekick(page, 'Change this extension to 25 and make the work email primary');
    await expect(proposal(page)).toContainText('extension 22 → 25');
    await expect(proposal(page)).toContainText('Sidekick proposal');
    await proposal(page).getByRole('button', { name: 'Discard' }).click();
    await expect(proposal(page)).toHaveCount(0);
    await askSidekick(page, 'Change this extension to 25 and make the work email primary');
    await proposal(page).getByRole('button', { name: 'Apply as one Save' }).click();
    await expect(page.locator('#th-card-saved')).toContainText('Saved together as revision 8');
    await askSidekick(page, 'What is the weather in Cuernavaca?');
    await expect(page.locator('.th-card--sk-bounded')).toBeVisible();
    // as Mariana the tenant-wide question is answered within the contact's history (bounded)
    await askSidekick(page, "Show Bruno's phone changes");
    await expect(page.locator('.th-card--sk').last()).toContainText('cannot search tenant-wide');
    await persona(page, /Sofía Reyes/);
    await askSidekick(page, "Show Bruno's phone changes");
    await expect(page.locator('#th-card-query')).toBeVisible();
    await expect(page.locator('#th-card-query .th-result')).toHaveCount(3);
    expect(con.errors).toEqual([]);
  });

  test('shared notes: a note posted in one tab appears in the other', async ({ page, context }) => {
    await openVariant(page, 'thread');
    const tabB = await openSecondTab(context, 'thread');
    await persona(tabB, /Bruno Castañeda/);
    await page.getByLabel('Write a note').fill('Why did the primary email change on Sep 2?');
    await page.getByLabel('Write a note').press('Enter');
    await expect(page.locator('.th-card--note')).toContainText('Why did the primary email change');
    await expect(tabB.locator('.th-card--note')).toContainText('Why did the primary email change');
    await expect(tabB.locator('.th-card--note')).toContainText('Mariana Solís');
  });

  test('personas: auditor read only, directory projection', async ({ page }) => {
    await openVariant(page, 'thread');
    await persona(page, /Diego Lara/);
    await expect(page.getByRole('button', { name: 'Edit contact' })).toHaveCount(0);
    await page.goto(`/#/thread/case/${NORTE}`);
    await expect(page.getByText('directory view · public only')).toBeVisible();
    await expect(page.getByText('facturacion@nortetaller.example')).toHaveCount(0);
    await expect(page.getByText('history needs read_history').first()).toBeVisible();
  });

  test('conflict rehearsal: stale Save rejected, reconciled, saved as revision 5', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'thread');
    await demo(page);
    await page.getByRole('button', { name: 'Rewind: Mariana edits revision 3' }).click();
    await closeDemo(page);
    await expect(proposal(page)).toContainText('on revision 3');
    await demo(page);
    await page.getByRole('button', { name: 'Simulate Bruno’s update' }).click();
    await closeDemo(page);
    await expect(proposal(page)).toContainText('Bruno saved revision 4');
    await proposal(page).getByRole('button', { name: 'Apply as one Save' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('409 conflict');
    await expect(page.getByRole('alertdialog')).toContainText('overlaps');
    await page.getByRole('button', { name: 'Keep my draft on revision 4' }).click();
    await expect(proposal(page)).toContainText('on revision 4');
    await proposal(page).getByRole('button', { name: 'Apply as one Save' }).click();
    await expect(page.locator('#th-card-saved')).toContainText('Saved together as revision 5');
    expect(con.errors).toEqual([]);
  });

  test('two tabs: Bruno saves in tab B while Mariana drafts in tab A', async ({ page, context }) => {
    await openVariant(page, 'thread');
    await page.getByRole('button', { name: 'Edit contact' }).click();
    const s = sheet(page);
    await s.getByRole('button', { name: /Edit \+52 55 5254 0800/ }).click();
    await s.getByLabel('Extension').fill('30');
    await s.getByRole('button', { name: 'Apply to draft' }).click();
    await s.getByRole('button', { name: 'Close (keep draft)' }).click();
    await expect(proposal(page)).toContainText('extension 22 → 30');
    const tabB = await openSecondTab(context, 'thread');
    await persona(tabB, /Bruno Castañeda/);
    await tabB.getByRole('button', { name: 'Edit contact' }).click();
    const sB = sheet(tabB);
    await sB.getByRole('button', { name: 'Make linatorres.ag@mail.example primary' }).click();
    await sB.getByRole('button', { name: 'Save as one revision' }).click();
    await expect(tabB.locator('#th-card-saved')).toContainText('Saved together as revision 8');
    await expect(proposal(page)).toContainText('Bruno saved revision 8');
    await expect(page.locator('.th-people')).toContainText('Bruno');
    await proposal(page).getByRole('button', { name: 'Apply as one Save' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('409 conflict');
    await page.getByRole('button', { name: 'Discard my draft' }).click();
    await expect(proposal(page)).toHaveCount(0);
    await expect(page.locator('.th-hero')).toContainText('Revision 8');
  });

  test('demo outcomes: 403, uncertain commit investigation, reset', async ({ page }) => {
    await openVariant(page, 'thread');
    await demo(page);
    await page.getByLabel('Next Save outcome').selectOption('forbidden');
    await closeDemo(page);
    await page.getByRole('button', { name: 'Edit contact' }).click();
    const s = sheet(page);
    await s.getByRole('button', { name: 'Make linatorres.ag@mail.example primary' }).click();
    await s.getByRole('button', { name: 'Save as one revision' }).click();
    await expect(page.locator('.th-card--conflict')).toContainText('Save failed · 403 forbidden');
    await page.getByRole('button', { name: 'Keep my draft' }).click();
    await demo(page);
    await page.getByLabel('Next Save outcome').selectOption('uncertain');
    await closeDemo(page);
    await proposal(page).getByRole('button', { name: 'Apply as one Save' }).click();
    await expect(page.locator('.th-card--warn')).toContainText('Save outcome unknown');
    await page.getByRole('button', { name: 'Check the current revision' }).click();
    await expect(page.locator('.th-card--warn')).toContainText('The Save did commit');
    await page.getByRole('button', { name: 'It committed · drop my draft' }).click();
    await expect(page.locator('.th-hero')).toContainText('Revision 8');
    await demo(page);
    await page.getByRole('button', { name: 'Reset demo' }).click();
    await closeDemo(page);
    await expect(page.locator('.th-hero')).toContainText('Revision 7');
  });

  test('narrow layout keeps the thread and composer usable', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 860 });
    await openVariant(page, 'thread');
    await expect(page.getByRole('heading', { name: 'Lina Torres' })).toBeVisible();
    await expect(page.getByLabel('Write a note')).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(420);
  });
});
