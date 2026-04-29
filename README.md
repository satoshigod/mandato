# Mandato — Plataforma de finca raíz al revés

Plataforma con modelo de doble suscripción: compradores (free + premium) y brokers (3 tiers, todos pagan).

## 📁 Archivos

```
index.html                  → Landing principal
pricing.html                → Página de planes (compradores + brokers)
signup-comprador.html       → Registro y checkout de compradores
signup-broker.html          → Registro y checkout de brokers
mi-cuenta.html              → Panel del comprador
brokers.html                → Panel del broker (feed según plan)
admin.html                  → Panel admin (solo tú)
config.js                   → Configuración compartida (Supabase + Wompi)
styles.css                  → Estilos compartidos
schema.sql                  → Script SQL para Supabase
```

## 🚀 Setup rápido (en orden)

### 1. Sube los archivos a tu hosting

Sube todos los archivos a la raíz de tu sitio (ej. GitHub Pages, Vercel, Netlify).
**Mantén la estructura plana** — todos los archivos en el mismo nivel.

### 2. Configura Supabase

1. Ve a [supabase.com](https://supabase.com) → tu proyecto
2. **SQL Editor** → New query → pega el contenido de `schema.sql` → Run
3. Verifica que se crearon las tablas: `planes`, `usuarios`, `brokers`, `mandatos`, `ofertas`, `suscripciones`, `pagos`, `broker_mandato_views`
4. **Settings → API** → copia tu **Project URL** y tu **anon public key**

### 3. Configura Wompi

1. Ve a [comercios.wompi.co](https://comercios.wompi.co) → registrarte
2. Sandbox / Producción → **API Keys** → copia tu **llave pública** (`pub_test_...` o `pub_prod_...`)
3. Configura tu URL de redirect: `https://tu-dominio.com/pago-resultado.html` (la página la creas tú o reusa `mi-cuenta.html`)

### 4. Edita `config.js`

Abre `config.js` y reemplaza estas líneas con tus datos:

```javascript
SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...tu-anon-key',
WOMPI_PUBLIC_KEY: 'pub_test_TU_LLAVE_PUBLICA',
WHATSAPP_NUMBER: '573005485019',
ADMIN_PASSWORD: 'CAMBIA_ESTA_PASSWORD_AHORA',
SITE_URL: 'https://tu-dominio.com'
```

### 5. Probar el flujo

Modo **demo (sin Supabase configurado)**: la plataforma funciona con datos locales del navegador. Útil para ver cómo se siente.

Modo **producción**: cuando `config.js` tiene credenciales reales, todo se guarda en Supabase.

## 💰 Modelo de negocio

### Compradores
| Plan | Precio | Mandatos activos | Vigencia |
|------|--------|------------------|----------|
| Free | $0 | 1 | 15 días |
| Premium | $79.000/mes | 5 | 30 días renovable |

### Brokers (todos pagan)
| Plan | Precio | Mandatos visibles | Contacto directo |
|------|--------|-------------------|------------------|
| Básico | $149.000/mes | 10/mes | No |
| Pro | $349.000/mes | Ilimitados | Sí |
| Élite | $799.000/mes | Ilimitados + premium destacados | Sí + API |

## 🔄 Flujo de pago

1. Usuario elige plan en `pricing.html`
2. Va a `signup-comprador.html` o `signup-broker.html` con `?plan=xxx`
3. Llena sus datos en 3 pasos
4. En el paso 3, **se crea registro en Supabase** (`usuarios` o `brokers`) + **suscripción pending** (`suscripciones`)
5. Si el plan tiene precio > 0, abre **widget de Wompi** con el monto
6. Wompi devuelve resultado:
   - **APPROVED** → registra pago en `pagos` + activa suscripción + activa cuenta
   - **DECLINED** → muestra error, usuario puede reintentar
7. Redirige a `mi-cuenta.html` o `brokers.html` con su token único

## 🔐 Seguridad

⚠️ **Importante antes de ir a producción**:

1. **Cambia `ADMIN_PASSWORD`** en `config.js`
2. **Restringe las políticas RLS** en Supabase. Las que están en `schema.sql` son permisivas para que todo funcione rápido. Para producción usa Supabase Auth + JWT.
3. **El admin actualmente usa password en JS** (visible en el código fuente). Para producción, mueve la auth a Supabase Auth.
4. **Verifica los pagos server-side**. El frontend confía en lo que dice Wompi al volver, pero un usuario malicioso puede manipular la respuesta. Para producción, configura un **webhook de Wompi** que verifique el pago en una Edge Function de Supabase.

## 📊 Panel admin

Accede en `admin.html`. Verás:

- **Dashboard**: MRR, compradores, brokers activos, mandatos, pagos del mes
- **Mandatos**: lista filtrable, abre detalle, envía ofertas, cambia estado
- **Compradores**: lista de usuarios con su plan
- **Brokers**: lista de brokers con plan, vencimiento, estado
- **Pagos**: histórico de transacciones Wompi
- **Suscripciones**: histórico de suscripciones activas/canceladas

## 🛠️ Próximos pasos recomendados

1. **Webhook de Wompi** → Edge Function de Supabase que verifica el pago server-side y activa la suscripción de forma confiable
2. **Notificaciones por WhatsApp** → cuando alguien publica un mandato, te llega un WhatsApp automático con el link para responder
3. **Renovación automática** → tarea programada que cobra mensualidad y extiende suscripción
4. **Verificación de identidad** → integración con Truora o Veriff para verificar cédula
5. **Email transaccional** → con Resend, Postmark o SendGrid
6. **Página `pago-resultado.html`** → donde Wompi redirige después del pago

## ❓ FAQ técnico

**¿Por qué no usé un framework?** Pure HTML + vanilla JS para que cualquiera pueda editar y subir a cualquier hosting sin configurar nada. Cuando tengas tracción y necesites más, migra a Next.js o similar.

**¿Por qué Supabase REST API y no la librería?** Para no depender de un CDN ni de un build step. El cliente está en `config.js` y son 30 líneas.

**¿Qué pasa si Wompi falla?** En modo demo, simulación local. En producción, el botón muestra error y el usuario puede reintentar. La suscripción queda en estado `pending` hasta que llegue un pago aprobado.

**¿Puedo cambiar los precios?** Sí, en dos lugares:
1. `schema.sql` (al inicio, en la sección INSERT INTO planes)
2. `pricing.html`, `signup-comprador.html`, `signup-broker.html` (constantes `PLANS` en cada uno)

Idealmente, en producción todos los precios se leen de la tabla `planes` en Supabase.

---

**Soporte**: Si algo no funciona, revisa la consola del navegador (F12) — los errores de Supabase salen ahí con detalles.
