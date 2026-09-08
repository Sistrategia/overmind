// Shared data model for the three prototypes. Shapes mirror the HTTP wire contract
// (docs/contact-http-api.md, ADR 0015): camelCase, INT revisions/ordinals as numbers,
// Int64 audit stamps as decimal strings.

export type Family = 'email' | 'phone' | 'web_link' | 'address';
export const FAMILIES: Family[] = ['email', 'phone', 'web_link', 'address'];
export type ChildOp = 'insert' | 'replace' | 'delete' | 'restore' | 'move';
export type ContactTypeId = 1 | 2;

export interface Profile {
  contactTypeId: ContactTypeId;
  fullName: string;
  displayName: string | null;
  personFirstName: string | null;
  personLastName1: string | null;
  personLastName2: string | null;
  personAlias: string | null;
  jobTitle: string | null;
  summary: string | null;
  isPrivate: boolean;
  doNotContact: boolean;
  recruiting: boolean;
}

export const PROFILE_FIELDS: (keyof Profile)[] = [
  'fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2',
  'personAlias', 'jobTitle', 'summary', 'isPrivate', 'doNotContact', 'recruiting'
];

export const PROFILE_FIELD_LABEL: Record<string, string> = {
  fullName: 'Full name', displayName: 'Display name', personFirstName: 'First name',
  personLastName1: 'First surname', personLastName2: 'Second surname', personAlias: 'Alias',
  jobTitle: 'Job title', summary: 'Summary', isPrivate: 'Private contact', doNotContact: 'Do not contact',
  recruiting: 'Recruiting'
};

/** Phone input as sent on the wire (PhoneInput). */
export interface PhoneInput { number: string; defaultRegion?: string; areaCode?: string }

/** Immutable interpretation captured at Save time (simulated PhoneParser output). */
export interface PhoneValue {
  e164: string;
  callingCode: string;
  nationalNumber: string;
  /** ISO-style numbering region, when resolvable. Not the contact's residence. */
  numberingRegion: string | null;
  /** Destination grouping hint (e.g. Mexican area 777). Not a city or residence claim. */
  destinationGroup: string | null;
  rawInput: string;
  parser: string;
}

export interface AddressInput {
  streetName?: string | null; extNumber?: string | null; intNumber?: string | null;
  address1?: string | null; address2?: string | null;
  zipCode?: string | null; country?: string | null; state?: string | null;
  city?: string | null; colony?: string | null; references?: string | null;
}
export const ADDRESS_FIELDS: (keyof AddressInput)[] = [
  'streetName', 'extNumber', 'intNumber', 'address1', 'address2', 'colony', 'zipCode', 'city', 'state', 'country', 'references'
];
export const ADDRESS_FIELD_LABEL: Record<string, string> = {
  streetName: 'Street', extNumber: 'Number', intNumber: 'Interior', address1: 'Line 1', address2: 'Line 2',
  colony: 'Colony', zipCode: 'Postal code', city: 'City', state: 'State', country: 'Country', references: 'References'
};

/** Shared immutable address value (contacts.address). id is a demo catalog identity. */
export interface AddressValue extends AddressInput { id: string }

export interface WebLinkValue { url: string; type: string | null; displayText: string | null }

export interface ChildBase {
  ordinal: number;             // stable child identity
  displayOrder: number | null; // saved one-based position; null when deleted
  location: string | null;     // label
  isPublic: boolean;
  deleted: boolean;
}
export interface EmailChild extends ChildBase { family: 'email'; value: string; extension?: undefined }
export interface PhoneChild extends ChildBase { family: 'phone'; value: PhoneValue; extension: string | null }
export interface WebLinkChild extends ChildBase { family: 'web_link'; value: WebLinkValue; extension?: undefined }
export interface AddressChild extends ChildBase { family: 'address'; value: AddressValue; extension?: undefined }
export type Child = EmailChild | PhoneChild | WebLinkChild | AddressChild;

export interface ContactState {
  publicKey: string;
  entityVersion: number;
  profile: Profile;
  emails: EmailChild[];
  phones: PhoneChild[];
  webLinks: WebLinkChild[];
  addresses: AddressChild[];
  deletedRoot: boolean;
}

export type FamilyListKey = 'emails' | 'phones' | 'webLinks' | 'addresses';
export const FAMILY_LIST: Record<Family, FamilyListKey> = {
  email: 'emails', phone: 'phones', web_link: 'webLinks', address: 'addresses'
};

export const FAMILY_LABEL: Record<Family, string> = {
  email: 'Email', phone: 'Phone', web_link: 'Web link', address: 'Address'
};
export const FAMILY_LABEL_PLURAL: Record<Family, string> = {
  email: 'Emails', phone: 'Phones', web_link: 'Web links', address: 'Addresses'
};

