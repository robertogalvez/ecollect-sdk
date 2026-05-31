import React from 'react';
import type { BrandInfo } from '@ecollect/ui-core';

interface CardPreviewProps {
  cardNumber: string;       // raw digits
  cardHolderName: string;
  expiry: string;           // MM / YY display
  cvvLength: number;        // only the count — never the raw CVV digits
  isFlipped: boolean;       // true when CVV field is focused
  brand: BrandInfo;
}

export function CardPreview({ cardNumber, cardHolderName, expiry, cvvLength, isFlipped, brand }: CardPreviewProps) {
  // Show only last 4 digits after Luhn passes; mask the rest
  const digits = cardNumber.replace(/\D/g, '');
  const displayNumber = maskCardNumber(digits, brand.spacing);
  const holderDisplay = cardHolderName.trim() || '•••• ••••';
  const expiryDisplay = expiry.trim() || 'MM / YY';

  return (
    <div style={styles.perspective}>
      <div style={{ ...styles.card, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transformStyle: 'preserve-3d', transition: 'transform 0.6s ease', position: 'relative', width: '100%', height: '100%' }}>
        {/* Front */}
        <div style={{ ...styles.face, ...styles.front, background: brand.color ? getBrandGradient(brand.color) : 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          <div style={styles.chip}>
            <div style={styles.chipLines} />
          </div>
          <div style={styles.number}>{displayNumber}</div>
          <div style={styles.bottomRow}>
            <div>
              <div style={styles.cardLabel}>Titular / Cardholder</div>
              <div style={styles.cardValue}>{holderDisplay.toUpperCase().slice(0, 26)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={styles.cardLabel}>Vence / Expires</div>
              <div style={styles.cardValue}>{expiryDisplay}</div>
            </div>
            <div style={styles.brandName}>{brand.brand !== 'Unknown' ? brand.brand.toUpperCase() : ''}</div>
          </div>
        </div>

        {/* Back */}
        <div style={{ ...styles.face, ...styles.back }}>
          <div style={styles.stripe} />
          <div style={styles.cvvArea}>
            <div style={styles.cardLabel}>Código de seguridad / Security Code</div>
            <div style={styles.cvvBox}>{'•'.repeat(cvvLength || 3)}</div>
          </div>
          <div style={{ ...styles.cardLabel, textAlign: 'center', marginTop: 'auto', opacity: 0.5 }}>
            {brand.brand !== 'Unknown' ? brand.brand : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

function maskCardNumber(digits: string, spacing: number[]): string {
  const maxLen = spacing.reduce((a, b) => a + b, 0);
  const padded = digits.slice(0, maxLen).padEnd(maxLen, '•');
  const groups: string[] = [];
  let pos = 0;
  for (const size of spacing) {
    groups.push(padded.slice(pos, pos + size));
    pos += size;
  }
  // Mask all but last group
  const lastGroup = groups.length - 1;
  return groups.map((g, i) => i === lastGroup ? g : g.replace(/\d/g, '•')).join(' ');
}

function getBrandGradient(color: string): string {
  return `linear-gradient(135deg, ${color}, ${darken(color, 20)})`;
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles: Record<string, React.CSSProperties> = {
  perspective: {
    perspective: 1000,
    width: '100%',
    aspectRatio: '1.586',
  },
  card: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  face: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    padding: 24,
    backfaceVisibility: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,.3)',
    color: '#fff',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  },
  front: {
    justifyContent: 'space-between',
  },
  back: {
    background: '#1e293b',
    transform: 'rotateY(180deg)',
    justifyContent: 'flex-start',
    gap: 16,
  },
  chip: {
    width: 44,
    height: 34,
    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  chipLines: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,0,0,.15) 6px, rgba(0,0,0,.15) 7px)',
  },
  number: {
    fontSize: '1.2rem',
    letterSpacing: '0.15em',
    fontFamily: "'Courier New', monospace",
    textShadow: '0 1px 2px rgba(0,0,0,.4)',
  },
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardLabel: {
    fontSize: '0.55rem',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: '0.8rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  brandName: {
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    opacity: 0.9,
    alignSelf: 'flex-end',
  },
  stripe: {
    height: 44,
    background: '#0f172a',
    margin: '0 -24px',
  },
  cvvArea: {
    padding: '0 8px',
  },
  cvvBox: {
    background: '#fff',
    color: '#1a202c',
    padding: '8px 12px',
    borderRadius: 4,
    fontFamily: "'Courier New', monospace",
    letterSpacing: '0.2em',
    display: 'inline-block',
    marginTop: 6,
    fontSize: '0.9rem',
  },
};
