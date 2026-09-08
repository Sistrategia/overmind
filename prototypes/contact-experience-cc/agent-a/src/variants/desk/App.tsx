// Desk: focused record workspace with an evidence rail. Layout: left nav · record · rail (· sidekick).
import { useCallback, useEffect, useMemo, useState } from 'react';
import './desk.css';
import { parseChildKey } from '../../core/model';
import { buildHash, navigate, useRoute } from '../../core/router';
import type { SidekickContext, SidekickProposal, SidekickRef } from '../../core/sidekick';
import { useContacts, useSession, useWorkspace } from '../../core/workspace';
import { DemoDrawer } from '../../shared/demo';
import { Avatar, ThemeToggle, Toasts } from '../../shared/ui';
import { useContactWorkspace } from '../../shared/use-contact-workspace';
import { useSaveFlow } from '../../shared/use-save';
import { DeskActivity, filtersFromRoute, UnitDrawer } from './Activity';
import { DeskRail } from './Rail';
import { DeskRecord } from './Record';
import { DeskSidekick } from './Sidekick';

export default function DeskApp() {
  const ws = useWorkspace();
  const route = useRoute();
  const session = useSession();
  const contacts = useContacts();
  const screen = route.screen || 'contact';
  const slug = route.segment || (screen === 'activity' ? '' : 'lina');
  const contactKey = useMemo(() => (slug ? ws.server.resolveKey(slug) ?? null : null), [ws, slug]);
  const cw = useContactWorkspace(screen === 'activity' ? null : contactKey);
  const save = useSaveFlow(cw);
  const rev = route.params.rev ? Number(route.params.rev) : null;
  const compare = route.params.compare ? Number(route.params.compare) : null;
  const highlight = useMemo(() => (route.params.hl ? route.params.hl.split(',').filter(Boolean) : []), [route.params.hl]);
  const [focus, setFocus] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [search, setSearch] = useState('');
  const sidekickOpen = session.sidekickOpen;
  const setSidekick = (open: boolean) => ws.session.set({ sidekickOpen: open });

  useEffect(() => { setRailOpen(false); setNavOpen(false); }, [route.screen, route.segment]);
  useEffect(() => { if (screen === 'history') setRailOpen(true); }, [screen, route.params.rev]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); setSidekick(!ws.session.get().sidekickOpen); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); (document.getElementById('desk-search') as HTMLInputElement | null)?.focus(); }
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && cw.committed && route.screen !== 'activity') {
        const cur = rev ?? cw.committed.entityVersion;
        const next = e.key === 'ArrowLeft' ? cur - 1 : cur + 1;
        if (next >= 1 && next <= cw.committed.entityVersion) navigate({ variant: 'desk', screen: 'history', segment: slug, params: { rev: String(next), compare: next > 1 ? String(next - 1) : '' } });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ws, rev, cw.committed, slug, route.screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusChild = useCallback((key: string) => { setFocus(key); setRailOpen(false); const el = document.querySelector(`[data-target="${key}"]`); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, []);

  const getContext = useCallback((): SidekickContext => ({
    persona: ws.session.get().persona, contactKey: screen === 'activity' ? null : contactKey, selectedRevision: rev, compareRevision: compare,
    filters: screen === 'activity' ? filtersFromRoute(route) : null, draft: contactKey ? ws.draftFor(contactKey) : null,
    focusedChild: focus ? parseChildKey(focus) : null, screen: screen === 'activity' ? 'activity' : screen === 'history' ? 'history' : 'contact'
  }), [ws, screen, contactKey, rev, compare, route, focus]);

  const onNavigate = useCallback((r: SidekickRef) => {
    const targetSlug = r.contactKey ? ws.server.slugOf(r.contactKey) : slug;
    if (r.kind === 'activity') { navigate({ variant: 'desk', screen: 'activity', segment: '', params: { ...Object.fromEntries(Object.entries(r.filters ?? {}).filter(([, v]) => v).map(([k, v]) => [k, String(v)])), unit: r.unitId ?? '' } }); return; }
    if (r.kind === 'contact') { navigate({ variant: 'desk', screen: 'contact', segment: targetSlug }); return; }
    if (r.kind === 'child' && r.highlight?.[0]) { focusChild(r.highlight[0]); return; }
    const revision = r.revision ?? ws.server.currentVersion(r.contactKey ?? contactKey ?? '');
    navigate({ variant: 'desk', screen: 'history', segment: targetSlug, params: { rev: String(revision), compare: r.compare ? String(r.compare) : revision > 1 ? String(revision - 1) : '', hl: (r.highlight ?? []).join(',') } });
    setRailOpen(true);
  }, [ws, slug, contactKey, focusChild]);

  const onStage = useCallback(async (p: SidekickProposal, mode: 'stage' | 'save') => {
    if (!cw.base || p.contactKey !== contactKey) { ws.toast('warning', 'Open the proposed contact first.'); return false; }
    const d = cw.stage.proposal(p);
    if (mode === 'save') return save.save(d);
    ws.toast('info', `${p.items.length} command${p.items.length === 1 ? '' : 's'} staged in the pending tray.`);
    return true;
  }, [cw, contactKey, save, ws]);

  const list = (contacts.data ?? []).filter(c => !search || c.displayName.toLowerCase().includes(search.toLowerCase()));
  const canActivity = session.persona.grants.includes('activity');

  return (
    <div className="desk" data-variant="desk">
      <a href="#desk-main" className="skip-link">Skip to record</a>
      <header className="desk-top">
        <button className="btn quiet icon" style={{ display: 'none' }} id="desk-menu" onClick={() => setNavOpen(!navOpen)} aria-label="Menu">☰</button>
        <a className="brand" href="#/" title="Back to gallery"><span className="mark">O</span>Overmind</a>
        <span className="tenant" title="Tenant resolved by the host; not a switcher">{ws.server.tenant().name}</span>
        <nav className="crumbs" aria-label="Breadcrumb"><a href={buildHash({ variant: 'desk', screen: 'contact', segment: 'lina' })}>Contacts</a>{screen !== 'activity' && cw.committed && <><span>/</span><strong>{cw.committed.profile.displayName ?? cw.committed.profile.fullName}</strong></>}{screen === 'activity' && <><span>/</span><strong>Activity</strong></>}</nav>
        <span className="grow" />
        <label className="search"><span aria-hidden="true">⌕</span><input id="desk-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find contact  Ctrl K" aria-label="Find contact" /></label>
        <button className="btn quiet" onClick={() => ws.session.set({ demoOpen: true })} title="Persona is chosen in the demo controls" data-testid="persona-chip"><Avatar actorKey={session.persona.actorKey} /> <span className="small">{session.persona.shortName}</span></button>
        <ThemeToggle compact />
        <button className={`btn ${sidekickOpen ? 'primary' : ''}`} onClick={() => setSidekick(!sidekickOpen)} aria-pressed={sidekickOpen} title="Ctrl+/" data-testid="toggle-sidekick">✦ Sidekick</button>
      </header>
      <div className="desk-mobile-tabs">
        <button className="btn sm" onClick={() => setNavOpen(!navOpen)}>☰ Contacts</button>
        {screen !== 'activity' && <button className="btn sm" onClick={() => setRailOpen(!railOpen)} data-testid="mobile-evidence">Evidence</button>}
        <a className="btn sm" href={buildHash({ variant: 'desk', screen: 'activity' })}>Activity</a>
      </div>
      <div className={`desk-body ${sidekickOpen ? 'with-sidekick' : ''}`}>
        <nav className={`desk-nav ${navOpen ? 'open' : ''}`} aria-label="Contacts">
          <div>
            <h4>Contacts</h4>
            <div className="navlist" data-testid="contact-list">
              {list.map(c => <a key={c.key} className={`navitem ${c.key === contactKey && screen !== 'activity' ? 'active' : ''}`} href={buildHash({ variant: 'desk', screen: 'contact', segment: c.slug })}><span className="cat" aria-hidden="true">{c.category === 'Organization' ? 'O' : 'P'}</span><span className="truncate">{c.displayName}</span><span className="rev">r{c.entityVersion}</span></a>)}
              {contacts.data && list.length === 0 && <span className="small muted" style={{ padding: '0 8px' }}>No matches</span>}
            </div>
          </div>
          <div>
            <h4>Investigate</h4>
            <div className="navlist">
              <a className={`navitem ${screen === 'activity' ? 'active' : ''}`} href={buildHash({ variant: 'desk', screen: 'activity' })} title={canActivity ? '' : 'Your role cannot open tenant activity'} data-testid="nav-activity"><span className="cat" aria-hidden="true">⚲</span>Tenant activity{!canActivity && <span className="rev">403</span>}</a>
            </div>
          </div>
          <div className="tiny faint" style={{ marginTop: 'auto', padding: '0 6px' }}>Keys: Enter edit · p primary · Alt+↑↓ reorder · Ctrl+S save · Alt+←→ revisions · Ctrl+/ sidekick</div>
        </nav>
        <main className="desk-main" id="desk-main" tabIndex={-1}>
          {screen === 'activity' ? <DeskActivity route={route} /> : (
            <DeskRecord cw={cw} save={save} slug={slug} rev={rev} compare={compare} highlight={highlight} focus={focus} onFocusHandled={() => setFocus(null)} onOpenRail={() => setRailOpen(true)} />
          )}
        </main>
        <aside className={`desk-rail ${railOpen ? 'open' : ''}`} aria-label="Evidence" data-testid="rail">
          {screen === 'activity' ? (route.params.unit ? <UnitDrawer unitId={route.params.unit} route={route} /> : <div style={{ padding: 16 }} className="small muted">Select a row to open its audit unit: actor, time, affected records and ordered actions.</div>)
            : <DeskRail cw={cw} slug={slug} rev={rev} compare={compare} highlight={highlight} fromActivity={route.params.from || null} onFocusChild={focusChild} />}
        </aside>
        {sidekickOpen && <DeskSidekick getContext={getContext} onNavigate={onNavigate} onStage={onStage} onClose={() => { setSidekick(false); (document.querySelector('[data-testid="toggle-sidekick"]') as HTMLElement | null)?.focus(); }} canEdit={cw.canEdit} />}
      </div>
      <Toasts />
      <DemoDrawer contactKey={contactKey} />
    </div>
  );
}
