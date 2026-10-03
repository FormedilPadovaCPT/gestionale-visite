-- 03/10/2026 — ESPORTAZIONE PER L'OSSERVATORIO SENZA VALORI DI RIPIEGO (fase 4 del piano
-- «campi obbligatori dell'Osservatorio», manutenzione/2026_10_03_REL_…analisi-e-piano.md).
--
-- Fino a oggi osservatorio.js, dove mancava un dato obbligatorio, metteva un valore di
-- ripiego (ruolo → 2, tipo di intervento → 8, opera → 16, importo → 11, durata → 7,
-- tipo del committente → 3) e lo diceva nel riepilogo, a file già scaricati.
-- Da oggi: una visita a cui manca un dato obbligatorio per l'Osservatorio NON ESCE,
-- e lo si vede prima, tutto l'anno, nella tessera «Pronti per l'Osservatorio».
--
-- osservatorio_controllo(dal, al, dettaglio) è l'UNICA definizione di «visita pronta per
-- l'Osservatorio». NON è verbale_mancanze: quella vale per i verbali che si chiudono
-- nell'app dal 03/10/2026 e chiede anche i dati dell'ufficio (ora di fine, persona presente,
-- committente, lavorazioni…), che i 3.254 verbali importati non hanno e non avranno.
-- Qui ci sono solo gli obbligatori del manuale operativo dell'Osservatorio.
--
-- Due livelli:
--   blocca = true   il dato manca o non è fra i valori ammessi: la visita non si esporta;
--   blocca = false  il dato c'è ed è ammesso, ma è un «Non disponibile» o un «Altro» senza
--                   descrizione: la visita si esporta, e l'elenco lo dichiara.
--
-- Restituisce un solo jsonb (niente limite di 1000 righe di PostgREST):
--   { definitive, pronte, ferme, con_avvisi, non_definitive,
--     motivi:   [{cosa, dove, blocca, testo, visite, cantieri}],
--     cantieri: [{cantiere_id, cantiere, comune, visite, blocchi[], avvisi[]}]   solo con problemi
--     visite:   [{visita_id, nr_verbale, data, tecnico, impresa, cantiere_id, blocchi[]}]  solo le ferme }
-- Con dettaglio = false gli elenchi «cantieri» e «visite» restano vuoti (tessera).

