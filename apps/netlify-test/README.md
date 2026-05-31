# ecollect SDK Test Console

A real-time testing dashboard for the ecollect payment SDK. Test all SDK functionality directly in your browser.

## 🚀 Quick Start

### Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Deploy to Netlify

#### Option 1: Connect GitHub Repository

1. Push this folder to GitHub
2. Go to [Netlify](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your GitHub repository
5. Set environment variables in Site Settings

#### Option 2: Deploy via Netlify CLI

```bash
npm install -g netlify-cli
netlify deploy
```

## 📋 Environment Variables

Create a `.env.local` file (for local development):

```env
VITE_API_KEY=your_test_api_key_here
VITE_ENTITY_CODE=50039
VITE_ECOLLECT_ENVIRONMENT=test
```

For Netlify deployment, set in **Site Settings → Build & Deploy → Environment**:

- `VITE_API_KEY`: Your ecollect test API key
- `VITE_ENTITY_CODE`: Your entity code (50039)
- `VITE_ECOLLECT_ENVIRONMENT`: `test` or `prod`

## 🎯 Testing Scenarios

The app includes pre-configured test data (David Caballero's card):

- **Card Number**: 4296005885355275
- **Expiration**: 12/2025
- **Payment System**: Visa (code 1)
- **Cardholder ID**: CC 123456799
- **Email**: david.caballero@ecollect.co
- **Phone**: +1 311111111

### Available Actions

1. **Get Session Token** - Initialize a new session
2. **Save Token (SAVE)** - Tokenize the test card
3. **Query Tokens** - List saved tokens for the test cardholder
4. **Get Payment Systems** - Retrieve available payment methods

## 📦 Project Structure

```
netlify-test/
├── netlify/functions/
│   └── ecollect-proxy.ts       # Serverless function (API proxy)
├── src/
│   ├── App.tsx                 # Main React component
│   ├── App.css                 # Styling
│   └── main.tsx                # Entry point
├── index.html                  # HTML template
├── netlify.toml                # Netlify configuration
├── vite.config.ts              # Vite configuration
└── package.json
```

## 🔐 Security Notes

- The serverless function (`ecollect-proxy.ts`) automatically injects your API key
- Session tokens are never exposed in client-side code
- All requests go through Netlify Functions for secure credential handling
- Environment variables are server-side only

## 📡 API Endpoints Used

- `getSessionToken` - Get authenticated session
- `tokenCommand` - Save/query/manage tokens (SAVE, GET, REMOVE, UPDATE, HOLD)
- `queryToken` - Search tokens by cardholder info
- `getPaymentSystem` - List available payment methods

## 🛠️ Development

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Type Check

```bash
npm run type-check
```

## 📚 Documentation

- [ecollect SDK Repository](https://github.com/robertogalvez/ecollect-sdk)
- API Reference: See `EndPoint.txt` in the SDK repo

## 🐛 Troubleshooting

### "Missing API credentials"
- Ensure environment variables are set in Netlify Site Settings
- For local dev, create `.env.local` file

### "Method not allowed"
- The proxy function only accepts POST requests

### CORS Issues
- The serverless function handles all CORS automatically

## 📝 License

MIT
