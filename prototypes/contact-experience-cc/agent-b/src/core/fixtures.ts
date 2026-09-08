// Shared demo story: tenant Vértice Demo, person Lina Torres, organization Norte Taller,
// person Rodrigo Ibarra, four personas. Revisions are computed by replaying commands through
// the same engine the simulated server uses, so snapshots, actions and diffs stay consistent.
import type {
  Action,
  AuditUnit,
  Command,
  ContactId,
  ContactState,
  Persona,
  PersonaId,
  Revision,
  Tenant,
} from './types';
import { applyCommands } from './engine';

export const TENANT: Tenant = {
  id: '7d2f3a10-9c4e-4b8a-a1d2-3e4f5a6b7c8d',
  name: 'Vértice Demo',
  timeZone: 'America/Mexico_City',
  timeZoneLabel: 'CDMX (UTC−6)',
};

export const CONTACT_IDS = {
  lina: 'c0a1e2d3-4b5c-4d6e-8f70-1a2b3c4d5e01',
  norte: 'c0a1e2d3-4b5c-4d6e-8f70-1a2b3c4d5e02',
  rodrigo: 'c0a1e2d3-4b5c-4d6e-8f70-1a2b3c4d5e03',
} as const;

export const PERSONAS: Persona[] = [
  {
    id: 'mariana',
    actorKey: 'a1b2c3d4-0001-4a1b-9c2d-0e1f2a3b4c01',
    name: 'Mariana',
    fullName: 'Mariana Solís',
    role: 'Contact editor',
    initials: 'MS',
    hue: 262,
    grants: ['create:*', 'edit:*', 'read_detail:*', 'read_history:*', 'read_directory:*'],
    proposed: ['presence:*'],
  },
  {
    id: 'bruno',
    actorKey: 'a1b2c3d4-0002-4a1b-9c2d-0e1f2a3b4c02',
    name: 'Bruno',
    fullName: 'Bruno Castañeda',
    role: 'Contact editor',
    initials: 'BC',
    hue: 160,
    grants: ['create:*', 'edit:*', 'read_detail:*', 'read_history:*', 'read_directory:*'],
    proposed: ['presence:*'],
  },
  {
    id: 'sofia',
    actorKey: 'a1b2c3d4-0003-4a1b-9c2d-0e1f2a3b4c03',
    name: 'Sofía',
    fullName: 'Sofía Reyes',
    role: 'Administrator',
    initials: 'SR',
    hue: 20,
    grants: ['create:*', 'edit:*', 'delete:*', 'restore:*', 'read_detail:*', 'read_history:*', 'read_directory:*'],
    proposed: ['read_activity:*', 'presence:*', 'provision:*'],
  },
  {
    id: 'diego',
    actorKey: 'a1b2c3d4-0004-4a1b-9c2d-0e1f2a3b4c04',
    name: 'Diego',
    fullName: 'Diego Lara',
    role: 'Auditor (read-only)',
    initials: 'DL',
    hue: 205,
    grants: [`read_detail:${CONTACT_IDS.lina}`, `read_history:${CONTACT_IDS.lina}`, 'read_directory:*'],
    proposed: ['read_activity:*', 'presence:*'],
  },
];

export function personaById(id: PersonaId): Persona {
  return PERSONAS.find((p) => p.id === id)!;
}

/** Local CDMX wall time (UTC−6, no DST since 2022) to ISO instant. */
export function t(local: string): string {
  return new Date(`${local.replace(' ', 'T')}:00-06:00`).toISOString();
}

export const TODAY = '2026-09-07';

// ---- Initial states ----

const linaRev1: ContactState = {
  profile: {
    contactTypeId: 1,
    fullName: 'Lina Torres Aguilar',
    displayName: null,
    personFirstName: 'Lina',
    personLastName1: 'Torres',
    personLastName2: 'Aguilar',
    personAlias: null,
    summary: null,
    doNotContact: false,
    isPrivate: false,
  },
  emails: [],
  phones: [],
  webLinks: [],
  addresses: [],
  deleted: false,
};

