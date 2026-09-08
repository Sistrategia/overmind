// Per-variant workspace: simulated server, API adapter, presence bus, per-tab session,
// local drafts and the sidekick engine. Variants render on top of this; they share
// behaviour, not layout.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ContactApiClient, type SaveOutcomeOverride } from './adapter';
import { CollabBus, tabIdentity, type PresenceInfo } from './collab';
import type { Draft } from './draft';
import { TENANT } from './fixtures';
import type { ContactState, Problem } from './model';
import { isProblem } from './model';
import { actorShort, personaByKey, type Persona } from './personas';
import { SimServer, type ActivityFilters, type ActivityItem, type ContactSummary, type DirectoryRead, type RevisionRead } from './server';
import { SidekickEngine } from './sidekick';
import { Store, useStore } from './store';

export type VariantId = 'desk' | 'console' | 'strata';
export const VARIANTS: { id: VariantId; name: string; thesis: string; tagline: string }[] = [
  { id: 'desk', name: 'Desk', tagline: 'A focused record workspace with an evidence rail',
    thesis: 'Everyday work happens on one dense record page. Rows edit in place, pending changes gather in a tray and save together, and the evidence rail lets you step into any revision without leaving the record.' },
  { id: 'console', name: 'Console', tagline: 'A keyboard-first command console',
    thesis: 'One command line drives everything: filters, navigation, and edits staged as an explicit ordered command stack that mirrors the Save request. The sidekick lives inside the same line, so a typed sentence and a typed command are the same gesture.' },
  { id: 'strata', name: 'Strata', tagline: 'A time-axis workspace where the draft is a future revision',
    thesis: 'The contact is read along a revision axis. Any point can be inspected read-only, two points compare side by side with the actions between them, and your unsaved draft appears as a provisional next revision whose diff you see before you commit.' }
];

export interface Toast { id: number; kind: 'info' | 'success' | 'warning' | 'error'; text: string; at: number }

export interface SessionState {
  persona: Persona;
  tabId: string;
  peers: PresenceInfo[];
  dataVersion: number;
  toasts: Toast[];
  latencyMs: number;
  nextSaveOutcome: SaveOutcomeOverride;
  lastRemoteCommit: { contactKey: string; entityVersion: number; actorKey: string; unitId: string; at: number } | null;
  sidekickOpen: boolean;
  demoOpen: boolean;
}

let toastSeq = 0;

export class Workspace {
  readonly ns: string;
  readonly server: SimServer;
  readonly api: ContactApiClient;
  bus: CollabBus | null = null;
  readonly session: Store<SessionState>;
  readonly drafts: Store<Record<string, Draft>>;
  readonly sidekick: SidekickEngine;
  private disposers: (() => void)[] = [];

  constructor(readonly variant: VariantId) {
    this.ns = `overmind-cc-a:${variant}:${TENANT.key.slice(0, 8)}`;
    this.server = new SimServer(this.ns);
    this.api = new ContactApiClient(this.server);
    this.sidekick = new SidekickEngine(this.server);
    const tabId = tabIdentity(this.ns);
    const persona = personaByKey(readSession(`${this.ns}:persona`) ?? 'mariana');
    this.session = new Store<SessionState>({
      persona, tabId, peers: [], dataVersion: 0, toasts: [], latencyMs: this.api.latencyMs, nextSaveOutcome: 'ok', lastRemoteCommit: null, sidekickOpen: false, demoOpen: false
    });
    this.drafts = new Store<Record<string, Draft>>(readJson(`${this.ns}:drafts`) ?? {});
  }

