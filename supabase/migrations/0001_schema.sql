-- 0001_schema.sql
-- Core schema. Everything lives in the private schema "app", which the
-- Supabase Data API does not expose. Row level security is enabled on every
-- table with no policies, and anon/authenticated roles get no grants, so the
-- only path to data is server code using the database connection string.
-- Money is always integer points. Never floats.

create schema if not exists app;

-- Supabase creates these roles. Local test databases may not have them.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

revoke all on schema app from public, anon, authenticated;

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Sports ----------------------------------------------------------------
create table app.sports (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (length(name) between 1 and 60),
  config jsonb not null,
  sort_order int not null default 0,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.sport_presets (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references app.sports(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  description text not null default '',
  is_example boolean not null default false,
  config jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport_id, name)
);

-- Auctions --------------------------------------------------------------
create table app.auctions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  name text not null check (length(name) between 1 and 120),
  sport_id uuid not null references app.sports(id),
  status text not null default 'draft'
    check (status in ('draft','scheduled','live','paused','completed','archived')),
  starts_at timestamptz,
  points_unit_label text not null default 'points' check (length(points_unit_label) between 1 and 24),
  purse_per_team int not null default 0 check (purse_per_team >= 0),
  squad_min int not null default 0 check (squad_min >= 0),
  squad_max int not null default 25 check (squad_max >= 1),
  max_overseas int not null default 0 check (max_overseas >= 0),
  role_minimums jsonb not null default '{}'::jsonb,
  role_maximums jsonb not null default '{}'::jsonb,
  default_base_price int not null default 0 check (default_base_price >= 0),
  category_base_prices jsonb not null default '{}'::jsonb,
  reserve_rule_enabled boolean not null default true,
  bid_timer_seconds int check (bid_timer_seconds is null or bid_timer_seconds between 3 and 600),
  timer_extension_seconds int check (timer_extension_seconds is null or timer_extension_seconds between 1 and 600),
  rtm_enabled boolean not null default false,
  rtm_label text not null default 'RTM' check (rtm_label in ('RTM','FBM')),
  rtm_allow_final_raise boolean not null default true,
  rtm_cards_per_team int not null default 0 check (rtm_cards_per_team between 0 and 20),
  retentions_enabled boolean not null default false,
  max_retentions int not null default 0 check (max_retentions between 0 and 30),
  current_round int not null default 1 check (current_round >= 1),
  public boolean not null default true,
  registration_open boolean not null default false,
  rehearsal boolean not null default false,
  settings_version bigint not null default 1,
  event_seq bigint not null default 0,
  rules_changed_at timestamptz,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (squad_min <= squad_max)
);
create index auctions_status_idx on app.auctions(status) where deleted_at is null;
create index auctions_sport_idx on app.auctions(sport_id);

