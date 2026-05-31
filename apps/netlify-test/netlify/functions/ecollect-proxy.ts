import { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  const { method, body } = event;
  const apiKey = process.env.VITE_API_KEY;
  const etyCode = process.env.VITE_ENTITY_CODE;
  const environment = process.env.ECOLLECT_ENVIRONMENT || 'test';

  if (!apiKey || !etyCode) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing API credentials' }),
    };
  }

  if (method !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload = JSON.parse(body || '{}');
    const endpoint = payload.endpoint;
    delete payload.endpoint;

    const baseUrl = environment === 'prod'
      ? 'https://www.e-collect.com/app_Express/api'
      : 'https://test1.e-collect.com/app_express/api';

    const url = endpoint === 'getTransactionInformation' && environment === 'prod'
      ? `https://m.e-collect.com/app_Express/api/GetTransactionInformation`
      : `${baseUrl}/${endpoint}`;

    // Add credentials to request
    const requestBody = {
      EntityCode: parseInt(etyCode),
      ApiKey: apiKey,
      ...payload,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(error) }),
    };
  }
};

export { handler };
