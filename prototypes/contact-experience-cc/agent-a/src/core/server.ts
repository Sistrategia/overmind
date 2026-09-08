// Simulated shared server. Committed state lives in localStorage, namespaced per variant
// and tenant, so two tabs of the same variant share one "database" while variants stay
// isolated. It enforces the same contracts the HTTP API documents: unit-entry expected
// revision, ordered commands, whole-unit rollback, Int64 stamps as strings.
import { applyAll, CommandError, diffStates, emptyCatalog, emptyState, liveChildren, summarizeActions, type AddressCatalog } from './engine';
import { CONTACT_SLUGS, DEMO_NOW_ISO, FIRST_STAMP, SEEDS, SEED_OPERATIONAL, TENANT } from './fixtures';
import type {
  Action, AuditUnit, Child, Command, ContactState, Family, OperationalEvent, Problem, ProblemCode, RevisionDiff, SaveResult
} from './model';
import { actorName, can, type Persona } from './personas';
import { Emitter } from './store';

export interface ServerState {
  version: number;
  tenant: { key: string; name: string };
  units: AuditUnit[];
  snapshots: Record<string, ContactState[]>;   // contactKey → snapshot per revision (index = revision - 1)
  slugs: Record<string, string>;
  catalog: AddressCatalog;
  operational: OperationalEvent[];
  nextStamp: string;
  clock: { demoMs: number; realMs: number };
  lastRecordedMs: number;
  demo: { historyUnavailableBelow: number };
}

const SCHEMA_VERSION = 3;

export interface ContactSummary { key: string; slug: string; displayName: string; category: 'Person' | 'Organization'; entityVersion: number; isPrivate: boolean; deleted: boolean }

export interface RevisionRead {
  state: ContactState;
  compareState: ContactState | null;
  diff: RevisionDiff | null;
  actions: Action[];
  unit: AuditUnit;
}

export interface DirectoryRead {
  publicKey: string; entityVersion: number; category: 'Person' | 'Organization'; displayName: string;
  emails: Child[]; phones: Child[]; webLinks: Child[]; addresses: Child[];
}

export interface ActivityFilters {
  actor?: string;      // persona key or actor key
  contact?: string;    // contact key or slug
  family?: 'profile' | 'root' | 'provisioning' | Family | '';
  from?: string;       // ISO date (tenant day) inclusive
  to?: string;         // ISO date inclusive
  q?: string;
  source?: 'audit' | 'operational' | 'all';
}

export type ActivityItem =
  | { kind: 'unit'; at: string; unit: AuditUnit; contact: ContactSummary | null }
  | { kind: 'operational'; at: string; event: OperationalEvent; contact: ContactSummary | null };

let traceCounter = 0;
export function newTraceId(): string {
  traceCounter += 1;
  const rnd = Math.random().toString(16).slice(2, 10);
  return `00-${rnd}${(Date.now() % 0xffffffff).toString(16).padStart(8, '0')}${traceCounter.toString(16).padStart(4, '0')}-${rnd.slice(0, 4)}0000-01`;
}

export function problem(status: number, code: ProblemCode, title: string, detail: string, extra: Partial<Problem> = {}): Problem {
  return { status, code, title, detail, traceId: newTraceId(), automaticRetryAllowed: false, ...extra };
}

export class SimServer {
  readonly changed = new Emitter<'committed' | 'reset' | 'operational' | 'demo'>();
  private state!: ServerState;
  readonly storageKey: string;

  constructor(readonly namespace: string) {
    this.storageKey = `${namespace}:server`;
    this.load();
  }

