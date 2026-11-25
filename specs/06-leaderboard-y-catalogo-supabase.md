# SPEC 06 — Leaderboard y catálogo de juegos en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-11-24
> **Objetivo:** Crear en Supabase las tablas `games` y `scores` con una vista de leaderboard, hacer que la biblioteca y el detalle lean de ellas y que "GUARDAR PUNTUACIÓN" inserte en `scores` mediante una Server Action.

---

## Por qué existe esta spec

SPEC 04 dejó Supabase instalado y enlazado, pero sin tablas ni clientes.
Hoy el catálogo es la constante `GAMES` de `lib/data.ts`, los rankings salen de `seededScores()` y las puntuaciones se guardan en `av_scores` (localStorage), donde nadie las lee.
Esta spec crea el primer esquema real y conecta dos pantallas y el guardado, de modo que una puntuación guardada aparece en el ranking del detalle.
Todavía no hay Supabase Auth, así que la escritura es anónima y pasa por el servidor.

---

## Alcance

**Dentro:**

- Migración con la tabla `games`, la tabla `scores`, la vista `game_stats` y la vista `leaderboard`, con RLS activado en ambas tablas.
- `supabase/seed.sql` con los 9 juegos de `GAMES` (incluido `asteroides`) y 12 puntuaciones por juego con nombres de `PLAYERS`.
- Aplicación al remoto con `npx supabase db push --include-seed`.
- Tipos generados en `lib/supabase/database.types.ts`.
- Cliente público sin cookies `lib/supabase/public.ts` (publishable key) para lecturas cacheadas.
- Cliente admin `lib/supabase/admin.ts` con `SUPABASE_SECRET_KEY`, protegido con `server-only`.
- Funciones de lectura en `lib/supabase/queries.ts` con `"use cache"` y `cacheTag`.
- `/juegos` (biblioteca) lee el catálogo con `best` y `plays` calculados desde `scores`.
- `/juegos/[id]` (detalle) lee el juego, sus estadísticas y el top 10 desde `leaderboard`; `generateStaticParams` lee de Supabase.
- Server Action `submitScore` en `app/juegos/[id]/jugar/actions.ts` que valida, inserta con el cliente admin e invalida el tag `scores` con `updateTag`.
- Modal "FIN DEL JUEGO": estados "GUARDANDO…", guardado y error con reintento.
- Eliminación de `saveScore` y de la clave `av_scores` en `lib/storage.ts`; `av_user` se mantiene.
- `app/juegos/error.tsx` con mensaje "SEÑAL PERDIDA" y botón REINTENTAR.
- Variable `SUPABASE_SECRET_KEY` documentada en `.env.example`.
- Verificación con `npm run build`, `npm run lint`, el MCP de Supabase y el MCP de Playwright.

**Fuera de alcance (para specs futuras):**

- `/salon` (Salón de la Fama) leyendo de Supabase; sigue con `seededScores()`.
- Inicio `/` (preview de juegos, actividad, top del día) leyendo de Supabase; sigue con datos de `lib/data.ts`.
- `/juegos/[id]/jugar` obteniendo el juego de Supabase; sigue con `getGame()` de `GAMES`.
- Eliminar la constante `GAMES`.
- Supabase Auth, perfiles y asociar puntuaciones a usuarios.
- Rate limit, anti-trampas o verificación de la puntuación en servidor.
- Realtime para refrescar rankings en vivo.
- Migrar puntuaciones antiguas de `av_scores` a Supabase.
- Edición del catálogo desde una UI de administración.
- Tests automatizados en el repo.

---

## Modelo de datos

### Tabla `public.games`

```sql
create table public.games (
  id          text primary key,              -- slug, p. ej. 'asteroides'
  title       text not null,
  short       text not null,
  long        text not null,
  cat         text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover       text not null,                 -- clase CSS, p. ej. 'cover-rocas'
  color       text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  sort_order  int  not null,                 -- orden actual de GAMES
  created_at  timestamptz not null default now()
);
```

