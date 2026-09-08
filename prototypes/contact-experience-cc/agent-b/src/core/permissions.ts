import type { ContactId, ContactState, Persona } from './types';
import { liveChildren } from './format';

export type Permission = 'create' | 'edit' | 'delete' | 'restore' | 'read_detail' | 'read_history' | 'read_directory';
export type ProposedCapability = 'read_activity' | 'presence' | 'provision';

export function hasGrant(persona: Persona, permission: Permission, contactId?: ContactId): boolean {
  return persona.grants.some((g) => g === `${permission}:*` || (contactId !== undefined && g === `${permission}:${contactId}`));
}

export function hasProposed(persona: Persona, capability: ProposedCapability): boolean {
  return persona.proposed.some((g) => g === `${capability}:*`);
}

/** Limited current directory projection (ReadDirectory): public live channels only, order preserved with gaps. */
export function directoryProjection(state: ContactState): ContactState | null {
  if (state.deleted || state.profile.isPrivate) return null;
  const onlyPublic = <T>(list: { ordinal: number; displayOrder: number; value: T; location: string | null; isPublic: boolean; extension: string | null; deleted: boolean }[]) =>
    liveChildren(list).filter((c) => c.isPublic);
  return {
    profile: {
      contactTypeId: state.profile.contactTypeId,
      fullName: state.profile.displayName ?? state.profile.fullName,
      displayName: state.profile.displayName ?? state.profile.fullName,
      personFirstName: null,
      personLastName1: null,
      personLastName2: null,
      personAlias: null,
      summary: null,
      doNotContact: false,
      isPrivate: false,
    },
    emails: onlyPublic(state.emails),
    phones: onlyPublic(state.phones).map((p) => ({ ...p })),
    webLinks: onlyPublic(state.webLinks),
    addresses: onlyPublic(state.addresses),
    deleted: false,
  };
}
