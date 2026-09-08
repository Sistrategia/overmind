// Demo story: tenant Vértice Demo. Every seed is a Save request replayed through the
// engine at seed time, so state, diffs and action evidence cannot disagree.
import type { Command, OperationalEvent } from './model';
import { PERSONAS, SYSTEM_ACTOR } from './personas';

export const TENANT = { key: 'b4f1e2c3-7d8a-4e9f-a0b1-c2d3e4f5a601', name: 'Vértice Demo' };

/** Demo clock start: Thursday 10 Sep 2026, 12:00 in America/Mexico_City (18:00Z). Advances in real time. */
export const DEMO_NOW_ISO = '2026-09-10T18:00:00.000Z';

export const LINA_KEY = '0d3f8a2b-6c4e-4d1f-9a7b-5e8c1f2d3a11';
export const NORTE_KEY = '7a2e5c1d-3b9f-4e6a-8c0d-1f4b7e2a9c22';

export const CONTACT_SLUGS: Record<string, string> = {
  [LINA_KEY]: 'lina',
  [NORTE_KEY]: 'norte-taller'
};
for (const p of PERSONAS) CONTACT_SLUGS[p.actorKey] = p.key;

export function keyForSlug(slug: string): string | undefined {
  return Object.entries(CONTACT_SLUGS).find(([, s]) => s === slug)?.[0];
}

const P = Object.fromEntries(PERSONAS.map(p => [p.key, p.actorKey])) as Record<string, string>;

export interface SeedCommit {
  contactKey: string;
  actorKey: string;
  at: string;               // ISO UTC recording time
  summary: string;
  source: 'contact' | 'provisioning';
  commands: Command[];
  account?: { loginName: string; initialRoleId: number | null };
}

const OFFICE_ADDRESS_ORIGINAL = {
  streetName: 'Calle Morelos', extNumber: '25', intNumber: 'B', colony: 'Centro', zipCode: '62000',
  city: 'Cuernavaca', state: 'Morelos', country: 'México'
};

function personProfile(first: string, last1: string, last2: string | null, jobTitle: string | null) {
  return {
    contactTypeId: 1 as const, fullName: [first, last1, last2].filter(Boolean).join(' '), displayName: null,
    personFirstName: first, personLastName1: last1, personLastName2: last2, personAlias: null, jobTitle,
    summary: null, isPrivate: false, doNotContact: false, recruiting: false
  };
}

