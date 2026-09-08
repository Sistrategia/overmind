import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './casefile.css';
import { useWorkspace } from '../../core/store';
import { useHashRoute, useMediaQuery } from '../../core/router';
import { CONTACT_IDS } from '../../core/fixtures';
import { Icon } from '../../core/icons';
import { CasefileContact } from './CasefileRecord';
import { CasefileActivity } from './CasefileActivity';
import { CasefileSidekick } from './CasefileSidekick';
import { CasefileDemo, CasefileToasts } from './CasefileDemo';
import type { ActivityFilters } from '../../core/types';
import { filtersToQuery } from '../../core/activity';

export interface CasefileNav {
  contact(contactId: string, query?: Record<string, string | null | undefined>, replace?: boolean): void;
  history(contactId: string, rev: number, compare: number | null, mode?: 'state' | 'changes' | 'actions', focus?: string | null): void;
  activity(filters?: Partial<ActivityFilters>, unit?: string | null, replace?: boolean): void;
  raw(path: string, query?: Record<string, string | null | undefined>, replace?: boolean): void;
}

export function Avatar({ initials, hue, size, square }: { initials: string; hue: number; size?: 'sm' | 'lg'; square?: boolean }) {
  return (
    <span className={`cf-avatar${size ? ` cf-avatar--${size}` : ''}${square ? ' cf-avatar--square' : ''}`} style={{ ['--h' as string]: hue }} aria-hidden="true">
      {initials}
    </span>
  );
}

export default function CasefileApp() {
  const ws = useWorkspace();
  const { route, navigate } = useHashRoute();
  const narrow = useMediaQuery('(max-width: 1100px)');
  const [paneOpen, setPaneOpen] = useState(() => !window.matchMedia('(max-width: 1100px)').matches);
  const [demoOpen, setDemoOpen] = useState(false);

  const nav = useMemo<CasefileNav>(
    () => ({
      contact: (id, query, replace) => navigate('casefile', `contact/${id}`, query, replace),
      history: (id, rev, compare, mode = 'changes', focus = null) =>
        navigate('casefile', `contact/${id}`, { tab: 'history', rev: String(rev), compare: compare === null ? null : String(compare), mode, focus }),
      activity: (filters, unit, replace) => {
        const q = filters ? filtersToQuery({ actor: 'all', contact: 'all', family: 'all', source: 'all', from: null, to: null, q: '', ...filters }) : {};
        navigate('casefile', 'activity', { ...q, unit: unit ?? null }, replace);
      },
      raw: (path, query, replace) => navigate('casefile', path, query, replace),
    }),
    [navigate],
  );

  useEffect(() => {
    if (route.path.length === 0) nav.contact(CONTACT_IDS.lina, undefined, true);
  }, [route.path.length, nav]);

  const page = route.path[0] === 'activity' ? 'activity' : 'contact';
  const contactId = page === 'contact' ? route.path[1] ?? CONTACT_IDS.lina : null;
  const selectedRevision = route.query.get('rev') ? Number(route.query.get('rev')) : null;
  const compareRevision = route.query.get('compare') ? Number(route.query.get('compare')) : null;

  const togglePane = useCallback(() => setPaneOpen((o) => !o), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        togglePane();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePane]);

  return (
    <div className="cf" data-theme={ws.theme} data-variant-root="casefile">
      <header className="cf-appbar">
        <a className="cf-appbar__brand" href="#/" aria-label="Back to gallery">
          <span className="cf-appbar__logo">O</span>
          <span>Overmind</span>
        </a>
        <span className="cf-tenant" title={`Tenant ${ws.tenant.id}`}>
          <span className="cf-tenant__dot" aria-hidden="true" />
          {ws.tenant.name}
        </span>
        <div className="cf-appbar__search" role="search">
          <Icon name="search" size={16} />
          <input placeholder="Search contacts (proposed: no search endpoint yet)" aria-label="Search contacts" disabled />
        </div>
        <div className="cf-appbar__right">
          <button className="cf-btn cf-btn--subtle cf-btn--icon" onClick={() => ws.setTheme(ws.theme === 'dark' ? 'light' : 'dark')} aria-label={ws.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={ws.theme === 'dark'}>
            <Icon name={ws.theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button id="cf-sidekick-toggle" className="cf-btn cf-btn--subtle" onClick={togglePane} aria-pressed={paneOpen} aria-controls="cf-sidekick-pane">
            <Icon name="sparkle" />
            <span>Sidekick</span>
          </button>
          <span className="cf-persona" title={`${ws.persona.fullName} · ${ws.persona.role}`}>
            <Avatar initials={ws.persona.initials} hue={ws.persona.hue} />
            <span className="cf-persona__meta">
              <span className="cf-persona__name">{ws.persona.fullName}</span>
              <span className="cf-persona__role">{ws.persona.role}</span>
            </span>
          </span>
        </div>
      </header>
      <div className={`cf-shell${paneOpen && !narrow ? ' cf-shell--pane' : ''}`}>
        <nav className="cf-rail" aria-label="Primary">
          <button className="cf-rail__btn" aria-current={page === 'contact' ? 'page' : undefined} onClick={() => nav.contact(contactId ?? CONTACT_IDS.lina)}>
            <Icon name="person" size={20} />
            Contacts
          </button>
          <button className="cf-rail__btn" aria-current={page === 'activity' ? 'page' : undefined} onClick={() => nav.activity(undefined, null)}>
            <Icon name="activity" size={20} />
            Activity
          </button>
          <span className="cf-rail__spacer" />
        </nav>
        <main className="cf-main" id="cf-main">
          {page === 'contact' && contactId ? (
            <CasefileContact key={contactId} contactId={contactId} nav={nav} query={route.query} paneOpen={paneOpen && !narrow} />
          ) : (
            <CasefileActivity nav={nav} query={route.query} />
          )}
        </main>
        {paneOpen ? (
          <CasefileSidekick
            nav={nav}
            contactId={contactId}
            selectedRevision={selectedRevision}
            compareRevision={compareRevision}
            filters={page === 'activity' ? route.query : null}
            onClose={() => {
              setPaneOpen(false);
              window.setTimeout(() => document.getElementById('cf-sidekick-toggle')?.focus(), 0);
            }}
          />
        ) : null}
      </div>
      <button className="cf-btn cf-btn--sm cf-demo-btn" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen} aria-controls="cf-demo">
        <Icon name="settings" size={14} />
        Demo controls
      </button>
      {demoOpen ? <CasefileDemo onClose={() => setDemoOpen(false)} nav={nav} /> : null}
      <CasefileToasts />
    </div>
  );
}
