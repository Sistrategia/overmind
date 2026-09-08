// Pure state transitions: apply an ordered command list to a contact state and produce the
// effective actions. Used by the fixture builder, the simulated server and local drafts so every
// snapshot, action and diff stays consistent.
import type {
  Action,
  ActionFamily,
  AddressInput,
  AddressValue,
  Child,
  Command,
  ContactState,
  Family,
  PhoneValue,
  Profile,
  WebLinkValue,
} from './types';
import { parsePhone } from './phone';
import { addressOneLine, childDisplay, childLabel, familyKey, isValidEmail, isValidUrl, liveChildren } from './format';

export class CommandError extends Error {
  commandIndex: number;
  constructor(message: string, commandIndex: number) {
    super(message);
    this.commandIndex = commandIndex;
  }
}

export interface ApplyResult {
  state: ContactState;
  actions: Action[];
  identities: { commandIndex: number; family: Family; ordinal: number }[];
}

export function cloneState(s: ContactState): ContactState {
  return JSON.parse(JSON.stringify(s)) as ContactState;
}

function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(7, '0');
}

/** Address values are immutable and shared: identical fields resolve to the same catalog identity. */
export function addressValueOf(input: AddressInput): AddressValue {
  const norm = (v: string | null | undefined) => (v && v.trim() ? v : null);
  const value: AddressValue = {
    valueId: '',
    streetName: norm(input.streetName),
    extNumber: norm(input.extNumber),
    intNumber: norm(input.intNumber),
    address1: norm(input.address1),
    address2: norm(input.address2),
    colony: norm(input.colony),
    city: norm(input.city),
    state: norm(input.state),
    zipCode: norm(input.zipCode),
    country: norm(input.country),
    references: norm(input.references),
  };
  const key = JSON.stringify([
    value.streetName, value.extNumber, value.intNumber, value.address1, value.address2,
    value.colony, value.city, value.state, value.zipCode, value.country, value.references,
  ]);
  value.valueId = `ADDR-${hashString(key)}`;
  return value;
}

export function validateAddress(input: AddressInput): string | null {
  const has = (v: string | null | undefined) => !!(v && v.trim());
  if ((has(input.address1) || has(input.address2)) && (has(input.streetName) || has(input.extNumber) || has(input.intNumber))) {
    return 'Use either address lines or street name with numbers, not both.';
  }
  if ((has(input.extNumber) || has(input.intNumber)) && !has(input.streetName)) return 'Numbers need a street name.';
  if (has(input.state) && !has(input.country)) return 'State needs a country.';
  if (has(input.city) && !has(input.country)) return 'City needs a country.';
  if (has(input.colony) && !has(input.city)) return 'Colony (neighborhood) needs a city.';
  const anything = has(input.streetName) || has(input.address1) || has(input.address2) || has(input.zipCode) || has(input.country) || has(input.city);
  if (!anything) return 'An address needs at least a street or line, a postal code or a country.';
  return null;
}

export function addressToInput(v: AddressValue): AddressInput {
  const { valueId: _id, ...rest } = v;
  return rest;
}

