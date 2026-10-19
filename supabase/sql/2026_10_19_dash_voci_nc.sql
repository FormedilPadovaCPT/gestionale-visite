-- Statistiche: le voci della check-list con più inadempienze (19/10/2026, chiesto dall'utente).
-- Gemella di dash_macroaree: stessi filtri (periodo, tecnico, tipo di accesso, IPC), stessa
-- visibilità (chi vede solo le proprie visite conta solo quelle), stessa esclusione delle
-- visite eliminate. Per ogni voce: NC+, NC− e in quante visite è stata rilevata almeno una volta.
create or replace function public.dash_voci_nc(
  p_da date default null, p_a date default null, p_tecnico text default null,
  p_tipo integer default null, p_ipc text default null, p_limite integer default 10)
returns table(codice text, descrizione text, zona integer, nc_plus bigint, nc_minus bigint, visite bigint)
language sql stable security definer
set search_path to 'public'
as $$
  with vis as materialized (select public.solo_proprie() s, public.mio_tecnico_id() me, public.cantieri_extra_miei() cx)
  select cv.codice::text, cv.descrizione::text, cv.zona_osserv::int,
    count(*) filter (where vc.valore = 'NC+') as nc_plus,
    count(*) filter (where vc.valore = 'NC-') as nc_minus,
    count(distinct vc.visita_id) as visite
  from visite v
  join visite_checklist vc on vc.visita_id = v.visita_id and vc.valore in ('NC+', 'NC-')
  join checklist_voci cv on cv.codice = vc.codice
  cross join vis
  where (select public.is_personale()) and v.elimina is distinct from 1
    and (not vis.s or v.tecnico_id = vis.me or v.tecnico2_id = vis.me or v.cantiere_id = any(vis.cx))
    and (p_da is null or v.data_visita >= p_da)
    and (p_a is null or v.data_visita <= p_a)
    and (p_tecnico is null or v.tecnico_id::text = p_tecnico)
    and (p_tipo is null or v.tipo_accesso = p_tipo)
    and (p_ipc is null or (case when v.ipc in ('ALTO','MEDIO','BASSO') then v.ipc else 'NR' end) = p_ipc)
  group by cv.codice, cv.descrizione, cv.zona_osserv
  order by count(*) desc, count(*) filter (where vc.valore = 'NC+') desc, cv.codice
  limit greatest(1, least(coalesce(p_limite, 10), 50));
$$;

revoke all on function public.dash_voci_nc(date, date, text, integer, text, integer) from public, anon;
grant execute on function public.dash_voci_nc(date, date, text, integer, text, integer) to authenticated;
