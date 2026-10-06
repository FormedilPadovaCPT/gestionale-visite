-- 06/10/2026 — IMPRESE E LAVORATORI PRESENTI MA NON CENSITI (chiesto dall'utente: «a volte ci sono cantieri enormi e
-- complessi e risulta impossibile raccogliere i dati di tutte le imprese e tutti i lavoratori… inserire numero altre imprese
-- non censite con i lavoratori presenti… e mi vanno a implementare il conteggio totale»; «oltre a imprese e lavoratori
-- anche autonomi»).
--
-- Tre numeri sulla visita, a zero se non si usano (i verbali già fatti non cambiano). Il gestionale li somma ai totali
-- che già salva sulla visita e che statistiche, Osservatorio e report leggono:
--   nr_imp        = imprese elencate (non autonome) + nr_imp_non_censite
--   nr_ind        = autonomi elencati               + nr_ind_non_censite
--   nr_lavoratori = lavoratori delle righe          + nr_lav_non_censite
-- Le colonne altre_imp_text e note_altre_imp restano com'erano: sono il testo libero del vecchio modulo.
alter table public.visite
  add column if not exists nr_imp_non_censite smallint not null default 0,
  add column if not exists nr_lav_non_censite smallint not null default 0,
  add column if not exists nr_ind_non_censite smallint not null default 0;
alter table public.visite drop constraint if exists visite_non_censite_check;
alter table public.visite add constraint visite_non_censite_check
  check (nr_imp_non_censite between 0 and 9999 and nr_lav_non_censite between 0 and 9999 and nr_ind_non_censite between 0 and 9999);
comment on column public.visite.nr_imp_non_censite is 'Imprese presenti in cantiere ma non elencate nel verbale (06/10/2026): sommate in nr_imp';
comment on column public.visite.nr_lav_non_censite is 'Lavoratori delle imprese non censite (06/10/2026): sommati in nr_lavoratori';
comment on column public.visite.nr_ind_non_censite is 'Lavoratori autonomi presenti ma non elencati (06/10/2026): sommati in nr_ind';
