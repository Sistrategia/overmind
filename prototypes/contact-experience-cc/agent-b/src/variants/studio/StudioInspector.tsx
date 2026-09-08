import React, { useEffect, useState } from 'react';
import type { StudioNav } from './StudioApp';
import { StAvatar } from './StudioApp';
import { useWorkspace } from '../../core/store';
import { useRevisionView, usePresenceOn } from '../../core/hooks';
import { Icon } from '../../core/icons';
import type { AuditUnit, Child, Family, PhoneValue, Profile } from '../../core/types';
import { childDisplay, childLabel, fmt, liveChildren, FAMILY_LABEL, TZ_LABEL } from '../../core/format';
import { personaById } from '../../core/fixtures';
import { childrenOf, useChannelFields, useEditing, LABEL_SUGGESTIONS, REGIONS } from '../../core/editing';
import { profileFieldLabel } from '../../core/engine';
import { SOURCE_LABEL } from '../../core/activity';
import { diffFieldCount } from '../../core/diff';

export type InspectorTarget =
  | { kind: 'none' }
  | { kind: 'record'; contactId: string }
  | { kind: 'selection'; contactId: string; sel: string }
  | { kind: 'revision'; contactId: string; rev: number }
  | { kind: 'compare'; contactId: string; rev: number; pin: number }
  | { kind: 'activity' }
  | { kind: 'unit'; stamp: string };

export function StudioInspector({ target, nav, hidden, onAsk }: { target: InspectorTarget; nav: StudioNav; hidden: boolean; onAsk: () => void }) {
  const ws = useWorkspace();
  return (
    <aside className={`st-inspector${hidden ? ' st-inspector--hidden' : ''}`} aria-label="Inspector">
      {target.kind === 'none' || target.kind === 'activity' ? (
        <>
          <div className="st-inspector__title">
            <Icon name="info" size={15} /> Inspector
          </div>
          <p className="st-hint">{target.kind === 'activity' ? 'Select an activity entry to see its actor, time, affected records and actions.' : 'Select something to inspect it.'}</p>
        </>
      ) : null}
      {target.kind === 'record' ? <RecordInspector contactId={target.contactId} nav={nav} onAsk={onAsk} /> : null}
      {target.kind === 'selection' ? <SelectionInspector contactId={target.contactId} sel={target.sel} nav={nav} /> : null}
      {target.kind === 'revision' ? <RevisionInspector contactId={target.contactId} rev={target.rev} nav={nav} /> : null}
      {target.kind === 'compare' ? <CompareInspector contactId={target.contactId} rev={target.rev} pin={target.pin} nav={nav} /> : null}
      {target.kind === 'unit' ? <UnitInspector stamp={target.stamp} nav={nav} /> : null}
      {ws.draft && (target.kind === 'record' || target.kind === 'selection') ? <PendingCard nav={nav} /> : null}
    </aside>
  );
}

