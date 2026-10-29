-- 29/10/2026 — CICLO_PROPOSTA: «column reference "u" is ambiguous»
-- Trovato nel controllo generale del gestionale chiesto dall'utente: nei log del 28/10 la funzione ha risposto 400
-- undici volte (11:43-18:04) con quel messaggio. In ciclo_proposta `u` è la variabile record dell'ultima visita del
-- lotto, e lo stesso nome era l'alias di unnest() nelle due righe che normalizzano imprese e fasi della visita:
-- PL/pgSQL (variable_conflict = error) rifiuta la query. Passavano solo i casi che escono prima (asseverazione,
-- visite prima del 1° ottobre, cantiere o data mancanti): per ogni altra visita il tecnico vedeva l'errore al posto
-- della proposta del ciclo. La chiusura non era bloccata (le 54 visite chiuse dal 01/10 hanno il ciclo, assegnato da
-- chiudi_verbale), ma la proposta da confermare non arrivava.
-- Correzione: l'alias di unnest() diventa `x`. Nient'altro cambia. Applicata sul server con md5 di controllo
-- (prima 26ee3f563d06fdc43de93a30841fc255, dopo 32e22372024c6c34f5030eedd19ab534). Applicata il 29/10/2026 con l'ok
-- dell'utente; verificata subito su tutti i 54 verbali dal 01/10: 54 proposte calcolate, nessun errore.
-- Nota: 2026_10_20d_cicli_visita.sql ha la stessa forma alle righe 263-264, ma in una funzione dove `u` non è una
-- variabile: lì non c'è conflitto.

do $do$
declare
  d text := pg_get_functiondef('public.ciclo_proposta(text,date,text,text[],text[],text,integer,text)'::regprocedure);
  a1 text := $a$imp_v := array(select distinct u from unnest(coalesce(p_imprese, '{}')) u where nullif(trim(u), '') is not null order by u);$a$;
  b1 text := $b$imp_v := array(select distinct x from unnest(coalesce(p_imprese, '{}')) x where nullif(trim(x), '') is not null order by x);$b$;
  a2 text := $a$fasi_v := array(select distinct lower(trim(u)) from unnest(coalesce(p_fasi, '{}')) u where nullif(trim(u), '') is not null order by 1);$a$;
  b2 text := $b$fasi_v := array(select distinct lower(trim(x)) from unnest(coalesce(p_fasi, '{}')) x where nullif(trim(x), '') is not null order by 1);$b$;
begin
  if md5(d) <> '26ee3f563d06fdc43de93a30841fc255' then raise exception 'ciclo_proposta in produzione è cambiata: non tocco'; end if;
  if position(a1 in d) = 0 or position(a2 in d) = 0 then raise exception 'righe da correggere non trovate'; end if;
  execute replace(replace(d, a1, b1), a2, b2);
end $do$;
