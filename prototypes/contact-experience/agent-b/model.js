// Pure domain model for a fictional, single-tenant local demonstration.
export const TENANT = 'vertice-demo';
export const VARIANTS = ['relay', 'atelier', 'trace'];
export const PERSONAS = {
  Mariana: { role: 'Contact editor', edit: true, history: true, activity: true, private: true },
  Bruno: { role: 'Contact editor', edit: true, history: true, activity: true, private: true },
  Isabel: { role: 'Administrator', edit: true, history: true, activity: true, private: true, admin: true },
  Rafael: { role: 'Read-only auditor', edit: false, history: true, activity: true, private: true, admin: true },
  'Directory viewer': { role: 'Public channels only', edit: false, history: false, activity: false, private: false }
};
export const clone = value => structuredClone(value);
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function parsePhone(raw, region='MX', area='777') {
  const clean = String(raw).replace(/[\s().-]/g,'');
  if (/^\+[1-9]\d{7,14}$/.test(clean)) return { number: clean, input: raw, source: 'International input' };
  if (/^\d{10}$/.test(clean) && region==='MX') return { number: '+52'+clean, input: raw, source: 'Mexico · +52' };
  if (/^\d{7}$/.test(clean) && region==='MX' && /^\d{3}$/.test(area)) return { number: '+52'+area+clean, input: raw, source: `Mexico · area ${area}` };
  throw new Error('Enter an international number, or a 10-digit Mexican number. For 7 digits, provide a 3-digit area code.');
}
export function prettyPhone(number) {
  return /^\+52\d{10}$/.test(number) ? number.replace(/^(\+52)(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4') : number;
}
export function flatten(state) {
  const fields = { 'profile.name': state.name };
  for (const family of ['email','phone','address']) for (const item of state[family]) {
    const prefix = `${family}.${item.ordinal}`;
    fields[prefix+'.value'] = item.value;
    fields[prefix+'.label'] = item.label;
    fields[prefix+'.visibility'] = item.public ? 'Public' : 'Private';
    fields[prefix+'.order'] = item.deleted ? 'Removed' : String(item.order);
    if (family==='phone') fields[prefix+'.extension'] = item.extension || 'None';
  }
  return fields;
}
export function fieldLabel(key) {
  const parts=key.split('.');
  if(key==='profile.name') return 'Full name';
  const last=parts.at(-1);
  const labels={email:'Email',phone:'Phone',address:'Address'};
  return `${labels[parts[0]] || parts[0]} ${parts[1]} · ${{value:'value',label:'label',visibility:'visibility',order:'saved position',extension:'extension'}[last]||last}`;
}
export function diff(a,b) {
  const left=flatten(a),right=flatten(b);
  return [...new Set([...Object.keys(left),...Object.keys(right)])].filter(key=>left[key]!==right[key]).map(key=>({key,family:key.split('.')[0],label:fieldLabel(key),before:left[key]??'Not present',after:right[key]??'Not present'}));
}
function action(family,kind,field,before,after,ordinal=1) { return { family,kind,field,before,after,ordinal }; }
const address1='Río Mayo 120, Col. Vista Hermosa\n62290 Cuernavaca, Morelos, México';
const address2='Río Mayo 120, Oficina 4, Col. Vista Hermosa\n62290 Cuernavaca, Morelos, México';
export function fixture(conflict=false) {
  const contact={id:'lina',category:'Person',name:'Lina Torres',email:[
    {ordinal:1,value:'lina.torres@example.test',label:'Personal',public:false,order:1},
    {ordinal:7,value:'lina@nortetaller.example',label:'Work',public:true,order:2},
    {ordinal:9,value:'ltorres@archivo.example',label:'Archive',public:false,order:3}
  ],phone:[
    {ordinal:1,value:'+527773123465',label:'Office',extension:'12',public:true,order:1},
    {ordinal:3,value:'+525555108822',label:'Mobile',extension:'',public:false,order:2}
  ],address:[{ordinal:1,value:address1,valueId:'address-100',label:'Mailing',public:true,order:1}]};
  const db={tenant:TENANT,generation:crypto.randomUUID(),clock:0,contacts:{},revisions:{lina:[],norte:[]},units:[]};
  function seed(id,state,actor,time,title,actions) {
    const rev=db.revisions[id].length+1;
    const unit={id:`unit-${id}-${rev}`,stamp:(9007199254741000n+BigInt(db.clock++)).toString(),actor,time,title,contact:id,revision:rev,source:'business',actions:actions.map((a,i)=>({...a,order:i+1}))};
    const saved={...clone(state),revision:rev};
    db.revisions[id].push({revision:rev,state:saved,unitId:unit.id}); db.contacts[id]=saved; db.units.push(unit);
  }
  seed('lina',contact,'Mariana','2026-09-01T15:10:00Z','Lina’s contact created',[
    action('profile','insert','Full name','Not present','Lina Torres'),
    ...contact.email.map(x=>action('email','insert',`Email ${x.ordinal}`, 'Not present',x.value,x.ordinal)),
    ...contact.phone.map(x=>action('phone','insert',`Phone ${x.ordinal}`,'Not present',prettyPhone(x.value),x.ordinal)),
    action('address','insert','Mailing address','Not present',address1)
  ]);
  contact.phone[0].value='+527773123456';
  seed('lina',contact,'Bruno','2026-09-02T17:24:00Z','Corrected the office phone',[
    action('phone','replace','Phone 1 · value','+52 777 312 3465','+52 777 312 3456')
  ]);
  contact.email[0].order=2;contact.email[1].order=1;
  seed('lina',contact,'Mariana','2026-09-03T16:45:00Z','Made the work email primary',[
    action('email','move','Email 7 · saved position','2','1',7)
  ]);
  if (!conflict) {
    contact.name='Lina Torres';contact.phone[0].extension='20';contact.phone[0].label='Studio';
    contact.address[0].value=address2;contact.address[0].valueId='address-101';
    seed('lina',contact,'Bruno','2026-09-04T18:08:00Z','Updated name, phone & mailing address',[
      // A meaningful profile edit must survive: the current display name remains recognizable.
      action('profile','replace','Full name','Lina Torres','Lina Torres García'),
      action('phone','replace','Phone 1 · extension','12','20'),
      action('phone','replace','Phone 1 · label','Office','Studio'),
      action('address','replace','Mailing address',address1,address2)
    ]);
    db.contacts.lina.name='Lina Torres García'; db.revisions.lina.at(-1).state.name='Lina Torres García'; contact.name='Lina Torres García';
    seed('lina',contact,'Mariana','2026-09-05T16:32:00Z','Reviewed extension, then kept 20',[
      action('phone','replace','Phone 1 · extension','20','24'),action('phone','replace','Phone 1 · extension','24','20')
    ]);
    contact.email[2].deleted=true;
    seed('lina',contact,'Mariana','2026-09-06T15:15:00Z','Removed the archive email',[
      action('email','delete','Email 9 · status','Active','Removed',9)
    ]);
    contact.email[2].deleted=false;contact.email[2].order=3;contact.email[2].label='Backup';
    seed('lina',contact,'Bruno','2026-09-07T16:42:00Z','Restored the email as a backup',[
      action('email','restore','Email 9 · status','Removed','Active · appended at position 3',9),
      action('email','replace','Email 9 · label','Archive','Backup',9)
    ]);
  }
  const org={id:'norte',category:'Organization',name:'Norte Taller',email:[{ordinal:1,value:'hola@nortetaller.example',label:'General',public:true,order:1}],phone:[{ordinal:1,value:'+527773104020',label:'Reception',extension:'10',public:true,order:1}],address:[{ordinal:1,value:address1,valueId:'address-100',label:'Mailing',public:true,order:1}]};
  seed('norte',org,'Isabel','2026-09-01T16:00:00Z','Norte Taller’s contact created',[
    action('profile','insert','Full name','Not present','Norte Taller'),action('email','insert','Email 1','Not present',org.email[0].value),action('phone','insert','Phone 1','Not present',prettyPhone(org.phone[0].value)),action('address','insert','Mailing address','Not present',address1)
  ]);
  return db;
}
export function project(db,persona) {
  const permission=PERSONAS[persona];
  if (!permission) throw new Error('Unknown demo persona');
  const output=clone(db);
  if (!permission.private) {
    for (const contact of Object.values(output.contacts)) {
      for (const family of ['email','phone','address']) contact[family]=contact[family].filter(x=>x.public&&!x.deleted).map(x=>{const {valueId,...shown}=x;return shown;});
      if(contact.id==='lina') contact.name='Lina Torres';
    }
    output.revisions={lina:[],norte:[]};output.units=[];
  }
  return output;
}
export function validateDraft(draft) {
  const errors=[];
  if(!draft.name.trim()||draft.name.length>256) errors.push('Full name is required and must be at most 256 characters.');
  for(const item of draft.email.filter(x=>!x.deleted)) {
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.value)||item.value.length>320) errors.push(`Email ${item.ordinal}: enter a complete email address.`);
    if(item.label.length>100) errors.push('Email label must be at most 100 characters.');
  }
  for(const item of draft.phone.filter(x=>!x.deleted)) {
    try{parsePhone(item.value,item.region||'MX',item.area||'777');}catch(e){errors.push(e.message);}
    if(item.extension.length>10||!/^[\d\s]*$/.test(item.extension)) errors.push('Extension must contain at most 10 digits or spaces.');
    if(item.label.length>100) errors.push('Phone label must be at most 100 characters.');
  }
  for(const item of draft.address.filter(x=>!x.deleted)) if(!item.value.trim()||item.value.length>1000) errors.push('Mailing address is required and must be at most 1,000 characters.');
  return errors;
}
export function save(db,{persona,contact,expectedEntityVersion,draft}) {
  if(!PERSONAS[persona]?.edit) return {status:403,code:'forbidden'};
  const current=db.contacts[contact];
  if(!current) return {status:404,code:'not_found'};
  if(current.revision!==expectedEntityVersion) return {status:409,code:'conflict',latest:clone(current)};
  if(draft.category!==current.category||draft.id!==current.id) return {status:400,code:'validation',errors:['Contact category and identity cannot change.']};
  const errors=validateDraft(draft);if(errors.length) return {status:400,code:'validation',errors};
  const next=clone(draft);
  for(const item of next.phone) { item.value=parsePhone(item.value,item.region||'MX',item.area||'777').number; delete item.region;delete item.area; }
  // The narrow demo supports replacements, appending one child, and moves; it is not a whole-list API.
  for (const family of ['email','phone','address']) {
    if(current[family].some(old=>!next[family].some(item=>item.ordinal===old.ordinal))) return {status:400,code:'validation',errors:['Existing child identities must be retained.']};
    if(new Set(next[family].map(x=>x.ordinal)).size!==next[family].length) return {status:400,code:'validation',errors:['Child identities must be unique.']};
    const ordered=next[family].filter(x=>!x.deleted).map(x=>x.order).sort((a,b)=>a-b);
    if(ordered.some((n,i)=>n!==i+1)) return {status:400,code:'validation',errors:['Saved order must be dense.']};
  }
  let differences=diff(current,next);
  if(!differences.length) return {status:200,revision:current.revision,stamp:null,unchanged:true};
  for(const item of next.address) {
    const old=current.address.find(x=>x.ordinal===item.ordinal);
    item.valueId=old?.value===item.value?old.valueId:`address-${crypto.randomUUID()}`;
  }
  const identities=[];
  for(const family of ['email','phone','address']) {
    let max=Math.max(0,...current[family].map(x=>x.ordinal));
    for(const item of next[family]) if(item.ordinal<0) {const temp=item.ordinal;item.ordinal=++max;identities.push({family,temporary:temp,ordinal:item.ordinal});}
  }
  differences=diff(current,next);
  next.revision=current.revision+1;
  const date=new Date(Date.UTC(2026,8,7,18,30)+db.clock*60000).toISOString();
  const unit={id:'unit-'+crypto.randomUUID(),stamp:(9007199254741000n+BigInt(db.clock++)).toString(),actor:persona,time:date,title:`${differences.length} field ${differences.length===1?'change':'changes'} saved together`,contact,revision:next.revision,source:'business',actions:differences.map((d,i)=>({order:i+1,family:d.family,kind:d.before==='Not present'?'insert':d.key.endsWith('.order')?'move':'replace',field:d.label,before:d.before,after:d.after,ordinal:Number(d.key.split('.')[1])||1}))};
  db.contacts[contact]=next;db.revisions[contact].push({revision:next.revision,state:clone(next),unitId:unit.id});db.units.push(unit);
  return {status:200,revision:next.revision,stamp:unit.stamp,unitId:unit.id,identities};
}
export function filterUnits(db,filters={}) {
  return db.units.filter(u=>(!filters.actor||u.actor===filters.actor)&&(!filters.contact||u.contact===filters.contact)&&(!filters.family||u.actions.some(a=>a.family===filters.family))&&(!filters.range||filters.range==='all'||u.time>=(filters.range==='today'?'2026-09-07':'2026-09-01'))&&(!filters.search||`${u.title} ${u.actor} ${db.contacts[u.contact].name} ${u.actions.map(a=>`${a.field} ${a.before} ${a.after}`).join(' ')}`.toLowerCase().includes(filters.search.toLowerCase()))).sort((a,b)=>b.time.localeCompare(a.time));
}
export function reconcile(base,mine,latest,choices={}) {
  const result=clone(latest),changes=diff(base,mine);
  for(const change of changes) {
    if(choices[change.key]==='latest') continue;
    if(change.key==='profile.name') { result.name=mine.name;continue; }
    const [family,ordinal,property]=change.key.split('.');
    const wanted=mine[family].find(x=>x.ordinal===Number(ordinal));
    let item=result[family].find(x=>x.ordinal===Number(ordinal));
    if(!item){ result[family].push(clone(wanted));continue; }
    const prop=property==='visibility'?'public':property;
    item[prop]=wanted[prop];
  }
  return result;
}
