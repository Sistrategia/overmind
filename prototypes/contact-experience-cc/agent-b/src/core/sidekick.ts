// Deterministic local sidekick. No external model, no API key. It answers only from the current
// fixture state, the selected revision, the active filters, the persona's grants and the unsaved draft.
// Unsupported questions get an honest bounded reply.
import type {
  ActivityFilters,
  AuditUnit,
  Command,
  ContactId,
  ContactState,
  Family,
  PendingChange,
  Persona,
  PersonaId,
  PhoneValue,
  Revision,
} from './types';
import { diffStates, changedPaths } from './diff';
import { childDisplay, fmt, liveChildren, FAMILY_LABEL, addressOneLine } from './format';
import { PERSONAS, personaById } from './fixtures';
import { hasGrant } from './permissions';
import { phoneToInput } from './phone';

export interface SidekickContext {
  persona: Persona;
  contactId: ContactId | null;
  contactName: string | null;
  revisions: Revision[]; // of the current contact (all, unfiltered)
  selectedRevision: number | null;
  compareRevision: number | null;
  filters: ActivityFilters | null;
  draft: { pending: PendingChange[]; baseVersion: number; working: ContactState } | null;
  units: AuditUnit[]; // activity visible to the persona (empty when not permitted)
  canActivity: boolean;
  today: string; // YYYY-MM-DD in tenant zone
  contacts: { id: ContactId; name: string }[];
  selectedPhoneOrdinal: number | null;
}

export type SidekickRef =
  | { kind: 'revision'; contactId: ContactId; version: number; compare: number | null; fields: string[]; label: string }
  | { kind: 'unit'; stamp: string; label: string };

export type SidekickAction =
  | { kind: 'filters'; filters: Partial<ActivityFilters>; label: string }
  | { kind: 'navigate'; contactId: ContactId; version: number; compare: number | null; label: string }
  | { kind: 'proposal'; contactId: ContactId; baseVersion: number; commands: Command[]; lines: string[]; label: string };

export interface SidekickReply {
  id: string;
  query: string;
  text: string;
  used: string[];
  refs: SidekickRef[];
  actions: SidekickAction[];
  bounded: boolean;
}

export const SUGGESTIONS = [
  'What changed in Lina’s contact this week?',
  'Show Bruno’s phone changes',
  'Change this extension to 25 and make the work email primary',
  'Who changed the home address?',
  'Compare revision 3 and 4',
  'Why is the revision 5 diff empty?',
];

let replyCounter = 0;

function usedFrom(ctx: SidekickContext): string[] {
  const used = [`Persona: ${ctx.persona.name} (${ctx.persona.role})`];
  const current = ctx.revisions[ctx.revisions.length - 1];
  if (ctx.contactName && current) used.push(`Contact: ${ctx.contactName} · revision ${current.entityVersion}`);
  if (ctx.selectedRevision) used.push(`Selected: revision ${ctx.selectedRevision}${ctx.compareRevision ? ` vs ${ctx.compareRevision}` : ''}`);
  if (ctx.filters) {
    const f = ctx.filters;
    const parts = [
      f.actor !== 'all' ? `actor ${personaById(f.actor).name}` : null,
      f.family !== 'all' ? `family ${f.family}` : null,
      f.contact !== 'all' ? `contact ${ctx.contacts.find((c) => c.id === f.contact)?.name ?? f.contact}` : null,
      f.source !== 'all' ? `source ${f.source}` : null,
      f.q ? `search “${f.q}”` : null,
    ].filter(Boolean);
    if (parts.length) used.push(`Filters: ${parts.join(', ')}`);
  }
  if (ctx.draft && ctx.draft.pending.length) used.push(`Draft: ${ctx.draft.pending.length} unsaved change${ctx.draft.pending.length === 1 ? '' : 's'} (not history)`);
  return used;
}

