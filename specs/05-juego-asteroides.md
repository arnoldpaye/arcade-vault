# SPEC 05 — Primer juego jugable: Asteroides en el reproductor

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-18
> **Objetivo:** Portar a TypeScript el juego de `references/started-games/02-asteroids/game.js` y montarlo como canvas en `/juegos/asteroides/jugar`, notificando a React la puntuación, las vidas, el nivel y el fin de partida.

---

## Por qué existe esta spec

SPEC 01 dejó el reproductor `/juegos/[id]/jugar` con una arena decorativa y la puntuación fija en 0.
`references/started-games/02-asteroids/` contiene un Asteroides completo en canvas puro (800×600, un solo `game.js` de 510 líneas con globals y listeners en `window`).
Esta spec lo convierte en el primer juego real de la plataforma.
También deja un patrón reutilizable (motor + mapa por id) para Tetris y Arkanoid, que ya esperan en `references/started-games/`.

---

## Alcance

**Dentro:**

- Nueva entrada `asteroides` al final de `GAMES` en `lib/data.ts`; `rocas` se mantiene como juego mock.
- Port de `game.js` a TypeScript estricto en `lib/games/asteroids/`, sin variables globales ni código que toque `window` al importar el módulo.
- Toda la mecánica original: rotación, propulsión con inercia y arrastre, espacio toroidal, disparo con cooldown, asteroides que se parten (3 → 2 → 1), partículas, 3 vidas, invencibilidad con parpadeo al reaparecer, niveles con `3 + nivel` asteroides y power-up de triple disparo.
- Paleta neón del tema con glow (`shadowBlur`) en lugar del trazo blanco original.
- Eliminación del HUD dibujado en canvas (SCORE, NIVEL, vidas, temporizador 3x) y del overlay "GAME OVER".
- Contrato común de motor en `lib/games/types.ts` y registro `GAME_ENGINES` en `lib/games/index.ts`.
- Componente cliente `components/game-canvas.tsx` que crea el motor al montar y lo destruye al desmontar.
- `components/game-player.tsx` usa el motor si el id está en `GAME_ENGINES`; si no, sigue mostrando la arena decorativa.
- HUD React con puntuación, vidas y nivel reales, más un indicador del triple disparo con su tiempo restante.
- Pausa con el botón PAUSA/REANUDAR, con `P` y con `Escape`, y pausa automática al ocultarse la pestaña.
- Botón FIN: termina la partida y abre el modal "FIN DEL JUEGO" con la puntuación actual.
- Fin de partida por vidas: el motor lo notifica y se abre el mismo modal; "GUARDAR PUNTUACIÓN" guarda en `av_scores` como hoy.
- "JUGAR DE NUEVO" reinicia el motor desde cero.
- Solo teclado: flechas y Espacio, con `preventDefault` para que no hagan scroll.
- Verificación con `npm run build`, `npm run lint` y el MCP de Playwright.

**Fuera de alcance (para specs futuras):**

- Controles táctiles o botones en pantalla para móvil.
- Guardar puntuaciones en Supabase o mostrar `av_scores` en el detalle o el salón.
- Portada propia `cover-asteroides` (se reutiliza `cover-rocas`).
- Eliminar o modificar el juego mock `rocas`.
- OVNIs, sonido, música, hiperespacio o cualquier mecánica nueva no presente en `game.js`.
- Ajustes de dificultad o de balance respecto al original.
- Tetris, Arkanoid u otros juegos.
- Tests automatizados en el repo.

---

## Modelo de datos

### Entrada del catálogo (`lib/data.ts`, al final de `GAMES`)

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Pilota tu nave y pulveriza el campo de asteroides.",
  long: "Una nave triangular en un espacio sin bordes: lo que sale por un lado entra por el otro. Rota, propulsa y dispara para partir las rocas grandes en medianas y las medianas en pequeñas. Atrapa el power-up 3x para disparar en abanico.",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

### Contrato de motor (`lib/games/types.ts`)

```ts
export type HudState = {
  score: number;
  lives: number;
  level: number;
  /** Segundos restantes del triple disparo, redondeados a 0.1; 0 = inactivo. */
  tripleShot: number;
};

export type GameEvents = {
  /** Solo se emite cuando cambia algún valor de HudState. */
  onHud: (hud: HudState) => void;
  onPause: (paused: boolean) => void;
  /** Se emite una sola vez por partida. */
  onGameOver: (finalScore: number) => void;
};

export type GameEngine = {
  pause: () => void;
  resume: () => void;
  /** Termina la partida actual y emite onGameOver con la puntuación actual. */
  end: () => void;
  /** Partida nueva: puntuación 0, 3 vidas, nivel 1. */
  restart: () => void;
  /** Cancela el requestAnimationFrame y quita todos los listeners. */
  destroy: () => void;
};

export type GameEngineFactory = (canvas: HTMLCanvasElement, events: GameEvents) => GameEngine;
```

