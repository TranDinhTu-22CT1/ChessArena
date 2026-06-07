-- Wrap the deployed matcher instead of modifying its formatted source text.
-- The wrapper and the core execute in one transaction, so a ticket inserted
-- after waiting on a concurrently matched row is cancelled before commit.

do $migration$
begin
  if to_regprocedure(
    'public.quick_match_find_game_core(uuid,text,text,integer,text,text,text,integer,text)'
  ) is null then
    alter function public.quick_match_find_game(
      uuid,
      text,
      text,
      integer,
      text,
      text,
      text,
      integer,
      text
    ) rename to quick_match_find_game_core;
  end if;
end;
$migration$;

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
as $function$
declare
  v_result jsonb;
  v_existing_game uuid;
begin
  v_result := public.quick_match_find_game_core(
    p_user_id,
    p_time_control,
    p_mode,
    p_rating,
    p_client_id,
    p_session_id,
    p_region,
    p_rating_range_preference,
    p_idempotency_key
  );

  if coalesce(v_result ->> 'status', '') <> 'waiting' then
    return v_result;
  end if;

  select id into v_existing_game
  from public.online_games
  where status = 'active'
    and (white_user_id = p_user_id or black_user_id = p_user_id)
  order by created_at desc
  limit 1;

  if v_existing_game is null then
    return v_result;
  end if;

  update public.online_match_queue
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancel_reason = 'concurrent_match_won',
      updated_at = clock_timestamp()
  where user_id = p_user_id
    and status in ('waiting', 'claimed')
    and matched_game_id is null;

  update public.online_presence
  set status = 'playing',
      current_game_id = v_existing_game,
      current_queue_ticket_id = null,
      last_seen = clock_timestamp(),
      updated_at = clock_timestamp()
  where user_id = p_user_id;

  return jsonb_build_object(
    'status', 'matched',
    'game_id', v_existing_game,
    'queue_ticket_id', v_result -> 'queue_ticket_id',
    'reconnected', true,
    'race_recovered', true
  );
end;
$function$;

revoke all on function public.quick_match_find_game_core(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  text
) from public;

revoke all on function public.quick_match_find_game(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  text
) from public;

grant execute on function public.quick_match_find_game(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text,
  integer,
  text
) to service_role;

notify pgrst, 'reload schema';
