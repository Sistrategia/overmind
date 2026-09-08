// Local draft logic: a draft holds the base state (the revision the user started from) and a
// working state. Commands are derived from the difference, so any number of inline edits become
// one ordered Save with one new revision.
import type { AddressValue, Child, Command, ContactState, Draft, Family, PendingChange, PhoneValue, WebLinkValue } from './types';
import { FAMILIES } from './types';
import { addressToInput, changedProfileKeys, profileFieldLabel, profileFieldText } from './engine';
import { childDisplay, childLabel, familyKey, liveChildren, FAMILY_LABEL } from './format';
import { phoneToInput } from './phone';

export class DraftError extends Error {}

function valueInput(family: Family, c: Child<unknown>): unknown {
  switch (family) {
    case 'email':
      return c.value as string;
    case 'phone':
      return phoneToInput(c.value as PhoneValue);
    case 'web_link':
      return c.value as WebLinkValue;
    case 'address':
      return addressToInput(c.value as AddressValue);
  }
}

function valueChanged(family: Family, a: Child<unknown>, b: Child<unknown>): boolean {
  if (family === 'phone') {
    const pa = a.value as PhoneValue;
    const pb = b.value as PhoneValue;
    return pa.e164 !== pb.e164 || pa.raw !== pb.raw;
  }
  if (family === 'address') return (a.value as AddressValue).valueId !== (b.value as AddressValue).valueId;
  return JSON.stringify(a.value) !== JSON.stringify(b.value);
}

function metaChanged(family: Family, a: Child<unknown>, b: Child<unknown>): boolean {
  return (a.location ?? null) !== (b.location ?? null) || a.isPublic !== b.isPublic || (family === 'phone' && (a.extension ?? null) !== (b.extension ?? null));
}

function replaceLike(kind: 'replace' | 'restore', family: Family, c: Child<unknown>): Command {
  const base = { ordinal: c.ordinal, value: valueInput(family, c), location: c.location, isPublic: c.isPublic } as Record<string, unknown>;
  if (family === 'phone') base.extension = c.extension;
  return { kind: `${family}.${kind}`, ...base } as unknown as Command;
}

/** Plan move commands that turn `current` (ordinals in live order) into `target`. */
export function planMoves(family: Family, current: number[], target: number[]): Command[] {
  const moves: Command[] = [];
  const work = [...current];
  for (let i = 0; i < target.length; i++) {
    const want = target[i]!;
    if (work[i] === want) continue;
    const from = work.indexOf(want);
    if (from < 0) continue;
    work.splice(from, 1);
    work.splice(i, 0, want);
    moves.push({ kind: `${family}.move`, ordinal: want, displayOrder: i + 1 } as Command);
  }
  return moves;
}

export function deriveCommands(base: ContactState, working: ContactState): Command[] {
  const commands: Command[] = [];
  if (base.deleted && !working.deleted) commands.push({ kind: 'contact.restore' });
  if (changedProfileKeys(base.profile, working.profile).length) commands.push({ kind: 'profile.replace', profile: working.profile });
  const moveCommands: Command[] = [];
  for (const family of FAMILIES) {
    const key = familyKey(family);
    const baseList = base[key] as Child<unknown>[];
    const workList = working[key] as Child<unknown>[];
    const inserted: Child<unknown>[] = [];
    for (const w of workList) {
      if (w.ordinal < 0) {
        if (!w.deleted) inserted.push(w);
        continue;
      }
      const b = baseList.find((x) => x.ordinal === w.ordinal);
      if (!b) continue;
      if (b.deleted && !w.deleted) commands.push(replaceLike('restore', family, w));
      else if (!b.deleted && w.deleted) commands.push({ kind: `${family}.delete`, ordinal: w.ordinal } as Command);
      else if (!b.deleted && !w.deleted && (valueChanged(family, b, w) || metaChanged(family, b, w))) commands.push(replaceLike('replace', family, w));
    }
    // Intermediate order after replace/delete/restore but before inserts: base live order minus deletions, restored appended in ordinal order.
    const workLive = liveChildren(workList);
    const restored = workLive.filter((w) => w.ordinal > 0 && baseList.find((b) => b.ordinal === w.ordinal)?.deleted);
    const intermediate = [
      ...liveChildren(baseList).filter((b) => !workList.find((w) => w.ordinal === b.ordinal)?.deleted).map((b) => b.ordinal),
      ...restored.map((r) => r.ordinal),
    ];
    const targetExisting = workLive.filter((w) => w.ordinal > 0).map((w) => w.ordinal);
    const targetNew = workLive.filter((w) => w.ordinal < 0).map((w) => w.ordinal);
    // New children must be a suffix in insertion order: the API cannot reference them before the Save returns their ordinals.
    const tail = workLive.slice(workLive.length - targetNew.length).map((w) => w.ordinal);
    if (targetNew.length && tail.join(',') !== targetNew.join(',')) {
      throw new DraftError(`New ${FAMILY_LABEL[family].toLowerCase()} entries are saved at the end of the list. Save first, then reorder.`);
    }
    moveCommands.push(...planMoves(family, intermediate, targetExisting));
    for (const w of inserted) {
      const c = { kind: `${family}.insert`, value: valueInput(family, w), location: w.location, isPublic: w.isPublic } as Record<string, unknown>;
      if (family === 'phone') c.extension = w.extension;
      commands.push(c as unknown as Command);
    }
  }
  commands.push(...moveCommands);
  if (!base.deleted && working.deleted) commands.push({ kind: 'contact.delete' });
  return commands;
}

