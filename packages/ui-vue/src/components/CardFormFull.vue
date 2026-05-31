<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
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
  getMessages,
  clearSensitiveData,
  warnIfInsecure,
  interpolate,
} from '@ecollect/ui-core';
import type {
  CardFormProps,
  CardFormErrors,
  CardFormSubmitPayload,
  SubmitError,
} from '@ecollect/ui-core';

const props = withDefaults(defineProps<CardFormProps>(), {
  config: () => ({}),
});

const lang = computed(() => props.config?.language ?? 'es');
const msgs = computed(() => getMessages(lang.value, props.config?.messages));
const fieldConfig = computed(() => props.config?.fields ?? {});
const showPositive = computed(() => props.config?.showPositiveValidation !== false);
const showPreview = computed(() => props.config?.showCardPreview !== false);

// ── State ─────────────────────────────────────────────────────────────────────
const fields = reactive({
  cardNumber: '',
  expiry: '',
  cvv: '',
  cardHolderName: '',
  email: '',
  cardHolderIdType: '',
  cardHolderId: '',
  mobileCountryCode: '',
  mobileNumber: '',
});

const extraValues = reactive<Record<string, string>>({});
const errors = reactive<CardFormErrors>({});
const touched = reactive<Set<string>>(new Set());
const brand = ref(detectBrand(''));
const isSubmitting = ref(false);
const cvvFocused = ref(false);

warnIfInsecure(props.config?.insecureContextOverride);

// ── Field messages ────────────────────────────────────────────────────────────
const fieldMsgs = computed(() => ({
  cardNumber: msgs.value.cardNumber as Required<typeof msgs.value.cardNumber>,
  expiry: msgs.value.expiry as Required<typeof msgs.value.expiry>,
  cvv: msgs.value.cvv as Required<typeof msgs.value.cvv>,
  cardHolderName: msgs.value.cardHolderName as Required<typeof msgs.value.cardHolderName>,
  email: msgs.value.email as Required<typeof msgs.value.email>,
  cardHolderId: msgs.value.cardHolderId as Required<typeof msgs.value.cardHolderId>,
}));

// ── Computed ──────────────────────────────────────────────────────────────────
const isTouched = (f: string) => touched.has(f);
const isFieldValid = (f: string, value: string) =>
  isTouched(f) && !errors[f] && value.length > 0;

const isValid = computed(() => {
  const fc = fieldConfig.value;
  const coreOk = !validateField('cardNumber', fields.cardNumber, fieldMsgs.value, brand.value.brand, props.config?.enabledBrands)
    && !validateField('expiry', fields.expiry, fieldMsgs.value, brand.value.brand)
    && !validateField('cvv', fields.cvv, fieldMsgs.value, brand.value.brand);
  if (!coreOk) return false;
  if (fc.cardHolderName?.required && validateField('cardHolderName', fields.cardHolderName, fieldMsgs.value, brand.value.brand)) return false;
  if (fc.email?.required && validateField('email', fields.email, fieldMsgs.value, brand.value.brand)) return false;
  if (fc.cardHolderId?.required && validateField('cardHolderId', fields.cardHolderId, fieldMsgs.value, brand.value.brand)) return false;
  return true;
});

const submitLabel = computed(() =>
  props.config?.submitLabel ?? (lang.value === 'es' ? 'Tokenizar tarjeta' : 'Tokenize card')
);

const maskedNumber = computed(() => {
  const digits = sanitizeNumber(fields.cardNumber);
  return digits.length >= 4 ? `•••• •••• •••• ${digits.slice(-4)}` : '•••• •••• •••• ••••';
});

// ── Handlers ──────────────────────────────────────────────────────────────────
function handleChange(field: string, value: string) {
  let formatted = value;

  if (field === 'cardNumber') {
    const digits = sanitizeNumber(value);
    brand.value = detectBrand(digits);
    formatted = formatCardNumberAuto(digits);
  } else if (field === 'expiry') {
    formatted = formatExpiry(value);
  } else if (field === 'cvv') {
    formatted = sanitizeNumber(value).slice(0, getCvvLength(brand.value.brand));
  }

  (fields as Record<string, string>)[field] = formatted;

  // Clear error immediately if field is now valid (reward early)
  if (touched.has(field)) {
    const err = validateField(field as keyof CardFormErrors, formatted, fieldMsgs.value, brand.value.brand);
    if (!err) delete errors[field];
  }
}

