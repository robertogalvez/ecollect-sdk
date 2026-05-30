# Plan de Aplicación y Construcción del SDK de ecollect (Blueprint Técnico)

## Arquitectura de Datos y Modelos

### Modelos de Datos Internos
Los modelos se basan en la documentación de la API Gateway de ecollect (PaymentRequest, PersonType, ChannelInfoType). Se mapean a nombres semánticos modernos para Clean Code, facilitando el uso y mantenimiento.

| Modelo Original (ecollect) | Modelo SDK (Semántico) | Descripción | Campos Principales |
|----------------------------|-------------------------|-------------|---------------------|
| PaymentRequest | PaymentIntent | Representa la intención de pago con detalles de transacción. | amount (decimal), currency (string), description (string), merchantTransactionId (string), etyCode (string), srvCode (string), referenceArray (array<string>: [documentNumber, otherDoc, name, address, phone, email]), paymentInfoArray (array<object>: atributos adicionales como PaymentSystem, Usermail), tokenInfoArray (array<object>: datos del token como TokenId, SecureCode, Installments) |
| PersonType | Customer | Información del cliente o beneficiario. | firstName (string), lastName (string), email (string), phone (string), documentType (enum: ID/PASSPORT), documentNumber (string) |
| ChannelInfoType | PaymentChannel | Configuración del canal de pago (e.g., banco, método). | channelId (string), channelName (string), isActive (boolean), supportedCurrencies (array<string>) |
| SavedCard (nuevo) | SavedCard | Tarjeta guardada con token truncado para gestión segura. | tokenId (string), truncatedNumber (string, e.g., "****1234"), expiryMonth (int), expiryYear (int), cardholderName (string), country (string) |

### Mapeo de Campos Técnicos a Semánticos
- `PaymentRequest.amount` → `PaymentIntent.totalAmount` (decimal, con validación de rango).
- `PersonType.firstName` → `Customer.givenName` (string, normalizado a UTF-8).
- `ChannelInfoType.channelId` → `PaymentChannel.identifier` (string, único y no expuesto en logs).
- Campos opcionales se mapean con defaults seguros (e.g., `currency` default a "USD" si no especificado).
- `SavedCard` (de ecollect tokens) → `SavedCard.tokenId` (string, generado por ecollect); `truncatedNumber` (últimos 4 dígitos, e.g., "****1234"); campos adicionales por país (e.g., documentNumber para Colombia).
- `EtyCode` → `Merchant.etyCode` (string, identificador único de comercio, asociado a merchant number/terminal ID/category).
- `SrvCode` → `PaymentIntent.srvCode` (string, servicio específico; permite múltiples servicios por comercio).

### Mapeo de Métodos a Endpoints ecollect
- `createSessionToken` → getSessionToken (payload: {EntityCode, ApiKey})
- `createTransactionPayment` → createTransactionPayment (payload: {EntityCode, SessionToken, SrvCode, TransValue, TransVatValue, SrvCurrency, URLRedirect, URLResponse, LangCode, PaymentSystem, FICode, Invoice, InvoiceDueDate, PolicyCode, RequestType, ReferenceArray, PaymentInfoArray, TokenInfoArray}) - Soporta `RequestType` numérico: 0 = autorización inmediata, 1 = pre-autorización, y `Ticketid` para posteo/captura (`Ticketid` positivo) o anulación de pre-autorización (`Ticketid` negativo).
- `queryToken` → queryToken (payload: {EntityCode, SessionToken, TokenInfoArray} para consultar tarjetas guardadas)
- `tokenCommand` → tokenCommand (payload: {EntityCode, SessionToken, Command: "GET"|"SAVE"|"REMOVE"|"UPDATE"|"HOLD", TokenInfoArray} para tokenización con soporte a GET=token temporal sin guardar, SAVE=guardar persistente, REMOVE=eliminar, UPDATE=actualizar expiry, HOLD=token reservado para pre-autorización)
- `getPaymentSystem` → getPaymentSystem (payload: {EntityCode, SessionToken} para info de canales con BrandImageUrl, FiImagesArray con FindKeys para detección automática)
- `getTransactionInformation` → getTransactionInformation (payload: {EntityCode, SessionToken, Ticketid} o MerchantTransactionId como contingencia para conciliación)
- `getCustomerId` → getCustomerId (payload: {EntityCode, SessionToken, CustomerInfoArray} para obtener/actualizar CustomerId persistente por cliente)
- `verifySessionToken` → verifySessionToken (payload: {EntityCode, SessionToken, SessionTokenToVerify, TicketIdToVerify} para validar webhooks)

### Estructura de Almacenamiento Temporal para SessionToken
- **Almacenamiento**: In-memory cache (e.g., Map en JS, dict en Python) con TTL automático basado en expiración del token.
- **Persistencia Segura**: Encriptación AES-256 para storage local (e.g., localStorage en browser, pero solo para frontend; backend usa vaults).
- **Ciclo de Vida**: Emisión → Cache (con refresh automático si <5 min restantes) → Expiración → Limpieza automática.
- **Seguridad**: No persistir en disco; usar HTTPS-only cookies para browser.

## Arquitectura Multi-lenguaje y Enfoque Ruby-like
- **Patrón Stripe Ruby**: SDK único por lenguaje con namespace central (`Ecollect`/`EcollectClient`), configuración global y cliente explícito. Ejemplo Stripe:
  - `Stripe.api_key = '...'`
  - `client = Stripe::StripeClient.new('sk_test...')`
  - `client.v1.customers.list`
- **Nuestro enfoque**: un solo core técnico con un wrapper idiomático para cada lenguaje.
  - Para Ruby, diseñar un gem/paquete con API similar:
    - `Ecollect.api_key = '...'`
    - `client = Ecollect::Client.new(api_key: '...')`
    - `client.v1.transactions.create(...)`
