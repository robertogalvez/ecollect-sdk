API de Integración Gateway
Contiene la especificación para la integración entre la aplicación del Comercio y la plataforma ecollect para el procesamiento de pagos.

Este servicio recibe peticiones tipo REST API en formato JSON y debe ser consumido mediante protocolo HTTPS

Obtener Token de Sesión
Este servicio permite obtener la llave pública para realizar el consumo de todos los servicios que provee el API.

Recurso: /api/getSessionToken
Método: POST
getSessionTokenType (Request)
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

ApiKey

string

Clave privada de acceso a ecollect, se suministra una llave para ambiente de pruebas y otra diferente para producción.

Nota: Esta clave solo puede ser utilizada desde la parte Server de tu aplicación. Una vez obtengas las clave pública podrás consumir los servicios del API desde tu aplicación web o App sin exponer la llave privada, aunque siempre será recomendado consumir los servicios desde la parte server, es decir, que tu aplicación Web/App se conecta con el Server y éste con el API de ecollect.
getSessionTokenResponseType (Response)
Field	Description
ReturnCode

string

Código de resultado del requerimiento, ver valores posibles en ReturnCode Values.

SessionToken

Clave pública generada por ecollect para consumir los servicios del API.

Nota: Esta clave es requerida para consumir los recursos disponibles en el API, puede ser utilizada varias veces siempre y cuando no haya cumplido el tiempo de expiración, luego de lo cual deberás solicitar un nuevo token de sesión.
LifetimeSecs

Cantidad de segundos que restan para expirar la clave pública enviada en SessionToken.

ReturnCode Values
Code	Description
SUCCESS

Requerimiento exitoso.

FAIL_INVALIDENTITYCODE

EntityCode inválido o no existe.	

FAIL_ACCESSDENIED

ApiKey autenticación inválida o el Comercio se encuentra Inactivo o bloqueado.	

FAIL_SYSTEM

Requerimiento fallido, se presentó excepción en ecollect al procesar la solicitud.

Iniciar una transacción en ecollect
Este servicio permite iniciar una transacción para ser procesada por la plataforma ecollect.

Recurso: /api/createTransactionPayment
Método: POST
createTransactionType (Request)
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

SessionToken

string

Clave pública de acceso a ecollect obtenida en el API /api/getSessionToken

SrvCode

integer

Código asignado por el Comercio para identificar el concepto que está pagando.

TransValue

decimal

Valor a pagar sin impuestos.

TransVatValue

decimal

(Opcional) Valor de impuesto para este pago.

SrvCurrency

string

Código ISO 4217 de moneda en la cual están representados los campos TransValue y TransVatValue. Ejemplos:

COP — Peso Colombiano

MXN — Peso Mexicano

DOP — Peso Dominicano

USD — Dólar Americano

URLRedirect

String

(Opcional) URL púbblica del Comercio donde debe ser enviado el usuario una vez finalice la transacción. Es requerida cuando los medios de pago se van a presentar en la plataforma ecollect o cuando el medio de pago requiere navegación al sitio web de la entidad financiera. Debe ser HTTPS.

Nota:Se recomienda que la URL del Comercio envíe los parámetros tipo GET que requiera manejar internamente de manera cifrada y no en texto plano. Ejemplo: https://MyPulbicSite/myWebApp/Confirmation.aspx?Transactionid=AS6DG89239GG
URLResponse

String

(Opcional) URL púbblica del Endpoint del Comercio donde ecollect envía el resultado de la transacción mediante un requerimiento REST API. (Ver definición del Webhook en la especificación getTransactionInformation). Debe ser HTTPS.

Nota: Se recomienda como principal mecanismo para resolver las transacciones utilizar el API getTransactionInformation en lugar de un webhook.
LangCode

string

(Opcional) Código ISO 639-1 del idioma en el cual se presentará la interfase en ecollect. Ejemplos:

ES — Español (Default)

EN — English

PaymentSystem

string

(Opcional) Código ecollect que identifica el canal o medio de pago seleccionado por el usuario. (ver PaymentSystem Values)

Nota:Requerido solo en el caso que los medios de pago se presenten en la aplicación del Comercio. En este caso se debe consumir previamente el servicio getPaymentSystem
FICode

string

(Opcional) Código ecollect de la entidad financiera o franquicia que seleccionó el usuario para realizar el pago.

Nota: Requerido solo en el caso que los medios de pago se presenten en la aplicación del Comercio. En este caso se debe consumir previamente el servicio getPaymentSystem
Invoice

String

(Opcional) Referencia de pago generada por el Comercio para pago en canales presenciales.

InvoiceDueDate

String

(Opcional) Fecha de vencimiento de la referencia para pago en canales presenciales.
Formato: yyyyMMddHHmmss

PolicyCode

String

(Opcional) La política es un conjunto de operaciones débito/crédito que afectan el valor a pagar. Es neceario que la política esté configurada en ecollect

RequestType

integer

(Opcional) Indica el tipo de requerimiento para procesar esta transacción:

0 — (Default) Solicitud de autorización para ser procesada inmediatamente.

1 — Solicitud de pre-autorización. El autorizador reserva el valor a pagar.

TicketId — Solicitud de posteo. Procesar la transacción de pre-autorizada.

