// Console command grammar. Typed commands and typed sentences share one input: anything
// that is not a recognised command goes to the sidekick.
import { fieldsOf, type ChildFields } from '../../core/draft';
import { liveChildren } from '../../core/engine';
import type { ContactState, Family, PhoneChild } from '../../core/model';
import { FAMILY_LABEL } from '../../core/model';
import { PERSONAS } from '../../core/personas';

export type ParsedCommand =
  | { kind: 'nav'; target: 'contact' | 'history' | 'activity' | 'gallery' | 'back'; slug?: string; rev?: number; compare?: number; unit?: string }
  | { kind: 'filter'; patch: Record<string, string> }
  | { kind: 'stage'; op: 'replace' | 'insert' | 'delete' | 'restore' | 'move' | 'profile'; family?: Family; ordinal?: number; fields?: ChildFields; displayOrder?: number; profilePatch?: Record<string, string | null>; description: string }
  | { kind: 'edit'; family: Family; ordinal: number | null }
  | { kind: 'stack'; op: 'save' | 'discard' | 'undo' | 'drop' | 'reconcile'; index?: number }
  | { kind: 'meta'; op: 'persona' | 'theme' | 'reset' | 'help' | 'sidekick'; value?: string }
  | { kind: 'ask'; text: string }
  | { kind: 'error'; message: string };

const FAMILY_ALIASES: Record<string, Family> = { email: 'email', mail: 'email', phone: 'phone', tel: 'phone', link: 'web_link', web_link: 'web_link', weblink: 'web_link', url: 'web_link', address: 'address', addr: 'address' };

