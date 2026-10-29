# Resend — Gym SaaS
El adaptador de correo transaccional está integrado en la API, pero **los enlaces de confirmación y restablecimiento aún no están activos**. No habilitar envío de correos con tokens sin implementar tokens de uso único, expiración y verificación de cuenta.

## Configurar Resend
1. Crear una cuenta en https://resend.com
2. En Domains, agregar un dominio bajo control del negocio (por ejemplo, un subdominio de envíos propio). Verificar los registros DNS requeridos, incluidos SPF y DKIM.
3. En API Keys crear una clave de envío con permisos mínimos.
4. En Azure App Service > Environment variables, agregar:
   - `Resend__ApiKey`: clave secreta, solo Azure.
   - `Resend__From`: remitente de dominio verificado (ejemplo ilustrativo: `Gym SaaS <no-reply@emails.tudominio.com>`).
   - `App__PublicUrl`: `https://gymsaascr.vercel.app` (para construir enlaces absolutos cuando se implemente el flujo).
5. Reiniciar la API para que cargue las variables. Nunca colocar secretos Resend dentro de `VITE_*`, GitHub ni archivos versionados.

## API de correo
Se añadió `ITransactionalEmailSender` y `ResendEmailSender` para enviar correos de texto por HTTPS a `https://api.resend.com/emails`. El servicio solo se utilizará desde endpoints del backend cuando estén listas la verificación de correo y recuperación de contraseña.

## Reglas de seguridad antes de activar
- Generar tokens aleatorios fuertes, almacenar su hash SHA-256 (nunca tokens en claro).
- Duración corta, consumir una vez, bloquear JWT para correos no verificados; migrar cuentas existentes con estrategia segura.
- No revelar existencia de correos en reset. Limitación por cuenta/IP y CAPTCHA server-side.
- No registrar enlaces completos, tokens ni claves en logs.
- Mensajes de error genéricos; emitir correos después de una transacción confirmada y usar reintentos controlados.
- Probar entregabilidad, caducidad, uso repetido y cambio de contraseña en staging.