-TicketId — Anular pre-autorización. El autorizador reversa la reserva de fondos.

Nota: Esta funcionalidad no está disponible para todos los autorizadores.
Para la solicitud de posteo se debe enviar el TicketId obtenido en la solicitud de pre-autorización. En el caso de Anular la pre-autorización se envía el mismo -TicketId pero con signo negativo.
ReferenceArray

List<string>

Arreglo de las referencias que permite identifcar la transacción. ecollect le permite al Comercio incluir la información que le ayude al usuario identificar su pago y que sea útil para el proceso. Se recomienda el siguiente orden de las referencias:

[0] — Tipo de documento de identificación cliente/usuario. Ejemplos:CC, NIT, RFC, IFE, RNC, etc.

[1] — Número de Identificación del cliente/usuario.

[2] — Id. de la transacción del Comercio. Ejemplos:#Orden, #Pedido, etc.

[3] — Nombre(s) y Apellido(s) del cliente/usuario

[4] — Correo electrónico del cliente/usuario.

[5] — Número de teléfono cliente/usuario.

[6..n] — (Opcional) Referencias adicionales requeridas por el Comercio.

SubservicesArray

List<subserviceType>

(Opcional) Permite indicar cómo se debe dispersar el pago de esta transacción.

Nota: Esta funcionalidad no está disponible para todos los medios de pago y tiene algunas restricciones que deben ser validadas según el alcance del proyecto. Es responsabilidad del Comercio asegurar que las dispersiones, ya sea en valores fijos o porcentajes, sumen el 100% del total de la transacción.
PaymentInfoArray

List<PaymentInfoType>

Contiene información adicional requerida para el procesamiento de la transacción. (Ver definición PaymentInfoType)

MerchantTransactionId

Usermail

CardHolderIdType

CardHolderId

IPAddress

DeviceFingerPrint

OneTimePassword (Opcional) según alcance del proyeto.

Nota: Para el medio de pago PSE (Colombia) se debe enviar el siguiente atributo, solo si el medio de pago es capturado en la aplicación del Comercio.
UserType

TokenInfoArray

List<PaymentInfoType>

(Opcional) Requerido solo en el caso que los medios de pago sean capturados en la aplicación del Comercio. Contiene la información de la tarjeta de crédito tokenizada que se va a utilizar para esta transacción. (Ver definición PaymentInfoType)

Nota: Esta funcionalidad aplica solo para pagos con tarjeta de crédito. Para usar esta estructura previamente se debe consumir el servicio queryToken para obtener los tokens registrados por el usuario.
Usermail (Utilizado en request queryToken)

CardHolderId (Utilizado en request queryToken)

TokenId (Obtenido en queryToken)

PaymentSystem (Obtenido en queryToken)

FiCode (Obtenido en queryToken)

SecureCode

Installments

OneTimePassword (Opcional) Requerido solo si se recibió como atributo de respuesta en los servicios queryToken o tokenCommand

ChannelInfoArray

List<ChannelInfoType>

(Opcional) Información adicional requerida para el canal. (Ver definición ChannelInfoType)

Nota: Los códigos posibles que se manejan en este arreglo se suministran cuando el alcance del proyecto lo requiere.
createTransactionResponseType (Response)
Field	Description
ReturnCode

string

Código de resultado del requerimiento, ver valores posibles en ReturnCode Values.

TicketId

Integer

Número único de transacción generado por ecollect.

Nota: Será utilizado para consultar en ecollect el estado final de la transacción.
eCollectUrl

String

(Opcional) URL de ecollect donde la aplicación del Comercio debe redirigir al usuario para realizar el pago. Es requerida cuando el medio de pago requiere navegación al sitio web de la entidad financiera.

LifetimeSecs

Cantidad de segundos que restan para expirar el link suministrado en eCollectUrl.

Nota: Si el usuario es enviado a la url indicada en eCollectUrl luego de superar el tiempo de expiración, ecollect generará automáticamente un comprobante de transacción expirada, por lo que al consultar la transacción mediante el API getTransactionInformation se reponderá con TranState en EXPIRED.
TransactionResponse

getTransactionInformationResponseType

(Opcional) Se envia solo si ReturnCode es SUCCESS y si la respuesta no generó una URL de navegación en eCollectUrl. Contiene la misma estructura de respuesta del API /api/getTransactionInformation.

Nota: Si la respuesta retorna un estado BANK o PENDING en el campo TranState, se debe consumir el API /api/getTransactionInformation unos minutos más tarde para resolver la transacción.
ReturnCode Values
Code	Description
SUCCESS

Requerimiento fué recibido correctamente.

FAIL_INVALIDENTITYCODE

EntityCode inválido o no existe.
FAIL_ACCESSDENIED

SessionToken autenticación inválida.
FAIL_APIEXPIREDSESSION

SessionToken el token de sesión ha expirado.
FAIL_INVALIDSERVICECODE

SrvCode inválido o no existe.

FAIL_INVALIDREFERENCE1

ReferenceArray debe contener al menos una referencia que identifique la transacción.
FAIL_INVALIDTRANSVALUE

TransValue inválido.
FAIL_INVALIDVATVALUE

TransVatValue inválido.
FAIL_INVALIDCURRENCY

