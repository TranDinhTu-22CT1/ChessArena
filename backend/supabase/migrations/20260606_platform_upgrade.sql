create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chessarena',
  'chessarena',
  true,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/x-chess-pgn',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.online_games
add column if not exists draw_offered_by uuid references public.users(id) on delete set null;

alter table public.online_games
add column if not exists draw_offered_at timestamptz;

alter table public.online_games
add column if not exists spectator_allowed boolean not null default true;

alter table public.online_games
add column if not exists white_disconnected_at timestamptz;

alter table public.online_games
add column if not exists black_disconnected_at timestamptz;

alter table public.online_games
add column if not exists disconnect_grace_seconds integer not null default 45;

alter table public.arena_tournaments
add column if not exists pairing_system text not null default 'arena'
check (pairing_system in ('arena', 'swiss', 'round_robin'));

alter table public.arena_tournaments
add column if not exists max_players integer not null default 100
check (max_players between 2 and 1000);

alter table public.arena_tournaments
add column if not exists current_round integer not null default 0;

alter table public.arena_tournaments
add column if not exists auto_manage boolean not null default true;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.users(id) on delete cascade,
  bucket text not null default 'chessarena',
  object_path text not null unique,
  public_url text not null,
  mime_type text not null,
  original_name text not null default 'file',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  purpose text not null default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  sender_user_id uuid references public.users(id) on delete set null,
  sender_role text not null check (sender_role in ('user', 'admin', 'system')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  read_by_user_at timestamptz,
  read_by_admin_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.support_status_events (
  id bigserial primary key,
  request_id uuid not null references public.support_requests(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text not null check (actor_role in ('user', 'admin', 'system')),
  old_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  provider text not null check (provider in ('paypal', 'momo', 'manual')),
  provider_transaction_id text,
  provider_event_id text,
  kind text not null default 'subscription'
    check (kind in ('subscription', 'renewal', 'refund', 'chargeback', 'adjustment')),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
  tier text,
  billing_cycle text,
  currency text not null default 'USD',
  amount numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_payment_transactions_provider_event
on public.payment_transactions(provider, provider_event_id);

create unique index if not exists idx_payment_transactions_provider_transaction_kind
on public.payment_transactions(provider, provider_transaction_id, kind);

create table if not exists public.puzzle_progress (
  user_id uuid primary key references public.users(id) on delete cascade,
  rating integer not null default 800 check (rating between 100 and 4000),
  points integer not null default 0 check (points >= 0),
  correct integer not null default 0 check (correct >= 0),
  attempted integer not null default 0 check (attempted >= 0),
  rush_best integer not null default 0 check (rush_best >= 0),
  streak_best integer not null default 0 check (streak_best >= 0),
  daily_streak integer not null default 0 check (daily_streak >= 0),
  seen_puzzle_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.puzzle_battles (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'finished', 'cancelled')),
  player_one_id uuid not null references public.users(id) on delete cascade,
  player_two_id uuid references public.users(id) on delete cascade,
  puzzle_ids jsonb not null default '[]'::jsonb,
  player_one_score integer not null default 0,
  player_two_score integer not null default 0,
  player_one_index integer not null default 0,
  player_two_index integer not null default 0,
  winner_user_id uuid references public.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default now() + interval '5 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_follows (
  follower_user_id uuid not null references public.users(id) on delete cascade,
  followed_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, followed_user_id),
  constraint user_follows_not_self check (follower_user_id <> followed_user_id)
);

create table if not exists public.activity_feed (
  id bigserial primary key,
  actor_user_id uuid references public.users(id) on delete cascade,
  type text not null,
  visibility text not null default 'public'
    check (visibility in ('public', 'followers', 'private')),
  subject_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.opening_repertoire (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  color text not null check (color in ('w', 'b')),
  name text not null,
  eco text,
  pgn text not null default '',
  notes text not null default '',
  source text not null default 'manual' check (source in ('manual', 'import', 'game')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anti_cheat_appeals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.anti_cheat_reports(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'accepted', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.online_game_chat (
  id bigserial primary key,
  game_id uuid not null references public.online_games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.online_game_spectators (
  game_id uuid not null references public.online_games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table if not exists public.tournament_pairings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.arena_tournaments(id) on delete cascade,
  round_number integer not null default 1,
  white_user_id uuid not null references public.users(id) on delete cascade,
  black_user_id uuid not null references public.users(id) on delete cascade,
  game_id uuid references public.online_games(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'finished', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round_number, white_user_id, black_user_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.api_rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.api_rate_limits%rowtype;
begin
  insert into public.api_rate_limits (key, count, reset_at, updated_at)
  values (p_key, 1, v_now + (greatest(p_window_ms, 1000)::text || ' milliseconds')::interval, v_now)
  on conflict (key) do update
  set count = case
      when public.api_rate_limits.reset_at <= v_now then 1
      else public.api_rate_limits.count + 1
    end,
    reset_at = case
      when public.api_rate_limits.reset_at <= v_now
        then v_now + (greatest(p_window_ms, 1000)::text || ' milliseconds')::interval
      else public.api_rate_limits.reset_at
    end,
    updated_at = v_now
  returning * into v_row;

  allowed := v_row.count <= greatest(p_limit, 1);
  retry_after := greatest(0, ceil(extract(epoch from (v_row.reset_at - v_now)))::integer);
  return next;
end;
$$;

create index if not exists idx_support_messages_request_created
on public.support_messages(request_id, created_at);

create index if not exists idx_support_status_events_request_created
on public.support_status_events(request_id, created_at);

create index if not exists idx_media_assets_owner_created
on public.media_assets(owner_user_id, created_at desc);

create index if not exists idx_payment_transactions_user_created
on public.payment_transactions(user_id, created_at desc);

create index if not exists idx_activity_feed_actor_created
on public.activity_feed(actor_user_id, created_at desc);

create index if not exists idx_activity_feed_visibility_created
on public.activity_feed(visibility, created_at desc);

create index if not exists idx_opening_repertoire_user_updated
on public.opening_repertoire(user_id, updated_at desc);

create index if not exists idx_anti_cheat_appeals_user_created
on public.anti_cheat_appeals(user_id, created_at desc);

create index if not exists idx_online_game_chat_game_created
on public.online_game_chat(game_id, created_at);

create index if not exists idx_tournament_pairings_tournament_round
on public.tournament_pairings(tournament_id, round_number, status);

alter table public.media_assets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_status_events enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.puzzle_progress enable row level security;
alter table public.puzzle_battles enable row level security;
alter table public.user_follows enable row level security;
alter table public.activity_feed enable row level security;
alter table public.opening_repertoire enable row level security;
alter table public.anti_cheat_appeals enable row level security;
alter table public.online_game_chat enable row level security;
alter table public.online_game_spectators enable row level security;
alter table public.tournament_pairings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.api_rate_limits enable row level security;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
