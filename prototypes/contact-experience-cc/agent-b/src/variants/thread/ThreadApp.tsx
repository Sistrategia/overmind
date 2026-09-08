import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './thread.css';
import { useWorkspace } from '../../core/store';
import { useHashRoute, useMediaQuery } from '../../core/router';
import { CONTACT_IDS, personaById } from '../../core/fixtures';
import { Icon } from '../../core/icons';
import type { ActivityFilters, ContactId, PhoneValue, ThreadNote } from '../../core/types';
import { filtersFromQuery, filtersToQuery } from '../../core/activity';
import { useContactView, usePresenceOn, useReportPresence, useEscape, useScrollIntoView } from '../../core/hooks';
import { categoryOf, displayNameOf, fmt, initialsOf, liveChildren } from '../../core/format';
import { SUGGESTIONS, type SidekickReply } from '../../core/sidekick';
import { NoteCard, ProposalCard, QueryCard, RevisionCard, SavedCard, SidekickCard, StatusCards } from './ThreadCards';
import { ThreadEditSheet } from './ThreadEditSheet';

export interface ThreadNav {
  thread(contactId: ContactId, card?: string | null, focus?: string | null, replace?: boolean): void;
  activity(filters?: Partial<ActivityFilters>, unit?: string | null, replace?: boolean): void;
}

export interface LocalCard {
  id: string;
  at: string;
  kind: 'sk' | 'proposal' | 'query';
  query?: string;
  reply?: SidekickReply;
  staged?: { ok: boolean; message: string } | null;
  filters?: ActivityFilters;
}

export function ThAvatar({ initials, hue, size, round }: { initials: string; hue: number; size?: 'sm' | 'lg'; round?: boolean }) {
  return (
    <span className={`th-avatar${size ? ` th-avatar--${size}` : ''}${round ? ' th-avatar--round' : ''}`} style={{ ['--h' as string]: hue }} aria-hidden="true">
      {initials}
    </span>
  );
}

