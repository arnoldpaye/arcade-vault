# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault: an online platform to play games and compete for the highest score (UI copy is in Spanish). Development follows Spec Driven Design via the `/spec` and `/spec-impl` skills from `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`).

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build (also the type check; there is no separate `tsc` script)
- `npm run lint` — ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript)

No test framework is configured yet.

## Stack and config notes

- Next.js 16.4 App Router (`app/`), React 19.3, TypeScript strict, Tailwind CSS v4.
- Next.js APIs differ from training data: read `node_modules/next/dist/docs/` (`01-app`, `03-architecture`, …) before writing Next code.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback`. With Cache Components on, data fetching/caching follows the `"use cache"` / Suspense model — check the docs before adding dynamic data access.
- Tailwind is wired through a Turbopack loader rule (`@tailwindcss/turbopack` on `*.css`), not PostCSS. Theme tokens live in `app/globals.css` under `@theme inline`.
- Layout props use the generated global type `LayoutProps<"/">` (see `app/layout.tsx`); page props likewise use `PageProps<...>`.
- Path alias `@/*` maps to the repo root.

## `references/` — design prototype

`references/` holds a standalone React 18 + Babel-in-browser prototype (`Arcade Vault.html`) that is the visual/functional reference for the app. It is not part of the Next build. Key pieces:

- `data.jsx` — mock data: `GAMES` (id, title, short/long description, `cat`, cover class, color, best score, plays), `CATS`, `PLAYERS`, `seededScores()`.
- `app.jsx` — hash-based router with screens `biblioteca` (Library), `detalle` (GameDetail), `player` (GamePlayer), `auth` (Auth), `salon` (HallOfFame); user and scores persisted in `localStorage` (`av_user`, `av_scores`).
- `styles.css` — full retro/neon theme (`av-*` classes, CSS variables like `--line`, `--ink-faint`, `--mono`); fonts Press Start 2P, Courier Prime, JetBrains Mono.

When porting a screen, map it to an App Router route and reuse the prototype's data shapes and styling.
