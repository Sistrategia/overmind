import { beforeEach, describe, expect, it } from 'vitest';
import { buildStory, CONTACT_IDS, PERSONAS, personaById } from '../../src/core/fixtures';
import { diffStates } from '../../src/core/diff';
import { liveChildren } from '../../src/core/format';
import { parsePhone } from '../../src/core/phone';
import { LocalServer } from '../../src/core/server';
import { deriveCommands, pendingOf, moveChild, updateChild, addChild } from '../../src/core/draft';
import { askSidekick, type SidekickContext } from '../../src/core/sidekick';
import { cloneState } from '../../src/core/engine';
import { ProblemError, type Draft } from '../../src/core/types';

// Minimal localStorage for the simulated server in node.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const story = buildStory();
const lina = story.revisions[CONTACT_IDS.lina]!;

describe('fixture story', () => {
  it('seeds seven consistent revisions for Lina', () => {
    expect(lina.map((r) => r.entityVersion)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(lina.map((r) => r.actorId)).toEqual(['bruno', 'bruno', 'mariana', 'bruno', 'mariana', 'sofia', 'bruno']);
    for (let i = 1; i < lina.length; i++) expect(BigInt(lina[i]!.unitStamp) > BigInt(lina[i - 1]!.unitStamp)).toBe(true);
  });

  it('revision 2 corrects the mobile number and keeps the identity', () => {
    const d = diffStates(lina[0]!.state, lina[1]!.state);
    const phone = d.children.find((c) => c.family === 'phone' && c.ordinal === 1)!;
    expect(phone.status).toBe('changed');
    expect(phone.changes.map((c) => c.label)).toEqual(['Value']);
    expect(phone.changes[0]!.before).toBe('+52 777 312 3465');
    expect(phone.changes[0]!.after).toBe('+52 777 312 3456');
  });

  it('revision 3 makes the corrected work email primary', () => {
    const emails = liveChildren(lina[2]!.state.emails);
    expect(emails[0]!.ordinal).toBe(2);
    expect(emails[0]!.value).toBe('lina.torres@vertice-demo.mx');
    expect(lina[2]!.actions.map((a) => a.kind)).toEqual(['email.replace', 'email.move']);
    const d = diffStates(lina[1]!.state, lina[2]!.state);
    const personal = d.children.find((c) => c.family === 'email' && c.ordinal === 1)!;
    expect(personal.changes.map((c) => c.label)).toEqual(['Position']);
  });

  it('revision 4 is one unit touching profile, phone and address; the shared address value is untouched elsewhere', () => {
    const rev4 = lina[3]!;
    expect(new Set(rev4.actions.map((a) => a.family))).toEqual(new Set(['profile', 'phone', 'address']));
    const oldValue = lina[2]!.state.addresses[0]!.value.valueId;
    const newValue = rev4.state.addresses[0]!.value.valueId;
    expect(newValue).not.toBe(oldValue);
    const rodrigo = story.revisions[CONTACT_IDS.rodrigo]!;
    expect(rodrigo[rodrigo.length - 1]!.state.addresses[0]!.value.valueId).toBe(oldValue);
  });

  it('revision 5 has an empty diff but two actions', () => {
    const d = diffStates(lina[3]!.state, lina[4]!.state);
    expect(d.isEmpty).toBe(true);
    expect(lina[4]!.actions).toHaveLength(2);
    expect(lina[4]!.actions.map((a) => a.after)).toEqual([
      'linatorres.ag@mail.example (Home, private)',
      'linatorres.ag@mail.example (Personal, private)',
    ]);
  });

  it('revisions 6 and 7 delete and restore the same web link identity', () => {
    expect(liveChildren(lina[5]!.state.webLinks)).toHaveLength(0);
    const restored = liveChildren(lina[6]!.state.webLinks);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.ordinal).toBe(1);
    expect(restored[0]!.value.url).toBe('https://linatorres.example/2026');
    const d = diffStates(lina[5]!.state, lina[6]!.state);
    expect(d.children.find((c) => c.family === 'web_link')!.status).toBe('restored');
  });

  it('separates business, batch, operational, agent and presence sources', () => {
    const sources = new Set(story.units.map((u) => u.source));
    expect(sources).toEqual(new Set(['business', 'batch', 'operational', 'agent', 'presence']));
    const batch = story.units.find((u) => u.source === 'batch')!;
    expect(batch.contacts).toHaveLength(2);
    expect(story.units.filter((u) => u.batchId === batch.batchId && u.source === 'business')).toHaveLength(2);
  });
});

