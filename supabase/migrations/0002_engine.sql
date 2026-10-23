-- 0002_engine.sql
-- The bid engine. Every bid and floor change goes through these functions.
-- Each one locks the auction's floor_state row first (FOR UPDATE), so all
-- mutations of one auction are serialised. Rules are read fresh from the
-- auction row and bid_slabs inside the transaction on every call.

-- Helpers ---------------------------------------------------------------

create or replace function app._audit(
  p_auction_id uuid, p_actor_type text, p_actor_id text, p_action text,
  p_entity text, p_entity_id text, p_before jsonb, p_after jsonb, p_reason text default null
) returns void language sql as $$
  insert into app.audit_log(auction_id, actor_type, actor_id, action, entity, entity_id, before, after, reason)
  values (p_auction_id, p_actor_type, coalesce(p_actor_id, ''), p_action, p_entity, coalesce(p_entity_id, ''), p_before, p_after, p_reason);
$$;

create or replace function app._bump(p_auction_id uuid) returns bigint language sql as $$
  update app.auctions set event_seq = event_seq + 1 where id = p_auction_id returning event_seq;
$$;

-- Increment for a given price: the band where from_points <= price < to_points
-- (to_points null means no upper limit). Returns null when no band covers it.
create or replace function app.increment_for(p_auction_id uuid, p_price int) returns int
language sql stable as $$
  select increment_points from app.bid_slabs
  where auction_id = p_auction_id and from_points <= p_price and (to_points is null or p_price < to_points)
  order by from_points desc limit 1;
$$;

create or replace function app.next_bid_amount(p_auction_id uuid) returns int
language plpgsql stable as $$
declare f app.floor_state%rowtype; v_base int; v_inc int;
begin
  select * into f from app.floor_state where auction_id = p_auction_id;
  if not found or f.current_auction_player_id is null then return null; end if;
  if f.leading_team_id is null then
    select base_price into v_base from app.auction_players where id = f.current_auction_player_id;
    return v_base;
  end if;
  v_inc := app.increment_for(p_auction_id, f.current_price);
  if v_inc is null then return null; end if;
  return f.current_price + v_inc;
end $$;

create or replace function app.floor_json(p_auction_id uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'auctionId', f.auction_id,
    'currentAuctionPlayerId', f.current_auction_player_id,
    'phase', f.phase,
    'currentPrice', f.current_price,
    'leadingTeamId', f.leading_team_id,
    'version', f.version,
    'timerEndsAt', f.timer_ends_at,
    'pausedRemainingMs', f.paused_remaining_ms,
    'rtmTeamId', f.rtm_team_id,
    'rtmStage', f.rtm_stage,
    'lastResultTeamId', f.last_result_team_id,
    'lastResultPrice', f.last_result_price,
    'nextBidAmount', app.next_bid_amount(f.auction_id),
    'auctionStatus', a.status,
    'eventSeq', a.event_seq,
    'settingsVersion', a.settings_version,
    'rulesChangedAt', a.rules_changed_at,
    'serverTime', clock_timestamp()
  )
  from app.floor_state f join app.auctions a on a.id = f.auction_id
  where f.auction_id = p_auction_id;
$$;

create or replace function app._result(p_ok boolean, p_code text, p_message text, p_auction_id uuid, p_extra jsonb default '{}'::jsonb)
returns jsonb language sql stable as $$
  select jsonb_build_object('ok', p_ok, 'code', p_code, 'message', p_message, 'floor', app.floor_json(p_auction_id)) || coalesce(p_extra, '{}'::jsonb);
$$;

-- Squad numbers for a team: players sold to it or retained by it.
create or replace function app.team_counts(p_team_id uuid)
returns table(squad_count int, overseas_count int, role_counts jsonb)
language sql stable as $$
  with squad as (
    select p.role_key, p.nationality_group
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.sold_to_team_id = p_team_id and ap.status in ('sold','retained')
  )
  select
    (select count(*)::int from squad),
    (select count(*)::int from squad where nationality_group = 'overseas'),
    coalesce((select jsonb_object_agg(role_key, n) from (select role_key, count(*)::int n from squad group by role_key) r), '{}'::jsonb);
$$;

-- Lowest base price among players still to be auctioned. Used by the
-- purse reserve rule. Falls back to the auction default base price.
create or replace function app.reserve_unit_price(p_auction_id uuid) returns int
language sql stable as $$
  select coalesce(
    (select min(base_price) from app.auction_players where auction_id = p_auction_id and status in ('pool','unsold')),
    (select default_base_price from app.auctions where id = p_auction_id),
    0);
$$;

-- Largest bid a team may place right now under purse and reserve rules.
create or replace function app.max_bid_for(p_team_id uuid) returns int
language plpgsql stable as $$
declare t app.teams%rowtype; a app.auctions%rowtype; c record; v_left int; v_slots int;
begin
  select * into t from app.teams where id = p_team_id;
  select * into a from app.auctions where id = t.auction_id;
  select * into c from app.team_counts(p_team_id);
  v_left := t.purse_total - t.purse_spent;
  if not a.reserve_rule_enabled then return greatest(v_left, 0); end if;
  v_slots := greatest(a.squad_min - c.squad_count - 1, 0);
  return greatest(v_left - v_slots * app.reserve_unit_price(a.id), 0);
end $$;

-- Can this team win this player at this amount? Returns (null, null) when
-- allowed, else a machine code and a plain-language message.
create or replace function app._eligibility(p_team_id uuid, p_player_id uuid, p_amount int,
  out code text, out message text)
language plpgsql stable as $$
declare
  t app.teams%rowtype; a app.auctions%rowtype; pl app.players%rowtype; c record;
  v_left int; v_slots int; v_reserve int; v_role_max int; v_unmet int; v_role text; v_min int; v_have int;
