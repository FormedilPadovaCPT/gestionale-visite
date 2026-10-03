-- 03/10/2026 — IMPRESE VISITATE SENZA CODICE FISCALE: l'elenco per la segreteria.
-- Chiesto dall'utente: il codice fiscale dell'impresa resta facoltativo nel verbale, ma la
-- segreteria vuole vedere quali imprese ne sono prive per sistemarle a mano.
-- Solo le imprese che compaiono in almeno un verbale (466 su 11.160 senza CF al 03/10/2026):
-- le altre vengono dalle importazioni e non entrano nell'Osservatorio.
-- security invoker: legge quello che la RLS concede a chi chiama (il personale).

create or replace function public.imprese_senza_cf()
returns table (
  impresa_id text,
  impresa_nome text,
  piva text,
  tipo_impresa text,
  comune text,
  n_visite bigint,
  ultima_visita date
)
language sql
stable
security invoker
set search_path = public
as $fn$
  select i.impresa_id, i.impresa_nome, i.piva, i.tipo_impresa, i.comune,
         count(distinct v.visita_id) as n_visite, max(v.data_visita) as ultima_visita
    from public.imprese i
    join public.visite_imprese_presenti p on p.impresa_id = i.impresa_id
    join public.visite v on v.visita_id = p.visita_id and coalesce(v.elimina,0) = 0
   where coalesce(i.elimina,0) = 0
     and coalesce(trim(i.impresa_cf),'') = ''
   group by i.impresa_id, i.impresa_nome, i.piva, i.tipo_impresa, i.comune
   order by max(v.data_visita) desc, i.impresa_nome
$fn$;

revoke execute on function public.imprese_senza_cf() from public, anon;
grant execute on function public.imprese_senza_cf() to authenticated, service_role;
