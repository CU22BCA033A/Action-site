-- A player cannot be marked unsold while the bid timer still has time left.
-- Owners may still be about to bid, so the floor waits for the timer to run
-- out (or for the admin to switch the timer off). Auctions without a timer
-- are unchanged: the admin decides when nobody is going to bid.

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
  if (f.phase = 'live' and f.timer_ends_at is not null and f.timer_ends_at > clock_timestamp())
     or (f.phase = 'paused' and coalesce(f.paused_remaining_ms, 0) > 0) then
    return app._result(false, 'TIMER_RUNNING', 'The timer has not run out yet. Wait for it to finish before marking the player unsold.', p_auction_id);
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
