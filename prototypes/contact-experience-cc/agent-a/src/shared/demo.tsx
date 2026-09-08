// Demo drawer: reviewer controls kept apart from the product interface. Every control here
// is simulation plumbing (persona-as-claims, latency, forced outcomes, a stand-in Bruno).
import { useState } from 'react';
import type { SaveOutcomeOverride } from '../core/adapter';
import { fmtDateTime, fmtWeekday, TENANT_TZ_LABEL } from '../core/format';
import { PERSONAS } from '../core/personas';
import { useStore } from '../core/store';
import { useSession, useWorkspace } from '../core/workspace';
import { Badge, ThemeToggle } from './ui';

const OUTCOMES: { value: SaveOutcomeOverride; label: string; hint: string }[] = [
  { value: 'ok', label: 'Normal', hint: 'Server answers normally.' },
  { value: 'slow', label: 'Slow network', hint: 'Adds 2.5 s so pending state is visible.' },
  { value: 'uncertain-committed', label: 'Uncertain (did commit)', hint: 'Commit succeeds, acknowledgement is lost.' },
  { value: 'uncertain-lost', label: 'Uncertain (did not commit)', hint: 'Request lost before commit; same client-side symptom.' },
  { value: 'storage', label: 'Storage failure', hint: 'Definite 500/storage; nothing saved.' }
];

export function DemoDrawer({ contactKey }: { contactKey: string | null }) {
  const ws = useWorkspace();
  const s = useSession();
  const log = useStore(ws.api.log);
  const [msg, setMsg] = useState<string | null>(null);
  const flags = ws.server.demoFlags();
  const open = s.demoOpen;
  const set = (patch: Partial<typeof s>) => ws.session.set(patch);

  const bruno = (scenario: 'relabel' | 'extension' | 'email') => {
    if (!contactKey) { setMsg('Open a contact first.'); return; }
    const r = ws.simulateBruno(contactKey, scenario);
    setMsg(r.message);
  };

  return (
    <>
      <button className="demo-toggle" onClick={() => set({ demoOpen: !open })} aria-expanded={open} aria-controls="demo-drawer" data-testid="demo-toggle">
        <span aria-hidden="true">⚙</span> Demo controls
      </button>
      {open && (
        <aside className="demo-drawer" id="demo-drawer" aria-label="Demo controls">
          <header>
            <strong>Demo controls</strong>
            <Badge tone="warn">simulated</Badge>
            <span className="grow" />
            <button className="btn quiet icon sm" onClick={() => set({ demoOpen: false })} aria-label="Close demo controls">✕</button>
          </header>
          <div className="body">
            <section>
              <h4>Persona (stands in for signed claims)</h4>
              <select className="select" value={s.persona.key} onChange={e => ws.setPersona(e.target.value)} data-testid="persona-select" aria-label="Persona">
                {PERSONAS.map(p => <option key={p.key} value={p.key}>{p.name} — {p.role}</option>)}
              </select>
              <p className="small muted">{s.persona.blurb}</p>
              <p className="tiny faint">Grants: {s.persona.grants.join(', ')}. Tab {s.tabId}.</p>
            </section>
            <section>
              <h4>Appearance</h4>
              <div className="row"><ThemeToggle /><span className="small muted">Light is the default; your choice persists.</span></div>
            </section>
            <section>
              <h4>Network and outcomes</h4>
              <div className="row">
                <label className="small muted" htmlFor="demo-latency">Latency</label>
                <select id="demo-latency" className="select" style={{ width: 120 }} value={s.latencyMs} onChange={e => ws.setLatency(Number(e.target.value))}>
                  <option value={0}>0 ms</option><option value={220}>220 ms</option><option value={1500}>1.5 s</option>
                </select>
              </div>
              <label className="small muted" htmlFor="demo-outcome">Next Save outcome</label>
              <select id="demo-outcome" className="select" value={s.nextSaveOutcome} onChange={e => ws.setNextSaveOutcome(e.target.value as SaveOutcomeOverride)} data-testid="save-outcome-select">
                {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="tiny faint">{OUTCOMES.find(o => o.value === s.nextSaveOutcome)?.hint} Applies to the next Save from this tab only.</p>
            </section>
            <section>
              <h4>Collaboration</h4>
              <div className="grid2">
                <button className="btn sm" onClick={() => bruno('relabel')} data-testid="simulate-bruno-relabel">Bruno relabels the office phone</button>
                <button className="btn sm" onClick={() => bruno('extension')} data-testid="simulate-bruno-extension">Bruno changes the extension</button>
                <button className="btn sm" onClick={() => bruno('email')} data-testid="simulate-bruno-email">Bruno adds an email</button>
                <button className="btn sm" onClick={() => window.open(location.href, '_blank', 'noopener')} data-testid="open-second-tab">Open a second tab</button>
              </div>
              {msg && <p className="small" role="status">{msg}</p>}
              <p className="tiny faint">Tabs share one simulated server (this browser's storage) over BroadcastChannel. Presence is awareness, not a lock. This proves local prototype interaction, not deployed infrastructure.</p>
              <p className="tiny faint">Peers now: {s.peers.length ? s.peers.map(p => `${PERSONAS.find(x => x.key === p.personaKey)?.shortName ?? p.personaKey} (${p.editing ? 'editing' : 'viewing'})`).join(', ') : 'none'}.</p>
            </section>
            <section>
              <h4>History coverage</h4>
              <label className="check"><input type="checkbox" checked={flags.historyUnavailableBelow > 1} onChange={e => ws.server.setHistoryUnavailableBelow(e.target.checked ? 2 : 0)} data-testid="history-unavailable" /> Simulate missing coverage before revision 2</label>
              <p className="tiny faint">Revision 1 then answers 409/history_unavailable instead of borrowing current values.</p>
            </section>
            <section>
              <h4>Story</h4>
              <div className="row">
                <button className="btn sm danger" onClick={() => ws.reset()} data-testid="demo-reset">Reset demo data</button>
                <span className="tiny faint">Restores the seeded story for this variant only.</span>
              </div>
              <p className="tiny faint">Demo clock: {fmtWeekday(ws.server.now())} {fmtDateTime(ws.server.now())} {TENANT_TZ_LABEL}, advancing in real time.</p>
            </section>
            <section>
              <h4>API trace (simulated requests)</h4>
              <div className="reqlog" data-testid="request-log">
                {log.length === 0 && <span className="faint">No requests yet.</span>}
                {log.map(r => (
                  <div className="r" key={r.id} title={r.note ?? ''}>
                    <span>{r.method}</span>
                    <span className={`st ${r.status < 300 ? 'ok' : r.status < 500 ? 'warn' : 'bad'}`}>{r.status}</span>
                    <span className={r.contract === 'proposed' ? 'prop' : ''}>{r.path}{r.contract === 'proposed' ? ' · proposed' : ''}{r.note?.startsWith('demo') ? ' · demo' : ''}</span>
                  </div>
                ))}
              </div>
              <p className="tiny faint">Paths marked <span className="prop">proposed</span> have no production endpoint yet; they document the integration seam.</p>
            </section>
          </div>
        </aside>
      )}
    </>
  );
}
