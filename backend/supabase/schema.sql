-- ChessArena: canonical schema for a NEW, empty Supabase project.
-- Existing projects: run BanCanCapNhat.sql instead. Run this entire file once.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local check_function_bodies = false;
set local search_path = public, extensions;
create extension if not exists pgcrypto;

create sequence if not exists public."activity_feed_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public."admin_audit_logs_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public."game_moves_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public."matchmaking_events_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public."matchmaking_outbox_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public."online_game_chat_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public."online_game_moves_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public."support_status_events_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;

create table if not exists public."activity_feed" (
  "id" bigint default nextval('activity_feed_id_seq'::regclass) not null,
  "actor_user_id" uuid,
  "type" text not null,
  "visibility" text default 'public'::text not null,
  "subject_id" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."admin_audit_logs" (
  "id" bigint default nextval('admin_audit_logs_id_seq'::regclass) not null,
  "admin_user_id" uuid,
  "action" text not null,
  "target_user_id" uuid,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."api_rate_limits" (
  "key" text not null,
  "count" integer default 0 not null,
  "reset_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."auth_otps" (
  "id" uuid default gen_random_uuid() not null,
  "email" text not null,
  "purpose" text not null,
  "otp_hash" text not null,
  "attempts" integer default 0 not null,
  "expires_at" timestamp with time zone not null,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."bot_personas" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "elo" integer default 1200 not null,
  "mood" text default 'Custom admin bot'::text not null,
  "chat" text default 'Ready for a themed game.'::text not null,
  "avatar_url" text default '/chessarena-mark.svg'::text not null,
  "event_tag" text default 'seasonal'::text not null,
  "active" boolean default true not null,
  "sort_order" integer default 50 not null,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."daily_puzzle_claims" (
  "user_id" uuid not null,
  "puzzle_date" date not null,
  "puzzle_id" text not null,
  "solved_at" timestamp with time zone,
  "streak" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."game_invitations" (
  "id" uuid default gen_random_uuid() not null,
  "sender_id" uuid not null,
  "recipient_id" uuid not null,
  "time_control" text not null,
  "sender_color" text default 'random'::text not null,
  "status" text default 'pending'::text not null,
  "game_id" uuid,
  "expires_at" timestamp with time zone default (now() + '00:02:00'::interval) not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."game_moves" (
  "id" bigint default nextval('game_moves_id_seq'::regclass) not null,
  "game_id" uuid not null,
  "ply" integer not null,
  "move_number" integer not null,
  "color" text not null,
  "san" text not null,
  "lan" text not null,
  "from_square" text not null,
  "to_square" text not null,
  "piece" text not null,
  "captured" text,
  "promotion" text,
  "flags" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."game_review_moves" (
  "id" uuid default gen_random_uuid() not null,
  "review_id" uuid not null,
  "game_id" uuid not null,
  "user_id" uuid not null,
  "ply" integer not null,
  "san" text,
  "move" text,
  "fen" text,
  "best_move" text,
  "tone" text,
  "label" text,
  "centipawn_loss" integer default 0,
  "win_loss" numeric(6,2) default 0,
  "white_score" integer,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."game_reviews" (
  "id" uuid default gen_random_uuid() not null,
  "game_id" uuid not null,
  "user_id" uuid not null,
  "color" text not null,
  "accuracy" numeric(5,2) default 0,
  "average_centipawn_loss" integer default 0,
  "blunders" integer default 0,
  "mistakes" integer default 0,
  "inaccuracies" integer default 0,
  "best_moves" integer default 0,
  "total_moves" integer default 0,
  "summary" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."review_quota_uses" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "review_key" text not null,
  "game_id" uuid,
  "usage_date" date default (now() at time zone 'utc')::date not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."games" (
  "id" uuid default gen_random_uuid() not null,
  "client_game_id" text not null,
  "user_id" uuid not null,
  "player_color" text not null,
  "ai_elo" integer not null,
  "result" text default '*'::text not null,
  "fen" text not null,
  "pgn" text default ''::text not null,
  "headers" jsonb default '{}'::jsonb not null,
  "saved_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."matchmaking_events" (
  "id" bigint default nextval('matchmaking_events_id_seq'::regclass) not null,
  "user_id" uuid,
  "ticket_id" uuid,
  "game_id" uuid,
  "event_type" text not null,
  "mode" text,
  "time_control" text,
  "pool" text,
  "wait_ms" integer,
  "rating" integer,
  "rating_window" integer,
  "rating_gap" integer,
  "client_id" text,
  "session_id" text,
  "correlation_id" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."matchmaking_outbox" (
  "id" bigint default nextval('matchmaking_outbox_id_seq'::regclass) not null,
  "event_key" text not null,
  "event_type" text not null,
  "aggregate_id" uuid,
  "payload" jsonb default '{}'::jsonb not null,
  "attempts" integer default 0 not null,
  "available_at" timestamp with time zone default now() not null,
  "delivered_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."matchmaking_user_generations" (
  "user_id" uuid not null,
  "generation" bigint default 0 not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."media_assets" (
  "id" uuid default gen_random_uuid() not null,
  "owner_user_id" uuid,
  "bucket" text default 'chessarena'::text not null,
  "object_path" text not null,
  "public_url" text not null,
  "mime_type" text not null,
  "original_name" text default 'file'::text not null,
  "size_bytes" bigint default 0 not null,
  "purpose" text default 'general'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."membership_checkouts" (
  "user_id" uuid not null,
  "request_id" uuid default gen_random_uuid() not null,
  "tier" text not null,
  "billing_cycle" text not null,
  "plan_id" text not null,
  "subscription_id" text,
  "approve_url" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."membership_subscriptions" (
  "subscription_id" text not null,
  "user_id" uuid not null,
  "tier" text not null,
  "billing_cycle" text not null,
  "plan_id" text not null,
  "provider_status" text not null,
  "paid_through" timestamp with time zone,
  "last_payment_at" timestamp with time zone,
  "provider_updated_at" timestamp with time zone,
  "cancel_requested" boolean default false not null,
  "cancelled_at" timestamp with time zone,
  "synced_at" timestamp with time zone default now() not null
);

create table if not exists public."online_game_chat" (
  "id" bigint default nextval('online_game_chat_id_seq'::regclass) not null,
  "game_id" uuid not null,
  "user_id" uuid not null,
  "body" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."online_game_moves" (
  "id" bigint default nextval('online_game_moves_id_seq'::regclass) not null,
  "game_id" uuid not null,
  "ply" integer not null,
  "user_id" uuid not null,
  "color" text not null,
  "san" text not null,
  "lan" text not null,
  "from_square" text not null,
  "to_square" text not null,
  "promotion" text,
  "fen_after" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."online_game_spectators" (
  "game_id" uuid not null,
  "user_id" uuid not null,
  "joined_at" timestamp with time zone default now() not null,
  "last_seen" timestamp with time zone default now() not null
);

create table if not exists public."online_game_tickets" (
  "ticket_id" uuid not null,
  "game_id" uuid not null,
  "color" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."online_games" (
  "id" uuid default gen_random_uuid() not null,
  "status" text default 'waiting'::text not null,
  "match_type" text default 'quick'::text not null,
  "white_user_id" uuid,
  "black_user_id" uuid,
  "white_name" text default 'Player'::text not null,
  "black_name" text default 'Player'::text not null,
  "fen" text default 'start'::text not null,
  "pgn" text default ''::text not null,
  "turn" text default 'w'::text not null,
  "result" text default '*'::text not null,
  "time_control" text default '600+0'::text not null,
  "last_move_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "rematch_requested_by" uuid,
  "rematch_requested_at" timestamp with time zone,
  "rematch_response" text,
  "rematch_game_id" uuid,
  "mode" text default 'rapid'::text not null,
  "rated" boolean default true not null,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "white_rating_before" integer,
  "black_rating_before" integer,
  "white_rating_after" integer,
  "black_rating_after" integer,
  "matchmaking_ticket_white" uuid,
  "matchmaking_ticket_black" uuid,
  "matchmaking_pool" text,
  "rating_gap" integer,
  "match_wait_time_white" integer,
  "match_wait_time_black" integer,
  "fairness_score" integer,
  "match_region" text,
  "matchmaking_correlation_id" text,
  "matchmaking_match_key" text,
  "draw_offered_by" uuid,
  "draw_offered_at" timestamp with time zone,
  "spectator_allowed" boolean default true not null,
  "white_disconnected_at" timestamp with time zone,
  "black_disconnected_at" timestamp with time zone,
  "disconnect_grace_seconds" integer default 45 not null,
  "state_version" bigint default 1 not null
);

create table if not exists public."online_match_queue" (
  "user_id" uuid not null,
  "firebase_uid" text not null,
  "display_name" text not null,
  "time_control" text default '600+0'::text not null,
  "rating" integer default 400 not null,
  "joined_at" timestamp with time zone default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "mode" text default 'rapid'::text not null,
  "rating_min" integer default 350 not null,
  "rating_max" integer default 450 not null,
  "rating_range_preference" integer default 500 not null,
  "pool" text default 'standard'::text not null,
  "status" text default 'waiting'::text not null,
  "last_seen" timestamp with time zone default now() not null,
  "claimed_by" uuid,
  "claimed_at" timestamp with time zone,
  "matched_game_id" uuid,
  "cancelled_at" timestamp with time zone,
  "cancel_reason" text,
  "client_id" text,
  "session_id" text,
  "region" text,
  "latency_ms" integer,
  "idempotency_key" text,
  "queue_shard" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "generation" bigint default 1 not null,
  "lease_expires_at" timestamp with time zone,
  "region_scope" text default 'global'::text not null
);

create table if not exists public."online_presence" (
  "user_id" uuid not null,
  "firebase_uid" text not null,
  "display_name" text not null,
  "status" text default 'online'::text not null,
  "current_game_id" uuid,
  "last_seen" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "current_queue_ticket_id" uuid,
  "client_id" text,
  "session_id" text
);

create table if not exists public."online_rating_events" (
  "game_id" uuid not null,
  "white_user_id" uuid not null,
  "black_user_id" uuid not null,
  "result" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."online_ratings" (
  "user_id" uuid not null,
  "rating" integer default 400 not null,
  "games_played" integer default 0 not null,
  "wins" integer default 0 not null,
  "losses" integer default 0 not null,
  "draws" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."opening_repertoire" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "color" text not null,
  "name" text not null,
  "eco" text,
  "pgn" text default ''::text not null,
  "notes" text default ''::text not null,
  "source" text default 'manual'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."payment_transactions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "provider" text not null,
  "provider_transaction_id" text,
  "provider_event_id" text,
  "kind" text default 'subscription'::text not null,
  "status" text default 'pending'::text not null,
  "tier" text,
  "billing_cycle" text,
  "currency" text default 'USD'::text not null,
  "amount" numeric(12,2),
  "metadata" jsonb default '{}'::jsonb not null,
  "occurred_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."paypal_webhook_events" (
  "id" text not null,
  "event_type" text not null,
  "subscription_id" text,
  "processed_at" timestamp with time zone default now() not null
);

create table if not exists public."personal_puzzles" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "source_game_id" uuid,
  "source_review_id" uuid,
  "source_ply" integer,
  "fen" text not null,
  "solution" text not null,
  "played_move" text,
  "san" text,
  "theme" text default 'mistake'::text,
  "stage" text default 'review'::text,
  "rating" integer default 1200,
  "status" text default 'new'::text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."player_reports" (
  "id" uuid default gen_random_uuid() not null,
  "game_id" uuid,
  "reporter_user_id" uuid not null,
  "reported_user_id" uuid,
  "category" text not null,
  "status" text default 'pending'::text not null,
  "severity" text default 'medium'::text not null,
  "description" text default ''::text not null,
  "evidence" jsonb default '{}'::jsonb not null,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "resolution_note" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."puzzle_battles" (
  "id" uuid default gen_random_uuid() not null,
  "status" text default 'waiting'::text not null,
  "player_one_id" uuid not null,
  "player_two_id" uuid,
  "puzzle_ids" jsonb default '[]'::jsonb not null,
  "player_one_score" integer default 0 not null,
  "player_two_score" integer default 0 not null,
  "player_one_index" integer default 0 not null,
  "player_two_index" integer default 0 not null,
  "winner_user_id" uuid,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "expires_at" timestamp with time zone default (now() + '00:05:00'::interval) not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."puzzle_progress" (
  "user_id" uuid not null,
  "rating" integer default 800 not null,
  "points" integer default 0 not null,
  "correct" integer default 0 not null,
  "attempted" integer default 0 not null,
  "rush_best" integer default 0 not null,
  "streak_best" integer default 0 not null,
  "daily_streak" integer default 0 not null,
  "seen_puzzle_ids" jsonb default '[]'::jsonb not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."puzzle_sessions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "mode" text not null,
  "score" integer default 0 not null,
  "correct" integer default 0 not null,
  "attempted" integer default 0 not null,
  "best_streak" integer default 0 not null,
  "duration_seconds" integer default 0 not null,
  "started_at" timestamp with time zone default now() not null,
  "finished_at" timestamp with time zone default now() not null,
  "metadata" jsonb default '{}'::jsonb not null
);

create table if not exists public."site_events" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "event_type" text default 'bot_challenge'::text not null,
  "description" text default 'Beat the featured bot during the event window.'::text not null,
  "reward_label" text default 'Profile badge'::text not null,
  "active" boolean default true not null,
  "starts_at" timestamp with time zone default now() not null,
  "ends_at" timestamp with time zone,
  "config" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."support_messages" (
  "id" uuid default gen_random_uuid() not null,
  "request_id" uuid not null,
  "sender_user_id" uuid,
  "sender_role" text not null,
  "body" text default ''::text not null,
  "attachments" jsonb default '[]'::jsonb not null,
  "read_by_user_at" timestamp with time zone,
  "read_by_admin_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."support_requests" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "category" text default 'general'::text not null,
  "status" text default 'new'::text not null,
  "subject" text default ''::text not null,
  "message" text default ''::text not null,
  "page_url" text,
  "contact_email" text,
  "context" jsonb default '{}'::jsonb not null,
  "admin_note" text,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "attachments" jsonb default '[]'::jsonb not null
);

create table if not exists public."support_status_events" (
  "id" bigint default nextval('support_status_events_id_seq'::regclass) not null,
  "request_id" uuid not null,
  "actor_user_id" uuid,
  "actor_role" text not null,
  "old_status" text,
  "new_status" text not null,
  "note" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."user_achievements" (
  "user_id" uuid not null,
  "achievement_key" text not null,
  "tier" text default 'bronze'::text not null,
  "progress" integer default 0 not null,
  "target" integer default 1 not null,
  "unlocked_at" timestamp with time zone,
  "updated_at" timestamp with time zone default now() not null,
  "metadata" jsonb default '{}'::jsonb not null
);

create table if not exists public."user_active_locks" (
  "user_id" uuid not null,
  "game_id" uuid not null,
  "acquired_at" timestamp with time zone default now() not null
);

create table if not exists public."user_bans" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "ban_type" text default 'account'::text not null,
  "reason" text default 'Policy violation'::text not null,
  "status" text default 'active'::text not null,
  "created_by" uuid,
  "lifted_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "lifted_at" timestamp with time zone,
  "expires_at" timestamp with time zone
);


create table if not exists public."user_follows" (
  "follower_user_id" uuid not null,
  "followed_user_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."user_friendships" (
  "id" uuid default gen_random_uuid() not null,
  "requester_id" uuid not null,
  "receiver_id" uuid not null,
  "status" text default 'pending'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."user_matchmaking_stats" (
  "user_id" uuid not null,
  "finds" integer default 0 not null,
  "cancels" integer default 0 not null,
  "stale_disconnects" integer default 0 not null,
  "accepted_games" integer default 0 not null,
  "aborts" integer default 0 not null,
  "cooldown_until" timestamp with time zone,
  "last_find_at" timestamp with time zone,
  "last_cancel_at" timestamp with time zone,
  "last_client_id" text,
  "last_session_id" text,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."user_memberships" (
  "user_id" uuid not null,
  "tier" text default 'free'::text not null,
  "status" text default 'inactive'::text not null,
  "billing_cycle" text default 'monthly'::text not null,
  "provider" text,
  "provider_subscription_id" text,
  "provider_plan_id" text,
  "started_at" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "updated_at" timestamp with time zone default now() not null,
  "cancel_at_period_end" boolean default false not null,
  "synced_at" timestamp with time zone
);

create table if not exists public."user_mutes" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "reason" text default 'Chat policy violation'::text not null,
  "scopes" jsonb default '["chat", "reports"]'::jsonb not null,
  "status" text default 'active'::text not null,
  "created_by" uuid,
  "lifted_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "lifted_at" timestamp with time zone,
  "expires_at" timestamp with time zone
);

create table if not exists public."user_notifications" (
  "id" uuid default gen_random_uuid() not null,
  "recipient_user_id" uuid,
  "audience" text default 'user'::text not null,
  "type" text default 'system'::text not null,
  "title" text not null,
  "body" text default ''::text not null,
  "action_url" text,
  "priority" text default 'normal'::text not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."user_preferences" (
  "user_id" uuid not null,
  "theme" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."user_rating_peaks" (
  "user_id" uuid not null,
  "peak_rating" integer not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."user_ratings" (
  "user_id" uuid not null,
  "mode" text not null,
  "rating" integer default 400 not null,
  "deviation" integer default 350 not null,
  "volatility" numeric(8,6) default 0.060000 not null,
  "provisional" boolean default true not null,
  "games_played" integer default 0 not null,
  "wins" integer default 0 not null,
  "losses" integer default 0 not null,
  "draws" integer default 0 not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."users" (
  "id" uuid default gen_random_uuid() not null,
  "username" text not null,
  "display_name" text not null,
  "firebase_uid" text,
  "email" text,
  "photo_url" text,
  "email_verified" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter sequence public."activity_feed_id_seq" owned by public."activity_feed"."id";
alter sequence public."admin_audit_logs_id_seq" owned by public."admin_audit_logs"."id";
alter sequence public."game_moves_id_seq" owned by public."game_moves"."id";
alter sequence public."matchmaking_events_id_seq" owned by public."matchmaking_events"."id";
alter sequence public."matchmaking_outbox_id_seq" owned by public."matchmaking_outbox"."id";
alter sequence public."online_game_chat_id_seq" owned by public."online_game_chat"."id";
alter sequence public."online_game_moves_id_seq" owned by public."online_game_moves"."id";
alter sequence public."support_status_events_id_seq" owned by public."support_status_events"."id";

alter table public."activity_feed" add constraint "activity_feed_pkey" PRIMARY KEY (id);
alter table public."activity_feed" add constraint "activity_feed_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'followers'::text, 'private'::text])));
alter table public."admin_audit_logs" add constraint "admin_audit_logs_pkey" PRIMARY KEY (id);
alter table public."api_rate_limits" add constraint "api_rate_limits_pkey" PRIMARY KEY (key);
alter table public."auth_otps" add constraint "auth_otps_pkey" PRIMARY KEY (id);
alter table public."auth_otps" add constraint "auth_otps_purpose_check" CHECK ((purpose = ANY (ARRAY['register'::text, 'reset'::text])));
alter table public."bot_personas" add constraint "bot_personas_pkey" PRIMARY KEY (id);
alter table public."bot_personas" add constraint "bot_personas_elo_check" CHECK (((elo >= 250) AND (elo <= 3200)));
alter table public."daily_puzzle_claims" add constraint "daily_puzzle_claims_pkey" PRIMARY KEY (user_id, puzzle_date);
alter table public."game_invitations" add constraint "game_invitations_pkey" PRIMARY KEY (id);
alter table public."game_invitations" add constraint "game_invitations_check" CHECK ((sender_id <> recipient_id));
alter table public."game_invitations" add constraint "game_invitations_sender_color_check" CHECK ((sender_color = ANY (ARRAY['w'::text, 'b'::text, 'random'::text])));
alter table public."game_invitations" add constraint "game_invitations_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text, 'expired'::text])));
alter table public."game_invitations" add constraint "game_invitations_time_control_check" CHECK ((time_control = ANY (ARRAY['180+0'::text, '300+0'::text, '600+0'::text, '900+10'::text])));
alter table public."game_moves" add constraint "game_moves_pkey" PRIMARY KEY (id);
alter table public."game_moves" add constraint "game_moves_game_id_ply_key" UNIQUE (game_id, ply);
alter table public."game_moves" add constraint "game_moves_color_check" CHECK ((color = ANY (ARRAY['white'::text, 'black'::text])));
alter table public."game_review_moves" add constraint "game_review_moves_pkey" PRIMARY KEY (id);
alter table public."game_review_moves" add constraint "game_review_moves_review_id_ply_key" UNIQUE (review_id, ply);
alter table public."game_reviews" add constraint "game_reviews_pkey" PRIMARY KEY (id);
alter table public."game_reviews" add constraint "game_reviews_game_id_user_id_key" UNIQUE (game_id, user_id);
alter table public."game_reviews" add constraint "game_reviews_color_check" CHECK ((color = ANY (ARRAY['w'::text, 'b'::text])));
alter table public."review_quota_uses" add constraint "review_quota_uses_pkey" PRIMARY KEY (id);
alter table public."review_quota_uses" add constraint "review_quota_uses_user_key_unique" UNIQUE (user_id, review_key);
alter table public."review_quota_uses" add constraint "review_quota_uses_key_length" CHECK ((length(review_key) between 1 and 160));
alter table public."games" add constraint "games_pkey" PRIMARY KEY (id);
alter table public."games" add constraint "games_client_game_id_key" UNIQUE (client_game_id);
alter table public."games" add constraint "games_player_color_check" CHECK ((player_color = ANY (ARRAY['w'::text, 'b'::text])));
alter table public."matchmaking_events" add constraint "matchmaking_events_pkey" PRIMARY KEY (id);
alter table public."matchmaking_outbox" add constraint "matchmaking_outbox_pkey" PRIMARY KEY (id);
alter table public."matchmaking_outbox" add constraint "matchmaking_outbox_event_key_key" UNIQUE (event_key);
alter table public."matchmaking_user_generations" add constraint "matchmaking_user_generations_pkey" PRIMARY KEY (user_id);
alter table public."matchmaking_user_generations" add constraint "matchmaking_user_generations_generation_check" CHECK ((generation >= 0));
alter table public."media_assets" add constraint "media_assets_pkey" PRIMARY KEY (id);
alter table public."media_assets" add constraint "media_assets_object_path_key" UNIQUE (object_path);
alter table public."media_assets" add constraint "media_assets_size_bytes_check" CHECK ((size_bytes >= 0));
alter table public."membership_checkouts" add constraint "membership_checkouts_pkey" PRIMARY KEY (user_id);
alter table public."membership_subscriptions" add constraint "membership_subscriptions_pkey" PRIMARY KEY (subscription_id);
alter table public."membership_subscriptions" add constraint "membership_subscriptions_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text])));
alter table public."membership_subscriptions" add constraint "membership_subscriptions_tier_check" CHECK ((tier = ANY (ARRAY['plus'::text, 'pro'::text, 'master'::text])));
alter table public."online_game_chat" add constraint "online_game_chat_pkey" PRIMARY KEY (id);
alter table public."online_game_moves" add constraint "online_game_moves_pkey" PRIMARY KEY (id);
alter table public."online_game_moves" add constraint "online_game_moves_game_id_ply_key" UNIQUE (game_id, ply);
alter table public."online_game_moves" add constraint "online_game_moves_color_check" CHECK ((color = ANY (ARRAY['w'::text, 'b'::text])));
alter table public."online_game_spectators" add constraint "online_game_spectators_pkey" PRIMARY KEY (game_id, user_id);
alter table public."online_game_tickets" add constraint "online_game_tickets_pkey" PRIMARY KEY (ticket_id);
alter table public."online_game_tickets" add constraint "online_game_tickets_color_check" CHECK ((color = ANY (ARRAY['w'::text, 'b'::text])));
alter table public."online_games" add constraint "online_games_pkey" PRIMARY KEY (id);
alter table public."online_games" add constraint "online_games_distinct_players_check" CHECK (((white_user_id IS NULL) OR (black_user_id IS NULL) OR (white_user_id <> black_user_id)));
alter table public."online_games" add constraint "online_games_state_version_check" CHECK ((state_version >= 1));
alter table public."online_games" add constraint "online_games_match_type_check" CHECK ((match_type = ANY (ARRAY['quick'::text, 'friend'::text])));
alter table public."online_games" add constraint "online_games_rematch_response_check" CHECK ((rematch_response = ANY (ARRAY['accepted'::text, 'declined'::text])));
alter table public."online_games" add constraint "online_games_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'active'::text, 'draw'::text, 'checkmate'::text, 'resigned'::text, 'abandoned'::text])));
alter table public."online_games" add constraint "online_games_turn_check" CHECK ((turn = ANY (ARRAY['w'::text, 'b'::text])));
alter table public."online_match_queue" add constraint "online_match_queue_id_pkey" PRIMARY KEY (id);
alter table public."online_match_queue" add constraint "online_match_queue_mode_check" CHECK ((mode = ANY (ARRAY['bullet'::text, 'blitz'::text, 'rapid'::text, 'classical'::text])));
alter table public."online_match_queue" add constraint "online_match_queue_pool_check" CHECK ((pool = ANY (ARRAY['standard'::text, 'provisional'::text])));
alter table public."online_match_queue" add constraint "online_match_queue_rating_bounds_check" CHECK (((rating >= 100) AND (rating <= 4000) AND (rating_min <= rating) AND (rating_max >= rating) AND ((rating_range_preference >= 25) AND (rating_range_preference <= 1000))));
alter table public."online_match_queue" add constraint "online_match_queue_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'claimed'::text, 'matched'::text, 'cancelled'::text, 'stale'::text])));
alter table public."online_presence" add constraint "online_presence_pkey" PRIMARY KEY (user_id);
alter table public."online_presence" add constraint "online_presence_firebase_uid_key" UNIQUE (firebase_uid);
alter table public."online_presence" add constraint "online_presence_status_check" CHECK ((status = ANY (ARRAY['online'::text, 'queue'::text, 'playing'::text, 'idle'::text])));
alter table public."online_rating_events" add constraint "online_rating_events_pkey" PRIMARY KEY (game_id);
alter table public."online_rating_events" add constraint "online_rating_events_result_check" CHECK ((result = ANY (ARRAY['1-0'::text, '0-1'::text, '1/2-1/2'::text])));
alter table public."online_ratings" add constraint "online_ratings_pkey" PRIMARY KEY (user_id);
alter table public."opening_repertoire" add constraint "opening_repertoire_pkey" PRIMARY KEY (id);
alter table public."opening_repertoire" add constraint "opening_repertoire_color_check" CHECK ((color = ANY (ARRAY['w'::text, 'b'::text])));
alter table public."opening_repertoire" add constraint "opening_repertoire_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'import'::text, 'game'::text])));
alter table public."payment_transactions" add constraint "payment_transactions_pkey" PRIMARY KEY (id);
alter table public."payment_transactions" add constraint "payment_transactions_kind_check" CHECK ((kind = ANY (ARRAY['subscription'::text, 'renewal'::text, 'refund'::text, 'chargeback'::text, 'adjustment'::text])));
alter table public."payment_transactions" add constraint "payment_transactions_provider_check" CHECK ((provider = ANY (ARRAY['paypal'::text, 'manual'::text])));
alter table public."payment_transactions" add constraint "payment_transactions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text])));
alter table public."paypal_webhook_events" add constraint "paypal_webhook_events_pkey" PRIMARY KEY (id);
alter table public."personal_puzzles" add constraint "personal_puzzles_pkey" PRIMARY KEY (id);
alter table public."personal_puzzles" add constraint "personal_puzzles_user_id_source_game_id_source_ply_key" UNIQUE (user_id, source_game_id, source_ply);
alter table public."personal_puzzles" add constraint "personal_puzzles_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'solved'::text, 'dismissed'::text])));
alter table public."player_reports" add constraint "player_reports_pkey" PRIMARY KEY (id);
alter table public."player_reports" add constraint "player_reports_game_id_reporter_user_id_category_key" UNIQUE (game_id, reporter_user_id, category);
alter table public."player_reports" add constraint "player_reports_category_check" CHECK ((category = ANY (ARRAY['toxic'::text, 'stalling'::text, 'username'::text, 'avatar'::text, 'harassment'::text, 'match_abuse'::text, 'other'::text])));
alter table public."player_reports" add constraint "player_reports_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
alter table public."player_reports" add constraint "player_reports_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'resolved'::text, 'dismissed'::text, 'escalated'::text])));
alter table public."player_reports" add constraint "player_reports_no_self_report_check" CHECK ((reported_user_id is null or reporter_user_id <> reported_user_id));
alter table public."puzzle_battles" add constraint "puzzle_battles_pkey" PRIMARY KEY (id);
alter table public."puzzle_battles" add constraint "puzzle_battles_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'active'::text, 'finished'::text, 'cancelled'::text])));
alter table public."puzzle_progress" add constraint "puzzle_progress_pkey" PRIMARY KEY (user_id);
alter table public."puzzle_progress" add constraint "puzzle_progress_attempted_check" CHECK ((attempted >= 0));
alter table public."puzzle_progress" add constraint "puzzle_progress_correct_check" CHECK ((correct >= 0));
alter table public."puzzle_progress" add constraint "puzzle_progress_daily_streak_check" CHECK ((daily_streak >= 0));
alter table public."puzzle_progress" add constraint "puzzle_progress_points_check" CHECK ((points >= 0));
alter table public."puzzle_progress" add constraint "puzzle_progress_rating_check" CHECK (((rating >= 100) AND (rating <= 4000)));
alter table public."puzzle_progress" add constraint "puzzle_progress_rush_best_check" CHECK ((rush_best >= 0));
alter table public."puzzle_progress" add constraint "puzzle_progress_streak_best_check" CHECK ((streak_best >= 0));
alter table public."puzzle_sessions" add constraint "puzzle_sessions_pkey" PRIMARY KEY (id);
alter table public."puzzle_sessions" add constraint "puzzle_sessions_mode_check" CHECK ((mode = ANY (ARRAY['rated'::text, 'daily'::text, 'rush'::text, 'streak'::text, 'custom'::text, 'personal'::text])));
alter table public."site_events" add constraint "site_events_pkey" PRIMARY KEY (id);
alter table public."support_messages" add constraint "support_messages_pkey" PRIMARY KEY (id);
alter table public."support_messages" add constraint "support_messages_sender_role_check" CHECK ((sender_role = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text])));
alter table public."support_requests" add constraint "support_requests_pkey" PRIMARY KEY (id);
alter table public."support_requests" add constraint "support_requests_category_check" CHECK ((category = ANY (ARRAY['account'::text, 'billing'::text, 'online'::text, 'moderation'::text, 'puzzle'::text, 'technical'::text, 'general'::text])));
alter table public."support_requests" add constraint "support_requests_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'in_review'::text, 'waiting_user'::text, 'resolved'::text, 'dismissed'::text])));
alter table public."support_status_events" add constraint "support_status_events_pkey" PRIMARY KEY (id);
alter table public."support_status_events" add constraint "support_status_events_actor_role_check" CHECK ((actor_role = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text])));
alter table public."user_achievements" add constraint "user_achievements_pkey" PRIMARY KEY (user_id, achievement_key);
alter table public."user_active_locks" add constraint "user_active_locks_pkey" PRIMARY KEY (user_id);
alter table public."user_bans" add constraint "user_bans_pkey" PRIMARY KEY (id);
alter table public."user_bans" add constraint "user_bans_ban_type_check" CHECK (ban_type = 'account'::text);
alter table public."user_bans" add constraint "user_bans_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'lifted'::text])));
alter table public."user_follows" add constraint "user_follows_pkey" PRIMARY KEY (follower_user_id, followed_user_id);
alter table public."user_follows" add constraint "user_follows_not_self" CHECK ((follower_user_id <> followed_user_id));
alter table public."user_friendships" add constraint "user_friendships_pkey" PRIMARY KEY (id);
alter table public."user_friendships" add constraint "user_friendships_not_self" CHECK ((requester_id <> receiver_id));
alter table public."user_friendships" add constraint "user_friendships_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'blocked'::text])));
alter table public."user_matchmaking_stats" add constraint "user_matchmaking_stats_pkey" PRIMARY KEY (user_id);
alter table public."user_memberships" add constraint "user_memberships_pkey" PRIMARY KEY (user_id);
alter table public."user_memberships" add constraint "user_memberships_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text])));
alter table public."user_memberships" add constraint "user_memberships_status_check" CHECK ((status = ANY (ARRAY['inactive'::text, 'active'::text, 'cancelled'::text, 'expired'::text, 'pending'::text])));
alter table public."user_memberships" add constraint "user_memberships_tier_check" CHECK ((tier = ANY (ARRAY['free'::text, 'plus'::text, 'pro'::text, 'master'::text])));
alter table public."user_mutes" add constraint "user_mutes_pkey" PRIMARY KEY (id);
alter table public."user_mutes" add constraint "user_mutes_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'lifted'::text])));
alter table public."user_notifications" add constraint "user_notifications_pkey" PRIMARY KEY (id);
alter table public."user_notifications" add constraint "user_notifications_audience_check" CHECK ((audience = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text])));
alter table public."user_notifications" add constraint "user_notifications_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text])));
alter table public."user_preferences" add constraint "user_preferences_pkey" PRIMARY KEY (user_id);
alter table public."user_rating_peaks" add constraint "user_rating_peaks_pkey" PRIMARY KEY (user_id);
alter table public."user_ratings" add constraint "user_ratings_pkey" PRIMARY KEY (user_id, mode);
alter table public."user_ratings" add constraint "user_ratings_deviation_check" CHECK (((deviation >= 30) AND (deviation <= 500)));
alter table public."user_ratings" add constraint "user_ratings_draws_check" CHECK ((draws >= 0));
alter table public."user_ratings" add constraint "user_ratings_games_played_check" CHECK ((games_played >= 0));
alter table public."user_ratings" add constraint "user_ratings_losses_check" CHECK ((losses >= 0));
alter table public."user_ratings" add constraint "user_ratings_mode_check" CHECK ((mode = ANY (ARRAY['bullet'::text, 'blitz'::text, 'rapid'::text, 'classical'::text])));
alter table public."user_ratings" add constraint "user_ratings_rating_check" CHECK (((rating >= 100) AND (rating <= 4000)));
alter table public."user_ratings" add constraint "user_ratings_volatility_check" CHECK ((volatility > (0)::numeric));
alter table public."user_ratings" add constraint "user_ratings_wins_check" CHECK ((wins >= 0));
alter table public."users" add constraint "users_pkey" PRIMARY KEY (id);
alter table public."users" add constraint "users_email_key" UNIQUE (email);
alter table public."users" add constraint "users_firebase_uid_key" UNIQUE (firebase_uid);
alter table public."users" add constraint "users_username_key" UNIQUE (username);
alter table public."activity_feed" add constraint "activity_feed_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."admin_audit_logs" add constraint "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."admin_audit_logs" add constraint "admin_audit_logs_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."daily_puzzle_claims" add constraint "daily_puzzle_claims_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."game_invitations" add constraint "game_invitations_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE SET NULL;
alter table public."game_invitations" add constraint "game_invitations_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."game_invitations" add constraint "game_invitations_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."game_moves" add constraint "game_moves_game_id_fkey" FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
alter table public."game_review_moves" add constraint "game_review_moves_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."game_review_moves" add constraint "game_review_moves_review_id_fkey" FOREIGN KEY (review_id) REFERENCES game_reviews(id) ON DELETE CASCADE;
alter table public."game_review_moves" add constraint "game_review_moves_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."game_reviews" add constraint "game_reviews_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."game_reviews" add constraint "game_reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."review_quota_uses" add constraint "review_quota_uses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."review_quota_uses" add constraint "review_quota_uses_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."games" add constraint "games_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."matchmaking_events" add constraint "matchmaking_events_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE SET NULL;
alter table public."matchmaking_events" add constraint "matchmaking_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."matchmaking_user_generations" add constraint "matchmaking_user_generations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."media_assets" add constraint "media_assets_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."membership_checkouts" add constraint "membership_checkouts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."membership_subscriptions" add constraint "membership_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."online_game_chat" add constraint "online_game_chat_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."online_game_chat" add constraint "online_game_chat_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."online_game_moves" add constraint "online_game_moves_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."online_game_moves" add constraint "online_game_moves_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."online_game_spectators" add constraint "online_game_spectators_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."online_game_spectators" add constraint "online_game_spectators_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."online_game_tickets" add constraint "online_game_tickets_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."online_game_tickets" add constraint "online_game_tickets_ticket_fk" FOREIGN KEY (ticket_id) REFERENCES online_match_queue(id) ON DELETE RESTRICT;
alter table public."online_games" add constraint "online_games_black_user_id_fkey" FOREIGN KEY (black_user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."online_games" add constraint "online_games_draw_offered_by_fkey" FOREIGN KEY (draw_offered_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."online_games" add constraint "online_games_rematch_game_id_fkey" FOREIGN KEY (rematch_game_id) REFERENCES online_games(id) ON DELETE SET NULL;
alter table public."online_games" add constraint "online_games_rematch_requested_by_fkey" FOREIGN KEY (rematch_requested_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."online_games" add constraint "online_games_ticket_black_fk" FOREIGN KEY (matchmaking_ticket_black) REFERENCES online_match_queue(id) ON DELETE SET NULL;
alter table public."online_games" add constraint "online_games_ticket_white_fk" FOREIGN KEY (matchmaking_ticket_white) REFERENCES online_match_queue(id) ON DELETE SET NULL;
alter table public."online_games" add constraint "online_games_white_user_id_fkey" FOREIGN KEY (white_user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."online_match_queue" add constraint "online_match_queue_claimed_by_fkey" FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."online_match_queue" add constraint "online_match_queue_game_fk" FOREIGN KEY (matched_game_id) REFERENCES online_games(id) ON DELETE SET NULL;
alter table public."online_match_queue" add constraint "online_match_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."online_presence" add constraint "online_presence_current_game_fk" FOREIGN KEY (current_game_id) REFERENCES online_games(id) ON DELETE SET NULL;
alter table public."online_presence" add constraint "online_presence_queue_ticket_fk" FOREIGN KEY (current_queue_ticket_id) REFERENCES online_match_queue(id) ON DELETE SET NULL;
alter table public."online_presence" add constraint "online_presence_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."online_rating_events" add constraint "online_rating_events_black_user_id_fkey" FOREIGN KEY (black_user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."online_rating_events" add constraint "online_rating_events_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."online_rating_events" add constraint "online_rating_events_white_user_id_fkey" FOREIGN KEY (white_user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."online_ratings" add constraint "online_ratings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."opening_repertoire" add constraint "opening_repertoire_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."payment_transactions" add constraint "payment_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."personal_puzzles" add constraint "personal_puzzles_source_game_id_fkey" FOREIGN KEY (source_game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."personal_puzzles" add constraint "personal_puzzles_source_review_id_fkey" FOREIGN KEY (source_review_id) REFERENCES game_reviews(id) ON DELETE CASCADE;
alter table public."personal_puzzles" add constraint "personal_puzzles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."player_reports" add constraint "player_reports_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."player_reports" add constraint "player_reports_reported_user_id_fkey" FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."player_reports" add constraint "player_reports_reporter_user_id_fkey" FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."player_reports" add constraint "player_reports_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."puzzle_battles" add constraint "puzzle_battles_player_one_id_fkey" FOREIGN KEY (player_one_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."puzzle_battles" add constraint "puzzle_battles_player_two_id_fkey" FOREIGN KEY (player_two_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."puzzle_battles" add constraint "puzzle_battles_winner_user_id_fkey" FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."puzzle_progress" add constraint "puzzle_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."puzzle_sessions" add constraint "puzzle_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."support_messages" add constraint "support_messages_request_id_fkey" FOREIGN KEY (request_id) REFERENCES support_requests(id) ON DELETE CASCADE;
alter table public."support_messages" add constraint "support_messages_sender_user_id_fkey" FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."support_requests" add constraint "support_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."support_requests" add constraint "support_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."support_status_events" add constraint "support_status_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public."support_status_events" add constraint "support_status_events_request_id_fkey" FOREIGN KEY (request_id) REFERENCES support_requests(id) ON DELETE CASCADE;
alter table public."user_achievements" add constraint "user_achievements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_active_locks" add constraint "user_active_locks_game_id_fkey" FOREIGN KEY (game_id) REFERENCES online_games(id) ON DELETE CASCADE;
alter table public."user_active_locks" add constraint "user_active_locks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_bans" add constraint "user_bans_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."user_bans" add constraint "user_bans_lifted_by_fkey" FOREIGN KEY (lifted_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."user_bans" add constraint "user_bans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_follows" add constraint "user_follows_followed_user_id_fkey" FOREIGN KEY (followed_user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_follows" add constraint "user_follows_follower_user_id_fkey" FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_friendships" add constraint "user_friendships_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_friendships" add constraint "user_friendships_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_matchmaking_stats" add constraint "user_matchmaking_stats_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_memberships" add constraint "user_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_mutes" add constraint "user_mutes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."user_mutes" add constraint "user_mutes_lifted_by_fkey" FOREIGN KEY (lifted_by) REFERENCES users(id) ON DELETE SET NULL;
alter table public."user_mutes" add constraint "user_mutes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_notifications" add constraint "user_notifications_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_preferences" add constraint "user_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_rating_peaks" add constraint "user_rating_peaks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public."user_ratings" add constraint "user_ratings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

create index if not exists idx_activity_feed_actor_created ON public.activity_feed USING btree (actor_user_id, created_at DESC);
create index if not exists idx_activity_feed_visibility_created ON public.activity_feed USING btree (visibility, created_at DESC);
create index if not exists idx_admin_audit_logs_created ON public.admin_audit_logs USING btree (created_at DESC);
create index if not exists idx_auth_otps_email_purpose ON public.auth_otps USING btree (email, purpose, created_at DESC);
create index if not exists idx_bot_personas_active_window ON public.bot_personas USING btree (active, starts_at, ends_at, sort_order);
create index if not exists idx_daily_puzzle_claims_user_date ON public.daily_puzzle_claims USING btree (user_id, puzzle_date DESC);
create index if not exists game_invitations_inbox ON public.game_invitations USING btree (recipient_id, status, expires_at);
create index if not exists game_invitations_outbox ON public.game_invitations USING btree (sender_id, status, updated_at);
create UNIQUE index if not exists game_invitations_pending_pair ON public.game_invitations USING btree (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)) WHERE (status = 'pending'::text);
create index if not exists idx_game_moves_game_ply ON public.game_moves USING btree (game_id, ply);
create index if not exists idx_game_review_moves_user_tone ON public.game_review_moves USING btree (user_id, tone, created_at DESC);
create index if not exists idx_game_reviews_user_updated ON public.game_reviews USING btree (user_id, updated_at DESC);
create index if not exists idx_review_quota_uses_user_date ON public.review_quota_uses USING btree (user_id, usage_date, created_at DESC);
create index if not exists idx_games_user_saved_at ON public.games USING btree (user_id, saved_at DESC);
create index if not exists idx_matchmaking_events_session ON public.matchmaking_events USING btree (session_id, created_at DESC);
create index if not exists idx_matchmaking_events_type_created ON public.matchmaking_events USING btree (event_type, created_at DESC);
create index if not exists idx_matchmaking_outbox_pending ON public.matchmaking_outbox USING btree (available_at, id) WHERE (delivered_at IS NULL);
create index if not exists idx_media_assets_owner_created ON public.media_assets USING btree (owner_user_id, created_at DESC);
create index if not exists membership_subscriptions_user ON public.membership_subscriptions USING btree (user_id);
create index if not exists idx_online_game_chat_game_created ON public.online_game_chat USING btree (game_id, created_at);
create index if not exists idx_online_game_moves_game_ply ON public.online_game_moves USING btree (game_id, ply);
create index if not exists idx_online_game_tickets_game ON public.online_game_tickets USING btree (game_id);
create UNIQUE index if not exists idx_online_game_tickets_game_color_unique ON public.online_game_tickets USING btree (game_id, color);
create index if not exists idx_online_games_active_black ON public.online_games USING btree (black_user_id, updated_at DESC) WHERE (status = 'active'::text);
create index if not exists idx_online_games_active_white ON public.online_games USING btree (white_user_id, updated_at DESC) WHERE (status = 'active'::text);
create UNIQUE index if not exists idx_online_games_match_key_unique ON public.online_games USING btree (matchmaking_match_key) WHERE (matchmaking_match_key IS NOT NULL);
create index if not exists idx_online_games_players ON public.online_games USING btree (white_user_id, black_user_id, updated_at DESC);
create index if not exists idx_online_games_quick_recent_pair ON public.online_games USING btree (match_type, created_at DESC, white_user_id, black_user_id) WHERE (match_type = 'quick'::text);
create UNIQUE index if not exists idx_online_games_ticket_black_unique ON public.online_games USING btree (matchmaking_ticket_black) WHERE (matchmaking_ticket_black IS NOT NULL);
create UNIQUE index if not exists idx_online_games_ticket_white_unique ON public.online_games USING btree (matchmaking_ticket_white) WHERE (matchmaking_ticket_white IS NOT NULL);
create UNIQUE index if not exists idx_online_match_queue_active_idempotency ON public.online_match_queue USING btree (user_id, idempotency_key) WHERE ((status = ANY (ARRAY['waiting'::text, 'claimed'::text])) AND (idempotency_key IS NOT NULL));
create UNIQUE index if not exists idx_online_match_queue_active_user ON public.online_match_queue USING btree (user_id) WHERE (status = ANY (ARRAY['waiting'::text, 'claimed'::text]));
create index if not exists idx_online_match_queue_candidate_rating ON public.online_match_queue USING btree (time_control, mode, pool, rating, joined_at, id) WHERE (status = 'waiting'::text);
create index if not exists idx_online_match_queue_cleanup ON public.online_match_queue USING btree (last_seen, id) WHERE (status = ANY (ARRAY['waiting'::text, 'claimed'::text]));
create index if not exists idx_online_match_queue_joined ON public.online_match_queue USING btree (time_control, joined_at);
create index if not exists idx_online_match_queue_stale ON public.online_match_queue USING btree (last_seen) WHERE (status = ANY (ARRAY['waiting'::text, 'claimed'::text]));
create index if not exists idx_online_match_queue_v2_candidates ON public.online_match_queue USING btree (time_control, mode, pool, region_scope, rating, joined_at, id) INCLUDE (user_id, display_name, rating_min, rating_max, generation, lease_expires_at, session_id) WHERE (status = 'waiting'::text);
create index if not exists idx_online_match_queue_waiting_pool ON public.online_match_queue USING btree (time_control, mode, pool, joined_at, rating) WHERE (status = 'waiting'::text);
create index if not exists idx_online_match_queue_waiting_shard ON public.online_match_queue USING btree (time_control, mode, pool, queue_shard, joined_at, rating) WHERE (status = 'waiting'::text);
create index if not exists online_match_queue_v3_rating_candidates ON public.online_match_queue USING btree (time_control, mode, rating, joined_at, id) WHERE (status = 'waiting'::text);
create index if not exists idx_online_presence_last_seen ON public.online_presence USING btree (last_seen DESC);
create index if not exists idx_online_ratings_rating ON public.online_ratings USING btree (rating DESC);
create index if not exists idx_opening_repertoire_user_updated ON public.opening_repertoire USING btree (user_id, updated_at DESC);
create UNIQUE index if not exists idx_payment_transactions_provider_event ON public.payment_transactions USING btree (provider, provider_event_id);
create UNIQUE index if not exists idx_payment_transactions_provider_transaction_kind ON public.payment_transactions USING btree (provider, provider_transaction_id, kind);
create index if not exists idx_payment_transactions_user_created ON public.payment_transactions USING btree (user_id, created_at DESC);
create index if not exists idx_personal_puzzles_user_status ON public.personal_puzzles USING btree (user_id, status, created_at DESC);
create index if not exists idx_player_reports_game ON public.player_reports USING btree (game_id, created_at DESC);
create index if not exists idx_player_reports_reported_user ON public.player_reports USING btree (reported_user_id, status, created_at DESC);
create index if not exists idx_player_reports_status_created ON public.player_reports USING btree (status, created_at DESC);
create index if not exists idx_puzzle_sessions_user_finished ON public.puzzle_sessions USING btree (user_id, mode, finished_at DESC);
create index if not exists idx_site_events_active_window ON public.site_events USING btree (active, starts_at DESC, ends_at);
create index if not exists idx_support_messages_request_created ON public.support_messages USING btree (request_id, created_at);
create index if not exists idx_support_requests_status_created ON public.support_requests USING btree (status, created_at DESC);
create index if not exists idx_support_requests_user_created ON public.support_requests USING btree (user_id, created_at DESC);
create index if not exists idx_support_status_events_request_created ON public.support_status_events USING btree (request_id, created_at);
create index if not exists idx_user_achievements_user_unlocked ON public.user_achievements USING btree (user_id, unlocked_at DESC, updated_at DESC);
create index if not exists idx_user_bans_active_user ON public.user_bans USING btree (user_id, status, created_at DESC);
create UNIQUE index if not exists idx_user_friendships_pair ON public.user_friendships USING btree (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));
create index if not exists idx_user_friendships_receiver_status ON public.user_friendships USING btree (receiver_id, status, updated_at DESC);
create index if not exists idx_user_friendships_requester_status ON public.user_friendships USING btree (requester_id, status, updated_at DESC);
create index if not exists idx_user_memberships_provider_subscription ON public.user_memberships USING btree (provider, provider_subscription_id) WHERE (provider_subscription_id IS NOT NULL);
create index if not exists idx_user_memberships_status ON public.user_memberships USING btree (status, tier, updated_at DESC);
create index if not exists idx_user_mutes_active_user ON public.user_mutes USING btree (user_id, status, created_at DESC);
create index if not exists idx_user_notifications_audience_created ON public.user_notifications USING btree (audience, created_at DESC);
create index if not exists idx_user_notifications_recipient_created ON public.user_notifications USING btree (recipient_user_id, created_at DESC);
create index if not exists idx_user_notifications_unread ON public.user_notifications USING btree (recipient_user_id, read_at, created_at DESC);
create index if not exists idx_user_ratings_mode_rating ON public.user_ratings USING btree (mode, rating);

CREATE OR REPLACE FUNCTION public.apply_paypal_subscription(p_user uuid, p_subscription text, p_tier text, p_cycle text, p_plan text, p_status text, p_paid_through timestamp with time zone, p_last_payment timestamp with time zone, p_started_at timestamp with time zone, p_provider_updated timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.user_memberships%rowtype; s public.membership_subscriptions%rowtype; v_access boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('membership:'||p_user::text,0));
  select * into s from public.membership_subscriptions where subscription_id=p_subscription for update;
  if found and s.user_id<>p_user then raise exception 'Subscription belongs to another account.' using errcode='42501'; end if;
  insert into public.membership_subscriptions(subscription_id,user_id,tier,billing_cycle,plan_id,provider_status,paid_through,last_payment_at,provider_updated_at,cancelled_at)
  values(p_subscription,p_user,p_tier,p_cycle,p_plan,p_status,p_paid_through,p_last_payment,p_provider_updated,
    case when p_status='CANCELLED' then now() end)
  on conflict(subscription_id) do update set
    paid_through=greatest(membership_subscriptions.paid_through,excluded.paid_through),
    last_payment_at=greatest(membership_subscriptions.last_payment_at,excluded.last_payment_at),
    provider_status=case when membership_subscriptions.cancelled_at is not null then 'CANCELLED'
      when excluded.provider_updated_at>=coalesce(membership_subscriptions.provider_updated_at,'epoch') then excluded.provider_status
      else membership_subscriptions.provider_status end,
    provider_updated_at=greatest(membership_subscriptions.provider_updated_at,excluded.provider_updated_at),
    cancelled_at=coalesce(membership_subscriptions.cancelled_at,excluded.cancelled_at),synced_at=now()
  returning * into s;
  select * into m from public.user_memberships where user_id=p_user for update;
  v_access:=coalesce(s.paid_through>now(),false);
  if m.provider_subscription_id=p_subscription or (v_access and (
      m.user_id is null or m.current_period_end is null or m.current_period_end<=now() or m.status<>'active'
      or public.membership_tier_rank(s.tier)>public.membership_tier_rank(m.tier))) then
    if v_access and m.provider='paypal' and m.provider_subscription_id<>p_subscription then
      update public.membership_subscriptions set cancel_requested=true where subscription_id=m.provider_subscription_id and cancelled_at is null;
    end if;
    insert into public.user_memberships(user_id,tier,status,billing_cycle,provider,provider_subscription_id,provider_plan_id,
      started_at,current_period_end,cancelled_at,cancel_at_period_end,synced_at,updated_at)
    values(p_user,p_tier,case when v_access then 'active' else 'expired' end,p_cycle,'paypal',p_subscription,p_plan,
      p_started_at,s.paid_through,s.cancelled_at,s.provider_status<>'ACTIVE',now(),now())
    on conflict(user_id) do update set tier=excluded.tier,status=excluded.status,billing_cycle=excluded.billing_cycle,
      provider=excluded.provider,provider_subscription_id=excluded.provider_subscription_id,provider_plan_id=excluded.provider_plan_id,
      started_at=case when user_memberships.provider_subscription_id=excluded.provider_subscription_id then user_memberships.started_at else excluded.started_at end,
      current_period_end=excluded.current_period_end,cancelled_at=excluded.cancelled_at,cancel_at_period_end=excluded.cancel_at_period_end,synced_at=now(),updated_at=now();
  elsif v_access and m.provider_subscription_id<>p_subscription and public.membership_tier_rank(p_tier)<=public.membership_tier_rank(m.tier) then
    -- A delayed approval of an older/lower checkout must never downgrade or renew alongside the current plan.
    update public.membership_subscriptions set cancel_requested=true where subscription_id=p_subscription and cancelled_at is null;
  end if;
  if p_status not in('APPROVAL_PENDING','APPROVED') then
    delete from public.membership_checkouts where user_id=p_user and subscription_id=p_subscription;
  end if;
  return (select to_jsonb(user_memberships) from public.user_memberships where user_id=p_user);
end $function$;
revoke all on function public."apply_paypal_subscription"(p_user uuid, p_subscription text, p_tier text, p_cycle text, p_plan text, p_status text, p_paid_through timestamp with time zone, p_last_payment timestamp with time zone, p_started_at timestamp with time zone, p_provider_updated timestamp with time zone) from public, anon, authenticated;
grant execute on function public."apply_paypal_subscription"(p_user uuid, p_subscription text, p_tier text, p_cycle text, p_plan text, p_status text, p_paid_through timestamp with time zone, p_last_payment timestamp with time zone, p_started_at timestamp with time zone, p_provider_updated timestamp with time zone) to service_role;

CREATE OR REPLACE FUNCTION public.cleanup_online_matchmaking()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
revoke all on function public."cleanup_online_matchmaking"() from public, anon, authenticated;
grant execute on function public."cleanup_online_matchmaking"() to service_role;

CREATE OR REPLACE FUNCTION public.commit_online_move_v2(p_game_id uuid, p_user_id uuid, p_expected_ply integer, p_expected_turn text, p_san text, p_lan text, p_from_square text, p_to_square text, p_promotion text, p_fen_after text, p_pgn_after text, p_next_turn text, p_next_status text, p_result text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
revoke all on function public."commit_online_move_v2"(p_game_id uuid, p_user_id uuid, p_expected_ply integer, p_expected_turn text, p_san text, p_lan text, p_from_square text, p_to_square text, p_promotion text, p_fen_after text, p_pgn_after text, p_next_turn text, p_next_status text, p_result text) from public, anon, authenticated;
grant execute on function public."commit_online_move_v2"(p_game_id uuid, p_user_id uuid, p_expected_ply integer, p_expected_turn text, p_san text, p_lan text, p_from_square text, p_to_square text, p_promotion text, p_fen_after text, p_pgn_after text, p_next_turn text, p_next_status text, p_result text) to service_role;

CREATE OR REPLACE FUNCTION public.commit_online_move_v3(p_game_id uuid, p_user_id uuid, p_expected_ply integer, p_expected_turn text, p_san text, p_lan text, p_from_square text, p_to_square text, p_promotion text, p_fen_after text, p_pgn_after text, p_next_turn text, p_next_status text, p_result text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g jsonb;
begin
  select to_jsonb(online_games) into g from public.online_games where id=p_game_id;
  if g is null then raise exception 'Game not found.' using errcode='P0002'; end if;
  if p_user_id is null or p_user_id not in((g->>'white_user_id')::uuid,(g->>'black_user_id')::uuid) then
    raise exception 'Player is not in game.' using errcode='42501';
  end if;
  -- Expiration takes and retains the row lock until the move transaction commits.
  g:=public.expire_online_game(p_game_id);
  if g->>'status'<>'active' then return g; end if;
  return public.commit_online_move_v2(p_game_id,p_user_id,p_expected_ply,p_expected_turn,p_san,p_lan,
    p_from_square,p_to_square,p_promotion,p_fen_after,p_pgn_after,p_next_turn,p_next_status,p_result);
end $function$;
revoke all on function public."commit_online_move_v3"(p_game_id uuid, p_user_id uuid, p_expected_ply integer, p_expected_turn text, p_san text, p_lan text, p_from_square text, p_to_square text, p_promotion text, p_fen_after text, p_pgn_after text, p_next_turn text, p_next_status text, p_result text) from public, anon, authenticated;
grant execute on function public."commit_online_move_v3"(p_game_id uuid, p_user_id uuid, p_expected_ply integer, p_expected_turn text, p_san text, p_lan text, p_from_square text, p_to_square text, p_promotion text, p_fen_after text, p_pgn_after text, p_next_turn text, p_next_status text, p_result text) to service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_ms integer)
 RETURNS TABLE(allowed boolean, retry_after integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
revoke all on function public."consume_rate_limit"(p_key text, p_limit integer, p_window_ms integer) from public, anon, authenticated;
grant execute on function public."consume_rate_limit"(p_key text, p_limit integer, p_window_ms integer) to service_role;

CREATE OR REPLACE FUNCTION public.enforce_single_active_online_game()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
revoke all on function public."enforce_single_active_online_game"() from public, anon, authenticated;
grant execute on function public."enforce_single_active_online_game"() to service_role;

CREATE OR REPLACE FUNCTION public.expire_online_game(p_game uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g public.online_games%rowtype; m record;
  v_now timestamptz; v_previous timestamptz; v_first_move timestamptz;
  v_white numeric; v_black numeric; v_increment numeric; v_elapsed numeric; v_ply integer:=0;
begin
  select * into g from public.online_games where id=p_game for update;
  if not found then raise exception 'Game not found.' using errcode='P0002'; end if;
  if g.status<>'active' then return to_jsonb(g); end if;
  v_now:=clock_timestamp();
  v_previous:=coalesce(g.started_at,g.last_move_at,g.created_at);
  v_white:=split_part(g.time_control,'+',1)::numeric*1000;
  v_black:=v_white;
  v_increment:=coalesce(nullif(split_part(g.time_control,'+',2),''),'0')::numeric*1000;
  for m in select color,created_at from public.online_game_moves where game_id=p_game order by ply loop
    v_ply:=v_ply+1;
    if v_ply=1 then v_first_move:=m.created_at; end if;
    v_elapsed:=greatest(0,extract(epoch from (m.created_at-v_previous))*1000);
    if m.color='w' then v_white:=greatest(0,v_white-v_elapsed)+v_increment;
    else v_black:=greatest(0,v_black-v_elapsed)+v_increment; end if;
    v_previous:=m.created_at;
  end loop;
  if (v_ply=0 and v_now>=v_previous+interval '20 seconds')
    or (v_ply=1 and v_now>=v_first_move+interval '20 seconds') then
    update public.online_games set status='abandoned',result='*',finished_at=v_now,updated_at=v_now
      where id=p_game returning * into g;
  elsif (case when g.turn='w' then v_white else v_black end)
    <=greatest(0,extract(epoch from (v_now-v_previous))*1000) then
    update public.online_games set status='resigned',result=case when turn='w' then '0-1' else '1-0' end,
      finished_at=v_now,updated_at=v_now where id=p_game returning * into g;
  end if;
  if g.status<>'active' then
    delete from public.user_active_locks where game_id=p_game;
    update public.online_presence set status='online',current_game_id=null,current_queue_ticket_id=null,
      last_seen=v_now,updated_at=v_now where current_game_id=p_game or user_id in(g.white_user_id,g.black_user_id);
  end if;
  return to_jsonb(g);
end $function$;
revoke all on function public."expire_online_game"(p_game uuid) from public, anon, authenticated;
grant execute on function public."expire_online_game"(p_game uuid) to service_role;

CREATE OR REPLACE FUNCTION public.finalize_online_rating_result(p_game_id uuid, p_result text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if v_game.status not in ('checkmate','draw','resigned') or v_game.result is distinct from p_result then
    raise exception 'Rating result must match the finished game.' using errcode='55000';
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
      updated_at = clock_timestamp()
  where user_id = v_game.white_user_id and mode = coalesce(v_game.mode, 'rapid');

  update public.user_ratings
  set rating = v_black_after,
      games_played = games_played + 1,
      wins = wins + case when v_black_score = 1 then 1 else 0 end,
      losses = losses + case when v_black_score = 0 then 1 else 0 end,
      draws = draws + case when v_black_score = 0.5 then 1 else 0 end,
      provisional = games_played + 1 < 20,
      deviation = greatest(30, deviation - case when games_played < 20 then 12 else 4 end),
      updated_at = clock_timestamp()
  where user_id = v_game.black_user_id and mode = coalesce(v_game.mode, 'rapid');

  update public.online_games
  set white_rating_before = coalesce(white_rating_before, v_white.rating),
      black_rating_before = coalesce(black_rating_before, v_black.rating),
      white_rating_after = v_white_after,
      black_rating_after = v_black_after,
      updated_at = clock_timestamp()
  where id = p_game_id;

  return jsonb_build_object(
    'status', 'finalized',
    'white', jsonb_build_object('before', v_white.rating, 'after', v_white_after, 'delta', v_white_delta),
    'black', jsonb_build_object('before', v_black.rating, 'after', v_black_after, 'delta', v_black_delta)
  );
end;
$function$;
revoke all on function public."finalize_online_rating_result"(p_game_id uuid, p_result text) from public, anon, authenticated;
grant execute on function public."finalize_online_rating_result"(p_game_id uuid, p_result text) to service_role;

CREATE OR REPLACE FUNCTION public.get_platform_capabilities()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object('matchmakingVersion',3,'matchmakingRevision',3,'directInvitations',true,'recurringMemberships',true,'gameplayVersion',1,'gameLogVersion',1,'reviewVersion',2,'accountBanAppeals',true);
$function$;
revoke all on function public."get_platform_capabilities"() from public, anon, authenticated;
grant execute on function public."get_platform_capabilities"() to service_role;

CREATE OR REPLACE FUNCTION public.matchmaking_elo_window(p_joined_at timestamp with time zone, p_preference integer DEFAULT 500)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  select least(200,greatest(50,coalesce(p_preference,200)),case
    when now()-p_joined_at < interval '5 seconds' then 50
    when now()-p_joined_at < interval '12 seconds' then 100
    when now()-p_joined_at < interval '25 seconds' then 150 else 200 end);
$function$;
revoke all on function public."matchmaking_elo_window"(p_joined_at timestamp with time zone, p_preference integer) from public, anon, authenticated;
grant execute on function public."matchmaking_elo_window"(p_joined_at timestamp with time zone, p_preference integer) to service_role;

CREATE OR REPLACE FUNCTION public.matchmaking_fairness_score(p_wait_ms integer, p_rating_gap integer, p_same_region boolean DEFAULT true, p_recent_opponent boolean DEFAULT false)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select greatest(0, least(1000,
    1000
    - least(coalesce(p_rating_gap, 0), 1000)
    + least(greatest(coalesce(p_wait_ms, 0), 0) / 100, 200)
    + case when coalesce(p_same_region, true) then 25 else 0 end
    - case when coalesce(p_recent_opponent, false) then 250 else 0 end
  ));
$function$;
revoke all on function public."matchmaking_fairness_score"(p_wait_ms integer, p_rating_gap integer, p_same_region boolean, p_recent_opponent boolean) from public, anon, authenticated;
grant execute on function public."matchmaking_fairness_score"(p_wait_ms integer, p_rating_gap integer, p_same_region boolean, p_recent_opponent boolean) to service_role;

CREATE OR REPLACE FUNCTION public.matchmaking_region_limit(p_region text, p_joined_at timestamp with time zone)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
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
revoke all on function public."matchmaking_region_limit"(p_region text, p_joined_at timestamp with time zone) from public, anon, authenticated;
grant execute on function public."matchmaking_region_limit"(p_region text, p_joined_at timestamp with time zone) to service_role;

CREATE OR REPLACE FUNCTION public.matchmaking_region_rank(p_region text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case lower(coalesce(p_region, 'global'))
    when 'vn' then 0
    when 'sea' then 1
    when 'asia' then 2
    else 3
  end;
$function$;
revoke all on function public."matchmaking_region_rank"(p_region text) from public, anon, authenticated;
grant execute on function public."matchmaking_region_rank"(p_region text) to service_role;

CREATE OR REPLACE FUNCTION public.matchmaking_regions_compatible(p_region_a text, p_joined_a timestamp with time zone, p_region_b text, p_joined_b timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select public.matchmaking_region_rank(p_region_a)
           <= public.matchmaking_region_limit(p_region_b, p_joined_b)
     and public.matchmaking_region_rank(p_region_b)
           <= public.matchmaking_region_limit(p_region_a, p_joined_a);
$function$;
revoke all on function public."matchmaking_regions_compatible"(p_region_a text, p_joined_a timestamp with time zone, p_region_b text, p_joined_b timestamp with time zone) from public, anon, authenticated;
grant execute on function public."matchmaking_regions_compatible"(p_region_a text, p_joined_a timestamp with time zone, p_region_b text, p_joined_b timestamp with time zone) to service_role;

CREATE OR REPLACE FUNCTION public.membership_tier_rank(p_tier text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
select case p_tier when 'plus' then 1 when 'pro' then 2 when 'master' then 3 else 0 end;
$function$;
revoke all on function public."membership_tier_rank"(p_tier text) from public, anon, authenticated;
grant execute on function public."membership_tier_rank"(p_tier text) to service_role;

CREATE OR REPLACE FUNCTION public.online_game_snapshot(p_game uuid, p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('game',to_jsonb(g),'moves',coalesce(
    (select jsonb_agg(to_jsonb(m) order by m.ply) from public.online_game_moves m where m.game_id=g.id),'[]'::jsonb))
  from public.online_games g where g.id=p_game and p_user in(g.white_user_id,g.black_user_id);
$function$;
revoke all on function public."online_game_snapshot"(p_game uuid, p_user uuid) from public, anon, authenticated;
grant execute on function public."online_game_snapshot"(p_game uuid, p_user uuid) to service_role;

CREATE OR REPLACE FUNCTION public.quick_match_cancel_v2(p_user_id uuid, p_ticket_id uuid, p_session_id text, p_reason text DEFAULT 'user_cancelled'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cancelled uuid;
  v_game uuid;
  v_cooldown_until timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('queue-v2:' || p_user_id::text, 0));

  select q.matched_game_id into v_game
  from public.online_match_queue q join public.online_games g on g.id=q.matched_game_id
  where q.id=p_ticket_id and q.user_id=p_user_id and q.session_id=left(p_session_id,120)
    and q.status='matched' and g.status='active';
  if v_game is not null then
    return jsonb_build_object('status','matched','game_id',v_game,'queue_ticket_id',p_ticket_id);
  end if;

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
revoke all on function public."quick_match_cancel_v2"(p_user_id uuid, p_ticket_id uuid, p_session_id text, p_reason text) from public, anon, authenticated;
grant execute on function public."quick_match_cancel_v2"(p_user_id uuid, p_ticket_id uuid, p_session_id text, p_reason text) to service_role;

CREATE OR REPLACE FUNCTION public.quick_match_find_game_v2(p_user_id uuid, p_time_control text, p_mode text, p_rating integer DEFAULT NULL::integer, p_client_id text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text, p_region text DEFAULT 'global'::text, p_rating_range_preference integer DEFAULT 500, p_idempotency_key text DEFAULT NULL::text, p_renew_lease boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.quick_match_find_game_v3(p_user_id,p_time_control,p_mode,p_rating,p_client_id,p_session_id,
    p_region,p_rating_range_preference,p_idempotency_key,p_renew_lease);
$function$;
revoke all on function public."quick_match_find_game_v2"(p_user_id uuid, p_time_control text, p_mode text, p_rating integer, p_client_id text, p_session_id text, p_region text, p_rating_range_preference integer, p_idempotency_key text, p_renew_lease boolean) from public, anon, authenticated;
grant execute on function public."quick_match_find_game_v2"(p_user_id uuid, p_time_control text, p_mode text, p_rating integer, p_client_id text, p_session_id text, p_region text, p_rating_range_preference integer, p_idempotency_key text, p_renew_lease boolean) to service_role;

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
    and q.pool in ('standard', 'provisional')
    and pg_try_advisory_xact_lock(hashtextextended('queue-v2:' || q.user_id::text, 0))
    and q.rating between v_rating - 200 and v_rating + 200
    -- Both players must accept the gap, even on the immediate fallback path.
    and abs(v_rating - q.rating) <= least(200,
      greatest(50, v_me.rating_range_preference), greatest(50, q.rating_range_preference))
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
    -- Preserve the normal expanding-window/pool policy as first preference.
    -- If none qualify, pair an already-waiting compatible opponent immediately.
    case when (q.pool = v_pool or v_now - least(q.joined_at, v_me.joined_at) >= interval '30 seconds')
      and abs(v_rating - q.rating) <= least(
        public.matchmaking_elo_window(least(v_me.joined_at,q.joined_at),v_me.rating_range_preference),
        public.matchmaking_elo_window(least(v_me.joined_at,q.joined_at),q.rating_range_preference))
      then 0 else 1 end,
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
      'rating_limit', least(200, greatest(50, v_me.rating_range_preference)),
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
    'rating_limit', least(200, greatest(50, v_me.rating_range_preference)),
      'rating_window', v_window, 'rating', v_rating, 'joined_at', v_me.joined_at,
    'rating_gap', abs(v_rating - v_opponent.rating),
    'fairness_score', v_fairness,
    'region', v_region,
    'mode', p_mode,
    'pool', v_pool
  );
end;
$function$;
revoke all on function public."quick_match_find_game_v3"(p_user_id uuid, p_time_control text, p_mode text, p_rating integer, p_client_id text, p_session_id text, p_region text, p_rating_range_preference integer, p_idempotency_key text, p_renew_lease boolean) from public, anon, authenticated;
grant execute on function public."quick_match_find_game_v3"(p_user_id uuid, p_time_control text, p_mode text, p_rating integer, p_client_id text, p_session_id text, p_region text, p_rating_range_preference integer, p_idempotency_key text, p_renew_lease boolean) to service_role;

CREATE OR REPLACE FUNCTION public.quick_match_heartbeat_v2(p_user_id uuid, p_ticket_id uuid, p_client_id text, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
revoke all on function public."quick_match_heartbeat_v2"(p_user_id uuid, p_ticket_id uuid, p_client_id text, p_session_id text) from public, anon, authenticated;
grant execute on function public."quick_match_heartbeat_v2"(p_user_id uuid, p_ticket_id uuid, p_client_id text, p_session_id text) to service_role;

CREATE OR REPLACE FUNCTION public.reconcile_matchmaking_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    and not exists(select 1 from public.online_games previous where previous.rematch_game_id=g.id)
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
revoke all on function public."reconcile_matchmaking_v2"() from public, anon, authenticated;
grant execute on function public."reconcile_matchmaking_v2"() to service_role;

CREATE OR REPLACE FUNCTION public.record_rating_peak()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.games_played >= 10 then
    insert into public.user_rating_peaks(user_id, peak_rating) values(new.user_id,new.rating)
    on conflict(user_id) do update set peak_rating=greatest(user_rating_peaks.peak_rating,excluded.peak_rating),updated_at=now();
  end if;
  return new;
end $function$;
revoke all on function public."record_rating_peak"() from public, anon, authenticated;
grant execute on function public."record_rating_peak"() to service_role;

CREATE OR REPLACE FUNCTION public.reserve_membership_checkout(p_user uuid, p_tier text, p_cycle text, p_plan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.user_memberships%rowtype; c public.membership_checkouts%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('membership:'||p_user::text,0));
  if public.membership_tier_rank(p_tier)=0 or p_cycle not in('monthly','yearly') then raise exception 'Invalid package.' using errcode='22023'; end if;
  select * into m from public.user_memberships where user_id=p_user;
  if m.status='active' and m.current_period_end>now() and public.membership_tier_rank(p_tier)<=public.membership_tier_rank(m.tier) then
    raise exception 'Bạn đang có gói này hoặc gói cao hơn.' using errcode='55000';
  end if;
  select * into c from public.membership_checkouts where user_id=p_user;
  if found then
    if c.tier<>p_tier or c.billing_cycle<>p_cycle or c.plan_id<>p_plan then
      raise exception 'Bạn có giao dịch PayPal đang chờ duyệt. Hãy hủy giao dịch trước khi chọn gói khác.' using errcode='55000';
    end if;
    return to_jsonb(c);
  end if;
  insert into public.membership_checkouts(user_id,tier,billing_cycle,plan_id) values(p_user,p_tier,p_cycle,p_plan) returning * into c;
  return to_jsonb(c);
end $function$;
revoke all on function public."reserve_membership_checkout"(p_user uuid, p_tier text, p_cycle text, p_plan text) from public, anon, authenticated;
grant execute on function public."reserve_membership_checkout"(p_user uuid, p_tier text, p_cycle text, p_plan text) to service_role;

CREATE OR REPLACE FUNCTION public.resign_online_game(p_user uuid, p_game uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g public.online_games%rowtype;
begin
  select * into g from public.online_games where id=p_game for update;
  if not found then raise exception 'Game not found.' using errcode='P0002'; end if;
  if p_user is null or not (coalesce(p_user=g.white_user_id,false) or coalesce(p_user=g.black_user_id,false)) then
    raise exception 'Only a player can resign.' using errcode='42501';
  end if;
  perform public.expire_online_game(p_game);
  select * into g from public.online_games where id=p_game;
  if g.status='active' then
    update public.online_games set status='resigned',result=case when white_user_id=p_user then '0-1' else '1-0' end,
      draw_offered_by=null,draw_offered_at=null,finished_at=clock_timestamp(),updated_at=clock_timestamp()
      where id=p_game returning * into g;
  end if;
  return to_jsonb(g);
end $function$;
revoke all on function public."resign_online_game"(p_user uuid, p_game uuid) from public, anon, authenticated;
grant execute on function public."resign_online_game"(p_user uuid, p_game uuid) to service_role;

CREATE OR REPLACE FUNCTION public.respond_game_invitation(p_user uuid, p_invitation uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.game_invitations%rowtype; v_white uuid; v_black uuid; v_game uuid; v_mode text;
begin
  select * into v from public.game_invitations where id=p_invitation;
  if not found or p_user not in(v.sender_id,v.recipient_id) then raise exception 'Lời mời không tồn tại.' using errcode='42501'; end if;
  if (p_action='cancel' and p_user<>v.sender_id) or (p_action in ('accept','decline') and p_user<>v.recipient_id)
    or p_action not in('accept','decline','cancel') then raise exception 'Không có quyền phản hồi lời mời.' using errcode='42501'; end if;
  -- Same lock order and namespace as ranked matching: no overlapping games.
  perform pg_advisory_xact_lock(hashtextextended('queue-v2:'||least(v.sender_id,v.recipient_id)::text,0));
  perform pg_advisory_xact_lock(hashtextextended('queue-v2:'||greatest(v.sender_id,v.recipient_id)::text,0));
  select * into v from public.game_invitations where id=p_invitation for update;
  if v.status<>'pending' then return to_jsonb(v); end if;
  if v.expires_at<=now() then
    update public.game_invitations set status='expired',updated_at=now() where id=v.id returning * into v;
    return to_jsonb(v);
  end if;
  if p_action<>'accept' then
    update public.game_invitations set status=case p_action when 'cancel' then 'cancelled' else 'declined' end,updated_at=now()
      where id=v.id returning * into v;
    return to_jsonb(v);
  end if;
  if not exists(select 1 from public.user_friendships where status='accepted' and
    least(requester_id,receiver_id)=least(v.sender_id,v.recipient_id) and greatest(requester_id,receiver_id)=greatest(v.sender_id,v.recipient_id)) then
    raise exception 'Hai người chơi không còn là bạn bè.' using errcode='42501';
  end if;
  if exists(select 1 from public.user_bans where status='active' and (expires_at is null or expires_at>now()) and user_id in(v.sender_id,v.recipient_id)) then
    raise exception 'Một tài khoản đang bị tạm khóa.' using errcode='42501';
  end if;
  if exists(select 1 from public.online_games where status='active' and
    (white_user_id in(v.sender_id,v.recipient_id) or black_user_id in(v.sender_id,v.recipient_id))) then
    raise exception 'Một người chơi đã vào trận khác. Hãy thử lại sau.' using errcode='55000';
  end if;
  v_white:=case when v.sender_color='w' or (v.sender_color='random' and random()<0.5) then v.sender_id else v.recipient_id end;
  v_black:=case when v_white=v.sender_id then v.recipient_id else v.sender_id end;
  v_mode:=case when v.time_control in('180+0','300+0') then 'blitz' else 'rapid' end;
  insert into public.user_ratings(user_id,mode) values(v_white,v_mode),(v_black,v_mode) on conflict(user_id,mode) do nothing;
  insert into public.online_games(status,match_type,white_user_id,black_user_id,white_name,black_name,
    fen,pgn,turn,result,time_control,mode,rated,started_at,last_move_at,white_rating_before,black_rating_before)
  values('active','friend',v_white,v_black,
    (select display_name from public.users where id=v_white),(select display_name from public.users where id=v_black),
    'start','','w','*',v.time_control,v_mode,false,now(),now(),
    (select rating from public.user_ratings where user_id=v_white and mode=v_mode),
    (select rating from public.user_ratings where user_id=v_black and mode=v_mode)) returning id into v_game;
  update public.online_match_queue set status='cancelled',cancel_reason='accepted_invitation',cancelled_at=now(),lease_expires_at=now(),updated_at=now()
    where user_id in(v.sender_id,v.recipient_id) and status in('waiting','claimed');
  delete from public.user_active_locks where user_id in(v.sender_id,v.recipient_id);
  insert into public.user_active_locks(user_id,game_id) values(v.sender_id,v_game),(v.recipient_id,v_game);
  update public.online_presence set status='playing',current_game_id=v_game,current_queue_ticket_id=null,updated_at=now()
    where user_id in(v.sender_id,v.recipient_id);
  update public.game_invitations set status='accepted',game_id=v_game,updated_at=now() where id=v.id returning * into v;
  update public.game_invitations set status='cancelled',updated_at=now() where status='pending' and id<>v.id and
    (sender_id in(v.sender_id,v.recipient_id) or recipient_id in(v.sender_id,v.recipient_id));
  return to_jsonb(v);
end $function$;
revoke all on function public."respond_game_invitation"(p_user uuid, p_invitation uuid, p_action text) from public, anon, authenticated;
grant execute on function public."respond_game_invitation"(p_user uuid, p_invitation uuid, p_action text) to service_role;

CREATE OR REPLACE FUNCTION public.respond_online_draw(p_user uuid, p_game uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g public.online_games%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if p_action is null or p_action not in ('offer','accept','decline','cancel') then
    raise exception 'Invalid draw action.' using errcode='22023';
  end if;
  select * into g from public.online_games where id=p_game for update;
  if not found then raise exception 'Game not found.' using errcode='P0002'; end if;
  if p_user is null or p_user not in(g.white_user_id,g.black_user_id) then
    raise exception 'Only the players can respond.' using errcode='42501';
  end if;
  if g.status<>'active' then return to_jsonb(g); end if;
  perform public.expire_online_game(p_game);
  select * into g from public.online_games where id=p_game;
  if g.status<>'active' then return to_jsonb(g); end if;
  v_now:=clock_timestamp();
  if p_action='offer' then
    if g.draw_offered_by is not null then
      if g.draw_offered_by=p_user then return to_jsonb(g); end if;
      raise exception 'Your opponent already offered a draw.' using errcode='55000';
    end if;
    update public.online_games set draw_offered_by=p_user,draw_offered_at=v_now,updated_at=v_now where id=p_game returning * into g;
  else
    if g.draw_offered_by is null then raise exception 'No pending draw offer.' using errcode='55000'; end if;
    if (p_action='cancel' and g.draw_offered_by<>p_user)
      or (p_action in('accept','decline') and g.draw_offered_by=p_user) then
      raise exception 'You cannot answer this draw offer.' using errcode='42501';
    end if;
    update public.online_games set draw_offered_by=null,draw_offered_at=null,
      status=case when p_action='accept' then 'draw' else status end,
      result=case when p_action='accept' then '1/2-1/2' else result end,
      finished_at=case when p_action='accept' then v_now else finished_at end,updated_at=v_now
      where id=p_game returning * into g;
  end if;
  return to_jsonb(g);
end $function$;
revoke all on function public."respond_online_draw"(p_user uuid, p_game uuid, p_action text) from public, anon, authenticated;
grant execute on function public."respond_online_draw"(p_user uuid, p_game uuid, p_action text) to service_role;

CREATE OR REPLACE FUNCTION public.respond_online_rematch(p_user uuid, p_game uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g public.online_games%rowtype;
  n public.online_games%rowtype;
  v_now timestamptz;
begin
  if p_action is null or p_action not in ('request','accept','decline') then
    raise exception 'Invalid rematch action.' using errcode='22023';
  end if;
  select * into g from public.online_games where id=p_game;
  if not found then raise exception 'Game not found.' using errcode='P0002'; end if;
  if p_user is null or p_user not in (g.white_user_id,g.black_user_id) then
    raise exception 'Only the players can request a rematch.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('queue-v2:'||least(g.white_user_id,g.black_user_id)::text,0));
  perform pg_advisory_xact_lock(hashtextextended('queue-v2:'||greatest(g.white_user_id,g.black_user_id)::text,0));
  select * into g from public.online_games where id=p_game for update;
  v_now := clock_timestamp();
  if g.status not in ('checkmate','draw','resigned') then
    raise exception 'Rematch is available after the game ends.' using errcode='55000';
  end if;
  -- A retry, late decline or another request must never detach an accepted game.
  if g.rematch_game_id is not null then
    select * into n from public.online_games where id=g.rematch_game_id;
    return jsonb_build_object('previous_game',to_jsonb(g),'game',to_jsonb(n));
  end if;
  if p_action='request' then
    if g.rematch_requested_by is not null and g.rematch_response is null
      and g.rematch_requested_at > v_now-interval '15 seconds' then
      if g.rematch_requested_by<>p_user then
        raise exception 'Answer your opponent''s rematch request first.' using errcode='55000';
      end if;
      return jsonb_build_object('previous_game',to_jsonb(g),'game',null);
    end if;
  else
    if g.rematch_requested_by is null or g.rematch_response is not null then
      raise exception 'No pending rematch request.' using errcode='55000';
    end if;
    if g.rematch_requested_by=p_user then
      raise exception 'Only the opponent can answer this rematch.' using errcode='42501';
    end if;
    if g.rematch_requested_at is null or g.rematch_requested_at<=v_now-interval '15 seconds' then
      update public.online_games set rematch_response='declined',updated_at=v_now where id=p_game returning * into g;
      return jsonb_build_object('previous_game',to_jsonb(g),'game',null,'expired',true);
    end if;
    if p_action='decline' then
      update public.online_games set rematch_response='declined',updated_at=v_now where id=p_game returning * into g;
      return jsonb_build_object('previous_game',to_jsonb(g),'game',null);
    end if;
  end if;
  if exists(select 1 from public.online_games where status='active'
    and (white_user_id in(g.white_user_id,g.black_user_id) or black_user_id in(g.white_user_id,g.black_user_id))) then
    raise exception 'Một người chơi đã vào trận khác.' using errcode='55000';
  end if;
  if exists(select 1 from public.user_bans where user_id in(g.white_user_id,g.black_user_id)
    and status='active' and (expires_at is null or expires_at>v_now)) then
    raise exception 'Một tài khoản đang bị tạm khóa.' using errcode='42501';
  end if;
  if p_action='request' then
    update public.online_games set rematch_requested_by=p_user,rematch_requested_at=v_now,
      rematch_response=null,updated_at=v_now where id=p_game returning * into g;
    return jsonb_build_object('previous_game',to_jsonb(g),'game',null);
  end if;

  -- Finish the previous rating transaction before taking the next game's baseline.
  perform public.finalize_online_rating_result(g.id,g.result);
  insert into public.user_ratings(user_id,mode) values(g.white_user_id,g.mode),(g.black_user_id,g.mode)
    on conflict(user_id,mode) do nothing;
  insert into public.online_games(status,match_type,white_user_id,black_user_id,white_name,black_name,
    fen,pgn,turn,result,time_control,mode,rated,started_at,last_move_at,white_rating_before,black_rating_before)
  values('active',g.match_type,g.black_user_id,g.white_user_id,g.black_name,g.white_name,
    'start','','w','*',g.time_control,g.mode,g.rated,v_now,v_now,
    (select rating from public.user_ratings where user_id=g.black_user_id and mode=g.mode),
    (select rating from public.user_ratings where user_id=g.white_user_id and mode=g.mode)) returning * into n;
  update public.online_games set rematch_response='accepted',rematch_game_id=n.id,updated_at=v_now
    where id=p_game returning * into g;
  update public.online_match_queue set status='cancelled',cancel_reason='accepted_rematch',
    cancelled_at=v_now,lease_expires_at=v_now,updated_at=v_now
    where user_id in(g.white_user_id,g.black_user_id) and status in('waiting','claimed');
  delete from public.user_active_locks where user_id in(g.white_user_id,g.black_user_id);
  insert into public.user_active_locks(user_id,game_id) values(g.white_user_id,n.id),(g.black_user_id,n.id);
  update public.online_presence set status='playing',current_game_id=n.id,current_queue_ticket_id=null,updated_at=v_now
    where user_id in(g.white_user_id,g.black_user_id);
  update public.game_invitations set status='cancelled',updated_at=v_now where status='pending'
    and (sender_id in(g.white_user_id,g.black_user_id) or recipient_id in(g.white_user_id,g.black_user_id));
  return jsonb_build_object('previous_game',to_jsonb(g),'game',to_jsonb(n));
end $function$;
revoke all on function public."respond_online_rematch"(p_user uuid, p_game uuid, p_action text) from public, anon, authenticated;
grant execute on function public."respond_online_rematch"(p_user uuid, p_game uuid, p_action text) to service_role;

CREATE OR REPLACE FUNCTION public.save_local_game_log(p_user uuid, p_log jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g public.games%rowtype; v_client text:=p_log->>'gameId';
begin
  if p_user is null or nullif(v_client,'') is null then
    raise exception 'Invalid game owner or id.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('local-game:'||v_client,0));
  select * into g from public.games where client_game_id=v_client for update;
  if found and g.user_id<>p_user then
    raise exception 'This game belongs to another account.' using errcode='42501';
  end if;
  insert into public.games(client_game_id,user_id,player_color,ai_elo,result,fen,pgn,headers,saved_at)
  values(v_client,p_user,p_log->>'playerColor',(p_log->>'aiElo')::integer,p_log->>'result',
    p_log->>'fen',coalesce(p_log->>'pgn',''),coalesce(p_log->'headers','{}'::jsonb),(p_log->>'savedAt')::timestamptz)
  on conflict(client_game_id) do update set player_color=excluded.player_color,ai_elo=excluded.ai_elo,
    result=excluded.result,fen=excluded.fen,pgn=excluded.pgn,headers=excluded.headers,saved_at=excluded.saved_at,updated_at=now()
  returning * into g;
  delete from public.game_moves where game_id=g.id;
  insert into public.game_moves(game_id,ply,move_number,color,san,lan,from_square,to_square,piece,captured,promotion,flags)
  select g.id,(m->>'ply')::integer,(m->>'moveNumber')::integer,m->>'color',m->>'san',m->>'lan',
    m->>'from',m->>'to',m->>'piece',m->>'captured',m->>'promotion',m->>'flags'
  from jsonb_array_elements(p_log->'moves') m;
  return g.id;
end $function$;
revoke all on function public."save_local_game_log"(p_user uuid, p_log jsonb) from public, anon, authenticated;
grant execute on function public."save_local_game_log"(p_user uuid, p_log jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.send_game_invitation(p_sender uuid, p_recipient uuid, p_time_control text, p_color text DEFAULT 'random'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_invitation public.game_invitations%rowtype;
begin
  if p_sender=p_recipient or p_time_control not in ('180+0','300+0','600+0','900+10') or p_color not in ('w','b','random') then
    raise exception 'Invalid invitation.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('queue-v2:'||least(p_sender,p_recipient)::text,0));
  perform pg_advisory_xact_lock(hashtextextended('queue-v2:'||greatest(p_sender,p_recipient)::text,0));
  if not exists(select 1 from public.user_friendships where status='accepted' and
    ((requester_id=p_sender and receiver_id=p_recipient) or (requester_id=p_recipient and receiver_id=p_sender))) then
    raise exception 'Bạn chỉ có thể mời người trong danh sách bạn bè.' using errcode='42501';
  end if;
  if exists(select 1 from public.online_games where status='active' and
    (white_user_id in(p_sender,p_recipient) or black_user_id in(p_sender,p_recipient))) then
    raise exception 'Một người chơi đang trong trận đấu.' using errcode='55000';
  end if;
  update public.game_invitations set status='expired',updated_at=now() where status='pending' and expires_at<=now() and
    (sender_id in(p_sender,p_recipient) or recipient_id in(p_sender,p_recipient));
  select * into v_invitation from public.game_invitations where status='pending' and
    least(sender_id,recipient_id)=least(p_sender,p_recipient) and greatest(sender_id,recipient_id)=greatest(p_sender,p_recipient);
  if found then return to_jsonb(v_invitation); end if;
  if (select count(*) from public.game_invitations where sender_id=p_sender and status='pending')>=3 then
    raise exception 'Bạn đang có 3 lời mời chờ phản hồi.' using errcode='55000';
  end if;
  insert into public.game_invitations(sender_id,recipient_id,time_control,sender_color)
    values(p_sender,p_recipient,p_time_control,p_color) returning * into v_invitation;
  return to_jsonb(v_invitation);
end $function$;
revoke all on function public."send_game_invitation"(p_sender uuid, p_recipient uuid, p_time_control text, p_color text) from public, anon, authenticated;
grant execute on function public."send_game_invitation"(p_sender uuid, p_recipient uuid, p_time_control text, p_color text) to service_role;

drop trigger if exists "trg_single_active_online_game" on public."online_games";
CREATE TRIGGER trg_single_active_online_game BEFORE INSERT OR UPDATE OF status, white_user_id, black_user_id ON public.online_games FOR EACH ROW EXECUTE FUNCTION enforce_single_active_online_game();
drop trigger if exists "record_rating_peak" on public."user_ratings";
CREATE TRIGGER record_rating_peak AFTER INSERT OR UPDATE ON public.user_ratings FOR EACH ROW EXECUTE FUNCTION record_rating_peak();

create or replace view public."matchmaking_integrity_issues" as
SELECT 'active_ticket_without_live_lease'::text AS issue_type,
    q.id::text AS entity_id,
    q.user_id,
    q.matched_game_id AS game_id
   FROM online_match_queue q
  WHERE (q.status = ANY (ARRAY['waiting'::text, 'claimed'::text])) AND COALESCE(q.lease_expires_at, q.last_seen + '00:00:15'::interval) < now()
UNION ALL
 SELECT 'matched_ticket_without_game'::text AS issue_type,
    q.id::text AS entity_id,
    q.user_id,
    q.matched_game_id AS game_id
   FROM online_match_queue q
  WHERE q.status = 'matched'::text AND (q.matched_game_id IS NULL OR NOT (EXISTS ( SELECT 1
           FROM online_games g
          WHERE g.id = q.matched_game_id)))
UNION ALL
 SELECT 'active_lock_without_active_game'::text AS issue_type,
    l.user_id::text AS entity_id,
    l.user_id,
    l.game_id
   FROM user_active_locks l
  WHERE NOT (EXISTS ( SELECT 1
           FROM online_games g
          WHERE g.id = l.game_id AND g.status = 'active'::text))
UNION ALL
 SELECT 'active_game_without_two_tickets'::text AS issue_type,
    g.id::text AS entity_id,
    NULL::uuid AS user_id,
    g.id AS game_id
   FROM online_games g
  WHERE g.status = 'active'::text AND g.match_type = 'quick'::text AND NOT (EXISTS ( SELECT 1
           FROM online_games previous
          WHERE previous.rematch_game_id = g.id)) AND (( SELECT count(*) AS count
           FROM online_game_tickets t
          WHERE t.game_id = g.id)) <> 2;
revoke all on public."matchmaking_integrity_issues" from public,anon,authenticated;
grant select on public."matchmaking_integrity_issues" to service_role;

create or replace view public."matchmaking_metrics_5m" as
SELECT date_trunc('minute'::text, created_at) - make_interval(mins => EXTRACT(minute FROM created_at)::integer % 5) AS bucket,
    mode,
    time_control,
    pool,
    count(*) FILTER (WHERE event_type = 'waiting'::text) AS waiting_events,
    count(*) FILTER (WHERE event_type = 'matched'::text) AS matched_players,
    count(*) FILTER (WHERE event_type = 'queue_cancelled'::text) AS cancelled_events,
    percentile_cont(0.50::double precision) WITHIN GROUP (ORDER BY (wait_ms::double precision)) FILTER (WHERE event_type = 'matched'::text) AS p50_wait_ms,
    percentile_cont(0.95::double precision) WITHIN GROUP (ORDER BY (wait_ms::double precision)) FILTER (WHERE event_type = 'matched'::text) AS p95_wait_ms,
    percentile_cont(0.99::double precision) WITHIN GROUP (ORDER BY (wait_ms::double precision)) FILTER (WHERE event_type = 'matched'::text) AS p99_wait_ms,
    avg(rating_gap) FILTER (WHERE event_type = 'matched'::text) AS average_rating_gap
   FROM matchmaking_events
  WHERE created_at >= (now() - '7 days'::interval)
  GROUP BY (date_trunc('minute'::text, created_at) - make_interval(mins => EXTRACT(minute FROM created_at)::integer % 5)), mode, time_control, pool;
revoke all on public."matchmaking_metrics_5m" from public,anon,authenticated;
grant select on public."matchmaking_metrics_5m" to service_role;

alter table public."activity_feed" enable row level security;
alter table public."admin_audit_logs" enable row level security;
alter table public."api_rate_limits" enable row level security;
alter table public."auth_otps" enable row level security;
alter table public."daily_puzzle_claims" enable row level security;
alter table public."game_invitations" enable row level security;
alter table public."game_moves" enable row level security;
alter table public."game_review_moves" enable row level security;
alter table public."game_reviews" enable row level security;
alter table public."games" enable row level security;
alter table public."matchmaking_events" enable row level security;
alter table public."matchmaking_outbox" enable row level security;
alter table public."matchmaking_user_generations" enable row level security;
alter table public."media_assets" enable row level security;
alter table public."membership_checkouts" enable row level security;
alter table public."membership_subscriptions" enable row level security;
alter table public."online_game_chat" enable row level security;
alter table public."online_game_moves" enable row level security;
alter table public."online_game_spectators" enable row level security;
alter table public."online_game_tickets" enable row level security;
alter table public."online_games" enable row level security;
alter table public."online_match_queue" enable row level security;
alter table public."online_presence" enable row level security;
alter table public."online_rating_events" enable row level security;
alter table public."online_ratings" enable row level security;
alter table public."opening_repertoire" enable row level security;
alter table public."payment_transactions" enable row level security;
alter table public."paypal_webhook_events" enable row level security;
alter table public."player_reports" enable row level security;
alter table public."puzzle_battles" enable row level security;
alter table public."puzzle_progress" enable row level security;
alter table public."puzzle_sessions" enable row level security;
alter table public."review_quota_uses" enable row level security;
alter table public."support_messages" enable row level security;
alter table public."support_requests" enable row level security;
alter table public."support_status_events" enable row level security;
alter table public."user_achievements" enable row level security;
alter table public."user_active_locks" enable row level security;
alter table public."user_bans" enable row level security;
alter table public."user_follows" enable row level security;
alter table public."user_friendships" enable row level security;
alter table public."user_matchmaking_stats" enable row level security;
alter table public."user_memberships" enable row level security;
alter table public."user_mutes" enable row level security;
alter table public."user_notifications" enable row level security;
alter table public."user_preferences" enable row level security;
alter table public."user_rating_peaks" enable row level security;
alter table public."user_ratings" enable row level security;
alter table public."users" enable row level security;

drop policy if exists "service role manages admin audit logs" on public."admin_audit_logs";
create policy "service role manages admin audit logs" on public."admin_audit_logs" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages auth otps" on public."auth_otps";
create policy "service role manages auth otps" on public."auth_otps" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages daily puzzle claims" on public."daily_puzzle_claims";
create policy "service role manages daily puzzle claims" on public."daily_puzzle_claims" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages game invitations" on public."game_invitations";
create policy "service role manages game invitations" on public."game_invitations" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages game moves" on public."game_moves";
create policy "service role manages game moves" on public."game_moves" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages game review moves" on public."game_review_moves";
create policy "service role manages game review moves" on public."game_review_moves" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages game reviews" on public."game_reviews";
create policy "service role manages game reviews" on public."game_reviews" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages games" on public."games";
create policy "service role manages games" on public."games" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages matchmaking events" on public."matchmaking_events";
create policy "service role manages matchmaking events" on public."matchmaking_events" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages matchmaking outbox" on public."matchmaking_outbox";
create policy "service role manages matchmaking outbox" on public."matchmaking_outbox" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages matchmaking generations" on public."matchmaking_user_generations";
create policy "service role manages matchmaking generations" on public."matchmaking_user_generations" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages checkouts" on public."membership_checkouts";
create policy "service role manages checkouts" on public."membership_checkouts" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages subscriptions" on public."membership_subscriptions";
create policy "service role manages subscriptions" on public."membership_subscriptions" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages online game moves" on public."online_game_moves";
create policy "service role manages online game moves" on public."online_game_moves" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages online game tickets" on public."online_game_tickets";
create policy "service role manages online game tickets" on public."online_game_tickets" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages online games" on public."online_games";
create policy "service role manages online games" on public."online_games" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages online match queue" on public."online_match_queue";
create policy "service role manages online match queue" on public."online_match_queue" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages online presence" on public."online_presence";
create policy "service role manages online presence" on public."online_presence" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages online rating events" on public."online_rating_events";
create policy "service role manages online rating events" on public."online_rating_events" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages online ratings" on public."online_ratings";
create policy "service role manages online ratings" on public."online_ratings" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages payment events" on public."paypal_webhook_events";
create policy "service role manages payment events" on public."paypal_webhook_events" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages player reports" on public."player_reports";
create policy "service role manages player reports" on public."player_reports" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages puzzle sessions" on public."puzzle_sessions";
create policy "service role manages puzzle sessions" on public."puzzle_sessions" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages review quota uses" on public."review_quota_uses";
create policy "service role manages review quota uses" on public."review_quota_uses" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages support messages" on public."support_messages";
create policy "service role manages support messages" on public."support_messages" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages support requests" on public."support_requests";
create policy "service role manages support requests" on public."support_requests" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages support status events" on public."support_status_events";
create policy "service role manages support status events" on public."support_status_events" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user achievements" on public."user_achievements";
create policy "service role manages user achievements" on public."user_achievements" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user active locks" on public."user_active_locks";
create policy "service role manages user active locks" on public."user_active_locks" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user bans" on public."user_bans";
create policy "service role manages user bans" on public."user_bans" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user friendships" on public."user_friendships";
create policy "service role manages user friendships" on public."user_friendships" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user matchmaking stats" on public."user_matchmaking_stats";
create policy "service role manages user matchmaking stats" on public."user_matchmaking_stats" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user memberships" on public."user_memberships";
create policy "service role manages user memberships" on public."user_memberships" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user mutes" on public."user_mutes";
create policy "service role manages user mutes" on public."user_mutes" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user notifications" on public."user_notifications";
create policy "service role manages user notifications" on public."user_notifications" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user preferences" on public."user_preferences";
create policy "service role manages user preferences" on public."user_preferences" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages rating peaks" on public."user_rating_peaks";
create policy "service role manages rating peaks" on public."user_rating_peaks" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages user ratings" on public."user_ratings";
create policy "service role manages user ratings" on public."user_ratings" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
drop policy if exists "service role manages users" on public."users";
create policy "service role manages users" on public."users" as PERMISSIVE for ALL to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));

-- Service API owns writes; existing Supabase client policies remain in force.
grant usage on schema public to service_role;
grant all on public.activity_feed,
  public.admin_audit_logs,
  public.api_rate_limits,
  public.auth_otps,
  public.bot_personas,
  public.daily_puzzle_claims,
  public.game_invitations,
  public.game_moves,
  public.game_review_moves,
  public.game_reviews,
  public.review_quota_uses,
  public.games,
  public.matchmaking_events,
  public.matchmaking_outbox,
  public.matchmaking_user_generations,
  public.media_assets,
  public.membership_checkouts,
  public.membership_subscriptions,
  public.online_game_chat,
  public.online_game_moves,
  public.online_game_spectators,
  public.online_game_tickets,
  public.online_games,
  public.online_match_queue,
  public.online_presence,
  public.online_rating_events,
  public.online_ratings,
  public.opening_repertoire,
  public.payment_transactions,
  public.paypal_webhook_events,
  public.personal_puzzles,
  public.player_reports,
  public.puzzle_battles,
  public.puzzle_progress,
  public.puzzle_sessions,
  public.site_events,
  public.support_messages,
  public.support_requests,
  public.support_status_events,
  public.user_achievements,
  public.user_active_locks,
  public.user_bans,
  public.user_follows,
  public.user_friendships,
  public.user_matchmaking_stats,
  public.user_memberships,
  public.user_mutes,
  public.user_notifications,
  public.user_preferences,
  public.user_rating_peaks,
  public.user_ratings,
  public.users to service_role;
grant usage, select on public.activity_feed_id_seq,
  public.admin_audit_logs_id_seq,
  public.game_moves_id_seq,
  public.matchmaking_events_id_seq,
  public.matchmaking_outbox_id_seq,
  public.online_game_chat_id_seq,
  public.online_game_moves_id_seq,
  public.support_status_events_id_seq to service_role;
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

-- Puzzle Battle commits are serialized per battle; joins share one short lock.
create or replace function public.puzzle_battle_action(
  p_user uuid, p_action text, p_battle uuid default null, p_ids jsonb default '[]',
  p_index integer default null, p_correct boolean default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.puzzle_battles%rowtype; v_one boolean; v_count integer;
begin
  if p_action not in ('join','read','cancel','answer') or p_user is null then
    raise exception 'Invalid puzzle action.' using errcode='22023';
  end if;
  if p_action='join' then
    perform pg_advisory_xact_lock(hashtextextended('puzzle-battle-join',0));
    select * into b from public.puzzle_battles where status in('waiting','active') and expires_at>now()
      and (player_one_id=p_user or player_two_id=p_user) order by created_at desc limit 1 for update;
    if found then return jsonb_build_object('battle',to_jsonb(b),'applied',false); end if;
    select * into b from public.puzzle_battles where status='waiting' and player_two_id is null
      and player_one_id<>p_user and expires_at>now() order by created_at,id limit 1 for update;
    if found then
      update public.puzzle_battles set player_two_id=p_user,status='active',started_at=now(),
        expires_at=now()+interval '5 minutes',updated_at=now() where id=b.id returning * into b;
    else
      if jsonb_typeof(p_ids)<>'array' or jsonb_array_length(p_ids) not between 1 and 20 then
        raise exception 'Invalid puzzle set.' using errcode='22023';
      end if;
      insert into public.puzzle_battles(player_one_id,puzzle_ids) values(p_user,p_ids) returning * into b;
    end if;
    return jsonb_build_object('battle',to_jsonb(b),'applied',true);
  end if;
  select * into b from public.puzzle_battles where
    ((p_battle is not null and id=p_battle) or (p_battle is null and status in('waiting','active')))
    and (player_one_id=p_user or player_two_id=p_user) order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('battle',null,'applied',false); end if;
  if b.status in('waiting','active') and b.expires_at<=now() then
    update public.puzzle_battles set status=case when b.status='waiting' then 'cancelled' else 'finished' end,
      winner_user_id=case when b.status='waiting' or b.player_one_score=b.player_two_score then null
        when b.player_one_score>b.player_two_score then b.player_one_id else b.player_two_id end,
      finished_at=now(),updated_at=now() where id=b.id returning * into b;
  end if;
  if p_action='cancel' and b.status='waiting' and b.player_one_id=p_user then
    update public.puzzle_battles set status='cancelled',updated_at=now() where id=b.id returning * into b;
    return jsonb_build_object('battle',to_jsonb(b),'applied',true);
  end if;
  if p_action<>'answer' or b.status<>'active' then
    return jsonb_build_object('battle',to_jsonb(b),'applied',false);
  end if;
  v_one:=b.player_one_id=p_user;
  v_count:=jsonb_array_length(b.puzzle_ids);
  if p_index is null or p_correct is null or p_index>=v_count
      or p_index<>(case when v_one then b.player_one_index else b.player_two_index end) then
    return jsonb_build_object('battle',to_jsonb(b),'applied',false);
  end if;
  if v_one then
    b.player_one_index:=b.player_one_index+1;
    b.player_one_score:=b.player_one_score+case when p_correct then 1 else 0 end;
  else
    b.player_two_index:=b.player_two_index+1;
    b.player_two_score:=b.player_two_score+case when p_correct then 1 else 0 end;
  end if;
  if b.player_one_index>=v_count and b.player_two_index>=v_count then
    b.status:='finished'; b.finished_at:=now();
    b.winner_user_id:=case when b.player_one_score=b.player_two_score then null
      when b.player_one_score>b.player_two_score then b.player_one_id else b.player_two_id end;
  end if;
  update public.puzzle_battles set status=b.status,player_one_index=b.player_one_index,player_two_index=b.player_two_index,
    player_one_score=b.player_one_score,player_two_score=b.player_two_score,winner_user_id=b.winner_user_id,
    finished_at=b.finished_at,updated_at=now() where id=b.id returning * into b;
  return jsonb_build_object('battle',to_jsonb(b),'applied',true);
end $$;
revoke all on function public.puzzle_battle_action(uuid,text,uuid,jsonb,integer,boolean) from public,anon,authenticated;
grant execute on function public.puzzle_battle_action(uuid,text,uuid,jsonb,integer,boolean) to service_role;



-- Account appeals use support tickets and never grant a login session.
create index if not exists support_account_appeals on public.support_requests(user_id,(context->>'banId')) where context->>'kind'='ban_appeal';
create or replace function public.submit_account_ban_appeal(p_user uuid,p_ban uuid,p_message text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.user_bans%rowtype; r public.support_requests%rowtype;
begin
  if p_message is null or length(trim(p_message)) not between 20 and 2000 then raise exception 'Invalid appeal.' using errcode='22023'; end if;
  select * into b from public.user_bans where id=p_ban and user_id=p_user and ban_type='account' for update;
  if not found then raise exception 'Ban not found.' using errcode='42501'; end if;
  if b.status<>'active' or b.expires_at<=now() then raise exception 'Ban has ended.' using errcode='55000'; end if;
  select * into r from public.support_requests where user_id=p_user and context->>'kind'='ban_appeal' and context->>'banId'=p_ban::text order by created_at desc limit 1;
  if found then return to_jsonb(r); end if;
  insert into public.support_requests(user_id,category,subject,message,contact_email,page_url,context)
  values(p_user,'moderation','Yêu cầu xem xét khóa tài khoản',trim(p_message),(select email from users where id=p_user),'/login',
    jsonb_build_object('kind','ban_appeal','banId',p_ban,'banReason',b.reason,'banExpiresAt',b.expires_at)) returning * into r;
  insert into public.support_status_events(request_id,actor_user_id,actor_role,new_status,note) values(r.id,p_user,'user','new','Gửi yêu cầu xem xét khóa tài khoản.');
  return to_jsonb(r);
end $$;
create or replace function public.review_account_ban_appeal(p_request uuid,p_admin uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.support_requests%rowtype; b public.user_bans%rowtype; v_old text;
begin
  if p_decision is null or p_decision not in('approved','rejected') or coalesce(length(trim(p_note)),0) not between 5 and 1800 then raise exception 'Invalid review.' using errcode='22023'; end if;
  -- Lock the ban before its ticket, the same order as submission.
  select * into r from public.support_requests where id=p_request and context->>'kind'='ban_appeal';
  if not found then raise exception 'Appeal not found.' using errcode='42501'; end if;
  select * into b from public.user_bans where id=(r.context->>'banId')::uuid and user_id=r.user_id for update;
  if not found then raise exception 'Ban not found.' using errcode='42501'; end if;
  select * into r from public.support_requests where id=p_request for update;
  if r.context->>'decision' in('approved','rejected') then return to_jsonb(r); end if;
  v_old:=r.status;
  if p_decision='approved' then
    update public.user_bans set status='lifted',lifted_by=p_admin,lifted_at=now() where id=b.id and status='active';
  end if;
  update public.support_requests set status=case when p_decision='approved' then 'resolved' else 'dismissed' end,
    admin_note=trim(p_note),reviewed_by=p_admin,reviewed_at=now(),updated_at=now(),context=context||jsonb_build_object('decision',p_decision)
    where id=r.id returning * into r;
  insert into public.support_status_events(request_id,actor_user_id,actor_role,old_status,new_status,note) values(r.id,p_admin,'admin',v_old,r.status,trim(p_note));
  insert into public.admin_audit_logs(admin_user_id,action,target_user_id,metadata)
    values(p_admin,'account.appeal.'||p_decision,r.user_id,jsonb_build_object('supportRequestId',r.id,'banId',b.id));
  return to_jsonb(r);
end $$;
revoke all on function public.submit_account_ban_appeal(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.review_account_ban_appeal(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_account_ban_appeal(uuid,uuid,text) to service_role;
grant execute on function public.review_account_ban_appeal(uuid,uuid,text,text) to service_role;


create or replace function public.bump_online_game_state_version() returns trigger language plpgsql set search_path=public as $$
begin
  new.state_version:=greatest(coalesce(old.state_version,1)+1,coalesce(new.state_version,1));
  return new;
end $$;
drop trigger if exists bump_online_game_state_version on public.online_games;
create trigger bump_online_game_state_version before update on public.online_games for each row execute function public.bump_online_game_state_version();

create or replace function public.release_finished_online_game_players() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status='active' and new.status<>'active' then
    delete from public.user_active_locks where game_id=new.id;
    update public.online_presence set status='online',current_game_id=null,current_queue_ticket_id=null,
      last_seen=clock_timestamp(),updated_at=clock_timestamp()
      where current_game_id=new.id or user_id in(new.white_user_id,new.black_user_id);
  end if;
  return new;
end $$;
drop trigger if exists release_finished_online_game_players on public.online_games;
create trigger release_finished_online_game_players after update of status on public.online_games for each row execute function public.release_finished_online_game_players();

create or replace function public.notify_player_report_resolution() returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text; v_action_taken boolean:=false;
begin
  if old.status is distinct from new.status and new.status in('resolved','dismissed')
    and not exists(select 1 from public.user_notifications where type='player_report_result' and metadata->>'reportId'=new.id::text) then
    select coalesce(display_name,username,'người chơi được báo cáo') into v_name from public.users where id=new.reported_user_id;
    if new.status='resolved' then
      select exists(select 1 from public.user_bans where user_id=new.reported_user_id and status='active'
        and (expires_at is null or expires_at>now())) into v_action_taken;
    end if;
    insert into public.user_notifications(recipient_user_id,audience,type,title,body,action_url,priority,metadata)
    values(new.reporter_user_id,'user','player_report_result','Báo cáo của bạn đã được xử lý',
      case when new.status='dismissed' then 'Báo cáo về '||coalesce(v_name,'người chơi được báo cáo')||' đã được xem xét nhưng hiện chưa có đủ bằng chứng để xử phạt.'
        when v_action_taken then 'Báo cáo về '||coalesce(v_name,'người chơi được báo cáo')||' đã được xác nhận và người chơi đã bị xử phạt.'
        else 'Báo cáo về '||coalesce(v_name,'người chơi được báo cáo')||' đã được xử lý. Cảm ơn bạn đã giúp bảo vệ cộng đồng.' end,
      '/notifications','normal',jsonb_build_object('reportId',new.id,'reportedUserId',new.reported_user_id,'status',new.status,'actionTaken',v_action_taken));
  end if;
  return new;
end $$;
drop trigger if exists notify_player_report_resolution on public.player_reports;
create trigger notify_player_report_resolution after update of status on public.player_reports for each row execute function public.notify_player_report_resolution();

create or replace function public.update_support_request_status(p_request uuid,p_admin uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.support_requests%rowtype; v_old text; v_now timestamptz:=clock_timestamp();
begin
  if p_status not in('new','in_review','waiting_user','resolved','dismissed') then
    raise exception 'Invalid support status.' using errcode='22023';
  end if;
  select * into r from public.support_requests where id=p_request for update;
  if not found then raise exception 'Support request not found.' using errcode='P0002'; end if;
  v_old:=r.status;
  update public.support_requests set status=p_status,admin_note=nullif(left(trim(coalesce(p_note,'')),1800),''),
    reviewed_by=p_admin,reviewed_at=v_now,updated_at=v_now where id=p_request returning * into r;
  if v_old is distinct from p_status then
    insert into public.support_status_events(request_id,actor_user_id,actor_role,old_status,new_status,note)
      values(p_request,p_admin,'admin',v_old,p_status,nullif(left(trim(coalesce(p_note,'')),1800),''));
    insert into public.user_notifications(recipient_user_id,audience,type,title,body,action_url,priority,metadata)
      values(r.user_id,'user','support_status','Ticket hỗ trợ đã được cập nhật',
        coalesce(nullif(r.subject,''),'Ticket #'||left(r.id::text,8))||': '||p_status,
        '/support/tickets','normal',jsonb_build_object('requestId',r.id,'status',p_status));
  end if;
  return to_jsonb(r);
end $$;
revoke all on function public.update_support_request_status(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_support_request_status(uuid,uuid,text,text) to service_role;

-- Reserve one daily review atomically before any engine work. Reusing the same
-- game/session key is idempotent and never consumes a second allowance.
create or replace function public.reserve_game_review(p_user uuid,p_game uuid,p_review_key text,p_daily_limit integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.online_games%rowtype; v_key text; v_used integer; v_existing public.review_quota_uses%rowtype; v_already boolean;
begin
  if p_user is null or (p_daily_limit is not null and p_daily_limit not between 1 and 1000) then
    raise exception 'Invalid review entitlement.' using errcode='22023';
  end if;
  if p_game is not null then
    select * into g from public.online_games where id=p_game;
    if not found or p_user not in(g.white_user_id,g.black_user_id) then raise exception 'Not a game participant.' using errcode='42501'; end if;
    if g.status in('active','waiting') then raise exception 'The game is not finished.' using errcode='55000'; end if;
    v_key:='game:'||p_game::text;
  else
    v_key:=left(trim(coalesce(p_review_key,'')),160);
    if length(v_key)<8 then raise exception 'Review session is required.' using errcode='22023'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('review-quota:'||p_user::text||':'||(now() at time zone 'utc')::date::text,0));
  select * into v_existing from public.review_quota_uses where user_id=p_user and review_key=v_key;
  v_already:=found;
  select count(*) into v_used from public.review_quota_uses where user_id=p_user and usage_date=(now() at time zone 'utc')::date;
  if v_already then
    return jsonb_build_object('allowed',true,'alreadyReserved',true,'used',v_used,'remaining',case when p_daily_limit is null then null else greatest(0,p_daily_limit-v_used) end);
  end if;
  if p_daily_limit is not null and v_used>=p_daily_limit then
    return jsonb_build_object('allowed',false,'alreadyReserved',false,'used',v_used,'remaining',0);
  end if;
  insert into public.review_quota_uses(user_id,review_key,game_id) values(p_user,v_key,p_game);
  v_used:=v_used+1;
  return jsonb_build_object('allowed',true,'alreadyReserved',false,'used',v_used,'remaining',case when p_daily_limit is null then null else greatest(0,p_daily_limit-v_used) end);
end $$;
revoke all on function public.reserve_game_review(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_game_review(uuid,uuid,text,integer) to service_role;
-- Release only a reservation created for a review that never produced stored
-- analysis. The same advisory lock as reserve_game_review keeps quota atomic.
create or replace function public.release_game_review_reservation(p_user uuid,p_game uuid,p_review_key text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_key text; v_deleted integer;
begin
  if p_user is null then raise exception 'Invalid review reservation.' using errcode='22023'; end if;
  v_key:=case when p_game is not null then 'game:'||p_game::text else left(trim(coalesce(p_review_key,'')),160) end;
  if length(v_key)<8 then raise exception 'Review session is required.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('review-quota:'||p_user::text||':'||(now() at time zone 'utc')::date::text,0));
  delete from public.review_quota_uses q
  where q.user_id=p_user and q.review_key=v_key
    and (p_game is null or not exists(
      select 1 from public.game_reviews r where r.user_id=p_user and r.game_id=p_game
    ));
  get diagnostics v_deleted=row_count;
  return v_deleted=1;
end $$;
revoke all on function public.release_game_review_reservation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.release_game_review_reservation(uuid,uuid,text) to service_role;


-- Merge review batches atomically. Never erase earlier analyzed moves.
create or replace function public.save_game_review_batch(p_user uuid,p_game uuid,p_results jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.online_games%rowtype; r public.game_reviews%rowtype; item jsonb; m public.online_game_moves%rowtype;
  v_color text; v_fen text; v_expected integer; v_count integer; v_accuracy numeric; v_cp integer;
begin
  if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results) not between 1 and 24 then raise exception 'Invalid batch.' using errcode='22023'; end if;
  select * into g from public.online_games where id=p_game;
  if not found or p_user not in(g.white_user_id,g.black_user_id) then raise exception 'Not a game participant.' using errcode='42501'; end if;
  if g.status in('active','waiting') then return null; end if;
  v_color:=case when g.white_user_id=p_user then 'w' else 'b' end;
  perform pg_advisory_xact_lock(hashtextextended('review:'||p_user::text||':'||p_game::text,0));
  insert into public.game_reviews(game_id,user_id,color) values(p_game,p_user,v_color) on conflict(game_id,user_id) do nothing;
  select * into r from public.game_reviews where game_id=p_game and user_id=p_user for update;
  for item in select value from jsonb_array_elements(p_results) loop
    select * into m from public.online_game_moves where game_id=p_game and ply=(item->>'ply')::integer;
    if not found or m.lan<>item->>'move' then raise exception 'Move does not belong to this game.' using errcode='22023'; end if;
    v_fen:=case when m.ply=1 then 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      else (select fen_after from public.online_game_moves where game_id=p_game and ply=m.ply-1) end;
    if v_fen is null or v_fen<>item->>'fen' then raise exception 'Position does not match the game.' using errcode='22023'; end if;
    if m.color<>v_color then continue; end if;
    insert into public.game_review_moves(review_id,game_id,user_id,ply,san,move,fen,best_move,tone,label,centipawn_loss,win_loss,white_score)
    values(r.id,p_game,p_user,m.ply,m.san,m.lan,v_fen,item->>'bestMove',item->>'tone',item->>'label',
      (item->>'centipawnLoss')::integer,(item->>'winLoss')::numeric,(item->>'whiteScore')::integer)
    on conflict(review_id,ply) do update set best_move=excluded.best_move,tone=excluded.tone,label=excluded.label,
      centipawn_loss=excluded.centipawn_loss,win_loss=excluded.win_loss,white_score=excluded.white_score;
    if item->>'tone' in('blunder','mistake','miss') and coalesce(item->>'bestMove','')<>'' then
      insert into public.personal_puzzles(user_id,source_game_id,source_review_id,source_ply,fen,solution,played_move,san,theme,stage,rating)
      values(p_user,p_game,r.id,m.ply,v_fen,item->>'bestMove',m.lan,m.san,item->>'tone',
        case when m.ply<=16 then 'opening' when m.ply>=70 then 'endgame' else 'middlegame' end,
        greatest(700,least(2400,1000+(item->>'centipawnLoss')::integer*2)))
      on conflict(user_id,source_game_id,source_ply) do update set solution=excluded.solution,theme=excluded.theme,updated_at=now();
    end if;
  end loop;
  select count(*),round(avg(100*exp(-.045*greatest(0,win_loss))),1),round(avg(centipawn_loss))
    into v_count,v_accuracy,v_cp from public.game_review_moves where review_id=r.id;
  select count(*) into v_expected from public.online_game_moves where game_id=p_game and color=v_color;
  update public.game_reviews set accuracy=coalesce(v_accuracy,0),average_centipawn_loss=coalesce(v_cp,0),total_moves=v_count,
    blunders=(select count(*) from game_review_moves where review_id=r.id and tone='blunder'),
    mistakes=(select count(*) from game_review_moves where review_id=r.id and tone in('mistake','miss')),
    inaccuracies=(select count(*) from game_review_moves where review_id=r.id and tone='inaccuracy'),
    best_moves=(select count(*) from game_review_moves where review_id=r.id and tone in('book','best','great','brilliant')),
    summary=jsonb_build_object('policy','stockfish_review_v2','complete',v_count=v_expected,'expectedMoves',v_expected),updated_at=now()
    where id=r.id returning * into r;
  return jsonb_build_object('reviewId',r.id,'savedMoves',v_count,'complete',v_count=v_expected,'summary',to_jsonb(r));
end $$;
revoke all on function public.save_game_review_batch(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_game_review_batch(uuid,uuid,jsonb) to service_role;

create table if not exists public.website_settings (
  setting_key text primary key,
  value jsonb not null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.website_settings enable row level security;
revoke all on public.website_settings from public, anon, authenticated;
grant select, insert, update, delete on public.website_settings to service_role;
drop policy if exists "service role manages website settings" on public.website_settings;
create policy "service role manages website settings" on public.website_settings for all using(auth.role()='service_role') with check(auth.role()='service_role');

-- Publish committed game changes to backend subscribers across processes.
do $realtime$
declare v_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables) then
    foreach v_table in array array['online_games','online_game_moves','online_game_chat'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
        execute format('alter publication supabase_realtime add table public.%I',v_table);
      end if;
    end loop;
  end if;
end $realtime$;

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

notify pgrst, 'reload schema';
commit;
