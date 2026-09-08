import { expect, test, type Page } from '@playwright/test';
import { collectErrors, demoAction, expectNoErrors, fresh, secondTab, setPersona, setSaveOutcome } from './helpers';

const V = 'console';

async function run(page: Page, command: string) {
  const input = page.getByTestId('command-input');
  await input.click();
  await input.fill(command);
  await input.press('Enter');
}

test.describe('Console', () => {
  test('typed commands stage an ordered stack and save it as one revision', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await expect(page.getByTestId('record')).toBeVisible();
    await expect(page.getByTestId('record')).toContainText('r7');
    await run(page, 'set phone 2 ext 25');
    await expect(page.getByTestId('status-text')).toContainText('staged');
    await run(page, 'set phone 2 label Oficina');
    await expect(page.getByTestId('pending-list').locator('li')).toHaveCount(1); // coalesced replace on the same child
    await expect(page.getByTestId('pending-list')).toContainText('extension 12 → 25');
    await expect(page.getByTestId('pending-list')).toContainText('label Office → Oficina');
    await run(page, 'primary email 1');
    await expect(page.getByTestId('pending-list').locator('li')).toHaveCount(2);
    await expect(page.getByTestId('pending-list')).toContainText('email.move');
    await page.getByRole('button', { name: 'show request' }).click();
    await expect(page.getByTestId('wire-preview')).toContainText('"expectedEntityVersion": 7');
    await page.screenshot({ path: `evidence/${V}-contact-light.png` });
    // Validation through the command line and the form.
    await run(page, 'add email not-an-email');
    await expect(page.getByTestId('pending-list').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('pending-list')).toContainText('This does not look like an email address.');
    await expect(page.getByTestId('save')).toBeDisabled();
    await run(page, 'undo');
    await expect(page.getByTestId('pending-list').locator('li')).toHaveCount(2);
    await run(page, 'edit phone 1');
    await expect(page.getByTestId('editor-pane')).toBeVisible();
    await expect(page.getByTestId('phone-interpretation')).toContainText('+527773123456');
    await page.getByTestId('child-cancel').click();
    await run(page, 'save');
    await expect(page.getByTestId('saved-banner')).toContainText('r8');
    await expect(page.getByTestId('row-phone#2')).toContainText('25');
    await expect(page.getByTestId('row-phone#2')).toContainText('Oficina');
    await expect(page.getByTestId('row-email#1')).toContainText('primary');
    await expect(page.getByTestId('status-bar')).toContainText('contact lina r8');
    await page.getByTestId('view-evidence').click();
    await expect(page.getByTestId('three-answers')).toContainText('phone.replace');
    await expect(page.getByTestId('three-answers')).toContainText('email.move');
    await expectNoErrors(errors);
  });

  test('combined profile + phone + address via form and commands in one Save; shared address untouched', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await run(page, 'set alias "Lina T."'); // typed before the contact finishes loading: held, then applied
    await run(page, 'set phone 1 label Celular');
    await run(page, 'edit address 1');
    await page.getByTestId('address-zipCode').fill('62020');
    await page.getByTestId('child-submit').click();
    await expect(page.getByTestId('pending-list').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('pending-list').locator('li').first()).toContainText('profile.replace');
    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('saved-banner')).toContainText('r8');
    await expect(page.getByTestId('profile-kv')).toContainText('Lina T.');
    await run(page, 'open norte-taller');
    await expect(page.getByTestId('row-address#1')).toContainText('62000');
    await expectNoErrors(errors);
  });

  test('history: ladder scrubbing with three simultaneous answers', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await run(page, 'rev 4');
    await expect(page.getByTestId('historical-banner')).toContainText('r4');
    await expect(page.getByTestId('three-answers')).toContainText('Postal code');
    await expect(page.getByTestId('three-answers')).toContainText('62000');
    await expect(page.getByTestId('actions-list').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('state-at')).toContainText('lina.ta@correo-personal.mx');
    await page.getByTestId('ladder').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('historical-banner')).toContainText('r5');
    await expect(page.getByTestId('diff-empty')).toContainText('no net difference');
    await expect(page.getByTestId('actions-list').locator('li')).toHaveCount(2);
    await run(page, 'compare 3 7');
    await expect(page.getByTestId('diff-list')).toContainText('Office phone');
    await expect(page.getByTestId('rev-3')).toHaveClass(/cmp/);
    await page.screenshot({ path: `evidence/${V}-history-light.png` });
    await run(page, 'rev 1');
    await expect(page.getByTestId('state-at')).toContainText('+52 777 312 3465');
    await demoAction(page, 'history-unavailable');
    await expect(page.getByText('Historical coverage unavailable').first()).toBeVisible();
    // Staging is refused in historical mode.
    await run(page, 'set phone 1 label X');
    await expect(page.getByTestId('status-text')).toContainText('read-only');
    await expectNoErrors(errors);
  });

  test('activity: typed filters, unit detail, evidence round trip with context', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/activity`);
    await expect(page.getByTestId('activity-denied')).toBeVisible();
    await run(page, 'persona rocio');
    await expect(page.getByTestId('list-item').first()).toBeVisible();
    await run(page, 'actor bruno');
    await run(page, 'family phone');
    await expect(page).toHaveURL(/actor=bruno/);
    await expect(page.getByTestId('list-item')).toHaveCount(3);
    await run(page, 'q zzz');
    await expect(page.getByTestId('activity-empty')).toBeVisible();
    await run(page, 'q none');
    await page.getByTestId('list-item').first().click();
    await expect(page.getByTestId('unit-drawer')).toContainText('Bruno Salas');
    await expect(page.getByTestId('unit-drawer')).toContainText('affected records');
    await page.screenshot({ path: `evidence/${V}-activity-light.png` });
    await page.getByTestId('open-contact-revision').click();
    await expect(page.getByTestId('historical-banner')).toBeVisible();
    await page.getByTestId('back-to-activity').click();
    await expect(page).toHaveURL(/actor=bruno/);
    await expect(page.getByTestId('unit-drawer')).toBeVisible();
    await run(page, 'clear');
    await run(page, 'source operational');
    await expect(page.getByTestId('list-item').first()).toContainText('not in the business audit');
    await expectNoErrors(errors);
  });

  test('sidekick shares the command line: summary, filters, proposal into the stack', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await run(page, "What changed in Lina's contact this week?");
    await expect(page.getByTestId('sidekick')).toBeVisible();
    const reply = page.getByTestId('sidekick-sidekick').last();
    await expect(reply).toContainText('Revision 4');
    await expect(reply).toContainText('Revision 7');
    await reply.getByTestId('sidekick-ref').first().click();
    await expect(page.getByTestId('historical-banner')).toContainText('r4');
    await run(page, 'open');
    await run(page, "Show Bruno's phone changes");
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText('cannot open tenant-wide activity');
    await run(page, 'persona rocio');
    await run(page, "Show Bruno's phone changes");
    await expect(page).toHaveURL(/activity\?.*actor=bruno/);
    await expect(page.getByTestId('list-item')).toHaveCount(3);
    await run(page, 'persona mariana');
    await run(page, 'open lina');
    await page.getByTestId('row-phone#2').click(); // "this" phone
    await run(page, 'Change this extension to 25 and make the work email primary');
    const proposal = page.getByTestId('sidekick-proposal').last();
    await expect(proposal).toContainText('extension 12 → 25');
    await proposal.getByTestId('proposal-stage').click();
    await expect(page.getByTestId('pending-list').locator('li')).toHaveCount(2);
    await expect(page.getByTestId('pending-list')).toContainText('sidekick');
    await run(page, 'drop 2');
    await expect(page.getByTestId('pending-list').locator('li')).toHaveCount(1);
    await run(page, 'discard');
    await run(page, 'change the office extension to 25 and make the work email primary');
    await page.getByTestId('sidekick-proposal').last().getByTestId('proposal-save').click();
    await expect(page.getByTestId('saved-banner')).toContainText('r8');
    await expect(page.getByTestId('row-phone#2')).toContainText('25');
    await run(page, 'What is the primary email?');
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText('lina.torres@vertice-demo.mx');
    await run(page, "What is Lina's birthday?");
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText("don't hold other facts");
    await run(page, 'persona tomas');
    await run(page, 'change the office extension to 30');
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText('no edit grant');
    await run(page, 'set phone 2 ext 31');
    await expect(page.getByTestId('status-text')).toContainText('no edit grant');
    await expectNoErrors(errors);
  });

  test('two tabs: stale stack reconciles; same-field conflict needs a choice', async ({ page, context }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await run(page, 'set phone 2 ext 25');
    const bruno = await secondTab(context, `#/${V}/contact/lina`, 'bruno');
    await expect(bruno.getByTestId('presence')).toContainText('Mariana is editing');
    await run(bruno, 'set phone 2 label Oficina');
    await run(bruno, 'save');
    await expect(bruno.getByTestId('saved-banner')).toContainText('r8');
    await expect(page.getByTestId('stale-banner')).toContainText('r8 arrived');
    await run(page, 'save');
    await expect(page.getByTestId('reconcile')).toBeVisible();
    await expect(page.getByTestId('reconcile-item-merged')).toBeVisible();
    await page.screenshot({ path: `evidence/${V}-conflict-light.png` });
    await page.getByTestId('reconcile-save').click();
    await expect(page.getByTestId('saved-banner')).toContainText('r9');
    await expect(page.getByTestId('row-phone#2')).toContainText('Oficina');
    await expect(page.getByTestId('row-phone#2')).toContainText('25');
    await run(page, 'set phone 2 ext 40');
    await demoAction(bruno, 'simulate-bruno-extension');
    await expect(page.getByTestId('stale-banner')).toBeVisible();
    await run(page, 'reconcile');
    await expect(page.getByTestId('reconcile-item-conflict')).toBeVisible();
    await expect(page.getByTestId('reconcile-save')).toBeDisabled();
    await page.getByTestId('resolve-theirs').check();
    await page.getByTestId('reconcile-save').click();
    await expect(page.getByTestId('row-phone#2')).toContainText('30'); // Bruno's value kept, nothing overwritten
    await expect(page.getByTestId('pending-tray')).toHaveCount(0);
    await bruno.close();
    await expectNoErrors(errors);
  });

  test('personas, uncertain outcome, theme persistence, reset, narrow', async ({ page }) => {
    const errors = collectErrors(page);
    await fresh(page, `#/${V}/contact/lina`);
    await run(page, 'persona paola');
    await expect(page.getByTestId('directory-banner')).toBeVisible();
    await expect(page.getByTestId('record-directory')).not.toContainText('correo-personal');
    await run(page, 'persona tomas');
    await expect(page.getByText('read-only role')).toBeVisible();
    await run(page, 'history');
    await expect(page.getByTestId('three-answers')).toBeVisible();
    await run(page, 'persona mariana');
    await run(page, 'open');
    await setSaveOutcome(page, 'uncertain-committed');
    await run(page, 'set phone 1 label Celular');
    await run(page, 'save');
    await expect(page.getByTestId('uncertain-outcome')).toBeVisible();
    await page.getByTestId('uncertain-check').click();
    await expect(page.getByTestId('uncertain-result')).toContainText('Committed');
    await page.getByRole('button', { name: 'Discard draft' }).click();
    await expect(page.getByTestId('row-phone#1')).toContainText('Celular');
    await run(page, 'theme dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await run(page, 'rev 4');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('three-answers')).toBeVisible();
    await run(page, 'Who changed the postal code?');
    await expect(page.getByTestId('sidekick-sidekick').last()).toContainText('Bruno');
    await page.screenshot({ path: `evidence/${V}-dark.png` });
    await run(page, 'theme light');
    await run(page, 'reset');
    await run(page, 'open');
    await expect(page.getByTestId('record')).toContainText('r7');
    await expect(page.getByTestId('row-phone#1')).toContainText('Mobile');

    await page.setViewportSize({ width: 414, height: 860 });
    await page.goto(`/#/${V}/contact/lina`);
    await expect(page.getByTestId('record-table')).toBeVisible();
    await run(page, 'edit phone 2');
    await expect(page.getByTestId('child-extension')).toBeVisible();
    await page.screenshot({ path: `evidence/${V}-narrow.png` });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(414);
    await expectNoErrors(errors);
  });
});
