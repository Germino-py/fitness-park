-- 9. Pseudos uniques (ajouté le 18/11/2026)
-- Chaque appareil peut choisir un pseudo à la place de « Machine 48213 ». Deux personnes ne peuvent pas avoir le même pseudo
-- (majuscules, accents, espaces, points et tirets ne comptent pas : « Léo_77 » et « leo77 » sont le même pseudo).
-- Rien n'est visible du public tant que tu n'actives pas « Pseudos » dans Admin → Fonctionnalités. Sans danger si on le relance.

create table if not exists public.pseudos (
  voter text primary key references public.players on delete cascade,
  pseudo text not null check (char_length(pseudo) between 3 and 20),
  pseudo_key text not null unique,
  updated_at timestamptz not null default now()
);
alter table public.pseudos enable row level security;
revoke all on public.pseudos from anon, authenticated;

-- Mots interdits (la même liste que pour les commentaires)
create table if not exists public.bad_words (w text primary key);
alter table public.bad_words enable row level security;
revoke all on public.bad_words from anon, authenticated;
insert into public.bad_words (w) values ('abruti'),('andouille'),('avorton'),('batard'),('biatch'),('bicot'),('bite'),('bitembois'),('bouffon'),('bougnoul'),('bougnoule'),('bougnoulisation'),('bougnouliser'),('boukak'),('bounioul'),('bouseux'),('branler'),('branleur'),('brise-burnes'),('cafre'),('caldoche'),('casse-bonbon'),('casse-couille'),('casse-couilles'),('chachar'),('chagasse'),('chiennasse'),('chier'),('chieur'),('chieurs'),('chinetoc'),('chinetoque'),('chintok'),('chleuh'),('chnoque'),('coche'),('con'),('conard'),('conasse'),('conchier'),('connard'),('connarde'),('connasse'),('conne'),('cons'),('couille'),('couilles'),('couillon'),('couillonner'),('counifle'),('courtaud'),('cretin'),('crevard'),('crevure'),('cricri'),('crotte'),('crouillat'),('crouille'),('crouton'),('cul'),('debile'),('deguelasse'),('demerder'),('drouille'),('du schnoc'),('ducon'),('duconnot'),('dugenoux'),('dugland'),('duschnock'),('emmanche'),('emmerder'),('emmerdeur'),('emmerdeuse'),('empafe'),('empapaoute'),('encule'),('enculer'),('enculeur'),('enflure'),('enfoire'),('envaselineur'),('epais'),('espingoin'),('etron'),('feignasse'),('fiotte'),('fouteur'),('foutre'),('fritz'),('fumier'),('garce'),('gaupe'),('gland'),('glandeur'),('glandeuse'),('glandouillou'),('glandu'),('gnoul'),('gnoule'),('gogol'),('goi'),('gouilland'),('gouine'),('gourde'),('gourgandine'),('grognasse'),('gueniche'),('guindoule'),('imbecile'),('jean-foutre'),('kikoo'),('kikou'),('lacheux'),('lavette'),('lopette'),('magot'),('makoume'),('manche'),('mange-merde'),('marchandot'),('margouilliste'),('mauviette'),('merdaille'),('merdaillon'),('merde'),('merdeux'),('merdouillard'),('michto'),('minable'),('minus'),('miserable'),('moinaille'),('moins-que-rien'),('monacaille'),('moricaud'),('nase'),('naze'),('negro'),('niac'),('niaiseux'),('niakoue'),('nique'),('niquer'),('pakos'),('panoufle'),('patarin'),('pecque'),('pedale'),('pede'),('pedoque'),('pequenaud'),('pet'),('petasse'),('peteux'),('pignouf'),('pimbeche'),('pisseux'),('pissou'),('pleutre'),('plouc'),('porcas'),('porcasse'),('poucav'),('pouf'),('pouffiasse'),('poufiasse'),('pounde'),('pourriture'),('punaise'),('putain'),('pute'),('putin'),('queutard'),('raclure'),('raton'),('ripopee'),('robespierrot'),('rosbif'),('roulure'),('sagouin'),('salaud'),('sale'),('salop'),('salopard'),('salope'),('saloperie'),('satrouille'),('schbeb'),('schleu'),('schnoc'),('schnock'),('schnoque'),('sent-la-pisse'),('sottiseux'),('sous-merde'),('stearique'),('tafiole'),('tantouserie'),('tantouze'),('tapette'),('tarlouze'),('tebe'),('teteux'),('teube'),('tocard'),('trainee'),('trouduc'),('truiasse'),('vaurien'),('vide-couilles'),('viedase'),('vier'),('xeropineur'),('yeule'),('youd'),('youpin'),('youpine'),('youpinisation'),('youtre'),('zguegue') on conflict do nothing;

