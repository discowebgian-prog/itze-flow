-- Comprobar mejoras_nov.sql. Solo lee; no cambia nada.
select 'tabla flow_vistos' as que, to_regclass('public.flow_vistos') is not null as ok
union all select 'reservas.checkout_original', exists (select 1 from information_schema.columns where table_name = 'reservas' and column_name = 'checkout_original')
union all select 'reservas.extendida_noches', exists (select 1 from information_schema.columns where table_name = 'reservas' and column_name = 'extendida_noches')
union all select 'tabla competencia', to_regclass('public.competencia') is not null
union all select 'tabla eventos_fuentes', to_regclass('public.eventos_fuentes') is not null
union all select 'función eventos_contexto', exists (select 1 from pg_proc where proname = 'eventos_contexto')
union all select 'RLS en las 3 tablas', (select bool_and(relrowsecurity) from pg_class where oid in ('public.flow_vistos'::regclass, 'public.competencia'::regclass, 'public.eventos_fuentes'::regclass));
