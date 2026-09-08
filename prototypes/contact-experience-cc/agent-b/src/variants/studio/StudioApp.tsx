import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './studio.css';
import { useWorkspace } from '../../core/store';
import { useHashRoute, useMediaQuery } from '../../core/router';
import { CONTACT_IDS } from '../../core/fixtures';
import { Icon } from '../../core/icons';
import type { ActivityFilters } from '../../core/types';
import { filtersToQuery } from '../../core/activity';
import { StudioContact } from './StudioSheet';
import { StudioActivity } from './StudioActivity';
import { StudioInspector, type InspectorTarget } from './StudioInspector';
import { StudioPalette } from './StudioPalette';
import { StudioDemo, StudioToasts, StudioAlerts } from './StudioDemo';
import { initialsOf } from '../../core/format';
import { personaById } from '../../core/fixtures';

export type StudioMode = 'now' | 'timeline' | 'compare';

export interface StudioRoute {
  page: 'contact' | 'activity';
  contactId: string | null;
  mode: StudioMode;
  rev: number | null; // B (selected)
  pin: number | null; // A (compare base)
  sel: string | null; // profile | family.ordinal | new:family
  unit: string | null;
  query: URLSearchParams;
}

export interface StudioNav {
  contact(contactId: string, patch?: Partial<Record<'mode' | 'rev' | 'pin' | 'sel' | 'focus', string | null>>, replace?: boolean): void;
  timeline(contactId: string, rev: number, pin?: number | null, focus?: string | null): void;
  compare(contactId: string, rev: number, pin: number, focus?: string | null): void;
  select(sel: string | null): void;
  activity(filters?: Partial<ActivityFilters>, unit?: string | null, replace?: boolean): void;
}

export function StAvatar({ initials, hue, size }: { initials: string; hue: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`st-avatar${size ? ` st-avatar--${size}` : ''}`} style={{ ['--h' as string]: hue }} aria-hidden="true">
      {initials}
    </span>
  );
}

