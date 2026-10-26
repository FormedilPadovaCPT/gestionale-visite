-- 26/10/2026 — Statistiche del gradimento: i RINGRAZIAMENTI arrivati per mail (fonte = 'mail', registrati dal
-- giro risposte-verbali, solo testo e nessun voto) si contano a parte, «ringraziamenti», e restano fuori dai
-- numeri dei questionari: un ringraziamento non è un questionario compilato. Il resto è com'era il 19/10
-- (2026_10_19_dash_questionari.sql): solo totali, mai commenti, recapiti o nomi.
create or replace function public.dash_questionari(
  p_da date default null, p_a date default null, p_tecnico text default null,
  p_tipo integer default null, p_ipc text default null)
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
  with vis as materialized (select public.solo_proprie() s, public.mio_tecnico_id() me, public.cantieri_extra_miei() cx),
  q as (
    select q.*, v.visita_id as vid, v.tecnico_id, v.tecnico2_id, v.cantiere_id, v.tipo_accesso, v.ipc as v_ipc,
           coalesce(v.data_visita, q.data_visita, (q.timestamp_modulo at time zone 'Europe/Rome')::date) as giorno
    from s_questionari_sopralluogo q
    left join visite v on v.visita_id = q.visita_id and v.elimina is distinct from 1
    where coalesce(q.stato, '') <> 'scartato'
  ),
  f as (
    select q.* from q cross join vis
    where (select public.is_personale())
      and (not vis.s or (q.vid is not null and (q.tecnico_id = vis.me or q.tecnico2_id = vis.me or q.cantiere_id = any(vis.cx))))
      and (p_da is null or q.giorno >= p_da)
      and (p_a is null or q.giorno <= p_a)
      and (p_tecnico is null or (q.vid is not null and q.tecnico_id::text = p_tecnico))
      and (p_tipo is null or (q.vid is not null and q.tipo_accesso = p_tipo))
      and (p_ipc is null or (q.vid is not null and (case when q.v_ipc in ('ALTO','MEDIO','BASSO') then q.v_ipc else 'NR' end) = p_ipc))
  ),
  visite_periodo as (
    select count(*) n from visite v cross join vis
    where (select public.is_personale()) and v.elimina is distinct from 1
      and (not vis.s or v.tecnico_id = vis.me or v.tecnico2_id = vis.me or v.cantiere_id = any(vis.cx))
      and (p_da is null or v.data_visita >= p_da) and (p_a is null or v.data_visita <= p_a)
      and (p_tecnico is null or v.tecnico_id::text = p_tecnico)
      and (p_tipo is null or v.tipo_accesso = p_tipo)
      and (p_ipc is null or (case when v.ipc in ('ALTO','MEDIO','BASSO') then v.ipc else 'NR' end) = p_ipc)
  )
  select jsonb_build_object(
    'ricevuti', (select count(*) from f where fonte is distinct from 'mail'),
    'agganciati', (select count(*) from f where vid is not null and fonte is distinct from 'mail'),
    'visite_con_questionario', (select count(distinct vid) from f where vid is not null and fonte is distinct from 'mail'),
    'ringraziamenti', (select count(*) from f where fonte = 'mail'),
    'visite_periodo', (select n from visite_periodo),
    'media', (select round(avg(utilita)::numeric, 2) from f where utilita between 1 and 5),
    'utilita', (select coalesce(jsonb_object_agg(u, n), '{}'::jsonb) from (select utilita::text u, count(*) n from f where utilita between 1 and 5 group by 1) x),
    'motivi', (select coalesce(jsonb_object_agg(m, n), '{}'::jsonb) from (
       select trim(m) m, count(*) n from f, regexp_split_to_table(coalesce(f.motivi, ''), '\s*·\s*') m where trim(m) <> '' group by 1) x),
    'azione', (select coalesce(jsonb_object_agg(a, n), '{}'::jsonb) from (select azione_dopo a, count(*) n from f where coalesce(azione_dopo, '') <> '' group by 1) x)
  );
$$;

revoke all on function public.dash_questionari(date, date, text, integer, text) from public, anon;
grant execute on function public.dash_questionari(date, date, text, integer, text) to authenticated;
