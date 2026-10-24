-- Full admin deletes. The admin can remove any player or team at any time.
-- Purses are refunded, the floor is cleared if needed, and every delete is
-- written to the audit log with what was removed.

-- Clears the floor without a result. Used when the player or team on it is deleted.
create or replace function app._clear_floor(p_auction_id uuid)
returns void language plpgsql as $$
begin
  update app.floor_state set current_auction_player_id = null, phase = 'idle', current_price = 0,
    leading_team_id = null, timer_ends_at = null, paused_remaining_ms = null, rtm_team_id = null, rtm_stage = null,
    last_result_team_id = null, last_result_price = null,
    version = version + 1, server_updated_at = clock_timestamp()
    where auction_id = p_auction_id;
end $$;

create or replace function app.admin_delete_players(p_auction_id uuid, p_ids uuid[], p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; r record; v_count int := 0; v_refunded int := 0; v_bids int := 0; v_names text[] := '{}';
begin
  f := app._lock_floor(p_auction_id);

  -- A player on the floor is taken off it first.
  if f.current_auction_player_id = any(p_ids) then
    perform app._clear_floor(p_auction_id);
  end if;

  for r in
    select ap.id, ap.status, ap.sold_to_team_id, ap.sold_price, ap.player_id, p.full_name,
      (select count(*)::int from app.bids b where b.auction_player_id = ap.id) as bids
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.auction_id = p_auction_id and ap.id = any(p_ids)
    for update of ap
  loop
    if r.status in ('sold','retained') and r.sold_to_team_id is not null then
      update app.teams set purse_spent = greatest(0, purse_spent - r.sold_price), version = version + 1 where id = r.sold_to_team_id;
      v_refunded := v_refunded + coalesce(r.sold_price, 0);
    end if;
    v_bids := v_bids + r.bids;
    v_names := v_names || r.full_name;
    delete from app.shortlists where auction_player_id = r.id;
    delete from app.auction_players where id = r.id; -- bids go with it (on delete cascade)
    update app.players set deleted_at = now()
      where id = r.player_id and not exists (select 1 from app.auction_players x where x.player_id = r.player_id);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    return app._result(false, 'NOT_FOUND', 'None of those players were found.', p_auction_id);
  end if;

  update app.floor_state set version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'player.delete', 'auction', p_auction_id::text, null,
    jsonb_build_object('count', v_count, 'names', to_jsonb(v_names), 'points_refunded', v_refunded, 'bids_removed', v_bids));
  return app._result(true, 'OK',
    v_count || case when v_count = 1 then ' player deleted.' else ' players deleted.' end
    || case when v_refunded > 0 then ' ' || v_refunded || ' points returned to team purses.' else '' end, p_auction_id);
end $$;

create or replace function app.admin_delete_team(p_auction_id uuid, p_team_id uuid, p_actor_id text)
returns jsonb language plpgsql as $$
declare f app.floor_state%rowtype; t app.teams%rowtype; v_players int; v_bids int;
begin
  f := app._lock_floor(p_auction_id);
  select * into t from app.teams where id = p_team_id and auction_id = p_auction_id and deleted_at is null for update;
  if not found then
    return app._result(false, 'NOT_FOUND', 'Team not found.', p_auction_id);
  end if;

  -- If this team is in the bidding on the floor, the player goes back to the pool.
  if f.current_auction_player_id is not null and (f.leading_team_id = p_team_id or f.rtm_team_id = p_team_id)
     and f.phase in ('live','paused','rtm_pending') then
    update app.bids set voided = true, voided_at = clock_timestamp(), void_reason = 'team_deleted'
      where auction_player_id = f.current_auction_player_id and not voided;
    update app.auction_players set status = 'pool', version = version + 1 where id = f.current_auction_player_id;
    perform app._clear_floor(p_auction_id);
  elsif f.last_result_team_id = p_team_id then
    update app.floor_state set last_result_team_id = null where auction_id = p_auction_id;
  end if;

  -- Its players go back to the pool and can be auctioned again.
  update app.auction_players set status = 'pool', sold_to_team_id = null, sold_price = null, sold_at = null, version = version + 1
    where sold_to_team_id = p_team_id;
  get diagnostics v_players = row_count;
  update app.auction_players set previous_team_id = null where previous_team_id = p_team_id;

  -- Bids stay in the history, marked void.
  update app.bids set voided = true, voided_at = clock_timestamp(), void_reason = 'team_deleted'
    where team_id = p_team_id and not voided;
  get diagnostics v_bids = row_count;

  update app.teams set deleted_at = now(), purse_spent = 0, version = version + 1 where id = p_team_id;
  update app.team_access_codes set active = false, revoked_at = now() where team_id = p_team_id and active;
  update app.team_sessions set revoked_at = now() where team_id = p_team_id and revoked_at is null;

  update app.floor_state set version = version + 1, server_updated_at = clock_timestamp() where auction_id = p_auction_id;
  perform app._bump(p_auction_id);
  perform app._audit(p_auction_id, 'admin', p_actor_id, 'team.delete', 'team', p_team_id::text,
    jsonb_build_object('name', t.name, 'purse_spent', t.purse_spent), jsonb_build_object('players_returned', v_players, 'bids_voided', v_bids));
  return app._result(true, 'OK', t.name || ' deleted.'
    || case when v_players > 0 then ' ' || v_players || case when v_players = 1 then ' player is' else ' players are' end || ' back in the pool.' else '' end, p_auction_id);
end $$;

revoke execute on all functions in schema app from public, anon, authenticated;
