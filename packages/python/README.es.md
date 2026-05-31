# 🚀 ecollect Python SDK — Guía Completa

Bienvenido al **SDK de Python de ecollect**. Esta guía está escrita para desarrolladores de todos los niveles de experiencia. Si nunca ha integrado una pasarela de pagos, no se preocupe — explicamos cada paso en detalle.

---

## 📋 Tabla de Contenidos

1. [¿Qué es ecollect?](#qué-es-ecollect)
2. [Requisitos Previos](#requisitos-previos)
3. [Instalación](#instalación)
4. [Configuración — Creando el Cliente](#configuración--creando-el-cliente)
5. [API Asíncrona vs Síncrona](#api-asíncrona-vs-síncrona)
6. [Obtener un Token de Sesión](#obtener-un-token-de-sesión)
7. [Guardar un Token de Tarjeta](#guardar-un-token-de-tarjeta)
8. [Listar Tokens Guardados](#listar-tokens-guardados)
9. [Procesar un Pago](#procesar-un-pago)
10. [Obtener Sistemas de Pago Disponibles](#obtener-sistemas-de-pago-disponibles)
11. [Consultar Estado de Transacción](#consultar-estado-de-transacción)
12. [Verificación de Webhooks](#verificación-de-webhooks)
13. [Manejo de Errores](#manejo-de-errores)
14. [Pruebas vs Producción](#pruebas-vs-producción)
15. [Script Completo de Ejemplo](#script-completo-de-ejemplo)
16. [Errores Comunes](#errores-comunes)
17. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## 💡 ¿Qué es ecollect?

**ecollect** es una pasarela de pagos latinoamericana que permite a su aplicación:

- Aceptar pagos con tarjetas de crédito y débito (Visa, Mastercard y más)
- Procesar transferencias bancarias (PSE en Colombia, SPEI en México, entre otros)
- Guardar datos de tarjetas de forma segura usando **tokens** (para que los clientes no tengan que digitar su número de tarjeta cada vez)
- Consultar el estado de transacciones anteriores
- Verificar webhooks enviados por ecollect a su servidor

El SDK (Kit de Desarrollo de Software) es una librería de Python que encapsula todas las llamadas a la API de ecollect en funciones fáciles de usar — no necesita escribir solicitudes HTTP directamente.

> 🏦 **¿De dónde obtengo mis credenciales?** Su **API Key** y **Código de Entidad** provienen del panel de control de comerciantes de ecollect. Contacte a su gestor de cuenta ecollect para obtener acceso.

---

## ✅ Requisitos Previos

Antes de comenzar, asegúrese de tener:

| Requisito | Versión Mínima | Cómo verificar |
|---|---|---|
| Python | 3.9 o superior | `python --version` |
| pip | Última versión recomendada | `pip --version` |

### Instalar Python (si aún no lo tiene)

Vaya a [https://www.python.org/downloads/](https://www.python.org/downloads/) y descargue el instalador para su sistema operativo. Durante la instalación, marque la casilla **"Add Python to PATH"**.

### Verificar la versión de Python

Abra su terminal (Símbolo del sistema en Windows, Terminal en Mac/Linux) y escriba:

```bash
python --version
# Salida esperada, por ejemplo: Python 3.11.4
```

Si ve `Python 2.x.x`, necesita instalar Python 3. En Mac/Linux, pruebe con `python3 --version`.

---

## 📦 Instalación

Instale el SDK de ecollect usando pip:

```bash
pip install ecollect-sdk
```

Si utiliza un entorno virtual (¡recomendado!):

```bash
# Crear un entorno virtual llamado "venv"
python -m venv venv

# Activarlo en Mac/Linux
source venv/bin/activate

# Activarlo en Windows (Símbolo del sistema)
venv\Scripts\activate

# Ahora instalar el SDK dentro del entorno virtual
pip install ecollect-sdk
```

> 💡 **¿Qué es un entorno virtual?** Es un entorno Python aislado para su proyecto. Mantiene las dependencias de su proyecto separadas de otros proyectos en su máquina. Piense en él como una caja de herramientas dedicada para cada proyecto.

Verifique que la instalación fue exitosa:

```bash
pip show ecollect-sdk
# Debería mostrar: Name: ecollect-sdk, Version: x.x.x, etc.
```

---

## 🔧 Configuración — Creando el Cliente

El `EcollectClient` es el objeto principal que utiliza para comunicarse con la API de ecollect. Créelo una vez y reutilícelo en toda su aplicación.

```python
from ecollect import EcollectClient

# Crear el cliente con sus credenciales
cliente = EcollectClient(
    api_key="SU_API_KEY_AQUÍ",          # La API key de su panel de ecollect
    entity_code="SU_CÓDIGO_DE_ENTIDAD", # Su código de entidad (ej: "50039")
    test_mode=True,                     # True  = entorno de pruebas (¡sin cobros reales!)
                                        # False = producción (¡dinero real!)
)
```

### Todas las opciones disponibles

```python
from ecollect import EcollectClient

cliente = EcollectClient(
    api_key="SU_API_KEY_AQUÍ",          # Obligatorio: su API key
    entity_code="SU_CÓDIGO_DE_ENTIDAD", # Obligatorio: su código de entidad
    test_mode=True,                     # Opcional: por defecto False (producción)
    timeout=30,                         # Opcional: tiempo de espera HTTP en segundos (defecto: 30)
    retries=3,                          # Opcional: número de reintentos en caso de fallo (defecto: 3)
)
```

### URLs de Prueba vs Producción

El SDK selecciona automáticamente la URL correcta según `test_mode`:

| Modo | URL |
|---|---|
| Pruebas (`test_mode=True`) | `https://test1.e-collect.com/app_express/api/` |
| Producción (`test_mode=False`) | `https://www.e-collect.com/app_Express/api/` |
| Producción — Info de Transacción | `https://m.e-collect.com/app_Express/api/GetTransactionInformation` |

> ⚠️ **Importante:** El entorno de pruebas **NO** realiza cobros reales. Use siempre `test_mode=True` durante el desarrollo. Nunca use números de tarjeta reales en el entorno de pruebas.

---

## ⚡ API Asíncrona vs Síncrona

El SDK de ecollect admite tanto el estilo de programación **síncrono** como el **asíncrono**.

### ¿Qué es async/sync?

- **Síncrono (sync):** Su código espera a que cada operación termine antes de pasar a la siguiente línea. Simple y fácil de entender — ideal para scripts y aplicaciones sencillas.
- **Asíncrono (async):** Su código puede realizar otras tareas mientras espera la respuesta de una solicitud de red. Mejor rendimiento en servidores web que atienden muchos usuarios simultáneamente.

### Ejemplo síncrono

```python
# Código síncrono — se ejecuta línea por línea, espera en cada paso
from ecollect import EcollectClient

cliente = EcollectClient(api_key="SU_KEY", entity_code="50039", test_mode=True)

# Esta línea ESPERA hasta recibir la respuesta
token = cliente.get_session_token()
print(token.session_token)
```

### Ejemplo asíncrono

```python
# Código asíncrono — requiere la librería asyncio
import asyncio
from ecollect import EcollectClient

cliente = EcollectClient(api_key="SU_KEY", entity_code="50039", test_mode=True)

async def principal():
    # 'await' significa: esperar esto, pero permitir que otras tareas continúen
    token = await cliente.async_get_session_token()
    print(token.session_token)

# asyncio.run() inicia el bucle de eventos y ejecuta la función asíncrona
asyncio.run(principal())
```

> 💡 **¿Cuál debo usar?** Use **sync** si escribe un script, usa Django, o Flask con vistas normales. Use **async** si usa FastAPI, aiohttp, u otro framework asíncrono. Ambos producen exactamente los mismos resultados.

---

## 🔑 Obtener un Token de Sesión

Antes de realizar la mayoría de las llamadas a la API, necesita un **token de sesión**. Piense en él como una contraseña temporal que demuestra que tiene permiso para hacer solicitudes. Los tokens de sesión expiran rápidamente, así que obtenga uno fresco antes de operaciones importantes.

### Síncrono

```python
from ecollect import EcollectClient

# Inicializar el cliente (hágalo una vez, generalmente al iniciar la aplicación)
cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Solicitar un token de sesión a la API de ecollect
respuesta = cliente.get_session_token()

# El objeto de respuesta contiene el token y metadatos
print("Token de sesión:", respuesta.session_token)
print("Expira en:", respuesta.expires_at)
print("Estado:", respuesta.status)
```

### Asíncrono

```python
import asyncio
from ecollect import EcollectClient

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

async def obtener_token():
    # Observe el prefijo 'async_' en los métodos asíncronos
    respuesta = await cliente.async_get_session_token()
    print("Token de sesión:", respuesta.session_token)
    print("Expira en:", respuesta.expires_at)

asyncio.run(obtener_token())
```

### Campos de la respuesta

| Campo | Tipo | Descripción |
|---|---|---|
| `session_token` | `str` | El token a usar en las siguientes solicitudes |
| `expires_at` | `datetime` | Cuándo expira este token |
| `status` | `str` | `"SUCCESS"` si todo funcionó correctamente |

---

## 💳 Guardar un Token de Tarjeta

La **tokenización** de tarjetas permite guardar los datos de la tarjeta de un cliente de forma segura. En lugar de almacenar el número de tarjeta real en su base de datos (lo que requiere cumplimiento estricto de PCI DSS), ecollect lo almacena y le entrega un **token** — una referencia segura que puede guardar y usar en pagos futuros.

### El método `token_command` con `SAVE`

#### Versión asíncrona (recomendada para aplicaciones web)

```python
import asyncio
from ecollect import EcollectClient
from ecollect.models import TokenCommandRequest

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

async def guardar_tarjeta():
    # Paso 1: Obtener un token de sesión — requerido antes de cualquier llamada
    sesion = await cliente.async_get_session_token()
    token_sesion = sesion.session_token

    # Paso 2: Construir el objeto de solicitud con los datos de la tarjeta
    solicitud = TokenCommandRequest(
        command="SAVE",                              # Indicar a ecollect que queremos GUARDAR una tarjeta
        session_token=token_sesion,                  # El token de sesión que acabamos de obtener
        card_number="4296005885355275",              # Número de tarjeta del cliente
        expiration_date="12/2025",                   # Fecha de vencimiento (formato: MM/AAAA)
        payment_system=1,                            # Red de pago: 1 = Visa
        fi_code=190,                                 # Código de institución financiera
        cardholder_name="David Caballero",           # Nombre tal como aparece en la tarjeta
        cardholder_id_type="CC",                     # Tipo de ID: CC = Cédula Ciudadana
        cardholder_id="123456799",                   # Número de identificación nacional
        email="david.caballero@ecollect.co",         # Email del cliente (para recibos)
        phone="+1 311111111",                        # Teléfono del cliente
    )

    # Paso 3: Enviar la solicitud a ecollect
    respuesta = await cliente.async_token_command(solicitud)

    # Paso 4: Guarde respuesta.token en SU base de datos — lo necesitará para pagos futuros
    print("¡Tarjeta guardada exitosamente!")
    print("Token a almacenar en su BD:", respuesta.token)
    print("Estado:", respuesta.status)

asyncio.run(guardar_tarjeta())
```

#### Versión síncrona

```python
from ecollect import EcollectClient
from ecollect.models import TokenCommandRequest

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Paso 1: Obtener un token de sesión
sesion = cliente.get_session_token()
token_sesion = sesion.session_token

# Paso 2: Construir la solicitud para guardar la tarjeta
solicitud = TokenCommandRequest(
    command="SAVE",                              # Comando: GUARDAR una nueva tarjeta
    session_token=token_sesion,                  # Obligatorio: token de sesión activo
    card_number="4296005885355275",              # Número de tarjeta (sin espacios ni guiones)
    expiration_date="12/2025",                   # Fecha de vencimiento: MM/AAAA
    payment_system=1,                            # 1 = Visa, 2 = Mastercard, etc.
    fi_code=190,                                 # Código de institución financiera de ecollect
    cardholder_name="David Caballero",           # Nombre como aparece en la tarjeta
    cardholder_id_type="CC",                     # CC = Cédula Ciudadana (Colombia)
    cardholder_id="123456799",                   # Número de identificación del cliente
    email="david.caballero@ecollect.co",         # Email (para recibos y notificaciones)
    phone="+1 311111111",                        # Teléfono con código de país
)

# Paso 3: Ejecutar el comando
respuesta = cliente.token_command(solicitud)

# Paso 4: ¡Guarde respuesta.token en su base de datos!
# Este token representa la tarjeta — úselo para pagos futuros
print("¡Tarjeta guardada exitosamente!")
print("Token a guardar:", respuesta.token)
print("Estado:", respuesta.status)
```

### Otros comandos de token

| Comando | Descripción |
|---|---|
| `SAVE` | Guardar una nueva tarjeta y recibir un token reutilizable |
| `GET` | Recuperar detalles (enmascarados) de una tarjeta usando su token |
| `REMOVE` | Eliminar permanentemente un token de tarjeta guardado |
| `UPDATE` | Actualizar datos de tarjeta (ej: nueva fecha de vencimiento) |
| `HOLD` | Congelar temporalmente un token de tarjeta |

#### GET — Recuperar una tarjeta guardada

```python
from ecollect.models import TokenCommandRequest

# Recuperar información de una tarjeta guardada (el número aparecerá enmascarado)
solicitud = TokenCommandRequest(
    command="GET",
    session_token=token_sesion,       # Su token de sesión activo
    token="TOKEN_DE_TARJETA_AQUÍ",    # El token guardado cuando se almacenó la tarjeta
)

respuesta = cliente.token_command(solicitud)
print("Titular:", respuesta.cardholder_name)
print("Últimos 4 dígitos:", respuesta.last_four)   # ej: "5275"
print("Vence:", respuesta.expiration_date)
```

#### REMOVE — Eliminar una tarjeta guardada

```python
from ecollect.models import TokenCommandRequest

# Eliminar permanentemente una tarjeta (por ejemplo, cuando el cliente lo solicita)
solicitud = TokenCommandRequest(
    command="REMOVE",
    session_token=token_sesion,       # Su token de sesión activo
    token="TOKEN_DE_TARJETA_AQUÍ",    # El token de la tarjeta a eliminar
)

respuesta = cliente.token_command(solicitud)
print("Tarjeta eliminada, estado:", respuesta.status)
```

---

## 📋 Listar Tokens Guardados

Use `query_token` para obtener todas las tarjetas guardadas de un cliente específico. Esto es útil para mostrar la pantalla "Métodos de pago guardados" en su aplicación.

### Síncrono

```python
from ecollect import EcollectClient
from ecollect.models import QueryTokenRequest

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Primero obtener un token de sesión (siempre requerido)
sesion = cliente.get_session_token()

# Construir la consulta — identificamos al cliente por su número de ID
solicitud = QueryTokenRequest(
    session_token=sesion.session_token,   # Token de sesión activo
    cardholder_id="123456799",            # Número de identificación del cliente
    cardholder_id_type="CC",              # Tipo de ID (CC, NIT, Pasaporte, etc.)
)

# Ejecutar la consulta
respuesta = cliente.query_token(solicitud)

# Recorrer los resultados y mostrar cada tarjeta
print(f"Se encontraron {len(respuesta.tokens)} tarjeta(s) guardada(s) para este cliente:")
for tarjeta in respuesta.tokens:
    print(f"  Token: {tarjeta.token}")
    print(f"  Tarjeta:  **** **** **** {tarjeta.last_four}")
    print(f"  Tipo:  {tarjeta.payment_system_name}")   # ej: "Visa"
    print(f"  Vence:   {tarjeta.expiration_date}")
    print()
```

### Asíncrono

```python
import asyncio
from ecollect import EcollectClient
from ecollect.models import QueryTokenRequest

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

async def listar_tarjetas_guardadas(id_cliente: str):
    # Obtener un token de sesión fresco
    sesion = await cliente.async_get_session_token()

    solicitud = QueryTokenRequest(
        session_token=sesion.session_token,
        cardholder_id=id_cliente,
        cardholder_id_type="CC",
    )

    respuesta = await cliente.async_query_token(solicitud)

    # Retornar una lista de resúmenes de tarjetas para mostrar en la UI
    return [
        {
            "token": tarjeta.token,
            "ultimos_cuatro": tarjeta.last_four,
            "tipo": tarjeta.payment_system_name,
            "vence": tarjeta.expiration_date,
        }
        for tarjeta in respuesta.tokens
    ]

tarjetas = asyncio.run(listar_tarjetas_guardadas("123456799"))
print(tarjetas)
```

---

## 💰 Procesar un Pago

El método `create_transaction_payment` cobra a un cliente. Puede pagar usando:
1. Un **token de tarjeta** (guardado previamente — recomendado para clientes recurrentes)
2. **Datos de tarjeta directamente** (para pagos únicos donde la tarjeta no se guarda)

### Pago con token guardado (Síncrono)

```python
from ecollect import EcollectClient
from ecollect.models import CreateTransactionPaymentRequest

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Paso 1: Obtener un token de sesión fresco
sesion = cliente.get_session_token()

# Paso 2: Construir la solicitud de pago
solicitud = CreateTransactionPaymentRequest(
    session_token=sesion.session_token,      # Token de sesión activo
    amount=50000,                            # Monto en la unidad mínima de la moneda
                                             # (ej: 50000 centavos = $500.00 COP)
    currency="COP",                          # Moneda: COP, MXN, PEN, etc.
    order_id="ORDEN-001",                    # Su referencia única para este pedido
    description="Compra en Mi Tienda",      # Descripción legible del pago
    token="TOKEN_DE_TARJETA_AQUÍ",          # Token de una tarjeta guardada previamente
    cardholder_id="123456799",              # Identificación del cliente
    cardholder_id_type="CC",               # Tipo de ID
    email="david.caballero@ecollect.co",   # Email del cliente (para recibo)
    phone="+1 311111111",                  # Teléfono del cliente
    ip_address="192.168.1.1",              # Dirección IP del cliente
)

# Paso 3: Ejecutar el pago
respuesta = cliente.create_transaction_payment(solicitud)

# Paso 4: Verificar si el pago fue aprobado
if respuesta.approved:
    print("✅ ¡Pago aprobado!")
    print("ID de transacción:", respuesta.transaction_id)    # ¡Guárdelo!
    print("Código de autorización:", respuesta.authorization_code)
else:
    print("❌ Pago rechazado.")
    print("Motivo:", respuesta.response_message)
    print("Código:", respuesta.response_code)
```

### Pago con datos de tarjeta directamente (sin token)

```python
from ecollect import EcollectClient
from ecollect.models import CreateTransactionPaymentRequest

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

sesion = cliente.get_session_token()

# Usar datos de tarjeta directamente en lugar de token (la tarjeta NO se guarda)
solicitud = CreateTransactionPaymentRequest(
    session_token=sesion.session_token,
    amount=50000,
    currency="COP",
    order_id="ORDEN-002",
    description="Compra única",
    # --- Datos de tarjeta (use estos O un token, no ambos) ---
    card_number="4296005885355275",         # Número completo de tarjeta
    expiration_date="12/2025",              # Fecha de vencimiento MM/AAAA
    payment_system=1,                       # 1 = Visa
    fi_code=190,                            # Código de institución financiera
    cardholder_name="David Caballero",      # Nombre en la tarjeta
    cardholder_id="123456799",
    cardholder_id_type="CC",
    email="david.caballero@ecollect.co",
    phone="+1 311111111",
    ip_address="192.168.1.1",
)

respuesta = cliente.create_transaction_payment(solicitud)
print("Aprobado:", respuesta.approved)
print("ID de transacción:", respuesta.transaction_id)
```

### Campos de la respuesta de pago

| Campo | Tipo | Descripción |
|---|---|---|
| `approved` | `bool` | `True` si el pago fue aprobado |
| `transaction_id` | `str` | ID único — **¡guárdelo en su base de datos!** |
| `authorization_code` | `str` | Código de autorización bancaria |
| `response_message` | `str` | Mensaje de resultado legible |
| `response_code` | `str` | Código de resultado para máquinas |
| `amount` | `int` | Monto cobrado |

---

## 🏦 Obtener Sistemas de Pago Disponibles

Use `get_payment_system` para listar todos los métodos de pago habilitados en su cuenta (Visa, Mastercard, PSE, SPEI, etc.). Úselo para mostrar un selector de métodos de pago en su pantalla de pago.

```python
from ecollect import EcollectClient
from ecollect.models import GetPaymentSystemRequest

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Obtener token de sesión
sesion = cliente.get_session_token()

# Construir la solicitud — solo necesita el token de sesión
solicitud = GetPaymentSystemRequest(
    session_token=sesion.session_token,
)

# Ejecutar y mostrar resultados
respuesta = cliente.get_payment_system(solicitud)

print("Métodos de pago disponibles para su cuenta:")
for metodo in respuesta.payment_systems:
    print(f"  ID: {metodo.payment_system_id:<5} Nombre: {metodo.name}")
    # Ejemplo de salida:
    # ID: 1     Nombre: Visa
    # ID: 2     Nombre: Mastercard
    # ID: 5     Nombre: PSE
    # ID: 10    Nombre: SPEI
```

---

## 🔍 Consultar Estado de Transacción

Use `get_transaction_information` para consultar el estado actual de cualquier transacción. Esto es esencial para:
- **Reconciliación:** Comparar sus registros con los de ecollect al cierre del día
- **Recuperación por timeout:** Si su servidor falló durante un pago, verifique si fue aprobado
- **Soporte al cliente:** Consultar rápidamente una transacción cuando un cliente llama

> 📌 **Nota:** En producción, este endpoint usa una URL especial (`https://m.e-collect.com/app_Express/api/GetTransactionInformation`). El SDK maneja esto automáticamente.

```python
from ecollect import EcollectClient
from ecollect.models import GetTransactionInformationRequest

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Obtener token de sesión
sesion = cliente.get_session_token()

# Construir la solicitud de consulta de estado
solicitud = GetTransactionInformationRequest(
    session_token=sesion.session_token,          # Token de sesión activo
    transaction_id="ID_TRANSACCION_AQUÍ",        # El ID retornado al crear el pago
)

# Ejecutar la consulta
respuesta = cliente.get_transaction_information(solicitud)

# Mostrar la información actual de la transacción
print("ID de Transacción:", respuesta.transaction_id)
print("Estado:", respuesta.status)              # "APPROVED", "DECLINED", "PENDING", etc.
print("Monto:", respuesta.amount)
print("Moneda:", respuesta.currency)
print("Fecha:", respuesta.transaction_date)
print("Autorización:", respuesta.authorization_code)
print("Cliente:", respuesta.cardholder_name)
```

---

## 🔒 Verificación de Webhooks

Cuando se completa un pago, ecollect envía un **webhook** — una solicitud HTTP POST a una URL que usted configura en su panel de control. Esto notifica a su servidor sobre eventos de pago en tiempo real.

Para confirmar que un webhook realmente proviene de ecollect (y no de un atacante), siempre **verifique la firma** usando `verify_session_token`.

### Configurar un endpoint de webhook (ejemplo con Flask)

```python
from flask import Flask, request, jsonify
from ecollect import EcollectClient

app = Flask(__name__)

# Inicializar el cliente una vez al arrancar la aplicación
cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

@app.route("/webhook/ecollect", methods=["POST"])
def webhook_ecollect():
    # Parsear el payload JSON entrante
    datos = request.get_json()

    if not datos:
        return jsonify({"error": "No se recibieron datos"}), 400

    # ecollect incluye un session_token en el payload del webhook
    token_sesion = datos.get("session_token")

    if not token_sesion:
        return jsonify({"error": "Token de sesión ausente"}), 400

    # Verificar el token — confirma que la solicitud genuinamente proviene de ecollect
    es_valido = cliente.verify_session_token(token_sesion)

    if not es_valido:
        # Rechazar — podría ser un intento de webhook falsificado
        return jsonify({"error": "Token de sesión inválido"}), 401

    # El webhook es genuino — procesarlo
    id_transaccion = datos.get("transaction_id")
    estado = datos.get("status")

    if estado == "APPROVED":
        # Actualizar el estado del pedido en su base de datos
        print(f"Pago {id_transaccion} aprobado — ¡completar el pedido!")
    elif estado == "DECLINED":
        print(f"Pago {id_transaccion} rechazado.")

    # Siempre retornar 200 para que ecollect sepa que recibió el webhook
    return jsonify({"recibido": True}), 200


if __name__ == "__main__":
    app.run(port=5000)
```

### Verificación independiente

```python
from ecollect import EcollectClient

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# El token que extrajo del payload del webhook entrante
token_entrante = "TOKEN_DEL_PAYLOAD_WEBHOOK"

# Retorna True si es auténtico, False si es inválido/expirado
es_valido = cliente.verify_session_token(token_entrante)

if es_valido:
    print("✅ Webhook auténtico — seguro de procesar")
else:
    print("❌ Webhook falló la verificación — ¡rechácelo!")
```

---

## ❌ Manejo de Errores

El SDK lanza tipos de excepción específicos para que pueda manejar cada escenario de error apropiadamente.

### Todas las clases de excepción

| Excepción | Cuándo se lanza |
|---|---|
| `EcollectAuthError` | API key o código de entidad inválidos |
| `EcollectConnectionError` | No se puede alcanzar el servidor de ecollect (problema de red) |
| `EcollectTimeoutError` | La solicitud tardó más que el timeout configurado |
| `EcollectValidationError` | Parámetros inválidos o faltantes en la solicitud |
| `EcollectApiError` | ecollect retornó un error de lógica de negocio (ej: tarjeta rechazada) |
| `EcollectError` | Clase base — captura cualquiera de los anteriores |

### Ejemplo: Manejo comprehensivo de errores

```python
from ecollect import EcollectClient
from ecollect.models import CreateTransactionPaymentRequest
from ecollect.exceptions import (
    EcollectAuthError,        # Credenciales incorrectas
    EcollectConnectionError,  # Problema de red — no se puede alcanzar el servidor
    EcollectTimeoutError,     # Tardó demasiado en responder
    EcollectValidationError,  # Datos de entrada incorrectos en la solicitud
    EcollectApiError,         # La API respondió con un error de negocio
    EcollectError,            # Captura general para cualquier error de ecollect
)

cliente = EcollectClient(
    api_key="SU_API_KEY",
    entity_code="50039",
    test_mode=True,
)

try:
    # Intentar obtener sesión y procesar un pago
    sesion = cliente.get_session_token()

    solicitud = CreateTransactionPaymentRequest(
        session_token=sesion.session_token,
        amount=50000,
        currency="COP",
        order_id="ORDEN-003",
        description="Pago de prueba",
        token="TOKEN_DE_TARJETA_AQUÍ",
        cardholder_id="123456799",
        cardholder_id_type="CC",
        email="cliente@ejemplo.com",
        phone="+1 311111111",
        ip_address="192.168.1.1",
    )

    respuesta = cliente.create_transaction_payment(solicitud)
    print("Resultado:", respuesta.response_message)

except EcollectAuthError as e:
    # Su API key o código de entidad está incorrecto
    print(f"Error de autenticación: {e}")
    print("Acción: Inicie sesión en su panel de ecollect y copie la API key nuevamente.")

except EcollectConnectionError as e:
    # No se pudo alcanzar el servidor de ecollect
    print(f"Error de conexión: {e}")
    print("Acción: Verifique su conexión a internet. Intente nuevamente en un momento.")

except EcollectTimeoutError as e:
    # El servidor no respondió a tiempo
    print(f"Tiempo de espera agotado: {e}")
    print("Acción: El servidor puede estar ocupado. Reintente o aumente el timeout.")
    # ¡Considere verificar el estado de la transacción antes de reintentar para evitar cobros dobles!

except EcollectValidationError as e:
    # Usted envió datos inválidos o faltantes
    print(f"Error de validación: {e}")
    print(f"Campo con problema: {e.field}")
    print("Acción: Revise todos los campos requeridos en su solicitud.")

except EcollectApiError as e:
    # ecollect procesó la solicitud pero retornó un error de negocio
    print(f"Error de API: {e}")
    print(f"Código de error: {e.code}")
    print(f"Mensaje de error: {e.message}")

except EcollectError as e:
    # Algo más salió mal con el SDK de ecollect
    print(f"Error inesperado de ecollect: {e}")

except Exception as e:
    # Errores que no son de ecollect (bugs en su código, etc.)
    print(f"Error inesperado: {e}")
    raise
```

---

## 🌍 Pruebas vs Producción

### Usar el entorno de pruebas

```python
# MODO PRUEBA — sandbox seguro, no se mueve dinero real
cliente = EcollectClient(
    api_key="SU_API_KEY_DE_PRUEBA",
    entity_code="50039",
    test_mode=True,   # <-- Activa el entorno de pruebas
)
```

### Cambiar a producción

```python
# MODO PRODUCCIÓN — ¡transacciones reales con dinero real!
cliente = EcollectClient(
    api_key="SU_API_KEY_DE_PRODUCCION",       # API key de PRODUCCIÓN del panel
    entity_code="SU_ENTIDAD_DE_PRODUCCION",   # Código de entidad de PRODUCCIÓN
    test_mode=False,                          # <-- Activa el entorno en vivo
)
```

### Buena práctica: Use variables de entorno

¡Nunca codifique sus credenciales directamente en el código fuente! Cualquiera que lea su código (o el historial de git) podría robarlas. Use variables de entorno:

```python
import os
from ecollect import EcollectClient

cliente = EcollectClient(
    api_key=os.environ["ECOLLECT_API_KEY"],          # Leer del entorno
    entity_code=os.environ["ECOLLECT_ENTITY_CODE"],  # Leer del entorno
    test_mode=os.environ.get("ECOLLECT_TEST_MODE", "true").lower() == "true",
)
```

Configure las variables de entorno antes de ejecutar su aplicación:

```bash
# Mac/Linux (agréguelas a ~/.bashrc o ~/.zshrc para que persistan)
export ECOLLECT_API_KEY="su_api_key_aqui"
export ECOLLECT_ENTITY_CODE="50039"
export ECOLLECT_TEST_MODE="true"

# Windows (Símbolo del sistema)
set ECOLLECT_API_KEY=su_api_key_aqui
set ECOLLECT_ENTITY_CODE=50039
set ECOLLECT_TEST_MODE=true
```

O use un archivo `.env` con el paquete `python-dotenv`:

```bash
pip install python-dotenv
```

```
# Archivo .env (¡NUNCA lo suba a git!)
ECOLLECT_API_KEY=su_api_key_aqui
ECOLLECT_ENTITY_CODE=50039
ECOLLECT_TEST_MODE=true
```

```python
from dotenv import load_dotenv
import os
from ecollect import EcollectClient

load_dotenv()  # Carga variables desde el archivo .env

cliente = EcollectClient(
    api_key=os.environ["ECOLLECT_API_KEY"],
    entity_code=os.environ["ECOLLECT_ENTITY_CODE"],
    test_mode=os.environ.get("ECOLLECT_TEST_MODE", "true").lower() == "true",
)
```

### Datos de tarjeta de prueba

Use estos datos cuando `test_mode=True` para simular pagos:

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

## 🎯 Script Completo de Ejemplo

Este script demuestra el flujo de pago completo de principio a fin. Cópielo, reemplace las credenciales y ejecútelo con `python ejemplo.py`.

```python
"""
SDK de ecollect — Ejemplo Completo de Extremo a Extremo (Síncrono)

Este script demuestra el flujo completo:
  1. Inicializar el cliente
  2. Obtener un token de sesión
  3. Consultar métodos de pago disponibles
  4. Guardar un token de tarjeta
  5. Listar tokens guardados del cliente
  6. Procesar un pago usando el token guardado
  7. Consultar el estado de la transacción

Cómo ejecutar:
  pip install ecollect-sdk
  python ejemplo.py
"""

from ecollect import EcollectClient
from ecollect.models import (
    TokenCommandRequest,
    QueryTokenRequest,
    CreateTransactionPaymentRequest,
    GetTransactionInformationRequest,
    GetPaymentSystemRequest,
)
from ecollect.exceptions import EcollectError

# ============================================================
# PASO 0: Inicializar el cliente
# ============================================================
print("=" * 60)
print("SDK de ecollect — Ejemplo Completo")
print("=" * 60)

cliente = EcollectClient(
    api_key="SU_API_KEY",    # <-- Reemplace con su API key real
    entity_code="50039",     # <-- Reemplace con su código de entidad real
    test_mode=True,          # Usando modo de prueba — ¡sin cobros reales!
)

print("Cliente inicializado en modo PRUEBA")

# ============================================================
# PASO 1: Obtener un token de sesión
# ============================================================
print("\n--- Paso 1: Obtener Token de Sesión ---")

try:
    sesion = cliente.get_session_token()
    token_sesion = sesion.session_token
    print(f"Token de sesión obtenido: {token_sesion[:20]}...")
except EcollectError as e:
    print(f"No se pudo obtener el token de sesión: {e}")
    exit(1)

# ============================================================
# PASO 2: Listar métodos de pago disponibles
# ============================================================
print("\n--- Paso 2: Métodos de Pago Disponibles ---")

try:
    solicitud_ps = GetPaymentSystemRequest(session_token=token_sesion)
    respuesta_ps = cliente.get_payment_system(solicitud_ps)

    for metodo in respuesta_ps.payment_systems:
        print(f"  [{metodo.payment_system_id}] {metodo.name}")
except EcollectError as e:
    print(f"No se pudieron obtener los métodos de pago: {e}")

# ============================================================
# PASO 3: Guardar un token de tarjeta
# ============================================================
print("\n--- Paso 3: Guardar Token de Tarjeta ---")

token_tarjeta = None
try:
    solicitud_guardar = TokenCommandRequest(
        command="SAVE",
        session_token=token_sesion,
        card_number="4296005885355275",        # Número de tarjeta de prueba
        expiration_date="12/2025",             # Vencimiento de prueba
        payment_system=1,                      # Visa
        fi_code=190,
        cardholder_name="David Caballero",
        cardholder_id_type="CC",
        cardholder_id="123456799",
        email="david.caballero@ecollect.co",
        phone="+1 311111111",
    )

    respuesta_guardar = cliente.token_command(solicitud_guardar)
    token_tarjeta = respuesta_guardar.token
    print(f"¡Tarjeta guardada! Token: {token_tarjeta}")
except EcollectError as e:
    print(f"No se pudo guardar la tarjeta: {e}")

# ============================================================
# PASO 4: Listar todos los tokens de este cliente
# ============================================================
print("\n--- Paso 4: Listar Tarjetas Guardadas del Cliente ---")

try:
    # Obtener un token de sesión fresco (buena práctica antes de cada operación)
    sesion = cliente.get_session_token()

    solicitud_consulta = QueryTokenRequest(
        session_token=sesion.session_token,
        cardholder_id="123456799",
        cardholder_id_type="CC",
    )

    respuesta_consulta = cliente.query_token(solicitud_consulta)
    print(f"Se encontraron {len(respuesta_consulta.tokens)} tarjeta(s) guardada(s):")
    for tarjeta in respuesta_consulta.tokens:
        print(f"  **** **** **** {tarjeta.last_four}  ({tarjeta.payment_system_name})")
except EcollectError as e:
    print(f"No se pudieron listar los tokens: {e}")

# ============================================================
# PASO 5: Procesar un pago
# ============================================================
print("\n--- Paso 5: Procesar Pago ---")

id_transaccion = None
try:
    # Token de sesión fresco para el pago
    sesion = cliente.get_session_token()

    solicitud_pago = CreateTransactionPaymentRequest(
        session_token=sesion.session_token,
        amount=50000,                              # $500.00 COP (50000 centavos)
        currency="COP",                            # Peso colombiano
        order_id="ORDEN-DEMO-001",                 # Su referencia única de pedido
        description="Compra de prueba via SDK ecollect",
        token=token_tarjeta or "TOKEN_DEMO",       # Token guardado en el paso 3
        cardholder_id="123456799",
        cardholder_id_type="CC",
        email="david.caballero@ecollect.co",
        phone="+1 311111111",
        ip_address="192.168.1.100",
    )

    respuesta_pago = cliente.create_transaction_payment(solicitud_pago)

    if respuesta_pago.approved:
        print("¡PAGO APROBADO!")
        print(f"  ID de Transacción: {respuesta_pago.transaction_id}")
        print(f"  Autorización:      {respuesta_pago.authorization_code}")
        id_transaccion = respuesta_pago.transaction_id
    else:
        print("PAGO RECHAZADO")
        print(f"  Motivo: {respuesta_pago.response_message}")

except EcollectError as e:
    print(f"Error en el pago: {e}")

# ============================================================
# PASO 6: Consultar el estado de la transacción
# ============================================================
if id_transaccion:
    print("\n--- Paso 6: Consultar Estado de Transacción ---")

    try:
        sesion = cliente.get_session_token()

        solicitud_estado = GetTransactionInformationRequest(
            session_token=sesion.session_token,
            transaction_id=id_transaccion,
        )

        respuesta_estado = cliente.get_transaction_information(solicitud_estado)
        print(f"Estado:  {respuesta_estado.status}")
        print(f"Monto:   {respuesta_estado.amount} {respuesta_estado.currency}")
        print(f"Fecha:   {respuesta_estado.transaction_date}")
    except EcollectError as e:
        print(f"No se pudo consultar el estado: {e}")

# ============================================================
# ¡Listo!
# ============================================================
print("\n" + "=" * 60)
print("¡Ejemplo de extremo a extremo completado!")
print("=" * 60)
print("\nPróximos pasos:")
print("  1. Reemplace SU_API_KEY y entity_code con credenciales reales")
print("  2. Configure test_mode=False cuando esté listo para producción")
print("  3. Almacene tokens de tarjeta en su base de datos para clientes recurrentes")
print("  4. Configure una URL de webhook en su panel de ecollect")
```

---

## ⚠️ Errores Comunes

### `EcollectAuthError: Invalid API key`
**Causa:** La API key que proporcionó es incorrecta, expiró, o tiene espacios adicionales.
**Solución:** Inicie sesión en su panel de comerciante de ecollect, vaya a configuración de API y copie la key nuevamente con cuidado.

### `EcollectConnectionError: Unable to reach server`
**Causa:** Su máquina no puede alcanzar los servidores de ecollect (sin internet, firewall, problema de DNS).
**Solución:** Verifique su conexión a internet. Si está en una red corporativa, consulte con su equipo de IT sobre reglas de firewall.

### `EcollectValidationError: field 'card_number' is required`
**Causa:** Olvidó un campo requerido en su objeto de solicitud.
**Solución:** Revise `e.field` para ver el nombre exacto del campo faltante y agréguelo a su solicitud.

### `EcollectTimeoutError`
**Causa:** La solicitud tardó más que la configuración de `timeout` (por defecto: 30 segundos).
**Solución:** Aumente el timeout: `EcollectClient(..., timeout=60)`. También verifique el estado del servidor.

### `SSL Certificate verification failed`
**Causa:** Los certificados SSL/TLS de su sistema están desactualizados.
**Solución:** Ejecute `pip install --upgrade certifi` e intente nuevamente.

### El pago retorna `approved=False` con "Fondos insuficientes"
**Causa:** En modo de prueba, esto es un rechazo simulado para probar su código de manejo de rechazos.
**Solución:** Use los números de tarjeta de prueba oficiales listados en esta guía.

### `ModuleNotFoundError: No module named 'ecollect'`
**Causa:** El SDK no está instalado en el entorno Python que está ejecutando.
**Solución:** Asegúrese de haber activado su entorno virtual (`source venv/bin/activate`) y ejecutado `pip install ecollect-sdk`.

---

## ❓ Preguntas Frecuentes

**P: ¿Necesito un servidor dedicado para usar este SDK?**
R: No. Puede usarlo en cualquier entorno Python — scripts, Django, Flask, FastAPI, AWS Lambda, Google Cloud Functions y más.

**P: ¿Es seguro almacenar tokens de tarjeta en mi base de datos?**
R: Sí. Los tokens no son números de tarjeta reales. Son referencias que solo ecollect puede resolver. Almacenar tokens NO requiere cumplimiento PCI DSS de su parte.

**P: ¿Cuál es la diferencia entre API key y código de entidad?**
R: La API key lo autentica a usted como desarrollador/comerciante. El código de entidad identifica la cuenta de comerciante específica bajo la cual se procesarán los pagos. Ambos provienen de su panel de ecollect.

**P: ¿Cuánto tiempo duran los tokens de sesión?**
R: Los tokens de sesión expiran rápidamente (típicamente pocos minutos). Buena práctica: llame a `get_session_token()` fresco antes de cada grupo de operaciones en lugar de reutilizar tokens anteriores.

**P: ¿Puedo procesar pagos sin guardar un token de tarjeta primero?**
R: Sí. Pase los datos de tarjeta directamente en `CreateTransactionPaymentRequest` en lugar de un token. La tarjeta no se guardará para uso futuro.

**P: ¿Qué monedas son compatibles?**
R: Depende de su contrato con ecollect. Las comunes son: COP (Colombia), MXN (México), PEN (Perú). Contacte a su gestor de cuenta ecollect para la configuración de su cuenta.

**P: Mi pago sigue siendo rechazado en modo de prueba.**
R: Use el número de tarjeta de prueba exacto `4296005885355275` con los datos de esta guía. Los números aleatorios o reales serán rechazados en el entorno de pruebas.

**P: ¿Cómo paso a producción?**
R: Configure `test_mode=False` y use su API key y código de entidad de producción. Complete primero el proceso de incorporación como comerciante en ecollect — ellos habilitarán el acceso a producción.

**P: ¿Puedo usar async y sync en la misma aplicación?**
R: Sí. La misma instancia `EcollectClient` tiene tanto métodos síncronos (`cliente.get_session_token()`) como asíncronos (`await cliente.async_get_session_token()`).

---

## 📞 Soporte

- **Panel de Comerciante ecollect:** [https://www.e-collect.com](https://www.e-collect.com)
- **Problemas con el SDK:** Abra un issue en el repositorio de GitHub
- **Soporte de cuenta:** Contacte a ecollect a través de su panel de comerciante

---

*¡Usted puede lograrlo! Comience con el modo de prueba, familiarícese con el flujo y luego pase a producción con confianza.* 🚀
