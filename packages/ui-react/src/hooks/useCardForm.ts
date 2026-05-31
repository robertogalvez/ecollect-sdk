import { useState, useCallback, useRef } from 'react';
import {
  detectBrand,
  formatCardNumberAuto,
  formatExpiry,
  expiryToApiFormat,
  sanitizeNumber,
  handleCardNumberBackspace,
  parseMultiFieldPaste,
  validateField,
  getCvvLength,
  luhnCheck,
  getMessages,
  clearSensitiveData,
  warnIfInsecure,
  interpolate,
} from '@ecollect/ui-core';
import type {
  CardBrand,
  CardFormData,
  CardFormErrors,
  CardFormConfig,
  CardFormSubmitPayload,
  SubmitError,
  ExtraFieldDef,
} from '@ecollect/ui-core';

export interface UseCardFormOptions {
  onSubmit: (payload: CardFormSubmitPayload) => Promise<void>;
  onError?: (error: SubmitError) => void;
  onSuccess?: (tokenId: string, maskedCard: string) => void;
  config?: CardFormConfig;
}

export interface UseCardFormReturn {
  fields: {
    cardNumber: string;
    expiry: string;
    cvv: string;
    cardHolderName: string;
    email: string;
    cardHolderIdType: string;
    cardHolderId: string;
    mobileCountryCode: string;
    mobileNumber: string;
    [key: string]: string;
  };
  errors: CardFormErrors;
  touched: Set<string>;
  brand: ReturnType<typeof detectBrand>;
  isValid: boolean;
  isSubmitting: boolean;
  submitAttempted: boolean;
  handleChange: (field: string, value: string) => void;
  handleBlur: (field: string) => void;
  handleKeyDown: (field: string, e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  reset: () => void;
  extraValues: Record<string, string>;
  handleExtraChange: (name: string, value: string) => void;
}

const EMPTY_FIELDS = {
  cardNumber: '',
  expiry: '',
  cvv: '',
  cardHolderName: '',
  email: '',
  cardHolderIdType: '',
  cardHolderId: '',
  mobileCountryCode: '',
  mobileNumber: '',
};

export function useCardForm({
  onSubmit,
  onError,
  onSuccess,
  config = {},
}: UseCardFormOptions): UseCardFormReturn {
  const lang = config.language ?? 'es';
  const msgs = getMessages(lang, config.messages);

  const [fields, setFields] = useState({ ...EMPTY_FIELDS });
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [brand, setBrand] = useState(detectBrand(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Keep a mutable ref to fields for use inside async callbacks
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  warnIfInsecure(config.insecureContextOverride);

  const getFieldMessages = useCallback(() => ({
    cardNumber: msgs.cardNumber as Required<typeof msgs.cardNumber>,
    expiry: msgs.expiry as Required<typeof msgs.expiry>,
    cvv: msgs.cvv as Required<typeof msgs.cvv>,
    cardHolderName: msgs.cardHolderName as Required<typeof msgs.cardHolderName>,
    email: msgs.email as Required<typeof msgs.email>,
    cardHolderId: msgs.cardHolderId as Required<typeof msgs.cardHolderId>,
  }), [msgs]);

  const validateOne = useCallback((field: string, value: string, currentBrand: typeof brand): string | null => {
    if (!['cardNumber', 'expiry', 'cvv', 'cardHolderName', 'email', 'cardHolderId'].includes(field)) {
      return null;
    }
    return validateField(
      field as keyof CardFormErrors,
      value,
      getFieldMessages(),
      currentBrand.brand,
      config.enabledBrands,
    );
  }, [getFieldMessages, config.enabledBrands]);

  const validateRequired = useCallback((
    currentFields: typeof fields,
    currentBrand: typeof brand,
    currentExtraValues: Record<string, string>,
  ): CardFormErrors => {
    const newErrors: CardFormErrors = {};
    const fieldConfig = config.fields ?? {};

    // Core card fields (always required)
    for (const f of ['cardNumber', 'expiry', 'cvv'] as const) {
      const err = validateOne(f, currentFields[f], currentBrand);
      if (err) newErrors[f] = err;
    }

    // Optional fields — validate only if visible + required
    if (fieldConfig.cardHolderName?.show !== false) {
      if (fieldConfig.cardHolderName?.required) {
        const err = validateOne('cardHolderName', currentFields.cardHolderName, currentBrand);
        if (err) newErrors.cardHolderName = err;
      }
    }
    if (fieldConfig.email?.show && fieldConfig.email?.required) {
      const err = validateOne('email', currentFields.email, currentBrand);
      if (err) newErrors.email = err;
    }
    if (fieldConfig.cardHolderId?.show && fieldConfig.cardHolderId?.required) {
      const err = validateOne('cardHolderId', currentFields.cardHolderId, currentBrand);
      if (err) newErrors.cardHolderId = err;
    }

    // Extra fields
    for (const def of config.extraFields ?? []) {
      if (def.required) {
        const val = currentExtraValues[def.name] ?? '';
        const customErr = def.validate ? def.validate(val) : null;
        if (!val.trim()) {
          newErrors[def.name] = `${def.label} es requerido`;
        } else if (customErr) {
          newErrors[def.name] = customErr;
        }
      }
    }

    return newErrors;
  }, [config, validateOne]);

  const handleChange = useCallback((field: string, value: string) => {
    setFields((prev) => {
      let formatted = value;
      let newBrand = brand;

      if (field === 'cardNumber') {
        const digits = sanitizeNumber(value);
        newBrand = detectBrand(digits);
        setBrand(newBrand);
        formatted = formatCardNumberAuto(digits);
      } else if (field === 'expiry') {
        formatted = formatExpiry(value);
      } else if (field === 'cvv') {
        formatted = sanitizeNumber(value).slice(0, getCvvLength(brand.brand));
      }

      const next = { ...prev, [field]: formatted };

      // Reward early: clear error as soon as field becomes valid (only if already touched)
      setErrors((prevErrors) => {
        if (!touched.has(field)) return prevErrors;
        const err = validateOne(field, formatted, newBrand);
        if (!err && prevErrors[field]) {
          const { [field]: _removed, ...rest } = prevErrors;
          return rest;
        }
        return prevErrors;
      });

      return next;
    });
  }, [brand, touched, validateOne]);

  const handleExtraChange = useCallback((name: string, value: string) => {
    setExtraValues((prev) => {
      const next = { ...prev, [name]: value };
      // Clear extra field error on change if was touched
      if (touched.has(name)) {
        setErrors((prevErrors) => {
          const { [name]: _removed, ...rest } = prevErrors;
          return rest;
        });
      }
      return next;
    });
  }, [touched]);

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => new Set(prev).add(field));
    const currentFields = fieldsRef.current;
    const err = validateOne(field, (currentFields as Record<string, string>)[field] ?? '', brand);
    setErrors((prev) => {
      if (err) return { ...prev, [field]: err };
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  }, [brand, validateOne]);

  const handleKeyDown = useCallback((field: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (field === 'cardNumber' && e.key === 'Backspace') {
      const input = e.currentTarget;
      const cursor = input.selectionStart ?? 0;
      const current = fields.cardNumber;

      if (cursor > 0 && current[cursor - 1] === ' ') {
        e.preventDefault();
        const { value: newRaw, cursorPos } = handleCardNumberBackspace(current, cursor);
        const newBrand = detectBrand(newRaw);
        setBrand(newBrand);
        const formatted = formatCardNumberAuto(newRaw);
        setFields((prev) => ({ ...prev, cardNumber: formatted }));
        // Restore cursor after React re-render
        requestAnimationFrame(() => {
          input.setSelectionRange(cursorPos, cursorPos);
        });
      }
    }
  }, [fields.cardNumber]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const parsed = parseMultiFieldPaste(text);
    if (parsed.cardNumber || parsed.expiry) {
      e.preventDefault();
      setFields((prev) => {
        const next = { ...prev };
        if (parsed.cardNumber) {
          const newBrand = detectBrand(parsed.cardNumber);
          setBrand(newBrand);
          next.cardNumber = formatCardNumberAuto(parsed.cardNumber);
        }
        if (parsed.expiry) next.expiry = parsed.expiry;
        if (parsed.cvv) next.cvv = parsed.cvv;
        if (parsed.cardHolderName) next.cardHolderName = parsed.cardHolderName;
        return next;
      });
    }
  }, []);

  const isValid = useCallback(() => {
    const errs = validateRequired(fields, brand, extraValues);
    return Object.keys(errs).length === 0;
  }, [fields, brand, extraValues, validateRequired])();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitAttempted(true);
    const currentFields = fieldsRef.current;
    const errs = validateRequired(currentFields, brand, extraValues);

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Mark all fields as touched on submit attempt
      const allFields = new Set(['cardNumber', 'expiry', 'cvv', 'cardHolderName', 'email', 'cardHolderId',
        ...(config.extraFields ?? []).map((f: ExtraFieldDef) => f.name)]);
      setTouched(allFields);
      return;
    }

