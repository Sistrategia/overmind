import { useCallback, useEffect, useState } from 'react';

export interface Route {
  variant: string | null;
  path: string[];
  query: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [p, qs] = raw.split('?');
  const segments = (p ?? '').split('/').filter(Boolean).map(decodeURIComponent);
  return { variant: segments[0] ?? null, path: segments.slice(1), query: new URLSearchParams(qs ?? '') };
}

export function buildHash(variant: string, path: string, query?: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) if (v !== null && v !== undefined && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return `#/${variant}${path ? `/${path}` : ''}${qs ? `?${qs}` : ''}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((variant: string, path: string, query?: Record<string, string | null | undefined>, replace = false) => {
    const next = buildHash(variant, path, query);
    if (replace) window.history.replaceState(null, '', next);
    else window.location.hash = next;
    if (replace) setRoute(parse(next));
  }, []);
  return { route, navigate };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
