// Contrato común entre un motor de juego en canvas y el reproductor React.
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
