// Headless editing model shared by the three variants. Each variant renders its own controls; this
// module only knows how to turn field edits into working-state updates with validation messages.
import { useCallback, useMemo, useState } from 'react';
import type { AddressInput, AddressValue, Child, ContactState, Family, PhoneValue, Profile, WebLinkValue } from './types';
import { addChild, moveChild, removeChild, restoreChild, updateChild } from './draft';
import { addressToInput, addressValueOf, validateAddress, validateProfile } from './engine';
import { parsePhone } from './phone';
import { familyKey, isValidEmail, isValidUrl } from './format';
import { useWorkspace } from './store';

export interface PhoneFields {
  number: string;
  defaultRegion: string;
  areaCode: string;
  extension: string;
}

export interface ChannelFields {
  value: string; // email / url
  title: string; // web link
  phone: PhoneFields;
  address: AddressInput;
  location: string;
  isPublic: boolean;
}

export function fieldsFromChild(family: Family, child: Child<unknown> | null): ChannelFields {
  const base: ChannelFields = {
    value: '',
    title: '',
    phone: { number: '', defaultRegion: 'MX', areaCode: '', extension: '' },
    address: { country: 'México' },
    location: '',
    isPublic: false,
  };
  if (!child) return base;
  base.location = child.location ?? '';
  base.isPublic = child.isPublic;
  if (family === 'email') base.value = child.value as string;
  if (family === 'web_link') {
    base.value = (child.value as WebLinkValue).url;
    base.title = (child.value as WebLinkValue).title ?? '';
  }
  if (family === 'phone') {
    const v = child.value as PhoneValue;
    base.phone = { number: v.raw, defaultRegion: v.defaultRegion ?? 'MX', areaCode: v.areaCode ?? '', extension: child.extension ?? '' };
  }
  if (family === 'address') base.address = addressToInput(child.value as AddressValue);
  return base;
}

export interface ChannelValidation {
  ok: boolean;
  message: string | null; // error
  hint: string | null; // interpretation for phones
}

export function validateChannel(family: Family, f: ChannelFields): ChannelValidation {
  if (f.location.length > 100) return { ok: false, message: 'Label is limited to 100 characters.', hint: null };
  switch (family) {
    case 'email':
      if (!f.value.trim()) return { ok: false, message: 'Enter an email address.', hint: null };
      if (!isValidEmail(f.value)) return { ok: false, message: `“${f.value}” is not a valid email address.`, hint: null };
      return { ok: true, message: null, hint: null };
    case 'web_link':
      if (!isValidUrl(f.value)) return { ok: false, message: 'Enter an http(s) URL.', hint: null };
      return { ok: true, message: null, hint: null };
    case 'phone': {
      if (f.phone.extension && !/^\d{1,25}$/.test(f.phone.extension)) return { ok: false, message: 'Extension must be 1–25 digits.', hint: null };
      const p = parsePhone({ number: f.phone.number, defaultRegion: f.phone.defaultRegion || undefined, areaCode: f.phone.areaCode || undefined });
      if (!p.ok) return { ok: false, message: p.reason, hint: null };
      const how =
        p.value.interpretation === 'international'
          ? 'read as a full international number'
          : p.value.interpretation === 'split'
            ? `read as a ${p.value.defaultRegion} number with area code ${p.value.areaCode}`
            : `read as a ${p.value.defaultRegion} national number`;
      return { ok: true, message: null, hint: `Saved as ${p.value.e164} (${p.value.international}), ${how}. Area codes are numbering hints, not the person’s location.` };
    }
    case 'address': {
      const err = validateAddress(f.address);
      return err ? { ok: false, message: err, hint: null } : { ok: true, message: null, hint: 'A correction creates a new shared address value for this contact only; other contacts keep the old value.' };
    }
  }
}

function toChildPatch(family: Family, f: ChannelFields): Partial<Child<unknown>> {
  const location = f.location.trim() || null;
  switch (family) {
    case 'email':
      return { value: f.value.trim(), location, isPublic: f.isPublic, extension: null };
    case 'web_link':
      return { value: { url: f.value.trim(), title: f.title.trim() || null } satisfies WebLinkValue, location, isPublic: f.isPublic, extension: null };
    case 'phone': {
      const p = parsePhone({ number: f.phone.number, defaultRegion: f.phone.defaultRegion || undefined, areaCode: f.phone.areaCode || undefined });
      if (!p.ok) throw new Error(p.reason);
      return { value: p.value, location, isPublic: f.isPublic, extension: f.phone.extension.trim() || null };
    }
    case 'address':
      return { value: addressValueOf(f.address), location, isPublic: f.isPublic, extension: null };
  }
}

