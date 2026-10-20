-- Statistiche «Per la Commissione» (20/10/2026, chiesto dall'utente dopo la seduta della Commissione
-- Salute e Sicurezza del 20/10). Riferimento per contenuti, definizioni e numeri:
-- 2_AREE/Commissione_Sicurezza/materiale_riunioni/2026_10_20_REL_Commissione-Sicurezza_statistiche-richieste.
--
-- Definizioni (le stesse del documento):
--  · una visita conta una volta; escluse le eliminate; periodo sulla data della visita;
--  · visita con NC = almeno una voce NC- o NC+ in visite_checklist; NC grave = almeno una NC+;
--  · rischio = visite.ipc MEDIO o ALTO;
--  · impresa di riferimento = impresa principale (visite_imprese_presenti.is_principale);
--  · dimensione = imprese.numero_addetti di oggi: vuoto = non noto, 0-4 = «da 1 a 4» (scelta del documento);
--  · servizi su richiesta = tipo_accesso 2 (su richiesta), 8 (in serie), 11 (consulenza con attestazione);
--  · C.E.I.V. = attiva o sospesa nella FOTO del verbale (v_visite_cassa), non imprese.stato_cassa.
-- Solo totali: niente nomi di imprese, niente dati per tecnico. Stessa visibilità di dash_questionari.

-- ── Aree del territorio: si cambiano qui, non nel codice ──
create table if not exists public.aree_territorio (
  area_id     text primary key,
  nome        text not null,
  descrizione text,
  ordine      smallint not null
);
create table if not exists public.aree_territorio_comuni (
  comune_cod  text primary key,             -- codice ISTAT del comune attuale (comuni_istat.cod)
  area_id     text not null references public.aree_territorio(area_id) on update cascade
);
comment on table public.aree_territorio is 'Aree geografiche della provincia per le statistiche della Commissione (20/10/2026): proposta della segreteria, modificabile. Indipendenti dalle zone dei tecnici.';
comment on table public.aree_territorio_comuni is 'Un comune ISTAT della provincia di Padova → una sola area. Un comune che non c''è finisce in «non assegnato» e la scheda lo dice.';

alter table public.aree_territorio enable row level security;
alter table public.aree_territorio_comuni enable row level security;
drop policy if exists aree_territorio_sel on public.aree_territorio;
drop policy if exists aree_territorio_sgr on public.aree_territorio;
drop policy if exists aree_territorio_comuni_sel on public.aree_territorio_comuni;
drop policy if exists aree_territorio_comuni_sgr on public.aree_territorio_comuni;
create policy aree_territorio_sel on public.aree_territorio for select to authenticated using ((select public.is_personale()));
create policy aree_territorio_sgr on public.aree_territorio for all to authenticated using ((select public.is_segreteria())) with check ((select public.is_segreteria()));
create policy aree_territorio_comuni_sel on public.aree_territorio_comuni for select to authenticated using ((select public.is_personale()));
create policy aree_territorio_comuni_sgr on public.aree_territorio_comuni for all to authenticated using ((select public.is_segreteria())) with check ((select public.is_segreteria()));
revoke all on public.aree_territorio, public.aree_territorio_comuni from anon;

insert into public.aree_territorio (area_id, nome, descrizione, ordine) values
  ('padova',    'Padova città',           null,                                              1),
  ('cintura',   'Cintura urbana',         null,                                              2),
  ('alta',      'Alta Padovana',          'Cittadellese e Camposampierese',                  3),
  ('bassa',     'Bassa Padovana',         'Estense, Montagnanese, Monselicense',             4),
  ('saccisica', 'Saccisica e Conselvano', null,                                              5),
  ('colli',     'Colli Euganei e Terme',  null,                                              6)
on conflict (area_id) do nothing;

