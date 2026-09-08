import { describe, expect, it } from 'vitest';
import { formatPhone, parsePhone } from '../src/core/phone';

describe('simulated phone parser', () => {
  it('reads a full international Mexican number', () => {
    const p = parsePhone({ number: '+52 777 312 3456' });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.e164).toBe('+527773123456');
    expect(p.value.destinationGroup).toBe('777');
    expect(p.value.numberingRegion).toBe('MX');
    expect(formatPhone(p.value)).toBe('+52 777 312 3456');
    expect(p.notes.join(' ')).toMatch(/not a residence/);
  });
  it('reads a Mexican local number only with country and area context', () => {
    expect(parsePhone({ number: '312 3456' }).ok).toBe(false);
    expect(parsePhone({ number: '312 3456', defaultRegion: 'MX' }).ok).toBe(false);
    const split = parsePhone({ number: '312-3456', defaultRegion: 'MX', areaCode: '777' });
    expect(split.ok && split.value.e164).toBe('+527773123456');
    const national = parsePhone({ number: '55 5123 4567', defaultRegion: 'MX' });
    expect(national.ok && national.value.destinationGroup).toBe('55');
  });
  it('rejects letters, embedded extensions and incomplete numbers', () => {
    expect(parsePhone({ number: '+52 777 CALL' }).ok).toBe(false);
    expect(parsePhone({ number: '+52 777 312 3456 #25' }).ok).toBe(false);
    expect(parsePhone({ number: '+52 777 312' }).ok).toBe(false);
  });
  it('accepts other plans and generic international input', () => {
    const us = parsePhone({ number: '+1 (415) 555-0134' });
    expect(us.ok && formatPhone(us.value)).toBe('+1 (415) 555-0134');
    expect(parsePhone({ number: '+34 912 345 678' }).ok).toBe(true);
    expect(parsePhone({ number: '+998 71 234 5678' }).ok).toBe(true);
  });
});
