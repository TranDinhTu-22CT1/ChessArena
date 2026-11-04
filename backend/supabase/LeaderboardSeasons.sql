-- Existing installations: run this entire file in Supabase SQL Editor.
-- Read-only leaderboard RPC. No Elo, game, payment or friendship rows are reset.
begin;
set local lock_timeout = '10s';

-- BEGIN LEADERBOARD SEASONS
create index if not exists idx_online_games_season_finished
  on public.online_games(finished_at, id)
  where rated and match_type='quick' and status in ('checkmate','draw','resigned');

create or replace function public.get_leaderboard(
  p_user uuid, p_mode text default 'rapid', p_period text default 'all',
  p_offset integer default 0, p_page integer default 1, p_limit integer default 20
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_start timestamptz; v_end timestamptz; v_previous timestamptz;
  v_step interval; v_rows jsonb; v_me jsonb; v_old jsonb; v_total integer; v_page integer;
begin
  if p_user is null or p_mode is null or p_mode not in ('bullet','blitz','rapid','classical')
    or p_period is null or p_period not in ('all','week','month')
    or p_offset is null or p_offset not between 0 and 12
    or p_page is null or p_page not between 1 and 1000000
    or p_limit is null or p_limit not between 10 and 50 then
    raise exception 'Invalid leaderboard query.' using errcode='22023';
  end if;

  if p_period='all' then
    with ranked as materialized (
      select r.*, row_number() over(order by rating desc,games_played desc,updated_at,user_id) as rank
      from public.user_ratings r where mode=p_mode and games_played>0
    ), decorated as materialized (
      select r.rank, r.user_id, jsonb_build_object(
        'rank',r.rank,'userId',r.user_id,'username',u.username,'displayName',u.display_name,
        'photoURL',u.photo_url,'mode',r.mode,'rating',r.rating,'provisional',r.provisional,
        'gamesPlayed',r.games_played,'wins',r.wins,'losses',r.losses,'draws',r.draws,
        'winRate',round(100.0*r.wins/greatest(1,r.games_played)), 'updatedAt',r.updated_at
      ) as item from ranked r join public.users u on u.id=r.user_id
    ), paging as (
      select count(*)::integer as total,
        least(p_page,greatest(1,ceil(count(*)::numeric/p_limit)::integer)) as page from decorated
    )
    select coalesce((select jsonb_agg(d.item order by d.rank) from decorated d
        where d.rank between (paging.page-1)*p_limit+1 and paging.page*p_limit),'[]'::jsonb),
      (select item from decorated where user_id=p_user),total,page
    into v_rows,v_me,v_total,v_page from paging;
  else
    v_step:=case when p_period='week' then interval '1 week' else interval '1 month' end;
    v_start:=(date_trunc(p_period,now() at time zone 'Asia/Ho_Chi_Minh')-p_offset*v_step)
      at time zone 'Asia/Ho_Chi_Minh';
    v_end:=((v_start at time zone 'Asia/Ho_Chi_Minh')+v_step) at time zone 'Asia/Ho_Chi_Minh';
    v_previous:=((v_start at time zone 'Asia/Ho_Chi_Minh')-v_step) at time zone 'Asia/Ho_Chi_Minh';

    -- The first three finalized quick games per pair per local calendar day
    -- count across all modes, not three per mode. Never use client statistics.
    with eligible as materialized (
      select g.*, row_number() over(
        partition by least(g.white_user_id,g.black_user_id),greatest(g.white_user_id,g.black_user_id),
          (g.finished_at at time zone 'Asia/Ho_Chi_Minh')::date
        order by g.finished_at,g.id) as pair_game
      from public.online_games g join public.online_rating_events e on e.game_id=g.id
        and e.result=g.result and e.white_user_id=g.white_user_id and e.black_user_id=g.black_user_id
      where g.rated and g.match_type='quick' and g.status in ('checkmate','draw','resigned')
        and g.finished_at>=v_previous and g.finished_at<v_end
        and g.finished_at<=now() and g.white_user_id<>g.black_user_id
        and g.result in ('1-0','0-1','1/2-1/2')
    ), participants as (
      select case when g.finished_at>=v_start then 0 else 1 end as period_index,
        p.user_id,g.finished_at,
        case when g.result='1/2-1/2' then 1 when g.result=p.win_result then 3 else 0 end as points,
        (g.result=p.win_result)::integer as win,
        (g.result='1/2-1/2')::integer as draw
      from eligible g cross join lateral
        (values (g.white_user_id,'1-0'),(g.black_user_id,'0-1')) p(user_id,win_result)
      where g.pair_game<=3 and g.mode=p_mode
    ), totals as (
      select period_index,user_id,sum(points)::integer as points,count(*)::integer as games,
        sum(win)::integer as wins,sum(draw)::integer as draws,max(finished_at) as updated_at
      from participants group by period_index,user_id
    ), ranked as (
      select *,row_number() over(partition by period_index order by points desc,wins desc,updated_at,user_id) as rank
      from totals
    ), decorated as materialized (
      select r.period_index,r.rank,r.user_id,jsonb_build_object(
        'rank',r.rank,'userId',r.user_id,'username',u.username,'displayName',u.display_name,
        'photoURL',u.photo_url,'mode',p_mode,'rating',coalesce(ur.rating,400),
        'provisional',coalesce(ur.provisional,true),'points',r.points,'gamesPlayed',r.games,
        'wins',r.wins,'draws',r.draws,'losses',r.games-r.wins-r.draws,
        'winRate',round(100.0*r.wins/r.games),'updatedAt',r.updated_at
      ) as item from ranked r join public.users u on u.id=r.user_id
      left join public.user_ratings ur on ur.user_id=r.user_id and ur.mode=p_mode
    ), paging as (
      select count(*)::integer as total,
        least(p_page,greatest(1,ceil(count(*)::numeric/p_limit)::integer)) as page
      from decorated where period_index=0
    )
    select coalesce((select jsonb_agg(d.item order by d.rank) from decorated d
        where d.period_index=0 and d.rank between (paging.page-1)*p_limit+1 and paging.page*p_limit),'[]'::jsonb),
      (select item from decorated where period_index=0 and user_id=p_user),
      (select item from decorated where period_index=1 and user_id=p_user),total,page
    into v_rows,v_me,v_old,v_total,v_page from paging;
  end if;
  return jsonb_build_object('ok',true,'mode',p_mode,'period',p_period,'offset',p_offset,
    'page',v_page,'limit',p_limit,'entries',v_rows,'currentUser',v_me,'previousUser',v_old,
    'total',v_total,'totalPages',greatest(1,ceil(v_total::numeric/p_limit)::integer),
    'periodStart',v_start,'periodEnd',v_end,'serverNow',now(),'timezone','Asia/Ho_Chi_Minh',
    'rules',jsonb_build_object('winPoints',3,'drawPoints',1,'opponentDailyLimit',3));
end $$;
revoke all on function public.get_leaderboard(uuid,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.get_leaderboard(uuid,text,text,integer,integer,integer) to service_role;
-- END LEADERBOARD SEASONS

notify pgrst, 'reload schema';
commit;
