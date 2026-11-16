-- (16/11/2026) Applicato come migrazione task_dec_visibile_senza_anon_2026_11_16.
-- Supabase concede EXECUTE ad anon a ogni funzione nuova: la rete di sicurezza
-- (segreteria-app/tests-db/03_rls_personale.sql e 21_pgtap_rete_di_sicurezza.sql)
-- pretende che nessuna funzione di public sia eseguibile senza accesso, ed era rossa
-- dal giro di lunedì 16/11 per questa sola funzione, nata con la pagina 📋 Task.
-- s_task_dec_visibile serve solo alla policy s_task_vault_sel, che vale per authenticated:
-- togliere anon non cambia che cosa vedono segreteria, Coordinatore e Direttore.
-- Chi crea una funzione nuova aggiunge subito la sua riga di revoke.
revoke execute on function public.s_task_dec_visibile(integer) from public, anon;
grant execute on function public.s_task_dec_visibile(integer) to authenticated, service_role;
