// Strata building blocks: the revision axis, contact cards, Then/Now compare, action steps,
// activity swimlanes and the unit panel.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeItem, fieldsOf } from '../../core/draft';
import { childTitle, childValueText, liveChildren } from '../../core/engine';
import { fmtDate, fmtDayMonth, fmtTime, tzDateKey } from '../../core/format';
import type { Action, AuditUnit, Child, ChildRef, ContactState, Family, PhoneChild, Profile, RevisionDiff } from '../../core/model';
import { childKey, FAMILIES, FAMILY_LABEL, FAMILY_LABEL_PLURAL, PROFILE_FIELD_LABEL, PROFILE_FIELDS } from '../../core/model';
import { actorShort, PERSONAS, SYSTEM_ACTOR } from '../../core/personas';
import type { ActivityItem } from '../../core/server';
import { useWorkspace } from '../../core/workspace';
import { ActionsList, UnitMeta, When } from '../../shared/evidence';
import { ChildForm } from '../../shared/fields';
import { Avatar, Badge, DiffMark, DiffValue, TechDetails } from '../../shared/ui';
import type { ContactWorkspace } from '../../shared/use-contact-workspace';

// ---- axis ------------------------------------------------------------------------------

export interface AxisTick { rev: number; at: string; actorKey: string; summary: string; draft?: boolean }

