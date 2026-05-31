import React, { useState } from 'react';
import axios from 'axios';
import { CardFormMinimal, CardFormFull, CardFormDark } from '@ecollect/ui-react';
import type { CardFormSubmitPayload, SubmitError } from '@ecollect/ui-core';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppTab = 'console' | 'minimal' | 'full' | 'dark';
type Step = 'init' | 'ready' | 'done';

interface SavedToken {
  tokenId: string;
  maskedCard: string;
  brand: string;
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function callProxy(endpoint: string, payload: Record<string, unknown> = {}) {
  const { data } = await axios.post('/.netlify/functions/ecollect-proxy', { endpoint, ...payload });
  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ResponsePanel({ data, label }: { data: unknown; label: string }) {
  const success = (data as Record<string, unknown>)?.ReturnCode === 'SUCCESS';
  return (
    <div className={`response-panel ${success ? 'response-success' : 'response-error'}`}>
      <div className="response-header">
        <span>{success ? '✅' : '⚠️'} {label}</span>
        <span className={`rc-badge ${success ? 'rc-ok' : 'rc-fail'}`}>
          {(data as Record<string, unknown>)?.ReturnCode as string ?? 'ERROR'}
        </span>
      </div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function TabBar({ active, onChange }: { active: AppTab; onChange: (t: AppTab) => void }) {
  const tabs: { id: AppTab; label: string }[] = [
    { id: 'console', label: '🖥 Consola API' },
    { id: 'minimal', label: '⬜ Minimal' },
    { id: 'full', label: '💳 Full + Preview' },
    { id: 'dark', label: '🌑 Dark Glass' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: active === t.id ? '2px solid #6366f1' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            fontWeight: active === t.id ? 700 : 400,
            color: active === t.id ? '#6366f1' : '#64748b',
            fontSize: '0.9rem',
            marginBottom: -2,
            transition: 'all .15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Classic Console Tab ───────────────────────────────────────────────────────

function ConsoleTab({
  sessionToken, loading, onGetSession, onReset,
}: {
  sessionToken: string;
  loading: boolean;
  onGetSession: () => void;
  onReset: () => void;
}) {
  const [response, setResponse] = useState<{ label: string; data: unknown } | null>(null);
  const [queryEmail, setQueryEmail] = useState('');
  const [queryDoc, setQueryDoc] = useState('');
  const [paymentSystems, setPaymentSystems] = useState<unknown[]>([]);
  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);
  const [innerLoading, setInnerLoading] = useState(false);

  async function run(label: string, fn: () => Promise<unknown>) {
    setInnerLoading(true);
    setResponse(null);
    try {
      const data = await fn();
      setResponse({ label, data });
      return data as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResponse({ label, data: { error: msg } });
    } finally {
      setInnerLoading(false);
    }
  }

  async function handleQueryTokens() {
    const data = await run('queryToken', () =>
      callProxy('queryToken', {
        SessionToken: sessionToken,
        TokenInfoArray: [
          { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: queryEmail },
          { AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: queryDoc },
        ],
      })
    );
    if ((data as Record<string, unknown>)?.TokenArray) {
      const tokens: SavedToken[] = ((data as Record<string, unknown>).TokenArray as unknown[]).map((t) => {
        const attrs = (t as Record<string, unknown>).TokenInfoArray ?? [] as unknown[];
        const find = (code: number) =>
          (attrs as Array<Record<string, unknown>>).find((a) => a.AttributeCode === code)?.AttributeValue ?? '';
        return { tokenId: find(1) as string, maskedCard: (find(12) || find(11)) as string, brand: find(9) as string };
      });
      setSavedTokens(tokens);
    }
  }

  async function handleGetPaymentSystems() {
    const data = await run('getPaymentSystem', () =>
      callProxy('getPaymentSystem', { SessionToken: sessionToken })
    );
    if ((data as Record<string, unknown>)?.PaymentSystemArray) {
      setPaymentSystems((data as Record<string, unknown>).PaymentSystemArray as unknown[]);
    }
  }

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
          <button className="btn-secondary" onClick={handleQueryTokens} disabled={innerLoading || !queryEmail}>
            🔍 Ver tokens
          </button>
          <button className="btn-secondary" onClick={handleGetPaymentSystems} disabled={innerLoading}>
            🏦 Métodos de pago
          </button>
          <button className="btn-ghost" onClick={onReset} disabled={innerLoading}>
            🔄 Nueva sesión
          </button>
        </div>
      </div>

      {paymentSystems.length > 0 && (
        <div className="methods-grid">
          <h4>Métodos disponibles</h4>
          {paymentSystems.map((ps, i) => (
            <div key={i} className="method-item">
              <span className="method-code">{(ps as Record<string, unknown>).PaymentSystem as string}</span>
              <span>{((ps as Record<string, unknown>).FiArray as Array<Record<string, unknown>>)?.[0]?.FiName ?? `Sistema ${(ps as Record<string, unknown>).PaymentSystem}`}</span>
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

      {response && <ResponsePanel data={response.data} label={response.label} />}
    </div>
  );
}

// ─── Template Tab Wrapper ─────────────────────────────────────────────────────

function TemplateTab({
  sessionToken, loading, onGetSession, onReset, theme,
}: {
  sessionToken: string;
  loading: boolean;
  onGetSession: () => void;
  onReset: () => void;
  theme: 'minimal' | 'full' | 'dark';
}) {
  const [tokenized, setTokenized] = useState(false);
  const [result, setResult] = useState<{ data: unknown; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit({ cardFormData }: CardFormSubmitPayload) {
    if (!sessionToken) throw new Error('No hay sesión activa. Inicia sesión primero.');

    const resp = await callProxy('tokenCommand', {
      SessionToken: sessionToken,
      Command: 'SAVE',
      TokenInfoArray: [
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
      ],
    });

    if (resp.ReturnCode !== 'SUCCESS') {
      throw new Error(resp.ReturnDesc ?? `ReturnCode: ${resp.ReturnCode}`);
    }

    setResult({ data: resp, label: 'tokenCommand — SAVE' });
    setTokenized(true);
  }

  function handleError(err: SubmitError) {
    setError(err.message);
  }

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn-ghost" onClick={onReset} style={{ fontSize: '0.85rem' }}>
          🔄 Nueva sesión
        </button>
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

      {result && <ResponsePanel data={result.data} label={result.label} />}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('console');
  const [sessionToken, setSessionToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenized, setTokenized] = useState(false);

  async function handleGetSession() {
    setLoading(true);
    try {
      const data = await callProxy('getSessionToken');
      if (data?.ReturnCode === 'SUCCESS' && data?.SessionToken) {
        setSessionToken(data.SessionToken);
      }
    } catch {
      // Error shown inline in each tab
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSessionToken('');
    setTokenized(false);
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

        {activeTab === 'console' && (
          <ConsoleTab
            sessionToken={sessionToken}
            loading={loading}
            onGetSession={handleGetSession}
            onReset={handleReset}
          />
        )}
        {activeTab === 'minimal' && (
          <TemplateTab
            sessionToken={sessionToken}
            loading={loading}
            onGetSession={handleGetSession}
            onReset={handleReset}
            theme="minimal"
          />
        )}
        {activeTab === 'full' && (
          <TemplateTab
            sessionToken={sessionToken}
            loading={loading}
            onGetSession={handleGetSession}
            onReset={handleReset}
            theme="full"
          />
        )}
        {activeTab === 'dark' && (
          <TemplateTab
            sessionToken={sessionToken}
            loading={loading}
            onGetSession={handleGetSession}
            onReset={handleReset}
            theme="dark"
          />
        )}
      </main>
    </div>
  );
}
