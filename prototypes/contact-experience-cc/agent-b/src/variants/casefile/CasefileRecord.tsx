import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { CasefileNav } from './CasefileApp';
import { Avatar } from './CasefileApp';
import { useWorkspace, type UncertainCheck } from '../../core/store';
import { useContactView, usePresenceOn, useReportPresence, useFlash, useScrollIntoView } from '../../core/hooks';
import { Icon } from '../../core/icons';
import type { Child, ContactState, Family, PhoneValue, Profile } from '../../core/types';
import { FAMILIES } from '../../core/types';
import { addressLines, childDisplay, displayNameOf, categoryOf, fmt, initialsOf, liveChildren, FAMILY_PLURAL, FAMILY_LABEL, TZ_LABEL } from '../../core/format';
import { personaById } from '../../core/fixtures';
import { childrenOf, useChannelFields, useEditing, LABEL_SUGGESTIONS, REGIONS, type ChannelFields } from '../../core/editing';
import { CasefileHistory } from './CasefileHistory';
import { profileFieldLabel, profileFieldText } from '../../core/engine';

const FAMILY_ICON: Record<Family, 'mail' | 'phone' | 'link' | 'pin'> = { email: 'mail', phone: 'phone', web_link: 'link', address: 'pin' };

export function ContactList({ current, nav }: { current: string | null; nav: CasefileNav }) {
  const ws = useWorkspace();
  return (
    <div>
      <p className="cf-side-title">Contacts · {ws.tenant.name}</p>
      <div className="cf-contacts">
        {ws.contacts.map((c) => (
          <a key={c.id} className="cf-contact-card" href={`#/casefile/contact/${c.id}`} aria-current={c.id === current ? 'true' : undefined}>
            <Avatar initials={initialsOf(c.name)} hue={c.category === 'Person' ? 210 : 30} square={c.category === 'Organization'} />
            <span>
              <span className="cf-contact-card__name">{c.name}</span>
              <br />
              <span className="cf-contact-card__sub">
                {c.category} · revision {c.revision.entityVersion}
                {c.projection === 'directory' ? ' · directory view' : ''}
              </span>
            </span>
            <Icon name="chevronRight" size={16} />
          </a>
        ))}
      </div>
      {ws.persona.id === 'diego' ? <p className="cf-hint">Diego holds full detail/history only for Lina Torres; other contacts appear as the public directory projection.</p> : null}
    </div>
  );
}

