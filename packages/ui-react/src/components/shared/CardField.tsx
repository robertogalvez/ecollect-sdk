import React from 'react';

export interface CardFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  error?: string;
  isValid?: boolean;
  showPositiveValidation?: boolean;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  maxLength?: number;
  optional?: boolean;
  disabled?: boolean;
  suffix?: React.ReactNode;
  style?: React.CSSProperties;
}

export function CardField({
  id,
  label,
  value,
  onChange,
  onBlur,
  onKeyDown,
  onPaste,
  error,
  isValid,
  showPositiveValidation = true,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  maxLength,
  optional,
  disabled,
  suffix,
  style,
}: CardFieldProps) {
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  const showSuccess = showPositiveValidation && isValid && !hasError && value.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label htmlFor={id} style={styles.label}>
        {label}
        {optional && <span style={styles.optionalBadge}> (opcional)</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          style={{
            ...styles.input,
            borderColor: hasError ? '#ef4444' : showSuccess ? '#10b981' : '#e2e8f0',
            boxShadow: hasError
              ? '0 0 0 3px rgba(239,68,68,.12)'
              : showSuccess
              ? '0 0 0 3px rgba(16,185,129,.12)'
              : undefined,
            paddingRight: suffix || hasError || showSuccess ? 40 : 14,
          }}
        />
        {/* Success checkmark or error icon */}
        {(showSuccess || hasError) && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: suffix ? 44 : 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '1rem',
              pointerEvents: 'none',
            }}
          >
            {showSuccess ? '✓' : '✕'}
          </span>
        )}
        {suffix && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
            {suffix}
          </div>
        )}
      </div>
      {hasError && (
        <span id={errorId} role="alert" style={styles.errorMsg}>
          {error}
        </span>
      )}
    </div>
  );
}

const styles = {
  label: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  optionalBadge: {
    fontWeight: 400,
    textTransform: 'none' as const,
    color: '#94a3b8',
    fontSize: '0.72rem',
  },
  input: {
    padding: '11px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    fontSize: '0.95rem',
    color: '#1a202c',
    background: '#fff',
    transition: 'border-color .2s, box-shadow .2s',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  errorMsg: {
    color: '#ef4444',
    fontSize: '0.78rem',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
};
