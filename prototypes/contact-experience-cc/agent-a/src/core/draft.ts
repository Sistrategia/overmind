// Local drafts: an ordered list of Save commands staged against a base revision.
// Drafts live in the tab (sessionStorage) and never in shared committed state.
import { addressKey, applyCommand, CommandError, diffStates, findChild, liveChildren, childTitle, type AddressCatalog } from './engine';
import type {
  AddressInput, AuditUnit, Child, ChildCommand, ChildRef, Command, ContactState, Family, PhoneChild, PhoneInput, Profile,
  RevisionDiff, WebLinkValue
} from './model';
import { FAMILY_LABEL, PROFILE_FIELDS, PROFILE_FIELD_LABEL, familyOf, isChildCommand, opOf } from './model';
import { parsePhone } from './phone';

export interface DraftItem { id: string; command: Command; origin: 'user' | 'sidekick'; note: string | null }
export interface Draft { contactKey: string; baseVersion: number; items: DraftItem[]; updatedAt: number }

export interface ChildFields {
  value: string | PhoneInput | AddressInput | WebLinkValue;
  location: string | null;
  isPublic: boolean;
  extension: string | null;
}

let idSeq = 0;
export function newItemId(): string { idSeq += 1; return `d${Date.now().toString(36)}${idSeq.toString(36)}`; }

export function emptyDraft(contactKey: string, baseVersion: number): Draft {
  return { contactKey, baseVersion, items: [], updatedAt: Date.now() };
}
export function draftCommands(d: Draft): Command[] { return d.items.map(i => i.command); }
export function isDraftEmpty(d: Draft | null | undefined): boolean { return !d || d.items.length === 0; }

function touch(d: Draft, items: DraftItem[]): Draft { return { ...d, items, updatedAt: Date.now() }; }

// ---- field helpers -----------------------------------------------------------------

export function fieldsOf(child: Child): ChildFields {
  switch (child.family) {
    case 'email': return { value: child.value, location: child.location, isPublic: child.isPublic, extension: null };
    case 'phone': return { value: { number: child.value.e164 }, location: child.location, isPublic: child.isPublic, extension: child.extension };
    case 'web_link': return { value: { ...child.value }, location: child.location, isPublic: child.isPublic, extension: null };
    case 'address': { const { id: _id, ...rest } = child.value; void _id; return { value: rest, location: child.location, isPublic: child.isPublic, extension: null }; }
  }
}

export function valueEquals(family: Family, a: ChildFields['value'], b: ChildFields['value']): boolean {
  switch (family) {
    case 'email': return a === b;
    case 'phone': {
      const pa = parsePhone(a as PhoneInput), pb = parsePhone(b as PhoneInput);
      return pa.ok && pb.ok ? pa.value.e164 === pb.value.e164 : JSON.stringify(a) === JSON.stringify(b);
    }
    case 'address': return addressKey(a as AddressInput) === addressKey(b as AddressInput);
    case 'web_link': { const x = a as WebLinkValue, y = b as WebLinkValue; return x.url === y.url && (x.type ?? null) === (y.type ?? null) && (x.displayText ?? null) === (y.displayText ?? null); }
  }
}
export function fieldsEqual(family: Family, a: ChildFields, b: ChildFields): boolean {
  return valueEquals(family, a.value, b.value) && (a.location ?? null) === (b.location ?? null) && a.isPublic === b.isPublic
    && (family !== 'phone' || (a.extension ?? null) === (b.extension ?? null));
}

export function commandFor(kind: ChildCommand['kind'], ordinal: number | undefined, fields: ChildFields): ChildCommand {
  const family = familyOf(kind);
  const cmd: ChildCommand = { kind, value: fields.value, location: fields.location, isPublic: fields.isPublic };
  if (ordinal !== undefined) cmd.ordinal = ordinal;
  if (family === 'phone') cmd.extension = fields.extension ?? null;
  return cmd;
}
export function fieldsFromCommand(cmd: ChildCommand): ChildFields {
  return { value: cmd.value as ChildFields['value'], location: cmd.location ?? null, isPublic: cmd.isPublic === true, extension: cmd.extension ?? null };
}

