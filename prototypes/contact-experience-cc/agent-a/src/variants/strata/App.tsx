// Strata: a time-axis workspace. The axis is the primary navigation; any point can be
// inspected read-only, two points compare as Then/Now, and the unsaved draft is a
// provisional next revision whose difference is visible before committing.
import { useCallback, useEffect, useMemo, useState } from 'react';
import './strata.css';
import { describeItem } from '../../core/draft';
import { diffStates } from '../../core/engine';
import { fmtDateTime } from '../../core/format';
import { parseChildKey, type Family } from '../../core/model';
import { buildHash, navigate, useRoute } from '../../core/router';
import { actorShort, PERSONAS } from '../../core/personas';
import type { SidekickContext, SidekickProposal, SidekickRef } from '../../core/sidekick';
import { useActivity, useContacts, useDirectory, useRevision, useSession, useWorkspace } from '../../core/workspace';
import { DemoDrawer } from '../../shared/demo';
import { UncertainOutcome } from '../../shared/evidence';
import { ReconcilePanel } from '../../shared/reconcile';
import { Avatar, Badge, Empty, Presence, ProblemView, Spinner, ThemeToggle, Toasts } from '../../shared/ui';
import { useContactWorkspace } from '../../shared/use-contact-workspace';
import { useSaveFlow } from '../../shared/use-save';
import { filtersFromRoute } from '../desk/Activity';
import { Lens } from './Lens';
import { Axis, FamilyCard, fmtWhen, NameCard, StepsStrip, Swimlanes, ThenNow, UnitPanel, type AxisTick } from './panes';

type Mode = 'at' | 'between' | 'during';
const FAM: Family[] = ['email', 'phone', 'address', 'web_link'];

