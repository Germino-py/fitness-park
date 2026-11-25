-- =====================================================================================================
-- HMG Fitness · 01 · Correctifs de sécurité « phase 0 » (4-backend.md §1.3 et annexe A §0)
-- À coller dans Supabase → SQL Editor → Run. Transactionnel, rejouable, ne change rien pour les visiteurs.
-- =====================================================================================================
begin;

-- 0.1 (faille F6) Avis : la date est imposée par le serveur. Avant, un client pouvait envoyer created_at = 2020
--     (l'anti-flood reviews_flood ne le comptait plus) ou 2099 (avis épinglé en tête de liste pour toujours).
--     Les pouces repartent toujours de 0 (comme avant).
create or replace function public.reviews_zero_votes() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.up := 0; new.down := 0;
  if not public.is_admin() then new.created_at := now(); end if;
  return new;
end $$;

-- 0.2 (faille F10) Fonctions de déclencheur : pas appelables par l'API ; search_path figé
--     (avertissements du conseiller Supabase). Les déclencheurs continuent de marcher sans ce droit.
revoke all on function public.reviews_flood() from public, anon, authenticated;
revoke all on function public.reviews_zero_votes() from public, anon, authenticated;
alter function public.pseudo_key(text) set search_path = public;

-- 0.3 (faille F7, À LA MAIN, après avoir récupéré le fichier qui s'y trouve) : le seau « transfert » est public,
--     50 Mo, tout type de fichier, et une règle laisse n'importe qui y déposer. Quand il ne sert plus :
--       drop policy if exists "transfert_tmp_insert" on storage.objects;
--     puis Storage → transfert → Delete bucket.
-- 0.4 (À LA MAIN) Authentication → Attack Protection → « Leaked password protection » : ON (compte admin).

notify pgrst, 'reload schema';
commit;