/** The ordinal a pending insert will receive: max existing ordinal (incl. deleted) + insert position. */
export function pendingInsertOrdinal(base: ContactState, d: Draft, itemId: string): number | null {
  const item = d.items.find(i => i.id === itemId);
  if (!item || !isChildCommand(item.command) || opOf(item.command.kind) !== 'insert') return null;
  const family = familyOf(item.command.kind);
  const baseMax = (base[family === 'email' ? 'emails' : family === 'phone' ? 'phones' : family === 'web_link' ? 'webLinks' : 'addresses'] as Child[]).reduce((m, c) => Math.max(m, c.ordinal), 0);
  const inserts = d.items.filter(i => isChildCommand(i.command) && familyOf(i.command.kind) === family && opOf(i.command.kind) === 'insert');
  return baseMax + inserts.findIndex(i => i.id === itemId) + 1;
}
export function insertItemForOrdinal(base: ContactState, d: Draft, ref: ChildRef): DraftItem | undefined {
  return d.items.find(i => pendingInsertOrdinal(base, d, i.id) === ref.ordinal && isChildCommand(i.command) && familyOf(i.command.kind) === ref.family);
}

// ---- staging -------------------------------------------------------------------------

function isChildItem(i: DraftItem, ref: ChildRef, op?: ChildCommand['kind'] extends `${string}.${infer O}` ? O : never): boolean {
  if (!isChildCommand(i.command)) return false;
  return familyOf(i.command.kind) === ref.family && i.command.ordinal === ref.ordinal && (!op || opOf(i.command.kind) === op);
}

export function stageChildReplace(d: Draft, base: ContactState, ref: ChildRef, fields: ChildFields, origin: DraftItem['origin'] = 'user', note: string | null = null): Draft {
  const pendingInsert = insertItemForOrdinal(base, d, ref);
  if (pendingInsert) {
    return touch(d, d.items.map(i => i.id === pendingInsert.id ? { ...i, command: commandFor(`${ref.family}.insert`, undefined, fields), origin, note } : i));
  }
  const baseChild = findChild(base, ref);
  const others = d.items.filter(i => !isChildItem(i, ref, 'replace'));
  if (baseChild && !baseChild.deleted && fieldsEqual(ref.family, fieldsOf(baseChild), fields)) return touch(d, others); // back to base: nothing to stage
  const existing = d.items.find(i => isChildItem(i, ref, 'replace'));
  const item: DraftItem = { id: existing?.id ?? newItemId(), command: commandFor(`${ref.family}.replace`, ref.ordinal, fields), origin, note };
  if (existing) return touch(d, d.items.map(i => i.id === existing.id ? item : i));
  return touch(d, [...d.items, item]);
}

export function stageChildInsert(d: Draft, family: Family, fields: ChildFields, origin: DraftItem['origin'] = 'user', note: string | null = null): Draft {
  return touch(d, [...d.items, { id: newItemId(), command: commandFor(`${family}.insert`, undefined, fields), origin, note }]);
}

export function stageChildDelete(d: Draft, base: ContactState, ref: ChildRef, origin: DraftItem['origin'] = 'user'): Draft {
  const pendingInsert = insertItemForOrdinal(base, d, ref);
  if (pendingInsert) return touch(d, d.items.filter(i => i.id !== pendingInsert.id));
  const kept = d.items.filter(i => !isChildItem(i, ref));
  return touch(d, [...kept, { id: newItemId(), command: { kind: `${ref.family}.delete`, ordinal: ref.ordinal }, origin, note: null }]);
}

export function stageChildRestore(d: Draft, ref: ChildRef, fields: ChildFields, origin: DraftItem['origin'] = 'user'): Draft {
  const kept = d.items.filter(i => !isChildItem(i, ref));
  return touch(d, [...kept, { id: newItemId(), command: commandFor(`${ref.family}.restore`, ref.ordinal, fields), origin, note: null }]);
}

