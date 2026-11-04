-- Existing installations: apply this entire file before deploying the updated API/UI.
-- Additive; preserves existing games, ratings, puzzle progress and payments.
begin;
set local lock_timeout = '10s';
-- BEGIN SECURITY UPGRADE
alter table public.bot_personas enable row level security;
alter table public.site_events enable row level security;
alter table public.personal_puzzles enable row level security;
revoke all on public.bot_personas,public.site_events,public.personal_puzzles from public,anon,authenticated;
grant all on public.bot_personas,public.site_events,public.personal_puzzles to service_role;
drop policy if exists server_only on public.bot_personas;
create policy server_only on public.bot_personas for all to service_role using(true) with check(true);
drop policy if exists server_only on public.site_events;
create policy server_only on public.site_events for all to service_role using(true) with check(true);
drop policy if exists server_only on public.personal_puzzles;
create policy server_only on public.personal_puzzles for all to service_role using(true) with check(true);
-- Deny browser roles even if an old policy or column grant survived an upgrade.
do $browser_access$
declare t text;
begin
 foreach t in array array['bot_personas','site_events','personal_puzzles'] loop
   execute format('drop policy if exists deny_browser_access on public.%I',t);
   execute format('create policy deny_browser_access on public.%I as restrictive for all to anon,authenticated using(false) with check(false)',t);
 end loop;
end $browser_access$;

create or replace function public.touch_site_presence(p_user uuid) returns void
language sql security definer set search_path=public as $$
  insert into public.online_presence(user_id,firebase_uid,display_name,last_seen,updated_at)
  select id,coalesce(firebase_uid,id::text),display_name,clock_timestamp(),clock_timestamp()
    from public.users where id=p_user
  on conflict(user_id) do update set last_seen=excluded.last_seen,updated_at=excluded.updated_at;
$$;
revoke all on function public.touch_site_presence(uuid) from public,anon,authenticated;
grant execute on function public.touch_site_presence(uuid) to service_role;

create table if not exists public.puzzle_runs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  mode text not null check(mode in('rated','daily','rush','streak','custom','personal')),
  status text not null default 'active' check(status in('active','finished')),
  score integer not null default 0, correct integer not null default 0,
  attempted integer not null default 0, misses integer not null default 0,
  started_at timestamptz not null default clock_timestamp(), expires_at timestamptz,
  finished_at timestamptz
);
create index if not exists idx_puzzle_runs_owner on public.puzzle_runs(user_id,mode,started_at desc);
create table if not exists public.puzzle_attempts (
  id uuid primary key, user_id uuid not null references public.users(id) on delete cascade,
  run_id uuid not null references public.puzzle_runs(id) on delete cascade,
  puzzle_id text not null, snapshot jsonb not null, played_moves jsonb not null default '[]',
  version integer not null default 0, counted boolean not null default false,
  created_at timestamptz not null default clock_timestamp(), finished_at timestamptz,
  last_version integer, last_move text, last_response jsonb
);
create index if not exists idx_puzzle_attempts_owner_date on public.puzzle_attempts(user_id,created_at);
create index if not exists idx_puzzle_attempts_run on public.puzzle_attempts(run_id,created_at);
create table if not exists public.puzzle_awards (
  user_id uuid not null references public.users(id) on delete cascade,
  puzzle_key text not null, usage_date date not null, primary key(user_id,puzzle_key,usage_date)
);
alter table public.puzzle_runs enable row level security;
alter table public.puzzle_attempts enable row level security;
alter table public.puzzle_awards enable row level security;
revoke all on public.puzzle_runs,public.puzzle_attempts,public.puzzle_awards from public,anon,authenticated;
grant all on public.puzzle_runs,public.puzzle_attempts,public.puzzle_awards to service_role;
drop policy if exists server_only on public.puzzle_runs;
create policy server_only on public.puzzle_runs for all to service_role using(true) with check(true);
drop policy if exists server_only on public.puzzle_attempts;
create policy server_only on public.puzzle_attempts for all to service_role using(true) with check(true);
drop policy if exists server_only on public.puzzle_awards;
create policy server_only on public.puzzle_awards for all to service_role using(true) with check(true);

