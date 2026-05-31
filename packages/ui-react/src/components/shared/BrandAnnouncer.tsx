import React from 'react';
import { interpolate } from '@ecollect/ui-core';
import type { CardBrand } from '@ecollect/ui-core';

interface BrandAnnouncerProps {
  brand: CardBrand;
  brandDetectedTemplate: string; // e.g. "{brand} detectada"
}

export function BrandAnnouncer({ brand, brandDetectedTemplate }: BrandAnnouncerProps) {
  const text = brand !== 'Unknown'
    ? interpolate(brandDetectedTemplate, { brand })
    : '';

  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {text}
    </span>
  );
}