begin
  code := null; message := null;
  select * into t from app.teams where id = p_team_id;
  select * into a from app.auctions where id = t.auction_id;
  select * into pl from app.players where id = p_player_id;
  select * into c from app.team_counts(p_team_id);

  v_left := t.purse_total - t.purse_spent;
  if p_amount > v_left then
    code := 'INSUFFICIENT_PURSE'; message := 'Not enough purse left for this bid.'; return;
  end if;

  if a.reserve_rule_enabled then
    v_slots := greatest(a.squad_min - c.squad_count - 1, 0);
    v_reserve := v_slots * app.reserve_unit_price(a.id);
    if p_amount > v_left - v_reserve then
      code := 'RESERVE_VIOLATION';
      message := 'Not enough purse after reserve. You must keep enough to fill your minimum squad.';
      return;
    end if;
  end if;

  if c.squad_count + 1 > a.squad_max then
    code := 'SQUAD_FULL'; message := 'Your squad is full.'; return;
  end if;

  if pl.nationality_group = 'overseas' and c.overseas_count + 1 > a.max_overseas then
    code := 'OVERSEAS_LIMIT'; message := 'You have reached the overseas player limit.'; return;
  end if;

  v_role_max := nullif(a.role_maximums ->> pl.role_key, '')::int;
  if v_role_max is not null and coalesce((c.role_counts ->> pl.role_key)::int, 0) + 1 > v_role_max then
    code := 'ROLE_LIMIT'; message := 'You have reached the maximum for this role.'; return;
  end if;

  -- Winning this player must leave enough open slots for unmet role minimums.
  v_unmet := 0;
  for v_role, v_min in select key, nullif(value #>> '{}', '')::int from jsonb_each(a.role_minimums) loop
    v_have := coalesce((c.role_counts ->> v_role)::int, 0) + case when v_role = pl.role_key then 1 else 0 end;
    v_unmet := v_unmet + greatest(coalesce(v_min, 0) - v_have, 0);
  end loop;
  if a.squad_max - (c.squad_count + 1) < v_unmet then
    code := 'ROLE_LIMIT';
    message := 'Winning this player would leave too few squad slots for the roles you still need.';
    return;
  end if;
end $$;

-- Completes a sale on the floor. Caller holds the floor lock.
create or replace function app._sell(p_auction_id uuid, p_team_id uuid, p_price int,
  p_actor_type text, p_actor_id text, p_via text) returns jsonb
language plpgsql as $$
declare f app.floor_state%rowtype; t app.teams%rowtype; ap app.auction_players%rowtype;
begin
  select * into f from app.floor_state where auction_id = p_auction_id;
  select * into ap from app.auction_players where id = f.current_auction_player_id for update;
  select * into t from app.teams where id = p_team_id for update;
  if t.purse_spent + p_price > t.purse_total then
    return app._result(false, 'INSUFFICIENT_PURSE', 'That team does not have enough purse left for this sale.', p_auction_id);
  end if;
  update app.teams set purse_spent = purse_spent + p_price, version = version + 1 where id = p_team_id;
  update app.auction_players set status = 'sold', sold_to_team_id = p_team_id, sold_price = p_price,
    sold_at = clock_timestamp(), version = version + 1 where id = ap.id;
  update app.floor_state set phase = 'sold', leading_team_id = p_team_id, current_price = p_price,
    timer_ends_at = null, paused_remaining_ms = null, rtm_team_id = null, rtm_stage = null,
    last_result_team_id = p_team_id, last_result_price = p_price,
    version = version + 1, server_updated_at = clock_timestamp()
    where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, p_actor_type, p_actor_id, 'floor.sold', 'auction_player', ap.id::text,
    jsonb_build_object('status', ap.status),
    jsonb_build_object('status', 'sold', 'team_id', p_team_id, 'price', p_price, 'via', p_via));
  return app._result(true, 'SOLD', 'Sold.', p_auction_id);
end $$;

-- place_bid ---------------------------------------------------------------
create or replace function app.place_bid(
  p_auction_id uuid, p_team_id uuid, p_expected_version bigint, p_idempotency_key text,
  p_source text, p_actor_id text, p_session_id uuid default null
) returns jsonb language plpgsql as $$
declare
  f app.floor_state%rowtype; a app.auctions%rowtype; t app.teams%rowtype;
  ap app.auction_players%rowtype; v_dup app.bids%rowtype;
  v_amount int; v_inc int; e record; v_new_end timestamptz; v_ext int; v_now timestamptz := clock_timestamp();
begin
  if p_source not in ('manager','admin_on_behalf') then
    raise exception 'invalid bid source';
  end if;

  select * into f from app.floor_state where auction_id = p_auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_LIVE', 'message', 'This auction is not running.');
  end if;

  select * into v_dup from app.bids where idempotency_key = p_idempotency_key;
  if found then
    if v_dup.team_id = p_team_id and v_dup.auction_id = p_auction_id then
      return app._result(true, 'DUPLICATE', 'This bid was already placed.', p_auction_id, jsonb_build_object('amount', v_dup.amount));
    end if;
    return app._result(false, 'STALE', 'Please try again.', p_auction_id);
  end if;

  select * into t from app.teams where id = p_team_id and auction_id = p_auction_id and deleted_at is null;
  if not found then
    return app._result(false, 'NOT_AUTHORISED', 'This team is not part of this auction.', p_auction_id);
  end if;

  if p_source = 'manager' then
    perform 1 from app.team_sessions s join app.team_access_codes c on c.id = s.access_code_id
      where s.id = p_session_id and s.team_id = p_team_id and s.revoked_at is null
        and s.expires_at > v_now and c.active;
    if not found then
      return app._result(false, 'NOT_AUTHORISED', 'Your session has ended. Join again with your access code.', p_auction_id);
    end if;
  end if;

  select * into a from app.auctions where id = p_auction_id;
  if a.status <> 'live' or f.phase <> 'live' or f.current_auction_player_id is null then
    return app._result(false, 'NOT_LIVE', 'Bidding is not open right now.', p_auction_id);
  end if;
  if f.timer_ends_at is not null and v_now >= f.timer_ends_at then
    return app._result(false, 'NOT_LIVE', 'Time is up for this player.', p_auction_id);
  end if;
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'Another bid came in first. The price has been updated.', p_auction_id);
  end if;
  if f.leading_team_id = p_team_id then
    return app._result(false, 'ALREADY_LEADING', 'You are the leading bidder.', p_auction_id);
  end if;

  select * into ap from app.auction_players where id = f.current_auction_player_id;
  if f.leading_team_id is null then
    v_amount := ap.base_price;
  else
    v_inc := app.increment_for(p_auction_id, f.current_price);
    if v_inc is null then
      return app._result(false, 'NOT_LIVE', 'No bid increment is set for this price. Ask the admin to fix the bid slabs.', p_auction_id);
    end if;
    v_amount := f.current_price + v_inc;
  end if;

  select * into e from app._eligibility(p_team_id, ap.player_id, v_amount);
  if e.code is not null then
    return app._result(false, e.code, e.message, p_auction_id, jsonb_build_object('amount', v_amount));
  end if;

  insert into app.bids(auction_id, auction_player_id, team_id, amount, placed_by_profile_id, source, idempotency_key)
  values (p_auction_id, ap.id, p_team_id, v_amount, coalesce(p_actor_id, ''), p_source, p_idempotency_key);

  v_new_end := f.timer_ends_at;
  if a.bid_timer_seconds is not null then
    v_ext := coalesce(a.timer_extension_seconds, a.bid_timer_seconds);
    v_new_end := greatest(coalesce(f.timer_ends_at, v_now), v_now + make_interval(secs => v_ext));
  end if;

  update app.floor_state set current_price = v_amount, leading_team_id = p_team_id,
    version = version + 1, timer_ends_at = v_new_end, server_updated_at = v_now
    where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, case when p_source = 'manager' then 'team' else 'admin' end, p_actor_id,
    case when p_source = 'manager' then 'bid.placed' else 'bid.placed_on_behalf' end,
    'auction_player', ap.id::text,
    jsonb_build_object('price', f.current_price, 'leading_team_id', f.leading_team_id),
    jsonb_build_object('price', v_amount, 'leading_team_id', p_team_id));

  return app._result(true, 'OK', 'Bid placed.', p_auction_id, jsonb_build_object('amount', v_amount));
