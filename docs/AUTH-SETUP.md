# Autenticación — desarrollo inicial
1. Configurar las variables de entorno `ConnectionStrings__GymDb`, `Jwt__Key` (secreto aleatorio de al menos 32 bytes), `Jwt__Issuer=GymSaaS`, `Jwt__Audience=GymSaaS.Client`.
2. Ejecutar `dotnet tool install --global dotnet-ef` (versión 10) y `dotnet ef migrations add Initial --project src/GymSaaS.Api --startup-project src/GymSaaS.Api`, luego `dotnet ef database update --project src/GymSaaS.Api --startup-project src/GymSaaS.Api`.
3. Iniciar API y llamar `POST /api/auth/register` con `gymName, slug, ownerName, email, password` (12+ caracteres).
4. `POST /api/auth/login` devuelve JWT; `GET /api/auth/me` y `GET /api/members` requieren header Authorization: Bearer.
5. El `GymId` para leer miembros se toma del JWT validado, no de la petición.

**Antes de producción:** aplicar rate limiting, verificación de email, restablecimiento de contraseña, revocación de sesiones, auditoría, pruebas multi-tenant y pruebas de integración. No usar JWT en localStorage sin evaluar riesgos de XSS. No desplegar la API públicamente sin estas salvaguardas. Cada propietario debe tener un correo globalmente único (política inicial). Las migraciones aún deben generarse y ejecutarse en la base destino.
