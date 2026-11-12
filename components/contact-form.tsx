"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { sendContactMessage, type ContactState } from "@/app/acerca/actions";

const EMPTY = { name: "", email: "", msg: "" };
const INITIAL_STATE: ContactState = { status: "idle" };
const SHAKE_MS = 400;

// Oculta el honeypot a personas y lectores de pantalla sin usar display:none
// (algunos bots ignoran los campos con display:none).
const HONEYPOT_STYLE = {
  position: "absolute",
  left: "-10000px",
  width: 1,
  height: 1,
  overflow: "hidden",
} as const;

// Variante de error de .terminal-success: mismo layout, borde y texto en magenta.
const ERROR_TERMINAL_STYLE = {
  borderColor: "var(--magenta)",
  boxShadow: "0 0 22px rgba(255,0,110,0.25)",
  marginBottom: 18,
} as const;
const ERROR_LINE_STYLE = { color: "var(--magenta)" } as const;

type ErrorState = Extract<ContactState, { status: "error" }>;

function ErrorTerminal({ state }: { state: ErrorState }) {
  const fieldErrors = Object.values(state.fieldErrors ?? {});
  return (
    <div className="terminal-success" style={ERROR_TERMINAL_STYLE} role="alert">
      <div className="term-bar">
        <span className="dot r"></span>
        <span className="dot y"></span>
        <span className="dot g"></span>
        <span className="term-title">VAULT-OS // TERMINAL</span>
      </div>
      <div className="term-body">
        <div className="line">
          <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
        </div>
        <div className="line" style={ERROR_LINE_STYLE}>
          [ERROR] {state.message}
        </div>
        {fieldErrors.map((err) => (
          <div key={err} className="line" style={ERROR_LINE_STYLE}>
            [ERROR] {err}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessTerminal({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <div className="terminal-success" role="status">
      <div className="term-bar">
        <span className="dot r"></span>
        <span className="dot y"></span>
        <span className="dot g"></span>
        <span className="term-title">VAULT-OS // TERMINAL</span>
      </div>
      <div className="term-body">
        <div className="line">
          <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
        </div>
        <div className="line dim">[OK] Conectando con servidor…</div>
        <div className="line dim">[OK] Validando contenido…</div>
        <div className="line dim">[OK] Transmitiendo paquete…</div>
        <div className="line success">
          &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {name.toUpperCase()}.
          <span className="caret">_</span>
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="btn ghost" type="button" onClick={onReset}>
            ENVIAR OTRO MENSAJE
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(sendContactMessage, INITIAL_STATE);
  const [form, setForm] = useState(EMPTY);
  const [shake, setShake] = useState(false);
  // Resultado que el usuario ya descartó con "ENVIAR OTRO MENSAJE".
  const [dismissed, setDismissed] = useState<ContactState | null>(null);
  // Último resultado procesado, para restaurar lo escrito cuando llega un error.
  const [seen, setSeen] = useState<ContactState>(state);

  if (state !== seen) {
    setSeen(state);
    if (state.status === "error") setForm(state.values);
  }

  const visible = state === dismissed ? INITIAL_STATE : state;

  // Validación previa solo para el "shake" del prototipo: con algún campo vacío
  // no se llama al servidor. La validación real la hace la Server Action.
  // Se envía a mano (sin la prop action) para que React no resetee el formulario.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), SHAKE_MS);
      return;
    }
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  };

  const onReset = () => {
    setDismissed(state);
    setForm(EMPTY);
  };

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit} noValidate>
      {visible.status === "success" ? (
        <SuccessTerminal name={visible.name} onReset={onReset} />
      ) : (
        <>
          {visible.status === "error" && !isPending && <ErrorTerminal state={visible} />}
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MENSAJE</label>
            <textarea
              id="contact-msg"
              name="msg"
              rows={5}
              value={form.msg}
              onChange={(e) => setForm({ ...form, msg: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
            ></textarea>
          </div>

          {/* Honeypot: campo trampa para bots. */}
          <div style={HONEYPOT_STYLE} aria-hidden="true">
            <label htmlFor="contact-website">WEBSITE</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <button
            className="btn xl press"
            type="submit"
            disabled={isPending}
            style={{ width: "100%" }}
          >
            {isPending ? "TRANSMITIENDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      )}
    </form>
  );
}