export function Axis({ ticks, at, base, onAt, onBase, draftCount }: { ticks: AxisTick[]; at: number; base: number | null; onAt: (rev: number) => void; onBase: (rev: number) => void; draftCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const n = ticks.length;
  const step = Math.max(130, Math.min(200, 1000 / Math.max(1, n)));
  const width = Math.max(step * (n + 0.5), 400);
  const x = (i: number) => step * (i + 0.5);
  const lo = base !== null ? Math.min(base, at) : at, hi = Math.max(base ?? at, at);
  const idx = (rev: number) => ticks.findIndex(t => t.rev === rev);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('.tick.at')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [at]);
  const onKey = (e: React.KeyboardEvent) => {
    const i = idx(at);
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); onAt(ticks[i - 1].rev); }
    else if (e.key === 'ArrowRight' && i < n - 1) { e.preventDefault(); onAt(ticks[i + 1].rev); }
    else if (e.key === 'b' && i > 0) onBase(ticks[i - 1].rev);
  };
  const draftIdx = ticks.findIndex(t => t.draft);
  return (
    <div className="axis" ref={ref} role="group" aria-label="Revision axis" tabIndex={0} onKeyDown={onKey} data-testid="axis">
      <div style={{ position: 'relative', width, height: '100%' }}>
        <div className="line" />
        {base !== null && idx(lo) >= 0 && idx(hi) >= 0 && <div className="between" style={{ left: x(idx(lo)), width: x(idx(hi)) - x(idx(lo)) }} />}
        {draftIdx > 0 && <div className="draft-link" style={{ left: x(draftIdx - 1), width: x(draftIdx) - x(draftIdx - 1) }} />}
        {ticks.map((t, i) => (
          <button key={t.draft ? 'draft' : t.rev} className={`tick ${t.rev === at ? 'at' : ''} ${t.rev === base ? 'base' : ''} ${t.rev > lo && t.rev < hi ? 'range' : ''} ${t.draft ? 'draft' : ''}`} style={{ left: x(i) }}
            onClick={e => (e.shiftKey && !t.draft ? onBase(t.rev) : onAt(t.rev))} data-testid={t.draft ? 'tick-draft' : `rev-${t.rev}`} aria-pressed={t.rev === at}
            title={t.draft ? `Draft: ${draftCount} pending change${draftCount === 1 ? '' : 's'} not yet saved` : `Revision ${t.rev} · ${actorShort(t.actorKey)} · ${t.summary}. Click to view, Shift+click to compare from here.`}>
            <span className="when">{t.draft ? 'not saved' : `${fmtDayMonth(t.at)} ${fmtTime(t.at)}`}</span>
            <span className="lbl">{t.draft ? `r${t.rev} draft` : `r${t.rev}`}</span>
            <span className="dot" />
            <span className="who">{t.draft ? <span>{draftCount} pending</span> : <><Avatar actorKey={t.actorKey} /><span>{actorShort(t.actorKey)}</span></>}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- cards --------------------------------------------------------------------------------

function ItemRow({ child, family, live, cw, readOnly, pending, diffFor, highlight, editing, onEdit, removed, focused }: {
  child: Child; family: Family; live: number; cw: ContactWorkspace | null; readOnly: boolean; pending: boolean; diffFor?: (ref: ChildRef) => RevisionDiff['children'][number] | undefined; highlight: boolean; editing: boolean; onEdit: () => void; removed?: boolean; focused?: boolean;
}) {
  const ref = { family, ordinal: child.ordinal };
  const d = diffFor?.(ref);
  const phone = child as PhoneChild;
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focused) el.current?.focus(); }, [focused]);
  const canAct = !readOnly && !removed && cw?.canEdit;
  return (
    <>
      <div ref={el} className={`item ${pending ? 'pending' : ''} ${highlight ? 'hi' : ''} ${removed ? 'removed' : ''}`} tabIndex={0} data-testid={`row-${childKey(ref)}`} data-target={childKey(ref)}
        onKeyDown={e => { if (!canAct) return; if (e.key === 'Enter' || e.key === 'e') { e.preventDefault(); onEdit(); } else if (e.key === 'p' && child.displayOrder !== 1) cw!.stage.move(ref, 1); else if (e.key === 'Delete') cw!.stage.remove(ref); }}
        onDoubleClick={() => canAct && onEdit()}>
        <span className={`pos ${child.displayOrder === 1 && !removed && live > 1 ? 'primary' : ''}`} title={`Saved position ${child.displayOrder ?? '—'} · identity ${child.ordinal}`}>{removed ? '×' : child.displayOrder}</span>
        <span className="main">
          <span className="v">{family === 'phone' ? childValueText({ ...phone, extension: null } as Child) : childValueText(child)}{family === 'phone' && phone.extension && <span className="muted"> ext. {phone.extension}</span>}</span>
          <span className="meta">
            <span>{child.location ?? 'no label'}</span>
            {child.displayOrder === 1 && !removed && live > 1 && <Badge tone="accent">Primary</Badge>}
            {!child.isPublic && <span title="Private: not in the directory">🔒 private</span>}
            {pending && <Badge tone="pending">pending</Badge>}
            {removed && <Badge tone="danger">removed in this revision</Badge>}
            {d?.kind === 'added' && <Badge tone="ok">added</Badge>}
            {d?.kind === 'changed' && <DiffMark kind={d.fields.every(f => f.field === 'displayOrder') ? 'moved' : 'changed'} />}
          </span>
        </span>
        <span className="acts">
          {canAct && <><button className="btn quiet sm" onClick={onEdit} data-testid="row-edit">Edit</button>{child.displayOrder !== 1 && <button className="btn quiet sm" onClick={() => cw!.stage.move(ref, 1)} data-testid="row-primary">Make primary</button>}<button className="btn quiet icon sm" onClick={() => cw!.stage.move(ref, Math.max(1, (child.displayOrder ?? 1) - 1))} disabled={child.displayOrder === 1} aria-label="Move up">↑</button><button className="btn quiet icon sm" onClick={() => cw!.stage.move(ref, Math.min(live, (child.displayOrder ?? 1) + 1))} disabled={child.displayOrder === live} aria-label="Move down">↓</button><button className="btn quiet icon sm" onClick={() => cw!.stage.remove(ref)} aria-label="Remove">🗑</button></>}
        </span>
        {d?.kind === 'changed' && d.fields.filter(f => !f.technical).length > 0 && <span className="then-now" data-testid="row-diff">{d.fields.filter(f => !f.technical).map(f => <span key={f.field}><span className="muted">{f.label}:</span> <DiffValue oldValue={f.old} newValue={f.new} /></span>)}</span>}
      </div>
      {editing && cw && (
        <div className="item-form">
          <ChildForm family={family} initial={fieldsOf(child)} compact onSubmit={f => { cw.stage.replace(ref, f); onEdit(); }} onCancel={onEdit}
            extra={child.family === 'address' ? <AddressInspector cw={cw} valueId={child.value.id} /> : undefined} />
        </div>
      )}
    </>
  );
}

function AddressInspector({ cw, valueId }: { cw: ContactWorkspace; valueId: string }) {
  const users = cw.ws.server.addressValueUsers(valueId).filter(u => u.key !== cw.contactKey);
  return <TechDetails summary="Inspector: shared address value" rows={[['value id', valueId], ['also referenced by', users.length ? `${users.map(u => u.displayName).join(', ')} (shared value, no relationship implied)` : 'no other current contact'], ['on correction', 'this association selects or creates a new value; others keep this one']]} />;
}

export function FamilyCard({ family, state, cw, readOnly, diff, editingKey, setEditingKey, adding, setAdding, highlight, focusKey }: {
  family: Family; state: ContactState; cw: ContactWorkspace | null; readOnly: boolean; diff: RevisionDiff | null; editingKey: string | null; setEditingKey: (k: string | null) => void; adding: Family | null; setAdding: (f: Family | null) => void; highlight: Set<string>; focusKey: string | null;
}) {
  const live = liveChildren(state, family);
  const removed = (diff?.children ?? []).filter(c => c.ref.family === family && c.kind === 'removed').map(c => c.old!);
  const pendingKeys = cw?.projection?.touched ?? new Set<string>();
  const diffFor = (ref: ChildRef) => diff?.children.find(c => c.ref.family === ref.family && c.ref.ordinal === ref.ordinal);
  const deletedBase = !readOnly && cw?.base ? (cw.base[family === 'email' ? 'emails' : family === 'phone' ? 'phones' : family === 'web_link' ? 'webLinks' : 'addresses'] as Child[]).filter(c => c.deleted && !live.some(l => l.ordinal === c.ordinal)) : [];
  const anyPending = live.some(c => pendingKeys.has(childKey({ family, ordinal: c.ordinal })));
  return (
    <section className={`card ${anyPending ? 'pending' : ''}`} aria-labelledby={`card-${family}`} data-testid={`section-${family}`}>
      <header><h2 id={`card-${family}`}>{FAMILY_LABEL_PLURAL[family]}</h2><span className="tiny faint">{live.length}</span><span className="grow" />{!readOnly && cw?.canEdit && adding !== family && <button className="btn quiet sm" onClick={() => { setEditingKey(null); setAdding(family); }} data-testid={`add-${family}`}>＋ Add</button>}</header>
      <div className="body">
        {live.length === 0 && removed.length === 0 && <span className="faint small">None</span>}
        {live.map(c => { const k = childKey({ family, ordinal: c.ordinal }); return <ItemRow key={c.ordinal} child={c} family={family} live={live.length} cw={cw} readOnly={readOnly} pending={pendingKeys.has(k)} diffFor={diffFor} highlight={highlight.has(k)} editing={editingKey === k} onEdit={() => setEditingKey(editingKey === k ? null : k)} focused={focusKey === k} />; })}
        {removed.map(c => <ItemRow key={`r${c.ordinal}`} child={c} family={family} live={live.length} cw={null} readOnly pending={false} highlight={false} editing={false} onEdit={() => undefined} removed />)}
        {deletedBase.map(c => (
          <div key={`d${c.ordinal}`} className="item removed" data-testid={`row-deleted-${childKey({ family, ordinal: c.ordinal })}`}>
            <span className="pos">×</span>
            <span className="main"><span className="v">{childValueText(c)}</span><span className="meta"><Badge tone="hist">removed earlier · identity {c.ordinal} retained</Badge></span></span>
            <span>{cw?.canEdit && <button className="btn sm" onClick={() => cw.stage.restore({ family, ordinal: c.ordinal }, fieldsOf(c))} data-testid="row-restore">Restore</button>}</span>
          </div>
        ))}
        {!readOnly && adding === family && cw && <div className="item-form"><ChildForm family={family} initial={null} compact submitLabel={`Add ${FAMILY_LABEL[family].toLowerCase()}`} onSubmit={f => { cw.stage.insert(family, f); setAdding(null); }} onCancel={() => setAdding(null)} /></div>}
      </div>
    </section>
  );
}

export function NameCard({ state, cw, readOnly, diff, editing, setEditing }: { state: ContactState; cw: ContactWorkspace | null; readOnly: boolean; diff: RevisionDiff | null; editing: boolean; setEditing: (v: boolean) => void }) {
  const p = state.profile;
  const pending = !!cw?.projection?.touched.has('profile');
  const changed = new Set(diff?.profile.map(f => f.field));
  const fields: (keyof Profile)[] = p.contactTypeId === 2 ? ['summary'] : ['personFirstName', 'personLastName1', 'personLastName2', 'personAlias', 'jobTitle'];
  return (
    <section className="card wide" data-testid="profile-block" data-target="profile">
      <div className="body" style={{ paddingTop: 12 }}>
        <div className="name-block">
          <span className={`n ${pending ? 'pend' : ''}`}>{diff?.profile.find(f => f.field === 'displayName' || f.field === 'fullName') ? <DiffValue oldValue={(diff.profile.find(f => f.field === 'fullName')?.old as string) ?? p.fullName} newValue={p.fullName} /> : p.displayName ?? p.fullName}</span>
          <span className="sub">
            {p.displayName && p.displayName !== p.fullName && <span>Full name {changed.has('fullName') ? <DiffValue oldValue={diff!.profile.find(f => f.field === 'fullName')!.old} newValue={p.fullName} /> : p.fullName}</span>}
            {fields.map(f => p[f] || changed.has(f) ? <span key={f}>{PROFILE_FIELD_LABEL[f]} {changed.has(f) ? <DiffValue oldValue={diff!.profile.find(x => x.field === f)!.old} newValue={p[f]} /> : <strong>{p[f] as string}</strong>}</span> : null)}
            {(p.isPrivate || p.doNotContact || p.recruiting) && <span>{[p.isPrivate && 'Private', p.doNotContact && 'Do not contact', p.recruiting && 'Recruiting'].filter(Boolean).join(' · ')}</span>}
            {!readOnly && cw?.canEdit && !editing && <button className="btn sm" onClick={() => setEditing(true)} data-testid="edit-profile">Edit name and details</button>}
          </span>
        </div>
        {editing && cw && <ProfileForm profile={p} onSubmit={np => { cw.stage.profile(np); setEditing(false); }} onCancel={() => setEditing(false)} />}
      </div>
    </section>
  );
}

function ProfileForm({ profile, onSubmit, onCancel }: { profile: Profile; onSubmit: (p: Profile) => void; onCancel: () => void }) {
  const [p, setP] = useState<Profile>({ ...profile });
  const org = p.contactTypeId === 2;
  const set = (k: keyof Profile, v: string | boolean) => setP({ ...p, [k]: typeof v === 'string' ? (v === '' ? null : v) : v });
  const err = !p.fullName?.trim() ? 'Full name is required.' : null;
  return (
    <form className="profile-form" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); if (!err) onSubmit(p); }} data-testid="profile-form">
      <div className="field full"><label>Full name</label><input className="input" value={p.fullName} onChange={e => setP({ ...p, fullName: e.target.value })} autoFocus aria-invalid={!!err} data-testid="profile-fullName" />{err && <span className="field-error">{err}</span>}</div>
      <div className="field"><label>Display name</label><input className="input" value={p.displayName ?? ''} onChange={e => set('displayName', e.target.value)} data-testid="profile-displayName" /></div>
      {!org && <>
        <div className="field"><label>First name</label><input className="input" value={p.personFirstName ?? ''} onChange={e => set('personFirstName', e.target.value)} /></div>
        <div className="field"><label>First surname</label><input className="input" value={p.personLastName1 ?? ''} onChange={e => set('personLastName1', e.target.value)} /></div>
        <div className="field"><label>Second surname</label><input className="input" value={p.personLastName2 ?? ''} onChange={e => set('personLastName2', e.target.value)} /></div>
        <div className="field"><label>Alias</label><input className="input" value={p.personAlias ?? ''} onChange={e => set('personAlias', e.target.value)} data-testid="profile-alias" /></div>
        <div className="field"><label>Job title</label><input className="input" value={p.jobTitle ?? ''} onChange={e => set('jobTitle', e.target.value)} /></div>
      </>}
      <div className="row wrap full"><label className="check"><input type="checkbox" checked={p.isPrivate} onChange={e => set('isPrivate', e.target.checked)} /> Private contact</label><label className="check"><input type="checkbox" checked={p.doNotContact} onChange={e => set('doNotContact', e.target.checked)} /> Do not contact</label>{org && <label className="check"><input type="checkbox" checked={p.recruiting} onChange={e => set('recruiting', e.target.checked)} /> Recruiting</label>}</div>
      <div className="row full"><button className="btn primary" type="submit" data-testid="profile-submit">Stage change</button><button className="btn" type="button" onClick={onCancel}>Cancel</button><span className="field-hint">A profile replace supplies every field; blanks clear optional values.</span></div>
    </form>
  );
}

