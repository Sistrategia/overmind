// The Save state machine shared by all variants: one request per Save, stale drafts go to
// reconciliation, uncertain commits go to investigation. Never a silent overwrite or retry.
import { useCallback, useState } from 'react';
import { applyReconciliation, draftCommands, reconcile, type Draft, type ReconcileReport, type Resolution } from '../core/draft';
import type { AuditUnit, ContactState, Problem, SaveResult } from '../core/model';
import { isProblem } from '../core/model';
import type { ContactWorkspace } from './use-contact-workspace';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; result: SaveResult; at: number }
  | { kind: 'conflict'; report: ReconcileReport; base: ContactState; draft: Draft }
  | { kind: 'uncertain'; problem: Problem; baseVersion: number }
  | { kind: 'error'; problem: Problem };

export interface SaveFlow {
  status: SaveStatus;
  save: (draftOverride?: Draft) => Promise<boolean>;
  openConflict: () => void;
  resolveAndSave: (resolutions: Record<string, Resolution>) => Promise<boolean>;
  resolveOnly: (resolutions: Record<string, Resolution>) => void;
  discardDraft: () => void;
  dismiss: () => void;
  checkAfterUncertain: () => Promise<{ entityVersion: number; unit: AuditUnit | null }>;
}

export function useSaveFlow(cw: ContactWorkspace): SaveFlow {
  const { ws, contactKey } = cw;
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  const buildConflict = useCallback((d: Draft, currentVersion: number): SaveStatus => {
    const base = ws.server.snapshotAt(contactKey!, d.baseVersion)!;
    const cur = ws.server.snapshotAt(contactKey!, currentVersion)!;
    const theirUnits = ws.server.unitsFor(contactKey!).filter(u => u.entityVersion > d.baseVersion && u.entityVersion <= currentVersion);
    return { kind: 'conflict', report: reconcile(d, base, cur, theirUnits), base, draft: d };
  }, [ws, contactKey]);

  const save = useCallback(async (draftOverride?: Draft): Promise<boolean> => {
    const d = draftOverride ?? ws.draftFor(contactKey!);
    if (!d || !d.items.length || !contactKey) return false;
    const persona = ws.session.get().persona;
    const known = ws.server.currentVersion(contactKey);
    if (known > d.baseVersion) {
      // The tab already knows the revision moved: do not send a request that must fail.
      ws.api.log.set(prev => [{ id: Date.now(), at: new Date().toISOString(), method: 'POST', path: `/api/contacts/${contactKey.slice(0, 8)}…/save`, status: 0, contract: 'local' as const, note: `withheld: draft base ${d.baseVersion} < current ${known}`, ms: 0 }, ...prev].slice(0, 40));
      setStatus(buildConflict(d, known));
      return false;
    }
    setStatus({ kind: 'saving' });
    const r = await ws.api.save(contactKey, d.baseVersion, draftCommands(d), persona);
    if (isProblem(r)) {
      if (r.code === 'conflict' && r.currentEntityVersion) {
        ws.server.logOperational({ category: 'operational', actorKey: persona.actorKey, contactKey, outcome: 'rejected', summary: `Save rejected: stale revision (expected ${d.baseVersion}, current ${r.currentEntityVersion})`, detail: `HTTP 409 conflict, traceId ${r.traceId}. Draft kept for reconciliation.` });
        setStatus(buildConflict(d, r.currentEntityVersion));
        return false;
      }
      if (r.code === 'commit_uncertain') {
        ws.server.logOperational({ category: 'operational', actorKey: persona.actorKey, contactKey, outcome: 'uncertain', summary: 'Save acknowledgement lost (commit_uncertain)', detail: `HTTP 500 commit_uncertain, traceId ${r.traceId}. Outcome investigated by the user; no automatic replay.` });
        setStatus({ kind: 'uncertain', problem: r, baseVersion: d.baseVersion });
        return false;
      }
      if (r.code === 'forbidden') ws.server.logOperational({ category: 'operational', actorKey: persona.actorKey, contactKey, outcome: 'rejected', summary: `Save rejected: ${persona.shortName} has no edit grant`, detail: `HTTP 403 forbidden, traceId ${r.traceId}.` });
      setStatus({ kind: 'error', problem: r });
      return false;
    }
    ws.setDraft(contactKey, null);
    setStatus({ kind: 'saved', result: r, at: Date.now() });
    ws.toast('success', r.auditDbrowVersion ? `Saved together as revision ${r.entityVersion}.` : `Nothing changed: the contact stays at revision ${r.entityVersion}.`);
    return true;
  }, [ws, contactKey, buildConflict]);

  const openConflict = useCallback(() => {
    const d = ws.draftFor(contactKey!);
    if (!d) return;
    setStatus(buildConflict(d, ws.server.currentVersion(contactKey!)));
  }, [ws, contactKey, buildConflict]);

  const resolveAndSave = useCallback(async (resolutions: Record<string, Resolution>) => {
    if (status.kind !== 'conflict') return false;
    const rebased = applyReconciliation(status.report, status.draft, resolutions);
    ws.setDraft(contactKey!, rebased);
    if (!rebased.items.length) { setStatus({ kind: 'idle' }); ws.toast('info', 'Nothing left to save after taking their changes.'); return true; }
    setStatus({ kind: 'idle' });
    return save(rebased);
  }, [status, ws, contactKey, save]);

  const resolveOnly = useCallback((resolutions: Record<string, Resolution>) => {
    if (status.kind !== 'conflict') return;
    const rebased = applyReconciliation(status.report, status.draft, resolutions);
    ws.setDraft(contactKey!, rebased.items.length ? rebased : null);
    setStatus({ kind: 'idle' });
    ws.toast('info', `Draft rebased onto revision ${status.report.currentVersion}. Nothing saved yet.`);
  }, [status, ws, contactKey]);

  const discardDraft = useCallback(() => { ws.setDraft(contactKey!, null); setStatus({ kind: 'idle' }); }, [ws, contactKey]);
  const dismiss = useCallback(() => setStatus({ kind: 'idle' }), []);

  const checkAfterUncertain = useCallback(async () => {
    const c = await ws.api.getCurrent(contactKey!, ws.session.get().persona);
    const entityVersion = isProblem(c) ? ws.server.currentVersion(contactKey!) : c.entityVersion;
    const unit = ws.server.unitsFor(contactKey!).find(u => u.entityVersion === entityVersion) ?? null;
    if (status.kind === 'uncertain' && entityVersion > status.baseVersion && unit?.actorKey === ws.session.get().persona.actorKey) {
      // The Save did commit: the draft is now redundant, but leave the decision to the person.
      ws.bump();
    }
    return { entityVersion, unit };
  }, [ws, contactKey, status]);

  return { status, save, openConflict, resolveAndSave, resolveOnly, discardDraft, dismiss, checkAfterUncertain };
}
