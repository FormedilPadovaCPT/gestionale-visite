-- 02/10/2026 — v_master_visite: la vista scavalcava la RLS.
--
-- Segnalata dal linter di Supabase (0010_security_definer_view, livello ERROR).
-- La vista girava con i diritti di chi l'ha creata (postgres) e aveva tutti i permessi
-- anche per «anon»: chiunque avesse la chiave pubblica leggeva tutte le visite, con nomi,
-- telefoni, e-mail e le osservazioni interne («NON VISIBILI SU REPORT»).
-- Provato prima della correzione: anon leggeva 3.254 righe dalla vista e 0 dalla tabella visite.
--
-- Dopo: la vista applica i permessi di chi la interroga (security_invoker), anon non ha
-- nessun permesso, gli utenti autenticati solo la lettura. Provato: anon rifiutato (42501),
-- segreteria e tecnico leggono quello che la RLS delle tabelle concede loro.
-- Studio e gli script col ruolo di servizio non cambiano.
alter view public.v_master_visite set (security_invoker = true);
revoke all on public.v_master_visite from anon;
revoke insert, update, delete, truncate, references, trigger on public.v_master_visite from authenticated;
comment on view public.v_master_visite is 'Vista di consultazione per Studio ed export. Ricalcola gli aggregati checklist a ogni chiamata (~4 s per pagina): NON usare dalle app. Analisi DB 05/09/2026. Dal 02/10/2026 security_invoker: vale la RLS di chi interroga; nessun permesso ad anon.';

-- Stesso giorno: la funzione del trigger trg_visite_incarico_altrui era chiamabile da chiunque
-- via /rest/v1/rpc (avviso anon_security_definer_function_executable). Una funzione di trigger
-- non va esposta; il trigger continua a scattare (provato come utente autenticato).
revoke all on function public.tg_visite_incarico_altrui() from public, anon, authenticated;
