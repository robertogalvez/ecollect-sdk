import React, { useState } from 'react';
import axios from 'axios';
import { CardFormMinimal, CardFormFull, CardFormDark } from '@ecollect/ui-react';
import type { CardFormSubmitPayload, SubmitError } from '@ecollect/ui-core';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppTab = 'console' | 'minimal' | 'full' | 'dark';

interface SavedToken {
  tokenId: string;
  maskedCard: string;
  brand: string;
}

interface TramaRecord {
  id: string;
  timestamp: string;
  endpoint: string;
  request: Record<string, unknown>;
  response: unknown;
  durationMs: number;
  success: boolean;
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function callProxy(
  endpoint: string,
  payload: Record<string, unknown> = {},
  onTrama?: (t: TramaRecord) => void,
): Promise<Record<string, unknown>> {
  const request = { endpoint, ...payload };
  const t0 = Date.now();
  const id = `${endpoint}-${Date.now()}`;
  try {
    const { data } = await axios.post('/.netlify/functions/ecollect-proxy', request);
    const record: TramaRecord = {
      id,
      timestamp: new Date().toISOString(),
      endpoint,
      request,
      response: data,
      durationMs: Date.now() - t0,
      success: data?.ReturnCode === 'SUCCESS',
    };
    onTrama?.(record);
    return data as Record<string, unknown>;
  } catch (err: unknown) {
    const errData = (err as { response?: { data?: unknown } })?.response?.data ?? { error: String(err) };
    const record: TramaRecord = {
      id,
      timestamp: new Date().toISOString(),
      endpoint,
      request,
      response: errData,
      durationMs: Date.now() - t0,
      success: false,
    };
    onTrama?.(record);
    throw err;
  }
}

// ─── Trama Panel ──────────────────────────────────────────────────────────────

function TramaPanel({ trama, onCopy }: { trama: TramaRecord; onCopy: (text: string, label: string) => void }) {
  const [tab, setTab] = useState<'request' | 'response'>('request');
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
      onCopy(text, label);
    });
  }

  const reqJson = JSON.stringify(trama.request, null, 2);
  const resJson = JSON.stringify(trama.response, null, 2);

  return (
    <div style={{
      border: `1.5px solid ${trama.success ? '#10b981' : '#f59e0b'}`,
      borderRadius: 12,
      overflow: 'hidden',
      fontFamily: 'monospace',
      fontSize: '0.82rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: trama.success ? '#ecfdf5' : '#fffbeb',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: trama.success ? '#065f46' : '#92400e' }}>
            {trama.success ? '✅' : '⚠️'} {trama.endpoint}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{trama.timestamp.replace('T', ' ').slice(0, 19)}</span>
          <span style={{
            background: trama.success ? '#d1fae5' : '#fef3c7',
            color: trama.success ? '#065f46' : '#92400e',
            padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
          }}>
            {(trama.response as Record<string, unknown>)?.ReturnCode as string ?? 'ERROR'}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{trama.durationMs}ms</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => copy(reqJson, 'request')}
            style={copyBtnStyle}
            title="Copiar trama enviada"
          >
            {copied === 'request' ? '✓ Copiado' : '📋 Request'}
          </button>
          <button
            onClick={() => copy(resJson, 'response')}
            style={copyBtnStyle}
            title="Copiar trama recibida"
          >
            {copied === 'response' ? '✓ Copiado' : '📋 Response'}
          </button>
          <button
            onClick={() => copy(JSON.stringify({ request: trama.request, response: trama.response }, null, 2), 'both')}
            style={{ ...copyBtnStyle, background: '#6366f1', color: '#fff', borderColor: '#6366f1' }}
            title="Copiar ambas tramas (para Postman)"
          >
            {copied === 'both' ? '✓ Copiado' : '📤 Postman'}
          </button>
        </div>
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        {(['request', 'response'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? '#6366f1' : '#64748b',
              borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
              fontSize: '0.8rem', fontFamily: 'monospace',
              marginBottom: -1,
            }}
          >
            {t === 'request' ? '→ Trama enviada' : '← Trama recibida'}
          </button>
        ))}
      </div>

      {/* JSON body */}
      <div style={{ position: 'relative' }}>
        <pre style={{
          margin: 0, padding: '16px 20px', background: '#0f172a', color: '#e2e8f0',
          overflowX: 'auto', maxHeight: 420, lineHeight: 1.55,
        }}>
          <SyntaxJson json={tab === 'request' ? reqJson : resJson} />
        </pre>
      </div>
    </div>
  );
}

