// Frontend adapter. Methods marked `implemented` mirror routes that exist at checkpoint
// 7212a4c (docs/contact-http-api.md). Methods marked `proposed` are integration seams
// with no production endpoint; they run against the local simulated server only.
import type { Command, ContactState, Problem, SaveResult } from './model';
import { isProblem } from './model';
import type { Persona } from './personas';
import { problem, type ActivityFilters, type ActivityItem, type ContactSummary, type DirectoryRead, type RevisionRead, type SimServer } from './server';
import { Store } from './store';

export type Contract = 'implemented' | 'proposed' | 'local';
export type SaveOutcomeOverride = 'ok' | 'uncertain-committed' | 'uncertain-lost' | 'storage' | 'slow';

export interface RequestLogEntry {
  id: number; at: string; method: string; path: string; status: number; contract: Contract; note: string | null; ms: number;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
let seq = 0;

export class ContactApiClient {
  readonly log = new Store<RequestLogEntry[]>([]);
  latencyMs = 220;
  nextSaveOutcome: SaveOutcomeOverride = 'ok';

  constructor(private readonly server: SimServer) {}

  private record(method: string, path: string, status: number, contract: Contract, note: string | null, ms: number): void {
    const entry: RequestLogEntry = { id: ++seq, at: new Date().toISOString(), method, path, status, contract, note, ms };
    this.log.set(prev => [entry, ...prev].slice(0, 40));
  }

  private async simulate<T>(method: string, path: string, contract: Contract, fn: () => T | Problem, note: string | null = null, extraLatency = 0): Promise<T | Problem> {
    const started = performance.now();
    await sleep(this.latencyMs + extraLatency);
    const result = fn();
    this.record(method, path, isProblem(result) ? result.status : 200, contract, note, Math.round(performance.now() - started));
    return result;
  }

  // ---- implemented contract ------------------------------------------------------
  getCurrent(key: string, persona: Persona): Promise<ContactState | Problem> {
    return this.simulate('GET', `/api/contacts/${short(key)}`, 'implemented', () => this.server.getCurrent(key, persona));
  }
  getRevision(key: string, version: number, compare: number | null, persona: Persona): Promise<RevisionRead | Problem> {
    const qs = compare !== null ? `?compareEntityVersion=${compare}` : '';
    return this.simulate('GET', `/api/contacts/${short(key)}/revisions/${version}${qs}`, 'implemented', () => this.server.getRevision(key, version, compare, persona));
  }
  getDirectory(key: string, persona: Persona): Promise<DirectoryRead | Problem> {
    return this.simulate('GET', `/api/contacts/${short(key)}/directory`, 'implemented', () => this.server.getDirectory(key, persona));
  }
  async save(key: string, expectedEntityVersion: number, commands: Command[], persona: Persona, summary?: string | null): Promise<SaveResult | Problem> {
    const outcome = this.nextSaveOutcome;
    this.nextSaveOutcome = 'ok';
    const path = `/api/contacts/${short(key)}/save`;
    if (outcome === 'storage') {
      return this.simulate('POST', path, 'implemented', () => problem(500, 'storage', 'Storage failure', 'The server reported a storage failure before commit. Nothing was saved.'), 'demo: forced storage failure');
    }
    if (outcome === 'uncertain-committed' || outcome === 'uncertain-lost') {
      return this.simulate('POST', path, 'implemented', () => {
        if (outcome === 'uncertain-committed') {
          const r = this.server.save(key, expectedEntityVersion, commands, persona, { summary });
          if (isProblem(r)) return r; // a real rejection is still a definite answer
        }
        return problem(500, 'commit_uncertain', 'Commit outcome unknown', 'The server did not acknowledge the commit. It may or may not have succeeded; no durable recovery receipt exists yet. Do not resend blindly: check the current revision first.');
      }, outcome === 'uncertain-committed' ? 'demo: acknowledgement lost after commit' : 'demo: request lost before commit', 900);
    }
    return this.simulate('POST', path, 'implemented', () => this.server.save(key, expectedEntityVersion, commands, persona, { summary }), null, outcome === 'slow' ? 2500 : 0);
  }

  // ---- proposed capabilities -------------------------------------------------------
  listActivity(filters: ActivityFilters, persona: Persona): Promise<ActivityItem[] | Problem> {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
    return this.simulate('GET', `/api/tenant/activity${qs ? '?' + qs : ''}`, 'proposed', () => this.server.listActivity(filters, persona), 'proposed: tenant audit explorer');
  }
  getUnit(id: string, persona: Persona) {
    return this.simulate('GET', `/api/tenant/activity/units/${id}`, 'proposed', () => this.server.getUnit(id, persona), 'proposed: audit unit detail');
  }
  listContacts(persona: Persona, q = ''): Promise<ContactSummary[] | Problem> {
    return this.simulate('GET', `/api/contacts?search=${encodeURIComponent(q)}`, 'proposed', () => {
      const all = this.server.listContacts(persona);
      const needle = q.trim().toLowerCase();
      return needle ? all.filter(c => c.displayName.toLowerCase().includes(needle) || c.slug.includes(needle)) : all;
    }, 'proposed: paginated listing/search');
  }
}

function short(key: string): string { return key.length > 12 ? key.slice(0, 8) + '…' : key; }