SrvCurrency inválido o no permitido.
FAIL_INVALIDINVOICE

Invoice inválido o ya existe en otra transacción.
FAIL_INVALIDPOLICY

PolicyCode inválido o no existe.
FAIL_INVALIDSUBSERVICEARRAY

SubservicesArray falló procesando la información de dispersión.
FAIL_TOKENNOTFOUND

TokenInfoArray token no existe o no coincide con los datos como fué creado.
FAIL_TOKENREQUEST

TokenInfoArray información requerida del token está incompleta para procesar la petición.
FAIL_TOKENEXPIRED

TokenInfoArray token no permitido ya que la fecha de vencimiento de la tarjeta ha expirado.
FAIL_MERCHANTRANSID

MerchantTransactionId ya se encuentra asignado a una transacción, debe ser un identificador único por cada requerimiento
FAIL_SYSTEM

Requerimiento fallido, se presentó excepción en ecollect al procesar la información.

subserviceType
Contiene las instrucciones para disepersar el pago en varias cuentas bancarias

Field	Description
EntityCode

integer

Código del Comercio asignado por ecollect de la cuenta bancaria receptora.

SrvCode

string

Código del concepto que se está dispersando

ValueType

integer

Indica qué tipo de valor ha sido enviado en los campos TransValue y TransVatValue. Valores permitidos:

0 — Valor. (valor fijo)

1 — Porcentaje. (1-100)

TransValue

decimal

Valor fijo o porcentaje a dispersar en la cuenta receptora.

TransVatValue

decimal

(Opcional) Valor fijo o porcentaje a dispersar en la cuenta receptora.

Pre-autorización
Permite solicitar una reserva de fondos para una transacción de tarjeta de crédito. Estos son los pasos para utilizar esta funcionalidad:

Paso	Description
Pre-autorización

Enviar una transacción de pre-autorización

Consumir el API /api/createTransactionPayment enviando en RequestType = 1. Este paso genera el TicketId de la transacción ecollect.

Postear

Procesar una transacción de pre-autorización

Consumir nuevamente el API /api/createTransactionPayment enviando en esta oportunidad el RequestType = TicketId con el número de transacción ecollect obtenido en la transacción de pre-autorización. Para esta transacción no requiere enviar PaymentInfoArray ni TokenInfoArray

Anular

Anula la reserva de fondos que se realizó en la pre-autorización

Consumir nuevamente el API /api/createTransactionPayment enviando en esta oportunidad el RequestType = -TicketId (Valor negativo) con el número de transacción ecollect obtenido en la transacción de pre-autorización. Para esta transacción no requiere enviar PaymentInfoArray ni TokenInfoArray

Nota: Por el momento esta funcionalidad solo está disponible para República Dominicana con el autorizador AZUL (Banco Popular Dominicano).
Link de Pagos, SMS y QR
En primera instancia el API createTransactionPayment permite obtener una URL a la cual se debe enviar al usuario para que realice el pago inmediatamente, sin embargo, también es posible generar un link para que realice el pago posteriormente. Por defecto la funcionalidad de Link de Pagos envía el botón para pagar al correo electrónico enviado en PaymentInfoArray, sin embargo, también se puede utilizar este mismo link para enviarlo vía SMS o código QR.

Recurso: /api/createTransactionPayment
Método: POST
createTransactionType (Request)
Adicional a los campos ya especificados se deben enviar la siguiente información:

Field	Description
PaymentSystem

string

Para la funcionalidad de Link de Pagos se debe enviar el valor PaymentSystem=10. (ver PaymentSystem Values)

Nota: El Link de Pagos generado tiene una vigencia que es parametrizable (por defecto es de 1 hora) y se informa en el campo LifetimeSecs contenido en la respuesta de esta API createTransactionResponseType.
PaymentInfoArray

List<PaymentInfoType>

Agregar los siguientes atributos para envio de SMS. (Ver definición PaymentInfoType)

MobileCountryCode

MobileNumber

Obtener el estado de una transacción ecollect
Este servicio permite conocer el estado actualizado de una transacción procesada en la plataforma ecollect.

Recurso: /api/getTransactionInformation
Método: POST
getTransactionInformationType (Request)
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

SessionToken

string

Clave pública de acceso a ecollect obtenida en el API /api/getSessionToken

TicketId

Integer

Número único de transacción generado por ecollect.

PaymentInfoArray

List<PaymentInfoType>

(Opcional) Como contingencia se puede realizar la consulta de la transacción por el siguiente atributo. (Ver definición PaymentInfoType)

MerchantTransactionId

getTransactionInformationResponseType (Response)
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

TicketId

Integer

Número único de transacción generado por ecollect.

TrazabilityCode

string

Número único de transacción generado por ecollect.

TranState

string

Código de estado de transacción, ver valores posibles en TranState Values.

ReturnCode

string

Código de resultado del requerimiento, ver valores posibles en ReturnCode Values.

TransValue

decimal

Valor a total de la transacción incluyendo impuestos.

TransVatValue

decimal

(Opcional) Valor de impuesto para este pago.

PayCurrency

decimal

Código ISO 4217 de moneda en la cual fué procesada la transacción y en la que están representados los campos TransValue y TransVatValue. Ejemplos:

COP — Peso Colombiano

MXN — Peso Mexicano

