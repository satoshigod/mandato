# Mandato v2 — Con autenticación real

Plataforma de finca raíz al revés con login email/password (Supabase Auth).

## 📁 Archivos

```
index.html                  → Landing principal
pricing.html                → Planes (compradores + brokers)
signup-comprador.html       → Registro comprador (con email + password)
signup-broker.html          → Registro broker (con email + password)
login-comprador.html        → ⭐ NUEVO: Login comprador
login-broker.html           → ⭐ NUEVO: Login broker
login-admin.html            → ⭐ NUEVO: Login admin
recuperar.html              → ⭐ NUEVO: Recuperar contraseña
mi-cuenta.html              → Panel comprador (requiere auth)
brokers.html                → Panel broker (requiere auth)
admin.html                  → Panel admin (requiere admin auth)
config.js                   → ⭐ ACTUALIZADO: con cliente Auth
styles.css                  → Estilos compartidos
schema.sql                  → SQL inicial
```

## 🔐 Cómo funciona el auth ahora

**Antes (v1):** login con teléfono, password admin en JS.
**Ahora (v2):** Supabase Auth con email + password. Tres tipos de usuario separados:

1. **Comprador** se registra en `signup-comprador.html` → entra en `login-comprador.html` → panel `mi-cuenta.html`
2. **Broker** se registra en `signup-broker.html` → entra en `login-broker.html` → panel `brokers.html`
3. **Admin** se crea manualmente en Supabase + tabla `admins` → entra en `login-admin.html` → panel `admin.html`

Cada panel verifica que el usuario logueado existe en la tabla correspondiente. Si no, redirige al login que corresponde.

## 🛠️ Setup (si ya hiciste v1)

Si ya tienes Supabase configurado con v1:

1. **Ya hiciste el SQL de auth** en Supabase (las nuevas políticas RLS y tabla `admins`).
2. **Ya te creaste cuenta de admin** en Authentication → Users + insertaste tu UUID en tabla `admins`.
3. **Ya configuraste URL Configuration** con tu Site URL y Redirect URLs.

Solo necesitas:

1. Subir todos los archivos nuevos/actualizados al hosting
2. Verificar que `config.js` tenga tu `SUPABASE_URL` y `SUPABASE_ANON_KEY` (publishable key)
3. Probar el flujo

## 🧪 Probar el flujo

### Como comprador
1. Ve a `/pricing.html` → click "Empezar gratis" en plan Free
2. En `/signup-comprador.html?plan=comprador_free` llena datos + email + password
3. Click "Activar cuenta gratis"
4. Te redirige a `/mi-cuenta.html` (con sesión activa)
5. Cierra sesión → te lleva a `/login-comprador.html`
6. Ingresa email + password → vuelves a tu panel

### Como broker
1. Ve a `/pricing.html?tab=broker` → click "Empezar Pro"
2. En `/signup-broker.html?plan=broker_pro` llena datos + email + password + zonas
3. Click "Pagar" → en modo demo simula pago aprobado
4. Te redirige a `/brokers.html` (con sesión activa)

### Como admin
1. Ve a `/login-admin.html`
2. Ingresa con el email + password que creaste en Supabase Auth
3. Si tu UUID está en tabla `admins`, entras al panel
4. Si no, te rechaza

### Recuperar contraseña
1. Ve a `/login-comprador.html` (o broker)
2. Click "¿Olvidaste tu contraseña?"
3. Ingresa email
4. Te llega un email con link
5. Click en el link → te abre `/recuperar.html` con sesión temporal
6. Pones nueva contraseña → te redirige al login

## ⚠️ Importante

**Limitaciones del email gratuito de Supabase:**
- 3 emails por hora máximo
- Para producción real, configura un SMTP propio (Resend, Postmark, SendGrid)
- Los emails llegan desde `noreply@mail.app.supabase.io` (puede caer en spam)

**Si un email cae en spam:**
- Pídele al usuario que lo busque en spam
- O configura SMTP propio cuando tengas tracción

## 🔄 Diferencias clave con v1

| | v1 | v2 |
|---|---|---|
| Login | Teléfono | Email + password |
| Sesión | sessionStorage | localStorage (persiste) |
| Admin | Password en JS (visible) | Cuenta real en Supabase |
| Recuperar contraseña | No existía | Por email con link |
| Multi-dispositivo | No (solo navegador) | Sí (sesión sigue donde sea) |
| Seguridad | Baja | Alta (passwords hasheados) |

## 🚀 Próximos pasos recomendados

1. **Configurar SMTP propio** para emails profesionales
2. **Wompi en producción** para cobrar de verdad
3. **Webhook de Wompi** para verificar pagos server-side
4. **Notificación a admin por WhatsApp** cuando llega un mandato
5. **Dominio propio** (mandato.com.co) en lugar de github.io
