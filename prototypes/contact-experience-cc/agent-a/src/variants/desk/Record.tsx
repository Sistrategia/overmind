// Desk record page: dense rows, inline editing, pending tray, historical read-only mode
// with inline diff annotations.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeItem, fieldsOf } from '../../core/draft';
import { childValueText, diffStates, displayName, liveChildren } from '../../core/engine';
import type { Child, ChildRef, ContactState, Family, PhoneChild, Profile, RevisionDiff } from '../../core/model';
import { childKey, FAMILIES, FAMILY_LABEL, FAMILY_LABEL_PLURAL, PROFILE_FIELD_LABEL } from '../../core/model';
import { navigate } from '../../core/router';
import type { RevisionRead } from '../../core/server';
import { useDirectory, useRevision } from '../../core/workspace';
import { UncertainOutcome } from '../../shared/evidence';
import { ChildForm } from '../../shared/fields';
import { ReconcilePanel } from '../../shared/reconcile';
import { Badge, Dialog, DiffMark, DiffValue, Empty, Presence, ProblemView, Spinner } from '../../shared/ui';
import type { ContactWorkspace } from '../../shared/use-contact-workspace';
import type { SaveFlow } from '../../shared/use-save';

export interface RecordProps {
  cw: ContactWorkspace;
  save: SaveFlow;
  slug: string;
  rev: number | null;
  compare: number | null;
  highlight: string[];
  focus: string | null;
  onFocusHandled: () => void;
  onOpenRail: () => void;
}

function ProfileBlock({ profile, diff, pending, onEdit, canEdit, readOnly }: { profile: Profile; diff: RevisionDiff | null; pending: boolean; onEdit: () => void; canEdit: boolean; readOnly: boolean }) {
  const changed = new Set(diff?.profile.map(f => f.field));
  const fields: (keyof Profile)[] = profile.contactTypeId === 2 ? ['fullName', 'displayName', 'summary'] : ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'personAlias', 'jobTitle'];
  return (
    <div className={`profile-block ${pending ? 'pending' : ''}`} data-testid="profile-block" data-target="profile">
      {fields.map(f => {
        const d = diff?.profile.find(x => x.field === f);
        return (
          <div className="f" key={f}>
            <span className="k">{PROFILE_FIELD_LABEL[f]}{changed.has(f) && <DiffMark kind="changed" />}</span>
            {d ? <span className="v"><DiffValue oldValue={d.old} newValue={d.new} /></span> : <span className="v">{(profile[f] as string | null) ?? <span className="faint">—</span>}</span>}
          </div>
        );
      })}
      <div className="f"><span className="k">Flags</span><span className="v small">{[profile.isPrivate && 'Private', profile.doNotContact && 'Do not contact', profile.recruiting && 'Recruiting'].filter(Boolean).join(' · ') || <span className="faint">none</span>}</span></div>
      {!readOnly && canEdit && <div className="f" style={{ alignSelf: 'end', justifySelf: 'end' }}><button className="btn sm" onClick={onEdit} data-testid="edit-profile">Edit name and details</button></div>}
    </div>
  );
}