// ---- Commands (wire shapes) -------------------------------------------------

export type ChildKind = `${Family}.${ChildOp}`;
export type CommandKind = 'profile.replace' | 'contact.delete' | 'contact.restore' | 'contact.create' | ChildKind;

export interface ProfileReplaceCommand { kind: 'profile.replace'; profile: Profile }
/** Internal creation evidence for revision 1. Not a Save command on the wire (creation is POST /api/contacts). */
export interface ContactCreateCommand { kind: 'contact.create'; profile: Profile }
export interface RootLifecycleCommand { kind: 'contact.delete' | 'contact.restore' }
export interface ChildCommand {
  kind: ChildKind;
  ordinal?: number;
  value?: string | PhoneInput | AddressInput | WebLinkValue;
  location?: string | null;
  isPublic?: boolean;
  extension?: string | null;
  displayOrder?: number;
}
export type Command = ProfileReplaceCommand | ContactCreateCommand | RootLifecycleCommand | ChildCommand;

export function isChildCommand(c: Command): c is ChildCommand {
  return !c.kind.startsWith('profile.') && !c.kind.startsWith('contact.');
}
export function familyOf(kind: ChildKind): Family { return kind.split('.')[0] as Family; }
export function opOf(kind: ChildKind): ChildOp { return kind.split('.')[1] as ChildOp; }

// ---- Evidence ----------------------------------------------------------------

export interface ChildRef { family: Family; ordinal: number }
export type ActionTarget = ChildRef | { family: 'profile' } | { family: 'root' };

export interface Action {
  ordinal: number;                 // global order inside the unit
  kind: CommandKind;
  target: ActionTarget;
  summary: string;                 // human-readable, e.g. "Replaced Mobile phone value"
  before: unknown;                 // state of the target before this action (derived at commit)
  after: unknown;                  // accepted values after this action
}

export type AuditSource = 'contact' | 'provisioning';

export interface AuditUnit {
  id: string;                      // dbrow_version, Int64 as decimal string
  tenantKey: string;
  actorKey: string;
  recordedAt: string;              // ISO 8601 UTC, server recording time
  source: AuditSource;
  contactKey: string;
  entityVersion: number;           // committed revision
  expectedEntityVersion: number;   // unit-entry token
  summary: string;
  actions: Action[];
  traceId: string;
  commands: Command[];             // request evidence (demo convenience)
  /** Present only for provisioning units: non-secret account facts. */
  account?: { loginName: string; initialRoleId: number | null };
}

export type OperationalCategory = 'operational' | 'sidekick' | 'presence';
export interface OperationalEvent {
  id: string;
  at: string;
  category: OperationalCategory;
  actorKey: string;
  contactKey: string | null;
  summary: string;
  detail: string | null;
  outcome: 'rejected' | 'uncertain' | 'info';
}

// ---- Problems (ProblemDetails subset) ---------------------------------------

export type ProblemCode =
  | 'validation' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict'
  | 'dependency' | 'history_unavailable' | 'commit_uncertain' | 'storage' | 'cancelled';

export interface Problem {
  status: number;
  code: ProblemCode;
  title: string;
  detail: string;
  traceId: string;
  automaticRetryAllowed: false;
  commandIndex?: number;
  currentEntityVersion?: number;
}

export function isProblem(x: unknown): x is Problem {
  return !!x && typeof x === 'object' && 'code' in (x as object) && 'status' in (x as object) && 'traceId' in (x as object);
}

export interface ChildIdentity { commandIndex: number; family: Family; ordinal: number }
export interface SaveResult {
  publicKey: string;
  entityVersion: number;
  auditDbrowVersion: string | null;
  childIdentities: ChildIdentity[];
}

// ---- Diff --------------------------------------------------------------------

export interface FieldDiff { field: string; label: string; old: unknown; new: unknown; technical?: boolean }
export interface ChildDiff {
  ref: ChildRef;
  kind: 'added' | 'removed' | 'changed';
  fields: FieldDiff[];
  old: Child | null;
  new: Child | null;
}
export interface RevisionDiff {
  from: number;
  to: number;
  profile: FieldDiff[];
  children: ChildDiff[];
  root: FieldDiff[];
  empty: boolean;
}

export function childKey(ref: ChildRef): string { return `${ref.family}#${ref.ordinal}`; }
export function parseChildKey(key: string): ChildRef | null {
  const m = /^(email|phone|web_link|address)#(\d+)$/.exec(key);
  return m ? { family: m[1] as Family, ordinal: Number(m[2]) } : null;
}
