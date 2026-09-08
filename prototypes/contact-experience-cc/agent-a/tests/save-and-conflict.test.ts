import { describe, expect, it } from 'vitest';
import { SimServer } from '../src/core/server';
import { LINA_KEY } from '../src/core/fixtures';
import { personaByKey } from '../src/core/personas';
import { isProblem, type ContactState } from '../src/core/model';
import { applyReconciliation, draftCommands, emptyDraft, fieldsOf, projectDraft, reconcile, stageChildMove, stageChildReplace, stageProfile } from '../src/core/draft';
import { liveChildren } from '../src/core/engine';

const mariana = personaByKey('mariana');
const bruno = personaByKey('bruno');

function fresh(): SimServer { return new SimServer(`test-${Math.random().toString(36).slice(2)}`); }
function current(s: SimServer): ContactState { const c = s.getCurrent(LINA_KEY, mariana); if (isProblem(c)) throw new Error(c.detail); return c; }

describe('Save contract', () => {
  it('one Save with three commands makes exactly one new revision', () => {
    const s = fresh();
    const base = current(s);
    let d = emptyDraft(LINA_KEY, base.entityVersion);
    d = stageProfile(d, base, { ...base.profile, personAlias: 'Lina T.' });
    d = stageChildReplace(d, base, { family: 'phone', ordinal: 2 }, { ...fieldsOf(base.phones[1]), extension: '25' });
    d = stageChildMove(d, base, { family: 'email', ordinal: 1 }, 1);
    const r = s.save(LINA_KEY, base.entityVersion, draftCommands(d), mariana);
    if (isProblem(r)) throw new Error(r.detail);
    expect(r.entityVersion).toBe(8);
    expect(r.auditDbrowVersion).not.toBeNull();
    const after = current(s);
    expect(after.entityVersion).toBe(8);
    expect(liveChildren(after, 'email').map(e => e.ordinal)).toEqual([1, 2]);
    expect(after.phones[1].extension).toBe('25');
    expect(after.phones[1].ordinal).toBe(2); // identity preserved through the edit
    const unit = s.unitsFor(LINA_KEY).at(-1)!;
    expect(unit.actions.map(a => a.kind)).toEqual(['profile.replace', 'phone.replace', 'email.move']);
  });

  it('a failing last command rolls back the whole Save', () => {
    const s = fresh();
    const base = current(s);
    const r = s.save(LINA_KEY, base.entityVersion, [
      { kind: 'profile.replace', profile: { ...base.profile, personAlias: 'X' } },
      { kind: 'email.replace', ordinal: 2, value: 'not-an-email', location: 'Personal', isPublic: false }
    ], mariana);
    expect(isProblem(r) && r.code).toBe('validation');
    expect(isProblem(r) && r.commandIndex).toBe(1);
    expect(current(s).entityVersion).toBe(7);
    expect(current(s).profile.personAlias).toBeNull();
  });

  it('an ineffective Save returns the same revision and a null stamp', () => {
    const s = fresh();
    const base = current(s);
    const r = s.save(LINA_KEY, 7, [{ kind: 'email.replace', ordinal: 2, value: base.emails[1].value, location: 'Personal', isPublic: false }], mariana);
    if (isProblem(r)) throw new Error(r.detail);
    expect(r.entityVersion).toBe(7);
    expect(r.auditDbrowVersion).toBeNull();
    expect(s.unitsFor(LINA_KEY)).toHaveLength(7);
  });

  it('staging back to the base value removes the pending command', () => {
    const s = fresh();
    const base = current(s);
    let d = emptyDraft(LINA_KEY, 7);
    d = stageChildReplace(d, base, { family: 'phone', ordinal: 2 }, { ...fieldsOf(base.phones[1]), extension: '25' });
    expect(d.items).toHaveLength(1);
    d = stageChildReplace(d, base, { family: 'phone', ordinal: 2 }, fieldsOf(base.phones[1]));
    expect(d.items).toHaveLength(0);
  });
});