function ProfileForm({ profile, onSubmit, onCancel }: { profile: Profile; onSubmit: (p: Profile) => void; onCancel: () => void }) {
  const [p, setP] = useState<Profile>({ ...profile });
  const org = p.contactTypeId === 2;
  const set = (k: keyof Profile, v: string | boolean) => setP({ ...p, [k]: typeof v === 'string' ? (v === '' ? null : v) : v });
  const err = !p.fullName?.trim() ? 'Full name is required.' : null;
  return (
    <form className="profile-form" onSubmit={e => { e.preventDefault(); if (!err) onSubmit(p); }} data-testid="profile-form">
      <div className="field full"><label>Full name (explicit, never derived)</label><input className="input" value={p.fullName} onChange={e => setP({ ...p, fullName: e.target.value })} autoFocus aria-invalid={!!err} data-testid="profile-fullName" />{err && <span className="field-error">{err}</span>}</div>
      <div className="field"><label>Display name (empty = full name)</label><input className="input" value={p.displayName ?? ''} onChange={e => set('displayName', e.target.value)} data-testid="profile-displayName" /></div>
      {!org && <>
        <div className="field"><label>First name</label><input className="input" value={p.personFirstName ?? ''} onChange={e => set('personFirstName', e.target.value)} /></div>
        <div className="field"><label>First surname</label><input className="input" value={p.personLastName1 ?? ''} onChange={e => set('personLastName1', e.target.value)} /></div>
        <div className="field"><label>Second surname</label><input className="input" value={p.personLastName2 ?? ''} onChange={e => set('personLastName2', e.target.value)} data-testid="profile-lastName2" /></div>
        <div className="field"><label>Alias</label><input className="input" value={p.personAlias ?? ''} onChange={e => set('personAlias', e.target.value)} data-testid="profile-alias" /></div>
        <div className="field"><label>Job title</label><input className="input" value={p.jobTitle ?? ''} onChange={e => set('jobTitle', e.target.value)} /></div>
      </>}
      <div className="field full"><label>Summary</label><textarea className="textarea" rows={2} value={p.summary ?? ''} onChange={e => set('summary', e.target.value)} /></div>
      <div className="row wrap full">
        <label className="check"><input type="checkbox" checked={p.isPrivate} onChange={e => set('isPrivate', e.target.checked)} /> Private contact (hidden from directory)</label>
        <label className="check"><input type="checkbox" checked={p.doNotContact} onChange={e => set('doNotContact', e.target.checked)} /> Do not contact</label>
        {org && <label className="check"><input type="checkbox" checked={p.recruiting} onChange={e => set('recruiting', e.target.checked)} /> Recruiting</label>}
      </div>
      <div className="row full"><button className="btn primary" type="submit" data-testid="profile-submit">Stage change</button><button className="btn" type="button" onClick={onCancel}>Cancel</button><span className="field-hint">Profile replace supplies every field; blanks clear optional values.</span></div>
    </form>
  );
}

