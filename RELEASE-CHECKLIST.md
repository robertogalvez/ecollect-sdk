# ecollect SDK — Release Checklist

Ejecutar antes de cada release público. Todos los ítems deben estar marcados.

---

## ✅ Automatizado — CI debe pasar en verde

### Backend SDKs
- [ ] TypeScript CI verde (`ci-typescript.yml`) — cobertura ≥ 90%
- [ ] Python CI verde (`ci-python.yml`) — cobertura ≥ 90%
- [ ] PHP CI verde (`ci-php.yml`) — cobertura ≥ 90%
- [ ] Kotlin CI verde (`ci-kotlin.yml`) — cobertura ≥ 90%
- [ ] Swift CI verde (`ci-swift.yml`) — cobertura ≥ 90%

### UI Packages
- [ ] UI CI verde (`ci-ui.yml`)
  - [ ] ui-core: validators, formatters, brands, security, i18n
  - [ ] ui-react: useCardForm, CardFormMinimal, CardField

---

## 🧪 Manual — Funcional (contra ambiente TEST de ecollect)

### Flujo 1: Solo tokenizar
- [ ] `getSessionToken` → ReturnCode SUCCESS
- [ ] `tokenCommand SAVE` con tarjeta Visa test → retorna TokenId
- [ ] `tokenCommand SAVE` con tarjeta Mastercard → retorna TokenId
- [ ] `tokenCommand SAVE` con tarjeta Amex (CVV 4 dígitos) → retorna TokenId
- [ ] `queryToken` con email+documento → lista tokens guardados
- [ ] `tokenCommand DELETE` → token eliminado, no aparece en queryToken

### Flujo 2: Pago directo (sin token)
- [ ] `createTransactionPayment` con datos de tarjeta directa → ReturnCode SUCCESS
- [ ] Verificar TicketId en respuesta
- [ ] `getTransactionInformation` con TicketId → estado APPROVED

### Flujo 3: Tokenizar + cobrar
- [ ] `tokenCommand SAVE` → obtener TokenId
- [ ] `createTransactionPayment` con TokenId → ReturnCode SUCCESS

### Clientes
- [ ] `getCustomerId` para cliente nuevo → crea y retorna CustomerId
- [ ] `getCustomerId` para cliente existente → retorna mismo CustomerId

### Métodos de pago
- [ ] `getPaymentSystem` → lista sistemas con FiCode y FiName

### Reconciliación
- [ ] `getTransactionInformation` por TicketId → retorna estado correcto

### Error handling
- [ ] Sesión expirada (usar token vencido) → error con mensaje accionable
- [ ] Número de tarjeta inválido → validación local, no llega a la API
- [ ] CVV incorrecto → error de API manejado correctamente

---

## 🎨 Manual — UI / UX (browser, formularios React)

### Brand detection
- [ ] `4111...` → badge Visa aparece desde el primer dígito
- [ ] `5411...` → badge Mastercard
- [ ] `3714...` → badge Amex, CVV cambia a 4 dígitos
- [ ] `6011...` → badge Discover

### Formateo inteligente
- [ ] Número se formatea automáticamente: `4111 1111 1111 1111`
- [ ] Amex se formatea: `3714 496353 98431`
- [ ] Backspace sobre espacio de formato salta al dígito anterior (no borra el espacio)
- [ ] Expiry se formatea: `12 / 26`

### Paste multi-campo
- [ ] Pegar `4111111111111111 05/26 123 John Doe` → distribuye los 4 campos
- [ ] Pegar solo número con espacios `4111 1111 1111 1111` → limpia y formatea

### Validación
- [ ] Errores aparecen SOLO después de blur (no en tiempo real si el campo no fue tocado)
- [ ] Error desaparece INMEDIATAMENTE cuando el campo se vuelve válido (reward early)
- [ ] Error de Luhn: `4111111111111112` → muestra error después de blur
- [ ] Submit con campos vacíos → todos los campos requeridos muestran error

### Accesibilidad (WCAG 2.1 AA)
- [ ] Screen reader anuncia marca al detectarse (`aria-live="polite"`)
- [ ] Campos con error tienen `aria-invalid="true"`
- [ ] Mensajes de error tienen `role="alert"`
- [ ] Error indicado con color + ícono + texto (no solo color — WCAG 1.4.1)
- [ ] Navegación completa por teclado (Tab / Shift+Tab / Enter)

### CVV tooltip
- [ ] Botón `?` junto al CVV abre tooltip
- [ ] Tooltip muestra imagen del reverso (estándar) o frente (Amex)

### Card preview 3D (template Full + Dark)
- [ ] Número enmascarado: `•••• •••• •••• 1234`
- [ ] Flip al enfocar campo CVV
- [ ] Nombre del titular se actualiza en tiempo real

---

## 🔐 Manual — Seguridad

- [ ] DevTools → Application → LocalStorage → **0 datos de tarjeta**
- [ ] DevTools → Application → SessionStorage → **0 datos de tarjeta**
- [ ] DevTools → Console → **0 logs con PAN, CVV o fecha**
- [ ] DevTools → Network → payload del form **NO contiene CVV en claro** (va al proxy)
- [ ] Formulario en HTTP → muestra warning en consola
- [ ] `theme-primary` con valor `"><script>` → no produce XSS (validado como color hex)
- [ ] Paste de `"><img src=x onerror=alert(1)>` en nombre → renderizado como texto, no ejecutado

---

## 📱 Manual — Mobile

- [ ] Chrome DevTools responsive 375px → layout 1 columna correcto
- [ ] iOS Safari (dispositivo real o Simulator) → teclado numérico en campos de tarjeta
- [ ] Touch targets ≥ 44×44px (verificar en DevTools → Lighthouse → Accessibility)
- [ ] Sin hover states como única indicación de estado interactivo

---

## 📦 Pre-publicación a npm / registro

- [ ] Versiones en `package.json` incrementadas correctamente (semver)
- [ ] `CHANGELOG.md` actualizado con cambios del release
- [ ] `README.md` de cada package tiene ejemplos actualizados
- [ ] `peerDependencies` correctas (React ≥17, Angular ≥17, Vue ≥3.3)
- [ ] `sideEffects: false` en todos los ui-* packages
- [ ] Build de producción sin errores: `npm run build --workspace=packages/ui-core`
- [ ] Bundle size ui-html ≤ 30KB gzip (verificar con `size-limit` o `gzip -c dist/index.js | wc -c`)

---

## 🚀 Post-publicación

- [ ] Instalar desde registro y verificar que el import funciona: `import { CardFormMinimal } from '@ecollect/ui-react'`
- [ ] Smoke test en Netlify deploy con credenciales de test
- [ ] Notificar al equipo de QA para pruebas de aceptación con Postman
