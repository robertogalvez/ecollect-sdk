# Plan de Simulador de Pruebas — ecollect SDK

## Visión General

El simulador es una aplicación web de referencia que corre en **Netlify + Neon (PostgreSQL)** y actúa como un comercio ficticio ("TiendaDemo"). Su propósito es doble:

1. **Validar el SDK en condiciones reales** contra el sandbox de ecollect antes del GA.
2. **Servir como app de ejemplo** ("quickstart") que los clientes puedan clonar y adaptar.

La app cubre todos los flujos del SDK de forma interactiva, con UI mínima pero funcional, logs visibles en pantalla y trazabilidad completa en base de datos.

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React + Vite (TypeScript) | Ligero, desplegable como sitio estático en Netlify |
| Backend | Netlify Functions (Node.js) | Serverless; ejecuta el SDK TypeScript en server-side donde vive la ApiKey |
| Base de datos | Neon (PostgreSQL serverless) | Sin servidor dedicado; gratis tier suficiente para pruebas; compatible con Drizzle ORM |
| ORM | Drizzle ORM | Ligero, TypeScript-first, compatible con Neon |
| Estilos | Tailwind CSS | Sin build pesado; suficiente para UI funcional |
| SDK bajo prueba | `ecollect-sdk` (TypeScript) | El paquete local del monorepo via `npm link` |

---

## Arquitectura de la Aplicación

```
Browser (React SPA en Netlify CDN)
       │  llamadas fetch a /.netlify/functions/*
       ▼
Netlify Functions (Node.js serverless)
  ├── /session          → getSessionToken (usa ApiKey privada)
  ├── /payment          → createTransactionPayment
  ├── /token            → tokenCommand (GET/SAVE/HOLD/REMOVE/UPDATE)
  ├── /query-tokens     → queryToken
  ├── /payment-systems  → getPaymentSystem
  ├── /transaction      → getTransactionInformation
  ├── /customer         → getCustomerId
  ├── /verify-webhook   → verifySessionToken
  └── /webhook          → endpoint receptor de webhooks de ecollect
       │  usa ecollect-sdk TypeScript
       │  escribe/lee en Neon via Drizzle
       ▼
Neon PostgreSQL
  ├── transactions       → registro de todas las transacciones de prueba
  ├── saved_cards        → tarjetas tokenizadas (sin PAN)
  ├── customers          → CustomerId + datos de clientes de prueba
  ├── webhook_events     → webhooks recibidos de ecollect
  └── test_sessions      → sesiones de prueba activas
```

**Flujo de seguridad:**
- `ECOLLECT_API_KEY` y `ECOLLECT_ETY_CODE` viven en variables de entorno de Netlify (nunca en el frontend).
- El frontend solo recibe `SessionToken` (devuelto por `/session`) y lo usa para el componente de captura de tarjeta.
- El `SessionToken` tiene TTL de 30 min; la app lo refresca automáticamente.

---

## Esquema de Base de Datos (Neon / Drizzle)

