import React, { useEffect, useRef, useState } from 'react';
import type { CasefileNav } from './CasefileApp';
import { useWorkspace } from '../../core/store';
import { Icon } from '../../core/icons';
import { SUGGESTIONS, type SidekickReply, type SidekickAction } from '../../core/sidekick';
import { filtersFromQuery } from '../../core/activity';

interface Entry {
  id: string;
  query: string;
  reply: SidekickReply;
  staged: { ok: boolean; message: string } | null;
}

export function CasefileSidekick({ nav, contactId, selectedRevision, compareRevision, filters, onClose }: { nav: CasefileNav; contactId: string | null; selectedRevision: number | null; compareRevision: number | null; filters: URLSearchParams | null; onClose: () => void }) {
  const ws = useWorkspace();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight });
  }, [entries.length]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.activeElement === input.current) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const context = [
    `Persona: ${ws.persona.name}`,
    contactId ? `Contact: ${ws.server.contactName(contactId)} · revision ${ws.latest(contactId)?.entityVersion}` : 'No contact open',
    selectedRevision ? `Selected: revision ${selectedRevision}${compareRevision ? ` vs ${compareRevision}` : ''}` : null,
    filters ? 'Activity filters in view' : null,
    ws.draft ? `Draft: ${ws.pending.length} pending` : null,
  ].filter(Boolean) as string[];

  const runActions = (reply: SidekickReply): { ok: boolean; message: string } | null => {
    let staged: { ok: boolean; message: string } | null = null;
    for (const a of reply.actions) {
      if (a.kind === 'filters') nav.activity(a.filters, null);
      else if (a.kind === 'navigate') nav.history(a.contactId, a.version, a.compare, 'changes', null);
      else if (a.kind === 'proposal') {
        staged = ws.stageProposal(a);
        if (staged.ok) {
          const first = a.commands.find((c) => 'ordinal' in c) as { kind: string; ordinal: number } | undefined;
          nav.contact(a.contactId, { focus: first ? `${first.kind.split('.')[0]}.${first.ordinal}` : null });
        }
      }
    }
    return staged;
  };

  const ask = (q: string) => {
    const query = q.trim();
    if (!query) return;
    const reply = ws.ask(query, { contactId, selectedRevision, compareRevision, filters: filters ? filtersFromQuery(filters) : null });
    const staged = runActions(reply);
    setEntries((e) => [...e, { id: reply.id, query, reply, staged }]);
    setText('');
  };

  const openRef = (r: SidekickReply['refs'][number]) => {
    if (r.kind === 'revision') nav.history(r.contactId, r.version, r.compare, 'changes', r.fields[0] ?? null);
    else nav.activity({ q: '' }, r.stamp);
  };

  return (
    <aside className="cf-pane" id="cf-sidekick-pane" aria-label="Sidekick">
      <div className="cf-pane__head">
        <span className="cf-pane__title">
          <Icon name="sparkle" size={18} /> Sidekick <span className="cf-badge cf-badge--warning">simulated · local</span>
        </span>
        <button className="cf-btn cf-btn--subtle cf-btn--icon" onClick={onClose} aria-label="Close sidekick">
          <Icon name="close" />
        </button>
      </div>
      <div className="cf-pane__context" aria-label="What the sidekick is using">
        <span className="cf-hint" style={{ width: '100%' }}>
          Using
        </span>
        {context.map((c) => (
          <span key={c} className="cf-badge">
            {c}
          </span>
        ))}
      </div>
      <div className="cf-pane__body" ref={body} aria-live="polite">
        {entries.length === 0 ? (
          <p className="cf-hint">
            Ask about this contact’s history, the activity filters, or stage a small edit. Answers only use the fixture state you can read; proposals become visible pending changes that you apply as one Save.
          </p>
        ) : null}
        {entries.map((e) => (
          <React.Fragment key={e.id}>
            <div className="cf-msg cf-msg--user">
              <div className="cf-msg__bubble">{e.query}</div>
            </div>
            <div className={`cf-msg cf-msg--sk${e.reply.bounded ? ' cf-msg--bounded' : ''}`}>
              <div className="cf-msg__bubble">{e.reply.text}</div>
              {e.reply.refs.length ? (
                <div className="cf-refs">
                  {e.reply.refs.map((r, i) => (
                    <button key={i} className="cf-ref" onClick={() => openRef(r)} title={r.label}>
                      <Icon name={r.kind === 'revision' ? 'history' : 'activity'} size={12} />
                      <span>{r.kind === 'revision' ? `Revision ${r.version}${r.compare ? ` vs ${r.compare}` : ''}` : r.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {e.reply.actions.map((a, i) => (
                <ActionCard key={i} action={a} staged={e.staged} nav={nav} />
              ))}
              <div className="cf-msg__used">
                {e.reply.used.map((u) => (
                  <span key={u}>{u}</span>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="cf-suggest" aria-label="Suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>
      <form
        className="cf-pane__input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input ref={input} className="cf-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the sidekick…" aria-label="Ask the sidekick" />
        <button className="cf-btn cf-btn--primary cf-btn--icon" type="submit" aria-label="Send">
          <Icon name="send" size={16} />
        </button>
      </form>
      <p className="cf-pane__foot">Deterministic local assistant. No data leaves the browser; no API key. Ctrl/⌘+J toggles this pane.</p>
    </aside>
  );
}

function ActionCard({ action, staged, nav }: { action: SidekickAction; staged: { ok: boolean; message: string } | null; nav: CasefileNav }) {
  const ws = useWorkspace();
  if (action.kind === 'filters') {
    return (
      <div className="cf-proposal">
        <div className="cf-proposal__title">
          <Icon name="filter" size={14} /> {action.label}
        </div>
        <div className="cf-hint">Filters applied to the activity view; navigation happened immediately because it is a read.</div>
      </div>
    );
  }
  if (action.kind === 'navigate') {
    return (
      <div className="cf-proposal">
        <div className="cf-proposal__title">
          <Icon name="history" size={14} /> {action.label}
        </div>
        <div className="cf-hint">Opened in read-only historical mode.</div>
      </div>
    );
  }
  const stillDrafting = ws.draft && ws.draft.contactId === action.contactId;
  const saved = ws.saveState.status === 'saved';
  return (
    <div className={`cf-proposal${saved && !stillDrafting ? ' cf-proposal--done' : ''}`}>
      <div className="cf-proposal__title">
        <Icon name="edit" size={14} /> {staged?.ok ? 'Staged in your draft' : 'Proposal'} · {action.lines.length} change{action.lines.length === 1 ? '' : 's'}
      </div>
      <ul>
        {action.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {staged && !staged.ok ? (
        <div className="cf-error">
          <Icon name="alert" size={14} /> {staged.message}
        </div>
      ) : null}
      {stillDrafting ? (
        <div className="cf-proposal__actions">
          <button className="cf-btn cf-btn--sm cf-btn--primary" onClick={() => void ws.save()} disabled={ws.saveState.status === 'saving'}>
            Apply as one Save
          </button>
          <button className="cf-btn cf-btn--sm" onClick={() => nav.contact(action.contactId, { focus: ws.pending[0]?.family && ws.pending[0]?.ordinal !== null ? `${ws.pending[0].family}.${ws.pending[0].ordinal}` : null })}>
            Adjust in the form
          </button>
          <button className="cf-btn cf-btn--sm cf-btn--subtle" onClick={ws.discardDraft}>
            Discard
          </button>
        </div>
      ) : saved ? (
        <div className="cf-hint">Applied as revision {ws.saveState.result?.entityVersion}.</div>
      ) : (
        <div className="cf-hint">This proposal is no longer staged.</div>
      )}
    </div>
  );
}
