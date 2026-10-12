-- (12/10/2026, chiesto dall'utente) «Segnala un cantiere»: non sempre si è davanti al cantiere —
-- lo si vede dalla strada, magari a qualche chilometro — e il GPS registrava la posizione del tecnico.
-- Ora nel modulo c'è una mappa e il segnaposto si sposta sul cantiere. lat/lng restano LA POSIZIONE DEL
-- CANTIERE (è quella che usano mappa, «Naviga fin qui» e aggancio); qui si tiene da dove viene:
--   posizione_da  'gps'   = presa dal GPS e lasciata com'era (anche tutte le segnalazioni di prima)
--                 'mappa' = scelta o corretta a mano sulla mappa; accuracy_m allora è vuota,
--                           perché la precisione del GPS non dice niente su un punto scelto a mano
--   gps_lat/gps_lng = dov'era il tecnico quando ha segnalato (vuoti se il GPS non ha risposto)
alter table public.segnalazioni_cantiere
  add column if not exists posizione_da text not null default 'gps',
  add column if not exists gps_lat double precision,
  add column if not exists gps_lng double precision;
alter table public.segnalazioni_cantiere drop constraint if exists segnalazioni_cantiere_posizione_da_chk;
alter table public.segnalazioni_cantiere add constraint segnalazioni_cantiere_posizione_da_chk
  check (posizione_da in ('gps', 'mappa'));
comment on column public.segnalazioni_cantiere.posizione_da is
  'gps = posizione del telefono; mappa = scelta a mano sul segnaposto (12/10/2026)';