const linaCreate: Command[] = [
  { kind: 'email.insert', value: 'linatorres.ag@mail.example', location: 'Personal', isPublic: false },
  { kind: 'email.insert', value: 'lina.torres@verticedemo.mx', location: 'Work', isPublic: true },
  { kind: 'phone.insert', value: { number: '312-3465', defaultRegion: 'MX', areaCode: '777' }, location: 'Mobile', isPublic: true },
  { kind: 'phone.insert', value: { number: '+52 55 5254 0800' }, location: 'Office', isPublic: false, extension: '14' },
  { kind: 'web_link.insert', value: { url: 'https://linatorres.example', title: 'Portfolio' }, isPublic: true },
  {
    kind: 'address.insert',
    value: { streetName: 'Calle Morrow', extNumber: '12', colony: 'Centro', city: 'Cuernavaca', state: 'Morelos', zipCode: '62000', country: 'México' },
    location: 'Home',
    isPublic: false,
  },
];

const norteRev1: ContactState = {
  profile: {
    contactTypeId: 2,
    fullName: 'Norte Taller S.A. de C.V.',
    displayName: 'Norte Taller',
    personFirstName: null,
    personLastName1: null,
    personLastName2: null,
    personAlias: null,
    summary: 'Industrial workshop, Monterrey',
    doNotContact: false,
    isPrivate: false,
  },
  emails: [],
  phones: [],
  webLinks: [],
  addresses: [],
  deleted: false,
};

const norteCreate: Command[] = [
  { kind: 'email.insert', value: 'ventas@nortetaller.example', location: 'Sales', isPublic: true },
  { kind: 'email.insert', value: 'facturacion@nortetaller.example', location: 'Billing', isPublic: false },
  { kind: 'phone.insert', value: { number: '+52 81 8340 1122' }, location: 'Main', isPublic: true },
  { kind: 'phone.insert', value: { number: '8340-1123', defaultRegion: 'MX', areaCode: '81' }, location: 'Warehouse', isPublic: false, extension: '301' },
  { kind: 'web_link.insert', value: { url: 'https://nortetaller.example', title: 'Website' }, isPublic: true },
  {
    kind: 'address.insert',
    value: { streetName: 'Av. Constitución', extNumber: '2020', colony: 'Centro', city: 'Monterrey', state: 'Nuevo León', zipCode: '64000', country: 'México' },
    location: 'Office',
    isPublic: true,
  },
];

const rodrigoRev1: ContactState = {
  profile: {
    contactTypeId: 1,
    fullName: 'Rodrigo Ibarra Peña',
    displayName: 'Rodrigo Ibarra',
    personFirstName: 'Rodrigo',
    personLastName1: 'Ibarra',
    personLastName2: 'Peña',
    personAlias: null,
    summary: null,
    doNotContact: false,
    isPrivate: false,
  },
  emails: [],
  phones: [],
  webLinks: [],
  addresses: [],
  deleted: false,
};

const rodrigoCreate: Command[] = [
  { kind: 'email.insert', value: 'rodrigo.ibarra@verticedemo.mx', location: 'Work', isPublic: true },
  { kind: 'phone.insert', value: { number: '318-9900', defaultRegion: 'MX', areaCode: '777' }, location: 'Cel', isPublic: true },
  {
    kind: 'address.insert',
    // Same immutable address value as Lina's original home address (shared catalog value, not a relationship).
    value: { streetName: 'Calle Morrow', extNumber: '12', colony: 'Centro', city: 'Cuernavaca', state: 'Morelos', zipCode: '62000', country: 'México' },
    location: 'Home',
    isPublic: false,
  },
];

// ---- Story steps ----

interface Step {
  contactId: ContactId;
  actorId: PersonaId;
  at: string;
  kind: AuditUnit['kind'];
  summary: string;
  commands: Command[];
  batchId?: string;
  extraActions?: Action[]; // e.g. account creation evidence
  detail?: Record<string, string>;
}