function PendingCard({ nav }: { nav: StudioNav }) {
  const ws = useWorkspace();
  const d = ws.draft!;
  const saving = ws.saveState.status === 'saving';
  return (
    <div className="st-card st-card--accent" role="region" aria-label="Pending changes">
      <div className="st-card__title">
        <Icon name="edit" size={14} /> {ws.pending.length ? `${ws.pending.length} pending · saved together` : 'Draft · no changes yet'}
        <span className="st-badge" style={{ marginLeft: 'auto' }}>
          on revision {d.baseVersion}
        </span>
      </div>
      {d.origin === 'sidekick' ? <span className="st-hint">Staged by the sidekick. Adjust any row, then Save as one revision.</span> : null}
      {d.origin === 'reconciled' ? <span className="st-hint">Carried onto revision {d.baseVersion}. Use “Take theirs” to drop a field.</span> : null}
      {ws.draftError ? (
        <div className="st-error">
          <Icon name="alert" size={13} /> {ws.draftError}
        </div>
      ) : (
        <ol className="st-pending">
          {ws.pending.map((p) => (
            <li key={p.key}>
              {p.text}
              {d.origin === 'reconciled' && p.ordinal !== null && p.family !== 'profile' && p.family !== 'contact' ? (
                <button className="st-link" onClick={() => ws.revertPath(`${p.family}.${p.ordinal}`)}>
                  Take theirs
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <div className="st-card__actions">
        <button className="st-btn st-btn--sm st-btn--primary" onClick={() => void ws.save()} disabled={saving || !ws.pending.length || !!ws.draftError}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="st-btn st-btn--sm" onClick={ws.discardDraft} disabled={saving}>
          Discard
        </button>
        {ws.incoming ? (
          <button className="st-btn st-btn--sm" onClick={ws.openReconcile}>
            Reconcile with revision {ws.incoming.entityVersion}
          </button>
        ) : null}
      </div>
      {ws.incoming ? (
        <div className="st-hint" style={{ color: 'var(--st-orange)' }}>
          {personaById(ws.incoming.actorId).name} saved revision {ws.incoming.entityVersion} while you edit revision {d.baseVersion}. Your draft is kept; Save will ask you to reconcile.
        </div>
      ) : null}
      <span className="st-hint">
        <button className="st-link" onClick={() => nav.select(null)}>
          Clear selection
        </button>
      </span>
    </div>
  );
}

function RecordInspector({ contactId, nav, onAsk }: { contactId: string; nav: StudioNav; onAsk: () => void }) {
  const ws = useWorkspace();
  const rev = ws.latest(contactId);
  const others = usePresenceOn(contactId);
  const s = ws.saveState;
  if (!rev) return null;
  return (
    <>
      <div className="st-inspector__title">
        <Icon name="person" size={15} /> Record
        {ws.can('edit', contactId) ? <span className="st-badge st-badge--green">editable</span> : <span className="st-badge">read only</span>}
      </div>
      {s.status === 'saved' && s.result ? (
        <div className="st-card st-card--ok" role="status">
          <div className="st-card__title">
            <Icon name="check" size={14} /> Saved together as revision {s.result.entityVersion}
          </div>
          <span className="st-hint">{s.result.dbrowVersion ? `Audit stamp ${s.result.dbrowVersion}. ` : ''}Committed result; the sheet shows the current read.</span>
          <div className="st-card__actions">
            <button className="st-btn st-btn--sm" onClick={() => nav.compare(contactId, s.result!.entityVersion, s.result!.entityVersion - 1)}>
              Compare with revision {s.result.entityVersion - 1}
            </button>
            <button className="st-btn st-btn--sm st-btn--quiet" onClick={ws.clearSaveState}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      {s.status === 'noop' ? (
        <div className="st-card">
          <div className="st-card__title">
            <Icon name="info" size={14} /> Nothing to save
          </div>
          <span className="st-hint">Every command was ineffective: same revision, no audit stamp.</span>
          <button className="st-btn st-btn--sm" onClick={ws.clearSaveState}>
            OK
          </button>
        </div>
      ) : null}
      <div className="st-isec">
        <div className="st-isec__h">Revision</div>
        <dl className="st-ikv">
          <dt>Current</dt>
          <dd>Revision {rev.entityVersion}</dd>
          <dt>Saved by</dt>
          <dd>{personaById(rev.actorId).fullName}</dd>
          <dt>When</dt>
          <dd>
            {fmt.dateTime(rev.at)} {TZ_LABEL}
          </dd>
          <dt>Summary</dt>
          <dd>{rev.summary}</dd>
        </dl>
        {ws.can('read_history', contactId) ? (
          <div className="st-card__actions">
            <button className="st-btn st-btn--sm" onClick={() => nav.timeline(contactId, rev.entityVersion, null)}>
              <Icon name="clock" size={13} /> Timeline
            </button>
            {rev.entityVersion > 1 ? (
              <button className="st-btn st-btn--sm" onClick={() => nav.compare(contactId, rev.entityVersion, rev.entityVersion - 1)}>
                <Icon name="compare" size={13} /> Last change
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="st-isec">
        <div className="st-isec__h">People here</div>
        {others.length === 0 ? <span className="st-hint">Only you. Presence is awareness, not a lock.</span> : null}
        {others.map((p) => (
          <div key={p.tabId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <StAvatar initials={personaById(p.personaId).initials} hue={personaById(p.personaId).hue} size="sm" />
            {personaById(p.personaId).name} is {p.editing ? 'editing' : 'viewing'}
            {p.section && p.section !== 'record' ? ` · ${p.section}` : ''}
          </div>
        ))}
      </div>
      <div className="st-isec">
        <div className="st-isec__h">Sidekick</div>
        <span className="st-hint">Ask ⌘K about this contact’s history or stage a small edit. Simulated, local, no API key.</span>
        <button className="st-btn st-btn--sm" onClick={onAsk}>
          <Icon name="sparkle" size={13} /> Ask
        </button>
      </div>
    </>
  );
}

function SelectionInspector({ contactId, sel, nav }: { contactId: string; sel: string; nav: StudioNav }) {
  const ws = useWorkspace();
  const draft = ws.draft && ws.draft.contactId === contactId ? ws.draft : null;
  const latest = ws.latest(contactId)!;
  const state = draft ? draft.working : latest.state;
  const editing = !!draft;
  if (sel === 'profile') return <ProfileInspector contactId={contactId} profile={state.profile} editing={editing} nav={nav} />;
  if (sel.startsWith('new:')) {
    const family = sel.slice(4) as Family;
    return <ChannelInspector contactId={contactId} family={family} child={null} nav={nav} editing={editing} />;
  }
  const [familyRaw, ordRaw] = sel.split('.');
  const family = familyRaw as Family;
  const child = childrenOf(state, family).find((c) => c.ordinal === Number(ordRaw)) ?? null;
  if (!child) {
    return (
      <>
        <div className="st-inspector__title">
          <Icon name="info" size={15} /> Selection
        </div>
        <p className="st-hint">That entry is no longer in the record.</p>
      </>
    );
  }
  return <ChannelInspector key={`${sel}-${editing}`} contactId={contactId} family={family} child={child} nav={nav} editing={editing} />;
}

function ProfileInspector({ contactId, profile, editing, nav }: { contactId: string; profile: Profile; editing: boolean; nav: StudioNav }) {
  const ws = useWorkspace();
  const edit = useEditing(contactId);
  const [p, setP] = useState<Profile>(profile);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setP(profile), [profile]);
  const set = (k: keyof Profile, v: string) => setP((x) => ({ ...x, [k]: v === '' ? null : v }));
  const keys: (keyof Profile)[] = profile.contactTypeId === 1 ? ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'personAlias'] : ['fullName', 'displayName'];
  return (
    <>
      <div className="st-inspector__title">
        <Icon name="person" size={15} /> Profile
        {!editing ? (
          ws.can('edit', contactId) ? (
            <button className="st-btn st-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => ws.beginDraft(contactId)}>
              Edit
            </button>
          ) : null
        ) : null}
      </div>
      <div className="st-formgrid">
        {keys.map((k) => (
          <div key={k} className="st-field">
            <label htmlFor={`sp-${k}`}>{profileFieldLabel(k)}</label>
            <input id={`sp-${k}`} className="st-input" value={(p[k] as string | null) ?? ''} onChange={(e) => set(k, e.target.value)} readOnly={!editing} />
          </div>
        ))}
        <div className="st-field">
          <label htmlFor="sp-summary">Summary</label>
          <textarea id="sp-summary" className="st-textarea" value={p.summary ?? ''} onChange={(e) => set('summary', e.target.value)} readOnly={!editing} />
        </div>
      </div>
      {error ? (
        <div className="st-error" role="alert">
          <Icon name="alert" size={13} /> {error}
        </div>
      ) : null}
      {editing ? (
        <div className="st-card__actions">
          <button
            className="st-btn st-btn--sm st-btn--primary"
            onClick={() => {
              const e = edit.commitProfile(p);
              setError(e);
              if (!e) ws.notify('Profile change added to your draft.', 'info');
            }}
          >
            Apply to draft
          </button>
          <button className="st-btn st-btn--sm" onClick={() => nav.select(null)}>
            Close
          </button>
        </div>
      ) : null}
      <span className="st-hint">Profile replace supplies every field; empty optional fields clear. Names are shared immutable values.</span>
    </>
  );
}

function ChannelInspector({ contactId, family, child, nav, editing }: { contactId: string; family: Family; child: Child<unknown> | null; nav: StudioNav; editing: boolean }) {
  const ws = useWorkspace();
  const edit = useEditing(contactId);
  const { fields, set, setPhone, setAddress, validation } = useChannelFields(family, child);
  const [submitted, setSubmitted] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const draftState = ws.draft && ws.draft.contactId === contactId ? ws.draft.working : ws.latest(contactId)!.state;
  const position = child ? liveChildren(childrenOf(draftState, family)).findIndex((c) => c.ordinal === child.ordinal) + 1 : 0;
  const apply = () => {
    setSubmitted(true);
    if (!validation.ok) return;
    const err = edit.commitChannel(family, child?.ordinal ?? null, fields);
    if (err) setRowError(err);
    else {
      ws.notify(child ? `${childLabel(family, child)} change added to your draft.` : `${FAMILY_LABEL[family]} added to your draft (at the end).`, 'info');
      if (!child) nav.select(null);
    }
  };
  const id = `si-${family}-${child?.ordinal ?? 'new'}`;
  const ro = !editing;
  return (
    <>
      <div className="st-inspector__title">
        <Icon name={family === 'email' ? 'mail' : family === 'phone' ? 'phone' : family === 'web_link' ? 'link' : 'pin'} size={15} />
        {child ? childLabel(family, child) : `New ${FAMILY_LABEL[family].toLowerCase()}`}
        {!editing && ws.can('edit', contactId) ? (
          <button className="st-btn st-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => ws.beginDraft(contactId)}>
            Edit
          </button>
        ) : null}
      </div>
      {child && child.deleted ? (
        <div className="st-card st-card--warn">
          <div className="st-card__title">Removed</div>
          <span className="st-hint">This entry keeps its identity (ordinal {child.ordinal}). Restoring appends it at the end of the list.</span>
          {editing ? (
            <button className="st-btn st-btn--sm" onClick={() => edit.restore(family, child.ordinal)}>
              <Icon name="restore" size={13} /> Restore
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="st-formgrid">
        {family === 'email' ? (
          <div className="st-field">
            <label htmlFor={`${id}-value`}>Email address</label>
            <input id={`${id}-value`} className="st-input" value={fields.value} onChange={(e) => set('value', e.target.value)} readOnly={ro} inputMode="email" aria-invalid={submitted && !validation.ok ? 'true' : undefined} autoFocus={editing} />
          </div>
        ) : null}
        {family === 'web_link' ? (
          <>
            <div className="st-field">
              <label htmlFor={`${id}-value`}>URL</label>
              <input id={`${id}-value`} className="st-input" value={fields.value} onChange={(e) => set('value', e.target.value)} readOnly={ro} inputMode="url" aria-invalid={submitted && !validation.ok ? 'true' : undefined} autoFocus={editing} />
            </div>
            <div className="st-field">
              <label htmlFor={`${id}-title`}>Title</label>
              <input id={`${id}-title`} className="st-input" value={fields.title} onChange={(e) => set('title', e.target.value)} readOnly={ro} />
            </div>
          </>
        ) : null}
        {family === 'phone' ? (
          <>
            <div className="st-field">
              <label htmlFor={`${id}-number`}>Number</label>
              <input id={`${id}-number`} className="st-input" value={fields.phone.number} onChange={(e) => setPhone({ number: e.target.value })} readOnly={ro} inputMode="tel" placeholder="+52 777 312 3456 or 312-3456" aria-invalid={submitted && !validation.ok ? 'true' : undefined} autoFocus={editing} />
            </div>
            <div className="st-formgrid st-formgrid--2">
              <div className="st-field">
                <label htmlFor={`${id}-region`}>Country</label>
                <select id={`${id}-region`} className="st-select" value={fields.phone.defaultRegion} onChange={(e) => setPhone({ defaultRegion: e.target.value })} disabled={ro}>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="st-field">
                <label htmlFor={`${id}-area`}>Area code</label>
                <input id={`${id}-area`} className="st-input" value={fields.phone.areaCode} onChange={(e) => setPhone({ areaCode: e.target.value })} readOnly={ro} inputMode="numeric" />
              </div>
            </div>
            <div className="st-field">
              <label htmlFor={`${id}-ext`}>Extension</label>
              <input id={`${id}-ext`} className="st-input" value={fields.phone.extension} onChange={(e) => setPhone({ extension: e.target.value })} readOnly={ro} inputMode="numeric" />
            </div>
          </>
        ) : null}
        {family === 'address' ? (
          <>
            <div className="st-field">
              <label htmlFor={`${id}-street`}>Street</label>
              <input id={`${id}-street`} className="st-input" value={fields.address.streetName ?? ''} onChange={(e) => setAddress({ streetName: e.target.value })} readOnly={ro} autoFocus={editing} />
            </div>
            <div className="st-formgrid st-formgrid--2">
              <div className="st-field">
                <label htmlFor={`${id}-ext`}>Ext. number</label>
                <input id={`${id}-ext`} className="st-input" value={fields.address.extNumber ?? ''} onChange={(e) => setAddress({ extNumber: e.target.value })} readOnly={ro} />
              </div>
              <div className="st-field">
                <label htmlFor={`${id}-int`}>Int. number</label>
                <input id={`${id}-int`} className="st-input" value={fields.address.intNumber ?? ''} onChange={(e) => setAddress({ intNumber: e.target.value })} readOnly={ro} />
              </div>
            </div>
            <div className="st-field">
              <label htmlFor={`${id}-colony`}>Colony</label>
              <input id={`${id}-colony`} className="st-input" value={fields.address.colony ?? ''} onChange={(e) => setAddress({ colony: e.target.value })} readOnly={ro} />
            </div>
            <div className="st-formgrid st-formgrid--2">
              <div className="st-field">
                <label htmlFor={`${id}-city`}>City</label>
                <input id={`${id}-city`} className="st-input" value={fields.address.city ?? ''} onChange={(e) => setAddress({ city: e.target.value })} readOnly={ro} />
              </div>
              <div className="st-field">
                <label htmlFor={`${id}-state`}>State</label>
                <input id={`${id}-state`} className="st-input" value={fields.address.state ?? ''} onChange={(e) => setAddress({ state: e.target.value })} readOnly={ro} />
              </div>
            </div>
            <div className="st-formgrid st-formgrid--2">
              <div className="st-field">
                <label htmlFor={`${id}-zip`}>Postal code</label>
                <input id={`${id}-zip`} className="st-input" value={fields.address.zipCode ?? ''} onChange={(e) => setAddress({ zipCode: e.target.value })} readOnly={ro} />
              </div>
              <div className="st-field">
                <label htmlFor={`${id}-country`}>Country</label>
                <input id={`${id}-country`} className="st-input" value={fields.address.country ?? ''} onChange={(e) => setAddress({ country: e.target.value })} readOnly={ro} />
              </div>
            </div>
          </>
        ) : null}
        <div className="st-field">
          <label htmlFor={`${id}-label`}>Label</label>
          <input id={`${id}-label`} className="st-input" list={`${id}-labels`} value={fields.location} onChange={(e) => set('location', e.target.value)} readOnly={ro} />
          <datalist id={`${id}-labels`}>
            {LABEL_SUGGESTIONS[family].map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>
        <label className="st-toggle">
          <input type="checkbox" checked={fields.isPublic} onChange={(e) => set('isPublic', e.target.checked)} disabled={ro} /> Public (shown in the directory)
        </label>
      </div>
      {submitted && validation.message ? (
        <div className="st-error" role="alert">
          <Icon name="alert" size={13} /> {validation.message}
        </div>
      ) : validation.ok && validation.hint ? (
        <span className="st-hint">{validation.hint}</span>
      ) : family === 'phone' ? (
        <span className="st-hint">Simulated parser: full international numbers, or local numbers with explicit country and area code.</span>
      ) : null}
      {rowError ? (
        <div className="st-error" role="alert">
          <Icon name="alert" size={13} /> {rowError}
        </div>
      ) : null}
      {editing ? (
        <div className="st-card__actions">
          <button className="st-btn st-btn--sm st-btn--primary" onClick={apply}>
            {child ? 'Apply to draft' : 'Add to draft'}
          </button>
          {child && !child.deleted && position !== 1 ? (
            <button
              className="st-btn st-btn--sm"
              onClick={() => {
                const err = edit.makePrimary(family, child.ordinal);
                setRowError(err);
                if (!err) ws.notify('Moved to position 1 (primary) in your draft.', 'info');
              }}
            >
              <Icon name="star" size={13} /> Make primary
            </button>
          ) : null}
          {child && !child.deleted ? (
            <button
              className="st-btn st-btn--sm st-btn--danger"
              onClick={() => {
                edit.remove(family, child.ordinal);
                if (child.ordinal < 0) nav.select(null);
              }}
            >
              <Icon name="trash" size={13} /> Remove
            </button>
          ) : null}
          <button className="st-btn st-btn--sm st-btn--quiet" onClick={() => nav.select(null)}>
            Close
          </button>
        </div>
      ) : null}
      {child ? (
        <details className="st-details">
          <summary>Technical details</summary>
          <dl className="st-details__body">
            <dt>Ordinal</dt>
            <dd>{child.ordinal < 0 ? 'allocated on Save' : child.ordinal}</dd>
            <dt>Position</dt>
            <dd>{position || '—'}</dd>
            {family === 'phone' ? (
              <>
                <dt>E.164</dt>
                <dd>{(child.value as PhoneValue).e164}</dd>
                <dt>Interpretation</dt>
                <dd>{(child.value as PhoneValue).interpretation}</dd>
              </>
            ) : null}
            {family === 'address' ? (
              <>
                <dt>Value id</dt>
                <dd>{(child.value as { valueId: string }).valueId}</dd>
                <dt>Note</dt>
                <dd style={{ fontFamily: 'inherit' }}>Immutable shared value; a correction creates a new value for this association only.</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}
    </>
  );
}

function RevisionInspector({ contactId, rev, nav }: { contactId: string; rev: number; nav: StudioNav }) {
  const read = useRevisionView(contactId, rev, rev > 1 ? rev - 1 : null);
  const ws = useWorkspace();
  if (read.problem) {
    return (
      <>
        <div className="st-inspector__title">
          <Icon name="clock" size={15} /> Revision {rev}
        </div>
        <div className="st-card st-card--warn">{read.problem.detail}</div>
      </>
    );
  }
  if (!read.data) return null;
  const r = read.data.revision;
  return (
    <>
      <div className="st-inspector__title">
        <Icon name="clock" size={15} /> Revision {rev}
        <span className="st-badge st-badge--hist">read only</span>
      </div>
      <div className="st-isec">
        <dl className="st-ikv">
          <dt>Saved by</dt>
          <dd style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StAvatar initials={personaById(r.actorId).initials} hue={personaById(r.actorId).hue} size="sm" /> {personaById(r.actorId).fullName}
          </dd>
          <dt>When</dt>
          <dd>
            {fmt.dateTime(r.at)} {TZ_LABEL}
            <br />
            <span className="st-hint">{fmt.utc(r.at)}</span>
          </dd>
          <dt>Summary</dt>
          <dd>{r.summary}</dd>
          <dt>Changes</dt>
          <dd>{read.data.diff ? (read.data.diff.isEmpty ? 'No net difference vs previous revision' : `${diffFieldCount(read.data.diff)} field difference${diffFieldCount(read.data.diff) === 1 ? '' : 's'} vs revision ${rev - 1}`) : 'Creation'}</dd>
        </dl>
        <div className="st-card__actions">
          {rev > 1 ? (
            <button className="st-btn st-btn--sm" onClick={() => nav.compare(contactId, rev, rev - 1)}>
              <Icon name="compare" size={13} /> Compare with {rev - 1}
            </button>
          ) : null}
          <button className="st-btn st-btn--sm" onClick={() => nav.contact(contactId, { mode: null, rev: null, pin: null, sel: null })}>
            Return to now
          </button>
        </div>
      </div>
      <ActionsSection actions={r.actions} stamp={r.unitStamp} emptyDiff={!!read.data.diff?.isEmpty} />
      <details className="st-details">
        <summary>Technical details</summary>
        <dl className="st-details__body">
          <dt>Unit stamp</dt>
          <dd>{r.unitStamp}</dd>
          <dt>Actor key</dt>
          <dd>{personaById(r.actorId).actorKey}</dd>
          <dt>Read</dt>
          <dd>GET …/revisions/{rev}{rev > 1 ? `?compareEntityVersion=${rev - 1}` : ''}</dd>
          <dt>Activity</dt>
          <dd>
            <button className="st-link" onClick={() => nav.activity({ contact: contactId }, r.unitStamp)}>
              open unit
            </button>
          </dd>
        </dl>
      </details>
      <span className="st-hint">{ws.persona.name} is viewing history; nothing here edits the current record.</span>
    </>
  );
}

function ActionsSection({ actions, stamp, emptyDiff }: { actions: AuditUnit['actions']; stamp: string; emptyDiff: boolean }) {
  return (
    <div className="st-isec">
      <div className="st-isec__h">Actions in this Save ({actions.length})</div>
      {emptyDiff ? <span className="st-hint" style={{ color: 'var(--st-hist-text)' }}>The final diff is empty, but these actions happened inside unit {stamp}: a value changed and changed back.</span> : null}
      <ol className="st-actions">
        {actions.map((a) => (
          <li key={a.seq} className="st-action">
            <span className="st-action__seq">{a.seq}</span>
            <div>
              <div>
                {a.summary}
                <span className="st-action__kind">{a.kind}</span>
              </div>
              {a.before !== null || a.after !== null ? (
                <div className="st-action__ba">
                  {a.before !== null ? <span className="st-before">− {a.before}</span> : null}
                  {a.after !== null ? <span className="st-after">+ {a.after}</span> : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CompareInspector({ contactId, rev, pin, nav }: { contactId: string; rev: number; pin: number; nav: StudioNav }) {
  const read = useRevisionView(contactId, rev, pin);
  if (read.problem) {
    return (
      <>
        <div className="st-inspector__title">
          <Icon name="compare" size={15} /> Compare
        </div>
        <div className="st-card st-card--warn">{read.problem.detail}</div>
      </>
    );
  }
  if (!read.data || !read.data.diff) return null;
  const d = read.data.diff;
  const flipped = pin > rev;
  const older = Math.min(rev, pin);
  const newer = Math.max(rev, pin);
  const changed = d.children.filter((c) => c.status !== 'unchanged');
  return (
    <>
      <div className="st-inspector__title">
        <Icon name="compare" size={15} /> A → B
        <span className="st-badge st-badge--accent">{diffFieldCount(d)} differences</span>
      </div>
      <span className="st-hint">
        Before = revision {older}, after = revision {newer}{flipped ? ' (A is newer than B)' : ''}. Markers: − before, + after, ~ changed; labels say what.
      </span>
      {d.isEmpty ? (
        <div className="st-card st-card--hist">
          <div className="st-card__title">No net difference</div>
          <span className="st-hint">The final state equals revision {older}. The actions below still happened.</span>
        </div>
      ) : (
        <div className="st-diff">
          {d.profile.length ? <div className="st-diff__group">Profile</div> : null}
          {d.profile.map((f) => (
            <div key={f.path} className="st-diff__row">
              <span className="st-fname">{f.label}</span>
              <span className="st-before">− {(flipped ? f.after : f.before) ?? '(empty)'}</span>
              <span className="st-after">+ {(flipped ? f.before : f.after) ?? '(empty)'}</span>
            </div>
          ))}
          {changed.map((c) => (
            <React.Fragment key={`${c.family}-${c.ordinal}`}>
              <div className="st-diff__group">
                {c.label} <span className="st-mono">ord {c.ordinal}</span> <span className={`st-mark-label st-mark-label--${c.status}`}>{c.status}</span>
              </div>
              {c.status === 'changed' || (c.status === 'restored' && c.changes.length) ? (
                c.changes.map((f) => (
                  <button key={f.path} className="st-diff__row" style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => nav.compare(contactId, rev, pin, f.path)} title="Highlight in the sheet">
                    <span className="st-fname">{f.label}</span>
                    <span className="st-before">− {(flipped ? f.after : f.before) ?? '(empty)'}</span>
                    <span className="st-after">+ {(flipped ? f.before : f.after) ?? '(empty)'}</span>
                  </button>
                ))
              ) : (
                <div className="st-diff__row">
                  <span className={c.status === 'removed' ? 'st-before' : 'st-after'}>
                    {c.status === 'removed' ? '− ' : '+ '}
                    {c.display}
                  </span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      <ActionsSection actions={read.data.revision.actions} stamp={read.data.revision.unitStamp} emptyDiff={d.isEmpty} />
      <div className="st-card__actions">
        <button className="st-btn st-btn--sm" onClick={() => nav.timeline(contactId, rev, null)}>
          Timeline
        </button>
        <button className="st-btn st-btn--sm" onClick={() => nav.contact(contactId, { mode: null, rev: null, pin: null, sel: null })}>
          Return to now
        </button>
      </div>
    </>
  );
}

function UnitInspector({ stamp, nav }: { stamp: string; nav: StudioNav }) {
  const ws = useWorkspace();
  const unit = ws.unit(stamp);
  if (!unit) {
    return (
      <>
        <div className="st-inspector__title">
          <Icon name="activity" size={15} /> Activity entry
        </div>
        <p className="st-hint">Not found.</p>
      </>
    );
  }
  const actor = personaById(unit.actorId);
  const notAudit = unit.source === 'operational' || unit.source === 'agent' || unit.source === 'presence';
  const children = unit.source === 'batch' ? ws.server.data.units.filter((u) => u.batchId === unit.batchId && u.source === 'business') : [];
  const canValues = unit.contacts.every((c) => ws.can('read_history', c.contactId));
  return (
    <>
      <div className="st-inspector__title">
        <Icon name="activity" size={15} /> Activity entry
        <span className={`st-source st-source--${unit.source}`} style={{ marginLeft: 'auto' }}>
          {SOURCE_LABEL[unit.source]}
        </span>
      </div>
      <div style={{ fontWeight: 600 }}>{unit.summary}</div>
      {notAudit ? (
        <div className="st-card st-card--warn">
          <span className="st-hint">Not part of the business audit ledger: {unit.detail.source ?? 'separate simulated source'}. No committed revision.</span>
        </div>
      ) : null}
      <dl className="st-ikv">
        <dt>Actor</dt>
        <dd style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StAvatar initials={actor.initials} hue={actor.hue} size="sm" /> {actor.fullName}
        </dd>
        <dt>When</dt>
        <dd>
          {fmt.dateTime(unit.at)} {TZ_LABEL}
          <br />
          <span className="st-hint">{fmt.utc(unit.at)}</span>
        </dd>
        <dt>Kind</dt>
        <dd>{unit.kind}</dd>
        <dt>Affected</dt>
        <dd>
          {unit.contacts.map((c) => (
            <div key={c.contactId}>
              {ws.server.contactName(c.contactId)}
              {c.entityVersion ? ` · revision ${c.entityVersion}` : ''}
              {c.entityVersion && ws.can('read_history', c.contactId) ? (
                <>
                  {' '}
                  <button className="st-link" onClick={() => (c.entityVersion! > 1 ? nav.compare(c.contactId, c.entityVersion!, c.entityVersion! - 1) : nav.timeline(c.contactId, 1))}>
                    open in timeline
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </dd>
      </dl>
      {children.length ? (
        <div className="st-isec">
          <div className="st-isec__h">Units in this batch</div>
          <span className="st-hint">One single-contact Save per contact; the batch is a simulated grouping, not a multi-contact API.</span>
          {children.map((c) => (
            <button key={c.stamp} className="st-link" style={{ textAlign: 'left' }} onClick={() => nav.activity(undefined, c.stamp, true)}>
              {ws.server.contactName(c.contacts[0]!.contactId)} — {c.summary}
            </button>
          ))}
        </div>
      ) : null}
      {unit.actions.length ? canValues ? <ActionsSection actions={unit.actions} stamp={unit.stamp} emptyDiff={false} /> : <span className="st-hint">Action values hidden: {ws.persona.name} lacks read_history for this contact.</span> : null}
      <details className="st-details">
        <summary>Technical details</summary>
        <dl className="st-details__body">
          <dt>Stamp</dt>
          <dd>{unit.stamp}</dd>
          <dt>Correlation</dt>
          <dd>{unit.correlationId}</dd>
          {Object.entries(unit.detail).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </details>
      <div className="st-card__actions">
        {unit.contacts[0] ? (
          <button className="st-btn st-btn--sm" onClick={() => nav.contact(unit.contacts[0]!.contactId, { mode: null, rev: null, pin: null, sel: null })}>
            Open {ws.server.contactName(unit.contacts[0].contactId)}
          </button>
        ) : null}
      </div>
    </>
  );
}

export const _unusedInsp = { childDisplay };
