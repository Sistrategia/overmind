// Desk tenant activity: filter bar + table, unit detail in the rail, evidence links back
// to the contact at the relevant revision with filters preserved in the URL.
import { useMemo } from 'react';
import { childTitle } from '../../core/engine';
import { fmtDate, fmtTime } from '../../core/format';
import type { AuditUnit } from '../../core/model';
import { FAMILY_LABEL } from '../../core/model';
import { buildHash, navigate, type Route } from '../../core/router';
import { actorName, actorShort, PERSONAS } from '../../core/personas';
import type { ActivityFilters, ActivityItem } from '../../core/server';
import { useActivity, useContacts, useSession, useWorkspace } from '../../core/workspace';
import { ActionsList, UnitMeta, When } from '../../shared/evidence';
import { Avatar, Badge, Empty, ProblemView, Spinner } from '../../shared/ui';

export function filtersFromRoute(r: Route): ActivityFilters {
  return { actor: r.params.actor || undefined, contact: r.params.contact || undefined, family: (r.params.family as ActivityFilters['family']) || undefined, from: r.params.from || undefined, to: r.params.to || undefined, q: r.params.q || undefined, source: (r.params.source as ActivityFilters['source']) || undefined };
}

export function affectedRecords(u: AuditUnit, ws: ReturnType<typeof useWorkspace>): { label: string; key: string }[] {
  const snap = ws.server.snapshotAt(u.contactKey, u.entityVersion)!;
  const out: { label: string; key: string }[] = [];
  for (const a of u.actions) {
    if (a.target.family === 'profile') out.push({ label: 'Profile', key: 'profile' });
    else if (a.target.family === 'root') out.push({ label: 'Contact root', key: 'root' });
    else {
      const fam = a.target.family;
      const c = (snap[fam === 'email' ? 'emails' : fam === 'phone' ? 'phones' : fam === 'web_link' ? 'webLinks' : 'addresses'] as { ordinal: number }[]).find(x => x.ordinal === (a.target as { ordinal: number }).ordinal);
      out.push({ label: c ? `${childTitle(c as never)} (identity ${(a.target as { ordinal: number }).ordinal})` : `${FAMILY_LABEL[fam]} ${(a.target as { ordinal: number }).ordinal}`, key: `${fam}#${(a.target as { ordinal: number }).ordinal}` });
    }
  }
  if (u.account) out.push({ label: `Account ${u.account.loginName}`, key: 'account' });
  return out.filter((x, i, arr) => arr.findIndex(y => y.key === x.key) === i);
}