export function stageChildMove(d: Draft, base: ContactState, ref: ChildRef, displayOrder: number, origin: DraftItem['origin'] = 'user', note: string | null = null): Draft {
  const kept = d.items.filter(i => !isChildItem(i, ref, 'move'));
  const baseChild = findChild(base, ref);
  const otherMoves = kept.some(i => isChildCommand(i.command) && familyOf(i.command.kind) === ref.family && opOf(i.command.kind) === 'move');
  if (baseChild && baseChild.displayOrder === displayOrder && !otherMoves) return touch(d, kept);
  return touch(d, [...kept, { id: newItemId(), command: { kind: `${ref.family}.move`, ordinal: ref.ordinal, displayOrder }, origin, note }]);
}

export function stageProfile(d: Draft, base: ContactState, profile: Profile, origin: DraftItem['origin'] = 'user'): Draft {
  const kept = d.items.filter(i => i.command.kind !== 'profile.replace');
  const same = PROFILE_FIELDS.every(f => (base.profile[f] ?? null) === (profile[f] ?? null));
  if (same) return touch(d, kept);
  const existing = d.items.find(i => i.command.kind === 'profile.replace');
  const item: DraftItem = { id: existing?.id ?? newItemId(), command: { kind: 'profile.replace', profile }, origin, note: null };
  // Keep profile.replace at its original position when it already exists.
  if (existing) return touch(d, d.items.map(i => i.id === existing.id ? item : i));
  return touch(d, [item, ...kept]);
}

export function removeItem(d: Draft, id: string): Draft { return touch(d, d.items.filter(i => i.id !== id)); }
export function moveItem(d: Draft, from: number, to: number): Draft {
  const items = [...d.items];
  const [x] = items.splice(from, 1);
  items.splice(to, 0, x);
  return touch(d, items);
}
export function appendItems(d: Draft, items: DraftItem[]): Draft { return touch(d, [...d.items, ...items]); }

// ---- projection ---------------------------------------------------------------------

export interface DraftProblem { itemId: string; index: number; message: string }
export interface Projection {
  state: ContactState;
  problems: DraftProblem[];
  insertedOrdinals: Record<string, number>;
  pending: RevisionDiff;         // base → projected
  touched: Set<string>;          // child keys / 'profile' / 'root' with pending changes
}

export function projectDraft(base: ContactState, d: Draft, catalog: AddressCatalog): Projection {
  const scratch: AddressCatalog = { byKey: { ...catalog.byKey }, nextId: catalog.nextId };
  let state = base;
  const problems: DraftProblem[] = [];
  const insertedOrdinals: Record<string, number> = {};
  const touched = new Set<string>();
  d.items.forEach((item, index) => {
    try {
      const out = applyCommand(state, item.command, { addresses: scratch }, index, index + 1);
      state = out.state;
      if (out.action) {
        const t = out.action.target;
        touched.add(t.family === 'profile' || t.family === 'root' ? t.family : `${t.family}#${t.ordinal}`);
        if (isChildCommand(item.command) && opOf(item.command.kind) === 'insert' && 'ordinal' in t) insertedOrdinals[item.id] = t.ordinal;
      }
    } catch (e) {
      problems.push({ itemId: item.id, index, message: e instanceof CommandError ? e.message : String(e) });
    }
  });
  const pending = diffStates(base, state);
  return { state, problems, insertedOrdinals, pending, touched };
}