create or replace function public.puzzle_progress_snapshot(p_user uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('rating',p.rating,'points',p.points,'correct',p.correct,'attempted',p.attempted,
   'rushBest',p.rush_best,'streakBest',p.streak_best,'dailyStreak',p.daily_streak,'seen',p.seen_puzzle_ids,
   'dailyPuzzleUsage',jsonb_build_object((now() at time zone 'utc')::date::text,
     (select count(*) from public.puzzle_attempts a join public.puzzle_runs r on r.id=a.run_id
      where a.user_id=p_user and r.mode='rated' and a.created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc')),
   'dailySolved',coalesce((select jsonb_object_agg(puzzle_date::text,true) from public.daily_puzzle_claims
      where user_id=p_user and solved_at is not null),'{}'::jsonb))
 from public.puzzle_progress p where p.user_id=p_user;
$$;

create or replace function public.finish_puzzle_run(p_user uuid,p_run uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.puzzle_runs%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('puzzle:'||p_user::text,0));
 select * into r from public.puzzle_runs where id=p_run and user_id=p_user for update;
 if not found then raise exception 'Puzzle run not found.' using errcode='42501'; end if;
 update public.puzzle_runs set status='finished',finished_at=coalesce(finished_at,clock_timestamp())
 where id=p_run returning * into r;
 insert into public.puzzle_sessions(id,user_id,mode,score,correct,attempted,best_streak,duration_seconds,started_at,finished_at)
 values(r.id,p_user,r.mode,r.score,r.correct,r.attempted,r.correct,
   greatest(0,extract(epoch from (least(r.finished_at,coalesce(r.expires_at,r.finished_at))-r.started_at))::integer),r.started_at,r.finished_at)
 on conflict(id) do nothing;
 update public.puzzle_progress set rush_best=case when r.mode='rush' then greatest(rush_best,r.score) else rush_best end,
   streak_best=case when r.mode='streak' then greatest(streak_best,r.score) else streak_best end,updated_at=clock_timestamp()
 where user_id=p_user;
 return to_jsonb(r);
end $$;

create or replace function public.start_puzzle_attempt(p_user uuid,p_request uuid,p_mode text,p_puzzle jsonb,p_run uuid default null,p_limit integer default 5)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.puzzle_runs%rowtype; a public.puzzle_attempts%rowtype; v_used integer;
begin
 if p_user is null or p_request is null or p_mode is null or p_mode not in('rated','daily','rush','streak','custom','personal')
   or nullif(p_puzzle->>'id','') is null or nullif(p_puzzle->>'fen','') is null then
   raise exception 'Invalid puzzle attempt.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('puzzle:'||p_user::text,0));
 select * into a from public.puzzle_attempts where id=p_request;
 if found then
   if a.user_id<>p_user then raise exception 'Puzzle attempt belongs to another user.' using errcode='42501'; end if;
   select * into r from public.puzzle_runs where id=a.run_id;
   return jsonb_build_object('attempt',to_jsonb(a),'run',to_jsonb(r),'progress',public.puzzle_progress_snapshot(p_user));
 end if;
 insert into public.puzzle_progress(user_id) values(p_user) on conflict(user_id) do nothing;
 -- Reloading a normal exercise resumes the server-owned attempt, including at
 -- the daily quota boundary. It must not spend another assignment or reset moves.
 if p_run is null and p_mode in('rated','daily','personal') then
   select pr.* into r from public.puzzle_runs pr where pr.user_id=p_user and pr.mode=p_mode
     and pr.status='active' and pr.expires_at>clock_timestamp()
     and (p_mode<>'daily' or (pr.started_at at time zone 'utc')::date=(clock_timestamp() at time zone 'utc')::date)
     order by pr.started_at desc limit 1 for update;
   if found then
     select pa.* into a from public.puzzle_attempts pa where pa.run_id=r.id and pa.finished_at is null order by pa.created_at desc limit 1;
     if found then return jsonb_build_object('attempt',to_jsonb(a),'run',to_jsonb(r),'progress',public.puzzle_progress_snapshot(p_user)); end if;
   end if;
   r:=null;
 end if;
 if p_run is not null then
   select * into r from public.puzzle_runs where id=p_run and user_id=p_user and mode=p_mode for update;
   if not found then raise exception 'Puzzle run not found.' using errcode='42501'; end if;
   if r.status<>'active' or r.expires_at<=clock_timestamp() then
     perform public.finish_puzzle_run(p_user,r.id);
     return jsonb_build_object('finished',true,'run',(select to_jsonb(x) from public.puzzle_runs x where id=r.id),'progress',public.puzzle_progress_snapshot(p_user));
   end if;
   select * into a from public.puzzle_attempts where run_id=r.id and finished_at is null order by created_at desc limit 1;
   if found then return jsonb_build_object('attempt',to_jsonb(a),'run',to_jsonb(r),'progress',public.puzzle_progress_snapshot(p_user)); end if;
 end if;
 if p_mode='rated' and p_limit is not null then
   select count(*) into v_used from public.puzzle_attempts pa join public.puzzle_runs pr on pr.id=pa.run_id
     where pa.user_id=p_user and pr.mode='rated' and pa.created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc';
   if v_used>=p_limit then raise exception 'Puzzle quota exhausted.' using errcode='54000'; end if;
 end if;
 if r.id is null then
   -- A new run retires the previous run of this mode; old tabs cannot keep scoring.
   for r in select * from public.puzzle_runs where user_id=p_user and mode=p_mode and status='active' loop
     perform public.finish_puzzle_run(p_user,r.id);
   end loop;
   insert into public.puzzle_runs(user_id,mode,expires_at) values(p_user,p_mode,
      clock_timestamp()+case when p_mode='rush' then interval '180 seconds' else interval '24 hours' end) returning * into r;
 end if;
 if exists(select 1 from public.puzzle_attempts where run_id=r.id and puzzle_id=p_puzzle->>'id') then
   raise exception 'Puzzle already used in this run.' using errcode='22023'; end if;
 insert into public.puzzle_attempts(id,user_id,run_id,puzzle_id,snapshot) values(p_request,p_user,r.id,p_puzzle->>'id',p_puzzle) returning * into a;
 return jsonb_build_object('attempt',to_jsonb(a),'run',to_jsonb(r),'progress',public.puzzle_progress_snapshot(p_user));
end $$;

create or replace function public.commit_puzzle_answer(p_user uuid,p_attempt uuid,p_version integer,p_move text,p_check jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.puzzle_attempts%rowtype; r public.puzzle_runs%rowtype; p public.puzzle_progress%rowtype;
 v_now timestamptz:=clock_timestamp(); v_date date; v_correct boolean; v_complete boolean; v_reward integer:=0;
 v_awarded boolean:=false; v_done boolean; v_streak integer; v_response jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('puzzle:'||p_user::text,0));
 select * into a from public.puzzle_attempts where id=p_attempt and user_id=p_user for update;
 if not found then raise exception 'Puzzle attempt not found.' using errcode='42501'; end if;
 if a.last_version=p_version and a.last_move=p_move then return a.last_response; end if;
 if p_version is null or a.version<>p_version then raise exception 'Puzzle state changed.' using errcode='40001'; end if;
 select * into r from public.puzzle_runs where id=a.run_id for update;
 v_now:=clock_timestamp(); v_date:=(v_now at time zone 'utc')::date;
 if r.status<>'active' or a.finished_at is not null then raise exception 'Puzzle run finished.' using errcode='55000'; end if;
 if r.expires_at<=v_now then
   return jsonb_build_object('accepted',false,'complete',false,'expired',true,'run',public.finish_puzzle_run(p_user,r.id),
     'progress',public.puzzle_progress_snapshot(p_user),'version',a.version);
 end if;
 if r.mode='daily' and (a.created_at at time zone 'utc')::date<>v_date then
   return jsonb_build_object('accepted',false,'expired',true,'run',public.finish_puzzle_run(p_user,r.id),'progress',public.puzzle_progress_snapshot(p_user));
 end if;
 v_correct:=coalesce((p_check->>'accepted')::boolean,false);
 v_complete:=v_correct and coalesce((p_check->>'complete')::boolean,false);
 v_done:=v_complete or (not v_correct and r.mode in('rush','streak'));
 select * into p from public.puzzle_progress where user_id=p_user for update;
 if v_complete then
   if r.mode in('rush','streak') then v_reward:=1;
   else
     insert into public.puzzle_awards(user_id,puzzle_key,usage_date)
     select p_user,(case when r.mode='daily' then 'daily:' else 'practice:' end)||a.puzzle_id,v_date
       where r.mode<>'daily' or not exists(select 1 from public.daily_puzzle_claims where user_id=p_user and puzzle_date=v_date and solved_at is not null)
     on conflict do nothing;
     v_awarded:=found;
     if v_awarded then
       v_reward:=case when r.mode='daily' then 20 when r.mode='custom' then 10
         else greatest(5,least(24,round((coalesce((a.snapshot->>'rating')::numeric,1200)-p.rating)/40)::integer+12)) end;
     end if;
   end if;
 elsif not v_correct and not a.counted and r.mode not in('rush','streak') then
   v_reward:=case when r.mode='rated' then -8 else -4 end;
 end if;
 if v_complete or not v_correct then
   update public.puzzle_runs set attempted=attempted+(not a.counted)::integer,correct=correct+v_complete::integer,
      misses=misses+(not v_correct and not a.counted)::integer,score=score+greatest(0,v_reward) where id=r.id returning * into r;
 end if;
 update public.puzzle_progress set
   attempted=attempted+case when not a.counted and (v_complete or not v_correct) then 1 else 0 end,
   correct=correct+case when v_complete and (v_awarded or r.mode in('rush','streak')) then 1 else 0 end,
   points=greatest(0,points+case when r.mode in('rush','streak') then 0 else v_reward end),
   rating=case when r.mode='rated' then greatest(100,least(4000,rating+v_reward)) else rating end,
   seen_puzzle_ids=case when v_done and not seen_puzzle_ids ? a.puzzle_id then seen_puzzle_ids||jsonb_build_array(a.puzzle_id) else seen_puzzle_ids end,
   rush_best=case when r.mode='rush' then greatest(rush_best,r.score) else rush_best end,
   streak_best=case when r.mode='streak' then greatest(streak_best,r.score) else streak_best end,updated_at=v_now
 where user_id=p_user;
 if v_complete and r.mode='personal' then update public.personal_puzzles set status='solved',updated_at=v_now where id=a.puzzle_id::uuid and user_id=p_user; end if;
 if v_complete and r.mode='daily' and v_awarded then
   select coalesce(max(streak),0)+1 into v_streak from public.daily_puzzle_claims where user_id=p_user and puzzle_date=v_date-1 and solved_at is not null;
   insert into public.daily_puzzle_claims(user_id,puzzle_date,puzzle_id,solved_at,streak)
   values(p_user,v_date,a.puzzle_id,v_now,v_streak) on conflict(user_id,puzzle_date) do update
     set puzzle_id=excluded.puzzle_id,solved_at=excluded.solved_at,streak=excluded.streak
     where daily_puzzle_claims.solved_at is null;
   update public.puzzle_progress set daily_streak=v_streak where user_id=p_user;
 end if;
 if (v_complete and r.mode not in('rush','streak')) or (r.mode='streak' and not v_correct) or (r.mode='rush' and r.misses>=3) then
   perform public.finish_puzzle_run(p_user,r.id);
   select * into r from public.puzzle_runs where id=r.id;
 end if;
 v_response:=p_check||jsonb_build_object('reward',v_reward,'version',a.version+1,'run',to_jsonb(r),'progress',public.puzzle_progress_snapshot(p_user));
 update public.puzzle_attempts set version=version+1,played_moves=case when v_correct then p_check->'playedMoves' else played_moves end,
   counted=counted or v_complete or not v_correct,finished_at=case when v_done then v_now else null end,
   last_version=p_version,last_move=p_move,last_response=v_response where id=a.id;
 return v_response;
end $$;

revoke all on function public.puzzle_progress_snapshot(uuid),public.finish_puzzle_run(uuid,uuid),
 public.start_puzzle_attempt(uuid,uuid,text,jsonb,uuid,integer),public.commit_puzzle_answer(uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.puzzle_progress_snapshot(uuid),public.finish_puzzle_run(uuid,uuid),
 public.start_puzzle_attempt(uuid,uuid,text,jsonb,uuid,integer),public.commit_puzzle_answer(uuid,uuid,integer,text,jsonb) to service_role;
-- END SECURITY UPGRADE
notify pgrst,'reload schema';
commit;