- **Recursos y clientes**: generar objetos de recurso consistentes, con helpers de serialización y validación, igual que Stripe usa clases dinámicas para recursos.
- **Configuración por request**: soporte para opciones locales (`api_key`, `environment`, `stripe_version`/`ecollect_version`) en cada llamada, sin perder el config global.
- **Extra features**: retries configurables, timeouts, logging, proxy, y hooks/instrumentation. Estas capacidades deben estar disponibles en la versión Ruby y en cualquier binding adicional.
- **Estrategia de generación**: mantener una única especificación API primero y usarla para generar bindings en .NET/Ruby/Go si se decide implementar, evitando librerías divergentes.

## Todos los Casos de Uso Considerados (19 Identificados)

### CRITICAL (6 - MVP Bloqueadores)
1. **verifySessionToken**: Validación de webhooks via API ecollect (SessionToken + TicketId matching)
2. **Control de Pago Doble**: Estados BANK/PENDING/CAPTURED/CREATED no reintentar; implementar máquina de estados segura
3. **Link de Pagos (SMS/QR)**: PaymentSystem=10 con múltiples canales (email, SMS, QR code) y LifetimeSecs configurable
4. **SubservicesArray (Dispersión)**: Soporte para distribuir pagos entre múltiples cuentas con validación suma 100%
5. **CustomerId Optimization**: getCustomerId endpoint para persistencia cliente y reducir payload en múltiples tokenizaciones
6. **Redirect a Página de ecollect (Hosted Checkout)**: Redirigir usuario a URL segura de ecollect con todos los medios de pago configurados (sin formulario en app); redirección de vuelta tras pago exitoso (ecollectGatewayRedirectAPI)

### IMPORTANT (7 - Phase 1 Enhancement)
6. **GET tokenCommand**: Token temporal sin guardar (LifetimeSecs 30 min, para pago único)
7. **HOLD tokenCommand**: Token reservado para pre-autorización (vigente hasta capture/void)
8. **Device Fingerprint + IP Validation**: Captura para anti-fraude en PaymentInfoArray (AttributeCode 33, 23)
9. **OneTimePassword (OTP)**: Verificación dinámica si requerida por tokenCommand/queryToken
10. **Polling Automático**: Background task 30s (BANK/PENDING) + 5min (CREATED) con timeout 10min global
11. **PSE UserType**: Validación obligatoria PaymentSystem=0 (UserType 0=Natural, 1=Jurídica)
12. **Invoice DueDate**: Soporte pagos presenciales con fecha/hora vencimiento (yyyyMMddHHmmss)

### OPTIONAL (6 - Phase 2+)
13. **Contingencia MerchantTransactionId**: getTransactionInformation fallback si TicketId no disponible
14. **ChannelInfoArray**: Soporte info específica por canal (ChannelId, ChannelType, ChannelData)
15. **PolicyCode**: Parámetro para políticas débito/crédito del merchant
16. **CurrencyRate**: Conversión si SrvCurrency ≠ PayCurrency
17. **TransCycle**: Especificar ciclo compensación bancaria (T+1, T+3, etc.)
18. **Métodos Pago Internacionales**: Tarjeta Crédito (CO/DO/MX), SPEI (MX), PSE (CO), Link Global, Cash (100)

---

## Estrategias para Cerrar Brechas Identificadas

### 1. Faltantes Funcionales (Casos 1-18 Completos)
- **Sandbox Pre-configurado**: Modelo de datos `MockPaymentIntent` con escenarios simulados (éxito: amount=100, fallo: invalidCard); flujo: SDK detecta modo sandbox y usa datos fake sin llamadas a ecollect.
- **Logging y Trazabilidad**: Niveles configurables (DEBUG: detalles técnicos, INFO: operaciones); correlación IDs en headers; export a ELK via JSON logs.
- **CLI Complementaria**: Comandos: `ecollect init --lang=js` (genera boilerplate), `ecollect validate-config` (chequea ApiKey), `ecollect monitor` (logs en tiempo real).
- **Gestión de Tarjetas Guardadas**: Soporte para "Mis Tarjetas" con métodos `listSavedCards`, `deleteCard`, `updateCard`; números truncados para PCI compliance. Incluye `getCustomerId` para persistencia de cliente entre tokenizaciones múltiples (Caso 5).
- **Manejo de EtyCode y SrvCode**: EtyCode único por comercio (asociado a merchant/terminal); SrvCode por servicio (múltiples por comercio); validar en init y processPayment para evitar errores de configuración.
- **Switch de Ambientes**: Soporte para 'test' y 'prod' en init; URLs específicas:
  - **Test**: https://test1.e-collect.com/app_express/api/ (getSessionToken, createTransactionPayment, queryToken, tokenCommand, getPaymentSystem, getTransactionInformation)
  - **Prod**: https://www.e-collect.com/app_Express/api/ (getSessionToken, createTransactionPayment, queryToken, tokenCommand, getPaymentSystem); GetTransactionInformation: https://m.e-collect.com/app_Express/api/GetTransactionInformation
  - Validación para prevenir mezcla de datos.
- **Link de Pagos (Email/SMS/QR)** (Caso 3): PaymentSystem=10 con envío vía email (default), SMS (MobileCountryCode + MobileNumber), o QR (LifetimeSecs parametrizable, default 1 hora).
- **Pagos en Canales Presenciales** (Caso 12): Invoice + InvoiceDueDate (yyyyMMddHHmmss) para referencias presenciales; PaymentSystem=100.
- **Dispersión de Pagos (SubservicesArray)** (Caso 4): Distribuir entre múltiples cuentas (EntityCode, SrvCode, ValueType=0/1). Validar suma 100%.
- **PSE Colombia** (Caso 11): PaymentSystem=0 con UserType requerido (0=Natural, 1=Jurídica).
- **Métodos de Pago Internacionales** (Caso 18): Tarjeta (CO/DO/MX), SPEI (MX), PSE (CO), Link (Global), Cash (Presencial).
- **Device Fingerprint + IP Validation** (Caso 8): Captura en PaymentInfoArray para anti-fraude.
- **OneTimePassword (OTP)** (Caso 9): Verificación dinámica si requerida.
- **Verificación de Webhooks** (Caso 1): Método `verifySessionToken` para validar legitimidad via API ecollect.
- **Proceso Sonda (Polling Automático)** (Caso 10): Background 30s (BANK/PENDING) + 5min (CREATED) + timeout 10min. Control de pago doble (Caso 2).
- **GET/HOLD tokenCommand** (Casos 6-7): Token temporal (GET) + reservado pre-auth (HOLD).
- **Contingencia MerchantTransactionId** (Caso 13): Fallback getTransactionInformation.
- **ChannelInfoArray, PolicyCode, CurrencyRate, TransCycle** (Casos 14-17): Soporte en estructura de datos.
- **Contingencia getTransactionInformation**: Consultar por MerchantTransactionId si TicketId no disponible.
- **Atributos Adicionales**: Soporte para PolicyCode (políticas débito/crédito), ChannelInfoArray (info canal específica), CurrencyRate (conversión si SrvCurrency ≠ PayCurrency), TransCycle (ciclo compensación banco).