  /** Side effects live here so React StrictMode's mount/unmount/mount cycle can re-open them. */
  connect(): void {
    if (this.bus) return;
    const { tabId, persona } = this.session.get();
    this.bus = new CollabBus(this.ns, tabId, persona.key);
    this.bus.update({ personaKey: persona.key });

    this.disposers.push(this.bus.presence.on(peers => this.session.set({ peers })));
    this.disposers.push(this.bus.messages.on(msg => {
      if (msg.type === 'committed') {
        this.server.reload();
        this.session.set(s => ({ ...s, dataVersion: s.dataVersion + 1, lastRemoteCommit: { contactKey: msg.contactKey, entityVersion: msg.entityVersion, actorKey: msg.actorKey, unitId: msg.unitId, at: Date.now() } }));
        const name = this.server.summary(msg.contactKey)?.displayName ?? 'a contact';
        this.toast('info', `${actorShort(msg.actorKey)} saved revision ${msg.entityVersion} of ${name} in another tab.`);
      } else if (msg.type === 'reset') {
        this.server.reload();
        this.drafts.set(() => ({}));
        persistJson(`${this.ns}:drafts`, {});
        this.session.set(s => ({ ...s, dataVersion: s.dataVersion + 1, lastRemoteCommit: null }));
        this.toast('warning', 'Demo data was reset from another tab.');
      } else if (msg.type === 'operational') {
        this.server.reload();
        this.bump();
      }
    }));
    this.disposers.push(this.server.changed.on(kind => {
      if (kind === 'committed') {
        const last = this.server.allUnits().at(-1);
        if (last) this.bus?.post({ type: 'committed', contactKey: last.contactKey, entityVersion: last.entityVersion, unitId: last.id, actorKey: last.actorKey });
      } else if (kind === 'reset') {
        this.bus?.post({ type: 'reset' });
      } else if (kind === 'operational') {
        this.bus?.post({ type: 'operational' });
      }
      this.bump();
    }));
  }

  disconnect(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.bus?.close();
    this.bus = null;
    this.session.set({ peers: [] });
  }

  bump(): void { this.session.set(s => ({ ...s, dataVersion: s.dataVersion + 1 })); }

  toast(kind: Toast['kind'], text: string): void {
    const id = ++toastSeq;
    this.session.set(s => ({ ...s, toasts: [...s.toasts, { id, kind, text, at: Date.now() }].slice(-4) }));
    window.setTimeout(() => this.dismissToast(id), kind === 'error' ? 12000 : 6000);
  }
  dismissToast(id: number): void { this.session.set(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) })); }

  setPersona(key: string): void {
    const persona = personaByKey(key);
    writeSession(`${this.ns}:persona`, persona.key);
    this.session.set({ persona });
    this.bus?.update({ personaKey: persona.key });
    this.bump();
  }

  setLatency(ms: number): void { this.api.latencyMs = ms; this.session.set({ latencyMs: ms }); }
  setNextSaveOutcome(o: SaveOutcomeOverride): void { this.api.nextSaveOutcome = o; this.session.set({ nextSaveOutcome: o }); }
  consumeSaveOutcome(): void { this.session.set({ nextSaveOutcome: 'ok' }); }

  draftFor(contactKey: string): Draft | null { return this.drafts.get()[contactKey] ?? null; }
  setDraft(contactKey: string, draft: Draft | null): void {
    this.drafts.set(prev => {
      const next = { ...prev };
      if (draft && draft.items.length) next[contactKey] = draft; else delete next[contactKey];
      persistJson(`${this.ns}:drafts`, next);
      return next;
    });
    const count = draft?.items.length ?? 0;
    this.bus?.update({ contactKey, editing: count > 0, draftCount: count });
  }

  presence(contactKey: string | null, area: string | null, editing?: boolean): void {
    const draft = contactKey ? this.draftFor(contactKey) : null;
    this.bus?.update({ contactKey, area, editing: editing ?? !!(draft && draft.items.length), draftCount: draft?.items.length ?? 0 });
  }

  /** Demo control: perform a Save as Bruno directly against the shared server. */
  simulateBruno(contactKey: string, scenario: 'relabel' | 'extension' | 'email'): { ok: boolean; message: string } {
    const bruno = personaByKey('bruno');
    const cur = this.server.getCurrent(contactKey, bruno);
    if (isProblem(cur)) return { ok: false, message: cur.detail };
    const office = cur.phones.find(p => !p.deleted && p.extension) ?? cur.phones.find(p => !p.deleted);
    let result;
    if (scenario === 'email') {
      result = this.server.save(contactKey, cur.entityVersion, [{ kind: 'email.insert', value: `assistant.${Date.now().toString(36).slice(-4)}@vertice-demo.mx`, location: 'Assistant', isPublic: false }], bruno, { summary: 'Added an assistant email (simulated Bruno)' });
    } else if (!office) {
      return { ok: false, message: 'No phone to change.' };
    } else if (scenario === 'relabel') {
      const label = office.location === 'Oficina' ? 'Office' : 'Oficina';
      result = this.server.save(contactKey, cur.entityVersion, [{ kind: 'phone.replace', ordinal: office.ordinal, value: { number: office.value.e164 }, location: label, isPublic: office.isPublic, extension: office.extension }], bruno, { summary: `Relabelled the ${office.location ?? 'office'} phone to ${label} (simulated Bruno)` });
    } else {
      const ext = office.extension === '30' ? '31' : '30';
      result = this.server.save(contactKey, cur.entityVersion, [{ kind: 'phone.replace', ordinal: office.ordinal, value: { number: office.value.e164 }, location: office.location, isPublic: office.isPublic, extension: ext }], bruno, { summary: `Changed the ${office.location ?? 'office'} phone extension to ${ext} (simulated Bruno)` });
    }
    if (isProblem(result)) return { ok: false, message: result.detail };
    return { ok: true, message: `Bruno saved revision ${result.entityVersion}.` };
  }

  reset(): void {
    this.server.reset();
    this.drafts.set(() => ({}));
    persistJson(`${this.ns}:drafts`, {});
    this.api.nextSaveOutcome = 'ok';
    this.session.set(s => ({ ...s, nextSaveOutcome: 'ok', lastRemoteCommit: null }));
    this.toast('success', 'Demo data reset to the initial story.');
  }

  dispose(): void { this.disconnect(); }
}

