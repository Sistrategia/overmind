// Console panes: dense record table + command stack, revision ladder with three answers
// side by side, tenant activity list + unit detail.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeItem, fieldsOf, type Draft } from '../../core/draft';
import { childTitle, childValueText, displayName, liveChildren } from '../../core/engine';
import { fmtDate, fmtDayMonth, fmtTime } from '../../core/format';
import type { Child, ChildRef, ContactState, Family, PhoneChild, RevisionDiff } from '../../core/model';
import { childKey, FAMILIES, FAMILY_LABEL, FAMILY_LABEL_PLURAL, PROFILE_FIELD_LABEL } from '../../core/model';
import { actorShort } from '../../core/personas';
import type { ActivityItem, ContactSummary, RevisionRead } from '../../core/server';
import { useSession, useWorkspace } from '../../core/workspace';
import { ActionsList, UnitMeta, When } from '../../shared/evidence';
import { ChildForm } from '../../shared/fields';
import { Avatar, Badge, DiffMark, DiffValue, Empty, Kbd, ProblemView, Spinner, TechDetails } from '../../shared/ui';
import type { ContactWorkspace } from '../../shared/use-contact-workspace';
import type { SaveFlow } from '../../shared/use-save';

// ---- generic list pane ---------------------------------------------------------------

export interface ListItem { id: string; primary: ReactNode; secondary?: ReactNode; trailing?: ReactNode; leading?: ReactNode; className?: string }

export function ListPane({ title, count, items, selectedId, onSelect, onAlt, footer, testId }: { title: string; count: number; items: ListItem[]; selectedId: string | null; onSelect: (id: string) => void; onAlt?: (id: string) => void; footer?: ReactNode; testId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = items.findIndex(i => i.id === selectedId);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); const n = items[Math.min(items.length - 1, idx + 1)]; if (n) onSelect(n.id); }
    else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); const n = items[Math.max(0, idx - 1)]; if (n) onSelect(n.id); }
    else if (e.key === 'Enter' && e.shiftKey && onAlt && selectedId) { e.preventDefault(); onAlt(selectedId); }
  };
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [selectedId]);
  return (
    <div className="con-list" ref={ref} data-testid={testId}>
      <div className="lhead"><b>{title}</b><span>{count}</span><span className="grow" /><span className="tiny faint"><Kbd>j</Kbd><Kbd>k</Kbd></span></div>
      <div role="listbox" aria-label={title} tabIndex={0} onKeyDown={onKey} style={{ outline: 'none' }}>
        {items.map(it => (
          <button key={it.id} role="option" aria-selected={it.id === selectedId} className={`litem ${it.className ?? ''}`} onClick={() => onSelect(it.id)} onDoubleClick={() => onAlt?.(it.id)} data-testid={`${testId}-item`} data-id={it.id}>
            <span className="n">{it.leading}</span>
            <span className="col" style={{ gap: 0, minWidth: 0 }}><span className="truncate">{it.primary}</span>{it.secondary && <span className="s">{it.secondary}</span>}</span>
            <span className="t">{it.trailing}</span>
          </button>
        ))}
        {items.length === 0 && <div className="sub">nothing here</div>}
      </div>
      {footer && <div className="sub">{footer}</div>}
    </div>
  );
}

// ---- record table --------------------------------------------------------------------

