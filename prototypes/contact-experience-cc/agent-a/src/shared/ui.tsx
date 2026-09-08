import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Problem } from '../core/model';
import { personaByActor, SYSTEM_ACTOR } from '../core/personas';
import { useWorkspace, useSession } from '../core/workspace';
import { useTheme } from '../core/theme';

export function Kbd({ children }: { children: ReactNode }) { return <kbd className="kbd">{children}</kbd>; }

export function Badge({ children, tone = '', className = '', title }: { children: ReactNode; tone?: '' | 'accent' | 'ok' | 'warn' | 'danger' | 'pending' | 'hist'; className?: string; title?: string }) {
  return <span className={`badge ${tone} ${className}`} title={title}>{children}</span>;
}

export function Avatar({ actorKey, size = '' , title }: { actorKey: string; size?: '' | 'lg'; title?: string }) {
  const p = personaByActor(actorKey);
  const hue = p?.hue ?? SYSTEM_ACTOR.hue;
  const initials = p?.initials ?? (actorKey === SYSTEM_ACTOR.actorKey ? 'SY' : '??');
  return <span className={`avatar ${size}`} style={{ background: `hsl(${hue} 45% 42%)` }} title={title ?? p?.name ?? 'System'} aria-hidden="true">{initials}</span>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /> <span className="sr-only">{label}</span></span>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }

export function ProblemView({ problem, tone, actions }: { problem: Problem; tone?: 'warn' | 'info'; actions?: ReactNode }) {
  const t = tone ?? (problem.code === 'history_unavailable' || problem.code === 'conflict' ? 'warn' : problem.code === 'forbidden' || problem.code === 'not_found' ? 'info' : undefined);
  return (
    <div className={`problem ${t ?? ''}`} role="alert">
      <div className="row"><strong>{problem.title}</strong><span className="code">HTTP {problem.status} · {problem.code}</span></div>
      <div className="small">{problem.detail}</div>
      {actions && <div className="row wrap" style={{ marginTop: 6 }}>{actions}</div>}
      <details className="tech"><summary>Technical details</summary>
        <dl><dt>traceId</dt><dd>{problem.traceId}</dd><dt>automaticRetryAllowed</dt><dd>false</dd>{problem.commandIndex !== undefined && problem.commandIndex >= 0 && <><dt>commandIndex</dt><dd>{problem.commandIndex}</dd></>}{problem.currentEntityVersion !== undefined && <><dt>currentEntityVersion</dt><dd>{problem.currentEntityVersion}</dd></>}</dl>
      </details>
    </div>
  );
}

export function TechDetails({ rows, summary = 'Technical details' }: { rows: [string, ReactNode][]; summary?: string }) {
  return (
    <details className="tech"><summary>{summary}</summary>
      <dl>{rows.map(([k, v]) => <FragmentRow key={k} k={k} v={v} />)}</dl>
    </details>
  );
}
function FragmentRow({ k, v }: { k: string; v: ReactNode }) { return <><dt>{k}</dt><dd>{v}</dd></>; }

export function Dialog({ title, onClose, children, footer, narrow, labelledBy }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; narrow?: boolean; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(el => !el.hasAttribute('disabled'));
    (focusables()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? id} ref={ref} tabIndex={-1}>
        <div className="dialog-head"><h2 id={id} style={{ fontSize: 16 }} className="grow">{title}</h2><button className="btn quiet icon" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toasts() {
  const ws = useWorkspace();
  const { toasts } = useSession();
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="grow">{t.text}</span>
          <button className="btn quiet icon sm" onClick={() => ws.dismissToast(t.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button className={`btn ${compact ? 'icon' : ''} quiet`} onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} data-testid="theme-toggle">
      <span aria-hidden="true">{theme === 'light' ? '◐' : '◑'}</span>{!compact && <span>{theme === 'light' ? 'Dark' : 'Light'}</span>}
    </button>
  );
}

export function DiffValue({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const o = fmt(oldValue), n = fmt(newValue);
  return (
    <span className="diffval">
      {o !== null && <span className="diff-old" aria-label={`was ${o}`}>{o}</span>}
      {o !== null && n !== null && <span className="diff-arrow" aria-hidden="true">→</span>}
      {n !== null && <span className="diff-new" aria-label={`now ${n}`}>{n}</span>}
      {o === null && n === null && <span className="faint">—</span>}
    </span>
  );
}
function fmt(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export function DiffMark({ kind }: { kind: 'added' | 'removed' | 'changed' | 'moved' }) {
  const sym = kind === 'added' ? '+' : kind === 'removed' ? '−' : kind === 'moved' ? '↕' : '±';
  const label = kind === 'added' ? 'Added' : kind === 'removed' ? 'Removed' : kind === 'moved' ? 'Moved' : 'Changed';
  return <span className={`diff-mark ${kind}`} role="img" aria-label={label} title={label}>{sym}</span>;
}

export function Presence({ contactKey }: { contactKey: string | null }) {
  const { peers, tabId } = useSession();
  const here = peers.filter(p => !contactKey || p.contactKey === contactKey);
  if (!here.length) return <span className="presence-note faint" data-testid="presence-empty">Only you here · tab {tabId.slice(0, 4)}</span>;
  return (
    <span className="row" data-testid="presence">
      <span className="presence">{here.map(p => <Avatar key={p.tabId} actorKey={personaByKeySafe(p.personaKey)} />)}</span>
      <span className="presence-note">
        {here.map(p => `${nameOf(p.personaKey)}${p.editing ? ` is editing${p.area ? ' · ' + p.area : ''}` : ' is viewing'}`).join(' · ')}
      </span>
    </span>
  );
}
import { personaByKey } from '../core/personas';
function personaByKeySafe(key: string): string { return personaByKey(key).actorKey; }
function nameOf(key: string): string { return personaByKey(key).shortName; }
