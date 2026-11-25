-- SPEC 06: catálogo de juegos, puntuaciones y vistas de leaderboard.

-- ===== Tablas =====

create table public.games (
  id          text primary key,              -- slug, p. ej. 'asteroides'
  title       text not null,
  short       text not null,
  long        text not null,
  cat         text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover       text not null,                 -- clase CSS, p. ej. 'cover-rocas'
  color       text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  sort_order  int  not null,                 -- orden de GAMES en lib/data.ts
  created_at  timestamptz not null default now()
);

create table public.scores (
  id           bigint generated always as identity primary key,
  game_id      text not null references public.games (id) on delete cascade,
  player_name  text not null check (player_name ~ '^[A-Z0-9_ ]{1,10}$'),
  score        int  not null check (score between 0 and 9999999),
  created_at   timestamptz not null default now()
);

-- Cubre el ranking por juego (score desc, empate por created_at) y la FK game_id.
create index scores_game_score_idx on public.scores (game_id, score desc, created_at);

-- ===== RLS =====
-- Solo lectura pública. Sin policies de insert/update/delete: la escritura
-- se hace desde la Server Action con la secret key, que salta RLS.

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games: lectura pública"
  on public.games for select
  to anon, authenticated
  using (true);

create policy "scores: lectura pública"
  on public.scores for select
  to anon, authenticated
  using (true);

-- ===== Vistas =====
-- security_invoker: las vistas aplican la RLS de las tablas base con el rol que consulta.

create view public.game_stats
with (security_invoker = true) as
select
  g.id                               as game_id,
  coalesce(max(s.score), 0)::int     as best,
  count(s.id)                        as plays
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

-- Mejor marca de cada jugador por juego; empate en puntuación: gana la más antigua.
create view public.leaderboard
with (security_invoker = true) as
with best_per_player as (
  select distinct on (s.game_id, s.player_name)
    s.game_id,
    s.player_name,
    s.score,
    s.created_at
  from public.scores s
  order by s.game_id, s.player_name, s.score desc, s.created_at asc
)
select
  b.game_id,
  b.player_name,
  b.score,
  b.created_at,
  row_number() over (partition by b.game_id order by b.score desc, b.created_at asc) as rank
from best_per_player b;

-- ===== Permisos =====
-- Grants explícitos: anon/authenticated solo leen; service_role (secret key) inserta en scores.

revoke all on public.games, public.scores, public.game_stats, public.leaderboard from anon, authenticated;
grant select on public.games, public.scores, public.game_stats, public.leaderboard to anon, authenticated;
grant select, insert, update, delete on public.games, public.scores to service_role;
grant select on public.game_stats, public.leaderboard to service_role;