```typescript
// schema.ts

export const transactions = pgTable('transactions', {
  id:                  serial('id').primaryKey(),
  ticketId:            integer('ticket_id'),
  trazabilityCode:     varchar('trazability_code', { length: 100 }),
  merchantTransactionId: varchar('merchant_transaction_id', { length: 100 }).unique(),
  tranState:           varchar('tran_state', { length: 30 }),
  transValue:          decimal('trans_value', { precision: 12, scale: 2 }),
  transVatValue:       decimal('trans_vat_value', { precision: 12, scale: 2 }),
  payCurrency:         varchar('pay_currency', { length: 10 }),
  currencyRate:        decimal('currency_rate', { precision: 10, scale: 6 }),
  paymentSystem:       varchar('payment_system', { length: 10 }),
  fiCode:              varchar('fi_code', { length: 50 }),
  fiName:              varchar('fi_name', { length: 100 }),
  bankProcessDate:     timestamp('bank_process_date'),
  invoice:             varchar('invoice', { length: 100 }),
  testScenario:        varchar('test_scenario', { length: 100 }),  // etiqueta del caso de prueba
  requestPayload:      jsonb('request_payload'),                   // payload enviado al SDK
  responsePayload:     jsonb('response_payload'),                  // respuesta recibida
  errorCode:           varchar('error_code', { length: 100 }),
  errorMessage:        text('error_message'),
  createdAt:           timestamp('created_at').defaultNow(),
  resolvedAt:          timestamp('resolved_at'),
});

export const savedCards = pgTable('saved_cards', {
  id:           serial('id').primaryKey(),
  tokenId:      varchar('token_id', { length: 200 }).notNull(),
  customerId:   varchar('customer_id', { length: 100 }),
  maskedCard:   varchar('masked_card', { length: 30 }),
  bin4:         varchar('bin4', { length: 4 }),
  last4:        varchar('last4', { length: 4 }),
  fiCode:       varchar('fi_code', { length: 50 }),
  fiName:       varchar('fi_name', { length: 100 }),
  brandImageUrl: varchar('brand_image_url', { length: 500 }),
  tokenStatus:  varchar('token_status', { length: 20 }),   // ACTIVE | VERIFY | EXPIRED
  lifetimeSecs: integer('lifetime_secs'),
  createdAt:    timestamp('created_at').defaultNow(),
});

export const customers = pgTable('customers', {
  id:          serial('id').primaryKey(),
  customerId:  varchar('customer_id', { length: 100 }).unique(),
  email:       varchar('email', { length: 200 }),
  documentType: varchar('document_type', { length: 20 }),
  documentNumber: varchar('document_number', { length: 50 }),
  fullName:    varchar('full_name', { length: 200 }),
  country:     varchar('country', { length: 5 }),
  createdAt:   timestamp('created_at').defaultNow(),
});

export const webhookEvents = pgTable('webhook_events', {
  id:              serial('id').primaryKey(),
  ticketId:        integer('ticket_id'),
  sessionToken:    varchar('session_token', { length: 500 }),
  tranState:       varchar('tran_state', { length: 30 }),
  verified:        boolean('verified').default(false),
  rawPayload:      jsonb('raw_payload'),
  receivedAt:      timestamp('received_at').defaultNow(),
});
```

---

## Pantallas y Casos de Prueba

### 1. Dashboard Principal
- Lista de transacciones recientes con estado en tiempo real (polling automático cada 10s para estados intermedios).
- Botones de acceso rápido a cada escenario de prueba.
- Indicador de conexión con el sandbox de ecollect (ping a `getSessionToken`).
- Panel de logs en vivo (últimas 50 operaciones del SDK).

---

### 2. Módulo: Checkout con Tarjeta (Flujo Embebido)

**Escenarios de prueba:**

| # | Escenario | Resultado esperado | TranState final |
|---|---|---|---|
| T-01 | Pago exitoso con tarjeta Visa Colombia | OK | OK |
| T-02 | Pago exitoso con tarjeta Mastercard RD | OK | OK |
| T-03 | Tarjeta con fondos insuficientes | InvalidCardException | NOT_AUTHORIZED |
| T-04 | Tarjeta expirada | InvalidCardException | NOT_AUTHORIZED |
| T-05 | CVV incorrecto | InvalidCardException | NOT_AUTHORIZED |
| T-06 | Pago en cuotas (Colombia, 3 cuotas) | OK | OK |
| T-07 | Pago con tarjeta guardada existente | OK (sin re-tokenizar) | OK |
| T-08 | Luhn inválido (validación SDK pre-API) | ValidationError (no llega a ecollect) | — |
| T-09 | MerchantTransactionId duplicado (reintento) | DuplicateTransactionException | — |
| T-10 | Simulación timeout red (requestTimeout=1s) | NetworkRetryableException + retry | OK (tras retry) |

**UI:**
- Formulario con `EcollectCardField` (iframe seguro) + campos de cliente.
- Selector de país dinámico: Colombia / Rep. Dominicana / México.
- Checkbox "Guardar tarjeta".
- Panel derecho: JSON del request y response en tiempo real.

---

### 3. Módulo: Hosted Checkout (Redirect)

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| H-01 | Redirect a ecollect, pago exitoso, vuelta al simulador | OK — transacción resuelta vía callback |
| H-02 | Redirect a ecollect, usuario abandona sin pagar | CREATED → EXPIRED (resuelto por proceso sonda) |
| H-03 | Redirect a ecollect, pago rechazado | NOT_AUTHORIZED — callback recibido |

**UI:**
- Botón "Pagar con ecollect" que genera la URL y abre en nueva pestaña.
- Listener en el callback URL (`/return`) que actualiza el estado en Neon y muestra resultado.