### 2. Riesgo PCI & Seguridad
- **Garantías Técnicas**: Runtime checks en `createToken`: regex para PAN (e.g., /\b\d{13,19}\b/) en logs/output; bloquea si detectado. Auditorías PCI Nivel 1 integradas en CI/CD.

### 3. Complejidad e Ineficiencia
- **Evaluación de Simplificación**: Benchmark: Flujo SDK vs. API raw (e.g., SessionToken refresh reduce 50% llamadas manuales). Simplificar: Mover SessionToken a backend-only si frontend no lo necesita.

### 4. Manejo de Excepciones
- **Traducción Específica**: Mapa:
  - ecollect 400 (Invalid Card) → `InvalidCardException: "Número de tarjeta inválido. Verifique Luhn y formato."`
  - ecollect 402 (Insufficient Funds) → `InsufficientFundsException: "Fondos insuficientes. Acción usuario: reintentar con otro método."`
  - ecollect 500 (Server Error) → `NetworkRetryableException: "Error temporal. SDK reintentará automáticamente."`

### 5. Validación de Datos
- **Validaciones Exhaustivas Client-Side**:
  ```
  function validatePaymentIntent(intent) {
    if (!/^\d+(\.\d{1,2})?$/.test(intent.totalAmount) || intent.totalAmount <= 0) throw new ValidationError("Amount inválido");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intent.customer.email)) throw new ValidationError("Email inválido");
    if (!intent.etyCode || typeof intent.etyCode !== 'string') throw new ValidationError("EtyCode requerido");
    if (intent.srvCode && typeof intent.srvCode !== 'string') throw new ValidationError("SrvCode inválido");
    // Más validaciones: currency in ['USD', 'EUR'], etc.
  }
  ```
  Ejecutar antes de `processPayment` para prevenir rechazos.
- **Validaciones por País**: Para Colombia, validar documentNumber (formato ID); para RD, solo campos básicos.
- **Validación de Ambiente**: En init, verificar environment ('test' o 'prod'); default a 'test' para desarrollo; logs warning si prod sin validación.

### 6. Puntos Ciegos de Infraestructura
- **Distribución**: NPM para JS, PyPI para Python, Packagist para PHP; CDN para assets UI. Instalación: `npm install ecollect-sdk`.
- **Versionamiento**: Semver (e.g., 1.0.0 para breaking changes); backward compatibility via deprecation warnings; updates via CLI (`ecollect update`).

## Nota de Viabilidad Actualizada
Con las estrategias implementadas, el Plan es 100% viable para construir el SDK según el PRD, cerrando todas las brechas identificadas y asegurando cumplimiento PCI, simplicidad y eficiencia.

## Flujos de Usuario y de Sistema (Step-by-Step)

### Flujo de Checkout Seguro
1. Usuario carga la página del comercio; SDK inicializa con `init(apiKey, config)`.
2. SDK renderiza Iframe con campos protegidos (cardNumber, cvv, expiry).
3. Usuario ingresa datos sensibles; SDK captura y envía directamente a endpoint de tokenización de ecollect (sin tocar servidor cliente).
4. ecollect devuelve `TokenId`; SDK lo almacena internamente.
5. Comercio llama `processPayment(paymentIntent)`; SDK verifica SessionToken y ejecuta `createTransactionPayment`.
6. Transacción procesada; SDK retorna estado o inicia polling/webhook.

### Flujo de Redirección
1. SDK detecta necesidad de redirección (e.g., 3DS); genera URL de entidad financiera con parámetros encriptados.
2. Usuario es redirigido; SDK almacena contexto (transactionId, returnUrl) en session storage encriptado.
3. Entidad financiera procesa y redirige de vuelta con callback params.
4. SDK valida callback, restaura contexto y notifica al comercio via evento o callback.
5. Comercio confirma transacción sin pérdida de estado.

### Flujo de Hosted Checkout (Redirect a ecollect)
1. Comercio llama `hostedCheckout(paymentIntent)`; SDK genera URL segura de ecollect via ecollectGatewayRedirectAPI con parámetros (EntityCode, SessionToken, TransValue, etc.).
2. Usuario es redirigido a página de ecollect con todos los medios de pago configurados (sin formulario en app).
3. Usuario selecciona medio de pago y completa transacción en página de ecollect.
4. Tras pago exitoso, ecollect redirige usuario de vuelta a URLResponse configurada con parámetros de resultado (ticketId, status).
5. SDK valida callback, confirma transacción via webhook/polling, y notifica al comercio.

### Flujo de Pre-Autorización y Captura (Hold/Post)
1. Comercio llama `preAuthorize(paymentIntent)` con monto inicial; SDK envía `RequestType: 1` a ecollect.
2. ecollect autoriza el monto (hold) y retorna `ticketId`; fondos reservados en tarjeta del cliente.
3. Servicio al cliente se completa; comercio calcula monto final (puede ser menor o igual al autorizado).
4. Comercio llama `capture(ticketId, finalAmount)`; SDK envía `Ticketid` positivo con `TransValue` final para procesar el posteo.
5. ecollect captura el monto final (post); diferencia si menor se libera automáticamente.
6. Para cancelar la pre-autorización antes de capturar, el comercio puede enviar `Ticketid` negativo.
7. SDK confirma via webhook o polling; comercio notifica al cliente.