DOP — Peso Dominicano

USD — Dólar Americano

CurrencyRate

decimal

(Opcional) Tasa de cambio aplicada durante la transacción.

Nota: Este campo es enviado solo cuando SrvCurrency (Request) es diferente a PayCurrency (Response) y efectivamente se encontró la tasa de cambio para la fecha de la transacción
BankProcessDate

DateTime

Fecha y hora en la que se recibió confirmación de la transacción del autorizador.
Formato: YYYY-MM-DDTHH24:mm:ss

FICode

string

Código ecollect de la entidad financiera, canal o franquicia que procesó la transacción.

FiName

string

Nombre de la entidad financiera, canal o franquicia que procesó la transacción.

PaymentSystem

string

Código ecollect que identifica el canal o medio de pago utilizado. (ver PaymentSystem Values)

TransCycle

string

Código ciclo de compensación asignado por la entidad financiera, canal o franquicia que procesó la transacción.

Invoice

String

(Opcional) Referencia de pago generada por ecollect o el Comercio para pago de esta transacción en canales presenciales.

ReferenceArray

List<string>

Arreglo de las referencias que permite identifcar la transacción. ecollect retorna las mismas referencias recibidas en createTransactionType (Request) y las adicionales que eventualmente ecollect pudo haber capturado en el proceso.

SrvCode

integer

Código asignado por el Comercio para identificar el concepto que está pagando.

PaymentInfoArray

List<PaymentInfoType>

(Opcional) Contiene información adicional generada durante el procesamiento de la transacción que envía ecollect al Comercio.

(Ver definición PaymentInfoType) La siguiente información puede ser suministrada por algunos autorizadores de tarjeta de crédito:

Installments

Last4

MaskedCard

MerchanId

TerminalNumber

AuthResponse (Opcional)

FailCode (Opcional)

ChannelInfoArray

List<ChannelInfoType>

(Opcional) Información adicional requerida para el canal. (Ver definición ChannelInfoType)

Nota: Los códigos posibles que se manejan en este arreglo se suministran cuando el alcance del proyecto lo requiere.
ReturnCode Values
Code	Description
SUCCESS

Requerimiento exitoso, se recibió correctamente la información.

FAIL_INVALIDENTITYCODE

EntityCode inválido o no existe.
FAIL_ACCESSDENIED

SessionToken autenticación inválida.
FAIL_APIEXPIREDSESSION

SessionToken el token de sesión ha expirado.
FAIL_INVALIDTICKETID

TicketId inválido o no existe.
FAIL_MERCHANTRANSID

MerchantTransactionId no existe transacción asociada a este Id.
FAIL_SYSTEM

Requerimiento fallido, se presentó excepción en ecollect al resolver la solicitud. Se debe reintentar la petición unos minutos más tarde hasta recibir una respuesta SUCCESS.

TranState Values
Nota: Los estados marcados con el comentario (Doble) requiere que el Comercio realicen control de pago doble, es decir, que no permita reintentar una transacción cuando se encuentre en alguno de estos estados, solo hasta que se presente un cambio de estado definitivo (OK, NOT_AUTHORIZED, EXPIRED, FAILED).
Code	Description
OK

Trasnacción APROBADA por la entidad financiera.

NOT_AUTHORIZED

Transacción RECHAZADA por la entidad financiera.	

BANK

(Doble) El usuario ha inicado el proceso de pago y la transacción está en la entidad financeira.	

PENDING

(Doble) La transacción se encuentra PENDIENTE de confirmación por parte de la entidad financiera.	

CAPTURED

(Doble) Se ha generado la transacción para pago en canales presenciales.

CREATED

(Doble) Corresponde al estado inicial cuando se acaba de crear una transacción por el API de integración Gateway de ecollect.

EXPIRED

Se puede presentar en los siguientes casos:

CAPTURED — Cuando vence el plazo para realizar el pago en canales presenciales.

CREATED — Cuando el usuario ha sido reedirigido a la plataforma ecollect y el usuario no realiza ninguna acción hasta expirar la sesión de la aplicación.

FAILED

Se presentó falla técnica del lado de la entidad financiera procesando la transacción.

Proceso Sonda
Es requerido que el Comercio implemente este proceso con el fin de asegurar integridad transaccional y resolver el estado de todas las transacciones procesadas en la plataforma ecollect que se hayan interrumpido en la navegación por causas del usuario o la entidad financiera, en otras palabras, aquellas transacciones que no hayan regresado a la URL indicada en el campo URLRedirect

Recurso: /api/getTransactionInformation
Método: POST
getTransactionInformationType (Request)
Nota: Consiste en implementar un proceso en background que permita resolver las transacciones que aún no han recibido un estado final (OK, NOT_AUTHORIZED, EXPIRED, FAILED). Se recomienda ejecutar este proceso cada 10 minutos para que consuma el API getTransactionInformation para los TicketId sobre los cuales aún no se ha recibido respuesta.
Webhook
Con este servicio ecollect enviará notificación del estado final de la transacción vía REST API al Endpoint del Comercio.

El Endpoint del Webhook puede ser parametrizado en la plataforma ecollect (único para todas las transacciones) o puede ser indicado a nivel de cada transacción en el atributo URLResponse del requerimiento createTransactionType.

