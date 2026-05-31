import React from 'react';
import { getMessages, getCvvLength } from '@ecollect/ui-core';
import type { CardFormProps } from '@ecollect/ui-core';
import { useCardForm } from '../hooks/useCardForm.js';
import { CardField } from './shared/CardField.js';
import { BrandAnnouncer } from './shared/BrandAnnouncer.js';
import { CvvTooltip } from './shared/CvvTooltip.js';
import { injectStyles } from '../styles/inject.js';

injectStyles();

/**
 * CardFormMinimal — lightweight card form without card preview.
 * Fields: card number, expiry, security code, (optional) cardholder name.
 * Baymard-compliant: correct field order, MM/YY format, "Security Code" label.
 */
export function CardFormMinimal({ onSubmit, onError, onSuccess, config = {} }: CardFormProps) {
  const lang = config.language ?? 'es';
  const msgs = getMessages(lang, config.messages);
  const fieldConfig = config.fields ?? {};
  const showPositive = config.showPositiveValidation !== false;

  const {
    fields, errors, touched, brand, isValid, isSubmitting,
    handleChange, handleBlur, handleKeyDown, handlePaste, handleSubmit,
    extraValues, handleExtraChange,
  } = useCardForm({ onSubmit, onError, onSuccess, config });

  const isTouched = (f: string) => touched.has(f);
  const isFieldValid = (f: string, value: string) => isTouched(f) && !errors[f] && value.length > 0;

  const showNameField = fieldConfig.cardHolderName?.show !== false;
  const nameRequired = fieldConfig.cardHolderName?.required === true;

  const submitLabel = config.submitLabel ?? (lang === 'es' ? 'Tokenizar tarjeta' : 'Tokenize card');

  const extraBefore = (config.extraFields ?? []).filter((f) => f.position === 'before-card-fields');
  const extraAfter = (config.extraFields ?? []).filter((f) => f.position !== 'before-card-fields' && f.position !== 'after-name');
  const extraAfterName = (config.extraFields ?? []).filter((f) => f.position === 'after-name');

  const brandLogo = config.showBrandLogo !== false && brand.brand !== 'Unknown' ? (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: brand.color, padding: '2px 8px', borderRadius: 4 }}>
      {brand.brand}
    </span>
  ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate style={styles.form}>
      <BrandAnnouncer brand={brand.brand} brandDetectedTemplate={msgs.brandDetected} />

      {extraBefore.map((def) => (
        <CardField
          key={def.name}
          id={def.name}
          label={def.label}
          value={extraValues[def.name] ?? ''}
          onChange={(v) => handleExtraChange(def.name, v)}
          onBlur={() => handleBlur(def.name)}
          error={isTouched(def.name) ? errors[def.name] : undefined}
          isValid={isFieldValid(def.name, extraValues[def.name] ?? '')}
          showPositiveValidation={showPositive}
          placeholder={def.placeholder}
          optional={!def.required}
        />
      ))}

      {/* Card number */}
      <CardField
        id="cardNumber"
        label={lang === 'es' ? 'Número de tarjeta' : 'Card number'}
        value={fields.cardNumber}
        onChange={(v) => handleChange('cardNumber', v)}
        onBlur={() => handleBlur('cardNumber')}
        onKeyDown={(e) => handleKeyDown('cardNumber', e)}
        onPaste={handlePaste}
        error={isTouched('cardNumber') ? errors.cardNumber : undefined}
        isValid={isFieldValid('cardNumber', fields.cardNumber)}
        showPositiveValidation={showPositive}
        placeholder="1234 5678 9012 3456"
        type="tel"
        inputMode="numeric"
        autoComplete="cc-number"
        maxLength={23}
        suffix={brandLogo}
      />

      {/* Expiry + Security Code in a row */}
      <div style={styles.fieldRow}>
        <CardField
          id="expiry"
          label={lang === 'es' ? 'Vencimiento' : 'Expiry'}
          value={fields.expiry}
          onChange={(v) => handleChange('expiry', v)}
          onBlur={() => handleBlur('expiry')}
          error={isTouched('expiry') ? errors.expiry : undefined}
          isValid={isFieldValid('expiry', fields.expiry)}
          showPositiveValidation={showPositive}
          placeholder="MM / YY"
          type="tel"
          inputMode="numeric"
          autoComplete="cc-exp"
          maxLength={7}
        />
        <CardField
          id="cvv"
          label={lang === 'es' ? 'Código de seguridad' : 'Security Code'}
          value={fields.cvv}
          onChange={(v) => handleChange('cvv', v)}
          onBlur={() => handleBlur('cvv')}
          error={isTouched('cvv') ? errors.cvv : undefined}
          isValid={isFieldValid('cvv', fields.cvv)}
          showPositiveValidation={showPositive}
          placeholder={brand.brand === 'Amex' ? '1234' : '123'}
          type="tel"
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={getCvvLength(brand.brand)}
          suffix={<CvvTooltip brand={brand.brand} lang={lang} />}
        />
      </div>

      {/* Cardholder name */}
      {showNameField && (
        <CardField
          id="cardHolderName"
          label={fieldConfig.cardHolderName?.label ?? (lang === 'es' ? 'Nombre del titular' : 'Cardholder name')}
          value={fields.cardHolderName}
          onChange={(v) => handleChange('cardHolderName', v)}
          onBlur={() => handleBlur('cardHolderName')}
          error={isTouched('cardHolderName') && nameRequired ? errors.cardHolderName : undefined}
          isValid={isFieldValid('cardHolderName', fields.cardHolderName)}
          showPositiveValidation={showPositive}
          placeholder={fieldConfig.cardHolderName?.placeholder ?? (lang === 'es' ? 'Como aparece en la tarjeta' : 'As it appears on the card')}
          autoComplete="cc-name"
          optional={!nameRequired}
        />
      )}

      {extraAfterName.map((def) => (
        <CardField key={def.name} id={def.name} label={def.label} value={extraValues[def.name] ?? ''}
          onChange={(v) => handleExtraChange(def.name, v)} onBlur={() => handleBlur(def.name)}
          error={isTouched(def.name) ? errors[def.name] : undefined}
          isValid={isFieldValid(def.name, extraValues[def.name] ?? '')}
          showPositiveValidation={showPositive} placeholder={def.placeholder} optional={!def.required} />
      ))}

      {extraAfter.map((def) => (
        <CardField key={def.name} id={def.name} label={def.label} value={extraValues[def.name] ?? ''}
          onChange={(v) => handleExtraChange(def.name, v)} onBlur={() => handleBlur(def.name)}
          error={isTouched(def.name) ? errors[def.name] : undefined}
          isValid={isFieldValid(def.name, extraValues[def.name] ?? '')}
          showPositiveValidation={showPositive} placeholder={def.placeholder} optional={!def.required} />
      ))}

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          ...styles.submitBtn,
          opacity: isSubmitting ? 0.7 : 1,
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
        }}
      >
        {isSubmitting ? (
          <><span style={styles.spinner} /> {msgs.submitting}</>
        ) : submitLabel}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    fontFamily: 'inherit',
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
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
    marginTop: 8,
    width: '100%',
    transition: 'all .2s',
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
