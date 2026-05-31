// Polyfill Web Crypto API for Node 18 Jest environment
// Node 18 has webcrypto but doesn't expose it as global.crypto in CommonJS Jest
if (!global.crypto) {
  global.crypto = require('crypto').webcrypto;
}