const STEPS: Step[] = [
  { contactId: CONTACT_IDS.lina, actorId: 'bruno', at: t('2026-08-18 10:12'), kind: 'contact.create', summary: 'Created Lina Torres with 2 emails, 2 phones, 1 web link and 1 address', commands: linaCreate },
  { contactId: CONTACT_IDS.rodrigo, actorId: 'sofia', at: t('2026-08-19 15:20'), kind: 'contact.create', summary: 'Created Rodrigo Ibarra with 1 email, 1 phone and 1 address', commands: rodrigoCreate },
  { contactId: CONTACT_IDS.norte, actorId: 'sofia', at: t('2026-08-20 09:00'), kind: 'contact.create', summary: 'Created Norte Taller with 2 emails, 2 phones, 1 web link and 1 address', commands: norteCreate },
  {
    contactId: CONTACT_IDS.rodrigo,
    actorId: 'sofia',
    at: t('2026-08-25 09:05'),
    kind: 'user.provision',
    summary: 'Promoted Rodrigo Ibarra to a user account (Contact editor)',
    commands: [],
    extraActions: [
      { seq: 1, family: 'account', kind: 'account.create', ordinal: null, summary: 'Account created: login rodrigo.ibarra@verticedemo.mx, initial role Contact editor (12)', before: null, after: 'rodrigo.ibarra@verticedemo.mx' },
    ],
    detail: { login: 'rodrigo.ibarra@verticedemo.mx', initialRoleId: '12', note: 'Password set by the administrator; never stored in history.' },
  },
  {
    contactId: CONTACT_IDS.lina,
    actorId: 'bruno',
    at: t('2026-09-01 10:40'),
    kind: 'contact.save',
    summary: 'Corrected the mobile number (transposed digits)',
    commands: [{ kind: 'phone.replace', ordinal: 1, value: { number: '312-3456', defaultRegion: 'MX', areaCode: '777' }, location: 'Mobile', isPublic: true }],
  },
  {
    contactId: CONTACT_IDS.norte,
    actorId: 'bruno',
    at: t('2026-09-02 09:30'),
    kind: 'contact.save',
    summary: 'Updated the warehouse extension',
    commands: [{ kind: 'phone.replace', ordinal: 2, value: { number: '8340-1123', defaultRegion: 'MX', areaCode: '81' }, location: 'Warehouse', isPublic: false, extension: '305' }],
  },
  {
    contactId: CONTACT_IDS.lina,
    actorId: 'mariana',
    at: t('2026-09-02 16:05'),
    kind: 'contact.save',
    summary: 'Fixed the work email domain and made it primary',
    commands: [
      { kind: 'email.replace', ordinal: 2, value: 'lina.torres@vertice-demo.mx', location: 'Work', isPublic: true },
      { kind: 'email.move', ordinal: 2, displayOrder: 1 },
    ],
  },
  {
    contactId: CONTACT_IDS.lina,
    actorId: 'bruno',
    at: t('2026-09-03 11:20'),
    kind: 'contact.save',
    summary: 'Saved together: display name, office extension and home address',
    commands: [
      {
        kind: 'profile.replace',
        profile: {
          contactTypeId: 1,
          fullName: 'Lina Torres Aguilar',
          displayName: 'Lina Torres',
          personFirstName: 'Lina',
          personLastName1: 'Torres',
          personLastName2: 'Aguilar',
          personAlias: null,
          summary: 'Prefers email; calls after 10:00',
          doNotContact: false,
          isPrivate: false,
        },
      },
      { kind: 'phone.replace', ordinal: 2, value: { number: '+52 55 5254 0800' }, location: 'Office', isPublic: false, extension: '22' },
      {
        kind: 'address.replace',
        ordinal: 1,
        value: { streetName: 'Calle Morrow', extNumber: '12', intNumber: 'B', colony: 'Centro', city: 'Cuernavaca', state: 'Morelos', zipCode: '62000', country: 'México' },
        location: 'Home',
        isPublic: false,
      },
    ],
  },
  {
    contactId: CONTACT_IDS.lina,
    actorId: 'mariana',
    at: t('2026-09-04 09:55'),
    kind: 'contact.save',
    summary: 'Changed the personal email label and changed it back in the same Save',
    commands: [
      { kind: 'email.replace', ordinal: 1, value: 'linatorres.ag@mail.example', location: 'Home', isPublic: false },
      { kind: 'email.replace', ordinal: 1, value: 'linatorres.ag@mail.example', location: 'Personal', isPublic: false },
    ],
  },
  {
    contactId: CONTACT_IDS.lina,
    actorId: 'sofia',
    at: t('2026-09-05 13:30'),
    kind: 'contact.save',
    summary: 'Removed the portfolio link',
    commands: [{ kind: 'web_link.delete', ordinal: 1 }],
  },
  {
    contactId: CONTACT_IDS.norte,
    actorId: 'sofia',
    at: t('2026-09-05 17:00'),
    kind: 'contact.save',
    summary: 'Batch: relabeled the main phone “Main” → “Switchboard”',
    commands: [{ kind: 'phone.replace', ordinal: 1, value: { number: '+52 81 8340 1122' }, location: 'Switchboard', isPublic: true }],
    batchId: 'batch-20260905-labels',
  },
  {
    contactId: CONTACT_IDS.rodrigo,
    actorId: 'sofia',
    at: t('2026-09-05 17:00'),
    kind: 'contact.save',
    summary: 'Batch: relabeled the phone “Cel” → “Mobile”',
    commands: [{ kind: 'phone.replace', ordinal: 1, value: { number: '318-9900', defaultRegion: 'MX', areaCode: '777' }, location: 'Mobile', isPublic: true }],
    batchId: 'batch-20260905-labels',
  },
  {
    contactId: CONTACT_IDS.lina,
    actorId: 'bruno',
    at: t('2026-09-06 08:15'),
    kind: 'contact.save',
    summary: 'Restored the portfolio link with the new URL',
    commands: [{ kind: 'web_link.restore', ordinal: 1, value: { url: 'https://linatorres.example/2026', title: 'Portfolio' }, isPublic: true }],
  },
];