with elenco(area_id, nome) as (values
  ('padova','Padova'),
  ('cintura','Albignasego'),('cintura','Cadoneghe'),('cintura','Casalserugo'),('cintura','Limena'),('cintura','Maserà di Padova'),
  ('cintura','Mestrino'),('cintura','Noventa Padovana'),('cintura','Ponte San Nicolò'),('cintura','Rubano'),('cintura','Saccolongo'),
  ('cintura','Saonara'),('cintura','Selvazzano Dentro'),('cintura','Veggiano'),('cintura','Vigodarzere'),('cintura','Vigonza'),
  ('cintura','Villafranca Padovana'),
  ('alta','Borgoricco'),('alta','Campo San Martino'),('alta','Campodarsego'),('alta','Campodoro'),('alta','Camposampiero'),
  ('alta','Carmignano di Brenta'),('alta','Cittadella'),('alta','Curtarolo'),('alta','Fontaniva'),('alta','Galliera Veneta'),
  ('alta','Gazzo'),('alta','Grantorto'),('alta','Loreggia'),('alta','Massanzago'),('alta','Piazzola sul Brenta'),
  ('alta','Piombino Dese'),('alta','San Giorgio delle Pertiche'),('alta','San Giorgio in Bosco'),('alta','San Martino di Lupari'),
  ('alta','San Pietro in Gu'),('alta','Santa Giustina in Colle'),('alta','Tombolo'),('alta','Trebaseleghe'),('alta','Villa del Conte'),
  ('alta','Villanova di Camposampiero'),
  ('saccisica','Agna'),('saccisica','Anguillara Veneta'),('saccisica','Arre'),('saccisica','Arzergrande'),('saccisica','Bagnoli di Sopra'),
  ('saccisica','Bovolenta'),('saccisica','Brugine'),('saccisica','Candiana'),('saccisica','Cartura'),('saccisica','Codevigo'),
  ('saccisica','Conselve'),('saccisica','Correzzola'),('saccisica','Legnaro'),('saccisica','Piove di Sacco'),('saccisica','Polverara'),
  ('saccisica','Pontelongo'),('saccisica','Sant''Angelo di Piove di Sacco'),('saccisica','Terrassa Padovana'),('saccisica','Tribano'),
  ('colli','Abano Terme'),('colli','Arquà Petrarca'),('colli','Baone'),('colli','Battaglia Terme'),('colli','Cervarese Santa Croce'),
  ('colli','Cinto Euganeo'),('colli','Due Carrare'),('colli','Galzignano Terme'),('colli','Lozzo Atestino'),('colli','Montegrotto Terme'),
  ('colli','Rovolon'),('colli','Teolo'),('colli','Torreglia'),('colli','Vo'''),
  ('bassa','Barbona'),('bassa','Boara Pisani'),('bassa','Borgo Veneto'),('bassa','Casale di Scodosia'),('bassa','Castelbaldo'),
  ('bassa','Este'),('bassa','Granze'),('bassa','Masi'),('bassa','Megliadino San Vitale'),('bassa','Merlara'),('bassa','Monselice'),
  ('bassa','Montagnana'),('bassa','Ospedaletto Euganeo'),('bassa','Pernumia'),('bassa','Piacenza d''Adige'),('bassa','Ponso'),
  ('bassa','Pozzonovo'),('bassa','San Pietro Viminario'),('bassa','Sant''Elena'),('bassa','Sant''Urbano'),('bassa','Santa Caterina d''Este'),
  ('bassa','Solesino'),('bassa','Stanghella'),('bassa','Urbana'),('bassa','Vescovana'),('bassa','Villa Estense'))
insert into public.aree_territorio_comuni (comune_cod, area_id)
select c.cod, e.area_id from elenco e join public.comuni_istat c on c.nome = e.nome and c.prov = 'PD' and c.soppresso_il is null
on conflict (comune_cod) do nothing;

