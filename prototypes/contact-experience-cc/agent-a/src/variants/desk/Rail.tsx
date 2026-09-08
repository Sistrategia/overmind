// Desk evidence rail: revision list plus At / Between / During for the selected revision.
import { useEffect, useMemo, useState } from 'react';
import { childTitle, touchedKeys } from '../../core/engine';
import { fmtDayMonth, fmtTime } from '../../core/format';
import type { AuditUnit } from '../../core/model';
import { navigate } from '../../core/router';
import { actorShort } from '../../core/personas';
import { useRevision, useSession, useWorkspace } from '../../core/workspace';
import { ActionsList, DiffList, UnitMeta } from '../../shared/evidence';
import { Avatar, Badge, Empty, ProblemView, Spinner } from '../../shared/ui';
import type { ContactWorkspace } from '../../shared/use-contact-workspace';
import { revisionSummaryList, useEmptyDiffNote } from './Record';

export function DeskRail({ cw, slug, rev, compare, highlight, fromActivity, onFocusChild }: { cw: ContactWorkspace; slug: string; rev: number | null; compare: number | null; highlight: string[]; fromActivity: string | null; onFocusChild: (key: string) => void }) {
  const ws = useWorkspace();
  const { dataVersion } = useSession();
  const units = useMemo(() => (cw.contactKey ? [...ws.server.unitsFor(cw.contactKey)].reverse() : []), [ws, cw.contactKey, dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = cw.committed?.entityVersion ?? null;
  const selected = rev ?? current;
  const cmp = compare ?? (selected && selected > 1 ? selected - 1 : null);
  const read = useRevision(cw.canHistory ? cw.contactKey : null, selected, cmp);
  const [mode, setMode] = useState<'at' | 'between' | 'during'>('between');
  useEffect(() => { if (highlight.length) setMode('between'); }, [highlight]);
  const emptyNote = useEmptyDiffNote(read.data);
  const hiSet = useMemo(() => new Set(highlight), [highlight]);

  const select = (u: AuditUnit) => navigate({ variant: 'desk', screen: 'history', segment: slug, params: { rev: String(u.entityVersion), compare: u.entityVersion > 1 ? String(u.entityVersion - 1) : '', from: fromActivity ?? '' } });

  if (!cw.canHistory) {
    return <div className="desk-rail-inner"><div className="rail-head"><h2>Evidence</h2></div><div style={{ padding: 12 }}><Empty>Your role ({cw.persona.role}) cannot read revision history.</Empty></div></div>;
  }
  return (
    <>
      <div className="rail-head">
        <h2>Evidence</h2>
        <span className="tiny faint">{units.length} revisions</span>
        <span className="grow" />
        {fromActivity && <button className="btn sm" onClick={() => { location.hash = fromActivity; }} data-testid="back-to-activity">← Activity</button>}
      </div>
      <div className="revlist" role="listbox" aria-label="Revisions" data-testid="revision-list">
        {units.map(u => {
          const keys = [...touchedKeys(u.actions)];
          const snap = ws.server.snapshotAt(u.contactKey, u.entityVersion)!;
          const chips = keys.slice(0, 3).map(k => {
            if (k === 'profile') return 'Profile';
            if (k === 'root') return 'Contact';
            const [fam, ord] = k.split('#');
            const c = (snap[fam === 'email' ? 'emails' : fam === 'phone' ? 'phones' : fam === 'web_link' ? 'webLinks' : 'addresses'] as { ordinal: number }[]).find(x => x.ordinal === Number(ord));
            return c ? childTitle(c as never) : k;
          });
          return (
            <button key={u.id} role="option" aria-selected={u.entityVersion === selected} className={`revitem ${u.entityVersion === selected ? 'active' : ''} ${u.entityVersion === current ? 'current' : ''}`} onClick={() => select(u)} data-testid={`rev-${u.entityVersion}`}>
              <span className="dot" aria-hidden="true" />
              <span className="col" style={{ gap: 1 }}>
                <span className="r1"><span className="n">Revision {u.entityVersion}</span>{u.entityVersion === current && <Badge tone="accent">Current</Badge>}<span className="t">{fmtDayMonth(u.recordedAt)} {fmtTime(u.recordedAt)}</span></span>
                <span className="r2"><Avatar actorKey={u.actorKey} /> {actorShort(u.actorKey)} · {u.summary}</span>
                <span className="r3">{chips.map((c, i) => <span key={i} className="chip">{c}</span>)}{keys.length > 3 && <span className="chip">+{keys.length - 3}</span>}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="rail-detail" data-testid="rail-detail">
        {read.loading && <Spinner label="Loading revision" />}
        {read.problem && <ProblemView problem={read.problem} />}
        {read.data && (<>
          <UnitMeta unit={read.data.unit} compact />
          <div className="row wrap">
            <div className="seg" role="group" aria-label="Evidence view">
              <button aria-pressed={mode === 'at'} onClick={() => setMode('at')} data-testid="mode-at">At revision {selected}</button>
              <button aria-pressed={mode === 'between'} onClick={() => setMode('between')} data-testid="mode-between">Between {cmp ?? '—'} → {selected}</button>
              <button aria-pressed={mode === 'during'} onClick={() => setMode('during')} data-testid="mode-during">During this Save</button>
            </div>
          </div>
          {mode === 'between' && (
            <div className="col" style={{ gap: 6 }}>
              <label className="row small muted">Compare with
                <select className="select" style={{ width: 'auto', height: 26 }} value={cmp ?? ''} onChange={e => navigate({ variant: 'desk', screen: 'history', segment: slug, params: { rev: String(selected), compare: e.target.value, from: fromActivity ?? '' } })} data-testid="compare-select">
                  {units.filter(u => u.entityVersion < (selected ?? 0)).map(u => <option key={u.id} value={u.entityVersion}>revision {u.entityVersion}</option>)}
                  {(selected ?? 0) <= 1 && <option value="">—</option>}
                </select>
              </label>
              {read.data.diff ? <DiffList diff={read.data.diff} onFocus={ref => onFocusChild(`${ref.family}#${ref.ordinal}`)} emptyNote={emptyNote} highlight={hiSet} /> : <p className="small muted">Revision 1 has nothing earlier to compare with.</p>}
              <p className="tiny faint">Difference = state at {selected} minus state at {cmp}. It is not the list of actions.</p>
            </div>
          )}
          {mode === 'during' && (
            <div className="col" style={{ gap: 6 }}>
              <ActionsList actions={read.data.actions} onFocus={ref => onFocusChild(`${ref.family}#${ref.ordinal}`)} highlight={highlight[0] ?? null} />
              <p className="tiny faint">Ordered effective actions recorded by this Save, including ones whose net effect cancelled out.</p>
            </div>
          )}
          {mode === 'at' && (
            <div className="state-list" data-testid="state-at">
              {revisionSummaryList(read.data).map(r => <div key={r.k}><span className="k">{r.k}:</span> <span style={{ whiteSpace: 'pre-line' }}>{r.v}</span></div>)}
              <p className="tiny faint">Reconstructed from historical payloads; labels and values are as they were then.</p>
            </div>
          )}
        </>)}
      </div>
    </>
  );
}
