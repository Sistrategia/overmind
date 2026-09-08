// Hash router. Investigation context (filters, selected revision, unit) lives in the
// URL so back/forward and copy-link preserve it: #/desk/history/lina?rev=4&compare=3
import { useSyncExternalStore } from 'react';

export interface Route {
  variant: string;      // '' (gallery) | 'desk' | 'console' | 'strata'
  screen: string;       // variant-specific
  segment: string;      // e.g. contact slug
  params: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  const [pathPart, query = ''] = h.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(query)) params[k] = v;
  return { variant: parts[0] ?? '', screen: parts[1] ?? '', segment: parts[2] ?? '', params };
}

export function buildHash(r: Partial<Route>): string {
  const path = ['', r.variant ?? '', r.screen ?? '', r.segment ?? ''].filter((p, i) => i === 0 || p).join('/');
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(r.params ?? {})) if (v !== '' && v !== undefined && v !== null) q.set(k, v);
  const qs = q.toString();
  return `#${path || '/'}${qs ? '?' + qs : ''}`;
}

let cached: { hash: string; route: Route } | null = null;
function current(): Route {
  const hash = typeof location === 'undefined' ? '' : location.hash;
  if (!cached || cached.hash !== hash) cached = { hash, route: parseHash(hash) };
  return cached.route;
}
function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
export function useRoute(): Route { return useSyncExternalStore(subscribe, current, current); }

export function navigate(r: Partial<Route>, opts: { replace?: boolean; merge?: boolean } = {}): void {
  const base = opts.merge ? current() : { variant: '', screen: '', segment: '', params: {} };
  const next: Route = {
    variant: r.variant ?? base.variant, screen: r.screen ?? base.screen, segment: r.segment ?? base.segment,
    params: { ...(opts.merge ? base.params : {}), ...(r.params ?? {}) }
  };
  const hash = buildHash(next);
  if (hash === location.hash) return;
  if (opts.replace) history.replaceState(null, '', hash);
  else location.hash = hash;
  if (opts.replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
export function routeHref(r: Partial<Route>): string { return buildHash({ variant: '', screen: '', segment: '', params: {}, ...r }); }
