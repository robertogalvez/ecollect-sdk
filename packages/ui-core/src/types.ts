export type CardBrand =
  | 'Visa'
  | 'Mastercard'
  | 'Amex'
  | 'Discover'
  | 'Diners'
  | 'JCB'
  | 'Maestro'
  | 'Unknown';

export interface CardFormData {
  cardNumber: string;
  expirationDate: string; // MM/YYYY for API
  secureCode: string;     // CVV — never persist
  cardHolderName: string;
  email?: string;
  cardHolderIdType?: string;
  cardHolderId?: string;
  mobileCountryCode?: string;
  mobileNumber?: string;
  paymentSystem: string;
  brand: CardBrand;
}

export interface CardFormErrors {
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  cardHolderName?: string;
  email?: string;
  cardHolderId?: string;
  [extraField: string]: string | undefined;
}

export type NetworkErrorKind = 'network' | 'timeout' | 'api' | 'session_expired';

export interface SubmitError {
  kind: NetworkErrorKind;
  message: string;
  retryable: boolean;
}

export interface FieldConfig {
  show?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
}

export interface ExtraFieldDef {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  validate?: (value: string) => string | null;
  position?: 'before-card-fields' | 'after-card-fields' | 'after-name';
}

export interface CardFormMessages {
  cardNumber: { required?: string; luhn?: string; length?: string; brandDisabled?: string };
  expiry: { required?: string; past?: string; tooFar?: string; invalid?: string };
  cvv: { required?: string; length?: string };
  cardHolderName: { required?: string; tooShort?: string };
  email: { required?: string; invalid?: string };
  cardHolderId: { required?: string };
  network: string;
  timeout: string;
  sessionExpired: string;
  apiError: string;
  submitting: string;
  success: string;
  brandDetected: string;
  brandNotEnabled: string;
}

export interface CardFormTheme {
  primary?: string;
  error?: string;
  success?: string;
  borderRadius?: string;
  fontFamily?: string;
  inputBg?: string;
  inputBorder?: string;
  cardGradient?: string;
  preset?: 'default' | 'dark' | 'minimal';
}

export interface CardFormConfig {
  showCardPreview?: boolean;
  cardPreviewPosition?: 'left' | 'top' | 'none';
  showPositiveValidation?: boolean;
  showBrandLogo?: boolean;
  animateErrors?: boolean;
  fields?: {
    cardHolderName?: FieldConfig;
    email?: FieldConfig;
    cardHolderIdType?: FieldConfig;
    cardHolderId?: FieldConfig;
    mobileCountryCode?: FieldConfig;
    mobileNumber?: FieldConfig;
    amount?: FieldConfig;
    currency?: FieldConfig;
  };
  extraFields?: ExtraFieldDef[];
  enabledBrands?: CardBrand[];
  messages?: Partial<CardFormMessages>;
  theme?: CardFormTheme;
  submitLabel?: string;
  timeoutMs?: number;
  language?: 'en' | 'es';
  insecureContextOverride?: boolean;
}

export interface CardFormSubmitPayload {
  cardFormData: CardFormData;
  extraFields?: Record<string, string>;
}

export interface CardFormProps {
  onSubmit: (payload: CardFormSubmitPayload) => Promise<void>;
  onError?: (error: SubmitError) => void;
  onSuccess?: (tokenId: string, maskedCard: string) => void;
  config?: CardFormConfig;
}
