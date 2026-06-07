-- ChessArena matchmaking v2: leased tickets, session ownership, dynamic Elo,
-- progressive region expansion, idempotent match commits, and an outbox.

alter table public.online_match_queue
add column if not exists generation bigint not null default 1;

alter table public.online_match_queue
add column if not exists lease_expires_at timestamptz;

alter table public.online_match_queue
add column if not exists region_scope text not null default 'global';

alter table public.online_games
add column if not exists matchmaking_match_key text;

create table if not exists public.matchmaking_user_generations (
  user_id uuid primary key references public.users(id) on delete cascade,
  generation bigint not null default 0 check (generation >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.matchmaking_outbox (
  id bigserial primary key,
  event_key text not null unique,
  event_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

update public.online_match_queue
set lease_expires_at = coalesce(lease_expires_at, last_seen + interval '15 seconds'),
    region_scope = case
      when lower(coalesce(region, '')) in ('vn', 'vietnam', 'asia/ho_chi_minh', 'asia/saigon') then 'vn'
      when lower(coalesce(region, '')) in ('sea', 'asia/bangkok', 'asia/singapore', 'asia/jakarta', 'asia/manila', 'asia/kuala_lumpur') then 'sea'
      when lower(coalesce(region, '')) in ('asia', 'asia/tokyo', 'asia/seoul', 'asia/hong_kong', 'asia/shanghai', 'asia/taipei') then 'asia'
      else 'global'
    end
where lease_expires_at is null
   or region_scope = 'global';

create unique index if not exists idx_online_games_match_key_unique
on public.online_games(matchmaking_match_key)
where matchmaking_match_key is not null;

create index if not exists idx_online_match_queue_v2_candidates
on public.online_match_queue(time_control, mode, pool, region_scope, rating, joined_at, id)
include (user_id, display_name, rating_min, rating_max, generation, lease_expires_at, session_id)
where status = 'waiting';

create index if not exists idx_matchmaking_outbox_pending
on public.matchmaking_outbox(available_at, id)
where delivered_at is null;

alter table public.matchmaking_user_generations enable row level security;
alter table public.matchmaking_outbox enable row level security;

drop policy if exists "service role manages matchmaking generations"
on public.matchmaking_user_generations;
create policy "service role manages matchmaking generations"
on public.matchmaking_user_generations
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role manages matchmaking outbox"
on public.matchmaking_outbox;
create policy "service role manages matchmaking outbox"
on public.matchmaking_outbox
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.matchmaking_elo_window(
  p_joined_at timestamptz,
  p_preference integer default 500
)
returns integer
language sql
stable
as $function$
  select case
    when now() - p_joined_at >= interval '120 seconds' then 4000
    else least(
      greatest(coalesce(p_preference, 500), 50),
      case
        when now() - p_joined_at < interval '10 seconds' then 50
        when now() - p_joined_at < interval '20 seconds' then 100
        when now() - p_joined_at < interval '30 seconds' then 150
        when now() - p_joined_at < interval '60 seconds' then 200
        when now() - p_joined_at < interval '90 seconds' then 300
        else 500
      end
    )
  end;
$function$;

create or replace function public.matchmaking_region_rank(p_region text)
returns integer
language sql
immutable
as $function$
  select case lower(coalesce(p_region, 'global'))
    when 'vn' then 0
    when 'sea' then 1
    when 'asia' then 2
    else 3
  end;
$function$;

create or replace function public.matchmaking_region_limit(
  p_region text,
  p_joined_at timestamptz
)
returns integer
language sql
stable
as $function$
  select greatest(
    public.matchmaking_region_rank(p_region),
    case
      when now() - p_joined_at < interval '15 seconds' then public.matchmaking_region_rank(p_region)
      when now() - p_joined_at < interval '30 seconds' then 1
      when now() - p_joined_at < interval '60 seconds' then 2
      else 3
    end
  );
$function$;

create or replace function public.matchmaking_regions_compatible(
  p_region_a text,
  p_joined_a timestamptz,
  p_region_b text,
  p_joined_b timestamptz
)
returns boolean
language sql
stable
as $function$
  select public.matchmaking_region_rank(p_region_a)
           <= public.matchmaking_region_limit(p_region_b, p_joined_b)
     and public.matchmaking_region_rank(p_region_b)
           <= public.matchmaking_region_limit(p_region_a, p_joined_a);
$function$;

create or replace function public.quick_match_find_game_v2(
  p_user_id uuid,
  p_time_control text,
  p_mode text,
  p_rating integer default null,
  p_client_id text default null,
  p_session_id text default null,
  p_region text default 'global',
  p_rating_range_preference integer default 500,
  p_idempotency_key text default null,
  p_renew_lease boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_user public.users%rowtype;
  v_me public.online_match_queue%rowtype;
  v_opponent public.online_match_queue%rowtype;
  v_existing_game uuid;
  v_game_id uuid;
  v_rating integer;
  v_pool text := 'standard';
  v_region text := case lower(coalesce(p_region, 'global'))
    when 'vn' then 'vn'
    when 'sea' then 'sea'
    when 'asia' then 'asia'
    else 'global'
  end;
  v_window integer;
  v_generation bigint;
  v_is_white boolean;
  v_white_user uuid;
  v_black_user uuid;
  v_white_name text;
  v_black_name text;
  v_white_ticket uuid;
  v_black_ticket uuid;
  v_white_rating integer;
  v_black_rating integer;
  v_match_key text;
  v_wait_ms integer;
  v_fairness integer;
  v_updated integer;
  v_cooldown_until timestamptz;
begin
  if p_time_control not in ('180+0', '300+0', '600+0', '900+10') then
    raise exception 'invalid time control' using errcode = '22023';
  end if;
  if p_mode not in ('bullet', 'blitz', 'rapid', 'classical') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;
  if nullif(left(coalesce(p_session_id, ''), 120), '') is null then
    raise exception 'matchmaking session is required' using errcode = '22023';
  end if;

  select * into v_user from public.users where id = p_user_id;
  if not found then
    raise exception 'user not found' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('queue-v2:' || p_user_id::text, 0));

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
    return jsonb_build_object('status', 'cooldown', 'cooldown_until', v_cooldown_until);
  end if;

  if p_renew_lease then
    insert into public.user_matchmaking_stats (
      user_id, finds, last_find_at, last_client_id, last_session_id, updated_at
    ) values (
      p_user_id, 1, v_now, left(p_client_id, 120), left(p_session_id, 120), v_now
    )
    on conflict (user_id) do update
    set finds = public.user_matchmaking_stats.finds + 1,
        last_find_at = excluded.last_find_at,
        last_client_id = excluded.last_client_id,
        last_session_id = excluded.last_session_id,
        updated_at = excluded.updated_at;
  end if;

  select * into v_me
  from public.online_match_queue
  where user_id = p_user_id
    and status in ('waiting', 'claimed')
  order by joined_at desc
  limit 1
  for update;

  if found and v_me.session_id <> left(p_session_id, 120) then
    if coalesce(v_me.lease_expires_at, v_me.last_seen + interval '15 seconds') <= v_now then
      update public.online_match_queue
      set status = 'stale',
          cancelled_at = v_now,
          cancel_reason = 'session_lease_expired',
          updated_at = v_now
      where id = v_me.id;
      v_me := null;
    else
      return jsonb_build_object(
        'status', 'owned_elsewhere',
        'queue_ticket_id', v_me.id,
        'lease_expires_at', v_me.lease_expires_at
      );
    end if;
  end if;

  if found and (
    v_me.time_control <> p_time_control
    or v_me.mode <> p_mode
    or v_me.pool <> v_pool
  ) then
    update public.online_match_queue
    set status = 'cancelled',
        cancelled_at = v_now,
        cancel_reason = 'new_search_parameters',
        lease_expires_at = v_now,
        updated_at = v_now
    where id = v_me.id;
    v_me := null;
  end if;

  if v_me.id is null then
    if not p_renew_lease then
      return jsonb_build_object('status', 'idle');
    end if;
    insert into public.matchmaking_user_generations (user_id, generation, updated_at)
    values (p_user_id, 1, v_now)
    on conflict (user_id) do update
    set generation = public.matchmaking_user_generations.generation + 1,
        updated_at = excluded.updated_at
    returning generation into v_generation;

    v_window := public.matchmaking_elo_window(v_now, p_rating_range_preference);
    insert into public.online_match_queue (
      user_id, firebase_uid, display_name, time_control, mode, rating,
      rating_min, rating_max, rating_range_preference, pool, status,
      joined_at, last_seen, lease_expires_at, client_id, session_id,
      region, region_scope, idempotency_key, generation, queue_shard,
      created_at, updated_at
    ) values (
      p_user_id, v_user.firebase_uid, v_user.display_name, p_time_control, p_mode, v_rating,
      greatest(100, v_rating - v_window), least(4000, v_rating + v_window),
      greatest(50, least(coalesce(p_rating_range_preference, 500), 4000)),
      v_pool, 'waiting', v_now, v_now, v_now + interval '15 seconds',
      left(p_client_id, 120), left(p_session_id, 120), v_region, v_region,
      nullif(left(coalesce(p_idempotency_key, ''), 120), ''), v_generation,
      (abs(hashtextextended(p_time_control || ':' || p_mode || ':' || v_pool || ':' || v_region, 0)) % 64)::integer,
      v_now, v_now
    )
    returning * into v_me;
  else
    v_window := public.matchmaking_elo_window(v_me.joined_at, v_me.rating_range_preference);
    update public.online_match_queue
    set rating = v_rating,
        rating_min = greatest(100, v_rating - v_window),
        rating_max = least(4000, v_rating + v_window),
        last_seen = case when p_renew_lease then v_now else last_seen end,
        lease_expires_at = case
          when p_renew_lease then v_now + interval '15 seconds'
          else lease_expires_at
        end,
        client_id = case when p_renew_lease then left(p_client_id, 120) else client_id end,
        region = v_region,
        region_scope = v_region,
        updated_at = v_now
    where id = v_me.id
    returning * into v_me;
  end if;

  if p_renew_lease then
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
  end if;

  select q.* into v_opponent
  from public.online_match_queue q
  where q.id <> v_me.id
    and q.user_id <> p_user_id
    and q.status = 'waiting'
    and q.lease_expires_at > v_now
    and q.time_control = p_time_control
    and q.mode = p_mode
    and q.pool = v_pool
    and q.rating between v_me.rating_min and v_me.rating_max
    and v_rating between q.rating_min and q.rating_max
    and public.matchmaking_regions_compatible(
      v_me.region_scope, v_me.joined_at, q.region_scope, q.joined_at
    )
    and not exists (
      select 1
      from public.online_games g
      where g.status = 'active'
        and (g.white_user_id = q.user_id or g.black_user_id = q.user_id)
    )
  order by
    abs(q.rating - v_rating),
    abs(public.matchmaking_region_rank(q.region_scope) - public.matchmaking_region_rank(v_me.region_scope)),
    q.joined_at,
    q.id
  for update skip locked
  limit 1;

  if not found then
    if p_renew_lease then
      insert into public.matchmaking_events (
        user_id, ticket_id, event_type, mode, time_control, pool, rating,
        rating_window, client_id, session_id, metadata
      ) values (
        p_user_id, v_me.id, 'waiting', p_mode, p_time_control, v_pool, v_rating,
        v_window, left(p_client_id, 120), left(p_session_id, 120),
        jsonb_build_object(
          'generation', v_me.generation,
          'region', v_region,
          'region_limit', public.matchmaking_region_limit(v_region, v_me.joined_at),
          'lease_expires_at', v_me.lease_expires_at,
          'matcher_version', 2
        )
      );
    end if;
    return jsonb_build_object(
      'status', 'waiting',
      'queue_ticket_id', v_me.id,
      'generation', v_me.generation,
      'lease_expires_at', v_me.lease_expires_at,
      'rating_window', v_window,
      'region', v_region,
      'region_limit', public.matchmaking_region_limit(v_region, v_me.joined_at),
      'mode', p_mode,
      'pool', v_pool
    );
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
  v_match_key := least(v_me.id, v_opponent.id)::text || ':' || greatest(v_me.id, v_opponent.id)::text;
  v_wait_ms := floor(extract(epoch from (v_now - least(v_me.joined_at, v_opponent.joined_at))) * 1000)::integer;
  v_fairness := public.matchmaking_fairness_score(
    v_wait_ms,
    abs(v_rating - v_opponent.rating),
    v_me.region_scope = v_opponent.region_scope,
    false
  );

  insert into public.online_games (
    status, match_type, white_user_id, black_user_id, white_name, black_name,
    fen, pgn, turn, result, time_control, mode, rated, last_move_at, created_at,
    started_at, updated_at, white_rating_before, black_rating_before,
    matchmaking_ticket_white, matchmaking_ticket_black, matchmaking_pool,
    matchmaking_match_key, rating_gap, fairness_score, match_region
  ) values (
    'active', 'quick', v_white_user, v_black_user, v_white_name, v_black_name,
    'start', '', 'w', '*', p_time_control, p_mode, true, v_now, v_now,
    v_now, v_now, v_white_rating, v_black_rating,
    v_white_ticket, v_black_ticket, v_pool, v_match_key,
    abs(v_rating - v_opponent.rating), v_fairness,
    case
      when public.matchmaking_region_rank(v_me.region_scope)
        >= public.matchmaking_region_rank(v_opponent.region_scope)
      then v_me.region_scope else v_opponent.region_scope
    end
  )
  on conflict (matchmaking_match_key) where matchmaking_match_key is not null
  do update set updated_at = excluded.updated_at
  returning id into v_game_id;

  insert into public.online_game_tickets (ticket_id, game_id, color)
  values (v_white_ticket, v_game_id, 'w'), (v_black_ticket, v_game_id, 'b')
  on conflict (ticket_id) do nothing;

  update public.online_match_queue
  set status = 'matched',
      claimed_by = p_user_id,
      claimed_at = v_now,
      matched_game_id = v_game_id,
      lease_expires_at = v_now,
      updated_at = v_now
  where id in (v_me.id, v_opponent.id)
    and status = 'waiting';
  get diagnostics v_updated = row_count;
  if v_updated <> 2 then
    raise exception 'match commit lost a queue ticket' using errcode = '40001';
  end if;

  delete from public.user_active_locks
  where user_id in (p_user_id, v_opponent.user_id);

  insert into public.user_active_locks (user_id, game_id, acquired_at)
  values (p_user_id, v_game_id, v_now), (v_opponent.user_id, v_game_id, v_now);

  update public.online_presence
  set status = 'playing',
      current_game_id = v_game_id,
      current_queue_ticket_id = null,
      last_seen = v_now,
      updated_at = v_now
  where user_id in (p_user_id, v_opponent.user_id);

  insert into public.matchmaking_outbox (event_key, event_type, aggregate_id, payload)
  values (
    'match-created:' || v_game_id::text,
    'match.created',
    v_game_id,
    jsonb_build_object(
      'game_id', v_game_id,
      'white_user_id', v_white_user,
      'black_user_id', v_black_user,
      'white_session_id', case when v_is_white then v_me.session_id else v_opponent.session_id end,
      'black_session_id', case when v_is_white then v_opponent.session_id else v_me.session_id end,
      'white_ticket_id', v_white_ticket,
      'black_ticket_id', v_black_ticket,
      'mode', p_mode,
      'time_control', p_time_control,
      'pool', v_pool,
      'rating_gap', abs(v_rating - v_opponent.rating),
      'fairness_score', v_fairness,
      'matcher_version', 2
    )
  )
  on conflict (event_key) do nothing;

  insert into public.matchmaking_events (
    user_id, ticket_id, game_id, event_type, mode, time_control, pool,
    wait_ms, rating, rating_window, rating_gap, client_id, session_id, metadata
  ) values
    (
      p_user_id, v_me.id, v_game_id, 'matched', p_mode, p_time_control, v_pool,
      floor(extract(epoch from (v_now - v_me.joined_at)) * 1000)::integer,
      v_rating, v_window, abs(v_rating - v_opponent.rating),
      left(p_client_id, 120), left(p_session_id, 120),
      jsonb_build_object('generation', v_me.generation, 'matcher_version', 2)
    ),
    (
      v_opponent.user_id, v_opponent.id, v_game_id, 'matched', p_mode, p_time_control, v_pool,
      floor(extract(epoch from (v_now - v_opponent.joined_at)) * 1000)::integer,
      v_opponent.rating,
      public.matchmaking_elo_window(v_opponent.joined_at, v_opponent.rating_range_preference),
      abs(v_rating - v_opponent.rating), v_opponent.client_id, v_opponent.session_id,
      jsonb_build_object('generation', v_opponent.generation, 'matcher_version', 2)
    );

  return jsonb_build_object(
    'status', 'matched',
    'game_id', v_game_id,
    'queue_ticket_id', v_me.id,
    'generation', v_me.generation,
    'rating_window', v_window,
    'rating_gap', abs(v_rating - v_opponent.rating),
    'fairness_score', v_fairness,
    'region', v_region,
    'mode', p_mode,
    'pool', v_pool
  );
end;
$function$;

create or replace function public.quick_match_heartbeat_v2(
  p_user_id uuid,
  p_ticket_id uuid,
  p_client_id text,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ticket public.online_match_queue%rowtype;
  v_window integer;
begin
  update public.online_match_queue
  set last_seen = clock_timestamp(),
      lease_expires_at = clock_timestamp() + interval '15 seconds',
      client_id = coalesce(left(p_client_id, 120), client_id),
      updated_at = clock_timestamp(),
      rating_min = greatest(100, rating - public.matchmaking_elo_window(joined_at, rating_range_preference)),
      rating_max = least(4000, rating + public.matchmaking_elo_window(joined_at, rating_range_preference))
  where id = p_ticket_id
    and user_id = p_user_id
    and session_id = left(p_session_id, 120)
    and status = 'waiting'
  returning * into v_ticket;

  if not found then
    return jsonb_build_object('status', 'idle');
  end if;

  v_window := public.matchmaking_elo_window(v_ticket.joined_at, v_ticket.rating_range_preference);
  return jsonb_build_object(
    'status', 'waiting',
    'queue_ticket_id', v_ticket.id,
    'generation', v_ticket.generation,
    'lease_expires_at', v_ticket.lease_expires_at,
    'rating_window', v_window,
    'region_limit', public.matchmaking_region_limit(v_ticket.region_scope, v_ticket.joined_at)
  );
end;
$function$;

create or replace function public.quick_match_cancel_v2(
  p_user_id uuid,
  p_ticket_id uuid,
  p_session_id text,
  p_reason text default 'user_cancelled'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cancelled uuid;
  v_cooldown_until timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('queue-v2:' || p_user_id::text, 0));

  update public.online_match_queue
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancel_reason = left(coalesce(p_reason, 'user_cancelled'), 80),
      lease_expires_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_ticket_id
    and user_id = p_user_id
    and session_id = left(p_session_id, 120)
    and status in ('waiting', 'claimed')
  returning id into v_cancelled;

  if v_cancelled is not null then
    update public.online_presence
    set status = 'online',
        current_queue_ticket_id = null,
        last_seen = clock_timestamp(),
        updated_at = clock_timestamp()
    where user_id = p_user_id
      and current_queue_ticket_id = v_cancelled;

    insert into public.user_matchmaking_stats (
      user_id, cancels, last_cancel_at, cooldown_until, updated_at
    ) values (
      p_user_id, 1, clock_timestamp(), null, clock_timestamp()
    )
    on conflict (user_id) do update
    set cancels = public.user_matchmaking_stats.cancels + 1,
        last_cancel_at = clock_timestamp(),
        cooldown_until = case
          when public.user_matchmaking_stats.last_cancel_at
            > clock_timestamp() - interval '30 seconds'
          then clock_timestamp()
            + least(public.user_matchmaking_stats.cancels + 1, 10) * interval '2 seconds'
          else null
        end,
        updated_at = clock_timestamp()
    returning cooldown_until into v_cooldown_until;
  end if;

  return jsonb_build_object(
    'status', case when v_cancelled is null then 'ignored' else 'cancelled' end,
    'queue_ticket_id', v_cancelled,
    'cooldown_until', v_cooldown_until
  );
end;
$function$;

create or replace function public.commit_online_move_v2(
  p_game_id uuid,
  p_user_id uuid,
  p_expected_ply integer,
  p_expected_turn text,
  p_san text,
  p_lan text,
  p_from_square text,
  p_to_square text,
  p_promotion text,
  p_fen_after text,
  p_pgn_after text,
  p_next_turn text,
  p_next_status text,
  p_result text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_game public.online_games%rowtype;
  v_color text;
  v_current_ply integer;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_game
  from public.online_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active' using errcode = '40001';
  end if;

  v_color := case
    when v_game.white_user_id = p_user_id then 'w'
    when v_game.black_user_id = p_user_id then 'b'
    else null
  end;
  if v_color is null then
    raise exception 'player is not in game' using errcode = '42501';
  end if;
  if v_color <> p_expected_turn or v_game.turn <> p_expected_turn then
    raise exception 'turn changed' using errcode = '40001';
  end if;

  select coalesce(max(ply), 0)::integer into v_current_ply
  from public.online_game_moves
  where game_id = p_game_id;
  if v_current_ply + 1 <> p_expected_ply then
    raise exception 'ply changed' using errcode = '40001';
  end if;

  insert into public.online_game_moves (
    game_id, ply, user_id, color, san, lan, from_square, to_square,
    promotion, fen_after, created_at
  ) values (
    p_game_id, p_expected_ply, p_user_id, v_color, p_san, p_lan,
    p_from_square, p_to_square, nullif(p_promotion, ''), p_fen_after, v_now
  );

  update public.online_games
  set status = p_next_status,
      fen = p_fen_after,
      pgn = p_pgn_after,
      turn = p_next_turn,
      result = p_result,
      last_move_at = v_now,
      finished_at = case when p_next_status = 'active' then null else v_now end,
      updated_at = v_now
  where id = p_game_id
  returning * into v_game;

  return to_jsonb(v_game);
end;
$function$;

create or replace view public.matchmaking_integrity_issues as
select 'active_ticket_without_live_lease'::text as issue_type, q.id::text as entity_id, q.user_id, q.matched_game_id as game_id
from public.online_match_queue q
where q.status in ('waiting', 'claimed')
  and coalesce(q.lease_expires_at, q.last_seen + interval '15 seconds') < now()
union all
select 'matched_ticket_without_game', q.id::text, q.user_id, q.matched_game_id
from public.online_match_queue q
where q.status = 'matched'
  and (q.matched_game_id is null or not exists (
    select 1 from public.online_games g where g.id = q.matched_game_id
  ))
union all
select 'active_lock_without_active_game', l.user_id::text, l.user_id, l.game_id
from public.user_active_locks l
where not exists (
  select 1 from public.online_games g where g.id = l.game_id and g.status = 'active'
)
union all
select 'active_game_without_two_tickets', g.id::text, null::uuid, g.id
from public.online_games g
where g.status = 'active'
  and g.match_type = 'quick'
  and (select count(*) from public.online_game_tickets t where t.game_id = g.id) <> 2;

create or replace view public.matchmaking_metrics_5m as
select
  date_trunc('minute', created_at)
    - make_interval(mins => extract(minute from created_at)::integer % 5) as bucket,
  mode,
  time_control,
  pool,
  count(*) filter (where event_type = 'waiting') as waiting_events,
  count(*) filter (where event_type = 'matched') as matched_players,
  count(*) filter (where event_type = 'queue_cancelled') as cancelled_events,
  percentile_cont(0.50) within group (order by wait_ms)
    filter (where event_type = 'matched') as p50_wait_ms,
  percentile_cont(0.95) within group (order by wait_ms)
    filter (where event_type = 'matched') as p95_wait_ms,
  percentile_cont(0.99) within group (order by wait_ms)
    filter (where event_type = 'matched') as p99_wait_ms,
  avg(rating_gap) filter (where event_type = 'matched') as average_rating_gap
from public.matchmaking_events
where created_at >= now() - interval '7 days'
group by 1, mode, time_control, pool;

create or replace function public.reconcile_matchmaking_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_expired_tickets integer := 0;
  v_broken_matched_tickets integer := 0;
  v_removed_locks integer := 0;
  v_fixed_presence integer := 0;
  v_active_games_without_tickets integer := 0;
  v_pending_outbox integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('matchmaking-reconcile-v2', 0)) then
    return jsonb_build_object('status', 'already_running');
  end if;

  with expired as (
    update public.online_match_queue
    set status = 'stale',
        cancelled_at = clock_timestamp(),
        cancel_reason = 'lease_expired',
        updated_at = clock_timestamp()
    where status in ('waiting', 'claimed')
      and coalesce(lease_expires_at, last_seen + interval '15 seconds') < clock_timestamp()
    returning id
  )
  select count(*) into v_expired_tickets from expired;

  with broken as (
    update public.online_match_queue q
    set status = 'cancelled',
        cancelled_at = clock_timestamp(),
        cancel_reason = 'matched_game_missing',
        updated_at = clock_timestamp()
    where q.status = 'matched'
      and (
        q.matched_game_id is null
        or not exists (select 1 from public.online_games g where g.id = q.matched_game_id)
      )
    returning q.id
  )
  select count(*) into v_broken_matched_tickets from broken;

  with removed as (
    delete from public.user_active_locks l
    where not exists (
      select 1 from public.online_games g
      where g.id = l.game_id and g.status = 'active'
    )
    returning l.user_id
  )
  select count(*) into v_removed_locks from removed;

  with fixed as (
    update public.online_presence p
    set status = 'online',
        current_queue_ticket_id = null,
        updated_at = clock_timestamp()
    where p.status = 'queue'
      and not exists (
        select 1
        from public.online_match_queue q
        where q.user_id = p.user_id
          and q.status in ('waiting', 'claimed')
          and coalesce(q.lease_expires_at, q.last_seen + interval '15 seconds') > clock_timestamp()
      )
    returning p.user_id
  )
  select count(*) into v_fixed_presence from fixed;

  select count(*) into v_active_games_without_tickets
  from public.online_games g
  where g.status = 'active'
    and g.match_type = 'quick'
    and (select count(*) from public.online_game_tickets t where t.game_id = g.id) <> 2;

  select count(*) into v_pending_outbox
  from public.matchmaking_outbox
  where delivered_at is null
    and available_at <= clock_timestamp();

  insert into public.matchmaking_events (event_type, metadata)
  values ('reconciliation_v2', jsonb_build_object(
    'expired_tickets', v_expired_tickets,
    'broken_matched_tickets', v_broken_matched_tickets,
    'removed_locks', v_removed_locks,
    'fixed_presence', v_fixed_presence,
    'active_games_without_tickets', v_active_games_without_tickets,
    'pending_outbox', v_pending_outbox
  ));

  return jsonb_build_object(
    'status', 'completed',
    'expired_tickets', v_expired_tickets,
    'broken_matched_tickets', v_broken_matched_tickets,
    'removed_locks', v_removed_locks,
    'fixed_presence', v_fixed_presence,
    'active_games_without_tickets', v_active_games_without_tickets,
    'pending_outbox', v_pending_outbox
  );
end;
$function$;

revoke all on function public.quick_match_find_game_v2(uuid, text, text, integer, text, text, text, integer, text, boolean) from public;
revoke all on function public.quick_match_heartbeat_v2(uuid, uuid, text, text) from public;
revoke all on function public.quick_match_cancel_v2(uuid, uuid, text, text) from public;
grant execute on function public.quick_match_find_game_v2(uuid, text, text, integer, text, text, text, integer, text, boolean) to service_role;
grant execute on function public.quick_match_heartbeat_v2(uuid, uuid, text, text) to service_role;
grant execute on function public.quick_match_cancel_v2(uuid, uuid, text, text) to service_role;
revoke all on function public.commit_online_move_v2(
  uuid, uuid, integer, text, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.commit_online_move_v2(
  uuid, uuid, integer, text, text, text, text, text, text, text, text, text, text, text
) to service_role;
revoke all on function public.reconcile_matchmaking_v2() from public;
grant execute on function public.reconcile_matchmaking_v2() to service_role;

revoke all on public.matchmaking_integrity_issues from public, anon, authenticated;
revoke all on public.matchmaking_metrics_5m from public, anon, authenticated;
grant select on public.matchmaking_integrity_issues to service_role;
grant select on public.matchmaking_metrics_5m to service_role;

notify pgrst, 'reload schema';
