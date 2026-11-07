-- (07/11/2026, regola dell'utente) LE STATISTICHE SI FANNO CON I DATI CHE IL TECNICO SCRIVE NEL VERBALE.
-- La «Dimensione dell'impresa» delle statistiche per la Commissione usava i dipendenti dell'anagrafica
-- (imprese.numero_addetti): «quel dato non si può mai usare perché non lo sappiamo mai per certo».
-- Tolti la classe per addetti, la chiave 'dimensione' del risultato e la lettura di `imprese`.
-- Tutto il resto è identico alla versione del 20/10/2026 (2026_10_20c_dash_commissione.sql).
create or replace function public.dash_commissione_calcolo(p_da date default null::date, p_a date default null::date)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with vis as materialized (select public.solo_proprie() s, public.mio_tecnico_id() me, public.cantieri_extra_miei() cx),
  v0 as materialized (
    select v.visita_id, v.cantiere_id, v.tipo_accesso,
           coalesce(v.ipc in ('MEDIO','ALTO'), false) as rischio
    from visite v cross join vis
    where (select public.is_personale()) and v.elimina is distinct from 1
      and (not vis.s or v.tecnico_id = vis.me or v.tecnico2_id = vis.me or v.cantiere_id = any(vis.cx))
      and (p_da is null or v.data_visita >= p_da) and (p_a is null or v.data_visita <= p_a)
  ),
  ck as materialized (
    select c.visita_id, bool_or(c.valore in ('NC-','NC+')) nc, bool_or(c.valore = 'NC+') ncg
    from visite_checklist c join v0 using (visita_id) group by c.visita_id
  ),
  pr as materialized (
    select distinct on (p.visita_id) p.visita_id, p.impresa_id, p.ruolo
    from visite_imprese_presenti p join v0 using (visita_id)
    where p.is_principale order by p.visita_id, p.ordine nulls last, p.id
  ),
  b as materialized (
    select v0.*, coalesce(ck.nc, false) nc, coalesce(ck.ncg, false) ncg,
           v0.tipo_accesso in (2, 8, 11) as serv,
           case co.committente_tipo::text when '1' then 'pubblico' when '2' then 'privato' else 'non_indicato' end as ct,
           pr.impresa_id, coalesce(nullif(trim(pr.ruolo), ''), 'non indicato') ruolo,
           exists (select 1 from visite_imprese_presenti s where s.visita_id = v0.visita_id and s.ruolo = 'subappaltatrice') as con_sub,
           coalesce(ci.cod_attuale, ci.cod, ca.cantiere_comune_cod) as comune_cod,
           ci.prov, coalesce(ci.nome, ca.comune_nome) as comune_nome
    from v0
    left join ck using (visita_id)
    left join pr using (visita_id)
    left join cantieri ca on ca.cantiere_id = v0.cantiere_id
    left join committenti co on co.committente_id = ca.cantiere_committente_id
    left join comuni_istat ci on ci.cod = ca.cantiere_comune_cod
  ),
  cas as materialized (
    select x.visita_id, x.impresa_id, x.is_principale, x.categoria, x.da_foto, x.alla_data_visita
    from v_visite_cassa x join v0 using (visita_id)
  ),
  bc as (
    select b.*, coalesce(c.categoria, 'non_ceiv') cat, c.da_foto, c.alla_data_visita
    from b left join lateral (select * from cas where cas.visita_id = b.visita_id and cas.impresa_id = b.impresa_id and cas.is_principale limit 1) c on true
  ),
  ar as (
    select bc.*, coalesce(a.area_id, case when bc.prov is distinct from 'PD' then 'fuori' else 'non_assegnato' end) area_id
    from bc left join aree_territorio_comuni a on a.comune_cod = bc.comune_cod
  )
  select jsonb_build_object(
    'visite',   (select count(*) from b),
    'con_nc',   (select count(*) from b where nc),
    'con_ncg',  (select count(*) from b where ncg),
    'rischio',  (select count(*) from b where rischio),
    'cassa_foto', jsonb_build_object(
        'alla_data_visita', (select count(*) from bc where impresa_id is not null and alla_data_visita),
        'stato_attuale',    (select count(*) from bc where impresa_id is not null and da_foto and not alla_data_visita),
        'senza_foto',       (select count(*) from bc where impresa_id is not null and not coalesce(da_foto, false)),
        'senza_principale', (select count(*) from bc where impresa_id is null)),
    'committente', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select ct, serv, count(*) visite, count(*) filter (where nc) nc, count(*) filter (where rischio) rischio
        from b group by ct, serv) x),
    'ruolo', (select coalesce(jsonb_agg(x order by x.visite desc), '[]'::jsonb) from (
        select ruolo, count(*) visite, count(*) filter (where nc) nc, count(*) filter (where ncg) ncg, count(*) filter (where rischio) rischio
        from b where impresa_id is not null group by ruolo) x),
    'subappalto', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select con_sub, count(*) visite, count(*) filter (where nc) nc from b group by con_sub) x),
    'ceiv', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select g, ceiv, count(distinct impresa_id) imprese, count(*) visite from (
          select case when serv then 'servizi' else 'altre' end g, cat in ('attiva','sospesa') ceiv, impresa_id from bc where impresa_id is not null
          union all select 'serie',      cat in ('attiva','sospesa'), impresa_id from bc where impresa_id is not null and tipo_accesso = 8
          union all select 'richiesta',  cat in ('attiva','sospesa'), impresa_id from bc where impresa_id is not null and tipo_accesso = 2
          union all select 'consulenze', cat in ('attiva','sospesa'), impresa_id from bc where impresa_id is not null and tipo_accesso = 11
          union all select 'tutte',      cat in ('attiva','sospesa'), impresa_id from bc where impresa_id is not null
        ) z group by g, ceiv) x),
    'aree', (select coalesce(jsonb_agg(x order by x.ordine), '[]'::jsonb) from (
        select t.area_id, t.nome, t.descrizione, t.ordine,
               (select count(*) from aree_territorio_comuni c where c.area_id = t.area_id) comuni_area,
               count(ar.visita_id) visite, count(distinct ar.cantiere_id) cantieri, count(distinct ar.comune_cod) comuni_toccati,
               count(ar.visita_id) filter (where ar.nc) nc, count(ar.visita_id) filter (where ar.rischio) rischio,
               null::jsonb comuni_nomi
        from aree_territorio t left join ar on ar.area_id = t.area_id
        group by t.area_id, t.nome, t.descrizione, t.ordine
        union all
        select k.area_id, case k.area_id when 'fuori' then 'Fuori provincia' else 'Comune non assegnato a un''area' end, null,
               case k.area_id when 'fuori' then 90 else 91 end, null,
               count(*), count(distinct cantiere_id), count(distinct comune_cod),
               count(*) filter (where nc), count(*) filter (where rischio),
               to_jsonb(array_agg(distinct coalesce(comune_nome, 'comune non indicato')))
        from ar k where k.area_id in ('fuori', 'non_assegnato') group by k.area_id) x),
    'sospese', jsonb_build_object(
        'principali_visite',  (select count(distinct visita_id) from cas where is_principale and categoria = 'sospesa'),
        'principali_imprese', (select count(distinct impresa_id) from cas where is_principale and categoria = 'sospesa'),
        'tutte_visite',       (select count(distinct visita_id) from cas where categoria = 'sospesa'),
        'tutte_imprese',      (select count(distinct impresa_id) from cas where categoria = 'sospesa'))
  );
$function$;
