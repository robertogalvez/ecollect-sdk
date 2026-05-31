import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

interface ApiResponse {
  ReturnCode?: string;
  SessionToken?: string;
  TicketId?: number;
  TokenInfoArray?: any[];
  PaymentSystemArray?: any[];
  [key: string]: any;
}

const TEST_CARD = {
  cardNumber: '4296005885355275',
  expirationDate: '12/2025',
  paymentSystem: '1',
  fiCode: '190',
  cardHolderName: 'David Caballero',
  cardHolderIdType: 'CC',
  cardHolderId: '123456799',
  email: 'david.caballero@ecollect.co',
  mobileCountryCode: '1',
  mobileNumber: '311111111',
  accountType: '0',
};

export default function App() {
  const [sessionToken, setSessionToken] = useState<string>('');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenId, setTokenId] = useState<string>('');

  const callApi = async (endpoint: string, payload: any = {}) => {
    setLoading(true);
    try {
      const data = await axios.post('/.netlify/functions/ecollect-proxy', {
        endpoint,
        ...payload,
      });
      setResponse(data.data);
      if (data.data.SessionToken) {
        setSessionToken(data.data.SessionToken);
      }
    } catch (error: any) {
      setResponse({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getSessionToken = () => {
    callApi('getSessionToken');
  };

  const saveToken = () => {
    if (!sessionToken) {
      alert('Get session token first');
      return;
    }
    callApi('tokenCommand', {
      SessionToken: sessionToken,
      Command: 'SAVE',
      TokenInfoArray: [
        { AttributeCode: 0, AttributeDesc: 'CardNumber', AttributeValue: TEST_CARD.cardNumber },
        { AttributeCode: 2, AttributeDesc: 'PaymentSystem', AttributeValue: TEST_CARD.paymentSystem },
        { AttributeCode: 4, AttributeDesc: 'ExpirationDate', AttributeValue: TEST_CARD.expirationDate },
        { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: TEST_CARD.email },
        { AttributeCode: 7, AttributeDesc: 'MobileCountryCode', AttributeValue: TEST_CARD.mobileCountryCode },
        { AttributeCode: 8, AttributeDesc: 'MobileNumber', AttributeValue: TEST_CARD.mobileNumber },
        { AttributeCode: 9, AttributeDesc: 'FiCode', AttributeValue: TEST_CARD.fiCode },
        { AttributeCode: 17, AttributeDesc: 'CardHolderName', AttributeValue: TEST_CARD.cardHolderName },
        { AttributeCode: 18, AttributeDesc: 'CardHolderIdType', AttributeValue: TEST_CARD.cardHolderIdType },
        { AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: TEST_CARD.cardHolderId },
        { AttributeCode: 22, AttributeDesc: 'AccountType', AttributeValue: TEST_CARD.accountType },
      ],
    });
  };

  const queryToken = () => {
    if (!sessionToken) {
      alert('Get session token first');
      return;
    }
    callApi('queryToken', {
      SessionToken: sessionToken,
      TokenInfoArray: [
        { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: TEST_CARD.email },
        { AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: TEST_CARD.cardHolderId },
      ],
    });
  };

  const getPaymentSystems = () => {
    if (!sessionToken) {
      alert('Get session token first');
      return;
    }
    callApi('getPaymentSystem', {
      SessionToken: sessionToken,
    });
  };

  return (
    <div className="container">
      <header>
        <h1>🚀 ecollect SDK Test Console</h1>
        <p>Test the ecollect payment SDK in real-time</p>
      </header>

      <section className="credentials">
        <h2>📋 Test Credentials</h2>
        <div className="card-info">
          <p><strong>Cardholder:</strong> {TEST_CARD.cardHolderName}</p>
          <p><strong>Card:</strong> {TEST_CARD.cardNumber}</p>
          <p><strong>Expires:</strong> {TEST_CARD.expirationDate}</p>
          <p><strong>Email:</strong> {TEST_CARD.email}</p>
          <p><strong>Document:</strong> {TEST_CARD.cardHolderIdType} {TEST_CARD.cardHolderId}</p>
        </div>
      </section>

      <section className="controls">
        <h2>🎮 API Actions</h2>
        <div className="button-group">
          <button onClick={getSessionToken} disabled={loading}>
            Get Session Token
          </button>
          <button onClick={saveToken} disabled={loading || !sessionToken}>
            Save Token (SAVE)
          </button>
          <button onClick={queryToken} disabled={loading || !sessionToken}>
            Query Tokens
          </button>
          <button onClick={getPaymentSystems} disabled={loading || !sessionToken}>
            Get Payment Systems
          </button>
        </div>
      </section>

      {sessionToken && (
        <section className="session">
          <h2>✅ Active Session</h2>
          <div className="token-display">
            <code>{sessionToken.substring(0, 50)}...</code>
          </div>
        </section>
      )}

      {response && (
        <section className="response">
          <h2>📤 API Response</h2>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </section>
      )}

      {loading && <div className="loader">Loading...</div>}
    </div>
  );
}
