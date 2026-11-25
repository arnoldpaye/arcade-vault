"use client"; // Los error boundaries deben ser Client Components.
import Link from "next/link";
import { useEffect } from "react";
// Error de lectura en /juegos y /juegos/[id] (p. ej. Supabase inaccesible). Sin fallback a datos mock.
export default function JuegosError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">SEÑAL PERDIDA</h1>
        <div className="sub">
          NO HAY CONEXIÓN CON EL VAULT <span className="blink">_</span>
        </div>
      </section>
      <div style={{ textAlign: "center", padding: "0 16px 64px" }}>
        <p
          className="mono"
          style={{ color: "var(--ink-dim)", letterSpacing: "0.12em", marginBottom: 28 }}
        >
          No pudimos cargar los cartuchos. Inténtalo de nuevo en unos segundos.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn lg" onClick={() => retry()}>
            REINTENTAR
          </button>
          <Link href="/" className="btn ghost lg">
            IR AL INICIO
          </Link>
        </div>
      </div>
    </div>
  );
}
