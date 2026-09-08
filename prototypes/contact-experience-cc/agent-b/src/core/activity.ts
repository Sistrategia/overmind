// Proposed capability: tenant activity explorer. The backend has no listing/search endpoint yet;
// this filters the simulated audit units locally.
import type { ActivityFilters, AuditUnit, ContactId } from './types';
import { fmt } from './format';
import { personaById } from './fixtures';

export function queryActivity(units: AuditUnit[], filters: ActivityFilters, contactName: (id: ContactId) => string): AuditUnit[] {
  const q = filters.q.trim().toLowerCase();
  return units.filter((u) => {
    if (filters.actor !== 'all' && u.actorId !== filters.actor) return false;
    if (filters.contact !== 'all' && !u.contacts.some((c) => c.contactId === filters.contact)) return false;
    if (filters.family !== 'all' && !u.families.includes(filters.family)) return false;
    if (filters.source !== 'all' && u.source !== filters.source) return false;
    const day = fmt.ymd(u.at);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (q) {
      const hay = [
        u.summary,
        personaById(u.actorId).fullName,
        ...u.contacts.map((c) => contactName(c.contactId)),
        u.stamp,
        u.correlationId,
        u.kind,
        u.source,
        ...u.actions.map((a) => `${a.summary} ${a.before ?? ''} ${a.after ?? ''}`),
        ...Object.values(u.detail),
      ]
        .join(' \n ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function activeFilterCount(f: ActivityFilters): number {
  return (
    (f.actor !== 'all' ? 1 : 0) +
    (f.contact !== 'all' ? 1 : 0) +
    (f.family !== 'all' ? 1 : 0) +
    (f.source !== 'all' ? 1 : 0) +
    (f.from ? 1 : 0) +
    (f.to ? 1 : 0) +
    (f.q.trim() ? 1 : 0)
  );
}

export const SOURCE_LABEL: Record<AuditUnit['source'], string> = {
  business: 'Committed change',
  batch: 'Administrative batch',
  operational: 'Operational (not audit)',
  agent: 'Sidekick (not audit)',
  presence: 'Presence (not audit)',
};

export function filtersToQuery(f: ActivityFilters): Record<string, string | null> {
  return {
    actor: f.actor === 'all' ? null : f.actor,
    contact: f.contact === 'all' ? null : f.contact,
    family: f.family === 'all' ? null : f.family,
    source: f.source === 'all' ? null : f.source,
    from: f.from,
    to: f.to,
    q: f.q.trim() ? f.q : null,
  };
}

export function filtersFromQuery(q: URLSearchParams): ActivityFilters {
  return {
    actor: (q.get('actor') as ActivityFilters['actor']) || 'all',
    contact: q.get('contact') || 'all',
    family: (q.get('family') as ActivityFilters['family']) || 'all',
    source: (q.get('source') as ActivityFilters['source']) || 'all',
    from: q.get('from'),
    to: q.get('to'),
    q: q.get('q') ?? '',
  };
}