Nota: Se recomienda como principal mecanismo para resolver las transacciones utilizar el API getTransactionInformation en lugar de un webhook.
Webhook Request
Se envía la misma estructura especificada en getTransactionInformationResponseType mencionada en el API getTransactionInformation.

Para que el Comercio pueda asegurar que la notificación está siendo enviada por la plataforma ecollect se agrega la siguiente información:

Field	Description
SessionToken

Corresponde a la clave pública entregada en el API getSessionToken vigente al momento de crear la transacción mediante el API createTransactionPayment, para verificarlo el Comercio puede optar por una de las siguientes alternativas:

Verificación local - Si el Comercio ha guardado bitácora de las claves públicas y TicketId obtenidos, puede verificar que el SessionToken y TicketId enviados en esta notificación efectivamente se encuentran en su base de datos y hacen match.

Verificación por API - Si el Comercio no guarda bitácora, puede consumir el API verifySessionToken para confirmar que el SessionToken enviado en esta notificación corresponde al TicketId contenido en esta notificación.

WebhookResponseType
Field	Description
ReturnCode

string

Código de resultado del requerimiento. Valores esperados:

SUCCESS - El webhook recibió la información

FAIL_SYSTEM - Se presentó falla técnica, ecollect reintentará la notificación.

Nota: ecollect reintentará la notificación máximo 60 minutos a partir de la hora indicada en BankProcessDate.
verifySessionToken
Este servicio permite verificar si una clave pública ha sido generada por la plataforma ecollect.

verifySessionTokenType
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

SessionToken

string

Clave pública de acceso a ecollect obtenida en el API /api/getSessionToken

SessionTokenToVerify

string

Clave pública que se desea verificar

TicketIdToVerify

Integer

(Opcional) Número único de transacción generado por ecollect que se desea verificar.

verifySessionTokenResponseType
Field	Description
ReturnCode

string

Código de resultado del requerimiento. ver valores posibles en ReturnCode Values

ReturnCode Values
Code	Description
SUCCESS

La verificación de la información enviada es exitosa.

FAIL_INVALIDENTITYCODE

EntityCode inválido o no existe.
FAIL_ACCESSDENIED

SessionToken autenticación inválida.
FAIL_APIEXPIREDSESSION

SessionToken el token de sesión ha expirado.
FAIL_SESSIONNOTFOUND

SessionTokenToVerify el token de sesión a verificar no existe.
FAIL_TICKETIDNOTMATCH

TicketIdToVerify no está asociado al SessionTokenToVerify.
FAIL_SYSTEM

Requerimiento fallido, se presentó excepción en ecollect al procesar la información.

Obtener medios de pagos
Este servicio permite consultar los medios de pago habilitados para el Comercio.

Recurso: /api/getPaymentSystem
Método: POST
getPaymentSystemType (Request)
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

SessionToken

string

Clave pública de acceso a ecollect obtenida en el API /api/getSessionToken

getPaymentSystemResponseType (Response)
Field	Description
ReturnCode

string

Código de resultado del requerimiento, ver valores posibles en ReturnCode Values.

PaymentSystemArray

List<PaymentSystemType>

Contiene lista de los medios de pago habilitados para el Comercio.

ReturnCode Values
Code	Description
SUCCESS

Requerimiento fué recibido correctamente y PaymentSystemArray contiene los medios de pago habilitados para este Comercio

NO_RECORDS

No se encontraron medios de pago habilitados para este comercio en la plataforma ecollect

FAIL_INVALIDENTITYCODE

EntityCode inválido o no existe.	

FAIL_ACCESSDENIED

SessionToken autenticación inválida.
FAIL_APIEXPIREDSESSION

SessionToken el token de sesión ha expirado.
FAIL_SYSTEM

Requerimiento fallido, se presentó excepción en ecollect al procesar la información.

PaymentSystemType
Field	Description
PaymentSystem

string

Código ecollect que identifica el canal o medio de pago utilizado. (ver PaymentSystem Values)

BrandImageUrl

string

(Opcional) Solo si el medio de pago está asociado a una marca, entonces se envía la URL del logo de la marca. Formato: .svg

FiImagesArray

List<FiImageType>

(Opcional) Contine lista de logos de la entidad financiera o franquicia y prefijos para identificar la marca de la tarjeta de crédito.

FiArray

List<FiType>

Contine lista de las entidades financieras o franquicias habilitados para el Comercio dentro de este PaymentSystem.

FiImageType
Field	Description
FiCode

string

Código asignado por ecollect para la entidad financeira o franquicia.

FindKeys

string

(Opcional) Lista de prefijos separados por coma para identificar la marca de tarjeta de crédito cuando el usuario digita los primeros números de la tarjeta de crédito. Ejemplos:

VISA — "4"

MASTERCARD — "51-55,222100-272099"

AMEX — "34,37"

Nota: Cuando no se recibe información de FindKeys seguramente el Comercio presentará al usuario una lista desplegable con todos las entidades financieras habilitadas. Mientras que para el caso de tarjeta de crédito ya no sería necesario desplegar una lista sino detectar el FiCode a partir de los primeros dígitos de la tarjeta de crédito.
BrandImageUrl

string

(Opcional) URL del logo de la marca asociada al FiCode. Formato: .svg

