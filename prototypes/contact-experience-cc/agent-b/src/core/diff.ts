import type { AddressValue, Child, ChildDiff, ContactState, Diff, Family, FieldChange, PhoneValue, WebLinkValue } from './types';
import { FAMILIES } from './types';
import { changedProfileKeys, profileFieldLabel, profileFieldText } from './engine';
import { addressOneLine, childDisplay, childLabel, familyKey, liveChildren } from './format';

function positionMap(children: Child<unknown>[]): Map<number, number> {
  const m = new Map<number, number>();
  liveChildren(children).forEach((c, i) => m.set(c.ordinal, i + 1));
  return m;
}

function valueText(family: Family, c: Child<unknown>): string {
  switch (family) {
    case 'email':
      return c.value as string;
    case 'phone':
      return (c.value as PhoneValue).international;
    case 'web_link':
      return (c.value as WebLinkValue).url;
    case 'address':
      return addressOneLine(c.value as AddressValue);
  }
}

function childFieldChanges(family: Family, a: Child<unknown>, b: Child<unknown>, posA: number | undefined, posB: number | undefined): FieldChange[] {
  const out: FieldChange[] = [];
  const p = `${family}.${a.ordinal}`;
  const va = valueText(family, a);
  const vb = valueText(family, b);
  if (va !== vb) out.push({ path: `${p}.value`, label: 'Value', before: va, after: vb });
  if (family === 'phone' && (a.value as PhoneValue).raw !== (b.value as PhoneValue).raw && va === vb) {
    out.push({ path: `${p}.raw`, label: 'Entered spelling', before: (a.value as PhoneValue).raw, after: (b.value as PhoneValue).raw });
  }
  if (family === 'web_link' && ((a.value as WebLinkValue).title ?? null) !== ((b.value as WebLinkValue).title ?? null)) {
    out.push({ path: `${p}.title`, label: 'Title', before: (a.value as WebLinkValue).title, after: (b.value as WebLinkValue).title });
  }
  if ((a.location ?? null) !== (b.location ?? null)) out.push({ path: `${p}.location`, label: 'Label', before: a.location, after: b.location });
  if (a.isPublic !== b.isPublic) out.push({ path: `${p}.isPublic`, label: 'Visibility', before: a.isPublic ? 'Public' : 'Private', after: b.isPublic ? 'Public' : 'Private' });
  if (family === 'phone' && (a.extension ?? null) !== (b.extension ?? null)) {
    out.push({ path: `${p}.extension`, label: 'Extension', before: a.extension, after: b.extension });
  }
  if (posA !== undefined && posB !== undefined && posA !== posB) {
    out.push({ path: `${p}.position`, label: 'Position', before: `${posA}${posA === 1 ? ' (primary)' : ''}`, after: `${posB}${posB === 1 ? ' (primary)' : ''}` });
  }
  return out;
}

export function diffStates(before: ContactState, after: ContactState): Diff {
  const profile: FieldChange[] = changedProfileKeys(before.profile, after.profile).map((k) => ({
    path: `profile.${k}`,
    label: profileFieldLabel(k),
    before: profileFieldText(k, before.profile),
    after: profileFieldText(k, after.profile),
  }));
  const root: FieldChange[] = [];
  if (before.deleted !== after.deleted) {
    root.push({ path: 'contact.deleted', label: 'Lifecycle', before: before.deleted ? 'Deleted' : 'Active', after: after.deleted ? 'Deleted' : 'Active' });
  }
  const children: ChildDiff[] = [];
  for (const family of FAMILIES) {
    const key = familyKey(family);
    const oldList = before[key] as Child<unknown>[];
    const newList = after[key] as Child<unknown>[];
    const posOld = positionMap(oldList);
    const posNew = positionMap(newList);
    const ordinals = new Set<number>([...oldList.map((c) => c.ordinal), ...newList.map((c) => c.ordinal)]);
    for (const ordinal of Array.from(ordinals).sort((x, y) => x - y)) {
      const a = oldList.find((c) => c.ordinal === ordinal);
      const b = newList.find((c) => c.ordinal === ordinal);
      const aLive = !!a && !a.deleted;
      const bLive = !!b && !b.deleted;
      if (!aLive && !bLive) continue; // never live in either → not part of the comparison
      if (!aLive && bLive) {
        const status: ChildDiff['status'] = a ? 'restored' : 'added';
        children.push({
          family,
          ordinal,
          status,
          label: childLabel(family, b!),
          display: childDisplay(family, b!),
          changes: a ? childFieldChanges(family, a, b!, undefined, undefined) : [],
        });
        continue;
      }
      if (aLive && !bLive) {
        children.push({ family, ordinal, status: 'removed', label: childLabel(family, a!), display: childDisplay(family, a!), changes: [] });
        continue;
      }
      const changes = childFieldChanges(family, a!, b!, posOld.get(ordinal), posNew.get(ordinal));
      children.push({
        family,
        ordinal,
        status: changes.length ? 'changed' : 'unchanged',
        label: childLabel(family, b!),
        display: childDisplay(family, b!),
        changes,
      });
    }
  }
  const isEmpty = profile.length === 0 && root.length === 0 && children.every((c) => c.status === 'unchanged');
  return { profile, children, root, isEmpty };
}

export function changedPaths(d: Diff): string[] {
  return [
    ...d.profile.map((c) => c.path),
    ...d.root.map((c) => c.path),
    ...d.children.flatMap((c) => (c.status === 'unchanged' ? [] : c.changes.length ? c.changes.map((x) => x.path) : [`${c.family}.${c.ordinal}`])),
  ];
}

export function diffFieldCount(d: Diff): number {
  return d.profile.length + d.root.length + d.children.reduce((n, c) => n + (c.status === 'changed' ? c.changes.length : c.status === 'unchanged' ? 0 : 1), 0);
}