function ChildRow({ child, family, pendingKey, diffFor, readOnly, canEdit, editing, onEdit, onAction, highlight, focused, cw, liveCount, removed }: {
  child: Child; family: Family; pendingKey: Set<string>; diffFor: (ref: ChildRef) => RevisionDiff['children'][number] | undefined; readOnly: boolean; canEdit: boolean;
  editing: boolean; onEdit: () => void; onAction: (a: 'primary' | 'up' | 'down' | 'remove' | 'restore' | 'toggle-public') => void; highlight: boolean; focused: boolean; cw: ContactWorkspace; liveCount: number; removed?: boolean;
}) {
  const ref = { family, ordinal: child.ordinal };
  const key = childKey(ref);
  const isPending = pendingKey.has(key);
  const d = diffFor(ref);
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focused) el.current?.focus(); }, [focused]);
  const phone = child as PhoneChild;
  const canAct = !readOnly && canEdit && !removed;
  return (
    <div ref={el} className={`crow ${isPending ? 'pending' : ''} ${highlight ? 'hi' : ''} ${removed ? 'removed' : ''}`} tabIndex={0} data-testid={`row-${key}`} data-target={key}
      onKeyDown={e => {
        if (!canAct) return;
        if (e.key === 'Enter' || e.key === 'e') { e.preventDefault(); onEdit(); }
        else if (e.key === 'p') onAction('primary');
        else if (e.key === 'Delete') onAction('remove');
        else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); onAction('up'); }
        else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); onAction('down'); }
      }}
      onDoubleClick={() => canAct && onEdit()}
      aria-label={`${child.location ?? FAMILY_LABEL[family]} ${childValueText(child)}${child.displayOrder === 1 ? ', primary' : ''}${child.isPublic ? ', public' : ', private'}${isPending ? ', pending change' : ''}`}>
      <span className="pos" title={`Saved position ${child.displayOrder}; identity ${child.ordinal}`}>{removed ? '×' : child.displayOrder}</span>
      <span className="lab">{child.location ?? <span className="faint">no label</span>}</span>
      <span className="val">
        <span className="txt">{family === 'phone' ? childValueText({ ...phone, extension: null } as Child) : childValueText(child)}</span>
        {family === 'phone' && phone.extension && <span className="ext">ext. {phone.extension}</span>}
        {child.displayOrder === 1 && !removed && liveCount > 1 && <Badge tone="accent">Primary</Badge>}
        {!child.isPublic && <span className="lock" title="Private: not in the directory" aria-label="private">🔒</span>}
        {isPending && <Badge tone="pending">pending</Badge>}
        {removed && <Badge tone="danger">removed in this revision</Badge>}
        {d && d.kind === 'added' && <Badge tone="ok">added</Badge>}
        {d && d.kind === 'changed' && !d.fields.every(f => f.field === 'displayOrder') && <DiffMark kind="changed" />}
        {d && d.kind === 'changed' && d.fields.every(f => f.field === 'displayOrder') && <DiffMark kind="moved" />}
      </span>
      <span className="meta">
        {canAct && (
          <span className="acts">
            <button className="btn quiet sm" onClick={onEdit} data-testid="row-edit">Edit</button>
            {child.displayOrder !== 1 && <button className="btn quiet sm" onClick={() => onAction('primary')} data-testid="row-primary" title="Move to position 1 (p)">Make primary</button>}
            <button className="btn quiet icon sm" onClick={() => onAction('up')} disabled={child.displayOrder === 1} aria-label="Move up" title="Alt+↑">↑</button>
            <button className="btn quiet icon sm" onClick={() => onAction('down')} disabled={child.displayOrder === liveCount} aria-label="Move down" title="Alt+↓">↓</button>
            <button className="btn quiet icon sm" onClick={() => onAction('remove')} aria-label="Remove" title="Delete">🗑</button>
          </span>
        )}
        {removed && !readOnly && canEdit && <button className="btn sm" onClick={() => onAction('restore')} data-testid="row-restore">Restore</button>}
      </span>
      {d && d.kind === 'changed' && d.fields.filter(f => !f.technical).length > 0 && (
        <div className="hist-diff" data-testid="row-diff">
          {d.fields.filter(f => !f.technical).map(f => <span key={f.field}><span className="muted">{f.label}:</span> <DiffValue oldValue={f.old} newValue={f.new} /></span>)}
        </div>
      )}
      {editing && !readOnly && (
        <div className="crow-edit" style={{ gridColumn: '1 / -1', margin: '0 -8px 0 -4px' }}>
          <ChildForm family={family} initial={fieldsOf(child)} onSubmit={f => { cw.stage.replace(ref, f); onEdit(); }} onCancel={onEdit} compact
            extra={family === 'address' ? <AddressSharing cw={cw} child={child} /> : undefined} />
        </div>
      )}
    </div>
  );
}

function AddressSharing({ cw, child }: { cw: ContactWorkspace; child: Child }) {
  if (child.family !== 'address') return null;
  const users = cw.ws.server.addressValueUsers(child.value.id).filter(u => u.key !== cw.contactKey);
  return (
    <details className="tech" style={{ marginTop: 6 }}><summary>Inspector: shared value</summary>
      <dl><dt>address value</dt><dd>{child.value.id}</dd><dt>also referenced by</dt><dd>{users.length ? users.map(u => u.displayName).join(', ') + ' (shared value, no relationship implied)' : 'no other current contact'}</dd><dt>on correction</dt><dd>this association selects a new value; others keep {child.value.id}</dd></dl>
    </details>
  );
}