export function CasefileContact({ contactId, nav, query, paneOpen }: { contactId: string; nav: CasefileNav; query: URLSearchParams; paneOpen: boolean }) {
  const ws = useWorkspace();
  const view = useContactView(contactId);
  const others = usePresenceOn(contactId);
  const tab = query.get('tab') === 'history' ? 'history' : 'record';
  const focus = query.get('focus');
  const [editMode, setEditMode] = useState(false);
  const editing = editMode || !!view?.editing;
  useReportPresence(contactId, tab === 'history' ? 'history' : editing ? 'editing' : 'record', editing && tab === 'record');
  useEffect(() => {
    if (!view?.editing) setEditMode(false);
  }, [view?.editing]);

  if (!view) return null;
  const rev = view.revision;
  const state = view.state;

  return (
    <div className="cf-layout">
      <aside className="cf-layout__side">
        <ContactList current={contactId} nav={nav} />
      </aside>
      <div>
        {view.loading ? (
          <div className="cf-card">
            <div className="cf-skeleton" aria-busy="true" aria-label="Loading contact">
              <span style={{ width: '40%' }} />
              <span style={{ width: '70%' }} />
              <span style={{ width: '55%' }} />
              <span style={{ width: '65%' }} />
            </div>
          </div>
        ) : view.problem ? (
          <div className="cf-bar cf-bar--danger" role="alert">
            <Icon name="shield" className="cf-bar__icon" />
            <div className="cf-bar__body">
              <div className="cf-bar__title">
                {view.problem.status} · {view.problem.code}
              </div>
              <div>{view.problem.detail}</div>
              <div className="cf-hint">Trace {view.problem.traceId}</div>
            </div>
          </div>
        ) : rev && state ? (
          <>
            <StatusBars contactId={contactId} nav={nav} />
            <div className="cf-card">
              <header className="cf-contact-head">
                <Avatar initials={initialsOf(displayNameOf(state))} hue={state.profile.contactTypeId === 1 ? 210 : 30} size="lg" square={state.profile.contactTypeId === 2} />
                <div className="cf-contact-head__meta">
                  <h1>{displayNameOf(state)}</h1>
                  <div className="cf-contact-head__sub">
                    <span className="cf-badge">{categoryOf(state)}</span>
                    {view.projection === 'directory' ? <span className="cf-badge cf-badge--warning">Directory view · public channels only</span> : null}
                    {state.deleted ? <span className="cf-badge cf-badge--danger">Deleted</span> : null}
                    <span>
                      Revision <strong>{rev.entityVersion}</strong> · saved by {personaById(rev.actorId).name} · {fmt.dateTime(rev.at)} {TZ_LABEL}
                    </span>
                    {view.editing ? <span className="cf-badge cf-badge--brand">Draft on revision {ws.draft?.baseVersion}</span> : null}
                    {others.length ? (
                      <span className="cf-presence" title="Presence is awareness only: it is not a lock and does not grant permission to overwrite.">
                        <span className="cf-presence__stack">
                          {others.map((p) => (
                            <Avatar key={p.tabId} initials={personaById(p.personaId).initials} hue={personaById(p.personaId).hue} size="sm" />
                          ))}
                        </span>
                        <span className="cf-presence__text">
                          {others.map((p) => `${personaById(p.personaId).name} ${p.editing ? 'is editing' : 'is viewing'}${p.section && p.section !== 'record' ? ` (${p.section})` : ''}`).join(' · ')}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="cf-contact-head__actions">
                  {tab === 'record' && view.projection === 'detail' && ws.can('edit', contactId) ? (
                    <button className={`cf-btn${editing ? ' cf-btn--subtle' : ''}`} onClick={() => setEditMode((m) => !m)} aria-pressed={editing}>
                      <Icon name="edit" size={16} />
                      {editing ? 'Editing' : 'Edit record'}
                    </button>
                  ) : null}
                  {tab === 'record' && ws.can('read_history', contactId) ? (
                    <button className="cf-btn" onClick={() => nav.history(contactId, rev.entityVersion, rev.entityVersion > 1 ? rev.entityVersion - 1 : null)}>
                      <Icon name="history" size={16} />
                      History
                    </button>
                  ) : null}
                  {tab === 'history' ? (
                    <button className="cf-btn" onClick={() => nav.contact(contactId)}>
                      <Icon name="arrowLeft" size={16} />
                      Back to current
                    </button>
                  ) : null}
                </div>
              </header>
              <div className="cf-tabs" role="tablist">
                <button role="tab" className="cf-tab" aria-selected={tab === 'record'} onClick={() => nav.contact(contactId)}>
                  <Icon name="person" size={16} /> Record
                </button>
                {ws.can('read_history', contactId) ? (
                  <button role="tab" className="cf-tab" aria-selected={tab === 'history'} onClick={() => nav.history(contactId, rev.entityVersion, rev.entityVersion > 1 ? rev.entityVersion - 1 : null)}>
                    <Icon name="history" size={16} /> History <span className="cf-badge">{ws.revisions(contactId).length}</span>
                  </button>
                ) : null}
              </div>
              {tab === 'record' ? (
                <RecordBody contactId={contactId} state={state} editing={editing && view.projection === 'detail'} focus={focus} />
              ) : (
                <CasefileHistory contactId={contactId} nav={nav} query={query} />
              )}
            </div>
          </>
        ) : null}
      </div>
      {view.editing && tab === 'record' ? <PendingTray contactId={contactId} nav={nav} paneOpen={paneOpen} /> : null}
    </div>
  );
}

function StatusBars({ contactId, nav }: { contactId: string; nav: CasefileNav }) {
  const ws = useWorkspace();
  const [check, setCheck] = useState<UncertainCheck | null>(null);
  const s = ws.saveState;
  const draft = ws.draft && ws.draft.contactId === contactId ? ws.draft : null;
  useEffect(() => {
    if (s.status !== 'uncertain') setCheck(null);
  }, [s.status]);

  return (
    <>
      {ws.conflict && draft ? <ConflictPanel contactId={contactId} nav={nav} /> : null}
      {ws.incoming && draft && !ws.conflict ? (
        <div className="cf-bar cf-bar--warning" role="status">
          <Icon name="users" className="cf-bar__icon" />
          <div className="cf-bar__body">
            <div className="cf-bar__title">
              {personaById(ws.incoming.actorId).name} saved revision {ws.incoming.entityVersion} while you are editing revision {draft.baseVersion}
            </div>
            <div>
              “{ws.incoming.summary}” · {fmt.dateTime(ws.incoming.at)}. Your draft is kept and nothing was overwritten. Saving now would be rejected as stale; reconcile first.
            </div>
            <div className="cf-bar__actions">
              <button className="cf-btn cf-btn--sm cf-btn--primary" onClick={() => ws.openReconcile()}>
                Reconcile now
              </button>
              <button className="cf-btn cf-btn--sm" onClick={() => nav.history(contactId, ws.incoming!.entityVersion, draft.baseVersion)}>
                See their changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {draft?.origin === 'reconciled' && !ws.conflict ? (
        <div className="cf-bar cf-bar--info" role="status">
          <Icon name="check" className="cf-bar__icon" />
          <div className="cf-bar__body">
            <div className="cf-bar__title">Draft now targets revision {draft.baseVersion}</div>
            <div>Your changes were carried onto the latest revision. Review the pending list, use “Take theirs” on any field you do not want to override, then Save.</div>
          </div>
        </div>
      ) : null}
      {s.status === 'saved' && s.result ? (
        <div className="cf-bar cf-bar--success" role="status">
          <Icon name="check" className="cf-bar__icon" />
          <div className="cf-bar__body">
            <div className="cf-bar__title">Saved together as revision {s.result.entityVersion}</div>
            <div>
              One audit unit{s.result.dbrowVersion ? <> · stamp <code>{s.result.dbrowVersion}</code></> : null}. Committed results only; the record below is the current read.
            </div>
            <div className="cf-bar__actions">
              <button className="cf-btn cf-btn--sm" onClick={() => nav.history(contactId, s.result!.entityVersion, s.result!.entityVersion - 1)}>
                Open this revision
              </button>
              <button className="cf-btn cf-btn--sm cf-btn--subtle" onClick={ws.clearSaveState}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {s.status === 'noop' ? (
        <div className="cf-bar cf-bar--info" role="status">
          <Icon name="info" className="cf-bar__icon" />
          <div className="cf-bar__body">
            <div className="cf-bar__title">Nothing to save</div>
            <div>Every command was ineffective, so the contact keeps its revision and no audit stamp was allocated.</div>
            <div className="cf-bar__actions">
              <button className="cf-btn cf-btn--sm cf-btn--subtle" onClick={ws.clearSaveState}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {s.status === 'error' && s.problem ? (
        <div className="cf-bar cf-bar--danger" role="alert">
          <Icon name="alert" className="cf-bar__icon" />
          <div className="cf-bar__body">
            <div className="cf-bar__title">
              Save failed · {s.problem.status} {s.problem.code}
            </div>
            <div>{s.problem.detail}</div>
            <div className="cf-hint">Nothing was committed. Trace {s.problem.traceId} · automatic retry not allowed.</div>
            <div className="cf-bar__actions">
              <button className="cf-btn cf-btn--sm" onClick={ws.clearSaveState}>
                Keep editing
              </button>
              <button className="cf-btn cf-btn--sm cf-btn--subtle" onClick={ws.discardDraft}>
                Discard draft
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {s.status === 'uncertain' && s.problem ? (
        <div className="cf-bar cf-bar--warning" role="alert">
          <Icon name="alert" className="cf-bar__icon" />
          <div className="cf-bar__body">
            <div className="cf-bar__title">Save outcome unknown (500 commit_uncertain)</div>
            <div>{s.problem.detail} Your draft is preserved. There is no automatic retry and no recovery receipt.</div>
            {check ? <div style={{ marginTop: 6 }}>{check.message}</div> : null}
            <div className="cf-bar__actions">
              {!check ? (
                <button className="cf-btn cf-btn--sm cf-btn--primary" onClick={() => setCheck(ws.checkUncertain())}>
                  Check the current revision
                </button>
              ) : check.committed ? (
                <>
                  <button className="cf-btn cf-btn--sm cf-btn--primary" onClick={ws.acceptUncertain}>
                    It committed · drop my draft
                  </button>
                  <button className="cf-btn cf-btn--sm" onClick={() => nav.history(contactId, check.latest.entityVersion, check.latest.entityVersion - 1)}>
                    Inspect revision {check.latest.entityVersion}
                  </button>
                </>
              ) : (
                <>
                  <button className="cf-btn cf-btn--sm cf-btn--primary" onClick={ws.clearSaveState}>
                    Keep my draft and decide
                  </button>
                  <button className="cf-btn cf-btn--sm cf-btn--subtle" onClick={ws.discardDraft}>
                    Discard draft
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConflictPanel({ contactId, nav }: { contactId: string; nav: CasefileNav }) {
  const ws = useWorkspace();
  const c = ws.conflict!;
  const theirActor = personaById(c.theirs.actorId).name;
  const theirChanges = [
    ...c.diffTheirs.profile.map((f) => ({ path: f.path, text: `${f.label}: ${f.before ?? '(empty)'} → ${f.after ?? '(empty)'}` })),
    ...c.diffTheirs.children.flatMap((ch) =>
      ch.status === 'unchanged'
        ? []
        : ch.status === 'changed'
          ? ch.changes.map((f) => ({ path: f.path, text: `${ch.label} ${f.label.toLowerCase()}: ${f.before ?? '(empty)'} → ${f.after ?? '(empty)'}` }))
          : [{ path: `${ch.family}.${ch.ordinal}`, text: `${ch.label} ${ch.status}: ${ch.display}` }],
    ),
  ];
  const overlap = (path: string) => c.overlaps.some((o) => o === path || o.startsWith(`${path}.`) || path.startsWith(`${o}.`));
  const minePaths = [
    ...c.mineDiff.profile.map((f) => f.path),
    ...c.mineDiff.children.flatMap((ch) => (ch.status === 'changed' ? ch.changes.map((f) => f.path) : ch.status === 'unchanged' ? [] : [`${ch.family}.${ch.ordinal}`])),
  ];
  return (
    <div className="cf-bar cf-bar--danger" role="alertdialog" aria-labelledby="cf-conflict-title">
      <Icon name="alert" className="cf-bar__icon" />
      <div className="cf-bar__body cf-conflict">
        <div>
          <div className="cf-bar__title" id="cf-conflict-title">
            Your Save was rejected as stale (409 conflict)
          </div>
          <div>
            You started from revision {c.base.entityVersion}; {theirActor} committed revision {c.theirs.entityVersion} at {fmt.dateTime(c.theirs.at)}. Nothing was overwritten and nothing was retried. Choose what to do with your draft.
          </div>
        </div>
        <div className="cf-conflict__cols">
          <div className="cf-conflict__col">
            <h4>
              <Icon name="edit" size={14} /> Your draft (from revision {c.base.entityVersion})
            </h4>
            <ul>
              {c.mine.map((p, i) => (
                <li key={p.key} className={overlap(minePaths[i] ?? '') ? 'cf-conflict__overlap' : undefined}>
                  {p.text}
                  {overlap(minePaths[i] ?? '') ? ' · overlaps' : ''}
                </li>
              ))}
            </ul>
          </div>
          <div className="cf-conflict__col">
            <h4>
              <Icon name="users" size={14} /> {theirActor}’s revision {c.theirs.entityVersion}: “{c.theirs.summary}”
            </h4>
            <ul>
              {theirChanges.map((t) => (
                <li key={t.path} className={overlap(t.path) ? 'cf-conflict__overlap' : undefined}>
                  {t.text}
                  {overlap(t.path) ? ' · overlaps' : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="cf-bar__actions">
          <button className="cf-btn cf-btn--sm cf-btn--primary" onClick={() => ws.resolveConflict('rebase')}>
            Keep my draft on revision {c.theirs.entityVersion}
          </button>
          <button className="cf-btn cf-btn--sm" onClick={() => nav.history(contactId, c.theirs.entityVersion, c.base.entityVersion)}>
            Open their diff
          </button>
          <button className="cf-btn cf-btn--sm cf-btn--danger" onClick={() => ws.resolveConflict('discard')}>
            Discard my draft
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Record body ----------------

function RecordBody({ contactId, state, editing, focus }: { contactId: string; state: ContactState; editing: boolean; focus: string | null }) {
  const ws = useWorkspace();
  const flash = useFlash(focus);
  const focusRowId = focus ? `cf-row-${focus.split('.').slice(0, 2).join('-')}` : null;
  useScrollIntoView(focusRowId);
  const [tech, setTech] = useState(false);
  const draft = ws.draft && ws.draft.contactId === contactId ? ws.draft : null;
  return (
    <div className={editing ? 'cf-editing' : undefined}>
      <ProfileSection contactId={contactId} state={state} editing={editing} base={draft?.base ?? null} flash={flash} />
      {FAMILIES.map((family) => (
        <ChannelSection key={family} contactId={contactId} family={family} state={state} editing={editing} base={draft?.base ?? null} flash={flash} tech={tech} />
      ))}
      <div className="cf-section">
        <label className="cf-check">
          <input type="checkbox" checked={tech} onChange={(e) => setTech(e.target.checked)} />
          Show technical details (ordinals, saved positions, address value ids)
        </label>
      </div>
    </div>
  );
}

function ProfileSection({ contactId, state, editing, base, flash }: { contactId: string; state: ContactState; editing: boolean; base: ContactState | null; flash: string | null }) {
  const [open, setOpen] = useState(false);
  const p = state.profile;
  const keys: (keyof Profile)[] = p.contactTypeId === 1 ? ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'personAlias', 'summary'] : ['fullName', 'displayName', 'summary'];
  const changed = (k: keyof Profile) => base && (base.profile[k] ?? null) !== (p[k] ?? null);
  return (
    <section className="cf-section" aria-labelledby="cf-profile-title">
      <div className="cf-section__head">
        <h2 className="cf-section__title" id="cf-profile-title">
          Profile
        </h2>
        {editing && !open ? (
          <div className="cf-section__actions">
            <button className="cf-btn cf-btn--sm" onClick={() => setOpen(true)}>
              <Icon name="edit" size={14} /> Edit profile
            </button>
          </div>
        ) : null}
      </div>
      {open ? (
        <ProfileEditor contactId={contactId} profile={p} onDone={() => setOpen(false)} />
      ) : (
        <dl className="cf-profile-grid">
          {keys.map((k) => (
            <div key={k} className={`cf-kv${flash === `profile.${k}` ? ' cf-row--flash' : ''}`} id={`cf-row-profile-${k}`}>
              <dt>
                {profileFieldLabel(k)}
                {changed(k) ? <span className="cf-badge cf-badge--brand" style={{ marginLeft: 6 }}>pending</span> : null}
              </dt>
              <dd className={profileFieldText(k, p) ? undefined : 'cf-kv__empty'}>{profileFieldText(k, p) ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function ProfileEditor({ contactId, profile, onDone }: { contactId: string; profile: Profile; onDone: () => void }) {
  const editing = useEditing(contactId);
  const [p, setP] = useState<Profile>(profile);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Profile, v: string) => setP((x) => ({ ...x, [k]: v === '' ? null : v }));
  const apply = () => {
    const e = editing.commitProfile(p);
    if (e) setError(e);
    else onDone();
  };
  const person = p.contactTypeId === 1;
  return (
    <div className="cf-editor" role="group" aria-label="Edit profile">
      <div className="cf-editor__grid">
        <div className="cf-field">
          <label htmlFor="pf-full">Full name</label>
          <input id="pf-full" className="cf-input" value={p.fullName} onChange={(e) => setP((x) => ({ ...x, fullName: e.target.value }))} />
        </div>
        <div className="cf-field">
          <label htmlFor="pf-display">Display name</label>
          <input id="pf-display" className="cf-input" value={p.displayName ?? ''} onChange={(e) => set('displayName', e.target.value)} placeholder="Defaults to full name" />
        </div>
        {person ? (
          <>
            <div className="cf-field">
              <label htmlFor="pf-first">First name</label>
              <input id="pf-first" className="cf-input" value={p.personFirstName ?? ''} onChange={(e) => set('personFirstName', e.target.value)} />
            </div>
            <div className="cf-field">
              <label htmlFor="pf-ln1">First surname</label>
              <input id="pf-ln1" className="cf-input" value={p.personLastName1 ?? ''} onChange={(e) => set('personLastName1', e.target.value)} />
            </div>
            <div className="cf-field">
              <label htmlFor="pf-ln2">Second surname</label>
              <input id="pf-ln2" className="cf-input" value={p.personLastName2 ?? ''} onChange={(e) => set('personLastName2', e.target.value)} />
            </div>
            <div className="cf-field">
              <label htmlFor="pf-alias">Alias</label>
              <input id="pf-alias" className="cf-input" value={p.personAlias ?? ''} onChange={(e) => set('personAlias', e.target.value)} />
            </div>
          </>
        ) : null}
      </div>
      <div className="cf-field">
        <label htmlFor="pf-summary">Summary</label>
        <textarea id="pf-summary" className="cf-textarea" value={p.summary ?? ''} onChange={(e) => set('summary', e.target.value)} />
      </div>
      {error ? (
        <div className="cf-error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </div>
      ) : null}
      <div className="cf-editor__foot">
        <span className="cf-hint">Profile replace supplies every field; empty optional fields clear. Names are shared immutable values, so nothing else changes.</span>
        <button className="cf-btn cf-btn--sm cf-btn--primary" onClick={apply}>
          Apply to draft
        </button>
        <button className="cf-btn cf-btn--sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ChannelSection({ contactId, family, state, editing, base, flash, tech }: { contactId: string; family: Family; state: ContactState; editing: boolean; base: ContactState | null; flash: string | null; tech: boolean }) {
  const ws = useWorkspace();
  const edit = useEditing(contactId);
  const all = childrenOf(state, family);
  const live = liveChildren(all);
  const deleted = all.filter((c) => c.deleted && c.ordinal > 0);
  const [adding, setAdding] = useState(false);
  const [editingOrdinal, setEditingOrdinal] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  useEffect(() => {
    if (!editing) {
      setAdding(false);
      setEditingOrdinal(null);
    }
  }, [editing]);
  const baseChild = (ordinal: number) => (base ? childrenOf(base, family).find((c) => c.ordinal === ordinal) ?? null : null);
  const isPending = (c: Child<unknown>) => {
    if (!base) return false;
    if (c.ordinal < 0) return true;
    const b = baseChild(c.ordinal);
    if (!b) return false;
    const posBase = liveChildren(childrenOf(base, family)).findIndex((x) => x.ordinal === c.ordinal) + 1;
    return JSON.stringify(b.value) !== JSON.stringify(c.value) || b.location !== c.location || b.isPublic !== c.isPublic || b.extension !== c.extension || b.deleted !== c.deleted || posBase !== c.displayOrder;
  };
  return (
    <section className="cf-section" aria-labelledby={`cf-sec-${family}`}>
      <div className="cf-section__head">
        <h2 className="cf-section__title" id={`cf-sec-${family}`}>
          <Icon name={FAMILY_ICON[family]} size={16} /> {FAMILY_PLURAL[family]} <span className="cf-section__count">{live.length}</span>
        </h2>
        {editing ? (
          <div className="cf-section__actions">
            <button className="cf-btn cf-btn--sm" onClick={() => setAdding(true)} disabled={adding}>
              <Icon name="plus" size={14} /> Add {FAMILY_LABEL[family].toLowerCase()}
            </button>
          </div>
        ) : null}
      </div>
      {live.length === 0 && !adding ? <p className="cf-hint">No {FAMILY_PLURAL[family].toLowerCase()} on this contact.</p> : null}
      {live.map((c, i) =>
        editingOrdinal === c.ordinal ? (
          <ChannelEditor key={c.ordinal} contactId={contactId} family={family} child={c} onDone={() => setEditingOrdinal(null)} />
        ) : (
          <div
            key={c.ordinal}
            id={`cf-row-${family}-${c.ordinal}`}
            className={`cf-row${isPending(c) ? ' cf-row--pending' : ''}${c.ordinal < 0 ? ' cf-row--new' : ''}${flash && flash.startsWith(`${family}.${c.ordinal}`) ? ' cf-row--flash' : ''}`}
          >
            <span className="cf-row__icon">
              <Icon name={FAMILY_ICON[family]} size={16} />
            </span>
            <div className="cf-row__main">
              <span className="cf-row__value">
                {family === 'address' ? addressLines(c.value as never).join(', ') : childDisplay(family, c)}
              </span>
              <span className="cf-row__meta">
                {i === 0 ? (
                  <span className="cf-primary">
                    <Icon name="starFill" size={12} /> Primary
                  </span>
                ) : (
                  <span>Position {c.displayOrder}</span>
                )}
                {c.location ? <span className="cf-badge">{c.location}</span> : <span className="cf-badge">No label</span>}
                <span className="cf-vis">
                  <Icon name={c.isPublic ? 'globe' : 'lock'} size={12} /> {c.isPublic ? 'Public' : 'Private'}
                </span>
                {family === 'phone' && (c.value as PhoneValue).interpretation !== 'international' ? (
                  <span title="Entered as a local number with explicit country/area context">entered “{(c.value as PhoneValue).raw}” · {(c.value as PhoneValue).defaultRegion} {(c.value as PhoneValue).areaCode}</span>
                ) : null}
                {c.ordinal < 0 ? <span className="cf-badge cf-badge--brand">New · saved at the end</span> : isPending(c) ? <span className="cf-badge cf-badge--brand">Pending</span> : null}
                {tech ? (
                  <span className="cf-mono">
                    ordinal {c.ordinal < 0 ? '(new)' : c.ordinal} · order {c.displayOrder}
                    {family === 'address' ? ` · value ${(c.value as { valueId: string }).valueId}` : ''}
                    {family === 'phone' ? ` · ${(c.value as PhoneValue).e164}` : ''}
                  </span>
                ) : null}
              </span>
            </div>
            {editing ? (
              <div className="cf-row__actions">
                {i !== 0 ? (
                  <button
                    className="cf-btn cf-btn--sm cf-btn--subtle"
                    onClick={() => {
                      const err = edit.makePrimary(family, c.ordinal);
                      setRowError(err);
                      if (!err) ws.notify(`${FAMILY_LABEL[family]} moved to position 1 (primary) in your draft.`, 'info');
                    }}
                    title="Move to position 1"
                  >
                    <Icon name="star" size={14} /> Make primary
                  </button>
                ) : null}
                <button className="cf-btn cf-btn--sm cf-btn--subtle" onClick={() => setEditingOrdinal(c.ordinal)} aria-label={`Edit ${childDisplay(family, c)}`}>
                  <Icon name="edit" size={14} /> Edit
                </button>
                <button className="cf-btn cf-btn--sm cf-btn--subtle cf-btn--danger" onClick={() => edit.remove(family, c.ordinal)} aria-label={`Remove ${childDisplay(family, c)}`}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ) : null}
          </div>
        ),
      )}
      {editing
        ? deleted.map((c) => (
            <div key={c.ordinal} className="cf-row cf-row--deleted">
              <span className="cf-row__icon">
                <Icon name={FAMILY_ICON[family]} size={16} />
              </span>
              <div className="cf-row__main">
                <span className="cf-row__value">{childDisplay(family, c)}</span>
                <span className="cf-row__meta">
                  <span className="cf-badge cf-badge--danger">{baseChild(c.ordinal)?.deleted ? 'Deleted in an earlier revision' : 'Removed in this draft'}</span>
                  {tech ? <span className="cf-mono">ordinal {c.ordinal} retained</span> : null}
                </span>
              </div>
              <div className="cf-row__actions">
                <button className="cf-btn cf-btn--sm cf-btn--subtle" onClick={() => edit.restore(family, c.ordinal)}>
                  <Icon name="restore" size={14} /> Restore (appends)
                </button>
              </div>
            </div>
          ))
        : null}
      {rowError ? (
        <div className="cf-error" role="alert">
          <Icon name="alert" size={14} /> {rowError}
        </div>
      ) : null}
      {adding ? <ChannelEditor contactId={contactId} family={family} child={null} onDone={() => setAdding(false)} /> : null}
    </section>
  );
}

export function ChannelEditor({ contactId, family, child, onDone }: { contactId: string; family: Family; child: Child<unknown> | null; onDone: () => void }) {
  const edit = useEditing(contactId);
  const { fields, set, setPhone, setAddress, validation } = useChannelFields(family, child);
  const [submitted, setSubmitted] = useState(false);
  const apply = () => {
    setSubmitted(true);
    if (!validation.ok) return;
    const err = edit.commitChannel(family, child?.ordinal ?? null, fields);
    if (!err) onDone();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      apply();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onDone();
    }
  };
  const id = `ce-${family}-${child?.ordinal ?? 'new'}`;
  return (
    <div className="cf-editor" role="group" aria-label={child ? `Edit ${FAMILY_LABEL[family].toLowerCase()}` : `Add ${FAMILY_LABEL[family].toLowerCase()}`} onKeyDown={onKey}>
      {family === 'email' || family === 'web_link' ? (
        <div className="cf-editor__grid cf-editor__grid--wide">
          <div className="cf-field">
            <label htmlFor={`${id}-value`}>{family === 'email' ? 'Email address' : 'URL'}</label>
            <input id={`${id}-value`} className="cf-input" value={fields.value} onChange={(e) => set('value', e.target.value)} autoFocus aria-invalid={submitted && !validation.ok ? 'true' : undefined} inputMode={family === 'email' ? 'email' : 'url'} />
          </div>
          {family === 'web_link' ? (
            <div className="cf-field">
              <label htmlFor={`${id}-title`}>Title</label>
              <input id={`${id}-title`} className="cf-input" value={fields.title} onChange={(e) => set('title', e.target.value)} />
            </div>
          ) : null}
          <LabelAndVisibility id={id} family={family} fields={fields} set={set} />
        </div>
      ) : null}
      {family === 'phone' ? (
        <>
          <div className="cf-editor__grid">
            <div className="cf-field">
              <label htmlFor={`${id}-number`}>Number</label>
              <input id={`${id}-number`} className="cf-input" value={fields.phone.number} onChange={(e) => setPhone({ number: e.target.value })} autoFocus placeholder="+52 777 312 3456 or 312-3456" inputMode="tel" aria-invalid={submitted && !validation.ok ? 'true' : undefined} />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-region`}>Country (for local numbers)</label>
              <select id={`${id}-region`} className="cf-select" value={fields.phone.defaultRegion} onChange={(e) => setPhone({ defaultRegion: e.target.value })}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-area`}>Area code (optional)</label>
              <input id={`${id}-area`} className="cf-input" value={fields.phone.areaCode} onChange={(e) => setPhone({ areaCode: e.target.value })} placeholder="777" inputMode="numeric" />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-ext`}>Extension</label>
              <input id={`${id}-ext`} className="cf-input" value={fields.phone.extension} onChange={(e) => setPhone({ extension: e.target.value })} inputMode="numeric" />
            </div>
          </div>
          <div className="cf-editor__grid">
            <LabelAndVisibility id={id} family={family} fields={fields} set={set} />
          </div>
        </>
      ) : null}
      {family === 'address' ? (
        <>
          <div className="cf-editor__grid">
            <div className="cf-field">
              <label htmlFor={`${id}-street`}>Street</label>
              <input id={`${id}-street`} className="cf-input" value={fields.address.streetName ?? ''} onChange={(e) => setAddress({ streetName: e.target.value })} autoFocus />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-ext`}>Ext. number</label>
              <input id={`${id}-ext`} className="cf-input" value={fields.address.extNumber ?? ''} onChange={(e) => setAddress({ extNumber: e.target.value })} />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-int`}>Int. number</label>
              <input id={`${id}-int`} className="cf-input" value={fields.address.intNumber ?? ''} onChange={(e) => setAddress({ intNumber: e.target.value })} />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-colony`}>Colony</label>
              <input id={`${id}-colony`} className="cf-input" value={fields.address.colony ?? ''} onChange={(e) => setAddress({ colony: e.target.value })} />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-city`}>City</label>
              <input id={`${id}-city`} className="cf-input" value={fields.address.city ?? ''} onChange={(e) => setAddress({ city: e.target.value })} />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-state`}>State</label>
              <input id={`${id}-state`} className="cf-input" value={fields.address.state ?? ''} onChange={(e) => setAddress({ state: e.target.value })} />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-zip`}>Postal code</label>
              <input id={`${id}-zip`} className="cf-input" value={fields.address.zipCode ?? ''} onChange={(e) => setAddress({ zipCode: e.target.value })} />
            </div>
            <div className="cf-field">
              <label htmlFor={`${id}-country`}>Country</label>
              <input id={`${id}-country`} className="cf-input" value={fields.address.country ?? ''} onChange={(e) => setAddress({ country: e.target.value })} />
            </div>
          </div>
          <div className="cf-editor__grid">
            <LabelAndVisibility id={id} family={family} fields={fields} set={set} />
          </div>
        </>
      ) : null}
      {submitted && validation.message ? (
        <div className="cf-error" role="alert">
          <Icon name="alert" size={14} /> {validation.message}
        </div>
      ) : null}
      <div className="cf-editor__foot">
        <span className="cf-hint">{validation.ok ? validation.hint ?? (child ? 'Replace keeps this entry’s identity and position.' : 'New entries are appended; save first to make one primary.') : validation.message && submitted ? '' : family === 'phone' ? 'Simulated parser: full international numbers, or local numbers with explicit country/area.' : ''}</span>
        <button className="cf-btn cf-btn--sm cf-btn--primary" onClick={apply}>
          {child ? 'Apply to draft' : 'Add to draft'}
        </button>
        <button className="cf-btn cf-btn--sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function LabelAndVisibility({ id, family, fields, set }: { id: string; family: Family; fields: ChannelFields; set: <K extends keyof ChannelFields>(k: K, v: ChannelFields[K]) => void }) {
  return (
    <>
      <div className="cf-field">
        <label htmlFor={`${id}-label`}>Label</label>
        <input id={`${id}-label`} className="cf-input" list={`${id}-labels`} value={fields.location} onChange={(e) => set('location', e.target.value)} />
        <datalist id={`${id}-labels`}>
          {LABEL_SUGGESTIONS[family].map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>
      <div className="cf-field">
        <span className="cf-label">Visibility</span>
        <label className="cf-check" style={{ height: 32 }}>
          <input type="checkbox" checked={fields.isPublic} onChange={(e) => set('isPublic', e.target.checked)} />
          Public (shown in the directory)
        </label>
      </div>
    </>
  );
}

function PendingTray({ contactId, nav, paneOpen }: { contactId: string; nav: CasefileNav; paneOpen: boolean }) {
  const ws = useWorkspace();
  const draft = ws.draft!;
  const saving = ws.saveState.status === 'saving';
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => setConfirmDiscard(false), [ws.pending.length]);
  const overlaps = useMemo(() => (draft.origin === 'reconciled' ? ws.pending : []), [draft.origin, ws.pending]);
  void nav;
  return (
    <div className={`cf-tray${paneOpen ? ' cf-tray--withpane' : ''}`} role="region" aria-label="Pending changes">
      <div>
        <div className="cf-tray__title">
          <Icon name="edit" size={16} />
          {ws.pending.length ? `${ws.pending.length} pending change${ws.pending.length === 1 ? '' : 's'} · saved together as one revision` : 'No pending changes yet'}
          <span className="cf-badge">on revision {draft.baseVersion}</span>
          {draft.origin === 'sidekick' ? <span className="cf-badge cf-badge--brand">staged by sidekick</span> : null}
        </div>
        {ws.draftError ? (
          <div className="cf-error" role="alert">
            <Icon name="alert" size={14} /> {ws.draftError}
          </div>
        ) : (
          <ol className="cf-tray__list">
            {ws.pending.map((p) => (
              <li key={p.key}>
                {p.text}
                {overlaps.includes(p) && p.ordinal !== null && p.family !== 'profile' && p.family !== 'contact' ? (
                  <>
                    {' '}
                    <button className="cf-link" onClick={() => ws.revertPath(`${p.family}.${p.ordinal}`)}>
                      Take theirs
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="cf-tray__actions">
        {confirmDiscard ? (
          <>
            <span className="cf-hint">Discard all changes?</span>
            <button className="cf-btn cf-btn--danger" onClick={ws.discardDraft}>
              Discard
            </button>
            <button className="cf-btn cf-btn--subtle" onClick={() => setConfirmDiscard(false)}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button className="cf-btn cf-btn--subtle" onClick={() => (ws.pending.length ? setConfirmDiscard(true) : ws.discardDraft())} disabled={saving}>
              {ws.pending.length ? 'Discard' : 'Cancel'}
            </button>
            <button className="cf-btn cf-btn--primary" onClick={() => void ws.save()} disabled={saving || !ws.pending.length || !!ws.draftError}>
              {saving ? 'Saving…' : `Save ${ws.pending.length ? `(${ws.pending.length})` : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export const _unused = { useCallback };