---

### 4. Módulo: Link de Pagos (Email / SMS / QR)

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| L-01 | Generar link vía Email | Link creado, email enviado por ecollect |
| L-02 | Generar link vía SMS | Link creado, SMS enviado por ecollect |
| L-03 | Generar link vía QR | QR renderizado en pantalla con `LifetimeSecs` visible |
| L-04 | Link expirado (LifetimeSecs=60, esperar 2 min) | TranState=EXPIRED |

**UI:**
- Formulario con campos de cliente + selector de método (email/sms/qr).
- Para QR: renderizar imagen QR en pantalla usando `qrcode` npm package.
- Countdown del `LifetimeSecs` en tiempo real.

---

### 5. Módulo: Pre-Autorización y Captura (RD)

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| P-01 | Pre-auth → captura total | OK → OK |
| P-02 | Pre-auth → captura parcial (monto menor) | OK → OK (diferencia liberada) |
| P-03 | Pre-auth → anulación (void) | OK → anulación confirmada |
| P-04 | Pre-auth con FICode=AZUL | OK (autorizador AZUL) |
| P-05 | Pre-auth con FICode=CARDNET | OK (autorizador CARDNET) |
| P-06 | Captura sin pre-auth previa (ticketId inválido) | TicketNotFoundException |

**UI:**
- Paso 1: Formulario pre-autorización + monto.
- Paso 2: Botones "Capturar [monto]" y "Anular" habilitados tras pre-auth exitosa.
- Input de monto final en captura (validar ≤ monto original).

---

### 6. Módulo: PSE Colombia

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| PSE-01 | Pago PSE persona natural | BANK → (webhook/polling) → OK |
| PSE-02 | Pago PSE persona jurídica | BANK → OK |
| PSE-03 | Sin UserType (error de validación SDK) | ValidationError (no llega a ecollect) |
| PSE-04 | Banco rechaza (fondos) | NOT_AUTHORIZED |

**UI:**
- Selector de banco (cargado de `getPaymentSystem` en tiempo real).
- Toggle Persona Natural / Jurídica.
- Indicador de estado intermedio BANK con spinner + proceso sonda visible.

---

### 7. Módulo: Pagos Presenciales (Cash/Caja)

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| C-01 | Generar referencia presencial con vencimiento | CAPTURED — referencia generada |
| C-02 | Referencia vencida (InvoiceDueDate pasada) | EXPIRED |
| C-03 | Invoice duplicado | DuplicateInvoiceException |

**UI:**
- Formulario con Invoice (texto libre) + DateTimePicker para InvoiceDueDate.
- Mostrar referencia generada con QR imprimible.

---

### 8. Módulo: Gestión de Tarjetas

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| G-01 | Tokenizar nueva tarjeta (SAVE) | Token creado, SavedCard en DB |
| G-02 | Tokenizar tarjeta ya existente | SUCCESS_ALREADY_CREATED → token existente retornado |
| G-03 | Listar tarjetas guardadas del cliente | Lista de SavedCards con MaskedCard |
| G-04 | Eliminar tarjeta | Token eliminado, removida de DB |
| G-05 | Actualizar fecha de vencimiento | Token actualizado |
| G-06 | Tarjeta con TokenStatus=VERIFY (OTP) | OTPRequiredException → campo OTP → retry exitoso |
| G-07 | Tarjeta con TokenStatus=EXPIRED | UI muestra opción "Actualizar" o "Eliminar" |
| G-08 | Token temporal GET (pago único) | Token con LifetimeSecs, no persiste en DB |

**UI:**
- Lista de tarjetas guardadas con logo de franquicia + MaskedCard.
- Modal de OTP cuando ecollect lo requiere.
- Botones por tarjeta: Pagar / Actualizar / Eliminar.

---

### 9. Módulo: Webhooks

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| W-01 | Webhook recibido, verificación via API ecollect | verified=true, transacción actualizada en DB |
| W-02 | Webhook con SessionToken inválido (simulado) | WebhookValidationException, evento marcado como rechazado |
| W-03 | Webhook recibido fuera de ventana 60 min | Registrado pero advertencia en UI |
| W-04 | Responder FAIL_SYSTEM al webhook (forzar retry) | ecollect reintenta; segundo intento responde SUCCESS |

