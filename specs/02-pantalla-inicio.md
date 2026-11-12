# SPEC 02 — Pantalla Inicio en "/" y Biblioteca en /juegos

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-11
> **Objetivo:** Portar la landing de `references/home-about/home.jsx` a la ruta `/` y mover la Biblioteca a `/juegos`.

---

## Por qué existe esta spec

En SPEC 01 la Biblioteca ocupa `/`.
El nuevo diseño de `references/home-about/` añade una landing de presentación como puerta de entrada al vault.
Esa landing necesita `/`, así que la Biblioteca se muda a `/juegos` y todos los enlaces que la apuntaban se reasignan.
El diseño también trae la pantalla "Acerca de", que queda para otra spec; aquí solo se añade su enlace en el nav.

---

## Alcance

**Dentro:**

- Reemplazar el cuerpo del tema en `app/globals.css` por el contenido completo de `references/home-about/styles.css`.
- Ruta `/` — Inicio: hero con siluetas flotantes, "¿POR QUÉ ARCADE VAULT?", "JUEGOS DISPONIBLES AHORA", franja de stats, "ACTIVIDAD EN VIVO", "PRECIOS" con FAQ y CTA final.
- Animación de aparición `.reveal` al hacer scroll con `IntersectionObserver`.
- Ruta `/juegos` — Biblioteca: el mismo componente `Library` que hoy vive en `/`.
- Nav: enlaces "Inicio" (`/`), "Biblioteca" (`/juegos`), "Salón de la Fama" (`/salon`) y "Acerca de" (`/acerca`), en escritorio y en el panel móvil.
- Reasignación a `/juegos` de todos los enlaces y redirecciones internas que hoy van a `/`, excepto el logo.
- Copy adaptado al catálogo propio (sin nombres de juegos de terceros, "8+ JUEGOS").
- Verificación visual con el MCP de Playwright de todas las rutas a 1280 px y 375 px.

**Fuera de alcance (para specs futuras):**

- Pantalla "Acerca de" (`about.jsx`), su formulario de contacto y la terminal de éxito. `/acerca` muestra el 404 temático hasta entonces.
- Clases `gp-*` del `styles.css` nuevo (gabinete/gamepad): se portan con el tema pero ningún componente las usa todavía.
- "ACTIVIDAD EN VIVO" con datos reales de `av_scores` o de un backend.
- Contadores reales de juegos o partidas en la franja de stats.
- Cualquier cambio funcional en Biblioteca, Detalle, Reproductor, Acceso o Salón aparte de sus enlaces.
- Pruebas automatizadas con framework (la verificación con Playwright es manual vía MCP, sin tests en el repo).

---

## Modelo de datos

Se añaden constantes estáticas a `lib/data.ts`, copiadas de `references/home-about/home.jsx`. Reutiliza `GAMES` y `GameColor` de SPEC 01.

```ts
export type HomeFeature = {
  icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
  title: string;
  desc: string;
  color: GameColor;
};

export type HomeStat = { n: string; u: string; s: string };

export type ActivityRow = {
  player: string;
  game: string;        // título visible, p. ej. "Caída"
  score: number;
  ago: string;         // ya formateado, p. ej. "hace 2 min"
  color: GameColor;
};

export type TopPlayerRow = { rank: number; player: string; score: number };

export type FaqItem = { q: string; a: string };

export const HOME_FEATURES: HomeFeature[];   // 4 tarjetas
export const HOME_STATS: HomeStat[];         // 3 bloques
export const HOME_ACTIVITY: ActivityRow[];   // 7 filas del ticker
export const HOME_TOP_TODAY: TopPlayerRow[]; // 5 filas
export const HOME_FAQ: FaqItem[];            // 3 preguntas
```

Convenciones:

- Los valores son los del prototipo salvo el copy adaptado:
  - Tarjeta "JUEGOS CLÁSICOS": "Bloque Buster, Caída, Serpentina y muchos más. Los mejores arcades de todos los tiempos en un solo lugar."
  - Primer stat: `{ n: "8+", u: "JUEGOS", s: "Y CONTANDO" }`.
- El rail "JUEGOS DISPONIBLES AHORA" usa `GAMES.slice(0, 6)`; no se crea una constante nueva.
- Los números se formatean con `toLocaleString("es-ES")`, igual que SPEC 01.
- La barra de `HOME_TOP_TODAY` usa `width: (100 - i * 16) + "%"`, igual que el prototipo.
- Inicio no lee ni escribe `localStorage`.

---

## Plan de implementación

