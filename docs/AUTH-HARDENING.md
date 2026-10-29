# Gym SaaS — Seguridad de identidad (owner + member)

## Implementado en código
- Claves protegidas con PasswordHasher de ASP.NET Core.
- JWT con issuer, audience, firma y expiración.
- Roles Owner/Member, GymId en claims y consultas de miembros limitadas por tenant.
- Límite por IP de ocho peticiones por minuto en registro e inicio de sesión (aplicado a ambos portales).
- Registros de miembros atómicos en PostgreSQL.

## IMPORTANTE: pendiente antes de admitir usuarios públicos
1. **Confirmación de correo**: agregar EmailVerifiedAt (Users y MemberIdentities), tokens de uso único criptográficamente aleatorios, almacenar únicamente SHA-256, expiración corta, token consumido una sola vez, enlaces distintos para dueño y miembro, y evitar emitir JWT utilizable hasta confirmar. Configurar proveedor transaccional (Resend, SendGrid, Azure Communication Services, etc.) con dominio verificado y credencial *solo* en Azure App Settings. No mostrar tokens en respuestas públicas.
2. **Olvidé contraseña**: respuesta genérica para no revelar cuentas, token de recuperación aleatorio y de un solo uso (guardar hash + expiración), invalidar tokens tras usar, cambiar hash de contraseña, notificar cambio al correo, rate limiting; rutas separadas para dueños y miembros. Recomendable agregar SessionVersion o token de revocación para invalidar JWT anteriores tras reset.
3. **Google OAuth/OIDC**: credencial propia en Google Cloud; usar flujo Authorization Code + PKCE en aplicación web (o Google Identity Services conforme al provider), validar id_token en servidor (iss/aud/exp/firma, nonce), vincular por provider subject (sub), NO confiar solamente en email ni en un token enviado sin validación; identidad de miembro aislada por GymId.
4. **Sign in with Apple**: Apple Developer, Services ID, return URL, private key de cliente almacenada como secreto, validación de identidad Apple en API; Apple puede usar email privado/relay, almacenar proveedor+sub y no basarse en email como clave.
5. **Antibots**: Cloudflare Turnstile o hCaptcha verificado en backend para registro y recuperación; protección de IP y cuenta con backoff/bloqueo temporal; considerar proxies confiables, IP forwarded headers y protección contra abuso distribuido.
6. **Sesión web**: preferir cookie HttpOnly Secure SameSite con CSRF y refresh rotation, en vez de persistir JWT en localStorage. Actualmente el JWT solo vive en memoria y se pierde al refrescar.
7. **Correos**: español, enlaces a https://gymsaascr.vercel.app, SPF/DKIM/DMARC, cola/reintento sin registrar secretos en logs.
8. **Auditoría y QA**: pruebas para duplicados, contraseñas débiles, múltiples gimnasios, reset vencido, intentos masivos y proveedor equivocado.

## Dependencias vulnerables
Hay reportes NU1902/NU1903 sobre System.Security.Cryptography.Pkcs 9.0.0 transitivo. Analizar `dotnet list package --include-transitive --vulnerable`, actualizar el paquete raíz que lo introduce o usar una versión parchada compatible y validar en CI. No silenciar NU190x.

## Estado de implementación
Los pasos 1–8 de la sección pendiente **no están activos**. No presentar Google, Apple, recuperación ni verificación de correo como funcionalidad disponible hasta implementar y probar el flujo real.
