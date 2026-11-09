# CLAUDE.md

Este archivo guía a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

@AGENTS.md

## Idioma

El proyecto se desarrolla en español: responde, documenta, escribe comentarios y mensajes de commit en español. Los identificadores de código, comandos y rutas se mantienen tal cual.

## Proyecto

Arcade Vault: una plataforma online para jugar juegos y competir por la puntuación más alta (los textos de la UI están en español). El desarrollo sigue Spec Driven Design mediante los skills `/spec` y `/spec-impl` de `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`).

## Comandos

- `npm run dev` — servidor de desarrollo (Turbopack)
- `npm run build` — build de producción (también hace el chequeo de tipos; no hay un script `tsc` separado)
- `npm run lint` — ESLint 9 con flat config (`eslint-config-next` core-web-vitals + typescript)

Todavía no hay framework de pruebas configurado.

## Stack y notas de configuración

- Next.js 16.4 App Router (`app/`), React 19.3, TypeScript strict, Tailwind CSS v4.
- Las APIs de Next.js difieren de los datos de entrenamiento: lee `node_modules/next/dist/docs/` (`01-app`, `03-architecture`, …) antes de escribir código de Next.
- `next.config.ts` habilita `cacheComponents`, `partialPrefetching` y `experimental.agentFeedback`. Con Cache Components activo, la obtención y el cacheo de datos siguen el modelo `"use cache"` / Suspense — revisa la documentación antes de añadir acceso a datos dinámicos.
- Tailwind se integra mediante una regla de loader de Turbopack (`@tailwindcss/turbopack` sobre `*.css`), no con PostCSS. Los tokens del tema viven en `app/globals.css` bajo `@theme inline`.
- Las props de layout usan el tipo global generado `LayoutProps<"/">` (ver `app/layout.tsx`); las props de página usan igualmente `PageProps<...>`.
- El alias de ruta `@/*` apunta a la raíz del repositorio.

## Skills

Usa `/frontend-design` al crear o rediseñar pantallas y componentes de UI.

## `references/` — prototipo de diseño

`references/` contiene un prototipo independiente en React 18 + Babel en el navegador (`Arcade Vault.html`) que es la referencia visual y funcional de la app. No forma parte del build de Next. Piezas clave:

- `data.jsx` — datos mock: `GAMES` (id, título, descripción corta/larga, `cat`, clase de portada, color, mejor puntuación, partidas), `CATS`, `PLAYERS`, `seededScores()`.
- `app.jsx` — router basado en hash con las pantallas `biblioteca` (Library), `detalle` (GameDetail), `player` (GamePlayer), `auth` (Auth), `salon` (HallOfFame); usuario y puntuaciones persistidos en `localStorage` (`av_user`, `av_scores`).
- `styles.css` — tema retro/neón completo (clases `av-*`, variables CSS como `--line`, `--ink-faint`, `--mono`); fuentes Press Start 2P, Courier Prime, JetBrains Mono.

Al portar una pantalla, asígnala a una ruta del App Router y reutiliza las estructuras de datos y estilos del prototipo.
