# SPEC 01 — MVP visual: pantallas del prototipo en el App Router

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-11-09
> **Objetivo:** Portar las cinco pantallas del prototipo de `references/` (biblioteca, detalle, reproductor, acceso y salón de la fama) a rutas del App Router, solo en su parte visual y sin implementar ningún juego.

---

## Por qué existe esta spec

El tema retro/neón ya está portado a `app/globals.css` y las fuentes están en `app/layout.tsx`.
Sin embargo, `app/page.tsx` sigue siendo la plantilla de `create-next-app`.
Esta spec convierte el prototipo navegable de `references/` en la primera versión navegable de la app Next.
Los juegos reales, el backend y la autenticación real quedan para specs posteriores.

---

## Alcance

**Dentro:**

- Datos mock tipados en `lib/data.ts`, portados de `references/data.jsx`.
- Capa de persistencia mock en `lib/storage.ts` sobre `localStorage` (`av_user`, `av_scores`).
- Componentes compartidos `Nav` y `Footer` montados en `app/layout.tsx`, incluido el menú móvil (hamburguesa, backdrop y panel lateral).
- Ruta `/` — Biblioteca: hero, buscador por nombre, chips de categoría, grilla de `GameCard` con efecto tilt y estado "NO HAY RESULTADOS".
- Ruta `/juegos/[id]` — Detalle: portada, tags, descripción larga, stat-strip, acciones y tabla "MEJORES PUNTUACIONES" (10 filas de `seededScores`).
- Ruta `/juegos/[id]/jugar` — Reproductor con arena estática: HUD con puntuación fija en 0, vidas 3 y nivel 01, overlay de pausa, modal "FIN DEL JUEGO" y guardado de la puntuación en `av_scores`.
- Ruta `/acceso` — Acceso: pestañas "INICIAR SESIÓN" / "CREAR CUENTA", formulario mock, "JUGAR COMO INVITADO" y botones sociales decorativos.
- Ruta `/salon` — Salón de la Fama: pestañas por juego (estado de cliente), podio top 3, tabla de 12 filas y fila "TU MEJOR MARCA" si hay usuario.
- `generateStaticParams` en las rutas `/juegos/[id]` y `/juegos/[id]/jugar` con los ids de `GAMES`.
- Página 404 temática `app/not-found.tsx` para ids desconocidos y rutas inexistentes.
- Borrado de los SVG de plantilla en `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).

**Fuera de alcance (para specs futuras):**

- Cualquier juego jugable (lógica, canvas, input de teclado o táctil).
- Contador automático de puntuación del prototipo (`setInterval`) y subida de nivel.
- Autenticación real, validación de formularios, OAuth de Google/GitHub.
- Backend, base de datos o API de puntuaciones.
- Mostrar en el salón o en el detalle las puntuaciones guardadas en `av_scores` (los rankings siguen siendo `seededScores`).
- Contador de créditos funcional (se muestra fijo "CRÉDITOS · 03").
- Menú desplegable de usuario (el botón con el nombre cierra sesión directamente, como en el prototipo).
- Framework de pruebas automatizadas.

---

## Modelo de datos

`lib/data.ts` porta `references/data.jsx` con tipos explícitos y los mismos valores:

```ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type CategoryFilter = "TODOS" | Category;
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;          // slug usado en /juegos/[id]
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;       // clase CSS de portada, p. ej. "cover-bricks"
  color: GameColor;
  best: number;
  plays: string;       // ya formateado, p. ej. "12.4K"
};

export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/2026"

export const GAMES: Game[];               // los 8 juegos del prototipo
export const CATS: CategoryFilter[];      // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: string[];           // los 18 nombres del prototipo
export function seededScores(seed: number, count?: number): ScoreRow[]; // mismo algoritmo, determinista
export function getGame(id: string): Game | undefined;
```

`lib/storage.ts` encapsula `localStorage`:

```ts
export type User = { name: string };      // name en mayúsculas, máx. 10 caracteres
export type SavedScore = { game: string; score: number; name: string; at: number };

// Claves exactas, compatibles con el prototipo
const USER_KEY = "av_user";               // JSON de User o ausente
const SCORES_KEY = "av_scores";           // JSON de SavedScore[]

