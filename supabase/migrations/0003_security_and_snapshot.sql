-- 0003_security_and_snapshot.sql
-- Row level security on every table, no policies, no grants for anon or
-- authenticated. Server code connects as the database owner.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t.tablename);
    execute format('revoke all on app.%I from public, anon, authenticated', t.tablename);
  end loop;
end $$;

revoke all on all sequences in schema app from public, anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;
alter default privileges in schema app revoke all on tables from public, anon, authenticated;
alter default privileges in schema app revoke all on sequences from public, anon, authenticated;
alter default privileges in schema app revoke execute on functions from public, anon, authenticated;

-- Public helpers ------------------------------------------------------

create or replace function app.age_group(p_dob date) returns text
language sql stable as $$
  select case
    when p_dob is null then null
    when age(current_date, p_dob) < interval '16 years' then 'under_16'
    when age(current_date, p_dob) < interval '18 years' then '16_17'
    when age(current_date, p_dob) < interval '24 years' then '18_23'
    when age(current_date, p_dob) < interval '30 years' then '24_29'
    when age(current_date, p_dob) < interval '36 years' then '30_35'
    else '36_plus' end;
$$;

-- A profile may be shown publicly unless the player is under 18 without
-- recorded guardian consent.
create or replace function app.player_is_public(p_dob date, p_guardian_consent boolean) returns boolean
language sql stable as $$
  select p_dob is null or p_dob <= (current_date - interval '18 years')::date or coalesce(p_guardian_consent, false);
$$;

create or replace function app.public_player_json(p app.players) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'fullName', p.full_name, 'photoPath', p.photo_path, 'roleKey', p.role_key,
    'subRole', p.sub_role, 'category', p.category, 'tags', to_jsonb(p.tags),
    'nationalityGroup', p.nationality_group, 'stats', p.stats, 'bioShort', p.bio_short,
    'ageGroup', app.age_group(p.date_of_birth));
$$;

create or replace function app.team_public_json(t app.teams) returns jsonb
language plpgsql stable as $$
declare c record; a app.auctions%rowtype;
begin
  select * into c from app.team_counts(t.id);
  select * into a from app.auctions where id = t.auction_id;
  return jsonb_build_object(
    'id', t.id, 'name', t.name, 'shortName', t.short_name, 'logoPath', t.logo_path,
    'primaryColor', t.primary_color, 'secondaryColor', t.secondary_color,
    'ownerDisplayName', t.owner_display_name,
    'purseTotal', t.purse_total, 'purseSpent', t.purse_spent, 'purseLeft', t.purse_total - t.purse_spent,
    'maxBid', app.max_bid_for(t.id),
    'squadCount', c.squad_count, 'overseasCount', c.overseas_count, 'roleCounts', c.role_counts,
    'slotsLeft', greatest(a.squad_max - c.squad_count, 0),
    'rtmCardsLeft', t.rtm_cards_left);
end $$;

create or replace function app.auction_public_json(a app.auctions) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'name', a.name, 'status', a.status, 'startsAt', a.starts_at,
    'sportId', s.id, 'sportKey', s.key, 'sportName', s.name, 'sportConfig', s.config,
    'pointsUnitLabel', a.points_unit_label,
    'squadMin', a.squad_min, 'squadMax', a.squad_max, 'maxOverseas', a.max_overseas,
    'roleMinimums', a.role_minimums, 'roleMaximums', a.role_maximums,
    'reserveRuleEnabled', a.reserve_rule_enabled,
    'bidTimerSeconds', a.bid_timer_seconds, 'timerExtensionSeconds', a.timer_extension_seconds,
    'rtmEnabled', a.rtm_enabled, 'rtmLabel', a.rtm_label, 'rtmAllowFinalRaise', a.rtm_allow_final_raise,
    'currentRound', a.current_round, 'rehearsal', a.rehearsal, 'registrationOpen', a.registration_open,
    'settingsVersion', a.settings_version, 'rulesChangedAt', a.rules_changed_at, 'completedAt', a.completed_at,
    'updatedAt', a.updated_at,
    'slabs', coalesce((select jsonb_agg(jsonb_build_object('from', from_points, 'to', to_points, 'increment', increment_points)
      order by from_points) from app.bid_slabs where auction_id = a.id), '[]'::jsonb))
  from app.sports s where s.id = a.sport_id;