1. **Tema completo.** En `app/globals.css`, sustituir el contenido de `@layer base { … }` por `references/home-about/styles.css` íntegro. Conservar la cabecera de imports de Tailwind y el bloque `@theme inline`. Verificar: `npm run build` pasa y `/` (aún Biblioteca) se ve igual que antes.
2. **Biblioteca a `/juegos`.** Crear `app/juegos/page.tsx` que renderiza `<Library />`. Dejar `app/page.tsx` temporalmente igual. Verificar: `/juegos` muestra la Biblioteca y `/juegos/caida` sigue funcionando.
3. **Reasignar enlaces a `/juegos`.** Cambiar a `/juegos`:
   - `components/nav.tsx`: enlace "Biblioteca" de escritorio y del panel móvil (el logo sigue en `/`).
   - `app/juegos/[id]/page.tsx`: "VOLVER AL VAULT".
   - `components/game-player.tsx`: "VOLVER AL VAULT" del modal.
   - `components/hall-of-fame.tsx`: "VOLVER A LA BIBLIOTECA".
   - `app/not-found.tsx`: "VOLVER AL VAULT".
   - `components/auth-form.tsx`: las dos redirecciones tras login e invitado.
   Verificar: `grep` no encuentra `href="/"` ni `push("/")` fuera del logo.
4. **Nav con Inicio y Acerca de.** En `components/nav.tsx`, añadir la sección `"inicio"` (activa solo en `/`) y `"acerca"` (activa en `/acerca`). "Biblioteca" pasa a activa en `/juegos` y `/juegos/*`. Orden de enlaces: Inicio, Biblioteca, Salón de la Fama, Acerca de; el panel móvil añade después "Iniciar Sesión"/"Cuenta". Verificar: el enlace activo cambia al navegar.
5. **Datos de Inicio.** Añadir a `lib/data.ts` los tipos y constantes del modelo de datos. Verificar: `npm run build` pasa.
6. **Iconos y siluetas.** Crear `components/home-icons.tsx` con `FeatureIcon` y `FloatingSilhouettes` (SVG pixel del prototipo, server components). Verificar: `npm run build` pasa.
7. **Reveal.** Crear `components/reveal-observer.tsx` (client) que, en `useEffect`, observa todos los `.reveal` y les añade la clase `in` al entrar en pantalla (`threshold: 0.12`). No renderiza nada. Verificar: `npm run build` pasa.
8. **Pantalla Inicio.** Crear `components/home.tsx` (server) con las siete secciones del prototipo y `<RevealObserver />`. Reemplazar `app/page.tsx` para que renderice `<Home />`. Navegación con `next/link`:
   - "▶ EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" → `/juegos`.
   - "✦ CREAR CUENTA" y "EMPEZAR GRATIS →" → `/acceso`.
   - Cada `MiniCard` → `/juegos/[id]`.
   - "VER SALÓN →" → `/salon`.
   Verificar: `/` se ve como `references/home-about/arcade-vault-standalone.html` y las secciones aparecen al hacer scroll.
9. **Lint y build.** Ejecutar `npm run lint` y `npm run build` y corregir lo que aparezca.
10. **Verificación visual con Playwright MCP.** Con `npm run dev`, capturar `/`, `/juegos`, `/juegos/caida`, `/juegos/caida/jugar`, `/acceso` y `/salon` a 1280 px y 375 px de ancho. Comparar `/` con `arcade-vault-standalone.html` abierto en el mismo ancho. Revisar la consola en cada ruta. Corregir las diferencias encontradas.

Cada paso deja la app compilando y navegable.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de compilación.
- [ ] `npm run lint` termina sin errores.
- [ ] La salida de `npm run build` marca `/` y `/juegos` como estáticas.
- [ ] `/` muestra el hero "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA" con el eyebrow "▸ INSERTA UNA MONEDA_".
- [ ] `/` muestra las secciones "// 01" a "// 04" y "¿LISTO PARA JUGAR?", en ese orden.
- [ ] "¿POR QUÉ ARCADE VAULT?" muestra 4 tarjetas, cada una con su icono pixel.
- [ ] Ningún texto de `/` contiene "Arkanoid", "Tetris" ni "Snake".
- [ ] La franja de stats muestra "8+", "MILES" y "GLOBAL".
- [ ] "JUEGOS DISPONIBLES AHORA" muestra exactamente 6 mini-tarjetas, las 6 primeras de `GAMES`.
- [ ] Clic en una mini-tarjeta navega a `/juegos/[id]` del juego correcto.
- [ ] "ÚLTIMAS PUNTUACIONES" muestra 7 filas y "TOP JUGADORES · HOY" muestra 5.
- [ ] "▶ EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" navegan a `/juegos`.
- [ ] "✦ CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/acceso`.
- [ ] "VER SALÓN →" navega a `/salon`.
- [ ] Las secciones con `.reveal` reciben la clase `in` al entrar en pantalla y se vuelven visibles.
- [ ] `/juegos` muestra la Biblioteca con buscador, chips y las 8 tarjetas.
- [ ] El nav muestra, en este orden, "Inicio", "Biblioteca", "Salón de la Fama" y "Acerca de".
- [ ] "Inicio" está activo solo en `/`; "Biblioteca" está activo en `/juegos` y `/juegos/*`.
- [ ] "Acerca de" navega a `/acerca`, que muestra el 404 temático.
- [ ] El logo navega a `/`.
- [ ] "VOLVER AL VAULT" del detalle, del modal del reproductor y del 404 navega a `/juegos`.
- [ ] "VOLVER A LA BIBLIOTECA" del salón navega a `/juegos`.
- [ ] Enviar el formulario de `/acceso` o pulsar "JUGAR COMO INVITADO" navega a `/juegos`.
- [ ] El panel móvil (< 768 px) muestra los cuatro enlaces más "Iniciar Sesión"/"Cuenta".
- [ ] Con Playwright MCP, `/`, `/juegos`, `/juegos/caida`, `/juegos/caida/jugar`, `/acceso` y `/salon` cargan a 1280 px y 375 px sin errores en consola, incluidos errores de hidratación.
- [ ] Con Playwright MCP, la captura de `/` a 1280 px y 375 px coincide visualmente con `arcade-vault-standalone.html` (salvo el copy adaptado).
- [ ] Con Playwright MCP, las capturas de las rutas de SPEC 01 no muestran regresiones visuales tras el cambio de tema.

