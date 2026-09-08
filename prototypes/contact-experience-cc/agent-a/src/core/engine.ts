// Pure command engine: applies ordered commands to a contact state, producing the
// effective action evidence, and computes state/diff answers. Mirrors the service
// semantics in docs/contact-service.md and ADR 0014: stable ordinal identity, saved
// display order, insert/restore append, delete closes the gap, replace is a full
// replacement of the supported fields, identical replacement is a no-op.
import {
  ADDRESS_FIELDS, ADDRESS_FIELD_LABEL, FAMILY_LABEL, FAMILY_LIST, PROFILE_FIELDS, PROFILE_FIELD_LABEL,
  familyOf, isChildCommand, opOf
} from './model';
import type {
  Action, AddressChild, AddressInput, AddressValue, Child, ChildCommand, ChildDiff, ChildIdentity, ChildRef, Command,
  ContactState, EmailChild, Family, FieldDiff, PhoneChild, PhoneInput, Profile, RevisionDiff, WebLinkChild, WebLinkValue
} from './model';
import { formatPhone, parsePhone } from './phone';

export class CommandError extends Error {
  constructor(public code: 'validation' | 'not_found', message: string, public commandIndex = -1) { super(message); }
}

// ---- Address catalog (shared immutable values) --------------------------------

export interface AddressCatalog { byKey: Record<string, AddressValue>; nextId: number }
export function emptyCatalog(): AddressCatalog { return { byKey: {}, nextId: 4410 }; }

function norm(s: string | null | undefined): string | null { return s === undefined || s === null || s === '' ? null : s; }

export function canonicalAddress(input: AddressInput): AddressInput {
  const out: AddressInput = {};
  for (const f of ADDRESS_FIELDS) out[f] = norm(input[f]);
  return out;
}
export function addressKey(input: AddressInput): string { return JSON.stringify(canonicalAddress(input)); }

export function internAddress(catalog: AddressCatalog, input: AddressInput): AddressValue {
  const key = addressKey(input);
  const existing = catalog.byKey[key];
  if (existing) return existing;
  const value: AddressValue = { id: `ADDR-${catalog.nextId++}`, ...canonicalAddress(input) };
  catalog.byKey[key] = value;
  return value;
}