$$;

-- Full public snapshot of one auction. Public-safe columns only.
create or replace function app.public_snapshot(p_auction_id uuid) returns jsonb
language plpgsql stable as $$
declare a app.auctions%rowtype; f app.floor_state%rowtype; v jsonb;
begin
  select * into a from app.auctions where id = p_auction_id and deleted_at is null;
  if not found then return null; end if;
  select * into f from app.floor_state where auction_id = p_auction_id;

  v := jsonb_build_object(
    'auction', app.auction_public_json(a),
    'floor', app.floor_json(p_auction_id),
    'currentPlayer', (
      select app.public_player_json(p) || jsonb_build_object(
        'auctionPlayerId', ap.id, 'basePrice', ap.base_price, 'setName', ap.set_name, 'status', ap.status,
        'previousTeamId', ap.previous_team_id, 'round', ap.round)
      from app.auction_players ap join app.players p on p.id = ap.player_id
      where ap.id = f.current_auction_player_id),
    'bids', coalesce((
      select jsonb_agg(x order by x->>'createdAt' desc) from (
        select jsonb_build_object('id', b.id, 'teamId', b.team_id, 'amount', b.amount, 'createdAt', b.created_at,
          'auctionPlayerId', b.auction_player_id, 'playerName', p.full_name, 'source', b.source) x
        from app.bids b join app.auction_players ap on ap.id = b.auction_player_id join app.players p on p.id = ap.player_id
        where b.auction_id = p_auction_id and not b.voided
        order by b.created_at desc, b.id desc limit 20) q), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(app.team_public_json(t) order by t.name)
      from app.teams t where t.auction_id = p_auction_id and t.deleted_at is null), '[]'::jsonb),
    'counts', (
      select jsonb_build_object(
        'pool', count(*) filter (where ap.status = 'pool'),
        'onFloor', count(*) filter (where ap.status = 'on_floor'),
        'sold', count(*) filter (where ap.status = 'sold'),
        'unsold', count(*) filter (where ap.status = 'unsold'),
        'retained', count(*) filter (where ap.status = 'retained'),
        'total', count(*))
      from app.auction_players ap join app.players p on p.id = ap.player_id
      where ap.auction_id = p_auction_id and p.deleted_at is null),
    'queue', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('auctionPlayerId', ap.id, 'playerId', p.id, 'fullName', p.full_name,
          'photoPath', p.photo_path, 'roleKey', p.role_key, 'subRole', p.sub_role, 'category', p.category,
          'nationalityGroup', p.nationality_group, 'setName', ap.set_name, 'basePrice', ap.base_price) x
        from app.auction_players ap join app.players p on p.id = ap.player_id
        where ap.auction_id = p_auction_id and ap.status = 'pool' and p.deleted_at is null
          and app.player_is_public(p.date_of_birth, p.guardian_consent)
        order by ap.set_order, ap.queue_position, p.full_name limit 12) q), '[]'::jsonb),
    'recentSales', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('auctionPlayerId', ap.id, 'playerId', p.id, 'fullName', p.full_name,
          'photoPath', p.photo_path, 'roleKey', p.role_key, 'teamId', ap.sold_to_team_id, 'price', ap.sold_price,
          'soldAt', ap.sold_at, 'status', ap.status) x
        from app.auction_players ap join app.players p on p.id = ap.player_id
        where ap.auction_id = p_auction_id and ap.status = 'sold'
        order by ap.sold_at desc nulls last limit 8) q), '[]'::jsonb),
    'serverTime', clock_timestamp());
  return v;
end $$;

revoke execute on all functions in schema app from public, anon, authenticated;