export function RecordTable({ state, cw, selectedKey, onSelect, onEdit, diff, readOnly, highlight }: {
  state: ContactState; cw: ContactWorkspace | null; selectedKey: string | null; onSelect: (k: string) => void; onEdit: (ref: ChildRef) => void; diff: RevisionDiff | null; readOnly: boolean; highlight: Set<string>;
}) {
  const pending = cw?.projection?.touched ?? new Set<string>();
  const rows: { family: Family; child: Child; removed?: boolean }[] = [];
  for (const f of FAMILIES) {
    for (const c of liveChildren(state, f)) rows.push({ family: f, child: c });
    for (const c of (diff?.children ?? []).filter(x => x.ref.family === f && x.kind === 'removed')) rows.push({ family: f, child: c.old!, removed: true });
  }
  const keys = rows.map(r => childKey({ family: r.family, ordinal: r.child.ordinal }));
  const onKey = (e: React.KeyboardEvent) => {
    const i = keys.indexOf(selectedKey ?? '');
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); onSelect(keys[Math.min(keys.length - 1, i + 1)] ?? keys[0]); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); onSelect(keys[Math.max(0, i - 1)] ?? keys[0]); }
    else if ((e.key === 'Enter' || e.key === 'e') && selectedKey && !readOnly) { e.preventDefault(); const r = rows[i]; if (r) onEdit({ family: r.family, ordinal: r.child.ordinal }); }
  };
  let lastFamily: Family | null = null;
  return (
    <table className="ctable" data-testid="record-table" tabIndex={0} onKeyDown={onKey} aria-label="Contact channels">
      <thead><tr><th style={{ width: 34 }}>id</th><th style={{ width: 34 }}>pos</th><th style={{ width: 110 }}>label</th><th>value</th><th style={{ width: 70 }} className="hide-narrow">ext</th><th style={{ width: 170 }}>flags</th></tr></thead>
      <tbody>
        {rows.map(r => {
          const key = childKey({ family: r.family, ordinal: r.child.ordinal });
          const group = r.family !== lastFamily; lastFamily = r.family;
          const d = diff?.children.find(c => c.ref.family === r.family && c.ref.ordinal === r.child.ordinal);
          const live = liveChildren(state, r.family).length;
          return [
            group && <tr key={`g-${r.family}`} className="group"><td colSpan={6}>{FAMILY_LABEL_PLURAL[r.family]} · {live}{r.family === 'address' ? ' · shared immutable values' : ''}</td></tr>,
            <tr key={key} aria-selected={selectedKey === key} className={`${pending.has(key) ? 'pending' : ''} ${r.removed ? 'removed' : ''} ${highlight.has(key) ? 'hi' : ''}`} onClick={() => onSelect(key)} onDoubleClick={() => !readOnly && !r.removed && onEdit({ family: r.family, ordinal: r.child.ordinal })} data-testid={`row-${key}`} data-target={key}>
              <td className="id">{r.child.ordinal}</td>
              <td className="id">{r.removed ? '×' : r.child.displayOrder}</td>
              <td>{r.child.location ?? <span className="faint">—</span>}{d && (d.kind === 'changed') && d.fields.some(f => f.field === 'location') && <DiffMark kind="changed" />}</td>
              <td className="v">
                {r.family === 'phone' ? childValueText({ ...(r.child as PhoneChild), extension: null } as Child) : childValueText(r.child)}
                {d && d.kind === 'changed' && d.fields.filter(f => !f.technical && f.field !== 'location' && f.field !== 'extension').length > 0 && <div className="hist-diff" data-testid="row-diff">{d.fields.filter(f => !f.technical && f.field !== 'location' && f.field !== 'extension').map(f => <span key={f.field}><span className="muted">{f.label}</span> <DiffValue oldValue={f.old} newValue={f.new} /></span>)}</div>}
              </td>
              <td className="v hide-narrow">{r.family === 'phone' ? ((r.child as PhoneChild).extension ?? <span className="faint">—</span>) : ''}{d && d.kind === 'changed' && d.fields.some(f => f.field === 'extension') && <DiffMark kind="changed" />}</td>
              <td>
                <span className="row wrap" style={{ gap: 4 }}>
                  {r.child.displayOrder === 1 && !r.removed && live > 1 && <Badge tone="accent">primary</Badge>}
                  {!r.child.isPublic && <Badge>private</Badge>}
                  {pending.has(key) && <Badge tone="pending">staged</Badge>}
                  {r.removed && <Badge tone="danger">removed</Badge>}
                  {d?.kind === 'added' && <Badge tone="ok">added</Badge>}
                  {d?.kind === 'changed' && d.fields.some(f => f.field === 'displayOrder') && <Badge tone="hist">moved {d.fields.find(f => f.field === 'displayOrder')!.old as number} → {d.fields.find(f => f.field === 'displayOrder')!.new as number}</Badge>}
                </span>
              </td>
            </tr>
          ];
        })}
        {rows.length === 0 && <tr><td colSpan={6} className="faint">No channels</td></tr>}
      </tbody>
    </table>
  );
}

