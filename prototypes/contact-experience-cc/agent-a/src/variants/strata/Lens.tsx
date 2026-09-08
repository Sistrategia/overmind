// Strata lens: the sidekick as an annotation panel attached to the axis. Its references
// move the axis; its proposals become the draft revision.
import { useEffect, useRef, useState } from 'react';
import type { SidekickContext, SidekickProposal, SidekickRef } from '../../core/sidekick';
import { Choices, ProposalCard, RefChips, SidekickDisclaimer, UsedList } from '../../shared/sidekick-parts';
import { Badge, Spinner } from '../../shared/ui';
import { useSidekick } from '../../shared/use-sidekick';

export function Lens({ getContext, onNavigate, onStage, onClose, canEdit, at, base, draftCount }: {
  getContext: () => SidekickContext; onNavigate: (r: SidekickRef) => void; onStage: (p: SidekickProposal, mode: 'stage' | 'save') => Promise<boolean>; onClose: () => void; canEdit: boolean; at: number | null; base: number | null; draftCount: number;
}) {
  const sk = useSidekick({ getContext, onNavigate, onStage });
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const ctx = getContext();
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [sk.messages.length, sk.pending]);
  return (
    <aside className="lens" aria-label="Lens" data-testid="sidekick">
      <div className="lh"><h2>Lens</h2><Badge tone="warn">simulated</Badge><span className="grow" />{sk.messages.length > 0 && <button className="btn quiet sm" onClick={sk.clear}>Clear</button>}<button className="btn quiet icon sm" onClick={onClose} aria-label="Close lens">✕</button></div>
      <div className="focus" data-testid="sidekick-context">
        <span>Looking at <b>{ctx.contactKey ? (ctx.screen === 'history' ? `r${at}` : at !== null ? `r${at} (now)` : 'the contact') : 'tenant activity'}</b>{base !== null ? <> compared from <b>r{base}</b></> : null}</span>
        <span>Draft: <b>{draftCount ? `${draftCount} pending` : 'none'}</b> · Persona: <b>{ctx.persona.shortName}</b> ({ctx.persona.role.toLowerCase()}){ctx.focusedChild && <> · Focus: <b>{ctx.focusedChild.family} {ctx.focusedChild.ordinal}</b></>}</span>
      </div>
      <div className="llog" ref={log} role="log" aria-live="polite">
        {sk.messages.length === 0 && <p className="small muted">Ask about this contact's changes and I will point at revisions on the axis. Describe a small edit and it becomes part of the draft revision for you to commit or discard.</p>}
        {sk.messages.map(m => (
          <div key={m.id} className={`note ${m.role === 'user' ? 'q' : ''} ${m.reply?.bounded ? 'bounded' : ''}`} data-testid={`sidekick-${m.role}`}>
            <div className="txt">{m.text}</div>
            {m.reply && <RefChips refs={m.reply.refs} onOpen={onNavigate} />}
            {m.reply?.proposal && <ProposalCard message={m} canEdit={canEdit} onAct={mode => void sk.actOnProposal(m.id, mode)} />}
            {m.reply && <Choices choices={m.reply.choices} onPick={p => sk.ask(p)} />}
            {m.reply && <UsedList used={m.reply.used} />}
          </div>
        ))}
        {sk.pending && <div className="small muted"><Spinner /> reading the axis…</div>}
      </div>
      <div className="lin">
        <div className="chips">{sk.suggestions.map(s => <button key={s} className="btn sm" onClick={() => sk.ask(s)} data-testid="sidekick-suggestion">{s}</button>)}</div>
        <form onSubmit={e => { e.preventDefault(); sk.ask(text); setText(''); }}>
          <input ref={input} className="input" value={text} onChange={e => setText(e.target.value)} placeholder="Ask, or describe a small edit…" aria-label="Ask the lens" data-testid="sidekick-input" onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
          <button className="btn primary" type="submit" disabled={!text.trim()} data-testid="sidekick-send">Ask</button>
        </form>
        <SidekickDisclaimer />
      </div>
    </aside>
  );
}