`best` y `plays` no son columnas: se calculan desde `scores`.

### Tabla `public.scores`

```sql
create table public.scores (
  id           bigint generated always as identity primary key,
  game_id      text not null references public.games (id) on delete cascade,
  player_name  text not null check (player_name ~ '^[A-Z0-9_ ]{1,10}$'),
  score        int  not null check (score between 0 and 9999999),
  created_at   timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
```

### Vista `public.game_stats`

Una fila por juego, incluidos los que no tienen puntuaciones (`left join`):

| Columna   | Tipo   | Cálculo                   |
| --------- | ------ | ------------------------- |
| `game_id` | text   | `games.id`                |
| `best`    | int    | `coalesce(max(score), 0)` |
| `plays`   | bigint | `count(scores.id)`        |

### Vista `public.leaderboard`

Mejor marca de cada `player_name` por juego.
Empate en puntuación: gana el `created_at` más antiguo.

| Columna       | Tipo        | Notas                                                                          |
| ------------- | ----------- | ------------------------------------------------------------------------------ |
| `game_id`     | text        |                                                                                |
| `player_name` | text        |                                                                                |
| `score`       | int         | mejor puntuación del jugador en ese juego                                      |
| `created_at`  | timestamptz | fecha de esa mejor marca                                                       |
| `rank`        | bigint      | `row_number() over (partition by game_id order by score desc, created_at asc)` |

Ambas vistas se crean con `with (security_invoker = true)`.

### RLS y permisos

| Objeto        | `anon` / `authenticated` | Cliente admin (secret key) |
| ------------- | ------------------------ | -------------------------- |
| `games`       | `select`                 | todo (bypass RLS)          |
| `scores`      | `select`                 | `insert` (bypass RLS)      |
| `game_stats`  | `select`                 | —                          |
| `leaderboard` | `select`                 | —                          |

No hay policies de `insert`, `update` ni `delete` para `anon` ni `authenticated`.

### Seed (`supabase/seed.sql`)

- Los 9 juegos de `GAMES` con su `sort_order` (0–8), `insert … on conflict (id) do nothing`.
- 12 filas por juego en `scores`, con nombres de `PLAYERS` y puntuaciones fijas escritas en el archivo (sin `random()`).
- El bloque de `scores` solo inserta si la tabla está vacía, para no duplicar al reaplicar.

### Variables de entorno

| Variable              | Obligatoria | Uso                                                                      |
| --------------------- | ----------- | ------------------------------------------------------------------------ |
| `SUPABASE_SECRET_KEY` | Sí          | Secret key `sb_secret_…`; solo servidor, la usa `lib/supabase/admin.ts`. |

### Funciones de lectura (`lib/supabase/queries.ts`)

```ts
// "use cache" + cacheTag("games", "scores"); orden por sort_order.
getGames(): Promise<Game[]>;
// "use cache" + cacheTag("games", "scores"); null si no existe.
getGameById(id: string): Promise<Game | null>;
// "use cache" + cacheTag("scores"); filas de leaderboard con rank <= limit.
getLeaderboard(gameId: string, limit = 10): Promise<ScoreRow[]>;
```

Devuelven los tipos existentes `Game` y `ScoreRow` de `lib/data.ts`.
`Game.plays` se formatea con una nueva función `formatPlays(n)` en `lib/data.ts` (`12400` → `"12.4K"`, `12` → `"12"`).
`ScoreRow.date` se formatea como `DD/MM/AAAA` desde `created_at`.

### Server Action (`app/juegos/[id]/jugar/actions.ts`)

```ts
export type SubmitScoreResult = { ok: true } | { ok: false; error: string };

export async function submitScore(input: {
  gameId: string;
  playerName: string;
  score: number;
}): Promise<SubmitScoreResult>;
```