### Registro (`lib/games/index.ts`)

```ts
export const GAME_ENGINES: Record<string, GameEngineFactory> = {
  asteroides: createAsteroids,
};
```

### Estado interno del motor (`lib/games/asteroids/engine.ts`)

Mismo estado que `game.js`, encapsulado en el closure de `createAsteroids` en vez de globals:
`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, `powerUpSpawned`, `killsSinceSpawn`, `keys`, `justPressed`.

```ts
type PlayState = "playing" | "dead" | "gameover";
```

La pausa es un flag `paused: boolean` aparte de `PlayState`.

### Constantes (sin cambios respecto a `game.js`)

- Canvas lógico 800×600; `dt` limitado a 50 ms.
- `RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]`.
- Power-up: probabilidad 0.15, garantizado a las 5 destrucciones, dura 5 s, caduca a los 12 s, apertura 0.18 rad.
- Reaparición a los 2 s; invencibilidad 3 s; colisión nave–asteroide con factor 0.82.

### Paleta neón (constantes en `lib/games/asteroids/entities.ts`, mismos valores que `app/globals.css`)

| Elemento            | Color                                         |
| ------------------- | --------------------------------------------- |
| Fondo               | `#0a0a0f` (`--bg`)                            |
| Nave                | `#00f5ff` (`--cyan`)                          |
| Llama del propulsor | `#ff006e` (`--magenta`)                       |
| Asteroides          | `#e6e9ff` (`--ink`)                           |
| Balas               | `#f5ff00` (`--yellow`)                        |
| Power-up 3x         | `#00ff88` (`--green`)                         |
| Partículas          | `#ff006e` (`--magenta`) con alpha decreciente |

Archivos nuevos o modificados:

