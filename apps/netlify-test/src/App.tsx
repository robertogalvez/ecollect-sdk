import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardForm {
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardHolderName: string;
  email: string;
  docType: string;
  docNumber: string;
  mobileCountryCode: string;
  mobileNumber: string;
  amount: string;
  currency: string;
}

interface SavedToken {
  tokenId: string;
  maskedCard: string;
  brand: string;
  expiry: string;
}

type Step = 'init' | 'form' | 'methods' | 'tokens' | 'done';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectBrand(num: string): { name: string; color: string; icon: string } {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n))                        return { name: 'Visa',       color: '#1a1f71', icon: '💳' };
  if (/^5[1-5]/.test(n))                  return { name: 'Mastercard', color: '#eb001b', icon: '💳' };
  if (/^3[47]/.test(n))                   return { name: 'Amex',       color: '#007bc1', icon: '💳' };
  if (/^6(?:011|5)/.test(n))              return { name: 'Discover',   color: '#ff6600', icon: '💳' };
  if (/^3(?:0[0-5]|[68])/.test(n))       return { name: 'Diners',     color: '#004a97', icon: '💳' };
  return { name: '', color: '#6b7280', icon: '💳' };
}

function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 4);
  if (digits.length >= 3) return `${digits.substring(0, 2)}/${digits.substring(2)}`;
  return digits;
}

function expiryToApiFormat(expiry: string): string {
  // Convert MM/YY → MM/YYYY
  const [mm, yy] = expiry.split('/');
  if (!mm || !yy) return expiry;
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${mm}/${year}`;
}

function paymentSystemFromBrand(brand: string): string {
  const map: Record<string, string> = {
    Visa: '1', Mastercard: '2', Amex: '3', Discover: '6',
  };
  return map[brand] ?? '1';
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function callProxy(endpoint: string, payload: Record<string, unknown> = {}) {
  const { data } = await axios.post('/.netlify/functions/ecollect-proxy', {
    endpoint,
    ...payload,
  });
  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardPreview({ form, flipped }: { form: CardForm; flipped: boolean }) {
  const brand = detectBrand(form.cardNumber);
  const display = form.cardNumber.padEnd(19, '·').substring(0, 19);

  return (
    <div className={`card-preview ${flipped ? 'flipped' : ''}`}>
      <div className="card-front" style={{ background: `linear-gradient(135deg, ${brand.color} 0%, #2d3748 100%)` }}>
        <div className="card-chip">
          <div className="chip-lines" />
        </div>
        <div className="card-number-display">
          {display.replace(/(.{4})/g, '$1 ').trim()}
        </div>
        <div className="card-bottom">
          <div>
            <div className="card-label">Titular</div>
            <div className="card-value">{form.cardHolderName || 'NOMBRE APELLIDO'}</div>
          </div>
          <div>
            <div className="card-label">Vence</div>
            <div className="card-value">{form.expiry || 'MM/AA'}</div>
          </div>
          {brand.name && <div className="card-brand">{brand.name}</div>}
        </div>
      </div>
      <div className="card-back">
        <div className="card-stripe" />
        <div className="card-cvv-area">
          <div className="card-label">CVV</div>
          <div className="cvv-box">{form.cvv ? '•'.repeat(form.cvv.length) : '•••'}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ step, sessionActive }: { step: Step; sessionActive: boolean }) {
  return (
    <div className="status-bar">
      <span className={`badge ${sessionActive ? 'badge-green' : 'badge-gray'}`}>
        {sessionActive ? '🔐 Sesión activa' : '🔒 Sin sesión'}
      </span>
      <span className="badge badge-blue">
        {step === 'init' && '① Iniciar sesión'}
        {step === 'form' && '② Datos de tarjeta'}
        {step === 'methods' && '③ Métodos de pago'}
        {step === 'tokens' && '④ Tokens guardados'}
        {step === 'done' && '✅ Completado'}
      </span>
    </div>
  );
}

