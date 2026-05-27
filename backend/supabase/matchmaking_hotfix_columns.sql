-- Hotfix for existing databases created before the latest matchmaking columns.
-- Safe to run multiple times in Supabase SQL Editor.

alter table public.user_matchmaking_stats
add column if not exists last_client_id text;

alter table public.user_matchmaking_stats
add column if not exists last_session_id text;

alter table public.matchmaking_events
add column if not exists correlation_id text;

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

notify pgrst, 'reload schema';
