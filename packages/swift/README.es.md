# 🚀 ecollect Swift/iOS SDK — Guía Completa

Bienvenido al **SDK de Swift de ecollect**. Esta guía está escrita para desarrolladores iOS de todos los niveles. Ya sea que sea nuevo en integraciones de pagos o un desarrollador experimentado, explicamos cada paso en detalle.

---

## 📋 Tabla de Contenidos

1. [¿Qué es ecollect?](#qué-es-ecollect)
2. [Requisitos Previos](#requisitos-previos)
3. [Instalación (Swift Package Manager)](#instalación-swift-package-manager)
4. [Configuración — Inicialización del EcollectClient](#configuración--inicialización-del-ecollectclient)
5. [API con async/await](#api-con-asyncawait)
6. [Obtener un Token de Sesión](#obtener-un-token-de-sesión)
7. [Guardar un Token de Tarjeta](#guardar-un-token-de-tarjeta)
8. [Listar Tokens Guardados](#listar-tokens-guardados)
9. [Procesar un Pago](#procesar-un-pago)
10. [Obtener Sistemas de Pago Disponibles](#obtener-sistemas-de-pago-disponibles)
11. [Consultar Estado de Transacción](#consultar-estado-de-transacción)
12. [Manejo de Errores](#manejo-de-errores)
13. [Pruebas vs Producción](#pruebas-vs-producción)
14. [Ejemplo de Integración con SwiftUI](#ejemplo-de-integración-con-swiftui)
15. [Ejemplo de Integración con UIKit](#ejemplo-de-integración-con-uikit)
16. [Ejemplo Completo](#ejemplo-completo)
17. [Errores Comunes](#errores-comunes)
18. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## 💡 ¿Qué es ecollect?

**ecollect** es una pasarela de pagos latinoamericana que permite a su aplicación iOS:

- Aceptar pagos con tarjetas de crédito y débito (Visa, Mastercard y más)
- Procesar transferencias bancarias (PSE en Colombia, SPEI en México, entre otros)
- Guardar datos de tarjetas de forma segura usando **tokens** (para que los clientes no digiten su número de tarjeta cada vez)
- Consultar el estado de transacciones anteriores
- Verificar webhooks enviados por ecollect a su servidor

El SDK está escrito en Swift y usa **async/await** moderno para código asíncrono limpio y legible.

> 🏦 **¿De dónde obtengo mis credenciales?** Su **API Key** y **Código de Entidad** provienen del panel de control de comerciantes de ecollect. Contacte a su gestor de cuenta ecollect para obtener acceso.

---

## ✅ Requisitos Previos

| Requisito | Versión Mínima | Cómo verificar |
|---|---|---|
| Xcode | 14.0 o superior | Xcode → About Xcode |
| iOS Deployment Target | iOS 15.0 | Project → Targets → General |
| macOS (máquina de desarrollo) | macOS 12 Monterey | Menú Apple → Acerca de este Mac |
| Swift | 5.7 o superior | `swift --version` en Terminal |

> 💡 **¿Por qué iOS 15?** El SDK usa `async/await`, que requiere iOS 15+. Si necesita soportar iOS 13 o 14, puede envolver las llamadas en `Task { }`, pero el deployment target debe ser al menos iOS 15 para async/await.

---

## 📦 Instalación (Swift Package Manager)

Swift Package Manager (SPM) es la forma recomendada de agregar el SDK de ecollect a su proyecto. Está integrado en Xcode — no se necesitan herramientas adicionales.

### Instrucciones paso a paso

**Paso 1:** Abra su proyecto en Xcode.

**Paso 2:** En la barra de menú, vaya a **File → Add Package Dependencies...**
*(En versiones anteriores de Xcode: File → Swift Packages → Add Package Dependency)*

**Paso 3:** En el campo de búsqueda en la parte superior derecha del diálogo, pegue la URL del repositorio:
```
https://github.com/ecollect/ecollect-swift-sdk
```
Luego presione **Enter** o haga clic en el botón de búsqueda.

**Paso 4:** Xcode encontrará el paquete. Verá el nombre del paquete y las versiones disponibles.
- En **Dependency Rule**, seleccione **Up to Next Major Version**
- Establezca la versión mínima en `1.0.0`

**Paso 5:** Haga clic en **Add Package**.

**Paso 6:** Un segundo diálogo pregunta a qué targets agregar la librería. Seleccione el target de su app (generalmente el que tiene el nombre de su app) y haga clic en **Add Package**.

**Paso 7:** Verifique la instalación abriendo cualquier archivo Swift y escribiendo:
```swift
import EcollectSDK
```
Si Xcode no muestra un error, ¡la instalación fue exitosa!

### Alternativa: Editar Package.swift directamente (para frameworks/paquetes)

Si su proyecto es en sí mismo un paquete Swift, agregue la dependencia a `Package.swift`:

```swift
// Package.swift
// swift-tools-version: 5.7

import PackageDescription

let package = Package(
    name: "MiApp",
    platforms: [
        .iOS(.v15),         // iOS 15 mínimo requerido
        .macOS(.v12),       // Si también soporta macOS
    ],
    dependencies: [
        // Agregar el SDK de ecollect como dependencia
        .package(
            url: "https://github.com/ecollect/ecollect-swift-sdk",
            from: "1.0.0"
        ),
    ],
    targets: [
        .target(
            name: "MiApp",
            dependencies: [
                // Vincular el SDK a su target
                .product(name: "EcollectSDK", package: "ecollect-swift-sdk"),
            ]
        ),
    ]
)
```

---

## 🔧 Configuración — Inicialización del EcollectClient

El `EcollectClient` es su punto de entrada principal para todas las operaciones de la API de ecollect. Créelo una vez y compártalo en toda su app.

```swift
import EcollectSDK

// Crear el cliente con sus credenciales
let cliente = EcollectClient(
    apiKey: "SU_API_KEY_AQUÍ",            // API key del panel de ecollect
    entityCode: "SU_CÓDIGO_DE_ENTIDAD",   // Su código de entidad, ej: "50039"
    testMode: true                        // true  = entorno de pruebas (¡sin cobros reales!)
                                          // false = producción (¡dinero real!)
)
```

### Todas las opciones disponibles

```swift
import EcollectSDK

let cliente = EcollectClient(
    apiKey: "SU_API_KEY_AQUÍ",            // Obligatorio: su API key
    entityCode: "SU_CÓDIGO_DE_ENTIDAD",   // Obligatorio: su código de entidad
    testMode: true,                       // Opcional: por defecto false (producción)
    timeoutInterval: 30.0,                // Opcional: timeout de red en segundos (defecto: 30)
    maxRetries: 3                         // Opcional: reintentos en caso de fallo (defecto: 3)
)
```

### Dónde colocar el cliente en su app

```swift
// Opción 1: En el punto de entrada de la app (SwiftUI)
@main
struct MiAppDePagos: App {
    // El cliente se crea una vez y se pasa a las vistas via environment
    let clienteEcollect = EcollectClient(
        apiKey: "SU_API_KEY",
        entityCode: "50039",
        testMode: true
    )

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(clienteEcollect)  // Inyectar en la jerarquía de vistas
        }
    }
}

// Opción 2: En una clase de servicio singleton
class ServicioPago {
    static let shared = ServicioPago()   // Singleton — una sola instancia en toda la app

    let cliente = EcollectClient(
        apiKey: "SU_API_KEY",
        entityCode: "50039",
        testMode: true
    )

    private init() {}  // Evitar inicialización externa
}
```

---

## ⚡ API con async/await

Todos los métodos del SDK de ecollect son **funciones async** — deben llamarse con `await` dentro de un contexto `async` (como un `Task` u otra función `async`). Esto mantiene su UI fluida y responsiva.

### ¿Qué es async/await?

```swift
// Una función regular se ejecuta de principio a fin sin pausarse
func funcionRegular() {
    let resultado = operacionRapida()   // Retorna inmediatamente
    print(resultado)
}

// Una función async puede pausarse (await) sin bloquear el hilo
func funcionAsincrona() async {
    let resultado = await llamadaDeRed()   // Se pausa aquí, la UI sigue responsiva
    print(resultado)
}
```

### Llamar funciones async desde un botón o evento del ciclo de vida

```swift
// En SwiftUI — use Task { } para iniciar un contexto async
Button("Pagar Ahora") {
    Task {
        do {
            let sesion = try await cliente.getSessionToken()
            print(sesion.sessionToken)
        } catch {
            print("Error: \(error)")
        }
    }
}

// En UIKit — use Task { } en una acción de botón
@IBAction func botonPagarPresionado(_ sender: UIButton) {
    Task {
        do {
            let sesion = try await cliente.getSessionToken()
            print(sesion.sessionToken)
        } catch {
            print("Error: \(error)")
        }
    }
}
```

---

## 🔑 Obtener un Token de Sesión

Antes de la mayoría de las llamadas a la API, necesita un **token de sesión** — una credencial temporal que prueba que está autorizado. Siempre obtenga uno fresco antes de operaciones importantes.

```swift
import EcollectSDK

let cliente = EcollectClient(
    apiKey: "SU_API_KEY",
    entityCode: "50039",
    testMode: true
)

// Debe llamarse desde un contexto async (Task, función async, etc.)
Task {
    do {
        // Solicitar un token de sesión
        let respuesta = try await cliente.getSessionToken()

        // La respuesta contiene el token y cuándo expira
        print("Token de sesión: \(respuesta.sessionToken)")
        print("Expira en:       \(respuesta.expiresAt)")
        print("Estado:          \(respuesta.status)")

    } catch {
        print("No se pudo obtener el token de sesión: \(error)")
    }
}
```

### Campos de la respuesta

| Campo | Tipo | Descripción |
|---|---|---|
| `sessionToken` | `String` | Token a usar en solicitudes posteriores |
| `expiresAt` | `Date` | Cuándo expira este token |
| `status` | `String` | `"SUCCESS"` si todo funcionó |

---

## 💳 Guardar un Token de Tarjeta

La **tokenización** permite guardar la tarjeta de un cliente de forma segura. ecollect almacena el número de tarjeta real y le devuelve un **token** — una referencia segura que puede guardar en su base de datos y reutilizar en pagos futuros.

```swift
import EcollectSDK

let cliente = EcollectClient(apiKey: "SU_API_KEY", entityCode: "50039", testMode: true)

Task {
    do {
        // Paso 1: Obtener un token de sesión — requerido antes de cualquier llamada
        let sesion = try await cliente.getSessionToken()

        // Paso 2: Construir la solicitud para guardar la tarjeta
        let solicitud = TokenCommandRequest(
            command: "SAVE",                             // Indicar a ecollect que GUARDE una tarjeta
            sessionToken: sesion.sessionToken,            // El token de sesión que acabamos de obtener
            cardNumber: "4296005885355275",               // Número de tarjeta del cliente
            expirationDate: "12/2025",                   // Vencimiento: MM/AAAA
            paymentSystem: 1,                            // Red de pago: 1 = Visa
            fiCode: 190,                                 // Código de institución financiera
            cardholderName: "David Caballero",           // Nombre tal como aparece en la tarjeta
            cardholderIdType: "CC",                      // CC = Cédula Ciudadana
            cardholderId: "123456799",                   // ID nacional del cliente
            email: "david.caballero@ecollect.co",        // Email del cliente
            phone: "+1 311111111"                        // Teléfono del cliente
        )

        // Paso 3: Ejecutar el comando
        let respuesta = try await cliente.tokenCommand(solicitud)

        // Paso 4: ¡Guarde respuesta.token en su base de datos para pagos futuros!
        print("¡Tarjeta guardada! Token: \(respuesta.token)")
        print("Estado: \(respuesta.status)")

    } catch {
        print("Error guardando tarjeta: \(error)")
    }
}
```

### Otros comandos de token

| Comando | Descripción |
|---|---|
| `SAVE` | Guardar una nueva tarjeta y recibir un token reutilizable |
| `GET` | Recuperar datos enmascarados de una tarjeta por token |
| `REMOVE` | Eliminar permanentemente un token de tarjeta |
| `UPDATE` | Actualizar datos de tarjeta (ej: nueva fecha de vencimiento) |
| `HOLD` | Congelar temporalmente un token |

#### GET — Recuperar una tarjeta guardada

```swift
let solicitud = TokenCommandRequest(
    command: "GET",
    sessionToken: sesion.sessionToken,    // Token de sesión activo
    token: "TOKEN_DE_TARJETA_AQUÍ"        // Token guardado anteriormente
)

let respuesta = try await cliente.tokenCommand(solicitud)
print("Titular: \(respuesta.cardholderName)")
print("Últimos 4: \(respuesta.lastFour)")
print("Vence: \(respuesta.expirationDate)")
```

#### REMOVE — Eliminar una tarjeta guardada

```swift
let solicitud = TokenCommandRequest(
    command: "REMOVE",
    sessionToken: sesion.sessionToken,
    token: "TOKEN_DE_TARJETA_AQUÍ"
)

let respuesta = try await cliente.tokenCommand(solicitud)
print("Tarjeta eliminada: \(respuesta.status)")
```

---

## 📋 Listar Tokens Guardados

Use `queryToken` para obtener todas las tarjetas guardadas de un cliente. Perfecto para la pantalla "Métodos de pago guardados".

```swift
import EcollectSDK

Task {
    do {
        // Obtener un token de sesión fresco
        let sesion = try await cliente.getSessionToken()

        // Construir la solicitud de consulta
        let solicitud = QueryTokenRequest(
            sessionToken: sesion.sessionToken,   // Token de sesión activo
            cardholderId: "123456799",           // ID nacional del cliente
            cardholderIdType: "CC"               // Tipo de ID
        )

        // Ejecutar la consulta
        let respuesta = try await cliente.queryToken(solicitud)

        // Mostrar todas las tarjetas guardadas
        print("Se encontraron \(respuesta.tokens.count) tarjeta(s) guardada(s):")
        for tarjeta in respuesta.tokens {
            print("  Token:   \(tarjeta.token)")
            print("  Tarjeta: **** **** **** \(tarjeta.lastFour)")
            print("  Tipo:    \(tarjeta.paymentSystemName)")  // ej: "Visa"
            print("  Vence:   \(tarjeta.expirationDate)")
            print()
        }

    } catch {
        print("Error listando tokens: \(error)")
    }
}
```

---

## 💰 Procesar un Pago

El método `createTransactionPayment` cobra a un cliente. Puede pagar con:
1. Un **token de tarjeta** (guardado previamente — recomendado para clientes recurrentes)
2. **Datos de tarjeta directamente** (para pagos únicos)

### Pago con token guardado

```swift
import EcollectSDK

Task {
    do {
        // Siempre obtenga un token de sesión fresco antes de un pago
        let sesion = try await cliente.getSessionToken()

        // Construir la solicitud de pago
        let solicitud = CreateTransactionPaymentRequest(
            sessionToken: sesion.sessionToken,            // Token de sesión activo
            amount: 50000,                                // Monto en la unidad mínima de la moneda
                                                          // 50000 = $500.00 COP
            currency: "COP",                              // Moneda: COP, MXN, PEN, etc.
            orderId: "ORDEN-001",                         // Su referencia única para este pedido
            description: "Compra en Mi Tienda",          // Descripción legible del pago
            token: "TOKEN_DE_TARJETA_AQUÍ",              // Token de una tarjeta guardada
            cardholderId: "123456799",                   // ID del cliente
            cardholderIdType: "CC",                      // Tipo de ID
            email: "david.caballero@ecollect.co",        // Email del cliente (para recibo)
            phone: "+1 311111111",                       // Teléfono del cliente
            ipAddress: "192.168.1.1"                     // IP del cliente
        )

        // Ejecutar el pago
        let respuesta = try await cliente.createTransactionPayment(solicitud)

        if respuesta.approved {
            print("✅ ¡Pago APROBADO!")
            print("ID de Transacción: \(respuesta.transactionId)")   // ¡Guárdelo!
            print("Autorización:      \(respuesta.authorizationCode)")
        } else {
            print("❌ Pago RECHAZADO")
            print("Motivo: \(respuesta.responseMessage)")
            print("Código: \(respuesta.responseCode)")
        }

    } catch {
        print("Error en el pago: \(error)")
    }
}
```

### Pago con datos de tarjeta directamente

```swift
let solicitud = CreateTransactionPaymentRequest(
    sessionToken: sesion.sessionToken,
    amount: 50000,
    currency: "COP",
    orderId: "ORDEN-002",
    description: "Compra única",
    // Datos de tarjeta en lugar de token
    cardNumber: "4296005885355275",
    expirationDate: "12/2025",
    paymentSystem: 1,              // 1 = Visa
    fiCode: 190,
    cardholderName: "David Caballero",
    cardholderId: "123456799",
    cardholderIdType: "CC",
    email: "david.caballero@ecollect.co",
    phone: "+1 311111111",
    ipAddress: "192.168.1.1"
)

let respuesta = try await cliente.createTransactionPayment(solicitud)
print("Aprobado: \(respuesta.approved)")
```

---

## 🏦 Obtener Sistemas de Pago Disponibles

Use `getPaymentSystem` para listar todos los métodos de pago habilitados en su cuenta.

```swift
import EcollectSDK

Task {
    do {
        let sesion = try await cliente.getSessionToken()

        let solicitud = GetPaymentSystemRequest(
            sessionToken: sesion.sessionToken
        )

        let respuesta = try await cliente.getPaymentSystem(solicitud)

        print("Métodos de pago disponibles:")
        for metodo in respuesta.paymentSystems {
            print("  [\(metodo.paymentSystemId)] \(metodo.name)")
            // Ejemplo de salida:
            // [1] Visa
            // [2] Mastercard
            // [5] PSE
        }

    } catch {
        print("Error: \(error)")
    }
}
```

---

## 🔍 Consultar Estado de Transacción

Use `getTransactionInformation` para consultar el estado actual de una transacción.

> 📌 **Nota:** En producción, este endpoint usa una URL especial. El SDK la maneja automáticamente.

```swift
import EcollectSDK

Task {
    do {
        let sesion = try await cliente.getSessionToken()

        let solicitud = GetTransactionInformationRequest(
            sessionToken: sesion.sessionToken,
            transactionId: "ID_TRANSACCION_AQUÍ"   // ID del pago original
        )

        let respuesta = try await cliente.getTransactionInformation(solicitud)

        print("Estado:          \(respuesta.status)")         // APPROVED, DECLINED, PENDING
        print("Monto:           \(respuesta.amount)")
        print("Moneda:          \(respuesta.currency)")
        print("Fecha:           \(respuesta.transactionDate)")
        print("Autorización:    \(respuesta.authorizationCode)")

    } catch {
        print("Error: \(error)")
    }
}
```

---

## ❌ Manejo de Errores

El SDK usa un enum tipado `EcollectError` para que pueda hacer `switch` en cada caso de error.

### El enum `EcollectError`

```swift
public enum EcollectError: Error {
    case authenticationFailed(String)    // API key o código de entidad incorrectos
    case connectionFailed(String)        // No se puede alcanzar el servidor
    case requestTimeout                  // La solicitud excedió el timeout
    case validationError(field: String, message: String)  // Parámetro de solicitud inválido
    case apiError(code: String, message: String)          // Error de lógica de negocio de la API
    case unknown(Error)                  // Error inesperado
}
```

### Manejo comprehensivo de errores

```swift
import EcollectSDK

Task {
    do {
        let sesion = try await cliente.getSessionToken()

        let solicitud = CreateTransactionPaymentRequest(
            sessionToken: sesion.sessionToken,
            amount: 50000,
            currency: "COP",
            orderId: "ORDEN-005",
            description: "Prueba",
            token: "TOKEN_TARJETA",
            cardholderId: "123456799",
            cardholderIdType: "CC",
            email: "cliente@ejemplo.com",
            phone: "+1 311111111",
            ipAddress: "192.168.1.1"
        )

        let respuesta = try await cliente.createTransactionPayment(solicitud)
        print("Resultado: \(respuesta.responseMessage)")

    } catch let error as EcollectError {
        // Hacer switch en el tipo de error específico
        switch error {
        case .authenticationFailed(let mensaje):
            // API key o código de entidad incorrectos
            print("Autenticación fallida: \(mensaje)")
            print("Acción: Verifique sus credenciales en el panel de ecollect.")

        case .connectionFailed(let mensaje):
            // No se puede alcanzar el servidor de ecollect
            print("Conexión fallida: \(mensaje)")
            print("Acción: Verifique la conexión a Internet.")

        case .requestTimeout:
            // La solicitud tardó demasiado
            print("Tiempo de espera agotado.")
            print("Acción: Reintente, o verifique el estado de la transacción antes de reintentar.")

        case .validationError(let campo, let mensaje):
            // Campo inválido o faltante en la solicitud
            print("Error de validación en '\(campo)': \(mensaje)")
            print("Acción: Corrija el campo indicado en su solicitud.")

        case .apiError(let codigo, let mensaje):
            // Error de negocio (ej: tarjeta rechazada, fondos insuficientes)
            print("Error de API [\(codigo)]: \(mensaje)")

        case .unknown(let subyacente):
            // Algo inesperado ocurrió
            print("Error inesperado: \(subyacente)")
        }

    } catch {
        // Errores que no son de ecollect (bugs de programación, etc.)
        print("Error externo: \(error)")
    }
}
```

---

## 🌍 Pruebas vs Producción

### Usar el entorno de pruebas

```swift
// MODO PRUEBA — sandbox seguro, sin dinero real
let cliente = EcollectClient(
    apiKey: "SU_API_KEY_DE_PRUEBA",
    entityCode: "50039",
    testMode: true   // ← Modo de prueba activado
)
```

### Cambiar a producción

```swift
// PRODUCCIÓN — ¡transacciones reales!
let cliente = EcollectClient(
    apiKey: "SU_API_KEY_DE_PRODUCCION",
    entityCode: "SU_CÓDIGO_DE_ENTIDAD_DE_PRODUCCION",
    testMode: false   // ← Modo de producción
)
```

### Buena práctica: Usar configuración basada en el entorno

Nunca codifique credenciales directamente en el código fuente. Use un archivo de configuración o variables de entorno:

```swift
// Config.swift — mantenga los secretos fuera del código fuente
// Cargue desde el entorno o almacenamiento seguro (Keychain para apps de producción)

enum ConfigEcollect {
    #if DEBUG
    // Build de depuración — usar credenciales de prueba
    static let apiKey = "SU_API_KEY_DE_PRUEBA"
    static let entityCode = "50039"
    static let testMode = true
    #else
    // Build de lanzamiento — usar credenciales de producción
    // En una app real, cárguelas desde Keychain o un servidor de configuración seguro
    static let apiKey = ProcessInfo.processInfo.environment["ECOLLECT_API_KEY"] ?? ""
    static let entityCode = ProcessInfo.processInfo.environment["ECOLLECT_ENTITY_CODE"] ?? ""
    static let testMode = false
    #endif
}

// Uso:
let cliente = EcollectClient(
    apiKey: ConfigEcollect.apiKey,
    entityCode: ConfigEcollect.entityCode,
    testMode: ConfigEcollect.testMode
)
```

### Datos de tarjeta de prueba

Use estos datos cuando `testMode: true` para simular pagos:

| Campo | Valor de Prueba |
|---|---|
| Número de Tarjeta | `4296005885355275` |
| Fecha de Vencimiento | `12/2025` |
| Sistema de Pago | `1` (Visa) |
| Código FI | `190` |
| Nombre del Titular | `David Caballero` |
| Tipo de ID del Titular | `CC` |
| ID del Titular | `123456799` |
| Email | `david.caballero@ecollect.co` |
| Teléfono | `+1 311111111` |
| Código de Entidad | `50039` |

---

## 🎨 Ejemplo de Integración con SwiftUI

Una vista de pago completa en SwiftUI usando el SDK de ecollect.

```swift
import SwiftUI
import EcollectSDK

// MARK: - ViewModel

@MainActor  // Todas las actualizaciones de UI ocurren en el hilo principal
class ModeloVistaPago: ObservableObject {

    // Las propiedades @Published disparan actualizaciones automáticas en SwiftUI
    @Published var estaCargando = false
    @Published var resultadoPago: String?
    @Published var mensajeError: String?
    @Published var mostrarError = false

    // El cliente de ecollect (inyectado o creado aquí)
    private let cliente: EcollectClient

    init(cliente: EcollectClient) {
        self.cliente = cliente
    }

    // Llamado cuando el usuario toca "Pagar"
    func procesarPago(tokenTarjeta: String, monto: Int) {
        estaCargando = true
        resultadoPago = nil
        mensajeError = nil

        Task {
            do {
                // Obtener un token de sesión fresco
                let sesion = try await cliente.getSessionToken()

                // Construir y ejecutar la solicitud de pago
                let respuesta = try await cliente.createTransactionPayment(
                    CreateTransactionPaymentRequest(
                        sessionToken: sesion.sessionToken,
                        amount: monto,
                        currency: "COP",
                        orderId: "ORDEN-\(UUID().uuidString.prefix(8))",
                        description: "Compra en la App",
                        token: tokenTarjeta,
                        cardholderId: "123456799",
                        cardholderIdType: "CC",
                        email: "cliente@ejemplo.com",
                        phone: "+1 311111111",
                        ipAddress: "0.0.0.0"   // Use la IP real en producción
                    )
                )

                estaCargando = false

                if respuesta.approved {
                    resultadoPago = "✅ ¡Aprobado! ID: \(respuesta.transactionId)"
                } else {
                    resultadoPago = "❌ Rechazado: \(respuesta.responseMessage)"
                }

            } catch let error as EcollectError {
                estaCargando = false
                mensajeError = error.localizedDescription
                mostrarError = true
            } catch {
                estaCargando = false
                mensajeError = error.localizedDescription
                mostrarError = true
            }
        }
    }
}

// MARK: - Vista SwiftUI

struct VistaPago: View {
    // EnvironmentObject — inyectado desde el padre o el punto de entrada de la app
    @EnvironmentObject var clienteEcollect: EcollectClient

    // ViewModel que pertenece a esta vista
    @StateObject private var modeloVista: ModeloVistaPago

    // El token de tarjeta guardada (en una app real, cargado desde su backend o Keychain)
    let tokenTarjetaGuardada = "SU_TOKEN_DE_TARJETA_GUARDADA"

    init() {
        // Nota: En una app real, inyectaría el cliente correctamente
        _modeloVista = StateObject(wrappedValue: ModeloVistaPago(
            cliente: EcollectClient(apiKey: "SU_KEY", entityCode: "50039", testMode: true)
        ))
    }

    var body: some View {
        VStack(spacing: 24) {

            Text("Pago")
                .font(.largeTitle)
                .fontWeight(.bold)

            // Resumen del pedido
            VStack(alignment: .leading, spacing: 8) {
                Text("Resumen del Pedido")
                    .font(.headline)
                HStack {
                    Text("Total")
                    Spacer()
                    Text("$500.00 COP")
                        .fontWeight(.semibold)
                }
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)

            // Mostrar tarjeta guardada (usando token)
            HStack {
                Image(systemName: "creditcard.fill")
                    .foregroundColor(.blue)
                Text("Visa **** 5275")
                Spacer()
                Text("Tarjeta guardada")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)

            // Mensaje de resultado del pago
            if let resultado = modeloVista.resultadoPago {
                Text(resultado)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .padding()
                    .background(
                        resultado.contains("✅") ? Color.green.opacity(0.1) : Color.red.opacity(0.1)
                    )
                    .cornerRadius(8)
            }

            // Botón de pago
            Button(action: {
                modeloVista.procesarPago(tokenTarjeta: tokenTarjetaGuardada, monto: 50000)
            }) {
                HStack {
                    if modeloVista.estaCargando {
                        ProgressView()       // Indicador de carga
                            .tint(.white)
                    } else {
                        Image(systemName: "lock.fill")
                    }
                    Text(modeloVista.estaCargando ? "Procesando..." : "Pagar $500.00 COP")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(modeloVista.estaCargando ? Color.gray : Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(modeloVista.estaCargando)

            Spacer()
        }
        .padding()
        // Alerta de error
        .alert("Error de Pago", isPresented: $modeloVista.mostrarError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(modeloVista.mensajeError ?? "Ocurrió un error desconocido")
        }
    }
}

// MARK: - Preview
#Preview {
    VistaPago()
}
```

---

## 📱 Ejemplo de Integración con UIKit

Cómo usar el SDK en un UIViewController con UIKit.

```swift
import UIKit
import EcollectSDK

class ControladorVistaPago: UIViewController {

    // Elementos de UI (conectados via Interface Builder o creados programáticamente)
    @IBOutlet weak var botonPagar: UIButton!
    @IBOutlet weak var indicadorActividad: UIActivityIndicatorView!
    @IBOutlet weak var etiquetaEstado: UILabel!

    // Cliente de ecollect — en una app real, inyéctelo via inicializador o propiedad
    private let cliente = EcollectClient(
        apiKey: "SU_API_KEY",
        entityCode: "50039",
        testMode: true
    )

    override func viewDidLoad() {
        super.viewDidLoad()
        etiquetaEstado.text = "Listo para pagar"
        indicadorActividad.hidesWhenStopped = true
    }

    @IBAction func botonPagarPresionado(_ sender: UIButton) {
        // Iniciar un Task para ejecutar código async
        Task {
            await procesarPago()
        }
    }

    // @MainActor garantiza que las actualizaciones de UI ocurran en el hilo principal
    @MainActor
    private func procesarPago() async {
        // Mostrar estado de carga
        botonPagar.isEnabled = false
        indicadorActividad.startAnimating()
        etiquetaEstado.text = "Procesando..."

        do {
            // Paso 1: Obtener un token de sesión fresco
            let sesion = try await cliente.getSessionToken()

            // Paso 2: Ejecutar el pago
            let respuesta = try await cliente.createTransactionPayment(
                CreateTransactionPaymentRequest(
                    sessionToken: sesion.sessionToken,
                    amount: 50000,
                    currency: "COP",
                    orderId: "ORDEN-UIK-001",
                    description: "Compra",
                    token: "TOKEN_TARJETA_GUARDADA",
                    cardholderId: "123456799",
                    cardholderIdType: "CC",
                    email: "cliente@ejemplo.com",
                    phone: "+1 311111111",
                    ipAddress: "0.0.0.0"
                )
            )

            // Actualizar UI con el resultado
            indicadorActividad.stopAnimating()
            botonPagar.isEnabled = true

            if respuesta.approved {
                etiquetaEstado.text = "✅ ¡Pago aprobado!\nID: \(respuesta.transactionId)"
                etiquetaEstado.textColor = .systemGreen
                mostrarAlertaExito(idTransaccion: respuesta.transactionId)
            } else {
                etiquetaEstado.text = "❌ Rechazado: \(respuesta.responseMessage)"
                etiquetaEstado.textColor = .systemRed
            }

        } catch let error as EcollectError {
            indicadorActividad.stopAnimating()
            botonPagar.isEnabled = true

            switch error {
            case .connectionFailed:
                mostrarAlertaError("Sin conexión a Internet. Intente nuevamente.")
            case .requestTimeout:
                mostrarAlertaError("Tiempo de espera agotado. Intente nuevamente.")
            case .authenticationFailed(let msg):
                mostrarAlertaError("Autenticación fallida: \(msg)")
            default:
                mostrarAlertaError("Error de pago: \(error.localizedDescription)")
            }
        } catch {
            indicadorActividad.stopAnimating()
            botonPagar.isEnabled = true
            mostrarAlertaError("Error inesperado: \(error.localizedDescription)")
        }
    }

    private func mostrarAlertaExito(idTransaccion: String) {
        let alerta = UIAlertController(
            title: "Pago Exitoso",
            message: "ID de Transacción: \(idTransaccion)\n\n¡Su pedido está confirmado!",
            preferredStyle: .alert
        )
        alerta.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            // Navegar a la pantalla de confirmación del pedido
        })
        present(alerta, animated: true)
    }

    private func mostrarAlertaError(_ mensaje: String) {
        let alerta = UIAlertController(
            title: "Pago Fallido",
            message: mensaje,
            preferredStyle: .alert
        )
        alerta.addAction(UIAlertAction(title: "OK", style: .default))
        present(alerta, animated: true)
    }
}
```

---

## 🎯 Ejemplo Completo

Este es un archivo Swift completo y ejecutable que demuestra todas las funciones del SDK.

```swift
/**
 * SDK de ecollect — Ejemplo Completo de Extremo a Extremo (Swift)
 *
 * Este archivo demuestra el flujo completo de pagos:
 *  1. Inicializar el cliente
 *  2. Obtener un token de sesión
 *  3. Listar métodos de pago disponibles
 *  4. Guardar un token de tarjeta
 *  5. Listar tokens guardados del cliente
 *  6. Procesar un pago usando el token guardado
 *  7. Consultar el estado de la transacción
 *
 * Cómo ejecutar: Agregue esto a un Swift Playground o a un nuevo archivo Swift en su proyecto.
 */

import Foundation
import EcollectSDK

// ============================================================
// PASO 0: Inicializar el cliente
// ============================================================
print("========================================")
print("SDK de ecollect — Ejemplo Completo Swift")
print("========================================")

let cliente = EcollectClient(
    apiKey: "SU_API_KEY",      // ← Reemplace con su API key real
    entityCode: "50039",        // ← Reemplace con su código de entidad real
    testMode: true             // Modo de prueba: ¡sin cobros reales!
)

print("Cliente inicializado en modo PRUEBA")

// Toda la acción ocurre en este Task asíncrono
Task {
    // --------------------------------------------------------
    // PASO 1: Obtener un token de sesión
    // --------------------------------------------------------
    print("\n--- Paso 1: Obtener Token de Sesión ---")

    guard let sesion = try? await cliente.getSessionToken() else {
        print("FALLÓ la obtención del token. Verifique su API key y conexión a Internet.")
        return
    }

    let tokenSesion = sesion.sessionToken
    print("Token obtenido: \(String(tokenSesion.prefix(20)))...")

    // --------------------------------------------------------
    // PASO 2: Listar métodos de pago disponibles
    // --------------------------------------------------------
    print("\n--- Paso 2: Métodos de Pago Disponibles ---")

    do {
        let respuestaMp = try await cliente.getPaymentSystem(
            GetPaymentSystemRequest(sessionToken: tokenSesion)
        )
        for metodo in respuestaMp.paymentSystems {
            print("  [\(metodo.paymentSystemId)] \(metodo.name)")
        }
    } catch {
        print("No se pudieron obtener los métodos de pago: \(error)")
    }

    // --------------------------------------------------------
    // PASO 3: Guardar un token de tarjeta
    // --------------------------------------------------------
    print("\n--- Paso 3: Guardar Token de Tarjeta ---")

    var tokenTarjeta: String? = nil
    do {
        let respuestaGuardar = try await cliente.tokenCommand(
            TokenCommandRequest(
                command: "SAVE",
                sessionToken: tokenSesion,
                cardNumber: "4296005885355275",        // Número de tarjeta de prueba
                expirationDate: "12/2025",
                paymentSystem: 1,                     // Visa
                fiCode: 190,
                cardholderName: "David Caballero",
                cardholderIdType: "CC",
                cardholderId: "123456799",
                email: "david.caballero@ecollect.co",
                phone: "+1 311111111"
            )
        )
        tokenTarjeta = respuestaGuardar.token
        print("¡Tarjeta guardada! Token: \(respuestaGuardar.token)")
    } catch {
        print("No se pudo guardar la tarjeta: \(error)")
    }

    // --------------------------------------------------------
    // PASO 4: Listar tokens guardados del cliente
    // --------------------------------------------------------
    print("\n--- Paso 4: Listar Tarjetas Guardadas ---")

    do {
        // Siempre use un token de sesión fresco
        let sesionFresca = try await cliente.getSessionToken()
        let respuestaConsulta = try await cliente.queryToken(
            QueryTokenRequest(
                sessionToken: sesionFresca.sessionToken,
                cardholderId: "123456799",
                cardholderIdType: "CC"
            )
        )
        print("Se encontraron \(respuestaConsulta.tokens.count) tarjeta(s) guardada(s):")
        for tarjeta in respuestaConsulta.tokens {
            print("  **** **** **** \(tarjeta.lastFour)  (\(tarjeta.paymentSystemName))")
        }
    } catch {
        print("No se pudieron listar los tokens: \(error)")
    }

    // --------------------------------------------------------
    // PASO 5: Procesar un pago
    // --------------------------------------------------------
    print("\n--- Paso 5: Procesar Pago ---")

    var idTransaccion: String? = nil
    do {
        let sesionPago = try await cliente.getSessionToken()  // Token fresco para el pago

        let respuestaPago = try await cliente.createTransactionPayment(
            CreateTransactionPaymentRequest(
                sessionToken: sesionPago.sessionToken,
                amount: 50000,                               // $500.00 COP
                currency: "COP",
                orderId: "ORDEN-SWIFT-001",
                description: "Compra de prueba via SDK Swift ecollect",
                token: tokenTarjeta ?? "TOKEN_DEMO",          // Token del paso 3
                cardholderId: "123456799",
                cardholderIdType: "CC",
                email: "david.caballero@ecollect.co",
                phone: "+1 311111111",
                ipAddress: "192.168.1.100"
            )
        )

        if respuestaPago.approved {
            print("¡PAGO APROBADO!")
            print("  ID de Transacción: \(respuestaPago.transactionId)")
            print("  Autorización:      \(respuestaPago.authorizationCode)")
            idTransaccion = respuestaPago.transactionId
        } else {
            print("PAGO RECHAZADO: \(respuestaPago.responseMessage)")
        }

    } catch let error as EcollectError {
        print("Error de pago: \(error)")
    }

    // --------------------------------------------------------
    // PASO 6: Consultar el estado de la transacción
    // --------------------------------------------------------
    if let txId = idTransaccion {
        print("\n--- Paso 6: Consultar Estado de Transacción ---")

        do {
            let sesionEstado = try await cliente.getSessionToken()

            let respuestaEstado = try await cliente.getTransactionInformation(
                GetTransactionInformationRequest(
                    sessionToken: sesionEstado.sessionToken,
                    transactionId: txId
                )
            )

            print("Estado:  \(respuestaEstado.status)")
            print("Monto:   \(respuestaEstado.amount) \(respuestaEstado.currency)")
            print("Fecha:   \(respuestaEstado.transactionDate)")
        } catch {
            print("No se pudo consultar el estado: \(error)")
        }
    }

    // --------------------------------------------------------
    // ¡Listo!
    // --------------------------------------------------------
    print("\n========================================")
    print("¡Ejemplo de extremo a extremo completado!")
    print("========================================")
    print("\nPróximos pasos:")
    print("  1. Reemplace SU_API_KEY con credenciales reales")
    print("  2. Configure testMode: false para producción")
    print("  3. Use un ViewModel + @Published para SwiftUI")
    print("  4. Configure una URL de webhook en su panel de ecollect")
}

// Mantener el proceso activo para que el Task async se complete (en herramientas de línea de comandos)
RunLoop.main.run(until: Date(timeIntervalSinceNow: 15))
```

---

## ⚠️ Errores Comunes

### `EcollectError.authenticationFailed`
**Causa:** API key o código de entidad incorrectos.
**Solución:** Inicie sesión en su panel de comerciante de ecollect y copie las credenciales nuevamente.

### `EcollectError.connectionFailed`
**Causa:** Sin internet, o `NSAppTransportSecurity` está bloqueando la solicitud.
**Solución:** Asegúrese de que su dispositivo/simulador tenga internet. En `Info.plist`, verifique la configuración ATS para el dominio de ecollect.

### `EcollectError.requestTimeout`
**Causa:** Red lenta o servidor sin respuesta.
**Solución:** Aumente el timeout: `EcollectClient(..., timeoutInterval: 60.0)`.

### `EcollectError.validationError`
**Causa:** Falta un campo requerido o tiene un formato inválido.
**Solución:** Revise el valor de `field` en el error para ver exactamente qué falta.

### Error de compilación: `Cannot find type 'EcollectClient' in scope`
**Causa:** El SDK no se agregó correctamente o falta el import.
**Solución:** Verifique que la dependencia de Swift Package Manager está en Xcode y que tiene `import EcollectSDK` al inicio de su archivo.

### Advertencia: `Non-sendable type 'EcollectClient' passed in implicitly`
**Causa:** Está usando el cliente desde múltiples contextos de concurrencia.
**Solución:** Anote su ViewModel con `@MainActor` o asegúrese de acceder al cliente desde el mismo actor.

---

## ❓ Preguntas Frecuentes

**P: ¿Puedo usar este SDK en macOS o tvOS también?**
R: El SDK soporta iOS 15+ y macOS 12+. El soporte para tvOS puede variar — revise la documentación del paquete.

**P: ¿Es seguro almacenar tokens de tarjeta en mi base de datos?**
R: Sí. Los tokens no son números de tarjeta. Son referencias seguras que solo ecollect puede resolver. No se requiere cumplimiento PCI DSS de su parte.

**P: ¿Dónde debo inicializar `EcollectClient` en una app SwiftUI?**
R: Las mejores opciones: (1) En su `@main App` y inyectar via `.environmentObject()`, o (2) En un ViewModel con `@StateObject`.

**P: ¿Cómo evito crear el cliente en cada creación de vista?**
R: Use `@StateObject` (no `@ObservedObject`) en SwiftUI, o una clase de servicio singleton. `@StateObject` crea el objeto solo una vez por ciclo de vida de la vista.

**P: Mi pago tuvo un timeout — ¿se realizó el cobro?**
R: Después de un timeout, siempre llame a `getTransactionInformation` antes de reintentar el pago. Nunca reintente sin verificar — podría cobrar doble al cliente.

**P: ¿Puedo procesar pagos por PSE (transferencia bancaria colombiana)?**
R: Sí, si PSE está habilitado en su cuenta de ecollect. Use `getPaymentSystem` para ver qué métodos están disponibles y pase el ID del sistema de pago PSE en su solicitud de pago.

**P: ¿Cómo pruebo en un iPhone real?**
R: Conecte su iPhone a su Mac, selecciónelo como destino de compilación en Xcode y ejecute. Asegúrese de que el dispositivo tenga conexión a Internet y esté usando `testMode: true`.

---

## 📞 Soporte

- **Panel de Comerciante ecollect:** [https://www.e-collect.com](https://www.e-collect.com)
- **Problemas con el SDK:** Abra un issue en el repositorio de GitHub

---

*¡Ya casi llega! Pruebe todo en modo de prueba primero — lo peor que puede pasar allí es una transacción de prueba rechazada. Una vez que esté seguro, configure `testMode: false` y ¡publique su app!* 🚀