---

## Decisiones

- **Sí:** Biblioteca en `/juegos`. Agrupa listado y detalle bajo el mismo prefijo (`/juegos`, `/juegos/[id]`).
- **No:** `/biblioteca`. Rompería la jerarquía con `/juegos/[id]`.
- **Sí:** todos los enlaces que iban a `/` pasan a `/juegos`, incluidos "VOLVER AL VAULT" y las redirecciones de login. Conserva el comportamiento de SPEC 01: volver siempre lleva al listado de juegos.
- **Sí:** el logo sigue en `/`. Es la convención de cualquier web y lleva a la nueva landing.
- **Sí:** enlace "Acerca de" a `/acerca` ya en esta spec. Deja el nav con su forma final del diseño.
- **No:** la pantalla "Acerca de" en esta spec. Tiene formulario y estados propios; va en su propia spec.
- **No:** `/acerca-de` ni `/nosotros`. `/acerca` es corto y en español como `/salon` y `/acceso`.
- **Sí:** reemplazar el tema completo por `references/home-about/styles.css`. Es un superconjunto del anterior (no elimina reglas), así que no rompe pantallas ya portadas.
- **No:** portar solo las clases de Inicio. Obligaría a otro port parcial en la spec de Acerca de.
- **Sí:** conservar la cabecera de Tailwind y `@theme inline` en `app/globals.css`. Son configuración del proyecto, no parte del prototipo.
- **Sí:** datos de Inicio fijos en `lib/data.ts`, como el prototipo. La página queda estática y sin `localStorage`.
- **No:** derivarlos de `seededScores` ni de `av_scores`. Más lógica sin cambio visual; los datos reales van en otra spec.
- **Sí:** copy adaptado al catálogo propio y "8+ JUEGOS". No cita marcas de terceros ni promete juegos que no existen.
- **No:** copy literal del prototipo.
- **Sí:** `Home` como server component y un `RevealObserver` client mínimo. Solo la animación necesita el DOM; el resto se pre-renderiza.
- **Sí:** `MiniCard` y botones como `next/link` en lugar de `div` con `onClick`. Navegación accesible y con prefetch.
- **Sí:** verificación visual con el MCP de Playwright en todas las rutas a 1280 px y 375 px. El cambio de tema afecta a toda la app.
- **No:** tests de Playwright en el repo. No hay framework de pruebas configurado; queda para otra spec.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El tema nuevo cambia reglas compartidas y altera pantallas de SPEC 01 | Verificado que el `styles.css` nuevo no elimina líneas del anterior; además, capturas con Playwright de todas las rutas en el paso 10. |
| Las secciones `.reveal` quedan invisibles si el observer no corre (JS deshabilitado o fallo de hidratación) | `RevealObserver` se monta en la misma página; se comprueba en el paso 10 que todas las secciones llegan a tener la clase `in`. |
| Enlaces olvidados que siguen apuntando a `/` como Biblioteca | Búsqueda con `grep` de `href="/"` y `push("/")` en el paso 3. |
| `/juegos/page.tsx` convive con `/juegos/[id]` | Rutas estáticas tienen prioridad sobre dinámicas en el App Router; se verifica en el paso 2. |
| Las animaciones de siluetas y `pulse` afectan al rendimiento en móvil | Son CSS puras del prototipo; se revisa la fluidez en la captura a 375 px. |

---

## Lo que **no** entra en esta spec

- Pantalla "Acerca de" y formulario de contacto.
- Uso de las clases `gp-*`.
- Actividad, rankings o contadores con datos reales.
- Cambios funcionales en las pantallas de SPEC 01.
- Tests automatizados en el repo.

Cada uno de esos puntos, si llega, va en su propia spec.