/** Seeds in global commit order (recording time ascending). */
export const SEEDS: SeedCommit[] = [
  // ---- Tenant setup: administrative provisioning (iteration 6 contract) ----------------
  { contactKey: P.rocio, actorKey: SYSTEM_ACTOR.actorKey, at: '2026-08-17T14:00:00Z', source: 'provisioning', summary: 'Provisioned administrator account for Rocío Herrera',
    account: { loginName: 'rocio.herrera@vertice-demo.mx', initialRoleId: 1 },
    commands: [{ kind: 'contact.create', profile: personProfile('Rocío', 'Herrera', null, 'Administradora') },
      { kind: 'email.insert', value: 'rocio.herrera@vertice-demo.mx', location: 'Work', isPublic: true }] },
  { contactKey: P.mariana, actorKey: P.rocio, at: '2026-08-17T14:20:00Z', source: 'provisioning', summary: 'Provisioned editor account for Mariana Ruiz',
    account: { loginName: 'mariana.ruiz@vertice-demo.mx', initialRoleId: 12 },
    commands: [{ kind: 'contact.create', profile: personProfile('Mariana', 'Ruiz', null, 'Editora de contactos') },
      { kind: 'email.insert', value: 'mariana.ruiz@vertice-demo.mx', location: 'Work', isPublic: true }] },
  { contactKey: P.bruno, actorKey: P.rocio, at: '2026-08-17T14:24:00Z', source: 'provisioning', summary: 'Provisioned editor account for Bruno Salas',
    account: { loginName: 'bruno.salas@vertice-demo.mx', initialRoleId: 12 },
    commands: [{ kind: 'contact.create', profile: personProfile('Bruno', 'Salas', null, 'Editor de contactos') },
      { kind: 'email.insert', value: 'bruno.salas@vertice-demo.mx', location: 'Work', isPublic: true }] },
  { contactKey: P.tomas, actorKey: P.rocio, at: '2026-08-17T14:31:00Z', source: 'provisioning', summary: 'Provisioned auditor account for Tomás Vega',
    account: { loginName: 'tomas.vega@vertice-demo.mx', initialRoleId: 20 },
    commands: [{ kind: 'contact.create', profile: personProfile('Tomás', 'Vega', null, 'Auditor interno') },
      { kind: 'email.insert', value: 'tomas.vega@vertice-demo.mx', location: 'Work', isPublic: true }] },
  { contactKey: P.paola, actorKey: P.rocio, at: '2026-08-17T14:35:00Z', source: 'provisioning', summary: 'Provisioned front-desk account for Paola Núñez',
    account: { loginName: 'paola.nunez@vertice-demo.mx', initialRoleId: 31 },
    commands: [{ kind: 'contact.create', profile: personProfile('Paola', 'Núñez', null, 'Recepción') },
      { kind: 'email.insert', value: 'paola.nunez@vertice-demo.mx', location: 'Work', isPublic: true }] },

  // ---- Lina Torres, revision 1 ----------------------------------------------------------
  { contactKey: LINA_KEY, actorKey: P.mariana, at: '2026-08-18T15:14:00Z', source: 'contact',
    summary: 'Created Lina Torres with two emails, a mobile phone, an office address and a website',
    commands: [
      { kind: 'contact.create', profile: personProfile('Lina', 'Torres', null, 'Directora de operaciones') },
      { kind: 'email.insert', value: 'lina.torres@vertice-demo.mx', location: 'Work', isPublic: true },
      { kind: 'email.insert', value: 'lina.ta@correo-personal.mx', location: 'Personal', isPublic: false },
      { kind: 'phone.insert', value: { number: '+52 777 312 3465' }, location: 'Mobile', isPublic: true },
      { kind: 'address.insert', value: OFFICE_ADDRESS_ORIGINAL, location: 'Office', isPublic: true },
      { kind: 'web_link.insert', value: { url: 'https://linatorres.mx', type: 'website', displayText: 'linatorres.mx' }, isPublic: true }
    ] },

  // ---- Norte Taller, revision 1 (organization; shares the original address value) -------
  { contactKey: NORTE_KEY, actorKey: P.bruno, at: '2026-08-20T16:30:00Z', source: 'contact',
    summary: 'Created Norte Taller with a contact email, workshop phone and address',
    commands: [
      { kind: 'contact.create', profile: { contactTypeId: 2, fullName: 'Norte Taller', displayName: null, personFirstName: null, personLastName1: null, personLastName2: null, personAlias: null, jobTitle: null, summary: 'Taller mecánico y de carrocería', isPrivate: false, doNotContact: false, recruiting: true } },
      { kind: 'email.insert', value: 'contacto@nortetaller.mx', location: 'Work', isPublic: true },
      { kind: 'phone.insert', value: { number: '55 4321 0987', defaultRegion: 'MX' }, location: 'Office', isPublic: true },
      { kind: 'address.insert', value: OFFICE_ADDRESS_ORIGINAL, location: 'Office', isPublic: true }
    ] },

  // ---- Lina, revision 2: corrected phone (split Mexican input) --------------------------
  { contactKey: LINA_KEY, actorKey: P.bruno, at: '2026-08-21T17:02:00Z', source: 'contact', summary: 'Corrected the mobile phone (digits were transposed)',
    commands: [{ kind: 'phone.replace', ordinal: 1, value: { number: '312 3456', defaultRegion: 'MX', areaCode: '777' }, location: 'Mobile', isPublic: true, extension: null }] },

  // ---- Lina, revision 3: changed primary email -------------------------------------------
  { contactKey: LINA_KEY, actorKey: P.mariana, at: '2026-08-28T22:40:00Z', source: 'contact', summary: 'Made the personal email primary at Lina\'s request',
    commands: [{ kind: 'email.move', ordinal: 2, displayOrder: 1 }] },

  // ---- Norte Taller, revision 2 (Monday of the demo week) ----------------------------------
  { contactKey: NORTE_KEY, actorKey: P.mariana, at: '2026-09-07T15:10:00Z', source: 'contact', summary: 'Relabelled the workshop phone',
    commands: [{ kind: 'phone.replace', ordinal: 1, value: { number: '+52 55 4321 0987' }, location: 'Taller', isPublic: true, extension: null }] },

  // ---- Lina, revision 4: mixed profile/phone/address Save ---------------------------------
  { contactKey: LINA_KEY, actorKey: P.bruno, at: '2026-09-07T16:25:00Z', source: 'contact', summary: 'Completed the surname, added the office phone and corrected the postal code',
    commands: [
      { kind: 'profile.replace', profile: { ...personProfile('Lina', 'Torres', 'Aguilar', 'Directora de operaciones'), displayName: 'Lina Torres' } },
      { kind: 'phone.insert', value: { number: '+52 55 5123 4567' }, location: 'Office', isPublic: false, extension: '12' },
      { kind: 'address.replace', ordinal: 1, value: { ...OFFICE_ADDRESS_ORIGINAL, zipCode: '62010' }, location: 'Office', isPublic: true }
    ] },

  // ---- Lina, revision 5: changed and changed back inside one Save --------------------------
  { contactKey: LINA_KEY, actorKey: P.mariana, at: '2026-09-08T15:05:00Z', source: 'contact', summary: 'Changed the work email domain, then changed it back before saving',
    commands: [
      { kind: 'email.replace', ordinal: 1, value: 'lina.torres@vertice-demo.com', location: 'Work', isPublic: true },
      { kind: 'email.replace', ordinal: 1, value: 'lina.torres@vertice-demo.mx', location: 'Work', isPublic: true }
    ] },

  // ---- Lina, revision 6: deleted child -------------------------------------------------------
  { contactKey: LINA_KEY, actorKey: P.bruno, at: '2026-09-09T19:47:00Z', source: 'contact', summary: 'Removed the work email after a bounce report',
    commands: [{ kind: 'email.delete', ordinal: 1 }] },

  // ---- Lina, revision 7: restored child (same identity, appended) ----------------------------
  { contactKey: LINA_KEY, actorKey: P.mariana, at: '2026-09-10T14:30:00Z', source: 'contact', summary: 'Restored the work email; the bounce was a mail-server outage',
    commands: [{ kind: 'email.restore', ordinal: 1, value: 'lina.torres@vertice-demo.mx', location: 'Work', isPublic: true }] }
];

/** Simulated operational events. These are NOT in the business audit. */
export const SEED_OPERATIONAL: OperationalEvent[] = [
  { id: 'op-seed-1', at: '2026-09-09T19:52:00Z', category: 'operational', actorKey: P.mariana, contactKey: LINA_KEY,
    summary: 'Save rejected: stale revision (expected 5, current 6)', detail: 'HTTP 409 conflict. The client reloaded revision 6 and Mariana discarded her draft.', outcome: 'rejected' }
];

export const FIRST_STAMP = 9007199254741001n; // above 2^53 on purpose: Int64 stays a string in JavaScript