function reply(ctx: SidekickContext, query: string, text: string, extra: Partial<SidekickReply> = {}): SidekickReply {
  replyCounter++;
  return { id: `sk-${Date.now().toString(36)}-${replyCounter}`, query, text, used: usedFrom(ctx), refs: [], actions: [], bounded: false, ...extra };
}

function fieldLabels(prev: Revision | null, rev: Revision): string[] {
  if (!prev) return ['created'];
  const d = diffStates(prev.state, rev.state);
  const labels: string[] = [];
  for (const p of d.profile) labels.push(p.label);
  for (const r of d.root) labels.push(r.label);
  for (const c of d.children) {
    if (c.status === 'unchanged') continue;
    if (c.status === 'changed') labels.push(...c.changes.map((x) => `${c.label} ${x.label.toLowerCase()}`));
    else labels.push(`${c.label} ${c.status}`);
  }
  return labels;
}

function revisionRef(rev: Revision, prev: Revision | null): SidekickRef {
  const fields = prev ? changedPaths(diffStates(prev.state, rev.state)) : [];
  return { kind: 'revision', contactId: rev.contactId, version: rev.entityVersion, compare: prev ? prev.entityVersion : null, fields, label: `Revision ${rev.entityVersion}` };
}

function actorFromText(q: string): PersonaId | null {
  const lower = q.toLowerCase();
  for (const p of PERSONAS) {
    if (lower.includes(p.name.toLowerCase()) || lower.includes(p.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''))) return p.id;
  }
  if (/\bmy\b|\bi\b|\bme\b/.test(lower)) return null;
  return null;
}

function familyFromText(q: string): Family | 'profile' | null {
  const l = q.toLowerCase();
  if (/\b(phone|phones|extension|number)\b/.test(l)) return 'phone';
  if (/\b(email|emails|e-mail)\b/.test(l)) return 'email';
  if (/\b(address|addresses)\b/.test(l)) return 'address';
  if (/\b(link|links|web|url|website|portfolio)\b/.test(l)) return 'web_link';
  if (/\b(name|profile|display name|summary)\b/.test(l)) return 'profile';
  return null;
}

function dayRange(ctx: SidekickContext, q: string): { from: string; to: string; label: string } | null {
  const l = q.toLowerCase();
  const today = new Date(`${ctx.today}T12:00:00-06:00`);
  const ymd = (d: Date) => fmt.ymd(d.toISOString());
  if (/\btoday\b/.test(l)) return { from: ctx.today, to: ctx.today, label: 'today' };
  if (/\byesterday\b/.test(l)) {
    const y = new Date(today.getTime() - 86400000);
    return { from: ymd(y), to: ymd(y), label: 'yesterday' };
  }
  if (/\bthis week\b|\bthe week\b|\bweek\b/.test(l)) {
    const from = new Date(today.getTime() - 6 * 86400000);
    return { from: ymd(from), to: ctx.today, label: `the last 7 days (${fmt.date(from.toISOString())} – ${fmt.date(today.toISOString())})` };
  }
  if (/\bthis month\b|\bmonth\b/.test(l)) {
    return { from: `${ctx.today.slice(0, 7)}-01`, to: ctx.today, label: 'this month' };
  }
  return null;
}

function requireContact(ctx: SidekickContext, query: string): SidekickReply | null {
  if (!ctx.contactId || !ctx.revisions.length) {
    return reply(ctx, query, 'Open a contact first; I answer about the contact that is on screen.', { bounded: true });
  }
  return null;
}

function requireHistory(ctx: SidekickContext, query: string): SidekickReply | null {
  if (!ctx.contactId) return null;
  if (!hasGrant(ctx.persona, 'read_history', ctx.contactId) || !hasGrant(ctx.persona, 'read_detail', ctx.contactId)) {
    return reply(ctx, query, `${ctx.persona.name} does not hold read_history for ${ctx.contactName}. I can only describe what your grants let you read.`, { bounded: true });
  }
  return null;
}

