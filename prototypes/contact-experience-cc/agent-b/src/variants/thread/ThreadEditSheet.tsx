import React, { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../core/store';
import { useContactView, useEscape, useFocusReturn } from '../../core/hooks';
import { Icon } from '../../core/icons';
import type { Child, ContactState, Family, PhoneValue, Profile } from '../../core/types';
import { FAMILIES } from '../../core/types';
import { childDisplay, liveChildren, FAMILY_LABEL, FAMILY_PLURAL } from '../../core/format';
import { childrenOf, useChannelFields, useEditing, LABEL_SUGGESTIONS, REGIONS, type ChannelFields } from '../../core/editing';
import { profileFieldLabel } from '../../core/engine';

export function ThreadEditSheet({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const ws = useWorkspace();
  const view = useContactView(contactId);
  useEscape(true, onClose);
  useFocusReturn(true);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    if (!ws.draft) ws.beginDraft(contactId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const state = view?.state;
  const draft = ws.draft && ws.draft.contactId === contactId ? ws.draft : null;
  const saving = ws.saveState.status === 'saving';
  if (!state) return null;
  return (
    <>
      <div className="th-sheet-backdrop" onClick={onClose} />
      <aside className="th-sheet" role="dialog" aria-modal="true" aria-labelledby="th-sheet-title">
        <div className="th-sheet__head">
          <h2 id="th-sheet-title">Edit contact</h2>
          {draft ? <span className="th-tag th-tag--primary">draft on revision {draft.baseVersion}</span> : null}
          <button ref={first} className="th-btn th-btn--text th-btn--icon" onClick={onClose} aria-label="Close editor">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="th-sheet__body">
          <ProfileEditor contactId={contactId} profile={state.profile} base={draft?.base ?? null} />
          {FAMILIES.map((family) => (
            <ChannelSection key={family} contactId={contactId} family={family} state={state} base={draft?.base ?? null} />
          ))}
        </div>
        <div className="th-sheet__foot">
          {ws.draftError ? (
            <div className="th-error">
              <Icon name="alert" size={14} /> {ws.draftError}
            </div>
          ) : ws.pending.length ? (
            <>
              <strong style={{ fontSize: 13 }}>
                {ws.pending.length} change{ws.pending.length === 1 ? '' : 's'} · saved together as one revision
              </strong>
              <ol className="th-pending">
                {ws.pending.map((p) => (
                  <li key={p.key}>{p.text}</li>
                ))}
              </ol>
            </>
          ) : (
            <span className="th-hint">No changes yet. Edit a field or add an entry; everything saves together.</span>
          )}
          <div className="th-card__actions">
            <button className="th-btn th-btn--filled" onClick={() => void ws.save()} disabled={saving || !ws.pending.length || !!ws.draftError}>
              <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save as one revision'}
            </button>
            <button
              className="th-btn th-btn--text"
              onClick={() => {
                if (!ws.pending.length) ws.discardDraft();
                onClose();
              }}
              disabled={saving}
            >
              {ws.pending.length ? 'Close (keep draft)' : 'Cancel'}
            </button>
            {ws.pending.length ? (
              <button className="th-btn th-btn--text" onClick={ws.discardDraft} disabled={saving}>
                Discard
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}

function ProfileEditor({ contactId, profile, base }: { contactId: string; profile: Profile; base: ContactState | null }) {
  const edit = useEditing(contactId);
  const ws = useWorkspace();
  const [p, setP] = useState<Profile>(profile);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setP(profile), [profile]);
  const set = (k: keyof Profile, v: string) => setP((x) => ({ ...x, [k]: v === '' ? null : v }));
  const keys: (keyof Profile)[] = profile.contactTypeId === 1 ? ['fullName', 'displayName', 'personFirstName', 'personLastName1', 'personLastName2', 'personAlias'] : ['fullName', 'displayName'];
  const dirty = JSON.stringify(p) !== JSON.stringify(profile);
  const changed = base && JSON.stringify(base.profile) !== JSON.stringify(profile);
  return (
    <section className="th-section" aria-labelledby="th-es-profile">
      <div className="th-section__h" id="th-es-profile">
        <Icon name="person" size={16} /> Profile {changed ? <span className="th-tag th-tag--primary">pending</span> : null}
      </div>
      <div className="th-form" style={{ background: 'var(--th-lowest)', color: 'inherit', border: '1px solid var(--th-outline-variant)' }}>
        <div className="th-form__grid">
          {keys.map((k) => (
            <div key={k} className="th-field">
              <label htmlFor={`tp-${k}`}>{profileFieldLabel(k)}</label>
              <input id={`tp-${k}`} className="th-input" value={(p[k] as string | null) ?? ''} onChange={(e) => set(k, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="th-field">
          <label htmlFor="tp-summary">Summary</label>
          <textarea id="tp-summary" className="th-textarea" value={p.summary ?? ''} onChange={(e) => set('summary', e.target.value)} />
        </div>
        {error ? (
          <div className="th-error" role="alert">
            <Icon name="alert" size={14} /> {error}
          </div>
        ) : null}
        <div className="th-card__actions">
          <button
            className="th-btn th-btn--sm th-btn--filled"
            disabled={!dirty}
            onClick={() => {
              const e = edit.commitProfile(p);
              setError(e);
              if (!e) ws.notify('Profile change added to your draft.', 'info');
            }}
          >
            Apply profile to draft
          </button>
          {dirty ? (
            <button className="th-btn th-btn--sm th-btn--text" onClick={() => setP(profile)}>
              Revert fields
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ChannelSection({ contactId, family, state, base }: { contactId: string; family: Family; state: ContactState; base: ContactState | null }) {
  const ws = useWorkspace();
  const edit = useEditing(contactId);
  const all = childrenOf(state, family);
  const live = liveChildren(all);
  const deleted = all.filter((c) => c.deleted && c.ordinal > 0);
  const [adding, setAdding] = useState(false);
  const [editingOrdinal, setEditingOrdinal] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const baseChild = (ordinal: number) => (base ? childrenOf(base, family).find((c) => c.ordinal === ordinal) ?? null : null);
  const isPending = (c: Child<unknown>) => {
    if (!base) return false;
    if (c.ordinal < 0) return true;
    const b = baseChild(c.ordinal);
    if (!b) return false;
    const posBase = liveChildren(childrenOf(base, family)).findIndex((x) => x.ordinal === c.ordinal) + 1;
    return JSON.stringify(b.value) !== JSON.stringify(c.value) || b.location !== c.location || b.isPublic !== c.isPublic || b.extension !== c.extension || b.deleted !== c.deleted || posBase !== c.displayOrder;
  };
  return (
    <section className="th-section" aria-labelledby={`th-es-${family}`}>
      <div className="th-section__h" id={`th-es-${family}`}>
        <Icon name={family === 'email' ? 'mail' : family === 'phone' ? 'phone' : family === 'web_link' ? 'link' : 'pin'} size={16} /> {FAMILY_PLURAL[family]} <span className="th-tag">{live.length}</span>
        <button className="th-btn th-btn--sm th-btn--outlined" onClick={() => setAdding(true)} disabled={adding}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      {live.map((c, i) =>
        editingOrdinal === c.ordinal ? (
          <ChannelForm key={c.ordinal} contactId={contactId} family={family} child={c} onDone={() => setEditingOrdinal(null)} />
        ) : (
          <div key={c.ordinal} className={`th-erow${isPending(c) ? ' th-erow--pending' : ''}`}>
            <div>
              <div className="th-erow__value">{childDisplay(family, c)}</div>
              <div className="th-erow__meta">
                {i === 0 ? <span style={{ fontWeight: 700, color: 'var(--th-primary)' }}>Primary</span> : <span>Position {c.displayOrder}</span>}
                <span>{c.location ?? 'No label'}</span>
                <span>{c.isPublic ? 'Public' : 'Private'}</span>
                {family === 'phone' && (c.value as PhoneValue).interpretation !== 'international' ? <span>entered “{(c.value as PhoneValue).raw}” · {(c.value as PhoneValue).defaultRegion} {(c.value as PhoneValue).areaCode}</span> : null}
                {c.ordinal < 0 ? <span className="th-tag th-tag--primary">new · saved at the end</span> : isPending(c) ? <span className="th-tag th-tag--primary">pending</span> : null}
              </div>
            </div>
            <div className="th-erow__actions">
              {i !== 0 ? (
                <button
                  className="th-btn th-btn--text th-btn--sm th-btn--icon"
                  title="Make primary"
                  aria-label={`Make ${childDisplay(family, c)} primary`}
                  onClick={() => {
                    const err = edit.makePrimary(family, c.ordinal);
                    setRowError(err);
                  }}
                >
                  <Icon name="star" size={16} />
                </button>
              ) : null}
              <button className="th-btn th-btn--text th-btn--sm th-btn--icon" aria-label={`Edit ${childDisplay(family, c)}`} onClick={() => setEditingOrdinal(c.ordinal)}>
                <Icon name="edit" size={16} />
              </button>
              <button className="th-btn th-btn--text th-btn--sm th-btn--icon" aria-label={`Remove ${childDisplay(family, c)}`} onClick={() => edit.remove(family, c.ordinal)}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
        ),
      )}
      {deleted.map((c) => (
        <div key={c.ordinal} className="th-erow th-erow--deleted">
          <div>
            <div className="th-erow__value">{childDisplay(family, c)}</div>
            <div className="th-erow__meta">
              <span className="th-tag th-tag--error">{baseChild(c.ordinal)?.deleted ? 'deleted earlier' : 'removed in draft'}</span>
            </div>
          </div>
          <div className="th-erow__actions">
            <button className="th-btn th-btn--sm th-btn--outlined" onClick={() => edit.restore(family, c.ordinal)}>
              <Icon name="restore" size={14} /> Restore
            </button>
          </div>
        </div>
      ))}
      {rowError ? (
        <div className="th-error" role="alert">
          <Icon name="alert" size={14} /> {rowError}
        </div>
      ) : null}
      {adding ? <ChannelForm contactId={contactId} family={family} child={null} onDone={() => setAdding(false)} /> : null}
      {live.length === 0 && !adding ? <span className="th-hint">No {FAMILY_PLURAL[family].toLowerCase()}.</span> : null}
      <span className="th-sr">{ws.persona.name}</span>
    </section>
  );
}

function ChannelForm({ contactId, family, child, onDone }: { contactId: string; family: Family; child: Child<unknown> | null; onDone: () => void }) {
  const edit = useEditing(contactId);
  const { fields, set, setPhone, setAddress, validation } = useChannelFields(family, child);
  const [submitted, setSubmitted] = useState(false);
  const apply = () => {
    setSubmitted(true);
    if (!validation.ok) return;
    const err = edit.commitChannel(family, child?.ordinal ?? null, fields);
    if (!err) onDone();
  };
  const id = `tf-${family}-${child?.ordinal ?? 'new'}`;
  return (
    <div
      className="th-form"
      role="group"
      aria-label={child ? `Edit ${FAMILY_LABEL[family].toLowerCase()}` : `Add ${FAMILY_LABEL[family].toLowerCase()}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          apply();
        }
      }}
    >
      {family === 'email' ? (
        <div className="th-field">
          <label htmlFor={`${id}-value`}>Email address</label>
          <input id={`${id}-value`} className="th-input" value={fields.value} onChange={(e) => set('value', e.target.value)} autoFocus inputMode="email" aria-invalid={submitted && !validation.ok ? 'true' : undefined} />
        </div>
      ) : null}
      {family === 'web_link' ? (
        <div className="th-form__grid">
          <div className="th-field">
            <label htmlFor={`${id}-value`}>URL</label>
            <input id={`${id}-value`} className="th-input" value={fields.value} onChange={(e) => set('value', e.target.value)} autoFocus inputMode="url" aria-invalid={submitted && !validation.ok ? 'true' : undefined} />
          </div>
          <div className="th-field">
            <label htmlFor={`${id}-title`}>Title</label>
            <input id={`${id}-title`} className="th-input" value={fields.title} onChange={(e) => set('title', e.target.value)} />
          </div>
        </div>
      ) : null}
      {family === 'phone' ? (
        <>
          <div className="th-field">
            <label htmlFor={`${id}-number`}>Number</label>
            <input id={`${id}-number`} className="th-input" value={fields.phone.number} onChange={(e) => setPhone({ number: e.target.value })} autoFocus inputMode="tel" placeholder="+52 777 312 3456 or 312-3456" aria-invalid={submitted && !validation.ok ? 'true' : undefined} />
          </div>
          <div className="th-form__grid">
            <div className="th-field">
              <label htmlFor={`${id}-region`}>Country (local numbers)</label>
              <select id={`${id}-region`} className="th-select" value={fields.phone.defaultRegion} onChange={(e) => setPhone({ defaultRegion: e.target.value })}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-area`}>Area code</label>
              <input id={`${id}-area`} className="th-input" value={fields.phone.areaCode} onChange={(e) => setPhone({ areaCode: e.target.value })} inputMode="numeric" />
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-ext`}>Extension</label>
              <input id={`${id}-ext`} className="th-input" value={fields.phone.extension} onChange={(e) => setPhone({ extension: e.target.value })} inputMode="numeric" />
            </div>
          </div>
        </>
      ) : null}
      {family === 'address' ? (
        <>
          <div className="th-form__grid">
            <div className="th-field">
              <label htmlFor={`${id}-street`}>Street</label>
              <input id={`${id}-street`} className="th-input" value={fields.address.streetName ?? ''} onChange={(e) => setAddress({ streetName: e.target.value })} autoFocus />
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-ext`}>Ext. number</label>
              <input id={`${id}-ext`} className="th-input" value={fields.address.extNumber ?? ''} onChange={(e) => setAddress({ extNumber: e.target.value })} />
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-int`}>Int. number</label>
              <input id={`${id}-int`} className="th-input" value={fields.address.intNumber ?? ''} onChange={(e) => setAddress({ intNumber: e.target.value })} />
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-colony`}>Colony</label>
              <input id={`${id}-colony`} className="th-input" value={fields.address.colony ?? ''} onChange={(e) => setAddress({ colony: e.target.value })} />
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-city`}>City</label>
              <input id={`${id}-city`} className="th-input" value={fields.address.city ?? ''} onChange={(e) => setAddress({ city: e.target.value })} />
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-state`}>State</label>
              <input id={`${id}-state`} className="th-input" value={fields.address.state ?? ''} onChange={(e) => setAddress({ state: e.target.value })} />
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-zip`}>Postal code</label>
              <input id={`${id}-zip`} className="th-input" value={fields.address.zipCode ?? ''} onChange={(e) => setAddress({ zipCode: e.target.value })} />
            </div>
            <div className="th-field">
              <label htmlFor={`${id}-country`}>Country</label>
              <input id={`${id}-country`} className="th-input" value={fields.address.country ?? ''} onChange={(e) => setAddress({ country: e.target.value })} />
            </div>
          </div>
        </>
      ) : null}
      <LabelVisibility id={id} family={family} fields={fields} set={set} />
      {submitted && validation.message ? (
        <div className="th-error" role="alert">
          <Icon name="alert" size={14} /> {validation.message}
        </div>
      ) : null}
      <span className="th-hint" style={{ color: 'inherit', opacity: 0.85 }}>
        {validation.ok ? validation.hint ?? (child ? 'Replace keeps this entry’s identity and position.' : 'New entries are appended; save first to make one primary.') : family === 'phone' ? 'Simulated parser: full international numbers, or local numbers with explicit country and area code.' : ''}
      </span>
      <div className="th-card__actions">
        <button className="th-btn th-btn--sm th-btn--filled" onClick={apply}>
          {child ? 'Apply to draft' : 'Add to draft'}
        </button>
        <button className="th-btn th-btn--sm th-btn--text" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function LabelVisibility({ id, family, fields, set }: { id: string; family: Family; fields: ChannelFields; set: <K extends keyof ChannelFields>(k: K, v: ChannelFields[K]) => void }) {
  return (
    <div className="th-form__grid">
      <div className="th-field">
        <label htmlFor={`${id}-label`}>Label</label>
        <input id={`${id}-label`} className="th-input" list={`${id}-labels`} value={fields.location} onChange={(e) => set('location', e.target.value)} />
        <datalist id={`${id}-labels`}>
          {LABEL_SUGGESTIONS[family].map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>
      <label className="th-switch" style={{ alignSelf: 'end', height: 40 }}>
        <input type="checkbox" checked={fields.isPublic} onChange={(e) => set('isPublic', e.target.checked)} /> Public
      </label>
    </div>
  );
}