### Flujo de Gestión de Tarjetas Guardadas
1. Usuario accede a sección "Mis Tarjetas"; SDK llama `listSavedCards(customerId)` para obtener lista truncada.
2. SDK renderiza lista con opciones (ver, eliminar, actualizar); números truncados (e.g., ****1234).
3. Para eliminar: Usuario selecciona; SDK llama `deleteCard(tokenId)` a ecollect.
4. Para actualizar: SDK renderiza formulario dinámico por país; captura datos y llama `updateCard(tokenId, newData)`.
5. ecollect procesa; SDK confirma via webhook o polling; actualiza UI sin exponer PAN.

## Definición de Componentes (Frontend & Backend)

### Componentes de UI (Elements)
- **CardNumberField**: Input protegido para número de tarjeta (máx. 19 chars, validación Luhn).
- **CvvField**: Input para CVV (3-4 chars, numérico).
- **ExpiryField**: Selector de fecha (MM/YY, validación futura).
- **SubmitButton**: Botón que dispara tokenización al hacer click.
- **DynamicFormFields**: Campos adicionales por país (e.g., RD: solo nombre; Colombia: documentNumber, address). SDK detecta país via config y renderiza dinámicamente.

### Métodos Core del SDK
- `init(apiKey: string, config: object)`: Inicializa SDK con credenciales y configuración (incluye etyCode: string, srvCode: string opcional para default, environment: 'test' | 'prod' para switch de URLs).
- `createToken(cardData: object)`: Envía datos a ecollect y retorna TokenId (usa URL según environment). Internamente usa tokenCommand con Command: SAVE.
- `createTemporaryToken(cardData: object)`: Obtiene token temporal sin guardar (Command: GET). Retorna TokenId con LifetimeSecs (30 min). Útil para pago único sin "Guardar tarjeta".
- `holdToken(cardData: object)`: Obtiene token temporal para pre-autorización (Command: HOLD). Retorna TokenId reservado para preAuthorize.
- `processPayment(intent: PaymentIntent)`: Ejecuta transacción con TokenId (usa etyCode y srvCode del intent o config). Soporta dispersión (SubservicesArray), políticas (PolicyCode), pagos presenciales (Invoice), y contingencia MerchantTransactionId.
- `confirmWebhook(payload: object, sessionToken: string, ticketId: string)`: Valida webhook via verifySessionToken + local SessionToken/TicketId matching.
- `listSavedCards(customerId: string)`: Retorna array de SavedCard truncadas. Requiere Usermail + CardHolderId. Usa getCustomerId para persistencia.
- `deleteCard(tokenId: string)`: Elimina tarjeta guardada via tokenCommand (Command: REMOVE).
- `updateCard(tokenId: string, newData: object)`: Actualiza tarjeta (ej., expiry) via tokenCommand (Command: UPDATE). No requiere PAN.
- `preAuthorize(intent: PaymentIntent)`: Realiza pre-autorización (hold) por monto inicial. RequestType: 1. Retorna ticketId para capture/void.
- `capture(ticketId: string, finalAmount?: number)`: Captura monto final. RequestType: TicketId (positivo). Implementa control de pago doble (rechaza si ya CAPTURED).
- `void(ticketId: string)`: Anula pre-autorización antes de captura. RequestType: -TicketId (negativo).
- `hostedCheckout(intent: PaymentIntent)`: Genera URL de redirect a página de ecollect con medios de pago configurados (ecollectGatewayRedirectAPI). Retorna URL para redirigir usuario; maneja callback de vuelta.
- `getTransactionStatus(ticketId: string)`: Consulta estado transacción. Retorna TranState (OK, NOT_AUTHORIZED, BANK, PENDING, CAPTURED, CREATED, EXPIRED, FAILED). Mapeo interno a excepciones normalizadas. Implementa lógica de pago doble.
- `reconciliate(ticketId: string, timeout?: number)`: Helper que intenta webhook (si URLResponse configurado) + polling automático (getTransactionInformation cada 30s hasta timeout). Resuelve estados BANK/PENDING/CREATED.
- `getOrCreateCustomerId(customerInfo: object)`: Obtiene/crea CustomerId persistente (Usermail + CardHolderId). Mejora UX para múltiples tokenizaciones.
- `updateCustomerInfo(customerId: string, updatedInfo: object)`: Actualiza cliente sin re-tokenizar.
- `generatePaymentLink(intent: PaymentIntent, method: 'email'|'sms'|'qr')`: Genera link (PaymentSystem=10) y envía vía email/SMS o retorna QR. Retorna link + LifetimeSecs.
- `verifyWebhookSignature(payload: object, signature: string)`: Valida HMAC-SHA256 + llamada verifySessionToken para autenticidad de webhook.

## Reglas de Seguridad y Cumplimiento

### Protocolo para Garantizar que PAN Nunca Toque el Servidor del Cliente
```
function createToken(cardData) {
  // Validar datos en cliente (Luhn, formato)
  if (!isValidCard(cardData.number)) throw new ValidationError();
  
  // Construir TokenInfoArray con datos de tarjeta
  const tokenInfoArray = [
    { AttributeCode: 0, AttributeDesc: "CardNumber", AttributeValue: cardData.number },
    { AttributeCode: 2, AttributeDesc: "PaymentSystem", AttributeValue: cardData.paymentSystem },
    { AttributeCode: 4, AttributeDesc: "ExpirationDate", AttributeValue: cardData.expiry },
    { AttributeCode: 6, AttributeDesc: "Usermail", AttributeValue: cardData.email },
    { AttributeCode: 17, AttributeDesc: "CardHolderName", AttributeValue: cardData.cardholderName },
    // Agregar otros campos según país (e.g., documentNumber, etc.)
  ];
  
  // Enviar a tokenCommand con Command: "SAVE"
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/tokenCommand' 
    : 'https://www.e-collect.com/app_express/api/tokenCommand';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: etyCode,
      SessionToken: sessionToken,
      Command: "SAVE",
      TokenInfoArray: tokenInfoArray
    })
  });
  
  // Retornar TokenId del response
  return response.tokenId;
}
```

