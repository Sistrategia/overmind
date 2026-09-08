import React, { useEffect, useMemo, useRef } from 'react';
import type { StudioNav, StudioRoute } from './StudioApp';
import { StAvatar } from './StudioApp';
import { useWorkspace } from '../../core/store';
import { useContactView, usePresenceOn, useReportPresence, useRevisionView, useFlash, useScrollIntoView } from '../../core/hooks';
import { Icon } from '../../core/icons';
import type { Child, ContactState, Diff, Family, PhoneValue, Profile, Revision } from '../../core/types';
import { FAMILIES } from '../../core/types';
import { addressLines, categoryOf, childDisplay, displayNameOf, fmt, initialsOf, liveChildren, FAMILY_PLURAL, FAMILY_LABEL, TZ_LABEL } from '../../core/format';
import { personaById } from '../../core/fixtures';
import { profileFieldLabel, profileFieldText } from '../../core/engine';
import { childrenOf } from '../../core/editing';
import { diffStates } from '../../core/diff';

const FAMILY_ICON: Record<Family, 'mail' | 'phone' | 'link' | 'pin'> = { email: 'mail', phone: 'phone', web_link: 'link', address: 'pin' };

export function StudioContact({ route, nav, onAsk, onMenu }: { route: StudioRoute; nav: StudioNav; onAsk: () => void; onMenu: () => void }) {
  const ws = useWorkspace();
  const contactId = route.contactId!;
  const view = useContactView(contactId);
  const others = usePresenceOn(contactId);
  const revisions = ws.revisions(contactId);
  const latest = revisions[revisions.length - 1] ?? null;
  const canHistory = ws.can('read_history', contactId);
  const mode = canHistory ? route.mode : 'now';
  const rev = route.rev ?? latest?.entityVersion ?? 1;
  const pin = route.pin ?? (rev > 1 ? rev - 1 : 1);
  const editing = !!view?.editing;
  useReportPresence(contactId, mode === 'now' ? (editing ? 'editing' : 'record') : mode, editing && mode === 'now');
  const focus = route.query.get('focus');

  const timelineRead = useRevisionView(contactId, mode !== 'now' ? rev : null, mode === 'compare' ? pin : rev > 1 ? rev - 1 : null);
  const pinRead = useRevisionView(contactId, mode === 'compare' ? pin : null, null);

  const title = view?.state ? displayNameOf(view.state) : ws.server.contactName(contactId);
  const saving = ws.saveState.status === 'saving';
  // After a successful Save the row selection is stale; return the inspector to the record.
  const savedAt = ws.saveState.status === 'saved' ? ws.saveState.at : null;
  useEffect(() => {
    if (savedAt && route.sel) nav.select(null);
  }, [savedAt, route.sel, nav]);

  const setMode = (m: 'now' | 'timeline' | 'compare') => {
    if (m === 'now') nav.contact(contactId, { mode: null, rev: null, pin: null, sel: null });
    else if (m === 'timeline') nav.timeline(contactId, rev, null);
    else nav.compare(contactId, rev, rev > 1 ? Math.min(pin, rev - 1) : 1);
  };

  return (
    <>
      <div className="st-toolbar" role="toolbar" aria-label="Contact toolbar">
        <button className="st-btn st-btn--quiet st-btn--icon st-menu-btn" onClick={onMenu} aria-label="Open sources">
          <Icon name="list" size={16} />
        </button>
        <button className="st-btn st-btn--quiet st-btn--icon" onClick={() => window.history.back()} aria-label="Back">
          <Icon name="chevronLeft" size={16} />
        </button>
        <div className="st-toolbar__title">
          <strong>{title}</strong>
          <span>
            {latest ? `Revision ${latest.entityVersion} · ${personaById(latest.actorId).name} · ${fmt.dateTime(latest.at)}` : ''}
            {mode !== 'now' ? ` · viewing revision ${rev}` : ''}
          </span>
        </div>
        {canHistory ? (
          <div className="st-seg" role="group" aria-label="View">
            <button aria-pressed={mode === 'now'} onClick={() => setMode('now')}>
              <Icon name="person" size={13} /> Now
            </button>
            <button aria-pressed={mode === 'timeline'} onClick={() => setMode('timeline')}>
              <Icon name="clock" size={13} /> Timeline
            </button>
            <button aria-pressed={mode === 'compare'} onClick={() => setMode('compare')} disabled={revisions.length < 2}>
              <Icon name="compare" size={13} /> Compare
            </button>
          </div>
        ) : null}
        <span className="st-toolbar__spacer" />
        {others.length ? (
          <span className="st-avatar-stack" title={others.map((p) => `${personaById(p.personaId).name} ${p.editing ? 'editing' : 'viewing'}`).join(', ')} aria-label={`Also here: ${others.map((p) => personaById(p.personaId).name).join(', ')}`}>
            {others.map((p) => (
              <StAvatar key={p.tabId} initials={personaById(p.personaId).initials} hue={personaById(p.personaId).hue} />
            ))}
          </span>
        ) : null}
        <button className="st-btn" id="st-ask-btn" onClick={onAsk} aria-keyshortcuts="Meta+K Control+K">
          <Icon name="sparkle" size={15} /> Ask <span className="st-kbd">⌘K</span>
        </button>
        {mode === 'now' && view?.projection === 'detail' && ws.can('edit', contactId) ? (
          editing ? (
            <>
              <button className="st-btn st-btn--quiet" onClick={ws.discardDraft} disabled={saving}>
                {ws.pending.length ? 'Discard' : 'Done'}
              </button>
              <button className="st-btn st-btn--primary" onClick={() => void ws.save()} disabled={saving || !ws.pending.length || !!ws.draftError}>
                {saving ? 'Saving…' : 'Save'} {ws.pending.length ? <span className="st-count">{ws.pending.length}</span> : null}
              </button>
            </>
          ) : (
            <button
              className="st-btn"
              onClick={() => {
                ws.beginDraft(contactId);
                nav.select(route.sel ?? 'profile');
              }}
            >
              <Icon name="edit" size={15} /> Edit
            </button>
          )
        ) : null}
      </div>

      {view?.loading ? (
        <div className="st-sheet">
          <div className="st-skeleton" aria-busy="true" aria-label="Loading contact">
            <span style={{ width: '38%' }} />
            <span style={{ width: '70%' }} />
            <span style={{ width: '52%' }} />
            <span style={{ width: '64%' }} />
          </div>
        </div>
      ) : view?.problem ? (
        <div className="st-sheet" role="alert" style={{ padding: 22 }}>
          <div className="st-card st-card--danger">
            <div className="st-card__title">
              <Icon name="shield" size={14} /> {view.problem.status} · {view.problem.code}
            </div>
            <div>{view.problem.detail}</div>
          </div>
        </div>
      ) : view?.state && latest ? (
        <>
          {mode === 'now' ? (
            <Sheet contactId={contactId} state={view.state} base={editing ? ws.draft!.base : null} revision={latest} projection={view.projection!} editing={editing} sel={route.sel} onSelect={nav.select} focus={focus} />
          ) : null}
          {mode === 'timeline' ? (
            timelineRead.problem ? (
              <HistoryProblem problem={timelineRead.problem} />
            ) : timelineRead.data ? (
              <Sheet key={`t-${rev}`} contactId={contactId} state={timelineRead.data.revision.state} base={null} revision={timelineRead.data.revision} projection="detail" editing={false} sel={null} onSelect={() => undefined} historical diff={timelineRead.data.diff} diffSide="after" focus={focus} onReturn={() => setMode('now')} />
            ) : null
          ) : null}
          {mode === 'compare' ? (
            timelineRead.problem || pinRead.problem ? (
              <HistoryProblem problem={(timelineRead.problem ?? pinRead.problem)!} />
            ) : timelineRead.data && pinRead.data ? (
              <div className="st-compare">
                <div>
                  <div className="st-compare__label">
                    <span className="st-badge st-badge--orange">A</span> Revision {pin} · {fmt.dateTime(pinRead.data.revision.at)} · {personaById(pinRead.data.revision.actorId).name}
                  </div>
                  <Sheet key={`a-${pin}`} contactId={contactId} state={pinRead.data.revision.state} base={null} revision={pinRead.data.revision} projection="detail" editing={false} sel={null} onSelect={() => undefined} historical compact diff={timelineRead.data.diff} diffSide="before" focus={null} />
                </div>
                <div>
                  <div className="st-compare__label">
                    <span className="st-badge st-badge--accent">B</span> Revision {rev} · {fmt.dateTime(timelineRead.data.revision.at)} · {personaById(timelineRead.data.revision.actorId).name}
                  </div>
                  <Sheet key={`b-${rev}`} contactId={contactId} state={timelineRead.data.revision.state} base={null} revision={timelineRead.data.revision} projection="detail" editing={false} sel={null} onSelect={() => undefined} historical compact diff={timelineRead.data.diff} diffSide="after" focus={focus} />
                </div>
              </div>
            ) : null
          ) : null}
          {mode !== 'now' ? <Scrubber contactId={contactId} revisions={revisions} rev={rev} pin={mode === 'compare' ? pin : null} nav={nav} mode={mode} /> : null}
        </>
      ) : null}
    </>
  );
}

