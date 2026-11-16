-- (16/11/2026) Applicato come migrazione funzioni_nuove_chiuse_ad_anon_2026_11_16.
-- Le funzioni nuove di public nascono SENZA il permesso di esecuzione per anon (e per PUBLIC).
-- Prima l'impostazione predefinita di Supabase lo dava a ogni funzione nuova creata da postgres,
-- e la rete di sicurezza (segreteria-app/tests-db/03_rls_personale.sql e
-- 21_pgtap_rete_di_sicurezza.sql) andava rossa ogni volta: 02/11, 09/11, 16/11.
-- Provato prima in una transazione annullata: funzione nuova eseguibile da anon prima sì, dopo no;
-- authenticated e service_role continuano a riceverlo da soli.
-- Le 504 funzioni già esistenti non cambiano.
-- Una funzione che deve davvero essere chiamata senza accesso si apre con un grant esplicito,
-- e va aggiunta come eccezione nelle due prove.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;
