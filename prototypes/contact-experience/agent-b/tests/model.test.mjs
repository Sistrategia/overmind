import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,clone,diff,save,parsePhone,project,filterUnits,reconcile,VARIANTS} from '../model.js';
test('fixture snapshots and actions agree, including a round trip and retained restored identity',()=>{
  const db=fixture(),r=db.revisions.lina;
  assert.equal(r.length,7);assert.equal(r[2].state.phone[0].extension,'12');
  assert.equal(r[3].state.name,'Lina Torres García');
  assert.deepEqual(diff(r[3].state,r[4].state),[]);
  const round=db.units.find(u=>u.contact==='lina'&&u.revision===5);
  assert.deepEqual(round.actions.map(a=>[a.before,a.after]),[['20','24'],['24','20']]);
  assert.deepEqual(round.actions.map(a=>a.order),[1,2]);
  assert.equal(r[5].state.email.find(x=>x.ordinal===9).deleted,true);
  assert.equal(r[6].state.email.find(x=>x.ordinal===9).deleted,false);
  assert.equal(r[6].state.email.find(x=>x.ordinal===9).order,3);
  assert.equal(r[5].state.email.find(x=>x.ordinal===9).label,'Archive');
  assert.equal(r[6].state.email.find(x=>x.ordinal===9).label,'Backup');
  for(const u of db.units){assert.equal(typeof u.stamp,'string');assert.ok(BigInt(u.stamp)>BigInt(Number.MAX_SAFE_INTEGER));assert.equal(u.actions[0].order,1);}
});
test('combined profile, phone and address Save creates one revision and preserves another contact',()=>{
  const db=fixture(),draft=clone(db.contacts.lina),org=clone(db.contacts.norte),oldAddress=draft.address[0].valueId;
  draft.name='Lina Torres García Castillo';draft.phone[0].extension='25';draft.address[0].value='Río Mayo 120, Oficina 5\nCuernavaca, Morelos, México';
  const result=save(db,{persona:'Mariana',contact:'lina',expectedEntityVersion:7,draft});
  assert.equal(result.status,200);assert.equal(result.revision,8);assert.equal(db.revisions.lina.length,8);
  assert.equal(db.units.at(-1).actions.length,3);assert.notEqual(db.contacts.lina.address[0].valueId,oldAddress);
  assert.equal(db.contacts.lina.address[0].ordinal,1);assert.deepEqual(db.contacts.norte,org);
  assert.equal(db.revisions.lina[6].state.phone[0].extension,'20');
});
test('two stale editors cannot overwrite; reconciliation preserves unrelated latest changes',()=>{
  const db=fixture(true),base=clone(db.contacts.lina),mine=clone(base),bruno=clone(base);
  mine.phone[0].extension='25';bruno.phone[0].extension='18';bruno.phone[0].label='Direct line';
  const b=save(db,{persona:'Bruno',contact:'lina',expectedEntityVersion:3,draft:bruno});assert.equal(b.revision,4);
  const m=save(db,{persona:'Mariana',contact:'lina',expectedEntityVersion:3,draft:mine});assert.equal(m.status,409);assert.equal(m.latest.revision,4);
  assert.equal(mine.phone[0].extension,'25');assert.equal(db.contacts.lina.phone[0].extension,'18');
  const merged=reconcile(base,mine,m.latest,{'phone.1.extension':'mine'});
  assert.equal(merged.phone[0].extension,'25');assert.equal(merged.phone[0].label,'Direct line');
  const saved=save(db,{persona:'Mariana',contact:'lina',expectedEntityVersion:4,draft:merged});assert.equal(saved.revision,5);
  assert.equal(db.revisions.lina[3].state.phone[0].extension,'18');
});
test('keeping latest in reconciliation does not replay a conflicting field',()=>{
  const db=fixture(true),base=clone(db.contacts.lina),mine=clone(base),latest=clone(base);
  mine.phone[0].extension='25';mine.name='Lina Torres García';latest.phone[0].extension='18';
  const result=reconcile(base,mine,latest,{'phone.1.extension':'latest','profile.name':'mine'});
  assert.equal(result.phone[0].extension,'18');assert.equal(result.name,'Lina Torres García');
});
test('phone parser interprets explicitly scoped Mexican numbers and rejects ambiguity',()=>{
  for(const raw of ['+52 777 312 3456','7773123456','312 3456'])assert.equal(parsePhone(raw,'MX','777').number,'+527773123456');
  assert.throws(()=>parsePhone('312 3456','US','777'));
  assert.throws(()=>parsePhone('312 3456','MX',''));
  assert.throws(()=>parsePhone('invalid'));
});
test('validation rejects the entire draft without changing state or history',()=>{
  const db=fixture(),old=clone(db),draft=clone(db.contacts.lina);
  draft.name='Changed';draft.email[0].value='broken';
  const result=save(db,{persona:'Mariana',contact:'lina',expectedEntityVersion:7,draft});
  assert.equal(result.status,400);assert.deepEqual(db,old);
});
test('no-op Save retains revision and has no audit stamp',()=>{
  const db=fixture();const result=save(db,{persona:'Mariana',contact:'lina',expectedEntityVersion:7,draft:clone(db.contacts.lina)});
  assert.equal(result.status,200);assert.equal(result.revision,7);assert.equal(result.stamp,null);assert.equal(db.revisions.lina.length,7);
});
test('edits and moves preserve ordinal; inserted child receives a fresh retained ordinal',()=>{
  const db=fixture(),draft=clone(db.contacts.lina);
  draft.email[0].order=1;draft.email[1].order=2;draft.email[1].value='lina.work@example.test';
  draft.email.push({ordinal:-1,order:4,value:'new@example.test',label:'Other',public:false});
  const result=save(db,{persona:'Mariana',contact:'lina',expectedEntityVersion:7,draft});
  assert.equal(result.status,200);assert.equal(db.contacts.lina.email[1].ordinal,7);assert.equal(db.contacts.lina.email[1].order,2);
  assert.equal(db.contacts.lina.email[3].ordinal,10);assert.equal(result.identities[0].ordinal,10);
});
test('read-only roles cannot write; public projection omits private channels and all evidence',()=>{
  const db=fixture(),initial=clone(db);
  for(const persona of ['Rafael','Directory viewer'])assert.equal(save(db,{persona,contact:'lina',expectedEntityVersion:7,draft:clone(db.contacts.lina)}).status,403);
  assert.deepEqual(db,initial);
  const publicData=project(db,'Directory viewer');
  assert.equal(publicData.units.length,0);assert.equal(publicData.revisions.lina.length,0);
  assert.equal(publicData.contacts.lina.email.length,1);assert.equal(publicData.contacts.lina.email[0].ordinal,7);
  assert.ok(!JSON.stringify(publicData).includes('lina.torres@example.test'));
  assert.equal(project(db,'Rafael').revisions.lina.length,7);
});
test('public directory never promotes a hidden principal',()=>{
  const db=fixture(true);db.contacts.lina.email[0].order=1;db.contacts.lina.email[1].order=2;
  const c=project(db,'Directory viewer').contacts.lina;
  assert.equal(c.email[0].order,2);
});
test('activity filters compose actor, contact, family, time range and ordinary text',()=>{
  const db=fixture();const result=filterUnits(db,{actor:'Bruno',contact:'lina',family:'phone',range:'week'});
  assert.deepEqual(result.map(u=>u.revision),[4,2]);
  assert.equal(filterUnits(db,{search:'Direct line'}).length,0);
  assert.equal(filterUnits(db,{range:'today'}).length,1);
  assert.equal(filterUnits(db,{search:'Norte Taller',contact:'norte'}).length,1);
});
test('variant stores are independent; reset restores a coherent full or revision-3 story',()=>{
  const stores=Object.fromEntries(VARIANTS.map(v=>[v,fixture()]));
  const draft=clone(stores.relay.contacts.lina);draft.name='New name';
  save(stores.relay,{persona:'Mariana',contact:'lina',expectedEntityVersion:7,draft});
  assert.equal(stores.atelier.contacts.lina.revision,7);assert.equal(stores.trace.contacts.lina.revision,7);
  stores.relay=fixture(true);assert.equal(stores.relay.contacts.lina.revision,3);assert.equal(stores.relay.units.length,4);
  stores.relay=fixture();assert.equal(stores.relay.contacts.lina.revision,7);assert.equal(stores.relay.units.length,8);
});
