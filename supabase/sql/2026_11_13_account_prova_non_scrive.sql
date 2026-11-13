-- 13/11/2026 — APPLICATA lo stesso giorno (migrazione account_prova_non_scrive_2026_11_13).
-- L'ACCOUNT DI PROVA NON SCRIVE NEL DATABASE.
--
-- Serve alle prove nel browser che entrano nel gestionale (e2e/prove/verbale-a-secco.spec.mjs).
-- La prova lavora «a secco» (tools/prova_a_secco.js ferma le scritture nel browser), ma se
-- quella protezione saltasse un verbale finto finirebbe nel database vero e nell'XML
-- dell'Osservatorio. Questa è la seconda protezione, dalla parte del database: qualunque
-- scrittura fatta con l'accesso di prova sulle tabelle del gestionale viene rifiutata, anche
-- se passa da una funzione con privilegi propri (i trigger scattano comunque).
--
-- Trigger per ISTRUZIONE: scatta anche su zero righe e costa un confronto di testo.
-- Provato prima in transazione annullata: l'account di prova è fermato; un tecnico vero,
-- un giro senza accesso e delle credenziali malformate passano come prima.
--
-- ⚠️ Una tabella NUOVA in cui un tecnico può scrivere va aggiunta all'elenco qui sotto.
-- Rieseguibile.
create or replace function public.tg_account_prova_non_scrive() returns trigger
language plpgsql set search_path to '' as $f$
declare v text := '';
begin
  begin
    v := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  exception when others then v := '';
  end;
  if v = 'prova.tecnico@did.formedilpadova.it' then
    raise exception 'L''account di prova non scrive nel database (%).', TG_TABLE_NAME using errcode = '42501';
  end if;
  return null;
end $f$;
comment on function public.tg_account_prova_non_scrive() is
  'Rifiuta ogni scrittura fatta con l''accesso di prova (prova.tecnico@…) sulle tabelle del gestionale. Seconda protezione delle prove nel browser, dopo la prova a secco. 13/11/2026.';
revoke execute on function public.tg_account_prova_non_scrive() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'visite','visite_checklist','visite_imprese_presenti','visite_lavorazioni','visite_foto','visite_snapshot',
    'visite_cicli','visite_questioni','visite_riaperture','visite_cassa_foto','verbali',
    'cantieri','cantiere_imprese_previste','cantieri_correzioni','cantieri_proposte_chiusura',
    'imprese','imprese_certificazioni','imprese_ateco','persone','persone_imprese','committenti',
    'incarichi','incarichi_foto','segnalazioni_cantiere','appunti_cantiere','appunti_cantiere_foto',
    'chat_messaggi','chat_contenuti','mail_correzioni','pendenze_riassegnate','doc_prese_visione','avvisi_letture']
  loop
    execute format('drop trigger if exists aa_account_prova on public.%I', t);
    execute format('create trigger aa_account_prova before insert or update or delete on public.%I for each statement execute function public.tg_account_prova_non_scrive()', t);
  end loop;
end $$;

-- il tecnico di prova (scheda TEC-PROVA-2026, già esistente) vede solo le proprie visite: non ne ha
update public.tecnici set vede_solo_proprie = true where tecnico_id = 'TEC-PROVA-2026';
