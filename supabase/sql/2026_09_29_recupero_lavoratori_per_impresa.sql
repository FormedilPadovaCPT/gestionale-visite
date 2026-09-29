-- 2026-09-29 — Recupero dei lavoratori per impresa sui verbali 2025-26 importati dal modulo
--
-- Il programma di importazione scriveva visite_imprese_presenti.nr_lav = 0 fisso: il dato del modulo
-- («1.x.7», che i tecnici compilano coi lavoratori dell'impresa trovati in cantiere) finiva solo in
-- imprese.numero_addetti. Risultato: 4.310 righe su 4.310 a zero, e l'estrazione per la Cassa Edile
-- senza lavoratori per impresa.
--
-- Eseguito il 29/09/2026 a partire dal foglio del modulo (CSV del batch import_visite_2026-09-28):
--   _nrlav_fix   = le 1.748 righe impresa del foglio (verbale, posizione, ultime 4 cifre della P.IVA, lavoratori)
--   _nrlav_piano = l'abbinamento con le righe del database: stessa posizione E stessa impresa (1.644),
--                  oppure stessa impresa in posizione diversa quando è l'unica possibile (84).
-- 20 righe non abbinate con certezza sono rimaste com'erano; 20 abbinate non avevano il dato sul modulo.
-- Aggiornate 1.708 righe (1.638 con lavoratori > 0, 70 con zero scritto dal tecnico).
--
-- La tabella _nrlav_piano resta nel database come registro di che cosa è stato cambiato.
-- Per annullare: update visite_imprese_presenti p set nr_lav = 0 from _nrlav_piano x where x.id = p.id;

update visite_imprese_presenti p
   set nr_lav = x.dip
  from _nrlav_piano x
 where x.id = p.id and x.dip is not null and coalesce(p.nr_lav, 0) = 0;
