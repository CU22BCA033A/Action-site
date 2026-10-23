-- 0004_lots_and_stats.sql
-- Lot numbers per auction, auction-wide totals in the snapshot, and the
-- statistics used by the public stats page.

alter table app.auction_players add column if not exists lot_no int;

with numbered as (
  select id, row_number() over (partition by auction_id order by queue_position, created_at, id) rn
  from app.auction_players
)
update app.auction_players ap set lot_no = n.rn from numbered n where ap.id = n.id and ap.lot_no is null;

create or replace function app.assign_lot_no() returns trigger language plpgsql as $$
begin
  if new.lot_no is null then
    perform pg_advisory_xact_lock(hashtext(new.auction_id::text));
    select coalesce(max(lot_no), 0) + 1 into new.lot_no from app.auction_players where auction_id = new.auction_id;
  end if;
  return new;
end $$;
drop trigger if exists auction_players_lot_no on app.auction_players;
create trigger auction_players_lot_no before insert on app.auction_players
  for each row execute function app.assign_lot_no();

alter table app.auction_players alter column lot_no set not null;
create unique index if not exists auction_players_lot_unique on app.auction_players(auction_id, lot_no);

-- Snapshot v2: adds lot numbers, totals and a ranked team order.
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
        'auctionPlayerId', ap.id, 'lotNo', ap.lot_no, 'basePrice', ap.base_price, 'setName', ap.set_name, 'status', ap.status,
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
    'totals', (
      select jsonb_build_object(
        'purseTotal', coalesce(sum(t.purse_total), 0)::int,
        'spent', coalesce(sum(t.purse_spent), 0)::int,
        'remaining', coalesce(sum(t.purse_total - t.purse_spent), 0)::int)
      from app.teams t where t.auction_id = p_auction_id and t.deleted_at is null),
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
        select jsonb_build_object('auctionPlayerId', ap.id, 'lotNo', ap.lot_no, 'playerId', p.id, 'fullName', p.full_name,
          'photoPath', p.photo_path, 'roleKey', p.role_key, 'subRole', p.sub_role, 'category', p.category,
          'nationalityGroup', p.nationality_group, 'setName', ap.set_name, 'basePrice', ap.base_price) x
        from app.auction_players ap join app.players p on p.id = ap.player_id
        where ap.auction_id = p_auction_id and ap.status = 'pool' and p.deleted_at is null
          and app.player_is_public(p.date_of_birth, p.guardian_consent)
        order by ap.set_order, ap.queue_position, p.full_name limit 12) q), '[]'::jsonb),
    'recentSales', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('auctionPlayerId', ap.id, 'lotNo', ap.lot_no, 'playerId', p.id, 'fullName', p.full_name,
          'photoPath', p.photo_path, 'roleKey', p.role_key, 'teamId', ap.sold_to_team_id, 'price', ap.sold_price,
          'soldAt', ap.sold_at, 'status', ap.status) x
        from app.auction_players ap join app.players p on p.id = ap.player_id
        where ap.auction_id = p_auction_id and ap.status = 'sold'
        order by ap.sold_at desc nulls last limit 12) q), '[]'::jsonb),
    'serverTime', clock_timestamp());
  return v;
end $$;

-- Statistics for the public stats page. Sold players only (not retentions).
create or replace function app.auction_stats(p_auction_id uuid) returns jsonb
language sql stable as $$
  with sold as (
    select ap.id, ap.lot_no, ap.sold_price, ap.sold_to_team_id, p.id as player_id, p.full_name, p.photo_path, p.role_key,
      p.sub_role, coalesce(p.category, '') as category
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.auction_id = p_auction_id and ap.status = 'sold' and p.deleted_at is null
  )
  select jsonb_build_object(
    'soldCount', (select count(*) from sold),
    'totalSpent', (select coalesce(sum(sold_price), 0)::int from sold),
    'averagePrice', (select coalesce(round(avg(sold_price)), 0)::int from sold),
    'highestPrice', (select coalesce(max(sold_price), 0)::int from sold),
    'topPlayers', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('auctionPlayerId', id, 'lotNo', lot_no, 'playerId', player_id, 'fullName', full_name,
          'photoPath', photo_path, 'roleKey', role_key, 'subRole', sub_role, 'category', nullif(category, ''),
          'teamId', sold_to_team_id, 'price', sold_price) x
        from sold order by sold_price desc, full_name limit 10) q), '[]'::jsonb),
    'byCategory', coalesce((select jsonb_agg(jsonb_build_object('key', category, 'spent', spent, 'players', n) order by spent desc)
        from (select category, sum(sold_price)::int spent, count(*)::int n from sold where category <> '' group by category) c), '[]'::jsonb),
    'byRole', coalesce((select jsonb_agg(jsonb_build_object('key', role_key, 'spent', spent, 'players', n) order by spent desc)
        from (select role_key, sum(sold_price)::int spent, count(*)::int n from sold group by role_key) r), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('teamId', t.id, 'players', coalesce(s.n, 0), 'spent', t.purse_spent,
          'average', case when coalesce(s.n, 0) = 0 then 0 else round(t.purse_spent::numeric / s.n)::int end,
          'remaining', t.purse_total - t.purse_spent) order by t.purse_spent desc, t.name)
        from app.teams t
        left join (select sold_to_team_id, count(*)::int n from app.auction_players
                   where auction_id = p_auction_id and status in ('sold','retained') group by sold_to_team_id) s on s.sold_to_team_id = t.id
        where t.auction_id = p_auction_id and t.deleted_at is null), '[]'::jsonb)
  );
$$;

revoke execute on all functions in schema app from public, anon, authenticated;
