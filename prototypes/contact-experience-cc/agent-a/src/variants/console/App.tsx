// Console: keyboard-first command workbench. One command line drives navigation, filters,
// staged edits (an explicit command stack) and the sidekick.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './console.css';
import { fmtDateTime, fmtWeekday } from '../../core/format';
import { parseChildKey } from '../../core/model';
import { buildHash, navigate, useRoute } from '../../core/router';
import type { SidekickContext, SidekickProposal, SidekickRef } from '../../core/sidekick';
import { useStore } from '../../core/store';
import { setTheme } from '../../core/theme';
import { useActivity, useContacts, useRevision, useSession, useWorkspace } from '../../core/workspace';
import { DemoDrawer } from '../../shared/demo';
import { UncertainOutcome } from '../../shared/evidence';
import { ReconcilePanel } from '../../shared/reconcile';
import { Avatar, Badge, Kbd, Presence, ProblemView, Spinner, ThemeToggle, Toasts } from '../../shared/ui';
import { useContactWorkspace } from '../../shared/use-contact-workspace';
import { useSaveFlow } from '../../shared/use-save';
import { useSidekick } from '../../shared/use-sidekick';
import { HELP_LINES, parseCommand, suggestCommands, type ParsedCommand } from './commands';
import { activityListItems, CommandStack, contactListItems, DirectoryTable, EditorPane, Ladder, ListPane, ProfileKV, RecordTable, revisionListItems, ThreeAnswers, UnitPane, useHighlightSet } from './panes';
import { Transcript } from './Transcript';
import { filtersFromRoute } from '../desk/Activity';

