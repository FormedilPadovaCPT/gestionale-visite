-- 13/11/2026 — APPLICATA lo stesso giorno (migrazione promemoria_ricontrolli_giri_2026_11_13).
-- Registro dei giri del promemoria dei ricontrolli.
--
-- La funzione promemoria-ricontrolli non teneva traccia dei giri: rilanciare il workflow
-- del lunedì, o premere due volte il pulsante del coordinatore, mandava due volte le
-- scadenze a tutti i tecnici. Ora ogni giro PRENOTA una riga prima di spedire:
--   - giro automatico: uno solo al giorno (indice unico sul giorno);
--   - giro a mano del coordinatore: sempre ammesso, ma non due nello stesso quarto d'ora
--     (lo controlla la funzione).
-- Se il registro non risponde la funzione spedisce lo stesso, come ha sempre fatto.
-- La legge e la scrive solo la funzione, col ruolo di servizio: RLS accesa, nessuna policy.
-- Provato in transazione annullata: il secondo giro automatico del giorno è rifiutato.
-- Rieseguibile.
create table if not exists public.promemoria_ricontrolli_giri (
  id          bigint generated always as identity primary key,
  giorno      date not null default ((now() at time zone 'Europe/Rome')::date),
  fatto_il    timestamptz not null default now(),
  manuale     boolean not null default false,
  inviate     integer,
  errori      integer,
  esito       text
);
create unique index if not exists promemoria_ricontrolli_giri_automatico_al_giorno
  on public.promemoria_ricontrolli_giri (giorno) where not manuale;
create index if not exists promemoria_ricontrolli_giri_fatto_il on public.promemoria_ricontrolli_giri (fatto_il desc);
alter table public.promemoria_ricontrolli_giri enable row level security;
revoke all on table public.promemoria_ricontrolli_giri from public, anon, authenticated;
comment on table public.promemoria_ricontrolli_giri is
  'Giri del promemoria dei ricontrolli (edge function promemoria-ricontrolli). Una riga prenotata prima di spedire: un solo giro automatico al giorno; i giri a mano non più di uno ogni 15 minuti. 13/11/2026.';
