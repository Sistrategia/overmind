// SIMULATED contextual sidekick. Deterministic intent matching over the live fixture
// state: no external model, no API key. Every factual claim is computed from the
// simulated server at the moment of the question, so it agrees with edits and resets.
import { commandFor, fieldsOf, newItemId, type Draft, type DraftItem } from './draft';
import { childTitle, childValueText, diffStates, displayName, liveChildren, touchedKeys } from './engine';
import { LINA_KEY, NORTE_KEY } from './fixtures';
import { fmtDate, fmtDateTime, fmtTime, fmtWeekday, startOfTenantDay, startOfTenantWeek } from './format';
import type { AuditUnit, Child, ChildRef, ContactState, EmailChild, Family, PhoneChild } from './model';
import { FAMILY_LABEL, PROFILE_FIELD_LABEL } from './model';
import { actorShort, can, PERSONAS, type Persona } from './personas';
import type { ActivityFilters, SimServer } from './server';

export interface SidekickContext {
  persona: Persona;
  contactKey: string | null;
  selectedRevision: number | null;
  compareRevision: number | null;
  filters: ActivityFilters | null;
  draft: Draft | null;
  focusedChild: ChildRef | null;
  screen: 'contact' | 'history' | 'activity' | 'other';
}

export interface SidekickRef {
  label: string;
  kind: 'revision' | 'unit' | 'child' | 'activity' | 'contact';
  contactKey?: string;
  revision?: number;
  compare?: number;
  unitId?: string;
  highlight?: string[];
  filters?: ActivityFilters;
}

export interface SidekickProposal { title: string; explanation: string[]; items: DraftItem[]; contactKey: string; overlapsDraft: boolean }

export interface SidekickReply {
  id: string;
  text: string;
  refs: SidekickRef[];
  used: string[];
  proposal: SidekickProposal | null;
  navigate: SidekickRef | null;
  choices: { label: string; prompt: string }[] | null;
  bounded: boolean;
}

const FAMILY_WORDS: Record<string, Family> = { email: 'email', emails: 'email', mail: 'email', phone: 'phone', phones: 'phone', number: 'phone', address: 'address', addresses: 'address', 'web link': 'web_link', weblink: 'web_link', website: 'web_link', link: 'web_link', url: 'web_link' };

