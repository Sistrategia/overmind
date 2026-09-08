import { expect, test } from '@playwright/test';
import { collectErrors, demoAction, expectNoErrors, fresh, secondTab, setPersona, setSaveOutcome } from './helpers';

const V = 'desk';

test.describe('Desk', () => {
  test('small edit: extension + label, make primary, save together as one revision', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await expect(page.getByTestId('record')).toBeVisible();
    await expect(page.getByText('Revision 7', { exact: true }).first()).toBeVisible();

    // Edit the office phone inline: extension 12 → 25, label Office → Oficina.
    const office = page.getByTestId('row-phone#2');
    await office.hover();
    await office.getByTestId('row-edit').click();
    await expect(page.getByTestId('phone-interpretation')).toContainText('+525551234567');
    await page.screenshot({ path: `evidence/${V}-contact-light.png` });
    await page.getByTestId('child-extension').fill('25');
    await page.getByTestId('child-label').fill('Oficina');
    await page.getByTestId('child-submit').click();
    await expect(page.getByTestId('pending-list')).toContainText('extension 12 → 25');
    await expect(office).toContainText('ext. 25');
    await expect(office).toContainText('pending');

    // Validation on a new email, then cancel.
    await page.getByTestId('add-email').click();
    await page.getByTestId('email-value').fill('not-an-email');
    await page.getByTestId('child-submit').click();
    await expect(page.getByText('This does not look like an email address.')).toBeVisible();
    await page.getByTestId('child-cancel').click();

    // Make the work email primary (position 2 → 1).
    const work = page.getByTestId('row-email#1');
    await work.hover();
    await work.getByTestId('row-primary').click();
    await expect(page.getByTestId('pending-list')).toContainText('Move Work email to position 1 (primary)');
    await expect(page.getByTestId('pending-tray')).toContainText('2 pending changes');

    await page.getByTestId('save').click();
    await expect(page.getByTestId('saved-banner')).toContainText('Revision 8');
    await expect(page.getByTestId('rev-8')).toContainText('Current');
    // identity preserved: phone 2 still phone 2, work email still identity 1 but now first.
    await expect(page.getByTestId('row-phone#2')).toContainText('ext. 25');
    await expect(page.getByTestId('row-email#1')).toContainText('Primary');
    await expect(page.getByTestId('section-email').locator('.crow').first()).toContainText('vertice-demo.mx');

    // Evidence: revision 8 shows two actions in order.
    await page.getByTestId('view-evidence').click();
    await expect(page.getByTestId('rail-detail')).toContainText('Mariana Ruiz saved revision 8');
    await expect(page.getByTestId('record')).toHaveAttribute('data-mode', 'current'); // the newest revision is not historical
    await page.getByTestId('mode-during').click();
    await expect(page.getByTestId('actions-list').locator('li')).toHaveCount(2);
    await expect(page.getByTestId('actions-list')).toContainText('phone.replace');
    await expect(page.getByTestId('actions-list')).toContainText('email.move');
    await expectNoErrors(errors);
  });

  test('combined name + phone + address edit makes one revision; address correction leaves Norte Taller alone', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await page.getByTestId('edit-profile').click();
    await page.getByTestId('profile-alias').fill('Lina T.');
    await page.getByTestId('profile-submit').click();
    const mobile = page.getByTestId('row-phone#1');
    await mobile.hover(); await mobile.getByTestId('row-edit').click();
    await page.getByTestId('child-label').fill('Celular');
    await page.getByTestId('child-submit').click();
    const addr = page.getByTestId('row-address#1');
    await addr.hover(); await addr.getByTestId('row-edit').click();
    await page.getByTestId('address-zipCode').fill('62020');
    await page.getByTestId('child-submit').click();
    await expect(page.getByTestId('pending-tray')).toContainText('3 pending changes');
    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('saved-banner')).toContainText('Revision 8');
    await expect(page.getByTestId('rev-8')).toContainText('Profile');
    await expect(page.getByTestId('row-address#1')).toContainText('62020');
    await page.goto(`/#/${V}/contact/norte-taller`);
    await expect(page.getByTestId('row-address#1')).toContainText('62000');
    await expectNoErrors(errors);
  });

  test('history: state at, difference between, actions during; change-and-back keeps actions with empty diff', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/history/lina?rev=4&compare=3`);
    await expect(page.getByTestId('historical-banner')).toContainText('revision 4');
    await expect(page.getByTestId('row-address#1').getByTestId('row-diff')).toContainText('62000');
    await expect(page.getByTestId('profile-block')).toContainText('Lina Torres Aguilar');
    await expect(page.getByTestId('rail-detail')).toContainText('Bruno Salas');
    await expect(page.getByTestId('diff-list')).toContainText('Postal code');
    await page.getByTestId('mode-during').click();
    await expect(page.getByTestId('actions-list').locator('li')).toHaveCount(3);
    await page.getByTestId('mode-at').click();
    await expect(page.getByTestId('state-at')).toContainText('lina.ta@correo-personal.mx');
    // No edit affordances in historical mode.
    await expect(page.getByTestId('row-edit')).toHaveCount(0);
    await expect(page.getByTestId('edit-profile')).toHaveCount(0);

    await page.getByTestId('rev-5').click();
    await page.getByTestId('mode-between').click();
    await expect(page.getByTestId('diff-empty')).toContainText('No net difference');
    await page.getByTestId('mode-during').click();
    await expect(page.getByTestId('actions-list').locator('li')).toHaveCount(2);
    // Revision 1 shows the original typo, not today's value.
    await page.getByTestId('rev-1').click();
    await expect(page.getByTestId('row-phone#1')).toContainText('+52 777 312 3465');
    // Compare 7 with 3 across several revisions.
    await page.getByTestId('rev-7').click();
    await page.getByTestId('mode-between').click();
    await page.getByTestId('compare-select').selectOption('3');
    await expect(page.getByTestId('diff-list')).toContainText('Office phone');
    await page.screenshot({ path: `evidence/${V}-history-light.png` });
    // Missing coverage is an explicit answer.
    await demoAction(page, 'history-unavailable');
    await page.getByTestId('rev-1').click();
    await expect(page.getByText('Historical coverage unavailable').first()).toBeVisible();
    await page.getByTestId('back-to-current').click();
    await expect(page.getByTestId('record')).toHaveAttribute('data-mode', 'current');
    await expectNoErrors(errors);
  });

  test('activity: permission, filters, unit detail, evidence navigation with preserved context', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/activity`);
    await expect(page.getByTestId('activity-denied')).toBeVisible();
    await setPersona(page, 'rocio');
    await expect(page.getByTestId('activity-table')).toBeVisible();
    const allRows = await page.getByTestId('activity-row').count();
    expect(allRows).toBeGreaterThanOrEqual(14);
    await expect(page.getByTestId('activity-op-row').first()).toContainText('stale revision');
    await page.getByTestId('filter-actor').selectOption('bruno');
    await page.getByTestId('filter-family').selectOption('phone');
    await expect(page.getByTestId('activity-row')).toHaveCount(3); // Lina rev 2, rev 4 and Norte Taller's creation
    await page.getByTestId('filter-q').fill('postal');
    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    await page.getByTestId('filter-q').fill('zzz-nothing');
    await expect(page.getByText('No activity matches these filters.')).toBeVisible();
    await page.getByTestId('filter-q').fill('');
    await page.getByTestId('activity-row').first().click();
    await expect(page.getByTestId('unit-drawer')).toContainText('Bruno Salas');
    await expect(page.getByTestId('unit-drawer')).toContainText('Office phone');
    await page.screenshot({ path: `evidence/${V}-activity-light.png` });
    await page.getByTestId('open-contact-revision').click();
    await expect(page.getByTestId('historical-banner')).toContainText('revision 4');
    await page.getByTestId('back-to-activity').click();
    await expect(page).toHaveURL(/actor=bruno/);
    await expect(page).toHaveURL(/family=phone/);
    await expect(page.getByTestId('unit-drawer')).toBeVisible();
    await expectNoErrors(errors);
  });

  test('sidekick: grounded summary, filter navigation, staged proposal applied as one Save, bounded answers', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await page.getByTestId('toggle-sidekick').click();
    await page.getByTestId('sidekick-input').fill("What changed in Lina's contact this week?");
    await page.getByTestId('sidekick-send').click();
    const reply = page.getByTestId('sidekick-sidekick').last();
    await expect(reply).toContainText('Revision 4');
    await expect(reply).toContainText('Revision 7');
    await expect(reply).toContainText('net difference');
    await reply.getByTestId('sidekick-ref').first().click();
    await expect(page.getByTestId('historical-banner')).toContainText('revision 4');
    await expect(page.getByTestId('diff-list')).toContainText('Postal code');

    // Editors cannot open tenant activity: bounded answer with contact-scoped evidence.
    await page.getByTestId('sidekick-input').fill("Show Bruno's phone changes");
    await page.getByTestId('sidekick-send').click();
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText('cannot open tenant-wide activity');
    await setPersona(page, 'rocio');
    await page.getByTestId('sidekick-input').fill("Show Bruno's phone changes");
    await page.getByTestId('sidekick-send').click();
    await expect(page).toHaveURL(/activity\?.*actor=bruno/);
    await expect(page).toHaveURL(/family=phone/);
    await expect(page.getByTestId('activity-row')).toHaveCount(3);

    // Back to Lina as Mariana: a write proposal.
    await setPersona(page, 'mariana');
    await page.goto(`/#/${V}/contact/lina`);
    await page.getByTestId('sidekick-input').fill('Change this extension to 25 and make the work email primary');
    await page.getByTestId('sidekick-send').click();
    const proposal = page.getByTestId('sidekick-proposal').last();
    await expect(proposal).toContainText('extension 12 → 25');
    await expect(proposal).toContainText('position 2 to 1');
    await proposal.getByTestId('proposal-stage').click();
    await expect(page.getByTestId('pending-tray')).toContainText('2 pending changes');
    await expect(page.getByTestId('pending-list')).toContainText('sidekick');
    await page.getByTestId('discard-all').click();
    await expect(page.getByTestId('pending-tray')).toHaveCount(0);
    await page.getByTestId('sidekick-input').fill('change the office extension to 25 and make the work email primary');
    await page.getByTestId('sidekick-send').click();
    await page.getByTestId('sidekick-proposal').last().getByTestId('proposal-save').click();
    await expect(page.getByTestId('saved-banner')).toContainText('Revision 8');
    await expect(page.getByTestId('row-phone#2')).toContainText('ext. 25');
    await expect(page.getByTestId('row-email#1')).toContainText('Primary');
    // Facts follow the new state.
    await page.getByTestId('sidekick-input').fill('What is the primary email?');
    await page.getByTestId('sidekick-send').click();
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText('lina.torres@vertice-demo.mx');
    // Bounded.
    await page.getByTestId('sidekick-input').fill("What is Lina's birthday?");
    await page.getByTestId('sidekick-send').click();
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText("don't hold other facts");
    // Read-only persona cannot stage.
    await setPersona(page, 'tomas');
    await page.getByTestId('sidekick-input').fill('change the office extension to 30');
    await page.getByTestId('sidekick-send').click();
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText('no edit grant');
    await expect(page.getByTestId('sidekick-proposal').last()).toHaveAttribute('data-state', 'saved');
    await expectNoErrors(errors);
  });

  test('two tabs: Mariana drafts on revision 7, Bruno saves 8, stale Save reconciles field by field', async ({ page, context }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    const office = page.getByTestId('row-phone#2');
    await office.hover(); await office.getByTestId('row-edit').click();
    await page.getByTestId('child-extension').fill('25');
    await page.getByTestId('child-submit').click();
    await expect(page.getByTestId('pending-tray')).toContainText('1 pending change');

    const bruno = await secondTab(context, `#/${V}/contact/lina`, 'bruno');
    await expect(bruno.getByTestId('presence')).toContainText('Mariana is editing');
    const bOffice = bruno.getByTestId('row-phone#2');
    await bOffice.hover(); await bOffice.getByTestId('row-edit').click();
    await bruno.getByTestId('child-label').fill('Oficina');
    await bruno.getByTestId('child-submit').click();
    await bruno.getByTestId('save').click();
    await expect(bruno.getByTestId('saved-banner')).toContainText('Revision 8');

    await expect(page.getByTestId('stale-banner')).toContainText('Revision 8 arrived');
    await expect(page.getByTestId('pending-tray')).toContainText('1 pending change'); // draft preserved
    await page.getByTestId('save').click();
    await expect(page.getByTestId('reconcile')).toBeVisible();
    await expect(page.getByTestId('reconcile-item-merged')).toContainText('Combined');
    await page.screenshot({ path: `evidence/${V}-conflict-light.png` });
    await page.getByTestId('reconcile-save').click();
    await expect(page.getByTestId('saved-banner')).toContainText('Revision 9');
    await expect(page.getByTestId('row-phone#2')).toContainText('Oficina');
    await expect(page.getByTestId('row-phone#2')).toContainText('ext. 25');
    await expect(bruno.getByTestId('row-phone#2')).toContainText('ext. 25'); // Bruno's tab refreshed

    // Same-field conflict needs an explicit choice.
    await office.hover(); await office.getByTestId('row-edit').click();
    await page.getByTestId('child-extension').fill('40');
    await page.getByTestId('child-submit').click();
    await demoAction(bruno, 'simulate-bruno-extension');
    await expect(page.getByTestId('stale-banner')).toBeVisible();
    await page.getByTestId('review-conflict').click();
    await expect(page.getByTestId('reconcile-item-conflict')).toBeVisible();
    await expect(page.getByTestId('reconcile-save')).toBeDisabled();
    await page.getByTestId('resolve-mine').check();
    await page.getByTestId('reconcile-save').click();
    await expect(page.getByTestId('saved-banner')).toContainText('Revision 11');
    await expect(page.getByTestId('row-phone#2')).toContainText('ext. 40');
    await bruno.close();
    await expectNoErrors(errors);
  });

  test('personas, uncertain outcome, theme persistence, reset', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await setPersona(page, 'tomas');
    await expect(page.getByText('Read-only role')).toBeVisible();
    await expect(page.getByTestId('edit-profile')).toHaveCount(0);
    await expect(page.getByTestId('rev-7')).toBeVisible();
    await setPersona(page, 'paola');
    await expect(page.getByTestId('directory-banner')).toBeVisible();
    await expect(page.getByTestId('record-directory')).not.toContainText('correo-personal');
    await expect(page.getByTestId('record-directory')).toContainText('vertice-demo.mx');
    await expect(page.getByTestId('rail')).toContainText('cannot read revision history');
    await setPersona(page, 'mariana');

    // Uncertain commit: investigate, do not retry.
    await setSaveOutcome(page, 'uncertain-committed');
    const mobile = page.getByTestId('row-phone#1');
    await mobile.hover(); await mobile.getByTestId('row-edit').click();
    await page.getByTestId('child-label').fill('Celular');
    await page.getByTestId('child-submit').click();
    await page.getByTestId('save').click();
    await expect(page.getByTestId('uncertain-outcome')).toBeVisible();
    await page.getByTestId('uncertain-check').click();
    await expect(page.getByTestId('uncertain-result')).toContainText('Committed');
    await expect(page.getByTestId('uncertain-result')).toContainText('revision 8');
    await page.getByRole('button', { name: 'Discard draft' }).click();
    await expect(page.getByTestId('row-phone#1')).toContainText('Celular');

    // Storage failure is a definite error.
    await setSaveOutcome(page, 'storage');
    await mobile.hover(); await mobile.getByTestId('row-edit').click();
    await page.getByTestId('child-label').fill('Mobile');
    await page.getByTestId('child-submit').click();
    await page.getByTestId('save').click();
    await expect(page.getByRole('alert').filter({ hasText: 'Storage failure' })).toBeVisible();

    // Theme persists across reload; dark screenshot of the history view.
    await page.getByTestId('theme-toggle').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.goto(`/#/${V}/history/lina?rev=4&compare=3`);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('historical-banner')).toBeVisible();
    await page.getByTestId('toggle-sidekick').click();
    await page.getByTestId('sidekick-input').fill('Who changed the postal code?');
    await page.getByTestId('sidekick-send').click();
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText('Bruno');
    await page.screenshot({ path: `evidence/${V}-dark.png` });
    await page.getByTestId('theme-toggle').first().click();

    // Reset restores the initial story.
    await page.goto(`/#/${V}/contact/lina`);
    await demoAction(page, 'demo-reset');
    await expect(page.getByTestId('rev-7')).toContainText('Current');
    await expect(page.getByTestId('rev-8')).toHaveCount(0);
    await expect(page.getByTestId('row-phone#1')).toContainText('Mobile');
    await expectNoErrors(errors);
  });

  test('narrow layout stays usable', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 414, height: 860 });
    await fresh(page, `#/${V}/contact/lina`);
    await expect(page.getByTestId('record')).toBeVisible();
    const office = page.getByTestId('row-phone#2');
    await office.getByTestId('row-edit').click();
    await expect(page.getByTestId('child-extension')).toBeVisible();
    await page.screenshot({ path: `evidence/${V}-narrow.png`, fullPage: false });
    await page.getByTestId('child-cancel').click();
    await page.getByTestId('mobile-evidence').click();
    await expect(page.getByTestId('rev-7')).toBeVisible();
    await page.getByTestId('rev-4').click();
    await expect(page.getByTestId('rail-detail')).toContainText('Postal code');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(414);
    await expectNoErrors(errors);
  });
});