export function describeItem(item: DraftItem, base: ContactState): string {
  const c = item.command;
  if (c.kind === 'profile.replace') {
    const changed = PROFILE_FIELDS.filter(f => (base.profile[f] ?? null) !== (c.profile[f] ?? null)).map(f => PROFILE_FIELD_LABEL[f]);
    return `Replace profile${changed.length ? ` (${changed.join(', ')})` : ''}`;
  }
  if (c.kind === 'contact.create') return 'Create contact';
  if (!isChildCommand(c)) return c.kind === 'contact.delete' ? 'Delete contact' : 'Restore contact';
  const family = familyOf(c.kind), op = opOf(c.kind);
  const baseChild = c.ordinal !== undefined ? findChild(base, { family, ordinal: c.ordinal }) : undefined;
  const who = baseChild ? childTitle(baseChild) : `${(c.location ? c.location + ' ' : '')}${FAMILY_LABEL[family].toLowerCase()}`;
  switch (op) {
    case 'insert': return `Add ${who}: ${valueText(family, c.value)}${c.extension ? ` ext. ${c.extension}` : ''}`;
    case 'replace': {
      if (!baseChild) return `Replace ${who}`;
      const before = fieldsOf(baseChild), after = fieldsFromCommand(c);
      const parts: string[] = [];
      if (!valueEquals(family, before.value, after.value)) parts.push(`${valueText(family, before.value)} → ${valueText(family, after.value)}`);
      if ((before.location ?? null) !== (after.location ?? null)) parts.push(`label ${before.location ?? '—'} → ${after.location ?? '—'}`);
      if (before.isPublic !== after.isPublic) parts.push(after.isPublic ? 'make public' : 'make private');
      if (family === 'phone' && (before.extension ?? null) !== (after.extension ?? null)) parts.push(`extension ${before.extension ?? '—'} → ${after.extension ?? '—'}`);
      return `Change ${who}: ${parts.join('; ') || 'no field change'}`;
    }
    case 'delete': return `Remove ${who}`;
    case 'restore': return `Restore ${who}`;
    case 'move': return `Move ${who} to position ${c.displayOrder}${c.displayOrder === 1 ? ' (primary)' : ''}`;
  }
}

export function valueText(family: Family, v: unknown): string {
  if (v === undefined || v === null) return '—';
  switch (family) {
    case 'email': return String(v);
    case 'phone': { const p = parsePhone(v as PhoneInput); return p.ok ? p.value.e164 : (v as PhoneInput).number; }
    case 'web_link': return (v as WebLinkValue).url;
    case 'address': { const a = v as AddressInput; return [a.address1, a.streetName ? `${a.streetName} ${a.extNumber ?? ''}${a.intNumber ? ' ' + a.intNumber : ''}`.trim() : null, a.colony, a.zipCode, a.city, a.state, a.country].filter(Boolean).join(', '); }
  }
}

// ---- reconciliation (three-way, field level) -----------------------------------------

export type ReconcileStatus = 'clean' | 'merged' | 'conflict' | 'superseded' | 'removed-by-them';
export type Resolution = 'keep' | 'mine' | 'theirs' | 'drop';
export interface FieldConflict { field: string; label: string; base: unknown; mine: unknown; theirs: unknown }
export interface ReconcileItem {
  item: DraftItem;
  status: ReconcileStatus;
  targetLabel: string;
  theirSummary: string | null;
  conflicts: FieldConflict[];
  mergedNote: string | null;
  defaultResolution: Resolution;
  /** Command to send if resolution is 'keep' or 'mine' (merged when possible). */
  rebased: Command | null;
}
export interface ReconcileReport {
  baseVersion: number; currentVersion: number; theirUnits: AuditUnit[]; items: ReconcileItem[]; hasConflicts: boolean;
}

const CHILD_FIELDS: { key: keyof ChildFields; label: string }[] = [
  { key: 'value', label: 'Value' }, { key: 'location', label: 'Label' }, { key: 'isPublic', label: 'Visibility' }, { key: 'extension', label: 'Extension' }
];

function fieldEq(family: Family, key: keyof ChildFields, a: ChildFields, b: ChildFields): boolean {
  if (key === 'value') return valueEquals(family, a.value, b.value);
  if (key === 'extension') return family !== 'phone' || (a.extension ?? null) === (b.extension ?? null);
  return (a[key] ?? null) === (b[key] ?? null);
}
function show(family: Family, key: keyof ChildFields, f: ChildFields): unknown {
  if (key === 'value') return valueText(family, f.value);
  if (key === 'isPublic') return f.isPublic ? 'Public' : 'Private';
  return f[key] ?? '—';
}

