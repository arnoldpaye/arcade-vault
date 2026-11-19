// Registro de juegos jugables: si el id de un juego está aquí, el reproductor monta su canvas.
import { createAsteroids } from "./asteroids/engine";
import type { GameEngineFactory } from "./types";
export const GAME_ENGINES: Record<string, GameEngineFactory> = {
  asteroides: createAsteroids,
};
