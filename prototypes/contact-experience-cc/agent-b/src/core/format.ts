import type { AddressValue, Child, ContactState, Family, PhoneValue, WebLinkValue } from './types';
import { phoneDisplay } from './phone';

export const TZ = 'America/Mexico_City';
export const TZ_LABEL = 'CDMX (UTC−6)';

const dt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const dOnly = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
const dLong = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const tOnly = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const utc = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const fmt = {
  dateTime: (iso: string) => dt.format(new Date(iso)),
  date: (iso: string) => dOnly.format(new Date(iso)),
  dateLong: (iso: string) => dLong.format(new Date(iso)),
  time: (iso: string) => tOnly.format(new Date(iso)),
  utc: (iso: string) => `${utc.format(new Date(iso))} UTC`,
  /** YYYY-MM-DD in the tenant zone, used for day grouping and range filters. */
  ymd: (iso: string) => ymd.format(new Date(iso)),
  relative(iso: string, now = Date.now()): string {
    const diff = now - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    if (d === 1) return 'yesterday';
    if (d < 7) return `${d} days ago`;
    return dOnly.format(new Date(iso));
  },
};

export function addressLines(a: AddressValue): string[] {
  const lines: string[] = [];
  if (a.streetName) {
    lines.push([a.streetName, a.extNumber, a.intNumber ? `Int. ${a.intNumber}` : null].filter(Boolean).join(' '));
  }
  if (a.address1) lines.push(a.address1);
  if (a.address2) lines.push(a.address2);
  const cityLine = [a.colony ? `Col. ${a.colony}` : null, a.city].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  const stateLine = [a.state, a.zipCode].filter(Boolean).join(' ');
  if (stateLine) lines.push(stateLine);
  if (a.country) lines.push(a.country);
  return lines;
}

export function addressOneLine(a: AddressValue): string {
  return addressLines(a).join(', ');
}

export function childDisplay(family: Family, child: Child<unknown>): string {
  switch (family) {
    case 'email':
      return child.value as string;
    case 'phone':
      return phoneDisplay(child.value as PhoneValue, child.extension);
    case 'web_link': {
      const v = child.value as WebLinkValue;
      return v.title ? `${v.title} · ${v.url}` : v.url;
    }
    case 'address':
      return addressOneLine(child.value as AddressValue);
  }
}

export const FAMILY_LABEL: Record<Family, string> = {
  email: 'Email',
  phone: 'Phone',
  web_link: 'Web link',
  address: 'Address',
};

export const FAMILY_PLURAL: Record<Family, string> = {
  email: 'Emails',
  phone: 'Phones',
  web_link: 'Web links',
  address: 'Addresses',
};

export function childLabel(family: Family, child: Child<unknown>): string {
  return child.location ? `${FAMILY_LABEL[family]} · ${child.location}` : FAMILY_LABEL[family];
}

export function familyKey(family: Family): keyof Pick<ContactState, 'emails' | 'phones' | 'webLinks' | 'addresses'> {
  return family === 'email' ? 'emails' : family === 'phone' ? 'phones' : family === 'web_link' ? 'webLinks' : 'addresses';
}

export function liveChildren<T>(children: Child<T>[]): Child<T>[] {
  return children.filter((c) => !c.deleted).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function displayNameOf(state: ContactState): string {
  return state.profile.displayName || state.profile.fullName;
}

export function categoryOf(state: ContactState): 'Person' | 'Organization' {
  return state.profile.contactTypeId === 1 ? 'Person' : 'Organization';
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function shortStamp(stamp: string): string {
  return stamp.length > 6 ? `…${stamp.slice(-6)}` : stamp;
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