const copyBtnStyle: React.CSSProperties = {
  padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer',
  background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
  color: '#475569', fontFamily: 'inherit',
};

// ─── Syntax-colored JSON (no deps, pure React) ────────────────────────────────

function SyntaxJson({ json }: { json: string }) {
  const tokens = json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
      let cls = 'num';
      if (/^"/.test(match)) cls = /:$/.test(match) ? 'key' : 'str';
      else if (/true|false/.test(match)) cls = 'bool';
      else if (/null/.test(match)) cls = 'null';
      return `<TOKEN:${cls}>${match}</TOKEN>`;
    })
    .split(/(<TOKEN:\w+>.*?<\/TOKEN>)/);

  return (
    <>
      {tokens.map((part, i) => {
        const m = part.match(/^<TOKEN:(\w+)>(.*)<\/TOKEN>$/s);
        if (!m) return <span key={i}>{part}</span>;
        const colors: Record<string, string> = {
          key: '#93c5fd', str: '#86efac', num: '#fbbf24', bool: '#f472b6', null: '#94a3b8',
        };
        return <span key={i} style={{ color: colors[m[1]] ?? '#e2e8f0' }}>{m[2]}</span>;
      })}
    </>
  );
}

// ─── Trama History sidebar ────────────────────────────────────────────────────