function profileEquals(a: Profile, b: Profile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function validateProfile(p: Profile): string | null {
  if (!p.fullName || !p.fullName.trim()) return 'Full name is required.';
  if (p.contactTypeId === 2 && (p.personFirstName || p.personLastName1 || p.personLastName2 || p.personAlias)) {
    return 'Person-only name fields are not allowed for an organization.';
  }
  if (p.summary && p.summary.length > 4096) return 'Summary is limited to 4096 characters.';
  return null;
}

const PROFILE_LABELS: Record<keyof Profile, string> = {
  contactTypeId: 'Category',
  fullName: 'Full name',
  displayName: 'Display name',
  personFirstName: 'First name',
  personLastName1: 'First surname',
  personLastName2: 'Second surname',
  personAlias: 'Alias',
  summary: 'Summary',
  doNotContact: 'Do not contact',
  isPrivate: 'Private contact',
};

export function profileFieldLabel(key: keyof Profile): string {
  return PROFILE_LABELS[key];
}

export function profileFieldText(key: keyof Profile, p: Profile): string | null {
  const v = p[key];
  if (key === 'contactTypeId') return v === 1 ? 'Person' : 'Organization';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return (v as string | null) ?? null;
}

export function changedProfileKeys(a: Profile, b: Profile): (keyof Profile)[] {
  return (Object.keys(PROFILE_LABELS) as (keyof Profile)[]).filter((k) => (a[k] ?? null) !== (b[k] ?? null));
}

function childrenOf(state: ContactState, family: Family): Child<unknown>[] {
  return state[familyKey(family)] as Child<unknown>[];
}

function renumber(children: Child<unknown>[]): void {
  liveChildren(children).forEach((c, i) => {
    c.displayOrder = i + 1;
  });
}

function buildValue(family: Family, raw: unknown, index: number): unknown {
  switch (family) {
    case 'email': {
      const v = String(raw ?? '').trim();
      if (!isValidEmail(v)) throw new CommandError(`“${v || '(empty)'}” is not a valid email address.`, index);
      if (v.length > 256) throw new CommandError('Email is limited to 256 characters.', index);
      return v;
    }
    case 'phone': {
      const parsed = parsePhone(raw as { number: string; defaultRegion?: string; areaCode?: string });
      if (!parsed.ok) throw new CommandError(parsed.reason, index);
      return parsed.value;
    }
    case 'web_link': {
      const v = raw as WebLinkValue;
      if (!v || !isValidUrl(v.url ?? '')) throw new CommandError('Web link needs an http(s) URL.', index);
      return { url: v.url.trim(), title: v.title?.trim() || null } satisfies WebLinkValue;
    }
    case 'address': {
      const err = validateAddress(raw as AddressInput);
      if (err) throw new CommandError(err, index);
      return addressValueOf(raw as AddressInput);
    }
  }
}

function sameValue(family: Family, a: unknown, b: unknown): boolean {
  if (family === 'phone') {
    const pa = a as PhoneValue;
    const pb = b as PhoneValue;
    return pa.e164 === pb.e164 && pa.raw === pb.raw; // spelling changes are audited too
  }
  if (family === 'address') return (a as AddressValue).valueId === (b as AddressValue).valueId;
  return JSON.stringify(a) === JSON.stringify(b);
}

function metaText(child: Child<unknown>, family: Family): string {
  const parts = [child.location ?? 'no label', child.isPublic ? 'public' : 'private'];
  if (family === 'phone' && child.extension) parts.push(`ext. ${child.extension}`);
  return parts.join(', ');
}

function validateMeta(cmd: { location?: string | null; extension?: string | null }, index: number): void {
  if (cmd.location && cmd.location.length > 100) throw new CommandError('Label is limited to 100 characters.', index);
  if (cmd.extension != null && cmd.extension !== '') {
    if (!/^\d{1,25}$/.test(cmd.extension)) throw new CommandError('Extension must be 1–25 digits.', index);
  }
}

export function applyCommands(
  input: ContactState,
  commands: Command[],
  options: { allocate: 'server' | 'draft' },
): ApplyResult {
  const state = cloneState(input);
  const actions: Action[] = [];
  const identities: ApplyResult['identities'] = [];
  let seq = 0;
  const push = (family: ActionFamily, kind: string, ordinal: number | null, summary: string, before: string | null, after: string | null) => {
    actions.push({ seq: ++seq, family, kind, ordinal, summary, before, after });
  };

  commands.forEach((cmd, index) => {
    if (cmd.kind === 'profile.replace') {
      const err = validateProfile(cmd.profile);
      if (err) throw new CommandError(err, index);
      if (cmd.profile.contactTypeId !== state.profile.contactTypeId) {
        throw new CommandError('Category conversion is not a Save command.', index);
      }
      if (state.deleted) throw new CommandError('The contact is deleted; restore it first.', index);
      const next: Profile = { ...cmd.profile, displayName: cmd.profile.displayName?.trim() || null };
      if (profileEquals(state.profile, next)) return;
      const keys = changedProfileKeys(state.profile, next);
      const before = keys.map((k) => `${PROFILE_LABELS[k]}: ${profileFieldText(k, state.profile) ?? '—'}`).join('; ');
      const after = keys.map((k) => `${PROFILE_LABELS[k]}: ${profileFieldText(k, next) ?? '—'}`).join('; ');
      state.profile = next;
      push('profile', 'profile.replace', null, `Profile replaced (${keys.map((k) => PROFILE_LABELS[k]).join(', ')})`, before, after);
      return;
    }
    if (cmd.kind === 'contact.delete') {
      if (state.deleted) return;
      state.deleted = true;
      push('contact', 'contact.delete', null, 'Contact deleted (children retained)', 'Active', 'Deleted');
      return;
    }
    if (cmd.kind === 'contact.restore') {
      if (!state.deleted) return;
      state.deleted = false;
      push('contact', 'contact.restore', null, 'Contact restored', 'Deleted', 'Active');
      return;
    }
    if (state.deleted) throw new CommandError('The contact is deleted; restore it first in the same Save.', index);

    const [familyRaw, op] = cmd.kind.split('.') as [Family, string];
    const family = familyRaw;
    const list = childrenOf(state, family);
    const isPhone = family === 'phone';

    if (op === 'insert') {
      const c = cmd as Extract<Command, { kind: `${Family}.insert` }>;
      validateMeta(c, index);
      const value = buildValue(family, c.value, index);
      const ordinal =
        options.allocate === 'server'
          ? Math.max(0, ...list.map((x) => x.ordinal)) + 1
          : Math.min(0, ...list.map((x) => x.ordinal)) - 1;
      const child: Child<unknown> = {
        ordinal,
        displayOrder: liveChildren(list).length + 1,
        value,
        location: c.location?.trim() || null,
        isPublic: c.isPublic ?? false,
        extension: isPhone ? (c as { extension?: string | null }).extension?.trim() || null : null,
        deleted: false,
      };
      list.push(child);
      identities.push({ commandIndex: index, family, ordinal });
      push(family, cmd.kind, ordinal, `${childLabel(family, child)} added: ${childDisplay(family, child)} (${metaText(child, family)})`, null, childDisplay(family, child));
      return;
    }

    const ordinal = (cmd as { ordinal: number }).ordinal;
    const child = list.find((x) => x.ordinal === ordinal);
    if (!child) throw new CommandError(`${family} ordinal ${ordinal} does not exist for this contact.`, index);

    if (op === 'replace') {
      if (child.deleted) throw new CommandError(`${childLabel(family, child)} is deleted; restore it instead of replacing.`, index);
      const c = cmd as Extract<Command, { kind: `${Family}.replace` }>;
      validateMeta(c, index);
      const value = buildValue(family, c.value, index);
      const nextLocation = c.location?.trim() || null;
      const nextPublic = c.isPublic ?? false;
      const nextExt = isPhone ? (c as { extension?: string | null }).extension?.trim() || null : null;
      const unchanged =
        sameValue(family, child.value, value) && child.location === nextLocation && child.isPublic === nextPublic && child.extension === nextExt;
      if (unchanged) return;
      const beforeText = `${childDisplay(family, child)} (${metaText(child, family)})`;
      child.value = value;
      child.location = nextLocation;
      child.isPublic = nextPublic;
      child.extension = nextExt;
      const afterText = `${childDisplay(family, child)} (${metaText(child, family)})`;
      identities.push({ commandIndex: index, family, ordinal });
      push(family, cmd.kind, ordinal, `${childLabel(family, child)} replaced`, beforeText, afterText);
      return;
    }
    if (op === 'delete') {
      if (child.deleted) throw new CommandError(`${childLabel(family, child)} is already deleted.`, index);
      const beforeText = childDisplay(family, child);
      child.deleted = true;
      renumber(list);
      identities.push({ commandIndex: index, family, ordinal });
      push(family, cmd.kind, ordinal, `${childLabel(family, child)} removed: ${beforeText}`, beforeText, null);
      return;
    }
    if (op === 'restore') {
      if (!child.deleted) throw new CommandError(`${childLabel(family, child)} is not deleted.`, index);
      const c = cmd as Extract<Command, { kind: `${Family}.restore` }>;
      validateMeta(c, index);
      const value = buildValue(family, c.value, index);
      const beforeText = childDisplay(family, child);
      const liveBefore = liveChildren(list).length;
      child.value = value;
      child.location = c.location?.trim() || null;
      child.isPublic = c.isPublic ?? false;
      child.extension = isPhone ? (c as { extension?: string | null }).extension?.trim() || null : null;
      child.deleted = false;
      child.displayOrder = liveBefore + 1; // restore appends; it never reclaims an old position
      renumber(list);
      identities.push({ commandIndex: index, family, ordinal });
      push(family, cmd.kind, ordinal, `${childLabel(family, child)} restored (appended at position ${child.displayOrder})`, beforeText, childDisplay(family, child));
      return;
    }
    if (op === 'move') {
      if (child.deleted) throw new CommandError(`${childLabel(family, child)} is deleted and cannot be moved.`, index);
      const target = (cmd as { displayOrder: number }).displayOrder;
      const live = liveChildren(list);
      if (target < 1 || target > live.length) throw new CommandError(`Position ${target} is outside 1–${live.length}.`, index);
      const from = child.displayOrder;
      if (from === target) return;
      const reordered = live.filter((x) => x.ordinal !== ordinal);
      reordered.splice(target - 1, 0, child);
      reordered.forEach((x, i) => {
        x.displayOrder = i + 1;
      });
      identities.push({ commandIndex: index, family, ordinal });
      push(
        family,
        cmd.kind,
        ordinal,
        `${childLabel(family, child)} moved to position ${target}${target === 1 ? ' (primary)' : ''}`,
        `Position ${from}`,
        `Position ${target}`,
      );
      return;
    }
    throw new CommandError(`Unknown command ${cmd.kind}.`, index);
  });

  return { state, actions, identities };
}

export function summarizeAddressInput(a: AddressInput): string {
  return addressOneLine(addressValueOf(a));
}