  // ---- persistence -------------------------------------------------------------
  private load(): void {
    let raw: string | null = null;
    try { raw = localStorage.getItem(this.storageKey); } catch { /* ignore */ }
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ServerState;
        if (parsed.version === SCHEMA_VERSION) { this.state = parsed; return; }
      } catch { /* fall through to reseed */ }
    }
    this.state = this.seed();
    this.persist();
  }
  private persist(): void {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); } catch { /* ignore quota */ }
  }
  /** Re-read shared storage (another tab committed). */
  reload(): void { this.load(); }
  reset(): void { this.state = this.seed(); this.persist(); this.changed.emit('reset'); }

  private seed(): ServerState {
    const s: ServerState = {
      version: SCHEMA_VERSION, tenant: TENANT, units: [], snapshots: {}, slugs: { ...CONTACT_SLUGS }, catalog: emptyCatalog(),
      operational: [...SEED_OPERATIONAL], nextStamp: FIRST_STAMP.toString(),
      clock: { demoMs: new Date(DEMO_NOW_ISO).getTime(), realMs: Date.now() }, lastRecordedMs: 0,
      demo: { historyUnavailableBelow: 0 }
    };
    // Stamps: provisioning units start at ...1001; contact units get memorable gaps.
    const stamps = [1001n, 1002n, 1003n, 1004n, 1005n, 1048n, 1051n, 1052n, 1067n, 1075n, 1079n, 1083n, 1090n, 1098n];
    const base = FIRST_STAMP - 1001n;
    SEEDS.forEach((seed, i) => {
      const stamp = (base + (stamps[i] ?? 1100n + BigInt(i))).toString();
      this.commitInto(s, seed.contactKey, seed.actorKey, seed.commands, seed.at, seed.source, seed.summary, stamp, seed.account);
    });
    s.nextStamp = (base + 1200n).toString();
    return s;
  }

  // ---- clock ---------------------------------------------------------------------
  now(): string {
    const ms = Math.max(this.state.clock.demoMs + (Date.now() - this.state.clock.realMs), this.state.lastRecordedMs + 1000);
    return new Date(ms).toISOString();
  }

  // ---- internal commit -----------------------------------------------------------
  private commitInto(s: ServerState, contactKey: string, actorKey: string, commands: Command[], at: string, source: 'contact' | 'provisioning', summary: string | null, stamp: string | null, account?: AuditUnit['account']): { unit: AuditUnit | null; identities: SaveResult['childIdentities'] } {
    const history = s.snapshots[contactKey] ?? [];
    const current = history.length ? history[history.length - 1] : emptyState(contactKey);
    const { state, actions, identities } = applyAll(current, commands, { addresses: s.catalog });
    if (actions.length === 0) return { unit: null, identities };
    const unitId = stamp ?? s.nextStamp;
    if (!stamp) s.nextStamp = (BigInt(s.nextStamp) + 1n).toString();
    const unit: AuditUnit = {
      id: unitId, tenantKey: s.tenant.key, actorKey, recordedAt: at, source, contactKey,
      entityVersion: current.entityVersion + 1, expectedEntityVersion: current.entityVersion,
      summary: summary ?? summarizeActions(actions), actions, traceId: newTraceId(), commands: JSON.parse(JSON.stringify(commands)) as Command[],
      ...(account ? { account } : {})
    };
    state.entityVersion = unit.entityVersion;
    s.units.push(unit);
    s.snapshots[contactKey] = [...history, state];
    s.lastRecordedMs = Math.max(s.lastRecordedMs, new Date(at).getTime());
    if (!s.slugs[contactKey]) s.slugs[contactKey] = contactKey.slice(0, 8);
    return { unit, identities };
  }

  // ---- reads ---------------------------------------------------------------------
  tenant(): { key: string; name: string } { return this.state.tenant; }
  resolveKey(slugOrKey: string): string | undefined {
    if (this.state.snapshots[slugOrKey]) return slugOrKey;
    return Object.entries(this.state.slugs).find(([, s]) => s === slugOrKey)?.[0];
  }
  slugOf(key: string): string { return this.state.slugs[key] ?? key; }

  summary(key: string): ContactSummary | null {
    const h = this.state.snapshots[key];
    if (!h) return null;
    const cur = h[h.length - 1];
    return { key, slug: this.slugOf(key), displayName: cur.profile.displayName ?? cur.profile.fullName, category: cur.profile.contactTypeId === 2 ? 'Organization' : 'Person', entityVersion: cur.entityVersion, isPrivate: cur.profile.isPrivate, deleted: cur.deletedRoot };
  }
  listContacts(persona: Persona): ContactSummary[] {
    return Object.keys(this.state.snapshots).map(k => this.summary(k)!).filter(c => this.canSeeContact(persona, c));
  }
  private canSeeContact(persona: Persona, c: ContactSummary): boolean {
    if (can(persona, 'read_detail')) return true;
    if (can(persona, 'read_directory')) return !c.isPrivate && !c.deleted;
    return false;
  }

  getCurrent(key: string, persona: Persona): ContactState | Problem {
    if (!can(persona, 'read_detail')) return problem(403, 'forbidden', 'Forbidden', `${persona.name} has no read_detail grant for this contact.`);
    const h = this.state.snapshots[key];
    if (!h) return problem(404, 'not_found', 'Not found', 'No contact with that key in this tenant.');
    return h[h.length - 1];
  }

  getRevision(key: string, version: number, compare: number | null, persona: Persona): RevisionRead | Problem {
    if (!can(persona, 'read_detail') || !can(persona, 'read_history')) return problem(403, 'forbidden', 'Forbidden', `${persona.name} needs read_detail and read_history to read revisions.`);
    const h = this.state.snapshots[key];
    if (!h) return problem(404, 'not_found', 'Not found', 'No contact with that key in this tenant.');
    if (!Number.isInteger(version) || version < 1 || version > h.length) return problem(404, 'not_found', 'Revision not found', `Revision ${version} does not exist; current is ${h.length}.`);
    if (version < this.state.demo.historyUnavailableBelow || (compare !== null && compare < this.state.demo.historyUnavailableBelow)) {
      return problem(409, 'history_unavailable', 'Historical coverage unavailable', `Complete profile history before revision ${this.state.demo.historyUnavailableBelow} is not available for this contact. Values are not borrowed from the current state.`);
    }
    if (compare !== null && (!Number.isInteger(compare) || compare < 1 || compare > h.length)) return problem(404, 'not_found', 'Revision not found', `Revision ${compare} does not exist.`);
    const unit = this.state.units.find(u => u.contactKey === key && u.entityVersion === version)!;
    const state = h[version - 1];
    const compareState = compare !== null ? h[compare - 1] : null;
    return { state, compareState, diff: compareState ? diffStates(compareState, state) : null, actions: unit.actions, unit };
  }

  getDirectory(key: string, persona: Persona): DirectoryRead | Problem {
    if (!can(persona, 'read_directory')) return problem(403, 'forbidden', 'Forbidden', `${persona.name} has no read_directory grant.`);
    const h = this.state.snapshots[key];
    if (!h) return problem(404, 'not_found', 'Not found', 'No contact with that key in this tenant.');
    const cur = h[h.length - 1];
    if (cur.profile.isPrivate || cur.deletedRoot) return problem(404, 'not_found', 'Not found', 'This contact is not in the directory.');
    const pub = (fam: Family) => liveChildren(cur, fam).filter(c => c.isPublic);
    return { publicKey: key, entityVersion: cur.entityVersion, category: cur.profile.contactTypeId === 2 ? 'Organization' : 'Person', displayName: cur.profile.displayName ?? cur.profile.fullName, emails: pub('email'), phones: pub('phone'), webLinks: pub('web_link'), addresses: pub('address') };
  }

  unitsFor(key: string): AuditUnit[] { return this.state.units.filter(u => u.contactKey === key); }
  unitById(id: string): AuditUnit | undefined { return this.state.units.find(u => u.id === id); }
  currentVersion(key: string): number { return this.state.snapshots[key]?.length ?? 0; }
  snapshotAt(key: string, version: number): ContactState | undefined { return this.state.snapshots[key]?.[version - 1]; }
  catalog(): AddressCatalog { return this.state.catalog; }
  /** Contacts whose current state references the same immutable address value. */
  addressValueUsers(valueId: string): ContactSummary[] {
    return Object.entries(this.state.snapshots)
      .filter(([, h]) => h[h.length - 1].addresses.some(a => !a.deleted && a.value.id === valueId))
      .map(([k]) => this.summary(k)!);
  }

  // ---- writes --------------------------------------------------------------------
  save(key: string, expectedEntityVersion: number, commands: Command[], persona: Persona, opts: { summary?: string | null; at?: string } = {}): SaveResult | Problem {
    if (!this.state.snapshots[key]) return problem(404, 'not_found', 'Not found', 'No contact with that key in this tenant.');
    if (!can(persona, 'edit')) return problem(403, 'forbidden', 'Forbidden', `${persona.name} has no edit grant; the request was not admitted.`);
    for (const c of commands) {
      if (c.kind === 'contact.delete' && !can(persona, 'delete')) return problem(403, 'forbidden', 'Forbidden', 'Root deletion requires the delete grant.');
      if (c.kind === 'contact.restore' && !can(persona, 'restore')) return problem(403, 'forbidden', 'Forbidden', 'Root restoration requires the restore grant.');
      if (c.kind === 'contact.create') return problem(400, 'validation', 'Invalid command', 'contact.create is not a Save command.');
    }
    if (!Number.isInteger(expectedEntityVersion) || expectedEntityVersion < 1) return problem(400, 'validation', 'Invalid request', 'expectedEntityVersion must be a positive revision.');
    if (commands.length === 0) return problem(400, 'validation', 'Invalid request', 'A Save needs at least one command.');
    if (commands.length > 256) return problem(400, 'validation', 'Invalid request', 'At most 256 commands per Save.');
    const current = this.currentVersion(key);
    if (expectedEntityVersion !== current) {
      return problem(409, 'conflict', 'Stale revision', `Your request expected revision ${expectedEntityVersion}, but the contact is at revision ${current}. Read the current revision and resolve your edit before saving again.`, { currentEntityVersion: current });
    }
    const at = opts.at ?? this.now();
    let committed: { unit: AuditUnit | null; identities: SaveResult['childIdentities'] };
    try {
      committed = this.commitInto(this.state, key, persona.actorKey, commands, at, 'contact', opts.summary ?? null, null);
    } catch (e) {
      if (e instanceof CommandError) {
        return problem(e.code === 'not_found' ? 404 : 400, e.code, e.code === 'not_found' ? 'Not found' : 'Validation failed', `${e.message} Nothing was saved.`, { commandIndex: e.commandIndex });
      }
      return problem(500, 'storage', 'Storage failure', 'The simulated server failed before commit.');
    }
    if (committed.unit) {
      this.persist();
      this.changed.emit('committed');
      return { publicKey: key, entityVersion: committed.unit.entityVersion, auditDbrowVersion: committed.unit.id, childIdentities: committed.identities };
    }
    // Entirely ineffective Save: same revision, NULL stamp, no unit (docs/contact-service.md).
    return { publicKey: key, entityVersion: current, auditDbrowVersion: null, childIdentities: committed.identities };
  }

  // ---- proposed capabilities (no production endpoint) ----------------------------
  listActivity(filters: ActivityFilters, persona: Persona): ActivityItem[] | Problem {
    if (!can(persona, 'activity')) return problem(403, 'forbidden', 'Forbidden', `${persona.name} cannot open tenant activity. Editors see a contact's own history instead.`);
    const q = (filters.q ?? '').trim().toLowerCase();
    const actorKey = filters.actor ? (this.actorKeyFor(filters.actor)) : null;
    const contactKey = filters.contact ? this.resolveKey(filters.contact) ?? filters.contact : null;
    const fromMs = filters.from ? new Date(`${filters.from}T06:00:00Z`).getTime() : null;
    const toMs = filters.to ? new Date(`${filters.to}T06:00:00Z`).getTime() + 86_400_000 - 1 : null;
    const source = filters.source ?? 'all';
    const items: ActivityItem[] = [];
    if (source !== 'operational') {
      for (const u of this.state.units) {
        if (actorKey && u.actorKey !== actorKey) continue;
        if (contactKey && u.contactKey !== contactKey) continue;
        const t = new Date(u.recordedAt).getTime();
        if (fromMs !== null && t < fromMs) continue;
        if (toMs !== null && t > toMs) continue;
        if (filters.family) {
          if (filters.family === 'provisioning') { if (u.source !== 'provisioning') continue; }
          else if (!u.actions.some(a => a.target.family === filters.family)) continue;
        }
        const contact = this.summary(u.contactKey);
        if (q) {
          const hay = [u.summary, actorName(u.actorKey), contact?.displayName ?? '', u.id, ...u.actions.map(a => a.summary)].join(' ').toLowerCase();
          if (!hay.includes(q)) continue;
        }
        items.push({ kind: 'unit', at: u.recordedAt, unit: u, contact });
      }
    }
    if (source !== 'audit' && !filters.family) {
      for (const e of this.state.operational) {
        if (actorKey && e.actorKey !== actorKey) continue;
        if (contactKey && e.contactKey !== contactKey) continue;
        const t = new Date(e.at).getTime();
        if (fromMs !== null && t < fromMs) continue;
        if (toMs !== null && t > toMs) continue;
        const contact = e.contactKey ? this.summary(e.contactKey) : null;
        if (q) {
          const hay = [e.summary, e.detail ?? '', actorName(e.actorKey), contact?.displayName ?? ''].join(' ').toLowerCase();
          if (!hay.includes(q)) continue;
        }
        items.push({ kind: 'operational', at: e.at, event: e, contact });
      }
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }

  actorKeyFor(personaOrActor: string): string {
    const lower = personaOrActor.toLowerCase();
    const p = [...this.knownActors()].find(a => a.key === lower || a.actorKey === personaOrActor || a.name.toLowerCase().startsWith(lower));
    return p?.actorKey ?? personaOrActor;
  }
  knownActors(): { key: string; actorKey: string; name: string }[] {
    const keys = new Set(this.state.units.map(u => u.actorKey));
    return [...keys].map(k => ({ key: (this.state.slugs[k] ?? k), actorKey: k, name: actorName(k) }));
  }

  getUnit(id: string, persona: Persona): { unit: AuditUnit; contact: ContactSummary | null } | Problem {
    const unit = this.unitById(id);
    if (!unit) return problem(404, 'not_found', 'Not found', `No audit unit ${id}.`);
    const allowed = can(persona, 'activity') || (can(persona, 'read_history') && can(persona, 'read_detail'));
    if (!allowed) return problem(403, 'forbidden', 'Forbidden', `${persona.name} cannot read audit units.`);
    return { unit, contact: this.summary(unit.contactKey) };
  }

  logOperational(ev: Omit<OperationalEvent, 'id' | 'at'> & { at?: string }): OperationalEvent {
    const full: OperationalEvent = { id: `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: ev.at ?? this.now(), ...ev };
    this.state.operational.push(full);
    this.persist();
    this.changed.emit('operational');
    return full;
  }

  setHistoryUnavailableBelow(rev: number): void { this.state.demo.historyUnavailableBelow = rev; this.persist(); this.changed.emit('demo'); }
  demoFlags(): ServerState['demo'] { return this.state.demo; }
  allUnits(): AuditUnit[] { return this.state.units; }
}