// ---- Intents ----

function whatChanged(ctx: SidekickContext, query: string): SidekickReply {
  const gate = requireContact(ctx, query) ?? requireHistory(ctx, query);
  if (gate) return gate;
  const range = dayRange(ctx, query);
  const revs = ctx.revisions.filter((r) => !range || (fmt.ymd(r.at) >= range.from && fmt.ymd(r.at) <= range.to));
  const refs: SidekickRef[] = [];
  const lines: string[] = [];
  if (!revs.length) {
    return reply(ctx, query, `No committed revision of ${ctx.contactName} falls in ${range?.label ?? 'that range'}. History shows committed Saves only; rejected attempts are not in it.`, { bounded: true });
  }
  for (const rev of revs) {
    const prev = ctx.revisions.find((r) => r.entityVersion === rev.entityVersion - 1) ?? null;
    const labels = fieldLabels(prev, rev);
    const net = prev && diffStates(prev.state, rev.state).isEmpty ? ' — no net change (see its two actions)' : '';
    lines.push(`Revision ${rev.entityVersion} · ${fmt.dateTime(rev.at)} · ${personaById(rev.actorId).name}: ${rev.summary}${labels.length && !net ? ` [${labels.join(', ')}]` : ''}${net}`);
    refs.push(revisionRef(rev, prev));
  }
  const draftNote = ctx.draft && ctx.draft.pending.length ? ` Your unsaved draft (${ctx.draft.pending.length} change${ctx.draft.pending.length === 1 ? '' : 's'}) is not part of history yet.` : '';
  const head = range ? `In ${range.label}, ${ctx.contactName} changed in ${revs.length} committed revision${revs.length === 1 ? '' : 's'}:` : `${ctx.contactName} has ${revs.length} committed revisions:`;
  return reply(ctx, query, `${head}\n${lines.map((l) => `• ${l}`).join('\n')}${draftNote}`, { refs });
}

function actorChanges(ctx: SidekickContext, query: string, actorId: PersonaId, family: Family | 'profile' | null): SidekickReply {
  const actor = personaById(actorId);
  const famLabel = family ? (family === 'profile' ? 'profile' : FAMILY_LABEL[family].toLowerCase()) : 'all';
  if (ctx.canActivity) {
    const matches = ctx.units.filter((u) => u.source === 'business' && u.actorId === actorId && (!family || u.families.includes(family)));
    const refs: SidekickRef[] = matches.map((u) => ({ kind: 'unit', stamp: u.stamp, label: `${fmt.date(u.at)} · ${ctx.contacts.find((c) => c.id === u.contacts[0]?.contactId)?.name ?? ''} · ${u.summary}` }));
    const filters: Partial<ActivityFilters> = { actor: actorId, family: family ?? 'all', contact: 'all', source: 'business', q: '', from: null, to: null };
    const text = matches.length
      ? `${actor.name} made ${matches.length} committed ${famLabel === 'all' ? '' : `${famLabel} `}change${matches.length === 1 ? '' : 's'} in this tenant. I set the activity filters to actor = ${actor.name}${family ? `, family = ${famLabel}` : ''} and opened the matches.`
      : `No committed ${famLabel} changes by ${actor.name} in the visible activity. I set the filters anyway so you can widen them.`;
    return reply(ctx, query, text, { refs, actions: [{ kind: 'filters', filters, label: `Filter activity: ${actor.name}${family ? ` · ${famLabel}` : ''}` }] });
  }
  // Bounded: no tenant-wide activity capability — answer from the current contact's history only.
  if (!ctx.contactId || !ctx.revisions.length) {
    return reply(ctx, query, `${ctx.persona.name} cannot open tenant activity (proposed read_activity capability). Open a contact and I can list ${actor.name}’s changes inside its history.`, { bounded: true });
  }
  const gate = requireHistory(ctx, query);
  if (gate) return gate;
  const revs = ctx.revisions.filter((r) => r.actorId === actorId && (!family || r.actions.some((a) => a.family === family)));
  const refs = revs.map((r) => revisionRef(r, ctx.revisions.find((x) => x.entityVersion === r.entityVersion - 1) ?? null));
  return reply(
    ctx,
    query,
    `${ctx.persona.name} cannot search tenant-wide activity, so this is limited to ${ctx.contactName}: ${revs.length ? revs.map((r) => `revision ${r.entityVersion} (${fmt.date(r.at)}: ${r.summary})`).join('; ') : `no ${famLabel} changes by ${actor.name}`}.`,
    { refs, bounded: true },
  );
}