export function FamilySection({ family, state, cw, readOnly, diff, editingKey, setEditingKey, adding, setAdding, highlight, focusKey }: {
  family: Family; state: ContactState; cw: ContactWorkspace; readOnly: boolean; diff: RevisionDiff | null;
  editingKey: string | null; setEditingKey: (k: string | null) => void; adding: Family | null; setAdding: (f: Family | null) => void; highlight: Set<string>; focusKey: string | null;
}) {
  const live = liveChildren(state, family);
  const removedInDiff = (diff?.children ?? []).filter(c => c.ref.family === family && c.kind === 'removed').map(c => c.old!);
  const pendingKey = cw.projection?.touched ?? new Set<string>();
  const diffFor = (ref: ChildRef) => diff?.children.find(c => c.ref.family === ref.family && c.ref.ordinal === ref.ordinal);
  const deletedBase = readOnly ? [] : (cw.base ? (cw.base[family === 'email' ? 'emails' : family === 'phone' ? 'phones' : family === 'web_link' ? 'webLinks' : 'addresses'] as Child[]).filter(c => c.deleted) : []);
  const onAction = (child: Child, a: 'primary' | 'up' | 'down' | 'remove' | 'restore' | 'toggle-public') => {
    const ref = { family, ordinal: child.ordinal };
    if (a === 'primary') cw.stage.move(ref, 1);
    else if (a === 'up') cw.stage.move(ref, Math.max(1, (child.displayOrder ?? 1) - 1));
    else if (a === 'down') cw.stage.move(ref, Math.min(live.length, (child.displayOrder ?? 1) + 1));
    else if (a === 'remove') cw.stage.remove(ref);
    else if (a === 'restore') cw.stage.restore(ref, fieldsOf(child));
    else if (a === 'toggle-public') cw.stage.replace(ref, { ...fieldsOf(child), isPublic: !child.isPublic });
  };
  return (
    <section className="section" aria-labelledby={`sec-${family}`} data-testid={`section-${family}`}>
      <div className="section-head"><h2 id={`sec-${family}`}>{FAMILY_LABEL_PLURAL[family]}</h2><span className="count">{live.length}</span>{family === 'address' && <span className="tiny faint">immutable shared values; edits replace the association</span>}</div>
      <div className="rows">
        {live.length === 0 && removedInDiff.length === 0 && <div className="crow"><span /><span className="lab" /><span className="val faint">None</span></div>}
        {live.map(c => (
          <ChildRow key={c.ordinal} child={c} family={family} pendingKey={pendingKey} diffFor={diffFor} readOnly={readOnly} canEdit={cw.canEdit}
            editing={editingKey === childKey({ family, ordinal: c.ordinal })} onEdit={() => setEditingKey(editingKey === childKey({ family, ordinal: c.ordinal }) ? null : childKey({ family, ordinal: c.ordinal }))}
            onAction={a => onAction(c, a)} highlight={highlight.has(childKey({ family, ordinal: c.ordinal }))} focused={focusKey === childKey({ family, ordinal: c.ordinal })} cw={cw} liveCount={live.length} />
        ))}
        {removedInDiff.map(c => <ChildRow key={`r${c.ordinal}`} child={c} family={family} pendingKey={pendingKey} diffFor={diffFor} readOnly canEdit={false} editing={false} onEdit={() => undefined} onAction={() => undefined} highlight={false} focused={false} cw={cw} liveCount={live.length} removed />)}
        {!readOnly && deletedBase.filter(c => !live.some(l => l.ordinal === c.ordinal)).map(c => (
          <div key={`d${c.ordinal}`} className="crow removed" data-testid={`row-deleted-${childKey({ family, ordinal: c.ordinal })}`}>
            <span className="pos">×</span><span className="lab">{c.location ?? ''}</span>
            <span className="val"><span className="txt">{childValueText(c)}</span><Badge tone="hist">removed earlier · identity {c.ordinal} retained</Badge></span>
            <span className="meta">{cw.canEdit && <button className="btn sm" onClick={() => onAction(c, 'restore')} data-testid="row-restore">Restore</button>}</span>
          </div>
        ))}
        {!readOnly && cw.canEdit && adding !== family && <button className="crow-add" onClick={() => { setEditingKey(null); setAdding(family); }} data-testid={`add-${family}`}>＋ Add {FAMILY_LABEL[family].toLowerCase()}</button>}
        {!readOnly && adding === family && (
          <div className="crow-edit">
            <ChildForm family={family} initial={null} submitLabel={`Add ${FAMILY_LABEL[family].toLowerCase()}`} onSubmit={f => { cw.stage.insert(family, f); setAdding(null); }} onCancel={() => setAdding(null)} compact />
          </div>
        )}
      </div>
    </section>
  );
}

