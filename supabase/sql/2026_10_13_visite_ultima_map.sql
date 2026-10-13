-- (13/10/2026) Elenco cantieri sul telefono, raggruppato per comune (proposta C scelta dall'utente):
-- accanto al numero delle visite si mostra la data dell'ultima. Stesse regole di visibilità di
-- visite_count_map: chi vede solo le sue visite vede solo la data delle sue.
create or replace function public.visite_ultima_map()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with vis as materialized (select public.solo_proprie() s, public.mio_tecnico_id() me, public.cantieri_extra_miei() cx)
  select coalesce(jsonb_object_agg(cantiere_id, ultima),'{}'::jsonb) from (
    select v.cantiere_id, max(v.data_visita) ultima from visite v cross join vis
    where (select public.is_personale()) and coalesce(v.elimina,0)=0 and v.cantiere_id is not null and v.data_visita is not null
      and (not vis.s or v.tecnico_id = vis.me or v.tecnico2_id = vis.me or v.cantiere_id = any(vis.cx))
    group by v.cantiere_id
  ) t;
$function$;

revoke all on function public.visite_ultima_map() from public, anon;
grant execute on function public.visite_ultima_map() to authenticated, service_role;
