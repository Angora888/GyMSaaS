# Hoja de ruta

## Etapa 1 — Identidad y multi-tenancy
- Crear migración inicial de PostgreSQL.
- Registro de dueño + gimnasio en una transacción.
- Usuarios, roles: SuperAdmin, GymOwner, Trainer, Member.
- Password hashing, JWT, renovación, recuperación de acceso.
- GymId determinado por autenticación, nunca por un valor aportado por el cliente.
- Pruebas de aislamiento entre gimnasios.

## Etapa 2 — Operación
- CRUD de miembros y entrenadores.
- Planes y renovaciones; zona horaria America/Costa_Rica.
- Reporte de membresías activas y vencidas.
- Asistencias de entrada y salida sin duplicados.

## Etapa 3 — Cliente
- App web/mobile, ficha del miembro, QR temporal validado en servidor.
- Rutinas, ejercicios, seguimiento de progreso.

## Etapa 4 — SaaS
- Alta y trial de gimnasios, suscripciones y facturación.
- Superadministrador, auditoría, monitoreo y copias de seguridad.
- CI, tests y despliegue Azure + Vercel.
