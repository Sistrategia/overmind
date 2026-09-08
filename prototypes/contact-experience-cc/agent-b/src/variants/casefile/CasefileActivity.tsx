import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CasefileNav } from './CasefileApp';
import { Avatar } from './CasefileApp';
import { useWorkspace } from '../../core/store';
import { useReportPresence, useEscape, useFocusReturn } from '../../core/hooks';
import { Icon } from '../../core/icons';
import type { ActivityFilters, AuditUnit } from '../../core/types';
import { fmt, TZ_LABEL } from '../../core/format';
import { personaById, PERSONAS } from '../../core/fixtures';
import { activeFilterCount, filtersFromQuery, SOURCE_LABEL } from '../../core/activity';

const FAMILY_OPTIONS: { value: ActivityFilters['family']; label: string }[] = [
  { value: 'all', label: 'All families' },
  { value: 'profile', label: 'Profile' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'web_link', label: 'Web link' },
  { value: 'address', label: 'Address' },
  { value: 'contact', label: 'Contact lifecycle' },
  { value: 'account', label: 'Account' },
];
const SOURCE_OPTIONS: { value: ActivityFilters['source']; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'business', label: 'Committed changes' },
  { value: 'batch', label: 'Administrative batches' },
  { value: 'operational', label: 'Operational (not audit)' },
  { value: 'agent', label: 'Sidekick (not audit)' },
  { value: 'presence', label: 'Presence (not audit)' },
];

