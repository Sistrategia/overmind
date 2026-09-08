// Headless view hooks shared by the variants (no styling, no layout decisions).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ContactId, ContactState, Problem, Revision } from './types';
import { ProblemError } from './types';
import { useWorkspace } from './store';
import type { RevisionRead } from './server';

export interface ContactView {
  contactId: ContactId;
  revision: Revision | null;
  state: ContactState | null; // draft working state when a draft exists, else committed
  committed: ContactState | null;
  projection: 'detail' | 'directory' | null;
  problem: Problem | null;
  editing: boolean; // a draft exists for this contact
  loading: boolean;
}

export function useContactView(contactId: ContactId | null): ContactView | null {
  const ws = useWorkspace();
  return useMemo(() => {
    if (!contactId) return null;
    void ws.tick;
    try {
      const read = ws.server.readCurrent(ws.persona, contactId);
      const draft = ws.draft && ws.draft.contactId === contactId ? ws.draft : null;
      return {
        contactId,
        revision: read.revision,
        state: draft ? draft.working : read.state,
        committed: read.state,
        projection: read.projection,
        problem: null,
        editing: !!draft,
        loading: ws.demo.loading,
      };
    } catch (e) {
      const problem = e instanceof ProblemError ? e.problem : null;
      return { contactId, revision: null, state: null, committed: null, projection: null, problem, editing: false, loading: ws.demo.loading };
    }
  }, [ws.tick, ws.server, ws.persona, ws.draft, contactId, ws.demo.loading]);
}

export interface RevisionView {
  data: RevisionRead | null;
  problem: Problem | null;
}

export function useRevisionView(contactId: ContactId | null, version: number | null, compare: number | null): RevisionView {
  const ws = useWorkspace();
  return useMemo(() => {
    if (!contactId || version === null) return { data: null, problem: null };
    void ws.tick;
    try {
      return { data: ws.server.readRevision(ws.persona, contactId, version, compare, ws.demo.historyCoverageFrom), problem: null };
    } catch (e) {
      return { data: null, problem: e instanceof ProblemError ? e.problem : null };
    }
  }, [ws.tick, ws.server, ws.persona, contactId, version, compare, ws.demo.historyCoverageFrom]);
}

/** Others (not this tab) currently on the given contact. */
export function usePresenceOn(contactId: ContactId | null) {
  const ws = useWorkspace();
  return useMemo(() => ws.presence.filter((p) => p.contactId === contactId && p.tabId !== ws.tabId), [ws.presence, ws.tabId, contactId]);
}

/** Report this tab's presence while mounted. */
export function useReportPresence(contactId: ContactId | null, section: string | null, editing: boolean) {
  const ws = useWorkspace();
  useEffect(() => {
    ws.setPresence(contactId, section, editing);
  }, [ws, contactId, section, editing]);
}

/** A transient highlight that clears itself; used when a sidekick reference opens a field. */
export function useFlash(key: string | null, ms = 2400): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    setActive(key);
    const t = window.setTimeout(() => setActive(null), ms);
    return () => window.clearTimeout(t);
  }, [key, ms]);
  return active;
}

export function useScrollIntoView(id: string | null) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!id || last.current === id) return;
    last.current = id;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [id]);
}

/** Return focus to the element that opened an overlay. */
export function useFocusReturn(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
    else if (opener.current && document.contains(opener.current)) {
      opener.current.focus();
      opener.current = null;
    }
  }, [open]);
}

export function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}