    setIsSubmitting(true);
    const controller = new AbortController();
    const timeoutMs = config.timeoutMs ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const cardFormData: CardFormData = {
      cardNumber: sanitizeNumber(currentFields.cardNumber),
      expirationDate: expiryToApiFormat(currentFields.expiry),
      secureCode: currentFields.cvv,
      cardHolderName: currentFields.cardHolderName,
      email: currentFields.email || undefined,
      cardHolderIdType: currentFields.cardHolderIdType || undefined,
      cardHolderId: currentFields.cardHolderId || undefined,
      mobileCountryCode: currentFields.mobileCountryCode || undefined,
      mobileNumber: currentFields.mobileNumber || undefined,
      paymentSystem: brand.paymentSystem,
      brand: brand.brand,
    };

    try {
      await onSubmit({ cardFormData, extraFields: extraValues });
      clearTimeout(timeoutId);

      // Build masked card for success display
      const digits = sanitizeNumber(currentFields.cardNumber);
      const masked = `•••• •••• •••• ${digits.slice(-4)}`;

      // Clear sensitive data before state reset
      clearSensitiveData(cardFormData);
      setFields({ ...EMPTY_FIELDS });
      setErrors({});
      setTouched(new Set());
      setBrand(detectBrand(''));
      setIsSubmitting(false);
      setSubmitAttempted(false);

      onSuccess?.('', masked); // tokenId comes from the onSubmit handler
    } catch (err) {
      clearTimeout(timeoutId);
      setIsSubmitting(false);

      let submitError: SubmitError;
      if (controller.signal.aborted) {
        submitError = { kind: 'timeout', message: msgs.timeout, retryable: true };
      } else if (err instanceof Error && err.message.includes('SESSION')) {
        submitError = { kind: 'session_expired', message: msgs.sessionExpired, retryable: false };
      } else if (err instanceof TypeError) {
        submitError = { kind: 'network', message: msgs.network, retryable: true };
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        submitError = {
          kind: 'api',
          message: interpolate(msgs.apiError, { message: msg }),
          retryable: false,
        };
      }

      onError?.(submitError);
    }
  }, [isSubmitting, brand, extraValues, config, msgs, onSubmit, onError, onSuccess, validateRequired]);

  const reset = useCallback(() => {
    setFields({ ...EMPTY_FIELDS });
    setExtraValues({});
    setErrors({});
    setTouched(new Set());
    setBrand(detectBrand(''));
    setIsSubmitting(false);
    setSubmitAttempted(false);
  }, []);

  return {
    fields,
    errors,
    touched,
    brand,
    isValid,
    isSubmitting,
    submitAttempted,
    handleChange,
    handleBlur,
    handleKeyDown,
    handlePaste,
    handleSubmit,
    reset,
    extraValues,
    handleExtraChange,
  };
}
