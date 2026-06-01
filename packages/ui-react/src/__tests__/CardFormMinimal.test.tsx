import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CardFormMinimal } from '../components/CardFormMinimal.js';

function noop() { return Promise.resolve(); }

describe('CardFormMinimal', () => {
  it('renders without crashing', () => {
    render(<CardFormMinimal onSubmit={noop} config={{ insecureContextOverride: true }} />);
    // The form should be in the document
    expect(document.querySelector('form')).toBeInTheDocument();
  });

  it('has an accessible label for the card number field', () => {
    render(<CardFormMinimal onSubmit={noop} config={{ insecureContextOverride: true }} />);
    // getByRole with name checks for an associated label
    const input = screen.getByRole('textbox', { name: /número de tarjeta/i });
    expect(input).toBeInTheDocument();
  });

  it('submit with empty fields shows required error with role="alert"', async () => {
    render(<CardFormMinimal onSubmit={noop} config={{ insecureContextOverride: true }} />);
    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  it('typing a valid Visa card number shows a brand badge', async () => {
    render(<CardFormMinimal onSubmit={noop} config={{ insecureContextOverride: true }} />);

    const cardInput = screen.getByRole('textbox', { name: /número de tarjeta/i });
    fireEvent.change(cardInput, { target: { value: '4111111111111111' } });

    await waitFor(() => {
      // The brand badge renders the brand name as a <span>
      expect(screen.getByText('Visa')).toBeInTheDocument();
    });
  });
});
