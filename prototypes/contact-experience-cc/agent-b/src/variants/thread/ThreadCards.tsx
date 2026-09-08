import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LocalCard, ThreadNav } from './ThreadApp';
import { ThAvatar } from './ThreadApp';
import { useWorkspace, type UncertainCheck } from '../../core/store';
import { useRevisionView } from '../../core/hooks';
import { Icon } from '../../core/icons';
import type { ActivityFilters, AuditUnit, Child, ContactState, Diff, Family, Revision, SaveResult, ThreadNote } from '../../core/types';
import { FAMILIES } from '../../core/types';
import { childDisplay, fmt, liveChildren, FAMILY_PLURAL, TZ_LABEL } from '../../core/format';
import { personaById, PERSONAS } from '../../core/fixtures';
import { profileFieldLabel, profileFieldText } from '../../core/engine';
import { diffFieldCount } from '../../core/diff';
import { activeFilterCount, SOURCE_LABEL } from '../../core/activity';
import type { Profile } from '../../core/types';

// ---------------- Revision card (system line that unfolds into state / diff / actions) ----------------

export function RevisionCard({ contactId, revision, open, onToggle, nav, focus }: { contactId: string; revision: Revision; open: boolean; onToggle: () => void; nav: ThreadNav; focus: string | null }) {
  const ws = useWorkspace();
  const actor = personaById(revision.actorId);
  const id = `th-card-rev-${revision.entityVersion}`;
  const canHistory = ws.can('read_history', contactId);
  return (
    <div className={`th-card th-card--system`} id={id} style={open ? { background: 'var(--th-low)', padding: '10px 12px 14px', display: 'grid', gridTemplateColumns: '1fr' } : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center' }}>
        <ThAvatar initials={actor.initials} hue={actor.hue} />
        <span>
          <strong>{actor.name}</strong> saved <strong>revision {revision.entityVersion}</strong> · {revision.summary}
          <span className="th-card__when"> · {fmt.dateTime(revision.at)}</span>
        </span>
        {canHistory ? (
          <button className="th-btn th-btn--sm th-btn--text" onClick={onToggle} aria-expanded={open} aria-controls={`${id}-body`}>
            {open ? 'Close' : 'Open'} <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
          </button>
        ) : (
          <span className="th-tag">history needs read_history</span>
        )}
      </div>
      {open && canHistory ? <RevisionBody contactId={contactId} revision={revision} nav={nav} focus={focus} bodyId={`${id}-body`} /> : null}
    </div>
  );
}

function RevisionBody({ contactId, revision, nav, focus, bodyId }: { contactId: string; revision: Revision; nav: ThreadNav; focus: string | null; bodyId: string }) {
  const ws = useWorkspace();
  const rev = revision.entityVersion;
  const [tab, setTab] = useState<'state' | 'diff' | 'actions'>(rev > 1 ? 'diff' : 'state');
  const [compare, setCompare] = useState<number | null>(rev > 1 ? rev - 1 : null);
  const read = useRevisionView(contactId, rev, compare);
  useEffect(() => {
    if (focus) setTab('diff');
  }, [focus]);
  const revisions = ws.revisions(contactId);
  return (
    <div id={bodyId} style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      {read.problem ? (
        <div className={`th-card ${read.problem.code === 'history_unavailable' ? 'th-card--warn' : 'th-card--conflict'}`} role="alert" style={{ padding: '12px 14px' }}>
          <div className="th-card__who">
            {read.problem.status} · {read.problem.code}
          </div>
          <div>{read.problem.detail}</div>
        </div>
      ) : read.data ? (
        <>
          <div className="th-card__head" style={{ flexWrap: 'wrap' }}>
            <div className="th-tabs" role="tablist" aria-label="Revision views">
              <button role="tab" aria-selected={tab === 'state'} onClick={() => setTab('state')}>
                <Icon name="eye" size={14} /> As it was
              </button>
              <button role="tab" aria-selected={tab === 'diff'} onClick={() => setTab('diff')}>
                <Icon name="diff" size={14} /> What changed
              </button>
              <button role="tab" aria-selected={tab === 'actions'} onClick={() => setTab('actions')}>
                <Icon name="list" size={14} /> Actions ({revision.actions.length})
              </button>
            </div>
            <span className="th-tag th-tag--hist">
              <Icon name="clock" size={12} /> read only · {fmt.dateTime(revision.at)} {TZ_LABEL}
            </span>
          </div>
          {tab === 'state' ? <HistoricalMini state={read.data.revision.state} /> : null}
          {tab === 'diff' ? (
            <>
              <div className="th-filters">
                <label className="th-hint" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  Compare revision {rev} with
                  <select value={compare ?? ''} onChange={(e) => setCompare(e.target.value ? Number(e.target.value) : null)} aria-label="Compare with revision">
                    <option value="">— none —</option>
                    {revisions
                      .filter((r) => r.entityVersion !== rev)
                      .map((r) => (
                        <option key={r.entityVersion} value={r.entityVersion}>
                          revision {r.entityVersion} · {fmt.date(r.at)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <DiffBlock diff={read.data.diff} rev={rev} compare={compare} actions={revision.actions.length} focus={focus} />
            </>
          ) : null}
          {tab === 'actions' ? <ActionsBlock revision={read.data.revision} emptyDiff={!!read.data.diff?.isEmpty} /> : null}
          <details className="th-details">
            <summary>Technical details</summary>
            <dl className="th-details__body">
              <dt>Unit stamp</dt>
              <dd>{revision.unitStamp}</dd>
              <dt>Recorded</dt>
              <dd>{fmt.utc(revision.at)}</dd>
              <dt>Actor key</dt>
              <dd>{personaById(revision.actorId).actorKey}</dd>
              <dt>Read</dt>
              <dd>
                GET …/revisions/{rev}
                {compare !== null ? `?compareEntityVersion=${compare}` : ''}
              </dd>
              <dt>Activity</dt>
              <dd>
                <button className="th-btn th-btn--text th-btn--sm" onClick={() => nav.activity({ contact: contactId }, revision.unitStamp)}>
                  open unit in tenant activity
                </button>
              </dd>
            </dl>
          </details>
        </>
      ) : null}
    </div>
  );
}

function HistoricalMini({ state }: { state: ContactState }) {
  const p = state.profile;
  const keys: (keyof Profile)[] = p.contactTypeId === 1 ? ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'summary'] : ['fullName', 'displayName', 'summary'];
  return (
    <div className="th-mini th-mini--hist" aria-label="State at this revision (read only)">
      <div className="th-mini__title">Profile</div>
      <dl className="th-kv">
        {keys.map((k) => (
          <div key={k}>
            <dt>{profileFieldLabel(k)}</dt>
            <dd>{profileFieldText(k, p) ?? '—'}</dd>
          </div>
        ))}
      </dl>
      {FAMILIES.map((family) => {
        const live = liveChildren(state[family === 'email' ? 'emails' : family === 'phone' ? 'phones' : family === 'web_link' ? 'webLinks' : 'addresses'] as Child<unknown>[]);
        return (
          <div key={family}>
            <div className="th-mini__title">
              {FAMILY_PLURAL[family]} · {live.length}
            </div>
            {live.length === 0 ? <div className="th-hint">None at this revision.</div> : null}
            {live.map((c, i) => (
              <div key={c.ordinal} className="th-mini__row">
                <span>{i === 0 ? <Icon name="starFill" size={14} /> : <span className="th-mono">{c.displayOrder}</span>}</span>
                <span>
                  {childDisplay(family, c)}
                  <span className="th-mini__meta">
                    <span>{i === 0 ? 'Primary' : `Position ${c.displayOrder}`}</span>
                    <span>{c.location ?? 'No label'}</span>
                    <span>{c.isPublic ? 'Public' : 'Private'}</span>
                    <span className="th-mono">ordinal {c.ordinal}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DiffBlock({ diff, rev, compare, actions, focus }: { diff: Diff | null; rev: number; compare: number | null; actions: number; focus: string | null }) {
  if (compare === null || !diff) return <div className="th-empty">{rev === 1 ? 'Revision 1 is the creation; nothing earlier to compare.' : 'Pick a revision to compare with.'}</div>;
  const older = Math.min(rev, compare);
  const newer = Math.max(rev, compare);
  const flipped = compare > rev;
  const changed = diff.children.filter((c) => c.status !== 'unchanged');
  if (diff.isEmpty) {
    return (
      <div className="th-card th-card--hist" style={{ padding: '14px 16px' }}>
        <div className="th-card__who">No net difference between revision {older} and {newer}</div>
        <div>
          The final state came back to where it started, but the Save recorded {actions} action{actions === 1 ? '' : 's'}. Open “Actions” to see both.
        </div>
      </div>
    );
  }
  return (
    <div className="th-diff">
      <span className="th-hint">
        {diffFieldCount(diff)} field difference{diffFieldCount(diff) === 1 ? '' : 's'} · before = revision {older}, after = revision {newer}. Markers: <span className="th-before">−</span> before, <span className="th-after">+</span> after; status labels say what happened.
      </span>
      {diff.profile.length ? <div className="th-diff__group">Profile</div> : null}
      {diff.profile.map((f) => (
        <div key={f.path} className={`th-diff__row${focus === f.path ? ' th-diff__row--flash' : ''}`}>
          <strong>{f.label}</strong>
          <span className="th-before">
            <span className="th-diff__mark">−</span>
            {(flipped ? f.after : f.before) ?? '(empty)'}
          </span>
          <span className="th-after">
            <span className="th-diff__mark">+</span>
            {(flipped ? f.before : f.after) ?? '(empty)'}
          </span>
        </div>
      ))}
      {changed.map((c) => (
        <React.Fragment key={`${c.family}-${c.ordinal}`}>
          <div className="th-diff__group">
            {c.label} <span className="th-mono">ordinal {c.ordinal}</span> <span className={`th-status th-status--${c.status}`}>{c.status}</span>
            {c.status === 'restored' ? <span className="th-hint">same identity, appended</span> : null}
          </div>
          {c.status === 'changed' || (c.status === 'restored' && c.changes.length) ? (
            c.changes.map((f) => (
              <div key={f.path} className={`th-diff__row${focus === f.path ? ' th-diff__row--flash' : ''}`}>
                <strong>{f.label}</strong>
                <span className="th-before">
                  <span className="th-diff__mark">−</span>
                  {(flipped ? f.after : f.before) ?? '(empty)'}
                </span>
                <span className="th-after">
                  <span className="th-diff__mark">+</span>
                  {(flipped ? f.before : f.after) ?? '(empty)'}
                </span>
              </div>
            ))
          ) : (
            <div className={`th-diff__row${focus && focus.startsWith(`${c.family}.${c.ordinal}`) ? ' th-diff__row--flash' : ''}`}>
              <strong>Entry</strong>
              <span className="th-before">
                <span className="th-diff__mark">−</span>
                {c.status === 'removed' ? c.display : '(absent)'}
              </span>
              <span className="th-after">
                <span className="th-diff__mark">+</span>
                {c.status === 'removed' ? '(absent)' : c.display}
              </span>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function ActionsBlock({ revision, emptyDiff }: { revision: Revision; emptyDiff: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span className="th-hint">
        {revision.actions.length} effective action{revision.actions.length === 1 ? '' : 's'} in unit <code>{revision.unitStamp}</code>, in order. Actions are what the Save did, not the difference between two states.
        {emptyDiff ? ' Both actions are real even though the final diff is empty.' : ''}
      </span>
      <ol className="th-actions">
        {revision.actions.map((a) => (
          <li key={a.seq} className="th-action">
            <span className="th-action__seq">{a.seq}</span>
            <div>
              <div>
                {a.summary}
                <span className="th-action__kind">{a.kind}</span>
              </div>
              {a.before !== null || a.after !== null ? (
                <div className="th-action__ba">
                  {a.before !== null ? <span className="th-before">− {a.before}</span> : null}
                  {a.after !== null ? <span className="th-after">+ {a.after}</span> : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------- Note card ----------------

export function NoteCard({ note, onOpenRef }: { note: ThreadNote; onOpenRef: (card: string) => void }) {
  const ws = useWorkspace();
  const p = personaById(note.personaId);
  const mine = p.id === ws.persona.id;
  return (
    <div className={`th-card th-card--note${mine ? ' th-card--mine' : ''}`} id={`th-card-${note.id}`}>
      <div className="th-card__head">
        <ThAvatar initials={p.initials} hue={p.hue} round />
        <span className="th-card__who">{p.fullName}</span>
        <span className="th-card__when">
          {fmt.dateTime(note.at)} · note{mine ? ' · you' : ''}
        </span>
        <span className="th-spacer" />
        <span className="th-tag">shared · prototype-local</span>
      </div>
      <div className="th-card__body">{note.text}</div>
      {note.ref && note.ref.kind === 'revision' ? (
        <div className="th-refs">
          <button className="th-ref" onClick={() => onOpenRef(`rev:${note.ref!.kind === 'revision' ? note.ref!.version : ''}`)}>
            <Icon name="history" size={13} /> Revision {note.ref.version}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------- Sidekick card ----------------

export function SidekickCard({ card, contactId, nav, onOpenRev, onAdjust }: { card: LocalCard; contactId: string | null; nav: ThreadNav; onOpenRev: (card: string) => void; onAdjust: () => void }) {
  const ws = useWorkspace();
  const reply = card.reply!;
  const proposal = reply.actions.find((a) => a.kind === 'proposal');
  const stillDrafting = proposal && proposal.kind === 'proposal' && ws.draft && ws.draft.contactId === proposal.contactId;
  return (
    <div className={`th-card th-card--sk${reply.bounded ? ' th-card--sk-bounded' : ''}`} id={`th-card-${card.id}`}>
      <div className="th-card__head">
        <span className="th-avatar" style={{ ['--h' as string]: 250 }}>
          <Icon name="sparkle" size={16} />
        </span>
        <span className="th-card__who">Sidekick</span>
        <span className="th-card__when">{fmt.time(card.at)} · answering “{card.query}”</span>
        <span className="th-spacer" />
        <span className="th-tag">only you see this · simulated</span>
      </div>
      <div className="th-card__body">{reply.text}</div>
      {reply.refs.length ? (
        <div className="th-refs">
          {reply.refs.map((r, i) => (
            <button
              key={i}
              className="th-ref"
              onClick={() => {
                if (r.kind === 'revision') {
                  if (contactId && r.contactId === contactId) nav.thread(contactId, `rev:${r.version}`, r.fields[0] ?? null, true);
                  else nav.thread(r.contactId, `rev:${r.version}`, r.fields[0] ?? null);
                  onOpenRev(`rev:${r.version}`);
                } else nav.activity(undefined, r.stamp);
              }}
              title={r.label}
            >
              <Icon name={r.kind === 'revision' ? 'history' : 'activity'} size={13} />
              <span>{r.kind === 'revision' ? `Revision ${r.version}${r.compare ? ` vs ${r.compare}` : ''}` : r.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {proposal && proposal.kind === 'proposal' ? (
        <div className="th-mini" style={{ color: 'var(--th-on)' }}>
          <div className="th-mini__title">{card.staged?.ok ? 'Staged in your draft' : 'Proposal'}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {proposal.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {card.staged && !card.staged.ok ? <div className="th-error">{card.staged.message}</div> : null}
          {stillDrafting ? <span className="th-hint">See the proposal card below to apply it as one Save, adjust it, or discard it.</span> : ws.saveState.status === 'saved' ? <span className="th-hint">Applied.</span> : <span className="th-hint">No longer staged.</span>}
          {stillDrafting ? (
            <div className="th-card__actions">
              <button className="th-btn th-btn--sm th-btn--outlined" onClick={onAdjust}>
                Adjust in the form
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="th-used">
        {reply.used.map((u) => (
          <span key={u} className="th-tag">
            {u}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------- Proposal / pending draft card ----------------

export function ProposalCard({ nav, onAdjust }: { nav: ThreadNav; onAdjust: () => void }) {
  const ws = useWorkspace();
  const d = ws.draft!;
  const saving = ws.saveState.status === 'saving';
  void nav;
  return (
    <div className="th-card th-card--proposal" role="region" aria-label="Pending changes" id="th-card-proposal">
      <div className="th-card__head">
        <ThAvatar initials={ws.persona.initials} hue={ws.persona.hue} round />
        <span className="th-card__who">{d.origin === 'sidekick' ? 'Sidekick proposal for ' : d.origin === 'reconciled' ? 'Reconciled draft by ' : 'Draft by '}{ws.persona.name}</span>
        <span className="th-card__when">
          {ws.pending.length} change{ws.pending.length === 1 ? '' : 's'} · on revision {d.baseVersion} · saved together as one revision
        </span>
        <span className="th-spacer" />
        <span className="th-tag">local · not saved</span>
      </div>
      {ws.draftError ? (
        <div className="th-error">
          <Icon name="alert" size={14} /> {ws.draftError}
        </div>
      ) : (
        <ol className="th-pending">
          {ws.pending.map((p) => (
            <li key={p.key}>
              {p.text}
              {d.origin === 'reconciled' && p.ordinal !== null && p.family !== 'profile' && p.family !== 'contact' ? (
                <>
                  {' '}
                  <button className="th-btn th-btn--text th-btn--sm" onClick={() => ws.revertPath(`${p.family}.${p.ordinal}`)}>
                    Take theirs
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {ws.incoming ? (
        <div className="th-hint">
          {personaById(ws.incoming.actorId).name} saved revision {ws.incoming.entityVersion} while you edit revision {d.baseVersion}. Your draft is kept; Save will ask you to reconcile.
        </div>
      ) : null}
      <div className="th-card__actions">
        <button className="th-btn th-btn--filled" onClick={() => void ws.save()} disabled={saving || !ws.pending.length || !!ws.draftError}>
          <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Apply as one Save'}
        </button>
        <button className="th-btn th-btn--outlined" onClick={onAdjust} disabled={saving}>
          <Icon name="edit" size={16} /> Adjust
        </button>
        {ws.incoming ? (
          <button className="th-btn th-btn--tertiary" onClick={ws.openReconcile}>
            Reconcile now
          </button>
        ) : null}
        <button className="th-btn th-btn--text" onClick={ws.discardDraft} disabled={saving}>
          Discard
        </button>
      </div>
    </div>
  );
}

export function SavedCard({ result, contactId, nav }: { result: SaveResult; contactId: string; nav: ThreadNav }) {
  const ws = useWorkspace();
  return (
    <div className="th-card th-card--saved" role="status" id="th-card-saved">
      <div className="th-card__head">
        <span className="th-avatar" style={{ ['--h' as string]: 160 }}>
          <Icon name="check" size={16} />
        </span>
        <span className="th-card__who">Saved together as revision {result.entityVersion}</span>
        <span className="th-card__when">{result.dbrowVersion ? `audit stamp ${result.dbrowVersion}` : ''}</span>
      </div>
      <div className="th-card__actions">
        <button className="th-btn th-btn--sm th-btn--outlined" onClick={() => nav.thread(contactId, `rev:${result.entityVersion}`, null, true)}>
          Open revision {result.entityVersion}
        </button>
        <button className="th-btn th-btn--sm th-btn--text" onClick={ws.clearSaveState}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------- Status cards: conflict, error, uncertain, noop ----------------

export function StatusCards({ contactId, nav, onAdjust }: { contactId: string; nav: ThreadNav; onAdjust: () => void }) {
  const ws = useWorkspace();
  const s = ws.saveState;
  const [check, setCheck] = useState<UncertainCheck | null>(null);
  useEffect(() => {
    if (s.status !== 'uncertain') setCheck(null);
  }, [s.status]);
  const draft = ws.draft && ws.draft.contactId === contactId ? ws.draft : null;
  void onAdjust;
  return (
    <>
      {ws.conflict && draft ? <ConflictCard contactId={contactId} nav={nav} /> : null}
      {s.status === 'noop' ? (
        <div className="th-card th-card--warn" role="status">
          <div className="th-card__who">Nothing to save</div>
          <div>Every command was ineffective, so the contact keeps its revision and no audit stamp was allocated.</div>
          <div className="th-card__actions">
            <button className="th-btn th-btn--sm th-btn--outlined" onClick={ws.clearSaveState}>
              OK
            </button>
          </div>
        </div>
      ) : null}
      {s.status === 'error' && s.problem ? (
        <div className="th-card th-card--conflict" role="alert">
          <div className="th-card__who">
            Save failed · {s.problem.status} {s.problem.code}
          </div>
          <div>{s.problem.detail}</div>
          <div className="th-hint">Nothing was committed. Trace {s.problem.traceId}. Automatic retry is not allowed.</div>
          <div className="th-card__actions">
            <button className="th-btn th-btn--sm th-btn--filled" onClick={ws.clearSaveState}>
              Keep my draft
            </button>
            <button className="th-btn th-btn--sm th-btn--text" onClick={ws.discardDraft}>
              Discard draft
            </button>
          </div>
        </div>
      ) : null}
      {s.status === 'uncertain' && s.problem ? (
        <div className="th-card th-card--warn" role="alert">
          <div className="th-card__who">Save outcome unknown (500 commit_uncertain)</div>
          <div>{s.problem.detail} Your draft is preserved. No automatic retry, no recovery receipt.</div>
          {check ? <div>{check.message}</div> : null}
          <div className="th-card__actions">
            {!check ? (
              <button className="th-btn th-btn--sm th-btn--filled" onClick={() => setCheck(ws.checkUncertain())}>
                Check the current revision
              </button>
            ) : check.committed ? (
              <>
                <button className="th-btn th-btn--sm th-btn--filled" onClick={ws.acceptUncertain}>
                  It committed · drop my draft
                </button>
                <button className="th-btn th-btn--sm th-btn--outlined" onClick={() => nav.thread(contactId, `rev:${check.latest.entityVersion}`, null, true)}>
                  Inspect revision {check.latest.entityVersion}
                </button>
              </>
            ) : (
              <>
                <button className="th-btn th-btn--sm th-btn--filled" onClick={ws.clearSaveState}>
                  Keep my draft and decide
                </button>
                <button className="th-btn th-btn--sm th-btn--text" onClick={ws.discardDraft}>
                  Discard draft
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConflictCard({ contactId, nav }: { contactId: string; nav: ThreadNav }) {
  const ws = useWorkspace();
  const c = ws.conflict!;
  const theirActor = personaById(c.theirs.actorId).name;
  const overlap = (path: string) => c.overlaps.some((o) => o === path || o.startsWith(`${path}.`) || path.startsWith(`${o}.`));
  const minePaths = [...c.mineDiff.profile.map((f) => f.path), ...c.mineDiff.children.flatMap((ch) => (ch.status === 'changed' ? ch.changes.map((f) => f.path) : ch.status === 'unchanged' ? [] : [`${ch.family}.${ch.ordinal}`]))];
  const theirs = [
    ...c.diffTheirs.profile.map((f) => ({ path: f.path, text: `${f.label}: ${f.before ?? '(empty)'} → ${f.after ?? '(empty)'}` })),
    ...c.diffTheirs.children.flatMap((ch) => (ch.status === 'unchanged' ? [] : ch.status === 'changed' ? ch.changes.map((f) => ({ path: f.path, text: `${ch.label} ${f.label.toLowerCase()}: ${f.before ?? '(empty)'} → ${f.after ?? '(empty)'}` })) : [{ path: `${ch.family}.${ch.ordinal}`, text: `${ch.label} ${ch.status}: ${ch.display}` }])),
  ];
  return (
    <div className="th-card th-card--conflict" role="alertdialog" aria-labelledby="th-conflict-title">
      <div className="th-card__head">
        <span className="th-avatar" style={{ ['--h' as string]: 0 }}>
          <Icon name="users" size={16} />
        </span>
        <span className="th-card__who" id="th-conflict-title">
          Your Save was rejected as stale (409 conflict)
        </span>
      </div>
      <div>
        You started from revision {c.base.entityVersion}; {theirActor} committed revision {c.theirs.entityVersion} at {fmt.dateTime(c.theirs.at)}. Nothing was overwritten or retried. Decide what to do with your draft.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        <div className="th-mini" style={{ color: 'var(--th-on)' }}>
          <div className="th-mini__title">Your draft (from revision {c.base.entityVersion})</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {c.mine.map((p, i) => (
              <li key={p.key} style={overlap(minePaths[i] ?? '') ? { fontWeight: 700, color: 'var(--th-tertiary)' } : undefined}>
                {p.text}
                {overlap(minePaths[i] ?? '') ? ' · overlaps' : ''}
              </li>
            ))}
          </ul>
        </div>
        <div className="th-mini" style={{ color: 'var(--th-on)' }}>
          <div className="th-mini__title">
            {theirActor}’s revision {c.theirs.entityVersion}: “{c.theirs.summary}”
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {theirs.map((t) => (
              <li key={t.path} style={overlap(t.path) ? { fontWeight: 700, color: 'var(--th-tertiary)' } : undefined}>
                {t.text}
                {overlap(t.path) ? ' · overlaps' : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="th-card__actions">
        <button className="th-btn th-btn--filled" onClick={() => ws.resolveConflict('rebase')}>
          Keep my draft on revision {c.theirs.entityVersion}
        </button>
        <button className="th-btn th-btn--outlined" onClick={() => nav.thread(contactId, `rev:${c.theirs.entityVersion}`, null, true)}>
          Open their revision
        </button>
        <button className="th-btn th-btn--text" onClick={() => ws.resolveConflict('discard')}>
          Discard my draft
        </button>
      </div>
    </div>
  );
}

// ---------------- Query card (activity) ----------------

const FAMILY_OPTIONS: { value: ActivityFilters['family']; label: string }[] = [
  { value: 'all', label: 'Any family' },
  { value: 'profile', label: 'Profile' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'web_link', label: 'Web link' },
  { value: 'address', label: 'Address' },
  { value: 'contact', label: 'Contact lifecycle' },
  { value: 'account', label: 'Account' },
];
const SOURCE_OPTIONS: { value: ActivityFilters['source']; label: string }[] = [
  { value: 'all', label: 'Any source' },
  { value: 'business', label: 'Committed changes' },
  { value: 'batch', label: 'Administrative batches' },
  { value: 'operational', label: 'Operational (not audit)' },
  { value: 'agent', label: 'Sidekick (not audit)' },
  { value: 'presence', label: 'Presence (not audit)' },
];

export function QueryCard({ initial, nav, contactId, bound, selectedUnit, onFiltersChange, onSelectUnit }: { initial: ActivityFilters; nav: ThreadNav; contactId: string | null; bound?: boolean; selectedUnit?: string | null; onFiltersChange?: (f: ActivityFilters) => void; onSelectUnit?: (stamp: string | null) => void }) {
  const ws = useWorkspace();
  const [localFilters, setLocalFilters] = useState<ActivityFilters>(initial);
  const [localUnit, setLocalUnit] = useState<string | null>(null);
  useEffect(() => {
    if (bound) setLocalFilters(initial);
  }, [bound, initial]);
  const filters = bound ? initial : localFilters;
  const unit = bound ? selectedUnit ?? null : localUnit;
  const [text, setText] = useState(filters.q);
  useEffect(() => setText(filters.q), [filters.q]);
  const debounce = useRef<number | null>(null);
  const set = (patch: Partial<ActivityFilters>) => {
    const next = { ...filters, ...patch };
    if (bound) onFiltersChange?.(next);
    else setLocalFilters(next);
  };
  const onText = (v: string) => {
    setText(v);
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => set({ q: v }), 250);
  };
  const select = (stamp: string | null) => {
    if (bound) onSelectUnit?.(stamp);
    else setLocalUnit(stamp);
  };
  const results = ws.activity(filters);
  const rows = useMemo(() => {
    if (!results) return [];
    const byBatch = new Map<string, AuditUnit[]>();
    for (const u of results) if (u.batchId && u.source === 'business') byBatch.set(u.batchId, [...(byBatch.get(u.batchId) ?? []), u]);
    const out: { unit: AuditUnit; child: boolean }[] = [];
    const seen = new Set<string>();
    for (const u of results) {
      if (u.batchId && u.source === 'business') {
        const parent = ws.unit(u.batchId);
        if (parent && !seen.has(parent.stamp)) {
          seen.add(parent.stamp);
          out.push({ unit: parent, child: false });
          for (const c of byBatch.get(u.batchId) ?? []) out.push({ unit: c, child: true });
        } else if (!parent) out.push({ unit: u, child: false });
        continue;
      }
      if (u.source === 'batch') {
        if (seen.has(u.stamp)) continue;
        seen.add(u.stamp);
        out.push({ unit: u, child: false });
        for (const c of byBatch.get(u.batchId!) ?? []) out.push({ unit: c, child: true });
        continue;
      }
      out.push({ unit: u, child: false });
    }
    return out;
  }, [results, ws]);
  const days = useMemo(() => {
    const groups: { day: string; label: string; rows: typeof rows }[] = [];
    for (const r of rows) {
      const day = fmt.ymd(r.unit.at);
      let g = groups[groups.length - 1];
      if (!g || g.day !== day) {
        g = { day, label: fmt.dateLong(r.unit.at), rows: [] };
        groups.push(g);
      }
      g.rows.push(r);
    }
    return groups;
  }, [rows]);
  const selected = unit ? ws.unit(unit) : null;

  if (results === null) {
    return (
      <div className="th-card th-card--conflict" role="alert">
        <div className="th-card__who">403 · forbidden</div>
        <div>{ws.persona.fullName} does not hold the proposed read_activity capability, so this query cannot run.</div>
      </div>
    );
  }
  return (
    <div className="th-card th-card--query" aria-label="Activity query" id="th-card-query">
      <div className="th-card__head">
        <span className="th-avatar" style={{ ['--h' as string]: 28 }}>
          <Icon name="filter" size={16} />
        </span>
        <span className="th-card__who">Activity query</span>
        <span className="th-card__when">
          {rows.filter((r) => !r.child).length} entr{rows.filter((r) => !r.child).length === 1 ? 'y' : 'ies'} · {activeFilterCount(filters)} filter{activeFilterCount(filters) === 1 ? '' : 's'} · {TZ_LABEL}
        </span>
        <span className="th-spacer" />
        {!bound ? (
          <button className="th-btn th-btn--sm th-btn--text" onClick={() => nav.activity(filters, null)}>
            Open in tenant activity
          </button>
        ) : null}
      </div>
      <div className="th-search">
        <Icon name="search" size={16} />
        <input id="tq-q" value={text} onChange={(e) => onText(e.target.value)} placeholder="Search summaries, actions, stamps…" aria-label="Search activity" />
        {text ? (
          <button className="th-btn th-btn--text th-btn--sm th-btn--icon" onClick={() => onText('')} aria-label="Clear search">
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>
      <div className="th-filters">
        <select id="tq-actor" aria-label="Actor" value={filters.actor} onChange={(e) => set({ actor: e.target.value as ActivityFilters['actor'] })}>
          <option value="all">Anyone</option>
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
        <select id="tq-contact" aria-label="Contact" value={filters.contact} onChange={(e) => set({ contact: e.target.value })}>
          <option value="all">Any contact</option>
          {ws.contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select id="tq-family" aria-label="Family" value={filters.family} onChange={(e) => set({ family: e.target.value as ActivityFilters['family'] })}>
          {FAMILY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select id="tq-source" aria-label="Source" value={filters.source} onChange={(e) => set({ source: e.target.value as ActivityFilters['source'] })}>
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input type="date" aria-label="From date" value={filters.from ?? ''} onChange={(e) => set({ from: e.target.value || null })} />
        <input type="date" aria-label="To date" value={filters.to ?? ''} onChange={(e) => set({ to: e.target.value || null })} />
        {activeFilterCount(filters) ? (
          <button className="th-chip" onClick={() => set({ actor: 'all', contact: 'all', family: 'all', source: 'all', from: null, to: null, q: '' })}>
            Clear all
          </button>
        ) : null}
      </div>
      {ws.demo.loading ? (
        <div className="th-skeleton" aria-busy="true">
          <span style={{ width: '30%' }} />
          <span style={{ width: '80%' }} />
          <span style={{ width: '70%' }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="th-empty">
          <strong>No activity matches these filters.</strong>
          <br />
          Widen the range, clear a filter, or search for a stamp.
        </div>
      ) : (
        <div className="th-results">
          {days.map((g) => (
            <React.Fragment key={g.day}>
              <div className="th-day">{g.label}</div>
              {g.rows.map(({ unit: u, child }) => {
                const actor = personaById(u.actorId);
                return (
                  <React.Fragment key={u.stamp}>
                    <button className={`th-result${child ? ' th-result--child' : ''}`} aria-selected={u.stamp === unit} onClick={() => select(u.stamp === unit ? null : u.stamp)} aria-expanded={u.stamp === unit}>
                      <span className="th-result__time">{fmt.time(u.at)}</span>
                      <ThAvatar initials={actor.initials} hue={actor.hue} size="sm" round />
                      <span>
                        <span className="th-result__summary">
                          {child ? '↳ ' : ''}
                          {u.summary}
                        </span>
                        <br />
                        <span className="th-result__sub">
                          {actor.name}
                          {u.contacts.length ? ` · ${u.contacts.map((c) => `${ws.server.contactName(c.contactId)}${c.entityVersion ? ` rev ${c.entityVersion}` : ''}`).join(', ')}` : ''}
                        </span>
                      </span>
                      <span className={`th-source th-source--${u.source}`}>{SOURCE_LABEL[u.source]}</span>
                    </button>
                    {selected && selected.stamp === u.stamp ? <UnitCard unit={selected} nav={nav} contactId={contactId} /> : null}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function UnitCard({ unit, nav, contactId }: { unit: AuditUnit; nav: ThreadNav; contactId: string | null }) {
  const ws = useWorkspace();
  const actor = personaById(unit.actorId);
  const notAudit = unit.source === 'operational' || unit.source === 'agent' || unit.source === 'presence';
  const children = unit.source === 'batch' ? ws.server.data.units.filter((u) => u.batchId === unit.batchId && u.source === 'business') : [];
  const canValues = unit.contacts.every((c) => ws.can('read_history', c.contactId));
  return (
    <div className="th-card th-card--unit" style={{ marginLeft: 12 }} id={`th-card-unit-${unit.stamp}`}>
      <div className="th-card__head">
        <ThAvatar initials={actor.initials} hue={actor.hue} round />
        <span className="th-card__who">{unit.summary}</span>
      </div>
      {notAudit ? <div className="th-tag th-tag--tertiary">Not part of the business audit · {unit.detail.source ?? 'separate simulated source'}</div> : null}
      <dl className="th-kv">
        <div>
          <dt>Actor</dt>
          <dd>
            {actor.fullName} · {actor.role}
          </dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>
            {fmt.dateTime(unit.at)} {TZ_LABEL}
            <br />
            <span className="th-hint">{fmt.utc(unit.at)}</span>
          </dd>
        </div>
        <div>
          <dt>Kind</dt>
          <dd>{unit.kind}</dd>
        </div>
        <div>
          <dt>Affected</dt>
          <dd>
            {unit.contacts.length === 0 ? '—' : null}
            {unit.contacts.map((c) => (
              <div key={c.contactId}>
                {ws.server.contactName(c.contactId)}
                {c.entityVersion ? ` · revision ${c.entityVersion}` : ''}
              </div>
            ))}
          </dd>
        </div>
      </dl>
      {children.length ? (
        <div className="th-mini">
          <div className="th-mini__title">Units in this batch</div>
          <span className="th-hint">One single-contact Save per contact; the batch is a simulated grouping, not a multi-contact API.</span>
          {children.map((c) => (
            <div key={c.stamp} className="th-mini__row">
              <span className="th-mono">{c.contacts[0]?.entityVersion}</span>
              <span>
                {ws.server.contactName(c.contacts[0]!.contactId)} — {c.summary}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {unit.actions.length ? (
        canValues ? (
          <ol className="th-actions">
            {unit.actions.map((a) => (
              <li key={a.seq} className="th-action">
                <span className="th-action__seq">{a.seq}</span>
                <div>
                  <div>
                    {a.summary}
                    <span className="th-action__kind">{a.kind}</span>
                  </div>
                  {a.before !== null || a.after !== null ? (
                    <div className="th-action__ba">
                      {a.before !== null ? <span className="th-before">− {a.before}</span> : null}
                      {a.after !== null ? <span className="th-after">+ {a.after}</span> : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <span className="th-hint">Action values hidden: {ws.persona.name} lacks read_history for this contact.</span>
        )
      ) : null}
      <details className="th-details">
        <summary>Technical details</summary>
        <dl className="th-details__body">
          <dt>Stamp</dt>
          <dd>{unit.stamp}</dd>
          <dt>Correlation</dt>
          <dd>{unit.correlationId}</dd>
          {Object.entries(unit.detail).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </details>
      <div className="th-card__actions">
        {unit.contacts.map((c) =>
          c.entityVersion && ws.can('read_history', c.contactId) ? (
            <button key={c.contactId} className="th-btn th-btn--sm th-btn--filled" onClick={() => nav.thread(c.contactId, `rev:${c.entityVersion}`, null, c.contactId === contactId)}>
              Open {ws.server.contactName(c.contactId)} at revision {c.entityVersion}
            </button>
          ) : c.entityVersion ? (
            <span key={c.contactId} className="th-hint">
              {ws.server.contactName(c.contactId)}: history needs read_history
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

export type { Family };
