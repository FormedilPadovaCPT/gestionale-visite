-- 03/10/2026 — Dati ufficiali dell'impresa da P.IVA / codice fiscale
--
-- La edge function dati-impresa-ufficiali interroga VIES e il portale
-- InfoCamere dei dati di elevato valore. Qui:
--  · la chiave InfoCamere in s_config (la legge solo la segreteria, come gli
--    altri token; quando scade si incolla la nuova, senza deploy);
--  · il registro delle richieste, per sapere se un canale ha smesso di
--    rispondere (token scaduto, servizio giù) e chi usa la funzione.

insert into public.s_config (chiave, valore, descrizione)
values ('infocamere_hvd_token', '',
  'Token API del portale hvdataset.infocamere.it (dati di elevato valore). Durata limitata: quando scade se ne chiede uno nuovo sul portale e si incolla qui.')
on conflict (chiave) do nothing;

create table if not exists public.imprese_dati_ufficiali_log (
  id               bigint generated always as identity primary key,
  creato_il        timestamptz not null default now(),
  utente_email     text,
  piva             text,
  cf               text,
  esito_vies       text,   -- ok | non_valida | errore | non_interrogato
  esito_infocamere text,   -- ok | non_trovata | token_scaduto | non_configurato | errore | non_interrogato
  messaggio        text
);

create index if not exists imprese_dati_ufficiali_log_creato_il
  on public.imprese_dati_ufficiali_log (creato_il desc);

alter table public.imprese_dati_ufficiali_log enable row level security;

-- la scrive solo la edge function (service role); la legge la segreteria
drop policy if exists imprese_dati_ufficiali_log_sel on public.imprese_dati_ufficiali_log;
create policy imprese_dati_ufficiali_log_sel on public.imprese_dati_ufficiali_log
  for select using ((select public.is_segreteria()));

revoke all on public.imprese_dati_ufficiali_log from anon;
grant select on public.imprese_dati_ufficiali_log to authenticated;
