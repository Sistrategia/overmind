import { describe, expect, it } from 'vitest';
import { SimServer } from '../src/core/server';
import { LINA_KEY, NORTE_KEY } from '../src/core/fixtures';
import { personaByKey } from '../src/core/personas';
import { isProblem, type PhoneChild } from '../src/core/model';
import { liveChildren } from '../src/core/engine';
import type { RevisionRead } from '../src/core/server';

const mariana = personaByKey('mariana');
const tomas = personaByKey('tomas');
const paola = personaByKey('paola');

function fresh(): SimServer { return new SimServer(`test-${Math.random().toString(36).slice(2)}`); }
function rev(s: SimServer, v: number, compare: number | null = null): RevisionRead {
  const r = s.getRevision(LINA_KEY, v, compare, mariana);
  if (isProblem(r)) throw new Error(r.detail);
  return r;
}

describe('seeded history', () => {
  it('Lina is at revision 7 with the expected current state', () => {
    const s = fresh();
    const cur = s.getCurrent(LINA_KEY, mariana);
    if (isProblem(cur)) throw new Error(cur.detail);
    expect(cur.entityVersion).toBe(7);
    const emails = liveChildren(cur, 'email');
    expect(emails.map(e => [e.ordinal, e.displayOrder, e.location])).toEqual([[2, 1, 'Personal'], [1, 2, 'Work']]);
    const phones = liveChildren<PhoneChild>(cur, 'phone');
    expect(phones.map(p => [p.ordinal, p.value.e164, p.extension])).toEqual([[1, '+527773123456', null], [2, '+525551234567', '12']]);
    expect(cur.profile.fullName).toBe('Lina Torres Aguilar');
    expect(cur.profile.displayName).toBe('Lina Torres');
    expect(cur.addresses[0].value.zipCode).toBe('62010');
  });

  it('state at an old revision uses historical values, not current ones', () => {
    const s = fresh();
    const r3 = rev(s, 3);
    expect(r3.state.profile.fullName).toBe('Lina Torres');
    expect(r3.state.phones[0].value.e164).toBe('+527773123456'); // corrected in revision 2
    expect(liveChildren(r3.state, 'email').map(e => e.ordinal)).toEqual([2, 1]);
    const r1 = rev(s, 1);
    expect(r1.state.phones[0].value.e164).toBe('+527773123465'); // the original typo
    expect(r1.state.addresses[0].value.zipCode).toBe('62000');
  });

  it('difference between revisions is separate from the actions during a Save', () => {
    const s = fresh();
    const r5 = rev(s, 5, 4);
    expect(r5.diff?.empty).toBe(true);             // changed and changed back
    expect(r5.actions).toHaveLength(2);            // both actions retained
    expect(r5.actions.map(a => a.kind)).toEqual(['email.replace', 'email.replace']);
    expect(r5.unit.entityVersion).toBe(5);
    expect(BigInt(r5.unit.id) > 9007199254740992n).toBe(true); // Int64 above 2^53 survives as a string
  });

  it('mixed Save produces one revision with three ordered actions and a field-level address diff', () => {
    const s = fresh();
    const r4 = rev(s, 4, 3);
    expect(r4.actions.map(a => a.kind)).toEqual(['profile.replace', 'phone.insert', 'address.replace']);
    expect(r4.actions.map(a => a.ordinal)).toEqual([1, 2, 3]);
    const addr = r4.diff!.children.find(c => c.ref.family === 'address');
    expect(addr?.fields.find(f => f.field === 'address.zipCode')).toMatchObject({ old: '62000', new: '62010' });
    expect(r4.diff!.profile.map(f => f.field).sort()).toEqual(['displayName', 'fullName', 'personLastName2']);
  });

  it('address correction does not touch the other contact sharing the old value', () => {
    const s = fresh();
    const norte = s.getCurrent(NORTE_KEY, mariana);
    if (isProblem(norte)) throw new Error(norte.detail);
    const lina = s.getCurrent(LINA_KEY, mariana);
    if (isProblem(lina)) throw new Error(lina.detail);
    expect(norte.addresses[0].value.zipCode).toBe('62000');
    expect(norte.addresses[0].value.id).not.toBe(lina.addresses[0].value.id);
    expect(s.snapshotAt(LINA_KEY, 3)!.addresses[0].value.id).toBe(norte.addresses[0].value.id); // shared before the correction
  });

  it('deleted then restored child keeps its identity and appends', () => {
    const s = fresh();
    const r6 = rev(s, 6, 5);
    expect(r6.diff!.children).toEqual([expect.objectContaining({ kind: 'removed', ref: { family: 'email', ordinal: 1 } })]);
    expect(liveChildren(r6.state, 'email').map(e => [e.ordinal, e.displayOrder])).toEqual([[2, 1]]);
    const r7 = rev(s, 7, 6);
    expect(r7.diff!.children).toEqual([expect.objectContaining({ kind: 'added', ref: { family: 'email', ordinal: 1 } })]);
    expect(liveChildren(r7.state, 'email').map(e => [e.ordinal, e.displayOrder])).toEqual([[2, 1], [1, 2]]);
  });

  it('history coverage can be unavailable without borrowing current values', () => {
    const s = fresh();
    s.setHistoryUnavailableBelow(2);
    const r = s.getRevision(LINA_KEY, 1, null, mariana);
    expect(isProblem(r) && r.code).toBe('history_unavailable');
    expect(isProblem(s.getRevision(LINA_KEY, 3, 1, mariana))).toBe(true);
    expect(isProblem(s.getRevision(LINA_KEY, 3, 2, mariana))).toBe(false);
  });

  it('personas: auditor reads history but cannot save; front desk gets the directory only', () => {
    const s = fresh();
    expect(isProblem(s.getRevision(LINA_KEY, 4, 3, tomas))).toBe(false);
    const denied = s.save(LINA_KEY, 7, [{ kind: 'email.delete', ordinal: 1 }], tomas);
    expect(isProblem(denied) && denied.status).toBe(403);
    expect(isProblem(s.getCurrent(LINA_KEY, paola)) ).toBe(true);
    const dir = s.getDirectory(LINA_KEY, paola);
    if (isProblem(dir)) throw new Error(dir.detail);
    expect(dir.emails.map(e => e.ordinal)).toEqual([1]);            // personal email is private → hidden
    expect(dir.emails[0].displayOrder).toBe(2);                     // saved order kept, gap preserved
    expect(dir.phones.map(p => p.ordinal)).toEqual([1]);
    expect(isProblem(s.listActivity({}, mariana)) ).toBe(true);   // editors cannot open tenant activity
  });
});