function handleExtraChange(name: string, value: string) {
  extraValues[name] = value;
  if (touched.has(name)) delete errors[name];
}

function handleBlur(field: string) {
  touched.add(field);
  const value = (fields as Record<string, string>)[field] ?? '';
  const err = validateField(field as keyof CardFormErrors, value, fieldMsgs.value, brand.value.brand);
  if (err) errors[field] = err;
  else delete errors[field];
}

function handleKeyDown(field: string, e: KeyboardEvent) {
  if (field === 'cardNumber' && e.key === 'Backspace') {
    const input = e.target as HTMLInputElement;
    const cursor = input.selectionStart ?? 0;
    if (cursor > 0 && fields.cardNumber[cursor - 1] === ' ') {
      e.preventDefault();
      const { value: newRaw, cursorPos } = handleCardNumberBackspace(fields.cardNumber, cursor);
      brand.value = detectBrand(newRaw);
      fields.cardNumber = formatCardNumberAuto(newRaw);
      requestAnimationFrame(() => input.setSelectionRange(cursorPos, cursorPos));
    }
  }
}

function handlePaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') ?? '';
  const parsed = parseMultiFieldPaste(text);
  if (parsed.cardNumber || parsed.expiry) {
    e.preventDefault();
    if (parsed.cardNumber) { brand.value = detectBrand(parsed.cardNumber); fields.cardNumber = formatCardNumberAuto(parsed.cardNumber); }
    if (parsed.expiry) fields.expiry = parsed.expiry;
    if (parsed.cvv) fields.cvv = parsed.cvv;
    if (parsed.cardHolderName) fields.cardHolderName = parsed.cardHolderName;
  }
}

async function handleSubmit(e: Event) {
  e.preventDefault();
  if (isSubmitting.value) return;

  // Mark all as touched and validate
  ['cardNumber', 'expiry', 'cvv', 'cardHolderName', 'email', 'cardHolderId'].forEach(f => {
    touched.add(f);
    const val = (fields as Record<string, string>)[f] ?? '';
    const err = validateField(f as keyof CardFormErrors, val, fieldMsgs.value, brand.value.brand);
    if (err) errors[f] = err;
    else delete errors[f];
  });

  if (Object.keys(errors).length > 0) return;

  isSubmitting.value = true;
  const controller = new AbortController();
  const timeoutMs = props.config?.timeoutMs ?? 30000;
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  const cardFormData = {
    cardNumber: sanitizeNumber(fields.cardNumber),
    expirationDate: expiryToApiFormat(fields.expiry),
    secureCode: fields.cvv,
    cardHolderName: fields.cardHolderName,
    email: fields.email || undefined,
    cardHolderIdType: fields.cardHolderIdType || undefined,
    cardHolderId: fields.cardHolderId || undefined,
    mobileCountryCode: fields.mobileCountryCode || undefined,
    mobileNumber: fields.mobileNumber || undefined,
    paymentSystem: brand.value.paymentSystem,
    brand: brand.value.brand,
  };

  try {
    const payload: CardFormSubmitPayload = { cardFormData, extraFields: { ...extraValues } };
    await props.onSubmit(payload);
    clearTimeout(tid);
    clearSensitiveData(cardFormData);
    Object.assign(fields, { cardNumber: '', expiry: '', cvv: '', cardHolderName: '', email: '', cardHolderIdType: '', cardHolderId: '', mobileCountryCode: '', mobileNumber: '' });
    touched.clear();
    Object.keys(errors).forEach(k => delete errors[k]);
    brand.value = detectBrand('');
  } catch (err) {
    clearTimeout(tid);
    let submitError: SubmitError;
    if (controller.signal.aborted) {
      submitError = { kind: 'timeout', message: msgs.value.timeout, retryable: true };
    } else if (err instanceof TypeError) {
      submitError = { kind: 'network', message: msgs.value.network, retryable: true };
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      submitError = { kind: 'api', message: interpolate(msgs.value.apiError, { message: msg }), retryable: false };
    }
    props.onError?.(submitError);
  } finally {
    isSubmitting.value = false;
  }
}

const show = (f: string) => (fieldConfig.value as Record<string, { show?: boolean }>)[f]?.show === true;
const req = (f: string) => (fieldConfig.value as Record<string, { required?: boolean }>)[f]?.required === true;
const lbl = (f: string, defEs: string, defEn: string) =>
  (fieldConfig.value as Record<string, { label?: string }>)[f]?.label ?? (lang.value === 'es' ? defEs : defEn);
</script>

