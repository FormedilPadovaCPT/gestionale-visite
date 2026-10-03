-- Carica in comuni_istat l'elenco ISTAT dei comuni italiani (supabase/dati/comuni_istat.csv).
-- Lo esegue il workflow «Carica comuni ISTAT» quando cambia il file; si può rieseguire quante volte si vuole.
--
-- Il file viene dall'«Elenco comuni italiani» dell'ISTAT (scaricato il 03/10/2026, con l'ok dell'utente):
-- codice alfanumerico a 6 cifre, denominazione in italiano, sigla della provincia, regione.
-- Restano fuori i comuni con lo stesso nome in due province — Castro (BG, LE), Livo (CO, TN), Peglio (CO, PU),
-- Samone (TO, TN), San Teodoro (ME, SS), Paterno/Paternò (PZ, CT) — perché il codice si ricava dal solo nome:
-- per quelli il codice si scrive a mano nel campo «Cod. ISTAT» della scheda del cantiere.
--
-- Che cosa NON tocca: le righe dei comuni soppressi (soppresso_il valorizzato) e il codice delle righe che ci
-- sono già. Se il file dice un codice diverso da quello in tabella, o dà per esistente un comune che la tabella
-- dà per soppresso, SI FERMA e lo dice: decide una persona.
\set ON_ERROR_STOP on
begin;
create temp table _c (cod text, nome text, prov text, regione text) on commit drop;
\copy _c from 'supabase/dati/comuni_istat.csv' with (format csv, header true, delimiter ';', encoding 'UTF8')
do $$
declare n int; t text;
begin
  select count(*) into n from _c;
  if n < 7500 or n > 8500 then raise exception 'comuni_istat.csv ha % righe: ne aspetto circa 7.900', n; end if;
  if exists (select 1 from _c where cod !~ '^[0-9]{6}$' or btrim(coalesce(nome, '')) = '') then
    raise exception 'comuni_istat.csv: un codice non è di 6 cifre o un nome è vuoto';
  end if;
  if exists (select 1 from _c group by nome having count(*) > 1) then raise exception 'comuni_istat.csv: nomi ripetuti'; end if;
  select string_agg(i.nome || ' (in tabella ' || i.cod || ', nel file ' || c.cod || ')', ', ') into t
    from public.comuni_istat i join _c c on c.nome = i.nome where i.soppresso_il is null and i.cod <> c.cod;
  if t is not null then raise exception 'codici diversi da quelli in tabella: %', t; end if;
  select string_agg(i.nome, ', ') into t from public.comuni_istat i join _c c on c.nome = i.nome where i.soppresso_il is not null;
  if t is not null then raise exception 'il file dà per esistenti comuni che la tabella dà per soppressi: %', t; end if;
end $$;
insert into public.comuni_istat (nome, cod, prov, regione, fonte)
select btrim(nome), cod, prov, regione, 'ISTAT, Elenco comuni italiani' from _c
on conflict (nome) do update set prov = excluded.prov, regione = excluded.regione, fonte = excluded.fonte;
do $$
declare t text;
begin
  select string_agg(nome_norm, ', ') into t from (select nome_norm from public.comuni_istat group by nome_norm having count(*) > 1) x;
  if t is not null then raise exception 'dopo il caricamento ci sono nomi che si confondono: %', t; end if;
  raise notice 'comuni_istat: % righe, di cui % comuni soppressi', (select count(*) from public.comuni_istat), (select count(*) from public.comuni_istat where soppresso_il is not null);
end $$;
commit;