export function ProfileKV({ state, diff, pending, base }: { state: ContactState; diff: RevisionDiff | null; pending: boolean; base?: ContactState | null }) {
  const p = state.profile;
  const fields: (keyof typeof p)[] = p.contactTypeId === 2 ? ['fullName', 'displayName', 'summary'] : ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'personAlias', 'jobTitle'];
  return (
    <div className="kv" data-testid="profile-kv" data-target="profile">
      {fields.map(f => {
        const d = diff?.profile.find(x => x.field === f);
        const changedPending = pending && base && (base.profile[f] ?? null) !== (p[f] ?? null);
        return [<span className="k" key={`k${f}`}>{PROFILE_FIELD_LABEL[f]}</span>, <span className={`v ${changedPending ? 'chg' : ''}`} key={`v${f}`}>{d ? <DiffValue oldValue={d.old} newValue={d.new} /> : ((p[f] as string | null) ?? <span className="faint">—</span>)}</span>];
      })}
      <span className="k">flags</span><span className="v">{[p.isPrivate && 'private', p.doNotContact && 'do-not-contact', p.recruiting && 'recruiting'].filter(Boolean).join(' ') || <span className="faint">—</span>}</span>
    </div>
  );
}

// ---- command stack --------------------------------------------------------------------

export function CommandStack({ cw, save, selectedIndex, onSelectIndex }: { cw: ContactWorkspace; save: SaveFlow; selectedIndex: number | null; onSelectIndex: (i: number | null) => void }) {
  const d = cw.draft;
  const problems = cw.projection?.problems ?? [];
  const [wire, setWire] = useState(false);
  if (!d || !d.items.length || !cw.base) return null;
  const request = { expectedEntityVersion: d.baseVersion, commands: d.items.map(i => i.command) };
  const busy = save.status.kind === 'saving';
  return (
    <div className="stack" data-testid="pending-tray" role="region" aria-label="Command stack">
      <div className="shead"><b>stack</b><span>{d.items.length} command{d.items.length === 1 ? '' : 's'} · expectedEntityVersion {d.baseVersion} · one Save, one revision</span><span className="grow" /><button className="btn quiet sm" onClick={() => setWire(!wire)} aria-expanded={wire}>{wire ? 'hide' : 'show'} request</button></div>
      <ol data-testid="pending-list">
        {d.items.map((it, i) => {
          const p = problems.find(x => x.itemId === it.id);
          return (
            <li key={it.id} aria-selected={selectedIndex === i} onClick={() => onSelectIndex(i)}>
              <span className="idx">{i + 1}</span>
              <span className="row wrap" style={{ gap: 6 }}><code>{it.command.kind}</code><span className="desc">{describeItem(it, cw.base!)}</span>{it.origin === 'sidekick' && <Badge tone="accent">sidekick</Badge>}{p && <span className="err">{p.message}</span>}</span>
              <button className="btn quiet icon sm" onClick={() => cw.stage.removeItem(it.id)} aria-label={`drop ${i + 1}`} title={`drop ${i + 1}`}>✕</button>
            </li>
          );
        })}
      </ol>
      {wire && <div className="wire" data-testid="wire-preview">POST /api/contacts/{cw.contactKey?.slice(0, 8)}…/save<pre>{JSON.stringify(request, null, 1)}</pre></div>}
      <div className="sfoot">
        <button className="btn primary sm" disabled={busy || problems.length > 0} onClick={() => void save.save()} data-testid="save">{busy ? <><Spinner /> saving</> : 'save'}</button>
        <button className="btn sm" disabled={busy} onClick={() => cw.stage.clear()} data-testid="discard-all">discard</button>
        <span className="tiny faint">or type <code>save</code> · <code>undo</code> · <code>drop n</code> · <Kbd>Ctrl</Kbd><Kbd>S</Kbd></span>
      </div>
    </div>
  );
}

// ---- editor pane -------------------------------------------------------------------------

export function EditorPane({ cw, family, ordinal, onDone }: { cw: ContactWorkspace; family: Family; ordinal: number | null; onDone: () => void }) {
  const state = cw.view;
  const child = state && ordinal !== null ? liveChildren(state, family).find(c => c.ordinal === ordinal) ?? null : null;
  if (ordinal !== null && !child) return <div className="editor"><p className="small">No live {FAMILY_LABEL[family].toLowerCase()} with identity {ordinal}.</p><button className="btn sm" onClick={onDone}>close</button></div>;
  return (
    <div className="editor" data-testid="editor-pane">
      <h3>{child ? `edit ${childTitle(child)} · identity ${child.ordinal}` : `add ${FAMILY_LABEL[family].toLowerCase()}`}</h3>
      <ChildForm family={family} initial={child ? fieldsOf(child) : null} compact submitLabel={child ? 'stage replace' : 'stage insert'}
        onSubmit={f => { if (child) cw.stage.replace({ family, ordinal: child.ordinal }, f); else cw.stage.insert(family, f); onDone(); }} onCancel={onDone}
        extra={child?.family === 'address' ? <AddressInspector cw={cw} valueId={child.value.id} /> : undefined} />
    </div>
  );
}