Validación antes de insertar: `gameId` existe en `games`, `playerName` recortado cumple `^[A-Z0-9_ ]{1,10}$`, `score` es entero entre 0 y 9.999.999.
Mensajes de error: `"NOMBRE INVÁLIDO"`, `"PUNTUACIÓN INVÁLIDA"`, `"JUEGO DESCONOCIDO"`, `"NO SE PUDO GUARDAR"`.
Tras insertar con éxito llama a `updateTag("scores")`.

### Archivos nuevos o modificados

- `supabase/migrations/<timestamp>_games_scores.sql` — tablas, índice, vistas, RLS, policies y grants.
- `supabase/seed.sql` — juegos y puntuaciones iniciales.
- `lib/supabase/database.types.ts` — generado con `npx supabase gen types typescript --linked`.
- `lib/supabase/public.ts` — `createClient` de `@supabase/supabase-js` con la publishable key y `persistSession: false`.
- `lib/supabase/admin.ts` — `import "server-only"`; `createClient` con `SUPABASE_SECRET_KEY`.
- `lib/supabase/queries.ts` — `getGames`, `getGameById`, `getLeaderboard`.
- `lib/data.ts` — `formatPlays`; comentario en `GAMES` indicando que solo la usan `/`, `/salon` y `/juegos/[id]/jugar` hasta su migración.
- `lib/storage.ts` — se elimina `saveScore`, `SavedScore` y `SCORES_KEY`.
- `app/juegos/page.tsx` — llama a `getGames()` y pasa `games` a `Library`.
- `components/library.tsx` — recibe `games: Game[]` por props en vez de importar `GAMES`.
- `app/juegos/[id]/page.tsx` — `generateStaticParams` y datos desde `queries.ts`.
- `app/juegos/[id]/jugar/actions.ts` — `submitScore`.
- `components/game-player.tsx` — llama a `submitScore` con estados de guardado y error.
- `app/juegos/error.tsx` — error boundary del segmento `/juegos`.
- `app/globals.css` — estilos del estado de error del modal y de `error.tsx`, si las clases existentes no bastan.
- `.env.example` — `SUPABASE_SECRET_KEY` vacía y comentada como "solo servidor".
- `package.json` — dependencia `server-only` si no está instalada.

---

## Plan de implementación

1. **Variables.** Obtener la secret key del dashboard (Project Settings > API Keys), añadir `SUPABASE_SECRET_KEY` a `.env.local` y documentarla en `.env.example`. Verificar: `git status` muestra `.env.example` y no `.env.local`.
2. **Migración.** Crear `supabase/migrations/<timestamp>_games_scores.sql` con `npx supabase migration new games_scores` y escribir tablas, índice, vistas, RLS, policies y grants. Aplicar con `npx supabase db push`. Verificar: MCP `list_tables` muestra `games` y `scores` con RLS activo.
3. **Seed.** Escribir `supabase/seed.sql` y aplicarlo con `npx supabase db push --include-seed`. Verificar con MCP `execute_sql`: 9 filas en `games`, 108 en `scores`, 9 filas en `game_stats`.
4. **Tipos.** Generar `lib/supabase/database.types.ts`. Verificar: `npm run build` pasa.
5. **Clientes.** Crear `lib/supabase/public.ts` y `lib/supabase/admin.ts` (instalar `server-only` si falta). Verificar: `npm run build` pasa.
6. **Lecturas.** Crear `lib/supabase/queries.ts` y `formatPlays` en `lib/data.ts`. Verificar: `npm run build` pasa.
7. **Biblioteca.** `app/juegos/page.tsx` obtiene `getGames()` y `Library` recibe `games` por props. Verificar: `/juegos` muestra 9 tarjetas con `best` calculado y los filtros siguen funcionando.
8. **Detalle.** `app/juegos/[id]/page.tsx` usa `getGames()` en `generateStaticParams`, `getGameById()` con `notFound()` y `getLeaderboard(id, 10)`. Verificar: `/juegos/asteroides` muestra el top 10 del seed y `/juegos/no-existe` muestra 404.
9. **Error de lectura.** Crear `app/juegos/error.tsx` (`"use client"`) con "SEÑAL PERDIDA" y REINTENTAR (`reset`). Verificar: con `NEXT_PUBLIC_SUPABASE_URL` inválida en `npm run dev`, `/juegos` muestra el error y no datos mock.
10. **Server Action.** Crear `app/juegos/[id]/jugar/actions.ts` con `submitScore`. Verificar: `npm run build` pasa.
11. **Guardado en el modal.** En `components/game-player.tsx`, `onSave` llama a `submitScore` dentro de `useTransition`. Botón "GUARDANDO…" deshabilitado mientras dura; éxito muestra "▸ PUNTUACIÓN GUARDADA_"; error muestra "▸ {error}_" y el botón vuelve a estar activo. Eliminar `saveScore` de `lib/storage.ts`. Verificar: guardar en `/juegos/asteroides/jugar` crea una fila en `scores`.
12. **Lint y build.** Ejecutar `npm run lint` y `npm run build` y corregir lo que aparezca.
13. **Verificación con MCP.** Supabase: `get_advisors` (security) y la comprobación de que `anon` no puede insertar. Playwright con `npm run dev`: biblioteca, detalle, partida de Asteroides, guardado, error de validación y reflejo en el detalle.

