-- 03/10/2026 — Rinnovo automatico della chiave InfoCamere (dura 6 ore)
--
-- Deciso dall'utente: la chiave si rinnova da sola. La edge function
-- dati-impresa-ufficiali chiede una chiave nuova a InfoCamere per
-- l'indirizzo dell'ente e la legge dalla posta di cptpd@ (gmail.readonly).
-- Qui: l'indirizzo, il segreto del giro e il giro pg_cron.
--
-- Orari (UTC): 05:20, 10:50, 16:20, dal lunedì al venerdì = 7:20, 12:50,
-- 18:20 d'estate (CEST), 6:20, 11:50, 17:20 d'inverno: con 6 ore di vita la
-- chiave copre la giornata fino a sera. Fuori da lì (sera, fine settimana)
-- la rinnova la prima richiesta di un tecnico che la trova scaduta.
-- La funzione rinnova solo se la chiave scade entro due ore: un giro in più
-- non manda mail inutili.

insert into public.s_config (chiave, valore, descrizione) values
  ('infocamere_hvd_email', 'cptpd@did.formedilpadova.it',
   'Indirizzo a cui InfoCamere manda la chiave delle API (dati di elevato valore). La funzione dati-impresa-ufficiali la legge da questa casella: deve essere cptpd@, l''unica che il service account legge.'),
  ('infocamere_rinnovo_token', encode(extensions.gen_random_bytes(24), 'hex'),
   'Segreto con cui il giro pg_cron infocamere-chiave-giro chiama la funzione dati-impresa-ufficiali (header X-Infocamere-Rinnovo).')
on conflict (chiave) do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'infocamere-chiave-giro';

select cron.schedule('infocamere-chiave-giro', '20 5,16 * * 1-5', $cron$
do $body$
declare r record; tok text;
begin
  select valore into tok from public.s_config where chiave = 'infocamere_rinnovo_token';
  if coalesce(tok, '') = '' then
    raise exception 'infocamere-chiave-giro: manca s_config.infocamere_rinnovo_token';
  end if;
  -- a meta' minuto: nei primi secondi del minuto PostgREST risponde 504 (13/09/2026)
  commit;
  perform pg_sleep(20);
  perform http_set_curlopt('CURLOPT_TIMEOUT_MS', '90000');
  select * into r from http((
    'POST',
    'https://utdantrfugnmqsuujxbe.supabase.co/functions/v1/dati-impresa-ufficiali',
    array[http_header('X-Infocamere-Rinnovo', tok),
          http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0ZGFudHJmdWdubXFzdXVqeGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjEzMTYsImV4cCI6MjA5MzgzNzMxNn0.L6YUgMD9rYPtqZCn5-c6hB-ok5nSCISpSolj_a-pcmM')],
    'application/json', '{}')::http_request);
  -- l'esito si controlla con RAISE EXCEPTION: un giro che non puo' fallire
  -- non dice niente quando riesce (13/09/2026)
  if r.status <> 200 then
    raise exception 'infocamere-chiave-giro: HTTP % %', r.status, left(r.content, 300);
  end if;
end
$body$;
$cron$);

-- il giro di mezzogiorno ha un minuto diverso: un secondo job
select cron.unschedule(jobid) from cron.job where jobname = 'infocamere-chiave-giro-mezzogiorno';
select cron.schedule('infocamere-chiave-giro-mezzogiorno', '50 10 * * 1-5',
  (select command from cron.job where jobname = 'infocamere-chiave-giro'));