export default function StrataApp() {
  const ws = useWorkspace();
  const route = useRoute();
  const session = useSession();
  const contacts = useContacts();
  const screen = route.screen === 'activity' ? 'activity' : 'contact';
  const slug = screen === 'activity' ? '' : route.segment || 'lina';
  const contactKey = useMemo(() => (slug ? ws.server.resolveKey(slug) ?? null : null), [ws, slug]);
  const cw = useContactWorkspace(screen === 'activity' ? null : contactKey);
  const save = useSaveFlow(cw);
  const units = useMemo(() => (contactKey ? ws.server.unitsFor(contactKey) : []), [ws, contactKey, session.dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = cw.committed?.entityVersion ?? units.length;
  const draftCount = cw.draft?.items.length ?? 0;
  const draftRev = draftCount ? (cw.draft!.baseVersion + 1) : null;
  const atParam = route.params.rev ? Number(route.params.rev) : null;
  const at = atParam ?? current;
  const isDraftPoint = route.params.rev === 'draft' && draftCount > 0;
  const base = route.params.compare ? Number(route.params.compare) : null;
  const mode: Mode = (route.params.mode as Mode) || (base !== null ? 'between' : 'at');
  const highlight = useMemo(() => new Set((route.params.hl ?? '').split(',').filter(Boolean)), [route.params.hl]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState<Family | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const lensOpen = session.sidekickOpen;
  const setLens = (v: boolean) => ws.session.set({ sidekickOpen: v });
  const historical = screen === 'contact' && !isDraftPoint && at !== current;
  const read = useRevision(screen === 'contact' && cw.canHistory && (historical || base !== null || mode === 'during') && !isDraftPoint ? contactKey : null, isDraftPoint ? null : at, base);
  const dir = useDirectory(contactKey, screen === 'contact' && cw.problem?.code === 'forbidden');
  const filters = useMemo(() => filtersFromRoute(route), [route]);
  const act = useActivity(filters, screen === 'activity');
  const unitId = route.params.unit || null;

  useEffect(() => { setEditingKey(null); setAdding(null); setEditingProfile(false); }, [route.segment, route.params.rev]);
  useEffect(() => { if (focus) { const t = setTimeout(() => setFocus(null), 1500); return () => clearTimeout(t); } }, [focus]);
  useEffect(() => { ws.presence(contactKey, editingKey ? editingKey.replace('#', ' ') : adding ? `new ${adding}` : editingProfile ? 'profile' : null, !!(editingKey || adding || editingProfile || draftCount)); }, [ws, contactKey, editingKey, adding, editingProfile, draftCount]);

  const go = useCallback((params: Record<string, string>, opts: { replace?: boolean } = {}) => navigate({ variant: 'strata', screen: 'history', segment: slug, params: { from: route.params.from ?? '', ...params } }, opts), [slug, route.params.from]);
  const setAt = (rev: number | 'draft') => {
    if (rev === 'draft') { go({ rev: 'draft', compare: String(current), mode: 'between' }); return; }
    if (rev === current && base === null) { navigate({ variant: 'strata', screen: 'contact', segment: slug }); return; }
    go({ rev: String(rev), compare: base !== null && base < rev ? String(base) : '', mode: base !== null && base < rev ? mode : 'at' });
  };
  const setBase = (rev: number) => { if (rev >= at) return; go({ rev: String(at), compare: String(rev), mode: 'between' }); };
  const setMode = (m: Mode) => go({ rev: isDraftPoint ? 'draft' : String(at), compare: m === 'at' ? '' : String(base ?? (at > 1 ? at - 1 : '')), mode: m });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); setLens(!ws.session.get().sidekickOpen); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (draftCount) void save.save(); }
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && screen === 'contact') { const n = e.key === 'ArrowLeft' ? at - 1 : at + 1; if (n >= 1 && n <= current) setAt(n); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ws, draftCount, save, at, current, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusChild = useCallback((key: string) => { setFocus(key); document.querySelector(`[data-target="${key}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, []);

  const getContext = useCallback((): SidekickContext => ({
    persona: ws.session.get().persona, contactKey: screen === 'activity' ? null : contactKey, selectedRevision: screen === 'contact' && historical ? at : null, compareRevision: base,
    filters: screen === 'activity' ? filters : null, draft: contactKey ? ws.draftFor(contactKey) : null, focusedChild: focus ? parseChildKey(focus) : editingKey ? parseChildKey(editingKey) : null,
    screen: screen === 'activity' ? 'activity' : historical ? 'history' : 'contact'
  }), [ws, screen, contactKey, historical, at, base, filters, focus, editingKey]);

  const onNavigate = useCallback((r: SidekickRef) => {
    const targetSlug = r.contactKey ? ws.server.slugOf(r.contactKey) : slug;
    if (r.kind === 'activity') { navigate({ variant: 'strata', screen: 'activity', segment: '', params: { ...Object.fromEntries(Object.entries(r.filters ?? {}).filter(([, v]) => v).map(([k, v]) => [k, String(v)])), unit: r.unitId ?? '' } }); return; }
    if (r.kind === 'contact') { navigate({ variant: 'strata', screen: 'contact', segment: targetSlug }); return; }
    if (r.kind === 'child' && r.highlight?.[0]) { focusChild(r.highlight[0]); return; }
    const revision = r.revision ?? ws.server.currentVersion(r.contactKey ?? contactKey ?? '');
    navigate({ variant: 'strata', screen: 'history', segment: targetSlug, params: { rev: String(revision), compare: r.compare ? String(r.compare) : revision > 1 ? String(revision - 1) : '', mode: 'between', hl: (r.highlight ?? []).join(',') } });
  }, [ws, slug, contactKey, focusChild]);

  const onStage = useCallback(async (p: SidekickProposal, mode: 'stage' | 'save') => {
    if (!cw.base || p.contactKey !== contactKey) { ws.toast('warning', 'Open the proposed contact first.'); return false; }
    if (historical) navigate({ variant: 'strata', screen: 'contact', segment: slug });
    const d = cw.stage.proposal(p);
    if (mode === 'save') return save.save(d);
    ws.toast('info', `Draft revision r${d.baseVersion + 1} now holds ${d.items.length} pending change${d.items.length === 1 ? '' : 's'}.`);
    return true;
  }, [cw, contactKey, historical, slug, save, ws]);

  const ticks: AxisTick[] = useMemo(() => {
    const t: AxisTick[] = units.map(u => ({ rev: u.entityVersion, at: u.recordedAt, actorKey: u.actorKey, summary: u.summary }));
    if (draftRev && cw.draft) t.push({ rev: cw.draft.baseVersion + 1, at: '', actorKey: session.persona.actorKey, summary: 'draft', draft: true });
    return t;
  }, [units, draftRev, cw.draft, session.persona.actorKey]);
  const axisAt = isDraftPoint && draftRev ? draftRev : at;

  // Draft-as-future-revision comparison.
  const draftDiff = useMemo(() => (cw.base && cw.projection ? diffStates(cw.base, cw.projection.state) : null), [cw.base, cw.projection]);
  const canActivity = session.persona.grants.includes('activity');

  return (
    <div className="strata" data-variant="strata" data-testid="strata-root">
      <a href="#st-main" className="skip-link">Skip to content</a>
      <header className="st-top">
        <a className="brand" href="#/" title="Back to gallery"><span className="mark" />Overmind <span className="muted" style={{ fontWeight: 400 }}>· {ws.server.tenant().name}</span></a>
        <nav aria-label="Areas">
          {(contacts.data ?? []).filter(c => c.slug === 'lina' || c.slug === 'norte-taller').map(c => <a key={c.key} className={screen === 'contact' && c.key === contactKey ? 'active' : ''} href={buildHash({ variant: 'strata', screen: 'contact', segment: c.slug })}>{c.displayName}</a>)}
          <a className={screen === 'activity' ? 'active' : ''} href={buildHash({ variant: 'strata', screen: 'activity' })} data-testid="nav-activity" title={canActivity ? '' : 'Your role cannot open tenant activity'}>Activity{!canActivity && ' · 403'}</a>
        </nav>
        <span className="grow" />
        {screen === 'contact' && <Presence contactKey={contactKey} />}
        <button className="btn quiet who" onClick={() => ws.session.set({ demoOpen: true })} data-testid="persona-chip"><Avatar actorKey={session.persona.actorKey} /><span>{session.persona.shortName}</span></button>
        <ThemeToggle compact />
        <button className={`btn ${lensOpen ? 'primary' : ''}`} onClick={() => setLens(!lensOpen)} aria-pressed={lensOpen} title="Ctrl+/" data-testid="toggle-sidekick">✦ Lens</button>
      </header>

      {screen === 'contact' ? (
        <div className="axis-wrap">
          <div className="axis-head">
            <h1>{cw.committed ? (cw.committed.profile.displayName ?? cw.committed.profile.fullName) : ws.server.summary(contactKey ?? '')?.displayName ?? '…'}</h1>
            {cw.committed && <Badge>{cw.committed.profile.contactTypeId === 2 ? 'Organization' : 'Person'}</Badge>}
            <span className="small muted">{units.length} revisions on the axis</span>
            {route.params.from && <button className="btn sm" onClick={() => { location.hash = route.params.from; }} data-testid="back-to-activity">← Activity</button>}
            <span className="grow" />
            <div className="legend"><span className="l-at">viewing</span><span className="l-base">compare base</span>{draftCount > 0 && <span className="l-draft">draft (not saved)</span>}</div>
          </div>
          {cw.canHistory || cw.problem?.code === 'forbidden' ? (
            cw.canHistory ? <Axis ticks={ticks} at={axisAt} base={base} onAt={rev => setAt(draftRev && rev === draftRev ? 'draft' : rev)} onBase={setBase} draftCount={draftCount} /> : <p className="small muted" style={{ padding: '8px 0' }}>The directory projection has no history axis.</p>
          ) : <p className="small muted" style={{ padding: '8px 0' }}>Your role cannot read revision history, so the axis is hidden.</p>}
          <div className="axis-foot">
            <div className="seg" role="group" aria-label="What to show">
              <button aria-pressed={mode === 'at'} onClick={() => setMode('at')} data-testid="mode-at">At {isDraftPoint ? 'draft' : `r${at}`}</button>
              <button aria-pressed={mode === 'between'} onClick={() => setMode('between')} data-testid="mode-between" disabled={at <= 1 && !isDraftPoint}>Between {base ?? (isDraftPoint ? current : at - 1)} → {isDraftPoint ? 'draft' : at}</button>
              <button aria-pressed={mode === 'during'} onClick={() => setMode('during')} data-testid="mode-during" disabled={isDraftPoint}>During save {isDraftPoint ? '' : `r${at}`}</button>
            </div>
            <span>Click a point to view it · Shift+click an earlier point to compare from it · ←/→ with the axis focused · Alt+←/→ anywhere</span>
          </div>
        </div>
      ) : <div className="axis-wrap"><div className="axis-head"><h1>Tenant activity</h1><Badge tone="warn" title="No production endpoint yet">proposed capability</Badge><span className="small muted">{ws.server.tenant().name} · one lane per actor, marks are audit units; dashed marks are simulated operational events</span></div></div>}

      <div className={`st-body ${lensOpen ? 'with-lens' : ''}`}>
        <main className="st-main" id="st-main" tabIndex={-1}>
          {screen === 'activity' && (
            <ActivityScreen act={act} filters={filters} route={route} unitId={unitId} contacts={contacts.data ?? []} />
          )}
          {screen === 'contact' && cw.problem?.code === 'forbidden' && (
            dir.problem ? <ProblemView problem={dir.problem} /> : !dir.data ? <Spinner /> : (
              <div className="col" data-testid="record-directory">
                <div className="st-mode dir" data-testid="directory-banner">Directory projection: public channels in saved order, no private values, no profile details, no history. Gaps in position numbers are hidden private items.</div>
                <div className="cards">{FAM.map(f => <FamilyCard key={f} family={f} state={{ publicKey: dir.data!.publicKey, entityVersion: dir.data!.entityVersion, deletedRoot: false, profile: { contactTypeId: 1, fullName: dir.data!.displayName, displayName: null, personFirstName: null, personLastName1: null, personLastName2: null, personAlias: null, jobTitle: null, summary: null, isPrivate: false, doNotContact: false, recruiting: false }, emails: dir.data!.emails as never, phones: dir.data!.phones as never, webLinks: dir.data!.webLinks as never, addresses: dir.data!.addresses as never }} cw={null} readOnly diff={null} editingKey={null} setEditingKey={() => undefined} adding={null} setAdding={() => undefined} highlight={highlight} focusKey={null} />)}</div>
              </div>
            )
          )}
          {screen === 'contact' && cw.problem && cw.problem.code !== 'forbidden' && <ProblemView problem={cw.problem} actions={<button className="btn sm" onClick={cw.reload}>Retry</button>} />}
          {screen === 'contact' && !cw.problem && !cw.view && <div className="cards" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="card skeleton" style={{ height: 140 }}>loading</div>)}</div>}
          {screen === 'contact' && cw.view && cw.committed && (
            <ContactScreen cw={cw} save={save} at={at} current={current} base={base} mode={mode} historical={historical} isDraftPoint={isDraftPoint} read={read} draftDiff={draftDiff} highlight={highlight} focus={focus}
              editingKey={editingKey} setEditingKey={k => { setEditingKey(k); setAdding(null); }} adding={adding} setAdding={setAdding} editingProfile={editingProfile} setEditingProfile={setEditingProfile}
              onBackToCurrent={() => navigate({ variant: 'strata', screen: 'contact', segment: slug })} onOpenDraftPoint={() => setAt('draft')} setBase={setBase} setMode={setMode} onFocusChild={focusChild} />
          )}
        </main>
        {lensOpen && <Lens getContext={getContext} onNavigate={onNavigate} onStage={onStage} onClose={() => { setLens(false); (document.querySelector('[data-testid="toggle-sidekick"]') as HTMLElement | null)?.focus(); }} canEdit={cw.canEdit} at={screen === 'contact' ? at : null} base={base} draftCount={draftCount} />}
      </div>

      {screen === 'contact' && cw.draft && draftCount > 0 && !isDraftPoint && save.status.kind !== 'conflict' && (
        <div className="draft-bar" role="region" aria-label="Draft revision" data-testid="pending-tray">
          <span className="t"><span className="dot" /><strong>Draft r{cw.draft.baseVersion + 1}</strong><span className="muted">{draftCount} pending change{draftCount === 1 ? '' : 's'} on r{cw.draft.baseVersion} · saved together as one revision</span></span>
          <ol data-testid="pending-list">{cw.draft.items.map((it, i) => { const p = cw.projection?.problems.find(x => x.itemId === it.id); return <li key={it.id}><span>{describeItem(it, cw.base!)}</span>{it.origin === 'sidekick' && <Badge tone="accent">sidekick</Badge>}{p && <span className="err" title={p.message}>⚠ {p.message}</span>}<button onClick={() => cw.stage.removeItem(it.id)} aria-label={`Remove pending change ${i + 1}`}>✕</button></li>; })}</ol>
          <span className="grow" />
          <button className="btn sm" onClick={() => setAt('draft')} data-testid="preview-draft">Preview r{cw.draft.baseVersion + 1}</button>
          <button className="btn primary" disabled={save.status.kind === 'saving' || (cw.projection?.problems.length ?? 0) > 0 || cw.stale} onClick={() => void save.save()} data-testid="save" title="Ctrl+S">{save.status.kind === 'saving' ? <><Spinner /> Committing…</> : `Commit as r${cw.draft.baseVersion + 1}`}</button>
          <button className="btn" onClick={() => cw.stage.clear()} data-testid="discard-all">Discard</button>
        </div>
      )}
      <Toasts />
      <DemoDrawer contactKey={contactKey} />
    </div>
  );
}

function ContactScreen(props: {
  cw: ReturnType<typeof useContactWorkspace>; save: ReturnType<typeof useSaveFlow>; at: number; current: number; base: number | null; mode: Mode; historical: boolean; isDraftPoint: boolean;
  read: ReturnType<typeof useRevision>; draftDiff: ReturnType<typeof diffStates> | null; highlight: Set<string>; focus: string | null;
  editingKey: string | null; setEditingKey: (k: string | null) => void; adding: Family | null; setAdding: (f: Family | null) => void; editingProfile: boolean; setEditingProfile: (v: boolean) => void;
  onBackToCurrent: () => void; onOpenDraftPoint: () => void; setBase: (n: number) => void; setMode: (m: Mode) => void; onFocusChild: (k: string) => void;
}) {
  const { cw, save, at, current, base, mode, historical, isDraftPoint, read, draftDiff, highlight, focus, editingKey, setEditingKey, adding, setAdding, editingProfile, setEditingProfile, onBackToCurrent, setBase, setMode } = props;
  const ws = useWorkspace();
  const committed = cw.committed!;
  const readOnly = historical || isDraftPoint || !cw.canEdit;
  const unitAt = ws.server.unitsFor(cw.contactKey!).find(u => u.entityVersion === at);
  // Which state do the cards show?
  const cardsState = isDraftPoint ? cw.view! : historical ? read.data?.state ?? null : cw.view!;
  const cardsDiff = isDraftPoint ? draftDiff : historical && mode !== 'at' ? read.data?.diff ?? null : null;

  return (
    <>
      {historical && <div className="st-mode then" role="status" data-testid="historical-banner"><strong>Then · read-only.</strong> The contact as it was at r{at}{unitAt ? `, saved by ${actorShort(unitAt.actorKey)} on ${fmtWhen(unitAt.recordedAt)}` : ''}. Selecting a past point undoes nothing. <button className="btn sm" onClick={onBackToCurrent} data-testid="back-to-current">Back to now (r{current})</button></div>}
      {isDraftPoint && <div className="st-mode draft" role="status" data-testid="draft-banner"><strong>Draft r{cw.draft!.baseVersion + 1} · not saved.</strong> This is what the next revision would contain if you commit now. <button className="btn sm" onClick={onBackToCurrent}>Back to editing</button><button className="btn sm primary" disabled={cw.stale || (cw.projection?.problems.length ?? 0) > 0} onClick={() => void save.save()} data-testid="save">Commit as r{cw.draft!.baseVersion + 1}</button></div>}
      {!historical && cw.stale && cw.draft && <div className="st-mode stale" role="status" data-testid="stale-banner"><strong>r{committed.entityVersion} arrived under your draft.</strong> Your {cw.draft.items.length} pending change{cw.draft.items.length === 1 ? '' : 's'} still sit on r{cw.draft.baseVersion}. Reconcile before committing. <button className="btn sm primary" onClick={save.openConflict} data-testid="review-conflict">Review and reconcile</button><button className="btn sm" onClick={save.discardDraft}>Discard my draft</button></div>}
      {save.status.kind === 'conflict' && <ReconcilePanel report={save.status.report} draft={save.status.draft} base={save.status.base} onSave={r => void save.resolveAndSave(r)} onRebaseOnly={save.resolveOnly} onDiscard={save.discardDraft} />}
      {save.status.kind === 'error' && <ProblemView problem={save.status.problem} actions={<button className="btn sm" onClick={save.dismiss}>Dismiss</button>} />}
      {save.status.kind === 'uncertain' && <UncertainOutcome problem={save.status.problem} contactKey={cw.contactKey!} baseVersion={save.status.baseVersion} onCheck={save.checkAfterUncertain} onOpenHistory={r => navigate({ variant: 'strata', screen: 'history', segment: ws.server.slugOf(cw.contactKey!), params: { rev: String(r), compare: String(r - 1), mode: 'between' } })} onDiscardDraft={save.discardDraft} onKeepDraft={save.dismiss} />}
      {save.status.kind === 'saved' && !cw.draft?.items.length && <div className="row wrap" data-testid="saved-banner"><Badge tone="ok">Saved together</Badge><span className="small">{save.status.result.auditDbrowVersion ? <>The draft became <strong>r{save.status.result.entityVersion}</strong> on the axis · unit …{save.status.result.auditDbrowVersion.slice(-4)}</> : 'No effective change; nothing new on the axis.'}</span>{save.status.result.auditDbrowVersion && <button className="btn sm" onClick={() => navigate({ variant: 'strata', screen: 'history', segment: ws.server.slugOf(cw.contactKey!), params: { rev: String(save.status.kind === 'saved' ? save.status.result.entityVersion : current), compare: String((save.status.kind === 'saved' ? save.status.result.entityVersion : current) - 1), mode: 'between' } })} data-testid="view-evidence">Show what changed</button>}<button className="btn quiet sm" onClick={save.dismiss}>Dismiss</button></div>}

      {save.status.kind !== 'conflict' && (
        <>
          {historical && read.loading && <Spinner label="Loading revision" />}
          {historical && read.problem && <ProblemView problem={read.problem} actions={<button className="btn sm" onClick={onBackToCurrent}>Back to now</button>} />}
          {mode === 'between' && !isDraftPoint && read.data?.diff && read.data.compareState && (
            <ThenNow then={read.data.compareState} now={read.data.state} diff={read.data.diff} thenLabel={<>r{base ?? at - 1} <select className="select" style={{ width: 'auto', height: 24, fontSize: 12 }} value={base ?? at - 1} onChange={e => setBase(Number(e.target.value))} aria-label="Compare base" data-testid="compare-select">{Array.from({ length: at - 1 }, (_, i) => i + 1).map(n => <option key={n} value={n}>r{n}</option>)}</select></>} nowLabel={`r${at}${at === current ? ' (now)' : ''}`} highlight={highlight} actions={read.data.actions} />
          )}
          {mode === 'between' && isDraftPoint && draftDiff && cw.base && cw.projection && (
            <ThenNow then={cw.base} now={cw.projection.state} diff={draftDiff} thenLabel={`r${cw.base.entityVersion} (now)`} nowLabel={`r${cw.draft!.baseVersion + 1} draft`} highlight={highlight} actions={null} />
          )}
          {mode === 'during' && read.data && (
            <section className="card wide"><header><h2>During save r{at}</h2><span className="small muted">{actorShort(read.data.unit.actorKey)} · {fmtDateTime(read.data.unit.recordedAt)} CST · unit …{read.data.unit.id.slice(-6)}</span></header><div className="body"><StepsStrip actions={read.data.actions} highlight={[...highlight][0] ?? null} /><p className="tiny faint">Ordered effective actions recorded by this Save, kept even when their net effect cancels out.</p></div></section>
          )}
          {(mode === 'at' || (!isDraftPoint && historical)) && cardsState && (
            <div className="cards">
              <NameCard state={cardsState} cw={readOnly ? null : cw} readOnly={readOnly} diff={mode === 'at' ? null : cardsDiff} editing={editingProfile} setEditing={setEditingProfile} />
              {FAM.map(f => <FamilyCard key={f} family={f} state={cardsState} cw={readOnly ? null : cw} readOnly={readOnly} diff={mode === 'at' ? null : cardsDiff} editingKey={editingKey} setEditingKey={setEditingKey} adding={adding} setAdding={setAdding} highlight={highlight} focusKey={focus} />)}
            </div>
          )}
          {mode === 'at' && !historical && !isDraftPoint && cw.projection && cw.draft && draftDiff && !draftDiff.empty && (
            <p className="small muted">Pending changes are marked on the cards. <button className="btn quiet sm" onClick={props.onOpenDraftPoint}>Preview the draft as r{cw.draft.baseVersion + 1}</button> to see the full Then/Now before committing.</p>
          )}
          {mode !== 'at' && !isDraftPoint && !historical && at === current && read.data && (
            <p className="tiny faint">You are comparing the current revision with r{base ?? at - 1}. Switch to “At r{at}” to edit.</p>
          )}
          {mode !== 'at' && <div className="row wrap small muted"><span>Switch view:</span><button className="btn quiet sm" onClick={() => setMode('at')}>At</button><button className="btn quiet sm" onClick={() => setMode('between')}>Between</button>{!isDraftPoint && <button className="btn quiet sm" onClick={() => setMode('during')}>During</button>}</div>}
        </>
      )}
    </>
  );
}

function ActivityScreen({ act, filters, route, unitId, contacts }: { act: ReturnType<typeof useActivity>; filters: ReturnType<typeof filtersFromRoute>; route: ReturnType<typeof useRoute>; unitId: string | null; contacts: { key: string; slug: string; displayName: string }[] }) {
  const ws = useWorkspace();
  const { persona } = useSession();
  const set = (patch: Record<string, string>) => navigate({ variant: 'strata', screen: 'activity', segment: '', params: { ...route.params, ...patch } }, { replace: true });
  if (act.problem?.code === 'forbidden') return <div className="denied" data-testid="activity-denied" style={{ margin: 0 }}><ProblemView problem={act.problem} /><p className="small muted">Editors work from a contact's own axis. Switch persona to the administrator or the auditor in the demo controls.</p></div>;
  const selected = unitId ? ws.server.getUnit(unitId, persona) : null;
  const returnHash = buildHash({ variant: 'strata', screen: 'activity', segment: '', params: route.params });
  const active = Object.entries(filters).filter(([, v]) => v);
  return (
    <div className="col" style={{ gap: 14 }} data-testid="activity">
      <div className="act-filters" role="search">
        <div className="field"><label htmlFor="sf-q">Search</label><input id="sf-q" className="input" value={filters.q ?? ''} onChange={e => set({ q: e.target.value })} data-testid="filter-q" placeholder="summary, actor, value…" /></div>
        <div className="field"><label htmlFor="sf-actor">Actor</label><select id="sf-actor" className="select" value={filters.actor ?? ''} onChange={e => set({ actor: e.target.value })} data-testid="filter-actor"><option value="">Anyone</option>{PERSONAS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}<option value="system">System</option></select></div>
        <div className="field"><label htmlFor="sf-contact">Contact</label><select id="sf-contact" className="select" value={filters.contact ?? ''} onChange={e => set({ contact: e.target.value })} data-testid="filter-contact"><option value="">Any</option>{contacts.map(c => <option key={c.key} value={c.slug}>{c.displayName}</option>)}</select></div>
        <div className="field"><label htmlFor="sf-family">Family</label><select id="sf-family" className="select" value={filters.family ?? ''} onChange={e => set({ family: e.target.value })} data-testid="filter-family"><option value="">Any</option><option value="profile">Profile</option><option value="email">Email</option><option value="phone">Phone</option><option value="address">Address</option><option value="web_link">Web link</option><option value="provisioning">Provisioning</option></select></div>
        <div className="field"><label htmlFor="sf-from">From</label><input id="sf-from" type="date" className="input" value={filters.from ?? ''} onChange={e => set({ from: e.target.value })} data-testid="filter-from" /></div>
        <div className="field"><label htmlFor="sf-to">To</label><input id="sf-to" type="date" className="input" value={filters.to ?? ''} onChange={e => set({ to: e.target.value })} data-testid="filter-to" /></div>
        <div className="field"><label htmlFor="sf-source">Source</label><select id="sf-source" className="select" value={filters.source ?? 'all'} onChange={e => set({ source: e.target.value })} data-testid="filter-source"><option value="all">Audit + operational</option><option value="audit">Business audit</option><option value="operational">Operational only</option></select></div>
        {active.length > 0 && <button className="btn sm" onClick={() => navigate({ variant: 'strata', screen: 'activity' })}>Clear filters</button>}
      </div>
      {act.loading && !act.data && <Spinner label="Loading activity" />}
      {act.problem && <ProblemView problem={act.problem} />}
      {act.data && act.data.length === 0 && <Empty>No activity matches these filters. Widen the date range or clear a filter.</Empty>}
      {act.data && act.data.length > 0 && <Swimlanes items={act.data} selected={unitId} onSelect={id => set({ unit: id })} />}
      {selected && !('code' in selected) && <UnitPanel unit={selected.unit} contactName={selected.contact?.displayName ?? null} onClose={() => set({ unit: '' })} onOpen={(rev, hl) => navigate({ variant: 'strata', screen: 'history', segment: selected.contact?.slug ?? selected.unit.contactKey, params: { rev: String(rev), compare: rev > 1 ? String(rev - 1) : '', mode: 'between', from: returnHash, hl: hl ?? '' } })} />}
      {selected && 'code' in selected && <ProblemView problem={selected} />}
      {act.data && act.data.length > 0 && (
        <div className="act-list" data-testid="activity-table">
          {act.data.map(item => item.kind === 'unit' ? (
            <button key={item.unit.id} className="act-row" aria-selected={unitId === item.unit.id} onClick={() => set({ unit: item.unit.id })} data-testid="activity-row">
              <span className="when">{fmtWhen(item.at)}</span>
              <span className="row"><Avatar actorKey={item.unit.actorKey} />{actorShort(item.unit.actorKey)}</span>
              <span className="truncate">{item.contact?.displayName ?? '—'} <span className="faint">r{item.unit.entityVersion}</span> · {item.unit.summary}</span>
              <span className="hide-narrow"><Badge tone={item.unit.source === 'provisioning' ? 'accent' : ''}>{item.unit.source === 'provisioning' ? 'Provisioning' : 'Contact change'}</Badge></span>
            </button>
          ) : (
            <div key={item.event.id} className="act-row op" data-testid="activity-op-row">
              <span className="when">{fmtWhen(item.at)}</span>
              <span className="row"><Avatar actorKey={item.event.actorKey} />{actorShort(item.event.actorKey)}</span>
              <span className="truncate">{item.event.summary}</span>
              <span className="hide-narrow"><Badge tone={item.event.outcome === 'rejected' ? 'danger' : item.event.outcome === 'uncertain' ? 'warn' : ''}>{item.event.category === 'sidekick' ? 'Sidekick (local)' : 'Operational (simulated)'}</Badge></span>
            </div>
          ))}
        </div>
      )}
      <p className="tiny faint">Operational and sidekick rows are not part of the business audit. Lane position orders one contact's units by recording time; it is not proof of cross-contact commit order or a universal database snapshot.</p>
    </div>
  );
}