function whoChanged(ctx: SidekickContext, query: string): SidekickReply {
  const gate = requireContact(ctx, query) ?? requireHistory(ctx, query);
  if (gate) return gate;
  const l = query.toLowerCase();
  const wanted: string[] = [];
  if (/extension/.test(l)) wanted.push('extension');
  if (/address/.test(l)) wanted.push('address');
  if (/primary|order|position/.test(l)) wanted.push('position');
  if (/email/.test(l) && !wanted.includes('position')) wanted.push('email');
  if (/phone|number/.test(l) && !wanted.includes('extension')) wanted.push('phone');
  if (/link|url|portfolio|web/.test(l)) wanted.push('web_link');
  if (/name|display/.test(l)) wanted.push('profile');
  if (/label/.test(l)) wanted.push('location');
  if (!wanted.length) wanted.push('');
  const hits: { rev: Revision; prev: Revision; paths: string[] }[] = [];
  for (const rev of ctx.revisions) {
    const prev = ctx.revisions.find((r) => r.entityVersion === rev.entityVersion - 1);
    if (!prev) continue;
    const paths = changedPaths(diffStates(prev.state, rev.state)).filter((p) => wanted.some((w) => p.includes(w)));
    if (paths.length) hits.push({ rev, prev, paths });
  }
  if (!hits.length) {
    return reply(ctx, query, `No committed revision of ${ctx.contactName} changed that. If a value changed and changed back inside one Save, the diff is empty but its actions remain (see revision 5).`, { bounded: true });
  }
  const last = hits[hits.length - 1]!;
  const refs = hits.map((h) => ({ ...revisionRef(h.rev, h.prev), fields: h.paths }));
  return reply(
    ctx,
    query,
    `${personaById(last.rev.actorId).name} changed it most recently in revision ${last.rev.entityVersion} (${fmt.dateTime(last.rev.at)}): ${last.rev.summary}.${hits.length > 1 ? ` Earlier: ${hits.slice(0, -1).map((h) => `revision ${h.rev.entityVersion} by ${personaById(h.rev.actorId).name}`).join(', ')}.` : ''}`,
    { refs },
  );
}

function openRevision(ctx: SidekickContext, query: string, version: number, compare: number | null): SidekickReply {
  const gate = requireContact(ctx, query) ?? requireHistory(ctx, query);
  if (gate) return gate;
  const rev = ctx.revisions.find((r) => r.entityVersion === version);
  if (!rev) return reply(ctx, query, `${ctx.contactName} has revisions 1–${ctx.revisions.length}; revision ${version} does not exist.`, { bounded: true });
  if (compare !== null && !ctx.revisions.find((r) => r.entityVersion === compare)) {
    return reply(ctx, query, `Revision ${compare} does not exist for ${ctx.contactName}.`, { bounded: true });
  }
  const prev = ctx.revisions.find((r) => r.entityVersion === (compare ?? version - 1)) ?? null;
  const d = prev ? diffStates(prev.state, rev.state) : null;
  const explain = d
    ? d.isEmpty
      ? `The difference is empty: the final state equals revision ${prev!.entityVersion}, but the Save recorded ${rev.actions.length} action${rev.actions.length === 1 ? '' : 's'} (${rev.actions.map((a) => a.summary).join('; ')}).`
      : `Compared with revision ${prev!.entityVersion}: ${fieldLabels(prev, rev).join(', ')}.`
    : 'This is the creation revision.';
  return reply(ctx, query, `Opening revision ${version}${compare !== null ? ` compared with ${compare}` : ''} of ${ctx.contactName} (${fmt.dateTime(rev.at)}, by ${personaById(rev.actorId).name}) in read-only historical mode. ${explain}`, {
    refs: [revisionRef(rev, prev)],
    actions: [{ kind: 'navigate', contactId: ctx.contactId!, version, compare: compare ?? (prev ? prev.entityVersion : null), label: `Open revision ${version}` }],
  });
}