export function getUser(): User | null;
export function setUser(user: User | null): void;   // null borra la clave
export function saveScore(entry: Omit<SavedScore, "at">): void;
export function useUser(): User | null;   // hook con useSyncExternalStore; null en servidor
```

Convenciones:

- Las semillas de `seededScores` son las del prototipo: detalle `id.length * 17 + 3` con 10 filas, salón `id.length * 23 + 7` con 12 filas.
- Los números se formatean con `toLocaleString("es-ES")`.
- `setUser` emite un evento para que `Nav` y el resto de suscriptores se actualicen sin recargar.
- Toda lectura o escritura de `localStorage` va envuelta en `try/catch`.

---

## Plan de implementación

1. **Datos mock.** Crear `lib/data.ts` con tipos, `GAMES`, `CATS`, `PLAYERS`, `seededScores` y `getGame`. Verificar: `npm run build` pasa.
2. **Persistencia mock.** Crear `lib/storage.ts` con `getUser`, `setUser`, `saveScore` y `useUser`. Verificar: `npm run build` pasa.
3. **Layout compartido.** Crear `components/nav.tsx` (client, con menú móvil y `useUser`) y `components/footer.tsx`. Montarlos en `app/layout.tsx` dentro de `#root`, con `<main className="av-main">` envolviendo `children`. Los enlaces usan `next/link` y el estado activo usa `usePathname` (Biblioteca activa en `/` y `/juegos/*`). Verificar: `npm run dev`, el nav y el footer se ven en `/`.
4. **Biblioteca.** Crear `components/game-card.tsx` (client, tilt) y `components/library.tsx` (client, búsqueda y chips). Reemplazar `app/page.tsx` por la biblioteca. Borrar los SVG de plantilla de `public/`. Verificar: filtrar por texto y categoría funciona; clic en tarjeta navega a `/juegos/[id]`.
5. **404 temático.** Crear `app/not-found.tsx` con estilo neón y botón "VOLVER AL VAULT" hacia `/`. Verificar: `/no-existe` muestra la página.
6. **Detalle.** Crear `app/juegos/[id]/page.tsx` (server component) con `generateStaticParams`, lectura de `params` según la documentación de Next 16 y `notFound()` si `getGame` no encuentra el id. Verificar: `/juegos/caida` se ve igual que el prototipo; `/juegos/xyz` muestra el 404.
7. **Reproductor.** Crear `app/juegos/[id]/jugar/page.tsx` (server, `generateStaticParams` y `notFound()`) que renderiza `components/game-player.tsx` (client). El HUD muestra jugador (`useUser()?.name` o "INVITADO"), puntuación 0, vidas "♥ ♥ ♥" y nivel 01. PAUSA alterna el overlay "EN PAUSA". FIN abre el modal con puntuación 0, input de iniciales (mayúsculas, máx. 10), "GUARDAR PUNTUACIÓN" (llama a `saveScore` y muestra el toast), "JUGAR DE NUEVO" (cierra el modal y reinicia el estado) y "VOLVER AL VAULT". SALIR vuelve a `/juegos/[id]`. Verificar: el flujo completo funciona y `av_scores` contiene la entrada.
8. **Acceso.** Crear `app/acceso/page.tsx` que renderiza `components/auth-form.tsx` (client). Enviar el formulario llama a `setUser({ name })` con el usuario en mayúsculas, máx. 10 caracteres, o "PLAYER1" si está vacío, y navega a `/`. "JUGAR COMO INVITADO" llama a `setUser(null)` y navega a `/`. Verificar: tras entrar, el nav muestra el nombre; clic en el nombre cierra sesión.
9. **Salón de la Fama.** Crear `app/salon/page.tsx` que renderiza `components/hall-of-fame.tsx` (client). Replicar pestañas, podio, tabla y fila "TU MEJOR MARCA" con la misma lógica de `youRank` / `youScore` del prototipo. Verificar: cambiar de pestaña cambia los datos; con usuario aparece la fila amarilla.
10. **Lint y build final.** Ejecutar `npm run lint` y `npm run build` y corregir lo que aparezca.

Cada paso deja la app compilando y navegable.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de compilación.
- [ ] `npm run lint` termina sin errores.
- [ ] `/`, `/juegos/[id]` (los 8 ids), `/juegos/[id]/jugar` (los 8 ids), `/acceso` y `/salon` cargan sin errores en la consola del navegador, incluidos errores de hidratación.
- [ ] La salida de `npm run build` marca `/juegos/[id]` y `/juegos/[id]/jugar` como pre-renderizadas para los 8 ids.
- [ ] Escribir "ser" en el buscador de `/` muestra solo SERPENTINA.
- [ ] Seleccionar el chip "SHOOTER" muestra solo INVASORES y ROCAS.
- [ ] Una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Clic en una tarjeta o en su botón JUGAR navega a `/juegos/[id]` del juego correcto.
- [ ] `/juegos/[id]` muestra exactamente 10 filas en "MEJORES PUNTUACIONES" y los mismos nombres que el prototipo para ese id.
- [ ] "▶ JUGAR AHORA" navega a `/juegos/[id]/jugar`; "VOLVER AL VAULT" navega a `/`.
- [ ] `/juegos/no-existe` y `/juegos/no-existe/jugar` muestran el 404 temático.
- [ ] En el reproductor la puntuación permanece en 0 sin interacción y no existe ningún `setInterval` de puntuación.
- [ ] PAUSA muestra el overlay "EN PAUSA" y el botón pasa a "REANUDAR"; pulsarlo de nuevo lo oculta.
- [ ] FIN abre el modal; "GUARDAR PUNTUACIÓN" añade a `localStorage.av_scores` un objeto `{ game, score: 0, name, at }` y muestra "▸ PUNTUACIÓN GUARDADA_".
- [ ] SALIR navega a `/juegos/[id]`.
- [ ] En `/acceso`, la pestaña "CREAR CUENTA" muestra el campo "Correo electrónico"; "INICIAR SESIÓN" lo oculta.
- [ ] Enviar el formulario con usuario "px_kai" guarda `{"name":"PX_KAI"}` en `localStorage.av_user`, navega a `/` y el nav muestra "PX_KAI ▾".
- [ ] Recargar la página mantiene el usuario en el nav.
- [ ] Clic en "PX_KAI ▾" borra `av_user` y el nav vuelve a mostrar "Iniciar Sesión".
- [ ] En `/salon`, cada pestaña muestra podio con 3 jugadores y tabla con 12 filas.
- [ ] Con usuario, `/salon` muestra la fila "▸ TU MEJOR MARCA EN {TÍTULO}"; sin usuario no aparece.
- [ ] El enlace del nav activo se resalta: "Biblioteca" en `/` y `/juegos/*`, "Salón de la Fama" en `/salon`.
- [ ] Con ancho < 768 px, el botón "≡" abre el panel móvil y clic en el backdrop lo cierra.
- [ ] `public/` ya no contiene `file.svg`, `globe.svg`, `next.svg`, `vercel.svg` ni `window.svg`.

