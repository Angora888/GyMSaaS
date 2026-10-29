# Gym SaaS — React

Frontend de administración React + Vite.
```bash
npm install
cp .env.example .env
npm run dev
```
Ajusta `VITE_API_URL` con la URL pública de la API. Solo el URL, nunca contraseñas.

La sesión JWT se mantiene **en memoria**: al recargar la página se requiere volver a iniciar sesión. Esto evita guardar el token en localStorage; antes de producción se recomienda evaluar cookies HttpOnly y un flujo de sesión completo.

El panel está conectado a los endpoints de autenticación y lectura de miembros; otros indicadores son marcadores de posición (—) hasta implementar las funcionalidades en la API.

Para probar funcionalmente hace falta desplegar la API, configurar credenciales seguras y confirmar conectividad real contra Neon.
