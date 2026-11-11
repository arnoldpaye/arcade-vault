"use client";

import { useRouter } from "next/navigation";
import { useRef, type MouseEvent } from "react";
import { formatScore, type Game } from "@/lib/data";

const BTN_COLOR: Record<Game["color"], string> = {
  cyan: "",
  green: "",
  magenta: "magenta",
  yellow: "yellow",
};

export function GameCard({ game }: { game: Game }) {
  const router = useRouter();
  const tiltRef = useRef<HTMLDivElement>(null);
  const href = `/juegos/${game.id}`;

  // Efecto tilt 3D: se aplica directo al DOM para no re-renderizar en cada mousemove.
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };
  const onLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  };

  return (
    <div
      ref={tiltRef}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => router.push(href)}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover}></div>
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{formatScore(game.best)}</b>
          </div>
          <button
            className={"btn " + BTN_COLOR[game.color]}
            onClick={(e) => {
              e.stopPropagation();
              router.push(href);
            }}
          >
            JUGAR
          </button>
        </div>
      </div>
    </div>
  );
}
