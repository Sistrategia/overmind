import React, { useEffect, useRef, useState } from 'react';
import type { StudioNav, StudioRoute } from './StudioApp';
import { useWorkspace } from '../../core/store';
import { Icon } from '../../core/icons';
import { SUGGESTIONS, type SidekickReply } from '../../core/sidekick';
import { filtersFromQuery } from '../../core/activity';
import { useEscape } from '../../core/hooks';

interface Entry {
  query: string;
  reply: SidekickReply;
  staged: { ok: boolean; message: string } | null;
}

export function StudioPalette({ route, nav, onClose }: { route: StudioRoute; nav: StudioNav; onClose: () => void }) {
  const ws = useWorkspace();
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEscape(true, onClose);
  useEffect(() => input.current?.focus(), []);

  const contactId = route.contactId;
  const context = [
    `Persona ${ws.persona.name}`,
    contactId ? `${ws.server.contactName(contactId)} · rev ${ws.latest(contactId)?.entityVersion}` : 'No contact',
    route.mode !== 'now' && route.rev ? `Viewing rev ${route.rev}${route.mode === 'compare' ? ` vs ${route.pin}` : ''}` : null,
    route.page === 'activity' ? 'Activity filters' : null,
    ws.draft ? `Draft: ${ws.pending.length} pending` : null,
  ].filter(Boolean) as string[];

  const selectedPhone = route.sel && route.sel.startsWith('phone.') ? Number(route.sel.split('.')[1]) : null;

  const ask = (q: string) => {
    const query = q.trim();
    if (!query) return;
    const reply = ws.ask(query, {
      contactId,
      selectedRevision: route.mode !== 'now' ? route.rev : null,
      compareRevision: route.mode === 'compare' ? route.pin : null,
      filters: route.page === 'activity' ? filtersFromQuery(route.query) : null,
      selectedPhoneOrdinal: selectedPhone,
    });
    let staged: Entry['staged'] = null;
    for (const a of reply.actions) {
      if (a.kind === 'filters') nav.activity(a.filters, null);
      else if (a.kind === 'navigate') nav.compare(a.contactId, a.version, a.compare ?? Math.max(1, a.version - 1));
      else if (a.kind === 'proposal') {
        staged = ws.stageProposal(a);
        if (staged.ok) {
          const first = a.commands.find((c) => 'ordinal' in c) as { kind: string; ordinal: number } | undefined;
          nav.contact(a.contactId, { mode: null, rev: null, pin: null, sel: first ? `${first.kind.split('.')[0]}.${first.ordinal}` : 'profile' });
        }
      }
    }
    setEntries((e) => [{ query, reply, staged }, ...e]);
    setText('');
  };

  const openRef = (r: SidekickReply['refs'][number]) => {
    if (r.kind === 'revision') {
      if (r.compare) nav.compare(r.contactId, r.version, r.compare, r.fields[0] ?? null);
      else nav.timeline(r.contactId, r.version, null, r.fields[0] ?? null);
    } else nav.activity(undefined, r.stamp);
    onClose();
  };

  const latest = entries[0];

  return (
    <div className="st-palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="st-palette" role="dialog" aria-modal="true" aria-label="Sidekick palette">
        <form
          className="st-palette__input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <Icon name="sparkle" size={20} />
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about this contact, its history, or stage an edit…" aria-label="Ask the sidekick" />
          <span className="st-badge st-badge--orange">simulated · local</span>
        </form>
        <div className="st-palette__ctx" aria-label="What the sidekick is using">
          <span>Using:</span>
          {context.map((c) => (
            <span key={c} className="st-badge">
              {c}
            </span>
          ))}
        </div>
        <div className="st-palette__body" aria-live="polite">
          {!latest ? (
            <>
              <div className="st-palette__section">Try</div>
              <div className="st-suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {latest ? (
            <>
              <div className="st-palette__section">Answer · “{latest.query}”</div>
              <div className={`st-answer${latest.reply.bounded ? ' st-answer--bounded' : ''}`}>
                {latest.reply.text}
                <div className="st-answer__used">
                  {latest.reply.used.map((u) => (
                    <span key={u} className="st-badge">
                      {u}
                    </span>
                  ))}
                </div>
              </div>
              {latest.reply.refs.length ? <div className="st-palette__section">Evidence</div> : null}
              {latest.reply.refs.map((r, i) => (
                <button key={i} className="st-result" onClick={() => openRef(r)}>
                  <span className="st-result__glyph">
                    <Icon name={r.kind === 'revision' ? 'history' : 'activity'} size={14} />
                  </span>
                  <span>
                    {r.kind === 'revision' ? `Revision ${r.version}${r.compare ? ` · compared with ${r.compare}` : ''}` : r.label}
                    {r.kind === 'revision' && r.fields.length ? <span className="st-result__sub">{r.fields.length} changed field{r.fields.length === 1 ? '' : 's'} · opens read-only</span> : null}
                  </span>
                  <span className="st-result__kbd">↩</span>
                </button>
              ))}
              {latest.reply.actions.map((a, i) => (
                <div key={i} className="st-answer" style={{ display: 'grid', gap: 6 }}>
                  {a.kind === 'filters' ? (
                    <>
                      <strong>
                        <Icon name="filter" size={13} /> {a.label}
                      </strong>
                      <span className="st-hint">Read-only navigation happened immediately.</span>
                      <button className="st-btn st-btn--sm" onClick={onClose}>
                        See activity
                      </button>
                    </>
                  ) : a.kind === 'navigate' ? (
                    <>
                      <strong>
                        <Icon name="history" size={13} /> {a.label}
                      </strong>
                      <button className="st-btn st-btn--sm" onClick={onClose}>
                        See it
                      </button>
                    </>
                  ) : (
                    <>
                      <strong>
                        <Icon name="edit" size={13} /> {latest.staged?.ok ? 'Staged in your draft' : 'Proposal'} · {a.lines.length} change{a.lines.length === 1 ? '' : 's'}
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {a.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                      {latest.staged && !latest.staged.ok ? <span className="st-error">{latest.staged.message}</span> : null}
                      {latest.staged?.ok ? (
                        <div className="st-card__actions">
                          <button
                            className="st-btn st-btn--sm st-btn--primary"
                            onClick={() => {
                              void ws.save();
                              onClose();
                            }}
                          >
                            Apply as one Save
                          </button>
                          <button className="st-btn st-btn--sm" onClick={onClose}>
                            Adjust in the inspector
                          </button>
                          <button
                            className="st-btn st-btn--sm st-btn--quiet"
                            onClick={() => {
                              ws.discardDraft();
                              onClose();
                            }}
                          >
                            Discard
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </>
          ) : null}
          {entries.length > 1 ? (
            <>
              <div className="st-palette__section">Earlier</div>
              {entries.slice(1, 4).map((e, i) => (
                <button key={i} className="st-result" onClick={() => ask(e.query)}>
                  <span className="st-result__glyph">
                    <Icon name="clock" size={14} />
                  </span>
                  <span>
                    {e.query}
                    <span className="st-result__sub">{e.reply.text.slice(0, 90)}…</span>
                  </span>
                  <span className="st-result__kbd">↻</span>
                </button>
              ))}
            </>
          ) : null}
        </div>
        <div className="st-palette__foot">
          <span>
            <span className="st-kbd">↩</span> ask
          </span>
          <span>
            <span className="st-kbd">esc</span> close
          </span>
          <span style={{ marginLeft: 'auto' }}>Deterministic local assistant · no data leaves the browser</span>
        </div>
      </div>
    </div>
  );
}
