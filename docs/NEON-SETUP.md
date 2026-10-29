# Gym SaaS — Neon

- Proyecto: `GymSaaS`
- ID: `delicate-feather-10310543`
- Región: `aws-us-east-2`
- PostgreSQL: 18
- Fecha: 2026-10-29

## Estado actual
Se creó el proyecto en Neon y se verificaron estas ocho tablas:
`Gyms`, `Users`, `Members`, `Plans`, `Subscriptions`, `Attendances`, `Trainers` y `Routines`.

Se aplicó un esquema SQL inicial directamente a la base con claves foráneas compuestas para evitar asociar membresías y asistencias a miembros de otro gimnasio. Los datos existentes no fueron modificados en otros proyectos.

## Configuración de la API
La cadena de conexión y secreto JWT deben configurarse **solo** como secretos del entorno de ejecución:
- `ConnectionStrings__GymDb` (obtener desde Neon)
- `Jwt__Key` (secreto aleatorio fuerte, 32+ bytes)
- `Jwt__Issuer=GymSaaS`
- `Jwt__Audience=GymSaaS.Client`

**No subir ni compartir las credenciales.**

## Importante: migraciones
El esquema inicial fue creado mediante SQL, y **todavía no existe historial de migraciones EF**. No ejecutar `dotnet ef database update` con una migración `Initial` sin antes preparar un baseline o una estrategia de adopción del esquema existente: se producirían conflictos de tablas. Para ambientes nuevos se recomienda consolidar el esquema EF y generar migraciones versionadas y verificadas. Es necesario revisar las restricciones de claves compuestas del modelo EF antes de crear dichas migraciones.

## Antes de producción
- Compilar y probar la API contra una base de desarrollo.
- Habilitar autenticación segura en el frontend, rate limiting y verificación de correo.
- Validar con pruebas automatizadas que un gimnasio no puede acceder a los miembros de otro.
- Implementar flujos de pagos, recuperación de contraseñas y monitoreo.