function AddressInspector({ cw, valueId }: { cw: ContactWorkspace; valueId: string }) {
  const users = cw.ws.server.addressValueUsers(valueId).filter(u => u.key !== cw.contactKey);
  return <TechDetails summary="inspector: shared address value" rows={[['value id', valueId], ['also used by', users.length ? users.map(u => u.displayName).join(', ') + ' (shared value, no relationship implied)' : 'no other current contact'], ['on correction', 'this association selects or creates a new value; others keep this one']]} />;
}

// ---- history: ladder + three answers ------------------------------------------------------

export function Ladder({ units, selected, compare, onSelect, onCompare }: { units: { entityVersion: number; recordedAt: string; actorKey: string }[]; selected: number; compare: number | null; onSelect: (n: number) => void; onCompare: (n: number) => void }) {
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === '[') { e.preventDefault(); if (selected > 1) onSelect(selected - 1); }
    else if (e.key === 'ArrowRight' || e.key === ']') { e.preventDefault(); if (selected < units.length) onSelect(selected + 1); }
    else if (e.key === 'c' && selected > 1) onCompare(selected - 1);
  };
  const lo = compare !== null ? Math.min(compare, selected) : selected, hi = Math.max(compare ?? selected, selected);
  return (
    <div className="ladder" role="group" aria-label="Revision ladder" tabIndex={0} onKeyDown={onKey} data-testid="ladder">
      {units.map(u => (
        <button key={u.entityVersion} className={`rung ${u.entityVersion === selected ? 'sel' : ''} ${u.entityVersion === compare ? 'cmp' : ''} ${u.entityVersion > lo && u.entityVersion < hi ? 'range' : ''}`} onClick={e => (e.shiftKey ? onCompare(u.entityVersion) : onSelect(u.entityVersion))} data-testid={`rev-${u.entityVersion}`} aria-pressed={u.entityVersion === selected} title={`Revision ${u.entityVersion} · click to view, Shift+click to compare against`}>
          <span className="rn">r{u.entityVersion}</span>
          <span className="ra"><Avatar actorKey={u.actorKey} /></span>
          <span className="rd">{fmtDayMonth(u.recordedAt)}</span>
          {u.entityVersion === compare && <span className="tiny">base</span>}
        </button>
      ))}
    </div>
  );
}

function StateColumn({ read }: { read: RevisionRead }) {
  const s = read.state;
  return (
    <div className="kv" data-testid="state-at">
      <span className="k">name</span><span className="v">{s.profile.fullName}{s.profile.displayName ? ` (${s.profile.displayName})` : ''}</span>
      {s.profile.personAlias && <><span className="k">alias</span><span className="v">{s.profile.personAlias}</span></>}
      {FAMILIES.map(f => <StateFamily key={f} state={s} family={f} />)}
    </div>
  );
}
function StateFamily({ state, family }: { state: ContactState; family: Family }) {
  const live = liveChildren(state, family);
  return <><span className="k">{FAMILY_LABEL_PLURAL[family].toLowerCase()}</span><span className="v" style={{ whiteSpace: 'pre-line' }}>{live.length ? live.map(c => `${c.displayOrder}. ${childValueText(c)}${c.location ? ` · ${c.location}` : ''}${c.isPublic ? '' : ' · private'}`).join('\n') : '—'}</span></>;
}

