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
  CardFormErrors,
  CardFormSubmitPayload,
  BrandInfo,
  CardFormMessages,
} from '@ecollect/ui-core';

const STYLES = `
  :host { display: block; font-family: inherit; }
  * { box-sizing: border-box; }
  form { display: flex; flex-direction: column; gap: 16px; }
  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  label {
    font-size: .78rem; font-weight: 600; color: #64748b;
    text-transform: uppercase; letter-spacing: .04em;
  }
  .input-wrap { position: relative; }
  input {
    padding: 11px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: .95rem; color: #1a202c; background: #fff; outline: none;
    width: 100%; font-family: inherit;
  }
  input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
  input[data-valid="true"] { border-color: #10b981; }
  input[data-error="true"] { border-color: #ef4444; }
  .brand-badge {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    font-size: .72rem; font-weight: 700; color: #fff;
    padding: 2px 8px; border-radius: 4px;
  }
  .field-icon {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    font-size: .85rem; pointer-events: none;
  }
  .error-msg { color: #ef4444; font-size: .78rem; }
  .optional { font-weight: 400; text-transform: none; color: #94a3b8; font-size: .72rem; }
  button[type="submit"] {
    padding: 14px 24px;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff; border: none; border-radius: 10px;
    font-size: 1rem; font-weight: 600; cursor: pointer;
    width: 100%; margin-top: 8px; transition: opacity .2s;
  }
  button[type="submit"]:disabled { opacity: .7; cursor: not-allowed; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip: rect(0,0,0,0); white-space: nowrap;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  .shake { animation: shake 0.4s ease; }
`;

interface FieldState {
  value: string;
  touched: boolean;
  error: string;
}

class EcollectCardForm extends HTMLElement {
  private shadow: ShadowRoot;
  private fields: Record<string, FieldState> = {
    cardNumber:    { value: '', touched: false, error: '' },
    expiry:        { value: '', touched: false, error: '' },
    cvv:           { value: '', touched: false, error: '' },
    cardHolderName:{ value: '', touched: false, error: '' },
    email:         { value: '', touched: false, error: '' },
  };
  private brand: BrandInfo = detectBrand('');
  private isSubmitting = false;
  private msgs: CardFormMessages = getMessages('es');