function HistoryProblem({ problem }: { problem: { status: number; code: string; detail: string } }) {
  return (
    <div className="st-sheet" role="alert" style={{ padding: 22 }}>
      <div className={`st-card ${problem.code === 'history_unavailable' ? 'st-card--warn' : 'st-card--danger'}`}>
        <div className="st-card__title">
          <Icon name="alert" size={14} /> {problem.status} · {problem.code}
        </div>
        <div>{problem.detail}</div>
        {problem.code === 'history_unavailable' ? <div className="st-hint">Unknown earlier state stays unknown; nothing is borrowed from today’s values.</div> : null}
      </div>
    </div>
  );
}

interface SheetProps {
  contactId: string;
  state: ContactState;
  base: ContactState | null; // draft base for pending markers
  revision: Revision;
  projection: 'detail' | 'directory';
  editing: boolean;
  sel: string | null;
  onSelect: (sel: string | null) => void;
  historical?: boolean;
  compact?: boolean;
  diff?: Diff | null;
  diffSide?: 'before' | 'after';
  focus: string | null;
  onReturn?: () => void;
}

export function Sheet({ contactId, state, base, revision, projection, editing, sel, onSelect, historical, compact, diff, diffSide, focus, onReturn }: SheetProps) {
  const flash = useFlash(focus);
  const focusId = focus ? `st-row-${diffSide ?? 'now'}-${focus.split('.').slice(0, 2).join('-')}` : null;
  useScrollIntoView(focusId);
  const p = state.profile;
  const keys: (keyof Profile)[] = p.contactTypeId === 1 ? ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'personAlias', 'summary'] : ['fullName', 'displayName', 'summary'];
  const profileChanged = (k: keyof Profile) => (base ? (base.profile[k] ?? null) !== (p[k] ?? null) : diff ? diff.profile.some((f) => f.path === `profile.${k}`) : false);
  const childStatus = (family: Family, ordinal: number) => diff?.children.find((c) => c.family === family && c.ordinal === ordinal) ?? null;
  const selectable = editing || (!historical && projection === 'detail');

  return (
    <div className={`st-sheet${historical ? ' st-sheet--hist' : ''}`} aria-label={historical ? `Revision ${revision.entityVersion} (read only)` : 'Contact record'}>
      {historical && !compact ? (
        <div className="st-hist-pill" role="status">
          <Icon name="clock" size={15} />
          <span>
            Revision {revision.entityVersion} as it was on {fmt.dateTime(revision.at)} {TZ_LABEL} · read only · saved by {personaById(revision.actorId).name}
          </span>
          {onReturn ? (
            <button className="st-btn st-btn--sm" onClick={onReturn}>
              Return to now
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className={`st-sheet__head${selectable ? ' st-sheet__head--selectable' : ''}${sel === 'profile' ? ' st-sheet__head--selected' : ''}`}
        onClick={selectable ? () => onSelect(sel === 'profile' ? null : 'profile') : undefined}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        onKeyDown={selectable ? (e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), onSelect('profile')) : undefined) : undefined}
        aria-pressed={selectable ? sel === 'profile' : undefined}
      >
        <StAvatar initials={initialsOf(displayNameOf(state))} hue={state.profile.contactTypeId === 1 ? 212 : 28} size={compact ? 'md' : 'lg'} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={compact ? { fontSize: 18 } : undefined}>{displayNameOf(state)}</h1>
          <div className="st-sheet__sub">
            <span>{categoryOf(state)}</span>
            {projection === 'directory' ? <span className="st-badge st-badge--orange">Directory view · public only</span> : null}
            {state.deleted ? <span className="st-badge st-badge--red">Deleted</span> : null}
            {p.summary ? <span>{p.summary}</span> : null}
            {keys.some(profileChanged) ? <span className="st-badge st-badge--accent">{base ? 'profile pending' : 'profile changed'}</span> : null}
          </div>
        </div>
        {selectable ? <Icon name="chevronRight" size={16} /> : null}
      </div>
      {(sel === 'profile' || (diff && diff.profile.length) || compact) && projection === 'detail' ? (
        <div className="st-group">
          <div className="st-group__title">Profile</div>
          <div className="st-list">
            <dl className="st-profile">
              {keys.map((k) => (
                <div key={k} className={`st-kv${profileChanged(k) ? ' st-kv--changed' : ''}${flash === `profile.${k}` ? ' st-row--flash' : ''}`} id={`st-row-${diffSide ?? 'now'}-profile-${k}`}>
                  <dt>{profileFieldLabel(k)}</dt>
                  <dd className={profileFieldText(k, p) ? undefined : 'st-kv__empty'}>{profileFieldText(k, p) ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
      {FAMILIES.map((family) => {
        const all = childrenOf(state, family);
        const live = liveChildren(all);
        const removedInDiff = diff && diffSide === 'before' ? [] : diff && diffSide === 'after' ? diff.children.filter((c) => c.family === family && c.status === 'removed') : [];
        const deletedDraft = editing ? all.filter((c) => c.deleted && c.ordinal > 0) : [];
        return (
          <div key={family} className="st-group">
            <div className="st-group__title">
              <Icon name={FAMILY_ICON[family]} size={13} /> {FAMILY_PLURAL[family]} <span className="st-badge">{live.length}</span>
              {editing ? (
                <button className="st-btn st-btn--sm" onClick={() => onSelect(`new:${family}`)} aria-pressed={sel === `new:${family}`}>
                  <Icon name="plus" size={13} /> Add
                </button>
              ) : null}
            </div>
            <div className="st-list">
              {live.length === 0 && removedInDiff.length === 0 && deletedDraft.length === 0 ? <div className="st-empty-row">No {FAMILY_PLURAL[family].toLowerCase()}{historical ? ' at this revision' : ''}.</div> : null}
              {live.map((c, i) => {
                const key = `${family}.${c.ordinal}`;
                const status = childStatus(family, c.ordinal);
                const pending = base ? isPending(base, family, c) : false;
                const changedFields = status?.status === 'changed' ? status.changes.map((x) => x.label.toLowerCase()) : [];
                const showMark = status && status.status !== 'unchanged' && (diffSide === 'after' ? status.status !== 'removed' : status.status === 'changed');
                return (
                  <button
                    key={c.ordinal}
                    id={`st-row-${diffSide ?? 'now'}-${family}-${c.ordinal}`}
                    className={`st-row${selectable ? ' st-row--selectable' : ''}${pending ? ' st-row--pending' : ''}${flash && flash.startsWith(key) ? ' st-row--flash' : ''}`}
                    aria-selected={selectable ? sel === key : undefined}
                    onClick={selectable ? () => onSelect(sel === key ? null : key) : undefined}
                    disabled={!selectable}
                    style={!selectable ? { cursor: 'default' } : undefined}
                  >
                    <span className={`st-row__glyph${i === 0 ? ' st-row__glyph--primary' : ''}`}>{i === 0 ? <Icon name="starFill" size={14} /> : <Icon name={FAMILY_ICON[family]} size={14} />}</span>
                    <span>
                      <span className="st-row__value">{family === 'address' ? addressLines(c.value as never).join(', ') : childDisplay(family, c)}</span>
                      <span className="st-row__meta">
                        {i === 0 ? <span style={{ color: 'var(--st-accent-text)', fontWeight: 600 }}>Primary</span> : <span>Position {c.displayOrder}</span>}
                        <span>{c.location ?? 'No label'}</span>
                        <span className="st-vis">
                          <Icon name={c.isPublic ? 'globe' : 'lock'} size={11} /> {c.isPublic ? 'Public' : 'Private'}
                        </span>
                        {family === 'phone' && (c.value as PhoneValue).interpretation !== 'international' ? <span>entered “{(c.value as PhoneValue).raw}” · {(c.value as PhoneValue).defaultRegion} {(c.value as PhoneValue).areaCode}</span> : null}
                        {c.ordinal < 0 ? <span className="st-badge st-badge--accent">new · saved at the end</span> : pending ? <span className="st-badge st-badge--accent">pending</span> : null}
                        {showMark && changedFields.length ? <span className={`st-mark-label st-mark-label--changed`}>changed: {changedFields.join(', ')}</span> : null}
                      </span>
                    </span>
                    <span className="st-row__right">
                      {showMark ? (
                        <>
                          <span className={`st-mark st-mark--${status!.status}`} aria-hidden="true">
                            {status!.status === 'added' ? '+' : status!.status === 'restored' ? '↺' : '~'}
                          </span>
                          <span className={`st-mark-label st-mark-label--${status!.status}`}>{status!.status}</span>
                        </>
                      ) : selectable ? (
                        <Icon name="chevronRight" size={14} />
                      ) : null}
                    </span>
                  </button>
                );
              })}
              {removedInDiff.map((c) => (
                <div key={`rm-${c.ordinal}`} className="st-row st-row--deleted" id={`st-row-after-${family}-${c.ordinal}`}>
                  <span className="st-row__glyph">
                    <Icon name={FAMILY_ICON[family]} size={14} />
                  </span>
                  <span>
                    <span className="st-row__value">{c.display}</span>
                    <span className="st-row__meta">{c.label}</span>
                  </span>
                  <span className="st-row__right">
                    <span className="st-mark st-mark--removed" aria-hidden="true">
                      −
                    </span>
                    <span className="st-mark-label st-mark-label--removed">removed</span>
                  </span>
                </div>
              ))}
              {deletedDraft.map((c) => (
                <button key={`del-${c.ordinal}`} className={`st-row st-row--selectable st-row--deleted`} aria-selected={sel === `${family}.${c.ordinal}`} onClick={() => onSelect(`${family}.${c.ordinal}`)}>
                  <span className="st-row__glyph">
                    <Icon name={FAMILY_ICON[family]} size={14} />
                  </span>
                  <span>
                    <span className="st-row__value">{childDisplay(family, c)}</span>
                    <span className="st-row__meta">
                      <span className="st-badge st-badge--red">{base && childrenOf(base, family).find((b) => b.ordinal === c.ordinal)?.deleted ? 'deleted earlier' : 'removed in draft'}</span>
                    </span>
                  </span>
                  <span className="st-row__right">
                    <Icon name="chevronRight" size={14} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!compact ? (
        <div className="st-group" style={{ paddingTop: 0 }}>
          <span className="st-hint">
            {historical ? 'Historical labels and values come from that revision, not from today’s record.' : projection === 'directory' ? 'Only public live channels are shown; saved order keeps its gaps.' : editing ? 'Select a row to edit it in the inspector. New entries save at the end; save first to make one primary.' : 'Select a row to see its details in the inspector.'}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function isPending(base: ContactState, family: Family, c: Child<unknown>): boolean {
  if (c.ordinal < 0) return true;
  const b = childrenOf(base, family).find((x) => x.ordinal === c.ordinal);
  if (!b) return false;
  const posBase = liveChildren(childrenOf(base, family)).findIndex((x) => x.ordinal === c.ordinal) + 1;
  return JSON.stringify(b.value) !== JSON.stringify(c.value) || b.location !== c.location || b.isPublic !== c.isPublic || b.extension !== c.extension || b.deleted !== c.deleted || posBase !== c.displayOrder;
}

// ---------------- Scrubber ----------------

export function Scrubber({ contactId, revisions, rev, pin, nav, mode }: { contactId: string; revisions: Revision[]; rev: number; pin: number | null; nav: StudioNav; mode: 'timeline' | 'compare' }) {
  const ws = useWorkspace();
  const coverage = ws.demo.historyCoverageFrom;
  const trackRef = useRef<HTMLDivElement>(null);
  const n = revisions.length;
  const pct = (i: number) => (n === 1 ? 50 : 6 + (i / (n - 1)) * 88);
  const select = (v: number, asPin = false) => {
    if (mode === 'compare') {
      if (asPin) nav.compare(contactId, rev, v);
      else nav.compare(contactId, v, pin ?? Math.max(1, v - 1));
    } else nav.timeline(contactId, v, null);
  };
  const fromPointer = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    let best = 0;
    let dist = Infinity;
    revisions.forEach((_, i) => {
      const d = Math.abs(pct(i) - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    const v = revisions[best]!.entityVersion;
    if (v !== rev) select(v, e.shiftKey);
  };
  const dragging = useRef(false);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (rev > 1) select(rev - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (rev < n) select(rev + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      select(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      select(n);
    }
  };
  const current = revisions.find((r) => r.entityVersion === rev);
  const a = pin !== null ? revisions.find((r) => r.entityVersion === pin) : null;
  const left = pin !== null ? Math.min(pct(pin - 1), pct(rev - 1)) : pct(rev - 1);
  const right = pin !== null ? Math.max(pct(pin - 1), pct(rev - 1)) : pct(rev - 1);
  const empty = useMemo(() => (mode === 'compare' && a && current ? diffStates(a.state, current.state).isEmpty : false), [mode, a, current]);

  return (
    <div className="st-scrubber" aria-label="Revision scrubber">
      <div className="st-scrubber__head">
        <Icon name="history" size={15} />
        <strong>{mode === 'compare' ? `Comparing A · revision ${pin} → B · revision ${rev}` : `Revision ${rev} of ${n}`}</strong>
        {current ? (
          <span>
            {fmt.dateTime(current.at)} · {personaById(current.actorId).name} · {current.summary}
          </span>
        ) : null}
        <span className="st-spacer" />
        {mode === 'compare' && empty ? <span className="st-badge st-badge--hist">no net difference · actions retained</span> : null}
        <span className="st-hint">{mode === 'compare' ? 'Click sets B · Shift+click sets A · ← → move B' : 'Drag, click or use ← → · read only'}</span>
      </div>
      <div
        ref={trackRef}
        className="st-track"
        role="slider"
        tabIndex={0}
        aria-label={mode === 'compare' ? 'Revision B' : 'Revision'}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={rev}
        aria-valuetext={`Revision ${rev}${current ? `, ${fmt.dateTime(current.at)}, ${current.summary}` : ''}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current) fromPointer(e);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        <div className="st-track__line" />
        <div className="st-track__range" style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }} />
        {revisions.map((r, i) => {
          const isB = r.entityVersion === rev;
          const isA = pin !== null && r.entityVersion === pin;
          const unavailable = coverage !== null && r.entityVersion < coverage;
          return (
            <button
              key={r.entityVersion}
              type="button"
              className={`st-marker${isB ? ' st-marker--b' : ''}${isA ? ' st-marker--a' : ''}${unavailable ? ' st-marker--unavail' : ''}`}
              style={{ left: `${pct(i)}%` }}
              title={`Revision ${r.entityVersion} · ${fmt.dateTime(r.at)} · ${personaById(r.actorId).name} — ${r.summary}${unavailable ? ' (coverage unavailable)' : ''}`}
              aria-label={`Revision ${r.entityVersion}, ${fmt.date(r.at)}, ${personaById(r.actorId).name}`}
              aria-pressed={isB}
              tabIndex={-1}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => select(r.entityVersion, e.shiftKey)}
            >
              {isB ? <span className="st-marker__tag">B</span> : isA ? <span className="st-marker__tag">A</span> : null}
              <span className="st-marker__dot" style={{ ['--h' as string]: personaById(r.actorId).hue }} />
              <span className="st-marker__label">
                {r.entityVersion} · {fmt.date(r.at).replace(/^\w+, /, '')}
              </span>
            </button>
          );
        })}
      </div>
      <div className="st-scrubber__foot">
        {mode === 'compare' ? (
          <>
            <label>
              A{' '}
              <select className="st-select" style={{ width: 'auto', display: 'inline-block' }} value={pin ?? 1} onChange={(e) => select(Number(e.target.value), true)} aria-label="Revision A">
                {revisions.map((r) => (
                  <option key={r.entityVersion} value={r.entityVersion}>
                    Revision {r.entityVersion}
                  </option>
                ))}
              </select>
            </label>
            <label>
              B{' '}
              <select className="st-select" style={{ width: 'auto', display: 'inline-block' }} value={rev} onChange={(e) => select(Number(e.target.value))} aria-label="Revision B">
                {revisions.map((r) => (
                  <option key={r.entityVersion} value={r.entityVersion}>
                    Revision {r.entityVersion}
                  </option>
                ))}
              </select>
            </label>
            <button className="st-btn st-btn--sm" onClick={() => nav.timeline(contactId, rev, null)}>
              Timeline only
            </button>
          </>
        ) : (
          <>
            <button className="st-btn st-btn--sm" onClick={() => select(rev - 1)} disabled={rev <= 1} aria-label="Previous revision">
              <Icon name="chevronLeft" size={13} /> Previous
            </button>
            <button className="st-btn st-btn--sm" onClick={() => select(rev + 1)} disabled={rev >= n} aria-label="Next revision">
              Next <Icon name="chevronRight" size={13} />
            </button>
            {rev > 1 ? (
              <button className="st-btn st-btn--sm" onClick={() => nav.compare(contactId, rev, rev - 1)}>
                <Icon name="compare" size={13} /> Compare with revision {rev - 1}
              </button>
            ) : null}
          </>
        )}
        <span style={{ marginLeft: 'auto' }}>{FAMILY_LABEL.email ? `${n} revisions · unit stamps are decimal strings` : ''}</span>
      </div>
    </div>
  );
}

export const _unusedSheet = { useEffect };