create or replace function public.osservatorio_controllo(p_dal date, p_al date, p_dettaglio boolean default true)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with regole(cosa, dove, blocca, ordine, testo) as (values
  ('impresa',             'visita',   true,  1, 'Impresa principale mancante o non più in anagrafica'),
  ('ruolo',               'visita',   true,  2, 'Ruolo dell''impresa principale non indicato (affidataria, esecutrice…)'),
  ('tipo-visita',         'visita',   true,  3, 'Tipologia di accesso non indicata'),
  ('checklist',           'visita',   true,  4, 'Check-list senza nessuna voce valutata'),
  ('tecnico',             'visita',   true,  5, 'Tecnico mancante o non più in anagrafica'),
  ('cantiere',            'visita',   true,  6, 'Cantiere mancante o non più in archivio'),
  ('cantiere-indirizzo',  'cantiere', true, 10, 'Scheda del cantiere: indirizzo mancante'),
  ('cantiere-civico',     'cantiere', true, 11, 'Scheda del cantiere: civico mancante (se non c''è si sceglie «SNC»)'),
  ('cantiere-comune',     'cantiere', true, 12, 'Scheda del cantiere: comune senza codice ISTAT'),
  ('cantiere-intervento', 'cantiere', true, 13, 'Scheda del cantiere: tipo di intervento da indicare (costruzione, ristrutturazione, demolizione, ampliamento: «Altro» non è ammesso)'),
  ('cantiere-opera',      'cantiere', true, 14, 'Scheda del cantiere: tipo di opera da indicare'),
  ('cantiere-importo',    'cantiere', true, 15, 'Scheda del cantiere: importo dei lavori da indicare'),
  ('cantiere-durata',     'cantiere', true, 16, 'Scheda del cantiere: durata dei lavori da indicare'),
  ('committente',         'cantiere', true, 17, 'Scheda del cantiere: il committente collegato non è più in anagrafica'),
  ('committente-tipo',    'cantiere', true, 18, 'Committente senza l''indicazione pubblico o privato'),
  ('importo-nd',          'cantiere', false, 30, 'Importo dei lavori «Non disponibile» (ammesso: se si può, si stima)'),
  ('durata-nd',           'cantiere', false, 31, 'Durata dei lavori «Non disponibile» (ammesso: se si può, si stima)'),
  ('opera-altro',         'cantiere', false, 32, 'Tipo di opera «Altro» senza descrizione'),
  ('committente-nd',      'cantiere', false, 33, 'Committente con tipo «Non disponibile»'),
  ('senza-committente',   'cantiere', false, 34, 'Cantiere senza committente (l''Osservatorio non lo chiede)')
),
vd as (
  select v.visita_id, v.nr_verbale, v.data_visita, v.cantiere_id, v.impresa_id, v.tecnico_id, v.tipo_accesso_naz
  from visite v
  where v.elimina = 0 and v.stato = 'definitivo' and v.data_visita between p_dal and p_al
),
pv as (
  select vd.visita_id, vd.cantiere_id, r.cosa
  from vd cross join lateral (
    select 'impresa' where not exists (select 1 from imprese i where i.impresa_id = vd.impresa_id)
    union all
    select 'ruolo' where not exists (
      select 1 from visite_imprese_presenti p
      where p.visita_id = vd.visita_id and p.is_principale
        and (p.tipo_imp between 1 and 5
             or lower(btrim(coalesce(p.ruolo, ''))) in ('affidataria','affidataria ed esecutrice','esecutrice','subappaltatrice','lavoratore autonomo','fornitrice')))
    union all
    select 'tipo-visita' where vd.tipo_accesso_naz is null or vd.tipo_accesso_naz not between 1 and 7
    union all
    select 'checklist' where not exists (
      select 1 from visite_checklist k
      where k.visita_id = vd.visita_id
        and (k.valore in ('VER','OSS','NC-','NC+') or (k.valore = 'nota' and btrim(coalesce(k.nota, '')) <> '')))
    union all
    select 'tecnico' where not exists (select 1 from tecnici t where t.tecnico_id = vd.tecnico_id)
    union all
    select 'cantiere' where not exists (select 1 from cantieri c where c.cantiere_id = vd.cantiere_id)
  ) r(cosa)
),
cd as (select cantiere_id, count(*) as n_visite from vd group by cantiere_id),
pc as (
  select c.cantiere_id, r.cosa
  from cd
  join cantieri c on c.cantiere_id = cd.cantiere_id
  left join committenti m on m.committente_id = nullif(btrim(c.cantiere_committente_id), '') and m.elimina = 0
  cross join lateral (
    select 'cantiere-indirizzo' where length(btrim(coalesce(c.cantiere_indirizzo, ''))) < 2
    union all select 'cantiere-civico' where btrim(coalesce(c.cantiere_civico, '')) = ''
    union all select 'cantiere-comune' where coalesce(c.cantiere_comune_cod, '') !~ '^[0-9]{6}$'
    union all select 'cantiere-intervento' where c.cantiere_tip_int is null or c.cantiere_tip_int not between 1 and 4
    union all select 'cantiere-opera' where c.cantiere_tip_ope is null or c.cantiere_tip_ope not between 1 and 16
    union all select 'cantiere-importo' where c.cantiere_importo is null or c.cantiere_importo not between 1 and 11
    union all select 'cantiere-durata' where c.cantiere_durata is null or c.cantiere_durata not between 1 and 7
    union all select 'committente' where nullif(btrim(c.cantiere_committente_id), '') is not null and m.committente_id is null
    union all select 'committente-tipo' where m.committente_id is not null and (m.committente_tipo is null or m.committente_tipo not in (1, 2, 3))
    union all select 'importo-nd' where c.cantiere_importo = 11
    union all select 'durata-nd' where c.cantiere_durata = 7
    union all select 'opera-altro' where c.cantiere_tip_ope = 16 and btrim(coalesce(c.cantiere_tip_ope_altro, '')) = ''
    union all select 'committente-nd' where m.committente_tipo = 3
    union all select 'senza-committente' where nullif(btrim(c.cantiere_committente_id), '') is null
  ) r(cosa)
),
tutti as (
  select pv.visita_id, pv.cantiere_id, pv.cosa from pv
  union all
  select vd.visita_id, vd.cantiere_id, pc.cosa from vd join pc on pc.cantiere_id = vd.cantiere_id
),
tr as (select t.visita_id, t.cantiere_id, t.cosa, g.dove, g.blocca, g.ordine, g.testo from tutti t join regole g on g.cosa = t.cosa),
ferme as (select distinct visita_id from tr where blocca),
conta as (
  select
    (select count(*) from vd) as definitive,
    (select count(*) from ferme) as ferme,
    (select count(distinct visita_id) from tr where not blocca and visita_id not in (select visita_id from ferme)) as con_avvisi,
    (select count(*) from visite v where v.elimina = 0 and v.stato is distinct from 'definitivo' and v.data_visita between p_dal and p_al) as non_definitive
)
select jsonb_build_object(
  'dal', p_dal, 'al', p_al,
  'definitive', conta.definitive,
  'pronte', conta.definitive - conta.ferme,
  'ferme', conta.ferme,
  'con_avvisi', conta.con_avvisi,
  'non_definitive', conta.non_definitive,
  'motivi', coalesce((
    select jsonb_agg(jsonb_build_object('cosa', x.cosa, 'dove', x.dove, 'blocca', x.blocca, 'testo', x.testo, 'visite', x.n_vis, 'cantieri', x.n_cant) order by x.ordine)
    from (select cosa, dove, blocca, ordine, testo, count(distinct visita_id) as n_vis, count(distinct cantiere_id) as n_cant
          from tr group by cosa, dove, blocca, ordine, testo) x), '[]'::jsonb),
  'cantieri', case when not p_dettaglio then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
             'cantiere_id', c.cantiere_id,
             'cantiere', coalesce(nullif(btrim(c.cantiere_etichetta), ''), btrim(coalesce(c.cantiere_indirizzo, '') || ' ' || coalesce(c.cantiere_civico, ''))),
             'comune', c.comune_nome,
             'visite', cd.n_visite,
             'blocchi', coalesce((select jsonb_agg(g.cosa order by g.ordine) from pc p join regole g on g.cosa = p.cosa where p.cantiere_id = c.cantiere_id and g.blocca), '[]'::jsonb),
             'avvisi',  coalesce((select jsonb_agg(g.cosa order by g.ordine) from pc p join regole g on g.cosa = p.cosa where p.cantiere_id = c.cantiere_id and not g.blocca), '[]'::jsonb))
           order by (exists (select 1 from pc p join regole g on g.cosa = p.cosa where p.cantiere_id = c.cantiere_id and g.blocca)) desc, c.comune_nome, c.cantiere_indirizzo)
    from cd join cantieri c on c.cantiere_id = cd.cantiere_id
    where exists (select 1 from pc p where p.cantiere_id = c.cantiere_id)), '[]'::jsonb) end,
  'visite', case when not p_dettaglio then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
             'visita_id', vd.visita_id, 'nr_verbale', vd.nr_verbale, 'data', vd.data_visita,
             'tecnico', (select t.tecnico_cognome from tecnici t where t.tecnico_id = vd.tecnico_id),
             'impresa', (select i.impresa_nome from imprese i where i.impresa_id = vd.impresa_id),
             'cantiere_id', vd.cantiere_id,
             'blocchi', (select jsonb_agg(distinct tr.cosa) from tr where tr.visita_id = vd.visita_id and tr.blocca))
           order by vd.data_visita, vd.visita_id)
    from vd where vd.visita_id in (select visita_id from ferme)), '[]'::jsonb) end
)
from conta;
$$;

comment on function public.osservatorio_controllo(date, date, boolean) is
  'Unica definizione di «visita pronta per l''Osservatorio»: conta le visite definitive del periodo, dice quali non si possono esportare e perché (blocchi) e quali escono con un «Non disponibile» (avvisi). Usata da osservatorio.js (esportazione XML) e dalla tessera «Pronti per l''Osservatorio». 03/10/2026.';

revoke execute on function public.osservatorio_controllo(date, date, boolean) from public, anon;
grant execute on function public.osservatorio_controllo(date, date, boolean) to authenticated, service_role;
