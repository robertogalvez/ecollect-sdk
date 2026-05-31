import { Handler } from '@netlify/functions';

// Only these endpoints may be called through this proxy
const ALLOWED_ENDPOINTS = new Set([
  'getSessionToken',
  'createTransactionPayment',
  'queryToken',
  'tokenCommand',
  'getPaymentSystem',
  'getTransactionInformation',
  'getCustomerId',
  'verifySessionToken',
]);

// Strip fields that should never reach the browser
const SENSITIVE_RESPONSE_FIELDS = ['ApiKey', 'SessionToken', 'CardNumber', 'SecureCode'];

function scrubResponse(data: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = { ...data };
  for (const field of SENSITIVE_RESPONSE_FIELDS) {
    if (field in scrubbed) {
      delete scrubbed[field];
    }
  }
  return scrubbed;
}

const handler: Handler = async (event) => {
  // Credentials live only in server-side env vars — never in the browser bundle
  const apiKey = process.env.ECOLLECT_API_KEY;
  const etyCode = process.env.ECOLLECT_ENTITY_CODE;
  const environment = process.env.ECOLLECT_ENVIRONMENT || 'test';

  if (!apiKey || !etyCode) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }), // don't leak which var is missing
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const endpoint = String(payload.endpoint ?? '');

  // Allowlist check — prevents using this proxy as an open relay
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown endpoint' }) };
  }

  const { endpoint: _removed, ...rest } = payload;

  const baseUrl =
    environment === 'prod'
      ? 'https://www.e-collect.com/app_Express/api'
      : 'https://test1.e-collect.com/app_express/api';

  const url =
    endpoint === 'getTransactionInformation' && environment === 'prod'
      ? 'https://m.e-collect.com/app_Express/api/GetTransactionInformation'
      : `${baseUrl}/${endpoint}`;

  // Credentials are injected server-side — they never pass through the browser
  const requestBody = {
    EntityCode: parseInt(etyCode, 10),
    ApiKey: apiKey,
    ...rest,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as Record<string, unknown>;

    return {
      statusCode: 200,
      body: JSON.stringify(scrubResponse(data)),
    };
  } catch (error) {
    console.error('ecollect proxy error:', error);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Gateway error — check server logs' }),
    };
  }
};

export { handler };