function proposal(ctx: SidekickContext, query: string): SidekickReply {
  const gate = requireContact(ctx, query);
  if (gate) return gate;
  const contactId = ctx.contactId!;
  const current = ctx.revisions[ctx.revisions.length - 1]!;
  const base = ctx.draft ? ctx.draft.working : current.state;
  const l = query.toLowerCase();
  const commands: Command[] = [];
  const lines: string[] = [];
  const notes: string[] = [];

  const extMatch = /extension\s+(?:to\s+)?(\d{1,25})|ext\.?\s*(?:to\s+)?(\d{1,25})/.exec(l);
  if (extMatch) {
    const ext = extMatch[1] ?? extMatch[2]!;
    const phones = liveChildren(base.phones);
    const target = (ctx.selectedPhoneOrdinal !== null ? phones.find((p) => p.ordinal === ctx.selectedPhoneOrdinal) : undefined) ?? phones.find((p) => p.extension) ?? phones[0];
    if (!target) notes.push('There is no live phone to carry an extension.');
    else if (target.ordinal < 0) notes.push('That phone is new in your draft; save it first before I stage an extension on it.');
    else if (target.extension === ext) notes.push(`The ${target.location ?? 'phone'} extension is already ${ext}.`);
    else {
      commands.push({ kind: 'phone.replace', ordinal: target.ordinal, value: phoneToInput(target.value as PhoneValue), location: target.location, isPublic: target.isPublic, extension: ext });
      lines.push(`Change ${target.location ?? 'phone'} ${(target.value as PhoneValue).international} extension ${target.extension ?? '(none)'} → ${ext}`);
    }
  }

  const primaryMatch = /make\s+(?:the\s+)?([\w-]+)\s+(email|phone|address|link)\s+primary|(?:set|use)\s+(?:the\s+)?([\w-]+)\s+(email|phone|address|link)\s+as\s+primary/.exec(l);
  if (primaryMatch) {
    const label = (primaryMatch[1] ?? primaryMatch[3] ?? '').toLowerCase();
    const famWord = (primaryMatch[2] ?? primaryMatch[4]) as string;
    const family: Family = famWord === 'link' ? 'web_link' : (famWord as Family);
    const key = family === 'email' ? 'emails' : family === 'phone' ? 'phones' : family === 'address' ? 'addresses' : 'webLinks';
    const live = liveChildren(base[key] as { ordinal: number; displayOrder: number; location: string | null; value: unknown; isPublic: boolean; extension: string | null; deleted: boolean }[]);
    const target = live.find((c) => (c.location ?? '').toLowerCase() === label) ?? live.find((c) => (c.location ?? '').toLowerCase().startsWith(label));
    if (!target) notes.push(`There is no ${label} ${famWord} on this contact.`);
    else if (target.ordinal < 0) notes.push(`The ${label} ${famWord} is new in your draft; new entries save at the end. Save first, then make it primary.`);
    else if (target.displayOrder === 1) notes.push(`The ${label} ${famWord} (${childDisplay(family, target)}) is already primary.`);
    else {
      commands.push({ kind: `${family}.move`, ordinal: target.ordinal, displayOrder: 1 } as Command);
      lines.push(`Make ${label} ${famWord} ${childDisplay(family, target)} primary (position ${target.displayOrder} → 1)`);
    }
  }

  const addEmail = /add\s+(?:the\s+|an?\s+)?email\s+([^\s]+@[^\s]+)(?:\s+as\s+(\w+))?/.exec(l);
  if (addEmail) {
    const value = addEmail[1]!;
    const label = addEmail[2] ? addEmail[2][0]!.toUpperCase() + addEmail[2].slice(1) : null;
    commands.push({ kind: 'email.insert', value, location: label, isPublic: false });
    lines.push(`Add email ${value}${label ? ` (${label})` : ''} at the end, private`);
  }

  const relabel = /(?:relabel|rename|label)\s+(?:the\s+)?([\w-]+)\s+(email|phone)\s+(?:as|to)\s+([\w-]+)/.exec(l);
  if (relabel) {
    const from = relabel[1]!;
    const family = relabel[2] as Family;
    const to = relabel[3]![0]!.toUpperCase() + relabel[3]!.slice(1);
    const list = liveChildren((family === 'email' ? base.emails : base.phones) as { ordinal: number; displayOrder: number; location: string | null; value: unknown; isPublic: boolean; extension: string | null; deleted: boolean }[]);
    const target = list.find((c) => (c.location ?? '').toLowerCase() === from);
    if (!target) notes.push(`There is no ${from} ${family}.`);
    else {
      const value = family === 'phone' ? phoneToInput(target.value as PhoneValue) : (target.value as string);
      commands.push({ kind: `${family}.replace`, ordinal: target.ordinal, value, location: to, isPublic: target.isPublic, ...(family === 'phone' ? { extension: target.extension } : {}) } as Command);
      lines.push(`Relabel ${family} ${childDisplay(family, target)}: ${target.location} → ${to}`);
    }
  }

  if (!commands.length && !notes.length) {
    return reply(ctx, query, 'I can stage extension changes, primary selection, adding an email, or relabeling an email/phone. Try “Change this extension to 25 and make the work email primary”.', { bounded: true });
  }
  if (!hasGrant(ctx.persona, 'edit', contactId)) {
    return reply(ctx, query, `${ctx.persona.name} has no edit grant for ${ctx.contactName}, so I cannot stage a draft. The proposal would be: ${lines.join('; ') || notes.join(' ')}`, { bounded: true });
  }
  if (!commands.length) return reply(ctx, query, notes.join(' '), { bounded: true });
  const baseVersion = ctx.draft ? ctx.draft.baseVersion : current.entityVersion;
  return reply(
    ctx,
    query,
    `I staged ${commands.length} change${commands.length === 1 ? '' : 's'} as a draft on revision ${baseVersion}. Nothing is saved until you apply it as one Save; you can adjust or discard it.${notes.length ? ` Note: ${notes.join(' ')}` : ''}`,
    { actions: [{ kind: 'proposal', contactId, baseVersion, commands, lines, label: 'Stage as one Save' }] },
  );
}