**UI:**
- Feed en tiempo real de webhooks recibidos (polling Neon cada 5s o WebSocket).
- Para cada evento: payload completo, estado de verificación, BankProcessDate.
- Botón "Simular webhook falso" (payload con SessionToken inválido).

---

### 10. Módulo: Dispersión de Pagos (SubservicesArray)

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| D-01 | Dispersión en 2 cuentas por porcentaje (60%/40%) | OK |
| D-02 | Dispersión en 3 cuentas por valor fijo | OK |
| D-03 | Dispersión que no suma 100% (error SDK pre-API) | ValidationError |

**UI:**
- Builder dinámico de subservicios: añadir/quitar filas con EntityCode, SrvCode, ValueType, monto.
- Validación visual en tiempo real del total.

---

### 11. Módulo: Proceso Sonda (Polling)

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| S-01 | Transacción en BANK: polling resuelve en <5 min | BANK → OK visible en UI |
| S-02 | Transacción en CREATED: polling a 5 min | CREATED → EXPIRED |
| S-03 | Cancelar polling manualmente | Polling detenido, estado congelado |
| S-04 | Timeout global (10 min sin resolución) | TranState=TIMEOUT mostrado en UI |

**UI:**
- Timeline animado mostrando cada consulta del polling con timestamp y estado.
- Botón "Cancelar polling".
- Contador regresivo hasta timeout global.

---

### 12. Módulo: Manejo de Errores y Edge Cases

**Escenarios de prueba:**

| # | Escenario | Resultado esperado |
|---|---|---|
| E-01 | SessionToken expirado a mitad de pago | Refresh automático transparente, pago continúa |
| E-02 | ApiKey inválida | InvalidConfigException en init |
| E-03 | EtyCode inválido | InvalidConfigException |
| E-04 | Red cortada (offline) durante pago | NetworkRetryableException + backoff visible |
| E-05 | Múltiples llamadas tokenCommand con mismo SessionToken | SDK obtiene SessionToken nuevo por cada llamada |
| E-06 | OTP incorrecto (3 intentos) | OTPRequiredException con contador de intentos |
| E-07 | Consulta con MerchantTransactionId (sin TicketId) | Transacción encontrada vía fallback |

---

## Estructura de Archivos del Simulador

```
ecollect-sdk/
└── apps/
    └── test-simulator/
        ├── netlify.toml
        ├── package.json
        ├── vite.config.ts
        ├── .env.example            # ECOLLECT_API_KEY, ECOLLECT_ETY_CODE, DATABASE_URL
        │
        ├── netlify/functions/      # Backend serverless
        │   ├── session.ts
        │   ├── payment.ts
        │   ├── token.ts
        │   ├── query-tokens.ts
        │   ├── payment-systems.ts
        │   ├── transaction.ts
        │   ├── customer.ts
        │   ├── verify-webhook.ts
        │   └── webhook.ts          # Receptor de webhooks de ecollect
        │
        ├── src/
        │   ├── main.tsx
        │   ├── App.tsx
        │   ├── db/
        │   │   ├── schema.ts       # Drizzle schema
        │   │   └── client.ts       # Neon + Drizzle client
        │   ├── pages/
        │   │   ├── Dashboard.tsx
        │   │   ├── CardCheckout.tsx
        │   │   ├── HostedCheckout.tsx
        │   │   ├── PaymentLink.tsx
        │   │   ├── PreAuth.tsx
        │   │   ├── PSE.tsx
        │   │   ├── CashPayment.tsx
        │   │   ├── SavedCards.tsx
        │   │   ├── Webhooks.tsx
        │   │   ├── Dispersion.tsx
        │   │   ├── Polling.tsx
        │   │   └── EdgeCases.tsx
        │   ├── components/
        │   │   ├── EcollectCardForm.tsx   # Wrapper del EcollectCardField del SDK
        │   │   ├── TransactionLog.tsx     # Tabla de transacciones con estado live
        │   │   ├── JsonViewer.tsx         # Request/response viewer
        │   │   ├── WebhookFeed.tsx        # Feed de webhooks en tiempo real
        │   │   ├── QRRenderer.tsx         # Renderizador de QR
        │   │   ├── OTPModal.tsx           # Modal para captura de OTP
        │   │   ├── PollingTimeline.tsx    # Timeline del proceso sonda
        │   │   └── CountrySelector.tsx   # Selector con validaciones dinámicas
        │   └── hooks/
        │       ├── useEcollectSession.ts  # SessionToken con auto-refresh
        │       ├── usePolling.ts          # Polling con cancelación
        │       └── useTransactions.ts    # CRUD sobre Neon
        │
        └── migrations/             # Drizzle migrations
            └── 0001_initial.sql
```

