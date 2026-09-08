// Evidence presentation blocks: unit metadata, ordered actions, revision differences,
// and the uncertain-commit investigation panel.
import { useState, type ReactNode } from 'react';
import { childTitle, childValueText } from '../core/engine';
import { fmtDateTime, fmtUtc, TENANT_TZ_LABEL } from '../core/format';
import type { Action, AuditUnit, Child, ChildRef, Problem, RevisionDiff } from '../core/model';
import { childKey, FAMILY_LABEL } from '../core/model';
import { actorName } from '../core/personas';
import { Avatar, Badge, DiffMark, DiffValue, TechDetails } from './ui';

export function When({ iso, withUtc = true }: { iso: string; withUtc?: boolean }) {
  return <time dateTime={iso} title={withUtc ? fmtUtc(iso) : undefined}>{fmtDateTime(iso)} <span className="faint">{TENANT_TZ_LABEL}</span></time>;
}

export function UnitMeta({ unit, contactName, compact = false, extra }: { unit: AuditUnit; contactName?: string | null; compact?: boolean; extra?: ReactNode }) {
  return (
    <div className="unit-meta" data-testid="unit-meta">
      <div className="row wrap">
        <Avatar actorKey={unit.actorKey} />
        <span><strong>{actorName(unit.actorKey)}</strong> <span className="muted">saved revision {unit.entityVersion}{contactName ? ` of ${contactName}` : ''}</span></span>
        <Badge tone={unit.source === 'provisioning' ? 'accent' : ''}>{unit.source === 'provisioning' ? 'Provisioning' : 'Contact change'}</Badge>
        {extra}
      </div>
      <div className="small muted"><When iso={unit.recordedAt} /> · {unit.actions.length} action{unit.actions.length === 1 ? '' : 's'} · expected revision {unit.expectedEntityVersion}</div>
      {!compact && (
        <TechDetails summary="Technical stamps" rows={[
          ['dbrow_version', <span className="mono" key="v">{unit.id}</span>],
          ['entity_version', unit.entityVersion],
          ['traceId', unit.traceId],
          ['recordedAt (UTC)', fmtUtc(unit.recordedAt)],
          ['tenant', unit.tenantKey],
          ['contact', unit.contactKey],
          ...(unit.account ? [['account login', unit.account.loginName] as [string, ReactNode], ['initial role id', unit.account.initialRoleId ?? '—'] as [string, ReactNode]] : [])
        ]} />
      )}
    </div>
  );
}

function ActionPayload({ action }: { action: Action }) {
  const rows: [string, ReactNode][] = [['kind', action.kind], ['target', 'ordinal' in action.target ? `${action.target.family} #${action.target.ordinal}` : action.target.family]];
  const b = action.before as Record<string, unknown> | null, a = action.after as Record<string, unknown> | null;
  if (b) rows.push(['before', <code key="b" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(b, null, 0)}</code>]);
  if (a) rows.push(['after', <code key="a" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(a, null, 0)}</code>]);
  return <TechDetails summary="Action payload" rows={rows} />;
}

