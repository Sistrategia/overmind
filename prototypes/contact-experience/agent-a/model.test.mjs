import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSeed,current,clone,diff,commandsFrom,save,parsePhone,project} from './model.mjs';
function request(s,draft,persona='Mariana'){const r=current(s,'lina');return {id:'lina',epoch:s.epoch,expectedEntityVersion:r.revision,commands:commandsFrom(r.snapshot,draft),persona};}
test('historical states, labels, deletion/restoration and reversible actions stay coherent',()=>{
 const s=makeSeed(),rs=s.contacts.lina.revisions;
 assert.equal(rs.length,7);assert.equal(rs[1].snapshot.phone[0].value,'+527773123456');assert.equal(rs[2].snapshot.phone[0].label,'Office');assert.equal(rs[3].snapshot.phone[0].label,'Work');
 assert.deepEqual(diff(rs[3].snapshot,rs[4].snapshot),[]);
 const actions=s.units.find(u=>u.revision===5&&u.contact==='lina').actions;
 assert.equal(actions.length,2);assert.equal(actions[0].changes[0].after,'99');assert.equal(actions[1].changes[0].after,'21');
 assert.equal(rs[5].snapshot.email[2].deleted,true);assert.equal(rs[6].snapshot.email[2].ordinal,3);assert.equal(rs[6].snapshot.email[2].order,3);assert.equal(rs[6].snapshot.email[2].deleted,false);
});
test('combined Save has one revision, stable children, independent address replacement',()=>{
 const s=makeSeed(),r=current(s,'lina'),d=clone(r.snapshot),org=clone(current(s,'norte'));
 d.profile.name='Lina Torres Castillo';d.phone[0].extension='25';d.address[0].value='Calle Reforma 12\nCuernavaca, Morelos\nMéxico';
 const result=save(s,request(s,d));assert.equal(result.revision,8);assert.equal(current(s,'lina').snapshot.phone[0].ordinal,1);assert.deepEqual(current(s,'norte'),org);assert.equal(s.units.at(-1).actions.length,3);assert.equal(typeof result.stamp,'string');assert.ok(BigInt(result.stamp)>BigInt(Number.MAX_SAFE_INTEGER));
});
test('primary selection moves position without changing child identity',()=>{
 const s=makeSeed(),d=clone(current(s,'lina').snapshot);d.email[0].order=1;d.email[1].order=2;
 save(s,request(s,d));assert.equal(current(s,'lina').snapshot.email[0].ordinal,1);assert.equal(current(s,'lina').snapshot.email[0].order,1);assert.equal(current(s,'lina').snapshot.email[1].order,2);
});
test('stale token preserves committed Bruno state and client draft',()=>{
 const s=makeSeed(true),r=current(s,'lina'),mine=clone(r.snapshot),bruno=clone(r.snapshot);mine.phone[0].extension='25';bruno.phone[0].extension='44';
 const pending=request(s,mine);assert.equal(save(s,request(s,bruno,'Bruno')).revision,4);
 const result=save(s,pending);assert.equal(result.status,409);assert.equal(result.latest.snapshot.phone[0].extension,'44');assert.equal(mine.phone[0].extension,'25');assert.equal(current(s,'lina').revision,4);
});
test('invalid late command leaves state and history unchanged',()=>{
 const s=makeSeed(),before=clone(s),d=clone(current(s,'lina').snapshot);d.profile.name='A valid change';d.email[0].value='invalid';
 assert.equal(save(s,request(s,d)).status,400);assert.deepEqual(s,before);
});
test('uncertain result never returns a provisional stamp or a success receipt',()=>{
 const s=makeSeed(),d=clone(current(s,'lina').snapshot);d.phone[0].extension='25';const result=save(s,{...request(s,d),uncertain:true});
 assert.equal(result.code,'commit_uncertain');assert.equal(result.stamp,undefined);assert.equal(result.revision,undefined);assert.equal(current(s,'lina').revision,8);
});
test('auditor writes reject, directory payload omits private state and historical evidence',()=>{
 const s=makeSeed(),d=clone(current(s,'lina').snapshot);d.profile.name='Forbidden';assert.equal(save(s,request(s,d,'Rafael')).status,403);
 const p=project(s,'Sofía');assert.equal(p.units.length,0);assert.equal(p.contacts.lina.revisions.length,1);assert.equal(p.contacts.lina.revisions[0].snapshot.email.length,1);assert.equal(p.contacts.lina.revisions[0].snapshot.email[0].order,2);assert.equal(p.contacts.lina.revisions[0].snapshot.phone[0].raw,undefined);assert.equal(p.contacts.lina.revisions[0].snapshot.profile.summary,undefined);
});
test('phone context is explicit and local interpretation does not edit an address',()=>{
 assert.equal(parsePhone('+52 777 312 3456').number,'+527773123456');assert.equal(parsePhone('312-3456','MX','777').number,'+527773123456');assert.equal(parsePhone('7773123456','MX').number,'+527773123456');assert.throws(()=>parsePhone('312-3456','US','777'));assert.throws(()=>parsePhone('+52 777'));
});
test('saved local phone retains explicit area context and inconsistent interpretation rejects',()=>{
 const s=makeSeed(),d=clone(current(s,'lina').snapshot);d.phone[0].raw='312-3456';d.phone[0].area='778';d.phone[0].region='MX';d.phone[0].value='+527783123456';
 assert.equal(save(s,request(s,d)).status,200);assert.equal(current(s,'lina').snapshot.phone[0].area,'778');
 const invalid=clone(current(s,'lina').snapshot);invalid.phone[0].area='777';assert.equal(save(s,request(s,invalid)).status,400);
 const publicPhone=project(s,'Sofía').contacts.lina.revisions[0].snapshot.phone[0];assert.equal(publicPhone.area,undefined);assert.equal(publicPhone.region,undefined);
});
test('a reset epoch prevents revision number reuse accepting an obsolete draft',()=>{
 const old=makeSeed(true),d=clone(current(old,'lina').snapshot);d.phone[0].extension='25';assert.equal(save(makeSeed(true),request(old,d)).status,409);
});
test('variant state is isolated and empty effective changes allocate no revision',()=>{
 const a=makeSeed(),b=makeSeed(),d=clone(current(a,'lina').snapshot);d.phone[0].extension='25';save(a,request(a,d));assert.equal(current(b,'lina').revision,7);
 const r=current(b,'lina');const result=save(b,{id:'lina',epoch:b.epoch,persona:'Mariana',expectedEntityVersion:7,commands:[{kind:'profile.replace',profile:clone(r.snapshot.profile)}]});assert.equal(result.revision,7);assert.equal(result.stamp,null);
});