/** Bruno's revision 4 as a replayable unit for the conflict rehearsal (same content as the story). */
export const BRUNO_REV4_COMMANDS: Command[] = STEPS[7]!.commands;
export const BRUNO_REV4_SUMMARY = STEPS[7]!.summary;

const INITIAL: Record<ContactId, ContactState> = {
  [CONTACT_IDS.lina]: linaRev1,
  [CONTACT_IDS.norte]: norteRev1,
  [CONTACT_IDS.rodrigo]: rodrigoRev1,
};

export const CONTACT_NAMES: Record<ContactId, string> = {
  [CONTACT_IDS.lina]: 'Lina Torres',
  [CONTACT_IDS.norte]: 'Norte Taller',
  [CONTACT_IDS.rodrigo]: 'Rodrigo Ibarra',
};

function corr(seed: string): string {
  // deterministic pseudo GUID for trace/correlation ids
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).padStart(8, '0');
  return `${hex}-4c0d-4e1f-9a2b-${seed.length.toString(16).padStart(4, '0')}${hex.slice(0, 8)}`;
}

export interface StoryData {
  revisions: Record<ContactId, Revision[]>;
  units: AuditUnit[];
  nextStamp: string;
}

const STAMP_START = 3000178300n;
const STAMP_GAPS = [18n, 2n, 3n, 11n, 9n, 7n, 4n, 13n, 5n, 6n, 2n, 1n, 8n];

