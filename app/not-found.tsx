import Link from "next/link";

// 404 temático: ids de juego desconocidos y rutas inexistentes.
export default function NotFound() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">404</h1>
        <div className="sub">
          GAME OVER · ESTA PANTALLA NO EXISTE <span className="blink">_</span>
        </div>
      </section>
      <div style={{ textAlign: "center", padding: "0 16px 64px" }}>
        <p className="mono" style={{ color: "var(--ink-dim)", letterSpacing: "0.12em", marginBottom: 28 }}>
          El cartucho que buscas no está en el vault.
        </p>
        <Link href="/" className="btn lg">
          VOLVER AL VAULT
        </Link>
      </div>
    </div>
  );
}