export function PendingTray({ cw, save, onOpenEvidence }: { cw: ContactWorkspace; save: SaveFlow; onOpenEvidence: (rev: number) => void }) {
  const draft = cw.draft;
  const problems = cw.projection?.problems ?? [];
  const busy = save.status.kind === 'saving';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (draft?.items.length && !busy) void save.save(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [draft, busy, save]);
  if (!draft?.items.length && save.status.kind !== 'saved' && save.status.kind !== 'error' && save.status.kind !== 'uncertain') return null;
  return (
    <div className="tray" data-testid="pending-tray" role="region" aria-label="Pending changes">
      {save.status.kind === 'error' && <ProblemView problem={save.status.problem} actions={<button className="btn sm" onClick={save.dismiss}>Dismiss</button>} />}
      {save.status.kind === 'uncertain' && cw.contactKey && (
        <UncertainOutcome problem={save.status.problem} contactKey={cw.contactKey} baseVersion={save.status.baseVersion} onCheck={save.checkAfterUncertain} onOpenHistory={onOpenEvidence} onDiscardDraft={save.discardDraft} onKeepDraft={save.dismiss} />
      )}
      {save.status.kind === 'saved' && !draft?.items.length && (
        <div className="row wrap" data-testid="saved-banner">
          <Badge tone="ok">Saved together</Badge>
          <span className="small">{save.status.result.auditDbrowVersion ? <>Revision {save.status.result.entityVersion} · audit unit <span className="mono">…{save.status.result.auditDbrowVersion.slice(-4)}</span></> : 'No effective change; revision unchanged.'}</span>
          {save.status.result.auditDbrowVersion && <button className="btn sm" onClick={() => onOpenEvidence(save.status.kind === 'saved' ? save.status.result.entityVersion : 0)} data-testid="view-evidence">View evidence</button>}
          <button className="btn quiet sm" onClick={save.dismiss}>Dismiss</button>
        </div>
      )}
      {draft && draft.items.length > 0 && (<>
        <div className="tray-head">
          <span className="tray-summary"><span className="dot" /><strong>{draft.items.length} pending change{draft.items.length === 1 ? '' : 's'}</strong><span className="muted">on revision {draft.baseVersion} · saved together as one revision</span></span>
          <span className="grow" />
          <button className="btn primary" disabled={busy || problems.length > 0} onClick={() => void save.save()} data-testid="save" title="Ctrl+S">{busy ? <><Spinner /> Saving…</> : 'Save together'}</button>
          <button className="btn" disabled={busy} onClick={() => cw.stage.clear()} data-testid="discard-all">Discard all</button>
        </div>
        <ol className="tray-list" data-testid="pending-list">
          {draft.items.map((it, i) => {
            const p = problems.find(x => x.itemId === it.id);
            return (
              <li key={it.id} className="tray-item">
                <span className="n">{i + 1}</span>
                <span className="grow">{cw.base ? describeItem(it, cw.base) : it.command.kind}</span>
                {it.origin === 'sidekick' && <span className="origin" title={it.note ?? ''}>sidekick</span>}
                {p && <span className="err">{p.message}</span>}
                <button className="btn quiet icon sm" onClick={() => cw.stage.removeItem(it.id)} aria-label={`Remove pending change ${i + 1}`}>✕</button>
              </li>
            );
          })}
        </ol>
      </>)}
    </div>
  );
}