FiType
Field	Description
FiCode

string

Código asignado por ecollect para la entidad financiera o franquicia.

FiName

string

Nombre de la entidad financiera o franquicia.

Obtener CustomerId para Tokenización (Opcional)
Este servicio permite obtener un identificador único para cada cliente que realiza tokenización, es útil cuando un cliente tokeniza más de una tarjeta, es decir, que no es necesario volver a enviar la información del cliente cuando tokeniza una nueva tarjeta si previamente se ha obtenido el CustomerId. Este servicio es aceptado para el API /api/tokenCommand

Recurso: /api/getCustomerId
Método: POST
getCustomerIdType (Request)
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

SessionToken

string

Clave pública de acceso a ecollect obtenida en el API /api/getSessionToken

CustomerInfoArray

List<PaymentInfoType>

Contiene la información requerida del cliente que realizará la tokenización de la tarjeta. (Ver definición PaymentInfoType)

Los siguientes atributos son requeridos para vincular un nuevo cliente:

CardHolderId

Usermail

CardHolderName

CardHolderIdType

MobileCountryCode

MobileNumber

Nota: Si el cliente ya se encuentra creado en la base de datos de ecollect entonces se retorna el mismo CustomerId suministrado la primera vez.
Si desea actualizar la información del cliente debes enviar los siguientes atributos:

CustomerId

Usermail (update)

CardHolderName (update)

CardHolderIdType (update)

MobileCountryCode (update)

MobileNumber (update)

Nota: Se han marcado como (update) los atributos que son actualizables mediante este mismo servicio.
getCustomerIdResponseType (Response)
Field	Description
ReturnCode

string

Código de resultado del requerimiento, ver valores posibles en ReturnCode Values.

CustomerInfoArray

List<PaymentInfoType>

Retorna el atributo de ecollect con el CustomerId para el API /api/tokenCommand. (Ver definición PaymentInfoType):

CustomerId

ReturnCode Values
Code	Description
SUCCESS

Requerimiento exitoso.

FAIL_ACCESSDENIED

SessionToken autenticación inválida.
FAIL_APIEXPIREDSESSION

SessionToken el token de sesión ha expirado.
FAIL_INVALIDENTITYCODE

EntityCode inválido o no existe.
FAIL_CARDHOLDERIDTYPE

CardHolderIdType no corresponde con los códigos indicados para este atributo.

FAIL_CARDHOLDERID

CardHolderId inválido.

FAIL_CARDHOLDERNAME

CardHolderName inválido.

FAIL_MOBILECOUNTRYCODE

MobileCountryCode inválido o mal construido.

FAIL_MOBILENUMBER

MobileNumber inválido o mal construido.

FAIL_MAILFORMAT

Usermail inválido o mal construido.

FAIL_SYSTEM

Requerimiento fallido, se presentó excepción en ecollect al procesar la solicitud.

Comandos Tokenización
Este servicio permite ejecutar algunas tareas de tokenización.

Nota: Este servicio aplica solo en el caso que los medios de pago se presenten en la aplicación del Comercio.
Recurso: /api/tokenCommand
Método: POST
tokenCommandType (Request)
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

SessionToken

string

Clave pública de acceso a ecollect obtenida en el API /api/getSessionToken

Nota: Si necesita consumir varias veces esta API dentro del mismo ciclo de una transacción será necesario obtener un nuevo token de sesión por cada consumo de este recurso.
Command

string

Comando a realizar en la plataforma ecollect

GET — Permite obtener un token temporal para procesar un pago con tarjeta de crédito. Este comando se utiliza cuado el usuario no ha aceptado la opción de guardar su tarjeta de crédito

SAVE — Permite tokenizar una nueva tarjeta de crédito. Este comando se utiliza cuado el usuario ha aceptado la opción de guardar su tarjeta de crédito

REMOVE — Permite que el usuario elimine esta tarjeta tokenizada

UPDATE — Permite actualizar la fecha de expiración de la tarjeta de crédito.

HOLD — Permite obtener un token temporal de la tarjeta de crédito para una transacción de pre-autorización. Este token será almancenado mientras se recibe la solicitud de procesar la transacción.

TokenInfoArray

List<PaymentInfoType>

Contiene la información requerida de la tarjeta de crédito sobre la cual se va a ejecutar el comando.

(Ver definición PaymentInfoType) Los siguientes campos son requeridos para el servicio de acuerdo con el tipo de comando:

PaymentSystem (GET/SAVE/REMOVE/UPDATE/HOLD)

FiCode (GET/SAVE/REMOVE/UPDATE/HOLD)

CardNumber (GET/SAVE/HOLD)

ExpirationDate (GET/SAVE/UPDATE/HOLD)

CardIssueBank (GET/SAVE/HOLD)

AccountType (GET/SAVE/HOLD)

CustomerId (GET/SAVE/REMOVE/UPDATE/HOLD)

TokenId (REMOVE/UPDATE)

Los siguientes atributos son requeridos si no se envía CustomerId:

CardHolderName (GET/SAVE/HOLD)

CardHolderIdType (GET/SAVE/HOLD)

CardHolderId (GET/SAVE/REMOVE/UPDATE/HOLD)

MobileCountryCode (GET/SAVE/HOLD)

