# ecollect PHP SDK

![PHP 7.4+](https://img.shields.io/badge/PHP-7.4%2B-777BB4?logo=php) ![Composer](https://img.shields.io/badge/Composer-requerido-885630?logo=composer) ![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)

---

## 📖 ¿Qué es este SDK?

El **ecollect PHP SDK** es la librería oficial para integrar la pasarela de pagos ecollect en cualquier aplicación PHP. Soporta Colombia, México y República Dominicana, y gestiona automáticamente las sesiones, la tokenización de tarjetas, los pagos y la conciliación de transacciones — para que usted pase de cero a pagos en producción con solo unas líneas de PHP.

---

## ✅ Requisitos previos

Antes de comenzar, asegúrese de tener:

- **PHP 7.4 o superior** (PHP 8.x es completamente compatible y recomendado)
- **Composer** instalado globalmente — [Obtener Composer](https://getcomposer.org/)
- Las extensiones PHP `curl` y `json` habilitadas (están activas por defecto en la mayoría de entornos)
- Una cuenta ecollect con una **API Key** y un **EntityCode** válidos (proporcionados por ecollect al registrarse)

---

## 📦 Instalación

```bash
composer require ecollect/sdk
```

Después de la instalación, asegúrese de incluir el autoloader de Composer en su proyecto:

```php
<?php
require_once __DIR__ . '/vendor/autoload.php';
```

---

## ⚙️ Configuración inicial

Cree una instancia del cliente una sola vez y reutilícela. En un framework como Laravel, regístrela en un service provider; en PHP puro, inclúyala en un archivo de bootstrap compartido:

```php
<?php
use Ecollect\EcollectClient;

$cliente = new EcollectClient([
    // ─────────────────────────────────────────────────────────────────────
    // OBLIGATORIO — Su API key del panel de comerciante de ecollect
    'api_key'     => 'SU_API_KEY_AQUI',

    // OBLIGATORIO — Su código de entidad, asignado por ecollect (ej. "50039")
    'entity_code' => 'SU_ENTITY_CODE',

    // OPCIONAL — Establezca en true para usar el entorno de PRUEBAS/sandbox.
    // ¡Desarrolle siempre con sandbox: true y cámbielo a false solo en producción!
    // Valor por defecto: false
    'sandbox'     => true,

    // OPCIONAL — Tiempo límite de la solicitud en segundos. Valor por defecto: 30
    'timeout'     => 30,

    // OPCIONAL — Número de reintentos automáticos ante fallos de red. Valor por defecto: 2
    'retries'     => 2,

    // OPCIONAL — Habilita salida de depuración detallada (registra en error_log). Valor por defecto: false
    'debug'       => false,
]);
```

---

## 🔑 Cómo funcionan las sesiones

ecollect usa un modelo de autenticación en dos capas:

1. **API Key + EntityCode** — Sus credenciales estáticas, nunca expuestas a los usuarios finales.
2. **SessionToken** — Un token de corta duración que el SDK obtiene automáticamente antes de cada solicitud.

**No necesita gestionar los tokens de sesión manualmente.** El SDK los almacena en caché en memoria y los refresca de forma transparente cuando expiran.

Si necesita el valor del token crudo (por ejemplo, para pasarlo a un widget del front-end):

```php
<?php
$infoToken = $cliente->getSessionToken();

echo 'SessionToken: ' . $infoToken->sessionToken . PHP_EOL;
echo 'Expira el   : ' . $infoToken->expiresAt . PHP_EOL; // Formato ISO 8601
```

---

## 💳 Guardar un token de tarjeta

Tokenizar una tarjeta la almacena de forma segura en los servidores PCI-compliant de ecollect y devuelve un **token** que usted usa para pagos futuros sin necesidad de manejar números de tarjeta sin procesar:

```php
<?php
use Ecollect\Enums\TokenCommandAction;

$resultado = $cliente->tokenCommand([
    // ── Operación a realizar ──────────────────────────────────────────────
    // TokenCommandAction::SAVE   → guardar una tarjeta nueva, devuelve un token
    // TokenCommandAction::GET    → recuperar datos de tarjeta por token
    // TokenCommandAction::REMOVE → eliminar permanentemente un token
    // TokenCommandAction::UPDATE → actualizar datos de tarjeta (ej. nueva fecha de vencimiento)
    // TokenCommandAction::HOLD   → congelar temporalmente un token
    'action'              => TokenCommandAction::SAVE,

    // ── Datos de la tarjeta ───────────────────────────────────────────────
    'card_number'         => '4296005885355275', // PAN completo — tarjeta de PRUEBA
    'expiration_date'     => '12/2025',           // Debe ser formato MM/YYYY
    'payment_system'      => '1',                 // 1 = Visa, 2 = Mastercard

    // ── Identidad del titular ─────────────────────────────────────────────
    'card_holder_name'    => 'David Caballero',   // Exactamente como aparece en la tarjeta
    'card_holder_id_type' => 'CC',                // CC = Cédula | CE | NIT | PP = Pasaporte
    'card_holder_id'      => '123456799',          // Número del documento de identidad

    // ── Información de contacto ───────────────────────────────────────────
    'email'               => 'david.caballero@ecollect.co',
    'mobile_country_code' => '1',     // Código de marcación sin "+" (Colombia = 57)
    'mobile_number'       => '311111111',

    // ── Institución financiera ────────────────────────────────────────────
    // fi_code identifica el banco emisor o red. Use 190 en el entorno de pruebas.
    'fi_code'             => '190',

    // ── CVV ───────────────────────────────────────────────────────────────
    // Requerido cuando la configuración de riesgo del comerciante lo exige.
    // ¡NUNCA guarde este valor en su base de datos!
    'cvv'                 => '123',
]);

// Guarde $resultado->token en su base de datos para usarlo en pagos futuros
echo 'Token guardado: ' . $resultado->token . PHP_EOL;
```

---

## 🔍 Consultar tokens guardados

Recupere todas las tarjetas guardadas de un titular específico — útil para una pantalla de "seleccionar tarjeta guardada":

```php
<?php
$tarjetas = $cliente->queryToken([
    // Buscar por correo electrónico...
    'email' => 'david.caballero@ecollect.co',

    // ... O buscar por tipo y número de documento:
    // 'card_holder_id_type' => 'CC',
    // 'card_holder_id'      => '123456799',
]);

foreach ($tarjetas as $tarjeta) {
    echo sprintf(
        "Token: %s | Marca: %s | Últimos4: %s | Vencimiento: %s\n",
        $tarjeta->token,
        $tarjeta->paymentSystem,
        $tarjeta->lastFour,
        $tarjeta->expirationDate
    );
}
```

---

## 💰 Procesar un pago

### Pagar con un token guardado (recomendado)

```php
<?php
$pago = $cliente->createTransactionPayment([
    // ── Monto ─────────────────────────────────────────────────────────────
    'amount'              => 50000,    // Unidad monetaria más pequeña
                                        // COP: centavos | MXN: centavos | DOP: centavos
    'currency'            => 'COP',    // ISO 4217: 'COP' | 'MXN' | 'DOP'

    // ── Token guardado ────────────────────────────────────────────────────
    'token'               => 'TOKEN_GUARDADO_AQUI',

    // ── Identificación del pedido (¡debe ser único por transacción!) ──────
    'order_id'            => 'ORDEN-' . time(),
    'description'         => 'Suscripción mensual plan A',

    // ── Titular (debe coincidir con lo usado al guardar el token) ─────────
    'card_holder_name'    => 'David Caballero',
    'card_holder_id_type' => 'CC',
    'card_holder_id'      => '123456799',
    'email'               => 'david.caballero@ecollect.co',
    'mobile_country_code' => '1',
    'mobile_number'       => '311111111',

    // ── Re-ingreso de CVV (opcional) ──────────────────────────────────────
    'cvv'                 => '123',
]);

if ($pago->approved) {
    echo '✅ ¡Pago aprobado!' . PHP_EOL;
    echo '   Referencia: ' . $pago->transactionReference . PHP_EOL; // Guarde para conciliación
    echo '   Cod. auth : ' . $pago->authorizationCode . PHP_EOL;
} else {
    echo '❌ Pago rechazado: ' . $pago->responseMessage . PHP_EOL;
}
```

### Pagar sin token (ingreso único de tarjeta)

```php
<?php
$pago = $cliente->createTransactionPayment([
    'amount'              => 50000,
    'currency'            => 'COP',
    'order_id'            => 'ORDEN-' . time(),
    'description'         => 'Compra única',

    // Datos completos de la tarjeta (sin token)
    'card_number'         => '4296005885355275',
    'expiration_date'     => '12/2025',
    'payment_system'      => '1',
    'cvv'                 => '123',
    'fi_code'             => '190',

    'card_holder_name'    => 'David Caballero',
    'card_holder_id_type' => 'CC',
    'card_holder_id'      => '123456799',
    'email'               => 'david.caballero@ecollect.co',
    'mobile_country_code' => '1',
    'mobile_number'       => '311111111',
]);
```

---

## 🏦 Obtener los métodos de pago disponibles

```php
<?php
$metodos = $cliente->getPaymentSystem();

foreach ($metodos as $metodo) {
    // id     → código paymentSystem para tokenCommand / createTransactionPayment
    // name   → nombre legible: "Visa", "Mastercard", "PSE", "SPEI", etc.
    // active → booleano: si el método está disponible actualmente
    printf("[%s] %s — activo: %s\n", $metodo->id, $metodo->name, $metodo->active ? 'sí' : 'no');
}
```

---

## 🔄 Consultar estado de transacción

Verifique el estado final de cualquier transacción para conciliación:

```php
<?php
$info = $cliente->getTransactionInformation([
    'transaction_reference' => 'SU_REFERENCIA_DE_TRANSACCION',
]);

echo 'Estado    : ' . $info->status . PHP_EOL;          // APPROVED | REJECTED | PENDING
echo 'Monto     : ' . $info->amount . PHP_EOL;
echo 'Moneda    : ' . $info->currency . PHP_EOL;
echo 'Fecha     : ' . $info->transactionDate . PHP_EOL; // ISO 8601
echo 'Cod. auth : ' . $info->authorizationCode . PHP_EOL;
```

> En producción, este método llama automáticamente al endpoint especial
> `https://m.e-collect.com/app_Express/api/GetTransactionInformation`.
> El SDK cambia las URLs según el indicador `sandbox` — no se requieren cambios en su código.

---

## 🔔 Verificación de webhooks (HMAC-SHA256)

Cuando ecollect envía una notificación asíncrona a su servidor, verifique siempre la firma antes de procesar el evento:

```php
<?php
use Ecollect\Exceptions\WebhookVerificationException;

// Lea el cuerpo POST crudo ANTES de llamar a json_decode() o cualquier filtro de entrada
$cuerpoCrudo = file_get_contents('php://input');
$firma = $_SERVER['HTTP_X_ECOLLECT_SIGNATURE'] ?? '';

try {
    // verifySessionToken valida la firma HMAC-SHA256 enviada por ecollect
    // y devuelve el payload decodificado como stdClass si es válida
    $payload = $cliente->verifySessionToken($cuerpoCrudo, $firma);

    echo '✅ Webhook verificado. Tipo de evento: ' . $payload->eventType . PHP_EOL;
    echo '   Referencia transacción: ' . $payload->transactionReference . PHP_EOL;

    // Actualice su pedido en la base de datos según $payload->status
    // if ($payload->status === 'APPROVED') { marcarPedidoPagado($payload->orderId); }

    http_response_code(200);
    echo json_encode(['recibido' => true]);

} catch (WebhookVerificationException $e) {
    // La firma no coincide — rechace la solicitud inmediatamente
    http_response_code(400);
    echo 'Firma inválida';
}
```

---

## ⚠️ Manejo de errores

Todas las excepciones extienden `Ecollect\Exceptions\EcollectException`:

```php
<?php
use Ecollect\Exceptions\EcollectException;         // Base — captura cualquier error del SDK
use Ecollect\Exceptions\AuthenticationException;   // Se lanza cuando: API key/EntityCode incorrecto o expirado
use Ecollect\Exceptions\ValidationException;       // Se lanza cuando: campo obligatorio falta o tiene formato incorrecto
use Ecollect\Exceptions\PaymentDeclinedException;  // Se lanza cuando: el emisor rechazó la transacción
use Ecollect\Exceptions\NetworkException;          // Se lanza cuando: tiempo límite excedido o fallo de conexión
use Ecollect\Exceptions\TokenNotFoundException;    // Se lanza cuando: el token no existe
use Ecollect\Exceptions\RateLimitException;        // Se lanza cuando: demasiadas solicitudes en poco tiempo
use Ecollect\Exceptions\ServerException;           // Se lanza cuando: error HTTP 5xx inesperado de ecollect

try {
    $pago = $cliente->createTransactionPayment([/* ... */]);

} catch (AuthenticationException $e) {
    // ➡ Verifique api_key y entity_code. ¿Usa credenciales de sandbox en producción?
    error_log('Credenciales incorrectas: ' . $e->getMessage());

} catch (ValidationException $e) {
    // ➡ getFields() devuelve [['field' => '...', 'message' => '...'], ...]
    error_log('Error de validación: ' . json_encode($e->getFields()));

} catch (PaymentDeclinedException $e) {
    // ➡ NO reintente automáticamente. Muestre un mensaje amigable al usuario.
    error_log('Rechazado: ' . $e->getResponseCode() . ' — ' . $e->getResponseMessage());

} catch (NetworkException $e) {
    // ➡ Es seguro reintentar después de una breve espera
    error_log('Error de red: ' . $e->getMessage());

} catch (TokenNotFoundException $e) {
    // ➡ El token fue eliminado o nunca existió — pida al usuario que ingrese su tarjeta nuevamente
    error_log('Token no encontrado');

} catch (RateLimitException $e) {
    // ➡ Implemente espera exponencial; getRetryAfter() indica los segundos a esperar
    error_log('Límite de tasa. Reintente después de: ' . $e->getRetryAfter() . 's');

} catch (ServerException $e) {
    // ➡ Registre los detalles y contacte al soporte de ecollect
    error_log('Error del servidor ' . $e->getStatusCode() . ': ' . $e->getRawBody());

} catch (EcollectException $e) {
    error_log('Error inesperado del SDK: ' . $e->getMessage());
}
```

---

## 🌍 Pruebas vs Producción

| Configuración | Pruebas (Sandbox) | Producción |
|---|---|---|
| Opción `sandbox` | `true` | `false` |
| URL base | `https://test1.e-collect.com/app_express/api/` | `https://www.e-collect.com/app_Express/api/` |
| URL GetTransactionInformation | misma URL base | `https://m.e-collect.com/app_Express/api/GetTransactionInformation` |
| Tarjeta de prueba | `4296005885355275` | Solo tarjetas reales |
| EntityCode de ejemplo | `50039` | Su EntityCode de producción |
| ¿Cobra dinero real? | ❌ No | ✅ Sí |

---

## 📋 Script PHP completo de extremo a extremo

```php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;
use Ecollect\Enums\TokenCommandAction;
use Ecollect\Exceptions\EcollectException;
use Ecollect\Exceptions\PaymentDeclinedException;
use Ecollect\Exceptions\ValidationException;

// ── 1. Crear el cliente en modo sandbox ───────────────────────────────────────
$cliente = new EcollectClient([
    'api_key'     => 'SU_API_KEY',    // Reemplace con su API key de prueba real
    'entity_code' => '50039',          // Reemplace con su código de entidad real
    'sandbox'     => true,             // Entorno de PRUEBAS
    'debug'       => true,             // Registros útiles durante el desarrollo
]);

try {
    // ── 2. Listar métodos de pago disponibles ──────────────────────────────
    echo "\n🏦 Métodos de pago disponibles:\n";
    $metodos = $cliente->getPaymentSystem();
    foreach ($metodos as $m) {
        echo "  [{$m->id}] {$m->name} — activo: " . ($m->active ? 'sí' : 'no') . "\n";
    }

    // ── 3. Guardar un token de tarjeta ─────────────────────────────────────
    echo "\n💳 Guardando tarjeta...\n";
    $resultadoToken = $cliente->tokenCommand([
        'action'              => TokenCommandAction::SAVE,
        'card_number'         => '4296005885355275',
        'expiration_date'     => '12/2025',
        'payment_system'      => '1',
        'cvv'                 => '123',
        'card_holder_name'    => 'David Caballero',
        'card_holder_id_type' => 'CC',
        'card_holder_id'      => '123456799',
        'email'               => 'david.caballero@ecollect.co',
        'mobile_country_code' => '1',
        'mobile_number'       => '311111111',
        'fi_code'             => '190',
    ]);
    $token = $resultadoToken->token;
    echo "  Token: $token\n";

    // ── 4. Listar tokens guardados del titular ─────────────────────────────
    echo "\n🔍 Consultando tokens guardados...\n";
    $tarjetas = $cliente->queryToken(['email' => 'david.caballero@ecollect.co']);
    foreach ($tarjetas as $tarjeta) {
        echo "  {$tarjeta->token} — {$tarjeta->lastFour} ({$tarjeta->paymentSystem})\n";
    }

    // ── 5. Crear un pago con el token guardado ─────────────────────────────
    echo "\n💰 Creando pago...\n";
    $pago = $cliente->createTransactionPayment([
        'amount'              => 50000,
        'currency'            => 'COP',
        'token'               => $token,
        'order_id'            => 'ORDEN-' . time(),
        'description'         => 'Compra de prueba via SDK PHP de ecollect',
        'card_holder_name'    => 'David Caballero',
        'card_holder_id_type' => 'CC',
        'card_holder_id'      => '123456799',
        'email'               => 'david.caballero@ecollect.co',
        'mobile_country_code' => '1',
        'mobile_number'       => '311111111',
    ]);

    if ($pago->approved) {
        echo "  ✅ ¡Aprobado! Ref: {$pago->transactionReference}\n";

        // ── 6. Verificar estado de la transacción ──────────────────────────
        echo "\n🔄 Verificando estado...\n";
        $info = $cliente->getTransactionInformation([
            'transaction_reference' => $pago->transactionReference,
        ]);
        echo "  Estado: {$info->status} | Fecha: {$info->transactionDate}\n";
    } else {
        echo "  ❌ Rechazado: {$pago->responseMessage}\n";
    }

    // ── 7. Eliminar el token de prueba ─────────────────────────────────────
    echo "\n🗑️  Eliminando token...\n";
    $cliente->tokenCommand(['action' => TokenCommandAction::REMOVE, 'token' => $token]);
    echo "  Listo.\n";

} catch (ValidationException $e) {
    echo "\n🚨 Error de validación: " . json_encode($e->getFields()) . "\n";
} catch (PaymentDeclinedException $e) {
    echo "\n🚨 Pago rechazado: {$e->getResponseMessage()}\n";
} catch (EcollectException $e) {
    echo "\n🚨 Error del SDK: {$e->getMessage()}\n";
}
```

---

## ❓ Preguntas frecuentes

**P1: ¿El SDK requiere Guzzle?**
No. El SDK usa la extensión nativa cURL de PHP. Opcionalmente puede pasarle un cliente HTTP PSR-18 (como Guzzle) a través de la opción `http_client` si su proyecto ya lo utiliza.

**P2: ¿Cómo lo uso en Laravel?**
Registre `EcollectClient` en un service provider e inyéctelo a través del contenedor IoC. Guarde `api_key` y `entity_code` en `.env` y léalos con `env('ECOLLECT_API_KEY')`. Nunca confirme credenciales en el control de versiones.

**P3: ¿Puedo guardar múltiples tarjetas por cliente?**
Sí. Cada llamada a `tokenCommand(SAVE)` devuelve un token único. Guarde todos los tokens en su base de datos vinculados al registro del cliente.

**P4: ¿ecollect guarda el CVV?**
No. ecollect nunca persiste valores de CVV. Páselo durante el guardado/pago y descártelo inmediatamente — no lo almacene en ningún lugar.

**P5: ¿Qué pasa cuando el token de sesión expira?**
El SDK detecta automáticamente la respuesta 401, obtiene un nuevo token de sesión y reintenta la solicitud una vez. Es completamente transparente para su código.

**P6: ¿Funciona con PHP 8.x?**
Sí. PHP 8.0, 8.1, 8.2 y 8.3 son todos compatibles y probados.

**P7: ¿Puedo usarlo en un plugin de WordPress?**
Sí. Incluya el autoloader de Composer en el bootstrap de su plugin y use `EcollectClient` normalmente. Asegúrese de no entrar en conflicto con las dependencias de otros plugins.

---

## 🐛 Errores comunes y soluciones

| Error | Causa probable | Solución |
|---|---|---|
| `AuthenticationException: Invalid API key` | Credenciales incorrectas o entorno equivocado | Verifique `api_key` y `entity_code`; asegúrese de que las claves sandbox/producción coincidan con `sandbox` |
| `ValidationException: card_number is required` | Campo obligatorio faltante | Verifique que todos los campos requeridos estén en su arreglo |
| `ValidationException: expiration_date format` | Formato de fecha incorrecto | Use exactamente `MM/YYYY`, ej. `12/2025` |
| `PaymentDeclinedException: CARD_DECLINED` | El emisor rechazó la tarjeta | Muestre un mensaje amigable; no reintente automáticamente |
| `NetworkException: cURL error 7` | Sin acceso a internet o entorno incorrecto | Verifique el indicador `sandbox`; compruebe que el servidor llegue a ecollect |
| `TokenNotFoundException` | Token eliminado o nunca creado | Llame a `tokenCommand(SAVE)` nuevamente para crear un nuevo token |
| `RateLimitException` | Demasiadas llamadas a la API por minuto | Agregue espera/retraso exponencial; contacte a ecollect para aumentar los límites |
| `ServerException: 503` | ecollect temporalmente caído | Reintente después de 30–60 s; consulte la página de estado de ecollect |
| `Call to undefined method` | Versión antigua del SDK | Ejecute `composer update ecollect/sdk` |
| PHP `cURL extension not found` | Extensión deshabilitada | Habilite `extension=curl` en `php.ini` y reinicie PHP-FPM |
