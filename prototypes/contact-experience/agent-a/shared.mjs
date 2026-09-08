// Shared, deterministic local adapter. This is not a production API implementation.
export const clone = x => structuredClone(x);
export const tenant = 'Vértice Demo';
export const personas = {
  Mariana: { role: 'Contact editor', edit: true, history: true, activity: true },
  Bruno: { role: 'Contact editor', edit: true, history: true, activity: true },
  Elena: { role: 'Administrator', edit: true, history: true, activity: true, admin: true },
  Rafael: { role: 'Read-only auditor', history: true, activity: true },
  Sofía: { role: 'Directory reader', directory: true }
};
export const families = ['email', 'phone', 'address'];
export function parsePhone(number, region = 'MX', area = '777') {
  const raw = number;
  if (!/^[+\d\s()-]+$/.test(number)) throw new Error('Use digits, spaces, parentheses or a leading +. Keep extension separate.');
  const digits = number.replace(/\D/g, '');
  let normalized;
  if (number.startsWith('+')) {
    if (!/^\+[1-9][\d\s()-]+$/.test(number) || digits.length < 8 || digits.length > 15) throw new Error('Enter a full international number (8–15 digits).');
    normalized = '+' + digits;
    if (normalized.startsWith('+52') && digits.length !== 12) throw new Error('Mexican numbers need +52 and ten national digits.');
  } else {
    if (region !== 'MX') throw new Error('This local parser supports explicit Mexico context only.');
    const national = digits.length === 10 ? digits : area + digits;
    if (!/^\d{10}$/.test(national)) throw new Error('Use ten Mexican national digits, or a local number with its area code.');
    normalized = '+52' + national;
  }
  return { number: normalized, raw, region: normalized.startsWith('+52') ? 'MX' : 'International' };
}
export function flatten(s) {
  const out = { 'profile.name': s.profile.name, 'profile.summary': s.profile.summary };
  for (const f of families) for (const c of s[f]) {
    for (const [k,v] of Object.entries(c)) if (k !== 'ordinal' && k !== 'valueId') out[`${f}.${c.ordinal}.${k}`] = v;
  }
  return out;
}
export function fieldName(path) {
  const [f,id,k] = path.split('.');
  if (f === 'profile') return id === 'name' ? 'Full name' : 'Notes';
  const names = { value: f === 'address' ? 'mailing address' : 'number / address', label: 'label', extension: 'extension', order: 'saved position', public: 'directory visibility', deleted: 'deleted', raw: 'entered number' };
  return `${f[0].toUpperCase()+f.slice(1)} ${id} · ${names[k] || k}`;
}
export function diff(a, b) {
  const x = a ? flatten(a) : {}, y = b ? flatten(b) : {};
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(k => JSON.stringify(x[k]) !== JSON.stringify(y[k])).map(path => ({ path, before: x[path] ?? null, after: y[path] ?? null }));
}
export function setPath(s, path, value) {
  const [f,id,k] = path.split('.');
  if (f === 'profile') s.profile[id] = value;
  else { const c = s[f].find(x => x.ordinal === Number(id)); if (c) c[k] = value; }
}
export function validate(s) {
  if (!s.profile.name.trim() || s.profile.name.length > 256) throw new Error('Enter a full name of 1–256 characters.');
  for (const f of families) for (const c of s[f].filter(x => !x.deleted)) {
    if (c.label.length > 100) throw new Error('Labels can contain up to 100 characters.');
    if (f === 'email' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value) || c.value.length > 256)) throw new Error('Enter an email like lina@example.test (up to 256 characters).');
    if (f === 'phone') { const parsed=parsePhone(c.raw || c.value,c.region||'MX',c.area||'777'); if(parsed.number!==c.value)throw new Error('The phone interpretation does not match the entered country and area context.'); if (c.extension.length > 25) throw new Error('Extensions can contain up to 25 characters.'); }
    if (f === 'address' && (!c.value.trim() || c.value.length > 1000)) throw new Error('Enter a mailing address (up to 1,000 characters in this demo).');
  }
}
export function commandsFrom(base, draft) {
  const cmds = [];
  if (JSON.stringify(base.profile) !== JSON.stringify(draft.profile)) cmds.push({kind:'profile.replace', profile:clone(draft.profile)});
  for (const f of families) {
    for (const c of draft[f]) {
      const old = base[f].find(x => x.ordinal === c.ordinal);
      if (!old) { cmds.push({kind:`${f}.insert`, value:clone(c)}); continue; }
      const withoutOrder = x => { const y = clone(x); delete y.order; delete y.valueId; return y; };
      if (JSON.stringify(withoutOrder(old)) !== JSON.stringify(withoutOrder(c))) cmds.push({kind:`${f}.replace`, ordinal:c.ordinal, value:clone(c)});
    }
    // Sequential moves reproduce desired dense order; identity remains the ordinal.
    let order = base[f].filter(x=>!x.deleted).sort((a,b)=>a.order-b.order).map(x=>x.ordinal);
    for (const [i,c] of draft[f].filter(x=>!x.deleted && x.ordinal>0).sort((a,b)=>a.order-b.order).entries()) {
      const at = order.indexOf(c.ordinal);
      if (at >= 0 && at !== i) { cmds.push({kind:`${f}.move`, ordinal:c.ordinal, displayOrder:i+1}); order.splice(at,1); order.splice(i,0,c.ordinal); }
    }
  }
  return cmds;
}
export function applyCommands(snapshot, commands) {
  const s = clone(snapshot), actions = [];
  for (const command of commands) {
    const before = clone(s), [f, op] = command.kind.split('.');
    if (f === 'profile' && op === 'replace') s.profile = clone(command.profile);
    else if (families.includes(f)) {
      if (op === 'insert') {
        const ordinal = Math.max(0,...s[f].map(x=>x.ordinal)) + 1;
        s[f].push({...clone(command.value), ordinal, order:s[f].filter(x=>!x.deleted).length+1, deleted:false});
      } else {
        const c = s[f].find(x=>x.ordinal === command.ordinal);
        if (!c) throw new Error('This channel is no longer available.');
        if (op === 'replace') Object.assign(c,clone(command.value),{ordinal:c.ordinal, order:c.order});
        else if (op === 'move') {
          const live = s[f].filter(x=>!x.deleted).sort((a,b)=>a.order-b.order);
          const at = live.indexOf(c); live.splice(at,1); live.splice(command.displayOrder-1,0,c); live.forEach((x,i)=>x.order=i+1);
        } else if (op === 'delete') { c.deleted = true; c.order = 0; }
        else if (op === 'restore') { Object.assign(c,command.value || {}); c.deleted = false; c.order=s[f].filter(x=>!x.deleted && x!==c).length+1; }
        else throw new Error('Unsupported local command.');
        s[f].filter(x=>!x.deleted).sort((a,b)=>a.order-b.order).forEach((x,i)=>x.order=i+1);
      }
      if (f === 'address') for (const c of s.address) c.valueId = 'address:' + c.value;
    } else throw new Error('Unsupported local command.');
    const changes = diff(before,s);
    if (changes.length) actions.push({order:actions.length+1, kind:command.kind, changes});
  }
  validate(s);
  return {snapshot:s, actions};
}
