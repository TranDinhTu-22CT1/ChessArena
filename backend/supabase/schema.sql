create extension if not exists pgcrypto;

-- USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  firebase_uid text,
  email text,
  photo_url text,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
add column if not exists firebase_uid text;

alter table public.users
add column if not exists email text;

alter table public.users
add column if not exists photo_url text;

alter table public.users
add column if not exists email_verified boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_firebase_uid_key'
  ) then
    alter table public.users
    add constraint users_firebase_uid_key unique (firebase_uid);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_email_key'
  ) then
    alter table public.users
    add constraint users_email_key unique (email);
  end if;
end $$;

-- GAMES
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  client_game_id text not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  player_color text not null check (player_color in ('w', 'b')),
  ai_elo integer not null,
  result text not null default '*',
  fen text not null,
  pgn text not null default '',
  headers jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- GAME MOVES
create table if not exists public.game_moves (
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  ply integer not null,
  move_number integer not null,
  color text not null check (color in ('white', 'black')),
  san text not null,
  lan text not null,
  from_square text not null,
  to_square text not null,
  piece text not null,
  captured text,
  promotion text,
  flags text,
  created_at timestamptz not null default now(),
  unique (game_id, ply)
);

-- USER PREFERENCES
create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AUTH OTP
create table if not exists public.auth_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('register', 'reset')),
  otp_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- INDEXES
create index if not exists idx_games_user_saved_at
on public.games(user_id, saved_at desc);

create index if not exists idx_game_moves_game_ply
on public.game_moves(game_id, ply);

create index if not exists idx_auth_otps_email_purpose
on public.auth_otps(email, purpose, created_at desc);

-- ENABLE RLS
alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.game_moves enable row level security;
alter table public.user_preferences enable row level security;
alter table public.auth_otps enable row level security;

-- DROP OLD POLICIES IF EXIST
drop policy if exists "service role manages users" on public.users;
drop policy if exists "service role manages games" on public.games;
drop policy if exists "service role manages game moves" on public.game_moves;
drop policy if exists "service role manages user preferences" on public.user_preferences;
drop policy if exists "service role manages auth otps" on public.auth_otps;

-- CREATE POLICIES
create policy "service role manages users"
on public.users
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages games"
on public.games
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages game moves"
on public.game_moves
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user preferences"
on public.user_preferences
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages auth otps"
on public.auth_otps
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