---

## Variables de Entorno

```bash
# .env.example

# ecollect (solo en Netlify Functions — nunca en frontend)
ECOLLECT_API_KEY=your_test_api_key
ECOLLECT_ETY_CODE=your_ety_code
ECOLLECT_SRV_CODE=your_srv_code
ECOLLECT_ENVIRONMENT=test

# Neon PostgreSQL
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Webhook URL pública (generada por Netlify deploy)
ECOLLECT_WEBHOOK_URL=https://your-app.netlify.app/.netlify/functions/webhook
```

---

## Plan de Implementación del Simulador

### Fase A — Infraestructura Base (paralela a SDK Semana 1)
- [ ] Crear proyecto en monorepo: `apps/test-simulator/`
- [ ] Configurar Vite + React + Tailwind
- [ ] Configurar Netlify Functions con TypeScript
- [ ] Crear proyecto en Neon, obtener `DATABASE_URL`
- [ ] Implementar schema Drizzle + primera migración
- [ ] Variables de entorno en Netlify
- [ ] Deploy inicial funcional (sin SDK aún — mock responses)

### Fase B — Integración con SDK TS (paralela a SDK Semana 1)
- [ ] Conectar `ecollect-sdk` TypeScript via npm workspace link
- [ ] Implementar función `/session` → `getSessionToken`
- [ ] Implementar función `/payment` → `processPayment`
- [ ] Implementar función `/payment-systems` → `getPaymentSystem`
- [ ] Implementar función `/webhook` → receptor + verificación
- [ ] Dashboard con TransactionLog leyendo desde Neon
- [ ] Ejecutar escenarios T-01 a T-10 (Módulo Checkout)

### Fase C — Flujos Avanzados (paralela a SDK Semana 2)
- [ ] Hosted Checkout (H-01 a H-03)
- [ ] Link de Pagos con QR (L-01 a L-04)
- [ ] PSE Colombia (PSE-01 a PSE-04)
- [ ] Gestión de tarjetas + OTP (G-01 a G-08)
- [ ] Webhooks feed + verificación (W-01 a W-04)
- [ ] Pre-autorización RD (P-01 a P-06)

### Fase D — Edge Cases y Hardening (paralela a SDK Semanas 3-4)
- [ ] Dispersión de pagos (D-01 a D-03)
- [ ] Proceso Sonda timeline (S-01 a S-04)
- [ ] Edge cases y errores (E-01 a E-07)
- [ ] Pagos presenciales (C-01 a C-03)
- [ ] Reporte final: % de escenarios OK vs FAIL por módulo

---

## Criterios de Aceptación del Simulador

| Criterio | Meta |
|---|---|
| Cobertura de escenarios | 100% de los 60 escenarios ejecutados al menos 1 vez |
| Escenarios de camino feliz (OK) | 100% pasan sin intervención manual |
| Escenarios de error | SDK lanza la excepción correcta en >99% de casos |
| Polling resuelve BANK/PENDING | En <5 min en >95% de casos |
| Webhook recibido y verificado | En <60s desde BankProcessDate en >95% de casos |
| Sin PAN en logs ni en Neon | 0 ocurrencias detectadas por regex `/\b\d{13,19}\b/` |
| Tiempo de ejecución de suite completa | <30 min end-to-end |

---

## Uso Post-GA como App de Referencia

Una vez validado el SDK, el simulador se convierte en el **quickstart oficial**:

```bash
# El cliente clona, configura sus credenciales y tiene una app funcional en minutos
git clone https://github.com/ecollect/ecollect-sdk
cd ecollect-sdk/apps/test-simulator
cp .env.example .env.local
# → agregar ECOLLECT_API_KEY, ECOLLECT_ETY_CODE, DATABASE_URL
npm install
netlify dev   # corre local con funciones serverless
```

La misma app sirve como documentación viva: cada módulo muestra el código del SDK usado para ese flujo.