export function reconcile(d: Draft, base: ContactState, current: ContactState, theirUnits: AuditUnit[]): ReconcileReport {
  const theirActions = theirUnits.flatMap(u => u.actions);
  const theirTouched = new Map<string, string[]>();
  for (const a of theirActions) {
    const k = a.target.family === 'profile' || a.target.family === 'root' ? a.target.family : `${a.target.family}#${a.target.ordinal}`;
    theirTouched.set(k, [...(theirTouched.get(k) ?? []), a.summary]);
  }
  const items: ReconcileItem[] = d.items.map(item => {
    const c = item.command;
    if (c.kind === 'profile.replace') {
      const theirs = theirTouched.get('profile');
      if (!theirs) return { item, status: 'clean', targetLabel: 'Profile', theirSummary: null, conflicts: [], mergedNote: null, defaultResolution: 'keep', rebased: c };
      const conflicts: FieldConflict[] = [];
      const merged: Profile = { ...current.profile };
      const mergedFields: string[] = [];
      for (const f of PROFILE_FIELDS) {
        const b = base.profile[f] ?? null, m = c.profile[f] ?? null, t = current.profile[f] ?? null;
        const mine = m !== b, their = t !== b;
        if (mine && their && m !== t) conflicts.push({ field: f, label: PROFILE_FIELD_LABEL[f], base: b, mine: m, theirs: t });
        if (mine) { (merged as unknown as Record<string, unknown>)[f] = m; if (their && m === t) { /* same change */ } else mergedFields.push(PROFILE_FIELD_LABEL[f]); }
      }
      return { item, status: conflicts.length ? 'conflict' : 'merged', targetLabel: 'Profile', theirSummary: theirs.join('; '), conflicts,
        mergedNote: conflicts.length ? null : `Combined: your ${mergedFields.join(', ') || 'fields'} with their other profile changes.`,
        defaultResolution: conflicts.length ? 'mine' : 'keep', rebased: { kind: 'profile.replace', profile: merged } };
    }
    if (!isChildCommand(c)) return { item, status: 'clean', targetLabel: 'Contact', theirSummary: null, conflicts: [], mergedNote: null, defaultResolution: 'keep', rebased: c };
    const family = familyOf(c.kind), op = opOf(c.kind);
    if (op === 'insert') return { item, status: 'clean', targetLabel: `New ${FAMILY_LABEL[family].toLowerCase()}`, theirSummary: null, conflicts: [], mergedNote: null, defaultResolution: 'keep', rebased: c };
    const ref: ChildRef = { family, ordinal: c.ordinal! };
    const key = `${family}#${ref.ordinal}`;
    const theirs = theirTouched.get(key);
    const baseChild = findChild(base, ref), curChild = findChild(current, ref);
    const label = baseChild ? childTitle(baseChild) : `${FAMILY_LABEL[family]} ${ref.ordinal}`;
    if (!theirs) return { item, status: 'clean', targetLabel: label, theirSummary: null, conflicts: [], mergedNote: null, defaultResolution: 'keep', rebased: c };
    const theirSummary = theirs.join('; ');
    if (op === 'replace') {
      if (!curChild || curChild.deleted) {
        return { item, status: 'removed-by-them', targetLabel: label, theirSummary, conflicts: [], mergedNote: 'They removed this item. Keeping yours restores it with your values.', defaultResolution: 'drop',
          rebased: commandFor(`${family}.restore`, ref.ordinal, fieldsFromCommand(c)) };
      }
      const b = fieldsOf(baseChild!), m = fieldsFromCommand(c), t = fieldsOf(curChild);
      const merged: ChildFields = { ...t };
      const conflicts: FieldConflict[] = [];
      const mergedFields: string[] = [];
      for (const { key: fk, label: fl } of CHILD_FIELDS) {
        if (fk === 'extension' && family !== 'phone') continue;
        const mine = !fieldEq(family, fk, m, b), their = !fieldEq(family, fk, t, b);
        if (mine && their && !fieldEq(family, fk, m, t)) conflicts.push({ field: fk, label: fl, base: show(family, fk, b), mine: show(family, fk, m), theirs: show(family, fk, t) });
        if (mine) { (merged as unknown as Record<string, unknown>)[fk] = m[fk]; mergedFields.push(fl.toLowerCase()); }
      }
      const status: ReconcileStatus = conflicts.length ? 'conflict' : mergedFields.length ? 'merged' : 'superseded';
      return { item, status, targetLabel: label, theirSummary, conflicts,
        mergedNote: status === 'merged' ? `Combined: your ${mergedFields.join(', ')} with their change.` : status === 'superseded' ? 'Their change already includes yours.' : null,
        defaultResolution: status === 'conflict' ? 'mine' : status === 'superseded' ? 'drop' : 'keep',
        rebased: commandFor(`${family}.replace`, ref.ordinal, conflicts.length ? { ...merged, ...Object.fromEntries(conflicts.map(cf => [cf.field, m[cf.field as keyof ChildFields]])) } as ChildFields : merged) };
    }
    if (op === 'move') {
      if (!curChild || curChild.deleted) return { item, status: 'removed-by-them', targetLabel: label, theirSummary, conflicts: [], mergedNote: 'They removed this item; a move no longer applies.', defaultResolution: 'drop', rebased: null };
      return { item, status: 'merged', targetLabel: label, theirSummary, conflicts: [], mergedNote: `Position will be applied on top of their change (now at position ${curChild.displayOrder}).`, defaultResolution: 'keep', rebased: c };
    }
    if (op === 'delete') {
      if (!curChild || curChild.deleted) return { item, status: 'superseded', targetLabel: label, theirSummary, conflicts: [], mergedNote: 'Already removed.', defaultResolution: 'drop', rebased: null };
      return { item, status: 'conflict', targetLabel: label, theirSummary, conflicts: [{ field: 'lifecycle', label: 'Item', base: 'Present', mine: 'Remove', theirs: 'Edited' }], mergedNote: null, defaultResolution: 'theirs', rebased: c };
    }
    if (op === 'restore') {
      if (curChild && !curChild.deleted) return { item, status: 'superseded', targetLabel: label, theirSummary, conflicts: [], mergedNote: 'Already restored by them.', defaultResolution: 'drop', rebased: null };
      return { item, status: 'clean', targetLabel: label, theirSummary, conflicts: [], mergedNote: null, defaultResolution: 'keep', rebased: c };
    }
    return { item, status: 'clean', targetLabel: label, theirSummary, conflicts: [], mergedNote: null, defaultResolution: 'keep', rebased: c };
  });
  return { baseVersion: d.baseVersion, currentVersion: current.entityVersion, theirUnits, items, hasConflicts: items.some(i => i.status === 'conflict') };
}

