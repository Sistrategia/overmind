// Family field editors shared by the variants. The containers differ (inline row, command
// stack, draft revision); the field semantics do not.
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { ChildFields } from '../core/draft';
import { validateAddress, validateEmail, validateExtension, validateLabel, validateUrl } from '../core/engine';
import type { AddressInput, Family, PhoneInput, WebLinkValue } from '../core/model';
import { ADDRESS_FIELD_LABEL } from '../core/model';
import { formatPhone, parsePhone, PHONE_PARSER_ID } from '../core/phone';
import { Badge } from './ui';

export const LABEL_SUGGESTIONS = ['Work', 'Personal', 'Office', 'Mobile', 'Home', 'Billing', 'Assistant'];

export function emptyFields(family: Family): ChildFields {
  switch (family) {
    case 'email': return { value: '', location: null, isPublic: false, extension: null };
    case 'phone': return { value: { number: '' }, location: null, isPublic: false, extension: null };
    case 'web_link': return { value: { url: '', type: null, displayText: null }, location: null, isPublic: false, extension: null };
    case 'address': return { value: { country: 'México' }, location: null, isPublic: false, extension: null };
  }
}

export function validateFields(family: Family, f: ChildFields): Record<string, string> {
  const errors: Record<string, string> = {};
  const label = validateLabel(f.location);
  if (label) errors.location = label;
  switch (family) {
    case 'email': { const e = validateEmail(f.value); if (e) errors.value = e; break; }
    case 'phone': { const p = parsePhone(f.value as PhoneInput); if (!p.ok) errors.value = p.error; const x = validateExtension(f.extension); if (x) errors.extension = x; break; }
    case 'web_link': { const e = validateUrl(f.value); if (e) errors.value = e; break; }
    case 'address': { const e = validateAddress(f.value as AddressInput); if (e) errors.value = e; break; }
  }
  return errors;
}

// ---- Phone ------------------------------------------------------------------------------

export function PhoneInterpretation({ input, compact = false }: { input: PhoneInput; compact?: boolean }) {
  const parsed = useMemo(() => parsePhone(input), [input]);
  if (!input.number.trim()) return <p className="field-hint">Enter a number to see how it is read.</p>;
  if (!parsed.ok) return <p className="field-error" role="alert">{parsed.error}</p>;
  const v = parsed.value;
  return (
    <div className="phone-interp small" data-testid="phone-interpretation">
      <div className="row wrap">
        <Badge tone="ok">Reads as</Badge>
        <span className="mono strong">{v.e164}</span>
        <span className="muted">shown as {formatPhone(v)}</span>
      </div>
      {!compact && (
        <ul className="muted" style={{ marginTop: 4 }}>
          <li>Calling code +{v.callingCode}, national number {v.nationalNumber}{v.numberingRegion ? `, numbering plan ${v.numberingRegion}` : ''}.</li>
          {parsed.notes.map((n, i) => <li key={i}>{n}</li>)}
          <li className="faint">Parser: {PHONE_PARSER_ID}. Simulated locally.</li>
        </ul>
      )}
    </div>
  );
}

