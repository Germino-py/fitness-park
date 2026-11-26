-- Relevé du catalogue (schémas, tables, colonnes, fonctions, déclencheurs, politiques, index, séquences, réglages),
-- pour vérifier que supabase/retour-arriere.sql remet la base exactement comme avant 02 (utilisé par lancer.sh).
select 'schema ' || nspname from pg_namespace where nspname not like 'pg\_%' and nspname not in ('information_schema', 'tests')
union all select 'table ' || n.nspname || '.' || c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm') and n.nspname in ('public', 'app')
union all select 'colonne ' || c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) from pg_attribute a
  join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
union all select 'fonction ' || p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app', 'auth')
union all select 'declencheur ' || tgname || ' sur ' || tgrelid::regclass::text from pg_trigger where not tgisinternal
union all select 'politique ' || polname || ' sur ' || polrelid::regclass::text from pg_policy
union all select 'index ' || indexrelid::regclass::text from pg_index i join pg_class c on c.oid = i.indrelid
  join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'app')
union all select 'sequence ' || c.oid::regclass::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'S' and n.nspname in ('public', 'app')
union all select 'reglage ' || key from public.settings
order by 1;
