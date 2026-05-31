# SDK de ecollect para TypeScript / JavaScript

![Node 18+](https://img.shields.io/badge/Node-18%2B-339933?logo=node.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript) ![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)

> **SDK oficial para la pasarela de pagos ecollect en LatAm** — procese tarjetas, transferencias bancarias (PSE / SPEI), guarde tokens de tarjeta, concilie transacciones y verifique webhooks, todo desde Node.js o cualquier entorno moderno de JavaScript.

---

## Tabla de Contenidos

1. [¿Qué es ecollect?](#1-qué-es-ecollect)
2. [Requisitos previos](#2-requisitos-previos)
3. [Instalación](#3-instalación)
4. [Configuración — Inicializar el cliente](#4-configuración--inicializar-el-cliente)
5. [Cómo funcionan los tokens de sesión](#5-cómo-funcionan-los-tokens-de-sesión)
6. [Guardar un token de tarjeta](#6-guardar-un-token-de-tarjeta)
7. [Listar tokens guardados](#7-listar-tokens-guardados)
8. [Procesar un pago](#8-procesar-un-pago)
9. [Obtener sistemas de pago disponibles](#9-obtener-sistemas-de-pago-disponibles)
10. [Consultar el estado de una transacción](#10-consultar-el-estado-de-una-transacción)
11. [Verificación de webhooks](#11-verificación-de-webhooks)
12. [Manejo de errores](#12-manejo-de-errores)
13. [Entorno de pruebas vs producción](#13-entorno-de-pruebas-vs-producción)
14. [Ejemplo completo de principio a fin](#14-ejemplo-completo-de-principio-a-fin)
15. [Uso con TypeScript vs JavaScript](#15-uso-con-typescript-vs-javascript)
16. [Errores comunes](#16-errores-comunes)
17. [Preguntas frecuentes](#17-preguntas-frecuentes)

---

## 1. ¿Qué es ecollect?

ecollect es una pasarela de pagos enfocada en América Latina que permite a los comercios aceptar tarjetas de crédito, tarjetas de débito, transferencias bancarias (PSE en Colombia, SPEI en México), pagos en efectivo y más, todo a través de una sola API unificada. Este SDK encapsula esa API para que usted pueda integrarla en minutos sin tener que lidiar con solicitudes HTTP directas, gestión de sesiones, lógica de reintentos o verificación de firmas.

**El SDK se encarga de todo por usted:**
- Autenticación automática con sus credenciales de API
- Renovación transparente de los tokens de sesión cuando expiran
- Reintentos de errores de red transitorios con espera exponencial
- Mapeo de cada código de error de la API a una excepción JavaScript significativa
- Validación del número de tarjeta (algoritmo de Luhn) y fecha de vencimiento antes de cualquier llamada de red

> ☁️ **Nota sobre el entorno de pruebas:** El entorno de pruebas (`environment: 'test'`) **no cobra dinero real**. Puede ejecutar todos los ejemplos de esta guía con total seguridad. Su clave de API y código de entidad para el entorno de pruebas se obtienen desde el **panel de control de ecollect para comercios**.

---

## 2. Requisitos previos

| Requisito | Versión mínima | Notas |
|---|---|---|
| **Node.js** | 18.0.0 | Necesario para `fetch` nativo y `crypto.subtle` |
| **npm** | 8.x | Incluido con Node 18 |
| **Yarn** (opcional) | 1.22+ | Administrador de paquetes alternativo |
| **TypeScript** (opcional) | 5.0+ | El SDK incluye declaraciones de tipo `.d.ts` completas |

Verifique su versión de Node:

```bash
node --version
# Debe mostrar v18.x.x o superior
```

---

## 3. Instalación

### Usando npm

```bash
npm install ecollect-sdk
```

### Usando Yarn

```bash
yarn add ecollect-sdk
```

### Usando pnpm

```bash
pnpm add ecollect-sdk
```

Después de la instalación verá `ecollect-sdk` en las dependencias de su `package.json`. No se requiere ningún paso de compilación adicional — el paquete se entrega precompilado.

---

## 4. Configuración — Inicializar el cliente

`EcollectClient` es el único punto de entrada para todo en el SDK. Se crea una vez y se reutiliza en toda la aplicación (patrón singleton).

### TypeScript

```typescript
import { EcollectClient } from 'ecollect-sdk';

const cliente = new EcollectClient({
  // 🔑 Su clave de API privada del panel de control de ecollect
  apiKey: 'SU_CLAVE_DE_API_AQUI',

  // 🏪 Su código de entidad/comercio del panel de control de ecollect
  etyCode: 50039,

  // 🌍 Entorno: 'test' para desarrollo, 'prod' para pagos reales
  environment: 'test',

  // 🔢 Código de servicio predeterminado (srvCode). Puede sobreescribirse por pago.
  // Solicite este valor a su gestor de cuenta de ecollect.
  srvCode: 1001,

  // 📝 Nivel de registro: 'debug' | 'info' | 'warn' | 'error' (predeterminado: 'info')
  logLevel: 'info',

  // 🔄 Cuántas veces reintentar solicitudes fallidas automáticamente (predeterminado: 3)
  maxRetries: 3,

  // ⏱️ Espera en milisegundos antes del primer reintento (se duplica en cada reintento, predeterminado: 2000)
  initialBackoffMs: 2000,
});
```

### JavaScript (CommonJS)

```javascript
const { EcollectClient } = require('ecollect-sdk');

const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_API_AQUI',
  etyCode: 50039,
  environment: 'test',
  srvCode: 1001,
});
```

### JavaScript (ESM)

```javascript
import { EcollectClient } from 'ecollect-sdk';

const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_API_AQUI',
  etyCode: 50039,
  environment: 'test',
  srvCode: 1001,
});
```

### Referencia de opciones de configuración

| Opción | Tipo | Requerida | Predeterminado | Descripción |
|---|---|---|---|---|
| `apiKey` | `string` | ✅ Sí | — | Clave de API privada del panel de ecollect |
| `etyCode` | `number` | ✅ Sí | — | Código de comercio/entidad del panel de ecollect |
| `environment` | `'test' \| 'prod'` | ✅ Sí | — | `'test'` para sandbox, `'prod'` para producción |
| `srvCode` | `number` | No | `0` | Código de servicio predeterminado; se puede sobreescribir por pago |
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error'` | No | `'info'` | Controla cuánto registra el SDK en consola |
| `maxRetries` | `number` | No | `3` | Máximo de reintentos automáticos en errores de red |
| `initialBackoffMs` | `number` | No | `2000` | Primera espera de reintento en milisegundos |

> 💡 **¿Dónde encuentro mi clave de API y código de entidad?**
> Inicie sesión en el panel de control de ecollect. Su `apiKey` y `etyCode` aparecen en la sección **Credenciales de API**. Si no tiene acceso, contacte a su representante de cuenta en ecollect.

---

## 5. Cómo funcionan los tokens de sesión

ecollect requiere un **token de sesión** de corta duración para cada llamada a la API. El SDK administra esto de forma completamente automática — usted no necesita llamar a `getSessionToken` por cuenta propia.

Lo que ocurre internamente:

1. Cuando realiza la primera llamada a la API (p. ej. `cliente.payments.process(...)`), el SDK llama a `getSessionToken` con su `apiKey` y `etyCode`.
2. El token se almacena en memoria caché.
3. En las llamadas posteriores, se reutiliza el token almacenado.
4. Si el token expira durante una solicitud, el SDK captura la respuesta `FAIL_APIEXPIREDSESSION`, obtiene un nuevo token y reintenta la llamada original de forma transparente.

Si alguna vez necesita inspeccionar o refrescar manualmente el token de sesión:

```typescript
// Obtener el token de sesión activo actual (crea uno si no existe ninguno)
const sesion = await cliente.session.getActive();
console.log('Token de sesión:', sesion);

// Forzar al SDK a descartar el token almacenado y crear uno nuevo
cliente.session.invalidate();
const nuevaSesion = await cliente.session.getActive();
console.log('Token nuevo:', nuevaSesion);
```

---

## 6. Guardar un token de tarjeta

La tokenización de tarjetas le permite guardar la tarjeta de un cliente de forma segura en los servidores de ecollect. Recibirá un `tokenId` que usted almacena en su propia base de datos. Nunca guarda el número de tarjeta en crudo — ecollect lo hace de forma segura.

### Ejemplo completo: guardar una tarjeta

```typescript
import { EcollectClient } from 'ecollect-sdk';
import type { CardData, SavedCard } from 'ecollect-sdk';

const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_API_AQUI',
  etyCode: 50039,
  environment: 'test',
});

// Construir el objeto con los datos de la tarjeta
const tarjeta: CardData = {
  // 💳 El número completo de tarjeta (el SDK lo valida con Luhn antes de enviarlo)
  cardNumber: '4296005885355275',

  // 📅 Fecha de vencimiento en formato MM/YYYY
  expirationDate: '12/2025',

  // 🔒 CVV / código de seguridad (opcional pero recomendado)
  secureCode: '123',

  // 👤 Nombre completo del titular exactamente como aparece en la tarjeta
  cardHolderName: 'David Caballero',

  // 🪪 Tipo de documento: CC=Cédula colombiana, NIT=NIT, CI=Ecuador/Venezuela, CURP=México
  cardHolderIdType: 'CC',

  // 🔢 El número de documento del titular de la tarjeta
  cardHolderId: '123456799',

  // 💳 Código del sistema de pago:
  //   '1'  = Visa Colombia (CC)
  //   '3'  = VISANET República Dominicana
  //   '6'  = CARDNET República Dominicana
  paymentSystem: '1',

  // 🏦 Código de institución financiera (proporcionado por ecollect; 190 = banco de pruebas)
  fiCode: '190',

  // 📧 Dirección de correo del titular
  email: 'david.caballero@ecollect.co',
};

// Guardar la tarjeta — devuelve un SavedCard con el tokenId
const tarjetaGuardada: SavedCard = await cliente.tokens.save(tarjeta);

console.log('✅ ¡Tarjeta guardada exitosamente!');
console.log('ID del token:', tarjetaGuardada.tokenId);       // ¡Guárdelo en su base de datos!
console.log('Tarjeta enmascarada:', tarjetaGuardada.maskedCard); // p. ej., "****5275"
console.log('Últimos 4 dígitos:', tarjetaGuardada.last4);
console.log('Nombre del banco:', tarjetaGuardada.fiName);
console.log('URL de imagen de marca:', tarjetaGuardada.brandImageUrl);
```

### Otros comandos de token

```typescript
// GET — obtener un token temporal sin guardar la tarjeta permanentemente
const tokenTemporal = await cliente.tokens.get(tarjeta);
console.log('Token temporal (expira pronto):', tokenTemporal.tokenId);

// HOLD — obtener un token de reserva para flujos de pre-autorización
const tokenReserva = await cliente.tokens.hold(tarjeta);
console.log('Token de reserva:', tokenReserva.tokenId);

// UPDATE — actualizar la fecha de vencimiento de un token guardado existente
const tarjetaActualizada = await cliente.tokens.update(
  'id-del-token-existente',  // El tokenId que guardó anteriormente
  '06/2027',                  // Nueva fecha de vencimiento
  '123456799',                // Número de documento del titular (opcional)
);
console.log('Vencimiento actualizado, token aún válido:', tarjetaActualizada.tokenId);

// DELETE (REMOVE) — eliminar permanentemente un token guardado
await cliente.tokens.delete(
  'id-del-token-existente',          // El tokenId a eliminar
  'david.caballero@ecollect.co',     // Correo del titular
  '123456799',                        // Número de documento del titular
);
console.log('Token de tarjeta eliminado.');
```

---

## 7. Listar tokens guardados

Para mostrar a un cliente sus métodos de pago guardados (p. ej., en una página de pago), llame a `queryToken`:

```typescript
import { EcollectClient } from 'ecollect-sdk';
import type { SavedCard } from 'ecollect-sdk';

const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_API_AQUI',
  etyCode: 50039,
  environment: 'test',
});

// Listar todas las tarjetas guardadas de un cliente específico
// Tanto el correo como el número de documento son requeridos por seguridad
const tarjetasGuardadas: SavedCard[] = await cliente.tokens.list(
  'david.caballero@ecollect.co', // Correo del cliente
  '123456799',                    // Número de documento del cliente
);

if (tarjetasGuardadas.length === 0) {
  console.log('Este cliente no tiene tarjetas guardadas.');
} else {
  console.log(`Se encontraron ${tarjetasGuardadas.length} tarjeta(s) guardada(s):`);

  for (const tarjeta of tarjetasGuardadas) {
    console.log('---');
    console.log('ID del token:', tarjeta.tokenId);
    console.log('Tarjeta enmascarada:', tarjeta.maskedCard);
    console.log('Últimos 4:', tarjeta.last4);
    console.log('Banco:', tarjeta.fiName);
    console.log('Estado:', tarjeta.tokenStatus); // 'ACTIVE' | 'VERIFY' | 'EXPIRED'
    console.log('Requiere OTP:', tarjeta.requiresOneTimePassword);
  }
}
```

---

## 8. Procesar un pago

### 8.1 Pago con nueva tarjeta (pago alojado)

Esto crea una URL de pago alojado a la que redirige al usuario. ecollect se encarga del formulario de tarjeta.

```typescript
import { EcollectClient } from 'ecollect-sdk';
import type { PaymentIntent, TransactionResult } from 'ecollect-sdk';

const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_API_AQUI',
  etyCode: 50039,
  environment: 'test',
  srvCode: 1001,
});

const intencionDePago: PaymentIntent = {
  // 💰 Monto a cobrar (en la unidad principal de la moneda, p. ej., 50000 = $50,000 COP)
  amount: 50000,

  // 🧾 Porción de IVA/impuesto del total (opcional)
  vatAmount: 7983,

  // 💱 Código de moneda ISO 4217: COP, MXN, DOP, USD
  currency: 'COP',

  // 🔖 Su ID interno de orden/transacción (debe ser único por transacción)
  merchantTransactionId: 'ORDEN-2024-001',

  // 👤 Información del cliente
  customer: {
    fullName: 'David Caballero',
    email: 'david.caballero@ecollect.co',
    phone: '+1 311111111',
    documentType: 'CC',
    documentNumber: '123456799',
  },

  // 🔀 URL a la que ecollect redirige después de que el cliente paga en su página
  redirectUrl: 'https://susitio.com/pago/exito',

  // 🔔 URL a la que ecollect envía el resultado del pago (su endpoint de webhook)
  responseUrl: 'https://susitio.com/webhooks/ecollect',

  // 🌐 Idioma para la página de pago de ecollect: 'ES' o 'EN'
  langCode: 'ES',
};

const resultado: TransactionResult = await cliente.payments.process(intencionDePago);

console.log('Código de retorno:', resultado.returnCode); // 'SUCCESS'
console.log('ID del ticket:', resultado.ticketId);       // ¡Guárdelo!

// Para el pago alojado, redirija al usuario a esta URL
if (resultado.eCollectUrl) {
  console.log('Redirigir usuario a:', resultado.eCollectUrl);
}
```

### 8.2 Pago con token de tarjeta guardado (pago en un clic)

Una vez que tiene un `tokenId` del paso 6, puede cobrar la tarjeta directamente.

```typescript
const intencionConToken: PaymentIntent = {
  amount: 50000,
  currency: 'COP',
  merchantTransactionId: 'ORDEN-2024-002', // Debe ser único cada vez

  customer: {
    fullName: 'David Caballero',
    email: 'david.caballero@ecollect.co',
    documentType: 'CC',
    documentNumber: '123456799',
  },

  // 🪙 El tokenId de cliente.tokens.save() o cliente.tokens.list()
  tokenId: 'el-token-id-que-guardo-antes',

  // Sistema de pago y código de institución asociados a la tarjeta guardada
  paymentSystem: '1',
  fiCode: '190',

  // 🔒 CVV (requerido para la mayoría de pagos con token)
  secureCode: '123',

  // Opcional: número de cuotas
  installments: 1,
};

const resultado = await cliente.payments.process(intencionConToken);
console.log('Estado del pago:', resultado.tranState); // 'OK' significa aprobado!
console.log('Código de trazabilidad:', resultado.trazabilityCode);
```

### 8.3 Pre-autorización y captura

La pre-autorización reserva fondos en la tarjeta sin cobrar.

```typescript
// Paso 1: Pre-autorizar (reservar fondos)
const resultadoPreAuth = await cliente.payments.preAuthorize(intencionDePago);
const ticketId = resultadoPreAuth.ticketId!;
console.log('Fondos reservados. ID del ticket:', ticketId);

// Paso 2: Capturar el cobro real
const resultadoCaptura = await cliente.payments.capture(ticketId, 45000);
console.log('¡Cobrado!', resultadoCaptura.tranState);

// O anular la reserva sin cobrar
await cliente.payments.void(ticketId);
console.log('Reserva cancelada, cliente no cobrado.');
```

### Descripción de los campos de TransactionResult

| Campo | Descripción |
|---|---|
| `returnCode` | `'SUCCESS'` si la llamada fue exitosa (¡no significa que el pago fue aprobado!) |
| `ticketId` | ID único de transacción de ecollect — **guárdelo en su base de datos** |
| `tranState` | Resultado: `'OK'` = aprobado, `'NOT_AUTHORIZED'` = rechazado |
| `trazabilityCode` | Número de referencia del banco para conciliación |
| `transValue` | Monto final cobrado |
| `bankProcessDate` | Fecha y hora en que el banco procesó la transacción |
| `eCollectUrl` | URL para redirigir al usuario en el pago alojado |

---

## 9. Obtener sistemas de pago disponibles

```typescript
const sistemasDePago = await cliente.paymentSystems.list();

for (const sp of sistemasDePago) {
  console.log('Código:', sp.paymentSystem);
  // '0'   = PSE (transferencias bancarias colombianas)
  // '1'   = Tarjetas de crédito/débito (Colombia)
  // '7'   = SPEI (transferencias bancarias mexicanas)
  // '10'  = Enlace de pago
  // '100' = Pago en efectivo

  console.log('Imagen de marca:', sp.brandImageUrl);

  if (sp.financialInstitutions) {
    for (const fi of sp.financialInstitutions) {
      console.log(`  Banco: ${fi.fiName} (código: ${fi.fiCode})`);
    }
  }
}
```

---

## 10. Consultar el estado de una transacción

```typescript
const estado = await cliente.reconciliation.getTransactionStatus(987654);

console.log('Estado de la transacción:', estado.tranState);
// 'OK'             — Pago aprobado y liquidado ✅
// 'NOT_AUTHORIZED' — El banco rechazó el pago ❌
// 'PENDING'        — Aún en proceso (p. ej., transferencia PSE en curso)
// 'BANK'           — Enviado al banco, esperando confirmación
// 'CAPTURED'       — La pre-autorización fue capturada
// 'CREATED'        — Transacción creada pero aún no procesada
// 'EXPIRED'        — La transacción expiró sin ser pagada
// 'FAILED'         — Error técnico

console.log('Monto cobrado:', estado.transValue);
console.log('Referencia bancaria:', estado.trazabilityCode);
```

### Sondeo automático

```typescript
import { PollingTimeoutException } from 'ecollect-sdk';

try {
  const resultadoFinal = await cliente.reconciliation.reconciliate(
    987654,    // ticketId
    600_000,   // tiempo límite en milisegundos (10 minutos)
  );

  if (resultadoFinal.tranState === 'OK') {
    console.log('¡Pago completado exitosamente!');
  }
} catch (err) {
  if (err instanceof PollingTimeoutException) {
    console.log('Tiempo de espera agotado. Consulte el estado manualmente más tarde.');
  }
}
```

---

## 11. Verificación de webhooks

Cuando un pago se completa, ecollect envía un POST a su `responseUrl`. Debe verificar que proviene genuinamente de ecollect.

```typescript
import express from 'express';
import { EcollectClient, WebhookValidationException } from 'ecollect-sdk';
import type { WebhookPayload } from 'ecollect-sdk';

const app = express();
app.use(express.json());

const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_API_AQUI',
  etyCode: 50039,
  environment: 'test',
});

app.post('/webhooks/ecollect', async (req, res) => {
  const payload = req.body as WebhookPayload;

  try {
    // Verificar que el webhook es genuino mediante la API verifySessionToken de ecollect
    const tokenSesion = await cliente.session.getActive();
    const resultado = await cliente.webhooks.confirmWebhook(payload, tokenSesion);

    console.log('¡Webhook verificado! Estado:', resultado.tranState);

    if (resultado.tranState === 'OK') {
      // Marcar la orden como pagada en su base de datos
      await marcarOrdenComoPagada(resultado.ticketId!, resultado.trazabilityCode!);
    }

    // IMPORTANTE: Debe responder con este JSON exacto o ecollect reintentará
    res.json({ ReturnCode: 'SUCCESS' });

  } catch (err) {
    if (err instanceof WebhookValidationException) {
      console.error('Webhook inválido:', err.message);
      res.status(400).json({ ReturnCode: 'FAIL_SYSTEM' });
    } else {
      throw err;
    }
  }
});
```

### Verificación de firma HMAC (opcional)

```typescript
const esValido = await cliente.webhooks.verifyWebhookSignature(
  req.body,
  req.headers['x-ecollect-sig'] as string,
  'SU_SECRETO_DE_WEBHOOK',
);

if (!esValido) {
  res.status(401).send('Firma inválida');
  return;
}
```

---

## 12. Manejo de errores

```typescript
import {
  EcollectError,
  InvalidCardException,
  InsufficientFundsException,
  TokenNotFoundException,
  SessionExpiredException,
  ValidationException,
  NetworkRetryableException,
  DuplicateTransactionException,
  AuthenticationException,
  WebhookValidationException,
  CardMismatchException,
  PollingTimeoutException,
  InvalidConfigException,
} from 'ecollect-sdk';

try {
  const resultado = await cliente.payments.process(intencionDePago);
} catch (err) {

  if (err instanceof InvalidCardException) {
    // Número de tarjeta inválido o fecha de vencimiento incorrecta
    console.error('Tarjeta inválida:', err.message);

  } else if (err instanceof InsufficientFundsException) {
    // El banco rechazó por fondos insuficientes
    console.error('Fondos insuficientes — solicite al usuario otra tarjeta');

  } else if (err instanceof DuplicateTransactionException) {
    // merchantTransactionId ya fue usado
    console.error('ID de orden duplicado — genere un nuevo merchantTransactionId');

  } else if (err instanceof TokenNotFoundException) {
    // El tokenId no existe o ya fue eliminado
    console.error('Tarjeta guardada no encontrada — solicite al cliente ingresar la tarjeta nuevamente');

  } else if (err instanceof ValidationException) {
    // Campo requerido faltante o inválido
    console.error('Error de validación:', err.message);

  } else if (err instanceof NetworkRetryableException) {
    // Error temporal del servidor, reintentos agotados
    console.error('ecollect no disponible temporalmente. Intente más tarde.');

  } else if (err instanceof AuthenticationException) {
    // Clave de API o código de entidad incorrecto
    console.error('Autenticación fallida — verifique apiKey y etyCode');

  } else if (err instanceof CardMismatchException) {
    // Tarjeta vinculada a un usuario diferente
    console.error('La tarjeta pertenece a un usuario diferente');

  } else if (err instanceof InvalidConfigException) {
    // Argumentos incorrectos en el constructor
    console.error('SDK mal configurado:', err.message);

  } else if (err instanceof EcollectError) {
    // Cualquier otro error de ecollect
    console.error(`Error de ecollect [${err.code}]:`, err.message);
    console.error('Código de retorno:', err.returnCode);

  } else {
    throw err; // Error inesperado genuino
  }
}
```

### Referencia de clases de error

| Clase | Código | Cuándo se lanza |
|---|---|---|
| `EcollectError` | varía | Clase base para todos los errores del SDK |
| `InvalidConfigException` | `INVALID_CONFIG` | Argumentos incorrectos en el constructor |
| `SessionExpiredException` | `SESSION_EXPIRED` | Token expirado (generalmente se recupera automáticamente) |
| `ValidationException` | `VALIDATION_ERROR` | Campo faltante/inválido en su solicitud |
| `InvalidCardException` | `INVALID_CARD` | Número de tarjeta o fecha de vencimiento incorrectos |
| `InsufficientFundsException` | `INSUFFICIENT_FUNDS` | Banco rechazó por falta de fondos |
| `NetworkRetryableException` | `NETWORK_RETRYABLE` | Error temporal del servidor, reintentos agotados |
| `TokenNotFoundException` | `TOKEN_NOT_FOUND` | El ID de token no existe |
| `TokenExpiredException` | `TOKEN_EXPIRED` | La tarjeta vinculada al token ha expirado |
| `TokenValidationException` | `TOKEN_VALIDATION` | Solicitud de token sin campos requeridos |
| `DuplicateTransactionException` | `DUPLICATE_TRANSACTION` | `merchantTransactionId` ya fue usado |
| `DuplicateInvoiceException` | `DUPLICATE_INVOICE` | El número de factura ya existe |
| `AuthenticationException` | `AUTHENTICATION_ERROR` | Clave de API/entidad inválida o bloqueada |
| `WebhookValidationException` | `WEBHOOK_VALIDATION` | El payload del webhook es falso o inválido |
| `CustomerNotFoundException` | `CUSTOMER_NOT_FOUND` | El ID de cliente no existe |
| `CardMismatchException` | `CARD_MISMATCH` | Tarjeta vinculada a un usuario diferente |
| `TicketNotFoundException` | `TICKET_NOT_FOUND` | El ID de ticket no existe |
| `PollingTimeoutException` | `POLLING_TIMEOUT` | `reconciliate()` agotó el tiempo de espera |
| `PolicyConfigException` | `POLICY_CONFIG` | Código de política inválido o no configurado |

---

## 13. Entorno de pruebas vs producción

### Entorno de pruebas

```typescript
const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_PRUEBAS',
  etyCode: 50039,
  environment: 'test', // Usa https://test1.e-collect.com/app_express/api/
});
```

- **No cobra dinero real**
- Tarjeta de prueba: `4296005885355275`, vencimiento `12/2025`, cualquier CVV
- Titular: David Caballero, CC 123456799, FiCode 190

### Entorno de producción

```typescript
const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_PRODUCCION',   // ¡Diferente a la de pruebas!
  etyCode: 12345,
  environment: 'prod',                 // Usa https://www.e-collect.com/app_Express/api/
});
```

> ⚠️ **Nunca incluya credenciales en el código fuente.** Use variables de entorno:

```typescript
const cliente = new EcollectClient({
  apiKey: process.env.ECOLLECT_API_KEY!,
  etyCode: Number(process.env.ECOLLECT_ETY_CODE!),
  environment: (process.env.ECOLLECT_ENV ?? 'test') as 'test' | 'prod',
});
```

Archivo `.env` (agréguelo a `.gitignore`):

```
ECOLLECT_API_KEY=su-clave-secreta
ECOLLECT_ETY_CODE=50039
ECOLLECT_ENV=test
```

---

## 14. Ejemplo completo de principio a fin

```typescript
/**
 * SDK de ecollect — ejemplo completo de principio a fin
 * Ejecutar con: npx ts-node ejemplo.ts
 */

import {
  EcollectClient,
  EcollectError,
  InvalidCardException,
  InsufficientFundsException,
} from 'ecollect-sdk';
import type { CardData, PaymentIntent } from 'ecollect-sdk';

// ─── 1. Inicializar el cliente ────────────────────────────────────────────
const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_DE_PRUEBAS',
  etyCode: 50039,
  environment: 'test',
  srvCode: 1001,
  logLevel: 'info',
});

async function principal() {
  // ─── 2. Guardar token de tarjeta ──────────────────────────────────────────
  console.log('\n📦 Guardando token de tarjeta...');

  const tarjeta: CardData = {
    cardNumber: '4296005885355275',
    expirationDate: '12/2025',
    secureCode: '123',
    cardHolderName: 'David Caballero',
    cardHolderIdType: 'CC',
    cardHolderId: '123456799',
    paymentSystem: '1',
    fiCode: '190',
    email: 'david.caballero@ecollect.co',
  };

  const tarjetaGuardada = await cliente.tokens.save(tarjeta);
  console.log('✅ ¡Tarjeta guardada!');
  console.log('   ID del token:', tarjetaGuardada.tokenId); // ¡Guárdelo en su BD!
  console.log('   Enmascarada:', tarjetaGuardada.maskedCard);

  // ─── 3. Listar tarjetas guardadas ─────────────────────────────────────────
  console.log('\n📋 Listando tarjetas guardadas...');
  const tarjetas = await cliente.tokens.list('david.caballero@ecollect.co', '123456799');
  console.log(`✅ Se encontraron ${tarjetas.length} tarjeta(s).`);

  // ─── 4. Procesar pago con token ───────────────────────────────────────────
  console.log('\n💳 Procesando pago...');

  const intencionDePago: PaymentIntent = {
    amount: 50000,
    vatAmount: 7983,
    currency: 'COP',
    merchantTransactionId: `ORDEN-${Date.now()}`, // Único por transacción
    customer: {
      fullName: 'David Caballero',
      email: 'david.caballero@ecollect.co',
      phone: '+1 311111111',
      documentType: 'CC',
      documentNumber: '123456799',
    },
    tokenId: tarjetaGuardada.tokenId, // Usar el token guardado
    paymentSystem: '1',
    fiCode: '190',
    secureCode: '123',
    installments: 1,
    responseUrl: 'https://susitio.com/webhooks/ecollect',
  };

  const resultado = await cliente.payments.process(intencionDePago);
  console.log('✅ ¡Pago procesado!');
  console.log('   ID del ticket:', resultado.ticketId);
  console.log('   Estado:', resultado.tranState);
  console.log('   Trazabilidad:', resultado.trazabilityCode);

  // ─── 5. Consultar estado ──────────────────────────────────────────────────
  if (resultado.ticketId) {
    console.log('\n🔍 Consultando estado...');
    const estado = await cliente.reconciliation.getTransactionStatus(resultado.ticketId);
    console.log('   Estado final:', estado.tranState);
    console.log('   Monto cobrado:', estado.transValue, estado.payCurrency);
  }

  // ─── 6. Sistemas de pago disponibles ─────────────────────────────────────
  console.log('\n🏦 Sistemas de pago disponibles:');
  const sistemas = await cliente.paymentSystems.list();
  for (const sp of sistemas) {
    console.log('  -', sp.paymentSystem, '→', sp.brandImageUrl ?? '(sin imagen)');
  }

  console.log('\n🎉 ¡Todo listo!');
}

principal().catch((err) => {
  if (err instanceof InvalidCardException) {
    console.error('❌ Tarjeta inválida:', err.message);
  } else if (err instanceof InsufficientFundsException) {
    console.error('❌ Fondos insuficientes');
  } else if (err instanceof EcollectError) {
    console.error(`❌ Error de ecollect [${err.code}]:`, err.message);
  } else {
    console.error('❌ Error inesperado:', err);
  }
  process.exit(1);
});
```

---

## 15. Uso con TypeScript vs JavaScript

### TypeScript (recomendado)

```typescript
import { EcollectClient } from 'ecollect-sdk';
import type { PaymentIntent, TransactionResult, SavedCard } from 'ecollect-sdk';

// TypeScript verifica los tipos en tiempo de compilación — detecta errores antes de ejecutar
const intencion: PaymentIntent = {
  amount: 50000,
  currency: 'COP',
  customer: { fullName: 'David Caballero', email: 'david@ejemplo.com' },
};
```

### JavaScript (ESM)

```javascript
import { EcollectClient } from 'ecollect-sdk';

const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_AQUI',
  etyCode: 50039,
  environment: 'test',
});
```

### JavaScript (CommonJS)

```javascript
const { EcollectClient } = require('ecollect-sdk');

const cliente = new EcollectClient({
  apiKey: 'SU_CLAVE_AQUI',
  etyCode: 50039,
  environment: 'test',
});
```

> 💡 Si obtiene `ERR_REQUIRE_ESM`, use `import` o `const { EcollectClient } = await import('ecollect-sdk')`.

---

## 16. Errores comunes

### "apiKey is required"

```typescript
// ❌ Incorrecto
new EcollectClient({ apiKey: '', etyCode: 50039, environment: 'test' });

// ✅ Correcto
new EcollectClient({ apiKey: 'mi-clave-real', etyCode: 50039, environment: 'test' });
```

### "etyCode must be a positive integer"

```typescript
// ❌ Incorrecto — etyCode no puede ser 0
new EcollectClient({ apiKey: 'clave', etyCode: 0, environment: 'test' });

// ✅ Correcto
new EcollectClient({ apiKey: 'clave', etyCode: 50039, environment: 'test' });
```

### "srvCode is required"

```typescript
// ✅ Opción 1: en el constructor
new EcollectClient({ ..., srvCode: 1001 });

// ✅ Opción 2: por pago
const intencion: PaymentIntent = { ..., srvCode: 1001 };
```

### "Card number is invalid (Luhn check failed)"

```typescript
// Use el número de tarjeta de prueba:
cardNumber: '4296005885355275'
```

### `FAIL_INVALIDENTITYCODE`

Verifique que `etyCode` sea correcto para el entorno elegido (pruebas y producción usan códigos diferentes).

### `FAIL_ACCESSDENIED`

Su clave de API es incorrecta o fue revocada. Regenere la clave en el panel de ecollect.

### `FAIL_MERCHANTRANSID`

Está reutilizando un `merchantTransactionId`. Use `ORDER-${Date.now()}` o un UUID para garantizar unicidad.

---

## 17. Preguntas frecuentes

**P: ¿Necesito llamar a `getSessionToken` yo mismo?**

No. El SDK lo gestiona automáticamente.

---

**P: ¿Dónde obtengo mi clave de API y código de entidad?**

En el panel de control de ecollect, sección **Credenciales de API**. Si no tiene acceso, contacte a su representante de ecollect.

---

**P: ¿El entorno de pruebas cobrará mi tarjeta?**

No. Es un sandbox completo que nunca cobra dinero real.

---

**P: ¿Puedo usar el SDK en el navegador?**

No. El SDK es para uso en el lado del servidor. Su clave de API debe mantenerse en secreto.

---

**P: ¿Qué es un código de servicio (`srvCode`)?**

Identifica un servicio de pago específico de su cuenta. ecollect lo proporciona al configurar su comercio.

---

**P: ¿Qué es un código de institución financiera (`fiCode`)?**

Identifica el banco adquirente (para tarjetas) o el banco del cliente (para PSE/SPEI). La lista completa se obtiene con `cliente.paymentSystems.list()`.

---

**P: ¿Qué ocurre si la red falla a mitad de un pago?**

El SDK reintenta `maxRetries` veces con espera exponencial. Siempre consulte el estado con `getTransactionStatus(ticketId)` antes de reintentar.

---

**P: ¿Cómo manejo los pagos con PSE?**

PSE es asíncrono. El flujo es: procesar con `paymentSystem: '0'` → redirigir al usuario a `eCollectUrl` → recibir webhook cuando el banco confirme → o usar `reconciliate(ticketId)` para esperar.

---

*Para más ayuda, visite [https://www.e-collect.com](https://www.e-collect.com) o contacte al equipo de soporte de ecollect.*
