import type { CardFormMessages } from './types.js';

const es: CardFormMessages = {
  cardNumber: {
    required: 'Ingresa el número de tarjeta',
    luhn: 'El número de tarjeta no es válido',
    length: 'El número de tarjeta tiene una longitud incorrecta',
    brandDisabled: 'Este tipo de tarjeta no está habilitado',
  },
  expiry: {
    required: 'Ingresa la fecha de vencimiento',
    past: 'La tarjeta está vencida',
    tooFar: 'La fecha de vencimiento es demasiado lejana',
    invalid: 'Fecha de vencimiento inválida',
  },
  cvv: {
    required: 'Ingresa el código de seguridad',
    length: 'El código de seguridad no es válido para esta tarjeta',
  },
  cardHolderName: {
    required: 'Ingresa el nombre del titular',
    tooShort: 'El nombre debe tener al menos 2 caracteres',
  },
  email: {
    required: 'Ingresa tu correo electrónico',
    invalid: 'El correo electrónico no es válido',
  },
  cardHolderId: {
    required: 'Ingresa el número de documento',
  },
  network: 'Error de red. Por favor intenta de nuevo.',
  timeout: 'La operación tardó demasiado. Por favor intenta de nuevo.',
  sessionExpired: 'Tu sesión expiró. Por favor recarga la página.',
  apiError: 'Error al procesar el pago: {message}',
  submitting: 'Procesando...',
  success: 'Tarjeta tokenizada exitosamente.',
  brandDetected: '{brand} detectada',
  brandNotEnabled: 'Este tipo de tarjeta no está habilitado para este comercio',
};

const en: CardFormMessages = {
  cardNumber: {
    required: 'Please enter your card number',
    luhn: 'Card number is not valid',
    length: 'Card number has incorrect length',
    brandDisabled: 'This card type is not enabled',
  },
  expiry: {
    required: 'Please enter expiry date',
    past: 'Your card has expired',
    tooFar: 'Expiry date is too far in the future',
    invalid: 'Invalid expiry date',
  },
  cvv: {
    required: 'Please enter your security code',
    length: 'Security code is not valid for this card type',
  },
  cardHolderName: {
    required: 'Please enter the cardholder name',
    tooShort: 'Name must be at least 2 characters',
  },
  email: {
    required: 'Please enter your email address',
    invalid: 'Email address is not valid',
  },
  cardHolderId: {
    required: 'Please enter your document number',
  },
  network: 'Network error. Please try again.',
  timeout: 'The operation timed out. Please try again.',
  sessionExpired: 'Your session has expired. Please reload the page.',
  apiError: 'Payment error: {message}',
  submitting: 'Processing...',
  success: 'Card tokenized successfully.',
  brandDetected: '{brand} detected',
  brandNotEnabled: 'This card type is not enabled for this merchant',
};

export const messages: Record<'en' | 'es', CardFormMessages> = { es, en };

export function getMessages(
  lang: 'en' | 'es' = 'es',
  overrides?: Partial<CardFormMessages>,
): CardFormMessages {
  const base = messages[lang];
  if (!overrides) return base;
  return deepMerge(base, overrides) as CardFormMessages;
}

/** Interpolates {key} placeholders in a message string. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function deepMerge(base: object, overrides: object): object {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key as keyof typeof result] = deepMerge(
        (base as Record<string, object>)[key] ?? {},
        value,
      ) as never;
    } else if (value !== undefined) {
      result[key as keyof typeof result] = value as never;
    }
  }
  return result;
}