export function DeskRecord(props: RecordProps) {
  const { cw, save, slug, rev, compare, highlight, focus, onFocusHandled, onOpenRail } = props;
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState<Family | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const historical = rev !== null && cw.committed !== null && rev !== cw.committed.entityVersion;
  const revRead = useRevision(historical || (rev !== null && compare !== null) ? cw.contactKey : null, rev, compare);
  const dirEnabled = !cw.canHistory && !cw.problem ? false : cw.problem?.code === 'forbidden';
  const dir = useDirectory(cw.contactKey, dirEnabled);
  const hiSet = useMemo(() => new Set(highlight), [highlight]);
  const focusKey = focus;
  useEffect(() => { if (focus) { const t = setTimeout(onFocusHandled, 1500); return () => clearTimeout(t); } }, [focus, onFocusHandled]);
  useEffect(() => { cw.ws.presence(cw.contactKey, editingKey ? `${editingKey.split('#')[0]} ${editingKey.split('#')[1]}` : adding ? `new ${adding}` : editingProfile ? 'profile' : null, !!(editingKey || adding || editingProfile || cw.draft?.items.length)); }, [editingKey, adding, editingProfile, cw.draft?.items.length, cw.contactKey, cw.ws]);
  const openEvidence = useCallback((r: number) => { navigate({ variant: 'desk', screen: 'history', segment: slug, params: { rev: String(r), compare: r > 1 ? String(r - 1) : '' } }); onOpenRail(); }, [slug, onOpenRail]);

  if (cw.problem?.code === 'forbidden') {
    // Directory-only persona: render the public projection.
    if (dir.problem) return <div className="record"><ProblemView problem={dir.problem} /></div>;
    if (dir.loading || !dir.data) return <div className="record"><Spinner /></div>;
    const d = dir.data;
    const pseudo: ContactState = { publicKey: d.publicKey, entityVersion: d.entityVersion, deletedRoot: false, profile: { contactTypeId: d.category === 'Organization' ? 2 : 1, fullName: d.displayName, displayName: null, personFirstName: null, personLastName1: null, personLastName2: null, personAlias: null, jobTitle: null, summary: null, isPrivate: false, doNotContact: false, recruiting: false }, emails: d.emails as ContactState['emails'], phones: d.phones as ContactState['phones'], webLinks: d.webLinks as ContactState['webLinks'], addresses: d.addresses as ContactState['addresses'] };
    return (
      <div className="record" data-testid="record-directory">
        <div className="record-head"><div className="title"><h1>{d.displayName}</h1><Badge>{d.category}</Badge><Badge tone="hist">Directory view</Badge></div>
          <div className="dir-banner" data-testid="directory-banner">Your role sees the public directory projection: public channels in saved order, no private values, no profile details and no history. Gaps in position numbers are hidden private items.</div></div>
        {FAMILIES.map(f => <FamilySection key={f} family={f} state={pseudo} cw={cw} readOnly diff={null} editingKey={null} setEditingKey={() => undefined} adding={null} setAdding={() => undefined} highlight={hiSet} focusKey={null} />)}
      </div>
    );
  }
  if (cw.problem) return <div className="record"><ProblemView problem={cw.problem} actions={<button className="btn sm" onClick={cw.reload}>Retry</button>} /></div>;
  if (!cw.view || !cw.committed) return <div className="record" aria-busy="true"><div className="record-head"><div className="skeleton" style={{ height: 28, width: 260 }}>loading</div><div className="skeleton" style={{ height: 14, width: 180 }}>loading</div></div>{FAMILIES.map(f => <div key={f} className="skeleton" style={{ height: 72 }}>loading</div>)}</div>;

  const state = historical ? revRead.data?.state ?? null : cw.view;
  const diff = historical ? revRead.data?.diff ?? null : null;
  const pendingDiff = !historical && cw.projection ? cw.projection.pending : null;
  const readOnly = historical || !cw.canEdit;
  const committedRev = cw.committed.entityVersion;

  return (
    <div className="record" data-testid="record" data-mode={historical ? 'historical' : 'current'}>
      <div className="record-head">
        <div className="title">
          <h1>{displayName((state ?? cw.view).profile)}</h1>
          <Badge>{cw.view.profile.contactTypeId === 2 ? 'Organization' : 'Person'}</Badge>
          {historical ? <Badge tone="hist">Revision {rev} of {committedRev}</Badge> : <Badge tone="accent" title="Current committed revision">Revision {committedRev}</Badge>}
          {!historical && cw.draft?.items.length ? <Badge tone="pending">{cw.draft.items.length} pending</Badge> : null}
          {!cw.canEdit && !historical && <Badge tone="hist">Read-only role</Badge>}
        </div>
        <div className="sub">
          <Presence contactKey={cw.contactKey} />
          <span>·</span>
          <button className="btn quiet sm" onClick={onOpenRail} data-testid="open-evidence">Evidence</button>
          {cw.view.profile.jobTitle && <span>· {cw.view.profile.jobTitle}</span>}
        </div>
        {historical && (
          <div className="hist-banner" role="status" data-testid="historical-banner">
            <strong>Historical view · read-only.</strong> You are looking at the contact as it was at revision {rev}{compare !== null ? `, with differences from revision ${compare} marked` : ''}. Selecting an old revision does not undo anything.
            <button className="btn sm" onClick={() => navigate({ variant: 'desk', screen: 'contact', segment: slug })} data-testid="back-to-current">Back to current (revision {committedRev})</button>
          </div>
        )}
        {!historical && cw.stale && cw.draft && (
          <div className="stale-banner" role="status" data-testid="stale-banner">
            <strong>Revision {committedRev} arrived while you were editing.</strong> Your {cw.draft.items.length} pending change{cw.draft.items.length === 1 ? '' : 's'} still target revision {cw.draft.baseVersion}. Review before saving.
            <button className="btn sm primary" onClick={save.openConflict} data-testid="review-conflict">Review and reconcile</button>
            <button className="btn sm" onClick={save.discardDraft}>Discard my draft</button>
          </div>
        )}
      </div>

      {historical && revRead.loading && <Spinner label="Loading revision" />}
      {historical && revRead.problem && <ProblemView problem={revRead.problem} actions={<button className="btn sm" onClick={() => navigate({ variant: 'desk', screen: 'contact', segment: slug })}>Back to current</button>} />}
      {state && (<>
        {editingProfile && !readOnly ? (
          <ProfileForm profile={state.profile} onSubmit={p => { cw.stage.profile(p); setEditingProfile(false); }} onCancel={() => setEditingProfile(false)} />
        ) : (
          <ProfileBlock profile={state.profile} diff={diff} pending={!!cw.projection?.touched.has('profile')} onEdit={() => setEditingProfile(true)} canEdit={cw.canEdit} readOnly={readOnly} />
        )}
        {FAMILIES.map(f => (
          <FamilySection key={f} family={f} state={state} cw={cw} readOnly={readOnly} diff={diff ?? pendingDiff} editingKey={editingKey} setEditingKey={k => { setEditingKey(k); setAdding(null); }} adding={adding} setAdding={setAdding} highlight={hiSet} focusKey={focusKey} />
        ))}
      </>)}
      {!historical && <PendingTray cw={cw} save={save} onOpenEvidence={openEvidence} />}
      {save.status.kind === 'conflict' && (
        <Dialog title="Your draft needs reconciling" onClose={save.dismiss}>
          <ReconcilePanel report={save.status.report} draft={save.status.draft} base={save.status.base} onSave={r => void save.resolveAndSave(r)} onRebaseOnly={save.resolveOnly} onDiscard={save.discardDraft} />
        </Dialog>
      )}
    </div>
  );
}

export function revisionSummaryList(read: RevisionRead): { k: string; v: string }[] {
  const s = read.state;
  return [
    { k: 'Name', v: s.profile.fullName + (s.profile.displayName ? ` (${s.profile.displayName})` : '') },
    ...FAMILIES.map(f => ({ k: FAMILY_LABEL_PLURAL[f], v: liveChildren(s, f).map(c => `${c.displayOrder}. ${childValueText(c)}${c.location ? ` · ${c.location}` : ''}${c.isPublic ? '' : ' · private'}`).join('\n') || '—' }))
  ];
}

export function useEmptyDiffNote(read: RevisionRead | null): string | undefined {
  if (!read?.diff || !read.diff.empty) return undefined;
  return `Revision ${read.unit.entityVersion} recorded ${read.actions.length} action${read.actions.length === 1 ? '' : 's'} whose final values equal revision ${read.diff.from}. See “During this Save”.`;
}

export const _diffStates = diffStates;
export const _empty: RevisionDiff | null = null;
export const _e = Empty;
