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

-- USER FRIENDSHIPS
create table if not exists public.user_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_friendships_not_self check (requester_id <> receiver_id)
);

create unique index if not exists idx_user_friendships_pair
on public.user_friendships (
  least(requester_id, receiver_id),
  greatest(requester_id, receiver_id)
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

-- ONLINE PRESENCE
create table if not exists public.online_presence (
  user_id uuid primary key references public.users(id) on delete cascade,
  firebase_uid text not null unique,
  display_name text not null,
  status text not null default 'online' check (status in ('online', 'queue', 'playing', 'idle')),
  current_game_id uuid,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.online_presence
add column if not exists current_queue_ticket_id uuid;

alter table public.online_presence
add column if not exists client_id text;

alter table public.online_presence
add column if not exists session_id text;

-- ONLINE MATCH QUEUE
create table if not exists public.online_match_queue (
  user_id uuid primary key references public.users(id) on delete cascade,
  firebase_uid text not null unique,
  display_name text not null,
  time_control text not null default '600+0',
  rating integer not null default 400,
  joined_at timestamptz not null default now()
);

alter table public.online_match_queue
alter column rating set default 400;

alter table public.online_match_queue
add column if not exists id uuid default gen_random_uuid();

update public.online_match_queue
set id = gen_random_uuid()
where id is null;

alter table public.online_match_queue
alter column id set not null;

alter table public.online_match_queue
drop constraint if exists online_match_queue_pkey;

alter table public.online_match_queue
drop constraint if exists online_match_queue_firebase_uid_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'online_match_queue_id_pkey') then
    alter table public.online_match_queue
    add constraint online_match_queue_id_pkey primary key (id);
  end if;
end $$;

alter table public.online_match_queue
add column if not exists mode text not null default 'rapid';

alter table public.online_match_queue
add column if not exists rating_min integer not null default 350;

alter table public.online_match_queue
add column if not exists rating_max integer not null default 450;

alter table public.online_match_queue
add column if not exists rating_range_preference integer not null default 500;

alter table public.online_match_queue
add column if not exists pool text not null default 'standard';

alter table public.online_match_queue
add column if not exists status text not null default 'waiting';

alter table public.online_match_queue
add column if not exists last_seen timestamptz not null default now();

alter table public.online_match_queue
add column if not exists claimed_by uuid references public.users(id) on delete set null;

alter table public.online_match_queue
add column if not exists claimed_at timestamptz;

alter table public.online_match_queue
add column if not exists matched_game_id uuid;

alter table public.online_match_queue
add column if not exists cancelled_at timestamptz;

alter table public.online_match_queue
add column if not exists cancel_reason text;

alter table public.online_match_queue
add column if not exists client_id text;

alter table public.online_match_queue
add column if not exists session_id text;

alter table public.online_match_queue
add column if not exists region text;

alter table public.online_match_queue
add column if not exists latency_ms integer;

alter table public.online_match_queue
add column if not exists idempotency_key text;

alter table public.online_match_queue
add column if not exists queue_shard integer not null default 0;

alter table public.online_match_queue
add column if not exists created_at timestamptz not null default now();

alter table public.online_match_queue
add column if not exists updated_at timestamptz not null default now();

-- ONLINE GAMES
create table if not exists public.online_games (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'draw', 'checkmate', 'resigned', 'abandoned')),
  match_type text not null default 'quick' check (match_type in ('quick', 'friend')),
  white_user_id uuid references public.users(id) on delete set null,
  black_user_id uuid references public.users(id) on delete set null,
  white_name text not null default 'Player',
  black_name text not null default 'Player',
  fen text not null default 'start',
  pgn text not null default '',
  turn text not null default 'w' check (turn in ('w', 'b')),
  result text not null default '*',
  time_control text not null default '600+0',
  last_move_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.online_games
alter column white_name set default 'Player';

alter table public.online_games
alter column black_name set default 'Player';

alter table public.online_games
add column if not exists rematch_requested_by uuid references public.users(id) on delete set null;

alter table public.online_games
add column if not exists rematch_requested_at timestamptz;

alter table public.online_games
add column if not exists rematch_response text check (rematch_response in ('accepted', 'declined'));

alter table public.online_games
add column if not exists rematch_game_id uuid references public.online_games(id) on delete set null;

alter table public.online_games
add column if not exists mode text not null default 'rapid';

alter table public.online_games
add column if not exists rated boolean not null default true;

alter table public.online_games
add column if not exists started_at timestamptz;

alter table public.online_games
add column if not exists finished_at timestamptz;

alter table public.online_games
add column if not exists white_rating_before integer;

alter table public.online_games
add column if not exists black_rating_before integer;

alter table public.online_games
add column if not exists white_rating_after integer;

alter table public.online_games
add column if not exists black_rating_after integer;

alter table public.online_games
add column if not exists matchmaking_ticket_white uuid;

alter table public.online_games
add column if not exists matchmaking_ticket_black uuid;

alter table public.online_games
add column if not exists matchmaking_pool text;

alter table public.online_games
add column if not exists rating_gap integer;

alter table public.online_games
add column if not exists match_wait_time_white integer;

alter table public.online_games
add column if not exists match_wait_time_black integer;

alter table public.online_games
add column if not exists fairness_score integer;

alter table public.online_games
add column if not exists match_region text;

alter table public.online_games
add column if not exists matchmaking_correlation_id text;


-- ONLINE RATINGS
create table if not exists public.online_ratings (
  user_id uuid primary key references public.users(id) on delete cascade,
  rating integer not null default 400,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PRODUCTION MATCHMAKING RATINGS (SEPARATE PER SPEED MODE)
create table if not exists public.user_ratings (
  user_id uuid not null references public.users(id) on delete cascade,
  mode text not null check (mode in ('bullet', 'blitz', 'rapid', 'classical')),
  rating integer not null default 400 check (rating >= 100 and rating <= 4000),
  deviation integer not null default 350 check (deviation >= 30 and deviation <= 500),
  volatility numeric(8,6) not null default 0.060000 check (volatility > 0),
  provisional boolean not null default true,
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);

insert into public.user_ratings (user_id, mode, rating, games_played, wins, losses, draws, provisional, updated_at)
select r.user_id, m.mode, r.rating, r.games_played, r.wins, r.losses, r.draws, r.games_played < 20, r.updated_at
from public.online_ratings r
cross join (values ('bullet'), ('blitz'), ('rapid'), ('classical')) as m(mode)
on conflict (user_id, mode) do nothing;

create table if not exists public.user_trust_scores (
  user_id uuid primary key references public.users(id) on delete cascade,
  trust_score integer not null default 100 check (trust_score between 0 and 100),
  pool text not null default 'standard' check (pool in ('standard', 'provisional', 'low_trust', 'restricted')),
  abort_rate numeric(6,5) not null default 0,
  disconnect_rate numeric(6,5) not null default 0,
  timeout_rate numeric(6,5) not null default 0,
  resign_too_early_rate numeric(6,5) not null default 0,
  report_count integer not null default 0,
  cheat_suspicion_score numeric(6,5) not null default 0,
  engine_similarity_score numeric(6,5) not null default 0,
  sandbagging_score numeric(6,5) not null default 0,
  smurf_score numeric(6,5) not null default 0,
  suspicious_pattern_score numeric(6,5) not null default 0,
  account_age_days integer not null default 0,
  verified boolean not null default false,
  games_played integer not null default 0,
  policy_version integer not null default 1,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_trust_scores
add column if not exists resign_too_early_rate numeric(6,5) not null default 0;

alter table public.user_trust_scores
add column if not exists engine_similarity_score numeric(6,5) not null default 0;

alter table public.user_trust_scores
add column if not exists suspicious_pattern_score numeric(6,5) not null default 0;

alter table public.user_trust_scores
add column if not exists account_age_days integer not null default 0;

alter table public.user_trust_scores
add column if not exists verified boolean not null default false;

alter table public.user_trust_scores
add column if not exists games_played integer not null default 0;

alter table public.user_trust_scores
add column if not exists policy_version integer not null default 1;

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  device_fingerprint text not null,
  user_agent text,
  user_agent_hash text,
  ip_address inet,
  ip_prefix text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_fingerprint)
);