// ---- Then / Now compare ------------------------------------------------------------------

interface CmpRow { key: string; label: string; then: string | null; now: string | null; kind: '' | 'chg' | 'add' | 'del' }

export function compareRows(then: ContactState, now: ContactState, diff: RevisionDiff): CmpRow[] {
  const rows: CmpRow[] = [];
  const pf = (s: ContactState) => `${s.profile.fullName}${s.profile.displayName ? ` (${s.profile.displayName})` : ''}`;
  rows.push({ key: 'profile', label: 'Name', then: pf(then), now: pf(now), kind: diff.profile.some(f => ['fullName', 'displayName'].includes(f.field)) ? 'chg' : '' });
  for (const f of PROFILE_FIELDS.filter(f => !['fullName', 'displayName'].includes(f))) {
    const t = then.profile[f], n = now.profile[f];
    if (t === null || t === undefined || t === false) { if (n === null || n === undefined || n === false) continue; }
    rows.push({ key: `p.${f}`, label: PROFILE_FIELD_LABEL[f], then: t === true ? 'Yes' : (t as string | null) ?? null, now: n === true ? 'Yes' : (n as string | null) ?? null, kind: (t ?? null) !== (n ?? null) ? 'chg' : '' });
  }
  for (const fam of FAMILIES) {
    const tl = then[fam === 'email' ? 'emails' : fam === 'phone' ? 'phones' : fam === 'web_link' ? 'webLinks' : 'addresses'] as Child[];
    const nl = now[fam === 'email' ? 'emails' : fam === 'phone' ? 'phones' : fam === 'web_link' ? 'webLinks' : 'addresses'] as Child[];
    const ords = [...new Set([...tl, ...nl].map(c => c.ordinal))].sort((a, b) => a - b);
    for (const o of ords) {
      const t = tl.find(c => c.ordinal === o && !c.deleted), n = nl.find(c => c.ordinal === o && !c.deleted);
      if (!t && !n) continue;
      const fmt = (c: Child) => `${c.displayOrder}. ${childValueText(c)} · ${c.location ?? 'no label'}${c.isPublic ? '' : ' · private'}`;
      const d = diff.children.find(x => x.ref.family === fam && x.ref.ordinal === o);
      rows.push({ key: `${fam}#${o}`, label: `${FAMILY_LABEL[fam]} · id ${o}`, then: t ? fmt(t) : null, now: n ? fmt(n) : null, kind: d ? (d.kind === 'added' ? 'add' : d.kind === 'removed' ? 'del' : 'chg') : '' });
    }
  }
  return rows;
}