export default function ConsoleApp() {
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
  const highlight = useHighlightSet(route.params.hl);
  const log = useStore(ws.api.log);

  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIdx, setMenuIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ family: 'email' | 'phone' | 'web_link' | 'address'; ordinal: number | null } | null>(null);
  const [stackSel, setStackSel] = useState<number | null>(null);
  const [status, setStatus] = useState<{ text: string; tone: 'ok' | 'err' | '' }>({ text: 'ready · press / to type a command or a question', tone: '' });
  const [help, setHelp] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptOpen = session.sidekickOpen;
  const setTranscript = (v: boolean) => ws.session.set({ sidekickOpen: v });

  const units = useMemo(() => (contactKey ? ws.server.unitsFor(contactKey) : []), [ws, contactKey, session.dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = cw.committed?.entityVersion ?? units.length;
  const selRev = screen === 'history' ? (rev ?? current) : null;
  const selCmp = screen === 'history' ? (compare ?? (selRev && selRev > 1 ? selRev - 1 : null)) : null;
  const read = useRevision(screen === 'history' && cw.canHistory ? contactKey : null, selRev, selCmp);
  const filters = useMemo(() => filtersFromRoute(route), [route]);
  const act = useActivity(filters, screen === 'activity');
  const unitId = route.params.unit || null;
  const historical = screen === 'history' && selRev !== null && selRev !== current;

  useEffect(() => { setEditor(null); setHelp(false); setListOpen(false); }, [route.screen, route.segment]);
  useEffect(() => { ws.presence(contactKey, editor ? `${editor.family} ${editor.ordinal ?? 'new'}` : selectedKey ? selectedKey.replace('#', ' ') : null, !!(editor || cw.draft?.items.length)); }, [ws, contactKey, editor, selectedKey, cw.draft?.items.length]);

  const getContext = useCallback((): SidekickContext => ({
    persona: ws.session.get().persona, contactKey: screen === 'activity' ? null : contactKey, selectedRevision: selRev, compareRevision: selCmp,
    filters: screen === 'activity' ? filters : null, draft: contactKey ? ws.draftFor(contactKey) : null, focusedChild: selectedKey ? parseChildKey(selectedKey) : null,
    screen: screen === 'activity' ? 'activity' : screen === 'history' ? 'history' : 'contact'
  }), [ws, screen, contactKey, selRev, selCmp, filters, selectedKey]);

  const onNavigate = useCallback((r: SidekickRef) => {
    const targetSlug = r.contactKey ? ws.server.slugOf(r.contactKey) : slug;
    if (r.kind === 'activity') { navigate({ variant: 'console', screen: 'activity', segment: '', params: { ...Object.fromEntries(Object.entries(r.filters ?? {}).filter(([, v]) => v).map(([k, v]) => [k, String(v)])), unit: r.unitId ?? '' } }); return; }
    if (r.kind === 'contact') { navigate({ variant: 'console', screen: 'contact', segment: targetSlug }); return; }
    if (r.kind === 'child' && r.highlight?.[0]) { setSelectedKey(r.highlight[0]); return; }
    const revision = r.revision ?? ws.server.currentVersion(r.contactKey ?? contactKey ?? '');
    navigate({ variant: 'console', screen: 'history', segment: targetSlug, params: { rev: String(revision), compare: r.compare ? String(r.compare) : revision > 1 ? String(revision - 1) : '', hl: (r.highlight ?? []).join(',') } });
  }, [ws, slug, contactKey]);

  const onStage = useCallback(async (p: SidekickProposal, mode: 'stage' | 'save') => {
    if (!cw.base || p.contactKey !== contactKey) { setStatus({ text: 'open the proposed contact first', tone: 'err' }); return false; }
    if (screen !== 'contact') navigate({ variant: 'console', screen: 'contact', segment: slug });
    const d = cw.stage.proposal(p);
    if (mode === 'save') return save.save(d);
    setStatus({ text: `${p.items.length} sidekick command${p.items.length === 1 ? '' : 's'} added to the stack (${d.items.length} total)`, tone: 'ok' });
    return true;
  }, [cw, contactKey, save, screen, slug]);

  const sk = useSidekick({ getContext, onNavigate, onStage });

  const queued = useRef<string[]>([]);
  const execute = useCallback((text: string) => {
    const ok = (t: string) => setStatus({ text: t, tone: 'ok' });
    const err = (t: string) => setStatus({ text: t, tone: 'err' });
    if (!cw.view && cw.loading && screen !== 'activity' && /^(set|add|remove|delete|rm|restore|primary|first|move|edit|form|save|undo|drop|discard)\b/i.test(text)) {
      // The contact is still loading: hold the command instead of rejecting it.
      queued.current = [...queued.current, text];
      setStatus({ text: `waiting for the contact to load, then: ${queued.current.join(' · ')}`, tone: '' });
      return;
    }
    const cmd: ParsedCommand = parseCommand(text, cw.view);
    switch (cmd.kind) {
      case 'error': err(cmd.message); break;
      case 'nav': {
        if (cmd.target === 'gallery') { location.hash = '#/'; break; }
        if (cmd.target === 'back') { if (route.params.from) location.hash = route.params.from; else history.back(); break; }
        if (cmd.target === 'activity') { navigate({ variant: 'console', screen: 'activity', segment: '', params: cmd.unit ? { ...route.params, unit: resolveUnit(cmd.unit) } : (screen === 'activity' ? route.params : {}) }); ok('tenant activity'); break; }
        const target = cmd.slug ? ws.server.resolveKey(cmd.slug) : contactKey;
        if (!target) { err(`no contact "${cmd.slug}"`); break; }
        const tslug = ws.server.slugOf(target);
        if (cmd.target === 'contact') { navigate({ variant: 'console', screen: 'contact', segment: tslug }); ok(`opened ${ws.server.summary(target)?.displayName}`); break; }
        const cur = ws.server.currentVersion(target);
        const r = cmd.rev ?? cur;
        if (r < 1 || r > cur) { err(`revisions 1..${cur}`); break; }
        navigate({ variant: 'console', screen: 'history', segment: tslug, params: { rev: String(r), compare: cmd.compare ? String(cmd.compare) : r > 1 ? String(r - 1) : '' } });
        ok(cmd.compare ? `comparing r${cmd.compare} → r${r}` : `revision ${r}`);
        break;
      }
      case 'filter': navigate({ variant: 'console', screen: 'activity', segment: '', params: { ...(screen === 'activity' ? route.params : {}), ...cmd.patch } }, { replace: screen === 'activity' }); ok(`filter ${Object.entries(cmd.patch).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' ') || 'cleared'}`); break;
      case 'stage': {
        if (!cw.base) { err('open a contact first'); break; }
        if (!cw.canEdit) { err(`persona ${session.persona.key} has no edit grant; nothing staged`); break; }
        if (historical) { err('historical view is read-only; type "open" to return to the current revision'); break; }
        let d;
        if (cmd.op === 'replace') d = cw.stage.replace({ family: cmd.family!, ordinal: cmd.ordinal! }, cmd.fields!);
        else if (cmd.op === 'insert') d = cw.stage.insert(cmd.family!, cmd.fields!);
        else if (cmd.op === 'delete') d = cw.stage.remove({ family: cmd.family!, ordinal: cmd.ordinal! });
        else if (cmd.op === 'restore') d = cw.stage.restore({ family: cmd.family!, ordinal: cmd.ordinal! }, cmd.fields!);
        else if (cmd.op === 'move') d = cw.stage.move({ family: cmd.family!, ordinal: cmd.ordinal! }, cmd.displayOrder!);
        else d = cw.stage.profile({ ...cw.view!.profile, ...cmd.profilePatch });
        if (screen !== 'contact') navigate({ variant: 'console', screen: 'contact', segment: slug });
        ok(d.items.length ? `staged: ${cmd.description} · stack ${d.items.length}` : `no change: ${cmd.description} equals the base value`);
        break;
      }
      case 'edit': if (!cw.canEdit) { err(`persona ${session.persona.key} has no edit grant`); break; } if (historical) { err('historical view is read-only'); break; } setEditor({ family: cmd.family, ordinal: cmd.ordinal }); ok(cmd.ordinal !== null ? `editing ${cmd.family} ${cmd.ordinal}` : `adding ${cmd.family}`); break;
      case 'stack': {
        const d = cw.draft;
        if (cmd.op === 'save') { if (!d?.items.length) err('stack is empty'); else void save.save(); break; }
        if (cmd.op === 'discard') { cw.stage.clear(); ok('stack cleared'); break; }
        if (cmd.op === 'undo') { if (!d?.items.length) err('stack is empty'); else { cw.stage.removeItem(d.items[d.items.length - 1].id); ok('dropped last command'); } break; }
        if (cmd.op === 'drop') { const it = d?.items[(cmd.index ?? 0) - 1]; if (!it) err(`no command ${cmd.index}`); else { cw.stage.removeItem(it.id); ok(`dropped ${cmd.index}`); } break; }
        if (cmd.op === 'reconcile') { if (cw.stale) save.openConflict(); else err('nothing to reconcile'); break; }
        break;
      }
      case 'meta':
        if (cmd.op === 'persona') { ws.setPersona(cmd.value!); ok(`persona ${cmd.value}`); }
        else if (cmd.op === 'theme') { setTheme(cmd.value as 'light' | 'dark'); ok(`theme ${cmd.value}`); }
        else if (cmd.op === 'reset') { ws.reset(); ok('demo data reset'); }
        else if (cmd.op === 'help') { setHelp(h => !h); ok('help'); }
        else if (cmd.op === 'sidekick') { setTranscript(!transcriptOpen); }
        break;
      case 'ask': setTranscript(true); sk.ask(cmd.text); ok('asked the sidekick'); break;
    }
    function resolveUnit(id: string): string { return ws.server.allUnits().find(u => u.id.endsWith(id))?.id ?? id; }
  }, [cw, ws, route.params, screen, contactKey, slug, session.persona.key, historical, save, sk, transcriptOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cw.view || !queued.current.length) return;
    const [next, ...rest] = queued.current;
    queued.current = rest;
    execute(next);
  }, [cw.view, execute, cw.draft]);

  const suggestions = useMemo(() => suggestCommands(input, cw.view, screen), [input, cw.view, screen]);
  useEffect(() => { setMenuIdx(0); }, [input]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement)?.matches?.('input, textarea, select, [contenteditable]');
      if ((e.key === '/' && !inField) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); setTranscript(!ws.session.get().sidekickOpen); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (cw.draft?.items.length) void save.save(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ws, cw.draft, save]); // eslint-disable-line react-hooks/exhaustive-deps

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setMenuOpen(true); setMenuIdx(i => Math.min(suggestions.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMenuIdx(i => Math.max(0, i - 1)); }
    else if (e.key === 'Tab' && menuOpen && suggestions[menuIdx]) { e.preventDefault(); setInput(suggestions[menuIdx].text); }
    else if (e.key === 'Escape') { setMenuOpen(false); inputRef.current?.blur(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = menuOpen && suggestions[menuIdx] && input.trim() !== suggestions[menuIdx].text && !input.trim() ? suggestions[menuIdx].text : input;
      if (!chosen.trim()) return;
      execute(chosen);
      setInput(''); setMenuOpen(false);
    }
  };

  const listItems = screen === 'activity' ? activityListItems(act.data ?? []) : screen === 'history' ? revisionListItems(units) : contactListItems(contacts.data ?? []);
  const listSelected = screen === 'activity' ? unitId : screen === 'history' ? (selRev !== null ? String(selRev) : null) : slug;
  const onListSelect = (id: string) => {
    if (screen === 'activity') navigate({ variant: 'console', screen: 'activity', segment: '', params: { ...route.params, unit: id } }, { replace: true });
    else if (screen === 'history') navigate({ variant: 'console', screen: 'history', segment: slug, params: { ...route.params, rev: id, compare: Number(id) > 1 ? String(Number(id) - 1) : '' } });
    else navigate({ variant: 'console', screen: 'contact', segment: id });
    setListOpen(false);
  };
  const onListAlt = (id: string) => { if (screen === 'history' && selRev) navigate({ variant: 'console', screen: 'history', segment: slug, params: { ...route.params, compare: id } }); };
  const lastReq = log[0];
  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  return (
    <div className="console" data-variant="console" data-testid="console-root">
      <a href="#con-detail" className="skip-link">Skip to detail</a>
      <header className="con-bar">
        <button className="btn quiet icon sm" onClick={() => setListOpen(!listOpen)} aria-label="Toggle list" title="Toggle list" style={{ display: 'none' }} id="con-list-toggle">☰</button>
        <a className="brand" href="#/" title="Back to gallery"><b>overmind</b> ▸ {ws.server.tenant().name.toLowerCase().replace(' ', '-')}</a>
        <div className="cmd">
          <span className="prompt" aria-hidden="true">›</span>
          <input ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setMenuOpen(true); }} onFocus={() => setMenuOpen(true)} onBlur={() => setTimeout(() => setMenuOpen(false), 120)} onKeyDown={onInputKey}
            placeholder={screen === 'activity' ? 'actor bruno · family phone · q postal · or ask a question' : 'set phone 2 ext 25 · primary email 1 · history · or ask a question'} aria-label="Command line" aria-autocomplete="list" aria-expanded={menuOpen} data-testid="command-input" />
          <span className="hint"><Kbd>/</Kbd> focus · <Kbd>Tab</Kbd> complete · <Kbd>↵</Kbd> run</span>
          {menuOpen && suggestions.length > 0 && (
            <div className="cmd-menu" role="listbox" data-testid="command-menu">
              {suggestions.map((s, i) => [
                (i === 0 || suggestions[i - 1].group !== s.group) && <div key={`g${s.group}`} className="group">{s.group}</div>,
                <div key={s.text} role="option" aria-selected={i === menuIdx} className={`item ${i === menuIdx ? 'active' : ''} ${s.nl ? 'nl' : ''}`} onMouseDown={e => { e.preventDefault(); execute(s.text); setInput(''); setMenuOpen(false); }}><span>{s.text}</span><span className="d">{s.description}</span></div>
              ])}
            </div>
          )}
        </div>
        <button className="btn quiet sm" onClick={() => ws.session.set({ demoOpen: true })} title="Persona is chosen in the demo controls or with: persona <key>" data-testid="persona-chip"><Avatar actorKey={session.persona.actorKey} /> <span className="mono">{session.persona.key}</span></button>
        <ThemeToggle compact />
        <button className={`btn sm ${transcriptOpen ? 'primary' : ''}`} onClick={() => setTranscript(!transcriptOpen)} aria-pressed={transcriptOpen} title="Ctrl+/" data-testid="toggle-sidekick">✦ transcript</button>
      </header>
      <div className={`con-body ${transcriptOpen ? 'with-transcript' : ''}`}>
        <div className={listOpen ? 'con-list open' : 'contents'} style={{ display: 'contents' }}>
          <ListPane title={screen === 'activity' ? 'activity' : screen === 'history' ? 'revisions' : 'contacts'} count={listItems.length} items={listItems} selectedId={listSelected} onSelect={onListSelect} onAlt={onListAlt} testId="list"
            footer={screen === 'history' ? <>Enter view · Shift+Enter set as compare base · <code>compare a b</code></> : screen === 'activity' ? (act.problem ? 'no access' : <>{activeFilters.length ? 'filtered' : 'unfiltered'} · type <code>actor bruno</code>, <code>family phone</code>, <code>clear</code></>) : <>Enter opens · <code>open norte-taller</code></>} />
        </div>
        <main className="con-detail" id="con-detail" tabIndex={-1}>
          {screen === 'activity' && (
            <>
              <div className="dhead"><h1>tenant activity</h1><Badge tone="warn">proposed capability</Badge><span className="small muted">{ws.server.tenant().name}</span></div>
              <div className="con-filters" data-testid="filter-chips">{activeFilters.length ? activeFilters.map(([k, v]) => <span key={k} className="f">{k}={String(v)}<button onClick={() => execute(`${k} none`)} aria-label={`clear ${k}`}>✕</button></span>) : <span className="none">no filters · type actor, family, from, to, q, source</span>}</div>
              <div className="dbody">
                {act.problem?.code === 'forbidden' && <div className="denied" data-testid="activity-denied" style={{ margin: 0 }}><ProblemView problem={act.problem} /><p className="small muted">Type <code>persona rocio</code> or <code>persona tomas</code> to open this view. Editors work from a contact's history.</p></div>}
                {act.problem && act.problem.code !== 'forbidden' && <ProblemView problem={act.problem} />}
                {act.loading && !act.data && <Spinner />}
                {act.data && act.data.length === 0 && <p className="small muted" data-testid="activity-empty">no activity matches these filters · <code>clear</code></p>}
                {act.data && unitId && <UnitPane unitId={unitId} onOpenRevision={(k, r, hl) => navigate({ variant: 'console', screen: 'history', segment: ws.server.slugOf(k), params: { rev: String(r), compare: r > 1 ? String(r - 1) : '', from: buildHash({ variant: 'console', screen: 'activity', segment: '', params: route.params }), hl: hl ?? '' } })} onFilterContact={s => execute(`contact ${s}`)} />}
                {act.data && !unitId && act.data.length > 0 && <p className="small muted">select a unit on the left (j/k, Enter) · {act.data.filter(i => i.kind === 'unit').length} committed units, {act.data.filter(i => i.kind !== 'unit').length} operational events (simulated, separate source)</p>}
              </div>
            </>
          )}
          {screen !== 'activity' && cw.problem && cw.problem.code !== 'forbidden' && <div className="dbody"><ProblemView problem={cw.problem} /></div>}
          {screen !== 'activity' && cw.problem?.code === 'forbidden' && contactKey && (
            <><div className="dhead"><h1>{ws.server.summary(contactKey)?.displayName}</h1><Badge tone="hist">directory only</Badge></div><div className="dbody"><DirectoryTable cw={cw} /></div></>
          )}
          {screen !== 'activity' && !cw.problem && !cw.view && <div className="dbody"><Spinner label="Loading contact" /></div>}
          {screen === 'contact' && cw.view && cw.committed && (
            <>
              <div className="dhead" data-testid="record" data-mode="current">
                <h1>{cw.view.profile.displayName ?? cw.view.profile.fullName}</h1>
                <Badge>{cw.view.profile.contactTypeId === 2 ? 'organization' : 'person'}</Badge>
                <Badge tone="accent">r{cw.committed.entityVersion}</Badge>
                {cw.draft?.items.length ? <Badge tone="pending">stack {cw.draft.items.length}</Badge> : null}
                {!cw.canEdit && <Badge tone="hist">read-only role</Badge>}
                <span className="grow" />
                <Presence contactKey={contactKey} />
              </div>
              <div className="dbody">
                {help && <div className="editor"><h3>commands</h3><ul className="small mono" style={{ paddingLeft: 16 }}>{HELP_LINES.map(l => <li key={l}>{l}</li>)}</ul></div>}
                {cw.stale && cw.draft && <div className="mode-banner stale" role="status" data-testid="stale-banner"><strong>r{cw.committed.entityVersion} arrived while your stack targets r{cw.draft.baseVersion}.</strong> Review before saving. <button className="btn sm primary" onClick={save.openConflict} data-testid="review-conflict">reconcile</button><button className="btn sm" onClick={save.discardDraft}>discard stack</button></div>}
                {save.status.kind === 'conflict' && <ReconcilePanel report={save.status.report} draft={save.status.draft} base={save.status.base} onSave={r => void save.resolveAndSave(r)} onRebaseOnly={save.resolveOnly} onDiscard={save.discardDraft} />}
                {save.status.kind === 'error' && <ProblemView problem={save.status.problem} actions={<button className="btn sm" onClick={save.dismiss}>dismiss</button>} />}
                {save.status.kind === 'uncertain' && <UncertainOutcome problem={save.status.problem} contactKey={contactKey!} baseVersion={save.status.baseVersion} onCheck={save.checkAfterUncertain} onOpenHistory={r => execute(`rev ${r}`)} onDiscardDraft={save.discardDraft} onKeepDraft={save.dismiss} />}
                {save.status.kind === 'saved' && !cw.draft?.items.length && <div className="row wrap" data-testid="saved-banner"><Badge tone="ok">saved together</Badge><span className="small">{save.status.result.auditDbrowVersion ? <>r{save.status.result.entityVersion} · unit <span className="mono">…{save.status.result.auditDbrowVersion.slice(-4)}</span></> : 'no effective change'}</span>{save.status.result.auditDbrowVersion && <button className="btn sm" onClick={() => execute(`rev ${save.status.kind === 'saved' ? save.status.result.entityVersion : ''}`)} data-testid="view-evidence">rev {save.status.result.entityVersion}</button>}<button className="btn quiet sm" onClick={save.dismiss}>dismiss</button></div>}
                {save.status.kind !== 'conflict' && (
                  <>
                    <ProfileKV state={cw.view} diff={null} pending={!!cw.projection?.touched.has('profile')} base={cw.base} />
                    <RecordTable state={cw.view} cw={cw} selectedKey={selectedKey} onSelect={setSelectedKey} onEdit={ref => setEditor({ family: ref.family, ordinal: ref.ordinal })} diff={null} readOnly={!cw.canEdit} highlight={highlight} />
                    <p className="tiny faint">click or ↑↓ selects a row (the sidekick's “this”) · Enter or double-click opens the form · commands: <code>set phone 2 ext 25</code>, <code>primary email 1</code>, <code>edit address 1</code>, <code>add email …</code></p>
                    {editor && <EditorPane cw={cw} family={editor.family} ordinal={editor.ordinal} onDone={() => setEditor(null)} />}
                    <CommandStack cw={cw} save={save} selectedIndex={stackSel} onSelectIndex={setStackSel} />
                  </>
                )}
              </div>
            </>
          )}
          {screen === 'history' && contactKey && (
            <>
              <div className="dhead" data-testid="record" data-mode={historical ? 'historical' : 'current'}>
                <h1>{ws.server.summary(contactKey)?.displayName}</h1>
                <Badge tone={historical ? 'hist' : 'accent'}>{historical ? `r${selRev} of ${current}` : `r${current} current`}</Badge>
                {route.params.from && <button className="btn sm" onClick={() => { location.hash = route.params.from; }} data-testid="back-to-activity">← activity</button>}
                <span className="grow" />
                <span className="tiny faint">←/→ or [ ] scrub · Shift+click sets compare base · <code>compare a b</code></span>
              </div>
              <div className="dbody">
                {!cw.canHistory && <ProblemView problem={{ status: 403, code: 'forbidden', title: 'Forbidden', detail: `${session.persona.name} cannot read revision history.`, traceId: 'local', automaticRetryAllowed: false }} />}
                {cw.canHistory && (<>
                  <Ladder units={units} selected={selRev ?? current} compare={selCmp} onSelect={n => navigate({ variant: 'console', screen: 'history', segment: slug, params: { ...route.params, rev: String(n), compare: n > 1 ? String(n - 1) : '' } })} onCompare={n => navigate({ variant: 'console', screen: 'history', segment: slug, params: { ...route.params, compare: String(n) } })} />
                  {historical && <div className="mode-banner hist" role="status" data-testid="historical-banner"><strong>historical view · read-only.</strong> the contact as it was at r{selRev}{selCmp ? `, differences from r${selCmp}` : ''}. selecting an old revision undoes nothing. <button className="btn sm" onClick={() => execute('open')} data-testid="back-to-current">open current r{current}</button></div>}
                  {read.loading && <Spinner label="Loading revision" />}
                  {read.problem && <ProblemView problem={read.problem} />}
                  {read.data && <ThreeAnswers read={read.data} highlight={highlight} onFocus={k => setSelectedKey(k)} />}
                  {read.data && <p className="tiny faint">unit …{read.data.unit.id.slice(-6)} · {fmtWeekday(read.data.unit.recordedAt)} {fmtDateTime(read.data.unit.recordedAt)} CST · labels and values come from historical payloads, not today's contact</p>}
                </>)}
              </div>
            </>
          )}
        </main>
        {transcriptOpen && <Transcript sk={sk} onNavigate={onNavigate} onClose={() => setTranscript(false)} canEdit={cw.canEdit} ctx={getContext()} />}
      </div>
      <footer className="con-status" aria-live="polite" data-testid="status-bar">
        <span className={status.tone === 'err' ? 'strong' : ''} style={status.tone === 'err' ? { color: 'var(--danger)' } : status.tone === 'ok' ? { color: 'var(--ok)' } : undefined} data-testid="status-text">{status.text}</span>
        <span className="grow" />
        <span className="hide-narrow"><span className="k">persona</span> {session.persona.key}</span>
        {contactKey && <span><span className="k">contact</span> {slug} r{ws.server.currentVersion(contactKey)}</span>}
        {cw.draft?.items.length ? <span><span className="k">stack</span> {cw.draft.items.length}</span> : null}
        {lastReq && <span className="hide-narrow" title={lastReq.note ?? ''}><span className="k">last</span> {lastReq.method} {lastReq.path.split('?')[0]} {lastReq.status || 'withheld'}{lastReq.contract === 'proposed' ? ' (proposed)' : ''}</span>}
        <span className="hide-narrow"><span className="k">clock</span> {fmtDateTime(ws.server.now())} CST</span>
      </footer>
      <Toasts />
      <DemoDrawer contactKey={contactKey} />
    </div>
  );
}
