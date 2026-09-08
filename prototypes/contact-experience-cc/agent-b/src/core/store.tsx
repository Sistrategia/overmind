// Workspace provider: shared state/behavior for one variant instance (one tab).
// Committed state lives in the simulated server (localStorage, shared across tabs).
// Drafts, persona, demo settings and the sidekick transcript are per tab.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type {
  ActivityFilters,
  AuditUnit,
  Command,
  ContactId,
  ContactState,
  Diff,
  Draft,
  PendingChange,
  Persona,
  PersonaId,
  PhoneValue,
  PresenceEntry,
  Problem,
  Revision,
  SaveResult,
  Tenant,
  ThreadNote,
  VariantId,
} from './types';
import { ProblemError } from './types';
import { LocalServer, type SaveOutcome } from './server';
import { createCollab } from './collab';
import { BRUNO_REV4_COMMANDS, BRUNO_REV4_SUMMARY, CONTACT_IDS, PERSONAS, personaById, TENANT, TODAY } from './fixtures';
import { hasGrant, hasProposed, type Permission, type ProposedCapability } from './permissions';
import { deriveCommands, pendingOf, updateChild, moveChild } from './draft';
import { applyCommands, cloneState } from './engine';
import { changedPaths, diffStates } from './diff';
import { askSidekick, type SidekickAction, type SidekickContext, type SidekickReply } from './sidekick';
import { liveChildren, categoryOf, displayNameOf, familyKey } from './format';
import { phoneToInput } from './phone';
import { queryActivity } from './activity';
import type { Family } from './types';

export type Theme = 'light' | 'dark';

export interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'noop' | 'error' | 'conflict' | 'uncertain';
  result?: SaveResult;
  problem?: Problem;
  at?: number;
}

export interface ConflictInfo {
  base: Revision;
  theirs: Revision;
  diffTheirs: Diff;
  mine: PendingChange[];
  mineDiff: Diff;
  overlaps: string[];
  problem: Problem | null;
}

export interface IncomingInfo {
  entityVersion: number;
  actorId: PersonaId;
  summary: string;
  at: string;
}

export interface DemoSettings {
  nextOutcome: SaveOutcome;
  slow: boolean;
  historyCoverageFrom: number | null;
  loading: boolean;
}

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

export interface ContactSummary {
  id: ContactId;
  name: string;
  category: 'Person' | 'Organization';
  revision: Revision;
  projection: 'detail' | 'directory';
  primaryEmail: string | null;
  primaryPhone: string | null;
}

export interface UncertainCheck {
  committed: boolean;
  latest: Revision;
  message: string;
}

export interface Workspace {
  variant: VariantId;
  tenant: Tenant;
  personas: Persona[];
  persona: Persona;
  setPersona(id: PersonaId): void;
  theme: Theme;
  setTheme(theme: Theme): void;
  tick: number;
  server: LocalServer;
  story: 'full' | 'rehearsal';
  contacts: ContactSummary[];
  latest(contactId: ContactId): Revision | null;
  revisions(contactId: ContactId): Revision[];
  can(permission: Permission, contactId?: ContactId): boolean;
  canProposed(capability: ProposedCapability): boolean;
  // draft
  draft: Draft | null;
  pending: PendingChange[];
  draftError: string | null;
  beginDraft(contactId: ContactId): Draft | null;
  updateWorking(fn: (working: ContactState) => ContactState): void;
  moveWorking(family: Family, ordinal: number, position: number): string | null;
  revertPath(path: string): void;
  discardDraft(): void;
  save(): Promise<void>;
  saveState: SaveState;
  clearSaveState(): void;
  checkUncertain(): UncertainCheck | null;
  acceptUncertain(): void;
  // conflict
  incoming: IncomingInfo | null;
  conflict: ConflictInfo | null;
  openReconcile(): void;
  resolveConflict(mode: 'rebase' | 'discard'): void;
  // sidekick
  ask(query: string, extra: Partial<SidekickContext>): SidekickReply;
  stageProposal(action: Extract<SidekickAction, { kind: 'proposal' }>): { ok: boolean; message: string };
  // presence (proposed)
  presence: PresenceEntry[];
  setPresence(contactId: ContactId | null, section: string | null, editing: boolean): void;
  tabId: string;
  // activity (proposed)
  activity(filters: ActivityFilters): AuditUnit[] | null;
  unit(stamp: string): AuditUnit | null;
  // notes (proposed, prototype-local)
  notes(contactId: ContactId): ThreadNote[];
  postNote(contactId: ContactId, text: string, ref: ThreadNote['ref']): void;
  // demo controls (not product UI)
  demo: DemoSettings;
  setDemo(patch: Partial<DemoSettings>): void;
  simulateBrunoUpdate(): void;
  rewindToRehearsal(): void;
  reset(): void;
  // toasts
  toasts: Toast[];
  notify(text: string, kind?: Toast['kind']): void;
  dismissToast(id: number): void;
  today: string;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error('useWorkspace outside WorkspaceProvider');
  return ws;
}