export function PhoneValueFields({ value, onChange, error, autoFocus }: { value: PhoneInput; onChange: (v: PhoneInput) => void; error?: string; autoFocus?: boolean }) {
  const [mode, setMode] = useState<'intl' | 'mx'>(value.areaCode || value.defaultRegion === 'MX' ? 'mx' : 'intl');
  const id = useId();
  useEffect(() => { if (mode === 'intl' && value.defaultRegion) onChange({ number: value.number }); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row wrap" role="radiogroup" aria-label="Number format">
        <label className="check"><input type="radio" name={`${id}-mode`} checked={mode === 'intl'} onChange={() => { setMode('intl'); onChange({ number: value.number }); }} /> International (+52 …)</label>
        <label className="check"><input type="radio" name={`${id}-mode`} checked={mode === 'mx'} onChange={() => { setMode('mx'); onChange({ number: value.number.replace(/^\+52\s?/, ''), defaultRegion: 'MX', areaCode: value.areaCode ?? '' }); }} /> Mexico local (area + number)</label>
      </div>
      {mode === 'intl' ? (
        <div className="field">
          <label htmlFor={`${id}-num`}>Number</label>
          <input id={`${id}-num`} className="input mono" value={value.number} onChange={e => onChange({ number: e.target.value })} placeholder="+52 777 312 3456" autoFocus={autoFocus} aria-invalid={!!error} data-testid="phone-number" inputMode="tel" />
        </div>
      ) : (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 90 }}>
            <label htmlFor={`${id}-area`}>Area (LADA)</label>
            <input id={`${id}-area`} className="input mono" value={value.areaCode ?? ''} onChange={e => onChange({ ...value, defaultRegion: 'MX', areaCode: e.target.value })} placeholder="777" inputMode="numeric" data-testid="phone-area" />
          </div>
          <div className="field grow">
            <label htmlFor={`${id}-local`}>Local number</label>
            <input id={`${id}-local`} className="input mono" value={value.number} onChange={e => onChange({ ...value, defaultRegion: 'MX', number: e.target.value })} placeholder="312 3456" inputMode="tel" autoFocus={autoFocus} aria-invalid={!!error} data-testid="phone-number" />
          </div>
        </div>
      )}
      {mode === 'mx' && <p className="field-hint">Country context MX is explicit; nothing is inferred from the contact's address.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

// ---- Address ------------------------------------------------------------------------------

const ADDRESS_GRID: { key: keyof AddressInput; span?: number }[] = [
  { key: 'streetName', span: 2 }, { key: 'extNumber' }, { key: 'intNumber' },
  { key: 'colony', span: 2 }, { key: 'zipCode' }, { key: 'city' },
  { key: 'state', span: 2 }, { key: 'country', span: 2 }, { key: 'references', span: 4 }
];

export function AddressValueFields({ value, onChange, error }: { value: AddressInput; onChange: (v: AddressInput) => void; error?: string }) {
  const id = useId();
  const [lines, setLines] = useState(!!(value.address1 || value.address2));
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row wrap small">
        <label className="check"><input type="checkbox" checked={lines} onChange={e => { const on = e.target.checked; setLines(on); const next = { ...value }; if (on) { delete next.streetName; delete next.extNumber; delete next.intNumber; } else { delete next.address1; delete next.address2; } onChange(next); }} /> Use free address lines instead of street fields</label>
      </div>
      <div className="addr-grid">
        {lines && (<>
          <div className="field" style={{ gridColumn: 'span 4' }}><label htmlFor={`${id}-a1`}>Line 1</label><input id={`${id}-a1`} className="input" value={value.address1 ?? ''} onChange={e => onChange({ ...value, address1: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: 'span 4' }}><label htmlFor={`${id}-a2`}>Line 2</label><input id={`${id}-a2`} className="input" value={value.address2 ?? ''} onChange={e => onChange({ ...value, address2: e.target.value })} /></div>
        </>)}
        {ADDRESS_GRID.filter(f => lines ? !['streetName', 'extNumber', 'intNumber'].includes(f.key) : true).map(f => (
          <div className="field" key={f.key} style={{ gridColumn: `span ${f.span ?? 1}` }}>
            <label htmlFor={`${id}-${f.key}`}>{ADDRESS_FIELD_LABEL[f.key]}</label>
            <input id={`${id}-${f.key}`} className="input" value={value[f.key] ?? ''} onChange={e => onChange({ ...value, [f.key]: e.target.value })} data-testid={`address-${f.key}`} />
          </div>
        ))}
      </div>
      <p className="field-hint">A correction selects or creates a new shared address value for this contact only; other contacts and earlier revisions keep the old one.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

// ---- Generic child form --------------------------------------------------------------------

export interface ChildFormProps {
  family: Family;
  initial: ChildFields | null;
  onSubmit: (fields: ChildFields) => void;
  onCancel: () => void;
  submitLabel?: string;
  extra?: ReactNode;
  readOnly?: boolean;
  compact?: boolean;
}

export function ChildForm({ family, initial, onSubmit, onCancel, submitLabel = 'Stage change', extra, readOnly, compact }: ChildFormProps) {
  const [fields, setFields] = useState<ChildFields>(initial ?? emptyFields(family));
  const [touched, setTouched] = useState(false);
  const id = useId();
  const errors = useMemo(() => validateFields(family, fields), [family, fields]);
  const showErrors = touched;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    onSubmit({ ...fields, location: fields.location?.trim() ? fields.location.trim() : null, extension: fields.extension?.trim() ? fields.extension.trim() : null });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <form className={`child-form ${compact ? 'compact' : ''}`} onSubmit={submit} noValidate data-testid={`child-form-${family}`}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {family === 'email' && (
          <div className="field">
            <label htmlFor={`${id}-email`}>Email address</label>
            <input id={`${id}-email`} type="email" className="input mono" value={fields.value as string} onChange={e => setFields({ ...fields, value: e.target.value })} autoFocus aria-invalid={showErrors && !!errors.value} placeholder="name@example.mx" data-testid="email-value" />
            {showErrors && errors.value && <p className="field-error" role="alert">{errors.value}</p>}
          </div>
        )}
        {family === 'phone' && (<>
          <PhoneValueFields value={fields.value as PhoneInput} onChange={v => setFields({ ...fields, value: v })} error={showErrors ? errors.value : undefined} autoFocus />
          <PhoneInterpretation input={fields.value as PhoneInput} compact={compact} />
        </>)}
        {family === 'web_link' && (<>
          <div className="field">
            <label htmlFor={`${id}-url`}>URL</label>
            <input id={`${id}-url`} className="input mono" value={(fields.value as WebLinkValue).url} onChange={e => setFields({ ...fields, value: { ...(fields.value as WebLinkValue), url: e.target.value } })} autoFocus aria-invalid={showErrors && !!errors.value} placeholder="https://" data-testid="link-url" />
            {showErrors && errors.value && <p className="field-error" role="alert">{errors.value}</p>}
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field grow"><label htmlFor={`${id}-lt`}>Type</label><input id={`${id}-lt`} className="input" value={(fields.value as WebLinkValue).type ?? ''} onChange={e => setFields({ ...fields, value: { ...(fields.value as WebLinkValue), type: e.target.value || null } })} placeholder="website" /></div>
            <div className="field grow"><label htmlFor={`${id}-ld`}>Display text</label><input id={`${id}-ld`} className="input" value={(fields.value as WebLinkValue).displayText ?? ''} onChange={e => setFields({ ...fields, value: { ...(fields.value as WebLinkValue), displayText: e.target.value || null } })} /></div>
          </div>
        </>)}
        {family === 'address' && <AddressValueFields value={fields.value as AddressInput} onChange={v => setFields({ ...fields, value: v })} error={showErrors ? errors.value : undefined} />}

        <div className="row wrap" style={{ alignItems: 'flex-end', marginTop: 8 }}>
          <div className="field" style={{ width: 150 }}>
            <label htmlFor={`${id}-label`}>Label</label>
            <input id={`${id}-label`} className="input" list={`${id}-labels`} value={fields.location ?? ''} onChange={e => setFields({ ...fields, location: e.target.value })} placeholder="Work, Personal…" aria-invalid={showErrors && !!errors.location} data-testid="child-label" />
            <datalist id={`${id}-labels`}>{LABEL_SUGGESTIONS.map(l => <option key={l} value={l} />)}</datalist>
          </div>
          {family === 'phone' && (
            <div className="field" style={{ width: 110 }}>
              <label htmlFor={`${id}-ext`}>Extension</label>
              <input id={`${id}-ext`} className="input mono" value={fields.extension ?? ''} onChange={e => setFields({ ...fields, extension: e.target.value })} inputMode="numeric" placeholder="—" aria-invalid={showErrors && !!errors.extension} data-testid="child-extension" />
            </div>
          )}
          <label className="check" style={{ height: 30 }}>
            <input type="checkbox" checked={fields.isPublic} onChange={e => setFields({ ...fields, isPublic: e.target.checked })} data-testid="child-public" /> Public in directory
          </label>
        </div>
        {showErrors && (errors.location || errors.extension) && <p className="field-error" role="alert">{errors.location ?? errors.extension}</p>}
        {extra}
      </fieldset>
      <div className="row wrap" style={{ marginTop: 10 }}>
        {!readOnly && <button type="submit" className="btn primary" data-testid="child-submit">{submitLabel}</button>}
        <button type="button" className="btn" onClick={onCancel} data-testid="child-cancel">{readOnly ? 'Close' : 'Cancel'}</button>
        <span className="field-hint">Staged changes are saved together, in one revision.</span>
      </div>
    </form>
  );
}
