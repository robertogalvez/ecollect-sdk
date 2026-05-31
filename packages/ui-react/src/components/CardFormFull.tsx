import React, { useState } from 'react';
import { getMessages, getCvvLength } from '@ecollect/ui-core';
import type { CardFormProps } from '@ecollect/ui-core';
import { useCardForm } from '../hooks/useCardForm.js';
import { CardField } from './shared/CardField.js';
import { BrandAnnouncer } from './shared/BrandAnnouncer.js';
import { CvvTooltip } from './shared/CvvTooltip.js';
import { CardPreview } from './CardPreview.js';
import { injectStyles } from '../styles/inject.js';

injectStyles();

/**
 * CardFormFull — complete card form with 3D animated card preview.
 * Includes all ecollect fields + configurable optional fields.
 * Baymard-compliant layout and labels.
 */
export function CardFormFull({ onSubmit, onError, onSuccess, config = {} }: CardFormProps) {
  const lang = config.language ?? 'es';
  const msgs = getMessages(lang, config.messages);
  const fieldConfig = config.fields ?? {};
  const showPreview = config.showCardPreview !== false;
  const previewPos = config.cardPreviewPosition ?? 'left';
  const showPositive = config.showPositiveValidation !== false;
  const showBrandLogo = config.showBrandLogo !== false;

  const [cvvFocused, setCvvFocused] = useState(false);
  const [formShaking, setFormShaking] = useState(false);

  const {
    fields, errors, touched, brand, isValid, isSubmitting,
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
  const lbl = (f: string, defEs: string, defEn: string) => fv(f)?.label ?? (lang === 'es' ? defEs : defEn);
  const ph = (f: string, def: string) => fv(f)?.placeholder ?? def;

  const brandLogo = showBrandLogo && brand.brand !== 'Unknown' ? (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: brand.color, padding: '2px 8px', borderRadius: 4 }}>
      {brand.brand}
    </span>
  ) : null;

  const formContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

      {/* Expiry + Security Code */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
          onBlur={() => { handleBlur('cvv'); setCvvFocused(false); }}
          error={isTouched('cvv') ? errors.cvv : undefined}
          isValid={isFieldValid('cvv', fields.cvv)}
          showPositiveValidation={showPositive}
          placeholder={brand.brand === 'Amex' ? '1234' : '123'}
          type="tel"
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={getCvvLength(brand.brand)}
          suffix={<CvvTooltip brand={brand.brand} lang={lang} />}
          style={{ onFocus: () => setCvvFocused(true) } as React.CSSProperties}
        />
      </div>

      {/* Cardholder name — optional by default (Baymard best practice) */}
      {fieldConfig.cardHolderName?.show !== false && (
        <CardField
          id="cardHolderName"
          label={lbl('cardHolderName', 'Nombre del titular', 'Cardholder name')}
          value={fields.cardHolderName}
          onChange={(v) => handleChange('cardHolderName', v)}
          onBlur={() => handleBlur('cardHolderName')}
          error={isTouched('cardHolderName') && req('cardHolderName') ? errors.cardHolderName : undefined}
          isValid={isFieldValid('cardHolderName', fields.cardHolderName)}
          showPositiveValidation={showPositive}
          placeholder={ph('cardHolderName', lang === 'es' ? 'Como aparece en la tarjeta' : 'As it appears on the card')}
          autoComplete="cc-name"
          optional={!req('cardHolderName')}
        />
      )}

      {/* Configurable optional fields */}
      {show('email') && (
        <CardField
          id="email"
          label={lbl('email', 'Correo electrónico', 'Email')}
          value={fields.email}
          onChange={(v) => handleChange('email', v)}
          onBlur={() => handleBlur('email')}
          error={isTouched('email') ? errors.email : undefined}
          isValid={isFieldValid('email', fields.email)}
          showPositiveValidation={showPositive}
          placeholder={ph('email', 'correo@ejemplo.com')}
          type="email"
          autoComplete="email"
          optional={!req('email')}
        />
      )}

      {show('cardHolderIdType') && (
        <CardField
          id="cardHolderIdType"
          label={lbl('cardHolderIdType', 'Tipo de documento', 'Document type')}
          value={fields.cardHolderIdType}
          onChange={(v) => handleChange('cardHolderIdType', v)}
          onBlur={() => handleBlur('cardHolderIdType')}
          error={isTouched('cardHolderIdType') ? errors.cardHolderIdType : undefined}
          isValid={isFieldValid('cardHolderIdType', fields.cardHolderIdType)}
          showPositiveValidation={showPositive}
          placeholder={ph('cardHolderIdType', 'CC, DNI, RUT...')}
          optional={!req('cardHolderIdType')}
        />
      )}

      {show('cardHolderId') && (
        <CardField
          id="cardHolderId"
          label={lbl('cardHolderId', 'Número de documento', 'Document number')}
          value={fields.cardHolderId}
          onChange={(v) => handleChange('cardHolderId', v)}
          onBlur={() => handleBlur('cardHolderId')}
          error={isTouched('cardHolderId') ? errors.cardHolderId : undefined}
          isValid={isFieldValid('cardHolderId', fields.cardHolderId)}
          showPositiveValidation={showPositive}
          placeholder={ph('cardHolderId', '123456789')}
          optional={!req('cardHolderId')}
        />
      )}

      {show('mobileNumber') && (
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10 }}>
          <CardField
            id="mobileCountryCode"
            label={lang === 'es' ? 'País' : 'Code'}
            value={fields.mobileCountryCode}
            onChange={(v) => handleChange('mobileCountryCode', v)}
            onBlur={() => handleBlur('mobileCountryCode')}
            placeholder="+57"
            type="tel"
            inputMode="numeric"
            optional
          />
          <CardField
            id="mobileNumber"
            label={lbl('mobileNumber', 'Teléfono móvil', 'Mobile number')}
            value={fields.mobileNumber}
            onChange={(v) => handleChange('mobileNumber', v)}
            onBlur={() => handleBlur('mobileNumber')}
            placeholder="3001234567"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            optional={!req('mobileNumber')}
          />
        </div>
      )}

      {/* Extra fields */}
      {(config.extraFields ?? []).map((def) => (
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

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          ...styles.submitBtn,
          opacity: isSubmitting ? 0.7 : 1,
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          marginTop: 8,
        }}
      >
        {isSubmitting ? (
          <><span style={styles.spinner} /> {msgs.submitting}</>
        ) : submitLabel}
      </button>
    </div>
  );

  const preview = showPreview && previewPos !== 'none' && (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <CardPreview
        cardNumber={fields.cardNumber}
        cardHolderName={fields.cardHolderName}
        expiry={fields.expiry}
        cvv={fields.cvv}
        isFlipped={cvvFocused}
        brand={brand}
      />
    </div>
  );

  return (
    <form
      onSubmit={wrappedSubmit}
      noValidate
      className={formShaking ? 'ecollect-shake' : ''}
      style={{ fontFamily: 'inherit' }}
    >
      <BrandAnnouncer brand={brand.brand} brandDetectedTemplate={msgs.brandDetected} />
      {previewPos === 'top' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {preview}
          {formContent}
        </div>
      ) : previewPos === 'left' ? (
        <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1.2fr' : '1fr', gap: 28, alignItems: 'start' }}>
          {showPreview && <div style={{ position: 'sticky', top: 80 }}>{preview}</div>}
          {formContent}
        </div>
      ) : (
        formContent
      )}
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