export function ActionsList({ actions, highlight, onFocus, dense }: { actions: Action[]; highlight?: string | null; onFocus?: (ref: ChildRef) => void; dense?: boolean }) {
  if (!actions.length) return <p className="small muted">No effective actions.</p>;
  return (
    <ol className={`actions ${dense ? 'dense' : ''}`} data-testid="actions-list">
      {actions.map(a => {
        const key = 'ordinal' in a.target ? childKey(a.target) : a.target.family;
        const isHi = highlight === key;
        return (
          <li key={a.ordinal} className={`action ${isHi ? 'hi' : ''}`} data-target={key}>
            <span className="action-n mono">{a.ordinal}</span>
            <div className="col" style={{ gap: 2 }}>
              <div className="row wrap">
                <code className="action-kind">{a.kind}</code>
                <span className="small">{a.summary}</span>
                {onFocus && 'ordinal' in a.target && <button className="btn quiet sm" onClick={() => onFocus(a.target as ChildRef)}>Show field</button>}
              </div>
              {!dense && <ActionPayload action={a} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function childName(c: Child | null | undefined, ref: ChildRef): string {
  return c ? childTitle(c) : `${FAMILY_LABEL[ref.family]} ${ref.ordinal}`;
}

export function DiffList({ diff, onFocus, showTechnical = false, emptyNote, highlight }: { diff: RevisionDiff; onFocus?: (ref: ChildRef) => void; showTechnical?: boolean; emptyNote?: ReactNode; highlight?: Set<string> | null }) {
  if (diff.empty) return <div className="diff-empty" data-testid="diff-empty"><Badge tone="hist">No net difference</Badge> <span className="small muted">{emptyNote ?? `Revision ${diff.to} ends with the same values as revision ${diff.from}.`}</span></div>;
  return (
    <div className="difflist" data-testid="diff-list">
      {diff.root.map(f => <div className="diffrow" key={f.field}><DiffMark kind="changed" /><span className="diff-label">{f.label}</span><DiffValue oldValue={f.old} newValue={f.new} /></div>)}
      {diff.profile.length > 0 && (
        <div className={`diffgroup ${highlight?.has('profile') ? 'hi' : ''}`} data-target="profile">
          <div className="diffgroup-title">Profile</div>
          {diff.profile.map(f => <div className="diffrow" key={f.field}><DiffMark kind="changed" /><span className="diff-label">{f.label}</span><DiffValue oldValue={f.old} newValue={f.new} /></div>)}
        </div>
      )}
      {diff.children.map(c => {
        const k = childKey(c.ref);
        const child = c.new ?? c.old!;
        return (
          <div key={k} className={`diffgroup ${highlight?.has(k) ? 'hi' : ''}`} data-target={k}>
            <div className="diffgroup-title row">
              <DiffMark kind={c.kind === 'changed' && c.fields.every(f => f.field === 'displayOrder') ? 'moved' : c.kind} />
              <span>{childName(child, c.ref)}</span>
              <span className="faint tiny">identity {c.ref.ordinal}</span>
              {onFocus && <button className="btn quiet sm" onClick={() => onFocus(c.ref)}>Show</button>}
            </div>
            {c.kind === 'added' && <div className="diffrow"><span className="diff-label">Value</span><DiffValue oldValue={null} newValue={childValueText(c.new!)} /><span className="small muted">position {c.new!.displayOrder}{c.new!.isPublic ? ', public' : ', private'}</span></div>}
            {c.kind === 'removed' && <div className="diffrow"><span className="diff-label">Value</span><DiffValue oldValue={childValueText(c.old!)} newValue={null} /><span className="small muted">identity retained; can be restored</span></div>}
            {c.kind === 'changed' && c.fields.filter(f => showTechnical || !f.technical).map(f => (
              <div className="diffrow" key={f.field}><span className="diff-label">{f.label}</span><DiffValue oldValue={f.old} newValue={f.new} />{f.field === 'displayOrder' && f.new === 1 && <Badge tone="accent">Primary</Badge>}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function UncertainOutcome({ problem, contactKey, baseVersion, onCheck, onOpenHistory, onDiscardDraft, onKeepDraft }: {
  problem: Problem; contactKey: string; baseVersion: number;
  onCheck: () => Promise<{ entityVersion: number; unit: AuditUnit | null }>;
  onOpenHistory: (rev: number) => void; onDiscardDraft: () => void; onKeepDraft: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ entityVersion: number; unit: AuditUnit | null } | null>(null);
  void contactKey;
  return (
    <div className="problem warn" role="alert" data-testid="uncertain-outcome">
      <div className="row"><strong>Save outcome unknown</strong><span className="code">HTTP {problem.status} · {problem.code}</span></div>
      <p className="small">{problem.detail}</p>
      <p className="small muted">The server never splits or automatically retries a Save, and this prototype does not either. Investigate first: if the revision advanced with your changes, the Save committed; if not, you can send it again as a new request.</p>
      <div className="row wrap">
        <button className="btn primary sm" disabled={checking} onClick={async () => { setChecking(true); setResult(await onCheck()); setChecking(false); }} data-testid="uncertain-check">{checking ? 'Checking…' : 'Check current revision'}</button>
        <button className="btn sm" onClick={onKeepDraft}>Keep my draft</button>
        <button className="btn sm quiet" onClick={onDiscardDraft}>Discard draft</button>
      </div>
      {result && (
        <div className="small" data-testid="uncertain-result" style={{ marginTop: 6 }}>
          {result.entityVersion > baseVersion
            ? <><Badge tone="ok">Committed</Badge> The contact is now at revision {result.entityVersion}{result.unit ? `, saved by ${actorName(result.unit.actorKey)} at ${fmtDateTime(result.unit.recordedAt)}` : ''}. Compare it with your draft before doing anything else. <button className="btn sm" onClick={() => onOpenHistory(result.entityVersion)}>Open revision {result.entityVersion}</button></>
            : <><Badge tone="warn">Not committed</Badge> The contact is still at revision {result.entityVersion}. Your draft is intact; saving again sends a new request against revision {result.entityVersion}.</>}
        </div>
      )}
      <TechDetails rows={[['traceId', problem.traceId], ['automaticRetryAllowed', 'false'], ['provisional stamp', 'not returned by design']]} />
    </div>
  );
}
