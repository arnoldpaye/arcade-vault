"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type MouseEvent } from "react";
import { GameCanvas } from "@/components/game-canvas";
import { formatScore, type Game } from "@/lib/data";
import { GAME_ENGINES } from "@/lib/games";
import type { GameEngine, GameEngineFactory, HudState } from "@/lib/games/types";
import { saveScore, useUser } from "@/lib/storage";
// Juegos sin motor en GAME_ENGINES: arena decorativa con la puntuación fija en 0 (MVP visual).
const INITIAL_HUD: HudState = { score: 0, lives: 3, level: 1, tripleShot: 0 };
/** Quita el foco del botón para que Espacio dispare en el juego y no vuelva a pulsarlo. */
const blurTarget = (e: MouseEvent<HTMLButtonElement>) => e.currentTarget.blur();
export function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const user = useUser();
  // Record<string, …> no marca las claves ausentes como undefined: se tipa explícitamente.
  const factory = GAME_ENGINES[game.id] as GameEngineFactory | undefined;
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [finalScore, setFinalScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  // null = aún no editado: se muestra el usuario actual o "INVITADO".
  const [nameInput, setNameInput] = useState<string | null>(null);
  const name = nameInput ?? user?.name ?? "INVITADO";
  const onGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setSaved(false);
    setOver(true);
  }, []);
  const togglePause = (e: MouseEvent<HTMLButtonElement>) => {
    blurTarget(e);
    if (!factory) return setPaused((p) => !p);
    if (paused) engineRef.current?.resume();
    else engineRef.current?.pause();
  };
  const end = (e: MouseEvent<HTMLButtonElement>) => {
    blurTarget(e);
    if (factory)
      engineRef.current?.end(); // el motor responde con onGameOver
    else onGameOver(0);
  };
  const restart = () => {
    setPaused(false);
    setOver(false);
    setSaved(false);
    engineRef.current?.restart();
  };
  const onSave = () => {
    saveScore({ game: game.id, score: finalScore, name });
    setSaved(true);
  };
  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{formatScore(hud.score)}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(hud.lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(hud.level).padStart(2, "0")}</div>
          </div>
          {hud.tripleShot > 0 && (
            <div className="hud-stat">
              <div className="l">Triple disparo</div>
              <div className="v" style={{ color: "var(--green)" }}>
                3x · {hud.tripleShot.toFixed(1)}s
              </div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={end}>
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>
      <div className="crt">
        <div className="crt-screen">
          {factory ? (
            <GameCanvas
              factory={factory}
              engineRef={engineRef}
              onHud={setHud}
              onPause={setPaused}
              onGameOver={onGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  {factory
                    ? "PULSA REANUDAR, P O ESC PARA CONTINUAR"
                    : "PULSA REANUDAR PARA CONTINUAR"}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>
      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{formatScore(finalScore)}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setNameInput(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={onSave}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/juegos")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