### Implementación de Validación de Firmas y Sesiones
```
function processPayment(intent) {
  // Validar intent
  validatePaymentIntent(intent);
  
  // Construir ReferenceArray (datos cliente)
  const referenceArray = [
    intent.customer.documentNumber,
    intent.customer.otherDocument || "",
    intent.customer.fullName,
    intent.customer.address || "",
    intent.customer.phone,
    intent.customer.email
  ];
  
  // Construir PaymentInfoArray (atributos adicionales)
  const paymentInfoArray = [
    { AttributeCode: 2, AttributeDesc: "PaymentSystem", AttributeValue: intent.paymentSystem },
    { AttributeCode: 6, AttributeDesc: "Usermail", AttributeValue: intent.customer.email },
    { AttributeCode: 18, AttributeDesc: "CardHolderIdType", AttributeValue: intent.customer.documentType },
    { AttributeCode: 19, AttributeDesc: "CardHolderId", AttributeValue: intent.customer.documentNumber },
    { AttributeCode: 23, AttributeDesc: "IPAddress", AttributeValue: getClientIP() },
    { AttributeCode: 26, AttributeDesc: "MerchantTransactionId", AttributeValue: intent.merchantTransactionId }
  ];
  
  // Construir TokenInfoArray (datos del token)
  const tokenInfoArray = [
    { AttributeCode: 1, AttributeDesc: "TokenId", AttributeValue: intent.tokenId },
    { AttributeCode: 2, AttributeDesc: "PaymentSystem", AttributeValue: intent.paymentSystem },
    { AttributeCode: 3, AttributeDesc: "SecureCode", AttributeValue: intent.cvv },
    { AttributeCode: 5, AttributeDesc: "Installments", AttributeValue: intent.installments || "1" },
    { AttributeCode: 6, AttributeDesc: "Usermail", AttributeValue: intent.customer.email },
    { AttributeCode: 9, AttributeDesc: "FiCode", AttributeValue: intent.fiCode },
    { AttributeCode: 19, AttributeDesc: "CardHolderId", AttributeValue: intent.customer.documentNumber }
  ];
  
  // Enviar a createTransactionPayment
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/createTransactionPayment' 
    : 'https://www.e-collect.com/app_Express/api/createTransactionPayment';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: intent.etyCode,
      SessionToken: sessionToken,
      SrvCode: intent.srvCode,
      TransValue: intent.amount,
      TransVatValue: intent.vatValue || 0,
      SrvCurrency: intent.currency,
      URLRedirect: intent.redirectUrl,
      URLResponse: intent.responseUrl || "",
      LangCode: intent.langCode || "ES",
      PaymentSystem: intent.paymentSystem,
      FICode: intent.fiCode,
      Invoice: intent.invoice || "",
      InvoiceDueDate: intent.invoiceDueDate || "",
      PolicyCode: intent.policyCode || "",
      RequestType: typeof intent.requestType !== 'undefined' ? intent.requestType : 0,
      ReferenceArray: referenceArray,
      PaymentInfoArray: paymentInfoArray,
      TokenInfoArray: tokenInfoArray
    })
  });
  
  return response;  // Procesar respuesta (ticketId, status, etc.)
}

function preAuthorize(intent) {
  // Similar a processPayment pero con RequestType: 1 para pre-autorización
  validatePaymentIntent(intent);
  
  // Construir arrays igual que en processPayment
  const referenceArray = [
    intent.customer.documentNumber,
    intent.customer.otherDocument || "",
    intent.customer.fullName,
    intent.customer.address || "",
    intent.customer.phone,
    intent.customer.email
  ];
  
  const paymentInfoArray = [
    { AttributeCode: 2, AttributeDesc: "PaymentSystem", AttributeValue: intent.paymentSystem },
    { AttributeCode: 6, AttributeDesc: "Usermail", AttributeValue: intent.customer.email },
    { AttributeCode: 18, AttributeDesc: "CardHolderIdType", AttributeValue: intent.customer.documentType },
    { AttributeCode: 19, AttributeDesc: "CardHolderId", AttributeValue: intent.customer.documentNumber },
    { AttributeCode: 23, AttributeDesc: "IPAddress", AttributeValue: getClientIP() },
    { AttributeCode: 26, AttributeDesc: "MerchantTransactionId", AttributeValue: intent.merchantTransactionId }
  ];
  
  const tokenInfoArray = [
    { AttributeCode: 1, AttributeDesc: "TokenId", AttributeValue: intent.tokenId },
    { AttributeCode: 2, AttributeDesc: "PaymentSystem", AttributeValue: intent.paymentSystem },
    { AttributeCode: 3, AttributeDesc: "SecureCode", AttributeValue: intent.cvv },
    { AttributeCode: 5, AttributeDesc: "Installments", AttributeValue: intent.installments || "1" },
    { AttributeCode: 6, AttributeDesc: "Usermail", AttributeValue: intent.customer.email },
    { AttributeCode: 9, AttributeDesc: "FiCode", AttributeValue: intent.fiCode },
    { AttributeCode: 19, AttributeDesc: "CardHolderId", AttributeValue: intent.customer.documentNumber }
  ];
  
  // Enviar a createTransactionPayment con RequestType: 1
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/createTransactionPayment' 
    : 'https://www.e-collect.com/app_Express/api/createTransactionPayment';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: intent.etyCode,
      SessionToken: sessionToken,
      SrvCode: intent.srvCode,
      TransValue: intent.amount,
      TransVatValue: intent.vatValue || 0,
      SrvCurrency: intent.currency,
      URLRedirect: intent.redirectUrl,
      URLResponse: intent.responseUrl || "",
      LangCode: intent.langCode || "ES",
      PaymentSystem: intent.paymentSystem,
      FICode: intent.fiCode,
      Invoice: intent.invoice || "",
      InvoiceDueDate: intent.invoiceDueDate || "",
      PolicyCode: intent.policyCode || "",
      RequestType: 1,  // Pre-autorización
      ReferenceArray: referenceArray,
      PaymentInfoArray: paymentInfoArray,
      TokenInfoArray: tokenInfoArray
    })
  });
  
  return response;  // Retorna ticketId para captura posterior
}

function capture(ticketId, finalAmount) {
  // Captura el monto final de una pre-autorización mediante Ticketid positivo
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/createTransactionPayment' 
    : 'https://www.e-collect.com/app_Express/api/createTransactionPayment';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: etyCode,
      SessionToken: sessionToken,
      Ticketid: ticketId,
      TransValue: finalAmount  // Monto final a capturar
    })
  });
  
  return response;  // Confirmación de captura
}

function listSavedCards(customerId) {
  // Construir TokenInfoArray para query (filtrar por customer)
  const tokenInfoArray = [
    { AttributeCode: 6, AttributeDesc: "Usermail", AttributeValue: customerEmail },  // Asumir email del customer
    { AttributeCode: 19, AttributeDesc: "CardHolderId", AttributeValue: customerId }
  ];
  
  // Enviar a queryToken
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/queryToken' 
    : 'https://www.e-collect.com/app_express/api/queryToken';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: etyCode,
      SessionToken: sessionToken,
      TokenInfoArray: tokenInfoArray
    })
  });
  
  // Mapear respuesta a SavedCard (truncar números)
  return response.TokenInfoArray.map(token => ({
    tokenId: token.AttributeValue,  // Asumir TokenId en response
    truncatedNumber: "****" + token.cardNumber.slice(-4),  // Truncar
    // Otros campos...
  }));
}

function deleteCard(tokenId) {
  // Enviar a tokenCommand con Command: "REMOVE"
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/tokenCommand' 
    : 'https://www.e-collect.com/app_express/api/tokenCommand';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: etyCode,
      SessionToken: sessionToken,
      Command: "REMOVE",
      TokenInfoArray: [{ AttributeCode: 1, AttributeDesc: "TokenId", AttributeValue: tokenId }]
    })
  });
  
  return response.success;
}

function updateCard(tokenId, newData) {
  // Construir TokenInfoArray con nuevos datos
  const tokenInfoArray = [
    { AttributeCode: 1, AttributeDesc: "TokenId", AttributeValue: tokenId },
    // Agregar campos a actualizar, e.g., expiry
    { AttributeCode: 4, AttributeDesc: "ExpirationDate", AttributeValue: newData.expiry }
  ];
  
  // Enviar a tokenCommand con Command: "UPDATE"
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/tokenCommand' 
    : 'https://www.e-collect.com/app_express/api/tokenCommand';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: etyCode,
      SessionToken: sessionToken,
      Command: "UPDATE",
      TokenInfoArray: tokenInfoArray
    })
  });
  
  return response.success;
}
```
```
function verifyWebhook(payload, signature) {
  const expectedSignature = hmacSha256(payload, secretKey);
  if (signature !== expectedSignature) throw new SecurityError();
  
  // Verificar session via verifySessionToken
  const isValid = await ecollect.verifySessionToken(payload.sessionId);
  if (!isValid) throw new AuthenticationError();
  
  return true;  // Procesar orden
}
```

