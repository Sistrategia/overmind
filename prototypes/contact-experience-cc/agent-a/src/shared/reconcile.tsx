// Recoverable conflict: the draft is preserved, the concurrent revisions are shown beside it,
// and nothing is saved until the person chooses. No silent overwrite, no blind retry.
import { useMemo, useState } from 'react';
import { describeItem, type Draft, type ReconcileReport, type Resolution } from '../core/draft';
import type { ContactState } from '../core/model';
import { actorName } from '../core/personas';
import { ActionsList, When } from './evidence';
import { Badge } from './ui';

const STATUS_LABEL: Record<string, { text: string; tone: '' | 'ok' | 'warn' | 'danger' | 'accent' }> = {
  clean: { text: 'No overlap', tone: 'ok' },
  merged: { text: 'Combined', tone: 'accent' },
  conflict: { text: 'Needs a choice', tone: 'danger' },
  superseded: { text: 'Already applied', tone: '' },
  'removed-by-them': { text: 'Removed by them', tone: 'warn' }
};

export function ReconcilePanel({ report, draft, base, onSave, onRebaseOnly, onDiscard, busy }: {
  report: ReconcileReport; draft: Draft; base: ContactState;
  onSave: (resolutions: Record<string, Resolution>) => void;
  onRebaseOnly: (resolutions: Record<string, Resolution>) => void;
  onDiscard: () => void;
  busy?: boolean;
}) {
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const unresolved = useMemo(() => report.items.filter(i => i.status === 'conflict' && !resolutions[i.item.id]), [report, resolutions]);
  const theirActors = [...new Set(report.theirUnits.map(u => actorName(u.actorKey)))].join(', ');
  return (
    <div className="reconcile" data-testid="reconcile">
      <p className="small">
        Your draft is based on <strong>revision {report.baseVersion}</strong>. {theirActors} saved
        {report.theirUnits.length === 1 ? ` revision ${report.currentVersion}` : ` revisions ${report.baseVersion + 1}–${report.currentVersion}`} in the meantime.
        Your draft was kept; nothing has been sent.
      </p>
      <div className="reconcile-cols">
        <section aria-labelledby="rc-mine">
          <h3 id="rc-mine" className="small strong">Your draft ({draft.items.length})</h3>
          <ol className="small" style={{ paddingLeft: 18 }}>{draft.items.map(i => <li key={i.id}>{describeItem(i, base)}</li>)}</ol>
        </section>
        <section aria-labelledby="rc-theirs">
          <h3 id="rc-theirs" className="small strong">What changed since revision {report.baseVersion}</h3>
          {report.theirUnits.map(u => (
            <div key={u.id} className="col" style={{ gap: 4, marginBottom: 8 }}>
              <div className="small"><strong>Revision {u.entityVersion}</strong> · {actorName(u.actorKey)} · <When iso={u.recordedAt} /></div>
              <ActionsList actions={u.actions} dense />
            </div>
          ))}
        </section>
      </div>
      <h3 className="small strong" style={{ marginTop: 10 }}>Reconciliation</h3>
      <ul className="reconcile-items">
        {report.items.map(r => {
          const st = STATUS_LABEL[r.status];
          const res = resolutions[r.item.id];
          return (
            <li key={r.item.id} className={`reconcile-item ${r.status}`} data-testid={`reconcile-item-${r.status}`}>
              <div className="row wrap"><Badge tone={st.tone}>{st.text}</Badge><span className="small strong">{describeItem(r.item, base)}</span></div>
              {r.theirSummary && <p className="small muted">They: {r.theirSummary}</p>}
              {r.mergedNote && <p className="small">{r.mergedNote}</p>}
              {r.status === 'conflict' && (
                <div className="conflict-table">
                  <table className="small">
                    <thead><tr><th>Field</th><th>Before (rev {report.baseVersion})</th><th>Yours</th><th>Theirs</th></tr></thead>
                    <tbody>{r.conflicts.map(c => <tr key={c.field}><td>{c.label}</td><td className="mono">{String(c.base ?? '—')}</td><td className="mono">{String(c.mine ?? '—')}</td><td className="mono">{String(c.theirs ?? '—')}</td></tr>)}</tbody>
                  </table>
                  <div className="row wrap" role="radiogroup" aria-label="Resolution">
                    <label className="check"><input type="radio" name={`res-${r.item.id}`} checked={res === 'mine'} onChange={() => setResolutions({ ...resolutions, [r.item.id]: 'mine' })} data-testid="resolve-mine" /> Keep mine (replaces theirs on these fields)</label>
                    <label className="check"><input type="radio" name={`res-${r.item.id}`} checked={res === 'theirs'} onChange={() => setResolutions({ ...resolutions, [r.item.id]: 'theirs' })} data-testid="resolve-theirs" /> Take theirs (drop my change)</label>
                  </div>
                </div>
              )}
              {r.status === 'removed-by-them' && (
                <div className="row wrap" role="radiogroup" aria-label="Resolution">
                  <label className="check"><input type="radio" name={`res-${r.item.id}`} checked={(res ?? r.defaultResolution) === 'drop'} onChange={() => setResolutions({ ...resolutions, [r.item.id]: 'drop' })} /> Drop my change</label>
                  <label className="check"><input type="radio" name={`res-${r.item.id}`} checked={res === 'mine'} onChange={() => setResolutions({ ...resolutions, [r.item.id]: 'mine' })} /> Restore it with my values</label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="row wrap" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={busy || unresolved.length > 0} onClick={() => onSave(resolutions)} data-testid="reconcile-save" title={unresolved.length ? 'Choose a resolution for each conflict first' : undefined}>
          Save against revision {report.currentVersion}
        </button>
        <button className="btn" disabled={busy || unresolved.length > 0} onClick={() => onRebaseOnly(resolutions)} data-testid="reconcile-keep-editing">Apply and keep editing</button>
        <button className="btn quiet" disabled={busy} onClick={onDiscard} data-testid="reconcile-discard">Discard my draft</button>
        {unresolved.length > 0 && <span className="small muted">{unresolved.length} conflict{unresolved.length === 1 ? '' : 's'} still need a choice.</span>}
      </div>
    </div>
  );
}