export function buildStory(options: { upToLinaRevision?: number } = {}): StoryData {
  const revisions: Record<ContactId, Revision[]> = {};
  const units: AuditUnit[] = [];
  const state: Record<ContactId, ContactState> = { ...INITIAL };
  let stamp = STAMP_START;
  const limit = options.upToLinaRevision ?? Infinity;
  let linaRevs = 0;

  STEPS.forEach((step, i) => {
    if (step.contactId === CONTACT_IDS.lina && linaRevs >= limit) return;
    stamp += STAMP_GAPS[i % STAMP_GAPS.length]!;
    const before = state[step.contactId]!;
    const result = applyCommands(before, step.commands, { allocate: 'server' });
    const list = (revisions[step.contactId] ??= []);
    const entityVersion = list.length + 1;
    let actions = result.actions;
    if (step.kind === 'contact.create') {
      // Initial child actions are hidden in favor of the parent creation event (phone-family.md).
      actions = [
        { seq: 1, family: 'contact', kind: 'contact.create', ordinal: null, summary: step.summary, before: null, after: before.profile.fullName },
      ];
    }
    if (step.extraActions) actions = [...actions, ...step.extraActions.map((a, k) => ({ ...a, seq: actions.length + k + 1 }))];
    const rev: Revision = {
      contactId: step.contactId,
      entityVersion,
      unitStamp: stamp.toString(),
      actorId: step.actorId,
      at: step.at,
      summary: step.summary,
      state: result.state,
      actions,
    };
    list.push(rev);
    state[step.contactId] = result.state;
    if (step.contactId === CONTACT_IDS.lina) linaRevs++;
    const families = Array.from(new Set(actions.map((a) => a.family)));
    units.push({
      stamp: stamp.toString(),
      at: step.at,
      actorId: step.actorId,
      source: 'business',
      kind: step.kind,
      summary: step.summary,
      contacts: [{ contactId: step.contactId, entityVersion }],
      families,
      actions,
      correlationId: corr(`unit-${stamp}`),
      batchId: step.batchId ?? null,
      detail: {
        ...(step.detail ?? {}),
        tenant: TENANT.id,
        actorKey: personaById(step.actorId).actorKey,
        dbrowVersion: stamp.toString(),
      },
    });
  });

  // Simulated administrative batch parent (proposed; the Save endpoint stays single-contact).
  const batchChildren = units.filter((u) => u.batchId === 'batch-20260905-labels');
  if (batchChildren.length) {
    units.push({
      stamp: 'batch-20260905-labels',
      at: batchChildren[0]!.at,
      actorId: 'sofia',
      source: 'batch',
      kind: 'admin.batch',
      summary: `Administrative batch: standardized phone labels on ${batchChildren.length} contacts`,
      contacts: batchChildren.map((u) => u.contacts[0]!),
      families: ['phone'],
      actions: [],
      correlationId: corr('batch-20260905-labels'),
      batchId: 'batch-20260905-labels',
      detail: {
        note: 'One simulated batch = one single-contact Save per contact. The current API has no multi-contact Save.',
        units: batchChildren.map((u) => u.stamp).join(', '),
      },
    });
  }

  if (limit === Infinity) {
    // Non-business entries with distinct sources. These are NOT in the business audit ledger.
    units.push(
      {
        stamp: 'op-20260906-1802',
        at: t('2026-09-06 18:02'),
        actorId: 'mariana',
        source: 'operational',
        kind: 'save.uncertain',
        summary: 'Save acknowledgement uncertain (500 commit_uncertain) on Lina Torres',
        contacts: [{ contactId: CONTACT_IDS.lina, entityVersion: null }],
        families: ['phone'],
        actions: [],
        correlationId: corr('op-20260906-1802'),
        batchId: null,
        detail: {
          source: 'Application operational log (simulated), not the business audit',
          outcome: 'Unknown at the time. Later check: current revision remained 7, so this Save did not commit.',
          traceId: corr('trace-20260906-1802'),
        },
      },
      {
        stamp: 'op-20260907-0941',
        at: t('2026-09-07 09:41'),
        actorId: 'mariana',
        source: 'operational',
        kind: 'save.rejected',
        summary: 'Save rejected: stale revision (409 conflict) on Lina Torres — expected 6, current 7',
        contacts: [{ contactId: CONTACT_IDS.lina, entityVersion: 7 }],
        families: ['email'],
        actions: [],
        correlationId: corr('op-20260907-0941'),
        batchId: null,
        detail: {
          source: 'Application operational log (simulated), not the business audit',
          note: 'Rejected attempts leave no business revision. A durable security/attempt log is separate work.',
        },
      },
      {
        stamp: 'agent-20260907-0938',
        at: t('2026-09-07 09:38'),
        actorId: 'mariana',
        source: 'agent',
        kind: 'sidekick.proposal',
        summary: 'Sidekick staged a proposal for Mariana (2 changes) — not saved',
        contacts: [{ contactId: CONTACT_IDS.lina, entityVersion: 7 }],
        families: ['phone', 'email'],
        actions: [],
        correlationId: corr('agent-20260907-0938'),
        batchId: null,
        detail: { source: 'Simulated agent activity (local)', note: 'A proposal is a local draft until a person applies it as one Save.' },
      },
      {
        stamp: 'presence-20260907-0935',
        at: t('2026-09-07 09:35'),
        actorId: 'bruno',
        source: 'presence',
        kind: 'presence.view',
        summary: 'Bruno viewed Lina Torres (phones)',
        contacts: [{ contactId: CONTACT_IDS.lina, entityVersion: 7 }],
        families: [],
        actions: [],
        correlationId: corr('presence-20260907-0935'),
        batchId: null,
        detail: { source: 'Simulated presence (local BroadcastChannel)', note: 'Presence is awareness, not a lock or an audit record.' },
      },
    );
  }

  units.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { revisions, units, nextStamp: (stamp + 17n).toString() };
}