end $$;

-- Floor controls (admin) ------------------------------------------------

create or replace function app._lock_floor(p_auction_id uuid) returns app.floor_state
language plpgsql as $$
declare f app.floor_state%rowtype;
begin
  select * into f from app.floor_state where auction_id = p_auction_id for update;
  if not found then raise exception 'floor not found for auction %', p_auction_id; end if;
  return f;
end $$;

create or replace function app.move_to_floor(p_auction_id uuid, p_auction_player_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; a app.auctions%rowtype; ap app.auction_players%rowtype; pl app.players%rowtype;
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  select * into a from app.auctions where id = p_auction_id;
  if a.status not in ('live','paused') then
    return app._result(false, 'NOT_LIVE', 'Start the auction before putting a player on the floor.', p_auction_id);
  end if;
  if f.phase in ('live','paused','rtm_pending') then
    return app._result(false, 'FLOOR_BUSY', 'Finish the current player first: mark sold, unsold, or return to pool.', p_auction_id);
  end if;
  select * into ap from app.auction_players where id = p_auction_player_id and auction_id = p_auction_id for update;
  if not found or ap.status not in ('pool','unsold') then
    return app._result(false, 'NOT_AVAILABLE', 'That player is not available for the floor.', p_auction_id);
  end if;
  select * into pl from app.players where id = ap.player_id;
  if pl.deleted_at is not null then
    return app._result(false, 'NOT_AVAILABLE', 'That player has been removed.', p_auction_id);
  end if;
  if pl.date_of_birth is not null and pl.date_of_birth > (current_date - interval '18 years')::date
     and coalesce(pl.guardian_consent, false) = false then
    return app._result(false, 'CONSENT_REQUIRED', 'This player is under 18. Record guardian consent before auctioning them.', p_auction_id);
  end if;

  -- A player that was on the floor but never started goes back to the pool.
  if f.phase = 'idle' and f.current_auction_player_id is not null then
    update app.auction_players set status = 'pool', version = version + 1
      where id = f.current_auction_player_id and status = 'on_floor';
  end if;

  update app.auction_players set status = 'on_floor', version = version + 1 where id = ap.id;
  update app.floor_state set current_auction_player_id = ap.id, phase = 'idle', current_price = ap.base_price,
    leading_team_id = null, timer_ends_at = null, paused_remaining_ms = null, rtm_team_id = null, rtm_stage = null,
    last_result_team_id = null, last_result_price = null,
    version = version + 1, server_updated_at = clock_timestamp()
    where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.move_to_floor', 'auction_player', ap.id::text,
    jsonb_build_object('status', ap.status), jsonb_build_object('status', 'on_floor'));
  return app._result(true, 'OK', 'Player is on the floor.', p_auction_id);
end $$;

