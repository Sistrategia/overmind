// Shared model for the three agent-B variants.
// Mirrors the wire contract in docs/contact-http-api.md and ADR 0015 where the
// backend already implements it, and labels the proposed parts explicitly.

export type ContactId = string;
export type PersonaId = 'mariana' | 'bruno' | 'sofia' | 'diego';
export type Family = 'email' | 'phone' | 'web_link' | 'address';
export type VariantId = 'casefile' | 'studio' | 'thread';

export const FAMILIES: Family[] = ['email', 'phone', 'web_link', 'address'];

export interface Tenant {
  id: string;
  name: string;
  timeZone: string; // IANA
  timeZoneLabel: string; // e.g. "CDMX (UTC−6)"
}

export interface Persona {
  id: PersonaId;
  actorKey: string; // entity public key (fictional)
  name: string; // short first name used in UI
  fullName: string;
  role: string;
  initials: string;
  hue: number; // avatar hue
  /** Implemented contract: overmind_contact grants, `permission:*` or `permission:<contactId>`. */
  grants: string[];
  /** Proposed capabilities the backend does not implement yet (activity explorer, presence). */
  proposed: string[];
}

export interface Profile {
  contactTypeId: 1 | 2;
  fullName: string;
  displayName: string | null;
  personFirstName: string | null;
  personLastName1: string | null;
  personLastName2: string | null;
  personAlias: string | null;
  summary: string | null;
  doNotContact: boolean;
  isPrivate: boolean;
}

export interface PhoneInput {
  number: string;
  defaultRegion?: string;
  areaCode?: string;
}

export interface PhoneValue {
  raw: string; // entered spelling
  defaultRegion: string | null;
  areaCode: string | null;
  e164: string; // complete identity
  national: string;
  international: string;
  callingCode: string;
  interpretation: 'international' | 'national' | 'split';
}

export interface WebLinkValue {
  url: string;
  title: string | null;
}

export interface AddressInput {
  streetName?: string | null;
  extNumber?: string | null;
  intNumber?: string | null;
  address1?: string | null;
  address2?: string | null;
  colony?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  references?: string | null;
}

export interface AddressValue extends AddressInput {
  /** Immutable shared value identity (catalog id). Shown only in the technical inspector. */
  valueId: string;
}

export interface Child<V> {
  ordinal: number; // stable identity within the family; negative = allocated in an unsaved draft
  displayOrder: number; // saved position (1-based) among live children
  value: V;
  location: string | null;
  isPublic: boolean;
  extension: string | null; // phone only
  deleted: boolean;
}

export interface ContactState {
  profile: Profile;
  emails: Child<string>[];
  phones: Child<PhoneValue>[];
  webLinks: Child<WebLinkValue>[];
  addresses: Child<AddressValue>[];
  deleted: boolean; // root soft-deleted
}

export type ActionFamily = Family | 'profile' | 'contact' | 'account';

export interface Action {
  seq: number; // global order within the audit unit
  family: ActionFamily;
  kind: string; // e.g. phone.replace
  ordinal: number | null;
  summary: string; // human readable
  before: string | null;
  after: string | null;
}

export interface Revision {
  contactId: ContactId;
  entityVersion: number;
  unitStamp: string; // dbrow_version as decimal string (Int64 stays a string)
  actorId: PersonaId;
  at: string; // ISO instant
  summary: string;
  state: ContactState; // reconstructed state at this revision
  actions: Action[];
}

export type UnitSource = 'business' | 'batch' | 'operational' | 'agent' | 'presence';

export interface AuditUnit {
  stamp: string; // business: dbrow_version string; other sources: their own id prefix
  at: string;
  actorId: PersonaId;
  source: UnitSource;
  kind:
    | 'contact.create'
    | 'contact.save'
    | 'user.provision'
    | 'admin.batch'
    | 'save.rejected'
    | 'save.uncertain'
    | 'sidekick.proposal'
    | 'presence.view';
  summary: string;
  contacts: { contactId: ContactId; entityVersion: number | null }[];
  families: ActionFamily[];
  actions: Action[];
  correlationId: string;
  batchId: string | null; // simulated administrative batch grouping
  detail: Record<string, string>;
}

// ---- Commands (wire contract, ADR 0015) ----