---

## Decisiones

- **Sí:** slugs en español (`/juegos/[id]`, `/juegos/[id]/jugar`, `/acceso`, `/salon`). Coinciden con el idioma de la UI y del proyecto.
- **No:** slugs en inglés ni los nombres del hash router (`/detalle`, `/player`, `/auth`). Mezclan idiomas o arrastran nombres internos del prototipo.
- **Sí:** arena estática con HUD en 0. El MVP es solo visual y no debe simular un juego.
- **No:** el contador automático del prototipo. Daría la falsa impresión de un juego funcionando.
- **No:** placeholder "Próximamente". Perdería la referencia visual del HUD, la pausa y el modal.
- **Sí:** las animaciones CSS decorativas de la arena (`drift` de los enemigos) se mantienen. Vienen de `styles.css` y no son lógica de juego.
- **Sí:** mock de usuario y puntuaciones en `localStorage` con las claves del prototipo (`av_user`, `av_scores`). Permite navegar el flujo completo sin backend.
- **No:** estado solo en memoria (Context). Se pierde al recargar y diverge del prototipo.
- **Sí:** `useSyncExternalStore` en `useUser` con `null` como snapshot de servidor. Evita errores de hidratación y sincroniza el nav tras el login sin recargar.
- **Sí:** pestaña del salón en estado de cliente. Más simple; `/salon` puede pre-renderizarse estática.
- **No:** query param `?juego=id`. Con `cacheComponents` obliga a Suspense por dato dinámico; se puede añadir en otra spec si hace falta compartir enlaces.
- **Sí:** `lib/` y `components/` en la raíz. Encaja con el alias `@/*` y separa datos de rutas.
- **No:** carpetas privadas `app/_components`. Mezclan componentes reutilizables con el árbol de rutas.
- **Sí:** `generateStaticParams` + `notFound()` + `app/not-found.tsx` temático. Ids conocidos en build y error coherente con el tema.
- **No:** redirigir a `/` en id inválido. Oculta errores de enlace.
- **Sí:** pantallas como server components cuando no tienen interacción (detalle), y client components solo donde hay estado o `localStorage`.
- **Sí:** reutilizar las clases `av-*` y las estructuras del prototipo tal cual. El tema ya está portado en `app/globals.css`.
- **Sí:** borrar los SVG de plantilla de `public/`. No se usan tras reemplazar `app/page.tsx`. Se conserva `app/favicon.ico`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Errores de hidratación al leer `localStorage` durante el render | Leer solo vía `useUser` (`useSyncExternalStore` con snapshot de servidor `null`); nunca en el render inicial de un server component. |
| `localStorage` deshabilitado (modo privado) o JSON corrupto | `try/catch` en `lib/storage.ts`; se devuelve `null` / `[]` y la app sigue funcionando sin persistir. |
| APIs de Next 16 distintas a lo conocido (`params` como Promise, `generateStaticParams`, `cacheComponents`) | Leer `node_modules/next/dist/docs/` antes de los pasos 6 y 7, en particular `generate-static-params.md` y `not-found.md`. |
| Estilos del prototipo que dependen de la estructura DOM exacta (`#root`, `.av-main`, footer) | Mantener la misma jerarquía de elementos y clases que `references/app.jsx`. |
| El efecto tilt de `GameCard` manipula `style.transform` directamente | Encapsularlo en un `ref` dentro de un client component, igual que el prototipo. |

---

## Lo que **no** entra en esta spec

- Ningún juego jugable ni simulación de puntuación.
- Autenticación real, validación de formularios ni OAuth.
- Backend o API de puntuaciones.
- Rankings construidos a partir de `av_scores`.
- Créditos funcionales ni menú desplegable de usuario.
- Pruebas automatizadas.

Cada uno de esos puntos, si llega, va en su propia spec.
