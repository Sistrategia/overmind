import React, { useMemo, useState } from 'react';
import type { CasefileNav } from './CasefileApp';
import { Avatar } from './CasefileApp';
import { useWorkspace } from '../../core/store';
import { useRevisionView } from '../../core/hooks';
import { Icon } from '../../core/icons';
import type { Child, ContactState, Diff, Family, Revision } from '../../core/types';
import { FAMILIES } from '../../core/types';
import { childDisplay, fmt, liveChildren, FAMILY_PLURAL, TZ_LABEL } from '../../core/format';
import { personaById } from '../../core/fixtures';
import { profileFieldLabel, profileFieldText } from '../../core/engine';
import { diffFieldCount } from '../../core/diff';
import type { Profile } from '../../core/types';

export function CasefileHistory({ contactId, nav, query }: { contactId: string; nav: CasefileNav; query: URLSearchParams }) {
  const ws = useWorkspace();
  const revisions = ws.revisions(contactId);
  const latest = revisions[revisions.length - 1]!;
  const rev = query.get('rev') ? Number(query.get('rev')) : latest.entityVersion;
  const compareParam = query.get('compare');
  const compare = compareParam === 'none' ? null : compareParam ? Number(compareParam) : rev > 1 ? rev - 1 : null;
  const modeParam = query.get('mode');
  const mode: 'state' | 'changes' | 'actions' = modeParam === 'state' || modeParam === 'actions' ? modeParam : 'changes';
  const focus = query.get('focus');
  const read = useRevisionView(contactId, rev, compare);
  const coverage = ws.demo.historyCoverageFrom;
  const go = (r: number, c: number | null, m = mode) => nav.history(contactId, r, c, m, null);

  return (
    <div>
      <div className="cf-ribbon" role="listbox" aria-label="Revisions">
        {revisions.map((r) => {
          const unavailable = coverage !== null && r.entityVersion < coverage;
          return (
            <button
              key={r.entityVersion}
              className={`cf-rev${r.entityVersion === latest.entityVersion ? ' cf-rev--current' : ''}${unavailable ? ' cf-rev--unavail' : ''}${compare === r.entityVersion ? ' cf-rev--compare' : ''}`}
              aria-pressed={r.entityVersion === rev}
              onClick={() => go(r.entityVersion, r.entityVersion > 1 ? r.entityVersion - 1 : null)}
              title={`${r.summary} — ${fmt.dateTime(r.at)}`}
            >
              <span className="cf-rev__top">
                <Avatar initials={personaById(r.actorId).initials} hue={personaById(r.actorId).hue} size="sm" />
                Revision {r.entityVersion}
              </span>
              <span className="cf-rev__when">
                {fmt.dateTime(r.at)} · {personaById(r.actorId).name}
              </span>
              <span className="cf-rev__summary">{unavailable ? 'Coverage unavailable' : r.summary}</span>
              {compare === r.entityVersion ? <span className="cf-badge cf-badge--hist">comparing against</span> : null}
            </button>
          );
        })}
      </div>
      <div className="cf-history-toolbar">
        <div className="cf-seg" role="group" aria-label="What to show">
          <button aria-pressed={mode === 'state'} onClick={() => go(rev, compare, 'state')}>
            <Icon name="eye" size={14} /> State at revision {rev}
          </button>
          <button aria-pressed={mode === 'changes'} onClick={() => go(rev, compare, 'changes')}>
            <Icon name="diff" size={14} /> Changes
          </button>
          <button aria-pressed={mode === 'actions'} onClick={() => go(rev, compare, 'actions')}>
            <Icon name="list" size={14} /> Actions in this Save
          </button>
        </div>
        <label className="cf-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="cf-label">Compare with</span>
          <select className="cf-select" value={compare === null ? 'none' : String(compare)} onChange={(e) => go(rev, e.target.value === 'none' ? null : Number(e.target.value))} aria-label="Compare with revision">
            <option value="none">— none —</option>
            {revisions
              .filter((r) => r.entityVersion !== rev)
              .map((r) => (
                <option key={r.entityVersion} value={r.entityVersion}>
                  Revision {r.entityVersion} · {fmt.date(r.at)}
                </option>
              ))}
          </select>
        </label>
        {rev !== latest.entityVersion ? (
          <button className="cf-btn cf-btn--sm" onClick={() => go(latest.entityVersion, latest.entityVersion - 1)} style={{ marginLeft: 'auto' }}>
            Jump to current (revision {latest.entityVersion})
          </button>
        ) : null}
      </div>
      <div className="cf-history-body">
        {read.problem ? (
          <div className={`cf-bar ${read.problem.code === 'history_unavailable' ? 'cf-bar--warning' : 'cf-bar--danger'}`} role="alert">
            <Icon name={read.problem.code === 'history_unavailable' ? 'alert' : 'shield'} className="cf-bar__icon" />
            <div className="cf-bar__body">
              <div className="cf-bar__title">
                {read.problem.status} · {read.problem.code}
              </div>
              <div>{read.problem.detail}</div>
              {read.problem.code === 'history_unavailable' ? <div className="cf-hint">Unknown earlier state stays unknown; the prototype does not borrow today’s values to fill it.</div> : null}
            </div>
          </div>
        ) : read.data ? (
          <>
            <div className="cf-bar cf-bar--hist" role="status">
              <Icon name="clock" className="cf-bar__icon" />
              <div className="cf-bar__body">
                <div className="cf-bar__title">
                  Revision {rev} as it was on {fmt.dateTime(read.data.revision.at)} {TZ_LABEL} · read only
                </div>
                <div>
                  Saved by {personaById(read.data.revision.actorId).fullName}: “{read.data.revision.summary}”. Selecting an old revision never undoes it; edits happen on the current record.
                </div>
              </div>
            </div>
            {mode === 'state' ? <HistoricalState state={read.data.revision.state} focus={focus} /> : null}
            {mode === 'changes' ? <ChangesTable read={read.data} compare={compare} rev={rev} focus={focus} onPickCompare={(c) => go(rev, c)} /> : null}
            {mode === 'actions' ? <ActionsList revision={read.data.revision} diff={read.data.diff} compare={compare} /> : null}
            <details className="cf-details">
              <summary>Technical details</summary>
              <dl className="cf-details__body">
                <dt>Entity revision</dt>
                <dd>{read.data.revision.entityVersion}</dd>
                <dt>Audit unit stamp</dt>
                <dd>{read.data.revision.unitStamp} (dbrow_version, Int64 kept as a string)</dd>
                <dt>Recorded</dt>
                <dd>
                  {fmt.utc(read.data.revision.at)} · {fmt.dateTime(read.data.revision.at)} {TZ_LABEL}
                </dd>
                <dt>Actor key</dt>
                <dd>{personaById(read.data.revision.actorId).actorKey}</dd>
                <dt>Read contract</dt>
                <dd>
                  GET /api/contacts/{'{id}'}/revisions/{rev}
                  {compare !== null ? `?compareEntityVersion=${compare}` : ''} (ReadDetail + ReadHistory)
                </dd>
                <dt>Open in activity</dt>
                <dd>
                  <button className="cf-link" onClick={() => nav.activity({ contact: contactId }, read.data!.revision.unitStamp)}>
                    unit {read.data.revision.unitStamp}
                  </button>
                </dd>
              </dl>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}

function HistoricalState({ state, focus }: { state: ContactState; focus: string | null }) {
  const p = state.profile;
  const keys: (keyof Profile)[] = p.contactTypeId === 1 ? ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'summary'] : ['fullName', 'displayName', 'summary'];
  return (
    <div className="cf-hist-record" aria-label="Historical state (read only)">
      <section className="cf-section">
        <div className="cf-section__head">
          <h3 className="cf-section__title">Profile</h3>
        </div>
        <dl className="cf-profile-grid">
          {keys.map((k) => (
            <div key={k} className={`cf-kv${focus === `profile.${k}` ? ' cf-row--flash' : ''}`}>
              <dt>{profileFieldLabel(k)}</dt>
              <dd className={profileFieldText(k, p) ? undefined : 'cf-kv__empty'}>{profileFieldText(k, p) ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
      {FAMILIES.map((family) => {
        const live = liveChildren(state[family === 'email' ? 'emails' : family === 'phone' ? 'phones' : family === 'web_link' ? 'webLinks' : 'addresses'] as Child<unknown>[]);
        return (
          <section key={family} className="cf-section">
            <div className="cf-section__head">
              <h3 className="cf-section__title">
                {FAMILY_PLURAL[family]} <span className="cf-section__count">{live.length}</span>
              </h3>
            </div>
            {live.length === 0 ? <p className="cf-hint">None at this revision.</p> : null}
            {live.map((child, i) => {
              return (
                <div key={child.ordinal} className={`cf-row${focus && focus.startsWith(`${family}.${child.ordinal}`) ? ' cf-row--flash' : ''}`}>
                  <span className="cf-row__icon">{i === 0 ? <Icon name="starFill" size={14} /> : <span className="cf-hint">{child.displayOrder}</span>}</span>
                  <div className="cf-row__main">
                    <span className="cf-row__value">{childDisplay(family, child)}</span>
                    <span className="cf-row__meta">
                      {i === 0 ? <span className="cf-primary">Primary</span> : <span>Position {child.displayOrder}</span>}
                      <span className="cf-badge">{child.location ?? 'No label'}</span>
                      <span className="cf-vis">
                        <Icon name={child.isPublic ? 'globe' : 'lock'} size={12} /> {child.isPublic ? 'Public' : 'Private'}
                      </span>
                      <span className="cf-mono">ordinal {child.ordinal}</span>
                    </span>
                  </div>
                  <span />
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function ChangesTable({ read, compare, rev, focus, onPickCompare }: { read: { revision: Revision; compare: Revision | null; diff: Diff | null }; compare: number | null; rev: number; focus: string | null; onPickCompare: (c: number) => void }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const diff = read.diff;
  if (compare === null || !diff) {
    return (
      <div className="cf-empty-diff">
        {rev === 1 ? 'Revision 1 is the creation; there is nothing earlier to compare with.' : 'Pick a revision to compare with to see field-level differences.'}
        {rev > 1 ? (
          <div style={{ marginTop: 8 }}>
            <button className="cf-btn cf-btn--sm" onClick={() => onPickCompare(rev - 1)}>
              Compare with revision {rev - 1}
            </button>
          </div>
        ) : null}
      </div>
    );
  }
  const unchanged = diff.children.filter((c) => c.status === 'unchanged');
  const changed = diff.children.filter((c) => c.status !== 'unchanged');
  const older = Math.min(rev, compare);
  const newer = Math.max(rev, compare);
  const flipped = compare > rev;
  return (
    <div>
      <p className="cf-hint" style={{ margin: '0 0 8px' }}>
        {diffFieldCount(diff)} field difference{diffFieldCount(diff) === 1 ? '' : 's'} between revision {older} (before) and revision {newer} (after)
        {flipped ? ' — the selected revision is the older side' : ''}. Markers: <span className="cf-diff-mark cf-diff-before">−</span> before, <span className="cf-diff-mark cf-diff-after">+</span> after.
      </p>
      {diff.isEmpty ? (
        <div className="cf-empty-diff">
          <strong>No net difference.</strong>
          <br />
          The final state of revision {newer} equals revision {older}. The Save still recorded {read.revision.actions.length} action{read.revision.actions.length === 1 ? '' : 's'} — open “Actions in this Save”.
        </div>
      ) : (
        <table className="cf-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Field</th>
              <th>Before (revision {older})</th>
              <th>After (revision {newer})</th>
            </tr>
          </thead>
          <tbody>
            {diff.profile.length ? (
              <tr className="cf-group">
                <td colSpan={3}>Profile</td>
              </tr>
            ) : null}
            {diff.profile.map((f) => (
              <tr key={f.path} className={focus === f.path ? 'cf-row--flash' : undefined}>
                <td>{f.label}</td>
                <td className="cf-diff-before">
                  <span className="cf-diff-mark">−</span>
                  {flipped ? f.after : f.before ?? '(empty)'}
                </td>
                <td className="cf-diff-after">
                  <span className="cf-diff-mark">+</span>
                  {flipped ? f.before : f.after ?? '(empty)'}
                </td>
              </tr>
            ))}
            {diff.root.map((f) => (
              <tr key={f.path}>
                <td>{f.label}</td>
                <td className="cf-diff-before">
                  <span className="cf-diff-mark">−</span>
                  {f.before}
                </td>
                <td className="cf-diff-after">
                  <span className="cf-diff-mark">+</span>
                  {f.after}
                </td>
              </tr>
            ))}
            {changed.map((c) => (
              <React.Fragment key={`${c.family}-${c.ordinal}`}>
                <tr className="cf-group">
                  <td colSpan={3}>
                    {c.label} <span className="cf-mono">ordinal {c.ordinal}</span> · <span className={`cf-status cf-status--${c.status}`}>{c.status}</span>
                    {c.status === 'restored' ? ' (same identity, appended)' : ''}
                  </td>
                </tr>
                {c.status === 'changed' || (c.status === 'restored' && c.changes.length) ? (
                  c.changes.map((f) => (
                    <tr key={f.path} className={focus === f.path ? 'cf-row--flash' : undefined}>
                      <td>{f.label}</td>
                      <td className="cf-diff-before">
                        <span className="cf-diff-mark">−</span>
                        {(flipped ? f.after : f.before) ?? '(empty)'}
                      </td>
                      <td className="cf-diff-after">
                        <span className="cf-diff-mark">+</span>
                        {(flipped ? f.before : f.after) ?? '(empty)'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className={focus && focus.startsWith(`${c.family}.${c.ordinal}`) ? 'cf-row--flash' : undefined}>
                    <td>Entry</td>
                    <td className="cf-diff-before">
                      <span className="cf-diff-mark">−</span>
                      {c.status === 'removed' ? c.display : '(absent)'}
                    </td>
                    <td className="cf-diff-after">
                      <span className="cf-diff-mark">+</span>
                      {c.status === 'removed' ? '(absent)' : c.display}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
      {unchanged.length ? (
        <p className="cf-hint" style={{ marginTop: 10 }}>
          <button className="cf-link" onClick={() => setShowUnchanged((s) => !s)}>
            {showUnchanged ? 'Hide' : 'Show'} {unchanged.length} unchanged entr{unchanged.length === 1 ? 'y' : 'ies'}
          </button>
          {showUnchanged ? <> — {unchanged.map((c) => `${c.label}: ${c.display}`).join(' · ')}</> : null}
        </p>
      ) : null}
    </div>
  );
}

function ActionsList({ revision, diff, compare }: { revision: Revision; diff: Diff | null; compare: number | null }) {
  const families = useMemo(() => Array.from(new Set(revision.actions.map((a) => a.family))), [revision.actions]);
  return (
    <div>
      <p className="cf-hint" style={{ margin: '0 0 8px' }}>
        {revision.actions.length} effective action{revision.actions.length === 1 ? '' : 's'} in audit unit <code>{revision.unitStamp}</code>, in their global order
        {families.length > 1 ? ` across ${families.join(', ')}` : ''}. Actions are what the Save did; they are not the difference between two states.
      </p>
      {diff?.isEmpty && compare !== null ? (
        <div className="cf-bar cf-bar--info">
          <Icon name="info" className="cf-bar__icon" />
          <div className="cf-bar__body">Both actions below are real even though the final diff against revision {compare} is empty: the value changed and changed back inside one committed unit.</div>
        </div>
      ) : null}
      <ol className="cf-actions">
        {revision.actions.map((a) => (
          <li key={a.seq} className="cf-action">
            <span className="cf-action__seq" aria-label={`Action ${a.seq}`}>
              {a.seq}
            </span>
            <div>
              <div className="cf-action__summary">
                {a.summary}
                <span className="cf-action__kind">{a.kind}</span>
              </div>
              {a.before !== null || a.after !== null ? (
                <div className="cf-action__ba">
                  {a.before !== null ? (
                    <span>
                      <span className="cf-diff-mark cf-diff-before">−</span>
                      {a.before}
                    </span>
                  ) : null}
                  {a.after !== null ? (
                    <span>
                      <span className="cf-diff-mark cf-diff-after">+</span>
                      {a.after}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export type { Family };
