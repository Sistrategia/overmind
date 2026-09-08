import React, { useEffect, useState } from 'react';
import type { StudioNav } from './StudioApp';
import { useWorkspace, type UncertainCheck } from '../../core/store';
import { Icon } from '../../core/icons';
import { CONTACT_IDS, personaById } from '../../core/fixtures';
import { useEscape } from '../../core/hooks';
import { fmt } from '../../core/format';

export function StudioDemo({ onClose, nav }: { onClose: () => void; nav: StudioNav }) {
  const ws = useWorkspace();
  useEscape(true, onClose);
  return (
    <div className="st-demo" id="st-demo" role="dialog" aria-label="Demo controls (not part of the product)">
      <div className="st-demo__head">
        <Icon name="settings" size={13} /> Demo controls · not product UI
        <button className="st-btn st-btn--quiet st-btn--icon st-btn--sm" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close demo controls">
          <Icon name="close" size={13} />
        </button>
      </div>
      <div className="st-demo__group">
        <strong>Persona (this tab)</strong>
        {ws.personas.map((p) => (
          <label key={p.id} className="st-radio">
            <input type="radio" name="st-persona" checked={ws.persona.id === p.id} onChange={() => ws.setPersona(p.id)} />
            <span>
              {p.fullName} <span className="st-hint">· {p.role}</span>
            </span>
          </label>
        ))}
        <span className="st-demo__note">Story: {ws.story === 'rehearsal' ? 'conflict rehearsal (Lina at revision 3)' : 'full (7 revisions)'}.</span>
      </div>
      <div className="st-demo__group">
        <strong>Collaboration</strong>
        <div className="st-demo__row">
          <button className="st-btn st-btn--sm" onClick={ws.rewindToRehearsal}>
            Rewind: Mariana edits revision 3
          </button>
          <button className="st-btn st-btn--sm" onClick={ws.simulateBrunoUpdate}>
            Simulate Bruno’s update
          </button>
          <a className="st-btn st-btn--sm" href={window.location.href} target="_blank" rel="noopener">
            <Icon name="externalTab" size={13} /> Second tab
          </a>
        </div>
        <span className="st-demo__note">Tabs share the simulated server (localStorage) and talk over BroadcastChannel — prototype interaction, not deployed infrastructure.</span>
      </div>
      <div className="st-demo__group">
        <strong>Next Save outcome</strong>
        <select className="st-select" value={ws.demo.nextOutcome} onChange={(e) => ws.setDemo({ nextOutcome: e.target.value as typeof ws.demo.nextOutcome })} aria-label="Next Save outcome">
          <option value="ok">Normal</option>
          <option value="forbidden">Permission denied (403)</option>
          <option value="storage">Storage failure (500, nothing committed)</option>
          <option value="uncertain">Commit uncertain (500, outcome unknown)</option>
        </select>
        <label className="st-toggle">
          <input type="checkbox" checked={ws.demo.slow} onChange={(e) => ws.setDemo({ slow: e.target.checked })} /> Slow Save
        </label>
      </div>
      <div className="st-demo__group">
        <strong>Reads</strong>
        <label className="st-toggle">
          <input type="checkbox" checked={ws.demo.loading} onChange={(e) => ws.setDemo({ loading: e.target.checked })} /> Show loading state
        </label>
        <label className="st-field">
          <span className="st-label">Historical coverage</span>
          <select className="st-select" value={ws.demo.historyCoverageFrom ?? ''} onChange={(e) => ws.setDemo({ historyCoverageFrom: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Complete</option>
            <option value="4">Unavailable before revision 4</option>
            <option value="6">Unavailable before revision 6</option>
          </select>
        </label>
      </div>
      <div className="st-demo__group">
        <strong>Story</strong>
        <div className="st-demo__row">
          <button className="st-btn st-btn--sm" onClick={ws.reset}>
            Reset demo
          </button>
          <button className="st-btn st-btn--sm" onClick={() => nav.contact(CONTACT_IDS.lina, { mode: null, rev: null, pin: null, sel: null })}>
            Go to Lina
          </button>
        </div>
      </div>
    </div>
  );
}

export function StudioToasts() {
  const ws = useWorkspace();
  if (!ws.toasts.length) return null;
  return (
    <div className="st-toasts" aria-live="polite">
      {ws.toasts.map((t) => (
        <div key={t.id} className={`st-toast st-toast--${t.kind}`} role="status">
          <span className="st-toast__icon">
            <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : t.kind === 'warning' ? 'users' : 'info'} size={15} />
          </span>
          <span>{t.text}</span>
          <button className="st-btn st-btn--quiet st-btn--icon st-btn--sm" onClick={() => ws.dismissToast(t.id)} aria-label="Dismiss">
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Modal sheets for outcomes that need a decision: conflict, error, uncertain commit. */
export function StudioAlerts({ nav }: { nav: StudioNav }) {
  const ws = useWorkspace();
  const s = ws.saveState;
  const [check, setCheck] = useState<UncertainCheck | null>(null);
  useEffect(() => {
    if (s.status !== 'uncertain') setCheck(null);
  }, [s.status]);

  if (ws.conflict && ws.draft) {
    const c = ws.conflict;
    const theirActor = personaById(c.theirs.actorId).name;
    const overlap = (path: string) => c.overlaps.some((o) => o === path || o.startsWith(`${path}.`) || path.startsWith(`${o}.`));
    const minePaths = [...c.mineDiff.profile.map((f) => f.path), ...c.mineDiff.children.flatMap((ch) => (ch.status === 'changed' ? ch.changes.map((f) => f.path) : ch.status === 'unchanged' ? [] : [`${ch.family}.${ch.ordinal}`]))];
    const theirs = [
      ...c.diffTheirs.profile.map((f) => ({ path: f.path, text: `${f.label}: ${f.before ?? '(empty)'} → ${f.after ?? '(empty)'}` })),
      ...c.diffTheirs.children.flatMap((ch) => (ch.status === 'unchanged' ? [] : ch.status === 'changed' ? ch.changes.map((f) => ({ path: f.path, text: `${ch.label} ${f.label.toLowerCase()}: ${f.before ?? '(empty)'} → ${f.after ?? '(empty)'}` })) : [{ path: `${ch.family}.${ch.ordinal}`, text: `${ch.label} ${ch.status}: ${ch.display}` }])),
    ];
    return (
      <div className="st-alert-backdrop">
        <div className="st-alert" role="alertdialog" aria-labelledby="st-conflict-title">
          <div className="st-alert__head">
            <span className="st-alert__icon st-alert__icon--warn">
              <Icon name="users" size={22} />
            </span>
            <div>
              <h2 id="st-conflict-title">Your Save was rejected as stale (409 conflict)</h2>
              <div className="st-hint">
                You started from revision {c.base.entityVersion}; {theirActor} committed revision {c.theirs.entityVersion} at {fmt.dateTime(c.theirs.at)}. Nothing was overwritten or retried.
              </div>
            </div>
          </div>
          <div className="st-alert__cols">
            <div className="st-alert__col">
              <h4>
                <Icon name="edit" size={13} /> Your draft (from revision {c.base.entityVersion})
              </h4>
              <ul>
                {c.mine.map((p, i) => (
                  <li key={p.key} className={overlap(minePaths[i] ?? '') ? 'st-overlap' : undefined}>
                    {p.text}
                    {overlap(minePaths[i] ?? '') ? ' · overlaps' : ''}
                  </li>
                ))}
              </ul>
            </div>
            <div className="st-alert__col">
              <h4>
                <Icon name="users" size={13} /> {theirActor}’s revision {c.theirs.entityVersion}: “{c.theirs.summary}”
              </h4>
              <ul>
                {theirs.map((t) => (
                  <li key={t.path} className={overlap(t.path) ? 'st-overlap' : undefined}>
                    {t.text}
                    {overlap(t.path) ? ' · overlaps' : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="st-alert__actions">
            <button className="st-btn st-btn--danger" onClick={() => ws.resolveConflict('discard')}>
              Discard my draft
            </button>
            <button
              className="st-btn"
              onClick={() => {
                nav.compare(c.theirs.contactId, c.theirs.entityVersion, c.base.entityVersion);
                ws.clearSaveState();
              }}
            >
              See their changes first
            </button>
            <button className="st-btn st-btn--primary" onClick={() => ws.resolveConflict('rebase')}>
              Keep my draft on revision {c.theirs.entityVersion}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (s.status === 'error' && s.problem) {
    return (
      <div className="st-alert-backdrop">
        <div className="st-alert" role="alertdialog" aria-labelledby="st-err-title">
          <div className="st-alert__head">
            <span className="st-alert__icon st-alert__icon--danger">
              <Icon name="alert" size={22} />
            </span>
            <div>
              <h2 id="st-err-title">
                Save failed · {s.problem.status} {s.problem.code}
              </h2>
              <div>{s.problem.detail}</div>
              <div className="st-hint">Nothing was committed. Trace {s.problem.traceId}. Automatic retry is not allowed.</div>
            </div>
          </div>
          <div className="st-alert__actions">
            <button className="st-btn st-btn--quiet" onClick={ws.discardDraft}>
              Discard draft
            </button>
            <button className="st-btn st-btn--primary" onClick={ws.clearSaveState}>
              Keep editing
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (s.status === 'uncertain' && s.problem) {
    return (
      <div className="st-alert-backdrop">
        <div className="st-alert" role="alertdialog" aria-labelledby="st-unc-title">
          <div className="st-alert__head">
            <span className="st-alert__icon st-alert__icon--warn">
              <Icon name="alert" size={22} />
            </span>
            <div>
              <h2 id="st-unc-title">Save outcome unknown (500 commit_uncertain)</h2>
              <div>{s.problem.detail}</div>
              <div className="st-hint">Your draft is preserved. No automatic retry, no recovery receipt.</div>
              {check ? <div style={{ marginTop: 8 }}>{check.message}</div> : null}
            </div>
          </div>
          <div className="st-alert__actions">
            {!check ? (
              <button className="st-btn st-btn--primary" onClick={() => setCheck(ws.checkUncertain())}>
                Check the current revision
              </button>
            ) : check.committed ? (
              <>
                <button className="st-btn" onClick={() => { nav.compare(check.latest.contactId, check.latest.entityVersion, check.latest.entityVersion - 1); ws.acceptUncertain(); }}>
                  Inspect revision {check.latest.entityVersion}
                </button>
                <button className="st-btn st-btn--primary" onClick={ws.acceptUncertain}>
                  It committed · drop my draft
                </button>
              </>
            ) : (
              <>
                <button className="st-btn st-btn--quiet" onClick={ws.discardDraft}>
                  Discard draft
                </button>
                <button className="st-btn st-btn--primary" onClick={ws.clearSaveState}>
                  Keep my draft and decide
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
}
