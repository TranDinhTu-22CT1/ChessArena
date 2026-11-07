CREATE OR REPLACE FUNCTION public.quick_match_find_game_v3(p_user_id uuid, p_time_control text, p_mode text, p_rating integer DEFAULT NULL::integer, p_client_id text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text, p_region text DEFAULT 'global'::text, p_rating_range_preference integer DEFAULT 500, p_idempotency_key text DEFAULT NULL::text, p_renew_lease boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Pairing uses the server's rating history; the client rating is never trusted.
  select greatest(v_rating, coalesce(max(rating) filter (where games_played >= 10), v_rating) - 150,
    coalesce((select peak_rating from public.user_rating_peaks where user_id = p_user_id), v_rating) - 300)
  into v_rating from public.user_ratings where user_id = p_user_id;
  select case when coalesce(sum(games_played), 0) < 10 then 'provisional' else 'standard' end
  into v_pool from public.user_ratings where user_id = p_user_id;

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

  if v_me.id is not null and v_me.lease_expires_at <= v_now then
    update public.online_match_queue set status = 'stale', cancelled_at = v_now,
      cancel_reason = 'lease_expired', updated_at = v_now where id = v_me.id;
    v_me := null;
  end if;
  if v_me.id is not null and v_me.session_id <> left(p_session_id, 120) then
    if coalesce(v_me.lease_expires_at, v_me.last_seen + interval '25 seconds') <= v_now then
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

  if v_me.id is not null and (
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
      v_pool, 'waiting', v_now, v_now, v_now + interval '25 seconds',
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
          when p_renew_lease then v_now + interval '25 seconds'
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
    and (q.pool = v_pool or (v_now - least(q.joined_at, v_me.joined_at) >= interval '30 seconds'
      and abs(q.rating - v_rating) <= 200))
    and pg_try_advisory_xact_lock(hashtextextended('queue-v2:' || q.user_id::text, 0))
    and q.rating between v_rating - 200 and v_rating + 200
    and abs(v_rating - q.rating) <= least(
      public.matchmaking_elo_window(least(v_me.joined_at,q.joined_at),v_me.rating_range_preference),
      public.matchmaking_elo_window(least(v_me.joined_at,q.joined_at),q.rating_range_preference))
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
    abs(q.rating - v_rating) - least(extract(epoch from (v_now - q.joined_at)), 60) / 4,
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
          'matcher_version', 3
        )
      );
    end if;
    return jsonb_build_object(
      'status', 'waiting',
      'queue_ticket_id', v_me.id,
      'generation', v_me.generation,
      'lease_expires_at', v_me.lease_expires_at,
      'rating_window', v_window, 'rating', v_rating, 'joined_at', v_me.joined_at,
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
  -- Store actual ratings for results/history; the pairing floor is only for choosing opponents.
  select rating into v_white_rating from public.user_ratings where user_id=v_white_user and mode=p_mode;
  select rating into v_black_rating from public.user_ratings where user_id=v_black_user and mode=p_mode;
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
      'matcher_version', 3
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
      jsonb_build_object('generation', v_me.generation, 'matcher_version', 3)
    ),
    (
      v_opponent.user_id, v_opponent.id, v_game_id, 'matched', p_mode, p_time_control, v_pool,
      floor(extract(epoch from (v_now - v_opponent.joined_at)) * 1000)::integer,
      v_opponent.rating,
      public.matchmaking_elo_window(v_opponent.joined_at, v_opponent.rating_range_preference),
      abs(v_rating - v_opponent.rating), v_opponent.client_id, v_opponent.session_id,
      jsonb_build_object('generation', v_opponent.generation, 'matcher_version', 3)
    );

  return jsonb_build_object(
    'status', 'matched',
    'game_id', v_game_id,
    'queue_ticket_id', v_me.id,
    'generation', v_me.generation,
    'rating_window', v_window, 'rating', v_rating, 'joined_at', v_me.joined_at,
    'rating_gap', abs(v_rating - v_opponent.rating),
    'fairness_score', v_fairness,
    'region', v_region,
    'mode', p_mode,
    'pool', v_pool
  );
end;
$function$;
