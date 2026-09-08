// Browser verification uses Playwright only as an optional development tool.
// Set PLAYWRIGHT_MODULE to an absolute playwright/index.mjs if not installed locally.
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const playwright=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await playwright.chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
const baseURL=process.env.BASE_URL||'http://127.0.0.1:4317';
await mkdir(new URL('./evidence/',import.meta.url),{recursive:true});
const errors=[],results=[],expectedNetworkDiagnostics=[];
const shot=async(page,file)=>page.screenshot({path:new URL('./evidence/'+file+'.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:false});
const action=(page,name)=>page.locator(`[data-action="${name}"]`).first();
const reset=async(page,variant,atThree=false)=>{await page.request.post(`${baseURL}/demo/${variant}/reset?persona=Mariana`,{data:{atThree}});await page.reload();await page.locator('#persona').waitFor();};
for(const variant of ['dispatch','ledger','relay']){
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(`${variant}: ${e.message}`));page.on('console',m=>{if(m.type()==='error'){if(/status of (409|500|404)/.test(m.text()))expectedNetworkDiagnostics.push(`${variant}: ${m.text()}`);else errors.push(`${variant}: ${m.text()}`);}});
 await page.goto(baseURL+'/'+variant);await reset(page,variant);
 await shot(page,variant+'-contact-light');
 // Inline/sequence editing, validation, cancel, combined Save and order.
 if(variant==='relay')await page.locator('[data-action="task"][data-family="all"]').click();else await action(page,'edit').click();
 await page.locator('#phone-1-extension').fill('26');await action(page,'cancel').click();
 if(variant==='relay')await page.locator('[data-action="task"][data-family="all"]').click();else await action(page,'edit').click();
 assert.equal(await page.locator('#phone-1-extension').inputValue(),'21');
 await page.locator('#profile-name').fill('Lina Torres Castillo');
 await page.locator('#phone-1-value').fill('312-3456');
 assert.match(await page.locator('#phone-hint-1').textContent(),/\+527773123456/);
 await page.locator('#phone-1-extension').fill('25');await page.locator('#phone-1-label').fill('Office line');
 await page.locator('#address-1-value').fill('Calle Reforma 12\n62000 Cuernavaca, Morelos\nMéxico');
 await page.locator('[data-action="primary"][data-family="email"][data-ordinal="1"]').click();
 if(variant==='relay')await action(page,'review').click();
 await action(page,'save').click();await page.getByText('Saved together · Revision 8 · Changed by Mariana',{exact:true}).waitFor();
 let data=await (await page.request.get(`${baseURL}/demo/${variant}/state?persona=Mariana`)).json();
 assert.equal(data.contacts.lina.revisions.length,8);assert.equal(data.contacts.norte.revisions[0].snapshot.address[0].value.includes('Reforma'),false);assert.equal(data.contacts.lina.revisions.at(-1).snapshot.email[0].ordinal,1);
 // Grounded history, no final diff versus two ordered actions, historical labels.
 await action(page,'saved-history').click();await page.locator('#revision').selectOption('5');await page.locator('#compare').selectOption('4');
 await page.getByText('No final state differences',{exact:true}).waitFor();
 await page.locator('[data-action="history-mode"][data-mode="actions"]').click();assert.equal(await page.locator('.evidence-paper .action-list>li').count(),2);
 await page.locator('#revision').selectOption('3');await page.locator('[data-action="history-mode"][data-mode="state"]').click();assert.match(await page.locator('.historical-state').textContent(),/Office/);
 await page.locator('#revision').selectOption('4');await page.locator('#compare').selectOption('3');await page.locator('[data-action="history-mode"][data-mode="diff"]').click();if(await page.locator('[data-action="dismiss-notice"]').count())await action(page,'dismiss-notice').click();await shot(page,variant+'-history-light');
 // Search/filter, unit navigation and context preservation.
 await page.locator('[data-action="view"][data-view="activity"]').click();await page.locator('#filter-actor').selectOption('Bruno');await page.locator('#filter-family').selectOption('phone');assert.equal(await page.locator('.activity-row').count(),2);
 await page.locator('.activity-row').first().click();await shot(page,variant+'-audit-light');
 await action(page,'unit-contact').click();await action(page,'back-activity').click();assert.equal(await page.locator('#filter-actor').inputValue(),'Bruno');
 await page.locator('#filter-search').fill('missing-result');assert.equal(await page.locator('.activity-row').count(),0);await action(page,'clear-filters').click();
 await page.locator('#filter-contact').selectOption('norte');assert.equal(await page.locator('.activity-row').count(),1);await page.locator('#filter-range').selectOption('recent');assert.equal(await page.locator('.activity-row').count(),0);await action(page,'clear-filters').click();
 // Theme persistence and dark evidence.
 await action(page,'theme').click();await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.locator('[data-action="view"][data-view="activity"]').click();await page.locator('.activity-row').nth(2).click();await shot(page,variant+'-dark');await action(page,'theme').click();
 // Assistant summary navigation; filter action; proposal is intentional, adjustable, discardable.
 await action(page,'assistant').click();await action(page,'assistant-week').click();await page.locator('[data-action="assistant-ref"][data-revision="4"]').click();assert.equal(await page.locator('#revision').inputValue(),'4');
 await action(page,'assistant').click();await action(page,'assistant-bruno').click();assert.equal(await page.locator('#filter-actor').inputValue(),'Bruno');
 await action(page,'assistant-stage').click();await action(page,'review-proposal').click();
 if(variant==='relay')await page.locator('[data-action="step"][data-step="1"]').first().click();
 assert.equal(await page.locator('#phone-1-extension').inputValue(),'25');await action(page,'cancel').click();
 await action(page,'assistant').click();await action(page,'assistant-stage').click();await action(page,'review-proposal').click();
 if(variant==='relay')await page.locator('[data-action="step"][data-step="1"]').first().click();
 await page.locator('#phone-1-extension').fill('27');if(variant==='relay')await action(page,'review').click();await action(page,'save').click();await page.getByText('Saved together · Revision 9 · Changed by Mariana',{exact:true}).waitFor();
 // Real second-tab stale-save conflict, original r3 and concurrent r4.
 await reset(page,variant,true);if(variant==='relay')await page.locator('[data-action="task"][data-family="all"]').click();else await action(page,'edit').click();await page.locator('#phone-1-extension').fill('25');
 const bruno=await context.newPage();await bruno.goto(baseURL+'/'+variant);await bruno.locator('#persona').selectOption('Bruno');
 if(variant==='relay')await bruno.locator('[data-action="task"][data-family="all"]').click();else await action(bruno,'edit').click();
 await bruno.locator('#phone-1-extension').fill('44');await bruno.locator('#phone-1-label').fill('Bruno office');if(variant==='relay')await action(bruno,'review').click();await action(bruno,'save').click();await bruno.getByText('Saved together · Revision 4 · Changed by Bruno',{exact:true}).waitFor();
 if(variant==='relay')await action(page,'review').click();await action(page,'save').click();await page.getByText('Another Save arrived first.',{exact:true}).waitFor();
 await page.locator('input[data-choice="phone.1.extension"][value="mine"]').check();await action(page,'reconcile').click();
 assert.equal(await page.locator('#phone-1-extension').inputValue(),'25');assert.equal(await page.locator('#phone-1-label').inputValue(),'Bruno office');
 if(variant==='relay')await action(page,'review').click();await action(page,'save').click();await page.getByText('Saved together · Revision 5 · Changed by Mariana',{exact:true}).waitFor();
 await shot(page,variant+'-reconciled');await bruno.close();
 // Persona constraints and omitted private payload.
 await page.locator('#persona').selectOption('Rafael');
 await page.locator(variant==='relay'?'[data-action="task"][data-family="all"]:disabled':'[data-action="edit"]:disabled').first().waitFor();
 await action(page,'assistant').click();await action(page,'assistant-stage').click();await page.getByText('You have read access. I cannot stage writes for this persona.').waitFor();await page.keyboard.press('Escape');
 await page.locator('#persona').selectOption('Sofía');await page.getByText('lina.torres@example.test',{exact:true}).waitFor({state:'hidden'});await page.locator('[data-action="view"][data-view="history"]').click();await page.getByText('History needs additional access').waitFor();
 await page.locator('#persona').selectOption('Elena');await page.locator('[data-action="view"][data-view="activity"]').click();await page.getByText('Administrator view',{exact:true}).waitFor();
 await page.locator('#persona').selectOption('Mariana');await reset(page,variant);
 // Required reviewable exceptional states and one-reviewer collaboration shortcut.
 await action(page,'demo').click();await page.locator('#simulation').selectOption('loading');await page.getByText('Loading the contact workspace').waitFor();await action(page,'normal').click();
 await page.locator('#simulation').selectOption('denied');await page.getByText('Access isn’t available').waitFor();await action(page,'normal').click();
 await page.locator('#simulation').selectOption('unavailable');await page.getByText('Historical coverage is unavailable').waitFor();await action(page,'normal').click();
 await page.locator('#simulation').selectOption('empty');await page.getByText('No matching changes').waitFor();await action(page,'clear-filters').click();
 await action(page,'scenario').click();await action(page,'bruno').click();if(variant==='relay')await action(page,'review').click();await action(page,'save').click();await page.getByText('Another Save arrived first.').waitFor();await action(page,'cancel').click();
 await action(page,'reset').click();await page.locator('#simulation').selectOption('uncertain');
 if(variant==='relay')await page.locator('[data-action="task"][data-family="all"]').click();else await action(page,'edit').click();await page.locator('#phone-1-extension').fill('28');if(variant==='relay')await action(page,'review').click();await action(page,'save').click();await page.getByText('Save outcome unknown',{exact:true}).waitFor();assert.equal(await action(page,'save').isDisabled(),true);await action(page,'investigate').click();await page.getByRole('heading',{name:'Revision 7 → 8',exact:true}).waitFor();await action(page,'cancel').click();
 await action(page,'reset').click();await action(page,'demo').click();
 // Keyboard focus and small screens. Width check catches accidental page overflow.
 await page.keyboard.press('Control+k');await page.locator('#assistant-question').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#assistant').evaluate(el=>el===document.activeElement),true);
 await page.setViewportSize({width:390,height:844});await shot(page,variant+'-narrow');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),variant+' narrow overflow');
 await page.locator('[data-action="view"][data-view="activity"]').click();await page.locator('.activity-row').first().click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),variant+' narrow audit overflow');await shot(page,variant+'-narrow-audit');
 results.push({variant,status:'passed',journeys:['edit / cancel / combined save','primary order','phone context','historical state / diff / ordered actions','filters / navigation','light / dark persistence','assistant references / filters / staging / adjust / discard','two-tab conflict / explicit reconciliation','persona restrictions','loading / empty / denied / unavailable / uncertain','single-reviewer conflict / reset','keyboard focus / narrow layout']});
 await context.close();
}
await browser.close();
await writeFile(new URL('./evidence/verification.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),results,errors,expectedNetworkDiagnostics},null,2));
assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors},null,2));
