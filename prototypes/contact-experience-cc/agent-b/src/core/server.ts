// Simulated backend shared by every tab of one variant through localStorage.
// - Implemented contracts (create/Save/current/revision compare/directory) follow the HTTP API
//   semantics: unit-entry expected revision, ordered commands, one revision per Save, 409 on stale
//   tokens, 403 on missing grants, 400 validation, 409 history_unavailable, 500 commit_uncertain.
// - Proposed capabilities (activity explorer, presence, shared notes) are labelled as such.
// This is a local prototype adapter; it is not a deployed server and offers no real isolation.
import type {
  AuditUnit,
  Command,
  ContactId,
  ContactState,
  Diff,
  Persona,
  PersonaId,
  Problem,
  ProblemCode,
  Revision,
  SaveRequest,
  SaveResult,
  ThreadNote,
  VariantId,
} from './types';
import { ProblemError } from './types';
import { applyCommands, CommandError } from './engine';
import { diffStates } from './diff';
import { buildStory, CONTACT_NAMES, personaById, TENANT } from './fixtures';
import { directoryProjection, hasGrant, hasProposed, type Permission } from './permissions';

export type SaveOutcome = 'ok' | 'forbidden' | 'uncertain' | 'storage';
export type Story = 'full' | 'rehearsal';

export interface ServerData {
  story: Story;
  revisions: Record<ContactId, Revision[]>;
  units: AuditUnit[];
  nextStamp: string;
  notes: ThreadNote[];
  writes: number;
}

function fresh(story: Story): ServerData {
  const built = buildStory(story === 'rehearsal' ? { upToLinaRevision: 3 } : {});
  return { story, revisions: built.revisions, units: built.units, nextStamp: built.nextStamp, notes: [], writes: 0 };
}

let traceCounter = 0;
function traceId(): string {
  traceCounter++;
  return `${Date.now().toString(16)}-${traceCounter.toString(16).padStart(4, '0')}`;
}

function problem(status: number, code: ProblemCode, title: string, detail: string): ProblemError {
  const p: Problem = { status, code, title, detail, traceId: traceId(), automaticRetryAllowed: false };
  return new ProblemError(p);
}

export interface RevisionRead {
  revision: Revision;
  compare: Revision | null;
  diff: Diff | null;
}

export class LocalServer {
  readonly key: string;
  data: ServerData;
  private listeners = new Set<() => void>();

  constructor(public readonly variant: VariantId) {
    this.key = `omb:v1:${variant}:server`;
    this.data = this.load();
  }

