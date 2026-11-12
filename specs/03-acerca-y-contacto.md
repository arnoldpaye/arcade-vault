# SPEC 03 — Pantalla "Acerca de" en /acerca con contacto por correo vía Resend

> **Estado:** Implementado
> **Depende de:** SPEC 02
> **Fecha:** 2026-11-12
> **Objetivo:** Portar `references/home-about/about.jsx` a la ruta `/acerca` y hacer que su formulario de contacto envíe un correo real al equipo mediante Resend.

---

## Por qué existe esta spec

SPEC 02 dejó el enlace "Acerca de" del nav apuntando a `/acerca`, que hoy muestra el 404 temático.
El tema completo de `references/home-about/styles.css` ya está en `app/globals.css`, incluidas las clases `about-*`, `contact-*` y `terminal-success`.
Falta la pantalla y, a diferencia de las specs anteriores, su formulario deja de ser mock: es la primera funcionalidad con servidor real de la app.

---

## Alcance

**Dentro:**

- Ruta `/acerca`: sección "ACERCA DE ARCADE VAULT" con misión y las tres tarjetas destacadas, divisor pixel animado y sección "CONTÁCTANOS", igual que el prototipo.
- Iconos pixel `HEART`, `BROWSER` y `PLANT` del prototipo.
- Animación `.reveal` reutilizando `components/reveal-observer.tsx` de SPEC 02.
- Formulario de contacto (nombre, correo, mensaje) con el `shake` del prototipo cuando falta un campo.
- Server Action `sendContactMessage` que valida en servidor y envía un correo al equipo con Resend.
- Correo con versión HTML mínima y versión de texto plano, con `replyTo` igual al correo del usuario.
- Campo honeypot oculto `website`: si viene relleno, la action responde éxito sin enviar.
- Estado de envío: botón deshabilitado con el texto "TRANSMITIENDO…".
- Estado de éxito: terminal "VAULT-OS // TERMINAL" con las líneas `[OK]` y "GRACIAS, {NOMBRE}." del prototipo, y botón "ENVIAR OTRO MENSAJE".
- Estado de error: bloque estilo terminal con líneas `[ERROR]` sobre el formulario, conservando lo escrito para reintentar.
- Configuración por variables de entorno (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`) y un `.env.example` versionado.
- Verificación con el MCP de Playwright a 1280 px y 375 px, y envío real con una API key de Resend.

**Fuera de alcance (para specs futuras):**

- Correo de confirmación al remitente.
- Rate limit por IP, captcha o cualquier anti-spam más allá del honeypot.
- Plantillas con React Email.
- Guardar los mensajes en base de datos, `localStorage` o logs.
- Verificación de dominio propio en Resend (se usa `onboarding@resend.dev` por defecto).
- Validación con Zod u otra librería de esquemas.
- Cambios en el nav, el footer u otras pantallas.
- Tests automatizados en el repo.

---

## Modelo de datos

Tipos nuevos en `app/acerca/actions.ts`:

```ts
export type ContactField = "name" | "email" | "msg";

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | {
      status: "error";
      kind: "validation" | "config" | "send";
      message: string;                                  // texto visible en la terminal de error
      fieldErrors?: Partial<Record<ContactField, string>>;
      values: { name: string; email: string; msg: string }; // para conservar lo escrito
    };

export async function sendContactMessage(
  prev: ContactState,
  formData: FormData,
): Promise<ContactState>;
```

Campos del `FormData`: `name`, `email`, `msg`, `website` (honeypot).

Reglas de validación en servidor (tras `trim`):

- `name`: obligatorio, 1–80 caracteres.
- `email`: obligatorio, máximo 254 caracteres, regex simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
- `msg`: obligatorio, 10–2000 caracteres.

Variables de entorno (solo servidor, sin prefijo `NEXT_PUBLIC_`):

| Variable | Obligatoria | Valor por defecto |
| --- | --- | --- |
| `RESEND_API_KEY` | Sí | — |
| `CONTACT_TO_EMAIL` | Sí | — |
| `CONTACT_FROM_EMAIL` | No | `Arcade Vault <onboarding@resend.dev>` |

Correo enviado:

- `subject`: `[Arcade Vault] Mensaje de {nombre}`.
- `replyTo`: el correo del usuario.
- `html` y `text` con nombre, correo y mensaje; el HTML escapa `& < > " '` antes de interpolar.

Convenciones:

- Las tarjetas destacadas son constantes locales de `components/about.tsx`, no se añaden a `lib/data.ts`.
- No se escribe nada en `localStorage` ni en disco.
- Ante fallo de Resend solo se hace `console.error` con el código de error, sin nombre, correo ni mensaje.

---

## Plan de implementación

1. **Dependencia y entorno.** Instalar `resend`. Crear `.env.example` con las tres variables vacías y añadir `!.env.example` a `.gitignore` (hoy `.env*` lo ignora). Verificar: `git status` muestra `.env.example` y `npm run build` pasa.
2. **Iconos.** Crear `components/about-icons.tsx` con `HighlightIcon` (`HEART`, `BROWSER`, `PLANT`), server component portado del prototipo. Verificar: `npm run build` pasa.
3. **Pantalla estática.** Crear `components/about.tsx` (server) con el hero, las tres tarjetas, el divisor de 24 pixeles, la intro de contacto con los tres tips y `<RevealObserver />`. Crear `app/acerca/page.tsx` que renderiza `<About />` con un hueco temporal para el formulario. Verificar: `/acerca` ya no muestra el 404 y coincide con el prototipo salvo el formulario.
4. **Server Action.** Crear `app/acerca/actions.ts` con `"use server"`, los tipos del modelo de datos, la validación, el honeypot y el envío con `new Resend(key).emails.send(...)` instanciado dentro de la action. Sin `RESEND_API_KEY` o `CONTACT_TO_EMAIL` devuelve `kind: "config"`; si Resend devuelve `error` o lanza, devuelve `kind: "send"`. Verificar: `npm run build` pasa.
5. **Formulario cliente.** Crear `components/contact-form.tsx` (`"use client"`) con `useActionState(sendContactMessage, { status: "idle" })`. Campos controlados con los placeholders del prototipo, honeypot oculto (`aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`), validación previa en cliente que solo dispara el `shake` de 400 ms, y botón "TRANSMITIENDO…" mientras `isPending`. Montarlo en `components/about.tsx`. Verificar: el formulario vacío hace `shake` sin llamar al servidor.
6. **Estados de éxito y error.** En `contact-form.tsx`, renderizar la terminal de éxito del prototipo cuando `status === "success"` y la terminal de error con líneas `[ERROR]` cuando `status === "error"`, restaurando `values`. "ENVIAR OTRO MENSAJE" vuelve al formulario vacío. Verificar: sin `.env.local` el envío muestra la terminal de error con los datos intactos.
7. **Lint y build.** Ejecutar `npm run lint` y `npm run build` y corregir lo que aparezca.
8. **Verificación con Playwright MCP y envío real.** Con `npm run dev` y `.env.local` con una API key real, enviar el formulario desde `/acerca` y confirmar el correo en el inbox de `CONTACT_TO_EMAIL` o en el dashboard de Resend. Repetir sin API key para el estado de error. Capturar `/acerca` a 1280 px y 375 px y compararlo con `references/home-about/arcade-vault-standalone.html`. Revisar la consola.

Cada paso deja la app compilando y navegable.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de compilación.
- [ ] `npm run lint` termina sin errores.
- [ ] La salida de `npm run build` marca `/acerca` como estática.
- [ ] `/acerca` muestra el título "ACERCA DE ARCADE VAULT" y el párrafo de misión del prototipo.
- [ ] Se muestran 3 tarjetas destacadas, cada una con su icono pixel y su color (magenta, cyan, green).
- [ ] El divisor muestra 24 pixeles animados.
- [ ] La sección "CONTÁCTANOS" muestra los tips "RESPUESTA EN 24-48H", "SUGERENCIAS BIENVENIDAS" y "SIN SPAM, JAMÁS".
- [ ] El divisor y la sección de contacto reciben la clase `in` al entrar en pantalla.
- [ ] "Acerca de" del nav está activo en `/acerca`.
- [ ] Enviar con algún campo vacío aplica la clase `shake` y no hace ninguna petición al servidor.
- [ ] La action rechaza un correo sin `@` o un mensaje de menos de 10 caracteres con `kind: "validation"`.
- [ ] Mientras se envía, el botón está deshabilitado y muestra "TRANSMITIENDO…".
- [ ] Con API key válida, un envío correcto llega a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de {nombre}`.
- [ ] Responder a ese correo desde el cliente de correo apunta al email que escribió el usuario.
- [ ] Un mensaje con `<script>` en el cuerpo llega al correo como texto escapado, no como HTML.
- [ ] Tras un envío correcto se ve la terminal con "MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE EN MAYÚSCULAS}."
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario con los tres campos vacíos.
- [ ] Sin `RESEND_API_KEY`, enviar muestra la terminal con `[ERROR]` y los tres campos conservan lo escrito.
- [ ] Con el honeypot `website` relleno, la action devuelve éxito y no llama a Resend.
- [ ] `RESEND_API_KEY` no aparece en ningún bundle del cliente (búsqueda en `.next/static`).
- [ ] `.env.example` está versionado y `.env.local` sigue ignorado por git.
- [ ] Con Playwright MCP, `/acerca` carga a 1280 px y 375 px sin errores en consola, incluidos errores de hidratación.
- [ ] Con Playwright MCP, la captura de `/acerca` a 1280 px y 375 px coincide visualmente con la pantalla "Acerca de" de `arcade-vault-standalone.html`.

---

## Decisiones

- **Sí:** Server Action con `useActionState`. Es el patrón nativo de Next 16 para formularios y no expone un endpoint REST extra.
- **No:** Route Handler `app/api/contacto`. Ningún otro cliente lo necesita.
- **Sí:** un solo correo, al equipo, con `replyTo` del usuario. Funciona con `onboarding@resend.dev` sin verificar dominio.
- **No:** acuse de recibo al remitente. Requiere dominio verificado y abre la puerta a usar el formulario para enviar correos a terceros.
- **Sí:** destino y remitente en variables de entorno con `.env.example`. Cambiar de buzón no requiere tocar código.
- **Sí:** instanciar `Resend` dentro de la action. Permite devolver un error controlado si falta la key y no rompe el build.
- **Sí:** HTML mínimo escapado más versión de texto. Sin dependencias y legible en cualquier cliente.
- **No:** React Email. Más dependencias para un correo interno.
- **Sí:** validación manual en servidor y validación previa en cliente solo para el `shake`. El servidor es la fuente de verdad.
- **No:** Zod. Tres campos no justifican la dependencia.
- **Sí:** honeypot que responde éxito. El bot no aprende que fue descartado.
- **No:** rate limit en memoria. No es fiable en despliegues serverless; va en otra spec.
- **Sí:** error en estilo terminal conservando lo escrito. Coherente con la terminal de éxito y el usuario no pierde su mensaje.
- **Sí:** `About` como server component y solo `ContactForm` como client. La página se pre-renderiza estática.
- **Sí:** reutilizar `RevealObserver` de SPEC 02. Ya resuelve la animación `.reveal`.
- **Sí:** tarjetas destacadas como constantes locales. Solo las usa esta pantalla.
- **Sí:** no guardar mensajes ni loguear datos personales. Resend ya conserva el registro de envíos.
- **Sí:** verificación con envío real. Es la única forma de probar la integración con Resend.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Con `onboarding@resend.dev`, Resend solo entrega a la dirección de la cuenta dueña de la API key | `CONTACT_TO_EMAIL` debe ser esa dirección hasta verificar un dominio; se documenta en `.env.example`. |
| `.env*` en `.gitignore` impide versionar `.env.example` | Paso 1 añade `!.env.example`; criterio de aceptación lo comprueba. |
| La API key acaba en el bundle del cliente | Variables sin `NEXT_PUBLIC_`, solo leídas en `actions.ts`; búsqueda en `.next/static` como criterio. |
| Inyección de HTML en el correo a través del mensaje | Escape de `& < > " '` antes de interpolar; criterio con `<script>`. |
| Abuso del formulario para quemar la cuota de Resend | Honeypot en esta spec; rate limit o captcha en una spec futura. |
| La terminal de éxito o error provoca un desajuste de hidratación | El estado inicial es `idle` en servidor y cliente; se revisa la consola en el paso 8. |

---

## Lo que **no** entra en esta spec

- Correo de confirmación al usuario.
- Rate limit, captcha o anti-spam avanzado.
- React Email o plantillas elaboradas.
- Persistencia de mensajes.
- Dominio verificado en Resend.
- Tests automatizados en el repo.

Cada uno de esos puntos, si llega, va en su propia spec.