Cada paso deja la app compilando y navegable.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de compilación.
- [ ] `npm run lint` termina sin errores.
- [ ] La salida de `npm run build` incluye las 9 rutas `/juegos/[id]` pre-renderizadas.
- [ ] `supabase/migrations/` contiene exactamente una migración nueva y `supabase/seed.sql` existe.
- [ ] MCP `list_tables` sobre `public` muestra `games` y `scores`, ambas con RLS activado.
- [ ] `select count(*) from games` devuelve 9 y `select count(*) from scores` devuelve al menos 108.
- [ ] `game_stats` devuelve una fila por cada uno de los 9 juegos.
- [ ] `leaderboard` no repite `player_name` dentro de un mismo `game_id`.
- [ ] Insertar `player_name = 'abc'` o `score = -1` directamente en SQL falla por `CHECK`.
- [ ] `POST $NEXT_PUBLIC_SUPABASE_URL/rest/v1/scores` con la publishable key es rechazado y no crea filas.
- [ ] `GET $NEXT_PUBLIC_SUPABASE_URL/rest/v1/leaderboard` con la publishable key responde `200` con filas.
- [ ] MCP `get_advisors` (security) no reporta errores sobre `games`, `scores`, `game_stats` ni `leaderboard`.
- [ ] `SUPABASE_SECRET_KEY` solo aparece en `lib/supabase/admin.ts`, `.env.local` y `.env.example` (sin valor).
- [ ] `lib/supabase/admin.ts` importa `server-only`.
- [ ] `components/library.tsx` y `app/juegos/[id]/page.tsx` no importan `GAMES` ni `seededScores`.
- [ ] `/juegos` muestra 9 juegos en el orden de `sort_order` y cada tarjeta muestra el `best` de `game_stats`.
- [ ] Los filtros por categoría y la búsqueda de `/juegos` siguen funcionando.
- [ ] `/juegos/asteroides` muestra "Partidas" y "Mejor global" iguales a `plays` y `best` de `game_stats`.
- [ ] El ranking de `/juegos/asteroides` muestra 10 filas ordenadas por puntuación, con fecha `DD/MM/AAAA`.
- [ ] `/juegos/no-existe` responde con la página 404.
- [ ] Con Supabase inaccesible, `/juegos` muestra "SEÑAL PERDIDA" y el botón REINTENTAR.
- [ ] En el modal, "GUARDAR PUNTUACIÓN" muestra "GUARDANDO…" deshabilitado hasta que responde la Server Action.
- [ ] Guardar con un nombre válido muestra "▸ PUNTUACIÓN GUARDADA_" y crea una fila en `scores` con `game_id = 'asteroides'`, ese nombre y esa puntuación.
- [ ] Guardar con un nombre con `Ñ` o acentos muestra "▸ NOMBRE INVÁLIDO_" y el botón vuelve a estar activo.
- [ ] Tras guardar, "Partidas" de `/juegos/asteroides` sube en 1 sin reiniciar el servidor.
- [ ] Tras guardar una puntuación mayor que el puesto 10, esa puntuación aparece en el ranking de `/juegos/asteroides`.
- [ ] Guardar no crea ni modifica la clave `av_scores` en localStorage.
- [ ] `lib/storage.ts` no exporta `saveScore`.
- [ ] `/salon`, `/` y `/juegos/rocas/jugar` se ven igual que antes de esta spec.
- [ ] Con Playwright MCP, `/juegos` y `/juegos/asteroides` cargan a 1280 px sin errores en consola, incluidos errores de hidratación.