  private load(): ServerData {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw) as ServerData;
        if (parsed && parsed.revisions && parsed.units) return parsed;
      }
    } catch {
      /* fall through */
    }
    return fresh('full');
  }

  private persist(): void {
    this.data.writes += 1;
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      /* storage may be unavailable; keep in memory */
    }
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Re-read shared storage (another tab may have committed). */
  refresh(): boolean {
    const latest = this.load();
    if (latest.writes !== this.data.writes || latest.story !== this.data.story) {
      this.data = latest;
      this.emit();
      return true;
    }
    return false;
  }

  reset(): void {
    this.data = fresh('full');
    this.persist();
  }

  rewindToRehearsal(): void {
    this.data = fresh('rehearsal');
    this.persist();
  }

  // ---- Reads ----

  contactIds(): ContactId[] {
    return Object.keys(this.data.revisions);
  }

  revisions(contactId: ContactId): Revision[] {
    return this.data.revisions[contactId] ?? [];
  }

  latest(contactId: ContactId): Revision | null {
    const list = this.revisions(contactId);
    return list.length ? list[list.length - 1]! : null;
  }

  contactName(contactId: ContactId): string {
    const latest = this.latest(contactId);
    return latest ? latest.state.profile.displayName ?? latest.state.profile.fullName : CONTACT_NAMES[contactId] ?? contactId;
  }

  /** GET /api/contacts/{id} — ReadDetail; falls back to the directory projection when only ReadDirectory is held. */
  readCurrent(persona: Persona, contactId: ContactId): { state: ContactState; revision: Revision; projection: 'detail' | 'directory' } {
    const latest = this.latest(contactId);
    if (!latest) throw problem(404, 'not_found', 'Not found', 'The contact does not exist in this tenant.');
    if (hasGrant(persona, 'read_detail', contactId)) return { state: latest.state, revision: latest, projection: 'detail' };
    if (hasGrant(persona, 'read_directory', contactId)) {
      const dir = directoryProjection(latest.state);
      if (!dir) throw problem(404, 'not_found', 'Not found', 'Private or deleted contacts are not in the directory.');
      return { state: dir, revision: latest, projection: 'directory' };
    }
    throw problem(403, 'forbidden', 'Forbidden', `${persona.fullName} holds no read grant for this contact.`);
  }

  /** GET /api/contacts/{id}/revisions/{v}?compareEntityVersion=... — ReadDetail + ReadHistory. */
  readRevision(persona: Persona, contactId: ContactId, version: number, compare: number | null, coverageFrom: number | null): RevisionRead {
    if (!hasGrant(persona, 'read_detail', contactId) || !hasGrant(persona, 'read_history', contactId)) {
      throw problem(403, 'forbidden', 'Forbidden', `${persona.fullName} needs read_detail and read_history for this contact to open its history.`);
    }
    const list = this.revisions(contactId);
    const revision = list.find((r) => r.entityVersion === version);
    if (!revision) throw problem(404, 'not_found', 'Not found', `Revision ${version} does not exist for this contact.`);
    if (coverageFrom !== null && version < coverageFrom) {
      throw problem(409, 'history_unavailable', 'History unavailable', `Historical coverage for this contact starts at revision ${coverageFrom}. Earlier state is unknown and is not reconstructed from today's values.`);
    }
    let compareRev: Revision | null = null;
    if (compare !== null) {
      compareRev = list.find((r) => r.entityVersion === compare) ?? null;
      if (!compareRev) throw problem(404, 'not_found', 'Not found', `Revision ${compare} does not exist for this contact.`);
      if (coverageFrom !== null && compare < coverageFrom) {
        throw problem(409, 'history_unavailable', 'History unavailable', `Historical coverage starts at revision ${coverageFrom}; revision ${compare} cannot be reconstructed.`);
      }
    }
    return { revision, compare: compareRev, diff: compareRev ? diffStates(compareRev.state, revision.state) : null };
  }

  // ---- Writes ----

  private requiredPermission(cmd: Command): Permission {
    if (cmd.kind === 'contact.delete') return 'delete';
    if (cmd.kind === 'contact.restore') return 'restore';
    return 'edit';
  }

  private allocateStamp(): string {
    const stamp = BigInt(this.data.nextStamp);
    this.data.nextStamp = (stamp + BigInt(3 + Math.floor(Math.random() * 9))).toString();
    return stamp.toString();
  }

  /** POST /api/contacts/{id}/save */
  save(persona: Persona, contactId: ContactId, request: SaveRequest, outcome: SaveOutcome = 'ok', summary?: string): SaveResult {
    this.data = this.load(); // always check against the shared committed state
    const latest = this.latest(contactId);
    if (!latest) throw problem(404, 'not_found', 'Not found', 'The contact does not exist in this tenant.');
    if (!request.commands.length) throw problem(400, 'validation', 'Validation', 'A Save needs at least one command.');
    if (request.commands.length > 256) throw problem(400, 'validation', 'Validation', 'A Save is limited to 256 commands.');
    // Every required permission is checked before the unit opens.
    for (const cmd of request.commands) {
      const perm = this.requiredPermission(cmd);
      if (!hasGrant(persona, perm, contactId)) {
        throw problem(403, 'forbidden', 'Forbidden', `${persona.fullName} does not hold “${perm}” for this contact.`);
      }
    }
    if (outcome === 'forbidden') {
      throw problem(403, 'forbidden', 'Forbidden', 'The SQL actor/tenant check rejected this request (simulated denial).');
    }
    if (request.expectedEntityVersion !== latest.entityVersion) {
      this.logOperational(persona.id, contactId, 'save.rejected',
        `Save rejected: stale revision (409 conflict) on ${this.contactName(contactId)} — expected ${request.expectedEntityVersion}, current ${latest.entityVersion}`,
        request.commands, latest.entityVersion);
      throw problem(409, 'conflict', 'Conflict', `The contact is at revision ${latest.entityVersion}; your Save expected revision ${request.expectedEntityVersion}. Read the current revision and resolve your edit before saving again.`);
    }
    if (outcome === 'storage') {
      throw problem(500, 'storage', 'Storage failure', 'The provider reported an error before commit (simulated). Nothing was committed.');
    }
    let applied;
    try {
      applied = applyCommands(latest.state, request.commands, { allocate: 'server' });
    } catch (e) {
      if (e instanceof CommandError) {
        throw problem(400, 'validation', 'Validation', `Command ${e.commandIndex + 1} (${request.commands[e.commandIndex]?.kind}): ${e.message} The whole Save was rejected; nothing was committed.`);
      }
      throw e;
    }
    if (!applied.actions.length) {
      // Entirely ineffective Save: same revision, NULL stamp.
      return { publicKey: contactId, entityVersion: latest.entityVersion, dbrowVersion: null, childIdentities: [] };
    }
    const stamp = this.allocateStamp();
    const at = new Date().toISOString();
    const entityVersion = latest.entityVersion + 1;
    const text = summary ?? describeSave(applied.actions);
    const revision: Revision = { contactId, entityVersion, unitStamp: stamp, actorId: persona.id, at, summary: text, state: applied.state, actions: applied.actions };
    this.data.revisions[contactId] = [...this.revisions(contactId), revision];
    this.data.units = [
      {
        stamp,
        at,
        actorId: persona.id,
        source: 'business',
        kind: 'contact.save',
        summary: text,
        contacts: [{ contactId, entityVersion }],
        families: Array.from(new Set(applied.actions.map((a) => a.family))),
        actions: applied.actions,
        correlationId: `${stamp}-${traceId()}`,
        batchId: null,
        detail: { tenant: TENANT.id, actorKey: persona.actorKey, dbrowVersion: stamp, expectedEntityVersion: String(request.expectedEntityVersion) },
      },
      ...this.data.units,
    ];
    if (outcome === 'uncertain') {
      // The commit happened, but the acknowledgement is lost: no stamp, no automatic retry.
      this.logOperational(persona.id, contactId, 'save.uncertain',
        `Save acknowledgement uncertain (500 commit_uncertain) on ${this.contactName(contactId)}`, request.commands, null);
      this.persist();
      throw problem(500, 'commit_uncertain', 'Commit uncertain', 'The server could not confirm whether the commit succeeded. Do not replay it blindly: check the current revision and decide.');
    }
    this.persist();
    return { publicKey: contactId, entityVersion, dbrowVersion: stamp, childIdentities: applied.identities };
  }

  private logOperational(actorId: PersonaId, contactId: ContactId, kind: 'save.rejected' | 'save.uncertain', summary: string, commands: Command[], entityVersion: number | null): void {
    const at = new Date().toISOString();
    this.data.units = [
      {
        stamp: `op-${Date.now().toString(36)}`,
        at,
        actorId,
        source: 'operational',
        kind,
        summary,
        contacts: [{ contactId, entityVersion }],
        families: Array.from(new Set(commands.map((c) => (c.kind.startsWith('profile') ? 'profile' : c.kind.startsWith('contact') ? 'contact' : (c.kind.split('.')[0] as AuditUnit['families'][number]))))),
        actions: [],
        correlationId: traceId(),
        batchId: null,
        detail: { source: 'Application operational log (simulated), not the business audit', commands: String(commands.length) },
      },
      ...this.data.units,
    ];
    if (kind === 'save.rejected') this.persist();
  }

  logAgentProposal(actorId: PersonaId, contactId: ContactId, changes: number): void {
    this.data.units = [
      {
        stamp: `agent-${Date.now().toString(36)}`,
        at: new Date().toISOString(),
        actorId,
        source: 'agent',
        kind: 'sidekick.proposal',
        summary: `Sidekick staged a proposal for ${personaById(actorId).name} (${changes} change${changes === 1 ? '' : 's'}) — not saved`,
        contacts: [{ contactId, entityVersion: this.latest(contactId)?.entityVersion ?? null }],
        families: [],
        actions: [],
        correlationId: traceId(),
        batchId: null,
        detail: { source: 'Simulated agent activity (local)', note: 'A proposal is a local draft until a person applies it as one Save.' },
      },
      ...this.data.units,
    ];
    this.persist();
  }

  // ---- Proposed: activity explorer ----

  activity(persona: Persona): AuditUnit[] {
    if (!hasProposed(persona, 'read_activity')) {
      throw problem(403, 'forbidden', 'Forbidden', `${persona.fullName} does not hold the proposed read_activity capability.`);
    }
    return this.data.units.filter((u) =>
      u.contacts.length === 0 || u.contacts.some((c) => hasGrant(persona, 'read_detail', c.contactId) || hasGrant(persona, 'read_directory', c.contactId)),
    );
  }

  unit(stamp: string): AuditUnit | null {
    return this.data.units.find((u) => u.stamp === stamp) ?? null;
  }

  // ---- Proposed: shared investigation notes (prototype-local) ----

  notes(contactId: ContactId): ThreadNote[] {
    return this.data.notes.filter((n) => n.contactId === contactId);
  }

  addNote(note: ThreadNote): void {
    this.data = this.load();
    this.data.notes = [...this.data.notes, note];
    this.persist();
  }
}

export function describeSave(actions: { family: string; kind: string }[]): string {
  const families = Array.from(new Set(actions.map((a) => a.family)));
  const label = (f: string) => (f === 'web_link' ? 'web link' : f);
  if (actions.length === 1) {
    const a = actions[0]!;
    const op = a.kind.split('.')[1];
    return `${label(a.family)[0]!.toUpperCase()}${label(a.family).slice(1)} ${op === 'replace' ? 'changed' : op === 'move' ? 'reordered' : op === 'insert' ? 'added' : op === 'delete' ? 'removed' : op === 'restore' ? 'restored' : op}`;
  }
  return `Saved together: ${families.map(label).join(', ')} (${actions.length} actions)`;
}