export function CasefileActivity({ nav, query }: { nav: CasefileNav; query: URLSearchParams }) {
  const ws = useWorkspace();
  const filters = useMemo(() => filtersFromQuery(query), [query]);
  const unitStamp = query.get('unit');
  useReportPresence(null, 'activity', false);
  const [text, setText] = useState(filters.q);
  useEffect(() => setText(filters.q), [filters.q]);
  const debounce = useRef<number | null>(null);
  const set = (patch: Partial<ActivityFilters>) => nav.activity({ ...filters, ...patch }, unitStamp, true);
  const onText = (v: string) => {
    setText(v);
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => nav.activity({ ...filters, q: v }, unitStamp, true), 250);
  };
  const results = ws.activity(filters);
  const allowed = results !== null;

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

  const selected = unitStamp ? ws.unit(unitStamp) : null;

  return (
    <div>
      <h1 className="cf-page-title">Tenant activity · {ws.tenant.name}</h1>
      <p className="cf-page-sub">
        Application activity view (proposed capability). Committed business changes are audit units; operational, sidekick and presence entries come from other sources and are labelled “not audit”. Times shown in {TZ_LABEL}.
      </p>
      {!allowed ? (
        <div className="cf-bar cf-bar--danger" role="alert">
          <Icon name="shield" className="cf-bar__icon" />
          <div className="cf-bar__body">
            <div className="cf-bar__title">403 · forbidden</div>
            <div>
              {ws.persona.fullName} ({ws.persona.role}) does not hold the proposed <code>read_activity</code> capability. Switch to Sofía (administrator) or Diego (auditor) in the demo controls to investigate tenant activity.
            </div>
          </div>
        </div>
      ) : (
        <div className="cf-card">
          <div className="cf-filters" role="search" aria-label="Activity filters">
            <div className="cf-field">
              <label htmlFor="af-q">Search</label>
              <div className="cf-filters__search">
                <Icon name="search" size={16} />
                <input id="af-q" value={text} onChange={(e) => onText(e.target.value)} placeholder="Summary, actor, contact, stamp, action…" />
                {text ? (
                  <button className="cf-btn cf-btn--subtle cf-btn--icon cf-btn--sm" onClick={() => onText('')} aria-label="Clear search">
                    <Icon name="close" size={14} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="cf-field">
              <label htmlFor="af-actor">Actor</label>
              <select id="af-actor" className="cf-select" value={filters.actor} onChange={(e) => set({ actor: e.target.value as ActivityFilters['actor'] })}>
                <option value="all">Anyone</option>
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="cf-field">
              <label htmlFor="af-contact">Contact</label>
              <select id="af-contact" className="cf-select" value={filters.contact} onChange={(e) => set({ contact: e.target.value })}>
                <option value="all">Any contact</option>
                {ws.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="cf-field">
              <label htmlFor="af-family">Family / action</label>
              <select id="af-family" className="cf-select" value={filters.family} onChange={(e) => set({ family: e.target.value as ActivityFilters['family'] })}>
                {FAMILY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="cf-field">
              <label htmlFor="af-source">Source</label>
              <select id="af-source" className="cf-select" value={filters.source} onChange={(e) => set({ source: e.target.value as ActivityFilters['source'] })}>
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="cf-field">
              <label htmlFor="af-from">From</label>
              <input id="af-from" type="date" className="cf-input" value={filters.from ?? ''} onChange={(e) => set({ from: e.target.value || null })} />
            </div>
            <div className="cf-field">
              <label htmlFor="af-to">To</label>
              <input id="af-to" type="date" className="cf-input" value={filters.to ?? ''} onChange={(e) => set({ to: e.target.value || null })} />
            </div>
            <button className="cf-btn" onClick={() => nav.activity(undefined, unitStamp, true)} disabled={activeFilterCount(filters) === 0}>
              Clear
            </button>
          </div>
          {activeFilterCount(filters) ? (
            <div className="cf-chips" aria-label="Active filters">
              {filters.actor !== 'all' ? <Chip label={`Actor: ${personaById(filters.actor).name}`} onRemove={() => set({ actor: 'all' })} /> : null}
              {filters.contact !== 'all' ? <Chip label={`Contact: ${ws.server.contactName(filters.contact)}`} onRemove={() => set({ contact: 'all' })} /> : null}
              {filters.family !== 'all' ? <Chip label={`Family: ${FAMILY_OPTIONS.find((o) => o.value === filters.family)?.label}`} onRemove={() => set({ family: 'all' })} /> : null}
              {filters.source !== 'all' ? <Chip label={`Source: ${SOURCE_OPTIONS.find((o) => o.value === filters.source)?.label}`} onRemove={() => set({ source: 'all' })} /> : null}
              {filters.from ? <Chip label={`From ${filters.from}`} onRemove={() => set({ from: null })} /> : null}
              {filters.to ? <Chip label={`To ${filters.to}`} onRemove={() => set({ to: null })} /> : null}
              {filters.q ? <Chip label={`“${filters.q}”`} onRemove={() => onText('')} /> : null}
              <span className="cf-hint" style={{ alignSelf: 'center' }}>
                {rows.filter((r) => !r.child).length} result{rows.filter((r) => !r.child).length === 1 ? '' : 's'}
              </span>
            </div>
          ) : null}
          {ws.demo.loading ? (
            <div className="cf-skeleton" aria-busy="true">
              <span style={{ width: '30%' }} />
              <span style={{ width: '80%' }} />
              <span style={{ width: '75%' }} />
              <span style={{ width: '60%' }} />
            </div>
          ) : rows.length === 0 ? (
            <div className="cf-empty">
              <strong>No activity matches these filters</strong>
              Try widening the time range, clearing the actor or family, or searching for a stamp.
            </div>
          ) : (
            <table className="cf-grid">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Time</th>
                  <th style={{ width: 160 }}>Actor</th>
                  <th>Summary</th>
                  <th className="cf-col-opt" style={{ width: 150 }}>
                    Contacts
                  </th>
                  <th className="cf-col-opt" style={{ width: 130 }}>
                    Families
                  </th>
                  <th style={{ width: 150 }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {days.map((g) => (
                  <React.Fragment key={g.day}>
                    <tr className="cf-day">
                      <td colSpan={6}>{g.label}</td>
                    </tr>
                    {g.rows.map(({ unit, child }) => {
                      const actor = personaById(unit.actorId);
                      return (
                        <tr
                          key={unit.stamp}
                          className={`cf-unit${child ? ' cf-unit--batchchild' : ''}`}
                          aria-selected={unit.stamp === unitStamp}
                          tabIndex={0}
                          onClick={() => nav.activity(filters, unit.stamp, true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              nav.activity(filters, unit.stamp, true);
                            }
                          }}
                        >
                          <td className="cf-time">{fmt.time(unit.at)}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Avatar initials={actor.initials} hue={actor.hue} size="sm" /> {actor.name}
                            </span>
                          </td>
                          <td className="cf-summary">
                            {child ? '↳ ' : ''}
                            {unit.summary}
                            {unit.contacts[0]?.entityVersion ? <small>revision {unit.contacts.map((c) => c.entityVersion).join(', ')}</small> : null}
                          </td>
                          <td className="cf-col-opt">{unit.contacts.map((c) => ws.server.contactName(c.contactId)).join(', ')}</td>
                          <td className="cf-col-opt">{unit.families.map((f) => (f === 'web_link' ? 'web link' : f)).join(', ') || '—'}</td>
                          <td>
                            <span className={`cf-source cf-source--${unit.source}`}>{SOURCE_LABEL[unit.source]}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {selected ? <UnitDrawer unit={selected} nav={nav} filters={filters} onClose={() => nav.activity(filters, null, true)} /> : null}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="cf-chip">
      {label}
      <button onClick={onRemove} aria-label={`Remove filter ${label}`}>
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}

function UnitDrawer({ unit, nav, filters, onClose }: { unit: AuditUnit; nav: CasefileNav; filters: ActivityFilters; onClose: () => void }) {
  const ws = useWorkspace();
  useEscape(true, onClose);
  useFocusReturn(true);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [unit.stamp]);
  const actor = personaById(unit.actorId);
  const notAudit = unit.source === 'operational' || unit.source === 'agent' || unit.source === 'presence';
  const children = unit.source === 'batch' ? ws.server.data.units.filter((u) => u.batchId === unit.batchId && u.source === 'business') : [];
  return (
    <>
      <div className="cf-drawer-backdrop" onClick={onClose} />
      <aside className="cf-drawer" role="dialog" aria-labelledby="cf-unit-title" aria-modal="true">
        <div className="cf-drawer__head">
          <div style={{ flex: 1 }}>
            <span className={`cf-source cf-source--${unit.source}`}>{SOURCE_LABEL[unit.source]}</span>
            <h2 id="cf-unit-title">{unit.summary}</h2>
          </div>
          <button ref={first} className="cf-btn cf-btn--subtle cf-btn--icon" onClick={onClose} aria-label="Close details">
            <Icon name="close" />
          </button>
        </div>
        <div className="cf-drawer__body">
          {notAudit ? (
            <div className="cf-bar cf-bar--warning">
              <Icon name="info" className="cf-bar__icon" />
              <div className="cf-bar__body">This entry is not part of the business audit ledger. It comes from {unit.detail.source ?? 'a separate simulated source'} and does not represent a committed revision.</div>
            </div>
          ) : null}
          <dl className="cf-meta">
            <dt>Actor</dt>
            <dd style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Avatar initials={actor.initials} hue={actor.hue} size="sm" /> {actor.fullName} · {actor.role}
            </dd>
            <dt>When</dt>
            <dd>
              {fmt.dateTime(unit.at)} {TZ_LABEL}
              <br />
              <span className="cf-hint">{fmt.utc(unit.at)}</span>
            </dd>
            <dt>Kind</dt>
            <dd>{unit.kind}</dd>
            <dt>Affected</dt>
            <dd>
              {unit.contacts.length === 0 ? '—' : null}
              {unit.contacts.map((c) => (
                <div key={c.contactId}>
                  {ws.server.contactName(c.contactId)}
                  {c.entityVersion ? <> · revision {c.entityVersion}</> : null}
                  {c.entityVersion && ws.can('read_history', c.contactId) ? (
                    <>
                      {' '}
                      <button className="cf-link" onClick={() => nav.history(c.contactId, c.entityVersion!, c.entityVersion! > 1 ? c.entityVersion! - 1 : null)}>
                        Open revision {c.entityVersion}
                        {c.entityVersion! > 1 ? ` (changes vs ${c.entityVersion! - 1})` : ''}
                      </button>
                    </>
                  ) : c.entityVersion ? (
                    <span className="cf-hint"> · history needs read_history for this contact</span>
                  ) : null}
                </div>
              ))}
            </dd>
            {unit.families.length ? (
              <>
                <dt>Families</dt>
                <dd>{unit.families.join(', ')}</dd>
              </>
            ) : null}
          </dl>
          {children.length ? (
            <>
              <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Units in this batch</h3>
              <p className="cf-hint">Each contact was saved by its own single-contact Save; the batch is a simulated administrative grouping, not a multi-contact API.</p>
              <ol className="cf-actions">
                {children.map((c) => (
                  <li key={c.stamp} className="cf-action">
                    <span className="cf-action__seq">{c.contacts[0]?.entityVersion}</span>
                    <div>
                      <div className="cf-action__summary">
                        {ws.server.contactName(c.contacts[0]!.contactId)} — {c.summary}
                      </div>
                      <button className="cf-link" onClick={() => nav.activity(filters, c.stamp, true)}>
                        Open unit {c.stamp}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {unit.actions.length ? (
            <>
              <h3 style={{ fontSize: 13, margin: '12px 0 6px' }}>Actions ({unit.actions.length}, in order)</h3>
              {unit.contacts.every((c) => ws.can('read_history', c.contactId)) ? (
                <ol className="cf-actions">
                  {unit.actions.map((a) => (
                    <li key={a.seq} className="cf-action">
                      <span className="cf-action__seq">{a.seq}</span>
                      <div>
                        <div className="cf-action__summary">
                          {a.summary}
                          <span className="cf-action__kind">{a.kind}</span>
                        </div>
                        {a.before !== null || a.after !== null ? (
                          <div className="cf-action__ba">
                            {a.before !== null ? <span>− {a.before}</span> : null}
                            {a.after !== null ? <span>+ {a.after}</span> : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="cf-hint">Action values are hidden: {ws.persona.name} lacks read_history for this contact. Only the summary is visible.</p>
              )}
            </>
          ) : null}
          <details className="cf-details">
            <summary>Technical details</summary>
            <dl className="cf-details__body">
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
        </div>
        <div className="cf-drawer__foot">
          {unit.contacts[0] ? (
            <button className="cf-btn" onClick={() => nav.contact(unit.contacts[0]!.contactId)}>
              <Icon name="person" size={16} /> Open {ws.server.contactName(unit.contacts[0].contactId)}
            </button>
          ) : null}
          <button className="cf-btn cf-btn--subtle" onClick={() => nav.activity({ ...filters, actor: unit.actorId }, unit.stamp, true)}>
            Filter by {actor.name}
          </button>
        </div>
      </aside>
    </>
  );
}
