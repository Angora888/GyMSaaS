# Gym SaaS 🏋️

Plataforma multi-gimnasio independiente de Barbería SaaS.

## Stack
- ASP.NET Core 10 + Entity Framework Core + PostgreSQL (Neon)
- Interfaz web: prototipo HTML responsive; React + Vite es la siguiente etapa
- App móvil futura: Expo + React Native

## Estructura
- `src/GymSaaS.Api`: backend y modelos
- `web`: prototipo visual
- `docs`: estrategia de implementación

## Primer arranque
1. Instalar .NET SDK 10 y PostgreSQL.
2. Definir `ConnectionStrings__GymDb` como variable de entorno.
3. Ejecutar desde `src/GymSaaS.Api`: `dotnet restore && dotnet run`.
4. Salud: `GET /health`.

**Advertencia:** el backend de esta versión es un esqueleto, no un producto listo para producción. No publicar endpoints de miembros o gimnasios sin autenticación y aislamiento multi-tenant. No subir secretos, cadenas de conexión ni credenciales.

## Roadmap
- [x] Repositorio independiente
- [x] Modelo inicial multi-gimnasio
- [x] Diseño de referencia
- [ ] Login y roles con JWT seguros
- [ ] Tenant creado por dueño y autorización estricta
- [ ] Gestión de miembros y membresías
- [ ] Asistencia con QR efímero
- [ ] Gestión de rutinas y entrenadores
- [ ] Pagos y despliegues separados
