import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { StudioNav, StudioRoute } from './StudioApp';
import { StAvatar } from './StudioApp';
import { useWorkspace } from '../../core/store';
import { useReportPresence } from '../../core/hooks';
import { Icon } from '../../core/icons';
import type { ActivityFilters, AuditUnit } from '../../core/types';
import { fmt, TZ_LABEL } from '../../core/format';
import { personaById, PERSONAS } from '../../core/fixtures';
import { activeFilterCount, filtersFromQuery, SOURCE_LABEL } from '../../core/activity';

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

function Menu({ label, value, options, onPick, id }: { label: string; value: string; options: { value: string; label: string }[]; onPick: (v: string) => void; id: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const active = value !== 'all';
  return (
    <details className="st-menu" ref={ref}>
      <summary className={`st-btn st-btn--sm${active ? ' st-btn--primary' : ''}`} aria-label={`${label} filter`} id={id}>
        {label} <Icon name="chevronDown" size={12} />
      </summary>
      <div className="st-menu__panel" role="menu">
        {options.map((o) => (
          <label key={o.value} className="st-menu__item" role="menuitemradio" aria-checked={o.value === value}>
            <input
              type="radio"
              name={id}
              checked={o.value === value}
              onChange={() => {
                onPick(o.value);
                if (ref.current) ref.current.open = false;
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export function StudioActivity({ route, nav, onAsk, onMenu }: { route: StudioRoute; nav: StudioNav; onAsk: () => void; onMenu: () => void }) {
  const ws = useWorkspace();
  const filters = useMemo(() => filtersFromQuery(route.query), [route.query]);
  const unitStamp = route.unit;
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

  return (
    <>
      <div className="st-toolbar" role="toolbar" aria-label="Activity toolbar">
        <button className="st-btn st-btn--quiet st-btn--icon st-menu-btn" onClick={onMenu} aria-label="Open sources">
          <Icon name="list" size={16} />
        </button>
        <button className="st-btn st-btn--quiet st-btn--icon" onClick={() => window.history.back()} aria-label="Back">
          <Icon name="chevronLeft" size={16} />
        </button>
        <div className="st-toolbar__title">
          <strong>Tenant activity</strong>
          <span>
            {ws.tenant.name} · application activity view (proposed) · {TZ_LABEL}
          </span>
        </div>
        <span className="st-toolbar__spacer" />
        <button className="st-btn" id="st-ask-btn" onClick={onAsk}>
          <Icon name="sparkle" size={15} /> Ask <span className="st-kbd">⌘K</span>
        </button>
      </div>
      {results === null ? (
        <div className="st-sheet" style={{ padding: 22 }} role="alert">
          <div className="st-card st-card--danger">
            <div className="st-card__title">
              <Icon name="shield" size={14} /> 403 · forbidden
            </div>
            <div>
              {ws.persona.fullName} ({ws.persona.role}) does not hold the proposed <code>read_activity</code> capability. Switch to Sofía or Diego in the demo controls.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="st-filterbar" role="search" aria-label="Activity filters">
            <div className="st-search">
              <Icon name="search" size={15} />
              {filters.actor !== 'all' ? <Token label={`actor:${personaById(filters.actor).name}`} onRemove={() => set({ actor: 'all' })} /> : null}
              {filters.contact !== 'all' ? <Token label={`contact:${ws.server.contactName(filters.contact)}`} onRemove={() => set({ contact: 'all' })} /> : null}
              {filters.family !== 'all' ? <Token label={`family:${filters.family}`} onRemove={() => set({ family: 'all' })} /> : null}
              {filters.source !== 'all' ? <Token label={`source:${filters.source}`} onRemove={() => set({ source: 'all' })} /> : null}
              {filters.from ? <Token label={`from:${filters.from}`} onRemove={() => set({ from: null })} /> : null}
              {filters.to ? <Token label={`to:${filters.to}`} onRemove={() => set({ to: null })} /> : null}
              <input id="sa-q" value={text} onChange={(e) => onText(e.target.value)} placeholder="Search summaries, actions, stamps…" aria-label="Search activity" />
              {text ? (
                <button className="st-btn st-btn--quiet st-btn--icon st-btn--sm" onClick={() => onText('')} aria-label="Clear search">
                  <Icon name="close" size={13} />
                </button>
              ) : null}
            </div>
            <Menu id="sa-actor" label="Actor" value={filters.actor} options={[{ value: 'all', label: 'Anyone' }, ...PERSONAS.map((p) => ({ value: p.id, label: p.fullName }))]} onPick={(v) => set({ actor: v as ActivityFilters['actor'] })} />
            <Menu id="sa-contact" label="Contact" value={filters.contact} options={[{ value: 'all', label: 'Any contact' }, ...ws.contacts.map((c) => ({ value: c.id, label: c.name }))]} onPick={(v) => set({ contact: v })} />
            <Menu id="sa-family" label="Family" value={filters.family} options={FAMILY_OPTIONS} onPick={(v) => set({ family: v as ActivityFilters['family'] })} />
            <Menu id="sa-source" label="Source" value={filters.source} options={SOURCE_OPTIONS} onPick={(v) => set({ source: v as ActivityFilters['source'] })} />
            <label className="st-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              From <input type="date" className="st-input" style={{ width: 138, height: 26 }} value={filters.from ?? ''} onChange={(e) => set({ from: e.target.value || null })} aria-label="From date" />
            </label>
            <label className="st-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              To <input type="date" className="st-input" style={{ width: 138, height: 26 }} value={filters.to ?? ''} onChange={(e) => set({ to: e.target.value || null })} aria-label="To date" />
            </label>
            {activeFilterCount(filters) ? (
              <button className="st-btn st-btn--sm st-btn--quiet" onClick={() => nav.activity(undefined, unitStamp, true)}>
                Clear
              </button>
            ) : null}
            <span className="st-hint" style={{ marginLeft: 'auto' }}>
              {rows.filter((r) => !r.child).length} entr{rows.filter((r) => !r.child).length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          {ws.demo.loading ? (
            <div className="st-sheet">
              <div className="st-skeleton" aria-busy="true">
                <span style={{ width: '30%' }} />
                <span style={{ width: '80%' }} />
                <span style={{ width: '70%' }} />
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="st-sheet">
              <div className="st-empty">
                <strong>No activity matches</strong>
                Widen the range, remove a token, or search a stamp.
              </div>
            </div>
          ) : (
            <div className="st-daylist">
              {days.map((g) => (
                <section key={g.day} className="st-day" aria-label={g.label}>
                  <div className="st-day__h">{g.label}</div>
                  <div className="st-sheet" style={{ animation: 'none' }}>
                    {g.rows.map(({ unit, child }) => {
                      const actor = personaById(unit.actorId);
                      return (
                        <button key={unit.stamp} className={`st-unit${child ? ' st-unit--child' : ''}`} aria-selected={unit.stamp === unitStamp} onClick={() => nav.activity(filters, unit.stamp, true)}>
                          <span className="st-unit__time">{fmt.time(unit.at)}</span>
                          <StAvatar initials={actor.initials} hue={actor.hue} />
                          <span>
                            <span className="st-unit__summary">
                              {child ? '↳ ' : ''}
                              {unit.summary}
                            </span>
                            <span className="st-unit__sub">
                              <span>{actor.name}</span>
                              {unit.contacts.length ? <span>· {unit.contacts.map((c) => `${ws.server.contactName(c.contactId)}${c.entityVersion ? ` rev ${c.entityVersion}` : ''}`).join(', ')}</span> : null}
                              {unit.families.length ? <span>· {unit.families.map((f) => (f === 'web_link' ? 'web link' : f)).join(', ')}</span> : null}
                            </span>
                          </span>
                          <span className={`st-source st-source--${unit.source} st-unit__source`}>{SOURCE_LABEL[unit.source]}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function Token({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="st-token">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`}>
        <Icon name="close" size={11} />
      </button>
    </span>
  );
}
