# 🔐 Security Guide — ecollect SDK

## The Golden Rule

> **Your API Key must NEVER exist in client-side code — browser, mobile app, or desktop app.**

The ecollect SDK is a **server-side library**. Your API Key is equivalent to a password. Whoever holds it can create transactions and manage tokens on your behalf.

---

## Why The API Key Must Stay Server-Side

| Location | Risk | Verdict |
|----------|------|---------|
| Browser JavaScript bundle | Anyone can open DevTools and read it | ❌ Never |
| React / Vue / Angular app | Bundled into JS files, publicly downloadable | ❌ Never |
| Mobile app binary | Extractable with reverse engineering tools | ❌ Never |
| `.env` committed to git | Exposed in repo history forever | ❌ Never |
| Server environment variable | Not accessible outside the server process | ✅ Safe |
| Secret manager (AWS/GCP/Azure) | Encrypted, audited, rotatable | ✅ Best practice |

---

## The Correct Architecture

Every deployment — regardless of framework or cloud provider — follows the same pattern:

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (Browser / iOS / Android)                           │
│                                                             │
│  - No API Key                                               │
│  - No direct calls to e-collect.com                         │
│  - Calls YOUR backend only                                  │
└───────────────────┬─────────────────────────────────────────┘
                    │  HTTPS  (your own API)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  YOUR BACKEND (Node / PHP / Python / Kotlin / Swift)        │
│                                                             │
│  - Holds ECOLLECT_API_KEY in env vars                       │
│  - Runs the ecollect SDK                                    │
│  - Validates & authenticates requests from your clients     │
│  - Returns only what the client needs (no raw tokens/keys)  │
└───────────────────┬─────────────────────────────────────────┘
                    │  HTTPS  (ecollect API)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  ecollect API  (test1.e-collect.com / www.e-collect.com)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Patterns by Architecture

### 1. Node.js / Express

```javascript
// server.js
import express from 'express';
import { EcollectClient } from 'ecollect-sdk';

const app = express();
app.use(express.json());

// API key loaded from environment — never hardcoded
const ecollect = new EcollectClient({
  apiKey:      process.env.ECOLLECT_API_KEY,
  etyCode:     parseInt(process.env.ECOLLECT_ENTITY_CODE),
  environment: process.env.ECOLLECT_ENVIRONMENT || 'test',
});

// Your client calls POST /api/payment — NOT e-collect.com directly
app.post('/api/payment', async (req, res) => {
  const { amount, currency, tokenId } = req.body;
  try {
    const result = await ecollect.payments.process({ amount, currency, tokenId });
    // Return only what the client needs — not the raw ecollect response
    res.json({ ticketId: result.ticketId, status: result.tranState });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

```bash
# .env  (never commit this file — add it to .gitignore)
ECOLLECT_API_KEY=your_api_key_here
ECOLLECT_ENTITY_CODE=50039
ECOLLECT_ENVIRONMENT=test
```

---

### 2. PHP / Laravel

```php
// config/ecollect.php
return [
    'api_key'     => env('ECOLLECT_API_KEY'),
    'entity_code' => env('ECOLLECT_ENTITY_CODE'),
    'environment' => env('ECOLLECT_ENVIRONMENT', 'test'),
];
```

```php
// app/Http/Controllers/PaymentController.php
use Ecollect\EcollectClient;

class PaymentController extends Controller
{
    private EcollectClient $ecollect;

    public function __construct()
    {
        $this->ecollect = new EcollectClient([
            'api_key'     => config('ecollect.api_key'),
            'ety_code'    => config('ecollect.entity_code'),
            'environment' => config('ecollect.environment'),
        ]);
    }

    public function process(Request $request)
    {
        $validated = $request->validate([
            'amount'   => 'required|numeric|min:0.01',
            'currency' => 'required|string',
            'tokenId'  => 'nullable|string',
        ]);

        $result = $this->ecollect->payments->process($validated);
        return response()->json(['ticketId' => $result->ticketId]);
    }
}
```

```ini
# .env
ECOLLECT_API_KEY=your_api_key_here
ECOLLECT_ENTITY_CODE=50039
ECOLLECT_ENVIRONMENT=test
```

---

### 3. Python / FastAPI or Django

```python
# FastAPI
import os
from fastapi import FastAPI, HTTPException
from ecollect import EcollectClient, EcollectConfig

app = FastAPI()

ecollect = EcollectClient(EcollectConfig(
    api_key=os.environ["ECOLLECT_API_KEY"],
    ety_code=int(os.environ["ECOLLECT_ENTITY_CODE"]),
    environment=os.getenv("ECOLLECT_ENVIRONMENT", "test"),
))

@app.post("/api/payment")
async def create_payment(amount: float, currency: str):
    try:
        result = await ecollect.payments.process(amount=amount, currency=currency)
        return {"ticket_id": result.ticket_id, "state": result.tran_state}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

```bash
# .env
ECOLLECT_API_KEY=your_api_key_here
ECOLLECT_ENTITY_CODE=50039
ECOLLECT_ENVIRONMENT=test
```