export default function StudioApp() {
  const ws = useWorkspace();
  const { route: hash, navigate } = useHashRoute();
  const narrow = useMediaQuery('(max-width: 1180px)');
  const phone = useMediaQuery('(max-width: 820px)');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const route = useMemo<StudioRoute>(() => {
    const q = hash.query;
    const page = hash.path[0] === 'activity' ? 'activity' : 'contact';
    const modeRaw = q.get('mode');
    return {
      page,
      contactId: page === 'contact' ? hash.path[1] ?? CONTACT_IDS.lina : null,
      mode: modeRaw === 'timeline' || modeRaw === 'compare' ? modeRaw : 'now',
      rev: q.get('rev') ? Number(q.get('rev')) : null,
      pin: q.get('pin') ? Number(q.get('pin')) : null,
      sel: q.get('sel'),
      unit: q.get('unit'),
      query: q,
    };
  }, [hash]);

  const nav = useMemo<StudioNav>(() => {
    const current = () => ({ mode: route.mode === 'now' ? null : route.mode, rev: route.rev ? String(route.rev) : null, pin: route.pin ? String(route.pin) : null, sel: route.sel });
    return {
      contact: (id, patch, replace) => navigate('studio', `contact/${id}`, { ...(id === route.contactId ? current() : {}), ...(patch ?? {}) }, replace),
      timeline: (id, rev, pin, focus) => navigate('studio', `contact/${id}`, { mode: 'timeline', rev: String(rev), pin: pin ? String(pin) : null, sel: null, focus: focus ?? null }),
      compare: (id, rev, pin, focus) => navigate('studio', `contact/${id}`, { mode: 'compare', rev: String(rev), pin: String(pin), sel: null, focus: focus ?? null }),
      select: (sel) => {
        if (route.contactId) navigate('studio', `contact/${route.contactId}`, { ...current(), sel }, true);
      },
      activity: (filters, unit, replace) => {
        const q = filters ? filtersToQuery({ actor: 'all', contact: 'all', family: 'all', source: 'all', from: null, to: null, q: '', ...filters }) : {};
        navigate('studio', 'activity', { ...q, unit: unit ?? null }, replace);
      },
    };
  }, [navigate, route]);

  useEffect(() => {
    if (hash.path.length === 0) nav.contact(CONTACT_IDS.lina, undefined, true);
  }, [hash.path.length, nav]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // What the inspector should show.
  const target = useMemo<InspectorTarget>(() => {
    if (route.page === 'activity') return route.unit ? { kind: 'unit', stamp: route.unit } : { kind: 'activity' };
    if (!route.contactId) return { kind: 'none' };
    if (route.mode === 'compare' && route.rev && route.pin) return { kind: 'compare', contactId: route.contactId, rev: route.rev, pin: route.pin };
    if (route.mode === 'timeline' && route.rev) return { kind: 'revision', contactId: route.contactId, rev: route.rev };
    if (route.sel) return { kind: 'selection', contactId: route.contactId, sel: route.sel };
    return { kind: 'record', contactId: route.contactId };
  }, [route]);

  const inspectorHidden = narrow && (target.kind === 'record' || target.kind === 'activity' || target.kind === 'none') && !ws.draft && !ws.conflict;

  return (
    <div className="st" data-theme={ws.theme} data-variant-root="studio">
      <div className="st-window">
        {phone && sidebarOpen ? <div className="st-sidebar-backdrop" onClick={() => setSidebarOpen(false)} /> : null}
        <aside className={`st-sidebar${sidebarOpen ? ' st-sidebar--open' : ''}`} aria-label="Sources">
          <a className="st-sidebar__tenant" href="#/" style={{ color: 'inherit', textDecoration: 'none' }} aria-label="Back to gallery">
            <span className="st-sidebar__icon">V</span>
            <span>
              <strong>{ws.tenant.name}</strong>
              <span>Overmind · Studio</span>
            </span>
          </a>
          <div className="st-sidebar__section">Contacts</div>
          {ws.contacts.map((c) => (
            <button
              key={c.id}
              className="st-source"
              aria-current={route.page === 'contact' && route.contactId === c.id ? 'true' : undefined}
              onClick={() => {
                navigate('studio', `contact/${c.id}`);
                setSidebarOpen(false);
              }}
            >
              <span className="st-source__glyph">
                <Icon name={c.category === 'Person' ? 'person' : 'building'} size={15} />
              </span>
              <span>
                <span className="st-source__name">{c.name}</span>
                <span className="st-source__sub">
                  {c.category} · rev {c.revision.entityVersion}
                  {c.projection === 'directory' ? ' · directory' : ''}
                </span>
              </span>
            </button>
          ))}
          <div className="st-sidebar__section">Investigate</div>
          <button
            className="st-source"
            aria-current={route.page === 'activity' ? 'true' : undefined}
            onClick={() => {
              nav.activity(undefined, null);
              setSidebarOpen(false);
            }}
          >
            <span className="st-source__glyph">
              <Icon name="activity" size={15} />
            </span>
            <span>
              <span className="st-source__name">Tenant activity</span>
              <span className="st-source__sub">{ws.canProposed('read_activity') ? 'audit units and events' : 'needs read_activity'}</span>
            </span>
            <span />
          </button>
          <div className="st-sidebar__section">People here</div>
          {ws.presence.filter((p) => p.tabId !== ws.tabId).length === 0 ? <div className="st-presence-row">Only you ({ws.persona.name})</div> : null}
          {ws.presence
            .filter((p) => p.tabId !== ws.tabId)
            .map((p) => (
              <div key={p.tabId} className="st-presence-row" title="Presence is awareness only, not a lock.">
                <StAvatar initials={personaById(p.personaId).initials} hue={personaById(p.personaId).hue} size="sm" />
                <span>
                  {personaById(p.personaId).name} · {p.editing ? 'editing' : 'viewing'} {p.contactId ? ws.server.contactName(p.contactId) : 'activity'}
                </span>
                <span className="st-dot" />
              </div>
            ))}
          <span className="st-sidebar__spacer" />
          <div className="st-sidebar__foot">
            <button className="st-source" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen} aria-controls="st-demo" id="st-demo-btn">
              <StAvatar initials={ws.persona.initials} hue={ws.persona.hue} />
              <span>
                <span className="st-source__name">{ws.persona.fullName}</span>
                <span className="st-source__sub">{ws.persona.role} · demo controls</span>
              </span>
              <Icon name="settings" size={14} />
            </button>
            <button className="st-btn st-btn--quiet" onClick={() => ws.setTheme(ws.theme === 'dark' ? 'light' : 'dark')} aria-pressed={ws.theme === 'dark'} aria-label={ws.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <Icon name={ws.theme === 'dark' ? 'sun' : 'moon'} size={15} /> {ws.theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
            </button>
          </div>
        </aside>
        <main className="st-content" id="st-content">
          {route.page === 'contact' && route.contactId ? (
            <StudioContact key={route.contactId} route={route} nav={nav} onAsk={openPalette} onMenu={() => setSidebarOpen(true)} />
          ) : (
            <StudioActivity route={route} nav={nav} onAsk={openPalette} onMenu={() => setSidebarOpen(true)} />
          )}
        </main>
        <StudioInspector target={target} nav={nav} hidden={inspectorHidden} onAsk={openPalette} />
      </div>
      {paletteOpen ? (
        <StudioPalette
          route={route}
          nav={nav}
          onClose={() => {
            setPaletteOpen(false);
            window.setTimeout(() => document.getElementById('st-ask-btn')?.focus(), 0);
          }}
        />
      ) : null}
      {demoOpen ? <StudioDemo onClose={() => setDemoOpen(false)} nav={nav} /> : null}
      <StudioAlerts nav={nav} />
      <StudioToasts />
    </div>
  );
}

export const _stInitials = initialsOf;
