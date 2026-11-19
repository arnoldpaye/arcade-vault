"use client";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { GameEngine, GameEngineFactory, GameEvents } from "@/lib/games/types";
type Props = GameEvents & {
  factory: GameEngineFactory;
  /** El padre controla el motor (pausa, fin, reinicio) a través de esta ref. */
  engineRef: RefObject<GameEngine | null>;
};
/** Monta el canvas 800×600 de un juego y gestiona el ciclo de vida de su motor. */
export function GameCanvas({ factory, engineRef, onHud, onPause, onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Callbacks en ref: cambiarlos no recrea el motor ni reinicia la partida.
  const eventsRef = useRef<GameEvents>({ onHud, onPause, onGameOver });
  useLayoutEffect(() => {
    eventsRef.current = { onHud, onPause, onGameOver };
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Un solo motor vivo: Strict Mode monta, limpia y vuelve a montar este efecto.
    const engine = factory(canvas, {
      onHud: (hud) => eventsRef.current.onHud(hud),
      onPause: (paused) => eventsRef.current.onPause(paused),
      onGameOver: (score) => eventsRef.current.onGameOver(score),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [factory, engineRef]);
  return <canvas ref={canvasRef} className="game-canvas" width={800} height={600} />;
}