// ---- Validation ----------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return 'Enter an email address.';
  if (value.length > 256) return 'Email must be 256 characters or fewer.';
  if (!EMAIL_RE.test(value)) return 'This does not look like an email address.';
  return null;
}
export function validateLabel(location: unknown): string | null {
  if (location === null || location === undefined) return null;
  if (typeof location !== 'string') return 'Label must be text.';
  if (location.length > 100) return 'Label must be 100 characters or fewer.';
  if (location !== '' && !location.trim()) return 'Label cannot be only spaces.';
  return null;
}
export function validateExtension(ext: unknown): string | null {
  if (ext === null || ext === undefined || ext === '') return null;
  if (typeof ext !== 'string') return 'Extension must be text.';
  if (ext.length > 25) return 'Extension must be 25 characters or fewer.';
  if (!/^[0-9]{1,25}$/.test(ext)) return 'Extension accepts digits only.';
  return null;
}
export function validateUrl(v: unknown): string | null {
  const url = (v as WebLinkValue | undefined)?.url;
  if (!url || typeof url !== 'string') return 'Enter a URL.';
  if (url.length > 2048) return 'URL must be 2048 characters or fewer.';
  try { const u = new URL(url); if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Only http and https links are accepted.'; }
  catch { return 'This is not a valid URL.'; }
  return null;
}
export function validateAddress(a: AddressInput | undefined): string | null {
  if (!a) return 'Enter an address.';
  const c = canonicalAddress(a);
  const hasLines = !!(c.address1 || c.address2);
  const hasStreet = !!(c.streetName || c.extNumber || c.intNumber);
  if (hasLines && hasStreet) return 'Use either address lines or street fields, not both.';
  if ((c.extNumber || c.intNumber) && !c.streetName) return 'A number needs a street name.';
  const anything = ADDRESS_FIELDS.some(f => f !== 'references' && c[f]);
  if (!anything) return 'An address needs at least one line, street, postal code or place.';
  if (c.state && !c.country) return 'A state needs a country.';
  if (c.city && !c.country) return 'A city needs a country.';
  if (c.colony && !c.city) return 'A colony needs a city.';
  for (const f of ADDRESS_FIELDS) {
    const v = c[f];
    if (!v) continue;
    const max = f === 'extNumber' || f === 'intNumber' ? 25 : f === 'zipCode' ? 32 : 256;
    if (v.length > max) return `${ADDRESS_FIELD_LABEL[f]} must be ${max} characters or fewer.`;
  }
  return null;
}
export function validateProfile(p: Profile | undefined): string | null {
  if (!p) return 'Profile is required.';
  if (!p.fullName || !p.fullName.trim()) return 'Full name is required.';
  if (p.fullName.length > 256) return 'Full name must be 256 characters or fewer.';
  if (p.displayName !== null && !p.displayName.trim()) return 'Display name cannot be blank; leave it empty to use the full name.';
  const personOnly: (keyof Profile)[] = ['personFirstName', 'personLastName1', 'personLastName2', 'personAlias', 'jobTitle'];
  if (p.contactTypeId === 2 && personOnly.some(f => p[f])) return 'Person fields are not accepted for an organization.';
  if (p.contactTypeId === 1 && p.recruiting) return 'Recruiting applies to organizations only.';
  return null;
}

// ---- State helpers -------------------------------------------------------------

export function emptyState(publicKey: string): ContactState {
  return {
    publicKey, entityVersion: 0, deletedRoot: false,
    profile: { contactTypeId: 1, fullName: '', displayName: null, personFirstName: null, personLastName1: null, personLastName2: null, personAlias: null, jobTitle: null, summary: null, isPrivate: false, doNotContact: false, recruiting: false },
    emails: [], phones: [], webLinks: [], addresses: []
  };
}
export function cloneState(s: ContactState): ContactState { return JSON.parse(JSON.stringify(s)) as ContactState; }

export function listOf(state: ContactState, family: Family): Child[] {
  return state[FAMILY_LIST[family]] as Child[];
}
export function liveChildren<T extends Child = Child>(state: ContactState, family: Family): T[] {
  return (listOf(state, family).filter(c => !c.deleted) as T[]).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}
export function findChild(state: ContactState, ref: ChildRef): Child | undefined {
  return listOf(state, ref.family).find(c => c.ordinal === ref.ordinal);
}
export function displayName(p: Profile): string { return p.displayName ?? p.fullName; }

export function childValueText(c: Child): string {
  switch (c.family) {
    case 'email': return c.value;
    case 'phone': return formatPhone(c.value) + (c.extension ? ` ext. ${c.extension}` : '');
    case 'web_link': return c.value.url;
    case 'address': return addressOneLine(c.value);
  }
}
export function addressOneLine(a: AddressInput): string {
  const street = a.streetName ? [a.streetName, a.extNumber, a.intNumber ? `int. ${a.intNumber}` : null].filter(Boolean).join(' ') : null;
  return [a.address1, a.address2, street, a.colony, a.zipCode && a.city ? `${a.zipCode} ${a.city}` : a.zipCode ?? a.city, a.state, a.country]
    .filter(Boolean).join(', ');
}
export function childLabel(c: Child): string { return c.location ?? FAMILY_LABEL[c.family]; }
export function childTitle(c: Child): string { return `${c.location ? c.location + ' ' : ''}${FAMILY_LABEL[c.family].toLowerCase()}`; }

const CHILD_FIELD_LABEL: Record<string, string> = { value: 'Value', location: 'Label', isPublic: 'Visibility', extension: 'Extension', displayOrder: 'Position' };

function comparableValue(c: Child): unknown {
  switch (c.family) {
    case 'email': return c.value;
    case 'phone': return { e164: c.value.e164, raw: c.value.rawInput };
    case 'web_link': return c.value;
    case 'address': return c.value.id;
  }
}
function sameChildFields(a: Child, b: Child): boolean {
  return JSON.stringify(comparableValue(a)) === JSON.stringify(comparableValue(b))
    && (a.location ?? null) === (b.location ?? null) && a.isPublic === b.isPublic
    && ((a as PhoneChild).extension ?? null) === ((b as PhoneChild).extension ?? null);
}

// ---- Applying commands ---------------------------------------------------------

export interface ApplyContext { addresses: AddressCatalog }
export interface ApplyOutcome { state: ContactState; action: Action | null }

function renumber(list: Child[]): void {
  const live = list.filter(c => !c.deleted).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  live.forEach((c, i) => { c.displayOrder = i + 1; });
}

function buildChildValue(family: Family, cmd: ChildCommand, ctx: ApplyContext, index: number): { value: Child['value']; extension: string | null } {
  switch (family) {
    case 'email': {
      const err = validateEmail(cmd.value);
      if (err) throw new CommandError('validation', err, index);
      return { value: cmd.value as string, extension: null };
    }
    case 'phone': {
      const parsed = parsePhone(cmd.value as PhoneInput);
      if (!parsed.ok) throw new CommandError('validation', parsed.error, index);
      const extErr = validateExtension(cmd.extension);
      if (extErr) throw new CommandError('validation', extErr, index);
      return { value: parsed.value, extension: cmd.extension ? cmd.extension : null };
    }
    case 'web_link': {
      const err = validateUrl(cmd.value);
      if (err) throw new CommandError('validation', err, index);
      const v = cmd.value as WebLinkValue;
      return { value: { url: v.url, type: norm(v.type), displayText: norm(v.displayText) }, extension: null };
    }
    case 'address': {
      const err = validateAddress(cmd.value as AddressInput);
      if (err) throw new CommandError('validation', err, index);
      return { value: internAddress(ctx.addresses, cmd.value as AddressInput), extension: null };
    }
  }
}

function makeChild(family: Family, ordinal: number, displayOrder: number, cmd: ChildCommand, built: { value: Child['value']; extension: string | null }): Child {
  const base = { ordinal, displayOrder, location: norm(cmd.location), isPublic: cmd.isPublic === true, deleted: false };
  switch (family) {
    case 'email': return { ...base, family, value: built.value as string } as EmailChild;
    case 'phone': return { ...base, family, value: built.value as PhoneChild['value'], extension: built.extension } as PhoneChild;
    case 'web_link': return { ...base, family, value: built.value as WebLinkValue } as WebLinkChild;
    case 'address': return { ...base, family, value: built.value as AddressValue } as AddressChild;
  }
}

function snapshot<T>(x: T): T { return x === undefined ? x : JSON.parse(JSON.stringify(x)) as T; }

export function applyCommand(input: ContactState, cmd: Command, ctx: ApplyContext, index = -1, actionOrdinal = 1): ApplyOutcome {
  const state = cloneState(input);
  const noAction = { state: input, action: null };

  if (cmd.kind === 'contact.create') {
    const err = validateProfile(cmd.profile);
    if (err) throw new CommandError('validation', err, index);
    if (state.entityVersion !== 0 && state.profile.fullName) throw new CommandError('validation', 'Contact already exists.', index);
    state.profile = { ...cmd.profile };
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: { family: 'root' }, summary: `Created ${cmd.profile.contactTypeId === 2 ? 'organization' : 'person'} ${displayName(cmd.profile)}`, before: null, after: snapshot(cmd.profile) } };
  }
  if (cmd.kind === 'profile.replace') {
    const err = validateProfile(cmd.profile);
    if (err) throw new CommandError('validation', err, index);
    if (state.deletedRoot) throw new CommandError('validation', 'The contact is deleted; restore it first.', index);
    if (cmd.profile.contactTypeId !== state.profile.contactTypeId) throw new CommandError('validation', 'Contact category cannot change through Save.', index);
    const before = snapshot(state.profile);
    const changed = PROFILE_FIELDS.filter(f => (before[f] ?? null) !== (cmd.profile[f] ?? null));
    if (changed.length === 0) return noAction;
    state.profile = { ...cmd.profile };
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: { family: 'profile' }, summary: `Replaced profile (${changed.map(f => PROFILE_FIELD_LABEL[f]).join(', ')})`, before, after: snapshot(state.profile) } };
  }
  if (cmd.kind === 'contact.delete') {
    if (state.deletedRoot) return noAction;
    state.deletedRoot = true;
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: { family: 'root' }, summary: 'Deleted contact (children retained)', before: { deletedRoot: false }, after: { deletedRoot: true } } };
  }
  if (cmd.kind === 'contact.restore') {
    if (!state.deletedRoot) return noAction;
    state.deletedRoot = false;
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: { family: 'root' }, summary: 'Restored contact', before: { deletedRoot: true }, after: { deletedRoot: false } } };
  }
  if (!isChildCommand(cmd)) throw new CommandError('validation', `Unknown command ${(cmd as Command).kind}.`, index);

  const family = familyOf(cmd.kind);
  const op = opOf(cmd.kind);
  const list = listOf(state, family);
  const labelErr = validateLabel(cmd.location);
  if (labelErr && (op === 'insert' || op === 'replace' || op === 'restore')) throw new CommandError('validation', labelErr, index);
  if (state.deletedRoot && state.entityVersion > 0) throw new CommandError('validation', 'The contact is deleted; restore it first.', index);
  const fam = FAMILY_LABEL[family].toLowerCase();

  if (op === 'insert') {
    const built = buildChildValue(family, cmd, ctx, index);
    const ordinal = list.reduce((m, c) => Math.max(m, c.ordinal), 0) + 1;
    const position = list.filter(c => !c.deleted).length + 1;
    const child = makeChild(family, ordinal, position, cmd, built);
    list.push(child);
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: { family, ordinal }, summary: `Added ${childTitle(child)} ${childValueText(child)} at position ${position}`, before: null, after: snapshot(child) } };
  }

  if (cmd.ordinal === undefined) throw new CommandError('validation', `${cmd.kind} needs an ordinal.`, index);
  const existing = list.find(c => c.ordinal === cmd.ordinal);
  if (!existing) throw new CommandError('not_found', `No ${fam} with identity ${cmd.ordinal}.`, index);
  const ref: ChildRef = { family, ordinal: existing.ordinal };

  if (op === 'replace') {
    if (existing.deleted) throw new CommandError('not_found', `${FAMILY_LABEL[family]} ${cmd.ordinal} is deleted; restore it instead.`, index);
    const built = buildChildValue(family, cmd, ctx, index);
    const replacement = makeChild(family, existing.ordinal, existing.displayOrder ?? 1, cmd, built);
    if (sameChildFields(existing, replacement)) return noAction;
    const before = snapshot(existing);
    Object.assign(existing, replacement);
    const parts: string[] = [];
    if (JSON.stringify(comparableValue(before)) !== JSON.stringify(comparableValue(existing))) parts.push(`${childValueText(before)} → ${childValueText(existing)}`);
    if ((before.location ?? null) !== (existing.location ?? null)) parts.push(`label ${before.location ?? '—'} → ${existing.location ?? '—'}`);
    if (before.isPublic !== existing.isPublic) parts.push(existing.isPublic ? 'now public' : 'now private');
    if (((before as PhoneChild).extension ?? null) !== ((existing as PhoneChild).extension ?? null)) parts.push(`extension ${(before as PhoneChild).extension ?? '—'} → ${(existing as PhoneChild).extension ?? '—'}`);
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: ref, summary: `Changed ${childTitle(before)}: ${parts.join('; ')}`, before, after: snapshot(existing) } };
  }
  if (op === 'delete') {
    if (existing.deleted) return noAction;
    const before = snapshot(existing);
    existing.deleted = true; existing.displayOrder = null;
    renumber(list);
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: ref, summary: `Removed ${childTitle(before)} ${childValueText(before)} (was position ${before.displayOrder})`, before, after: snapshot(existing) } };
  }
  if (op === 'restore') {
    if (!existing.deleted) throw new CommandError('validation', `${FAMILY_LABEL[family]} ${cmd.ordinal} is not deleted.`, index);
    const built = buildChildValue(family, cmd, ctx, index);
    const before = snapshot(existing);
    const position = list.filter(c => !c.deleted).length + 1;
    Object.assign(existing, makeChild(family, existing.ordinal, position, cmd, built));
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: ref, summary: `Restored ${childTitle(existing)} ${childValueText(existing)} at position ${position}`, before, after: snapshot(existing) } };
  }
  if (op === 'move') {
    if (existing.deleted) throw new CommandError('not_found', `${FAMILY_LABEL[family]} ${cmd.ordinal} is deleted.`, index);
    const live = list.filter(c => !c.deleted).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const target = cmd.displayOrder;
    if (!target || target < 1 || target > live.length) throw new CommandError('validation', `Position must be between 1 and ${live.length}.`, index);
    if (existing.displayOrder === target) return noAction;
    const before = snapshot(existing);
    const without = live.filter(c => c.ordinal !== existing.ordinal);
    without.splice(target - 1, 0, existing);
    without.forEach((c, i) => { c.displayOrder = i + 1; });
    return { state, action: { ordinal: actionOrdinal, kind: cmd.kind, target: ref, summary: `Moved ${childTitle(existing)} ${childValueText(existing)} from position ${before.displayOrder} to ${target}${target === 1 ? ' (primary)' : ''}`, before, after: snapshot(existing) } };
  }
  throw new CommandError('validation', `Unsupported command ${cmd.kind}.`, index);
}