const DEMO_DEFAULTS: DemoSettings = { nextOutcome: 'ok', slow: false, historyCoverageFrom: null, loading: false };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let toastCounter = 0;

export function WorkspaceProvider({ variant, children }: { variant: VariantId; children: React.ReactNode }) {
  const server = useMemo(() => new LocalServer(variant), [variant]);
  const collab = useMemo(() => createCollab(variant, TENANT.id), [variant]);
  const [tick, bump] = useReducer((x: number) => x + 1, 0);

  const [personaId, setPersonaIdState] = useState<PersonaId>(() => {
    try {
      const v = sessionStorage.getItem(`omb:v1:${variant}:persona`) as PersonaId | null;
      return v && PERSONAS.some((p) => p.id === v) ? v : 'mariana';
    } catch {
      return 'mariana';
    }
  });
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return localStorage.getItem(`omb:v1:${variant}:theme`) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [incoming, setIncoming] = useState<IncomingInfo | null>(null);
  const [presence, setPresenceList] = useState<PresenceEntry[]>([]);
  const myPresence = useRef<{ contactId: ContactId | null; section: string | null; editing: boolean }>({ contactId: null, section: null, editing: false });
  const [demo, setDemoState] = useState<DemoSettings>(DEMO_DEFAULTS);
  const demoRef = useRef(demo);
  demoRef.current = demo;
  const [toasts, setToasts] = useState<Toast[]>([]);

  const persona = useMemo(() => personaById(personaId), [personaId]);
  const personaRef = useRef(persona);
  personaRef.current = persona;

  const notify = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastCounter;
    setToasts((t) => [...t, { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 9000 : 5000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // ---- theme ----
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(`omb:v1:${variant}:theme`, theme);
    } catch {
      /* ignore */
    }
  }, [theme, variant]);
  useEffect(() => () => {
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
  }, []);

  // ---- persona ----
  const setPersona = useCallback(
    (id: PersonaId) => {
      if (id === personaRef.current.id) return;
      setPersonaIdState(id);
      try {
        sessionStorage.setItem(`omb:v1:${variant}:persona`, id);
      } catch {
        /* ignore */
      }
      if (draftRef.current) notify('Unsaved draft discarded because the persona changed.', 'warning');
      setDraft(null);
      setConflict(null);
      setIncoming(null);
      setSaveState({ status: 'idle' });
    },
    [variant, notify],
  );

  // ---- server subscriptions ----
  useEffect(() => server.subscribe(bump), [server]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === server.key) server.refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [server]);

  const postPresence = useCallback(() => {
    const p = myPresence.current;
    collab.post({ type: 'presence', entry: { tabId: collab.tabId, personaId: personaRef.current.id, contactId: p.contactId, section: p.section, editing: p.editing, at: Date.now() } });
  }, [collab]);

  useEffect(() => {
    collab.open();
    const unsub = collab.subscribe((m) => {
      if (m.type === 'committed') {
        server.refresh();
        const d = draftRef.current;
        const name = server.contactName(m.contactId);
        if (d && d.contactId === m.contactId && m.entityVersion > d.baseVersion) {
          const rev = server.latest(m.contactId);
          setIncoming({ entityVersion: m.entityVersion, actorId: m.actorId, summary: rev?.summary ?? '', at: rev?.at ?? new Date().toISOString() });
          notify(`${personaById(m.actorId).name} saved revision ${m.entityVersion} of ${name} while you are editing revision ${d.baseVersion}. Your draft is kept.`, 'warning');
        } else {
          notify(`${personaById(m.actorId).name} saved revision ${m.entityVersion} of ${name}.`, 'info');
        }
      } else if (m.type === 'presence') {
        setPresenceList((list) => [...list.filter((e) => e.tabId !== m.entry.tabId), m.entry]);
      } else if (m.type === 'bye') {
        setPresenceList((list) => list.filter((e) => e.tabId !== m.tabId));
      } else if (m.type === 'hello') {
        postPresence();
      } else if (m.type === 'reset') {
        server.refresh();
        setDraft(null);
        setConflict(null);
        setIncoming(null);
        setSaveState({ status: 'idle' });
        notify(m.story === 'rehearsal' ? 'Another tab rewound the story to the conflict rehearsal.' : 'Another tab reset the demo.', 'info');
      } else if (m.type === 'note') {
        server.refresh();
      }
    });
    collab.post({ type: 'hello' });
    postPresence();
    const heartbeat = window.setInterval(postPresence, 4000);
    const sweep = window.setInterval(() => {
      const cutoff = Date.now() - 12000;
      setPresenceList((list) => (list.some((e) => e.at < cutoff) ? list.filter((e) => e.at >= cutoff) : list));
    }, 3000);
    const onUnload = () => collab.close();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      unsub();
      window.clearInterval(heartbeat);
      window.clearInterval(sweep);
      window.removeEventListener('beforeunload', onUnload);
      collab.close();
    };
  }, [collab, server, notify, postPresence]);

  useEffect(() => {
    postPresence();
  }, [personaId, postPresence]);

  const setPresence = useCallback(
    (contactId: ContactId | null, section: string | null, editing: boolean) => {
      const p = myPresence.current;
      if (p.contactId === contactId && p.section === section && p.editing === editing) return;
      myPresence.current = { contactId, section, editing };
      postPresence();
    },
    [postPresence],
  );

  // ---- permissions ----
  const can = useCallback((permission: Permission, contactId?: ContactId) => hasGrant(persona, permission, contactId), [persona]);
  const canProposed = useCallback((capability: ProposedCapability) => hasProposed(persona, capability), [persona]);

  // ---- reads ----
  const contacts = useMemo<ContactSummary[]>(() => {
    void tick;
    return server
      .contactIds()
      .map((id) => {
        const revision = server.latest(id)!;
        const projection = hasGrant(persona, 'read_detail', id) ? 'detail' : hasGrant(persona, 'read_directory', id) ? 'directory' : null;
        if (!projection) return null;
        const state = revision.state;
        const emails = liveChildren(state.emails).filter((e) => projection === 'detail' || e.isPublic);
        const phones = liveChildren(state.phones).filter((p) => projection === 'detail' || p.isPublic);
        return {
          id,
          name: displayNameOf(state),
          category: categoryOf(state),
          revision,
          projection,
          primaryEmail: emails[0]?.value ?? null,
          primaryPhone: phones[0] ? (phones[0].value as PhoneValue).international : null,
        } as ContactSummary;
      })
      .filter((c): c is ContactSummary => !!c);
  }, [server, persona, tick]);

  const latest = useCallback((contactId: ContactId) => server.latest(contactId), [server]);
  const revisions = useCallback((contactId: ContactId) => server.revisions(contactId), [server]);

  // ---- draft ----
  const pendingInfo = useMemo(() => (draft ? pendingOf(draft) : { pending: [], error: null }), [draft]);

  const beginDraft = useCallback(
    (contactId: ContactId): Draft | null => {
      const existing = draftRef.current;
      if (existing && existing.contactId === contactId) return existing;
      if (!hasGrant(personaRef.current, 'edit', contactId)) {
        notify(`${personaRef.current.name} has no edit grant for this contact.`, 'error');
        return null;
      }
      const rev = server.latest(contactId);
      if (!rev) return null;
      const d: Draft = { contactId, baseVersion: rev.entityVersion, base: rev.state, working: cloneState(rev.state), startedAt: new Date().toISOString(), origin: 'user' };
      draftRef.current = d; // visible to synchronous follow-up calls in the same tick
      setDraft(d);
      setConflict(null);
      setIncoming(null);
      setSaveState({ status: 'idle' });
      return d;
    },
    [server, notify],
  );

  const updateWorking = useCallback((fn: (working: ContactState) => ContactState) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, working: fn(d.working) };
      draftRef.current = next;
      return next;
    });
  }, []);

  const moveWorking = useCallback((family: Family, ordinal: number, position: number): string | null => {
    const d = draftRef.current;
    if (!d) return 'No draft.';
    const probe = moveChild(d.working, family, ordinal, position);
    if (probe.error) return probe.error;
    setDraft((prev) => {
      if (!prev) return prev;
      const r = moveChild(prev.working, family, ordinal, position);
      const next = r.error ? prev : { ...prev, working: r.state };
      draftRef.current = next;
      return next;
    });
    return null;
  }, []);

  const revertPath = useCallback((path: string) => {
    const d = draftRef.current;
    if (!d) return;
    const [head, second, third] = path.split('.');
    let working = d.working;
    if (head === 'profile' && second) {
      working = { ...working, profile: { ...working.profile, [second]: (d.base.profile as unknown as Record<string, unknown>)[second] } };
    } else if (head === 'contact') {
      working = { ...working, deleted: d.base.deleted };
    } else if (head && second) {
      const family = head as Family;
      const ordinal = Number(second);
      const baseChild = (d.base[familyKey(family)] as { ordinal: number }[]).find((c) => c.ordinal === ordinal) as Record<string, unknown> | undefined;
      if (baseChild) {
        if (third === 'position') {
          const pos = liveChildren(d.base[familyKey(family)] as { ordinal: number; displayOrder: number; deleted: boolean; value: unknown; location: string | null; isPublic: boolean; extension: string | null }[]).findIndex((c) => c.ordinal === ordinal) + 1;
          const r = moveChild(working, family, ordinal, pos);
          if (!r.error) working = r.state;
        } else if (third === 'value' || third === 'raw' || third === 'title') {
          working = updateChild(working, family, ordinal, { value: baseChild.value });
        } else if (third) {
          working = updateChild(working, family, ordinal, { [third]: baseChild[third] });
        } else {
          working = updateChild(working, family, ordinal, { value: baseChild.value, location: baseChild.location as string | null, isPublic: baseChild.isPublic as boolean, extension: baseChild.extension as string | null, deleted: baseChild.deleted as boolean });
        }
      }
    }
    setDraft({ ...d, working });
  }, []);

  const discardDraft = useCallback(() => {
    setDraft(null);
    setConflict(null);
    setIncoming(null);
    setSaveState({ status: 'idle' });
  }, []);

  const buildConflict = useCallback(
    (d: Draft, problem: Problem | null): ConflictInfo | null => {
      const theirs = server.latest(d.contactId);
      if (!theirs) return null;
      const base = server.revisions(d.contactId).find((r) => r.entityVersion === d.baseVersion) ?? theirs;
      const diffTheirs = diffStates(base.state, theirs.state);
      const mineDiff = diffStates(d.base, d.working);
      const theirPaths = changedPaths(diffTheirs);
      const minePaths = changedPaths(mineDiff);
      const overlaps = minePaths.filter((p) => theirPaths.some((t) => t === p || t.startsWith(`${p}.`) || p.startsWith(`${t}.`)));
      return { base, theirs, diffTheirs, mine: pendingOf(d).pending, mineDiff, overlaps, problem };
    },
    [server],
  );

  const save = useCallback(async () => {
    const d = draftRef.current;
    if (!d) return;
    setSaveState({ status: 'saving' });
    await sleep(demoRef.current.slow ? 1800 : 450);
    let commands: Command[];
    try {
      commands = deriveCommands(d.base, d.working);
    } catch (e) {
      setSaveState({ status: 'error', problem: { status: 400, code: 'validation', title: 'Validation', detail: e instanceof Error ? e.message : String(e), traceId: 'local', automaticRetryAllowed: false } });
      return;
    }
    if (!commands.length) {
      setSaveState({ status: 'noop', at: Date.now() });
      return;
    }
    const outcome = demoRef.current.nextOutcome;
    setDemoState((s) => ({ ...s, nextOutcome: 'ok' }));
    try {
      const result = server.save(personaRef.current, d.contactId, { expectedEntityVersion: d.baseVersion, commands }, outcome);
      if (result.dbrowVersion) {
        collab.post({ type: 'committed', contactId: d.contactId, entityVersion: result.entityVersion, unitStamp: result.dbrowVersion, actorId: personaRef.current.id });
      }
      setDraft(null);
      setIncoming(null);
      setConflict(null);
      setSaveState({ status: 'saved', result, at: Date.now() });
      notify(`Saved together as revision ${result.entityVersion}.`, 'success');
    } catch (e) {
      if (!(e instanceof ProblemError)) throw e;
      const p = e.problem;
      if (p.code === 'conflict') {
        const info = buildConflict(d, p);
        setConflict(info);
        setSaveState({ status: 'conflict', problem: p });
      } else if (p.code === 'commit_uncertain') {
        const l = server.latest(d.contactId);
        if (l) collab.post({ type: 'committed', contactId: d.contactId, entityVersion: l.entityVersion, unitStamp: null, actorId: personaRef.current.id });
        setSaveState({ status: 'uncertain', problem: p });
      } else {
        setSaveState({ status: 'error', problem: p });
      }
    }
  }, [server, collab, notify, buildConflict]);

  const clearSaveState = useCallback(() => setSaveState({ status: 'idle' }), []);

  const checkUncertain = useCallback((): UncertainCheck | null => {
    const d = draftRef.current;
    if (!d) return null;
    server.refresh();
    const l = server.latest(d.contactId);
    if (!l) return null;
    const committed = l.entityVersion > d.baseVersion && l.actorId === personaRef.current.id && Date.now() - new Date(l.at).getTime() < 10 * 60 * 1000;
    return {
      committed,
      latest: l,
      message: committed
        ? `Revision ${l.entityVersion} exists, saved by you at ${new Date(l.at).toLocaleTimeString()} with the same changes. The Save did commit; the acknowledgement was lost.`
        : l.entityVersion === d.baseVersion
          ? `The contact is still at revision ${d.baseVersion}. The Save did not commit; your draft is intact and can be saved again.`
          : `The contact moved to revision ${l.entityVersion} by ${personaById(l.actorId).name}. Your Save did not commit; reconcile before saving again.`,
    };
  }, [server]);

  const acceptUncertain = useCallback(() => {
    const d = draftRef.current;
    const l = d ? server.latest(d.contactId) : null;
    setDraft(null);
    setConflict(null);
    setIncoming(null);
    setSaveState(l ? { status: 'saved', result: { publicKey: l.contactId, entityVersion: l.entityVersion, dbrowVersion: l.unitStamp, childIdentities: [] }, at: Date.now() } : { status: 'idle' });
  }, [server]);

  const openReconcile = useCallback(() => {
    const d = draftRef.current;
    if (!d) return;
    const info = buildConflict(d, null);
    if (info && info.theirs.entityVersion !== d.baseVersion) {
      setConflict(info);
      setSaveState({ status: 'conflict' });
    }
  }, [buildConflict]);

  const resolveConflict = useCallback(
    (mode: 'rebase' | 'discard') => {
      const d = draftRef.current;
      if (mode === 'discard' || !d) {
        discardDraft();
        notify('Draft discarded. The current revision is unchanged.', 'info');
        return;
      }
      const theirs = server.latest(d.contactId);
      if (!theirs) return;
      try {
        const commands = deriveCommands(d.base, d.working);
        const applied = applyCommands(theirs.state, commands, { allocate: 'draft' });
        setDraft({ contactId: d.contactId, baseVersion: theirs.entityVersion, base: theirs.state, working: applied.state, startedAt: d.startedAt, origin: 'reconciled' });
        setConflict(null);
        setIncoming(null);
        setSaveState({ status: 'idle' });
        notify(`Your draft now targets revision ${theirs.entityVersion}. Review the overlapping fields, then Save.`, 'info');
      } catch (e) {
        notify(`Your change cannot be carried onto revision ${theirs.entityVersion}: ${e instanceof Error ? e.message : String(e)} Discard or edit the draft.`, 'error');
      }
    },
    [server, discardDraft, notify],
  );

  // ---- activity (proposed) ----
  const activity = useCallback(
    (filters: ActivityFilters): AuditUnit[] | null => {
      void tick;
      if (!hasProposed(persona, 'read_activity')) return null;
      return queryActivity(server.activity(persona), filters, (id) => server.contactName(id));
    },
    [server, persona, tick],
  );
  const unit = useCallback((stamp: string) => server.unit(stamp), [server]);

  // ---- notes (proposed; prototype-local) ----
  const notes = useCallback(
    (contactId: ContactId) => {
      void tick;
      return server.notes(contactId);
    },
    [server, tick],
  );
  const postNote = useCallback(
    (contactId: ContactId, text: string, ref: ThreadNote['ref']) => {
      const note: ThreadNote = { id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, contactId, personaId: personaRef.current.id, at: new Date().toISOString(), text, ref };
      server.addNote(note);
      collab.post({ type: 'note', contactId });
    },
    [server, collab],
  );

  // ---- sidekick ----
  const ask = useCallback(
    (query: string, extra: Partial<SidekickContext>): SidekickReply => {
      const d = draftRef.current;
      const contactId = extra.contactId ?? d?.contactId ?? null;
      const revs = contactId ? server.revisions(contactId) : [];
      const canActivity = hasProposed(persona, 'read_activity');
      const ctx: SidekickContext = {
        persona,
        contactId,
        contactName: contactId ? server.contactName(contactId) : null,
        revisions: revs,
        selectedRevision: extra.selectedRevision ?? null,
        compareRevision: extra.compareRevision ?? null,
        filters: extra.filters ?? null,
        draft: d && d.contactId === contactId ? { pending: pendingOf(d).pending, baseVersion: d.baseVersion, working: d.working } : null,
        units: canActivity ? server.activity(persona) : [],
        canActivity,
        today: TODAY,
        contacts: server.contactIds().map((id) => ({ id, name: server.contactName(id) })),
        selectedPhoneOrdinal: extra.selectedPhoneOrdinal ?? null,
      };
      return askSidekick(query, ctx);
    },
    [server, persona],
  );

  const stageProposal = useCallback(
    (action: Extract<SidekickAction, { kind: 'proposal' }>): { ok: boolean; message: string } => {
      if (!hasGrant(personaRef.current, 'edit', action.contactId)) return { ok: false, message: 'No edit grant for this contact.' };
      const rev = server.latest(action.contactId);
      if (!rev) return { ok: false, message: 'Contact not found.' };
      const existing = draftRef.current && draftRef.current.contactId === action.contactId ? draftRef.current : null;
      const d: Draft = existing ?? { contactId: action.contactId, baseVersion: rev.entityVersion, base: rev.state, working: cloneState(rev.state), startedAt: new Date().toISOString(), origin: 'sidekick' };
      try {
        const applied = applyCommands(d.working, action.commands, { allocate: 'draft' });
        const next: Draft = { ...d, working: applied.state, origin: existing ? existing.origin : 'sidekick' };
        draftRef.current = next;
        setDraft(next);
        setSaveState({ status: 'idle' });
        server.logAgentProposal(personaRef.current.id, action.contactId, action.commands.length);
        return { ok: true, message: `Staged ${action.commands.length} change${action.commands.length === 1 ? '' : 's'} in your draft.` };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    },
    [server],
  );

  // ---- demo controls ----
  const setDemo = useCallback((patch: Partial<DemoSettings>) => setDemoState((s) => ({ ...s, ...patch })), []);

  const simulateBrunoUpdate = useCallback(() => {
    const bruno = personaById('bruno');
    const lina = CONTACT_IDS.lina;
    server.refresh();
    const l = server.latest(lina);
    if (!l) return;
    let commands: Command[];
    let summary: string;
    if (server.data.story === 'rehearsal' && l.entityVersion === 3) {
      commands = BRUNO_REV4_COMMANDS;
      summary = BRUNO_REV4_SUMMARY;
    } else {
      const phones = liveChildren(l.state.phones);
      const office = phones.find((p) => p.extension) ?? phones[0];
      if (!office) return;
      const nextExt = String((parseInt(office.extension ?? '0', 10) || 0) + 1);
      commands = [{ kind: 'phone.replace', ordinal: office.ordinal, value: phoneToInput(office.value), location: office.location, isPublic: office.isPublic, extension: nextExt }];
      summary = `Updated the ${office.location ?? 'phone'} extension to ${nextExt}`;
    }
    try {
      const result = server.save(bruno, lina, { expectedEntityVersion: l.entityVersion, commands }, 'ok', summary);
      collab.post({ type: 'committed', contactId: lina, entityVersion: result.entityVersion, unitStamp: result.dbrowVersion, actorId: 'bruno' });
      const d = draftRef.current;
      if (d && d.contactId === lina && d.baseVersion < result.entityVersion) {
        setIncoming({ entityVersion: result.entityVersion, actorId: 'bruno', summary, at: new Date().toISOString() });
        notify(`Bruno saved revision ${result.entityVersion} (simulated) while you are editing revision ${d.baseVersion}. Your draft is kept.`, 'warning');
      } else {
        notify(`Bruno saved revision ${result.entityVersion} of Lina Torres (simulated from this tab).`, 'info');
      }
    } catch (e) {
      notify(`Simulated update failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }, [server, collab, notify]);

  const rewindToRehearsal = useCallback(() => {
    server.rewindToRehearsal();
    collab.post({ type: 'reset', story: 'rehearsal' });
    if (personaRef.current.id !== 'mariana') {
      setPersonaIdState('mariana');
      try {
        sessionStorage.setItem(`omb:v1:${variant}:persona`, 'mariana');
      } catch {
        /* ignore */
      }
    }
    const l = server.latest(CONTACT_IDS.lina)!;
    const office = liveChildren(l.state.phones).find((p) => p.extension) ?? liveChildren(l.state.phones)[0]!;
    const working = updateChild(cloneState(l.state), 'phone', office.ordinal, { extension: '25' });
    setDraft({ contactId: CONTACT_IDS.lina, baseVersion: l.entityVersion, base: l.state, working, startedAt: new Date().toISOString(), origin: 'user' });
    setConflict(null);
    setIncoming(null);
    setSaveState({ status: 'idle' });
    setDemoState(DEMO_DEFAULTS);
    notify(`Rehearsal: Lina is at revision ${l.entityVersion}. Mariana is editing the ${office.location} extension (${office.extension} → 25). Now simulate Bruno's update, then Save.`, 'info');
  }, [server, collab, variant, notify]);

  const reset = useCallback(() => {
    server.reset();
    collab.post({ type: 'reset', story: 'full' });
    setDraft(null);
    setConflict(null);
    setIncoming(null);
    setSaveState({ status: 'idle' });
    setDemoState(DEMO_DEFAULTS);
    notify('Demo reset to the initial story (7 revisions of Lina Torres).', 'info');
  }, [server, collab, notify]);

  const value = useMemo<Workspace>(
    () => ({
      variant,
      tenant: TENANT,
      personas: PERSONAS,
      persona,
      setPersona,
      theme,
      setTheme: setThemeState,
      tick,
      server,
      story: server.data.story,
      contacts,
      latest,
      revisions,
      can,
      canProposed,
      draft,
      pending: pendingInfo.pending,
      draftError: pendingInfo.error,
      beginDraft,
      updateWorking,
      moveWorking,
      revertPath,
      discardDraft,
      save,
      saveState,
      clearSaveState,
      checkUncertain,
      acceptUncertain,
      incoming,
      conflict,
      openReconcile,
      resolveConflict,
      ask,
      stageProposal,
      presence,
      setPresence,
      tabId: collab.tabId,
      activity,
      unit,
      notes,
      postNote,
      demo,
      setDemo,
      simulateBrunoUpdate,
      rewindToRehearsal,
      reset,
      toasts,
      notify,
      dismissToast,
      today: TODAY,
    }),
    [
      variant, persona, setPersona, theme, tick, server, contacts, latest, revisions, can, canProposed, draft, pendingInfo, beginDraft, updateWorking, moveWorking,
      revertPath, discardDraft, save, saveState, clearSaveState, checkUncertain, acceptUncertain, incoming, conflict, openReconcile, resolveConflict, ask,
      stageProposal, presence, setPresence, collab.tabId, activity, unit, notes, postNote, demo, setDemo, simulateBrunoUpdate, rewindToRehearsal, reset, toasts,
      notify, dismissToast,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
