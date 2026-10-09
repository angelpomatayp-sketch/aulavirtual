# Aula Norte

MVP de gestión académica basado en el plan de tesis `PA1_Limachi (1).docx`. Integra autenticación por roles, usuarios, cursos, matrículas, asistencia, calificaciones y reportes.

## Cuentas de demostración

| Perfil | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@demo.edu.pe` | `Demo2026!` |
| Docente | `docente@demo.edu.pe` | `Demo2026!` |
| Estudiante | `estudiante@demo.edu.pe` | `Demo2026!` |

Los datos son ficticios y se restauran al reiniciar cuando se utiliza `DATA_MODE=memory`.

El conjunto inicial incluye 7 usuarios (1 administrador, 2 docentes y 4 estudiantes), 4 cursos, 3 secciones, 10 matrículas, sesiones, asistencias, evaluaciones y calificaciones. Todas las cuentas demo usan la contraseña `Demo2026!`.

## Persistencia de los datos demo

- Con `DATA_MODE=memory`, los datos viven únicamente durante la ejecución y vuelven al estado inicial al reiniciar.
- Con `DATA_MODE=mongo`, la primera ejecución sobre una base vacía carga automáticamente el conjunto completo de `server/demoData.js`.
- Después de esa carga inicial, los usuarios y la información creada o editada desde el sistema permanecen en MongoDB y no se reemplazan durante un reinicio o despliegue.
- `npm run seed` reinicia deliberadamente la base al conjunto demo. En producción está bloqueado salvo que se configure temporalmente `ALLOW_DEMO_SEED=yes`; no debe ejecutarse después de empezar a conservar cambios del MVP.

## Ejecución local inmediata

Requiere Node.js 22.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Abrir `http://localhost:5173`. El valor predeterminado `DATA_MODE=memory` permite probar el MVP sin instalar MongoDB.

## Ejecución local con MongoDB

Con Docker Desktop instalado:

```powershell
docker compose up -d
```

Configurar `.env`:

```env
DATA_MODE=mongo
MONGO_URL=mongodb://limachi:limachi_local@localhost:27017/academia_limachi?authSource=admin
JWT_SECRET=un-secreto-local-largo
```

Después ejecutar `npm run seed` y `npm run dev`.

## Verificación

```powershell
npm test
npm run build
npm start
```

El servidor de producción queda disponible en `http://localhost:3000`.

## Despliegue en Railway

1. Subir este directorio a un repositorio GitHub.
2. Crear un proyecto en Railway desde el repositorio.
3. Agregar la plantilla oficial MongoDB al mismo proyecto.
4. Configurar en la aplicación:

```env
NODE_ENV=production
DATA_MODE=mongo
MONGO_URL=${{MongoDB.MONGO_URL}}
JWT_SECRET=<secreto-aleatorio-largo>
```

5. Generar un dominio público únicamente para la aplicación.
6. Mantener MongoDB en la red privada.

En una base de Railway nueva no es necesario ejecutar `npm run seed`: la aplicación detecta que MongoDB está vacío y carga automáticamente todos los usuarios y registros demo. Una vez cargados, MongoDB los conserva.

`railway.toml` configura la compilación, el inicio y el healthcheck `/api/health`.

## Interacción

Los CRUD usan tablas o tarjetas para listar información. Crear, consultar detalles, editar y confirmar bajas se realiza mediante ventanas modales para mantener un patrón uniforme.

## Seguridad incorporada

- Contraseñas almacenadas con bcrypt.
- Sesión HTTP-only y token con expiración.
- Autorización por roles en la API.
- Validación de entradas con Zod.
- Limitación de intentos de inicio de sesión.
- Encabezados de seguridad con Helmet.
- Registro básico de cambios de usuarios y notas.

Este es un MVP para demostración académica. No debe cargarse con información personal real sin completar una revisión de privacidad, respaldo y recuperación.



admin@demo.edu.pe
docente@demo.edu.pe
estudiante@demo.edu.pe
Contraseña: Demo2026!
