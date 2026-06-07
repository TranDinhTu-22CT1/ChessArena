-- Constraints and indexes used by the production matchmaking hot path.

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.online_presence'::regclass
      and conname = 'online_presence_current_game_fk'
  ) then
    alter table public.online_presence
    add constraint online_presence_current_game_fk
    foreign key (current_game_id)
    references public.online_games(id)
    on delete set null;
  end if;
end;
$migration$;

create unique index if not exists idx_online_game_tickets_game_color_unique
on public.online_game_tickets(game_id, color);

create index if not exists idx_online_games_active_white
on public.online_games(white_user_id, updated_at desc)
where status = 'active';

create index if not exists idx_online_games_active_black
on public.online_games(black_user_id, updated_at desc)
where status = 'active';

create index if not exists idx_online_match_queue_candidate_rating
on public.online_match_queue(time_control, mode, pool, rating, joined_at, id)
where status = 'waiting';

create index if not exists idx_online_match_queue_cleanup
on public.online_match_queue(last_seen, id)
where status in ('waiting', 'claimed');

create index if not exists idx_online_game_tickets_game
on public.online_game_tickets(game_id);

notify pgrst, 'reload schema';