alter table public.user_devices
add column if not exists user_agent_hash text;

alter table public.user_devices
add column if not exists ip_prefix text;

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  device_fingerprint text,
  ip_prefix text,
  user_agent_hash text,
  risk_signals jsonb not null default '{}'::jsonb,
  ban_type text not null default 'account' check (ban_type in ('account', 'device', 'account_device', 'risk')),
  reason text not null default 'Policy violation',
  status text not null default 'active' check (status in ('active', 'lifted')),
  created_by uuid references public.users(id) on delete set null,
  lifted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  expires_at timestamptz
);

alter table public.user_bans
add column if not exists ip_prefix text;

alter table public.user_bans
add column if not exists user_agent_hash text;

alter table public.user_bans
add column if not exists risk_signals jsonb not null default '{}'::jsonb;

alter table public.user_bans
drop constraint if exists user_bans_ban_type_check;

alter table public.user_bans
add constraint user_bans_ban_type_check
check (ban_type in ('account', 'device', 'account_device', 'risk'));

create table if not exists public.user_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reason text not null default 'Chat policy violation',
  scopes jsonb not null default '["chat", "reports"]'::jsonb,
  status text not null default 'active' check (status in ('active', 'lifted')),
  created_by uuid references public.users(id) on delete set null,
  lifted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.admin_audit_logs (
  id bigserial primary key,
  admin_user_id uuid references public.users(id) on delete set null,
  action text not null,
  target_user_id uuid references public.users(id) on delete set null,
  target_device_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.anti_cheat_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  game_id uuid references public.online_games(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  engine_match_rate numeric(6,5) not null default 0,
  low_time_consistency numeric(6,5) not null default 0,
  suspicious_move_count integer not null default 0,
  total_moves integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.online_games(id) on delete cascade,
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid references public.users(id) on delete set null,
  category text not null check (category in ('cheating', 'toxic', 'stalling', 'sandbagging', 'username', 'avatar', 'harassment', 'match_abuse', 'other')),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'resolved', 'dismissed', 'escalated')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, reporter_user_id, category)
);

create table if not exists public.bot_personas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  elo integer not null default 1200 check (elo between 250 and 3200),
  mood text not null default 'Custom admin bot',
  chat text not null default 'Ready for a themed game.',
  avatar_url text not null default '/chessarena-mark.svg',
  event_tag text not null default 'seasonal',
  active boolean not null default true,
  sort_order integer not null default 50,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null default 'bot_challenge',
  description text not null default 'Beat the featured bot during the event window.',
  reward_label text not null default 'Profile badge',
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_matchmaking_stats (
  user_id uuid primary key references public.users(id) on delete cascade,
  finds integer not null default 0,
  cancels integer not null default 0,
  stale_disconnects integer not null default 0,
  accepted_games integer not null default 0,
  aborts integer not null default 0,
  cooldown_until timestamptz,
  last_find_at timestamptz,
  last_cancel_at timestamptz,
  last_client_id text,
  last_session_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_memberships (
  user_id uuid primary key references public.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'plus', 'pro', 'master')),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'cancelled', 'expired', 'pending')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  provider text,
  provider_subscription_id text,
  provider_plan_id text,
  started_at timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_memberships
add column if not exists provider text;

alter table public.user_memberships
add column if not exists provider_subscription_id text;

alter table public.user_memberships
add column if not exists provider_plan_id text;

alter table public.user_matchmaking_stats
add column if not exists last_client_id text;

alter table public.user_matchmaking_stats
add column if not exists last_session_id text;