  static get observedAttributes() {
    return ['language', 'submit-label', 'show-name', 'show-email', 'theme-primary'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const lang = this.getAttribute('language') ?? 'es';
    this.msgs = getMessages(lang);
    warnIfInsecure(false);
    this.render();
    this.attachEvents();
    this.dispatchEvent(new CustomEvent('ecollect:ready', { bubbles: true, composed: true }));
  }

  attributeChangedCallback() {
    if (this.shadow.innerHTML) {
      const lang = this.getAttribute('language') ?? 'es';
      this.msgs = getMessages(lang);
      this.render();
      this.attachEvents();
    }
  }

  private get lang() { return this.getAttribute('language') ?? 'es'; }
  private get submitLabel() {
    return this.getAttribute('submit-label') ?? (this.lang === 'es' ? 'Tokenizar tarjeta' : 'Tokenize card');
  }
  private get showName() { return this.getAttribute('show-name') !== 'false'; }
  private get showEmail() { return this.getAttribute('show-email') === 'true'; }
  private get themePrimary() { return this.getAttribute('theme-primary') ?? '#6366f1'; }

  private render() {
    const f = this.fields;
    const brand = this.brand;
    const msgs = this.msgs;
    const lang = this.lang;

    const inputStyle = (key: string) => {
      const st = f[key];
      if (!st) return '';
      const err = st.error && st.touched;
      const valid = st.touched && !st.error && st.value.length > 0;
      return `${err ? 'data-error="true"' : ''} ${valid ? 'data-valid="true"' : ''}`;
    };

    const errorHtml = (key: string) => {
      const st = f[key];
      if (!st || !st.touched || !st.error) return '';
      return `<span class="error-msg" role="alert">✕ ${st.error}</span>`;
    };

    const html = `
      <style>${STYLES.replace('#6366f1', this.themePrimary).replace('#4f46e5', this.themePrimary)}</style>
      <span class="sr-only" aria-live="polite" aria-atomic="true" id="brand-announcer">
        ${brand.brand !== 'Unknown' ? interpolate(msgs.brandDetected, { brand: brand.brand }) : ''}
      </span>
      <form id="ecollect-form" novalidate>
        <div class="field-group">
          <label for="ec-cardNumber">${lang === 'es' ? 'Número de tarjeta' : 'Card number'}</label>
          <div class="input-wrap">
            <input
              id="ec-cardNumber" name="cardNumber"
              type="tel" inputmode="numeric" autocomplete="cc-number"
              placeholder="1234 5678 9012 3456" maxlength="23"
              value="${f.cardNumber.value}"
              aria-invalid="${!!f.cardNumber.error || false}"
              ${inputStyle('cardNumber')}
            />
            ${brand.brand !== 'Unknown'
              ? `<span class="brand-badge" style="background:${brand.color}">${brand.brand}</span>`
              : ''}
          </div>
          ${errorHtml('cardNumber')}
        </div>

        <div class="row">
          <div class="field-group">
            <label for="ec-expiry">${lang === 'es' ? 'Vencimiento' : 'Expiry'}</label>
            <input
              id="ec-expiry" name="expiry"
              type="tel" inputmode="numeric" autocomplete="cc-exp"
              placeholder="MM / YY" maxlength="7"
              value="${f.expiry.value}"
              aria-invalid="${!!f.expiry.error || false}"
              ${inputStyle('expiry')}
            />
            ${errorHtml('expiry')}
          </div>
          <div class="field-group">
            <label for="ec-cvv">${lang === 'es' ? 'Código de seguridad' : 'Security Code'}</label>
            <input
              id="ec-cvv" name="cvv"
              type="tel" inputmode="numeric" autocomplete="cc-csc"
              placeholder="${brand.brand === 'Amex' ? '1234' : '123'}"
              maxlength="${getCvvLength(brand.brand)}"
              value="${f.cvv.value}"
              aria-invalid="${!!f.cvv.error || false}"
              ${inputStyle('cvv')}
            />
            ${errorHtml('cvv')}
          </div>
        </div>

        ${this.showName ? `
        <div class="field-group">
          <label for="ec-name">
            ${lang === 'es' ? 'Nombre del titular' : 'Cardholder name'}
            <span class="optional"> (${lang === 'es' ? 'opcional' : 'optional'})</span>
          </label>
          <input
            id="ec-name" name="cardHolderName"
            type="text" autocomplete="cc-name"
            placeholder="${lang === 'es' ? 'Como aparece en la tarjeta' : 'As it appears on the card'}"
            value="${f.cardHolderName.value}"
            ${inputStyle('cardHolderName')}
          />
          ${errorHtml('cardHolderName')}
        </div>` : ''}

        ${this.showEmail ? `
        <div class="field-group">
          <label for="ec-email">
            ${lang === 'es' ? 'Correo electrónico' : 'Email'}
            <span class="optional"> (${lang === 'es' ? 'opcional' : 'optional'})</span>
          </label>
          <input
            id="ec-email" name="email"
            type="email" autocomplete="email"
            placeholder="correo@ejemplo.com"
            value="${f.email.value}"
            aria-invalid="${!!f.email.error || false}"
            ${inputStyle('email')}
          />
          ${errorHtml('email')}
        </div>` : ''}

        <button type="submit" ${this.isSubmitting ? 'disabled' : ''}>
          ${this.isSubmitting ? msgs.submitting : this.submitLabel}
        </button>
      </form>
    `;

    this.shadow.innerHTML = html;
  }

  private attachEvents() {
    const form = this.shadow.getElementById('ecollect-form');
    if (!form) return;

    const inputs = form.querySelectorAll<HTMLInputElement>('input');
    inputs.forEach((input) => {
      const field = input.name;

      input.addEventListener('input', (e) => {
        this.handleChange(field, (e.target as HTMLInputElement).value);
      });

      input.addEventListener('blur', () => {
        this.handleBlur(field);
      });

      if (field === 'cardNumber') {
        input.addEventListener('keydown', (e) => {
          this.handleKeyDown(e as KeyboardEvent, input);
        });

        input.addEventListener('paste', (e) => {
          this.handlePaste(e as ClipboardEvent);
        });
      }
    });

    form.addEventListener('submit', (e) => {
      this.handleSubmit(e);
    });
  }

  private fieldMsgs() {
    return {
      cardNumber: this.msgs.cardNumber as Required<typeof this.msgs.cardNumber>,
      expiry: this.msgs.expiry as Required<typeof this.msgs.expiry>,
      cvv: this.msgs.cvv as Required<typeof this.msgs.cvv>,
      cardHolderName: this.msgs.cardHolderName as Required<typeof this.msgs.cardHolderName>,
      email: this.msgs.email as Required<typeof this.msgs.email>,
      cardHolderId: this.msgs.cardHolderId as Required<typeof this.msgs.cardHolderId>,
    };
  }

  private handleChange(field: string, value: string) {
    let formatted = value;
    if (field === 'cardNumber') {
      const digits = sanitizeNumber(value);
      this.brand = detectBrand(digits);
      formatted = formatCardNumberAuto(digits);
    } else if (field === 'expiry') {
      formatted = formatExpiry(value);
    } else if (field === 'cvv') {
      formatted = sanitizeNumber(value).slice(0, getCvvLength(this.brand.brand));
    }

    this.fields[field].value = formatted;

    if (this.fields[field].touched) {
      const err = validateField(field as keyof CardFormErrors, formatted, this.fieldMsgs(), this.brand.brand);
      this.fields[field].error = err ?? '';
    }

    this.render();
    this.attachEvents();

    // Restore focus
    const input = this.shadow.querySelector<HTMLInputElement>(`[name="${field}"]`);
    if (input) {
      input.focus();
      if (field === 'cardNumber' || field === 'expiry' || field === 'cvv') {
        const pos = formatted.length;
        input.setSelectionRange(pos, pos);
      }
    }
  }

  private handleBlur(field: string) {
    this.fields[field].touched = true;
    const value = this.fields[field].value ?? '';
    const err = validateField(field as keyof CardFormErrors, value, this.fieldMsgs(), this.brand.brand);
    this.fields[field].error = err ?? '';
    this.render();
    this.attachEvents();
  }

  private handleKeyDown(e: KeyboardEvent, input: HTMLInputElement) {
    if (e.key === 'Backspace') {
      const cursor = input.selectionStart ?? 0;
      if (cursor > 0 && this.fields.cardNumber.value[cursor - 1] === ' ') {
        e.preventDefault();
        const { value: newRaw, cursorPos } = handleCardNumberBackspace(this.fields.cardNumber.value, cursor);
        this.brand = detectBrand(newRaw);
        this.fields.cardNumber.value = formatCardNumberAuto(newRaw);
        this.render();
        this.attachEvents();
        requestAnimationFrame(() => {
          const inp = this.shadow.querySelector<HTMLInputElement>('[name="cardNumber"]');
          inp?.setSelectionRange(cursorPos, cursorPos);
        });
      }
    }
  }

  private handlePaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text') ?? '';
    const parsed = parseMultiFieldPaste(text);
    if (parsed.cardNumber || parsed.expiry) {
      e.preventDefault();
      if (parsed.cardNumber) {
        this.brand = detectBrand(parsed.cardNumber);
        this.fields.cardNumber.value = formatCardNumberAuto(parsed.cardNumber);
      }
      if (parsed.expiry) this.fields.expiry.value = parsed.expiry;
      if (parsed.cvv) this.fields.cvv.value = parsed.cvv;
      if (parsed.cardHolderName) this.fields.cardHolderName.value = parsed.cardHolderName;
      this.render();
      this.attachEvents();
    }
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    if (this.isSubmitting) return;

    const required = ['cardNumber', 'expiry', 'cvv'];
    required.forEach((f) => {
      this.fields[f].touched = true;
      const err = validateField(f as keyof CardFormErrors, this.fields[f].value, this.fieldMsgs(), this.brand.brand);
      this.fields[f].error = err ?? '';
    });

    const hasErrors = Object.values(this.fields).some((st) => st.error);
    if (hasErrors) {
      this.render();
      this.attachEvents();
      const form = this.shadow.getElementById('ecollect-form');
      if (form) {
        form.classList.add('shake');
        form.addEventListener('animationend', () => form.classList.remove('shake'), { once: true });
      }
      return;
    }

    this.isSubmitting = true;
    this.render();
    this.attachEvents();

    const cardFormData = {
      cardNumber: sanitizeNumber(this.fields.cardNumber.value),
      expirationDate: expiryToApiFormat(this.fields.expiry.value),
      secureCode: this.fields.cvv.value,
      cardHolderName: this.fields.cardHolderName.value,
      email: this.fields.email.value || undefined,
      cardHolderIdType: undefined as string | undefined,
      cardHolderId: undefined as string | undefined,
      mobileCountryCode: undefined as string | undefined,
      mobileNumber: undefined as string | undefined,
      paymentSystem: this.brand.paymentSystem,
      brand: this.brand.brand,
    };

    const payload: CardFormSubmitPayload = { cardFormData };

    this.dispatchEvent(new CustomEvent('ecollect:submit', {
      detail: payload,
      bubbles: true,
      composed: true,
    }));

    clearSensitiveData(cardFormData);
    this.isSubmitting = false;
    this.render();
    this.attachEvents();
  }

  /** Public method: configure(config) for complex config via JS */
  configure(config: Record<string, unknown>) {
    if (config.language) this.setAttribute('language', String(config.language));
    if (config.submitLabel) this.setAttribute('submit-label', String(config.submitLabel));
    if (config.showName !== undefined) this.setAttribute('show-name', String(config.showName));
    if (config.showEmail !== undefined) this.setAttribute('show-email', String(config.showEmail));
    if (config.themePrimary) this.setAttribute('theme-primary', String(config.themePrimary));
  }
}

if (typeof customElements !== 'undefined') {
  if (!customElements.get('ecollect-card-form')) {
    customElements.define('ecollect-card-form', EcollectCardForm);
  }
}

export { EcollectCardForm };