function fieldDeltas(family: Family, b: Child<unknown>, w: Child<unknown>): string[] {
  const out: string[] = [];
  if (valueChanged(family, b, w)) out.push(`${childDisplay(family, { ...b, extension: null })} → ${childDisplay(family, { ...w, extension: null })}`);
  if ((b.location ?? null) !== (w.location ?? null)) out.push(`label ${b.location ?? '(none)'} → ${w.location ?? '(none)'}`);
  if (b.isPublic !== w.isPublic) out.push(w.isPublic ? 'private → public' : 'public → private');
  if (family === 'phone' && (b.extension ?? null) !== (w.extension ?? null)) out.push(`extension ${b.extension ?? '(none)'} → ${w.extension ?? '(none)'}`);
  return out;
}

export function describeCommands(base: ContactState, working: ContactState, commands: Command[]): PendingChange[] {
  const out: PendingChange[] = [];
  commands.forEach((cmd, i) => {
    const key = `${i}:${cmd.kind}`;
    if (cmd.kind === 'profile.replace') {
      const keys = changedProfileKeys(base.profile, cmd.profile);
      const text = keys.map((k) => `${profileFieldLabel(k)}: ${profileFieldText(k, base.profile) ?? '(empty)'} → ${profileFieldText(k, cmd.profile) ?? '(empty)'}`).join('; ');
      out.push({ key, family: 'profile', ordinal: null, text: `Update profile — ${text}`, command: cmd });
      return;
    }
    if (cmd.kind === 'contact.delete') return void out.push({ key, family: 'contact', ordinal: null, text: 'Delete the contact (children retained)', command: cmd });
    if (cmd.kind === 'contact.restore') return void out.push({ key, family: 'contact', ordinal: null, text: 'Restore the contact', command: cmd });
    const [family, op] = cmd.kind.split('.') as [Family, string];
    const listKey = familyKey(family);
    const baseChild = 'ordinal' in cmd ? (base[listKey] as Child<unknown>[]).find((c) => c.ordinal === cmd.ordinal) : undefined;
    const workChild = 'ordinal' in cmd ? (working[listKey] as Child<unknown>[]).find((c) => c.ordinal === cmd.ordinal) : undefined;
    if (op === 'insert') {
      const w = (working[listKey] as Child<unknown>[]).find((c) => c.ordinal < 0 && !c.deleted && JSON.stringify(valueInput(family, c)) === JSON.stringify((cmd as { value: unknown }).value));
      const display = w ? childDisplay(family, w) : String((cmd as { value: unknown }).value);
      const meta = w ? `${w.location ?? 'no label'}, ${w.isPublic ? 'public' : 'private'}` : '';
      out.push({ key, family, ordinal: w?.ordinal ?? null, text: `Add ${FAMILY_LABEL[family].toLowerCase()} ${display}${meta ? ` (${meta})` : ''} at the end`, command: cmd });
      return;
    }
    if (op === 'replace' && baseChild && workChild) {
      out.push({ key, family, ordinal: baseChild.ordinal, text: `Change ${childLabel(family, baseChild).toLowerCase()} — ${fieldDeltas(family, baseChild, workChild).join('; ')}`, command: cmd });
      return;
    }
    if (op === 'delete' && baseChild) {
      out.push({ key, family, ordinal: baseChild.ordinal, text: `Remove ${childLabel(family, baseChild).toLowerCase()} ${childDisplay(family, baseChild)}`, command: cmd });
      return;
    }
    if (op === 'restore' && baseChild && workChild) {
      out.push({ key, family, ordinal: baseChild.ordinal, text: `Restore ${childLabel(family, workChild).toLowerCase()} ${childDisplay(family, workChild)} (appended)`, command: cmd });
      return;
    }
    if (op === 'move' && workChild) {
      const pos = (cmd as { displayOrder: number }).displayOrder;
      out.push({
        key,
        family,
        ordinal: workChild.ordinal,
        text: pos === 1 ? `Make ${childLabel(family, workChild).toLowerCase()} ${childDisplay(family, workChild)} primary` : `Move ${childLabel(family, workChild).toLowerCase()} to position ${pos}`,
        command: cmd,
      });
      return;
    }
    out.push({ key, family, ordinal: null, text: cmd.kind, command: cmd });
  });
  return out;
}

