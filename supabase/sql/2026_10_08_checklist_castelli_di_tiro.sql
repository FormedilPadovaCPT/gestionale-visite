-- 08/10/2026 — CHECK-LIST: «Cannelli di tiro» → «Castelli di tiro» (segnalato dall'utente: «la denominazione
-- corretta è Castelli di tiro»). Voce OPE_POF_008, ponteggi fissi; l'articolo della stessa riga diceva già
-- «Ponteggi fissi - castelli di tiro (art. 136 c 4 …)». Cercato in tutte le colonne di testo delle tabelle di public:
-- l'errore stava solo qui. Le note con «cannello» parlano del cannello a gas (ASU_ATT_002) e sono giuste.
-- Le importazioni riconoscono la voce dal codice (build_map: «castelli di tiro» → OPE_POF_008), non dal testo.
-- Copia della riga in archivio prima di cambiarla.

begin;

create table archivio.bk_2026_10_08_checklist_castelli_di_tiro as
select v.*, now() as copiato_il from public.checklist_voci v where v.codice = 'OPE_POF_008';
revoke all on archivio.bk_2026_10_08_checklist_castelli_di_tiro from public, anon, authenticated;

do $$
begin
  assert (select descrizione from public.checklist_voci where codice = 'OPE_POF_008') = 'Cannelli di tiro',
    'la voce OPE_POF_008 non dice più «Cannelli di tiro»: niente da correggere, o qualcuno l''ha già cambiata';
end $$;

update public.checklist_voci set descrizione = 'Castelli di tiro' where codice = 'OPE_POF_008';

do $$
begin
  assert (select descrizione from public.checklist_voci where codice = 'OPE_POF_008') = 'Castelli di tiro', 'correzione non riuscita';
  assert not exists (select 1 from public.checklist_voci where descrizione ~* 'cannelli di tiro'), 'resta una voce con «Cannelli di tiro»';
end $$;

commit;