function whereLives(ctx: SidekickContext, query: string): SidekickReply {
  const gate = requireContact(ctx, query);
  if (gate) return gate;
  if (!hasGrant(ctx.persona, 'read_detail', ctx.contactId!)) {
    return reply(ctx, query, `Private addresses need read_detail; ${ctx.persona.name} sees only the public directory projection of ${ctx.contactName}.`, { bounded: true });
  }
  const current = ctx.revisions[ctx.revisions.length - 1]!;
  const addresses = liveChildren(current.state.addresses);
  const text = addresses.length
    ? `The address family is the evidence: ${addresses.map((a) => `${a.location ?? 'Address'}: ${addressOneLine(a.value)}`).join('; ')}. A phone area code (for example 777) is a numbering hint, not proof of where someone lives.`
    : `${ctx.contactName} has no saved address. I will not infer residence from a phone area code.`;
  return reply(ctx, query, text, { bounded: !addresses.length });
}

export function askSidekick(rawQuery: string, ctx: SidekickContext): SidekickReply {
  const query = rawQuery.trim();
  const l = query.toLowerCase().replace(/[’']/g, '’');
  if (!query) return reply(ctx, query, 'Ask about this contact’s history, the activity filters, or stage a small edit.', { bounded: true });

  if (/^(help|what can you do|\?)$/.test(l)) {
    return reply(ctx, query, `I can: summarize what changed (this week, today, since creation); find who changed a field; open or compare revisions; filter tenant activity by actor and family; and stage small edits (extension, primary, add email, relabel). I only use fixture state and your grants; I never fabricate evidence.`, { bounded: true });
  }
  if (/password|login|secret|token|credential/.test(l)) {
    return reply(ctx, query, 'Passwords and credentials are never in contact history or in this prototype’s data. Provisioning evidence records only the login and role.', { bounded: true });
  }
  if (/\b(delete|remove)\b.*\b(contact|lina|record)\b/.test(l) && !/email|phone|link|address/.test(l)) {
    return reply(ctx, query, `Root deletion is a Save command that needs the “delete” grant${hasGrant(ctx.persona, 'delete', ctx.contactId ?? undefined) ? ' (you hold it)' : ` (${ctx.persona.name} does not hold it)`}. I do not stage root deletions; use the record’s lifecycle control if you are an administrator.`, { bounded: true });
  }
  if (/where (does|do) .* live|residence|lives? (in|at)/.test(l)) return whereLives(ctx, query);

  const cmp = /compare\s+(?:revision\s+)?(\d+)\s+(?:and|to|with|vs\.?)\s+(?:revision\s+)?(\d+)/.exec(l);
  if (cmp) return openRevision(ctx, query, Math.max(+cmp[1]!, +cmp[2]!), Math.min(+cmp[1]!, +cmp[2]!));

  const revOpen = /(?:open|show|go to|view|look like (?:at|in)|state at|what did .* look like (?:at|in))\s*(?:revision|rev|r)\s*(\d+)/.exec(l) ?? /revision\s+(\d+)\s+(?:diff|empty|state|actions)/.exec(l) ?? /(?:why is|why does) .*revision\s+(\d+)/.exec(l);
  if (revOpen) return openRevision(ctx, query, +revOpen[1]!, null);

  if (/who (changed|edited|updated|moved|set)/.test(l)) return whoChanged(ctx, query);

  // Imperative edits are proposals (checked before summaries so “change this…” is not read as “what changed”).
  if (/^(change|make|set|add|relabel|rename|update|stage|put)\b/.test(l) || /extension\s+(to\s+)?\d+/.test(l)) return proposal(ctx, query);

  const actor = actorFromText(l);
  const family = familyFromText(l);
  if (actor && /(show|find|list|filter|what|which|see).*(change|edit|update|save)/.test(l)) {
    return actorChanges(ctx, query, actor, family);
  }
  if (actor && /(change|edit|update|save)s?\b/.test(l) && !/\b(make|set|change (this|the) )/.test(l)) {
    return actorChanges(ctx, query, actor, family);
  }
  if (/what changed|what has changed|what’s changed|changes (this|in the|during|since|over)|changed (this|in the|during|since|over)|summar|what happened|recent/.test(l)) return whatChanged(ctx, query);

  if (/extension|primary|add (an? |the )?email|relabel|rename|label .* (as|to)/.test(l)) return proposal(ctx, query);

  return reply(
    ctx,
    query,
    'I can’t answer that from the fixture history, filters or draft on screen, and I won’t guess. Try: “What changed this week?”, “Who changed the home address?”, “Show Bruno’s phone changes”, or “Change this extension to 25”.',
    { bounded: true },
  );
}