function getPaymentSystems() {
  // Enviar a getPaymentSystem
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/getPaymentSystem' 
    : 'https://www.e-collect.com/app_express/api/getPaymentSystem';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: etyCode,
      SessionToken: sessionToken
    })
  });
  
  return response.paymentSystems;  // Array de sistemas de pago
}

function getTransactionInfo(ticketId) {
  // Enviar a getTransactionInformation
  const baseUrl = environment === 'test' 
    ? 'https://test1.e-collect.com/app_express/api/getTransactionInformation' 
    : (environment === 'prod' ? 'https://m.e-collect.com/app_Express/api/GetTransactionInformation' : 'https://www.e-collect.com/app_Express/api/getTransactionInformation');
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      EntityCode: etyCode,
      SessionToken: sessionToken,
      Ticketid: ticketId
    })
  });
  
  return response.transactionInfo;  // Detalles de la transacción
}

### Manejo de Variables de Entorno y Llaves
- **Private Keys (ApiKey)**: Almacenar en backend via vaults (e.g., AWS KMS); nunca en frontend.
- **Public Keys (SessionToken)**: Generar en backend, pasar a frontend via HTTPS; expirar en 30 min.

## Control de Pago Doble (Double Payment Prevention)

Implementación para evitar reintentos en transacciones intermedias:

```typescript
function canRetry(tranState: string): boolean {
  const nonRetryableStates = ['BANK', 'PENDING', 'CAPTURED', 'CREATED'];
  return !nonRetryableStates.includes(tranState);
}

async function shouldRetry(ticketId: string, lastAttemptTime: number): Promise<boolean> {
  try {
    const current = await getTransactionStatus(ticketId);
    
    // No reintentar si estado es BANK/PENDING/CAPTURED/CREATED (usuario potencialmente pagando)
    if (!canRetry(current.TranState)) {
      logger.info(`Transaction ${ticketId} in ${current.TranState} state; waiting for resolution`);
      return false;
    }
    
    // Sí reintentar si estado final: OK, NOT_AUTHORIZED, EXPIRED, FAILED
    return true;
  } catch (error) {
    return false;
  }
}

async function processPaymentWithRetry(
  intent: PaymentIntent, 
  maxRetries: number = 3
): Promise<{ticketId: string, tranState: string}> {
  let attempt = 0;
  let lastError;
  
  while (attempt < maxRetries) {
    try {
      const result = await createTransactionPayment(intent);
      
      // Verificar TranState
      if (!canRetry(result.TranState)) {
        // Estado intermedio; NO reintentar automáticamente
        logger.warn(`Transaction in ${result.TranState}; manual intervention required`);
        return result;
      }
      
      return result;
    } catch (error) {
      lastError = error;
      attempt++;
      
      // Exponential backoff: 2^attempt segundos
      if (attempt < maxRetries && error.isRetryable) {
        const backoff = Math.pow(2, attempt) * 1000;
        await sleep(backoff);
      }
    }
  }
  
  throw lastError;
}
```

