-- 2026_11_12_verbali_pdf_dati.sql
-- (12/11/2026, deciso dall'utente dal verbale CPT/26_27/0093) La rettifica si decide al momento dell'invio,
-- confrontando ciò che sta per essere stampato con ciò che era stampato nell'ultimo verbale spedito.
-- pdf_dati = i dati da cui è nato il PDF di quell'invio (VerbalePDF.prepara, normalizzati da rettifica-invio.js:
-- senza data di stampa, dicitura di rettifica, articoli e ipotesi di sanzione), più l'impronta delle foto.
-- Il tipo d'invio si arricchisce di «copia»: nuovo invio della stessa versione, senza dicitura di rettifica.
-- Nessun vincolo sul tipo: i valori in uso sono invio, rettifica, reinvio (indirizzo corretto dopo un rimbalzo), copia.

alter table public.verbali add column if not exists pdf_dati jsonb;

comment on column public.verbali.pdf_dati is
  'Dati stampati sul verbale di questo invio (rettifica-invio.js, normalizza): il prossimo invio si confronta con questi per decidere se è una rettifica.';
comment on column public.verbali.tipo is
  'invio | rettifica (il verbale è cambiato rispetto all''ultimo spedito) | reinvio (all''indirizzo corretto dopo una mail respinta) | copia (stessa versione, inviata di nuovo)';