export function pendingOf(draft: Draft): { pending: PendingChange[]; error: string | null } {
  try {
    const commands = deriveCommands(draft.base, draft.working);
    return { pending: describeCommands(draft.base, draft.working, commands), error: null };
  } catch (e) {
    return { pending: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- Working-state editing helpers (immutable updates) ----

export function updateChild<T>(state: ContactState, family: Family, ordinal: number, patch: Partial<Child<T>>): ContactState {
  const key = familyKey(family);
  return { ...state, [key]: (state[key] as Child<T>[]).map((c) => (c.ordinal === ordinal ? { ...c, ...patch } : c)) };
}

export function addChild<T>(state: ContactState, family: Family, child: Omit<Child<T>, 'ordinal' | 'displayOrder' | 'deleted'>): ContactState {
  const key = familyKey(family);
  const list = state[key] as Child<T>[];
  const ordinal = Math.min(0, ...list.map((c) => c.ordinal)) - 1;
  const displayOrder = liveChildren(list).length + 1;
  return { ...state, [key]: [...list, { ...child, ordinal, displayOrder, deleted: false }] };
}

export function removeChild(state: ContactState, family: Family, ordinal: number): ContactState {
  const key = familyKey(family);
  let list = (state[key] as Child<unknown>[]).map((c) => (c.ordinal === ordinal ? { ...c, deleted: true } : { ...c }));
  if (ordinal < 0) list = list.filter((c) => c.ordinal !== ordinal);
  liveChildren(list).forEach((c, i) => (c.displayOrder = i + 1));
  return { ...state, [key]: list };
}

export function restoreChild(state: ContactState, family: Family, ordinal: number): ContactState {
  const key = familyKey(family);
  const list = (state[key] as Child<unknown>[]).map((c) => ({ ...c }));
  const target = list.find((c) => c.ordinal === ordinal);
  if (!target || !target.deleted) return state;
  target.deleted = false;
  target.displayOrder = liveChildren(list).length; // it is live now, so it lands at the end
  liveChildren(list).forEach((c, i) => (c.displayOrder = i + 1));
  return { ...state, [key]: list };
}

/** Move a live child to a 1-based position. Returns an error string when the API cannot express it. */
export function moveChild(state: ContactState, family: Family, ordinal: number, position: number): { state: ContactState; error: string | null } {
  const key = familyKey(family);
  const list = (state[key] as Child<unknown>[]).map((c) => ({ ...c }));
  const live = liveChildren(list);
  const target = live.find((c) => c.ordinal === ordinal);
  if (!target) return { state, error: 'That entry is not live.' };
  if (ordinal < 0) return { state, error: `New ${FAMILY_LABEL[family].toLowerCase()} entries are saved at the end. Save first, then make it primary.` };
  const newCount = live.filter((c) => c.ordinal < 0).length;
  const maxPos = live.length - newCount;
  const pos = Math.max(1, Math.min(position, maxPos));
  const reordered = live.filter((c) => c.ordinal !== ordinal);
  reordered.splice(pos - 1, 0, target);
  reordered.forEach((c, i) => (c.displayOrder = i + 1));
  return { state: { ...state, [key]: list }, error: null };
}

export function childPosition(state: ContactState, family: Family, ordinal: number): number | null {
  const live = liveChildren(state[familyKey(family)] as Child<unknown>[]);
  const i = live.findIndex((c) => c.ordinal === ordinal);
  return i < 0 ? null : i + 1;
}