function fam(word: string | undefined): Family | null { return word ? FAMILY_ALIASES[word.toLowerCase()] ?? null : null; }
function unquote(s: string): string { return s.trim().replace(/^["']|["']$/g, ''); }

export function parseCommand(raw: string, state: ContactState | null): ParsedCommand {
  const text = raw.trim();
  if (!text) return { kind: 'error', message: 'Type a command or a question.' };
  if (text.startsWith('?')) return { kind: 'ask', text: text.slice(1).trim() };
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const [w0, w1, w2] = words;
  let m: RegExpExecArray | null;

  // ---- navigation ------------------------------------------------------------------
  if (w0 === 'open' || w0 === 'contact' || w0 === 'go') {
    if (!w1 || w1 === 'contact') return { kind: 'nav', target: 'contact' };
    if (w1 === 'history') return { kind: 'nav', target: 'history' };
    if (w1 === 'activity' || w1 === 'audit') return { kind: 'nav', target: 'activity' };
    if (w1 === 'gallery') return { kind: 'nav', target: 'gallery' };
    return { kind: 'nav', target: 'contact', slug: w1 === 'norte' ? 'norte-taller' : w1 };
  }
  if (w0 === 'history' || w0 === 'h') return { kind: 'nav', target: 'history', rev: w1 ? Number(w1) : undefined };
  if (w0 === 'activity' || w0 === 'audit' || w0 === 'a') return { kind: 'nav', target: 'activity' };
  if (w0 === 'back') return { kind: 'nav', target: 'back' };
  if ((w0 === 'rev' || w0 === 'revision' || w0 === 'r') && w1) return { kind: 'nav', target: 'history', rev: Number(w1), compare: w2 === 'vs' || w2 === 'compare' ? Number(words[3]) : undefined };
  if ((m = /^(?:compare|cmp|diff)\s+(\d+)\s*(?:\.\.|vs|and|to|,)?\s*(\d+)$/.exec(lower))) { const a = Number(m[1]), b = Number(m[2]); return { kind: 'nav', target: 'history', rev: Math.max(a, b), compare: Math.min(a, b) }; }
  if ((m = /^unit\s+(\S+)$/.exec(lower))) return { kind: 'nav', target: 'activity', unit: m[1] };

  // ---- activity filters -----------------------------------------------------------
  if ((m = /^(actor|family|from|to|q|search|source|contact)\s*[:=]?\s*(.+)$/.exec(lower)) && ['actor', 'family', 'from', 'to', 'q', 'search', 'source'].includes(m[1])) {
    const key = m[1] === 'search' ? 'q' : m[1];
    return { kind: 'filter', patch: { [key]: unquote(m[2] === 'any' || m[2] === 'none' ? '' : m[2]) } };
  }
  if (lower === 'clear' || lower === 'clear filters') return { kind: 'filter', patch: { actor: '', family: '', from: '', to: '', q: '', source: '', contact: '', unit: '' } };

  // ---- stack -----------------------------------------------------------------------
  if (lower === 'save' || lower === 'commit' || lower === 's') return { kind: 'stack', op: 'save' };
  if (lower === 'discard' || lower === 'discard all') return { kind: 'stack', op: 'discard' };
  if (lower === 'undo') return { kind: 'stack', op: 'undo' };
  if ((m = /^drop\s+(\d+)$/.exec(lower))) return { kind: 'stack', op: 'drop', index: Number(m[1]) };
  if (lower === 'reconcile') return { kind: 'stack', op: 'reconcile' };

  // ---- meta ------------------------------------------------------------------------
  if ((m = /^persona\s+(\w+)$/.exec(lower))) return { kind: 'meta', op: 'persona', value: m[1] };
  if ((m = /^theme\s+(light|dark)$/.exec(lower))) return { kind: 'meta', op: 'theme', value: m[1] };
  if (lower === 'reset' || lower === 'reset demo') return { kind: 'meta', op: 'reset' };
  if (lower === 'help' || lower === '?') return { kind: 'meta', op: 'help' };
  if (lower === 'sidekick' || lower === 'ask') return { kind: 'meta', op: 'sidekick' };

  // ---- editing ---------------------------------------------------------------------
  const findChild = (family: Family, ordinal: number) => state ? liveChildren(state, family).find(c => c.ordinal === ordinal) ?? null : null;
  const needState = (): ParsedCommand | null => (state ? null : { kind: 'error', message: 'Open a contact first.' });

  if ((m = /^(edit|form)\s+(\w+)\s*(\d+)?$/.exec(lower))) {
    const f = fam(m[2]); if (!f) return { kind: 'error', message: `Unknown family "${m[2]}". Use email, phone, link or address.` };
    return { kind: 'edit', family: f, ordinal: m[3] ? Number(m[3]) : null };
  }
  if ((m = /^add\s+(\w+)\s+(.+)$/i.exec(text)) || (m = /^add\s+(\w+)$/i.exec(text))) {
    const f = fam(m[1]); if (!f) return { kind: 'error', message: `Unknown family "${m[1]}".` };
    const rest = m[2] ?? '';
    if (f === 'address' || !rest) return { kind: 'edit', family: f, ordinal: null };
    const parts = rest.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
    const value = unquote(parts[0] ?? '');
    let location: string | null = null, extension: string | null = null, isPublic = false;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i].toLowerCase();
      if (p === 'label' && parts[i + 1]) { location = unquote(parts[++i]); }
      else if ((p === 'ext' || p === 'extension') && parts[i + 1]) { extension = unquote(parts[++i]); }
      else if (p === 'public') isPublic = true;
      else if (p === 'private') isPublic = false;
    }
    const fields: ChildFields = f === 'email' ? { value, location, isPublic, extension: null }
      : f === 'phone' ? { value: { number: value }, location, isPublic, extension }
      : { value: { url: value, type: null, displayText: null }, location, isPublic, extension: null };
    return { kind: 'stage', op: 'insert', family: f, fields, description: `add ${FAMILY_LABEL[f].toLowerCase()} ${value}` };
  }
  if ((m = /^(remove|delete|rm)\s+(\w+)\s+(\d+)$/.exec(lower))) {
    const f = fam(m[2]); if (!f) return { kind: 'error', message: `Unknown family "${m[2]}".` };
    const err = needState(); if (err) return err;
    if (!findChild(f, Number(m[3]))) return { kind: 'error', message: `No live ${FAMILY_LABEL[f].toLowerCase()} with identity ${m[3]}.` };
    return { kind: 'stage', op: 'delete', family: f, ordinal: Number(m[3]), description: `remove ${FAMILY_LABEL[f].toLowerCase()} ${m[3]}` };
  }
  if ((m = /^restore\s+(\w+)\s+(\d+)$/.exec(lower))) {
    const f = fam(m[1]); if (!f) return { kind: 'error', message: `Unknown family "${m[1]}".` };
    const err = needState(); if (err) return err;
    const c = state![f === 'email' ? 'emails' : f === 'phone' ? 'phones' : f === 'web_link' ? 'webLinks' : 'addresses'].find(x => x.ordinal === Number(m![2]));
    if (!c || !c.deleted) return { kind: 'error', message: `${FAMILY_LABEL[f]} ${m[2]} is not a removed item.` };
    return { kind: 'stage', op: 'restore', family: f, ordinal: c.ordinal, fields: fieldsOf(c), description: `restore ${FAMILY_LABEL[f].toLowerCase()} ${m[2]}` };
  }
  if ((m = /^(primary|first)\s+(\w+)\s+(\d+)$/.exec(lower))) {
    const f = fam(m[2]); if (!f) return { kind: 'error', message: `Unknown family "${m[2]}".` };
    const err = needState(); if (err) return err;
    if (!findChild(f, Number(m[3]))) return { kind: 'error', message: `No live ${FAMILY_LABEL[f].toLowerCase()} with identity ${m[3]}.` };
    return { kind: 'stage', op: 'move', family: f, ordinal: Number(m[3]), displayOrder: 1, description: `make ${FAMILY_LABEL[f].toLowerCase()} ${m[3]} primary` };
  }
  if ((m = /^move\s+(\w+)\s+(\d+)\s+(?:to\s+(\d+)|(up)|(down))$/.exec(lower))) {
    const f = fam(m[1]); if (!f) return { kind: 'error', message: `Unknown family "${m[1]}".` };
    const err = needState(); if (err) return err;
    const c = findChild(f, Number(m[2])); if (!c) return { kind: 'error', message: `No live ${FAMILY_LABEL[f].toLowerCase()} with identity ${m[2]}.` };
    const live = liveChildren(state!, f).length;
    const target = m[3] ? Number(m[3]) : m[4] ? Math.max(1, (c.displayOrder ?? 1) - 1) : Math.min(live, (c.displayOrder ?? 1) + 1);
    return { kind: 'stage', op: 'move', family: f, ordinal: c.ordinal, displayOrder: target, description: `move ${FAMILY_LABEL[f].toLowerCase()} ${m[2]} to position ${target}` };
  }
  if ((m = /^set\s+(\w+)\s+(\d+)\s+(ext|extension|label|value|public|private|number|url)\s*(.*)$/i.exec(text))) {
    const f = fam(m[1]); if (!f) return { kind: 'error', message: `Unknown family "${m[1]}".` };
    const err = needState(); if (err) return err;
    const c = findChild(f, Number(m[2])); if (!c) return { kind: 'error', message: `No live ${FAMILY_LABEL[f].toLowerCase()} with identity ${m[2]}.` };
    const fields = fieldsOf(c);
    const prop = m[3].toLowerCase(); const val = unquote(m[4] ?? '');
    if (prop === 'ext' || prop === 'extension') { if (f !== 'phone') return { kind: 'error', message: 'Only phones have an extension.' }; fields.extension = val || null; }
    else if (prop === 'label') fields.location = val || null;
    else if (prop === 'public') fields.isPublic = true;
    else if (prop === 'private') fields.isPublic = false;
    else if (prop === 'value' || prop === 'number' || prop === 'url') {
      if (!val) return { kind: 'error', message: 'Give the new value.' };
      if (f === 'email') fields.value = val; else if (f === 'phone') fields.value = { number: val }; else if (f === 'web_link') fields.value = { ...(fields.value as { url: string; type: string | null; displayText: string | null }), url: val }; else return { kind: 'error', message: 'Use "edit address N" for addresses.' };
    }
    const before = c as PhoneChild;
    const desc = prop === 'ext' || prop === 'extension' ? `extension ${before.extension ?? '—'} → ${val || '—'}` : prop === 'label' ? `label ${c.location ?? '—'} → ${val || '—'}` : prop === 'public' || prop === 'private' ? `make ${prop}` : `value → ${val}`;
    return { kind: 'stage', op: 'replace', family: f, ordinal: c.ordinal, fields, description: `${FAMILY_LABEL[f].toLowerCase()} ${c.ordinal}: ${desc}` };
  }
  if ((m = /^set\s+(name|fullname|display|alias|title|summary)\s+(.+)$/i.exec(text))) {
    const err = needState(); if (err) return err;
    const key = { name: 'fullName', fullname: 'fullName', display: 'displayName', alias: 'personAlias', title: 'jobTitle', summary: 'summary' }[m[1].toLowerCase()]!;
    const val = unquote(m[2]);
    return { kind: 'stage', op: 'profile', profilePatch: { [key]: val === '-' || val === 'none' ? null : val }, description: `${key} → ${val}` };
  }
  if (/^(set|add|remove|move|primary|restore|edit)\b/.test(lower)) return { kind: 'error', message: `Could not parse "${text}". Try: set phone 2 ext 25 · primary email 1 · add email x@y.mx label Work · move phone 2 up · edit address 1.` };

  return { kind: 'ask', text };
}

export interface Suggestion { text: string; description: string; group: string; nl?: boolean }

export function suggestCommands(input: string, state: ContactState | null, screen: string): Suggestion[] {
  const q = input.trim().toLowerCase();
  const all: Suggestion[] = [];
  const add = (text: string, description: string, group: string, nl = false) => all.push({ text, description, group, nl });
  if (state) {
    const phones = liveChildren<PhoneChild>(state, 'phone');
    for (const p of phones) add(`set phone ${p.ordinal} ext ${p.extension ? Number(p.extension) + 1 : 100}`, `${p.location ?? 'phone'} ${p.ordinal}: change extension (now ${p.extension ?? '—'})`, 'Edit');
    for (const p of phones) add(`set phone ${p.ordinal} label Oficina`, `${p.location ?? 'phone'} ${p.ordinal}: relabel`, 'Edit');
    for (const e of liveChildren(state, 'email')) if (e.displayOrder !== 1) add(`primary email ${e.ordinal}`, `make ${e.location ?? 'email'} ${e.ordinal} primary`, 'Edit');
    add('add email nombre@ejemplo.mx label Work', 'append an email', 'Edit');
    add('add phone +52 777 000 0000 label Mobile', 'append a phone (international)', 'Edit');
    add('edit address 1', 'open the address form (postal code, colony…)', 'Edit');
    add('set alias "Lina T."', 'profile alias (full profile replace)', 'Edit');
    add('move phone 2 up', 'reorder', 'Edit');
    add('remove email 2', 'remove a child (identity retained)', 'Edit');
  }
  add('save', 'send the command stack as one Save', 'Stack');
  add('undo', 'drop the last staged command', 'Stack');
  add('discard', 'clear the stack', 'Stack');
  add('history', 'revision ladder for this contact', 'Navigate');
  add('rev 4', 'show revision 4 (compared with 3)', 'Navigate');
  add('compare 3 5', 'compare two revisions', 'Navigate');
  add('activity', 'tenant activity (administrator, auditor)', 'Navigate');
  add('open norte-taller', 'switch contact', 'Navigate');
  add('open lina', 'switch contact', 'Navigate');
  if (screen === 'activity') {
    add('actor bruno', 'filter by actor', 'Filter');
    add('family phone', 'filter by action family', 'Filter');
    add('from 2026-09-07', 'filter from a date', 'Filter');
    add('q postal', 'text search', 'Filter');
    add('source operational', 'only simulated operational events', 'Filter');
    add('clear', 'clear filters', 'Filter');
  }
  for (const p of PERSONAS) add(`persona ${p.key}`, `${p.name} — ${p.role}`, 'Session');
  add('theme dark', 'switch theme', 'Session');
  add('help', 'list commands', 'Session');
  add("What changed in Lina's contact this week?", 'ask the sidekick', 'Ask', true);
  add('Change this extension to 25 and make the work email primary', 'ask the sidekick to stage an edit', 'Ask', true);
  add("Show Bruno's phone changes", 'ask the sidekick to filter activity', 'Ask', true);
  if (!q) return all.slice(0, 14);
  const scored = all.map(s => ({ s, score: s.text.toLowerCase().startsWith(q) ? 3 : s.text.toLowerCase().includes(q) ? 2 : s.description.toLowerCase().includes(q) ? 1 : 0 })).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map(x => x.s);
}

export const HELP_LINES = [
  'Navigate: open <slug> · history · rev <n> [vs <m>] · compare <a> <b> · activity · unit <id> · back',
  'Edit (staged, not saved): set <family> <id> ext|label|value|public|private … · primary <family> <id> · move <family> <id> up|down|to <n> · add <family> <value> [label X] [ext N] [public] · remove <family> <id> · restore <family> <id> · edit <family> [id] · set name|display|alias|title "…"',
  'Stack: save · undo · drop <n> · discard · reconcile',
  'Activity filters: actor <who> · family <f> · from <date> · to <date> · q <text> · source audit|operational · clear',
  'Session: persona <key> · theme light|dark · reset · help',
  'Anything else is a question for the sidekick (prefix with ? to force).'
];
