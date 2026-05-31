import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  forwardRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
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
  BrandInfo,
} from '@ecollect/ui-core';

@Component({
  selector: 'ecollect-card-form-full',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CardFormFullComponent),
      multi: true,
    },
  ],
  template: `
    <form (ngSubmit)="handleSubmit($event)" novalidate style="display:flex;flex-direction:column;gap:16px;font-family:inherit;">
      <!-- Screen reader brand announcement -->
      <span aria-live="polite" aria-atomic="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">
        {{ brand.brand !== 'Unknown' ? msgs.brandDetected.replace('{brand}', brand.brand) : '' }}
      </span>

      <!-- Card number -->
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="ng-cardNumber" [style]="labelStyle">
          {{ lang === 'es' ? 'Número de tarjeta' : 'Card number' }}
        </label>
        <div style="position:relative;">
          <input
            id="ng-cardNumber"
            type="tel"
            inputmode="numeric"
            autocomplete="cc-number"
            placeholder="1234 5678 9012 3456"
            maxlength="23"
            [value]="fields.cardNumber"
            [attr.aria-invalid]="!!errors['cardNumber'] || null"
            (input)="handleChange('cardNumber', $any($event.target).value)"
            (blur)="handleBlur('cardNumber')"
            (keydown)="handleKeyDown('cardNumber', $event)"
            (paste)="handlePaste($event)"
            [style]="inputStyle('cardNumber', fields.cardNumber)"
          />
          <span *ngIf="brand.brand !== 'Unknown'"
            [style]="'position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:.72rem;font-weight:700;color:#fff;background:' + brand.color + ';padding:2px 8px;border-radius:4px;'">
            {{ brand.brand }}
          </span>
        </div>
        <span *ngIf="isTouched('cardNumber') && errors['cardNumber']" role="alert" style="color:#ef4444;font-size:.78rem;">
          ✕ {{ errors['cardNumber'] }}
        </span>
      </div>

      <!-- Expiry + CVV -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label for="ng-expiry" [style]="labelStyle">{{ lang === 'es' ? 'Vencimiento' : 'Expiry' }}</label>
          <input id="ng-expiry" type="tel" inputmode="numeric" autocomplete="cc-exp"
            placeholder="MM / YY" maxlength="7"
            [value]="fields.expiry"
            [attr.aria-invalid]="!!errors['expiry'] || null"
            (input)="handleChange('expiry', $any($event.target).value)"
            (blur)="handleBlur('expiry')"
            [style]="inputStyle('expiry', fields.expiry)"
          />
          <span *ngIf="isTouched('expiry') && errors['expiry']" role="alert" style="color:#ef4444;font-size:.78rem;">✕ {{ errors['expiry'] }}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label for="ng-cvv" [style]="labelStyle">{{ lang === 'es' ? 'Código de seguridad' : 'Security Code' }}</label>
          <input id="ng-cvv" type="tel" inputmode="numeric" autocomplete="cc-csc"
            [placeholder]="brand.brand === 'Amex' ? '1234' : '123'"
            [maxlength]="getCvvLength(brand.brand)"
            [value]="fields.cvv"
            [attr.aria-invalid]="!!errors['cvv'] || null"
            (input)="handleChange('cvv', $any($event.target).value)"
            (blur)="handleBlur('cvv')"
            [style]="inputStyle('cvv', fields.cvv)"
          />
          <span *ngIf="isTouched('cvv') && errors['cvv']" role="alert" style="color:#ef4444;font-size:.78rem;">✕ {{ errors['cvv'] }}</span>
        </div>
      </div>

      <!-- Cardholder name (optional by default) -->
      <div *ngIf="showNameField" style="display:flex;flex-direction:column;gap:6px;">
        <label for="ng-name" [style]="labelStyle">
          {{ lang === 'es' ? 'Nombre del titular' : 'Cardholder name' }}
          <span *ngIf="!nameRequired" style="font-weight:400;text-transform:none;color:#94a3b8;font-size:.72rem;"> (opcional)</span>
        </label>
        <input id="ng-name" type="text" autocomplete="cc-name"
          [placeholder]="lang === 'es' ? 'Como aparece en la tarjeta' : 'As it appears on the card'"
          [value]="fields.cardHolderName"
          (input)="handleChange('cardHolderName', $any($event.target).value)"
          (blur)="handleBlur('cardHolderName')"
          [style]="inputStyle('cardHolderName', fields.cardHolderName)"
        />
      </div>

      <!-- Email -->
      <div *ngIf="showEmail" style="display:flex;flex-direction:column;gap:6px;">
        <label for="ng-email" [style]="labelStyle">
          {{ lang === 'es' ? 'Correo electrónico' : 'Email' }}
          <span *ngIf="!emailRequired" style="font-weight:400;text-transform:none;color:#94a3b8;font-size:.72rem;"> (opcional)</span>
        </label>
        <input id="ng-email" type="email" autocomplete="email" placeholder="correo@ejemplo.com"
          [value]="fields.email"
          [attr.aria-invalid]="!!errors['email'] || null"
          (input)="handleChange('email', $any($event.target).value)"
          (blur)="handleBlur('email')"
          [style]="inputStyle('email', fields.email)"
        />
        <span *ngIf="isTouched('email') && errors['email']" role="alert" style="color:#ef4444;font-size:.78rem;">✕ {{ errors['email'] }}</span>
      </div>

      <button type="submit"
        [disabled]="isSubmitting"
        [style]="'padding:14px 24px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:' + (isSubmitting ? 'not-allowed' : 'pointer') + ';width:100%;margin-top:8px;opacity:' + (isSubmitting ? 0.7 : 1)"
      >
        {{ isSubmitting ? msgs.submitting : submitLabel }}
      </button>
    </form>
  `,
})
export class CardFormFullComponent implements OnInit, ControlValueAccessor {
  @Input() config: CardFormProps['config'] = {};