---

## Decisiones

- **Sí:** tablas, clientes y UI en la misma spec. El usuario quiere ver el flujo completo: guardar y ver la puntuación en el ranking.
- **Sí:** tabla `games` como fuente de verdad del catálogo para biblioteca y detalle. Evita dos catálogos que diverjan en las pantallas migradas.
- **Sí:** mantener `GAMES` temporalmente para `/`, `/salon` y `/juegos/[id]/jugar`. Migrarlas ampliaría el alcance; se elimina cuando migren.
- **No:** fallback a `GAMES` si Supabase falla. Ocultaría errores y mezclaría fuentes.
- **Sí:** tabla `scores` con cada partida guardada y vista `leaderboard` con la mejor marca por jugador. No duplica datos y conserva el historial.
- **No:** top de todas las partidas sin agrupar. Un mismo jugador podría llenar el ranking.
- **No:** tabla `leaderboard` con upsert del mejor. Pierde el historial.
- **Sí:** empate resuelto por `created_at` más antiguo. Premia a quien llegó primero, como en un arcade.
- **Sí:** `best` y `plays` calculados en `game_stats`. Reflejan las partidas reales en vez de cifras fijas.
- **No:** columnas `best`/`plays` en `games`. Quedarían desactualizadas al jugar.
- **Sí:** seed con 12 puntuaciones fijas por juego. Las pantallas no arrancan vacías y el resultado es reproducible.
- **Sí:** `best` y `plays` cambian respecto a los valores mock (p. ej. `12.4K` pasa a `12`). Es consecuencia aceptada de calcularlos.
- **Sí:** `seed.sql` + `db push --include-seed`. Separa esquema de datos de ejemplo.
- **No:** datos dentro de una migración. Dejaría datos falsos en el historial de migraciones.
- **Sí:** escritura anónima solo vía Server Action con la secret key. El navegador no puede insertar directamente.
- **No:** policy de `insert` para `anon`. Cualquiera podría insertar con la publishable key sin validación.
- **No:** función RPC `SECURITY DEFINER`. El navegador también podría llamarla.
- **Sí:** validación básica en la Server Action y con `CHECK` en la tabla. Doble barrera sin estado extra.
- **No:** rate limit ni anti-trampas. Requiere estado adicional y va en otra spec si hace falta.
- **Sí:** cliente público sin cookies para lecturas. `"use cache"` no permite leer cookies y los datos son públicos.
- **No:** cliente `@supabase/ssr` con cookies en esta spec. Solo hace falta con Auth.
- **Sí:** `"use cache"` + `cacheTag("games" | "scores")` y `updateTag("scores")` en la Server Action. Mantiene el pre-render y da read-your-own-writes tras guardar.
- **No:** lecturas dinámicas en cada request con Suspense. Pierde el pre-render sin necesidad.
- **Sí:** `av_scores` deja de escribirse. Una sola fuente de puntuaciones; `av_user` sigue igual.
- **No:** migrar las entradas antiguas de `av_scores`. Son locales y de prueba.
- **Sí:** estado "GUARDANDO…", mensaje de error concreto y reintento. El jugador sabe si su puntuación quedó guardada.
- **Sí:** `error.tsx` en `/juegos` con el estilo del tema. Un fallo de red no rompe la app ni muestra datos falsos.
- **Sí:** vistas con `security_invoker = true`. Respetan RLS de las tablas base y evitan el aviso de los advisors.

