// SIMULATED phone interpretation for the prototype.
// The real parser (ADR 0009) is libphonenumber-csharp inside command admission on the backend.
// This local version handles the demo cases honestly: full international numbers and Mexican
// local numbers entered with explicit country/area context. It never infers where a person lives.
import type { PhoneInput, PhoneValue } from './types';

interface Plan {
  callingCode: string;
  region: string;
  nsnLength: number[];
  twoDigitAreas?: string[]; // MX: 55, 81, 33 are two-digit destination groups
}

const PLANS: Record<string, Plan> = {
  MX: { callingCode: '52', region: 'MX', nsnLength: [10], twoDigitAreas: ['55', '81', '33'] },
  US: { callingCode: '1', region: 'US', nsnLength: [10] },
  CA: { callingCode: '1', region: 'CA', nsnLength: [10] },
  ES: { callingCode: '34', region: 'ES', nsnLength: [9] },
  GB: { callingCode: '44', region: 'GB', nsnLength: [10] },
  CO: { callingCode: '57', region: 'CO', nsnLength: [10] },
  AR: { callingCode: '54', region: 'AR', nsnLength: [10] },
  BR: { callingCode: '55', region: 'BR', nsnLength: [10, 11] },
};

const BY_CALLING_CODE: [string, Plan][] = Object.values(PLANS)
  .filter((p) => p.region !== 'CA')
  .map((p) => [p.callingCode, p] as [string, Plan])
  .sort((a, b) => b[0].length - a[0].length);

export type PhoneParse = { ok: true; value: PhoneValue } | { ok: false; reason: string };

function groupNsn(plan: Plan, nsn: string): { area: string | null; groups: string[] } {
  if (plan.region === 'MX') {
    const two = nsn.slice(0, 2);
    if (plan.twoDigitAreas?.includes(two)) {
      return { area: two, groups: [two, nsn.slice(2, 6), nsn.slice(6)] };
    }
    return { area: nsn.slice(0, 3), groups: [nsn.slice(0, 3), nsn.slice(3, 6), nsn.slice(6)] };
  }
  if (plan.callingCode === '1') {
    return { area: nsn.slice(0, 3), groups: [nsn.slice(0, 3), nsn.slice(3, 6), nsn.slice(6)] };
  }
  if (plan.region === 'ES') return { area: null, groups: [nsn.slice(0, 3), nsn.slice(3, 6), nsn.slice(6)] };
  return { area: null, groups: [nsn.slice(0, 4), nsn.slice(4)] };
}

export function parsePhone(input: PhoneInput): PhoneParse {
  const raw = (input.number ?? '').trim();
  if (!raw) return { ok: false, reason: 'Enter a phone number.' };
  if (/(ext|x|#)\s*\d+/i.test(raw)) {
    return { ok: false, reason: 'Extensions are separate: put the extension in its own field.' };
  }
  if (/[a-z]/i.test(raw)) return { ok: false, reason: 'Letters are not allowed; use digits only.' };
  const cleaned = raw.replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) return { ok: false, reason: 'Use digits, spaces, dashes or parentheses only.' };

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    const hit = BY_CALLING_CODE.find(([cc]) => digits.startsWith(cc));
    if (!hit) {
      return { ok: false, reason: 'Unrecognized country calling code (the prototype parser knows MX, US, CA, ES, GB, CO, AR, BR).' };
    }
    const [cc, plan] = hit;
    const nsn = digits.slice(cc.length);
    if (!plan.nsnLength.includes(nsn.length)) {
      return { ok: false, reason: `A +${cc} number needs ${plan.nsnLength.join(' or ')} digits after the country code (got ${nsn.length}).` };
    }
    const { groups } = groupNsn(plan, nsn);
    return {
      ok: true,
      value: {
        raw,
        defaultRegion: null,
        areaCode: null,
        e164: `+${cc}${nsn}`,
        national: groups.join(' '),
        international: `+${cc} ${groups.join(' ')}`,
        callingCode: cc,
        interpretation: 'international',
      },
    };
  }

  const region = (input.defaultRegion ?? '').toUpperCase();
  if (!region) return { ok: false, reason: 'A national or local number needs an explicit country.' };
  const plan = PLANS[region];
  if (!plan) return { ok: false, reason: `Country ${region} is not in the prototype numbering table.` };
  const area = (input.areaCode ?? '').replace(/\D/g, '');
  let nsn: string;
  let interpretation: PhoneValue['interpretation'];
  if (area) {
    nsn = area + cleaned;
    interpretation = 'split';
    if (!plan.nsnLength.includes(nsn.length)) {
      return {
        ok: false,
        reason: `Area code ${area} plus the local number must total ${plan.nsnLength.join(' or ')} digits (got ${nsn.length}). Incomplete local input is rejected, not guessed.`,
      };
    }
  } else {
    nsn = cleaned;
    interpretation = 'national';
    if (!plan.nsnLength.includes(nsn.length)) {
      return { ok: false, reason: `A ${region} national number needs ${plan.nsnLength.join(' or ')} digits, or supply the area code separately.` };
    }
  }
  const g = groupNsn(plan, nsn);
  return {
    ok: true,
    value: {
      raw,
      defaultRegion: region,
      areaCode: area || null,
      e164: `+${plan.callingCode}${nsn}`,
      national: g.groups.join(' '),
      international: `+${plan.callingCode} ${g.groups.join(' ')}`,
      callingCode: plan.callingCode,
      interpretation,
    },
  };
}

export function phoneDisplay(v: PhoneValue, extension?: string | null): string {
  return extension ? `${v.international} ext. ${extension}` : v.international;
}

/** Turn a stored value back into the wire input that would reproduce it. */
export function phoneToInput(v: PhoneValue): PhoneInput {
  const input: PhoneInput = { number: v.raw };
  if (v.defaultRegion) input.defaultRegion = v.defaultRegion;
  if (v.areaCode) input.areaCode = v.areaCode;
  return input;
}