function ResponsePanel({ data, label }: { data: unknown; label: string }) {
  const success = (data as any)?.ReturnCode === 'SUCCESS';
  return (
    <div className={`response-panel ${success ? 'response-success' : 'response-error'}`}>
      <div className="response-header">
        <span>{success ? '✅' : '⚠️'} {label}</span>
        <span className={`rc-badge ${success ? 'rc-ok' : 'rc-fail'}`}>
          {(data as any)?.ReturnCode ?? 'ERROR'}
        </span>
      </div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep]               = useState<Step>('init');
  const [sessionToken, setSessionToken] = useState('');
  const [loading, setLoading]         = useState(false);
  const [flipped, setFlipped]         = useState(false);
  const [response, setResponse]       = useState<{ label: string; data: unknown } | null>(null);
  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);
  const [paymentSystems, setPaymentSystems] = useState<any[]>([]);

  const [form, setForm] = useState<CardForm>({
    cardNumber:        '',
    expiry:            '',
    cvv:               '',
    cardHolderName:    '',
    email:             '',
    docType:           'CC',
    docNumber:         '',
    mobileCountryCode: '57',
    mobileNumber:      '',
    amount:            '',
    currency:          'COP',
  });

  const brand = detectBrand(form.cardNumber);

  function setField(field: keyof CardForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setLoading(true);
    setResponse(null);
    try {
      const data = await fn();
      setResponse({ label, data });
      return data as any;
    } catch (err: any) {
      setResponse({ label, data: { error: err?.response?.data?.error ?? err.message } });
    } finally {
      setLoading(false);
    }
  }

  // ① Get Session Token
  async function handleGetSession() {
    const data = await run('getSessionToken', () => callProxy('getSessionToken'));
    if (data?.ReturnCode === 'SUCCESS' && data?.SessionToken) {
      setSessionToken(data.SessionToken);
      setStep('form');
    }
  }

  // ② Save Token
  async function handleSaveToken() {
    if (!sessionToken) return;
    const raw = form.cardNumber.replace(/\s/g, '');
    const data = await run('tokenCommand — SAVE', () =>
      callProxy('tokenCommand', {
        SessionToken: sessionToken,
        Command: 'SAVE',
        TokenInfoArray: [
          { AttributeCode: 0,  AttributeDesc: 'CardNumber',         AttributeValue: raw },
          { AttributeCode: 2,  AttributeDesc: 'PaymentSystem',      AttributeValue: paymentSystemFromBrand(brand.name) },
          { AttributeCode: 4,  AttributeDesc: 'ExpirationDate',     AttributeValue: expiryToApiFormat(form.expiry) },
          { AttributeCode: 6,  AttributeDesc: 'Usermail',           AttributeValue: form.email },
          { AttributeCode: 7,  AttributeDesc: 'MobileCountryCode',  AttributeValue: form.mobileCountryCode },
          { AttributeCode: 8,  AttributeDesc: 'MobileNumber',       AttributeValue: form.mobileNumber },
          { AttributeCode: 17, AttributeDesc: 'CardHolderName',     AttributeValue: form.cardHolderName },
          { AttributeCode: 18, AttributeDesc: 'CardHolderIdType',   AttributeValue: form.docType },
          { AttributeCode: 19, AttributeDesc: 'CardHolderId',       AttributeValue: form.docNumber },
          { AttributeCode: 22, AttributeDesc: 'AccountType',        AttributeValue: '0' },
        ],
      })
    );
    if (data?.ReturnCode === 'SUCCESS') {
      setStep('done');
    }
  }

  // ③ Query Tokens
  async function handleQueryTokens() {
    if (!sessionToken) return;
    const data = await run('queryToken', () =>
      callProxy('queryToken', {
        SessionToken: sessionToken,
        TokenInfoArray: [
          { AttributeCode: 6,  AttributeDesc: 'Usermail',      AttributeValue: form.email },
          { AttributeCode: 19, AttributeDesc: 'CardHolderId',  AttributeValue: form.docNumber },
        ],
      })
    );
    if (data?.TokenArray) {
      const tokens: SavedToken[] = (data.TokenArray as any[]).map((t: any) => {
        const attrs = t.TokenInfoArray ?? [];
        const find = (code: number) => attrs.find((a: any) => a.AttributeCode === code)?.AttributeValue ?? '';
        return {
          tokenId:    find(1),
          maskedCard: find(12) || find(11),
          brand:      find(9),
          expiry:     find(4),
        };
      });
      setSavedTokens(tokens);
      setStep('tokens');
    }
  }

  // ④ Get Payment Systems
  async function handleGetPaymentSystems() {
    if (!sessionToken) return;
    const data = await run('getPaymentSystem', () =>
      callProxy('getPaymentSystem', { SessionToken: sessionToken })
    );
    if (data?.PaymentSystemArray) {
      setPaymentSystems(data.PaymentSystemArray);
      setStep('methods');
    }
  }

  const canSubmit = form.cardNumber.replace(/\s/g, '').length >= 15
    && form.expiry.length >= 4
    && form.cvv.length >= 3
    && form.cardHolderName.trim().length > 2
    && form.email.includes('@')
    && form.docNumber.length > 3;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span>ecollect <strong>SDK Console</strong></span>
          </div>
          <StatusBadge step={step} sessionActive={!!sessionToken} />
        </div>
      </header>

      <main className="app-main">
        {/* ── STEP 1: Init ── */}
        {step === 'init' && (
          <div className="step-card center">
            <h2>Bienvenido al SDK Test Console</h2>
            <p className="subtitle">Prueba tokenización, consulta de métodos de pago y más en tiempo real contra la API de ecollect.</p>
            <button className="btn-primary btn-large" onClick={handleGetSession} disabled={loading}>
              {loading ? <span className="spinner" /> : '🔐 Iniciar sesión con ecollect'}
            </button>
            <p className="hint">Autenticará usando las credenciales configuradas en el servidor</p>
          </div>
        )}

        {/* ── STEPS 2+: Form + Card preview ── */}
        {step !== 'init' && (
          <div className="form-layout">

            {/* Left: Card preview */}
            <div className="card-column">
              <CardPreview form={form} flipped={flipped} />

              {/* Payment Systems */}
              {paymentSystems.length > 0 && (
                <div className="methods-grid">
                  <h4>Métodos disponibles</h4>
                  {paymentSystems.map((ps: any, i) => (
                    <div key={i} className="method-item">
                      <span className="method-code">{ps.PaymentSystem}</span>
                      <span>{ps.FiArray?.[0]?.FiName ?? `Sistema ${ps.PaymentSystem}`}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Saved Tokens */}
              {savedTokens.length > 0 && (
                <div className="tokens-list">
                  <h4>Tokens guardados</h4>
                  {savedTokens.map((t, i) => (
                    <div key={i} className="token-item">
                      <span className="token-mask">{t.maskedCard || 'XXXX-XXXX'}</span>
                      <span className="token-id">{t.tokenId.substring(0, 20)}…</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Form */}
            <div className="form-column">
              <div className="form-card">
                <h3>Datos de la tarjeta</h3>

                {/* Card Number */}
                <div className="field">
                  <label>Número de tarjeta</label>
                  <div className="input-with-badge">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      value={form.cardNumber}
                      onChange={e => setField('cardNumber', formatCardNumber(e.target.value))}
                      onFocus={() => setFlipped(false)}
                    />
                    {brand.name && <span className="brand-badge" style={{ background: brand.color }}>{brand.name}</span>}
                  </div>
                </div>

                {/* Expiry + CVV */}
                <div className="field-row">
                  <div className="field">
                    <label>Vencimiento</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="MM/AA"
                      maxLength={5}
                      value={form.expiry}
                      onChange={e => setField('expiry', formatExpiry(e.target.value))}
                      onFocus={() => setFlipped(false)}
                    />
                  </div>
                  <div className="field">
                    <label>CVV</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="•••"
                      maxLength={4}
                      value={form.cvv}
                      onChange={e => setField('cvv', e.target.value.replace(/\D/g, ''))}
                      onFocus={() => setFlipped(true)}
                      onBlur={() => setFlipped(false)}
                    />
                  </div>
                </div>

                {/* Cardholder */}
                <div className="field">
                  <label>Nombre del titular</label>
                  <input
                    type="text"
                    placeholder="Como aparece en la tarjeta"
                    value={form.cardHolderName}
                    onChange={e => setField('cardHolderName', e.target.value.toUpperCase())}
                    onFocus={() => setFlipped(false)}
                  />
                </div>

                <div className="divider"><span>Datos del titular</span></div>

                {/* Email */}
                <div className="field">
                  <label>Correo electrónico</label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                  />
                </div>

                {/* Document */}
                <div className="field-row">
                  <div className="field field-narrow">
                    <label>Tipo doc.</label>
                    <select value={form.docType} onChange={e => setField('docType', e.target.value)}>
                      <option value="CC">CC</option>
                      <option value="NIT">NIT</option>
                      <option value="CE">CE</option>
                      <option value="CURP">CURP</option>
                      <option value="RFC">RFC</option>
                      <option value="CI">CI</option>
                      <option value="RNC">RNC</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Número de documento</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="123456789"
                      value={form.docNumber}
                      onChange={e => setField('docNumber', e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="field-row">
                  <div className="field field-narrow">
                    <label>País</label>
                    <select value={form.mobileCountryCode} onChange={e => setField('mobileCountryCode', e.target.value)}>
                      <option value="57">🇨🇴 +57</option>
                      <option value="52">🇲🇽 +52</option>
                      <option value="1">🇩🇴 +1</option>
                      <option value="1">🇺🇸 +1</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Teléfono móvil</label>
                    <input
                      type="text"
                      inputMode="tel"
                      placeholder="311 123 4567"
                      value={form.mobileNumber}
                      onChange={e => setField('mobileNumber', e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <div className="divider"><span>Monto (opcional)</span></div>

                {/* Amount */}
                <div className="field-row">
                  <div className="field">
                    <label>Monto</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="50000"
                      value={form.amount}
                      onChange={e => setField('amount', e.target.value.replace(/[^\d.]/g, ''))}
                    />
                  </div>
                  <div className="field field-narrow">
                    <label>Moneda</label>
                    <select value={form.currency} onChange={e => setField('currency', e.target.value)}>
                      <option value="COP">COP</option>
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                      <option value="DOP">DOP</option>
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="action-grid">
                  <button
                    className="btn-primary"
                    onClick={handleSaveToken}
                    disabled={loading || !canSubmit}
                    title="Tokenizar tarjeta con tokenCommand SAVE"
                  >
                    {loading ? <span className="spinner" /> : '💾 Tokenizar tarjeta'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={handleQueryTokens}
                    disabled={loading || !form.email || !form.docNumber}
                    title="Consultar tokens guardados con queryToken"
                  >
                    🔍 Ver tokens
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={handleGetPaymentSystems}
                    disabled={loading}
                    title="Listar métodos de pago con getPaymentSystem"
                  >
                    🏦 Métodos de pago
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => { setStep('init'); setSessionToken(''); setResponse(null); setSavedTokens([]); setPaymentSystems([]); }}
                    disabled={loading}
                  >
                    🔄 Nueva sesión
                  </button>
                </div>
              </div>

              {/* Response */}
              {response && <ResponsePanel data={response.data} label={response.label} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