---

### 4. Kotlin / Spring Boot

```kotlin
// application.yml
ecollect:
  api-key: ${ECOLLECT_API_KEY}
  entity-code: ${ECOLLECT_ENTITY_CODE}
  environment: ${ECOLLECT_ENVIRONMENT:test}
```

```kotlin
// EcollectConfig.kt
@Configuration
class EcollectConfiguration {
    @Bean
    fun ecollectClient(
        @Value("\${ecollect.api-key}") apiKey: String,
        @Value("\${ecollect.entity-code}") entityCode: Int,
        @Value("\${ecollect.environment:test}") environment: String,
    ): EcollectClient {
        val env = if (environment == "prod") Environment.PRODUCTION else Environment.TEST
        return EcollectClient(Config(etyCode = entityCode, apiKey = apiKey, environment = env))
    }
}
```

---

### 5. Netlify Functions

```typescript
// netlify/functions/your-handler.ts
// API key comes from Netlify dashboard → Site Settings → Environment Variables
// It is NOT prefixed with VITE_ — that would embed it into the browser bundle
const apiKey = process.env.ECOLLECT_API_KEY;
```

---

### 6. AWS Lambda

```typescript
// handler.ts — API key set in Lambda → Configuration → Environment Variables
//              or fetched from AWS Secrets Manager
const ecollect = new EcollectClient({
  apiKey:      process.env.ECOLLECT_API_KEY!,
  etyCode:     parseInt(process.env.ECOLLECT_ENTITY_CODE!),
  environment: (process.env.ECOLLECT_ENVIRONMENT as any) || 'test',
});
```

---

### 7. Google Cloud Run / Cloud Functions

```python
# Fetch from Secret Manager instead of plain env vars in production
from google.cloud import secretmanager

def get_secret(name: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    response = client.access_secret_version(name=name)
    return response.payload.data.decode("UTF-8")

ecollect = EcollectClient(EcollectConfig(
    api_key=get_secret("projects/my-project/secrets/ecollect-api-key/versions/latest"),
    ety_code=50039,
    environment="prod",
))
```

---

### 8. Docker / Kubernetes

```yaml
# docker-compose.yml — values injected at runtime, not baked into the image
services:
  api:
    image: my-backend:latest
    environment:
      - ECOLLECT_API_KEY=${ECOLLECT_API_KEY}
      - ECOLLECT_ENTITY_CODE=${ECOLLECT_ENTITY_CODE}
      - ECOLLECT_ENVIRONMENT=prod
```

```yaml
# Kubernetes Secret + Deployment reference
apiVersion: v1
kind: Secret
metadata:
  name: ecollect-credentials
type: Opaque
stringData:
  ECOLLECT_API_KEY: "your_api_key_here"
---
# In your Deployment spec:
env:
  - name: ECOLLECT_API_KEY
    valueFrom:
      secretKeyRef:
        name: ecollect-credentials
        key: ECOLLECT_API_KEY
```

---

## Common Pitfalls by Framework

| Framework | Dangerous pattern | Safe pattern |
|-----------|-------------------|--------------|
| React / Vite | `VITE_ECOLLECT_API_KEY` | Server env var without `VITE_` prefix |
| Next.js | `NEXT_PUBLIC_ECOLLECT_API_KEY` | `ECOLLECT_API_KEY` in API routes only |
| Create React App | `REACT_APP_ECOLLECT_API_KEY` | Backend proxy endpoint |
| Vue / Nuxt | `NUXT_PUBLIC_ECOLLECT_API_KEY` | Server-side route handler |
| Angular | `environment.ts` file | Dedicated backend API |
| Flutter / React Native | Hardcoded string or local config | Your own backend endpoint |

> Any environment variable prefix that makes it "public" or "client-side" is dangerous.

---

## What To Return To The Client

Return the **minimum necessary** to proceed — never the raw ecollect response:

| Operation | ✅ Return to client | ❌ Never return |
|-----------|---------------------|----------------|
| Start session | `{ sessionReady: true }` | `SessionToken` |
| Save card | `{ tokenId, maskedCard, last4 }` | `CardNumber`, `ApiKey` |
| Process payment | `{ ticketId, state }` | Full response body |
| Query tokens | `[{ tokenId, maskedCard, brand }]` | Full `TokenInfoArray` |

---

## Pre-Launch Security Checklist

- [ ] `ECOLLECT_API_KEY` is a server-side environment variable only
- [ ] `.env` / `.env.local` is in `.gitignore`
- [ ] No `VITE_`, `REACT_APP_`, `NEXT_PUBLIC_` prefix on the API key
- [ ] SDK is initialized in a backend process, not in frontend code
- [ ] API responses are filtered before being sent to clients
- [ ] Production uses a different API key than test
- [ ] API keys are rotated if ever accidentally exposed in git history

---

## Reporting a Security Issue

If you discover a vulnerability in this SDK, please report it **privately**:

📧 **security@ecollect.co**

Do not open a public GitHub issue for security vulnerabilities.