## Mapeo Exhaustivo de Códigos de Error (ecollect → SDK)

```typescript
const errorMapping = {
  // Errores de Sesión
  'FAIL_APIEXPIREDSESSION': { exception: 'SessionExpiredException', action: 'retry_with_new_session' },
  
  // Errores de Configuración
  'FAIL_INVALIDENTITYCODE': { exception: 'InvalidConfigException', message: 'EtyCode inválido' },
  'FAIL_INVALIDSERVICECODE': { exception: 'InvalidConfigException', message: 'SrvCode inválido' },
  'FAIL_INVALIDPOLICY': { exception: 'PolicyConfigException', message: 'PolicyCode no configurado' },
  
  // Errores de Validación
  'FAIL_INVALIDREFERENCE1': { exception: 'ValidationException', message: 'ReferenceArray vacío' },
  'FAIL_INVALIDTRANSVALUE': { exception: 'ValidationException', message: 'Amount <= 0' },
  'FAIL_INVALIDVATVALUE': { exception: 'ValidationException', message: 'IVA inválido' },
  'FAIL_INVALIDCURRENCY': { exception: 'ValidationException', message: 'Moneda no soportada' },
  'FAIL_INVALIDCREDITCARD': { exception: 'InvalidCardException', message: 'Luhn fail' },
  'FAIL_INVALIDEXPIRATIONDATE': { exception: 'InvalidCardException', message: 'Fecha vencida' },
  'FAIL_CARDHOLDERIDTYPE': { exception: 'ValidationException', message: 'Tipo ID no válido para país' },
  'FAIL_MAILFORMAT': { exception: 'ValidationException', message: 'Email mal formado' },
  'FAIL_MOBILECOUNTRYCODE': { exception: 'ValidationException', message: 'Código país móvil inválido' },
  'FAIL_INVALIDSUBSERVICEARRAY': { exception: 'ValidationException', message: 'Dispersión no suma 100%' },
  
  // Errores de Tarjeta/Token
  'FAIL_TOKENNOTFOUND': { exception: 'TokenNotFoundException', action: 'request_retokenization' },
  'FAIL_TOKENEXPIRED': { exception: 'ExpiredTokenException', action: 'request_new_card' },
  'FAIL_TOKENREQUEST': { exception: 'TokenValidationException', message: 'Campos requeridos faltantes' },
  
  // Errores de Idempotencia
  'FAIL_MERCHANTRANSID': { exception: 'DuplicateTransactionException', action: 'check_status_retry_safe', message: 'Transacción ya procesada' },
  'FAIL_INVALIDINVOICE': { exception: 'DuplicateInvoiceException', message: 'Invoice duplicado' },
  
  // Errores de Cliente
  'FAIL_CUSTOMERNOTFOUND': { exception: 'CustomerNotFoundException', action: 'register_customer' },
  'FAIL_USERMISMATCH': { exception: 'CardMismatchException', message: 'Tarjeta bajo otro usuario' },
  
  // Errores de Transacción
  'FAIL_INVALIDTICKETID': { exception: 'TicketNotFoundException', action: 'check_merchanttransid_fallback' },
  
  // Errores de Autenticación
  'FAIL_ACCESSDENIED': { exception: 'AuthenticationException', message: 'Comercio inactivo/bloqueado' },
  
  // Errores de Webhook
  'FAIL_SESSIONNOTFOUND': { exception: 'WebhookValidationException', message: 'SessionToken a verificar no existe' },
  'FAIL_TICKETIDNOTMATCH': { exception: 'WebhookValidationException', message: 'TicketId no match con SessionToken' },
  
  // Errores de Sistema
  'FAIL_SYSTEM': { exception: 'NetworkRetryableException', action: 'retry_exponential_backoff' }
};
```

## Validaciones Exhaustivas por País

```typescript
const countryValidations = {
  'CO': {  // Colombia
    documentTypes: ['CC', 'NIT', 'PP', 'CE', 'DE'],
    paymentSystems: [0, 1],  // PSE, Credit
    requiresUserType: true,  // PSE requiere UserType
    allowsInstallments: true,
    speiAllowed: false
  },
  'DO': {  // República Dominicana
    documentTypes: ['CI', 'RNC', 'PP'],
    paymentSystems: [3, 6],  // VISANET, CARDNET
    requiresUserType: false,
    allowsInstallments: false,
    preAuthOnly: 'AZUL',  // Pre-auth solo con FICode AZUL
    speiAllowed: false
  },
  'MX': {  // México
    documentTypes: ['CURP', 'IFE', 'RFC', 'PP'],
    paymentSystems: [1, 7],  // Credit, SPEI
    requiresUserType: false,
    allowsInstallments: true,
    speiAllowed: true,
    speiRequiresNoCard: true  // SPEI sin tarjeta
  }
};

function validateByCountry(intent: PaymentIntent, country: string): void {
  const rules = countryValidations[country];
  if (!rules) throw new ValidationException(`Country ${country} not supported`);
  
  if (intent.customer.documentType && !rules.documentTypes.includes(intent.customer.documentType)) {
    throw new ValidationException(`DocumentType not allowed in ${country}`);
  }
  
  if (!rules.paymentSystems.includes(intent.paymentSystem)) {
    throw new ValidationException(`PaymentSystem not available in ${country}`);
  }
  
  if (intent.paymentSystem === 0 && rules.requiresUserType && !intent.userType) {
    throw new ValidationException(`UserType required for PSE in ${country}`);
  }
  
  if (country === 'MX' && intent.paymentSystem === 7 && intent.cardData) {
    throw new ValidationException(`SPEI does not support card data in Mexico`);
  }
}
```