function readSession(key: string): string | null { try { return sessionStorage.getItem(key); } catch { return null; } }
function writeSession(key: string, value: string): void { try { sessionStorage.setItem(key, value); } catch { /* ignore */ } }
function readJson<T>(key: string): T | null { try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; } }
function persistJson(key: string, value: unknown): void { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }

// ---- React bindings ------------------------------------------------------------------

export const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace(): Workspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error('Workspace missing');
  return ws;
}
export function useSession(): SessionState { return useStore(useWorkspace().session); }
export function useDraft(contactKey: string | null): Draft | null {
  const ws = useWorkspace();
  const all = useStore(ws.drafts);
  return contactKey ? all[contactKey] ?? null : null;
}

export interface AsyncState<T> { data: T | null; problem: Problem | null; loading: boolean; reload: () => void }

export function useAsync<T>(fn: (() => Promise<T | Problem>) | null, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; problem: Problem | null; loading: boolean }>({ data: null, problem: null, loading: !!fn });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!fn) { setState({ data: null, problem: null, loading: false }); return; }
    let alive = true;
    setState(s => ({ ...s, loading: true }));
    fn().then(r => {
      if (!alive) return;
      if (isProblem(r)) setState({ data: null, problem: r, loading: false });
      else setState({ data: r, problem: null, loading: false });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  // A request that exists but has neither data nor a problem yet is loading, even before the effect runs.
  const loading = !!fn && (state.loading || (state.data === null && state.problem === null));
  return useMemo(() => ({ data: fn ? state.data : null, problem: fn ? state.problem : null, loading, reload: () => setTick(t => t + 1) }), [state, loading, fn === null]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useContact(contactKey: string | null): AsyncState<ContactState> {
  const ws = useWorkspace();
  const { persona, dataVersion } = useSession();
  return useAsync<ContactState>(contactKey ? () => ws.api.getCurrent(contactKey, persona) : null, [contactKey, persona.key, dataVersion]);
}
export function useDirectory(contactKey: string | null, enabled = true): AsyncState<DirectoryRead> {
  const ws = useWorkspace();
  const { persona, dataVersion } = useSession();
  return useAsync<DirectoryRead>(contactKey && enabled ? () => ws.api.getDirectory(contactKey, persona) : null, [contactKey, persona.key, dataVersion, enabled]);
}
export function useRevision(contactKey: string | null, revision: number | null, compare: number | null): AsyncState<RevisionRead> {
  const ws = useWorkspace();
  const { persona, dataVersion } = useSession();
  return useAsync<RevisionRead>(contactKey && revision ? () => ws.api.getRevision(contactKey, revision, compare, persona) : null, [contactKey, revision, compare, persona.key, dataVersion]);
}
export function useActivity(filters: ActivityFilters, enabled = true): AsyncState<ActivityItem[]> {
  const ws = useWorkspace();
  const { persona, dataVersion } = useSession();
  const key = JSON.stringify(filters);
  return useAsync<ActivityItem[]>(enabled ? () => ws.api.listActivity(filters, persona) : null, [key, persona.key, dataVersion, enabled]);
}
export function useContacts(q = ''): AsyncState<ContactSummary[]> {
  const ws = useWorkspace();
  const { persona, dataVersion } = useSession();
  return useAsync<ContactSummary[]>(() => ws.api.listContacts(persona, q), [q, persona.key, dataVersion]);
}