  private _onChange: (value: CardFormSubmitPayload) => void = () => {};
  private _onTouched: () => void = () => {};

  fields = { cardNumber: '', expiry: '', cvv: '', cardHolderName: '', email: '', cardHolderIdType: '', cardHolderId: '', mobileCountryCode: '', mobileNumber: '' };
  errors: CardFormErrors = {};
  touched = new Set<string>();
  brand: BrandInfo = detectBrand('');
  isSubmitting = false;
  msgs = getMessages('es');

  readonly labelStyle = 'font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;';
  readonly getCvvLength = getCvvLength;

  get lang() { return this.config?.language ?? 'es'; }
  get submitLabel() { return this.config?.submitLabel ?? (this.lang === 'es' ? 'Tokenizar tarjeta' : 'Tokenize card'); }
  get showNameField() { return this.config?.fields?.cardHolderName?.show !== false; }
  get nameRequired() { return this.config?.fields?.cardHolderName?.required === true; }
  get showEmail() { return this.config?.fields?.email?.show === true; }
  get emailRequired() { return this.config?.fields?.email?.required === true; }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.msgs = getMessages(this.lang, this.config?.messages);
    warnIfInsecure(this.config?.insecureContextOverride);
  }

  isTouched(f: string) { return this.touched.has(f); }
  isFieldValid(f: string, v: string) { return this.touched.has(f) && !this.errors[f] && v.length > 0; }

  inputStyle(field: string, value: string) {
    const err = this.errors[field];
    const valid = this.isFieldValid(field, value);
    const border = err ? '#ef4444' : valid ? '#10b981' : '#e2e8f0';
    return `padding:11px 14px;border:1.5px solid ${border};border-radius:10px;font-size:.95rem;color:#1a202c;background:#fff;outline:none;width:100%;box-sizing:border-box;font-family:inherit;`;
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

  handleChange(field: string, value: string) {
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
    (this.fields as Record<string, string>)[field] = formatted;
    if (this.touched.has(field)) {
      const err = validateField(field as keyof CardFormErrors, formatted, this.fieldMsgs(), this.brand.brand);
      if (!err) delete this.errors[field];
      else this.errors[field] = err;
    }
    this.cdr.markForCheck();
  }

  handleBlur(field: string) {
    this.touched.add(field);
    const value = (this.fields as Record<string, string>)[field] ?? '';
    const err = validateField(field as keyof CardFormErrors, value, this.fieldMsgs(), this.brand.brand);
    if (err) this.errors[field] = err;
    else delete this.errors[field];
    this._onTouched();
    this.cdr.markForCheck();
  }

  handleKeyDown(field: string, e: KeyboardEvent) {
    if (field === 'cardNumber' && e.key === 'Backspace') {
      const input = e.target as HTMLInputElement;
      const cursor = input.selectionStart ?? 0;
      if (cursor > 0 && this.fields.cardNumber[cursor - 1] === ' ') {
        e.preventDefault();
        const { value: newRaw, cursorPos } = handleCardNumberBackspace(this.fields.cardNumber, cursor);
        this.brand = detectBrand(newRaw);
        this.fields.cardNumber = formatCardNumberAuto(newRaw);
        requestAnimationFrame(() => input.setSelectionRange(cursorPos, cursorPos));
        this.cdr.markForCheck();
      }
    }
  }

  handlePaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text') ?? '';
    const parsed = parseMultiFieldPaste(text);
    if (parsed.cardNumber || parsed.expiry) {
      e.preventDefault();
      if (parsed.cardNumber) { this.brand = detectBrand(parsed.cardNumber); this.fields.cardNumber = formatCardNumberAuto(parsed.cardNumber); }
      if (parsed.expiry) this.fields.expiry = parsed.expiry;
      if (parsed.cvv) this.fields.cvv = parsed.cvv;
      if (parsed.cardHolderName) this.fields.cardHolderName = parsed.cardHolderName;
      this.cdr.markForCheck();
    }
  }

  async handleSubmit(e: Event) {
    e.preventDefault();
    if (this.isSubmitting) return;

    ['cardNumber', 'expiry', 'cvv'].forEach(f => {
      this.touched.add(f);
      const val = (this.fields as Record<string, string>)[f] ?? '';
      const err = validateField(f as keyof CardFormErrors, val, this.fieldMsgs(), this.brand.brand);
      if (err) this.errors[f] = err;
      else delete this.errors[f];
    });
    if (Object.keys(this.errors).length > 0) { this.cdr.markForCheck(); return; }

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const cardFormData = {
      cardNumber: sanitizeNumber(this.fields.cardNumber),
      expirationDate: expiryToApiFormat(this.fields.expiry),
      secureCode: this.fields.cvv,
      cardHolderName: this.fields.cardHolderName,
      email: this.fields.email || undefined,
      cardHolderIdType: this.fields.cardHolderIdType || undefined,
      cardHolderId: this.fields.cardHolderId || undefined,
      mobileCountryCode: this.fields.mobileCountryCode || undefined,
      mobileNumber: this.fields.mobileNumber || undefined,
      paymentSystem: this.brand.paymentSystem,
      brand: this.brand.brand,
    };

    const payload: CardFormSubmitPayload = { cardFormData };
    this._onChange(payload);
    clearSensitiveData(cardFormData);
    this.isSubmitting = false;
    this.cdr.markForCheck();
  }

  // ControlValueAccessor
  writeValue(value: unknown): void { /* read-only form — value flows out via onChange */ }
  registerOnChange(fn: (v: CardFormSubmitPayload) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.isSubmitting = isDisabled; }
}

export { CardFormFullComponent as CardFormFull };