- `lib/data.ts` — entrada `asteroides`.
- `lib/games/types.ts` — contrato de motor.
- `lib/games/index.ts` — `GAME_ENGINES`.
- `lib/games/asteroids/entities.ts` — `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, utilidades (`wrap`, `dist`, `rand`, `randInt`), constantes y paleta. Cada clase recibe el `CanvasRenderingContext2D` en `draw(ctx)`.
- `lib/games/asteroids/engine.ts` — `createAsteroids`: estado, input, loop, colisiones, niveles y dibujo.
- `components/game-canvas.tsx` — client component que monta el `<canvas width={800} height={600}>`.
- `components/game-player.tsx` — HUD real y conexión con el motor.
- `app/globals.css` — clase `.game-canvas` (bloque, ancho y alto al 100 % del `crt-screen`).

---

## Plan de implementación

1. **Catálogo.** Añadir la entrada `asteroides` al final de `GAMES`. Verificar: `/juegos` muestra 9 tarjetas, `/juegos/asteroides` muestra el detalle y `/juegos/asteroides/jugar` muestra la arena decorativa.
2. **Contrato y registro.** Crear `lib/games/types.ts` y `lib/games/index.ts` con `GAME_ENGINES` vacío. Verificar: `npm run build` pasa.
3. **Entidades.** Crear `lib/games/asteroids/entities.ts` con las cinco clases, utilidades, constantes y paleta neón portadas a TypeScript. Verificar: `npm run build` pasa.
4. **Motor.** Crear `lib/games/asteroids/engine.ts` con `createAsteroids`. Listeners `keydown`/`keyup` en `window` y `visibilitychange` en `document`, registrados al crear y quitados en `destroy`. Las teclas se ignoran si el foco está en un `input`, `textarea` o elemento editable. `preventDefault` solo para flechas y Espacio con la partida activa. `P` y `Escape` alternan la pausa. Al reanudar se reinicia `lastTime` para que no haya salto. En `gameover` se emite `onGameOver` una vez y se deja de leer el input. Sin HUD ni overlay en canvas. Registrar `asteroides` en `GAME_ENGINES`. Verificar: `npm run build` pasa.
5. **Componente canvas.** Crear `components/game-canvas.tsx` (`"use client"`) que recibe la factory y los callbacks, crea el motor en un `useEffect`, expone el motor al padre (ref) y llama a `destroy` al desmontar. Añadir `.game-canvas` a `app/globals.css`. Verificar: `npm run build` pasa.
6. **Reproductor.** En `components/game-player.tsx`, si `GAME_ENGINES[game.id]` existe, renderizar `GameCanvas` dentro de `crt-screen` en lugar de `game-arena`. Guardar `HudState` en estado React y mostrar puntuación, vidas, nivel y el indicador `3x · N.Ns` cuando `tripleShot > 0`. Conectar PAUSA/REANUDAR, FIN, "JUGAR DE NUEVO" y `onPause`. `onGameOver` abre el modal con la puntuación final y `saveScore` guarda esa puntuación. Los juegos sin motor mantienen el comportamiento actual. Verificar: en `/juegos/asteroides/jugar` se juega y el HUD cambia al destruir asteroides.
7. **Lint y build.** Ejecutar `npm run lint` y `npm run build` y corregir lo que aparezca.
8. **Verificación con Playwright MCP.** Con `npm run dev`, abrir `/juegos/asteroides/jugar` a 1280 px. Mantener flechas y Espacio, comprobar que el HUD cambia, que la página no hace scroll, la pausa por botón, `P` y `Escape`, el modal por FIN y por perder las vidas, el guardado en `av_scores` y "JUGAR DE NUEVO". Navegar a SALIR y comprobar que no quedan errores ni loops activos en consola. Abrir `/juegos/rocas/jugar` y comprobar la arena decorativa.

Cada paso deja la app compilando y navegable.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de compilación.
- [ ] `npm run lint` termina sin errores.
- [ ] La salida de `npm run build` incluye `/juegos/asteroides` y `/juegos/asteroides/jugar` como rutas pre-renderizadas.
- [ ] `/juegos` muestra 9 juegos y la tarjeta "ASTEROIDES" usa la portada `cover-rocas`.
- [ ] `/juegos/rocas/jugar` sigue mostrando la arena decorativa con puntuación 0.
- [ ] `/juegos/asteroides/jugar` muestra un `<canvas>` de 800×600 lógicos que ocupa el `crt-screen`.
- [ ] Al cargar, la partida empieza con 4 asteroides grandes, puntuación 0, 3 vidas y nivel 01 en el HUD React.
- [ ] El canvas no dibuja textos de HUD (SCORE, NIVEL, vidas, temporizador 3x) ni GAME OVER; el único texto es la etiqueta "3x" dentro del rombo del power-up.
- [ ] `←` y `→` rotan la nave, `↑` la propulsa y `Espacio` dispara.
- [ ] Pulsar flechas o Espacio durante la partida no hace scroll de la página.
- [ ] Un objeto que sale por un borde reaparece por el opuesto.
- [ ] Destruir un asteroide grande, mediano y pequeño suma 20, 50 y 100 puntos en el HUD.
- [ ] Un asteroide grande se parte en 2 medianos y uno mediano en 2 pequeños; uno pequeño no se parte.
- [ ] Chocar con un asteroide resta 1 vida en el HUD y la nave reaparece en el centro parpadeando.
- [ ] Destruir todos los asteroides sube el nivel en el HUD y genera `3 + nivel` asteroides grandes.
- [ ] Recoger el power-up muestra en el HUD el indicador 3x con la cuenta atrás desde 5.0 s y dispara 3 balas.
- [ ] Nave, balas, asteroides, power-up y partículas usan los colores de la tabla de paleta neón.
- [ ] PAUSA, `P` y `Escape` congelan el juego y muestran el overlay "EN PAUSA"; REANUDAR, `P` y `Escape` lo reanudan.
- [ ] Cambiar de pestaña pausa el juego y al volver sigue en pausa.
- [ ] FIN abre el modal "FIN DEL JUEGO" con la puntuación actual.
- [ ] Perder la tercera vida abre el modal "FIN DEL JUEGO" con la puntuación final, sin pulsar nada.
- [ ] Escribir iniciales con espacios en el modal no dispara ni mueve la nave.
- [ ] "GUARDAR PUNTUACIÓN" añade a `av_scores` una entrada con `game: "asteroides"` y la puntuación real.
- [ ] "JUGAR DE NUEVO" cierra el modal y empieza una partida con puntuación 0, 3 vidas y nivel 01.
- [ ] Tras pulsar SALIR, el motor no sigue ejecutándose (sin errores en consola y sin `requestAnimationFrame` activo).
- [ ] Ningún archivo de `lib/games/` declara variables globales en `window` ni accede a `window` o `document` al importarse.
- [ ] Con Playwright MCP, `/juegos/asteroides/jugar` carga a 1280 px sin errores en consola, incluidos errores de hidratación.

---

## Decisiones

- **Sí:** nueva entrada `asteroides` y mantener `rocas`. El usuario prefiere no tocar el juego mock existente.
- **No:** reutilizar o renombrar `rocas`. Renombrar rompería URLs y reutilizar mezclaría el mock con el juego real.
- **Sí:** añadir la entrada al final de `GAMES`. No altera el orden actual del catálogo.
- **Sí:** reutilizar `cover-rocas`. Ya representa asteroides; una portada propia va en otra spec.
- **Sí:** `best: 0` y `plays: "0"`. Es un juego nuevo sin historial; los rankings siguen siendo `seededScores`.
- **Sí:** port a TypeScript con factory `createAsteroids(canvas, events)`. Encapsula el estado, permite limpiar listeners y loop al navegar y cumple TypeScript strict.
- **No:** `game.js` tal cual en `public/` con `<Script>`. Usa globals y listeners imposibles de limpiar entre navegaciones del App Router.
- **No:** iframe con `index.html`. Aísla el juego pero impide comunicar el HUD y el fin de partida con React.
- **Sí:** el canvas notifica a React (`onHud`, `onPause`, `onGameOver`) y React pinta HUD, pausa y modal. Un solo HUD coherente con el resto de la plataforma.
- **Sí:** `onHud` solo cuando cambia algo y `tripleShot` redondeado a 0.1 s. Evita re-renderizar React 60 veces por segundo.
- **No:** HUD ni overlay dentro del canvas. Duplicaría la información del HUD React.
- **Sí:** mantener la etiqueta "3x" dentro del rombo del power-up. Identifica el objeto en el campo de juego; no es HUD.
- **Sí:** mapa `GAME_ENGINES` por id. Tetris y Arkanoid se añaden con una línea sin tocar el tipo `Game`.
- **No:** campo `playable` en `Game`. Obliga a tocar todas las entradas y duplica lo que ya indica el registro.
- **Sí:** paleta neón con `shadowBlur`, con los valores de `globals.css` copiados como constantes. El canvas no puede leer variables CSS sin `getComputedStyle` y los colores son fijos.
- **No:** trazo blanco original. Desentona con el tema retro/neón de la plataforma.
- **Sí:** pausa por botón, `P`, `Escape` y `visibilitychange`. Evita perder vidas al cambiar de pestaña.
- **Sí:** listeners de teclado en `window` mientras el motor vive, ignorando eventos de campos de texto. El juego responde sin hacer clic en el canvas y el modal sigue siendo usable.
- **Sí:** se conservan todas las constantes de juego de `game.js`. El objetivo es adaptar, no rediseñar.
- **Sí:** solo teclado. Los controles táctiles amplían bastante el alcance y van en otra spec.
- **Sí:** guardado en `av_scores` (localStorage) con el `saveScore` existente. Supabase para puntuaciones va en su propia spec.
- **Sí:** verificación con Playwright MCP además de build y lint. Es la única forma de comprobar input, HUD y limpieza del loop.

---

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                                                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El loop o los listeners siguen vivos tras navegar y se acumulan             | `destroy` cancela el `requestAnimationFrame` y quita todos los listeners; `GameCanvas` lo llama en el cleanup del `useEffect`; criterio de aceptación tras SALIR. |
| React Strict Mode en desarrollo monta, desmonta y vuelve a montar el efecto | El efecto crea y destruye el motor de forma idempotente; nunca hay dos motores vivos a la vez.                                                                    |
| `onHud` a 60 fps provoca renders excesivos                                  | Emisión solo en cambios y `tripleShot` redondeado a 0.1 s.                                                                                                        |
| `preventDefault` de Espacio rompe escribir en el modal                      | El motor ignora eventos con foco en `input`, `textarea` o elementos editables y deja de leer input en `gameover`.                                                 |
| Salto brusco de `dt` al reanudar tras una pausa larga                       | `lastTime` se reinicia al reanudar; `dt` sigue limitado a 50 ms.                                                                                                  |
| `shadowBlur` en muchas partículas baja los fps                              | Glow solo en nave, balas y power-up; partículas y asteroides con `shadowBlur` bajo o nulo si hace falta.                                                          |
| Desajuste de hidratación al montar el canvas                                | El canvas se renderiza igual en servidor y cliente; el motor solo se crea dentro de `useEffect`.                                                                  |

---

## Lo que **no** entra en esta spec

- Controles táctiles para móvil.
- Puntuaciones en Supabase o rankings con `av_scores`.
- Portada propia para Asteroides.
- Cambios en el juego mock `rocas`.
- Mecánicas nuevas (OVNIs, sonido, hiperespacio) o rebalanceo.
- Tetris, Arkanoid u otros juegos.
- Tests automatizados en el repo.

Cada uno de esos puntos, si llega, va en su propia spec.