export function ThenNow({ then, now, diff, thenLabel, nowLabel, highlight, actions, onSwapBase }: { then: ContactState; now: ContactState; diff: RevisionDiff; thenLabel: ReactNode; nowLabel: ReactNode; highlight: Set<string>; actions: Action[] | null; onSwapBase?: ReactNode }) {
  const rows = compareRows(then, now, diff);
  return (
    <div className="compare" data-testid="then-now">
      <div className="col-then">
        <div className="colh">Then · {thenLabel}{onSwapBase}</div>
        {rows.map(r => <div key={r.key} className={`cmp-row ${r.kind === 'chg' || r.kind === 'del' ? (r.kind === 'del' ? 'del' : 'chg') : ''} ${highlight.has(r.key) ? 'hi' : ''}`} data-target={r.key}><span className="k">{r.label}</span><span className="v">{r.then ?? <span className="faint">—</span>}</span></div>)}
      </div>
      <div className="mid" aria-hidden="true">
        <span className="arrow">→</span>
        {diff.empty ? <Badge tone="hist" title="No net difference">=</Badge> : <Badge tone="accent">{diff.profile.length + diff.children.length}</Badge>}
        {actions && <span className="tiny faint" title="actions recorded">{actions.length}⚡</span>}
      </div>
      <div className="col-now">
        <div className="colh">Now · {nowLabel}</div>
        {rows.map(r => <div key={r.key} className={`cmp-row ${r.kind === 'chg' || r.kind === 'add' ? (r.kind === 'add' ? 'add' : 'chg') : ''}`}><span className="k">{r.label}</span><span className="v">{r.now ?? <span className="faint">—</span>}</span></div>)}
      </div>
      {diff.empty && <div style={{ gridColumn: '1 / -1', padding: '8px 14px' }} data-testid="diff-empty"><Badge tone="hist">No net difference</Badge> <span className="small muted">Both points hold the same values{actions && actions.length ? `, although ${actions.length} action${actions.length === 1 ? ' was' : 's were'} recorded in between. Switch to “During” to see them.` : '.'}</span></div>}
    </div>
  );
}