export function DeskActivity({ route }: { route: Route }) {
  const ws = useWorkspace();
  const { persona } = useSession();
  const filters = useMemo(() => filtersFromRoute(route), [route]);
  const act = useActivity(filters);
  const contacts = useContacts();
  const selectedUnit = route.params.unit || null;
  const set = (patch: Record<string, string>) => navigate({ variant: 'desk', screen: 'activity', segment: '', params: { ...route.params, ...patch } }, { replace: true });
  const active = Object.entries(filters).filter(([, v]) => v);
  const returnHash = buildHash({ variant: 'desk', screen: 'activity', segment: '', params: route.params });

  const openUnit = (id: string) => set({ unit: id });

  if (act.problem?.code === 'forbidden') {
    return (
      <div className="denied" data-testid="activity-denied">
        <h1 style={{ fontSize: 20 }}>Tenant activity</h1>
        <ProblemView problem={act.problem} />
        <p className="small muted">Editors work from a contact's own history instead. Switch persona to the administrator or the auditor in the demo controls to open this view.</p>
        <p className="tiny faint">A tenant-wide activity explorer is a proposed capability; the current API exposes per-contact revisions only.</p>
      </div>
    );
  }

  return (
    <div className="activity" data-testid="activity">
      <div className="row wrap"><h1>Tenant activity</h1><Badge tone="warn" title="No production endpoint yet">proposed capability</Badge><span className="small muted">{ws.server.tenant().name} · committed audit units and clearly separated operational events</span></div>
      <div className="filters" role="search">
        <div className="field"><label htmlFor="f-q">Search</label><input id="f-q" className="input" value={filters.q ?? ''} onChange={e => set({ q: e.target.value })} placeholder="summary, actor, value…" data-testid="filter-q" /></div>
        <div className="field"><label htmlFor="f-actor">Actor</label>
          <select id="f-actor" className="select" value={filters.actor ?? ''} onChange={e => set({ actor: e.target.value })} data-testid="filter-actor"><option value="">Anyone</option>{PERSONAS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}<option value="system">System</option></select></div>
        <div className="field"><label htmlFor="f-contact">Contact</label>
          <select id="f-contact" className="select" value={filters.contact ?? ''} onChange={e => set({ contact: e.target.value })} data-testid="filter-contact"><option value="">Any contact</option>{(contacts.data ?? []).map(c => <option key={c.key} value={c.slug}>{c.displayName}</option>)}</select></div>
        <div className="field"><label htmlFor="f-family">Action family</label>
          <select id="f-family" className="select" value={filters.family ?? ''} onChange={e => set({ family: e.target.value })} data-testid="filter-family"><option value="">Any</option><option value="profile">Profile</option><option value="email">Email</option><option value="phone">Phone</option><option value="address">Address</option><option value="web_link">Web link</option><option value="provisioning">Provisioning</option></select></div>
        <div className="field"><label htmlFor="f-from">From</label><input id="f-from" type="date" className="input" value={filters.from ?? ''} onChange={e => set({ from: e.target.value })} data-testid="filter-from" /></div>
        <div className="field"><label htmlFor="f-to">To</label><input id="f-to" type="date" className="input" value={filters.to ?? ''} onChange={e => set({ to: e.target.value })} data-testid="filter-to" /></div>
        <div className="field"><label htmlFor="f-source">Source</label>
          <select id="f-source" className="select" value={filters.source ?? 'all'} onChange={e => set({ source: e.target.value })} data-testid="filter-source"><option value="all">Audit + operational</option><option value="audit">Business audit only</option><option value="operational">Operational only</option></select></div>
      </div>
      {active.length > 0 && (
        <div className="chips" data-testid="filter-chips">
          <span className="muted">Filters:</span>
          {active.map(([k, v]) => <span key={k} className="chip-f">{k} = {String(v)}<button onClick={() => set({ [k]: '' })} aria-label={`Clear ${k}`}>✕</button></span>)}
          <button className="btn quiet sm" onClick={() => navigate({ variant: 'desk', screen: 'activity' })}>Clear all</button>
        </div>
      )}
      {act.loading && !act.data && <Spinner label="Loading activity" />}
      {act.problem && <ProblemView problem={act.problem} />}
      {act.data && act.data.length === 0 && <Empty data-testid="activity-empty">No activity matches these filters. Widen the date range or clear a filter.</Empty>}
      {act.data && act.data.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="acttable" data-testid="activity-table">
            <thead><tr><th>When ({'CST'})</th><th>Actor</th><th>Record</th><th>What happened</th><th className="hide-narrow">Source</th><th className="cnt hide-narrow">Actions</th></tr></thead>
            <tbody>
              {act.data.map(item => item.kind === 'unit' ? (
                <tr key={item.unit.id} className={`clickable ${selectedUnit === item.unit.id ? 'selected' : ''}`} onClick={() => openUnit(item.unit.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openUnit(item.unit.id); }} data-testid="activity-row" data-unit={item.unit.id}>
                  <td className="when">{fmtDate(item.at)} {fmtTime(item.at)}</td>
                  <td><span className="row"><Avatar actorKey={item.unit.actorKey} />{actorShort(item.unit.actorKey)}</span></td>
                  <td>{item.contact?.displayName ?? '—'} <span className="faint tiny">rev {item.unit.entityVersion}</span></td>
                  <td>{item.unit.summary}</td>
                  <td className="hide-narrow"><Badge tone={item.unit.source === 'provisioning' ? 'accent' : ''}>{item.unit.source === 'provisioning' ? 'Provisioning' : 'Contact change'}</Badge></td>
                  <td className="cnt hide-narrow">{item.unit.actions.length}</td>
                </tr>
              ) : (
                <tr key={item.event.id} className="op" data-testid="activity-op-row">
                  <td className="when">{fmtDate(item.at)} {fmtTime(item.at)}</td>
                  <td><span className="row"><Avatar actorKey={item.event.actorKey} />{actorShort(item.event.actorKey)}</span></td>
                  <td>{item.contact?.displayName ?? '—'}</td>
                  <td>{item.event.summary}{item.event.detail && <div className="tiny muted">{item.event.detail}</div>}</td>
                  <td className="hide-narrow"><Badge tone={item.event.outcome === 'rejected' ? 'danger' : item.event.outcome === 'uncertain' ? 'warn' : ''}>{item.event.category === 'sidekick' ? 'Sidekick (local)' : 'Operational (simulated)'}</Badge></td>
                  <td className="cnt hide-narrow">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tiny faint">Operational and sidekick rows are not part of the business audit: rejected attempts, lost acknowledgements and assistant activity would need a separate durable log. An increasing dbrow_version orders one contact's changes; it is not proof of cross-contact commit order.</p>
      <span hidden data-testid="return-hash">{returnHash}</span>
      <span hidden>{actorName(persona.actorKey)}</span>
    </div>
  );
}

export function UnitDrawer({ unitId, route }: { unitId: string; route: Route }) {
  const ws = useWorkspace();
  const { persona } = useSession();
  const read = ws.server.getUnit(unitId, persona);
  if ('code' in read) return <div className="unit-drawer"><ProblemView problem={read} /></div>;
  const { unit, contact } = read;
  const affected = affectedRecords(unit, ws);
  const returnHash = buildHash({ variant: 'desk', screen: 'activity', segment: '', params: route.params });
  const openContact = (key?: string) => navigate({ variant: 'desk', screen: 'history', segment: contact?.slug ?? unit.contactKey, params: { rev: String(unit.entityVersion), compare: unit.entityVersion > 1 ? String(unit.entityVersion - 1) : '', from: returnHash, hl: key ?? '' } });
  return (
    <div className="unit-drawer" data-testid="unit-drawer">
      <div className="row"><h3>Audit unit</h3><span className="mono small muted">…{unit.id.slice(-6)}</span><span className="grow" /><button className="btn quiet icon sm" onClick={() => navigate({ variant: 'desk', screen: 'activity', segment: '', params: { ...route.params, unit: '' } }, { replace: true })} aria-label="Close unit">✕</button></div>
      <UnitMeta unit={unit} contactName={contact?.displayName} />
      <div>
        <h4 className="small strong" style={{ marginBottom: 4 }}>Affected records</h4>
        <div className="affected">
          <div className="a"><Badge>{contact?.category ?? 'Contact'}</Badge><span>{contact?.displayName ?? unit.contactKey}</span><button className="btn sm" onClick={() => openContact()} data-testid="open-contact-revision">Open revision {unit.entityVersion}</button></div>
          {affected.map(a => <div className="a" key={a.key}><span className="faint">↳</span><span>{a.label}</span>{a.key !== 'account' && <button className="btn quiet sm" onClick={() => openContact(a.key)}>Show</button>}</div>)}
        </div>
      </div>
      <div>
        <h4 className="small strong" style={{ marginBottom: 4 }}>Actions, in order</h4>
        <ActionsList actions={unit.actions} dense />
      </div>
      <p className="tiny faint">Recorded <When iso={unit.recordedAt} />. Following “Open revision” keeps these filters; use ← Activity in the evidence rail to return.</p>
      <ItemsNote items={[]} />
    </div>
  );
}
function ItemsNote({ items }: { items: ActivityItem[] }) { return items.length ? null : null; }
