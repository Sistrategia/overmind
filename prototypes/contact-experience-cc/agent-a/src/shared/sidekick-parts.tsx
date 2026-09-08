import type { ReactNode } from 'react';
import type { SidekickRef } from '../core/sidekick';
import type { SidekickMessage } from './use-sidekick';
import { Badge } from './ui';

export function RefChips({ refs, onOpen }: { refs: SidekickRef[]; onOpen: (r: SidekickRef) => void }) {
  if (!refs.length) return null;
  return (
    <div className="row wrap sk-refs" style={{ gap: 4 }}>
      {refs.map((r, i) => (
        <button key={i} className="btn sm" onClick={() => onOpen(r)} data-testid="sidekick-ref" title={r.highlight?.length ? `Highlights ${r.highlight.join(', ')}` : undefined}>
          <span aria-hidden="true">{r.kind === 'revision' ? '⟲' : r.kind === 'unit' ? '▤' : r.kind === 'activity' ? '⚲' : '↗'}</span> {r.label}
        </button>
      ))}
    </div>
  );
}

export function UsedList({ used }: { used: string[] }) {
  return (
    <details className="tech sk-used"><summary>What I used</summary>
      <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 16 }}>{used.map((u, i) => <li key={i}>{u}</li>)}</ul>
    </details>
  );
}

export function ProposalCard({ message, canEdit, onAct }: { message: SidekickMessage; canEdit: boolean; onAct: (mode: 'stage' | 'save' | 'discard') => void }) {
  const p = message.reply?.proposal;
  if (!p) return null;
  const state = message.proposalState ?? 'open';
  return (
    <div className="sk-proposal" data-testid="sidekick-proposal" data-state={state}>
      <div className="row"><Badge tone="pending">Proposed edit</Badge><span className="small strong">{p.title}</span>{state !== 'open' && <Badge tone={state === 'saved' ? 'ok' : state === 'staged' ? 'accent' : ''}>{state}</Badge>}</div>
      <ol className="small" style={{ margin: '6px 0', paddingLeft: 18 }}>{p.explanation.map((e, i) => <li key={i}>{e}</li>)}</ol>
      {state === 'open' && canEdit && (
        <div className="row wrap">
          <button className="btn sm" onClick={() => onAct('stage')} data-testid="proposal-stage">Stage in form to adjust</button>
          <button className="btn sm primary" onClick={() => onAct('save')} data-testid="proposal-save">Save as one revision</button>
          <button className="btn sm quiet" onClick={() => onAct('discard')} data-testid="proposal-discard">Discard</button>
        </div>
      )}
      {state === 'open' && !canEdit && <p className="small muted">Your persona cannot edit; nothing can be staged.</p>}
    </div>
  );
}

export function Choices({ choices, onPick }: { choices: { label: string; prompt: string }[] | null; onPick: (prompt: string) => void }) {
  if (!choices?.length) return null;
  return <div className="row wrap" style={{ gap: 4 }}>{choices.map((c, i) => <button key={i} className="btn sm" onClick={() => onPick(c.prompt)} data-testid="sidekick-choice">{c.label}</button>)}</div>;
}

export function SidekickDisclaimer({ children }: { children?: ReactNode }) {
  return <p className="tiny faint sk-disclaimer">Simulated assistant: deterministic, local, no external model. Reads only fixture data; writes only through the same Save you would make.{children}</p>;
}
