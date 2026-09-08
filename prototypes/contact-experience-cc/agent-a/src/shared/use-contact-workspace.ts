// Binds a contact to the workspace: committed state, the draft's base revision, the
// projected (base + pending) state and staging helpers. The projection is what an edit
// mode renders; the committed state is what history and reads report.
import { useCallback, useMemo } from 'react';
import {
  appendItems, emptyDraft, fieldsFromCommand, projectDraft, removeItem, stageChildDelete, stageChildInsert, stageChildMove,
  stageChildReplace, stageChildRestore, stageProfile, type ChildFields, type Draft, type DraftItem, type Projection
} from '../core/draft';
import type { ChildRef, ContactState, Family, Problem, Profile } from '../core/model';
import { familyOf, isChildCommand, opOf } from '../core/model';
import { can, type Persona } from '../core/personas';
import type { SidekickProposal } from '../core/sidekick';
import { useContact, useDraft, useSession, useWorkspace, type Workspace } from '../core/workspace';

export interface StageApi {
  replace: (ref: ChildRef, fields: ChildFields, origin?: DraftItem['origin'], note?: string | null) => Draft;
  insert: (family: Family, fields: ChildFields, origin?: DraftItem['origin']) => Draft;
  remove: (ref: ChildRef) => Draft;
  restore: (ref: ChildRef, fields: ChildFields) => Draft;
  move: (ref: ChildRef, displayOrder: number, origin?: DraftItem['origin']) => Draft;
  profile: (profile: Profile) => Draft;
  removeItem: (itemId: string) => Draft;
  clear: () => void;
  proposal: (p: SidekickProposal) => Draft;
}

export interface ContactWorkspace {
  contactKey: string | null;
  committed: ContactState | null;
  loading: boolean;
  problem: Problem | null;
  reload: () => void;
  base: ContactState | null;
  draft: Draft | null;
  projection: Projection | null;
  view: ContactState | null;
  stale: boolean;
  persona: Persona;
  canEdit: boolean;
  canHistory: boolean;
  stage: StageApi;
  ws: Workspace;
}

export function applyProposalToDraft(d: Draft, base: ContactState, p: SidekickProposal): Draft {
  let next = d;
  for (const item of p.items) {
    const c = item.command;
    if (c.kind === 'profile.replace') { next = stageProfile(next, base, c.profile, 'sidekick'); continue; }
    if (!isChildCommand(c)) { next = appendItems(next, [item]); continue; }
    const family = familyOf(c.kind), op = opOf(c.kind);
    if (op === 'insert') next = stageChildInsert(next, family, fieldsFromCommand(c), 'sidekick', item.note);
    else if (op === 'replace') next = stageChildReplace(next, base, { family, ordinal: c.ordinal! }, fieldsFromCommand(c), 'sidekick', item.note);
    else if (op === 'move') next = stageChildMove(next, base, { family, ordinal: c.ordinal! }, c.displayOrder!, 'sidekick', item.note);
    else if (op === 'delete') next = stageChildDelete(next, base, { family, ordinal: c.ordinal! }, 'sidekick');
    else if (op === 'restore') next = stageChildRestore(next, { family, ordinal: c.ordinal! }, fieldsFromCommand(c), 'sidekick');
  }
  return next;
}

export function useContactWorkspace(contactKey: string | null): ContactWorkspace {
  const ws = useWorkspace();
  const { persona, dataVersion } = useSession();
  const contact = useContact(contactKey);
  const draft = useDraft(contactKey);
  const committed = contact.data;

  const base = useMemo(() => {
    if (!contactKey) return null;
    if (draft) return ws.server.snapshotAt(contactKey, draft.baseVersion) ?? committed;
    return committed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactKey, draft?.baseVersion, committed, dataVersion]);

  const projection = useMemo(() => (base && draft ? projectDraft(base, draft, ws.server.catalog()) : null), [base, draft, ws]);
  const view = projection?.state ?? base;
  const stale = !!(draft && committed && draft.baseVersion < committed.entityVersion);
  const canEdit = can(persona, 'edit');
  const canHistory = can(persona, 'read_history') && can(persona, 'read_detail');

  const current = useCallback((): Draft => {
    const d = ws.draftFor(contactKey!);
    return d ?? emptyDraft(contactKey!, base!.entityVersion);
  }, [ws, contactKey, base]);
  const commit = useCallback((d: Draft): Draft => { ws.setDraft(contactKey!, d); return d; }, [ws, contactKey]);

  const stage = useMemo<StageApi>(() => ({
    replace: (ref, fields, origin = 'user', note = null) => commit(stageChildReplace(current(), base!, ref, fields, origin, note)),
    insert: (family, fields, origin = 'user') => commit(stageChildInsert(current(), family, fields, origin)),
    remove: ref => commit(stageChildDelete(current(), base!, ref)),
    restore: (ref, fields) => commit(stageChildRestore(current(), ref, fields)),
    move: (ref, displayOrder, origin = 'user') => commit(stageChildMove(current(), base!, ref, displayOrder, origin)),
    profile: profile => commit(stageProfile(current(), base!, profile)),
    removeItem: itemId => commit(removeItem(current(), itemId)),
    clear: () => { ws.setDraft(contactKey!, null); },
    proposal: p => commit(applyProposalToDraft(current(), base!, p))
  }), [commit, current, base, ws, contactKey]);

  return { contactKey, committed, loading: contact.loading, problem: contact.problem, reload: contact.reload, base, draft, projection, view, stale, persona, canEdit, canHistory, stage, ws };
}
