import React, { useState } from 'react';
import { getMessages, getCvvLength } from '@ecollect/ui-core';
import type { CardFormProps } from '@ecollect/ui-core';
import { useCardForm } from '../hooks/useCardForm.js';
import { BrandAnnouncer } from './shared/BrandAnnouncer.js';
import { CvvTooltip } from './shared/CvvTooltip.js';
import { CardPreview } from './CardPreview.js';
import { injectStyles } from '../styles/inject.js';

injectStyles();

/**
 * CardFormDark — glassmorphism dark theme with glow effects.
 * All fields same as CardFormFull. Contrast ≥ 4.5:1 for WCAG AA.
 */
export function CardFormDark({ onSubmit, onError, onSuccess, config = {} }: CardFormProps) {
  const lang = config.language ?? 'es';
  const msgs = getMessages(lang, config.messages);
  const fieldConfig = config.fields ?? {};
  const showPreview = config.showCardPreview !== false;
  const showPositive = config.showPositiveValidation !== false;

  const [cvvFocused, setCvvFocused] = useState(false);
  const [formShaking, setFormShaking] = useState(false);

  const {
    fields, errors, touched, brand, isSubmitting,
    handleChange, handleBlur, handleKeyDown, handlePaste, handleSubmit,
    extraValues, handleExtraChange,
  } = useCardForm({ onSubmit, onError, onSuccess, config });

  const isTouched = (f: string) => touched.has(f);
  const isFieldValid = (f: string, value: string) => isTouched(f) && !errors[f] && value.length > 0;

  const wrappedSubmit = (e: React.FormEvent) => {
    handleSubmit(e);
    if (Object.keys(errors).length > 0 && config.animateErrors !== false) {
      setFormShaking(true);
      setTimeout(() => setFormShaking(false), 500);
    }
  };

  const submitLabel = config.submitLabel ?? (lang === 'es' ? 'Tokenizar tarjeta' : 'Tokenize card');

  const fv = (f: string) => fieldConfig[f as keyof typeof fieldConfig];
  const show = (f: string) => fv(f)?.show === true;
  const req = (f: string) => fv(f)?.required === true;

  const DarkField = ({
    id, label, value, onChange, onBlur: onBlurProp, onKeyDown: onKeyDownProp, onPaste: onPasteProp,
    error, placeholder, type = 'text', inputMode, autoComplete, maxLength, optional, suffix,
  }: {
    id: string; label: string; value: string; onChange: (v: string) => void;
    onBlur?: () => void; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
    error?: string; placeholder?: string; type?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    autoComplete?: string; maxLength?: number; optional?: boolean;
    suffix?: React.ReactNode;
  }) => {
    const valid = isFieldValid(id, value);
    const hasErr = Boolean(error);
    const errorId = `dark-${id}-error`;
    const glowColor = hasErr ? '#ef4444' : valid ? '#10b981' : brand.color;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`dark-${id}`} style={darkStyles.label}>
          {label}
          {optional && <span style={darkStyles.optional}> (opcional)</span>}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id={`dark-${id}`}
            type={type}
            inputMode={inputMode}
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlurProp}
            onKeyDown={onKeyDownProp}
            onPaste={onPasteProp}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-invalid={hasErr}
            aria-describedby={hasErr ? errorId : undefined}
            style={{
              ...darkStyles.input,
              borderColor: hasErr ? '#ef4444' : valid ? '#10b981' : 'rgba(255,255,255,.15)',
              boxShadow: (hasErr || valid || id === 'cvv' && cvvFocused)
                ? `0 0 0 3px ${glowColor}33, 0 0 12px ${glowColor}22`
                : undefined,
              paddingRight: suffix || hasErr || valid ? 40 : 14,
            }}
          />
          {(valid || hasErr) && (
            <span aria-hidden="true" style={{ position: 'absolute', right: suffix ? 40 : 12, top: '50%', transform: 'translateY(-50%)', color: valid ? '#10b981' : '#ef4444' }}>
              {valid ? '✓' : '✕'}
            </span>
          )}
          {suffix && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
              {suffix}
            </div>
          )}
        </div>
        {hasErr && (
          <span id={errorId} role="alert" style={darkStyles.errorMsg}>{error}</span>
        )}
      </div>
    );
  };

  const formFields = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DarkField id="cardNumber" label={lang === 'es' ? 'Número de tarjeta' : 'Card number'}
        value={fields.cardNumber} onChange={(v) => handleChange('cardNumber', v)}
        onBlur={() => handleBlur('cardNumber')} onKeyDown={(e) => handleKeyDown('cardNumber', e)} onPaste={handlePaste}
        error={isTouched('cardNumber') ? errors.cardNumber : undefined}
        placeholder="1234 5678 9012 3456" type="tel" inputMode="numeric" autoComplete="cc-number" maxLength={23}
        suffix={brand.brand !== 'Unknown' && config.showBrandLogo !== false ? (
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: brand.color, background: `${brand.color}22`, padding: '2px 6px', borderRadius: 4, border: `1px solid ${brand.color}44` }}>{brand.brand}</span>
        ) : null}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <DarkField id="expiry" label={lang === 'es' ? 'Vencimiento' : 'Expiry'}
          value={fields.expiry} onChange={(v) => handleChange('expiry', v)} onBlur={() => handleBlur('expiry')}
          error={isTouched('expiry') ? errors.expiry : undefined}
          placeholder="MM / YY" type="tel" inputMode="numeric" autoComplete="cc-exp" maxLength={7}
        />
        <DarkField id="cvv" label={lang === 'es' ? 'Código de seguridad' : 'Security Code'}
          value={fields.cvv} onChange={(v) => handleChange('cvv', v)}
          onBlur={() => { handleBlur('cvv'); setCvvFocused(false); }}
          error={isTouched('cvv') ? errors.cvv : undefined}
          placeholder={brand.brand === 'Amex' ? '1234' : '123'} type="tel" inputMode="numeric"
          autoComplete="cc-csc" maxLength={getCvvLength(brand.brand)}
          suffix={<CvvTooltip brand={brand.brand} lang={lang} />}
        />
      </div>

      {fieldConfig.cardHolderName?.show !== false && (
        <DarkField id="cardHolderName" label={lang === 'es' ? 'Nombre del titular' : 'Cardholder name'}
          value={fields.cardHolderName} onChange={(v) => handleChange('cardHolderName', v)}
          onBlur={() => handleBlur('cardHolderName')}
          error={isTouched('cardHolderName') && req('cardHolderName') ? errors.cardHolderName : undefined}
          placeholder={lang === 'es' ? 'Como aparece en la tarjeta' : 'As it appears on the card'}
          autoComplete="cc-name" optional={!req('cardHolderName')}
        />
      )}

      {show('email') && (
        <DarkField id="email" label={lang === 'es' ? 'Correo electrónico' : 'Email'}
          value={fields.email} onChange={(v) => handleChange('email', v)} onBlur={() => handleBlur('email')}
          error={isTouched('email') ? errors.email : undefined}
          placeholder="correo@ejemplo.com" type="email" autoComplete="email" optional={!req('email')}
        />
      )}

      {show('cardHolderId') && (
        <DarkField id="cardHolderId" label={lang === 'es' ? 'Número de documento' : 'Document number'}
          value={fields.cardHolderId} onChange={(v) => handleChange('cardHolderId', v)} onBlur={() => handleBlur('cardHolderId')}
          error={isTouched('cardHolderId') ? errors.cardHolderId : undefined}
          placeholder="123456789" optional={!req('cardHolderId')}
        />
      )}

      {(config.extraFields ?? []).map((def) => (
        <DarkField key={def.name} id={def.name} label={def.label}
          value={extraValues[def.name] ?? ''} onChange={(v) => handleExtraChange(def.name, v)}
          onBlur={() => handleBlur(def.name)}
          error={isTouched(def.name) ? errors[def.name] : undefined}
          placeholder={def.placeholder} optional={!def.required}
        />
      ))}

      <button type="submit" disabled={isSubmitting} style={{ ...darkStyles.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}>
        {isSubmitting ? <><span style={darkStyles.spinner} /> {msgs.submitting}</> : submitLabel}
      </button>
    </div>
  );

  return (
    <div style={darkStyles.wrapper}>
      <form onSubmit={wrappedSubmit} noValidate className={formShaking ? 'ecollect-shake' : ''} style={{ fontFamily: 'inherit' }}>
        <BrandAnnouncer brand={brand.brand} brandDetectedTemplate={msgs.brandDetected} />
        {showPreview ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 28, alignItems: 'start' }}>
            <div style={{ position: 'sticky', top: 80 }}>
              <CardPreview cardNumber={fields.cardNumber} cardHolderName={fields.cardHolderName}
                expiry={fields.expiry} cvv={fields.cvv} isFlipped={cvvFocused} brand={brand} />
            </div>
            {formFields}
          </div>
        ) : formFields}
      </form>
    </div>
  );
}

const darkStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: 'linear-gradient(135deg, rgba(15,23,42,.95), rgba(30,41,59,.98))',
    backdropFilter: 'blur(20px)',
    borderRadius: 20,
    padding: 32,
    border: '1px solid rgba(255,255,255,.1)',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,.7)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  optional: {
    fontWeight: 400,
    textTransform: 'none' as const,
    color: 'rgba(255,255,255,.4)',
    fontSize: '0.68rem',
  },
  input: {
    padding: '12px 14px',
    border: '1.5px solid rgba(255,255,255,.15)',
    borderRadius: 10,
    fontSize: '0.95rem',
    color: '#f8fafc',
    background: 'rgba(255,255,255,.07)',
    transition: 'border-color .2s, box-shadow .2s',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  errorMsg: {
    color: '#f87171',
    fontSize: '0.78rem',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  submitBtn: {
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 8,
    boxShadow: '0 4px 20px rgba(99,102,241,.4)',
  },
  spinner: {
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'ecollect-spin 0.7s linear infinite',
  },
};
