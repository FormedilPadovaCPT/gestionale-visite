-- 03/10/2026 — CODICE ISTAT DEL COMUNE (migrazione comuni_codice_istat_e_regola_2026_10_03, già applicata).
--
-- Che cosa è emerso scrivendo l'esportazione senza ripieghi: comuni_istat ha i soli comuni della provincia di
-- Padova (105 righe), e il codice del cantiere lo ricava il trigger cantiere_autofill dal nome. Quindi:
--   · un cantiere fuori provincia non prende mai il codice;
--   · i cantieri di Padova importati col quartiere nel nome («PADOVA - Q1 (CENTRO STORICO)») nemmeno: 257;
--   · Carceri non c'era: è un comune soppresso il 22/01/2024, oggi frazione di Santa Caterina d'Este
--     (indicato dall'utente il 03/10/2026). Due cantieri di Carceri portavano 028023, che è Carmignano di Brenta.
-- E dalla mattina del 03/10 verbale_mancanze fermava la chiusura del verbale se mancava il CODICE: un tecnico
-- in un cantiere fuori provincia non avrebbe potuto chiudere, senza poterci fare niente.
--
-- Che cosa fa:
--   1) copia di prima in archivio.bk_2026_10_03_cantieri_comune_cod (263 righe);
--   2) comuni_istat: Carceri → 028108 (Santa Caterina d'Este), Dolo → 027012, Bassano del Grappa → 024012;
--   3) cantieri: Padova col quartiere → 028060 (257), Carceri → 028108 (4), Dolo (1), Bassano del Grappa (1);
--   4) verbale_mancanze: ferma se manca il NOME del comune, non il codice (vedi 2026_10_03_verbale_completo.sql).
-- Restano 4 cantieri storici senza codice (comune «-», «ND», «BEVILACQUA VR»): li elenca «🔎 Controlla».
-- DA FARE: caricare in comuni_istat l'elenco ISTAT dei comuni (almeno il Veneto), così il caso non si ripresenta.
-- Da decidere: Vighizzolo d'Este (028098), Saletto, Megliadino San Fidenzio, Santa Margherita d'Adige sono comuni
-- soppressi che in tabella portano ancora il codice vecchio.

create table if not exists archivio.bk_2026_10_03_cantieri_comune_cod as
select c.cantiere_id, c.comune_nome, c.cantiere_comune_cod, now() as copiato_il
from public.cantieri c
where (c.comune_nome ilike 'PADOVA - Q%' and coalesce(c.cantiere_comune_cod,'') !~ '^[0-9]{6}$')
   or (upper(btrim(c.comune_nome)) = 'CARCERI' and coalesce(c.cantiere_comune_cod,'') <> '028108')
   or (upper(btrim(c.comune_nome)) in ('DOLO','BASSANO DEL GRAPPA') and coalesce(c.cantiere_comune_cod,'') !~ '^[0-9]{6}$');
revoke all on archivio.bk_2026_10_03_cantieri_comune_cod from public, anon, authenticated;

insert into public.comuni_istat (nome, cod)   -- nome_norm è una colonna calcolata
select v.nome, v.cod
from (values ('Carceri', '028108'), ('Dolo', '027012'), ('Bassano del Grappa', '024012')) v(nome, cod)
where not exists (select 1 from public.comuni_istat i where i.nome = v.nome);

update public.cantieri set cantiere_comune_cod = '028060'
where comune_nome ilike 'PADOVA - Q%' and coalesce(cantiere_comune_cod,'') !~ '^[0-9]{6}$';
update public.cantieri set cantiere_comune_cod = '028108'
where upper(btrim(comune_nome)) = 'CARCERI' and coalesce(cantiere_comune_cod,'') <> '028108';
update public.cantieri set cantiere_comune_cod = '027012'
where upper(btrim(comune_nome)) = 'DOLO' and coalesce(cantiere_comune_cod,'') !~ '^[0-9]{6}$';
update public.cantieri set cantiere_comune_cod = '024012'
where upper(btrim(comune_nome)) = 'BASSANO DEL GRAPPA' and coalesce(cantiere_comune_cod,'') !~ '^[0-9]{6}$';