describe('phone parser (simulated)', () => {
  it('interprets a full international number', () => {
    const r = parsePhone({ number: '+52 777 312 3456' });
    expect(r.ok && r.value.e164).toBe('+527773123456');
    expect(r.ok && r.value.international).toBe('+52 777 312 3456');
  });
  it('interprets a Mexican local number with explicit area context', () => {
    const r = parsePhone({ number: '312-3456', defaultRegion: 'MX', areaCode: '777' });
    expect(r.ok && r.value.e164).toBe('+527773123456');
    expect(r.ok && r.value.interpretation).toBe('split');
    const cdmx = parsePhone({ number: '5254 0800', defaultRegion: 'MX', areaCode: '55' });
    expect(cdmx.ok && cdmx.value.international).toBe('+52 55 5254 0800');
  });
  it('rejects incomplete local input and embedded extensions', () => {
    expect(parsePhone({ number: '312-3456', defaultRegion: 'MX' }).ok).toBe(false);
    expect(parsePhone({ number: '312-3456' }).ok).toBe(false);
    expect(parsePhone({ number: '+52 777 312 3456 ext 25' }).ok).toBe(false);
  });
});

describe('simulated server', () => {
  let server: LocalServer;
  const mariana = personaById('mariana');
  const bruno = personaById('bruno');
  const diego = personaById('diego');
  beforeEach(() => {
    localStorage.clear();
    server = new LocalServer('casefile');
  });

  it('rejects a stale Save with 409 and logs an operational entry, never overwriting', () => {
    const before = server.latest(CONTACT_IDS.lina)!;
    server.save(bruno, CONTACT_IDS.lina, { expectedEntityVersion: before.entityVersion, commands: [{ kind: 'phone.replace', ordinal: 2, value: { number: '+52 55 5254 0800' }, location: 'Office', isPublic: false, extension: '23' }] });
    expect(server.latest(CONTACT_IDS.lina)!.entityVersion).toBe(before.entityVersion + 1);
    let problem: ProblemError | null = null;
    try {
      server.save(mariana, CONTACT_IDS.lina, { expectedEntityVersion: before.entityVersion, commands: [{ kind: 'phone.replace', ordinal: 2, value: { number: '+52 55 5254 0800' }, location: 'Office', isPublic: false, extension: '25' }] });
    } catch (e) {
      problem = e as ProblemError;
    }
    expect(problem?.problem.code).toBe('conflict');
    expect(server.latest(CONTACT_IDS.lina)!.state.phones[1]!.extension).toBe('23');
    expect(server.data.units[0]!.source).toBe('operational');
    expect(server.data.units[0]!.kind).toBe('save.rejected');
  });

  it('denies the auditor any write and hides Norte Taller detail from him', () => {
    expect(() => server.save(diego, CONTACT_IDS.lina, { expectedEntityVersion: 7, commands: [{ kind: 'email.delete', ordinal: 1 }] })).toThrow(/does not hold/);
    expect(server.readCurrent(diego, CONTACT_IDS.norte).projection).toBe('directory');
    expect(server.readCurrent(diego, CONTACT_IDS.norte).state.emails.every((e) => e.isPublic)).toBe(true);
    expect(() => server.readRevision(diego, CONTACT_IDS.norte, 1, null, null)).toThrow(/read_history/);
    expect(server.readRevision(diego, CONTACT_IDS.lina, 3, 2, null).diff?.isEmpty).toBe(false);
  });

  it('returns the same revision and a null stamp for an ineffective Save', () => {
    const r = server.save(mariana, CONTACT_IDS.lina, { expectedEntityVersion: 7, commands: [{ kind: 'email.replace', ordinal: 1, value: 'linatorres.ag@mail.example', location: 'Personal', isPublic: false }] });
    expect(r.entityVersion).toBe(7);
    expect(r.dbrowVersion).toBeNull();
  });

  it('keeps a committed revision when the acknowledgement is uncertain', () => {
    expect(() =>
      server.save(mariana, CONTACT_IDS.lina, { expectedEntityVersion: 7, commands: [{ kind: 'email.insert', value: 'lina.alt@mail.example', location: 'Alt' }] }, 'uncertain'),
    ).toThrow(/could not confirm/);
    expect(server.latest(CONTACT_IDS.lina)!.entityVersion).toBe(8);
  });

  it('reports history_unavailable below the coverage boundary', () => {
    expect(() => server.readRevision(mariana, CONTACT_IDS.lina, 2, 1, 4)).toThrow(/coverage/);
    expect(server.readRevision(mariana, CONTACT_IDS.lina, 5, 4, 4).diff?.isEmpty).toBe(true);
  });

  it('rewinds to the rehearsal and replays Bruno as revision 4', () => {
    server.rewindToRehearsal();
    expect(server.latest(CONTACT_IDS.lina)!.entityVersion).toBe(3);
    expect(server.data.units.some((u) => u.source === 'operational')).toBe(false);
  });
});