export type Command =
  | { kind: 'profile.replace'; profile: Profile }
  | { kind: 'contact.delete' }
  | { kind: 'contact.restore' }
  | { kind: 'email.insert'; value: string; location?: string | null; isPublic?: boolean }
  | { kind: 'email.replace'; ordinal: number; value: string; location?: string | null; isPublic?: boolean }
  | { kind: 'email.delete'; ordinal: number }
  | { kind: 'email.restore'; ordinal: number; value: string; location?: string | null; isPublic?: boolean }
  | { kind: 'email.move'; ordinal: number; displayOrder: number }
  | { kind: 'phone.insert'; value: PhoneInput; location?: string | null; isPublic?: boolean; extension?: string | null }
  | { kind: 'phone.replace'; ordinal: number; value: PhoneInput; location?: string | null; isPublic?: boolean; extension?: string | null }
  | { kind: 'phone.delete'; ordinal: number }
  | { kind: 'phone.restore'; ordinal: number; value: PhoneInput; location?: string | null; isPublic?: boolean; extension?: string | null }
  | { kind: 'phone.move'; ordinal: number; displayOrder: number }
  | { kind: 'web_link.insert'; value: WebLinkValue; location?: string | null; isPublic?: boolean }
  | { kind: 'web_link.replace'; ordinal: number; value: WebLinkValue; location?: string | null; isPublic?: boolean }
  | { kind: 'web_link.delete'; ordinal: number }
  | { kind: 'web_link.restore'; ordinal: number; value: WebLinkValue; location?: string | null; isPublic?: boolean }
  | { kind: 'web_link.move'; ordinal: number; displayOrder: number }
  | { kind: 'address.insert'; value: AddressInput; location?: string | null; isPublic?: boolean }
  | { kind: 'address.replace'; ordinal: number; value: AddressInput; location?: string | null; isPublic?: boolean }
  | { kind: 'address.delete'; ordinal: number }
  | { kind: 'address.restore'; ordinal: number; value: AddressInput; location?: string | null; isPublic?: boolean }
  | { kind: 'address.move'; ordinal: number; displayOrder: number };

export interface SaveRequest {
  expectedEntityVersion: number;
  commands: Command[];
}

export interface SaveResult {
  publicKey: ContactId;
  entityVersion: number;
  dbrowVersion: string | null;
  childIdentities: { commandIndex: number; family: Family; ordinal: number }[];
}

export type ProblemCode =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'dependency'
  | 'history_unavailable'
  | 'commit_uncertain'
  | 'storage';

export interface Problem {
  status: number;
  code: ProblemCode;
  title: string;
  detail: string;
  traceId: string;
  automaticRetryAllowed: false;
}

export class ProblemError extends Error {
  problem: Problem;
  constructor(problem: Problem) {
    super(problem.detail);
    this.problem = problem;
  }
}

// ---- Diff ----

export interface FieldChange {
  path: string; // e.g. profile.displayName, phone.2.extension
  label: string;
  before: string | null;
  after: string | null;
}

export interface ChildDiff {
  family: Family;
  ordinal: number;
  status: 'added' | 'removed' | 'restored' | 'changed' | 'unchanged';
  label: string; // e.g. "Phone · Office"
  display: string; // display value after (or before when removed)
  changes: FieldChange[];
}

export interface Diff {
  profile: FieldChange[];
  children: ChildDiff[];
  root: FieldChange[];
  isEmpty: boolean;
}

// ---- Activity ----

export interface ActivityFilters {
  actor: PersonaId | 'all';
  contact: ContactId | 'all';
  family: ActionFamily | 'all';
  source: UnitSource | 'all';
  from: string | null; // YYYY-MM-DD in tenant zone
  to: string | null;
  q: string;
}

export const EMPTY_FILTERS: ActivityFilters = {
  actor: 'all',
  contact: 'all',
  family: 'all',
  source: 'all',
  from: null,
  to: null,
  q: '',
};

// ---- Draft (local, never broadcast) ----

export interface Draft {
  contactId: ContactId;
  baseVersion: number;
  base: ContactState;
  working: ContactState;
  startedAt: string;
  origin: 'user' | 'sidekick' | 'reconciled';
}

export interface PendingChange {
  key: string;
  family: ActionFamily;
  ordinal: number | null;
  text: string; // plain words: "Change extension 22 → 25"
  command: Command;
}

// ---- Presence (proposed capability; awareness only) ----

export interface PresenceEntry {
  tabId: string;
  personaId: PersonaId;
  contactId: ContactId | null;
  section: string | null; // e.g. "phones", "history", "activity"
  editing: boolean;
  at: number; // epoch ms
}

// ---- Shared investigation notes (Thread variant; prototype-local) ----

export interface ThreadNote {
  id: string;
  contactId: ContactId;
  personaId: PersonaId;
  at: string;
  text: string;
  ref: { kind: 'revision'; version: number; compare?: number } | { kind: 'unit'; stamp: string } | null;
}
