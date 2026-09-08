import React from 'react';
import type { CasefileNav } from './CasefileApp';
import { useWorkspace } from '../../core/store';
import { Icon } from '../../core/icons';
import { CONTACT_IDS } from '../../core/fixtures';
import { useEscape } from '../../core/hooks';

export function CasefileDemo({ onClose, nav }: { onClose: () => void; nav: CasefileNav }) {
  const ws = useWorkspace();
  useEscape(true, onClose);
  return (
    <div className="cf-demo" id="cf-demo" role="dialog" aria-label="Demo controls (not part of the product)">
      <div className="cf-demo__head">
        <Icon name="settings" size={14} /> Demo controls · not product UI
        <button className="cf-btn cf-btn--subtle cf-btn--icon cf-btn--sm" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close demo controls">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="cf-demo__group">
        <strong>Persona (this tab)</strong>
        {ws.personas.map((p) => (
          <label key={p.id} className="cf-radio">
            <input type="radio" name="cf-persona" checked={ws.persona.id === p.id} onChange={() => ws.setPersona(p.id)} />
            <span>
              {p.fullName} <span className="cf-hint">· {p.role}</span>
            </span>
          </label>
        ))}
        <span className="cf-demo__note">Story: {ws.story === 'rehearsal' ? 'conflict rehearsal (Lina at revision 3)' : 'full (7 revisions)'}. Persona is per tab; committed state is shared across tabs of this variant.</span>
      </div>
      <div className="cf-demo__group">
        <strong>Collaboration</strong>
        <div className="cf-demo__row">
          <button className="cf-btn cf-btn--sm" onClick={ws.rewindToRehearsal}>
            Rewind: Mariana edits revision 3
          </button>
          <button className="cf-btn cf-btn--sm" onClick={ws.simulateBrunoUpdate}>
            Simulate Bruno’s update
          </button>
          <a className="cf-btn cf-btn--sm" href={window.location.href} target="_blank" rel="noopener">
            <Icon name="externalTab" size={14} /> Open second tab
          </a>
        </div>
        <span className="cf-demo__note">Two tabs share the simulated server through localStorage and talk over BroadcastChannel. This proves prototype interaction, not deployed multi-user infrastructure.</span>
      </div>
      <div className="cf-demo__group">
        <strong>Next Save outcome</strong>
        <select className="cf-select" value={ws.demo.nextOutcome} onChange={(e) => ws.setDemo({ nextOutcome: e.target.value as typeof ws.demo.nextOutcome })} aria-label="Next Save outcome">
          <option value="ok">Normal</option>
          <option value="forbidden">Permission denied (403)</option>
          <option value="storage">Storage failure (500, nothing committed)</option>
          <option value="uncertain">Commit uncertain (500, outcome unknown)</option>
        </select>
        <label className="cf-check">
          <input type="checkbox" checked={ws.demo.slow} onChange={(e) => ws.setDemo({ slow: e.target.checked })} /> Slow Save (show saving state)
        </label>
      </div>
      <div className="cf-demo__group">
        <strong>Reads</strong>
        <label className="cf-check">
          <input type="checkbox" checked={ws.demo.loading} onChange={(e) => ws.setDemo({ loading: e.target.checked })} /> Show loading skeletons
        </label>
        <label className="cf-field">
          <span className="cf-label">Historical coverage</span>
          <select className="cf-select" value={ws.demo.historyCoverageFrom ?? ''} onChange={(e) => ws.setDemo({ historyCoverageFrom: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Complete</option>
            <option value="4">Unavailable before revision 4</option>
            <option value="6">Unavailable before revision 6</option>
          </select>
        </label>
      </div>
      <div className="cf-demo__group">
        <strong>Story</strong>
        <div className="cf-demo__row">
          <button className="cf-btn cf-btn--sm" onClick={ws.reset}>
            Reset demo
          </button>
          <button className="cf-btn cf-btn--sm" onClick={() => nav.contact(CONTACT_IDS.lina)}>
            Go to Lina
          </button>
          <button className="cf-btn cf-btn--sm" onClick={() => nav.activity({ actor: 'bruno', family: 'phone' })}>
            Bruno · phones
          </button>
        </div>
      </div>
    </div>
  );
}

export function CasefileToasts() {
  const ws = useWorkspace();
  if (!ws.toasts.length) return null;
  return (
    <div className="cf-toasts" aria-live="polite">
      {ws.toasts.map((t) => (
        <div key={t.id} className={`cf-toast cf-toast--${t.kind}`} role="status">
          <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : t.kind === 'warning' ? 'users' : 'info'} size={16} />
          <span>{t.text}</span>
          <button className="cf-btn cf-btn--subtle cf-btn--icon cf-btn--sm" onClick={() => ws.dismissToast(t.id)} aria-label="Dismiss">
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
