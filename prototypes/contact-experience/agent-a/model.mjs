import {clone,tenant,personas,families,diff,applyCommands} from './shared.mjs';
export * from './shared.mjs';
const ch = (ordinal,value,label,order,isPublic,extra={}) => ({ordinal,value,label,order,public:isPublic,deleted:false,...extra});
export function makeSeed(atThree = false) {
  const s = {tenant, epoch:crypto.randomUUID(), contacts:{}, units:[], counter:'9007199254741100'};
  const address = 'Calle Morelos 25, Centro\n62000 Cuernavaca, Morelos\nMéxico';
  const initial = { profile:{name:'Lina Torres',summary:'Prefers a call before 14:00. Contact details are independent of account sign-in.'}, email:[ch(1,'lina@vertice.example.test','Work',1,true),ch(2,'lina.torres@example.test','Personal',2,false),ch(3,'lina.projects@example.test','Projects',3,false)], phone:[ch(1,'+527773123465','Office',1,true,{extension:'12',raw:'+52 777 312 3465'}),ch(2,'+525555001234','Mobile',2,false,{extension:'',raw:'+52 55 5500 1234'})], address:[ch(1,address,'Mailing',1,true,{valueId:'address:'+address})] };
  s.contacts.lina = {id:'lina', publicKey:'151d1ea9-a0a0-4000-8000-000000000001', category:'Person', revisions:[]};
  s.contacts.norte = {id:'norte', publicKey:'151d1ea9-a0a0-4000-8000-000000000002', category:'Organization', revisions:[]};
  function seedRevision(id,snapshot,actor,time,title,actions) { append(s,id,snapshot,actor,time,title,actions); }
  seedRevision('lina', initial, 'Mariana','2026-09-01T15:10:00Z','Contact created',[{order:1,kind:'profile.create',changes:diff(null,initial)}]);
  const commit = (commands,actor,time,title) => { const r=applyCommands(current(s,'lina').snapshot,commands); seedRevision('lina',r.snapshot,actor,time,title,r.actions); };
  commit([{kind:'phone.replace',ordinal:1,value:{...initial.phone[0],value:'+527773123456',raw:'+52 777 312 3456'}}],'Bruno','2026-09-02T17:35:00Z','Corrected the office phone');
  commit([{kind:'email.move',ordinal:2,displayOrder:1}],'Mariana','2026-09-03T16:20:00Z','Made personal email primary');
  if (!atThree) {
    const r3 = current(s,'lina').snapshot;
    commit([{kind:'profile.replace',profile:{...r3.profile,name:'Lina Torres Mejía'}},{kind:'phone.replace',ordinal:1,value:{...r3.phone[0],extension:'21',label:'Work'}},{kind:'address.replace',ordinal:1,value:{...r3.address[0],value:address.replace('Morelos 25','Morelos 25, Interior B')}}],'Bruno','2026-09-04T19:40:00Z','Name, phone and mailing address saved together');
    const phone = current(s,'lina').snapshot.phone[0];
    commit([{kind:'phone.replace',ordinal:1,value:{...phone,extension:'99'}},{kind:'phone.replace',ordinal:1,value:{...phone,extension:'21'}}],'Elena','2026-09-05T16:05:00Z','Extension changed, then changed back');
    commit([{kind:'email.delete',ordinal:3}],'Mariana','2026-09-06T17:15:00Z','Removed the projects email');
    commit([{kind:'email.restore',ordinal:3}],'Mariana','2026-09-07T15:25:00Z','Restored the projects email');
  }
  const org = {profile:{name:'Norte Taller',summary:'Independent organization record. No employment relationship with Lina is recorded.'},email:[ch(1,'hola@norte.example.test','Office',1,true)],phone:[ch(1,'+527773000100','Reception',1,true,{extension:'10',raw:'+52 777 300 0100'})],address:[ch(1,address,'Workshop',1,true,{valueId:'address:'+address})]};
  seedRevision('norte',org,'Elena','2026-09-01T16:00:00Z','Organization created',[{order:1,kind:'profile.create',changes:diff(null,org)}]);
  return s;
}
export function current(s,id) { return s.contacts[id].revisions.at(-1); }
function append(s,id,snapshot,actor,time,title,actions) {
  s.counter = (BigInt(s.counter)+1n).toString();
  const revision = s.contacts[id].revisions.length+1;
  const unitId = `unit-${id}-${revision}-${s.counter.slice(-4)}`;
  const r = {revision,snapshot:clone(snapshot),actor,time,title,unitId};
  s.contacts[id].revisions.push(r);
  s.units.push({id:unitId,stamp:s.counter,contact:id,revision,actor,time,title,actions:clone(actions),source:'Committed business change'});
  return r;
}
export function save(s,{id,expectedEntityVersion,epoch,commands,persona,uncertain=false}) {
  if (!personas[persona]?.edit) return {status:403,code:'forbidden'};
  if (!s.contacts[id]) return {status:404,code:'not_found'};
  if (epoch !== s.epoch || current(s,id).revision !== expectedEntityVersion) return {status:409,code:'conflict',latest:clone(current(s,id))};
  if (!Array.isArray(commands) || commands.length < 1 || commands.length > 256) return {status:400,code:'validation',message:'Stage at least one change (up to 256 commands).'};
  let result;
  try { result = applyCommands(current(s,id).snapshot,commands); } catch (e) {return {status:400,code:'validation',message:e.message};}
  if (!result.actions.length) return {status:200,revision:current(s,id).revision,stamp:null};
  const title = [...new Set(result.actions.map(x=>x.kind.split('.')[0]))].map(x=>x[0].toUpperCase()+x.slice(1)).join(', ') + ' saved together';
  const r = append(s,id,result.snapshot,persona,new Date().toISOString(),title,result.actions);
  if (uncertain) return {status:500,code:'commit_uncertain',message:'The Save outcome is unknown. Investigate current state before deciding what to do.'};
  return {status:200,revision:r.revision,unitId:r.unitId,stamp:s.counter};
}
export function project(s,persona) {
  const p=personas[persona];
  if (!p) throw new Error('Unknown demo persona');
  const out=clone(s);
  if (p.directory) {
    out.units=[];
    for (const c of Object.values(out.contacts)) {
      const r=clone(c.revisions.at(-1));
      r.snapshot.profile={name:r.snapshot.profile.name};
      for (const f of families) r.snapshot[f]=r.snapshot[f].filter(x=>x.public && !x.deleted).map(x=>{delete x.raw;delete x.area;delete x.region; return x;});
      delete r.actor; delete r.time; delete r.unitId; delete r.title;
      c.revisions=[r];
    }
    delete out.counter;
  }
  return out;
}
