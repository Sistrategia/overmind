// Console transcript: the sidekick lives in the same command line; replies appear here.
import { useEffect, useRef } from 'react';
import type { SidekickContext, SidekickRef } from '../../core/sidekick';
import { Choices, ProposalCard, RefChips, SidekickDisclaimer, UsedList } from '../../shared/sidekick-parts';
import { Badge } from '../../shared/ui';
import type { useSidekick } from '../../shared/use-sidekick';

export function Transcript({ sk, onNavigate, onClose, canEdit, ctx }: { sk: ReturnType<typeof useSidekick>; onNavigate: (r: SidekickRef) => void; onClose: () => void; canEdit: boolean; ctx: SidekickContext }) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [sk.messages.length, sk.pending]);
  const pairs: { q: string; a: (typeof sk.messages)[number] | null }[] = [];
  for (const m of sk.messages) {
    if (m.role === 'user') pairs.push({ q: m.text, a: null });
    else if (pairs.length && !pairs[pairs.length - 1].a) pairs[pairs.length - 1].a = m;
    else pairs.push({ q: '', a: m });
  }
  return (
    <aside className="con-transcript" aria-label="Sidekick transcript" data-testid="sidekick">
      <div className="thead"><strong>transcript</strong><Badge tone="warn">simulated sidekick</Badge><span className="grow" /><span className="tiny faint" data-testid="sidekick-context">{ctx.contactKey ? `ctx: contact${ctx.selectedRevision ? ` rev ${ctx.selectedRevision}` : ''}` : 'ctx: tenant'}{ctx.draft?.items.length ? ` · stack ${ctx.draft.items.length}` : ''}{ctx.focusedChild ? ` · ${ctx.focusedChild.family} ${ctx.focusedChild.ordinal}` : ''}</span>{sk.messages.length > 0 && <button className="btn quiet sm" onClick={sk.clear}>clear</button>}<button className="btn quiet icon sm" onClick={onClose} aria-label="Close transcript">✕</button></div>
      <div className="tlog" ref={log} role="log" aria-live="polite">
        {pairs.length === 0 && <p className="muted">Type a sentence in the command line and the sidekick answers here with references you can open. Typed commands and typed questions share the same line.</p>}
        {pairs.map((p, i) => (
          <div key={i} className={`entry ${p.a?.reply?.bounded ? 'bounded' : ''}`} data-testid={p.a ? 'sidekick-sidekick' : 'sidekick-user'}>
            {p.q && <div className="q" data-testid="sidekick-user">{p.q}</div>}
            {p.a && (<>
              <div className="a">{p.a.text}</div>
              {p.a.reply && <RefChips refs={p.a.reply.refs} onOpen={onNavigate} />}
              {p.a.reply?.proposal && <ProposalCard message={p.a} canEdit={canEdit} onAct={mode => void sk.actOnProposal(p.a!.id, mode)} />}
              {p.a.reply && <Choices choices={p.a.reply.choices} onPick={q => sk.ask(q)} />}
              {p.a.reply && <UsedList used={p.a.reply.used} />}
            </>)}
          </div>
        ))}
        {sk.pending && <div className="muted small">… consulting the current view</div>}
      </div>
      <div className="tfoot">
        <div className="row wrap" style={{ gap: 4, marginBottom: 4 }}>{sk.suggestions.map(s => <button key={s} className="btn sm" style={{ height: 'auto', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => sk.ask(s)} data-testid="sidekick-suggestion">{s}</button>)}</div>
        <SidekickDisclaimer />
      </div>
    </aside>
  );
}
