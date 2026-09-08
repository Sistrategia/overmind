import { test, expect } from '@playwright/test';
import { LINA, NORTE, openVariant, openSecondTab, watchConsole, expectLightDefault } from './helpers';

test.describe('Casefile', () => {
  test('starts light despite dark OS preference and persists the explicit choice', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'casefile');
    await expectLightDefault(page);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('[data-variant-root]')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await page.waitForSelector('[data-variant-root]');
    await expect(page.locator('[data-variant-root]')).toHaveAttribute('data-theme', 'dark');
    expect(con.errors).toEqual([]);
  });

  test('small edit: extension + make primary, validation, cancel and one Save', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'casefile');
    await expect(page.getByRole('heading', { name: 'Lina Torres' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit record' }).click();
    // Validation on a bad email
    const emails = page.getByRole('region', { name: 'Emails' }).or(page.locator('section', { has: page.getByRole('heading', { name: /^Emails/ }) }));
    await emails.getByRole('button', { name: /Add email/ }).click();
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByRole('button', { name: 'Add to draft' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'not a valid email' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    // Edit office phone extension
    const phones = page.locator('section', { has: page.getByRole('heading', { name: /^Phones/ }) });
    await phones.getByRole('button', { name: /Edit \+52 55 5254 0800/ }).click();
    await page.getByLabel('Extension').fill('25');
    await expect(page.getByText(/Saved as \+525552540800/)).toBeVisible();
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    const tray = page.getByRole('region', { name: 'Pending changes' });
    await expect(tray).toContainText('extension 22 → 25');
    // Make personal email primary
    await emails.getByRole('button', { name: 'Make primary' }).click();
    await expect(tray).toContainText('2 pending changes');
    await expect(tray).toContainText(/Make email · personal .* primary/i);
    // Save
    await tray.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.cf-bar__title', { hasText: 'Saved together as revision 8' })).toBeVisible();
    await expect(page.getByText('Revision 8', { exact: false }).first()).toBeVisible();
    // Identity preserved: the personal email is now primary and history shows the move
    await page.getByRole('button', { name: 'Open this revision' }).click();
    await expect(page.getByText('4 field differences', { exact: false }).or(page.getByText('3 field differences', { exact: false }))).toBeVisible();
    await expect(page.locator('.cf-table')).toContainText('Position');
    await page.getByRole('button', { name: /Actions in this Save/ }).click();
    await expect(page.locator('.cf-action')).toHaveCount(2);
    expect(con.errors).toEqual([]);
  });

  test('combined edit: name, phone and address in one revision; shared address stays intact for Rodrigo', async ({ page }) => {
    await openVariant(page, 'casefile');
    await page.getByRole('button', { name: 'Edit record' }).click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByLabel('Display name').fill('Lina T.');
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    const phones = page.locator('section', { has: page.getByRole('heading', { name: /^Phones/ }) });
    await phones.getByRole('button', { name: /Edit \+52 777 312 3456/ }).click();
    await page.getByLabel('Number', { exact: true }).fill('312-3457');
    await expect(page.getByText(/read as a MX number with area code 777/)).toBeVisible();
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    const addresses = page.locator('section', { has: page.getByRole('heading', { name: /^Addresses/ }) });
    await addresses.getByRole('button', { name: /^Edit / }).click();
    await page.getByLabel('Ext. number').fill('14');
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    const tray = page.getByRole('region', { name: 'Pending changes' });
    await expect(tray).toContainText('3 pending changes');
    await tray.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.cf-bar__title', { hasText: 'Saved together as revision 8' })).toBeVisible();
    await page.getByRole('button', { name: 'Open this revision' }).click();
    await page.getByRole('button', { name: /Actions in this Save/ }).click();
    await expect(page.locator('.cf-action')).toHaveCount(3);
    // Rodrigo still has the old address value
    await page.goto(`/#/casefile/contact/c0a1e2d3-4b5c-4d6e-8f70-1a2b3c4d5e03`);
    await expect(page.getByText('Calle Morrow 12, Col. Centro')).toBeVisible();
  });

  test('history: state, empty diff with two actions, delete/restore identity, coverage unavailable', async ({ page }) => {
    await openVariant(page, 'casefile', `/contact/${LINA}?tab=history&rev=5&compare=4`);
    await expect(page.getByText('No net difference.')).toBeVisible();
    await page.getByRole('button', { name: /Actions in this Save/ }).click();
    await expect(page.locator('.cf-action')).toHaveCount(2);
    await page.getByRole('button', { name: /State at revision 5/ }).click();
    await expect(page.getByText('read only', { exact: false }).first()).toBeVisible();
    await expect(page.locator('.cf-hist-record')).toContainText('Personal');
    // revision 3 state has the old work email domain (historical values, not today's)
    await page.getByRole('button', { name: 'Revision 2', exact: false }).first().click();
    await page.getByRole('button', { name: /State at revision 2/ }).click();
    await expect(page.locator('.cf-hist-record')).toContainText('lina.torres@verticedemo.mx');
    // restore keeps identity
    await page.getByRole('button', { name: 'Revision 7', exact: false }).first().click();
    await page.getByRole('button', { name: /^Changes$/ }).click();
    await expect(page.locator('.cf-table')).toContainText('restored');
    await expect(page.locator('.cf-table')).toContainText('ordinal 1');
    // coverage
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByLabel('Historical coverage').selectOption('4');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Revision 2', exact: false }).first().click();
    await expect(page.getByText('409 · history_unavailable')).toBeVisible();
  });

  test('activity: permission denial, filters, drawer, evidence navigation and preserved context', async ({ page }) => {
    await openVariant(page, 'casefile', '/activity');
    await expect(page.getByText('403 · forbidden')).toBeVisible();
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByLabel(/Sofía Reyes/).check();
    await page.keyboard.press('Escape');
    await expect(page.locator('.cf-grid')).toBeVisible();
    await page.locator('#af-actor').selectOption('bruno');
    await page.locator('#af-family').selectOption('phone');
    await expect(page.locator('tr.cf-unit')).toHaveCount(3);
    await page.locator('#af-q').fill('warehouse');
    await expect(page.locator('tr.cf-unit')).toHaveCount(1);
    await page.locator('#af-q').fill('nothing-matches-this');
    await expect(page.getByText('No activity matches these filters')).toBeVisible();
    await page.locator('#af-q').fill('');
    await page.locator('tr.cf-unit').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: /Open revision/ }).click();
    await expect(page.getByText('read only', { exact: false }).first()).toBeVisible();
    await page.goBack();
    await expect(page.locator('#af-actor')).toHaveValue('bruno');
    await expect(page.locator('#af-family')).toHaveValue('phone');
    await expect(page.getByRole('dialog')).toBeVisible(); // the drawer is part of the preserved context
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // non-audit sources are distinct
    await page.locator('#af-actor').selectOption('all');
    await page.locator('#af-family').selectOption('all');
    await page.locator('#af-source').selectOption('operational');
    await expect(page.locator('tr.cf-unit')).toHaveCount(2);
    await page.locator('tr.cf-unit').first().click();
    await expect(page.getByRole('dialog')).toContainText('not part of the business audit');
  });

  test('sidekick: grounded summary, filter navigation, staged proposal apply/discard, bounded answer', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'casefile');
    const ask = page.getByLabel('Ask the sidekick');
    await ask.fill("What changed in Lina's contact this week?");
    await ask.press('Enter');
    await expect(page.locator('.cf-ref')).toHaveCount(6);
    await page.locator('.cf-ref', { hasText: 'Revision 4 vs 3' }).click();
    await expect(page.getByText('4 field differences', { exact: false })).toBeVisible();
    // proposal
    await ask.fill('Change this extension to 25 and make the work email primary');
    await ask.press('Enter');
    await expect(page.locator('.cf-proposal').last()).toContainText('Staged in your draft');
    const tray = page.getByRole('region', { name: 'Pending changes' });
    await expect(tray).toContainText('extension 22 → 25');
    await expect(tray).toContainText('staged by sidekick');
    await page.locator('.cf-proposal').last().getByRole('button', { name: 'Discard' }).click();
    await expect(tray).toHaveCount(0);
    await ask.fill('Change this extension to 25 and make the work email primary');
    await ask.press('Enter');
    await page.locator('.cf-proposal').last().getByRole('button', { name: 'Apply as one Save' }).click();
    await expect(page.locator('.cf-bar__title', { hasText: 'Saved together as revision 8' })).toBeVisible();
    // bounded
    await ask.fill('What is the weather in Cuernavaca?');
    await ask.press('Enter');
    await expect(page.locator('.cf-msg--bounded').last()).toContainText("won’t guess");
    // filter navigation as admin
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByLabel(/Sofía Reyes/).check();
    await page.keyboard.press('Escape');
    await ask.fill("Show Bruno's phone changes");
    await ask.press('Enter');
    await expect(page.locator('#af-actor')).toHaveValue('bruno');
    await expect(page.locator('tr.cf-unit')).toHaveCount(3);
    expect(con.errors).toEqual([]);
  });

  test('personas: auditor is read-only and sees Norte Taller as directory projection', async ({ page }) => {
    await openVariant(page, 'casefile');
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByLabel(/Diego Lara/).check();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Edit record' })).toHaveCount(0);
    await page.goto(`/#/casefile/contact/${NORTE}`);
    await expect(page.getByText('Directory view · public channels only')).toBeVisible();
    await expect(page.getByText('facturacion@nortetaller.example')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /History/ })).toHaveCount(0);
  });

  test('conflict rehearsal: Mariana edits revision 3, Bruno saves 4, stale Save is rejected and reconciled', async ({ page }) => {
    const con = watchConsole(page);
    await openVariant(page, 'casefile');
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByRole('button', { name: 'Rewind: Mariana edits revision 3' }).click();
    await page.keyboard.press('Escape');
    const tray = page.getByRole('region', { name: 'Pending changes' });
    await expect(tray).toContainText('on revision 3');
    await expect(tray).toContainText('extension 14 → 25');
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByRole('button', { name: 'Simulate Bruno’s update' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Bruno saved revision 4 while you are editing revision 3')).toBeVisible();
    await tray.getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('409 conflict');
    await expect(page.getByRole('alertdialog')).toContainText('overlaps');
    await page.getByRole('button', { name: 'Keep my draft on revision 4' }).click();
    await expect(tray).toContainText('on revision 4');
    await expect(tray).toContainText('extension 22 → 25');
    await tray.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.cf-bar__title', { hasText: 'Saved together as revision 5' })).toBeVisible();
    // operational log recorded the rejection; Bruno's revision 4 survived
    await page.goto(`/#/casefile/contact/${LINA}?tab=history&rev=4&compare=3`);
    await expect(page.locator('.cf-table')).toContainText('Lina Torres');
    expect(con.errors).toEqual([]);
  });

  test('two tabs: Bruno saves in tab B while Mariana drafts in tab A', async ({ page, context }) => {
    await openVariant(page, 'casefile');
    await page.getByRole('button', { name: 'Edit record' }).click();
    const phones = page.locator('section', { has: page.getByRole('heading', { name: /^Phones/ }) });
    await phones.getByRole('button', { name: /Edit \+52 55 5254 0800/ }).click();
    await page.getByLabel('Extension').fill('30');
    await page.getByRole('button', { name: 'Apply to draft' }).click();
    const tabB = await openSecondTab(context, 'casefile');
    await tabB.getByRole('button', { name: 'Demo controls' }).click();
    await tabB.getByLabel(/Bruno Castañeda/).check();
    await tabB.keyboard.press('Escape');
    await tabB.getByRole('button', { name: 'Edit record' }).click();
    const emailsB = tabB.locator('section', { has: tabB.getByRole('heading', { name: /^Emails/ }) });
    await emailsB.getByRole('button', { name: 'Make primary' }).click();
    await tabB.getByRole('region', { name: 'Pending changes' }).getByRole('button', { name: /^Save/ }).click();
    await expect(tabB.locator('.cf-bar__title', { hasText: 'Saved together as revision 8' })).toBeVisible();
    // presence: tab A shows Bruno; tab A sees the incoming revision
    await expect(page.getByText('Bruno saved revision 8 while you are editing revision 7')).toBeVisible();
    await expect(page.locator('.cf-presence__text')).toContainText('Bruno');
    await page.getByRole('region', { name: 'Pending changes' }).getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('409 conflict');
    await page.getByRole('button', { name: 'Discard my draft' }).click();
    await expect(page.getByRole('region', { name: 'Pending changes' })).toHaveCount(0);
    await expect(page.getByText('Revision 8', { exact: false }).first()).toBeVisible();
  });

  test('demo outcomes: permission denied, uncertain commit investigation, reset restores the story', async ({ page }) => {
    await openVariant(page, 'casefile');
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByLabel('Next Save outcome').selectOption('forbidden');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Edit record' }).click();
    const emails = page.locator('section', { has: page.getByRole('heading', { name: /^Emails/ }) });
    await emails.getByRole('button', { name: 'Make primary' }).click();
    const tray = page.getByRole('region', { name: 'Pending changes' });
    await tray.getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByText('Save failed · 403 forbidden')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByLabel('Next Save outcome').selectOption('uncertain');
    await page.keyboard.press('Escape');
    await tray.getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByText('Save outcome unknown (500 commit_uncertain)')).toBeVisible();
    await page.getByRole('button', { name: 'Check the current revision' }).click();
    await expect(page.getByText('The Save did commit', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'It committed · drop my draft' }).click();
    await expect(tray).toHaveCount(0);
    await expect(page.getByText('Revision 8', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Demo controls' }).click();
    await page.getByRole('button', { name: 'Reset demo' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Revision 7', { exact: false }).first()).toBeVisible();
  });

  test('narrow layout renders the record and the pending tray', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 860 });
    await openVariant(page, 'casefile');
    await expect(page.getByRole('heading', { name: 'Lina Torres' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit record' }).click();
    const emails = page.locator('section', { has: page.getByRole('heading', { name: /^Emails/ }) });
    await emails.getByRole('button', { name: 'Make primary' }).click();
    await expect(page.getByRole('region', { name: 'Pending changes' })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(420);
  });
});