---

## Riesgos

| Riesgo                                                                            | Mitigación                                                                                                   |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run build` falla sin red o sin variables porque pre-renderiza desde Supabase | Las variables están en `.env.local`; el build documenta que necesita acceso al proyecto remoto.              |
| La secret key llega al bundle del cliente                                         | `import "server-only"` en `admin.ts`; criterio de aceptación sobre dónde aparece la variable.                |
| Reaplicar el seed duplica puntuaciones                                            | `on conflict do nothing` en `games`; el bloque de `scores` solo inserta si la tabla está vacía.              |
| `--include-seed` sobre el remoto afecta datos reales                              | Solo hay datos de esta spec; el seed nunca borra filas.                                                      |
| Un nombre con `Ñ` o acentos pasa el input actual y falla en servidor              | Mensaje "NOMBRE INVÁLIDO" en el modal y reintento; la regex se documenta en la Server Action.                |
| `GAMES` y la tabla `games` divergen mientras conviven                             | El seed se genera a partir de `GAMES`; comentario de deuda en `lib/data.ts`; su eliminación va en otra spec. |
| Insertar puntuaciones falsas llamando a la Server Action a mano                   | Aceptado sin Auth; validación de rango y nombre; anti-trampas fuera de alcance.                              |
| El ranking no se actualiza tras guardar por la caché                              | `updateTag("scores")` en la Server Action; criterio de aceptación de "Partidas" + 1.                         |
| `generateStaticParams` con Cache Components exige al menos un parámetro           | El seed garantiza 9 juegos; si la consulta falla el build falla de forma visible.                            |

---

## Cambios durante la implementación

Desviaciones respecto al texto aprobado, descubiertas al implementar:

- **CLI v3 de Supabase:** `npx supabase db push` apunta por defecto al stack local (Docker). Se usó `npx supabase db push --remote` en el paso 2 y `npx supabase db push --remote --include-seed` en el paso 3. Hizo falta volver a ejecutar `npx supabase link --project-ref yscfrmyruviwjngwipjl`.
- **`error.tsx` en Next 16.4:** el error boundary recibe `retry` en lugar de `reset`. REINTENTAR llama a `retry()`.
- **`export const instant = false`** en `app/juegos/[id]/page.tsx` y `app/juegos/[id]/jugar/page.tsx`. Con `partialPrefetching`, `next dev` mostraba en consola el error "encountered URL data during prerendering" por leer `params` sin `<Suspense>`. El error ya ocurría en `/juegos/[id]/jugar` antes de esta spec. Las 9 rutas de cada página se siguen pre-renderizando.
- **404 del detalle:** `/juegos/no-existe` muestra la página 404, pero responde con HTTP `200`, porque la ruta es de pre-render parcial (◐) y la respuesta se envía por streaming. El criterio pide la página 404, así que se cumple.
- **Seed:** `supabase/seed.sql` se generó a partir de `GAMES` y `seededScores()` de `lib/data.ts`, con la misma semilla que usaba el detalle. Las fechas posteriores a 2026-11-24 se movieron a 2025.
- **Estilos:** se añadió `.toast-error` (magenta, sin animación) y el estilo del botón deshabilitado en `app/globals.css`.
- **Advisors:** `get_advisors` (security) solo reporta `public.rls_auto_enable()`, una función previa a esta spec. No hay avisos sobre `games`, `scores`, `game_stats` ni `leaderboard`.

---

## Lo que **no** entra en esta spec

- Salón de la Fama e inicio leyendo de Supabase.
- Reproductor obteniendo el juego de Supabase.
- Eliminar la constante `GAMES`.
- Supabase Auth y puntuaciones asociadas a usuarios.
- Rate limit y anti-trampas.
- Realtime.
- Migración de `av_scores`.
- UI de administración del catálogo.
- Tests automatizados en el repo.

Cada uno de esos puntos, si llega, va en su propia spec.
