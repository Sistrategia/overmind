// Personas are the demo's stand-in for issuer-signed claims (ADR 0015). Grants marked
// (proposed) do not exist in the current API; see CAPABILITY-MAP.md.
export type Grant =
  | 'create' | 'edit' | 'delete' | 'restore' | 'read_detail' | 'read_history' | 'read_directory'
  | 'activity' /* proposed: tenant activity explorer */
  | 'provision' /* iteration 6: overmind_provision */;

export interface Persona {
  key: string;
  actorKey: string;   // database public key (fiction)
  name: string;
  shortName: string;
  role: string;
  initials: string;
  hue: number;
  grants: Grant[];
  blurb: string;
}

const EDITOR: Grant[] = ['create', 'edit', 'read_detail', 'read_history'];

export const PERSONAS: Persona[] = [
  { key: 'mariana', actorKey: '6f1c2e4a-0b1d-4a52-9e3e-2a1f5c8d9b01', name: 'Mariana Ruiz', shortName: 'Mariana', role: 'Contact editor', initials: 'MR', hue: 262, grants: EDITOR,
    blurb: 'Edits contacts and reads their history. Cannot open tenant-wide activity.' },
  { key: 'bruno', actorKey: '3b7d9a10-5c2e-4f61-8d7a-1e0b4c6f2a02', name: 'Bruno Salas', shortName: 'Bruno', role: 'Contact editor', initials: 'BS', hue: 24, grants: EDITOR,
    blurb: 'Edits contacts and reads their history. Cannot open tenant-wide activity.' },
  { key: 'rocio', actorKey: 'a9e4b2c7-8d1f-4e33-b6a5-7c2d0f9e1b03', name: 'Rocío Herrera', shortName: 'Rocío', role: 'Administrator', initials: 'RH', hue: 200,
    grants: ['create', 'edit', 'delete', 'restore', 'read_detail', 'read_history', 'read_directory', 'activity', 'provision'],
    blurb: 'Full contact grants, provisioning and the tenant activity view.' },
  { key: 'tomas', actorKey: 'd2c8f6e1-4a9b-4d07-95e3-0b6a1c7d8e04', name: 'Tomás Vega', shortName: 'Tomás', role: 'Auditor (read-only)', initials: 'TV', hue: 150,
    grants: ['read_detail', 'read_history', 'read_directory', 'activity'],
    blurb: 'Reads every detail, revision and activity unit. Cannot stage or save any edit.' },
  { key: 'paola', actorKey: '5e0a7d3b-2f6c-4b18-a4d9-8c1e3f2b6a05', name: 'Paola Núñez', shortName: 'Paola', role: 'Front desk (directory only)', initials: 'PN', hue: 330,
    grants: ['read_directory'],
    blurb: 'Sees the public directory projection only: no private channels, no history.' }
];

export const SYSTEM_ACTOR = { actorKey: '71f092f4-3a35-463d-9589-e5ee1373f7d5', name: 'System', shortName: 'System', initials: 'SY', hue: 0 };

export function personaByKey(key: string | null | undefined): Persona {
  return PERSONAS.find(p => p.key === key) ?? PERSONAS[0];
}
export function personaByActor(actorKey: string): Persona | undefined {
  return PERSONAS.find(p => p.actorKey === actorKey);
}
export function actorName(actorKey: string): string {
  return personaByActor(actorKey)?.name ?? (actorKey === SYSTEM_ACTOR.actorKey ? 'System' : 'Unknown actor');
}
export function actorShort(actorKey: string): string {
  return personaByActor(actorKey)?.shortName ?? (actorKey === SYSTEM_ACTOR.actorKey ? 'System' : 'Unknown');
}
export function can(p: Persona, grant: Grant): boolean { return p.grants.includes(grant); }