create or replace function app.start_bidding(p_auction_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; a app.auctions%rowtype; v_now timestamptz := clock_timestamp();
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  select * into a from app.auctions where id = p_auction_id;
  if a.status <> 'live' then
    return app._result(false, 'NOT_LIVE', 'The auction is not live.', p_auction_id);
  end if;
  if f.phase <> 'idle' or f.current_auction_player_id is null then
    return app._result(false, 'FLOOR_BUSY', 'Put a player on the floor first.', p_auction_id);
  end if;
  update app.floor_state set phase = 'live',
    timer_ends_at = case when a.bid_timer_seconds is null then null else v_now + make_interval(secs => a.bid_timer_seconds) end,
    version = version + 1, server_updated_at = v_now
    where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.start', 'auction_player', f.current_auction_player_id::text, null, null);
  return app._result(true, 'OK', 'Bidding is open.', p_auction_id);
end $$;

create or replace function app.pause_floor(p_auction_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; v_now timestamptz := clock_timestamp(); v_ms int;
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  if f.phase <> 'live' then
    return app._result(false, 'NOT_LIVE', 'Bidding is not running.', p_auction_id);
  end if;
  v_ms := case when f.timer_ends_at is null then null
    else greatest(0, (extract(epoch from (f.timer_ends_at - v_now)) * 1000)::int) end;
  update app.floor_state set phase = 'paused', paused_remaining_ms = v_ms, timer_ends_at = null,
    version = version + 1, server_updated_at = v_now where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.pause', 'auction_player', f.current_auction_player_id::text, null,
    jsonb_build_object('remaining_ms', v_ms));
  return app._result(true, 'OK', 'Bidding paused.', p_auction_id);
end $$;

create or replace function app.resume_floor(p_auction_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; a app.auctions%rowtype; v_now timestamptz := clock_timestamp(); v_ms int;
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  select * into a from app.auctions where id = p_auction_id;
  if a.status <> 'live' then
    return app._result(false, 'NOT_LIVE', 'Resume the auction first.', p_auction_id);
  end if;
  if f.phase <> 'paused' then
    return app._result(false, 'NOT_PAUSED', 'Bidding is not paused.', p_auction_id);
  end if;
  -- Give at least 5 seconds after a resume so nobody is cut off instantly.
  v_ms := case when f.paused_remaining_ms is null then null else greatest(f.paused_remaining_ms, 5000) end;
  update app.floor_state set phase = 'live',
    timer_ends_at = case when v_ms is null then null else v_now + make_interval(secs => v_ms / 1000.0) end,
    paused_remaining_ms = null, version = version + 1, server_updated_at = v_now
    where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.resume', 'auction_player', f.current_auction_player_id::text, null, null);
  return app._result(true, 'OK', 'Bidding resumed.', p_auction_id);
end $$;

create or replace function app.reset_timer(p_auction_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; a app.auctions%rowtype; v_now timestamptz := clock_timestamp();
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  select * into a from app.auctions where id = p_auction_id;
  if a.bid_timer_seconds is null then
    return app._result(false, 'NO_TIMER', 'This auction has no bid timer.', p_auction_id);
  end if;
  if f.phase <> 'live' then
    return app._result(false, 'NOT_LIVE', 'Bidding is not running.', p_auction_id);
  end if;
  update app.floor_state set timer_ends_at = v_now + make_interval(secs => a.bid_timer_seconds),
    version = version + 1, server_updated_at = v_now where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.reset_timer', 'auction_player', f.current_auction_player_id::text, null, null);
  return app._result(true, 'OK', 'Timer reset.', p_auction_id);
end $$;

create or replace function app.undo_last_bid(p_auction_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; b app.bids%rowtype; prev app.bids%rowtype; ap app.auction_players%rowtype;
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  if f.phase not in ('live','paused') or f.current_auction_player_id is null then
    return app._result(false, 'NOT_LIVE', 'There is no running bid to undo.', p_auction_id);
  end if;
  select * into b from app.bids where auction_player_id = f.current_auction_player_id and not voided
    order by created_at desc, id desc limit 1 for update;
  if not found then
    return app._result(false, 'NO_BIDS', 'There are no bids to undo.', p_auction_id);
  end if;
  update app.bids set voided = true, voided_at = clock_timestamp(), void_reason = 'undo' where id = b.id;
  select * into prev from app.bids where auction_player_id = f.current_auction_player_id and not voided
    order by created_at desc, id desc limit 1;
  select * into ap from app.auction_players where id = f.current_auction_player_id;
  update app.floor_state set
    current_price = case when prev.id is null then ap.base_price else prev.amount end,
    leading_team_id = prev.team_id,
    version = version + 1, server_updated_at = clock_timestamp()
    where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'bid.undone', 'bid', b.id::text,
    jsonb_build_object('price', b.amount, 'team_id', b.team_id),
    jsonb_build_object('price', coalesce(prev.amount, ap.base_price), 'team_id', prev.team_id));
  return app._result(true, 'OK', 'Last bid undone.', p_auction_id);
end $$;

create or replace function app.mark_sold(p_auction_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype;
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  if f.phase not in ('live','paused') or f.current_auction_player_id is null then
    return app._result(false, 'NOT_LIVE', 'There is no player being bid on.', p_auction_id);
  end if;
  if f.leading_team_id is null then
    return app._result(false, 'NO_BIDS', 'Nobody has bid. Mark unsold instead.', p_auction_id);
  end if;
  return app._sell(p_auction_id, f.leading_team_id, f.current_price, 'admin', p_actor_id, 'bid');
end $$;

create or replace function app.mark_unsold(p_auction_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype;
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  if f.phase not in ('idle','live','paused') or f.current_auction_player_id is null then
    return app._result(false, 'NOT_LIVE', 'There is no player on the floor.', p_auction_id);
  end if;
  if f.leading_team_id is not null then
    return app._result(false, 'HAS_BIDS', 'There is a leading bid. Mark sold, or undo the bids first.', p_auction_id);
  end if;
  update app.auction_players set status = 'unsold', version = version + 1 where id = f.current_auction_player_id;
  update app.floor_state set phase = 'unsold', timer_ends_at = null, paused_remaining_ms = null,
    last_result_team_id = null, last_result_price = null,
    version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.unsold', 'auction_player', f.current_auction_player_id::text,
    jsonb_build_object('status', 'on_floor'), jsonb_build_object('status', 'unsold'));
  return app._result(true, 'OK', 'Marked unsold.', p_auction_id);
end $$;

-- Return a player on the floor (or an unsold player) to the pool.
create or replace function app.return_to_pool(p_auction_id uuid, p_auction_player_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; ap app.auction_players%rowtype; v_voided int;
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  select * into ap from app.auction_players where id = p_auction_player_id and auction_id = p_auction_id for update;
  if not found then
    return app._result(false, 'NOT_AVAILABLE', 'Player not found in this auction.', p_auction_id);
  end if;
  if ap.status in ('sold','retained') then
    return app._result(false, 'USE_CORRECTION', 'This player is sold. Use the results correction to return them.', p_auction_id);
  end if;
  update app.bids set voided = true, voided_at = clock_timestamp(), void_reason = 'returned_to_pool'
    where auction_player_id = ap.id and not voided;
  get diagnostics v_voided = row_count;
  update app.auction_players set status = 'pool', version = version + 1 where id = ap.id;
  if f.current_auction_player_id = ap.id then
    update app.floor_state set current_auction_player_id = null, phase = 'idle', current_price = 0,
      leading_team_id = null, timer_ends_at = null, paused_remaining_ms = null, rtm_team_id = null, rtm_stage = null,
      last_result_team_id = null, last_result_price = null,
      version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  else
    update app.floor_state set version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  end if;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.return_to_pool', 'auction_player', ap.id::text,
    jsonb_build_object('status', ap.status), jsonb_build_object('status', 'pool', 'bids_voided', v_voided));
  return app._result(true, 'OK', 'Returned to the pool.', p_auction_id);
end $$;

-- Assign a player directly to a team at a price. Purse is always enforced.
create or replace function app.force_assign(p_auction_id uuid, p_auction_player_id uuid, p_team_id uuid, p_price int,
  p_expected_version bigint, p_actor_id text, p_reason text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; ap app.auction_players%rowtype; t app.teams%rowtype;
begin
  if coalesce(trim(p_reason), '') = '' then
    return app._result(false, 'REASON_REQUIRED', 'Give a reason for this assignment.', p_auction_id);
  end if;
  if p_price is null or p_price < 0 then
    return app._result(false, 'INVALID', 'Enter a price of zero or more.', p_auction_id);
  end if;
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  select * into ap from app.auction_players where id = p_auction_player_id and auction_id = p_auction_id for update;
  if not found or ap.status not in ('pool','unsold','on_floor') then
    return app._result(false, 'NOT_AVAILABLE', 'That player cannot be assigned.', p_auction_id);
  end if;
  select * into t from app.teams where id = p_team_id and auction_id = p_auction_id and deleted_at is null for update;
  if not found then
    return app._result(false, 'NOT_FOUND', 'Team not found.', p_auction_id);
  end if;
  if t.purse_spent + p_price > t.purse_total then
    return app._result(false, 'INSUFFICIENT_PURSE', 'That team does not have enough purse left.', p_auction_id);
  end if;
  update app.bids set voided = true, voided_at = clock_timestamp(), void_reason = 'force_assign'
    where auction_player_id = ap.id and not voided;
  update app.teams set purse_spent = purse_spent + p_price, version = version + 1 where id = t.id;
  update app.auction_players set status = 'sold', sold_to_team_id = t.id, sold_price = p_price,
    sold_at = clock_timestamp(), version = version + 1 where id = ap.id;
  if f.current_auction_player_id = ap.id then
    update app.floor_state set phase = 'sold', leading_team_id = t.id, current_price = p_price,
      timer_ends_at = null, paused_remaining_ms = null, rtm_team_id = null, rtm_stage = null,
      last_result_team_id = t.id, last_result_price = p_price,
      version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  else
    update app.floor_state set version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  end if;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.force_assign', 'auction_player', ap.id::text,
    jsonb_build_object('status', ap.status),
    jsonb_build_object('status', 'sold', 'team_id', t.id, 'price', p_price), p_reason);
  return app._result(true, 'OK', 'Player assigned.', p_auction_id);
end $$;

-- Right to Match (RTM) / Final Bid Match (FBM) ---------------------------
-- offer:        admin. previous team may now match.
-- decline:      previous team or admin. sale goes to the leading bidder.
-- match:        previous team or admin. With final raise allowed, the
--               leading bidder may raise once; otherwise the previous team buys.
-- raise:        leading bidder or admin, once.
-- no_raise:     leading bidder or admin. previous team buys at the matched price.
-- match_raise:  previous team or admin. previous team buys at the raised price.
-- decline_raise: previous team or admin. leading bidder buys at the raised price.
-- A card is used only when the previous team actually buys the player.
create or replace function app.rtm_action(p_auction_id uuid, p_action text, p_expected_version bigint,
  p_actor_type text, p_actor_id text, p_actor_team_id uuid default null, p_amount int default null)
returns jsonb language plpgsql as $$
declare
  f app.floor_state%rowtype; a app.auctions%rowtype; ap app.auction_players%rowtype; prev app.teams%rowtype;
  e record; v_inc int; v_res jsonb; v_is_admin boolean := (p_actor_type = 'admin');
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  select * into a from app.auctions where id = p_auction_id;
  if not a.rtm_enabled then
    return app._result(false, 'RTM_DISABLED', a.rtm_label || ' is turned off for this auction.', p_auction_id);
  end if;
  select * into ap from app.auction_players where id = f.current_auction_player_id;

  if p_action = 'offer' then
    if not v_is_admin then
      return app._result(false, 'NOT_AUTHORISED', 'Only the admin can offer ' || a.rtm_label || '.', p_auction_id);
    end if;
    if f.phase not in ('live','paused') or f.leading_team_id is null then
      return app._result(false, 'NOT_LIVE', 'There must be a leading bid first.', p_auction_id);
    end if;
    if ap.previous_team_id is null or ap.previous_team_id = f.leading_team_id then
      return app._result(false, 'RTM_NOT_APPLICABLE', 'No other previous team can use ' || a.rtm_label || ' for this player.', p_auction_id);
    end if;
    select * into prev from app.teams where id = ap.previous_team_id and auction_id = p_auction_id and deleted_at is null;
    if not found or prev.rtm_cards_left <= 0 then
      return app._result(false, 'RTM_NO_CARDS', 'The previous team has no ' || a.rtm_label || ' cards left.', p_auction_id);
    end if;
    update app.floor_state set phase = 'rtm_pending', rtm_team_id = prev.id, rtm_stage = 'offered',
      timer_ends_at = null, paused_remaining_ms = null, version = version + 1, server_updated_at = clock_timestamp()
      where auction_id = p_auction_id;
    perform app._bump(p_auction_id);
    perform app._audit(p_auction_id, 'admin', p_actor_id, 'rtm.offer', 'auction_player', ap.id::text, null,
      jsonb_build_object('rtm_team_id', prev.id, 'price', f.current_price));
    return app._result(true, 'OK', a.rtm_label || ' offered to the previous team.', p_auction_id);
  end if;

  if f.phase <> 'rtm_pending' then
    return app._result(false, 'NOT_LIVE', 'No ' || a.rtm_label || ' decision is pending.', p_auction_id);
  end if;

  if p_action in ('decline','match','match_raise','decline_raise') then
    if not v_is_admin and p_actor_team_id is distinct from f.rtm_team_id then
      return app._result(false, 'NOT_AUTHORISED', 'Only the previous team can answer this.', p_auction_id);
    end if;
  elsif p_action in ('raise','no_raise') then
    if not v_is_admin and p_actor_team_id is distinct from f.leading_team_id then
      return app._result(false, 'NOT_AUTHORISED', 'Only the leading bidder can answer this.', p_auction_id);
    end if;
  else
    return app._result(false, 'INVALID', 'Unknown action.', p_auction_id);
  end if;

  if p_action = 'decline' and f.rtm_stage = 'offered' then
    v_res := app._sell(p_auction_id, f.leading_team_id, f.current_price, p_actor_type, p_actor_id, 'bid');
    if (v_res ->> 'ok')::boolean then
      perform app._audit(p_auction_id, p_actor_type, p_actor_id, 'rtm.decline', 'auction_player', ap.id::text, null, null);
    end if;
    return v_res;
  end if;

  if p_action = 'match' and f.rtm_stage = 'offered' then
    select * into e from app._eligibility(f.rtm_team_id, ap.player_id, f.current_price);
    if e.code is not null then
      return app._result(false, e.code, 'The previous team cannot match: ' || e.message, p_auction_id);
    end if;
    if a.rtm_allow_final_raise then
      update app.floor_state set rtm_stage = 'awaiting_raise', version = version + 1, server_updated_at = clock_timestamp()
        where auction_id = p_auction_id;
      perform app._bump(p_auction_id);
      perform app._audit(p_auction_id, p_actor_type, p_actor_id, 'rtm.match', 'auction_player', ap.id::text, null,
        jsonb_build_object('price', f.current_price));
      return app._result(true, 'OK', 'Matched. The leading bidder may raise once.', p_auction_id);
    end if;
    v_res := app._sell(p_auction_id, f.rtm_team_id, f.current_price, p_actor_type, p_actor_id, lower(a.rtm_label));
    if (v_res ->> 'ok')::boolean then
      update app.teams set rtm_cards_left = rtm_cards_left - 1 where id = f.rtm_team_id;
      perform app._audit(p_auction_id, p_actor_type, p_actor_id, 'rtm.match', 'auction_player', ap.id::text, null,
      jsonb_build_object('price', f.current_price));
    end if;
    return v_res;
  end if;

  if p_action = 'no_raise' and f.rtm_stage = 'awaiting_raise' then
    select * into e from app._eligibility(f.rtm_team_id, ap.player_id, f.current_price);
    if e.code is not null then
      return app._result(false, e.code, 'The previous team can no longer buy at this price: ' || e.message, p_auction_id);
    end if;
    v_res := app._sell(p_auction_id, f.rtm_team_id, f.current_price, p_actor_type, p_actor_id, lower(a.rtm_label));
    if (v_res ->> 'ok')::boolean then
      update app.teams set rtm_cards_left = rtm_cards_left - 1 where id = f.rtm_team_id;
      perform app._audit(p_auction_id, p_actor_type, p_actor_id, 'rtm.no_raise', 'auction_player', ap.id::text, null, null);
    end if;
    return v_res;
  end if;

  if p_action = 'raise' and f.rtm_stage = 'awaiting_raise' then
    v_inc := coalesce(app.increment_for(p_auction_id, f.current_price), 1);
    if p_amount is null or p_amount < f.current_price + v_inc then
      return app._result(false, 'INVALID', 'The raise must be at least ' || (f.current_price + v_inc) || '.', p_auction_id);
    end if;
    select * into e from app._eligibility(f.leading_team_id, ap.player_id, p_amount);
    if e.code is not null then
      return app._result(false, e.code, e.message, p_auction_id);
    end if;
    insert into app.bids(auction_id, auction_player_id, team_id, amount, placed_by_profile_id, source, idempotency_key)
    values (p_auction_id, ap.id, f.leading_team_id, p_amount, coalesce(p_actor_id, ''),
      case when v_is_admin then 'admin_on_behalf' else 'manager' end, 'rtm-raise-' || gen_random_uuid()::text);
    update app.floor_state set current_price = p_amount, rtm_stage = 'raised', version = version + 1, server_updated_at = clock_timestamp()
      where auction_id = p_auction_id;
    perform app._bump(p_auction_id);
    perform app._audit(p_auction_id, p_actor_type, p_actor_id, 'rtm.raise', 'auction_player', ap.id::text,
      jsonb_build_object('price', f.current_price), jsonb_build_object('price', p_amount));
    return app._result(true, 'OK', 'Raised. The previous team may match the new price.', p_auction_id);
  end if;

  if p_action = 'match_raise' and f.rtm_stage = 'raised' then
    select * into e from app._eligibility(f.rtm_team_id, ap.player_id, f.current_price);
    if e.code is not null then
      return app._result(false, e.code, 'The previous team cannot match: ' || e.message, p_auction_id);
    end if;
    v_res := app._sell(p_auction_id, f.rtm_team_id, f.current_price, p_actor_type, p_actor_id, lower(a.rtm_label));
    if (v_res ->> 'ok')::boolean then
      update app.teams set rtm_cards_left = rtm_cards_left - 1 where id = f.rtm_team_id;
      perform app._audit(p_auction_id, p_actor_type, p_actor_id, 'rtm.match_raise', 'auction_player', ap.id::text, null, null);
    end if;
    return v_res;
  end if;

  if p_action = 'decline_raise' and f.rtm_stage = 'raised' then
    v_res := app._sell(p_auction_id, f.leading_team_id, f.current_price, p_actor_type, p_actor_id, 'bid');
    if (v_res ->> 'ok')::boolean then
      perform app._audit(p_auction_id, p_actor_type, p_actor_id, 'rtm.decline_raise', 'auction_player', ap.id::text, null, null);
    end if;
    return v_res;
  end if;

  return app._result(false, 'INVALID', 'That step is not available right now.', p_auction_id);
end $$;

-- Accelerated round: unsold players go back into the queue. -----------
create or replace function app.start_accelerated_round(p_auction_id uuid, p_expected_version bigint, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; v_count int; v_round int; v_max int;
begin
  f := app._lock_floor(p_auction_id);
  if f.version <> p_expected_version then
    return app._result(false, 'STALE', 'The floor changed. Reload and try again.', p_auction_id);
  end if;
  if f.phase in ('live','paused','rtm_pending') then
    return app._result(false, 'FLOOR_BUSY', 'Finish the current player first.', p_auction_id);
  end if;
  update app.auctions set current_round = current_round + 1 where id = p_auction_id returning current_round into v_round;
  select coalesce(max(queue_position), 0) into v_max from app.auction_players where auction_id = p_auction_id;
  with ordered as (
    select id, row_number() over (order by set_order, queue_position) rn
    from app.auction_players where auction_id = p_auction_id and status = 'unsold'
  )
  update app.auction_players ap set status = 'pool', round = v_round, queue_position = v_max + o.rn, version = ap.version + 1
  from ordered o where ap.id = o.id;
  get diagnostics v_count = row_count;
  update app.floor_state set version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'floor.accelerated_round', 'auction', p_auction_id::text, null,
    jsonb_build_object('round', v_round, 'players', v_count));
  return app._result(true, 'OK', v_count || ' unsold players are back in the queue.', p_auction_id, jsonb_build_object('count', v_count));
end $$;

-- Queue order: positions follow the order of the given ids. -----------
create or replace function app.reorder_queue(p_auction_id uuid, p_ids uuid[], p_actor_id text)
returns jsonb language plpgsql as $$
declare v_count int;
begin
  perform app._lock_floor(p_auction_id);
  update app.auction_players ap set queue_position = x.pos, version = ap.version + 1
  from unnest(p_ids) with ordinality as x(id, pos)
  where ap.id = x.id and ap.auction_id = p_auction_id;
  get diagnostics v_count = row_count;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'queue.reorder', 'auction', p_auction_id::text, null,
    jsonb_build_object('count', v_count));
  return app._result(true, 'OK', 'Queue order saved.', p_auction_id);
end $$;

-- Results corrections (audited, reason required) ------------------------
create or replace function app.correct_sale(p_auction_id uuid, p_auction_player_id uuid, p_action text,
  p_new_price int, p_new_team_id uuid, p_actor_id text, p_reason text)
returns jsonb language plpgsql as $$
declare ap app.auction_players%rowtype; old_t app.teams%rowtype; new_t app.teams%rowtype; v_price int;
begin
  if coalesce(trim(p_reason), '') = '' then
    return app._result(false, 'REASON_REQUIRED', 'Give a reason for this correction.', p_auction_id);
  end if;
  perform app._lock_floor(p_auction_id);
  select * into ap from app.auction_players where id = p_auction_player_id and auction_id = p_auction_id for update;
  if not found or ap.status not in ('sold','retained') then
    return app._result(false, 'NOT_SOLD', 'Only sold or retained players can be corrected.', p_auction_id);
  end if;
  select * into old_t from app.teams where id = ap.sold_to_team_id for update;

  if p_action = 'price' then
    if p_new_price is null or p_new_price < 0 then
      return app._result(false, 'INVALID', 'Enter a price of zero or more.', p_auction_id);
    end if;
    if old_t.purse_spent - ap.sold_price + p_new_price > old_t.purse_total then
      return app._result(false, 'INSUFFICIENT_PURSE', 'That price would take the team over its purse.', p_auction_id);
    end if;
    update app.teams set purse_spent = purse_spent - ap.sold_price + p_new_price, version = version + 1 where id = old_t.id;
    update app.auction_players set sold_price = p_new_price, version = version + 1 where id = ap.id;
    v_price := p_new_price;
  elsif p_action = 'move' then
    select * into new_t from app.teams where id = p_new_team_id and auction_id = p_auction_id and deleted_at is null for update;
    if not found then
      return app._result(false, 'NOT_FOUND', 'Team not found.', p_auction_id);
    end if;
    if new_t.id = old_t.id then
      return app._result(false, 'INVALID', 'Pick a different team.', p_auction_id);
    end if;
    v_price := coalesce(p_new_price, ap.sold_price);
    if new_t.purse_spent + v_price > new_t.purse_total then
      return app._result(false, 'INSUFFICIENT_PURSE', 'The new team does not have enough purse left.', p_auction_id);
    end if;
    update app.teams set purse_spent = purse_spent - ap.sold_price, version = version + 1 where id = old_t.id;
    update app.teams set purse_spent = purse_spent + v_price, version = version + 1 where id = new_t.id;
    update app.auction_players set sold_to_team_id = new_t.id, sold_price = v_price, version = version + 1 where id = ap.id;
  elsif p_action = 'return' then
    update app.teams set purse_spent = purse_spent - ap.sold_price, version = version + 1 where id = old_t.id;
    update app.auction_players set status = 'pool', sold_to_team_id = null, sold_price = null, sold_at = null,
      version = version + 1 where id = ap.id;
    v_price := null;
  else
    return app._result(false, 'INVALID', 'Unknown correction.', p_auction_id);
  end if;

  update app.floor_state set version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'result.' || p_action, 'auction_player', ap.id::text,
    jsonb_build_object('status', ap.status, 'team_id', ap.sold_to_team_id, 'price', ap.sold_price),
    jsonb_build_object('team_id', coalesce(new_t.id, case when p_action = 'return' then null else old_t.id end), 'price', v_price),
    p_reason);
  return app._result(true, 'OK', 'Result corrected.', p_auction_id);
end $$;

-- Purse adjustment. Never below points already spent. -----------------
create or replace function app.adjust_purse(p_auction_id uuid, p_team_id uuid, p_new_total int, p_expected_team_version bigint,
  p_actor_id text, p_reason text)
returns jsonb language plpgsql as $$
declare t app.teams%rowtype; a app.auctions%rowtype;
begin
  perform app._lock_floor(p_auction_id);
  select * into a from app.auctions where id = p_auction_id;
  select * into t from app.teams where id = p_team_id and auction_id = p_auction_id and deleted_at is null for update;
  if not found then
    return app._result(false, 'NOT_FOUND', 'Team not found.', p_auction_id);
  end if;
  if t.version <> p_expected_team_version then
    return app._result(false, 'STALE', 'This team was changed elsewhere. Reload to see it.', p_auction_id);
  end if;
  if a.status not in ('draft','scheduled') and coalesce(trim(p_reason), '') = '' then
    return app._result(false, 'REASON_REQUIRED', 'Give a reason for changing a purse after the auction has started.', p_auction_id);
  end if;
  if p_new_total < t.purse_spent then
    return app._result(false, 'PURSE_BELOW_SPENT', 'The purse cannot be lower than the ' || t.purse_spent || ' already spent.', p_auction_id);
  end if;
  update app.teams set purse_total = p_new_total, version = version + 1 where id = t.id;
  update app.floor_state set version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'team.adjust_purse', 'team', t.id::text,
    jsonb_build_object('purse_total', t.purse_total), jsonb_build_object('purse_total', p_new_total), nullif(trim(p_reason), ''));
  return app._result(true, 'OK', 'Purse updated.', p_auction_id);
end $$;

-- Retentions (before the auction goes live). -------------------------
create or replace function app.retain_player(p_auction_id uuid, p_auction_player_id uuid, p_team_id uuid, p_price int, p_actor_id text)
returns jsonb language plpgsql as $$
declare a app.auctions%rowtype; ap app.auction_players%rowtype; t app.teams%rowtype; v_count int;
begin
  perform app._lock_floor(p_auction_id);
  select * into a from app.auctions where id = p_auction_id;
  if not a.retentions_enabled then
    return app._result(false, 'DISABLED', 'Retentions are turned off for this auction.', p_auction_id);
  end if;
  if a.status not in ('draft','scheduled') then
    return app._result(false, 'NOT_ALLOWED', 'Retentions are set before the auction starts.', p_auction_id);
  end if;
  select * into ap from app.auction_players where id = p_auction_player_id and auction_id = p_auction_id for update;
  if not found or ap.status <> 'pool' then
    return app._result(false, 'NOT_AVAILABLE', 'Only players in the pool can be retained.', p_auction_id);
  end if;
  select * into t from app.teams where id = p_team_id and auction_id = p_auction_id and deleted_at is null for update;
  if not found then
    return app._result(false, 'NOT_FOUND', 'Team not found.', p_auction_id);
  end if;
  select count(*) into v_count from app.auction_players where sold_to_team_id = t.id and status = 'retained';
  if v_count >= a.max_retentions then
    return app._result(false, 'LIMIT', 'This team has used all its retentions.', p_auction_id);
  end if;
  if t.purse_spent + p_price > t.purse_total then
    return app._result(false, 'INSUFFICIENT_PURSE', 'Not enough purse for this retention.', p_auction_id);
  end if;
  update app.teams set purse_spent = purse_spent + p_price, version = version + 1 where id = t.id;
  update app.auction_players set status = 'retained', sold_to_team_id = t.id, sold_price = p_price,
    sold_at = clock_timestamp(), previous_team_id = t.id, version = version + 1 where id = ap.id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'retention.add', 'auction_player', ap.id::text, null,
    jsonb_build_object('team_id', t.id, 'price', p_price));
  return app._result(true, 'OK', 'Player retained.', p_auction_id);