function cap(s: string): string { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function grants(p: Persona): string { return p.grants.join(', '); }

export class SidekickEngine {
  private seq = 0;
  constructor(private readonly server: SimServer) {}

  private reply(partial: Partial<SidekickReply> & { text: string; used: string[] }): SidekickReply {
    this.seq += 1;
    return { id: `sk${this.seq}`, refs: [], proposal: null, navigate: null, choices: null, bounded: false, ...partial };
  }

  suggestions(ctx: SidekickContext): string[] {
    const name = ctx.contactKey ? this.server.summary(ctx.contactKey)?.displayName.split(' ')[0] ?? 'this contact' : 'Lina';
    if (ctx.screen === 'activity') return ['Show Bruno\'s phone changes', 'Show Mariana\'s changes this week', `What changed in ${name}'s contact this week?`];
    if (ctx.screen === 'history') return ['Compare revision 3 and 4', 'What did revision 3 look like?', 'Who changed the postal code?'];
    return [`What changed in ${name}'s contact this week?`, 'Change this extension to 25 and make the work email primary', 'Who changed the postal code?'];
  }

  private used(ctx: SidekickContext, contactKey: string | null): string[] {
    const lines: string[] = [];
    if (contactKey) {
      const s = this.server.summary(contactKey);
      if (s) lines.push(`Contact: ${s.displayName}, revision ${s.entityVersion}${ctx.selectedRevision && ctx.selectedRevision !== s.entityVersion ? ` (viewing revision ${ctx.selectedRevision})` : ' (current)'}`);
      const units = this.server.unitsFor(contactKey);
      if (units.length) lines.push(`History: ${units.length} revisions, units …${units[0].id.slice(-4)} to …${units[units.length - 1].id.slice(-4)}`);
    }
    lines.push(`Persona: ${ctx.persona.name} (${grants(ctx.persona)})`);
    lines.push(ctx.draft && ctx.draft.items.length ? `Draft: ${ctx.draft.items.length} pending command${ctx.draft.items.length === 1 ? '' : 's'} on revision ${ctx.draft.baseVersion}` : 'Draft: none');
    if (ctx.filters && Object.values(ctx.filters).some(Boolean)) lines.push(`Filters: ${Object.entries(ctx.filters).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    lines.push(`Clock: ${fmtWeekday(this.server.now())} ${fmtDateTime(this.server.now())} CST`);
    return lines;
  }

  ask(rawText: string, ctx: SidekickContext): SidekickReply {
    const text = rawText.trim().toLowerCase().replace(/[?!.]+$/, '');
    const contactKey = this.resolveContact(text, ctx);

    if (!text) return this.reply({ text: 'Ask about what changed, who changed a field, compare revisions, or describe a small edit to stage.', used: this.used(ctx, contactKey), bounded: true });
    if (/^(help|what can you do)/.test(text)) return this.help(ctx, contactKey);

    if (/^(what|which)\s+.*(changed|change|happened)/.test(text) || /^(changes|recent changes)/.test(text) || /\bwhat changed\b/.test(text)) return this.whatChanged(text, ctx, contactKey);
    if (/^who\s+(changed|edited|updated|corrected|added|removed|deleted|restored)/.test(text)) return this.whoChanged(text, ctx, contactKey);
    if (/^(show|list|find|filter)\s+\w+'?s?\s+/.test(text) && /(change|edit|save|activity|update)/.test(text)) return this.showActorChanges(text, ctx);
    if (/^compare\s+/.test(text)) return this.compare(text, ctx, contactKey);
    if (/^(show|open|go to|view)\s+(revision|rev)\s+\d+/.test(text) || /what did .*revision\s+\d+/.test(text) || /look like/.test(text)) return this.showRevision(text, ctx, contactKey);
    if (/^(what|which)\s+(was|were|is|are)\s+/.test(text)) return this.stateQuestion(text, ctx, contactKey);
    if (/^(open|go to|show)\s+(history|activity|contact|the contact|the history|tenant activity|audit)/.test(text)) return this.navigateTo(text, ctx, contactKey);
    if (/^(change|set|update|make|add|relabel|label|rename|remove|delete|restore|move|mark)\b/.test(text)) return this.propose(rawText, ctx, contactKey);

    return this.reply({
      text: 'I can\'t answer that from the contact data I have. I don\'t invent facts outside the fixture: no birthdays, residence, employment or anything not stored on the contact. Try one of the suggestions.',
      used: this.used(ctx, contactKey), bounded: true, choices: this.suggestions(ctx).map(p => ({ label: p, prompt: p }))
    });
  }

  private help(ctx: SidekickContext, contactKey: string | null): SidekickReply {
    return this.reply({
      text: 'I work with the current view. I can summarise what changed and open the evidence, tell you who changed a field, compare two revisions, change activity filters, and stage a small edit that you apply as one Save. I never save on my own and I only use fixture data.',
      used: this.used(ctx, contactKey), choices: this.suggestions(ctx).map(p => ({ label: p, prompt: p }))
    });
  }

  private resolveContact(text: string, ctx: SidekickContext): string | null {
    if (/\blina\b/.test(text)) return LINA_KEY;
    if (/\bnorte\b/.test(text)) return NORTE_KEY;
    for (const p of PERSONAS) if (text.includes(`${p.shortName.toLowerCase()}'s contact`)) return p.actorKey;
    return ctx.contactKey;
  }

  private needContact(ctx: SidekickContext): SidekickReply {
    return this.reply({
      text: 'Which contact? Open a contact first or name one.', used: this.used(ctx, null), bounded: true,
      choices: [{ label: 'Lina Torres', prompt: 'What changed in Lina\'s contact this week?' }, { label: 'Norte Taller', prompt: 'What changed in Norte Taller\'s contact this week?' }]
    });
  }

  private needHistory(ctx: SidekickContext, contactKey: string | null): SidekickReply | null {
    if (can(ctx.persona, 'read_history') && can(ctx.persona, 'read_detail')) return null;
    return this.reply({ text: `${ctx.persona.name}'s role (${ctx.persona.role}) cannot read contact history, so I can't answer from revisions. Switch persona to an editor, the administrator or the auditor.`, used: this.used(ctx, contactKey), bounded: true });
  }

  // ---- what changed ---------------------------------------------------------------
  private window(text: string): { label: string; from: string | null; sinceRevision: number | null; count: number | null } {
    const now = this.server.now();
    const since = /since\s+(?:revision|rev)\s+(\d+)/.exec(text);
    if (since) return { label: `since revision ${since[1]}`, from: null, sinceRevision: Number(since[1]), count: null };
    if (/today/.test(text)) return { label: 'today', from: startOfTenantDay(now), sinceRevision: null, count: null };
    if (/last week|previous week/.test(text)) { const s = startOfTenantWeek(now); const prev = new Date(new Date(s).getTime() - 7 * 86_400_000).toISOString(); return { label: 'last week', from: prev, sinceRevision: null, count: null }; }
    if (/this week|week/.test(text)) return { label: 'this week', from: startOfTenantWeek(now), sinceRevision: null, count: null };
    if (/this month|month/.test(text)) { const d = new Date(now); d.setUTCDate(1); d.setUTCHours(6, 0, 0, 0); return { label: 'this month', from: d.toISOString(), sinceRevision: null, count: null }; }
    if (/ever|all time|overall/.test(text)) return { label: 'overall', from: null, sinceRevision: 0, count: null };
    return { label: 'recently', from: null, sinceRevision: null, count: 3 };
  }

  private unitLine(u: AuditUnit, contactKey: string): { text: string; ref: SidekickRef } {
    const prev = u.entityVersion > 1 ? this.server.snapshotAt(contactKey, u.entityVersion - 1) : null;
    const cur = this.server.snapshotAt(contactKey, u.entityVersion)!;
    const highlight = [...touchedKeys(u.actions)];
    let fields = '';
    if (prev) {
      const d = diffStates(prev, cur);
      const parts: string[] = [];
      if (d.profile.length) parts.push(d.profile.map(f => f.label).join(', '));
      for (const c of d.children) {
        const who = c.new ? childTitle(c.new) : c.old ? childTitle(c.old) : `${FAMILY_LABEL[c.ref.family]} ${c.ref.ordinal}`;
        if (c.kind === 'added') parts.push(`${who} added`);
        else if (c.kind === 'removed') parts.push(`${who} removed`);
        else parts.push(`${who}: ${c.fields.filter(f => !f.technical).map(f => `${f.label.toLowerCase()} ${f.old ?? '—'} → ${f.new ?? '—'}`).join(', ')}`);
      }
      fields = d.empty ? `no net difference, ${u.actions.length} actions recorded` : parts.join('; ');
    } else {
      fields = 'initial revision';
    }
    const when = `${fmtWeekday(u.recordedAt)} ${fmtDate(u.recordedAt)} ${fmtTime(u.recordedAt)}`;
    return {
      text: `Revision ${u.entityVersion} · ${when} · ${actorShort(u.actorKey)} — ${u.summary}. ${cap(fields)}.`,
      ref: { kind: 'revision', label: `Revision ${u.entityVersion}`, contactKey, revision: u.entityVersion, compare: u.entityVersion > 1 ? u.entityVersion - 1 : undefined, highlight, unitId: u.id }
    };
  }

  private whatChanged(text: string, ctx: SidekickContext, contactKey: string | null): SidekickReply {
    if (!contactKey) {
      if (ctx.screen === 'activity' && can(ctx.persona, 'activity')) return this.tenantChanged(text, ctx);
      return this.needContact(ctx);
    }
    const denied = this.needHistory(ctx, contactKey);
    if (denied) return denied;
    const summary = this.server.summary(contactKey)!;
    const w = this.window(text);
    let units = this.server.unitsFor(contactKey);
    if (w.from) units = units.filter(u => u.recordedAt >= w.from!);
    if (w.sinceRevision !== null) units = units.filter(u => u.entityVersion > w.sinceRevision!);
    if (w.count) units = units.slice(-w.count);
    const used = this.used(ctx, contactKey);
    if (w.from) used.push(`Window: from ${fmtWeekday(w.from)} ${fmtDate(w.from)} 00:00 CST to now`);
    if (units.length === 0) return this.reply({ text: `Nothing changed in ${summary.displayName}'s contact ${w.label}. The latest revision is ${summary.entityVersion}, saved ${fmtDate(this.server.unitsFor(contactKey).at(-1)!.recordedAt)}.`, used, refs: [{ kind: 'revision', label: `Revision ${summary.entityVersion}`, contactKey, revision: summary.entityVersion }] });
    const lines = units.map(u => this.unitLine(u, contactKey));
    const first = units[0].entityVersion, last = units[units.length - 1].entityVersion;
    let net = '';
    if (units.length > 1 && first > 1) {
      const d = diffStates(this.server.snapshotAt(contactKey, first - 1)!, this.server.snapshotAt(contactKey, last)!);
      net = d.empty ? `Net effect from revision ${first - 1} to ${last}: none.` : `Net effect from revision ${first - 1} to ${last}: ${d.profile.length + d.children.length} field group${d.profile.length + d.children.length === 1 ? '' : 's'} differ.`;
    }
    const refs = lines.map(l => l.ref);
    if (net && first > 1) refs.push({ kind: 'revision', label: `Compare ${first - 1} → ${last}`, contactKey, revision: last, compare: first - 1 });
    return this.reply({
      text: `${summary.displayName} changed ${units.length === 1 ? 'once' : `${units.length} times`} ${w.label}:\n${lines.map(l => '• ' + l.text).join('\n')}${net ? '\n' + net : ''}`,
      used, refs
    });
  }

  private tenantChanged(text: string, ctx: SidekickContext): SidekickReply {
    const w = this.window(text);
    let units = this.server.allUnits();
    if (w.from) units = units.filter(u => u.recordedAt >= w.from!);
    if (w.count) units = units.slice(-w.count);
    const byContact = new Map<string, AuditUnit[]>();
    for (const u of units) byContact.set(u.contactKey, [...(byContact.get(u.contactKey) ?? []), u]);
    const lines = [...byContact.entries()].map(([k, us]) => `• ${this.server.summary(k)?.displayName ?? k}: ${us.length} revision${us.length === 1 ? '' : 's'} (${[...new Set(us.map(u => actorShort(u.actorKey)))].join(', ')})`);
    return this.reply({
      text: units.length ? `Tenant activity ${w.label}: ${units.length} committed units across ${byContact.size} contacts.\n${lines.join('\n')}` : `No committed units ${w.label}.`,
      used: this.used(ctx, null),
      refs: [...byContact.keys()].map(k => ({ kind: 'activity' as const, label: `Filter: ${this.server.summary(k)?.displayName}`, filters: { contact: this.server.slugOf(k), from: w.from ? w.from.slice(0, 10) : undefined } }))
    });
  }

  // ---- who changed ---------------------------------------------------------------
  private whoChanged(text: string, ctx: SidekickContext, contactKey: string | null): SidekickReply {
    if (!contactKey) return this.needContact(ctx);
    const denied = this.needHistory(ctx, contactKey);
    if (denied) return denied;
    const units = this.server.unitsFor(contactKey);
    const target = this.fieldTarget(text);
    const hits: { u: AuditUnit; detail: string }[] = [];
    for (const u of [...units].reverse()) {
      const prev = u.entityVersion > 1 ? this.server.snapshotAt(contactKey, u.entityVersion - 1) : null;
      const cur = this.server.snapshotAt(contactKey, u.entityVersion)!;
      if (!prev) { if (target.kind === 'any') hits.push({ u, detail: 'created the contact' }); continue; }
      const d = diffStates(prev, cur);
      if (target.kind === 'profile') { const f = d.profile.filter(x => target.fields.includes(x.field)); if (f.length) hits.push({ u, detail: f.map(x => `${x.label} ${x.old ?? '—'} → ${x.new ?? '—'}`).join(', ') }); }
      else if (target.kind === 'child') {
        for (const c of d.children) {
          if (c.ref.family !== target.family) continue;
          const fields = c.fields.filter(f => !target.field || f.field === target.field || f.field.endsWith('.' + target.field));
          if (target.field && c.kind === 'changed' && fields.length === 0) continue;
          const who = childTitle((c.new ?? c.old)!);
          hits.push({ u, detail: c.kind === 'changed' ? `${who}: ${fields.map(f => `${f.label.toLowerCase()} ${f.old ?? '—'} → ${f.new ?? '—'}`).join(', ')}` : `${who} ${c.kind}` });
        }
      } else if (target.kind === 'any' && !d.empty) hits.push({ u, detail: u.summary });
      else if (target.kind === 'any' && d.empty && u.actions.length) hits.push({ u, detail: `${u.actions.length} actions with no net change` });
    }
    if (!hits.length) return this.reply({ text: `No revision of ${this.server.summary(contactKey)?.displayName} changed ${target.label}.`, used: this.used(ctx, contactKey), bounded: true });
    const latest = hits[0];
    const others = hits.slice(1, 4);
    return this.reply({
      text: `${actorShort(latest.u.actorKey)} changed ${target.label} most recently, in revision ${latest.u.entityVersion} on ${fmtWeekday(latest.u.recordedAt)} ${fmtDate(latest.u.recordedAt)} at ${fmtTime(latest.u.recordedAt)} CST: ${latest.detail}.${others.length ? `\nEarlier: ${others.map(h => `revision ${h.u.entityVersion} (${actorShort(h.u.actorKey)}) — ${h.detail}`).join('; ')}.` : ''}`,
      used: this.used(ctx, contactKey),
      refs: hits.slice(0, 4).map(h => ({ kind: 'revision' as const, label: `Revision ${h.u.entityVersion}`, contactKey, revision: h.u.entityVersion, compare: h.u.entityVersion - 1 || undefined, highlight: [...touchedKeys(h.u.actions)], unitId: h.u.id }))
    });
  }

  private fieldTarget(text: string): { kind: 'profile'; fields: string[]; label: string } | { kind: 'child'; family: Family; field: string | null; label: string } | { kind: 'any'; label: string } {
    if (/postal|zip|código postal/.test(text)) return { kind: 'child', family: 'address', field: 'zipCode', label: 'the postal code' };
    if (/address/.test(text)) return { kind: 'child', family: 'address', field: null, label: 'the address' };
    if (/extension/.test(text)) return { kind: 'child', family: 'phone', field: 'extension', label: 'a phone extension' };
    if (/label/.test(text)) { const fam = Object.entries(FAMILY_WORDS).find(([w]) => text.includes(w))?.[1] ?? 'phone'; return { kind: 'child', family: fam, field: 'location', label: `a ${FAMILY_LABEL[fam].toLowerCase()} label` }; }
    if (/primary|order|position/.test(text)) { const fam = Object.entries(FAMILY_WORDS).find(([w]) => text.includes(w))?.[1] ?? 'email'; return { kind: 'child', family: fam, field: 'displayOrder', label: `the ${FAMILY_LABEL[fam].toLowerCase()} order` }; }
    if (/phone|number/.test(text)) return { kind: 'child', family: 'phone', field: null, label: 'a phone' };
    if (/email|mail/.test(text)) return { kind: 'child', family: 'email', field: null, label: 'an email' };
    if (/link|website|url/.test(text)) return { kind: 'child', family: 'web_link', field: null, label: 'a web link' };
    if (/name|surname|alias|title/.test(text)) return { kind: 'profile', fields: ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'personAlias', 'jobTitle'], label: 'the name' };
    return { kind: 'any', label: 'the contact' };
  }

  // ---- activity filters ------------------------------------------------------------
  private showActorChanges(text: string, ctx: SidekickContext): SidekickReply {
    const m = /^(?:show|list|find|filter)\s+(\w+)'?s?\s+(.*)$/.exec(text);
    const actorWord = m?.[1] ?? '';
    const rest = m?.[2] ?? '';
    const persona = PERSONAS.find(p => p.shortName.toLowerCase() === actorWord || p.key === actorWord);
    if (!persona) return this.reply({ text: `I don't know an actor called "${cap(actorWord)}" in ${this.server.tenant().name}. Known actors: ${PERSONAS.map(p => p.shortName).join(', ')}.`, used: this.used(ctx, ctx.contactKey), bounded: true });
    const famWord = Object.keys(FAMILY_WORDS).find(w => new RegExp(`\\b${w}\\b`).test(rest));
    const family = famWord ? FAMILY_WORDS[famWord] : undefined;
    const w = this.window(rest);
    const filters: ActivityFilters = { actor: persona.key, family: family ?? '', from: w.from ? w.from.slice(0, 10) : undefined, source: 'audit' };
    if (can(ctx.persona, 'activity')) {
      const items = this.server.listActivity(filters, ctx.persona);
      const count = Array.isArray(items) ? items.length : 0;
      return this.reply({
        text: `Filtering tenant activity to ${persona.shortName}'s ${family ? FAMILY_LABEL[family].toLowerCase() + ' ' : ''}changes${w.from ? ' ' + w.label : ''}: ${count} committed unit${count === 1 ? '' : 's'}.${count ? ' Opening the first one.' : ''}`,
        used: this.used(ctx, ctx.contactKey),
        navigate: { kind: 'activity', label: 'Activity filters', filters, unitId: Array.isArray(items) && items[0]?.kind === 'unit' ? items[0].unit.id : undefined },
        refs: Array.isArray(items) ? items.filter(i => i.kind === 'unit').slice(0, 5).map(i => i.kind === 'unit' ? ({ kind: 'unit' as const, label: `${i.contact?.displayName} rev ${i.unit.entityVersion}`, unitId: i.unit.id, contactKey: i.unit.contactKey, revision: i.unit.entityVersion, compare: i.unit.entityVersion - 1 || undefined }) : null!).filter(Boolean) : []
      });
    }
    // Editors cannot open tenant activity: answer from the current contact's own history.
    const contactKey = ctx.contactKey;
    if (!contactKey || !can(ctx.persona, 'read_history')) return this.reply({ text: `${ctx.persona.name}'s role cannot open tenant activity, and there is no contact open to search instead.`, used: this.used(ctx, null), bounded: true });
    const units = this.server.unitsFor(contactKey).filter(u => u.actorKey === persona.actorKey && (!family || u.actions.some(a => a.target.family === family)) && (!w.from || u.recordedAt >= w.from));
    return this.reply({
      text: `${ctx.persona.name}'s role cannot open tenant-wide activity, so this is limited to ${this.server.summary(contactKey)?.displayName}'s own history: ${persona.shortName} made ${units.length} ${family ? FAMILY_LABEL[family].toLowerCase() + ' ' : ''}change${units.length === 1 ? '' : 's'} here${units.length ? ' — ' + units.map(u => `revision ${u.entityVersion} (${fmtDate(u.recordedAt)})`).join(', ') : ''}.`,
      used: this.used(ctx, contactKey), bounded: true,
      refs: units.map(u => ({ kind: 'revision' as const, label: `Revision ${u.entityVersion}`, contactKey, revision: u.entityVersion, compare: u.entityVersion - 1 || undefined, highlight: [...touchedKeys(u.actions)], unitId: u.id }))
    });
  }

  // ---- revisions -----------------------------------------------------------------
  private compare(text: string, ctx: SidekickContext, contactKey: string | null): SidekickReply {
    if (!contactKey) return this.needContact(ctx);
    const denied = this.needHistory(ctx, contactKey);
    if (denied) return denied;
    const m = /(\d+)\s*(?:and|with|to|vs\.?|→|-)\s*(\d+)/.exec(text);
    if (!m) return this.reply({ text: 'Tell me two revision numbers, for example "compare 3 and 4".', used: this.used(ctx, contactKey), bounded: true });
    const a = Math.min(Number(m[1]), Number(m[2])), b = Math.max(Number(m[1]), Number(m[2]));
    const sa = this.server.snapshotAt(contactKey, a), sb = this.server.snapshotAt(contactKey, b);
    if (!sa || !sb) return this.reply({ text: `This contact has revisions 1 to ${this.server.currentVersion(contactKey)}.`, used: this.used(ctx, contactKey), bounded: true });
    const d = diffStates(sa, sb);
    const actions = this.server.unitsFor(contactKey).filter(u => u.entityVersion > a && u.entityVersion <= b).reduce((n, u) => n + u.actions.length, 0);
    const parts = [...d.profile.map(f => `${f.label}: ${f.old ?? '—'} → ${f.new ?? '—'}`), ...d.children.map(c => `${childTitle((c.new ?? c.old)!)} ${c.kind === 'changed' ? c.fields.filter(f => !f.technical).map(f => `${f.label.toLowerCase()} ${f.old ?? '—'} → ${f.new ?? '—'}`).join(', ') : c.kind}`)];
    return this.reply({
      text: d.empty ? `Revisions ${a} and ${b} have no net difference, although ${actions} action${actions === 1 ? ' was' : 's were'} recorded in between. Opening the comparison.` : `Between revision ${a} and ${b}: ${parts.join('; ')}. ${actions} action${actions === 1 ? '' : 's'} recorded. Opening the comparison.`,
      used: this.used(ctx, contactKey), navigate: { kind: 'revision', label: `Compare ${a} → ${b}`, contactKey, revision: b, compare: a }
    });
  }

  private showRevision(text: string, ctx: SidekickContext, contactKey: string | null): SidekickReply {
    if (!contactKey) return this.needContact(ctx);
    const denied = this.needHistory(ctx, contactKey);
    if (denied) return denied;
    const m = /(?:revision|rev)\s+(\d+)/.exec(text);
    const rev = m ? Number(m[1]) : ctx.selectedRevision;
    if (!rev) return this.reply({ text: 'Which revision number?', used: this.used(ctx, contactKey), bounded: true });
    const s = this.server.snapshotAt(contactKey, rev);
    if (!s) return this.reply({ text: `This contact has revisions 1 to ${this.server.currentVersion(contactKey)}.`, used: this.used(ctx, contactKey), bounded: true });
    const u = this.server.unitsFor(contactKey).find(x => x.entityVersion === rev)!;
    const emails = liveChildren<EmailChild>(s, 'email').map(e => `${e.value} (${e.location ?? 'no label'}${e.displayOrder === 1 ? ', primary' : ''})`);
    const phones = liveChildren<PhoneChild>(s, 'phone').map(p => childValueText(p) + (p.location ? ` (${p.location})` : ''));
    return this.reply({
      text: `At revision ${rev} (${fmtDate(u.recordedAt)}, saved by ${actorShort(u.actorKey)}) the contact was "${displayName(s.profile)}" with ${emails.length} email${emails.length === 1 ? '' : 's'}: ${emails.join('; ') || 'none'}; phones: ${phones.join('; ') || 'none'}. This is a read-only historical view.`,
      used: this.used(ctx, contactKey), navigate: { kind: 'revision', label: `Revision ${rev}`, contactKey, revision: rev }
    });
  }

  private stateQuestion(text: string, ctx: SidekickContext, contactKey: string | null): SidekickReply {
    if (!contactKey) return this.needContact(ctx);
    const revM = /(?:at|in)\s+(?:revision|rev)\s+(\d+)/.exec(text);
    const rev = revM ? Number(revM[1]) : null;
    if (rev !== null) {
      const denied = this.needHistory(ctx, contactKey);
      if (denied) return denied;
    }
    const state: ContactState | undefined = rev !== null ? this.server.snapshotAt(contactKey, rev) : (() => { const c = this.server.getCurrent(contactKey, ctx.persona); return 'publicKey' in c ? c : undefined; })();
    if (!state) {
      if (can(ctx.persona, 'read_directory') && rev === null) {
        const dir = this.server.getDirectory(contactKey, ctx.persona);
        if ('publicKey' in dir) return this.reply({ text: `${ctx.persona.name} sees the public directory projection only. Public emails: ${dir.emails.map(e => (e as EmailChild).value).join(', ') || 'none'}; public phones: ${dir.phones.map(p => childValueText(p)).join(', ') || 'none'}. Private channels and history are not visible to this role.`, used: this.used(ctx, contactKey), bounded: true });
      }
      return this.reply({ text: `${ctx.persona.name}'s role cannot read this contact.`, used: this.used(ctx, contactKey), bounded: true });
    }
    const famWord = Object.keys(FAMILY_WORDS).find(w => new RegExp(`\\b${w}\\b`).test(text));
    const family = famWord ? FAMILY_WORDS[famWord] : null;
    const primaryOnly = /primary|first|main|default/.test(text);
    const when = rev !== null ? `at revision ${rev}` : `now (revision ${state.entityVersion})`;
    if (family) {
      const live = liveChildren(state, family);
      const pick = primaryOnly ? live.slice(0, 1) : live;
      const desc = pick.map(c => `${childValueText(c)}${c.location ? ` (${c.location}${c.displayOrder === 1 ? ', primary' : ''}${c.isPublic ? '' : ', private'})` : ''}`);
      return this.reply({ text: `${primaryOnly ? 'The primary ' + FAMILY_LABEL[family].toLowerCase() : cap(FAMILY_LABEL[family].toLowerCase()) + 's'} ${when}: ${desc.join('; ') || 'none'}.`, used: this.used(ctx, contactKey), refs: rev !== null ? [{ kind: 'revision', label: `Revision ${rev}`, contactKey, revision: rev }] : [], navigate: rev !== null ? { kind: 'revision', label: `Revision ${rev}`, contactKey, revision: rev } : null });
    }
    if (/name/.test(text)) return this.reply({ text: `The name ${when}: ${state.profile.fullName}${state.profile.displayName ? ` (displayed as ${state.profile.displayName})` : ''}.`, used: this.used(ctx, contactKey) });
    return this.reply({ text: `I can describe emails, phones, addresses, links or the name ${when}. I don't hold other facts about this contact.`, used: this.used(ctx, contactKey), bounded: true });
  }

  private navigateTo(text: string, ctx: SidekickContext, contactKey: string | null): SidekickReply {
    if (/activity|audit/.test(text)) {
      if (!can(ctx.persona, 'activity')) return this.reply({ text: `${ctx.persona.name}'s role cannot open tenant activity.`, used: this.used(ctx, contactKey), bounded: true });
      return this.reply({ text: 'Opening tenant activity.', used: this.used(ctx, contactKey), navigate: { kind: 'activity', label: 'Activity', filters: ctx.filters ?? {} } });
    }
    if (!contactKey) return this.needContact(ctx);
    if (/history/.test(text)) return this.reply({ text: 'Opening the history.', used: this.used(ctx, contactKey), navigate: { kind: 'revision', label: 'History', contactKey, revision: this.server.currentVersion(contactKey) } });
    return this.reply({ text: 'Opening the contact.', used: this.used(ctx, contactKey), navigate: { kind: 'contact', label: 'Contact', contactKey } });
  }

  // ---- proposals --------------------------------------------------------------------
  private propose(rawText: string, ctx: SidekickContext, contactKey: string | null): SidekickReply {
    if (!contactKey) return this.needContact(ctx);
    const cur = this.server.getCurrent(contactKey, ctx.persona);
    if (!('publicKey' in cur)) return this.reply({ text: `${ctx.persona.name}'s role cannot read this contact's details, so I can't stage an edit.`, used: this.used(ctx, contactKey), bounded: true });
    const clauses = rawText.trim().replace(/[?!.]+$/, '').split(/\s*(?:,|;|\band\b|\bthen\b)\s*/i).map(c => c.trim()).filter(Boolean);
    const items: DraftItem[] = [];
    const explanation: string[] = [];
    const notes: string[] = [];
    let choices: SidekickReply['choices'] = null;
    for (const clause of clauses) {
      const r = this.parseClause(clause, cur, ctx);
      if (r.kind === 'item') { items.push(r.item); explanation.push(r.explanation); }
      else if (r.kind === 'note') notes.push(r.note);
      else if (r.kind === 'ambiguous') { choices = r.choices; notes.push(r.note); }
    }
    if (choices) return this.reply({ text: notes.join(' '), used: this.used(ctx, contactKey), bounded: true, choices });
    if (!items.length) return this.reply({ text: notes.length ? notes.join(' ') : `I could not read an edit in "${rawText}". Try "change the office extension to 25" or "make the work email primary".`, used: this.used(ctx, contactKey), bounded: true });
    if (!can(ctx.persona, 'edit')) {
      return this.reply({ text: `${ctx.persona.name}'s role (${ctx.persona.role}) has no edit grant, so I will not stage anything. For the record, the edit would be: ${explanation.join('; ')}.`, used: this.used(ctx, contactKey), bounded: true });
    }
    const draftKeys = new Set((ctx.draft?.items ?? []).map(i => JSON.stringify([i.command.kind.split('.')[0], (i.command as { ordinal?: number }).ordinal])));
    const overlapsDraft = items.some(i => draftKeys.has(JSON.stringify([i.command.kind.split('.')[0], (i.command as { ordinal?: number }).ordinal])));
    return this.reply({
      text: `Proposed edit, ${items.length} command${items.length === 1 ? '' : 's'} as one Save against revision ${cur.entityVersion}:\n${explanation.map(e => '• ' + e).join('\n')}${notes.length ? '\n' + notes.join(' ') : ''}${overlapsDraft ? '\nYou already have a pending change on one of these items; staging replaces it.' : ''}\nNothing is saved until you apply it.`,
      used: this.used(ctx, contactKey),
      proposal: { title: `Stage ${items.length} command${items.length === 1 ? '' : 's'}`, explanation, items, contactKey, overlapsDraft }
    });
  }

  private findByWord(state: ContactState, family: Family, word: string | undefined): Child[] {
    const live = liveChildren(state, family);
    if (!word) return live;
    const w = word.toLowerCase();
    const byLabel = live.filter(c => (c.location ?? '').toLowerCase() === w || (c.location ?? '').toLowerCase().startsWith(w));
    if (byLabel.length) return byLabel;
    const byValue = live.filter(c => childValueText(c).toLowerCase().includes(w));
    if (byValue.length) return byValue;
    if (w === 'primary' || w === 'first' || w === 'main') return live.slice(0, 1);
    return [];
  }

  private parseClause(clause: string, state: ContactState, ctx: SidekickContext):
    { kind: 'item'; item: DraftItem; explanation: string } | { kind: 'note'; note: string } | { kind: 'ambiguous'; note: string; choices: { label: string; prompt: string }[] } {
    const c = clause.toLowerCase().trim();
    const note = 'proposed by the sidekick';
    let m: RegExpExecArray | null;

    // extension
    if ((m = /^(?:change|set|update|make)\s+(?:the\s+|this\s+|that\s+)?(?:(\w+)\s+)?(?:phone\s+)?(?:extension|ext\.?)\s+(?:to|=|as|into)?\s*(\d{1,25})$/.exec(c))) {
      const word = m[1] && !['phone'].includes(m[1]) ? m[1] : undefined;
      let phones = this.findByWord(state, 'phone', word) as PhoneChild[];
      if (!word && ctx.focusedChild?.family === 'phone') phones = phones.filter(p => p.ordinal === ctx.focusedChild!.ordinal);
      if (!word && phones.length > 1) { const withExt = phones.filter(p => p.extension); if (withExt.length === 1) phones = withExt; }
      if (phones.length === 0) return { kind: 'note', note: `No ${word ? word + ' ' : ''}phone with an extension to change.` };
      if (phones.length > 1) return { kind: 'ambiguous', note: 'Which phone\'s extension?', choices: phones.map(p => ({ label: `${childTitle(p)} ${childValueText(p)}`, prompt: `change the ${(p.location ?? 'first').toLowerCase()} extension to ${m![2]}` })) };
      const p = phones[0];
      if (p.extension === m[2]) return { kind: 'note', note: `The ${childTitle(p)} extension is already ${m[2]}.` };
      const fields = { ...fieldsOf(p), extension: m[2] };
      return { kind: 'item', item: { id: newItemId(), command: commandFor('phone.replace', p.ordinal, fields), origin: 'sidekick', note }, explanation: `Change the ${childTitle(p)} (${childValueText({ ...p, extension: null })}) extension ${p.extension ?? '—'} → ${m[2]} (phone.replace, identity ${p.ordinal} kept)` };
    }
    // primary
    if ((m = /^(?:make|set|mark)\s+(?:the\s+)?(.+?)\s+(email|phone|address|web ?link|link)\s+(?:the\s+|as\s+)?primary$/.exec(c)) || (m = /^(?:make|set|mark)\s+(\S+@\S+)()\s+(?:the\s+|as\s+)?primary$/.exec(c))) {
      const family = m[2] ? FAMILY_WORDS[m[2].replace(/\s+/, ' ')] ?? 'email' : 'email';
      const found = this.findByWord(state, family, m[1]);
      if (found.length === 0) return { kind: 'note', note: `No ${m[1]} ${FAMILY_LABEL[family].toLowerCase()} on this contact.` };
      if (found.length > 1) return { kind: 'ambiguous', note: `Which ${FAMILY_LABEL[family].toLowerCase()}?`, choices: found.map(f => ({ label: `${childTitle(f)} ${childValueText(f)}`, prompt: `make ${childValueText(f)} primary` })) };
      const f = found[0];
      if (f.displayOrder === 1) return { kind: 'note', note: `${cap(childTitle(f))} ${childValueText(f)} is already primary.` };
      return { kind: 'item', item: { id: newItemId(), command: { kind: `${family}.move`, ordinal: f.ordinal, displayOrder: 1 }, origin: 'sidekick', note }, explanation: `Move the ${childTitle(f)} ${childValueText(f)} from position ${f.displayOrder} to 1, making it primary (${family}.move)` };
    }
    // visibility
    if ((m = /^(?:make|set|mark)\s+(?:the\s+)?(.+?)\s+(email|phone|address|web ?link|link)\s+(public|private)$/.exec(c))) {
      const family = FAMILY_WORDS[m[2]] ?? 'email';
      const found = this.findByWord(state, family, m[1]);
      if (found.length !== 1) return found.length ? { kind: 'ambiguous', note: `Which ${FAMILY_LABEL[family].toLowerCase()}?`, choices: found.map(f => ({ label: `${childTitle(f)} ${childValueText(f)}`, prompt: `make ${childValueText(f)} ${m![3]}` })) } : { kind: 'note', note: `No ${m[1]} ${FAMILY_LABEL[family].toLowerCase()} here.` };
      const f = found[0];
      const isPublic = m[3] === 'public';
      if (f.isPublic === isPublic) return { kind: 'note', note: `${cap(childTitle(f))} is already ${m[3]}.` };
      return { kind: 'item', item: { id: newItemId(), command: commandFor(`${family}.replace`, f.ordinal, { ...fieldsOf(f), isPublic }), origin: 'sidekick', note }, explanation: `Make the ${childTitle(f)} ${childValueText(f)} ${m[3]} (${family}.replace)` };
    }
    // relabel
    if ((m = /^(?:re)?(?:label|rename)\s+(?:the\s+)?(.+?)\s+(email|phone|address|web ?link|link)\s+(?:as|to)\s+(.+)$/.exec(c))) {
      const family = FAMILY_WORDS[m[2]] ?? 'email';
      const found = this.findByWord(state, family, m[1]);
      if (found.length !== 1) return { kind: 'note', note: found.length ? `Several ${FAMILY_LABEL[family].toLowerCase()}s match "${m[1]}".` : `No ${m[1]} ${FAMILY_LABEL[family].toLowerCase()} here.` };
      const f = found[0];
      const label = cap(m[3].replace(/^["']|["']$/g, ''));
      return { kind: 'item', item: { id: newItemId(), command: commandFor(`${family}.replace`, f.ordinal, { ...fieldsOf(f), location: label }), origin: 'sidekick', note }, explanation: `Relabel the ${childTitle(f)} ${f.location ?? '—'} → ${label} (${family}.replace)` };
    }
    // add email
    if ((m = /^add\s+(?:an?\s+|the\s+)?(?:(\w+)\s+)?e-?mail\s+(\S+@\S+)$/.exec(c))) {
      const label = m[1] ? cap(m[1]) : null;
      return { kind: 'item', item: { id: newItemId(), command: commandFor('email.insert', undefined, { value: m[2], location: label, isPublic: false, extension: null }), origin: 'sidekick', note }, explanation: `Add ${label ? label + ' ' : ''}email ${m[2]} at the end of the list, private by default (email.insert)` };
    }
    // add phone
    if ((m = /^add\s+(?:an?\s+|the\s+)?(?:(\w+)\s+)?phone\s+(.+)$/.exec(c))) {
      const number = m[2].replace(/^["']|["']$/g, '');
      if (!number.startsWith('+')) return { kind: 'note', note: 'A local number needs a country context; use the form\'s Mexico-local mode or give the full international number.' };
      const label = m[1] ? cap(m[1]) : null;
      return { kind: 'item', item: { id: newItemId(), command: commandFor('phone.insert', undefined, { value: { number }, location: label, isPublic: false, extension: null }), origin: 'sidekick', note }, explanation: `Add ${label ? label + ' ' : ''}phone ${number}, private by default (phone.insert)` };
    }
    // remove
    if ((m = /^(?:remove|delete)\s+(?:the\s+)?(.+?)\s+(email|phone|address|web ?link|link)$/.exec(c))) {
      const family = FAMILY_WORDS[m[2]] ?? 'email';
      const found = this.findByWord(state, family, m[1]);
      if (found.length !== 1) return { kind: 'note', note: found.length ? `Several ${FAMILY_LABEL[family].toLowerCase()}s match "${m[1]}".` : `No ${m[1]} ${FAMILY_LABEL[family].toLowerCase()} here.` };
      const f = found[0];
      return { kind: 'item', item: { id: newItemId(), command: { kind: `${family}.delete`, ordinal: f.ordinal }, origin: 'sidekick', note }, explanation: `Remove the ${childTitle(f)} ${childValueText(f)}; its identity ${f.ordinal} is retained and can be restored later (${family}.delete)` };
    }
    // profile alias / display name
    if ((m = /^(?:set|change|update)\s+(?:the\s+)?(alias|display name|job title)\s+(?:to|as)\s+(.+)$/.exec(c))) {
      const field = m[1] === 'alias' ? 'personAlias' : m[1] === 'display name' ? 'displayName' : 'jobTitle';
      const value = m[2].replace(/^["']|["']$/g, '');
      const profile = { ...state.profile, [field]: value };
      return { kind: 'item', item: { id: newItemId(), command: { kind: 'profile.replace', profile }, origin: 'sidekick', note }, explanation: `Set ${PROFILE_FIELD_LABEL[field].toLowerCase()} ${state.profile[field as 'personAlias'] ?? '—'} → ${value} (profile.replace, full profile supplied)` };
    }
    return { kind: 'note', note: `I could not read "${clause}" as an edit.` };
  }
}
