# SPEC 04 — Conexión con Supabase: librerías y variables de entorno

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-11-16
> **Objetivo:** Instalar las librerías de Supabase, configurar sus variables de entorno y la carpeta `supabase/`, y verificar que el proyecto conecta con el proyecto remoto `yscfrmyruviwjngwipjl`.

---

## Por qué existe esta spec

El proyecto Supabase `yscfrmyruviwjngwipjl` ya está enlazado al MCP (`.mcp.json`), pero el repo no tiene dependencias, variables ni configuración de Supabase.
Esta spec deja solo la base preparada y comprobada.
Los clientes, la autenticación, las tablas y los datos llegan en specs posteriores sobre esta base, igual que Realtime y Edge Functions.

---

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`, y la CLI `supabase` como devDependency.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example`.
- Carpeta `supabase/` inicializada con `supabase init` (`config.toml`) y enlazada al proyecto remoto; sin migraciones todavía.
- Verificación de la conexión con la CLI y con las variables de entorno, sin código de aplicación.

**Fuera de alcance (para specs futuras):**

- Clientes `lib/supabase/client.ts` y `lib/supabase/server.ts`.
- `proxy.ts` y refresco de sesión.
- Supabase Auth: registro, inicio y cierre de sesión, confirmación de correo, cambios en `/acceso`.
- Tablas en `public`, migraciones y datos (perfiles, puntuaciones).
- Tipos generados de la base de datos (`database.types.ts`).
- Retirar `av_user` o `av_scores` de `localStorage`.
- Realtime.
- Edge Functions.
- Supabase local con Docker (`supabase start`).
- Tests automatizados en el repo.

---

## Modelo de datos

Esta feature no introduce estructuras de datos ni tablas.

Variables de entorno nuevas (públicas por diseño, la publishable key no es secreta):

| Variable                               | Obligatoria | Ejemplo                                    |
| -------------------------------------- | ----------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Sí          | `https://yscfrmyruviwjngwipjl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí          | `sb_publishable_…`                         |

Variable ya existente en `.env.local`, usada solo por la CLI y nunca por la app:

| Variable               | Uso                                                                        |
| ---------------------- | -------------------------------------------------------------------------- |
| `SUPABASE_DB_PASSWORD` | Contraseña de la base de datos para `supabase link` y comandos `--linked`. |

Archivos nuevos o modificados:

- `package.json` / `package-lock.json` — tres dependencias nuevas.
- `.env.example` — bloque "Supabase" con las dos variables públicas y `SUPABASE_DB_PASSWORD` vacías y comentadas.
- `.env.local` — valores reales (no versionado).
- `supabase/config.toml` — generado por `supabase init`, con `project_id = "arcade-vault"`.
- `supabase/.gitignore` — generado por `supabase init`; ignora `.temp/` y `.branches/`.

---

## Plan de implementación

1. **Dependencias.** Instalar `@supabase/supabase-js` y `@supabase/ssr` como dependencias y `supabase` como devDependency. Verificar: `npm run build` y `npm run lint` pasan.
2. **Variables de entorno.** Obtener la URL y la publishable key con el MCP (`get_project_url`, `get_publishable_keys`). Añadirlas a `.env.local` y documentar el bloque "Supabase" en `.env.example`. Verificar: `git status` muestra `.env.example` modificado y no muestra `.env.local`.
3. **Carpeta `supabase/`.** Ejecutar `npx supabase init`. Verificar: existe `supabase/config.toml`.
4. **Enlace con el remoto.** Ejecutar `npx supabase login` (lo hace el usuario con `! npx supabase login`) y `npx supabase link --project-ref yscfrmyruviwjngwipjl` usando `SUPABASE_DB_PASSWORD`. Verificar: el comando termina sin errores.
5. **Verificación de la conexión.**
   - Base de datos: `npx supabase migration list --linked` conecta y lista cero migraciones.
   - Variables: `curl` a `$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health` con la cabecera `apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` responde `200`.

Cada paso deja la app compilando y navegable.

---

## Criterios de aceptación

- [ ] `package.json` lista `@supabase/supabase-js` y `@supabase/ssr` en `dependencies` y `supabase` en `devDependencies`.
- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores.
- [ ] `.env.example` contiene `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_DB_PASSWORD`, sin valores.
- [ ] `.env.local` contiene los valores reales y sigue ignorado por git.
- [ ] `supabase/config.toml` está versionado.
- [ ] `supabase/.temp/` no aparece en `git status`.
- [ ] `supabase/migrations/` no existe o está vacía.
- [ ] `npx supabase link --project-ref yscfrmyruviwjngwipjl` termina sin errores.
- [ ] `npx supabase migration list --linked` conecta y no lista migraciones.
- [ ] `GET $NEXT_PUBLIC_SUPABASE_URL/auth/v1/health` con la publishable key responde `200`.
- [ ] MCP `list_tables` sobre `public` sigue devolviendo vacío.
- [ ] Ningún archivo de `app/`, `components/` o `lib/` cambia.

---

## Decisiones

- **Sí:** spec limitada a librerías, variables y CLI. El usuario quiere verificar la conexión antes de construir encima; clientes, Auth y datos van en specs propias.
- **Sí:** proyecto remoto `yscfrmyruviwjngwipjl`. Ya está enlazado al MCP y no requiere Docker.
- **No:** Supabase local con `supabase start`. Añade Docker sin necesidad mientras no haya esquema.
- **Sí:** carpeta `supabase/` versionada desde ahora. Las tablas de specs futuras llegarán como migraciones reproducibles.
- **Sí:** publishable key (`sb_publishable_…`). Es el formato actual de Supabase y sustituye a la anon key JWT.
- **No:** anon key legacy.
- **Sí:** CLI como devDependency. Fija la versión para todo el equipo y se usa con `npx supabase`.
- **Sí:** verificar sin código de aplicación (CLI + `curl` al health de Auth). Prueba la conexión a la base de datos y la validez de las variables sin añadir archivos que la siguiente spec reescribiría.
- **No:** Route Handler `/api/health` ni llamada a `getClaims()`. Requieren los clientes, que están fuera de alcance.
- **No:** tipos generados ahora. Sin tablas en `public` no aportan nada; se generan en la spec que cree la primera tabla.
- **Sí:** instalar `@supabase/ssr` aunque aún no se use. Es la dependencia que usarán los clientes de la siguiente spec.

---

## Riesgos

| Riesgo                                                            | Mitigación                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `supabase link` exige `supabase login` interactivo                | El usuario lo ejecuta con `! npx supabase login` en el paso 4.                          |
| `SUPABASE_DB_PASSWORD` incorrecta o ausente hace fallar el enlace | Se lee de `.env.local`; si falla, se restablece desde el dashboard (Database settings). |
| La carpeta `supabase/.temp/` con datos del enlace acaba en git    | `supabase/.gitignore` generado por `init`; criterio de aceptación lo comprueba.         |
| Confundir `SUPABASE_DB_PASSWORD` con una variable de la app       | Sin prefijo `NEXT_PUBLIC_` y comentada en `.env.example` como "solo CLI".               |

---

## Lo que **no** entra en esta spec

- Clientes de Supabase y `proxy.ts`.
- Supabase Auth.
- Tablas, migraciones, datos y tipos generados.
- Realtime.
- Edge Functions.
- Tests automatizados en el repo.

Cada uno de esos puntos, si llega, va en su propia spec.
