-- (12/10/2026, chiesto dall'utente, seguito della mappa nella segnalazione) «dal PC uno lo compila da casa:
-- comune, via e civico, e il segnaposto si mette quasi perfettamente; poi lo si sposta se serve».
--   indirizzo     l'indirizzo scritto da chi segnala (via civico, comune), così come l'ha scritto
--   posizione_da  si aggiunge 'indirizzo' = segnaposto messo dalla ricerca dell'indirizzo e NON spostato
--                 dopo (se lo si sposta a mano diventa 'mappa')
alter table public.segnalazioni_cantiere add column if not exists indirizzo text;
alter table public.segnalazioni_cantiere drop constraint if exists segnalazioni_cantiere_posizione_da_chk;
alter table public.segnalazioni_cantiere add constraint segnalazioni_cantiere_posizione_da_chk
  check (posizione_da in ('gps', 'mappa', 'indirizzo'));
comment on column public.segnalazioni_cantiere.posizione_da is
  'gps = posizione del telefono; mappa = scelta a mano sul segnaposto; indirizzo = trovata dalla ricerca dell''indirizzo (12/10/2026)';