describe('draft derivation', () => {
  const current = lina[6]!.state;
  it('turns an extension edit plus make-primary into two commands and readable pending text', () => {
    let working = updateChild(cloneState(current), 'phone', 2, { extension: '25' });
    working = moveChild(working, 'email', 1, 1).state;
    const commands = deriveCommands(current, working);
    expect(commands.map((c) => c.kind)).toEqual(['phone.replace', 'email.move']);
    const draft: Draft = { contactId: CONTACT_IDS.lina, baseVersion: 7, base: current, working, startedAt: '', origin: 'user' };
    const pending = pendingOf(draft).pending;
    expect(pending[0]!.text).toMatch(/extension 22 → 25/);
    expect(pending[1]!.text).toMatch(/Make email · personal .* primary/i);
  });
  it('refuses to make a new unsaved entry primary and explains why', () => {
    const working = addChild(cloneState(current), 'email', { value: 'new@mail.example', location: 'Other', isPublic: false, extension: null });
    const r = moveChild(working, 'email', -1, 1);
    expect(r.error).toMatch(/Save first/);
    expect(deriveCommands(current, working).map((c) => c.kind)).toEqual(['email.insert']);
  });
});

describe('sidekick', () => {
  const base = (persona = personaById('mariana')): SidekickContext => ({
    persona,
    contactId: CONTACT_IDS.lina,
    contactName: 'Lina Torres',
    revisions: lina,
    selectedRevision: null,
    compareRevision: null,
    filters: null,
    draft: null,
    units: story.units,
    canActivity: true,
    today: '2026-09-07',
    contacts: [{ id: CONTACT_IDS.lina, name: 'Lina Torres' }],
    selectedPhoneOrdinal: null,
  });
  it('summarizes this week with references to the actual revisions', () => {
    const r = askSidekick("What changed in Lina's contact this week?", base());
    expect(r.refs.map((x) => (x.kind === 'revision' ? x.version : 0))).toEqual([2, 3, 4, 5, 6, 7]);
    expect(r.text).toMatch(/no net change/);
    expect(r.bounded).toBe(false);
  });
  it("sets activity filters for Bruno's phone changes", () => {
    const r = askSidekick("Show Bruno's phone changes", base());
    const f = r.actions.find((a) => a.kind === 'filters');
    expect(f && f.kind === 'filters' && f.filters.actor).toBe('bruno');
    expect(f && f.kind === 'filters' && f.filters.family).toBe('phone');
    expect(r.refs.length).toBe(3);
  });
  it('stages a two-command proposal and respects the auditor grant', () => {
    const r = askSidekick('Change this extension to 25 and make the work email primary', { ...base(), revisions: lina.slice(0, 2) });
    const p = r.actions.find((a) => a.kind === 'proposal');
    expect(p && p.kind === 'proposal' && p.commands.map((c) => c.kind)).toEqual(['phone.replace', 'email.move']);
    const denied = askSidekick('Change this extension to 25', base(personaById('diego')));
    expect(denied.bounded).toBe(true);
    expect(denied.actions).toHaveLength(0);
  });
  it('answers unsupported questions with a bounded reply', () => {
    const r = askSidekick('What is the weather in Cuernavaca?', base());
    expect(r.bounded).toBe(true);
    expect(r.refs).toHaveLength(0);
  });
  it('explains the empty diff of revision 5', () => {
    const r = askSidekick('Why is the revision 5 diff empty?', base());
    expect(r.text).toMatch(/difference is empty/);
    expect(r.actions[0]!.kind).toBe('navigate');
  });
});

describe('personas', () => {
  it('gives every persona distinct allowed actions', () => {
    const grants = PERSONAS.map((p) => p.grants.join(','));
    expect(new Set(grants).size).toBe(3); // Mariana and Bruno share the editor profile
    expect(personaById('sofia').grants).toContain('delete:*');
    expect(personaById('diego').grants.some((g) => g.startsWith('edit'))).toBe(false);
  });
});