describe('stale Save and reconciliation', () => {
  it('Mariana\'s stale Save conflicts after Bruno commits; her draft survives and merges field by field', () => {
    const s = fresh();
    const base = current(s); // revision 7
    let d = emptyDraft(LINA_KEY, 7);
    d = stageChildReplace(d, base, { family: 'phone', ordinal: 2 }, { ...fieldsOf(base.phones[1]), extension: '25' });

    // Bruno relabels the same phone and saves revision 8.
    const b = s.save(LINA_KEY, 7, [{ kind: 'phone.replace', ordinal: 2, value: { number: '+52 55 5123 4567' }, location: 'Oficina', isPublic: false, extension: '12' }], bruno);
    if (isProblem(b)) throw new Error(b.detail);
    expect(b.entityVersion).toBe(8);

    const stale = s.save(LINA_KEY, 7, draftCommands(d), mariana);
    expect(isProblem(stale) && stale.code).toBe('conflict');
    expect(isProblem(stale) && stale.currentEntityVersion).toBe(8);
    expect(current(s).phones[1].location).toBe('Oficina'); // Bruno's edit untouched

    const now = current(s);
    const report = reconcile(d, base, now, s.unitsFor(LINA_KEY).filter(u => u.entityVersion > 7));
    expect(report.items[0].status).toBe('merged');
    expect(report.hasConflicts).toBe(false);
    const rebased = applyReconciliation(report, d, {});
    expect(rebased.baseVersion).toBe(8);
    const cmd = rebased.items[0].command as { location: string; extension: string };
    expect(cmd.location).toBe('Oficina');
    expect(cmd.extension).toBe('25');

    const ok = s.save(LINA_KEY, 8, draftCommands(rebased), mariana);
    if (isProblem(ok)) throw new Error(ok.detail);
    expect(ok.entityVersion).toBe(9);
    expect(current(s).phones[1]).toMatchObject({ location: 'Oficina', extension: '25', ordinal: 2 });
  });

  it('same-field conflict requires an explicit choice and never silently overwrites', () => {
    const s = fresh();
    const base = current(s);
    let d = emptyDraft(LINA_KEY, 7);
    d = stageChildReplace(d, base, { family: 'phone', ordinal: 2 }, { ...fieldsOf(base.phones[1]), extension: '25' });
    s.save(LINA_KEY, 7, [{ kind: 'phone.replace', ordinal: 2, value: { number: '+52 55 5123 4567' }, location: 'Office', isPublic: false, extension: '30' }], bruno);
    const report = reconcile(d, base, current(s), s.unitsFor(LINA_KEY).filter(u => u.entityVersion > 7));
    expect(report.hasConflicts).toBe(true);
    expect(report.items[0].conflicts).toEqual([expect.objectContaining({ field: 'extension', mine: '25', theirs: '30' })]);
    const takeTheirs = applyReconciliation(report, d, { [d.items[0].id]: 'theirs' });
    expect(takeTheirs.items).toHaveLength(0);
    const keepMine = applyReconciliation(report, d, { [d.items[0].id]: 'mine' });
    expect((keepMine.items[0].command as { extension: string }).extension).toBe('25');
  });

  it('projection reports per-command problems without losing the rest of the draft', () => {
    const s = fresh();
    const base = current(s);
    let d = emptyDraft(LINA_KEY, 7);
    d = stageChildReplace(d, base, { family: 'email', ordinal: 2 }, { ...fieldsOf(base.emails[1]), value: 'broken' });
    d = stageChildReplace(d, base, { family: 'phone', ordinal: 2 }, { ...fieldsOf(base.phones[1]), extension: '25' });
    const p = projectDraft(base, d, s.catalog());
    expect(p.problems).toHaveLength(1);
    expect(p.state.phones[1].extension).toBe('25');
    expect(p.pending.children.map(c => c.ref)).toEqual([{ family: 'phone', ordinal: 2 }]);
  });
});