create table app.bid_slabs (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references app.auctions(id) on delete cascade,
  from_points int not null check (from_points >= 0),
  to_points int check (to_points is null or to_points > from_points),
  increment_points int not null check (increment_points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bid_slabs_auction_idx on app.bid_slabs(auction_id, from_points);

-- Teams -----------------------------------------------------------------
create table app.teams (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references app.auctions(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  short_name text not null check (length(short_name) between 1 and 6),
  logo_path text,
  primary_color text not null default '#3B342C' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#F3EEE6' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  owner_display_name text not null default '' check (length(owner_display_name) <= 80),
  purse_total int not null check (purse_total >= 0),
  purse_spent int not null default 0 check (purse_spent >= 0),
  rtm_cards_left int not null default 0 check (rtm_cards_left >= 0),
  max_sessions int not null default 2 check (max_sessions between 1 and 10),
  version bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (purse_spent <= purse_total)
);
create index teams_auction_idx on app.teams(auction_id) where deleted_at is null;
create unique index teams_auction_short_name_idx on app.teams(auction_id, lower(short_name)) where deleted_at is null;

create table app.team_access_codes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references app.teams(id) on delete cascade,
  code_hash text not null unique,
  code_hint text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index team_access_codes_one_active on app.team_access_codes(team_id) where active;

create table app.team_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references app.teams(id) on delete cascade,
  access_code_id uuid not null references app.team_access_codes(id) on delete cascade,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index team_sessions_team_idx on app.team_sessions(team_id) where revoked_at is null;

create table app.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table app.login_attempts (
  id bigserial primary key,
  kind text not null check (kind in ('admin','join')),
  ip_hash text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_lookup on app.login_attempts(kind, ip_hash, created_at desc);

create table app.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);

-- Players ---------------------------------------------------------------
create table app.players (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references app.sports(id),
  full_name text not null check (length(full_name) between 1 and 80),
  photo_path text,
  role_key text not null check (length(role_key) between 1 and 40),
  sub_role text check (sub_role is null or length(sub_role) <= 40),
  category text check (category is null or length(category) <= 24),
  tags text[] not null default '{}',
  nationality_group text not null default 'domestic' check (nationality_group in ('domestic','overseas')),
  stats jsonb not null default '{}'::jsonb,
  bio_short text not null default '' check (length(bio_short) <= 160),
  date_of_birth date,
  guardian_consent boolean,
  guardian_consent_at timestamptz,
  source_registration_id uuid,
  version bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index players_sport_idx on app.players(sport_id) where deleted_at is null;
create index players_name_idx on app.players(lower(full_name));

create table app.auction_players (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references app.auctions(id) on delete cascade,
  player_id uuid not null references app.players(id),
  set_name text not null default 'Main' check (length(set_name) between 1 and 40),
  set_order int not null default 1,
  queue_position int not null default 0,
  base_price int not null check (base_price >= 0),
  status text not null default 'pool' check (status in ('pool','on_floor','sold','unsold','retained')),
  sold_to_team_id uuid references app.teams(id),
  sold_price int check (sold_price is null or sold_price >= 0),
  sold_at timestamptz,
  previous_team_id uuid references app.teams(id),
  round int not null default 1,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auction_id, player_id),
  check ((status in ('sold','retained')) = (sold_to_team_id is not null and sold_price is not null))
);
create index auction_players_queue_idx on app.auction_players(auction_id, status, set_order, queue_position);
create index auction_players_team_idx on app.auction_players(sold_to_team_id) where sold_to_team_id is not null;

-- Floor -----------------------------------------------------------------
create table app.floor_state (
  auction_id uuid primary key references app.auctions(id) on delete cascade,
  current_auction_player_id uuid references app.auction_players(id),
  phase text not null default 'idle' check (phase in ('idle','live','paused','rtm_pending','sold','unsold')),
  current_price int not null default 0 check (current_price >= 0),
  leading_team_id uuid references app.teams(id),
  version bigint not null default 1,
  timer_ends_at timestamptz,
  paused_remaining_ms int,
  rtm_team_id uuid references app.teams(id),
  rtm_stage text check (rtm_stage is null or rtm_stage in ('offered','awaiting_raise','raised')),
  last_result_team_id uuid references app.teams(id),
  last_result_price int,
  server_updated_at timestamptz not null default now()
);

create table app.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references app.auctions(id) on delete cascade,
  auction_player_id uuid not null references app.auction_players(id) on delete cascade,
  team_id uuid not null references app.teams(id),
  amount int not null check (amount >= 0),
  placed_by_profile_id text not null,
  source text not null check (source in ('manager','admin_on_behalf')),
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 80),
  voided boolean not null default false,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);
create index bids_player_idx on app.bids(auction_player_id, created_at desc);
create index bids_auction_idx on app.bids(auction_id, created_at desc);

-- Audit (append only) ---------------------------------------------------
create table app.audit_log (
  id bigserial primary key,
  auction_id uuid,
  actor_type text not null check (actor_type in ('admin','team','system','public')),
  actor_id text not null default '',
  action text not null,
  entity text not null,
  entity_id text not null default '',
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_log_auction_idx on app.audit_log(auction_id, id desc);
create index audit_log_action_idx on app.audit_log(action, id desc);

create or replace function app.audit_log_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append only';
end $$;
create trigger audit_log_no_update before update or delete on app.audit_log
  for each row execute function app.audit_log_is_append_only();

-- Registrations, shortlists, inbox, deletion ---------------------------
create table app.player_registrations (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references app.auctions(id) on delete cascade,
  reference_id text not null unique,
  full_name text not null check (length(full_name) between 1 and 80),
  role_key text not null,
  sub_role text,
  nationality_group text not null default 'domestic' check (nationality_group in ('domestic','overseas')),
  photo_path text,
  stats jsonb not null default '{}'::jsonb,
  bio_short text not null default '' check (length(bio_short) <= 160),
  date_of_birth date,
  guardian_consent boolean,
  consent_given boolean not null check (consent_given),
  consent_given_at timestamptz not null default now(),
  ip_hash text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  player_id uuid references app.players(id),
  reviewed_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index player_registrations_queue on app.player_registrations(auction_id, status, created_at);

create table app.shortlists (
  team_id uuid not null references app.teams(id) on delete cascade,
  auction_player_id uuid not null references app.auction_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, auction_player_id)
);

create table app.contact_messages (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  name text not null check (length(name) between 1 and 80),
  email text not null check (length(email) between 3 and 254),
  message text not null check (length(message) between 1 and 4000),
  consent_given boolean not null check (consent_given),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  status text not null default 'new' check (status in ('new','read','archived')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  requester_name text not null check (length(requester_name) between 1 and 80),
  requester_contact text not null default '' check (length(requester_contact) <= 254),
  registration_reference_id text,
  details text not null default '' check (length(details) <= 2000),
  status text not null default 'received' check (status in ('received','verified','completed','rejected')),
  status_note text not null default '',
  completed_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['sports','sport_presets','auctions','bid_slabs','teams','players',
    'auction_players','player_registrations','contact_messages','deletion_requests']
  loop
    execute format('create trigger %I_touch before update on app.%I for each row execute function app.touch_updated_at()', t, t);
  end loop;
end $$;