export function PropertyDiff({ diff, highlight, onFocus }: { diff: RevisionDiff; highlight: Set<string>; onFocus?: (k: string) => void }) {
  if (diff.empty) return <div className="diff-empty" data-testid="diff-empty"><Badge tone="hist">no net difference</Badge><span className="small muted">state at {diff.to} equals state at {diff.from}; see the actions column.</span></div>;
  const rows: ReactNode[] = [];
  if (diff.profile.length) {
    rows.push(<tr key="gp" className={`grp ${highlight.has('profile') ? 'hi' : ''}`}><td colSpan={3}>profile</td></tr>);
    for (const f of diff.profile) rows.push(<tr key={`p${f.field}`} className="changed"><td className="p">{f.label}</td><td className="o">{String(f.old ?? '—')}</td><td className="n">{String(f.new ?? '—')}</td></tr>);
  }
  for (const c of diff.children) {
    const k = childKey(c.ref);
    const who = childTitle((c.new ?? c.old)!);
    rows.push(<tr key={`g${k}`} className={`grp ${highlight.has(k) ? 'hi' : ''}`} data-target={k}><td colSpan={3}><span className="row">{who} · identity {c.ref.ordinal}{onFocus && <button className="btn quiet sm" onClick={() => onFocus(k)}>show</button>}</span></td></tr>);
    if (c.kind === 'added') rows.push(<tr key={`a${k}`} className="added"><td className="p">value</td><td className="o">—</td><td className="n">{childValueText(c.new!)} · position {c.new!.displayOrder}</td></tr>);
    else if (c.kind === 'removed') rows.push(<tr key={`r${k}`} className="removed"><td className="p">value</td><td className="o">{childValueText(c.old!)}</td><td className="n">— (identity retained)</td></tr>);
    else for (const f of c.fields.filter(x => !x.technical)) rows.push(<tr key={`${k}${f.field}`} className="changed"><td className="p">{f.label}</td><td className="o">{String(f.old ?? '—')}</td><td className="n">{String(f.new ?? '—')}</td></tr>);
  }
  return <table className="proptable" data-testid="diff-list"><thead><tr><th>property</th><th>r{diff.from}</th><th>r{diff.to}</th></tr></thead><tbody>{rows}</tbody></table>;
}

export function ThreeAnswers({ read, highlight, onFocus }: { read: RevisionRead; highlight: Set<string>; onFocus?: (k: string) => void }) {
  return (
    <div className="three" data-testid="three-answers">
      <section><h3>at revision {read.unit.entityVersion}</h3><StateColumn read={read} /><p className="tiny faint">what the contact looked like</p></section>
      <section><h3>between {read.diff ? `r${read.diff.from} → r${read.diff.to}` : '—'}</h3>{read.diff ? <PropertyDiff diff={read.diff} highlight={highlight} onFocus={onFocus} /> : <p className="small muted">first revision: nothing earlier to compare</p>}<p className="tiny faint">what differs between two states</p></section>
      <section><h3>during this save · {read.actions.length} action{read.actions.length === 1 ? '' : 's'}</h3><ActionsList actions={read.actions} highlight={[...highlight][0] ?? null} dense /><p className="tiny faint">effective actions in order, even when they cancel out</p></section>
    </div>
  );
}

// ---- activity ---------------------------------------------------------------------------

export function activityListItems(items: ActivityItem[]): ListItem[] {
  return items.map(it => it.kind === 'unit'
    ? { id: it.unit.id, leading: <Avatar actorKey={it.unit.actorKey} />, primary: <>{it.contact?.displayName ?? '—'} <span className="faint">r{it.unit.entityVersion}</span> · {it.unit.summary}</>, secondary: `${actorShort(it.unit.actorKey)} · ${it.unit.source === 'provisioning' ? 'provisioning' : 'contact change'} · ${it.unit.actions.length} actions`, trailing: `${fmtDayMonth(it.at)} ${fmtTime(it.at)}` }
    : { id: it.event.id, className: 'op', leading: <Avatar actorKey={it.event.actorKey} />, primary: <>{it.event.summary}</>, secondary: `${it.event.category === 'sidekick' ? 'sidekick (local)' : 'operational (simulated)'} · not in the business audit`, trailing: `${fmtDayMonth(it.at)} ${fmtTime(it.at)}` });
}