MobileNumber (GET/SAVE/HOLD)

Nota: Esta funcionalidad aplica solo para pagos con tarjeta de crédito y cuando los medios de pago son presentados en la aplicación del Comercio.
tokenCommandResponseType (Response)
Field	Description
ReturnCode

string

Código de resultado del requerimiento, ver valores posibles en ReturnCode Values.

TokenInfoArray

List<PaymentInfoType>

(Opcional) Contiene atributos de ecollect que pueden ser requeridos posterior a la ejecución del comnado sobre el token. (Ver definición PaymentInfoType):

TokenId

PaymentSystem (ver PaymentSystem Values)

FiCode

FiName

Last4

MaskedCard

BrandImageUrl

OneTimePassword

Si se recibe este atributo indica que se debe solicitar al usuario ingresar la clave dinámica enviada a su correo electrónico para continuar con la transacción.

LifetimeSecs

Cantidad de segundos que restan para expirar el TokenId.

ReturnCode Values
Code	Description
SUCCESS

Requerimiento exitoso.

FAIL_INVALIDENTITYCODE

EntityCode inválido o no existe.
FAIL_INVALIDCOMMAND

Command inválido.
FAIL_TOKENNOTFOUND

TokenId inválido o no existe.

FAIL_CUSTOMERNOTFOUND

CustomerId inválido o no existe.

FAIL_INVALIDCREDITCARD

CardNumber inválido, no cumple con algoritmo Luhn (ver algorithmo Luhn).

FAIL_INVALIDEXPIRATIONDATE

ExpirationDate inválido

FAIL_INVALIDACCOUNTTYPE

AccountType inválido

FAIL_CARDHOLDERIDTYPE

CardHolderIdType no corresponde con los códigos indicados para este atributo.

FAIL_CARDHOLDERID

CardHolderId inválido.

FAIL_CARDHOLDERNAME

CardHolderName inválido.

FAIL_MOBILECOUNTRYCODE

MobileCountryCode inválido o mal construido.

FAIL_MOBILENUMBER

MobileNumber inválido o mal construido.

FAIL_MAILFORMAT

Usermail inválido o mal construido.

FAIL_USERMISMATCH

No coinciden los atributos del usuario Usermail y/o CardHolderId con los registrados en el token (REMOVE).

FAIL_SYSTEM

Requerimiento fallido, se presentó excepción en ecollect al procesar la solicitud.

Consultar tarjetas tokenizadas
Este servicio permite consultar los token de tarjetas de crédito asociados a un usuario.

Nota: Este servicio aplica solo en el caso que los medios de pago se presenten en la aplicación del Comercio.
Recurso: /api/queryToken
Método: POST
queryTokenType (Request)
Field	Description
EntityCode

integer

Código de Comercio asignado por ecollect.

SessionToken

string

Clave pública de acceso a ecollect obtenida en el API /api/getSessionToken

TokenInfoArray

List<PaymentInfoType>

(Opcional) Contiene la información requerida para consultar las tarjetas de crédito tokenizadas por el usuario.

Los siguientes atributos son requeridos:

Usermail

CardHolderId

queryTokenResponseType (Response)
Field	Description
ReturnCode

string

Código de resultado del requerimiento, ver valores posibles en ReturnCode Values.

TokenArray

List<TokenType>

(Opcional) Contiene la información de la(s) tarjeta(s) de crédito tokenizadas por el usuario en la plataforma ecollect.

Nota: No se debe almacenar el Token en base de datos del comercio ya que la plataforma ecollect genera Token dinámicos los cuales tienen una determinada vigencia, por lo tanto siempre se debe consumir el servicio queryToken previo a una transacción.
ReturnCode Values
Code	Description
SUCCESS

Requerimiento fué recibido correctamente.

NO_RECORDS

No se encontraron tokens registrados o activos para este usuario.

SUCCESS_ALREADY_CREATED

Ya se encuentra creado un token para esta misma tarjeta de crédito, con los mismos datos de usuario Usermail y CardHolderId. Se considera exitosa la respuesta por lo tanto se envia la información del token que ya se encuentra en base de datos.

FAIL_USERMISMATCH

La tarjeta de crédito ya se encuentra tokenizada en ecollect, sin embargo, no coinciden los datos del usuario Usermail y/o CardHolderId. No se envía información del token.

FAIL_INVALIDENTITYCODE

EntityCode inválido o no existe.	

FAIL_ACCESSDENIED

autenticación inválida o el Comercio se encuentra Inactivo o bloqueado.	

FAIL_SYSTEM

Requerimiento fallido, se presentó excepción en ecollect al procesar la información.

TokenType
Field	Description
TokenInfoArray

List<PaymentInfoType>

(Opcional) Contiene atributos generados por ecollect para el procesamiento de la transacción.

Las siguientes atributos son enviados para cada token:

TokenId

PaymentSystem (ver PaymentSystem Values)

FiCode

FiName

Usermail

CustomerId

Bin4

Last4

MaskedCard

BrandImageUrl

OneTimePassword. (Opcional) Si se recibe este atributo indica que se debe solicitar al usuario ingresar la clave dinámica enviada a su correo electrónico para continuar con la transacción.

TokenStatus

string

Estado del token en la plataforma ecollect

ACTIVE — Indica que este token está disponible para realizar una transacción