<template>
  <form @submit="handleSubmit" novalidate style="display:flex;flex-direction:column;gap:16px;font-family:inherit;">
    <!-- Screen reader brand announcement -->
    <span aria-live="polite" aria-atomic="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">
      {{ brand.brand !== 'Unknown' ? msgs.brandDetected.replace('{brand}', brand.brand) : '' }}
    </span>

    <!-- Card number -->
    <div style="display:flex;flex-direction:column;gap:6px;">
      <label for="vue-cardNumber" style="font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">
        {{ lang === 'es' ? 'Número de tarjeta' : 'Card number' }}
      </label>
      <div style="position:relative;">
        <input
          id="vue-cardNumber"
          type="tel"
          inputmode="numeric"
          autocomplete="cc-number"
          placeholder="1234 5678 9012 3456"
          maxlength="23"
          :value="fields.cardNumber"
          :aria-invalid="!!errors.cardNumber"
          :aria-describedby="errors.cardNumber ? 'vue-cardNumber-error' : undefined"
          @input="handleChange('cardNumber', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('cardNumber')"
          @keydown="handleKeyDown('cardNumber', $event)"
          @paste="handlePaste"
          :style="{
            padding:'11px 14px',border:`1.5px solid ${errors.cardNumber ? '#ef4444' : isFieldValid('cardNumber', fields.cardNumber) ? '#10b981' : '#e2e8f0'}`,
            borderRadius:'10px',fontSize:'.95rem',color:'#1a202c',background:'#fff',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'
          }"
        />
        <span v-if="brand.brand !== 'Unknown'" :style="{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:'.72rem',fontWeight:700,color:'#fff',background:brand.color,padding:'2px 8px',borderRadius:'4px'}">
          {{ brand.brand }}
        </span>
      </div>
      <span v-if="isTouched('cardNumber') && errors.cardNumber" id="vue-cardNumber-error" role="alert" style="color:#ef4444;font-size:.78rem;">
        ✕ {{ errors.cardNumber }}
      </span>
    </div>

    <!-- Expiry + CVV row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="vue-expiry" style="font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">
          {{ lang === 'es' ? 'Vencimiento' : 'Expiry' }}
        </label>
        <input
          id="vue-expiry"
          type="tel"
          inputmode="numeric"
          autocomplete="cc-exp"
          placeholder="MM / YY"
          maxlength="7"
          :value="fields.expiry"
          :aria-invalid="!!errors.expiry"
          @input="handleChange('expiry', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('expiry')"
          :style="{padding:'11px 14px',border:`1.5px solid ${errors.expiry ? '#ef4444' : isFieldValid('expiry', fields.expiry) ? '#10b981' : '#e2e8f0'}`,borderRadius:'10px',fontSize:'.95rem',color:'#1a202c',background:'#fff',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'}"
        />
        <span v-if="isTouched('expiry') && errors.expiry" role="alert" style="color:#ef4444;font-size:.78rem;">✕ {{ errors.expiry }}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="vue-cvv" style="font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">
          {{ lang === 'es' ? 'Código de seguridad' : 'Security Code' }}
        </label>
        <input
          id="vue-cvv"
          type="tel"
          inputmode="numeric"
          autocomplete="cc-csc"
          :placeholder="brand.brand === 'Amex' ? '1234' : '123'"
          :maxlength="getCvvLength(brand.brand)"
          :value="fields.cvv"
          :aria-invalid="!!errors.cvv"
          @input="handleChange('cvv', ($event.target as HTMLInputElement).value)"
          @blur="handleBlur('cvv'); cvvFocused = false"
          @focus="cvvFocused = true"
          :style="{padding:'11px 14px',border:`1.5px solid ${errors.cvv ? '#ef4444' : isFieldValid('cvv', fields.cvv) ? '#10b981' : '#e2e8f0'}`,borderRadius:'10px',fontSize:'.95rem',color:'#1a202c',background:'#fff',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'}"
        />
        <span v-if="isTouched('cvv') && errors.cvv" role="alert" style="color:#ef4444;font-size:.78rem;">✕ {{ errors.cvv }}</span>
      </div>
    </div>

    <!-- Cardholder name (optional by default — Baymard) -->
    <div v-if="fieldConfig.cardHolderName?.show !== false" style="display:flex;flex-direction:column;gap:6px;">
      <label for="vue-name" style="font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">
        {{ lbl('cardHolderName', 'Nombre del titular', 'Cardholder name') }}
        <span v-if="!req('cardHolderName')" style="font-weight:400;text-transform:none;color:#94a3b8;font-size:.72rem;"> (opcional)</span>
      </label>
      <input
        id="vue-name"
        type="text"
        autocomplete="cc-name"
        :placeholder="lang === 'es' ? 'Como aparece en la tarjeta' : 'As it appears on the card'"
        :value="fields.cardHolderName"
        @input="handleChange('cardHolderName', ($event.target as HTMLInputElement).value)"
        @blur="handleBlur('cardHolderName')"
        :style="{padding:'11px 14px',border:`1.5px solid ${isFieldValid('cardHolderName', fields.cardHolderName) ? '#10b981' : '#e2e8f0'}`,borderRadius:'10px',fontSize:'.95rem',color:'#1a202c',background:'#fff',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'}"
      />
    </div>

    <!-- Optional fields -->
    <div v-if="show('email')" style="display:flex;flex-direction:column;gap:6px;">
      <label for="vue-email" style="font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">
        {{ lbl('email', 'Correo electrónico', 'Email') }}
        <span v-if="!req('email')" style="font-weight:400;text-transform:none;color:#94a3b8;font-size:.72rem;"> (opcional)</span>
      </label>
      <input id="vue-email" type="email" autocomplete="email" placeholder="correo@ejemplo.com"
        :value="fields.email"
        :aria-invalid="!!errors.email"
        @input="handleChange('email', ($event.target as HTMLInputElement).value)"
        @blur="handleBlur('email')"
        :style="{padding:'11px 14px',border:`1.5px solid ${errors.email ? '#ef4444' : isFieldValid('email', fields.email) ? '#10b981' : '#e2e8f0'}`,borderRadius:'10px',fontSize:'.95rem',color:'#1a202c',background:'#fff',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'}"
      />
      <span v-if="isTouched('email') && errors.email" role="alert" style="color:#ef4444;font-size:.78rem;">✕ {{ errors.email }}</span>
    </div>

    <div v-if="show('cardHolderId')" style="display:flex;flex-direction:column;gap:6px;">
      <label for="vue-doc" style="font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">
        {{ lbl('cardHolderId', 'Número de documento', 'Document number') }}
        <span v-if="!req('cardHolderId')" style="font-weight:400;text-transform:none;color:#94a3b8;font-size:.72rem;"> (opcional)</span>
      </label>
      <input id="vue-doc" type="text" placeholder="123456789"
        :value="fields.cardHolderId"
        @input="handleChange('cardHolderId', ($event.target as HTMLInputElement).value)"
        @blur="handleBlur('cardHolderId')"
        :style="{padding:'11px 14px',border:'1.5px solid #e2e8f0',borderRadius:'10px',fontSize:'.95rem',color:'#1a202c',background:'#fff',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'}"
      />
    </div>

    <!-- Extra fields -->
    <div v-for="def in (config?.extraFields ?? [])" :key="def.name" style="display:flex;flex-direction:column;gap:6px;">
      <label :for="`vue-extra-${def.name}`" style="font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">
        {{ def.label }}
        <span v-if="!def.required" style="font-weight:400;text-transform:none;color:#94a3b8;font-size:.72rem;"> (opcional)</span>
      </label>
      <input
        :id="`vue-extra-${def.name}`"
        :type="def.type ?? 'text'"
        :placeholder="def.placeholder"
        :value="extraValues[def.name] ?? ''"
        @input="handleExtraChange(def.name, ($event.target as HTMLInputElement).value)"
        @blur="touched.add(def.name)"
        :style="{padding:'11px 14px',border:'1.5px solid #e2e8f0',borderRadius:'10px',fontSize:'.95rem',color:'#1a202c',background:'#fff',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'}"
      />
      <span v-if="isTouched(def.name) && errors[def.name]" role="alert" style="color:#ef4444;font-size:.78rem;">✕ {{ errors[def.name] }}</span>
    </div>

    <button
      type="submit"
      :disabled="isSubmitting"
      :style="{
        padding:'14px 24px',
        background:'linear-gradient(135deg,#6366f1,#4f46e5)',
        color:'#fff',border:'none',borderRadius:'10px',fontSize:'1rem',fontWeight:600,
        cursor:isSubmitting ? 'not-allowed' : 'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
        width:'100%',marginTop:'8px',opacity:isSubmitting ? 0.7 : 1
      }"
    >
      {{ isSubmitting ? msgs.submitting : submitLabel }}
    </button>
  </form>
</template>