end $$;

-- Conflict check for rule changes. Lists teams that would break a rule.
create or replace function app.rule_conflicts(p_auction_id uuid, p_squad_max int, p_max_overseas int, p_role_maximums jsonb)
returns jsonb language plpgsql stable as $$
declare t record; c record; v_out jsonb := '[]'::jsonb; r record;
begin
  for t in select id, name from app.teams where auction_id = p_auction_id and deleted_at is null order by name loop
    select * into c from app.team_counts(t.id);
    if c.squad_count > p_squad_max then
      v_out := v_out || jsonb_build_object('teamId', t.id, 'teamName', t.name, 'issue', 'squad_max',
        'detail', format('holds %s players, new maximum is %s', c.squad_count, p_squad_max));
    end if;
    if c.overseas_count > p_max_overseas then
      v_out := v_out || jsonb_build_object('teamId', t.id, 'teamName', t.name, 'issue', 'max_overseas',
        'detail', format('holds %s overseas players, new maximum is %s', c.overseas_count, p_max_overseas));
    end if;
    for r in select key, nullif(value #>> '{}', '')::int as mx from jsonb_each(coalesce(p_role_maximums, '{}'::jsonb)) loop
      if r.mx is not null and coalesce((c.role_counts ->> r.key)::int, 0) > r.mx then
        v_out := v_out || jsonb_build_object('teamId', t.id, 'teamName', t.name, 'issue', 'role_max', 'role', r.key,
          'detail', format('holds %s in role %s, new maximum is %s', (c.role_counts ->> r.key), r.key, r.mx));
      end if;
    end loop;
  end loop;
  return v_out;
end $$;

-- Slab validation: contiguous bands from 0 with the last open-ended.
create or replace function app.validate_slabs(p_slabs jsonb) returns text
language plpgsql immutable as $$
declare s record; v_expected int := 0; v_n int := 0; v_total int;
begin
  v_total := jsonb_array_length(coalesce(p_slabs, '[]'::jsonb));
  if v_total = 0 then return 'Add at least one bid slab.'; end if;
  for s in select (e ->> 'from')::int f, nullif(e ->> 'to', '')::int t, (e ->> 'increment')::int i
           from jsonb_array_elements(p_slabs) e order by (e ->> 'from')::int loop
    v_n := v_n + 1;
    if s.f <> v_expected then
      return case when s.f > v_expected then format('There is a gap between %s and %s.', v_expected, s.f)
                  else format('Slabs overlap at %s.', s.f) end;
    end if;
    if s.i is null or s.i <= 0 then return 'Every increment must be more than zero.'; end if;
    if s.t is null and v_n < v_total then return 'Only the last slab can have no upper limit.'; end if;
    if s.t is not null and s.t <= s.f then return format('Slab starting at %s must end above its start.', s.f); end if;
    v_expected := coalesce(s.t, -1);
  end loop;
  if v_expected <> -1 then return 'The last slab must have no upper limit.'; end if;
  return null;
end $$;

-- Apply auction settings atomically. -------------------------------------
create or replace function app.update_auction_settings(p_auction_id uuid, p_expected_settings_version bigint,
  p_settings jsonb, p_slabs jsonb, p_actor_id text, p_reason text, p_confirm_conflicts boolean)
returns jsonb language plpgsql as $$
declare
  a app.auctions%rowtype; n app.auctions%rowtype; v_slab_err text; v_conflicts jsonb;
  v_old_slabs jsonb; v_live boolean; v_card_delta int; v_now timestamptz := clock_timestamp();
begin
  perform app._lock_floor(p_auction_id);
  select * into a from app.auctions where id = p_auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Auction not found.');
  end if;
  if a.settings_version <> p_expected_settings_version then
    return app._result(false, 'STALE', 'This was changed elsewhere. Reload to see it.', p_auction_id);
  end if;
  if a.status in ('completed','archived') then
    return app._result(false, 'LOCKED', 'Completed auctions can only be changed through results corrections.', p_auction_id);
  end if;
  v_live := a.status in ('live','paused');
  if v_live and coalesce(trim(p_reason), '') = '' then
    return app._result(false, 'REASON_REQUIRED', 'Give a reason for changing rules during a live auction.', p_auction_id);
  end if;

  n := a;
  n.name := coalesce(p_settings ->> 'name', a.name);
  if p_settings ? 'slug' and (p_settings ->> 'slug') <> a.slug then
    if v_live then
      return app._result(false, 'LOCKED', 'The link cannot change while the auction is running.', p_auction_id);
    end if;
    n.slug := p_settings ->> 'slug';
  end if;
  if p_settings ? 'starts_at' then n.starts_at := nullif(p_settings ->> 'starts_at', '')::timestamptz; end if;
  n.points_unit_label := coalesce(p_settings ->> 'points_unit_label', a.points_unit_label);
  n.public := coalesce((p_settings ->> 'public')::boolean, a.public);
  n.registration_open := coalesce((p_settings ->> 'registration_open')::boolean, a.registration_open);
  n.purse_per_team := coalesce((p_settings ->> 'purse_per_team')::int, a.purse_per_team);
  n.squad_min := coalesce((p_settings ->> 'squad_min')::int, a.squad_min);
  n.squad_max := coalesce((p_settings ->> 'squad_max')::int, a.squad_max);
  n.max_overseas := coalesce((p_settings ->> 'max_overseas')::int, a.max_overseas);
  n.role_minimums := coalesce(p_settings -> 'role_minimums', a.role_minimums);
  n.role_maximums := coalesce(p_settings -> 'role_maximums', a.role_maximums);
  n.default_base_price := coalesce((p_settings ->> 'default_base_price')::int, a.default_base_price);
  n.category_base_prices := coalesce(p_settings -> 'category_base_prices', a.category_base_prices);
  n.reserve_rule_enabled := coalesce((p_settings ->> 'reserve_rule_enabled')::boolean, a.reserve_rule_enabled);
  if p_settings ? 'bid_timer_seconds' then n.bid_timer_seconds := nullif(p_settings ->> 'bid_timer_seconds', '')::int; end if;
  if p_settings ? 'timer_extension_seconds' then n.timer_extension_seconds := nullif(p_settings ->> 'timer_extension_seconds', '')::int; end if;
  n.rtm_enabled := coalesce((p_settings ->> 'rtm_enabled')::boolean, a.rtm_enabled);
  n.rtm_label := coalesce(p_settings ->> 'rtm_label', a.rtm_label);
  n.rtm_allow_final_raise := coalesce((p_settings ->> 'rtm_allow_final_raise')::boolean, a.rtm_allow_final_raise);
  n.rtm_cards_per_team := coalesce((p_settings ->> 'rtm_cards_per_team')::int, a.rtm_cards_per_team);
  n.retentions_enabled := coalesce((p_settings ->> 'retentions_enabled')::boolean, a.retentions_enabled);
  n.max_retentions := coalesce((p_settings ->> 'max_retentions')::int, a.max_retentions);

  if n.squad_min > n.squad_max then
    return app._result(false, 'INVALID', 'Squad minimum cannot be more than squad maximum.', p_auction_id);
  end if;

  if p_slabs is not null then
    v_slab_err := app.validate_slabs(p_slabs);
    if v_slab_err is not null then
      return app._result(false, 'INVALID_SLABS', v_slab_err, p_auction_id);
    end if;
  end if;

  v_conflicts := app.rule_conflicts(p_auction_id, n.squad_max, n.max_overseas, n.role_maximums);
  if jsonb_array_length(v_conflicts) > 0 and not coalesce(p_confirm_conflicts, false) then
    return app._result(false, 'CONFLICTS', 'Some teams would break the new rules.', p_auction_id,
      jsonb_build_object('conflicts', v_conflicts));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('from', from_points, 'to', to_points, 'increment', increment_points)
    order by from_points), '[]'::jsonb) into v_old_slabs from app.bid_slabs where auction_id = p_auction_id;

  update app.auctions set name = n.name, slug = n.slug, starts_at = n.starts_at, points_unit_label = n.points_unit_label,
    public = n.public, registration_open = n.registration_open, purse_per_team = n.purse_per_team,
    squad_min = n.squad_min, squad_max = n.squad_max, max_overseas = n.max_overseas,
    role_minimums = n.role_minimums, role_maximums = n.role_maximums,
    default_base_price = n.default_base_price, category_base_prices = n.category_base_prices,
    reserve_rule_enabled = n.reserve_rule_enabled, bid_timer_seconds = n.bid_timer_seconds,
    timer_extension_seconds = n.timer_extension_seconds, rtm_enabled = n.rtm_enabled, rtm_label = n.rtm_label,
    rtm_allow_final_raise = n.rtm_allow_final_raise, rtm_cards_per_team = n.rtm_cards_per_team,
    retentions_enabled = n.retentions_enabled, max_retentions = n.max_retentions,
    settings_version = settings_version + 1,
    rules_changed_at = case when v_live then v_now else rules_changed_at end
    where id = p_auction_id;

  v_card_delta := n.rtm_cards_per_team - a.rtm_cards_per_team;
  if v_card_delta <> 0 then
    update app.teams set rtm_cards_left = greatest(rtm_cards_left + v_card_delta, 0) where auction_id = p_auction_id;
  end if;

  if p_slabs is not null then
    delete from app.bid_slabs where auction_id = p_auction_id;
    insert into app.bid_slabs(auction_id, from_points, to_points, increment_points)
    select p_auction_id, (e ->> 'from')::int, nullif(e ->> 'to', '')::int, (e ->> 'increment')::int
    from jsonb_array_elements(p_slabs) e;
  end if;

  update app.floor_state set server_updated_at = v_now where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'auction.settings', 'auction', p_auction_id::text,
    to_jsonb(a) - 'event_seq' - 'updated_at' || jsonb_build_object('slabs', v_old_slabs),
    (select to_jsonb(x) - 'event_seq' - 'updated_at' from app.auctions x where x.id = p_auction_id)
      || jsonb_build_object('slabs', coalesce(p_slabs, v_old_slabs)),
    nullif(trim(p_reason), ''));
  return app._result(true, 'OK', case when v_live then 'Rules updated. They apply from the next bid.' else 'Settings saved.' end,
    p_auction_id, jsonb_build_object('conflicts', v_conflicts));
end $$;

-- Every auction gets a floor row.
create or replace function app.create_floor_for_auction() returns trigger language plpgsql as $$
begin
  insert into app.floor_state(auction_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger auctions_create_floor after insert on app.auctions
  for each row execute function app.create_floor_for_auction();
