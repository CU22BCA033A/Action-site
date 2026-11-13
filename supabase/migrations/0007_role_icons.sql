-- Role icons are data on each role in app.sports.config ("icon": "bat" | "ball" |
-- "all_rounder" | "gloves"). Give the built-in cricket roles their icons when the
-- admin has not chosen one. Roles the admin renamed keep their key, so this
-- matches by key; any other role is left as it is.
update app.sports s
set config = jsonb_set(s.config, '{roles}', (
  select jsonb_agg(
    case
      when r ? 'icon' then r
      when r ->> 'key' = 'batter' then r || '{"icon":"bat"}'
      when r ->> 'key' = 'bowler' then r || '{"icon":"ball"}'
      when r ->> 'key' = 'all_rounder' then r || '{"icon":"all_rounder"}'
      when r ->> 'key' = 'wicketkeeper' then r || '{"icon":"gloves"}'
      else r
    end order by ord)
  from jsonb_array_elements(s.config -> 'roles') with ordinality as e(r, ord)
))
where s.key = 'cricket' and jsonb_typeof(s.config -> 'roles') = 'array';
