import React, { useState } from 'react';
import type { CardBrand } from '@ecollect/ui-core';

interface CvvTooltipProps {
  brand: CardBrand;
  lang?: 'en' | 'es';
}

export function CvvTooltip({ brand, lang = 'es' }: CvvTooltipProps) {
  const [open, setOpen] = useState(false);
  const isAmex = brand === 'Amex';

  const label = lang === 'es' ? '¿Dónde está mi código?' : 'Where is my code?';
  const title = lang === 'es' ? 'Código de seguridad' : 'Security Code';
  const description = isAmex
    ? lang === 'es'
      ? 'American Express: 4 dígitos en el frente de la tarjeta, arriba del número.'
      : 'American Express: 4 digits on the front of your card, above the number.'
    : lang === 'es'
    ? 'Visa / Mastercard / Discover: 3 dígitos en el reverso de la tarjeta, junto a la firma.'
    : 'Visa / Mastercard / Discover: 3 digits on the back of your card, near the signature strip.';

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        style={styles.button}
      >
        ?
      </button>
      {open && (
        <>
          <div
            style={styles.overlay}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div role="tooltip" style={styles.popover}>
            <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>
              {title}
            </strong>
            {/* Visual diagram */}
            <div style={styles.cardDiagram}>
              {isAmex ? (
                <AmexDiagram />
              ) : (
                <StandardDiagram />
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '8px 0 0', lineHeight: 1.5 }}>
              {description}
            </p>
            <button type="button" onClick={() => setOpen(false)} style={styles.closeBtn}>
              ✕
            </button>
          </div>
        </>
      )}
    </span>
  );
}

function StandardDiagram() {
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px 16px', color: '#fff', position: 'relative' }}>
      <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 4 }}>REVERSO / BACK</div>
      <div style={{ background: '#0f172a', height: 28, borderRadius: 3, marginBottom: 8 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>CVV</div>
        <div style={{ background: '#fff', color: '#1a202c', padding: '4px 10px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 0 0 2px #6366f1' }}>
          123
        </div>
      </div>
    </div>
  );
}

function AmexDiagram() {
  return (
    <div style={{ background: 'linear-gradient(135deg, #007bc1, #004a8f)', borderRadius: 8, padding: '12px 16px', color: '#fff', position: 'relative' }}>
      <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 4 }}>FRENTE / FRONT</div>
      <div style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '0.75rem', marginBottom: 8 }}>
        3782 822463 10005
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <div style={{ background: '#fff', color: '#1a202c', padding: '4px 10px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 0 0 2px #fbbf24' }}>
          1234
        </div>
        <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>CID</div>
      </div>
    </div>
  );
}

const styles = {
  button: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '1.5px solid #94a3b8',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  } as React.CSSProperties,
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 999,
  },
  popover: {
    position: 'absolute' as const,
    bottom: 'calc(100% + 8px)',
    right: 0,
    zIndex: 1000,
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 12,
    padding: 16,
    width: 240,
    boxShadow: '0 8px 32px rgba(0,0,0,.12)',
  },
  cardDiagram: {
    marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute' as const,
    top: 8,
    right: 10,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: '0.75rem',
    padding: 2,
  },
};
