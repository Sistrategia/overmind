// SIMULATED phone parser. The production backend uses libphonenumber-csharp 9.0.38 inside
// command admission (docs/phone-family.md). This local stand-in recognises a handful of
// calling codes well enough to demonstrate interpretation, and rejects what it cannot read.
import type { PhoneInput, PhoneValue } from './model';

export const PHONE_PARSER_ID = 'prototype-sim/1 (production: libphonenumber-csharp 9.0.38)';

interface Plan { code: string; region: string; nationalLength: number[]; name: string }
const PLANS: Plan[] = [
  { code: '52', region: 'MX', nationalLength: [10], name: 'Mexico numbering plan' },
  { code: '1', region: 'US/CA', nationalLength: [10], name: 'North American numbering plan' },
  { code: '34', region: 'ES', nationalLength: [9], name: 'Spain numbering plan' },
  { code: '44', region: 'GB', nationalLength: [10], name: 'United Kingdom numbering plan' },
  { code: '57', region: 'CO', nationalLength: [10], name: 'Colombia numbering plan' },
  { code: '54', region: 'AR', nationalLength: [10], name: 'Argentina numbering plan' }
];

export interface PhoneParseOk { ok: true; value: PhoneValue; notes: string[] }
export interface PhoneParseError { ok: false; error: string; notes: string[] }
export type PhoneParse = PhoneParseOk | PhoneParseError;

function digitsOnly(s: string): string { return s.replace(/[^0-9]/g, ''); }
function mxGroup(national: string): string {
  return ['55', '56', '33', '81'].some(g => national.startsWith(g)) ? national.slice(0, 2) : national.slice(0, 3);
}

export function parsePhone(input: PhoneInput): PhoneParse {
  const raw = (input.number ?? '').trim();
  const notes: string[] = [];
  if (!raw) return { ok: false, error: 'Enter a phone number.', notes };
  if (/[a-zA-Z]/.test(raw)) return { ok: false, error: 'Letters are not accepted; vanity numbers are not supported.', notes };
  if (/[#,;]/.test(raw)) return { ok: false, error: 'Put the extension in its own field.', notes };

  const international = raw.startsWith('+') || raw.startsWith('00');
  if (international) {
    const digits = digitsOnly(raw.startsWith('00') ? raw.slice(2) : raw);
    const plan = PLANS.find(p => digits.startsWith(p.code) && p.nationalLength.includes(digits.length - p.code.length));
    if (plan) {
      const national = digits.slice(plan.code.length);
      notes.push(`International input: calling code +${plan.code} (${plan.name}).`);
      if (plan.region === 'MX') {
        const group = mxGroup(national);
        notes.push(`Destination group ${group} is a numbering hint, not a residence.`);
        return { ok: true, notes, value: { e164: `+${digits}`, callingCode: plan.code, nationalNumber: national, numberingRegion: 'MX', destinationGroup: group, rawInput: raw, parser: PHONE_PARSER_ID } };
      }
      return { ok: true, notes, value: { e164: `+${digits}`, callingCode: plan.code, nationalNumber: national, numberingRegion: plan.region === 'US/CA' ? null : plan.region, destinationGroup: null, rawInput: raw, parser: PHONE_PARSER_ID } };
    }
    const knownPrefix = PLANS.find(p => digits.startsWith(p.code));
    if (knownPrefix) return { ok: false, error: `A +${knownPrefix.code} number needs ${knownPrefix.nationalLength[0]} national digits (got ${digits.length - knownPrefix.code.length}).`, notes };
    const m = /^(\d{1,3})(\d{6,12})$/.exec(digits);
    if (m && digits.length >= 8 && digits.length <= 15) {
      notes.push('Calling code not in the simulated table; accepted as a generic international number.');
      return { ok: true, notes, value: { e164: `+${digits}`, callingCode: m[1], nationalNumber: m[2], numberingRegion: null, destinationGroup: null, rawInput: raw, parser: PHONE_PARSER_ID } };
    }
    return { ok: false, error: 'Not a complete international number.', notes };
  }

  // National or split input needs explicit region context (ADR 0009: no inference from addresses).
  const region = (input.defaultRegion ?? '').toUpperCase();
  if (!region) return { ok: false, error: 'A national number needs a country context (for example MX).', notes };
  const plan = PLANS.find(p => p.region === region);
  if (!plan) return { ok: false, error: `Region ${region} is not in the simulated parser.`, notes };
  let national = digitsOnly(raw);
  const area = digitsOnly(input.areaCode ?? '');
  if (area) {
    national = area + national;
    notes.push(`Split input: area ${area} + local ${digitsOnly(raw)} under ${region} context.`);
  } else {
    notes.push(`National input under ${region} context.`);
  }
  if (plan.region === 'MX' && national.length === 11 && national.startsWith('1')) {
    national = national.slice(1);
    notes.push('Legacy mobile prefix 1 removed (not dialled since 2019).');
  }
  if (!plan.nationalLength.includes(national.length)) {
    return {
      ok: false, notes,
      error: area
        ? `Area plus local number must be ${plan.nationalLength[0]} digits (got ${national.length}).`
        : `A ${region} national number needs ${plan.nationalLength[0]} digits, or an area code.`
    };
  }
  let group: string | null = null;
  if (plan.region === 'MX') {
    group = mxGroup(national);
    notes.push(`Destination group ${group} is a numbering hint, not a residence.`);
  }
  return { ok: true, notes, value: { e164: `+${plan.code}${national}`, callingCode: plan.code, nationalNumber: national, numberingRegion: plan.region === 'US/CA' ? null : plan.region, destinationGroup: group, rawInput: raw, parser: PHONE_PARSER_ID } };
}

/** Display formatting only; never used as identity. */
export function formatPhone(v: PhoneValue): string {
  if (v.callingCode === '52' && v.nationalNumber.length === 10) {
    const g = v.destinationGroup ?? mxGroup(v.nationalNumber);
    const rest = v.nationalNumber.slice(g.length);
    const mid = rest.length === 8 ? `${rest.slice(0, 4)} ${rest.slice(4)}` : `${rest.slice(0, 3)} ${rest.slice(3)}`;
    return `+52 ${g} ${mid}`;
  }
  if (v.callingCode === '1' && v.nationalNumber.length === 10) {
    return `+1 (${v.nationalNumber.slice(0, 3)}) ${v.nationalNumber.slice(3, 6)}-${v.nationalNumber.slice(6)}`;
  }
  return `+${v.callingCode} ${v.nationalNumber}`;
}
