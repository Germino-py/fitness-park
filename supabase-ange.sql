-- 10. Ange de la semaine (ajouté le 19/11/2026, déjà installé)
-- Nombre de séances validées la semaine précédente (lundi → dimanche, heure de Paris).
create or replace function public.prev_week(p_voter text) returns json
  language plpgsql stable security definer set search_path = public as $$
declare lundi date := date_trunc('week', (now() at time zone 'Europe/Paris'))::date; n integer;
begin
  if p_voter is null or p_voter !~ '^[0-9a-f]{32}$' then raise exception 'Appareil non reconnu.'; end if;
  if not (feature_on('feat_angel') or is_admin()) then return json_build_object('n', 0, 'week', to_char(lundi, 'IYYY-IW')); end if;
  select count(*) into n from checkins where voter = p_voter and day >= lundi - 7 and day < lundi;
  return json_build_object('n', n, 'week', to_char(lundi, 'IYYY-IW'));
end $$;
revoke all on function public.prev_week(text) from public;
grant execute on function public.prev_week(text) to anon, authenticated;
notify pgrst, 'reload schema';
