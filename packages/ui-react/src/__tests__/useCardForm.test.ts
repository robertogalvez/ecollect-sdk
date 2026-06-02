import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useCardForm } from '../hooks/useCardForm.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOnSubmit() {
  return vi.fn().mockResolvedValue(undefined);
}

function renderForm(onSubmit = makeOnSubmit()) {
  return renderHook(() =>
    useCardForm({
      onSubmit,
      config: { insecureContextOverride: true },
    })
  );
}

// Fill all required core fields
async function fillValidFields(result: { current: ReturnType<typeof useCardForm> }) {
  await act(async () => {
    result.current.handleChange('cardNumber', '4111111111111111');
  });
  await act(async () => {
    result.current.handleChange('expiry', '1230'); // Dec 2030
  });
  await act(async () => {
    result.current.handleChange('cvv', '123');
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCardForm', () => {
  it('has empty initial state — no errors, no touched fields', () => {
    const { result } = renderForm();
    expect(result.current.fields.cardNumber).toBe('');
    expect(result.current.fields.expiry).toBe('');
    expect(result.current.fields.cvv).toBe('');
    expect(result.current.errors).toEqual({});
    expect(result.current.touched.size).toBe(0);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('handleChange cardNumber detects Visa brand and formats', async () => {
    const { result } = renderForm();
    await act(async () => {
      result.current.handleChange('cardNumber', '4111111111111111');
    });
    expect(result.current.brand.brand).toBe('Visa');
    expect(result.current.fields.cardNumber).toBe('4111 1111 1111 1111');
  });

  it('handleBlur on empty cardNumber shows required error', async () => {
    const { result } = renderForm();
    await act(async () => {
      result.current.handleBlur('cardNumber');
    });
    expect(result.current.errors.cardNumber).toBeTruthy();
    expect(result.current.touched.has('cardNumber')).toBe(true);
  });

  it('error clears immediately when a touched field becomes valid (reward early)', async () => {
    const { result } = renderForm();
    await act(async () => {
      result.current.handleBlur('cardNumber');
    });
    expect(result.current.errors.cardNumber).toBeTruthy();

    await act(async () => {
      result.current.handleChange('cardNumber', '4111111111111111');
    });
    expect(result.current.errors.cardNumber).toBeUndefined();
  });

  it('handleSubmit with invalid fields does NOT call onSubmit', async () => {
    const onSubmit = makeOnSubmit();
    const { result } = renderForm(onSubmit);

    await act(async () => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as any);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.cardNumber).toBeTruthy();
  });

  it('handleSubmit with valid fields calls onSubmit with correct payload', async () => {
    // Capture a deep copy of cardFormData before clearSensitiveData mutates it
    let capturedCardNumber = '';
    let capturedExpirationDate = '';
    const onSubmit = vi.fn().mockImplementation(async ({ cardFormData }) => {
      capturedCardNumber = cardFormData.cardNumber;
      capturedExpirationDate = cardFormData.expirationDate;
    });
    const { result } = renderForm(onSubmit);

    await fillValidFields(result);

    await act(async () => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as any);
    });

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(capturedCardNumber).toBe('4111111111111111');
    expect(capturedExpirationDate).toMatch(/^\d{2}\/\d{4}$/);
  });

  it('double submit — onSubmit called only once (isSubmitting guard)', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<void>((res) => { resolveSubmit = res; })
    );
    const { result } = renderForm(onSubmit);

    await fillValidFields(result);

    // Start first submit (doesn't resolve yet)
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as any);
    });

    // Immediately attempt second submit
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as any);
    });

    // Resolve the pending submit
    await act(async () => { resolveSubmit(); });

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('handlePaste distributes card number and expiry from combined paste', async () => {
    const { result } = renderForm();

    await act(async () => {
      result.current.handlePaste({
        preventDefault: vi.fn(),
        clipboardData: { getData: () => '4111111111111111 05/26 123' },
      } as any);
    });

    expect(result.current.fields.cardNumber).toBe('4111 1111 1111 1111');
    expect(result.current.fields.expiry).toMatch(/05/);
  });
});
