// Desk sidekick: a docked panel with a visible context strip, transcript and prompt.
import { useEffect, useRef, useState } from 'react';
import type { SidekickContext, SidekickProposal, SidekickRef } from '../../core/sidekick';
import { Choices, ProposalCard, RefChips, SidekickDisclaimer, UsedList } from '../../shared/sidekick-parts';
import { Badge, Spinner } from '../../shared/ui';
import { useSidekick } from '../../shared/use-sidekick';

export function DeskSidekick({ getContext, onNavigate, onStage, onClose, canEdit }: {
  getContext: () => SidekickContext; onNavigate: (r: SidekickRef) => void; onStage: (p: SidekickProposal, mode: 'stage' | 'save') => Promise<boolean>; onClose: () => void; canEdit: boolean;
}) {
  const sk = useSidekick({ getContext, onNavigate, onStage });
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const ctx = getContext();
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [sk.messages.length, sk.pending]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && document.activeElement === input.current) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const submit = (e: React.FormEvent) => { e.preventDefault(); sk.ask(text); setText(''); };
  return (
    <aside className="desk-sidekick" aria-label="Sidekick" data-testid="sidekick">
      <div className="sk-head"><h2>Sidekick</h2><Badge tone="warn">simulated</Badge><span className="grow" />{sk.messages.length > 0 && <button className="btn quiet sm" onClick={sk.clear}>Clear</button>}<button className="btn quiet icon sm" onClick={onClose} aria-label="Close sidekick (Esc)">✕</button></div>
      <div className="sk-context" aria-label="What the sidekick can see" data-testid="sidekick-context">
        <span className={`c ${ctx.contactKey ? 'on' : ''}`}>{ctx.contactKey ? `contact · ${ctx.screen === 'history' && ctx.selectedRevision ? `rev ${ctx.selectedRevision}` : 'current'}` : 'no contact'}</span>
        <span className={`c ${ctx.draft?.items.length ? 'on' : ''}`}>{ctx.draft?.items.length ? `${ctx.draft.items.length} pending` : 'no draft'}</span>
        <span className={`c ${ctx.filters && Object.values(ctx.filters).some(Boolean) ? 'on' : ''}`}>{ctx.screen === 'activity' ? 'activity filters' : 'no filters'}</span>
        <span className="c on">{ctx.persona.shortName} · {ctx.persona.role.toLowerCase()}</span>
        {ctx.focusedChild && <span className="c on">focus · {ctx.focusedChild.family} {ctx.focusedChild.ordinal}</span>}
      </div>
      <div className="sk-log" ref={log} role="log" aria-live="polite">
        {sk.messages.length === 0 && <p className="small muted">I work with what is on screen: this contact, the selected revision, the active filters and your unsaved draft. Read and navigation answers happen immediately; edits are staged for you to apply as one Save.</p>}
        {sk.messages.map(m => (
          <div key={m.id} className={`sk-msg ${m.role} ${m.reply?.bounded ? 'bounded' : ''}`} data-testid={`sidekick-${m.role}`}>
            <div className="bubble">{m.text}</div>
            {m.reply && <RefChips refs={m.reply.refs} onOpen={onNavigate} />}
            {m.reply?.proposal && <ProposalCard message={m} canEdit={canEdit} onAct={mode => void sk.actOnProposal(m.id, mode)} />}
            {m.reply && <Choices choices={m.reply.choices} onPick={p => sk.ask(p)} />}
            {m.reply && <UsedList used={m.reply.used} />}
          </div>
        ))}
        {sk.pending && <div className="small muted"><Spinner /> thinking with the current view…</div>}
      </div>
      <div className="sk-suggest">{sk.suggestions.map(s => <button key={s} className="btn sm" onClick={() => sk.ask(s)} data-testid="sidekick-suggestion">{s}</button>)}</div>
      <form className="sk-input" onSubmit={submit}>
        <input ref={input} className="input" value={text} onChange={e => setText(e.target.value)} placeholder="Ask about changes, or describe a small edit…" aria-label="Ask the sidekick" data-testid="sidekick-input" />
        <button className="btn primary" type="submit" disabled={!text.trim()} data-testid="sidekick-send">Ask</button>
      </form>
      <SidekickDisclaimer />
    </aside>
  );
}