function TramaHistory({ tramas, onSelect, selected }: {
  tramas: TramaRecord[];
  onSelect: (id: string) => void;
  selected: string | null;
}) {
  if (tramas.length === 0) return null;
  return (
    <div style={{
      border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{ padding: '8px 14px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>
        📡 Historial de tramas ({tramas.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10 }}>
        {tramas.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              padding: '4px 12px', fontSize: '0.75rem', cursor: 'pointer', borderRadius: 20,
              border: `1.5px solid ${selected === t.id ? '#6366f1' : t.success ? '#10b981' : '#f59e0b'}`,
              background: selected === t.id ? '#6366f1' : '#fff',
              color: selected === t.id ? '#fff' : t.success ? '#065f46' : '#92400e',
              fontFamily: 'monospace', fontWeight: selected === t.id ? 700 : 400,
            }}
          >
            {t.success ? '✅' : '⚠️'} {t.endpoint}
            <span style={{ opacity: 0.7, marginLeft: 6 }}>{t.timestamp.slice(11, 19)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ sessionActive, tokenized }: { sessionActive: boolean; tokenized: boolean }) {
  return (
    <div className="status-bar">
      <span className={`badge ${sessionActive ? 'badge-green' : 'badge-gray'}`}>
        {sessionActive ? '🔐 Sesión activa' : '🔒 Sin sesión'}
      </span>
      {tokenized && <span className="badge badge-green">✅ Tokenizado</span>}
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: AppTab; onChange: (t: AppTab) => void }) {
  const tabs: { id: AppTab; label: string }[] = [
    { id: 'console', label: '🖥 Consola API' },
    { id: 'minimal', label: '⬜ Minimal' },
    { id: 'full', label: '💳 Full + Preview' },
    { id: 'dark', label: '🌑 Dark Glass' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid #e2e8f0' }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '10px 20px', border: 'none',
          borderBottom: active === t.id ? '2px solid #6366f1' : '2px solid transparent',
          background: 'none', cursor: 'pointer',
          fontWeight: active === t.id ? 700 : 400,
          color: active === t.id ? '#6366f1' : '#64748b',
          fontSize: '0.9rem', marginBottom: -2, transition: 'all .15s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Console Tab ──────────────────────────────────────────────────────────────

function ConsoleTab({ sessionToken, loading, onGetSession, onReset }: {
  sessionToken: string; loading: boolean;
  onGetSession: () => void; onReset: () => void;
}) {
  const [tramas, setTramas] = useState<TramaRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queryEmail, setQueryEmail] = useState('');
  const [queryDoc, setQueryDoc] = useState('');
  const [paymentSystems, setPaymentSystems] = useState<unknown[]>([]);
  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);
  const [innerLoading, setInnerLoading] = useState(false);

  function addTrama(t: TramaRecord) {
    setTramas((prev) => [t, ...prev]);
    setSelectedId(t.id);
  }

  async function run(fn: () => Promise<unknown>) {
    setInnerLoading(true);
    try { return await fn(); }
    catch { /* trama already captured */ }
    finally { setInnerLoading(false); }
  }

  async function handleQueryTokens() {
    await run(() => callProxy('queryToken', {
      SessionToken: sessionToken,
      TokenInfoArray: [
        { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: queryEmail },
        { AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: queryDoc },
      ],
    }, (t) => {
      addTrama(t);
      const arr = (t.response as Record<string, unknown>)?.TokenArray;
      if (Array.isArray(arr)) {
        setSavedTokens(arr.map((item) => {
          const attrs = (item as Record<string, unknown>).TokenInfoArray as Array<Record<string, unknown>> ?? [];
          const find = (code: number) => attrs.find((a) => a.AttributeCode === code)?.AttributeValue ?? '';
          return { tokenId: find(1) as string, maskedCard: (find(12) || find(11)) as string, brand: find(9) as string };
        }));
      }
    }));
  }

  async function handleGetPaymentSystems() {
    await run(() => callProxy('getPaymentSystem', { SessionToken: sessionToken }, (t) => {
      addTrama(t);
      const arr = (t.response as Record<string, unknown>)?.PaymentSystemArray;
      if (Array.isArray(arr)) setPaymentSystems(arr);
    }));
  }

  const selectedTrama = tramas.find((t) => t.id === selectedId) ?? tramas[0] ?? null;

  if (!sessionToken) {
    return (
      <div className="step-card center">
        <h2>Bienvenido al SDK Test Console</h2>
        <p className="subtitle">Prueba tokenización, consulta de métodos de pago y más en tiempo real contra la API de ecollect.</p>
        <button className="btn-primary btn-large" onClick={onGetSession} disabled={loading}>
          {loading ? <span className="spinner" /> : '🔐 Iniciar sesión con ecollect'}
        </button>
        <p className="hint">Autenticará usando las credenciales configuradas en el servidor</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="form-card">
        <h3>Operaciones de la sesión</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field">
            <label>Email para consulta</label>
            <input type="email" placeholder="user@example.com" value={queryEmail} onChange={(e) => setQueryEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Documento para consulta</label>
            <input type="text" placeholder="123456789" value={queryDoc} onChange={(e) => setQueryDoc(e.target.value)} />
          </div>
        </div>
        <div className="action-grid" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={handleQueryTokens} disabled={innerLoading || !queryEmail}>🔍 Ver tokens</button>
          <button className="btn-secondary" onClick={handleGetPaymentSystems} disabled={innerLoading}>🏦 Métodos de pago</button>
          <button className="btn-ghost" onClick={onReset} disabled={innerLoading}>🔄 Nueva sesión</button>
        </div>
      </div>

      {paymentSystems.length > 0 && (
        <div className="methods-grid">
          <h4>Métodos disponibles</h4>
          {paymentSystems.map((ps, i) => (
            <div key={i} className="method-item">
              <span className="method-code">{(ps as Record<string, unknown>).PaymentSystem as string}</span>
              <span>{String(((ps as Record<string, unknown>).FiArray as Array<Record<string, unknown>>)?.[0]?.FiName ?? `Sistema ${(ps as Record<string, unknown>).PaymentSystem}`)}</span>
            </div>
          ))}
        </div>
      )}

      {savedTokens.length > 0 && (
        <div className="tokens-list">
          <h4>Tokens guardados</h4>
          {savedTokens.map((t, i) => (
            <div key={i} className="token-item">
              <span className="token-mask">{t.maskedCard || 'XXXX-XXXX'}</span>
              <span className="token-id">{t.tokenId.substring(0, 30)}…</span>
            </div>
          ))}
        </div>
      )}

      <TramaHistory tramas={tramas} onSelect={setSelectedId} selected={selectedId} />
      {selectedTrama && <TramaPanel trama={selectedTrama} onCopy={() => {}} />}
    </div>
  );
}

// ─── Template Tab ─────────────────────────────────────────────────────────────

type PaymentMode = 'tokenize' | 'charge' | 'tokenize-and-charge';

const PAYMENT_MODES: { value: PaymentMode; label: string; desc: string }[] = [
  { value: 'tokenize',            label: '💾 Solo tokenizar',          desc: 'tokenCommand SAVE → obtiene TokenId' },
  { value: 'charge',              label: '💳 Cobro directo',           desc: 'createTransactionPayment con datos de tarjeta' },
  { value: 'tokenize-and-charge', label: '💾💳 Tokenizar + cobrar',    desc: 'tokenCommand SAVE → createTransactionPayment con TokenId' },
];

function buildTokenInfoArray(cardFormData: CardFormSubmitPayload['cardFormData']) {
  return [
    { AttributeCode: 0,  AttributeDesc: 'CardNumber',        AttributeValue: cardFormData.cardNumber },
    { AttributeCode: 2,  AttributeDesc: 'PaymentSystem',     AttributeValue: cardFormData.paymentSystem },
    { AttributeCode: 4,  AttributeDesc: 'ExpirationDate',    AttributeValue: cardFormData.expirationDate },
    { AttributeCode: 6,  AttributeDesc: 'Usermail',          AttributeValue: cardFormData.email ?? '' },
    { AttributeCode: 7,  AttributeDesc: 'MobileCountryCode', AttributeValue: cardFormData.mobileCountryCode ?? '' },
    { AttributeCode: 8,  AttributeDesc: 'MobileNumber',      AttributeValue: cardFormData.mobileNumber ?? '' },
    { AttributeCode: 17, AttributeDesc: 'CardHolderName',    AttributeValue: cardFormData.cardHolderName },
    { AttributeCode: 18, AttributeDesc: 'CardHolderIdType',  AttributeValue: cardFormData.cardHolderIdType ?? '' },
    { AttributeCode: 19, AttributeDesc: 'CardHolderId',      AttributeValue: cardFormData.cardHolderId ?? '' },
    { AttributeCode: 22, AttributeDesc: 'AccountType',       AttributeValue: '0' },
  ].filter((a) => a.AttributeValue !== '');
}

function TemplateTab({ sessionToken, loading, onGetSession, onReset, theme }: {
  sessionToken: string; loading: boolean;
  onGetSession: () => void; onReset: () => void;
  theme: 'minimal' | 'full' | 'dark';
}) {
  const [tramas, setTramas] = useState<TramaRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tokenized, setTokenized] = useState(false);
  const [charged, setCharged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('tokenize');

  function addTrama(t: TramaRecord) {
    setTramas((prev) => [t, ...prev]);
    setSelectedId(t.id);
  }

  async function handleSubmit({ cardFormData }: CardFormSubmitPayload) {
    if (!sessionToken) throw new Error('No hay sesión activa.');
    setError(null);

    try {
      if (paymentMode === 'tokenize' || paymentMode === 'tokenize-and-charge') {
        const tokenInfoArray = buildTokenInfoArray(cardFormData);
        const tokenResp = await callProxy('tokenCommand', {
          SessionToken: sessionToken,
          Command: 'SAVE',
          TokenInfoArray: tokenInfoArray,
        }, addTrama);

        if (tokenResp.ReturnCode !== 'SUCCESS') {
          throw new Error(String(tokenResp.ReturnDesc ?? `ReturnCode: ${tokenResp.ReturnCode}`));
        }
        setTokenized(true);

        if (paymentMode === 'tokenize-and-charge') {
          const tokenId = tokenResp.TokenId as string;
          const chargeResp = await callProxy('createTransactionPayment', {
            SessionToken: sessionToken,
            TokenId: tokenId,
            PaymentSystem: cardFormData.paymentSystem,
          }, addTrama);

          if (chargeResp.ReturnCode !== 'SUCCESS') {
            throw new Error(String(chargeResp.ReturnDesc ?? `ReturnCode: ${chargeResp.ReturnCode}`));
          }
          setCharged(true);
        }
      } else {
        // charge: direct payment without tokenizing
        const chargeResp = await callProxy('createTransactionPayment', {
          SessionToken: sessionToken,
          CardNumber: cardFormData.cardNumber,
          ExpirationDate: cardFormData.expirationDate,
          SecurityCode: cardFormData.secureCode,
          CardHolderName: cardFormData.cardHolderName,
          PaymentSystem: cardFormData.paymentSystem,
          Email: cardFormData.email ?? undefined,
          CardHolderIdType: cardFormData.cardHolderIdType ?? undefined,
          CardHolderId: cardFormData.cardHolderId ?? undefined,
        }, addTrama);

        if (chargeResp.ReturnCode !== 'SUCCESS') {
          throw new Error(String(chargeResp.ReturnDesc ?? `ReturnCode: ${chargeResp.ReturnCode}`));
        }
        setCharged(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }

  function handleError(err: SubmitError) { setError(err.message); }

  const selectedTrama = tramas.find((t) => t.id === selectedId) ?? tramas[0] ?? null;

  if (!sessionToken) {
    return (
      <div className="step-card center">
        <h2>Sesión requerida</h2>
        <p className="subtitle">Inicia sesión con ecollect para usar los templates de formulario.</p>
        <button className="btn-primary btn-large" onClick={onGetSession} disabled={loading}>
          {loading ? <span className="spinner" /> : '🔐 Iniciar sesión'}
        </button>
      </div>
    );
  }

  const commonConfig = {
    language: 'es' as const,
    fields: {
      cardHolderName: { show: true, required: false },
      email: { show: true, required: false },
      cardHolderIdType: { show: true, required: false, label: 'Tipo de documento' },
      cardHolderId: { show: true, required: false, label: 'Número de documento' },
      mobileNumber: { show: true, required: false },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Payment flow selector */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Flujo de pago
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PAYMENT_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => { setPaymentMode(m.value); setTokenized(false); setCharged(false); setError(null); setTramas([]); }}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                border: paymentMode === m.value ? '2px solid #6366f1' : '2px solid #e2e8f0',
                background: paymentMode === m.value ? '#eef2ff' : '#fff',
                color: paymentMode === m.value ? '#4338ca' : '#64748b',
              }}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 8 }}>
          {PAYMENT_MODES.find((m) => m.value === paymentMode)?.desc}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.82rem', color: '#64748b', fontFamily: 'monospace', display: 'flex', gap: 12 }}>
          {tokenized && <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Tokenización exitosa</span>}
          {charged && <span style={{ color: '#6366f1', fontWeight: 700 }}>💳 Cobro aprobado</span>}
        </div>
        <button className="btn-ghost" onClick={onReset} style={{ fontSize: '0.85rem' }}>🔄 Nueva sesión</button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#991b1b', fontSize: '0.9rem' }}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>✕</button>
        </div>
      )}

      <div className="form-card" style={{ padding: theme === 'dark' ? 0 : undefined, overflow: 'hidden' }}>
        {theme === 'minimal' && (
          <div style={{ padding: 28 }}>
            <h3 style={{ marginBottom: 20, color: '#374151' }}>Template Minimal</h3>
            <CardFormMinimal onSubmit={handleSubmit} onError={handleError} config={commonConfig} />
          </div>
        )}
        {theme === 'full' && (
          <div style={{ padding: 28 }}>
            <h3 style={{ marginBottom: 20, color: '#374151' }}>Template Full + Preview 3D</h3>
            <CardFormFull onSubmit={handleSubmit} onError={handleError} config={commonConfig} />
          </div>
        )}
        {theme === 'dark' && (
          <CardFormDark onSubmit={handleSubmit} onError={handleError} config={{ ...commonConfig, showCardPreview: true }} />
        )}
      </div>

      {/* Trama viewer — aparece después de cada submit */}
      {tramas.length > 0 && (
        <div>
          <TramaHistory tramas={tramas} onSelect={setSelectedId} selected={selectedId} />
          {selectedTrama && <TramaPanel trama={selectedTrama} onCopy={() => {}} />}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('console');
  const [sessionToken, setSessionToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenized, setTokenized] = useState(false);
  const [sessionTrama, setSessionTrama] = useState<TramaRecord | null>(null);

  async function handleGetSession() {
    setLoading(true);
    try {
      await callProxy('getSessionToken', {}, (t) => {
        setSessionTrama(t);
        if (t.success) {
          setSessionToken((t.response as Record<string, unknown>).SessionToken as string);
        }
      });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSessionToken('');
    setTokenized(false);
    setSessionTrama(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span>ecollect <strong>SDK Console</strong></span>
          </div>
          <StatusBadge sessionActive={!!sessionToken} tokenized={tokenized} />
        </div>
      </header>

      <main className="app-main">
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* getSessionToken trama — visible en todas las tabs */}
        {sessionTrama && !sessionToken && (
          <div style={{ marginBottom: 20 }}>
            <TramaPanel trama={sessionTrama} onCopy={() => {}} />
          </div>
        )}

        {activeTab === 'console' && (
          <ConsoleTab sessionToken={sessionToken} loading={loading} onGetSession={handleGetSession} onReset={handleReset} />
        )}
        {activeTab === 'minimal' && (
          <TemplateTab sessionToken={sessionToken} loading={loading} onGetSession={handleGetSession} onReset={handleReset} theme="minimal" />
        )}
        {activeTab === 'full' && (
          <TemplateTab sessionToken={sessionToken} loading={loading} onGetSession={handleGetSession} onReset={handleReset} theme="full" />
        )}
        {activeTab === 'dark' && (
          <TemplateTab sessionToken={sessionToken} loading={loading} onGetSession={handleGetSession} onReset={handleReset} theme="dark" />
        )}
      </main>
    </div>
  );
}