export function StepsStrip({ actions, highlight }: { actions: Action[]; highlight: string | null }) {
  if (!actions.length) return <p className="small muted">No effective actions.</p>;
  return (
    <div className="during" data-testid="actions-list">
      <div className="strip">
        {actions.map(a => {
          const key = 'ordinal' in a.target ? childKey(a.target) : a.target.family;
          return (
            <div key={a.ordinal} className={`step ${highlight === key ? 'hi' : ''}`} data-target={key}>
              <span className="n">{a.ordinal}</span>
              <span className="kind">{a.kind}</span>
              <span>{a.summary}</span>
              <TechDetails summary="Payload" rows={[['target', 'ordinal' in a.target ? `${a.target.family} #${a.target.ordinal}` : a.target.family], ['before', <code key="b">{JSON.stringify(a.before)}</code>], ['after', <code key="a">{JSON.stringify(a.after)}</code>]]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- activity swimlanes -----------------------------------------------------------------

export function Swimlanes({ items, selected, onSelect }: { items: ActivityItem[]; selected: string | null; onSelect: (id: string) => void }) {
  const actors = useMemo(() => {
    const keys = [...new Set(items.map(i => i.kind === 'unit' ? i.unit.actorKey : i.event.actorKey))];
    return keys.map(k => ({ key: k, name: PERSONAS.find(p => p.actorKey === k)?.name ?? (k === SYSTEM_ACTOR.actorKey ? 'System' : k) }));
  }, [items]);
  if (!items.length) return null;
  const times = items.map(i => new Date(i.at).getTime());
  const min = Math.min(...times), max = Math.max(...times);
  const span = Math.max(max - min, 3_600_000);
  const pad = span * 0.04;
  const x = (t: number) => `${((t - (min - pad)) / (span + 2 * pad)) * 100}%`;
  const days: string[] = [];
  for (let t = min; t <= max + 86_400_000; t += 86_400_000) { const k = tzDateKey(new Date(t).toISOString()); if (!days.includes(k)) days.push(k); }
  return (
    <div className="lanes" data-testid="swimlanes" role="group" aria-label="Activity by actor over time">
      {actors.map(a => (
        <div className="lane" key={a.key}>
          <div className="who"><Avatar actorKey={a.key} /><span>{a.name}</span></div>
          <div className="track">
            {days.map(d => { const t = new Date(`${d}T06:00:00Z`).getTime(); if (t < min - pad || t > max + pad) return null; return <div key={d} className="gridline" style={{ left: x(t) }}><span>{fmtDayMonth(`${d}T12:00:00Z`)}</span></div>; })}
            {items.filter(i => (i.kind === 'unit' ? i.unit.actorKey : i.event.actorKey) === a.key).map(i => {
              const id = i.kind === 'unit' ? i.unit.id : i.event.id;
              const cls = i.kind === 'unit' ? (i.unit.source === 'provisioning' ? 'prov' : '') : 'op';
              const title = i.kind === 'unit' ? `${i.contact?.displayName} r${i.unit.entityVersion} · ${i.unit.summary}` : `${i.event.summary} (operational, simulated)`;
              return <button key={id} className={`mark ${cls} ${selected === id ? 'sel' : ''}`} style={{ left: x(new Date(i.at).getTime()) }} onClick={() => onSelect(id)} title={title} aria-label={title} data-testid={i.kind === 'unit' ? 'lane-mark' : 'lane-mark-op'} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UnitPanel({ unit, contactName, onOpen, onClose }: { unit: AuditUnit; contactName: string | null; onOpen: (rev: number, hl?: string) => void; onClose: () => void }) {
  const ws = useWorkspace();
  const cur = ws.server.snapshotAt(unit.contactKey, unit.entityVersion)!;
  const touched = [...new Set(unit.actions.map(a => a.target.family === 'profile' ? 'profile' : a.target.family === 'root' ? 'root' : `${a.target.family}#${a.target.ordinal}`))];
  return (
    <div className="unit-panel" data-testid="unit-drawer">
      <div className="row"><h3 style={{ fontSize: 15 }}>Audit unit …{unit.id.slice(-6)}</h3><span className="grow" /><button className="btn quiet icon sm" onClick={onClose} aria-label="Close unit">✕</button></div>
      <UnitMeta unit={unit} contactName={contactName} />
      <div className="row wrap"><button className="btn primary sm" onClick={() => onOpen(unit.entityVersion)} data-testid="open-contact-revision">Open on {contactName ?? 'the contact'}'s axis at r{unit.entityVersion}</button></div>
      <div><h4 className="small strong">Affected records</h4>
        <ul className="small" style={{ paddingLeft: 18 }}>
          <li><strong>{contactName ?? unit.contactKey}</strong> → revision {unit.entityVersion}</li>
          {touched.map(k => { const label = k === 'profile' ? 'Profile' : k === 'root' ? 'Contact root' : (() => { const [f, o] = k.split('#'); const c = (cur[f === 'email' ? 'emails' : f === 'phone' ? 'phones' : f === 'web_link' ? 'webLinks' : 'addresses'] as Child[]).find(x => x.ordinal === Number(o)); return c ? `${childTitle(c)} (identity ${o})` : k; })(); return <li key={k}>{label} <button className="btn quiet sm" onClick={() => onOpen(unit.entityVersion, k)}>Show</button></li>; })}
          {unit.account && <li>Account {unit.account.loginName} (role {unit.account.initialRoleId ?? '—'}); no secret recorded</li>}
        </ul>
      </div>
      <div><h4 className="small strong">Actions, in order</h4><ActionsList actions={unit.actions} dense /></div>
      <p className="tiny faint">Recorded <When iso={unit.recordedAt} />.</p>
    </div>
  );
}

export function draftDescription(cw: ContactWorkspace): string[] {
  return cw.draft && cw.base ? cw.draft.items.map(i => describeItem(i, cw.base!)) : [];
}
export const fmtWhen = (iso: string) => `${fmtDate(iso)} ${fmtTime(iso)}`;