-- La « clé » d'un pseudo : minuscules, sans accents, sans espaces ni ponctuation
create or replace function public.pseudo_key(p text) returns text language sql immutable as $$
  select regexp_replace(translate(lower(coalesce(p, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'), '[^a-z0-9]', '', 'g')
$$;

-- Vérifie un pseudo : 'ok', 'invalide', 'reserve', 'mot', 'pris' (ou 'toi' si c'est déjà le tien)
create or replace function public.pseudo_check(p_pseudo text, p_voter text default null) returns text
  language plpgsql stable security definer set search_path = public as $$
declare k text := pseudo_key(p_pseudo); t text := lower(coalesce(p_pseudo, '')); owner text;
begin
  if p_pseudo is null or p_pseudo !~ '^[A-Za-z0-9À-ÖØ-öø-ÿ][A-Za-z0-9À-ÖØ-öø-ÿ _.-]{1,18}[A-Za-z0-9À-ÖØ-öø-ÿ]$'
     or p_pseudo ~ '[ _.-]{2}' or char_length(k) < 3 then return 'invalide'; end if;
  if not is_admin() and (k ~ '^machine[0-9]*$' or k ~ '(admin|moderat|hmg|fitnesspark|anonyme)' or k in ('mino', 'toi', 'moi', 'visiteur')) then return 'reserve'; end if;
  if exists (select 1 from bad_words b where b.w = any (regexp_split_to_array(regexp_replace(translate(t, 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '[0-9]', ' ', 'g'), '[^a-z]+'))) then
    return 'mot'; end if;
  if k ~ '(encul|connard|connass|salop|putain|pouf+ias|petasse|tarlouz|tafiol|negro|youpin|bougnoul|enfoire|fdp|ntm|tamere|nazi|hitler)' then return 'mot'; end if;
  select voter into owner from pseudos where pseudo_key = k;
  if found then return case when owner = p_voter then 'toi' else 'pris' end; end if;
  return 'ok';
end $$;

-- Enregistre (ou change) le pseudo de l'appareil. Une seule personne par pseudo.
create or replace function public.set_pseudo(p_voter text, p_no integer, p_pseudo text) returns json
  language plpgsql security definer set search_path = public as $$
declare n integer; why text; p text := btrim(regexp_replace(coalesce(p_pseudo, ''), '\s+', ' ', 'g')); last timestamptz;
begin
  if p_voter is null or p_voter !~ '^[0-9a-f]{32}$' then raise exception 'Appareil non reconnu.'; end if;
  if not (feature_on('feat_pseudo') or is_admin()) then raise exception 'Cette fonction n''est pas encore ouverte.'; end if;
  why := pseudo_check(p, p_voter);
  if why not in ('ok', 'toi') then return json_build_object('ok', false, 'why', why); end if;
  select updated_at into last from pseudos where voter = p_voter;
  if last is not null and last > now() - interval '20 seconds' and why <> 'toi' then return json_build_object('ok', false, 'why', 'vite'); end if;
  if (select count(*) from pseudos where updated_at > now() - interval '1 minute') >= 60 then
    raise exception 'Trop de monde en même temps, réessaie dans une minute.';
  end if;
  n := player_no(p_voter, p_no);
  begin
    insert into pseudos (voter, pseudo, pseudo_key) values (p_voter, p, pseudo_key(p))
      on conflict (voter) do update set pseudo = excluded.pseudo, pseudo_key = excluded.pseudo_key, updated_at = now();
  exception when unique_violation then
    return json_build_object('ok', false, 'why', 'pris');
  end;
  return json_build_object('ok', true, 'pseudo', p, 'no', n);
end $$;

-- Tous les pseudos publics : { "48213": "Léo", ... } pour les afficher sur les avis et le classement
create or replace function public.pseudo_list() returns json
  language sql stable security definer set search_path = public as $$
  select case when feature_on('feat_pseudo') or is_admin()
    then coalesce((select json_object_agg(p.visitor_no::text, s.pseudo) from pseudos s join players p using (voter)), '{}'::json)
    else '{}'::json end
$$;

-- Le pseudo de cet appareil (pour le retrouver après avoir vidé un cache de page)
create or replace function public.my_pseudo(p_voter text) returns json
  language sql stable security definer set search_path = public as $$
  select coalesce((select json_build_object('pseudo', s.pseudo, 'no', p.visitor_no) from pseudos s join players p using (voter) where s.voter = p_voter), '{}'::json)
$$;

revoke all on function public.pseudo_check(text, text) from public;
revoke all on function public.set_pseudo(text, integer, text) from public;
revoke all on function public.pseudo_list() from public;
revoke all on function public.my_pseudo(text) from public;
grant execute on function public.pseudo_check(text, text) to anon, authenticated;
grant execute on function public.set_pseudo(text, integer, text) to anon, authenticated;
grant execute on function public.pseudo_list() to anon, authenticated;
grant execute on function public.my_pseudo(text) to anon, authenticated;

notify pgrst, 'reload schema';
