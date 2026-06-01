import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CardField } from '../components/shared/CardField.js';

describe('CardField', () => {
  it('renders label and input', () => {
    render(
      <CardField
        id="cardNumber"
        label="Card number"
        value=""
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Card number')).toBeInTheDocument();
  });

  it('shows error message with role="alert" when error prop is set', () => {
    render(
      <CardField
        id="cardNumber"
        label="Card number"
        value=""
        onChange={vi.fn()}
        error="Card number is required"
      />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Card number is required');
  });

  it('shows ✕ icon when error is present (WCAG 1.4.1 — not color alone)', () => {
    const { container } = render(
      <CardField
        id="cardNumber"
        label="Card number"
        value=""
        onChange={vi.fn()}
        error="Required"
      />
    );
    expect(container.textContent).toContain('✕');
  });

  it('shows ✓ icon when isValid=true and value is non-empty', () => {
    const { container } = render(
      <CardField
        id="cardNumber"
        label="Card number"
        value="4111 1111 1111 1111"
        onChange={vi.fn()}
        isValid={true}
        showPositiveValidation={true}
      />
    );
    expect(container.textContent).toContain('✓');
  });

  it('input has aria-invalid="true" when error is present', () => {
    render(
      <CardField
        id="cardNumber"
        label="Card number"
        value=""
        onChange={vi.fn()}
        error="Required"
      />
    );
    expect(screen.getByLabelText('Card number')).toHaveAttribute('aria-invalid', 'true');
  });

  it('input has aria-describedby pointing to the error span id', () => {
    render(
      <CardField
        id="cardNumber"
        label="Card number"
        value=""
        onChange={vi.fn()}
        error="Required"
      />
    );
    const input = screen.getByLabelText('Card number');
    expect(input).toHaveAttribute('aria-describedby', 'cardNumber-error');
    expect(document.getElementById('cardNumber-error')).toBeInTheDocument();
  });

  it('does not show ✕ or ✓ when there is no error and isValid is false', () => {
    const { container } = render(
      <CardField
        id="cardNumber"
        label="Card number"
        value=""
        onChange={vi.fn()}
      />
    );
    expect(container.textContent).not.toContain('✕');
    expect(container.textContent).not.toContain('✓');
  });
});