/** Builds the rebased draft against the current revision from chosen resolutions. */
export function applyReconciliation(report: ReconcileReport, d: Draft, resolutions: Record<string, Resolution>): Draft {
  const items: DraftItem[] = [];
  for (const r of report.items) {
    const res = resolutions[r.item.id] ?? r.defaultResolution;
    if (res === 'drop' || res === 'theirs') continue;
    const cmd = res === 'mine' || res === 'keep' ? r.rebased : null;
    if (!cmd) continue;
    items.push({ ...r.item, command: cmd, note: r.status === 'merged' ? 'combined with a concurrent change' : r.item.note });
  }
  return { contactKey: d.contactKey, baseVersion: report.currentVersion, items, updatedAt: Date.now() };
}

/** Human summary of what the other party changed on a child between two states. */
export function theirChangeSummary(base: ContactState, current: ContactState, ref: ChildRef): string | null {
  const b = findChild(base, ref), c = findChild(current, ref);
  if (!b || !c) return null;
  const pb = b as PhoneChild, pc = c as PhoneChild;
  const parts: string[] = [];
  if (JSON.stringify(fieldsOf(b).value) !== JSON.stringify(fieldsOf(c).value)) parts.push('value');
  if ((b.location ?? null) !== (c.location ?? null)) parts.push(`label ${b.location ?? '—'} → ${c.location ?? '—'}`);
  if (b.isPublic !== c.isPublic) parts.push(c.isPublic ? 'now public' : 'now private');
  if ((pb.extension ?? null) !== (pc.extension ?? null)) parts.push(`extension ${pb.extension ?? '—'} → ${pc.extension ?? '—'}`);
  if (b.deleted !== c.deleted) parts.push(c.deleted ? 'removed' : 'restored');
  return parts.length ? parts.join(', ') : null;
}

export function liveOrder(state: ContactState, family: Family): Child[] { return liveChildren(state, family); }