do $$ declare n int; m int; begin
  select count(*) into n from public.aree_territorio_comuni;
  select count(*) into m from public.comuni_istat where prov = 'PD' and soppresso_il is null;
  if n <> 101 or m <> 101 then raise exception 'aree_territorio_comuni: % comuni abbinati su % comuni ISTAT (attesi 101)', n, m; end if;
end $$;

-- ── La funzione ──
-- Il calcolo sta in una funzione interna, non eseguibile da fuori; quella pubblica controlla prima chi chiede:
-- a chi non e' personale risponde con un ERRORE, non con zeri, cosi' la scheda dice «non sono riuscito a leggere».
create or replace function public.dash_commissione_calcolo(p_da date default null, p_a date default null)
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
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
  pr as materialized (   -- l'impresa principale (una per visita; se per errore fossero due, la prima per ordine)
    select distinct on (p.visita_id) p.visita_id, p.impresa_id, p.ruolo
    from visite_imprese_presenti p join v0 using (visita_id)
    where p.is_principale order by p.visita_id, p.ordine nulls last, p.id
  ),
  b as materialized (
    select v0.*, coalesce(ck.nc, false) nc, coalesce(ck.ncg, false) ncg,
           v0.tipo_accesso in (2, 8, 11) as serv,
           case co.committente_tipo::text when '1' then 'pubblico' when '2' then 'privato' else 'non_indicato' end as ct,
           pr.impresa_id, coalesce(nullif(trim(pr.ruolo), ''), 'non indicato') ruolo,
           case when pr.impresa_id is null or i.numero_addetti is null then 'nn'
                when i.numero_addetti < 5 then '1-4' when i.numero_addetti < 10 then '5-9'
                when i.numero_addetti < 50 then '10-49' else '50+' end as classe,
           exists (select 1 from visite_imprese_presenti s where s.visita_id = v0.visita_id and s.ruolo = 'subappaltatrice') as con_sub,
           coalesce(ci.cod_attuale, ci.cod, ca.cantiere_comune_cod) as comune_cod,
           ci.prov, coalesce(ci.nome, ca.comune_nome) as comune_nome
    from v0
    left join ck using (visita_id)
    left join pr using (visita_id)
    left join imprese i on i.impresa_id = pr.impresa_id
    left join cantieri ca on ca.cantiere_id = v0.cantiere_id
    left join committenti co on co.committente_id = ca.cantiere_committente_id
    left join comuni_istat ci on ci.cod = ca.cantiere_comune_cod
  ),
  cas as materialized (   -- stato in Cassa dalla foto del verbale, per tutte le imprese presenti
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
    'dimensione', (select coalesce(jsonb_agg(x order by x.ordine), '[]'::jsonb) from (
        select classe, case classe when '1-4' then 1 when '5-9' then 2 when '10-49' then 3 when '50+' then 4 else 5 end ordine,
               count(*) visite, count(*) filter (where nc) nc, count(*) filter (where ncg) ncg, count(*) filter (where rischio) rischio,
               count(*) filter (where ct = 'privato') priv_visite, count(*) filter (where ct = 'privato' and nc) priv_nc,
               count(*) filter (where ct = 'pubblico') pub_visite, count(*) filter (where ct = 'pubblico' and nc) pub_nc
        from b group by classe) x),
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
$$;

revoke all on function public.dash_commissione_calcolo(date, date) from public, anon, authenticated;

create or replace function public.dash_commissione(p_da date default null, p_a date default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_personale(), false) then
    raise exception 'dash_commissione: non autorizzato' using errcode = '42501';
  end if;
  return public.dash_commissione_calcolo(p_da, p_a);
end $$;

comment on function public.dash_commissione(date, date) is 'Statistiche per la Commissione Salute e Sicurezza (20/10/2026): solo totali, sul periodo per data della visita. Nessun dato per impresa o per tecnico.';
revoke all on function public.dash_commissione(date, date) from public, anon;
grant execute on function public.dash_commissione(date, date) to authenticated;
