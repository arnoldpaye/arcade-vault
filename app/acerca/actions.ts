"use server";

import { Resend } from "resend";

export type ContactField = "name" | "email" | "msg";

type ContactValues = { name: string; email: string; msg: string };

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | {
      status: "error";
      kind: "validation" | "config" | "send";
      message: string; // texto visible en la terminal de error
      fieldErrors?: Partial<Record<ContactField, string>>;
      values: ContactValues; // para conservar lo escrito
    };

const NAME_MAX = 80;
const EMAIL_MAX = 254;
const MSG_MIN = 10;
const MSG_MAX = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_FROM = "Arcade Vault <onboarding@resend.dev>";

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function validate(v: ContactValues): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {};
  if (!v.name) errors.name = "EL NOMBRE ES OBLIGATORIO";
  else if (v.name.length > NAME_MAX) errors.name = `EL NOMBRE ADMITE COMO MÁXIMO ${NAME_MAX} CARACTERES`;

  if (!v.email) errors.email = "EL CORREO ES OBLIGATORIO";
  else if (v.email.length > EMAIL_MAX || !EMAIL_RE.test(v.email)) errors.email = "EL CORREO NO ES VÁLIDO";

  if (!v.msg) errors.msg = "EL MENSAJE ES OBLIGATORIO";
  else if (v.msg.length < MSG_MIN) errors.msg = `EL MENSAJE NECESITA AL MENOS ${MSG_MIN} CARACTERES`;
  else if (v.msg.length > MSG_MAX) errors.msg = `EL MENSAJE ADMITE COMO MÁXIMO ${MSG_MAX} CARACTERES`;
  return errors;
}

// Escapa & < > " ' antes de interpolar texto del usuario en el HTML del correo.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(v: ContactValues): string {
  const msg = escapeHtml(v.msg).replace(/\n/g, "<br>");
  return `<div style="font-family:monospace;font-size:14px;line-height:1.5;color:#111">
<h2 style="margin:0 0 12px">Nuevo mensaje de contacto · Arcade Vault</h2>
<p style="margin:0"><strong>Nombre:</strong> ${escapeHtml(v.name)}</p>
<p style="margin:0 0 12px"><strong>Correo:</strong> ${escapeHtml(v.email)}</p>
<p style="margin:0"><strong>Mensaje:</strong></p>
<p style="margin:0">${msg}</p>
</div>`;
}

function buildText(v: ContactValues): string {
  return `Nuevo mensaje de contacto · Arcade Vault\n\nNombre: ${v.name}\nCorreo: ${v.email}\n\nMensaje:\n${v.msg}\n`;
}

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const values: ContactValues = {
    name: field(formData, "name"),
    email: field(formData, "email"),
    msg: field(formData, "msg"),
  };

  // Honeypot: un humano nunca rellena "website". Se responde éxito para que el bot
  // no sepa que fue descartado, y no se llama a Resend.
  if (field(formData, "website")) {
    return { status: "success", name: values.name };
  }

  const fieldErrors = validate(values);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      kind: "validation",
      message: "DATOS INVÁLIDOS. REVISA LOS CAMPOS.",
      fieldErrors,
      values,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("[contacto] Falta RESEND_API_KEY o CONTACT_TO_EMAIL");
    return {
      status: "error",
      kind: "config",
      message: "SERVICIO DE CORREO NO CONFIGURADO. INTÉNTALO MÁS TARDE.",
      values,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM,
      to,
      replyTo: values.email,
      subject: `[Arcade Vault] Mensaje de ${values.name}`,
      html: buildHtml(values),
      text: buildText(values),
    });
    if (error) {
      // Solo el código de error: sin nombre, correo ni mensaje del usuario.
      console.error("[contacto] Resend devolvió error:", error.name);
      return {
        status: "error",
        kind: "send",
        message: "NO SE PUDO TRANSMITIR EL MENSAJE. INTÉNTALO DE NUEVO.",
        values,
      };
    }
  } catch (e) {
    console.error("[contacto] Fallo al llamar a Resend:", e instanceof Error ? e.name : "desconocido");
    return {
      status: "error",
      kind: "send",
      message: "NO SE PUDO TRANSMITIR EL MENSAJE. INTÉNTALO DE NUEVO.",
      values,
    };
  }

  return { status: "success", name: values.name };
}
