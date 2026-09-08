import { useCallback, useMemo, useRef, useState } from 'react';
import type { SidekickContext, SidekickProposal, SidekickRef, SidekickReply } from '../core/sidekick';
import { useWorkspace } from '../core/workspace';

export interface SidekickMessage { id: string; role: 'user' | 'sidekick'; text: string; reply: SidekickReply | null; at: number; proposalState?: 'open' | 'staged' | 'saved' | 'discarded' }

export interface SidekickHandlers {
  getContext: () => SidekickContext;
  onNavigate: (ref: SidekickRef) => void;
  onStage: (proposal: SidekickProposal, mode: 'stage' | 'save') => Promise<boolean> | boolean;
}

export function useSidekick(handlers: SidekickHandlers) {
  const ws = useWorkspace();
  const [messages, setMessages] = useState<SidekickMessage[]>([]);
  const [pending, setPending] = useState(false);
  const seq = useRef(0);
  const h = useRef(handlers);
  h.current = handlers;

  const ask = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    seq.current += 1;
    const userId = `u${seq.current}`;
    setMessages(m => [...m, { id: userId, role: 'user', text: t, reply: null, at: Date.now() }]);
    setPending(true);
    // Short, fixed delay: enough to show a pending state, no fake typing.
    window.setTimeout(() => {
      const reply = ws.sidekick.ask(t, h.current.getContext());
      setMessages(m => [...m, { id: reply.id, role: 'sidekick', text: reply.text, reply, at: Date.now(), proposalState: reply.proposal ? 'open' : undefined }]);
      setPending(false);
      if (reply.navigate) h.current.onNavigate(reply.navigate);
    }, 160);
  }, [ws]);

  const actOnProposal = useCallback(async (messageId: string, mode: 'stage' | 'save' | 'discard') => {
    const msg = messages.find(m => m.id === messageId);
    const proposal = msg?.reply?.proposal;
    if (!proposal) return;
    if (mode === 'discard') { setMessages(m => m.map(x => x.id === messageId ? { ...x, proposalState: 'discarded' } : x)); return; }
    const ok = await h.current.onStage(proposal, mode);
    if (ok) {
      setMessages(m => m.map(x => x.id === messageId ? { ...x, proposalState: mode === 'save' ? 'saved' : 'staged' } : x));
      ws.server.logOperational({ category: 'sidekick', actorKey: ws.session.get().persona.actorKey, contactKey: proposal.contactKey, outcome: 'info',
        summary: `Sidekick proposal ${mode === 'save' ? 'saved' : 'staged'} by ${ws.session.get().persona.shortName}: ${proposal.items.length} command${proposal.items.length === 1 ? '' : 's'}`,
        detail: proposal.explanation.join(' · ') });
    }
  }, [messages, ws]);

  const clear = useCallback(() => setMessages([]), []);
  const suggestions = useMemo(() => ws.sidekick.suggestions(h.current.getContext()), [ws, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, pending, ask, actOnProposal, clear, suggestions };
}