export interface ApplyAllResult { state: ContactState; actions: Action[]; identities: ChildIdentity[] }
/** Applies the whole list; any failure throws and nothing is kept (whole-unit rollback). */
export function applyAll(input: ContactState, commands: Command[], ctx: ApplyContext): ApplyAllResult {
  let state = input;
  const actions: Action[] = [];
  const identities: ChildIdentity[] = [];
  const scratch: ApplyContext = { addresses: { byKey: { ...ctx.addresses.byKey }, nextId: ctx.addresses.nextId } };
  commands.forEach((cmd, i) => {
    const out = applyCommand(state, cmd, scratch, i, actions.length + 1);
    state = out.state;
    if (out.action) actions.push(out.action);
    if (isChildCommand(cmd)) {
      const family = familyOf(cmd.kind);
      const ordinal = out.action && 'ordinal' in out.action.target ? out.action.target.ordinal : cmd.ordinal;
      if (ordinal !== undefined) identities.push({ commandIndex: i, family, ordinal });
    }
  });
  // Commit the catalog only after every command succeeded.
  ctx.addresses.byKey = scratch.addresses.byKey; ctx.addresses.nextId = scratch.addresses.nextId;
  return { state, actions, identities };
}

// ---- Diff ----------------------------------------------------------------------

function childFieldDiffs(a: Child, b: Child): FieldDiff[] {
  const out: FieldDiff[] = [];
  if (JSON.stringify(comparableValue(a)) !== JSON.stringify(comparableValue(b))) {
    if (a.family === 'address' && b.family === 'address') {
      for (const f of ADDRESS_FIELDS) {
        if ((a.value[f] ?? null) !== (b.value[f] ?? null)) out.push({ field: `address.${f}`, label: ADDRESS_FIELD_LABEL[f], old: a.value[f] ?? null, new: b.value[f] ?? null });
      }
      out.push({ field: 'valueId', label: 'Address value', old: a.value.id, new: b.value.id, technical: true });
    } else {
      out.push({ field: 'value', label: CHILD_FIELD_LABEL.value, old: childValueText({ ...a, extension: null } as Child), new: childValueText({ ...b, extension: null } as Child) });
    }
  }
  if ((a.location ?? null) !== (b.location ?? null)) out.push({ field: 'location', label: CHILD_FIELD_LABEL.location, old: a.location ?? null, new: b.location ?? null });
  if (a.isPublic !== b.isPublic) out.push({ field: 'isPublic', label: CHILD_FIELD_LABEL.isPublic, old: a.isPublic ? 'Public' : 'Private', new: b.isPublic ? 'Public' : 'Private' });
  if (((a as PhoneChild).extension ?? null) !== ((b as PhoneChild).extension ?? null)) out.push({ field: 'extension', label: CHILD_FIELD_LABEL.extension, old: (a as PhoneChild).extension ?? null, new: (b as PhoneChild).extension ?? null });
  if ((a.displayOrder ?? null) !== (b.displayOrder ?? null)) out.push({ field: 'displayOrder', label: CHILD_FIELD_LABEL.displayOrder, old: a.displayOrder, new: b.displayOrder });
  return out;
}