VERIFY — Indica que este token está disponible para realizar una transacción pero requiere verificación mediante clave(s) dinámica(s) enviada(s) en la respuesta

EXPIRED — Indica que este token ha expirado. De acuerdo con esto el Comercio puede presentarle al usuario las opciones de elimnar esta tarjeta o de actualizarla. Ver descripción del servicio TokenCommand

LifetimeSecs

Cantidad de segundos que resta para expirar el TokenId.

PaymentSystem Values
Tabla de los medios de pago definidos en la plataforma ecollect.

FiCode	FiName	Country
0

PSE

Colombia

1

Tarjeta de Crédito

Colombia

3

Tarjeta de Crédito

VISANET Rep. Dominicana

6

Tarjeta de Crédito

CARDNET Rep. Dominicana

7

SPEI - Transferencia interbancaria

México

10

Link de pagos (email, SMS o QR)

Todos

100

Transacciones con pago en caja

Todos

PaymentInfoType
Estructura genérica de ecollect que permite intercambiar información variable con el Comercio en ambos sentidos según el servicio que se esté consumiento.

Field	Description
AttributeCode

integer

Código de atributo ecollect.

AttributeDesc

string

Descripción del atributo.

AttributeValue

string

Valor del atributo.

PaymentInfoType values
de los atributos contemplados en esta API de integración a. En cada servicio de esta API se indican los atributos que son recibidos o enviados por ecollect.

Seguridad: Algunos atributos son utilizados por nuestras herramientas de monitoreo anti-fraude.

AttributeCode	AttributeDesc	AttributeValue
0

CardNumber

Número de la tarjeta de credito.

1

TokenId

Token de la tarjeta de crédito generado por la plataforma ecollect

2

PaymentSystem

Código de medio de pago asignado por ecollect. (ver PaymentSystem Values)

3

SecureCode

Código de verificación al respaldo de la tarjeta CVV2/CVC

4

ExpirationDate

Fecha de expiración de la tarjeta de crédito.
Formato: MM/YYYY

5

Installments

(Colombia) Número de cuotas en las cuales el usuario difiere el pago

6

Usermail

Correo electrónico del usuario que realiza la transacción - Pagador.

7

MobileCountryCode

Código de país del teléfono móvil. Ejemplo:

57 — Colombiano

52 — México

1 — Rep. Dominicana

8

MobileNumber

Número de teléfono móbile del usuario que realiza el pago - Pagador

9

FiCode

Código asignado por ecollect a las marcas de las franquicias

10

FiName

Nombre de la franquicia Ejemplo: VISA, MASTERCARD, AMEX

11

Last4

Últimos 4 digitos de la tarjeta de crédito

12

MaskedCard

Tarjeta de crédito enmascarada Ejemplo: VISA 5404****1234

13

BrandImageUrl

URL pública del logo de la franquicia

14

MerchanId

Código de comercio asignado por la red autorizadora

15

TerminalNumber

Código de terminal asignado por la red autorizadora

16

AuthResponse

Mensaje de respuesta generado por el autorizador

Nota: Este mensaje es para uso interno del Comercio para conocer la causal de rechazo, por seguridad no se recomienda mostrar al usuario.
17

CardHolderName

Nombres y Apellidos del tarjetahabiente - pagador.

18

CardHolderIdType

Tipo de Identificación del usuario que realiza la transacción - pagador.

Colombia:

CC — Cédula de Ciudadanía

NIT — Número de Identificaión Tributario

PP — Pasaporte

CE — Cédula de Extrangería

DE — Documento de Identificación Extranjero

Rep. Dominicana:

CI — Cédula de Identidad

RNC — Registro Nacional de Contribuyente

PP — Pasaporte

México:

CURP — CURP

IFE — IFE

RFC — RFC

PP — Pasaporte

19

CardHolderId

Número de Identificación del usuario que realiza la transacción - pagador.

20

CardIssueCountry

Código de país emisor de la tarjeta de crédito (ISO 3166-1 alfa-2-letter).

21

CardIssueBank

Nombre del banco emisor de la tarjeta.

22

AccountType

Tipo de Tarjeta. 0 = Credit Card (Default) / 1 = Debit Card

23

IPAddress

Dirección IP pública de navegación desde donde se realiza la transacción.

24

DeviceFingerPrint

Identificación única del dispositivo desde donde se origina la transacción.

25

OneTimePassword

Clave dinámica enviada al correo electrónico o al número Móvil del usuario para verificación de la transacción.

26

MerchantTransactionId

Identifica de manera única e irrepetible la transacción del Comercio

28

DevValue

Base de devolución del IVA (Colombia)

29

FailCode

Código de falla detallado cuando en la consulta del servicio getTransactionInformation genera TranState en estado FAILED

30

Bin4

Primeros 4-dígitos de la tarjeta de crédito

34

UserType

Tipo de usuario PSE para ingreso al portal bancario. (Colombia)

0 — Persona Natural

1 — Persona Jurídica

ChannelInfoType
Estructura genérica de ecollect que permite intercambiar información variable de los canales de pago.

Field	Description
AttributeCode

integer

Código de atributo ecollect.

AttributeDesc

string

Descripción del atributo.

AttributeValue

string

Valor del atributo.