export function UnitPane({ unitId, onOpenRevision, onFilterContact }: { unitId: string; onOpenRevision: (contactKey: string, rev: number, highlight?: string) => void; onFilterContact: (slug: string) => void }) {
  const ws = useWorkspace();
  const { persona } = useSession();
  const read = ws.server.getUnit(unitId, persona);
  if ('code' in read) return <ProblemView problem={read} />;
  const { unit, contact } = read;
  const prev = unit.entityVersion > 1 ? ws.server.snapshotAt(unit.contactKey, unit.entityVersion - 1) : null;
  const cur = ws.server.snapshotAt(unit.contactKey, unit.entityVersion)!;
  const rev = ws.server.getRevision(unit.contactKey, unit.entityVersion, prev ? unit.entityVersion - 1 : null, persona);
  return (
    <div className="col" style={{ gap: 12 }} data-testid="unit-drawer">
      <UnitMeta unit={unit} contactName={contact?.displayName} />
      <div className="row wrap">
        <button className="btn primary sm" onClick={() => onOpenRevision(unit.contactKey, unit.entityVersion)} data-testid="open-contact-revision">open {contact?.displayName ?? 'contact'} at r{unit.entityVersion}</button>
        {contact && <button className="btn sm" onClick={() => onFilterContact(contact.slug)}>filter activity to this contact</button>}
      </div>
      <div>
        <h4 className="small strong">affected records</h4>
        <ul className="small" style={{ paddingLeft: 18 }}>
          <li>{contact?.category ?? 'Contact'} <strong>{contact?.displayName ?? unit.contactKey}</strong> → revision {unit.entityVersion} (expected {unit.expectedEntityVersion})</li>
          {[...new Set(unit.actions.map(a => a.target.family === 'profile' ? 'profile' : a.target.family === 'root' ? 'root' : `${a.target.family}#${a.target.ordinal}`))].map(k => {
            const label = k === 'profile' ? 'Profile' : k === 'root' ? 'Contact root' : (() => { const [f, o] = k.split('#'); const c = (cur[f === 'email' ? 'emails' : f === 'phone' ? 'phones' : f === 'web_link' ? 'webLinks' : 'addresses'] as Child[]).find(x => x.ordinal === Number(o)); return c ? `${childTitle(c)} (identity ${o})` : k; })();
            return <li key={k}>{label} <button className="btn quiet sm" onClick={() => onOpenRevision(unit.contactKey, unit.entityVersion, k)}>show</button></li>;
          })}
          {unit.account && <li>Account {unit.account.loginName} (role {unit.account.initialRoleId ?? '—'}) — no secret is recorded</li>}
        </ul>
      </div>
      <div><h4 className="small strong">actions, in order</h4><ActionsList actions={unit.actions} /></div>
      {!('code' in rev) && rev.diff && <div><h4 className="small strong">net difference r{unit.entityVersion - 1} → r{unit.entityVersion}</h4><PropertyDiff diff={rev.diff} highlight={new Set()} /></div>}
      <p className="tiny faint">recorded <When iso={unit.recordedAt} />. An increasing stamp orders this contact's units; it does not prove cross-contact commit order.</p>
    </div>
  );
}

export function contactListItems(contacts: ContactSummary[]): ListItem[] {
  return contacts.map(c => ({ id: c.slug, leading: <span className="id">{c.category === 'Organization' ? 'org' : 'per'}</span>, primary: c.displayName, trailing: `r${c.entityVersion}` }));
}

export function revisionListItems(units: { id: string; entityVersion: number; recordedAt: string; actorKey: string; summary: string }[]): ListItem[] {
  return [...units].reverse().map(u => ({ id: String(u.entityVersion), leading: <span className="id">r{u.entityVersion}</span>, primary: <><Avatar actorKey={u.actorKey} /> {actorShort(u.actorKey)} · {u.summary}</>, trailing: `${fmtDate(u.recordedAt)} ${fmtTime(u.recordedAt)}` }));
}

export function DirectoryTable({ cw }: { cw: ContactWorkspace }) {
  const ws = useWorkspace();
  const { persona } = useSession();
  const dir = ws.server.getDirectory(cw.contactKey!, persona);
  if ('code' in dir) return <ProblemView problem={dir} />;
  const pseudo: ContactState = { publicKey: dir.publicKey, entityVersion: dir.entityVersion, deletedRoot: false, profile: { contactTypeId: dir.category === 'Organization' ? 2 : 1, fullName: dir.displayName, displayName: null, personFirstName: null, personLastName1: null, personLastName2: null, personAlias: null, jobTitle: null, summary: null, isPrivate: false, doNotContact: false, recruiting: false }, emails: dir.emails as ContactState['emails'], phones: dir.phones as ContactState['phones'], webLinks: dir.webLinks as ContactState['webLinks'], addresses: dir.addresses as ContactState['addresses'] };
  return (
    <div className="col" data-testid="record-directory">
      <div className="mode-banner dir" data-testid="directory-banner">directory projection · public channels only, saved order kept (gaps are hidden private items) · no profile details, no history</div>
      <RecordTable state={pseudo} cw={null} selectedKey={null} onSelect={() => undefined} onEdit={() => undefined} diff={null} readOnly highlight={new Set()} />
    </div>
  );
}

export function useHighlightSet(hl: string | undefined): Set<string> { return useMemo(() => new Set((hl ?? '').split(',').filter(Boolean)), [hl]); }

export const ConsoleEmpty = Empty;
export const conDisplayName = displayName;
export type ConsoleDraft = Draft;