create table if not exists public.matchmaking_events (
  id bigserial primary key,
  user_id uuid references public.users(id) on delete set null,
  ticket_id uuid,
  game_id uuid references public.online_games(id) on delete set null,
  event_type text not null,
  mode text,
  time_control text,
  pool text,
  wait_ms integer,
  rating integer,
  rating_window integer,
  rating_gap integer,
  client_id text,
  session_id text,
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.matchmaking_events
add column if not exists correlation_id text;

create table if not exists public.matchmaking_claim_logs (
  id bigserial primary key,
  claimant_user_id uuid references public.users(id) on delete set null,
  opponent_user_id uuid references public.users(id) on delete set null,
  claimant_ticket_id uuid,
  opponent_ticket_id uuid,
  outcome text not null check (outcome in ('matched', 'skipped', 'lock_conflict', 'active_game', 'rollback')),
  game_id uuid references public.online_games(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.matchmaking_abuse_logs (
  id bigserial primary key,
  user_id uuid references public.users(id) on delete set null,
  signal text not null,
  severity integer not null default 1 check (severity between 1 and 10),
  client_id text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_active_locks (
  user_id uuid primary key references public.users(id) on delete cascade,
  game_id uuid not null references public.online_games(id) on delete cascade,
  acquired_at timestamptz not null default now()
);

-- ONLINE RATING EVENTS
create table if not exists public.online_rating_events (
  game_id uuid primary key references public.online_games(id) on delete cascade,
  white_user_id uuid not null references public.users(id) on delete cascade,
  black_user_id uuid not null references public.users(id) on delete cascade,
  result text not null check (result in ('1-0', '0-1', '1/2-1/2')),
  created_at timestamptz not null default now()
);

-- ONLINE GAME MOVES
create table if not exists public.online_game_moves (
  id bigserial primary key,
  game_id uuid not null references public.online_games(id) on delete cascade,
  ply integer not null,
  user_id uuid not null references public.users(id) on delete cascade,
  color text not null check (color in ('w', 'b')),
  san text not null,
  lan text not null,
  from_square text not null,
  to_square text not null,
  promotion text,
  fen_after text not null,
  created_at timestamptz not null default now(),
  unique (game_id, ply)
);

create table if not exists public.online_game_tickets (
  ticket_id uuid primary key,
  game_id uuid not null references public.online_games(id) on delete cascade,
  color text not null check (color in ('w', 'b')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_online_match_queue_active_user
on public.online_match_queue(user_id)
where status in ('waiting', 'claimed');

create unique index if not exists idx_online_match_queue_active_idempotency
on public.online_match_queue(user_id, idempotency_key)
where status in ('waiting', 'claimed') and idempotency_key is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'online_presence_queue_ticket_fk') then
    alter table public.online_presence
    add constraint online_presence_queue_ticket_fk foreign key (current_queue_ticket_id)
    references public.online_match_queue(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_match_queue_game_fk') then
    alter table public.online_match_queue
    add constraint online_match_queue_game_fk foreign key (matched_game_id)
    references public.online_games(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_games_ticket_white_fk') then
    alter table public.online_games
    add constraint online_games_ticket_white_fk foreign key (matchmaking_ticket_white)
    references public.online_match_queue(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_games_ticket_black_fk') then
    alter table public.online_games
    add constraint online_games_ticket_black_fk foreign key (matchmaking_ticket_black)
    references public.online_match_queue(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_game_tickets_ticket_fk') then
    alter table public.online_game_tickets
    add constraint online_game_tickets_ticket_fk foreign key (ticket_id)
    references public.online_match_queue(id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_match_queue_status_check') then
    alter table public.online_match_queue
    add constraint online_match_queue_status_check check (status in ('waiting', 'claimed', 'matched', 'cancelled', 'stale'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_match_queue_mode_check') then
    alter table public.online_match_queue
    add constraint online_match_queue_mode_check check (mode in ('bullet', 'blitz', 'rapid', 'classical'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_match_queue_pool_check') then
    alter table public.online_match_queue
    add constraint online_match_queue_pool_check check (pool in ('standard', 'provisional', 'low_trust', 'restricted'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_match_queue_rating_bounds_check') then
    alter table public.online_match_queue
    add constraint online_match_queue_rating_bounds_check check (
      rating >= 100 and rating <= 4000 and
      rating_min <= rating and rating_max >= rating and
      rating_range_preference between 25 and 1000
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'online_games_distinct_players_check') then
    alter table public.online_games
    add constraint online_games_distinct_players_check check (
      white_user_id is null or black_user_id is null or white_user_id <> black_user_id
    );
  end if;
end $$;

create or replace function public.matchmaking_rating_window(
  p_joined_at timestamptz,
  p_preference integer default 500
)
returns integer
language sql
stable
as $$
  select least(
    greatest(coalesce(p_preference, 500), 25),
    case
      when now() - p_joined_at < interval '3 seconds' then 50
      when now() - p_joined_at < interval '8 seconds' then 100
      when now() - p_joined_at < interval '15 seconds' then 200
      when now() - p_joined_at < interval '30 seconds' then 350
      else 500
    end
  );
$$;

create or replace function public.matchmaking_fairness_score(
  p_wait_ms integer,
  p_rating_gap integer,
  p_same_region boolean default true,
  p_recent_opponent boolean default false
)
returns integer
language sql
immutable
as $$
  select greatest(0, least(1000,
    1000
    - least(coalesce(p_rating_gap, 0), 1000)
    + least(greatest(coalesce(p_wait_ms, 0), 0) / 100, 200)
    + case when coalesce(p_same_region, true) then 25 else 0 end
    - case when coalesce(p_recent_opponent, false) then 250 else 0 end
  ));
$$;

create or replace function public.quick_match_cancel(
  p_user_id uuid,
  p_reason text default 'user_cancelled'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_id uuid;
  v_cooldown_until timestamptz;
begin
  update public.online_match_queue
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = left(coalesce(p_reason, 'user_cancelled'), 80),
      updated_at = now()
  where user_id = p_user_id
    and status in ('waiting', 'claimed')
  returning id into v_ticket_id;

  update public.online_presence
  set status = 'online',
      current_queue_ticket_id = null,
      last_seen = now(),
      updated_at = now()
  where user_id = p_user_id
    and status = 'queue';

  insert into public.user_matchmaking_stats (user_id, cancels, last_cancel_at, cooldown_until, updated_at)
  values (p_user_id, 1, now(), null, now())
  on conflict (user_id) do update
  set cancels = public.user_matchmaking_stats.cancels + 1,
      last_cancel_at = now(),
      cooldown_until = case
        when public.user_matchmaking_stats.last_cancel_at > now() - interval '30 seconds'
          then now() + least(public.user_matchmaking_stats.cancels + 1, 10) * interval '2 seconds'
        else null
      end,
      updated_at = now()
  returning cooldown_until into v_cooldown_until;

  insert into public.matchmaking_events (user_id, ticket_id, event_type, metadata)
  values (p_user_id, v_ticket_id, 'queue_cancelled', jsonb_build_object(
    'reason', coalesce(p_reason, 'user_cancelled'),
    'cooldown_until', v_cooldown_until
  ));

  return jsonb_build_object('status', 'cancelled', 'queue_ticket_id', v_ticket_id, 'cooldown_until', v_cooldown_until);
end;
$$;

create or replace function public.enforce_single_active_online_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first uuid;
  v_second uuid;
begin
  if new.status <> 'active' or new.white_user_id is null or new.black_user_id is null then
    return new;
  end if;

  v_first := least(new.white_user_id, new.black_user_id);
  v_second := greatest(new.white_user_id, new.black_user_id);
  perform pg_advisory_xact_lock(hashtextextended('active:' || v_first::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('active:' || v_second::text, 0));

  if exists (
    select 1
    from public.online_games g
    where g.status = 'active'
      and g.id <> new.id
      and (
        g.white_user_id in (new.white_user_id, new.black_user_id)
        or g.black_user_id in (new.white_user_id, new.black_user_id)
      )
  ) then
    raise exception 'a player already has an active online game' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_single_active_online_game on public.online_games;
create trigger trg_single_active_online_game
before insert or update of status, white_user_id, black_user_id on public.online_games
for each row execute function public.enforce_single_active_online_game();

create or replace function public.quick_match_find_game(
  p_user_id uuid,
  p_time_control text,
  p_mode text,
  p_rating integer default null,
  p_client_id text default null,
  p_session_id text default null,
  p_region text default null,
  p_rating_range_preference integer default 500,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_user public.users%rowtype;
  v_me public.online_match_queue%rowtype;
  v_opponent public.online_match_queue%rowtype;
  v_game_id uuid;
  v_rating integer;
  v_pool text := 'standard';
  v_my_window integer;
  v_opponent_window integer;
  v_is_white boolean;
  v_white_user uuid;
  v_black_user uuid;
  v_white_name text;
  v_black_name text;
  v_white_ticket uuid;
  v_black_ticket uuid;
  v_white_rating integer;
  v_black_rating integer;
  v_existing_game uuid;
  v_cooldown_until timestamptz;
  v_idempotency_key text := nullif(left(coalesce(p_idempotency_key, ''), 120), '');
  v_correlation_id text := coalesce(nullif(left(coalesce(p_session_id, ''), 120), ''), gen_random_uuid()::text);
  v_wait_ms integer;
  v_recent_opponent boolean;
  v_fairness_score integer;
begin
  if p_time_control not in ('180+0', '300+0', '600+0', '900+10') then
    raise exception 'invalid time control' using errcode = '22023';
  end if;
  if p_mode not in ('bullet', 'blitz', 'rapid', 'classical') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;

  select * into v_user from public.users where id = p_user_id;
  if not found then
    raise exception 'user not found' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('queue:' || p_user_id::text, 0));

  select id into v_existing_game
  from public.online_games
  where status = 'active'
    and (white_user_id = p_user_id or black_user_id = p_user_id)
  order by created_at desc
  limit 1;
  if v_existing_game is not null then
    return jsonb_build_object('status', 'matched', 'game_id', v_existing_game, 'reconnected', true);
  end if;

  insert into public.user_ratings (user_id, mode)
  values (p_user_id, p_mode)
  on conflict (user_id, mode) do nothing;

  select rating into v_rating
  from public.user_ratings
  where user_id = p_user_id and mode = p_mode;

  select coalesce(pool, 'standard') into v_pool
  from public.user_trust_scores
  where user_id = p_user_id;
  v_pool := coalesce(v_pool, 'standard');
  if v_pool = 'restricted' then
    raise exception 'matchmaking restricted' using errcode = '42501';
  end if;

  select cooldown_until into v_cooldown_until
  from public.user_matchmaking_stats
  where user_id = p_user_id;
  if v_cooldown_until is not null and v_cooldown_until > v_now then
    insert into public.matchmaking_abuse_logs (user_id, signal, severity, client_id, session_id, metadata)
    values (p_user_id, 'queue_cooldown_block', 2, left(p_client_id, 120), left(p_session_id, 120),
      jsonb_build_object('cooldown_until', v_cooldown_until));
    return jsonb_build_object('status', 'cooldown', 'cooldown_until', v_cooldown_until);
  end if;

  insert into public.user_matchmaking_stats (user_id, finds, last_find_at, updated_at)
  values (p_user_id, 1, v_now, v_now)
  on conflict (user_id) do update
  set finds = public.user_matchmaking_stats.finds + 1,
      last_find_at = v_now,
      last_client_id = left(p_client_id, 120),
      last_session_id = left(p_session_id, 120),
      updated_at = v_now;

  select * into v_me
  from public.online_match_queue
  where user_id = p_user_id
    and status in ('waiting', 'claimed')
  order by joined_at desc
  limit 1
  for update;

  if found and v_me.status = 'waiting'
    and v_me.time_control = p_time_control
    and v_me.mode = p_mode
    and v_me.pool = v_pool then
    v_my_window := public.matchmaking_rating_window(v_me.joined_at, p_rating_range_preference);
    update public.online_match_queue
    set rating = v_rating,
        rating_min = greatest(100, v_rating - v_my_window),
        rating_max = least(4000, v_rating + v_my_window),
        rating_range_preference = greatest(25, least(coalesce(p_rating_range_preference, 500), 1000)),
        last_seen = v_now,
        client_id = left(p_client_id, 120),
        session_id = left(p_session_id, 120),
        region = left(p_region, 40),
        idempotency_key = coalesce(v_idempotency_key, idempotency_key),
        updated_at = v_now
    where id = v_me.id
    returning * into v_me;
  else
    if found and v_me.status in ('waiting', 'claimed') then
      update public.online_match_queue
      set status = 'cancelled',
          cancelled_at = v_now,
          cancel_reason = 'new_search_parameters',
          updated_at = v_now
      where id = v_me.id;
    end if;

    v_my_window := public.matchmaking_rating_window(v_now, p_rating_range_preference);
    insert into public.online_match_queue (
      user_id, firebase_uid, display_name, time_control, mode, rating,
      rating_min, rating_max, rating_range_preference, pool, status,
      joined_at, last_seen, client_id, session_id, region, idempotency_key,
      queue_shard, created_at, updated_at
    ) values (
      p_user_id, v_user.firebase_uid, v_user.display_name, p_time_control, p_mode, v_rating,
      greatest(100, v_rating - v_my_window), least(4000, v_rating + v_my_window),
      greatest(25, least(coalesce(p_rating_range_preference, 500), 1000)), v_pool, 'waiting',
      v_now, v_now, left(p_client_id, 120), left(p_session_id, 120), left(p_region, 40), v_idempotency_key,
      (abs(hashtextextended(p_time_control || ':' || p_mode || ':' || v_pool || ':' || coalesce(left(p_region, 40), 'global'), 0)) % 16)::integer,
      v_now, v_now
    )
    returning * into v_me;
  end if;

  insert into public.online_presence (
    user_id, firebase_uid, display_name, status, current_game_id,
    current_queue_ticket_id, client_id, session_id, last_seen, updated_at
  ) values (
    p_user_id, v_user.firebase_uid, v_user.display_name, 'queue', null,
    v_me.id, left(p_client_id, 120), left(p_session_id, 120), v_now, v_now
  )
  on conflict (user_id) do update set
    status = 'queue',
    current_game_id = null,
    current_queue_ticket_id = excluded.current_queue_ticket_id,
    client_id = excluded.client_id,
    session_id = excluded.session_id,
    last_seen = excluded.last_seen,
    updated_at = excluded.updated_at;

  update public.online_match_queue
  set status = 'stale', updated_at = v_now
  where status = 'waiting' and last_seen < v_now - interval '30 seconds';

  select q.* into v_opponent
  from public.online_match_queue q
  where q.id <> v_me.id
    and q.user_id <> p_user_id
    and q.status = 'waiting'
    and q.time_control = p_time_control
    and q.mode = p_mode
    and q.pool <> 'restricted'
    and q.last_seen >= v_now - interval '30 seconds'
    and abs(q.rating - v_rating) <= public.matchmaking_rating_window(v_me.joined_at, v_me.rating_range_preference)
    and abs(q.rating - v_rating) <= public.matchmaking_rating_window(q.joined_at, q.rating_range_preference)
    and (
      v_now - v_me.joined_at > interval '20 seconds'
      or v_now - q.joined_at > interval '20 seconds'
      or not exists (
        select 1
        from public.online_games g
        where g.created_at > v_now - interval '30 minutes'
          and g.match_type = 'quick'
          and (
            (g.white_user_id = p_user_id and g.black_user_id = q.user_id)
            or (g.white_user_id = q.user_id and g.black_user_id = p_user_id)
          )
      )
    )
  order by q.joined_at asc, abs(q.rating - v_rating), q.id
  for update skip locked
  limit 1;

  if not found then
    insert into public.matchmaking_events (
      user_id, ticket_id, event_type, mode, time_control, pool, rating, rating_window,
      client_id, session_id, correlation_id
    ) values (
      p_user_id, v_me.id, 'waiting', p_mode, p_time_control, v_pool, v_rating,
      public.matchmaking_rating_window(v_me.joined_at, v_me.rating_range_preference),
      left(p_client_id, 120), left(p_session_id, 120), v_correlation_id
    );
    return jsonb_build_object(
      'status', 'waiting',
      'queue_ticket_id', v_me.id,
      'estimated_wait', 5000,
      'rating_window', public.matchmaking_rating_window(v_me.joined_at, v_me.rating_range_preference),
      'rating', v_rating,
      'mode', p_mode,
      'pool', v_pool
    );
  end if;

  if exists (
    select 1 from public.online_games
    where status = 'active'
      and (white_user_id in (p_user_id, v_opponent.user_id) or black_user_id in (p_user_id, v_opponent.user_id))
  ) then
    insert into public.matchmaking_claim_logs (
      claimant_user_id, opponent_user_id, claimant_ticket_id, opponent_ticket_id, outcome
    ) values (p_user_id, v_opponent.user_id, v_me.id, v_opponent.id, 'active_game');
    return jsonb_build_object('status', 'waiting', 'queue_ticket_id', v_me.id, 'rating_window', v_my_window);
  end if;

  v_is_white := random() < 0.5;
  v_white_user := case when v_is_white then p_user_id else v_opponent.user_id end;
  v_black_user := case when v_is_white then v_opponent.user_id else p_user_id end;
  v_white_name := case when v_is_white then v_user.display_name else v_opponent.display_name end;
  v_black_name := case when v_is_white then v_opponent.display_name else v_user.display_name end;
  v_white_ticket := case when v_is_white then v_me.id else v_opponent.id end;
  v_black_ticket := case when v_is_white then v_opponent.id else v_me.id end;
  v_white_rating := case when v_is_white then v_rating else v_opponent.rating end;
  v_black_rating := case when v_is_white then v_opponent.rating else v_rating end;
  v_opponent_window := public.matchmaking_rating_window(v_opponent.joined_at, v_opponent.rating_range_preference);
  v_wait_ms := floor(extract(epoch from (v_now - least(v_me.joined_at, v_opponent.joined_at))) * 1000)::integer;
  select exists (
    select 1
    from public.online_games g
    where g.created_at > v_now - interval '30 minutes'
      and g.match_type = 'quick'
      and (
        (g.white_user_id = p_user_id and g.black_user_id = v_opponent.user_id)
        or (g.white_user_id = v_opponent.user_id and g.black_user_id = p_user_id)
      )
  ) into v_recent_opponent;
  v_fairness_score := public.matchmaking_fairness_score(
    v_wait_ms,
    abs(v_rating - v_opponent.rating),
    coalesce(v_me.region, '') = coalesce(v_opponent.region, ''),
    v_recent_opponent
  );

  insert into public.online_games (
    status, match_type, white_user_id, black_user_id, white_name, black_name,
    fen, pgn, turn, result, time_control, mode, rated, last_move_at, created_at,
    started_at, updated_at, white_rating_before, black_rating_before,
    matchmaking_ticket_white, matchmaking_ticket_black, matchmaking_pool, rating_gap,
    match_wait_time_white, match_wait_time_black, fairness_score, match_region,
    matchmaking_correlation_id
  ) values (
    'active', 'quick', v_white_user, v_black_user, v_white_name, v_black_name,
    'start', '', 'w', '*', p_time_control, p_mode, true, v_now, v_now,
    v_now, v_now, v_white_rating, v_black_rating,
    v_white_ticket, v_black_ticket, v_pool, abs(v_rating - v_opponent.rating),
    case when v_is_white then floor(extract(epoch from (v_now - v_me.joined_at)) * 1000)::integer else floor(extract(epoch from (v_now - v_opponent.joined_at)) * 1000)::integer end,
    case when v_is_white then floor(extract(epoch from (v_now - v_opponent.joined_at)) * 1000)::integer else floor(extract(epoch from (v_now - v_me.joined_at)) * 1000)::integer end,
    v_fairness_score,
    coalesce(nullif(v_me.region, ''), nullif(v_opponent.region, ''), 'global'),
    v_correlation_id
  ) returning id into v_game_id;

  insert into public.online_game_tickets (ticket_id, game_id, color)
  values (v_white_ticket, v_game_id, 'w'), (v_black_ticket, v_game_id, 'b');

  update public.online_match_queue
  set status = 'matched', claimed_by = p_user_id, claimed_at = v_now,
      matched_game_id = v_game_id, updated_at = v_now
  where id in (v_me.id, v_opponent.id);

  delete from public.user_active_locks l
  where l.user_id in (p_user_id, v_opponent.user_id)
    and not exists (select 1 from public.online_games g where g.id = l.game_id and g.status = 'active');

  insert into public.user_active_locks (user_id, game_id, acquired_at)
  values (p_user_id, v_game_id, v_now), (v_opponent.user_id, v_game_id, v_now);

  update public.online_presence
  set status = 'playing', current_game_id = v_game_id, current_queue_ticket_id = null,
      last_seen = v_now, updated_at = v_now
  where user_id in (p_user_id, v_opponent.user_id);

  insert into public.matchmaking_claim_logs (
    claimant_user_id, opponent_user_id, claimant_ticket_id, opponent_ticket_id, outcome, game_id
  ) values (p_user_id, v_opponent.user_id, v_me.id, v_opponent.id, 'matched', v_game_id);

  insert into public.matchmaking_events (
    user_id, ticket_id, game_id, event_type, mode, time_control, pool, wait_ms,
    rating, rating_window, rating_gap, client_id, session_id, correlation_id
  ) values
    (p_user_id, v_me.id, v_game_id, 'matched', p_mode, p_time_control, v_pool,
      floor(extract(epoch from (v_now - v_me.joined_at)) * 1000)::integer, v_rating, v_my_window,
      abs(v_rating - v_opponent.rating), left(p_client_id, 120), left(p_session_id, 120), v_correlation_id),
    (v_opponent.user_id, v_opponent.id, v_game_id, 'matched', p_mode, p_time_control, v_pool,
      floor(extract(epoch from (v_now - v_opponent.joined_at)) * 1000)::integer, v_opponent.rating, v_opponent_window,
      abs(v_rating - v_opponent.rating), v_opponent.client_id, v_opponent.session_id, v_correlation_id);

  return jsonb_build_object(
    'status', 'matched',
    'game_id', v_game_id,
    'queue_ticket_id', v_me.id,
    'estimated_wait', 0,
    'rating_window', v_my_window,
    'rating_gap', abs(v_rating - v_opponent.rating),
    'fairness_score', v_fairness_score,
    'rating', v_rating,
    'mode', p_mode,
    'pool', v_pool
  );
end;
$$;

revoke all on function public.quick_match_find_game(uuid, text, text, integer, text, text, text, integer, text) from public;
grant execute on function public.quick_match_find_game(uuid, text, text, integer, text, text, text, integer, text) to service_role;
revoke all on function public.quick_match_cancel(uuid, text) from public;
grant execute on function public.quick_match_cancel(uuid, text) to service_role;

create or replace function public.quick_match_heartbeat(
  p_user_id uuid,
  p_client_id text default null,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_id uuid;
begin
  update public.online_match_queue
  set last_seen = now(),
      client_id = coalesce(left(p_client_id, 120), client_id),
      session_id = coalesce(left(p_session_id, 120), session_id),
      updated_at = now()
  where user_id = p_user_id
    and status = 'waiting'
  returning id into v_ticket_id;

  update public.online_presence
  set last_seen = now(),
      updated_at = now(),
      current_queue_ticket_id = coalesce(v_ticket_id, current_queue_ticket_id)
  where user_id = p_user_id
    and status = 'queue';

  return jsonb_build_object('status', case when v_ticket_id is null then 'idle' else 'waiting' end, 'queue_ticket_id', v_ticket_id);
end;
$$;

revoke all on function public.quick_match_heartbeat(uuid, text, text) from public;
grant execute on function public.quick_match_heartbeat(uuid, text, text) to service_role;

create or replace function public.finalize_online_rating_result(
  p_game_id uuid,
  p_result text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.online_games%rowtype;
  v_white public.user_ratings%rowtype;
  v_black public.user_ratings%rowtype;
  v_white_score numeric;
  v_black_score numeric;
  v_white_expected numeric;
  v_black_expected numeric;
  v_white_k integer;
  v_black_k integer;
  v_white_delta integer;
  v_black_delta integer;
  v_white_after integer;
  v_black_after integer;
  v_first uuid;
  v_second uuid;
begin
  if p_result not in ('1-0', '0-1', '1/2-1/2') then
    raise exception 'invalid rating result' using errcode = '22023';
  end if;

  select * into v_game
  from public.online_games
  where id = p_game_id
  for update;

  if not found or v_game.rated = false or v_game.white_user_id is null or v_game.black_user_id is null then
    return jsonb_build_object('status', 'ignored');
  end if;

  insert into public.online_rating_events (game_id, white_user_id, black_user_id, result)
  values (p_game_id, v_game.white_user_id, v_game.black_user_id, p_result)
  on conflict (game_id) do nothing;

  if not found then
    return jsonb_build_object('status', 'already_finalized');
  end if;

  v_first := least(v_game.white_user_id, v_game.black_user_id);
  v_second := greatest(v_game.white_user_id, v_game.black_user_id);
  perform pg_advisory_xact_lock(hashtextextended('rating:' || v_first::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('rating:' || v_second::text, 0));

  insert into public.user_ratings (user_id, mode)
  values (v_game.white_user_id, coalesce(v_game.mode, 'rapid')),
         (v_game.black_user_id, coalesce(v_game.mode, 'rapid'))
  on conflict (user_id, mode) do nothing;

  select * into v_white
  from public.user_ratings
  where user_id = v_game.white_user_id and mode = coalesce(v_game.mode, 'rapid')
  for update;

  select * into v_black
  from public.user_ratings
  where user_id = v_game.black_user_id and mode = coalesce(v_game.mode, 'rapid')
  for update;

  v_white_score := case when p_result = '1-0' then 1 when p_result = '0-1' then 0 else 0.5 end;
  v_black_score := 1 - v_white_score;
  v_white_expected := 1 / (1 + power(10, ((v_black.rating - v_white.rating)::numeric / 400)));
  v_black_expected := 1 / (1 + power(10, ((v_white.rating - v_black.rating)::numeric / 400)));
  v_white_k := case when v_white.games_played < 30 then 40 when v_white.rating < 1200 then 32 when v_white.rating < 2000 then 24 else 16 end;
  v_black_k := case when v_black.games_played < 30 then 40 when v_black.rating < 1200 then 32 when v_black.rating < 2000 then 24 else 16 end;
  v_white_delta := round(v_white_k * (v_white_score - v_white_expected))::integer;
  v_black_delta := round(v_black_k * (v_black_score - v_black_expected))::integer;
  v_white_after := greatest(100, v_white.rating + v_white_delta);
  v_black_after := greatest(100, v_black.rating + v_black_delta);

  update public.user_ratings
  set rating = v_white_after,
      games_played = games_played + 1,
      wins = wins + case when v_white_score = 1 then 1 else 0 end,
      losses = losses + case when v_white_score = 0 then 1 else 0 end,
      draws = draws + case when v_white_score = 0.5 then 1 else 0 end,
      provisional = games_played + 1 < 20,
      deviation = greatest(30, deviation - case when games_played < 20 then 12 else 4 end),
      updated_at = now()
  where user_id = v_game.white_user_id and mode = coalesce(v_game.mode, 'rapid');

  update public.user_ratings
  set rating = v_black_after,
      games_played = games_played + 1,
      wins = wins + case when v_black_score = 1 then 1 else 0 end,
      losses = losses + case when v_black_score = 0 then 1 else 0 end,
      draws = draws + case when v_black_score = 0.5 then 1 else 0 end,
      provisional = games_played + 1 < 20,
      deviation = greatest(30, deviation - case when games_played < 20 then 12 else 4 end),
      updated_at = now()
  where user_id = v_game.black_user_id and mode = coalesce(v_game.mode, 'rapid');

  update public.online_games
  set white_rating_before = coalesce(white_rating_before, v_white.rating),
      black_rating_before = coalesce(black_rating_before, v_black.rating),
      white_rating_after = v_white_after,
      black_rating_after = v_black_after,
      updated_at = now()
  where id = p_game_id;

  return jsonb_build_object(
    'status', 'finalized',
    'white', jsonb_build_object('before', v_white.rating, 'after', v_white_after, 'delta', v_white_delta),
    'black', jsonb_build_object('before', v_black.rating, 'after', v_black_after, 'delta', v_black_delta)
  );
end;
$$;

revoke all on function public.finalize_online_rating_result(uuid, text) from public;
grant execute on function public.finalize_online_rating_result(uuid, text) to service_role;

create or replace function public.cleanup_online_matchmaking()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stale_tickets integer := 0;
  v_presence_fixed integer := 0;
  v_locks_removed integer := 0;
begin
  with expired as (
    update public.online_match_queue
    set status = 'stale',
        cancelled_at = now(),
        cancel_reason = 'heartbeat_expired',
        updated_at = now()
    where status in ('waiting', 'claimed')
      and last_seen < now() - interval '30 seconds'
    returning user_id, id
  )
  select count(*) into v_stale_tickets from expired;

  with fixed as (
    update public.online_presence p
    set status = 'online',
        current_queue_ticket_id = null,
        updated_at = now()
    where p.status = 'queue'
      and not exists (
        select 1 from public.online_match_queue q
        where q.user_id = p.user_id and q.status in ('waiting', 'claimed')
      )
    returning p.user_id
  )
  select count(*) into v_presence_fixed from fixed;

  with removed as (
    delete from public.user_active_locks l
    where not exists (
      select 1 from public.online_games g
      where g.id = l.game_id and g.status = 'active'
    )
    returning l.user_id
  )
  select count(*) into v_locks_removed from removed;

  insert into public.matchmaking_events (event_type, metadata)
  values ('maintenance', jsonb_build_object(
    'stale_tickets', v_stale_tickets,
    'presence_fixed', v_presence_fixed,
    'locks_removed', v_locks_removed
  ));

  return jsonb_build_object(
    'stale_tickets', v_stale_tickets,
    'presence_fixed', v_presence_fixed,
    'locks_removed', v_locks_removed
  );
end;
$$;

revoke all on function public.cleanup_online_matchmaking() from public;
grant execute on function public.cleanup_online_matchmaking() to service_role;

create or replace view public.matchmaking_metrics_hourly as
select
  date_trunc('hour', created_at) as bucket,
  mode,
  time_control,
  pool,
  count(*) filter (where event_type = 'matched') as matched_players,
  count(*) filter (where event_type = 'waiting') as waiting_events,
  count(*) filter (where event_type = 'queue_cancelled') as cancel_events,
  percentile_cont(0.5) within group (order by wait_ms) filter (where event_type = 'matched') as p50_wait_ms,
  percentile_cont(0.95) within group (order by wait_ms) filter (where event_type = 'matched') as p95_wait_ms,
  avg(rating_gap) filter (where event_type = 'matched') as average_rating_gap,
  percentile_cont(0.95) within group (order by rating_gap) filter (where event_type = 'matched') as p95_rating_gap
from public.matchmaking_events
group by date_trunc('hour', created_at), mode, time_control, pool;

revoke all on public.matchmaking_metrics_hourly from public;
revoke all on public.matchmaking_metrics_hourly from anon;
revoke all on public.matchmaking_metrics_hourly from authenticated;
grant select on public.matchmaking_metrics_hourly to service_role;

-- INDEXES
create index if not exists idx_games_user_saved_at
on public.games(user_id, saved_at desc);

create index if not exists idx_game_moves_game_ply
on public.game_moves(game_id, ply);

create index if not exists idx_user_friendships_requester_status
on public.user_friendships(requester_id, status, updated_at desc);

create index if not exists idx_user_friendships_receiver_status
on public.user_friendships(receiver_id, status, updated_at desc);

-- USER NOTIFICATIONS
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.users(id) on delete cascade,
  audience text not null default 'user' check (audience in ('user', 'admin', 'system')),
  type text not null default 'system',
  title text not null,
  body text not null default '',
  action_url text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_recipient_created
on public.user_notifications(recipient_user_id, created_at desc);

create index if not exists idx_user_notifications_unread
on public.user_notifications(recipient_user_id, read_at, created_at desc);

create index if not exists idx_user_notifications_audience_created
on public.user_notifications(audience, created_at desc);

create index if not exists idx_auth_otps_email_purpose
on public.auth_otps(email, purpose, created_at desc);

create index if not exists idx_online_presence_last_seen
on public.online_presence(last_seen desc);

create index if not exists idx_online_match_queue_joined
on public.online_match_queue(time_control, joined_at asc);

create index if not exists idx_online_match_queue_waiting_pool
on public.online_match_queue(time_control, mode, pool, joined_at asc, rating)
where status = 'waiting';

create index if not exists idx_online_match_queue_waiting_shard
on public.online_match_queue(time_control, mode, pool, queue_shard, joined_at asc, rating)
where status = 'waiting';

create index if not exists idx_online_match_queue_stale
on public.online_match_queue(last_seen)
where status in ('waiting', 'claimed');

create index if not exists idx_online_games_players
on public.online_games(white_user_id, black_user_id, updated_at desc);

create index if not exists idx_online_games_quick_recent_pair
on public.online_games(match_type, created_at desc, white_user_id, black_user_id)
where match_type = 'quick';

create unique index if not exists idx_online_games_ticket_white_unique
on public.online_games(matchmaking_ticket_white)
where matchmaking_ticket_white is not null;

create unique index if not exists idx_online_games_ticket_black_unique
on public.online_games(matchmaking_ticket_black)
where matchmaking_ticket_black is not null;

create index if not exists idx_online_ratings_rating
on public.online_ratings(rating desc);

create index if not exists idx_user_ratings_mode_rating
on public.user_ratings(mode, rating);

create index if not exists idx_matchmaking_events_session
on public.matchmaking_events(session_id, created_at desc);

create index if not exists idx_matchmaking_events_type_created
on public.matchmaking_events(event_type, created_at desc);

create index if not exists idx_matchmaking_claim_logs_created
on public.matchmaking_claim_logs(created_at desc);

create index if not exists idx_matchmaking_abuse_user_created
on public.matchmaking_abuse_logs(user_id, created_at desc);

create index if not exists idx_user_memberships_status
on public.user_memberships(status, tier, updated_at desc);

create index if not exists idx_user_devices_fingerprint
on public.user_devices(device_fingerprint, last_seen_at desc);

create index if not exists idx_user_devices_risk_signals
on public.user_devices(ip_prefix, user_agent_hash, last_seen_at desc);

create index if not exists idx_user_bans_active_user
on public.user_bans(user_id, status, created_at desc);

create index if not exists idx_user_bans_active_device
on public.user_bans(device_fingerprint, status, created_at desc);

create index if not exists idx_user_bans_active_risk
on public.user_bans(ip_prefix, user_agent_hash, status, created_at desc);

create index if not exists idx_user_mutes_active_user
on public.user_mutes(user_id, status, created_at desc);

create index if not exists idx_admin_audit_logs_created
on public.admin_audit_logs(created_at desc);

create index if not exists idx_anti_cheat_reports_user_risk
on public.anti_cheat_reports(user_id, risk_score desc, created_at desc);

create index if not exists idx_anti_cheat_reports_user_game
on public.anti_cheat_reports(user_id, game_id, created_at desc)
where game_id is not null;

create table if not exists public.game_reviews (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.online_games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  color text not null check (color in ('w', 'b')),
  accuracy numeric(5,2) default 0,
  average_centipawn_loss integer default 0,
  blunders integer default 0,
  mistakes integer default 0,
  inaccuracies integer default 0,
  best_moves integer default 0,
  total_moves integer default 0,
  summary jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(game_id, user_id)
);

create table if not exists public.game_review_moves (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.game_reviews(id) on delete cascade,
  game_id uuid not null references public.online_games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  ply integer not null,
  san text,
  move text,
  fen text,
  best_move text,
  tone text,
  label text,
  centipawn_loss integer default 0,
  win_loss numeric(6,2) default 0,
  white_score integer,
  created_at timestamptz default now(),
  unique(review_id, ply)
);

create table if not exists public.personal_puzzles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_game_id uuid references public.online_games(id) on delete cascade,
  source_review_id uuid references public.game_reviews(id) on delete cascade,
  source_ply integer,
  fen text not null,
  solution text not null,
  played_move text,
  san text,
  theme text default 'mistake',
  stage text default 'review',
  rating integer default 1200,
  status text default 'new' check (status in ('new', 'solved', 'dismissed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, source_game_id, source_ply)
);

create table if not exists public.rating_refunds (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.anti_cheat_reports(id) on delete set null,
  game_id uuid not null references public.online_games(id) on delete cascade,
  offender_user_id uuid not null references public.users(id) on delete cascade,
  refunded_user_id uuid not null references public.users(id) on delete cascade,
  mode text default 'rapid',
  rating_before integer,
  rating_after integer,
  refund_delta integer not null,
  reason text default 'fair_play_refund',
  created_at timestamptz default now(),
  unique(game_id, refunded_user_id, reason)
);

create index if not exists idx_game_reviews_user_updated
on public.game_reviews(user_id, updated_at desc);

create index if not exists idx_game_review_moves_user_tone
on public.game_review_moves(user_id, tone, created_at desc);

create index if not exists idx_personal_puzzles_user_status
on public.personal_puzzles(user_id, status, created_at desc);

create index if not exists idx_rating_refunds_user_created
on public.rating_refunds(refunded_user_id, created_at desc);

create index if not exists idx_bot_personas_active_window
on public.bot_personas(active, starts_at, ends_at, sort_order);

create index if not exists idx_site_events_active_window
on public.site_events(active, starts_at desc, ends_at);

create index if not exists idx_player_reports_status_created
on public.player_reports(status, created_at desc);

create index if not exists idx_player_reports_game
on public.player_reports(game_id, created_at desc);

create index if not exists idx_player_reports_reported_user
on public.player_reports(reported_user_id, status, created_at desc);

create index if not exists idx_online_game_moves_game_ply
on public.online_game_moves(game_id, ply);

-- REALTIME PUBLICATION FOR ONLINE CHESS
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'online_games'
    ) then
      execute 'alter publication supabase_realtime add table public.online_games';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'online_game_moves'
    ) then
      execute 'alter publication supabase_realtime add table public.online_game_moves';
    end if;
  end if;
end $$;

-- ENABLE RLS
alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.game_moves enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_friendships enable row level security;
alter table public.user_notifications enable row level security;
alter table public.auth_otps enable row level security;
alter table public.online_presence enable row level security;
alter table public.online_match_queue enable row level security;
alter table public.online_games enable row level security;
alter table public.online_ratings enable row level security;
alter table public.user_ratings enable row level security;
alter table public.user_trust_scores enable row level security;
alter table public.user_devices enable row level security;
alter table public.user_bans enable row level security;
alter table public.user_mutes enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.anti_cheat_reports enable row level security;
alter table public.player_reports enable row level security;
alter table public.user_matchmaking_stats enable row level security;
alter table public.user_memberships enable row level security;
alter table public.matchmaking_events enable row level security;
alter table public.matchmaking_claim_logs enable row level security;
alter table public.matchmaking_abuse_logs enable row level security;
alter table public.user_active_locks enable row level security;
alter table public.online_rating_events enable row level security;
alter table public.online_game_moves enable row level security;
alter table public.online_game_tickets enable row level security;

-- DROP OLD POLICIES IF EXIST
drop policy if exists "service role manages users" on public.users;
drop policy if exists "service role manages games" on public.games;
drop policy if exists "service role manages game moves" on public.game_moves;
drop policy if exists "service role manages user preferences" on public.user_preferences;
drop policy if exists "service role manages user friendships" on public.user_friendships;
drop policy if exists "service role manages user notifications" on public.user_notifications;
drop policy if exists "service role manages auth otps" on public.auth_otps;
drop policy if exists "service role manages online presence" on public.online_presence;
drop policy if exists "service role manages online match queue" on public.online_match_queue;
drop policy if exists "service role manages online games" on public.online_games;
drop policy if exists "service role manages online ratings" on public.online_ratings;
drop policy if exists "service role manages user ratings" on public.user_ratings;
drop policy if exists "service role manages user trust scores" on public.user_trust_scores;
drop policy if exists "service role manages user devices" on public.user_devices;
drop policy if exists "service role manages user bans" on public.user_bans;
drop policy if exists "service role manages user mutes" on public.user_mutes;
drop policy if exists "service role manages admin audit logs" on public.admin_audit_logs;
drop policy if exists "service role manages anti cheat reports" on public.anti_cheat_reports;
drop policy if exists "service role manages player reports" on public.player_reports;
drop policy if exists "service role manages user matchmaking stats" on public.user_matchmaking_stats;
drop policy if exists "service role manages user memberships" on public.user_memberships;
drop policy if exists "service role manages matchmaking events" on public.matchmaking_events;
drop policy if exists "service role manages matchmaking claim logs" on public.matchmaking_claim_logs;
drop policy if exists "service role manages matchmaking abuse logs" on public.matchmaking_abuse_logs;
drop policy if exists "service role manages user active locks" on public.user_active_locks;
drop policy if exists "service role manages online rating events" on public.online_rating_events;
drop policy if exists "service role manages online game moves" on public.online_game_moves;
drop policy if exists "service role manages online game tickets" on public.online_game_tickets;

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

create policy "service role manages user friendships"
on public.user_friendships
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user notifications"
on public.user_notifications
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages auth otps"
on public.auth_otps
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages online presence"
on public.online_presence
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages online match queue"
on public.online_match_queue
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages online games"
on public.online_games
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages online ratings"
on public.online_ratings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user ratings"
on public.user_ratings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user trust scores"
on public.user_trust_scores
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user devices"
on public.user_devices
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user bans"
on public.user_bans
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user mutes"
on public.user_mutes
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages admin audit logs"
on public.admin_audit_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages anti cheat reports"
on public.anti_cheat_reports
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages player reports"
on public.player_reports
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user matchmaking stats"
on public.user_matchmaking_stats
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user memberships"
on public.user_memberships
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages matchmaking events"
on public.matchmaking_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages matchmaking claim logs"
on public.matchmaking_claim_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages matchmaking abuse logs"
on public.matchmaking_abuse_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages user active locks"
on public.user_active_locks
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages online rating events"
on public.online_rating_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages online game moves"
on public.online_game_moves
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "service role manages online game tickets"
on public.online_game_tickets
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

notify pgrst, 'reload schema';