/** Editing operations against the workspace draft. Every call starts a draft when needed. */
export function useEditing(contactId: string | null) {
  const ws = useWorkspace();
  const ensure = useCallback(() => (contactId ? ws.beginDraft(contactId) : null), [ws, contactId]);

  const commitChannel = useCallback(
    (family: Family, ordinal: number | null, fields: ChannelFields): string | null => {
      const v = validateChannel(family, fields);
      if (!v.ok) return v.message;
      const d = ensure();
      if (!d) return 'Editing is not allowed for this persona.';
      const patch = toChildPatch(family, fields);
      ws.updateWorking((w) =>
        ordinal === null
          ? addChild(w, family, { value: patch.value, location: patch.location ?? null, isPublic: patch.isPublic ?? false, extension: patch.extension ?? null })
          : updateChild(w, family, ordinal, patch),
      );
      return null;
    },
    [ws, ensure],
  );

  const remove = useCallback(
    (family: Family, ordinal: number) => {
      if (!ensure()) return;
      ws.updateWorking((w) => removeChild(w, family, ordinal));
    },
    [ws, ensure],
  );

  const restore = useCallback(
    (family: Family, ordinal: number) => {
      if (!ensure()) return;
      ws.updateWorking((w) => restoreChild(w, family, ordinal));
    },
    [ws, ensure],
  );

  const makePrimary = useCallback(
    (family: Family, ordinal: number): string | null => {
      if (!ensure()) return 'Editing is not allowed for this persona.';
      return ws.moveWorking(family, ordinal, 1);
    },
    [ws, ensure],
  );

  const move = useCallback(
    (family: Family, ordinal: number, position: number): string | null => {
      if (!ensure()) return 'Editing is not allowed for this persona.';
      return ws.moveWorking(family, ordinal, position);
    },
    [ws, ensure],
  );

  const commitProfile = useCallback(
    (profile: Profile): string | null => {
      const err = validateProfile(profile);
      if (err) return err;
      if (!ensure()) return 'Editing is not allowed for this persona.';
      ws.updateWorking((w) => ({ ...w, profile: { ...profile, displayName: profile.displayName?.trim() || null } }));
      return null;
    },
    [ws, ensure],
  );

  const setLifecycle = useCallback(
    (deleted: boolean) => {
      if (!ensure()) return;
      ws.updateWorking((w) => ({ ...w, deleted }));
    },
    [ws, ensure],
  );

  return { commitChannel, remove, restore, makePrimary, move, commitProfile, setLifecycle, ensure };
}

/** Local field state for one channel form. */
export function useChannelFields(family: Family, child: Child<unknown> | null) {
  const [fields, setFields] = useState<ChannelFields>(() => fieldsFromChild(family, child));
  const validation = useMemo(() => validateChannel(family, fields), [family, fields]);
  const set = useCallback(<K extends keyof ChannelFields>(key: K, value: ChannelFields[K]) => setFields((f) => ({ ...f, [key]: value })), []);
  const setPhone = useCallback((patch: Partial<PhoneFields>) => setFields((f) => ({ ...f, phone: { ...f.phone, ...patch } })), []);
  const setAddress = useCallback((patch: Partial<AddressInput>) => setFields((f) => ({ ...f, address: { ...f.address, ...patch } })), []);
  const reset = useCallback(() => setFields(fieldsFromChild(family, child)), [family, child]);
  return { fields, set, setPhone, setAddress, validation, reset };
}

export function childrenOf(state: ContactState, family: Family): Child<unknown>[] {
  return state[familyKey(family)] as Child<unknown>[];
}

export const LABEL_SUGGESTIONS: Record<Family, string[]> = {
  email: ['Work', 'Personal', 'Billing', 'Sales', 'Other'],
  phone: ['Mobile', 'Office', 'Home', 'Main', 'Warehouse', 'Fax'],
  web_link: ['Website', 'Portfolio', 'Profile'],
  address: ['Home', 'Office', 'Billing', 'Shipping'],
};

export const REGIONS = ['MX', 'US', 'CA', 'ES', 'GB', 'CO', 'AR', 'BR'];
