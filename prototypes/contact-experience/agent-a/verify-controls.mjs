import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),root='http://127.0.0.1:4317';
const results=[],errors=[];
const click=(p,a)=>p.locator(`[data-action="${a}"]`).first().click();
for(const v of ['dispatch','ledger','relay']){
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(root+'/'+v);await p.request.post(`${root}/demo/${v}/reset?persona=Mariana`,{data:{}});await p.reload();
 // All contact selectors, role-specific category, nonrelationship copy.
 await p.locator('[data-action="contact"][data-contact="norte"]').click();await p.getByRole('heading',{name:'Norte Taller',exact:true}).waitFor();
 if(v==='relay')await p.locator('.live-preview summary').click();
 assert.match(await p.locator('#main').textContent(),/No employment relationship|No recorded employment|No recorded employment relationship|No employment/);
 await p.locator('[data-action="contact"][data-contact="lina"]').click();
 if(v==='relay')await p.locator('[data-action="task"][data-family="email"]').click();else await click(p,'edit');
 await p.locator('#email-1-value').fill('bad-email');
 if(v==='relay')await click(p,'review');else await click(p,'save');
 await p.locator('.error').waitFor();assert.match(await p.locator('.error').textContent(),/email/);
 await p.locator('#email-1-value').fill('lina.office@example.test');await p.locator('#email-1-label').fill('Work');await p.locator('#email-1-public').selectOption('false');
 await p.locator('[data-action="add"][data-family="email"]').click();await p.locator('#email--1-value').fill('lina.new@example.test');await p.locator('#email--1-label').fill('Alternate');
 await p.locator('[data-action="add"][data-family="phone"]').click();await p.locator('#phone--1-value').fill('+52 777 444 5566');await p.locator('#phone--1-extension').fill('18');
 await p.locator('[data-action="primary"][data-family="phone"][data-ordinal="2"]').click();
 if(v==='relay')await click(p,'review');await click(p,'save');await p.getByText('Saved together · Revision 8 · Changed by Mariana',{exact:true}).waitFor();
 let s=await (await p.request.get(`${root}/demo/${v}/state?persona=Mariana`)).json();const r=s.contacts.lina.revisions.at(-1);
 assert.equal(r.snapshot.email.at(-1).ordinal,4);assert.equal(r.snapshot.phone.at(-1).ordinal,3);assert.equal(r.snapshot.phone.find(x=>x.ordinal===2).order,1);assert.equal(r.snapshot.email[0].public,false);
 // Proposal discard preserves earlier draft. Freeform recognized and unsupported questions.
 if(v==='relay')await p.locator('[data-action="task"][data-family="all"]').click();else await click(p,'edit');
 await p.locator('#profile-name').fill('Lina pending draft');await click(p,'assistant');await p.locator('#assistant-question').fill('Is this customer profitable?');await click(p,'assistant-ask');await p.getByText(/I do not have evidence or tools/).waitFor();
 await p.locator('#assistant-question').fill('Change extension to 25 and make work primary');await click(p,'assistant-ask');
 await p.locator('.assistant-answer [data-action="cancel"]').click();await click(p,'close-assistant');
 assert.equal(await p.locator('#profile-name').inputValue(),'Lina pending draft');assert.equal(await p.locator('#phone-2-extension').inputValue(),'');await click(p,'cancel');
 // Real keyboard flow, disclosures, dark editable fields and errors.
 if(v==='relay')await p.locator('[data-action="task"][data-family="phone"]').click();else await click(p,'edit');
 await p.locator('#phone-1-extension').fill('31');await p.keyboard.press('Control+s');if(v==='relay')await p.keyboard.press('Control+s');await p.getByText('Saved together · Revision 9 · Changed by Mariana',{exact:true}).waitFor();
 await p.locator('[data-action="view"][data-view="activity"]').click();await p.locator('.activity-row').first().click();await p.locator('.technical summary').click();assert.match(await p.locator('.technical').textContent(),/900719925/);await click(p,'close-unit');
 await p.locator('[data-action="view"][data-view="contact"]').click();await click(p,'theme');
 if(v==='relay')await p.locator('[data-action="task"][data-family="all"]').click();else await click(p,'edit');
 await p.locator('#phone-1-value').fill('+52 777');assert.match(await p.locator('#phone-hint-1').textContent(),/international number|ten national digits/);await p.locator('#phone-1-value').fill('312-3456');await p.locator('#area-1').fill('778');assert.match(await p.locator('#phone-hint-1').textContent(),/527783123456/);
 await click(p,'assistant');await click(p,'assistant-week');await p.screenshot({path:new URL(`./evidence/${v}-assistant-dark.png`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});await p.keyboard.press('Escape');
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:new URL(`./evidence/${v}-edit-narrow-dark.png`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 await click(p,'cancel');await click(p,'theme');
 await p.request.post(`${root}/demo/${v}/reset?persona=Mariana`,{data:{}});await context.close();results.push({variant:v,status:'passed',checks:['organization navigation','invalid email validation','email edit / visibility','add email / phone / retained ordinals','phone primary','proposal restores pre-existing draft','freeform supported / unsupported assistant requests','keyboard save','technical disclosure / close','phone error / explicit area input','dark form / assistant / narrow overflow']});
}
await browser.close();assert.deepEqual(errors,[]);await writeFile(new URL('./evidence/control-verification.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
