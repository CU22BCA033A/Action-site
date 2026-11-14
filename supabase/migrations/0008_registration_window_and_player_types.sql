-- 0008: registration window and admin-defined player types.
--
-- Registration window: the admin can set when player registration opens and
-- closes (date and time). Registration is open only while the switch is on and
-- the current time is inside the window; an empty side means no limit.
--
-- Player types: an optional list per auction (for example Student, Teacher,
-- Faculty) that replaces the fixed domestic/overseas label in forms and on
-- cards. The domestic/overseas field stays for the overseas limit and is only
-- shown when the admin turns it on for the auction.

alter table app.auctions add column if not exists registration_opens_at timestamptz;
alter table app.auctions add column if not exists registration_closes_at timestamptz;
alter table app.auctions add column if not exists player_types text[] not null default '{}';
-- Domestic/overseas is optional: off by default for new auctions. Existing
-- auctions keep it on so their overseas limit keeps working as before.
alter table app.auctions add column if not exists use_nationality boolean;
update app.auctions set use_nationality = true where use_nationality is null;
alter table app.auctions alter column use_nationality set default false;
alter table app.auctions alter column use_nationality set not null;

alter table app.players add column if not exists player_type text;
alter table app.player_registrations add column if not exists player_type text;
do $$ begin
  alter table app.players add constraint players_player_type_len check (player_type is null or char_length(player_type) between 1 and 40);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table app.player_registrations add constraint registrations_player_type_len check (player_type is null or char_length(player_type) between 1 and 40);
exception when duplicate_object then null; end $$;

create or replace function app.registration_is_open(a app.auctions) returns boolean
language sql stable as $$
  select a.registration_open
    and (a.registration_opens_at is null or now() >= a.registration_opens_at)
    and (a.registration_closes_at is null or now() < a.registration_closes_at);
$$;

create or replace function app.public_player_json(p app.players) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'fullName', p.full_name, 'photoPath', p.photo_path, 'roleKey', p.role_key,
    'subRole', p.sub_role, 'category', p.category, 'tags', to_jsonb(p.tags),
    'nationalityGroup', p.nationality_group, 'playerType', p.player_type, 'stats', p.stats, 'bioShort', p.bio_short,
    'ageGroup', app.age_group(p.date_of_birth));
$$;