## Integración de Link de Pagos (SMS/QR)

```typescript
async function generatePaymentLink(
  intent: PaymentIntent,
  method: 'email' | 'sms' | 'qr' = 'email'
): Promise<{link: string, expiresAt: Date}> {
  const paymentInfoArray = [...intent.paymentInfoArray];
  intent.paymentSystem = 10;  // Link de Pagos
  
  const lifetime = intent.qrLifetimeSecs || 3600;  // 1 hora default
  
  if (method === 'sms') {
    const countryCode = intent.customer.countryCode || '57';
    const mobile = intent.customer.phone.replace(/\D/g, '');
    
    paymentInfoArray.push(
      { AttributeCode: 28, AttributeDesc: 'MobileCountryCode', AttributeValue: countryCode },
      { AttributeCode: 29, AttributeDesc: 'MobileNumber', AttributeValue: mobile }
    );
  } else if (method === 'qr') {
    paymentInfoArray.push({
      AttributeCode: 35,
      AttributeDesc: 'LifetimeSecs',
      AttributeValue: lifetime.toString()
    });
  } else {  // email
    paymentInfoArray.push({
      AttributeCode: 6,
      AttributeDesc: 'Usermail',
      AttributeValue: intent.customer.email
    });
  }
  
  const response = await createTransactionPayment({
    ...intent,
    paymentInfoArray
  });
  
  return {
    link: response.PaymentLink || response.Link,
    expiresAt: new Date(Date.now() + lifetime * 1000)
  };
}
```

## Polling Automático para Resolución de Transacciones

```typescript
class PollingManager {
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private pollingStartTimes = new Map<string, number>();
  
  startPolling(
    ticketId: string,
    onComplete: (status: TransactionStatus) => void,
    timeout: number = 600000  // 10 min default
  ): void {
    const startTime = Date.now();
    this.pollingStartTimes.set(ticketId, startTime);
    
    const pollTransaction = async () => {
      try {
        const status = await getTransactionStatus(ticketId);
        const elapsedTime = Date.now() - startTime;
        
        // Estados finales: detener polling
        if (['OK', 'NOT_AUTHORIZED', 'EXPIRED', 'FAILED'].includes(status.TranState)) {
          this.stopPolling(ticketId);
          onComplete(status);
          return;
        }
        
        // Estados intermedios: continuar
        if (['BANK', 'PENDING'].includes(status.TranState)) {
          // Próximo polling en 30s
          if (elapsedTime < timeout) {
            setTimeout(pollTransaction, 30000);
          } else {
            this.stopPolling(ticketId);
            onComplete({TranState: 'TIMEOUT', TicketId: ticketId});
          }
        }
        
        if (status.TranState === 'CREATED') {
          // Usuario abandonó; aumentar intervalo a 5 min
          if (elapsedTime < timeout) {
            setTimeout(pollTransaction, 300000);
          } else {
            this.stopPolling(ticketId);
            onComplete({TranState: 'TIMEOUT', TicketId: ticketId});
          }
        }
      } catch (error) {
        logger.error(`Polling error for ${ticketId}:`, error);
      }
    };
    
    // Inicio inmediato
    pollTransaction();
  }
  
  stopPolling(ticketId: string): void {
    const timer = this.pollingIntervals.get(ticketId);
    if (timer) clearInterval(timer);
    this.pollingIntervals.delete(ticketId);
    this.pollingStartTimes.delete(ticketId);
  }
}
```

## Integración de CustomerId para Múltiples Tokenizaciones

```typescript
async function getOrCreateCustomerId(customerInfo: object): Promise<string> {
  const response = await fetch(apiUrl + '/GetCustomerId', {
    method: 'POST',
    body: JSON.stringify({
      EntityCode: config.etyCode,
      SessionToken: sessionToken,
      CustomerInfoArray: [
        { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: customerInfo.email },
        { AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: customerInfo.documentNumber },
        { AttributeCode: 18, AttributeDesc: 'CardHolderIdType', AttributeValue: customerInfo.documentType }
      ]
    })
  });
  
  if (response.Result === 'OK') {
    return response.CustomerId;
  }
  
  throw new CustomerException('Failed to get/create CustomerId');
}

async function createTokenWithCustomerId(
  customerId: string,
  cardData: object
): Promise<string> {
  // Payload reducido si CustomerId presente
  const tokenInfoArray = [
    { AttributeCode: 0, AttributeValue: cardData.number },
    { AttributeCode: 2, AttributeValue: cardData.paymentSystem },
    { AttributeCode: 4, AttributeValue: cardData.expiry }
    // NO reenviar datos cliente; CustomerId lo reemplaza
  ];
  
  const response = await tokenCommand({
    EntityCode: config.etyCode,
    SessionToken: sessionToken,
    CustomerId: customerId,
    Command: 'SAVE',
    TokenInfoArray: tokenInfoArray
  });
  
  return response.TokenId;
}
```
- **Entorno**: Usar .env files con validación; rotación automática cada 30 días.

## Plan de Implementación (Fases)

### Fase 1: Core Lógico y Manejo de Sesiones
- Implementar modelos de datos y mapeo semántico.
- Desarrollar lógica de SessionToken (emisión, refresh, cache).
- Pruebas unitarias para autenticación.

### Fase 2: Componentes de UI y Tokenización
- Crear componentes UI seguros (iframes).
- Integrar endpoint de tokenización.
- Validar aislamiento de PAN.

### Fase 3: Wrappers para Pagos (Redirect y Web Services)
- Implementar processPayment con reintentos.
- Gestionar flujos de redirección y callbacks.
- Agregar polling/webhooks.

### Fase 4: Documentación y Sandbox
- Generar docs auto y ejemplos.
- Configurar sandbox con datos simulados.
- QA final y auditoría de seguridad.