export function diffStates(a: ContactState, b: ContactState): RevisionDiff {
  const profile: FieldDiff[] = [];
  for (const f of PROFILE_FIELDS) {
    const o = a.profile[f] ?? null, n = b.profile[f] ?? null;
    if (o !== n) profile.push({ field: f, label: PROFILE_FIELD_LABEL[f], old: o, new: n });
  }
  const root: FieldDiff[] = [];
  if (a.deletedRoot !== b.deletedRoot) root.push({ field: 'deletedRoot', label: 'Contact', old: a.deletedRoot ? 'Deleted' : 'Active', new: b.deletedRoot ? 'Deleted' : 'Active' });
  const children: ChildDiff[] = [];
  for (const family of ['email', 'phone', 'web_link', 'address'] as Family[]) {
    const la = listOf(a, family), lb = listOf(b, family);
    const ordinals = new Set<number>([...la.map(c => c.ordinal), ...lb.map(c => c.ordinal)]);
    for (const ordinal of [...ordinals].sort((x, y) => x - y)) {
      const ca = la.find(c => c.ordinal === ordinal), cb = lb.find(c => c.ordinal === ordinal);
      const liveA = !!ca && !ca.deleted, liveB = !!cb && !cb.deleted;
      const ref = { family, ordinal };
      if (!liveA && liveB) children.push({ ref, kind: 'added', fields: [], old: ca ?? null, new: cb! });
      else if (liveA && !liveB) children.push({ ref, kind: 'removed', fields: [], old: ca!, new: cb ?? null });
      else if (liveA && liveB) {
        const fields = childFieldDiffs(ca!, cb!);
        if (fields.length) children.push({ ref, kind: 'changed', fields, old: ca!, new: cb! });
      }
    }
  }
  return { from: a.entityVersion, to: b.entityVersion, profile, children, root, empty: profile.length === 0 && children.length === 0 && root.length === 0 };
}

/** Fields touched by a list of actions (used for conflict overlap and highlights). */
export function touchedKeys(actions: Action[]): Set<string> {
  const s = new Set<string>();
  for (const a of actions) {
    if (a.target.family === 'profile') s.add('profile');
    else if (a.target.family === 'root') s.add('root');
    else s.add(`${a.target.family}#${a.target.ordinal}`);
  }
  return s;
}

export function summarizeActions(actions: Action[]): string {
  if (actions.length === 0) return 'No effective change';
  if (actions.length === 1) return actions[0].summary;
  const fams = new Set(actions.map(a => a.target.family));
  return `${actions.length} changes across ${[...fams].map(f => f === 'profile' ? 'profile' : f === 'root' ? 'contact' : FAMILY_LABEL[f as Family].toLowerCase()).join(', ')}`;
}