export default function ThreadApp() {
  const ws = useWorkspace();
  const { route, navigate } = useHashRoute();
  const narrow = useMediaQuery('(max-width: 1080px)');
  const [boardOpen, setBoardOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const page = route.path[0] === 'activity' ? 'activity' : 'thread';
  const contactId = page === 'thread' ? route.path[1] ?? CONTACT_IDS.lina : null;

  const nav = useMemo<ThreadNav>(
    () => ({
      thread: (id, card, focus, replace) => navigate('thread', `case/${id}`, { card: card ?? null, focus: focus ?? null }, replace),
      activity: (filters, unit, replace) => {
        const q = filters ? filtersToQuery({ actor: 'all', contact: 'all', family: 'all', source: 'all', from: null, to: null, q: '', ...filters }) : {};
        navigate('thread', 'activity', { ...q, unit: unit ?? null }, replace);
      },
    }),
    [navigate],
  );
  useEffect(() => {
    if (route.path.length === 0) nav.thread(CONTACT_IDS.lina, null, null, true);
  }, [route.path.length, nav]);

  return (
    <div className="th" data-theme={ws.theme} data-variant-root="thread">
      <div className="th-app">
        <nav className="th-rail" aria-label="Primary">
          <a className="th-rail__logo" href="#/" aria-label="Back to gallery">
            V
          </a>
          <button className="th-rail__item" aria-current={page === 'thread' ? 'page' : undefined} onClick={() => nav.thread(contactId ?? CONTACT_IDS.lina)}>
            <span className="th-rail__pill">
              <Icon name="note" size={20} />
            </span>
            Threads
          </button>
          <button className="th-rail__item" aria-current={page === 'activity' ? 'page' : undefined} onClick={() => nav.activity(undefined, null)}>
            <span className="th-rail__pill">
              <Icon name="activity" size={20} />
            </span>
            Activity
          </button>
          <button className="th-rail__item" onClick={() => setBoardOpen((o) => !o)} aria-expanded={boardOpen} aria-controls="th-board">
            <span className="th-rail__pill">
              <Icon name="grid" size={20} />
            </span>
            Board
          </button>
          <span className="th-rail__spacer" />
          <button className="th-rail__item" onClick={() => ws.setTheme(ws.theme === 'dark' ? 'light' : 'dark')} aria-pressed={ws.theme === 'dark'} aria-label={ws.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <span className="th-rail__pill">
              <Icon name={ws.theme === 'dark' ? 'sun' : 'moon'} size={20} />
            </span>
            {ws.theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button className="th-rail__persona" id="th-demo-btn" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen} aria-controls="th-demo" aria-label={`${ws.persona.fullName} · demo controls`} title={`${ws.persona.fullName} · ${ws.persona.role} · demo controls`}>
            <ThAvatar initials={ws.persona.initials} hue={ws.persona.hue} size="lg" />
          </button>
        </nav>
        {narrow && boardOpen ? <div className="th-board-backdrop" onClick={() => setBoardOpen(false)} /> : null}
        <Board contactId={contactId} page={page} nav={nav} open={boardOpen} onClose={() => setBoardOpen(false)} />
        <main className="th-main">
          {page === 'thread' && contactId ? <ContactThread key={contactId} contactId={contactId} nav={nav} query={route.query} /> : <ActivityThread nav={nav} query={route.query} />}
        </main>
      </div>
      {demoOpen ? <ThreadDemo onClose={() => setDemoOpen(false)} nav={nav} /> : null}
      <Snacks />
    </div>
  );
}

function Board({ contactId, page, nav, open, onClose }: { contactId: string | null; page: string; nav: ThreadNav; open: boolean; onClose: () => void }) {
  const ws = useWorkspace();
  const view = useContactView(contactId);
  const revisions = contactId ? ws.revisions(contactId) : [];
  const coverage = ws.demo.historyCoverageFrom;
  const others = ws.presence.filter((p) => p.tabId !== ws.tabId);
  return (
    <aside className={`th-board${open ? ' th-board--open' : ''}`} id="th-board" aria-label="Board">
      <p className="th-board__title">Threads · {ws.tenant.name}</p>
      <div className="th-contacts">
        {ws.contacts.map((c) => (
          <button
            key={c.id}
            className="th-contact"
            aria-current={page === 'thread' && c.id === contactId ? 'true' : undefined}
            onClick={() => {
              nav.thread(c.id);
              onClose();
            }}
          >
            <ThAvatar initials={initialsOf(c.name)} hue={c.category === 'Person' ? 210 : 28} />
            <span>
              <span className="th-contact__name">{c.name}</span>
              <span className="th-contact__sub">
                {c.category} · revision {c.revision.entityVersion}
                {c.projection === 'directory' ? ' · directory' : ''}
              </span>
            </span>
          </button>
        ))}
        <button
          className="th-contact"
          aria-current={page === 'activity' ? 'true' : undefined}
          onClick={() => {
            nav.activity(undefined, null);
            onClose();
          }}
        >
          <span className="th-avatar" style={{ ['--h' as string]: 28 }}>
            <Icon name="activity" size={16} />
          </span>
          <span>
            <span className="th-contact__name">Tenant activity</span>
            <span className="th-contact__sub">{ws.canProposed('read_activity') ? 'audit units and events' : 'needs read_activity'}</span>
          </span>
        </button>
      </div>
      {view?.state && contactId ? (
        <>
          <p className="th-board__title">Pinned · current record</p>
          <div className="th-pin">
            <span className="th-pin__name">{displayNameOf(view.state)}</span>
            <span className="th-pin__line">
              {categoryOf(view.state)} · revision {view.revision?.entityVersion}
              {view.editing ? <span className="th-tag th-tag--primary">draft</span> : null}
            </span>
            {liveChildren(view.state.emails)[0] ? (
              <span className="th-pin__line">
                <Icon name="mail" size={13} /> {liveChildren(view.state.emails)[0]!.value}
              </span>
            ) : null}
            {liveChildren(view.state.phones)[0] ? (
              <span className="th-pin__line">
                <Icon name="phone" size={13} /> {(liveChildren(view.state.phones)[0]!.value as PhoneValue).international}
              </span>
            ) : null}
          </div>
          {ws.can('read_history', contactId) ? (
            <>
              <p className="th-board__title">Revisions</p>
              <div className="th-revchips" role="list">
                {revisions.map((r) => (
                  <button
                    key={r.entityVersion}
                    className={`th-revchip${coverage !== null && r.entityVersion < coverage ? ' th-revchip--unavail' : ''}`}
                    style={{ ['--h' as string]: personaById(r.actorId).hue }}
                    title={`${fmt.dateTime(r.at)} · ${personaById(r.actorId).name} — ${r.summary}`}
                    onClick={() => {
                      nav.thread(contactId, `rev:${r.entityVersion}`, null);
                      onClose();
                    }}
                  >
                    <ThAvatar initials={personaById(r.actorId).initials} hue={personaById(r.actorId).hue} />R{r.entityVersion}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
      <p className="th-board__title">People here</p>
      <div className="th-people">
        <div className="th-person">
          <ThAvatar initials={ws.persona.initials} hue={ws.persona.hue} size="sm" /> {ws.persona.name} (you)
        </div>
        {others.map((p) => (
          <div key={p.tabId} className="th-person" title="Presence is awareness, not a lock.">
            <ThAvatar initials={personaById(p.personaId).initials} hue={personaById(p.personaId).hue} size="sm" />
            {personaById(p.personaId).name} · {p.editing ? 'editing' : 'viewing'} {p.contactId ? ws.server.contactName(p.contactId) : 'activity'}
            <span className="th-person__dot" />
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---------------- Contact thread ----------------

function ContactThread({ contactId, nav, query }: { contactId: string; nav: ThreadNav; query: URLSearchParams }) {
  const ws = useWorkspace();
  const view = useContactView(contactId);
  const others = usePresenceOn(contactId);
  const revisions = ws.revisions(contactId);
  const notes = ws.notes(contactId);
  const [local, setLocal] = useState<LocalCard[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [mode, setMode] = useState<'note' | 'ask'>('note');
  const [text, setText] = useState('');
  const composer = useRef<HTMLInputElement>(null);
  const card = query.get('card');
  const focus = query.get('focus');
  const editing = !!view?.editing;
  useReportPresence(contactId, editOpen ? 'editing' : 'thread', editOpen && editing);

  useEffect(() => {
    if (card) setOpen((s) => (s.has(card) ? s : new Set(s).add(card)));
  }, [card]);
  useScrollIntoView(card ? `th-card-${card.replace(/[:.]/g, '-')}` : null);
  useEffect(() => {
    // Outcomes are shown as cards in the thread, so the sheet closes for saved/error/uncertain/conflict.
    if (ws.saveState.status !== 'idle' && ws.saveState.status !== 'saving' && ws.saveState.status !== 'noop') setEditOpen(false);
  }, [ws.saveState.status]);

  const toggle = useCallback((key: string) => {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }, []);

  const ask = (q: string) => {
    const queryText = q.trim();
    if (!queryText) return;
    const reply = ws.ask(queryText, { contactId, filters: null });
    let staged: LocalCard['staged'] = null;
    const extra: LocalCard[] = [];
    for (const a of reply.actions) {
      if (a.kind === 'proposal') {
        staged = ws.stageProposal(a);
        if (staged.ok) setEditOpen(false);
      } else if (a.kind === 'navigate') {
        setOpen((s) => new Set(s).add(`rev:${a.version}`));
        nav.thread(contactId, `rev:${a.version}`, null, true);
      } else if (a.kind === 'filters') {
        extra.push({ id: `q-${Date.now()}`, at: new Date().toISOString(), kind: 'query', filters: { actor: 'all', contact: 'all', family: 'all', source: 'all', from: null, to: null, q: '', ...a.filters } });
      }
    }
    setLocal((l) => [...l, { id: reply.id, at: new Date().toISOString(), kind: 'sk', query: queryText, reply, staged }, ...extra]);
    setText('');
  };
  const post = () => {
    const t = text.trim();
    if (!t) return;
    if (mode === 'ask') return ask(t);
    ws.postNote(contactId, t, null);
    setText('');
  };

  const items = useMemo(() => {
    const all: { at: string; key: string; node: React.ReactNode }[] = [];
    for (const r of revisions) {
      const key = `rev:${r.entityVersion}`;
      all.push({ at: r.at, key, node: <RevisionCard key={key} contactId={contactId} revision={r} open={open.has(key)} onToggle={() => toggle(key)} nav={nav} focus={card === key ? focus : null} /> });
    }
    for (const n of notes) all.push({ at: n.at, key: n.id, node: <NoteCard key={n.id} note={n} onOpenRef={(k) => nav.thread(contactId, k, null, true)} /> });
    for (const c of local) {
      if (c.kind === 'sk') all.push({ at: c.at, key: c.id, node: <SidekickCard key={c.id} card={c} contactId={contactId} nav={nav} onOpenRev={(k) => nav.thread(contactId, k, null, true)} onAdjust={() => setEditOpen(true)} /> });
      if (c.kind === 'query') all.push({ at: c.at, key: c.id, node: <QueryCard key={c.id} initial={c.filters!} nav={nav} contactId={contactId} /> });
    }
    all.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    return all;
  }, [revisions, notes, local, open, toggle, contactId, nav, card, focus]);

  if (!view) return null;
  const state = view.state;
  const latest = view.revision;

  return (
    <div className="th-column">
      <header className="th-hero">
        <div className="th-hero__eyebrow">
          <span>{ws.tenant.name}</span>
          <span>·</span>
          <span>Investigation thread</span>
          {view.projection === 'directory' ? <span className="th-tag th-tag--tertiary">directory view · public only</span> : null}
        </div>
        {view.loading ? (
          <div className="th-skeleton" aria-busy="true" aria-label="Loading contact">
            <span style={{ width: '40%', height: 36 }} />
            <span style={{ width: '60%' }} />
          </div>
        ) : view.problem ? (
          <div className="th-card th-card--conflict" role="alert">
            <div className="th-card__who">
              {view.problem.status} · {view.problem.code}
            </div>
            <div>{view.problem.detail}</div>
          </div>
        ) : state && latest ? (
          <>
            <h1>{displayNameOf(state)}</h1>
            <div className="th-hero__sub">
              <span>{categoryOf(state)}</span>
              <span>
                Revision <strong>{latest.entityVersion}</strong> · {personaById(latest.actorId).name} · {fmt.dateTime(latest.at)}
              </span>
              {editing ? <span className="th-tag th-tag--primary">draft on revision {ws.draft?.baseVersion}</span> : null}
              <span className="th-participants" title="Presence is awareness only, not a lock.">
                <ThAvatar initials={ws.persona.initials} hue={ws.persona.hue} size="sm" round />
                {others.map((p) => (
                  <ThAvatar key={p.tabId} initials={personaById(p.personaId).initials} hue={personaById(p.personaId).hue} size="sm" round />
                ))}
                <span>{others.length ? `${others.map((p) => `${personaById(p.personaId).name}${p.editing ? ' (editing)' : ''}`).join(', ')} here` : 'only you here'}</span>
              </span>
            </div>
            <div className="th-hero__actions">
              {view.projection === 'detail' && ws.can('edit', contactId) ? (
                <button className="th-btn th-btn--filled" onClick={() => setEditOpen(true)}>
                  <Icon name="edit" size={16} /> {editing ? `Continue editing (${ws.pending.length})` : 'Edit contact'}
                </button>
              ) : null}
              <button
                className="th-btn"
                onClick={() => {
                  setMode('ask');
                  composer.current?.focus();
                }}
              >
                <Icon name="sparkle" size={16} /> Ask the sidekick
              </button>
              {ws.can('read_history', contactId) ? (
                <button className="th-btn th-btn--text" onClick={() => nav.thread(contactId, `rev:${latest.entityVersion}`, null, true)}>
                  Open latest revision
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </header>
      {state && latest ? (
        <>
          <StatusCards contactId={contactId} nav={nav} onAdjust={() => setEditOpen(true)} />
          <div className="th-cards" aria-label="Thread">
            {items.map((i) => i.node)}
            {ws.draft && ws.draft.contactId === contactId && ws.pending.length ? <ProposalCard nav={nav} onAdjust={() => setEditOpen(true)} /> : null}
            {ws.saveState.status === 'saved' && ws.saveState.result ? <SavedCard result={ws.saveState.result} contactId={contactId} nav={nav} /> : null}
          </div>
          <div className="th-suggest" aria-label="Suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="th-chip" onClick={() => ask(s)}>
                <Icon name="sparkle" size={13} /> {s}
              </button>
            ))}
          </div>
          <form
            className="th-composer"
            onSubmit={(e) => {
              e.preventDefault();
              post();
            }}
          >
            <div className="th-composer__mode" role="group" aria-label="Composer mode">
              <button type="button" aria-pressed={mode === 'note'} onClick={() => setMode('note')}>
                <Icon name="note" size={14} /> Note
              </button>
              <button type="button" aria-pressed={mode === 'ask'} onClick={() => setMode('ask')}>
                <Icon name="sparkle" size={14} /> Ask
              </button>
            </div>
            <input ref={composer} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === 'note' ? `Add a note to ${displayNameOf(state)}’s thread (shared with this tenant)…` : 'Ask the sidekick about this contact…'} aria-label={mode === 'note' ? 'Write a note' : 'Ask the sidekick'} />
            <button className="th-composer__send" type="submit" aria-label={mode === 'note' ? 'Post note' : 'Send question'} disabled={!text.trim()}>
              <Icon name="send" size={18} />
            </button>
          </form>
        </>
      ) : null}
      {editOpen && state ? <ThreadEditSheet contactId={contactId} onClose={() => setEditOpen(false)} /> : null}
    </div>
  );
}

// ---------------- Tenant activity thread ----------------

function ActivityThread({ nav, query }: { nav: ThreadNav; query: URLSearchParams }) {
  const ws = useWorkspace();
  const filters = useMemo(() => filtersFromQuery(query), [query]);
  const unit = query.get('unit');
  const [local, setLocal] = useState<LocalCard[]>([]);
  const [text, setText] = useState('');
  useReportPresence(null, 'activity', false);
  const ask = (q: string) => {
    const queryText = q.trim();
    if (!queryText) return;
    const reply = ws.ask(queryText, { contactId: null, filters });
    for (const a of reply.actions) {
      if (a.kind === 'filters') nav.activity(a.filters, null, true);
    }
    setLocal((l) => [...l, { id: reply.id, at: new Date().toISOString(), kind: 'sk', query: queryText, reply, staged: null }]);
    setText('');
  };
  const allowed = ws.canProposed('read_activity');
  return (
    <div className="th-column">
      <header className="th-hero">
        <div className="th-hero__eyebrow">
          <span>{ws.tenant.name}</span>
          <span>·</span>
          <span>Application activity view (proposed)</span>
        </div>
        <h1>Tenant activity</h1>
        <div className="th-hero__sub">
          <span>Committed changes are audit units. Operational, sidekick and presence entries come from other sources and are labelled “not audit”.</span>
        </div>
      </header>
      <div className="th-cards">
        {!allowed ? (
          <div className="th-card th-card--conflict" role="alert">
            <div className="th-card__who">403 · forbidden</div>
            <div>
              {ws.persona.fullName} ({ws.persona.role}) does not hold the proposed <code>read_activity</code> capability. Switch to Sofía or Diego in the demo controls.
            </div>
          </div>
        ) : (
          <QueryCard initial={filters} nav={nav} contactId={null} bound selectedUnit={unit} onFiltersChange={(f) => nav.activity(f, unit, true)} onSelectUnit={(s) => nav.activity(filters, s, true)} />
        )}
        {local.map((c) => (
          <SidekickCard key={c.id} card={c} contactId={null} nav={nav} onOpenRev={() => undefined} onAdjust={() => undefined} />
        ))}
      </div>
      {allowed ? (
        <form
          className="th-composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <div className="th-composer__mode">
            <button type="button" aria-pressed>
              <Icon name="sparkle" size={14} /> Ask
            </button>
          </div>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the sidekick to filter activity, e.g. “Show Bruno’s phone changes”" aria-label="Ask the sidekick" />
          <button className="th-composer__send" type="submit" aria-label="Send question" disabled={!text.trim()}>
            <Icon name="send" size={18} />
          </button>
        </form>
      ) : null}
    </div>
  );
}

// ---------------- Demo + snackbar ----------------

function ThreadDemo({ onClose, nav }: { onClose: () => void; nav: ThreadNav }) {
  const ws = useWorkspace();
  useEscape(true, onClose);
  return (
    <div className="th-demo" id="th-demo" role="dialog" aria-label="Demo controls (not part of the product)">
      <div className="th-demo__head">
        <Icon name="settings" size={14} /> Demo controls · not product UI
        <button className="th-btn th-btn--text th-btn--icon th-btn--sm" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close demo controls">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="th-demo__group">
        <strong>Persona (this tab)</strong>
        {ws.personas.map((p) => (
          <label key={p.id} className="th-radio">
            <input type="radio" name="th-persona" checked={ws.persona.id === p.id} onChange={() => ws.setPersona(p.id)} />
            <ThAvatar initials={p.initials} hue={p.hue} size="sm" />
            <span>
              {p.fullName} <span className="th-hint">· {p.role}</span>
            </span>
          </label>
        ))}
        <span className="th-demo__note">Story: {ws.story === 'rehearsal' ? 'conflict rehearsal (Lina at revision 3)' : 'full (7 revisions)'}.</span>
      </div>
      <div className="th-demo__group">
        <strong>Collaboration</strong>
        <div className="th-demo__row">
          <button className="th-btn th-btn--sm" onClick={ws.rewindToRehearsal}>
            Rewind: Mariana edits revision 3
          </button>
          <button className="th-btn th-btn--sm" onClick={ws.simulateBrunoUpdate}>
            Simulate Bruno’s update
          </button>
          <a className="th-btn th-btn--sm th-btn--outlined" href={window.location.href} target="_blank" rel="noopener">
            <Icon name="externalTab" size={14} /> Second tab
          </a>
        </div>
        <span className="th-demo__note">Tabs share the simulated server (localStorage) and talk over BroadcastChannel. Notes are shared prototype state; sidekick replies stay in your tab.</span>
      </div>
      <div className="th-demo__group">
        <strong>Next Save outcome</strong>
        <select className="th-select" value={ws.demo.nextOutcome} onChange={(e) => ws.setDemo({ nextOutcome: e.target.value as typeof ws.demo.nextOutcome })} aria-label="Next Save outcome">
          <option value="ok">Normal</option>
          <option value="forbidden">Permission denied (403)</option>
          <option value="storage">Storage failure (500, nothing committed)</option>
          <option value="uncertain">Commit uncertain (500, outcome unknown)</option>
        </select>
        <label className="th-switch">
          <input type="checkbox" checked={ws.demo.slow} onChange={(e) => ws.setDemo({ slow: e.target.checked })} /> Slow Save
        </label>
      </div>
      <div className="th-demo__group">
        <strong>Reads</strong>
        <label className="th-switch">
          <input type="checkbox" checked={ws.demo.loading} onChange={(e) => ws.setDemo({ loading: e.target.checked })} /> Show loading state
        </label>
        <label className="th-field">
          <span className="th-label">Historical coverage</span>
          <select className="th-select" value={ws.demo.historyCoverageFrom ?? ''} onChange={(e) => ws.setDemo({ historyCoverageFrom: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Complete</option>
            <option value="4">Unavailable before revision 4</option>
            <option value="6">Unavailable before revision 6</option>
          </select>
        </label>
      </div>
      <div className="th-demo__group">
        <strong>Story</strong>
        <div className="th-demo__row">
          <button className="th-btn th-btn--sm" onClick={ws.reset}>
            Reset demo
          </button>
          <button className="th-btn th-btn--sm th-btn--outlined" onClick={() => nav.thread(CONTACT_IDS.lina)}>
            Go to Lina
          </button>
        </div>
      </div>
    </div>
  );
}

function Snacks() {
  const ws = useWorkspace();
  if (!ws.toasts.length) return null;
  return (
    <div className="th-snacks" aria-live="polite">
      {ws.toasts.map((t) => (
        <div key={t.id} className={`th-snack th-snack--${t.kind}`} role="status">
          <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : t.kind === 'warning' ? 'users' : 'info'} size={16} />
          <span>{t.text}</span>
          <button onClick={() => ws.dismissToast(t.id)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export type { ThreadNote };
