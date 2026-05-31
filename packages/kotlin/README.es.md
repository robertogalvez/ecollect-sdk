# 🚀 ecollect Kotlin/Android SDK — Guía Completa

Bienvenido al **SDK de Kotlin de ecollect**. Esta guía está escrita para desarrolladores Android y JVM de todos los niveles. Explicamos cada paso en detalle para que pueda integrar pagos con confianza.

---

## 📋 Tabla de Contenidos

1. [¿Qué es ecollect?](#qué-es-ecollect)
2. [Requisitos Previos](#requisitos-previos)
3. [Instalación](#instalación)
4. [Configuración — Creando el Cliente](#configuración--creando-el-cliente)
5. [API Basada en Corrutinas](#api-basada-en-corrutinas)
6. [Obtener un Token de Sesión](#obtener-un-token-de-sesión)
7. [Guardar un Token de Tarjeta](#guardar-un-token-de-tarjeta)
8. [Listar Tokens Guardados](#listar-tokens-guardados)
9. [Procesar un Pago](#procesar-un-pago)
10. [Obtener Sistemas de Pago Disponibles](#obtener-sistemas-de-pago-disponibles)
11. [Consultar Estado de Transacción](#consultar-estado-de-transacción)
12. [Verificación de Webhooks](#verificación-de-webhooks)
13. [Manejo de Errores](#manejo-de-errores)
14. [Pruebas vs Producción](#pruebas-vs-producción)
15. [Consejos para Integración en Android](#consejos-para-integración-en-android)
16. [Ejemplo Completo](#ejemplo-completo)
17. [Errores Comunes](#errores-comunes)
18. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## 💡 ¿Qué es ecollect?

**ecollect** es una pasarela de pagos latinoamericana que permite a su aplicación:

- Aceptar pagos con tarjetas de crédito y débito (Visa, Mastercard y más)
- Procesar transferencias bancarias (PSE en Colombia, SPEI en México, entre otros)
- Guardar datos de tarjetas de forma segura usando **tokens** (para que los clientes no digiten su número de tarjeta cada vez)
- Consultar el estado de transacciones anteriores
- Verificar webhooks enviados por ecollect a su servidor

Este SDK está construido para proyectos **Android** y **JVM (backend)** usando Kotlin. Utiliza **OkHttp** para la red y **Kotlin Coroutines** para operaciones asíncronas no bloqueantes.

> 🏦 **¿De dónde obtengo mis credenciales?** Su **API Key** y **Código de Entidad** provienen del panel de control de comerciantes de ecollect. Contacte a su gestor de cuenta ecollect para obtener acceso.

---

## ✅ Requisitos Previos

| Requisito | Versión Mínima | Notas |
|---|---|---|
| JDK | 17 o superior | `java -version` para verificar |
| Kotlin | 1.9 o superior | Incluido con Android Studio |
| Android Studio | Hedgehog (2023.1.1+) | Para proyectos Android |
| Gradle | 8.0 o superior | Generalmente incluido con el proyecto |
| `minSdk` | 21 (Android 5.0) | Para proyectos Android |

### Verificar la versión de JDK

```bash
java -version
# Salida esperada: openjdk version "17.x.x" o similar
```

Si ve versión 11 o inferior, descargue JDK 17 desde [https://adoptium.net/](https://adoptium.net/).

---

## 📦 Instalación

### Proyecto Android/JVM (Gradle con Kotlin DSL)

Abra su archivo `build.gradle.kts` a nivel de módulo y agregue la dependencia:

```kotlin
// build.gradle.kts (nivel de módulo — generalmente app/build.gradle.kts)

dependencies {
    // SDK de ecollect para pagos
    implementation("com.ecollect:ecollect-sdk:1.0.0")

    // Requerido: corrutinas de Kotlin (si no están incluidas ya)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
}
```

Para Groovy DSL (`build.gradle`):

```groovy
// build.gradle (nivel de módulo)
dependencies {
    implementation 'com.ecollect:ecollect-sdk:1.0.0'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
```

### Android: Agregar permiso de Internet

Abra `AndroidManifest.xml` y agregue el permiso de Internet (requerido para todas las solicitudes de red):

```xml
<!-- AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Requerido: permite que la app se conecte a Internet -->
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        ...
    </application>
</manifest>
```

### Sincronizar el proyecto

En Android Studio: haga clic en **File → Sync Project with Gradle Files** (o el ícono del elefante en la barra de herramientas).

---

## 🔧 Configuración — Creando el Cliente

El `EcollectClient` es el objeto principal para comunicarse con la API de ecollect. Créelo una vez y reutilícelo en toda su app.

```kotlin
import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig

// Crear el objeto de configuración
val config = EcollectConfig(
    apiKey = "SU_API_KEY_AQUÍ",             // API key del panel de ecollect
    entityCode = "SU_CÓDIGO_DE_ENTIDAD",    // Su código de entidad (ej: "50039")
    testMode = true,                        // true  = entorno de pruebas (¡sin cobros reales!)
                                            // false = producción (¡dinero real!)
)

// Crear el cliente con la configuración
val cliente = EcollectClient(config)
```

### Todas las opciones disponibles

```kotlin
import com.ecollect.sdk.EcollectConfig

val config = EcollectConfig(
    apiKey = "SU_API_KEY_AQUÍ",             // Obligatorio: su API key
    entityCode = "SU_CÓDIGO_DE_ENTIDAD",    // Obligatorio: su código de entidad
    testMode = true,                        // Opcional: por defecto false (producción)
    timeoutSeconds = 30L,                   // Opcional: timeout HTTP en segundos (defecto: 30)
    maxRetries = 3,                         // Opcional: reintentos en caso de fallo (defecto: 3)
)
```

### URLs de Prueba vs Producción

| Modo | URL |
|---|---|
| Pruebas (`testMode = true`) | `https://test1.e-collect.com/app_express/api/` |
| Producción (`testMode = false`) | `https://www.e-collect.com/app_Express/api/` |
| Producción — Info de Transacción | `https://m.e-collect.com/app_Express/api/GetTransactionInformation` |

> ⚠️ **Importante:** El entorno de pruebas **NO** realiza cobros reales. Siempre use `testMode = true` durante el desarrollo.

---

## ⚡ API Basada en Corrutinas

Todas las llamadas de red en este SDK son **funciones suspendibles** — deben llamarse desde dentro de un scope de corrutina. Esto mantiene su UI responsiva mientras espera respuestas de red.

### ¿Qué son las corrutinas?

Las corrutinas son la forma de Kotlin de escribir código asíncrono que se ve como código secuencial. En lugar de callbacks o hilos complejos, se usa `suspend fun` y `launch`/`async`.

```kotlin
// Esta función es una corrutina — puede suspenderse sin bloquear un hilo
suspend fun hacerAlgo() {
    val resultado = cliente.getSessionToken()   // Se suspende aquí, no bloquea el hilo
    println(resultado.sessionToken)              // Continúa aquí cuando llega la respuesta
}
```

### Ejecutar una corrutina en Android (ViewModel)

```kotlin
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class PagoViewModel : ViewModel() {

    fun obtenerToken() {
        // viewModelScope cancela automáticamente la corrutina cuando el ViewModel se destruye
        viewModelScope.launch {
            try {
                val respuesta = cliente.getSessionToken()   // Seguro llamar aquí
                // Actualizar UI con la respuesta...
            } catch (e: EcollectException) {
                // Manejar error...
            }
        }
    }
}
```

### Ejecutar una corrutina en JVM independiente

```kotlin
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    // runBlocking conecta el mundo síncrono con el mundo de corrutinas
    // Use SOLO para funciones main() o pruebas — NO en código de UI Android
    val respuesta = cliente.getSessionToken()
    println(respuesta.sessionToken)
}
```

---

## 🔑 Obtener un Token de Sesión

Antes de realizar la mayoría de las llamadas a la API, necesita un **token de sesión**. Siempre obtenga uno fresco antes de operaciones importantes.

```kotlin
import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig
import com.ecollect.sdk.exceptions.EcollectException
import kotlinx.coroutines.runBlocking

val config = EcollectConfig(
    apiKey = "SU_API_KEY",
    entityCode = "50039",
    testMode = true,
)
val cliente = EcollectClient(config)

runBlocking {
    // Solicitar un token de sesión a la API de ecollect
    val respuesta = cliente.getSessionToken()

    // La respuesta contiene el token e información de expiración
    println("Token de sesión: ${respuesta.sessionToken}")
    println("Expira en: ${respuesta.expiresAt}")
    println("Estado: ${respuesta.status}")
}
```

### Campos de la respuesta

| Campo | Tipo | Descripción |
|---|---|---|
| `sessionToken` | `String` | Token a usar en solicitudes posteriores |
| `expiresAt` | `Instant` | Cuándo expira este token |
| `status` | `String` | `"SUCCESS"` si todo funcionó |

---

## 💳 Guardar un Token de Tarjeta

La **tokenización** permite guardar la tarjeta de un cliente de forma segura. ecollect almacena el número de tarjeta real y le devuelve un **token** seguro que puede guardar en su base de datos.

```kotlin
import com.ecollect.sdk.models.TokenCommandRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    // Paso 1: Obtener un token de sesión
    val sesion = cliente.getSessionToken()

    // Paso 2: Construir la solicitud con los datos de la tarjeta
    val solicitud = TokenCommandRequest(
        command = "SAVE",                            // Indicar a ecollect que queremos GUARDAR
        sessionToken = sesion.sessionToken,           // El token de sesión que acabamos de obtener
        cardNumber = "4296005885355275",              // Número de tarjeta del cliente
        expirationDate = "12/2025",                  // Vencimiento en formato MM/AAAA
        paymentSystem = 1,                           // Red de pago: 1 = Visa
        fiCode = 190,                                // Código de institución financiera
        cardholderName = "David Caballero",          // Nombre tal como aparece en la tarjeta
        cardholderIdType = "CC",                     // CC = Cédula Ciudadana
        cardholderId = "123456799",                  // Número de identificación del cliente
        email = "david.caballero@ecollect.co",       // Email del cliente
        phone = "+1 311111111",                      // Teléfono del cliente
    )

    // Paso 3: Ejecutar el comando
    val respuesta = cliente.tokenCommand(solicitud)

    // Paso 4: ¡Guarde respuesta.token en su base de datos para pagos futuros!
    println("¡Tarjeta guardada! Token: ${respuesta.token}")
    println("Estado: ${respuesta.status}")
}
```

### Otros comandos de token

| Comando | Descripción |
|---|---|
| `SAVE` | Guardar una nueva tarjeta y recibir un token reutilizable |
| `GET` | Recuperar datos (enmascarados) usando un token |
| `REMOVE` | Eliminar permanentemente un token de tarjeta |
| `UPDATE` | Actualizar datos de tarjeta (ej: nueva fecha de vencimiento) |
| `HOLD` | Congelar temporalmente un token |

#### GET — Recuperar una tarjeta guardada

```kotlin
val solicitud = TokenCommandRequest(
    command = "GET",
    sessionToken = sesion.sessionToken,      // Token de sesión activo
    token = "TOKEN_DE_TARJETA_AQUÍ",         // El token guardado anteriormente
)

val respuesta = cliente.tokenCommand(solicitud)
println("Titular: ${respuesta.cardholderName}")
println("Últimos 4: ${respuesta.lastFour}")
```

#### REMOVE — Eliminar una tarjeta guardada

```kotlin
val solicitud = TokenCommandRequest(
    command = "REMOVE",
    sessionToken = sesion.sessionToken,
    token = "TOKEN_DE_TARJETA_AQUÍ",
)

val respuesta = cliente.tokenCommand(solicitud)
println("Tarjeta eliminada: ${respuesta.status}")
```

---

## 📋 Listar Tokens Guardados

Use `queryToken` para obtener todas las tarjetas guardadas de un cliente. Perfecto para una pantalla de "Métodos de pago guardados".

```kotlin
import com.ecollect.sdk.models.QueryTokenRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    // Obtener un token de sesión fresco
    val sesion = cliente.getSessionToken()

    // Construir la consulta — identificamos al cliente por su ID
    val solicitud = QueryTokenRequest(
        sessionToken = sesion.sessionToken,    // Token de sesión activo
        cardholderId = "123456799",            // Número de ID del cliente
        cardholderIdType = "CC",               // Tipo de ID
    )

    // Ejecutar la consulta
    val respuesta = cliente.queryToken(solicitud)

    // Mostrar todas las tarjetas guardadas
    println("Se encontraron ${respuesta.tokens.size} tarjeta(s) guardada(s):")
    for (tarjeta in respuesta.tokens) {
        println("  Token:   ${tarjeta.token}")
        println("  Tarjeta: **** **** **** ${tarjeta.lastFour}")
        println("  Tipo:    ${tarjeta.paymentSystemName}")   // ej: "Visa"
        println("  Vence:   ${tarjeta.expirationDate}")
        println()
    }
}
```

---

## 💰 Procesar un Pago

La función `createTransactionPayment` cobra a un cliente. Puede pagar con:
1. Un **token de tarjeta** (guardado previamente — recomendado para clientes recurrentes)
2. **Datos de tarjeta directamente** (para pagos únicos)

### Pago con token guardado

```kotlin
import com.ecollect.sdk.models.CreateTransactionPaymentRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    // Siempre obtenga un token de sesión fresco antes de un pago
    val sesion = cliente.getSessionToken()

    // Construir la solicitud de pago
    val solicitud = CreateTransactionPaymentRequest(
        sessionToken = sesion.sessionToken,           // Token de sesión activo
        amount = 50000,                               // Monto en la unidad mínima de la moneda
                                                      // 50000 centavos = $500.00 COP
        currency = "COP",                             // Moneda: COP, MXN, PEN, etc.
        orderId = "ORDEN-001",                        // Su referencia única para este pedido
        description = "Compra en Mi Tienda",         // Descripción legible del pago
        token = "TOKEN_DE_TARJETA_AQUÍ",             // Token de una tarjeta guardada
        cardholderId = "123456799",                  // ID del cliente
        cardholderIdType = "CC",                     // Tipo de ID
        email = "david.caballero@ecollect.co",       // Email del cliente (para recibo)
        phone = "+1 311111111",                      // Teléfono del cliente
        ipAddress = "192.168.1.1",                   // IP del cliente
    )

    val respuesta = cliente.createTransactionPayment(solicitud)

    if (respuesta.approved) {
        println("✅ ¡Pago APROBADO!")
        println("ID de Transacción: ${respuesta.transactionId}")    // ¡Guárdelo!
        println("Autorización:      ${respuesta.authorizationCode}")
    } else {
        println("❌ Pago RECHAZADO")
        println("Motivo: ${respuesta.responseMessage}")
        println("Código: ${respuesta.responseCode}")
    }
}
```

### Pago con datos de tarjeta directamente

```kotlin
val solicitud = CreateTransactionPaymentRequest(
    sessionToken = sesion.sessionToken,
    amount = 50000,
    currency = "COP",
    orderId = "ORDEN-002",
    description = "Compra única",
    // Usar datos de tarjeta en lugar de token
    cardNumber = "4296005885355275",
    expirationDate = "12/2025",
    paymentSystem = 1,             // 1 = Visa
    fiCode = 190,
    cardholderName = "David Caballero",
    cardholderId = "123456799",
    cardholderIdType = "CC",
    email = "david.caballero@ecollect.co",
    phone = "+1 311111111",
    ipAddress = "192.168.1.1",
)

val respuesta = cliente.createTransactionPayment(solicitud)
println("Aprobado: ${respuesta.approved}")
```

---

## 🏦 Obtener Sistemas de Pago Disponibles

Use `getPaymentSystem` para listar todos los métodos de pago habilitados en su cuenta.

```kotlin
import com.ecollect.sdk.models.GetPaymentSystemRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    val sesion = cliente.getSessionToken()

    val solicitud = GetPaymentSystemRequest(
        sessionToken = sesion.sessionToken,
    )

    val respuesta = cliente.getPaymentSystem(solicitud)

    println("Métodos de pago disponibles:")
    for (metodo in respuesta.paymentSystems) {
        println("  [${metodo.paymentSystemId}] ${metodo.name}")
        // Ejemplo de salida:
        // [1] Visa
        // [2] Mastercard
        // [5] PSE
    }
}
```

---

## 🔍 Consultar Estado de Transacción

Use `getTransactionInformation` para consultar el estado actual de cualquier transacción.

> 📌 **Nota:** En producción, este endpoint usa una URL especial. El SDK la maneja automáticamente.

```kotlin
import com.ecollect.sdk.models.GetTransactionInformationRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    val sesion = cliente.getSessionToken()

    val solicitud = GetTransactionInformationRequest(
        sessionToken = sesion.sessionToken,
        transactionId = "ID_TRANSACCION_AQUÍ",   // ID de la respuesta original del pago
    )

    val respuesta = cliente.getTransactionInformation(solicitud)

    println("Estado:          ${respuesta.status}")      // APPROVED, DECLINED, PENDING
    println("Monto:           ${respuesta.amount}")
    println("Moneda:          ${respuesta.currency}")
    println("Fecha:           ${respuesta.transactionDate}")
    println("Autorización:    ${respuesta.authorizationCode}")
}
```

---

## 🔒 Verificación de Webhooks

Cuando se completa un pago, ecollect envía un webhook a una URL que usted configura. Siempre verifique el token de sesión incluido para confirmar que proviene de ecollect.

```kotlin
// El token recibido en el payload del webhook
val tokenEntrante = "TOKEN_DEL_PAYLOAD_WEBHOOK"

// Retorna true si es auténtico, false si es inválido
val esValido = cliente.verifySessionToken(tokenEntrante)

if (esValido) {
    println("✅ Webhook verificado — seguro de procesar")
    // Actualizar base de datos, completar pedido, etc.
} else {
    println("❌ Webhook inválido — ¡rechazarlo!")
    // Retornar HTTP 401 al remitente
}
```

### Ejemplo con servidor Ktor

```kotlin
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

routing {
    post("/webhook/ecollect") {
        // Parsear el payload JSON
        val payload = call.receive<Map<String, String>>()
        val tokenSesion = payload["session_token"]

        if (tokenSesion == null) {
            call.respond(HttpStatusCode.BadRequest, "Falta session_token")
            return@post
        }

        // Verificar que el token es genuinamente de ecollect
        val esValido = cliente.verifySessionToken(tokenSesion)

        if (!esValido) {
            call.respond(HttpStatusCode.Unauthorized, "Token de sesión inválido")
            return@post
        }

        // Procesar el webhook legítimo
        val idTransaccion = payload["transaction_id"]
        val estado = payload["status"]
        println("Transacción $idTransaccion ahora está: $estado")

        call.respond(HttpStatusCode.OK, mapOf("recibido" to true))
    }
}
```

---

## ❌ Manejo de Errores

El SDK lanza excepciones tipadas que puede capturar y manejar individualmente.

### Todas las clases de excepción

| Excepción | Cuándo se lanza |
|---|---|
| `EcollectAuthException` | API key o código de entidad inválidos |
| `EcollectConnectionException` | No se puede alcanzar el servidor |
| `EcollectTimeoutException` | Tiempo de espera de la solicitud agotado |
| `EcollectValidationException` | Parámetros inválidos o faltantes |
| `EcollectApiException` | La API retornó un error de lógica de negocio |
| `EcollectException` | Clase base — captura cualquiera de los anteriores |

### Ejemplo de manejo comprehensivo de errores

```kotlin
import com.ecollect.sdk.exceptions.*

viewModelScope.launch {
    try {
        val sesion = cliente.getSessionToken()

        val solicitud = CreateTransactionPaymentRequest(
            sessionToken = sesion.sessionToken,
            amount = 50000,
            currency = "COP",
            orderId = "ORDEN-004",
            description = "Prueba",
            token = "TOKEN_TARJETA",
            cardholderId = "123456799",
            cardholderIdType = "CC",
            email = "cliente@ejemplo.com",
            phone = "+1 311111111",
            ipAddress = "192.168.1.1",
        )

        val respuesta = cliente.createTransactionPayment(solicitud)
        // Manejar éxito...

    } catch (e: EcollectAuthException) {
        // API key o código de entidad incorrectos
        mostrarError("Autenticación fallida. Verifique sus credenciales.")

    } catch (e: EcollectConnectionException) {
        // Sin internet o servidor inaccesible
        mostrarError("Sin conexión. Verifique su conexión a Internet.")

    } catch (e: EcollectTimeoutException) {
        // El servidor tardó demasiado en responder
        mostrarError("Tiempo de espera agotado. Intente nuevamente.")
        // ¡IMPORTANTE: verifique el estado de la transacción antes de reintentar para evitar cobros dobles!

    } catch (e: EcollectValidationException) {
        // Campo faltante o inválido en la solicitud
        mostrarError("Datos inválidos: ${e.field} — ${e.message}")

    } catch (e: EcollectApiException) {
        // Error de negocio de ecollect (ej: tarjeta rechazada)
        mostrarError("Error de pago [${e.code}]: ${e.message}")

    } catch (e: EcollectException) {
        // Cualquier otro error del SDK
        mostrarError("Error inesperado: ${e.message}")
    }
}
```

---

## 🌍 Pruebas vs Producción

### Usar el entorno de pruebas

```kotlin
val config = EcollectConfig(
    apiKey = "SU_API_KEY_DE_PRUEBA",
    entityCode = "50039",
    testMode = true,    // ← Modo de prueba: sin cobros reales
)
```

### Cambiar a producción

```kotlin
val config = EcollectConfig(
    apiKey = BuildConfig.ECOLLECT_API_KEY,
    entityCode = BuildConfig.ECOLLECT_ENTITY_CODE,
    testMode = false,   // ← Producción: ¡dinero real!
)
```

### Almacenar credenciales de forma segura en Android

Nunca codifique llaves API directamente en el código. Use `local.properties` + `BuildConfig`:

```properties
# local.properties (¡NUNCA suba este archivo a git!)
ECOLLECT_API_KEY=su_api_key_aqui
ECOLLECT_ENTITY_CODE=50039
ECOLLECT_TEST_MODE=true
```

```kotlin
// build.gradle.kts
android {
    defaultConfig {
        // Leer de local.properties e inyectar en BuildConfig
        buildConfigField(
            "String",
            "ECOLLECT_API_KEY",
            "\"${project.findProperty("ECOLLECT_API_KEY") ?: ""}\""
        )
        buildConfigField(
            "String",
            "ECOLLECT_ENTITY_CODE",
            "\"${project.findProperty("ECOLLECT_ENTITY_CODE") ?: ""}\""
        )
        buildConfigField(
            "Boolean",
            "ECOLLECT_TEST_MODE",
            "${project.findProperty("ECOLLECT_TEST_MODE") ?: true}"
        )
    }
    buildFeatures {
        buildConfig = true
    }
}
```

```kotlin
// Ahora use BuildConfig en su código
val config = EcollectConfig(
    apiKey = BuildConfig.ECOLLECT_API_KEY,
    entityCode = BuildConfig.ECOLLECT_ENTITY_CODE,
    testMode = BuildConfig.ECOLLECT_TEST_MODE,
)
```

### Datos de tarjeta de prueba

| Campo | Valor de Prueba |
|---|---|
| Número de Tarjeta | `4296005885355275` |
| Fecha de Vencimiento | `12/2025` |
| Sistema de Pago | `1` (Visa) |
| Código FI | `190` |
| Nombre del Titular | `David Caballero` |
| Tipo de ID | `CC` |
| ID del Titular | `123456799` |
| Email | `david.caballero@ecollect.co` |
| Teléfono | `+1 311111111` |
| Código de Entidad | `50039` |

---

## 📱 Consejos para Integración en Android

### 1. Use un ViewModel para mantener el cliente

```kotlin
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class PagoViewModel : ViewModel() {

    // Crear el cliente una vez en el ViewModel — sobrevive cambios de configuración
    private val cliente = EcollectClient(
        EcollectConfig(
            apiKey = BuildConfig.ECOLLECT_API_KEY,
            entityCode = BuildConfig.ECOLLECT_ENTITY_CODE,
            testMode = BuildConfig.ECOLLECT_TEST_MODE,
        )
    )

    // Clase sellada para representar el estado de la operación de pago
    sealed class EstadoPago {
        object Inactivo : EstadoPago()
        object Cargando : EstadoPago()
        data class Exitoso(val idTransaccion: String) : EstadoPago()
        data class Error(val mensaje: String) : EstadoPago()
    }

    // StateFlow para que la UI pueda observar los cambios
    private val _estadoPago = MutableStateFlow<EstadoPago>(EstadoPago.Inactivo)
    val estadoPago: StateFlow<EstadoPago> = _estadoPago

    fun procesarPago(tokenTarjeta: String, monto: Int) {
        viewModelScope.launch {
            _estadoPago.value = EstadoPago.Cargando

            try {
                // Obtener token de sesión
                val sesion = cliente.getSessionToken()

                // Crear el pago
                val respuesta = cliente.createTransactionPayment(
                    CreateTransactionPaymentRequest(
                        sessionToken = sesion.sessionToken,
                        amount = monto,
                        currency = "COP",
                        orderId = "ORDEN-${System.currentTimeMillis()}",
                        description = "Compra",
                        token = tokenTarjeta,
                        cardholderId = "123456799",
                        cardholderIdType = "CC",
                        email = "cliente@ejemplo.com",
                        phone = "+1 311111111",
                        ipAddress = "0.0.0.0",   // Use la IP real en producción
                    )
                )

                _estadoPago.value = if (respuesta.approved) {
                    EstadoPago.Exitoso(respuesta.transactionId)
                } else {
                    EstadoPago.Error(respuesta.responseMessage)
                }

            } catch (e: EcollectException) {
                _estadoPago.value = EstadoPago.Error(e.message ?: "Error desconocido")
            }
        }
    }
}
```

### 2. Observar el estado en Fragment/Activity

```kotlin
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class FragmentPago : Fragment() {

    private val viewModel: PagoViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Observar el estado del pago
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.estadoPago.collect { estado ->
                when (estado) {
                    is PagoViewModel.EstadoPago.Inactivo -> {
                        // Mostrar formulario de pago
                    }
                    is PagoViewModel.EstadoPago.Cargando -> {
                        // Mostrar indicador de carga
                        barraProgreso.visibility = View.VISIBLE
                    }
                    is PagoViewModel.EstadoPago.Exitoso -> {
                        // ¡Pago aprobado! Navegar a pantalla de confirmación
                        barraProgreso.visibility = View.GONE
                        navegarAConfirmacion(estado.idTransaccion)
                    }
                    is PagoViewModel.EstadoPago.Error -> {
                        // Mostrar el error al usuario
                        barraProgreso.visibility = View.GONE
                        mostrarDialogoError(estado.mensaje)
                    }
                }
            }
        }

        // Disparar un pago cuando se toca el botón
        botonPagar.setOnClickListener {
            viewModel.procesarPago(
                tokenTarjeta = tokenTarjetaGuardada,
                monto = 50000,
            )
        }
    }
}
```

### 3. Nunca llame código de red en el hilo principal

```kotlin
// ❌ INCORRECTO — esto causará NetworkOnMainThreadException
fun ejemploMalo() {
    val sesion = cliente.getSessionToken()   // ¡Fallará!
}

// ✅ CORRECTO — siempre use un scope de corrutina
fun ejemploBueno() {
    viewModelScope.launch {
        val sesion = cliente.getSessionToken()   // ¡Seguro!
    }
}
```

### 4. Inyecte el cliente con inyección de dependencias (Hilt)

```kotlin
// En su módulo Hilt
@Module
@InstallIn(SingletonComponent::class)
object ModuloEcollect {

    @Provides
    @Singleton
    fun proveerClienteEcollect(): EcollectClient {
        return EcollectClient(
            EcollectConfig(
                apiKey = BuildConfig.ECOLLECT_API_KEY,
                entityCode = BuildConfig.ECOLLECT_ENTITY_CODE,
                testMode = BuildConfig.ECOLLECT_TEST_MODE,
            )
        )
    }
}

// En su ViewModel
@HiltViewModel
class PagoViewModel @Inject constructor(
    private val clienteEcollect: EcollectClient,
) : ViewModel() {
    // Use clienteEcollect aquí
}
```

---

## 🎯 Ejemplo Completo

### JVM Independiente / Backend (runBlocking)

```kotlin
/**
 * SDK de ecollect — Ejemplo Completo de Extremo a Extremo (Kotlin)
 *
 * Demuestra el flujo completo:
 * 1. Inicializar el cliente
 * 2. Obtener un token de sesión
 * 3. Listar métodos de pago disponibles
 * 4. Guardar un token de tarjeta
 * 5. Listar tokens guardados
 * 6. Procesar un pago
 * 7. Consultar el estado de la transacción
 */

import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig
import com.ecollect.sdk.models.*
import com.ecollect.sdk.exceptions.EcollectException
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    println("=".repeat(60))
    println("SDK de ecollect — Ejemplo Completo de Kotlin")
    println("=".repeat(60))

    // --------------------------------------------------------
    // Paso 0: Inicializar el cliente
    // --------------------------------------------------------
    val cliente = EcollectClient(
        EcollectConfig(
            apiKey = "SU_API_KEY",       // ← Reemplace con su API key real
            entityCode = "50039",         // ← Reemplace con su código de entidad
            testMode = true,             // Modo de prueba — ¡sin cobros reales!
        )
    )
    println("Cliente inicializado en modo PRUEBA")

    // --------------------------------------------------------
    // Paso 1: Obtener un token de sesión
    // --------------------------------------------------------
    println("\n--- Paso 1: Obtener Token de Sesión ---")

    val tokenSesion: String
    try {
        val sesion = cliente.getSessionToken()
        tokenSesion = sesion.sessionToken
        println("Token obtenido: ${tokenSesion.take(20)}...")
    } catch (e: EcollectException) {
        println("No se pudo obtener el token: ${e.message}")
        return@runBlocking
    }

    // --------------------------------------------------------
    // Paso 2: Listar métodos de pago disponibles
    // --------------------------------------------------------
    println("\n--- Paso 2: Métodos de Pago Disponibles ---")
    try {
        val respuestaMp = cliente.getPaymentSystem(
            GetPaymentSystemRequest(sessionToken = tokenSesion)
        )
        for (metodo in respuestaMp.paymentSystems) {
            println("  [${metodo.paymentSystemId}] ${metodo.name}")
        }
    } catch (e: EcollectException) {
        println("No se pudieron obtener los métodos: ${e.message}")
    }

    // --------------------------------------------------------
    // Paso 3: Guardar un token de tarjeta
    // --------------------------------------------------------
    println("\n--- Paso 3: Guardar Token de Tarjeta ---")

    var tokenTarjeta: String? = null
    try {
        val respuestaGuardar = cliente.tokenCommand(
            TokenCommandRequest(
                command = "SAVE",
                sessionToken = tokenSesion,
                cardNumber = "4296005885355275",        // Número de tarjeta de prueba
                expirationDate = "12/2025",
                paymentSystem = 1,                     // Visa
                fiCode = 190,
                cardholderName = "David Caballero",
                cardholderIdType = "CC",
                cardholderId = "123456799",
                email = "david.caballero@ecollect.co",
                phone = "+1 311111111",
            )
        )
        tokenTarjeta = respuestaGuardar.token
        println("¡Tarjeta guardada! Token: $tokenTarjeta")
    } catch (e: EcollectException) {
        println("No se pudo guardar la tarjeta: ${e.message}")
    }

    // --------------------------------------------------------
    // Paso 4: Listar tokens guardados del cliente
    // --------------------------------------------------------
    println("\n--- Paso 4: Listar Tarjetas Guardadas ---")
    try {
        val sesionFresca = cliente.getSessionToken()    // Siempre use un token fresco
        val respuestaConsulta = cliente.queryToken(
            QueryTokenRequest(
                sessionToken = sesionFresca.sessionToken,
                cardholderId = "123456799",
                cardholderIdType = "CC",
            )
        )
        println("Se encontraron ${respuestaConsulta.tokens.size} tarjeta(s) guardada(s):")
        for (tarjeta in respuestaConsulta.tokens) {
            println("  **** **** **** ${tarjeta.lastFour}  (${tarjeta.paymentSystemName})")
        }
    } catch (e: EcollectException) {
        println("No se pudieron listar los tokens: ${e.message}")
    }

    // --------------------------------------------------------
    // Paso 5: Procesar un pago
    // --------------------------------------------------------
    println("\n--- Paso 5: Procesar Pago ---")

    var idTransaccion: String? = null
    try {
        val sesionPago = cliente.getSessionToken()   // Token fresco para el pago

        val respuestaPago = cliente.createTransactionPayment(
            CreateTransactionPaymentRequest(
                sessionToken = sesionPago.sessionToken,
                amount = 50000,                              // $500.00 COP
                currency = "COP",
                orderId = "ORDEN-KOTLIN-001",
                description = "Compra de prueba via SDK Kotlin ecollect",
                token = tokenTarjeta ?: "TOKEN_DEMO",        // Token guardado en el paso 3
                cardholderId = "123456799",
                cardholderIdType = "CC",
                email = "david.caballero@ecollect.co",
                phone = "+1 311111111",
                ipAddress = "192.168.1.100",
            )
        )

        if (respuestaPago.approved) {
            println("¡PAGO APROBADO!")
            println("  ID de Transacción: ${respuestaPago.transactionId}")
            println("  Autorización:      ${respuestaPago.authorizationCode}")
            idTransaccion = respuestaPago.transactionId
        } else {
            println("PAGO RECHAZADO: ${respuestaPago.responseMessage}")
        }

    } catch (e: EcollectException) {
        println("Error en el pago: ${e.message}")
    }

    // --------------------------------------------------------
    // Paso 6: Consultar el estado de la transacción
    // --------------------------------------------------------
    if (idTransaccion != null) {
        println("\n--- Paso 6: Consultar Estado de Transacción ---")
        try {
            val sesionEstado = cliente.getSessionToken()

            val respuestaEstado = cliente.getTransactionInformation(
                GetTransactionInformationRequest(
                    sessionToken = sesionEstado.sessionToken,
                    transactionId = idTransaccion,
                )
            )

            println("Estado:  ${respuestaEstado.status}")
            println("Monto:   ${respuestaEstado.amount} ${respuestaEstado.currency}")
            println("Fecha:   ${respuestaEstado.transactionDate}")
        } catch (e: EcollectException) {
            println("No se pudo consultar el estado: ${e.message}")
        }
    }

    // --------------------------------------------------------
    // ¡Listo!
    // --------------------------------------------------------
    println("\n${"=".repeat(60)}")
    println("¡Ejemplo de extremo a extremo completado!")
    println("=".repeat(60))
    println("\nPróximos pasos:")
    println("  1. Reemplace SU_API_KEY con credenciales reales")
    println("  2. Configure testMode = false para producción")
    println("  3. Use ViewModel + StateFlow en su app Android")
    println("  4. Configure una URL de webhook en su panel de ecollect")
}
```

---

## ⚠️ Errores Comunes

### `EcollectAuthException: Invalid API key`
**Causa:** API key o código de entidad incorrectos.
**Solución:** Verifique ambos valores en su panel de ecollect. Asegúrese de no tener espacios adicionales.

### `EcollectConnectionException`
**Causa:** Sin conexión a Internet, o falta el permiso `INTERNET` en `AndroidManifest.xml`.
**Solución:** Agregue `<uses-permission android:name="android.permission.INTERNET" />` a su manifest.

### `NetworkOnMainThreadException`
**Causa:** Llamó un método del SDK directamente en el hilo principal de Android sin una corrutina.
**Solución:** Siempre envuelva las llamadas del SDK en `viewModelScope.launch { }` u otro scope de corrutina.

### `EcollectValidationException: field 'cardNumber' is required`
**Causa:** Falta un campo requerido en su solicitud.
**Solución:** Revise `e.field` para ver qué parámetro falta.

### `EcollectTimeoutException`
**Causa:** Red lenta o servidor sin respuesta.
**Solución:** Aumente el timeout: `EcollectConfig(..., timeoutSeconds = 60L)`.

### Error de compilación: `Unresolved reference: EcollectClient`
**Causa:** La dependencia del SDK no se agregó correctamente o Gradle no se sincronizó.
**Solución:** Verifique su `build.gradle.kts` y haga clic en **File → Sync Project with Gradle Files**.

---

## ❓ Preguntas Frecuentes

**P: ¿Debo crear un `EcollectClient` o múltiples?**
R: Cree una instancia y reutilícela. En Android, manténgala en un `ViewModel` o inyéctela con Hilt como `@Singleton`.

**P: ¿Es seguro almacenar tokens de tarjeta en mi base de datos?**
R: Sí. Los tokens no son números de tarjeta. Son seguros para almacenar y no requieren cumplimiento PCI DSS de su parte.

**P: Mi app crashea con `NetworkOnMainThreadException`. ¿Qué hago?**
R: Llamó un método de red en el hilo principal. Siempre use `viewModelScope.launch { }` alrededor de las llamadas al SDK.

**P: ¿Puedo usar este SDK en un backend JVM puro (no Android)?**
R: Sí. Use `runBlocking { }` u otro scope de corrutina en su código backend.

**P: ¿Cómo manejo un timeout en el pago — ¿se realizó el cobro?**
R: Después de un timeout, llame a `getTransactionInformation` con su ID de orden para verificar antes de reintentar. NO reintente un pago sin verificar primero — podría cobrar doble al cliente.

**P: ¿Cómo paso a producción?**
R: Configure `testMode = false` y use su API key y código de entidad de producción. Complete primero el proceso de incorporación como comerciante en ecollect.

---

## 📞 Soporte

- **Panel de Comerciante ecollect:** [https://www.e-collect.com](https://www.e-collect.com)
- **Problemas con el SDK:** Abra un issue en el repositorio de GitHub

---

*¡Construya algo genial! Comience en modo de prueba, verifique que todo funcione y luego cambie `testMode = false` para salir a producción con confianza.* 🚀
