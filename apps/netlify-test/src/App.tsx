import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FiImageItem {
  FiCode: string;
  FindKeys?: string;
  BrandImageUrl?: string;
}

interface PaymentSystemItem {
  PaymentSystem: string;
  BrandImageUrl?: string;
  FiImagesArray?: FiImageItem[];
}

interface DetectedCard {
  paymentSystem: string;
  fiCode: string;
  brandImageUrl?: string;
}

interface ApiResponse {
  ReturnCode?: string;
  SessionToken?: string;
  TicketId?: number;
  TokenInfoArray?: any[];
  PaymentSystemArray?: PaymentSystemItem[];
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// BIN detection helper
// ---------------------------------------------------------------------------

function detectCardFromBin(
  bin: string,
  paymentSystems: PaymentSystemItem[],
): DetectedCard | null {
  for (const ps of paymentSystems) {
    for (const fi of ps.FiImagesArray ?? []) {
      const keys = (fi.FindKeys ?? '').split(',').map((k) => k.trim()).filter(Boolean);
      for (const key of keys) {
        if (bin.startsWith(key)) {
          return {
            paymentSystem: ps.PaymentSystem,
            fiCode: fi.FiCode,
            brandImageUrl: fi.BrandImageUrl,
          };
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Country / doc-type options
// ---------------------------------------------------------------------------

const COUNTRIES = [
  { code: 'co', dial: '57', label: 'co +57' },
  { code: 'mx', dial: '52', label: 'mx +52' },
  { code: 'do', dial: '1829', label: 'do +1' },
];

const DOC_TYPES = ['CC', 'CE', 'NIT', 'PP', 'CURP', 'RNC', 'RUC'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  // Session & UI state
  const [sessionToken, setSessionToken] = useState('');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');

  // Available payment systems (loaded once on mount)
  const [paymentSystems, setPaymentSystems] = useState<PaymentSystemItem[]>([]);

  // Auto-detected card brand from BIN lookup
  const [detectedCard, setDetectedCard] = useState<DetectedCard | null>(null);
  const binLookupRef = useRef(''); // last BIN we looked up to avoid duplicate calls

  // Card form fields
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [holderName, setHolderName] = useState('');
  const [email, setEmail] = useState('');
  const [docType, setDocType] = useState('CC');
  const [docNumber, setDocNumber] = useState('');
  const [country, setCountry] = useState('co');
  const [phone, setPhone] = useState('');
  const [saveCard, setSaveCard] = useState(true);

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------

  const callApi = async (endpoint: string, payload: any = {}): Promise<ApiResponse> => {
    const { data } = await axios.post<ApiResponse>('/.netlify/functions/ecollect-proxy', {
      endpoint,
      ...payload,
    });
    return data;
  };

  // ---------------------------------------------------------------------------
  // Step 1 — get session token (called automatically on mount)
  // ---------------------------------------------------------------------------

  const ensureSession = async (): Promise<string> => {
    if (sessionToken) return sessionToken;
    const data = await callApi('getSessionToken');
    const token = data.SessionToken ?? '';
    setSessionToken(token);
    return token;
  };

  // On mount: get session + payment systems
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setLoadingLabel('Inicializando…');
      try {
        const token = await ensureSession();
        const data = await callApi('getPaymentSystem', { SessionToken: token });
        setPaymentSystems(data.PaymentSystemArray ?? []);
      } catch (err: any) {
        setResponse({ error: err.message });
      } finally {
        setLoading(false);
        setLoadingLabel('');
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Step 2 — BIN detection when ≥6 digits are entered
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const digits = cardNumber.replace(/\s/g, '');
    if (digits.length < 6) {
      setDetectedCard(null);
      return;
    }

    const bin = digits.slice(0, 6);
    if (bin === binLookupRef.current) return; // already matched this BIN
    binLookupRef.current = bin;

    // Try local match first (payment systems already loaded)
    if (paymentSystems.length > 0) {
      setDetectedCard(detectCardFromBin(bin, paymentSystems));
    }
  }, [cardNumber, paymentSystems]);

  // ---------------------------------------------------------------------------
  // Card number formatter — adds spaces every 4 digits
  // ---------------------------------------------------------------------------

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCardNumber(raw.replace(/(.{4})/g, '$1 ').trim());
  };

  // Expiry formatter — MM/YY
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setExpiry(raw);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 3 — Tokenize card
  // ---------------------------------------------------------------------------

  const handleTokenize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detectedCard) {
      alert('No se pudo detectar el tipo de tarjeta. Revisa el número ingresado.');
      return;
    }

    setLoading(true);
    setLoadingLabel('Tokenizando…');
    setResponse(null);

    try {
      const token = await ensureSession();

      // Convert MM/YY → MM/YYYY for the API
      const [mm, yy] = expiry.split('/');
      const expirationDate = yy && yy.length === 2 ? `${mm}/20${yy}` : expiry;

      const countryDial = COUNTRIES.find((c) => c.code === country)?.dial ?? '57';
      const command = saveCard ? 'SAVE' : 'GET';

      const tokenInfoArray = [
        { AttributeCode: 0,  AttributeDesc: 'CardNumber',        AttributeValue: cardNumber.replace(/\s/g, '') },
        { AttributeCode: 2,  AttributeDesc: 'PaymentSystem',     AttributeValue: detectedCard.paymentSystem },
        { AttributeCode: 3,  AttributeDesc: 'SecureCode',        AttributeValue: cvv },
        { AttributeCode: 4,  AttributeDesc: 'ExpirationDate',    AttributeValue: expirationDate },
        { AttributeCode: 6,  AttributeDesc: 'Usermail',          AttributeValue: email },
        { AttributeCode: 7,  AttributeDesc: 'MobileCountryCode', AttributeValue: countryDial },
        { AttributeCode: 8,  AttributeDesc: 'MobileNumber',      AttributeValue: phone },
        { AttributeCode: 9,  AttributeDesc: 'FiCode',            AttributeValue: detectedCard.fiCode },
        { AttributeCode: 17, AttributeDesc: 'CardHolderName',    AttributeValue: holderName },
        { AttributeCode: 18, AttributeDesc: 'CardHolderIdType',  AttributeValue: docType },
        { AttributeCode: 19, AttributeDesc: 'CardHolderId',      AttributeValue: docNumber },
        { AttributeCode: 22, AttributeDesc: 'AccountType',       AttributeValue: '0' },
      ];

      const data = await callApi('tokenCommand', {
        SessionToken: token,
        Command: command,
        TokenInfoArray: tokenInfoArray,
      });

      setResponse(data);

      // Session expired — refresh and retry
      if (data.ReturnCode === 'FAIL_APIEXPIREDSESSION') {
        setSessionToken('');
        const newToken = await ensureSession();
        const retried = await callApi('tokenCommand', {
          SessionToken: newToken,
          Command: command,
          TokenInfoArray: tokenInfoArray,
        });
        setResponse(retried);
      }
    } catch (err: any) {
      setResponse({ error: err.message });
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const dialCode = COUNTRIES.find((c) => c.code === country)?.dial ?? '57';

  return (
    <div className="container">
      <header>
        <h1>ecollect SDK — Test Console</h1>
        <p>Tokenización de tarjetas de crédito</p>
      </header>

      {/* Session status */}
      {sessionToken && (
        <section className="session">
          <h2>Sesión activa</h2>
          <div className="token-display">
            <code>{sessionToken.substring(0, 30)}…</code>
          </div>
        </section>
      )}

      {/* Card form */}
      <section className="card-form-section">
        <h2>Datos de la tarjeta</h2>
        <form onSubmit={handleTokenize} className="card-form">

          {/* Card number */}
          <div className="form-group full-width">
            <label>NÚMERO DE TARJETA</label>
            <div className="input-with-badge">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={handleCardNumberChange}
                required
              />
              {detectedCard?.brandImageUrl ? (
                <img
                  className="brand-badge"
                  src={detectedCard.brandImageUrl}
                  alt={`FiCode ${detectedCard.fiCode}`}
                />
              ) : detectedCard ? (
                <span className="brand-badge brand-text">#{detectedCard.fiCode}</span>
              ) : null}
            </div>
          </div>

          {/* Expiry + CVV */}
          <div className="form-row">
            <div className="form-group">
              <label>VENCIMIENTO</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM/AA"
                value={expiry}
                onChange={handleExpiryChange}
                required
              />
            </div>
            <div className="form-group">
              <label>CVV</label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="•••"
                maxLength={4}
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>

          {/* Holder name */}
          <div className="form-group full-width">
            <label>NOMBRE DEL TITULAR</label>
            <input
              type="text"
              placeholder="Como aparece en la tarjeta"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="form-divider">DATOS DEL TITULAR</div>

          {/* Email */}
          <div className="form-group full-width">
            <label>CORREO ELECTRÓNICO</label>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Doc type + Doc number */}
          <div className="form-row">
            <div className="form-group">
              <label>TIPO DOC.</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>NÚMERO DE DOCUMENTO</label>
              <input
                type="text"
                placeholder="100000000"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Country + Phone */}
          <div className="form-row">
            <div className="form-group">
              <label>PAÍS</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>TELÉFONO MÓVIL</label>
              <div className="phone-input">
                <span className="dial-prefix">+{dialCode}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="3001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Save toggle */}
          <div className="form-group full-width save-toggle">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={saveCard}
                onChange={(e) => setSaveCard(e.target.checked)}
              />
              Guardar tarjeta para futuros pagos (SAVE)
              {!saveCard && <span className="hint"> — se usará GET (token temporal)</span>}
            </label>
          </div>

          {/* Detected card info */}
          {detectedCard && (
            <div className="detected-card">
              PaymentSystem: <strong>{detectedCard.paymentSystem}</strong>
              &nbsp;·&nbsp;FiCode: <strong>{detectedCard.fiCode}</strong>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !sessionToken || !detectedCard}
          >
            {loading ? loadingLabel || 'Procesando…' : 'Tokenizar tarjeta'}
          </button>
        </form>
      </section>

      {/* Response */}
      {response && (
        <section className="response">
          <h2>
            Respuesta API
            {response.ReturnCode && (
              <span className={`return-code ${response.ReturnCode.startsWith('SUCCESS') ? 'ok' : 'fail'}`}>
                {response.ReturnCode}
              </span>
            )}
          </h2>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </section>
      )}

      {loading && !response && <div className="loader">{loadingLabel || 'Cargando…'}</div>}
    </div>
  );
}
