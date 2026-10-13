-- ============================================================
-- PROMEMORIA AL TECNICO: VERBALI NON ANCORA INVIATI
-- (13/10/2026, deciso dall'utente)
--
-- Ogni mattina feriale, alle 8, il tecnico che ha visite ferme da
-- almeno un giorno lavorativo riceve UNA mail con l'elenco:
--   - verbali chiusi (definitivo) e mai inviati all'impresa;
--   - verbali ancora in bozza.
-- È indipendente dal riepilogo dei ricontrolli del lunedì. Va al solo
-- tecnico: il coordinatore non è in copia («è un promemoria per il
-- tecnico»). Niente segno «consegnato a mano»: se all'impresa manca la
-- mail, il tecnico la deve trovare.
--
-- ⚠️ Eccezione 9 alla regola «l'app prepara, la persona manda»: interna,
-- testo tutto dal database.
--
-- «Da inviare» vale come nella colonna Invio del gestionale (_invStato):
-- definitivo, non eliminato, nato nell'app (created_at dal 1/10/2026 e
-- visita_id non V####-…), senza una riga in `verbali` con inviato_email.
-- «Ferma da un giorno» = ultima modifica prima delle 8:00 (ora italiana)
-- del giorno lavorativo precedente (il lunedì: il venerdì).
-- ============================================================

-- 1) il registro dei giri: una riga per tecnico e giorno (niente doppioni),
--    più la riga '*' del giro, scritta anche quando non parte niente
create table if not exists public.promemoria_invii_giri (
  id bigserial primary key,
  giorno date not null,
  tecnico_email text not null,          -- '*' = il giro
  n_definitivi int not null default 0,
  n_bozze int not null default 0,
  elenco jsonb,
  prenotato_il timestamptz not null default now(),
  inviato_il timestamptz,
  esito text,                            -- inviato | errore | giro-ok | giro-errori | sospeso
  errore text,
  unique (giorno, tecnico_email)
);
alter table public.promemoria_invii_giri enable row level security;
drop policy if exists promemoria_invii_giri_leggi on public.promemoria_invii_giri;
create policy promemoria_invii_giri_leggi on public.promemoria_invii_giri
  for select to authenticated using (public.is_segreteria() or public.is_coordinatore());
revoke all on public.promemoria_invii_giri from anon;
grant select on public.promemoria_invii_giri to authenticated;

-- 2) l'elenco delle visite ferme, per tecnico
create or replace function public.promemoria_invii_elenco(p_ora timestamptz default now())
returns table (
  tecnico_email text, tecnico_nome text, visita_id text, nr_verbale text, data_visita date,
  stato text, cantiere text, comune text, impresa text, ferma_dal timestamptz, giorni int
)
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  d date := (p_ora at time zone 'Europe/Rome')::date;
  prec date;
  limite timestamptz;
begin
  prec := d - case extract(isodow from d)::int when 1 then 3 when 7 then 2 else 1 end;
  limite := (prec + time '08:00') at time zone 'Europe/Rome';
  return query
  select lower(t.email), trim(coalesce(t.tecnico_nome,'') || ' ' || coalesce(t.tecnico_cognome,'')),
         v.visita_id, v.nr_verbale::text, v.data_visita::date,
         case when coalesce(v.stato,'bozza') = 'bozza' then 'bozza' else 'definitivo' end,
         coalesce(nullif(trim(c.cantiere_etichetta),''), trim(coalesce(c.cantiere_indirizzo,'') || ' ' || coalesce(c.cantiere_civico,''))),
         c.comune_nome, i.impresa_nome, v.updated_at,
         (d - (v.updated_at at time zone 'Europe/Rome')::date)::int
  from public.visite v
  join public.tecnici t on t.tecnico_id = v.tecnico_id
  left join public.cantieri c on c.cantiere_id = v.cantiere_id
  left join public.imprese i on i.impresa_id = v.impresa_id
  where coalesce(v.elimina,0) = 0
    and t.email is not null and coalesce(t.attivo,false)
    and t.email !~* '^(cpt|prova)'
    and v.visita_id !~ '^V\d{4}-'
    and v.created_at >= timestamptz '2026-10-01 00:00:00+02'
    and v.updated_at < limite
    and ( coalesce(v.stato,'bozza') = 'bozza'
          or (v.stato = 'definitivo' and not exists (
                select 1 from public.verbali b where b.visita_id = v.visita_id and b.inviato_email is true)) )
  order by 1, 6, v.data_visita, v.nr_verbale;
end $$;
revoke execute on function public.promemoria_invii_elenco(timestamptz) from public, anon, authenticated;
grant execute on function public.promemoria_invii_elenco(timestamptz) to service_role;

-- 3) la chiave del giro e l'interruttore
insert into public.s_config (chiave, valore, descrizione)
values ('promemoria_invii_token', encode(extensions.gen_random_bytes(24), 'hex'),
        'Chiave del giro pg_cron promemoria-invii (verbali non inviati al tecnico)')
on conflict (chiave) do nothing;
insert into public.app_impostazioni (chiave, valore, aggiornato_il, aggiornato_da)
values ('promemoria_invii_attivo', 'true'::jsonb, now(), 'cptpd@did.formedilpadova.it')
on conflict (chiave) do nothing;

-- 4) il giro (applicato DOPO aver pubblicato la funzione): alle 6:20 e 7:20 UTC
--    nei feriali; la funzione manda solo dalle 8 italiane in poi e una volta al
--    giorno, quindi d'estate parte alle 8:20, d'inverno alle 8:20 col secondo giro
-- (applicato come migrazione promemoria_invii_giro; la chiave anon nell'header
--  Authorization è quella pubblica del progetto, come negli altri giri)
select cron.schedule('promemoria-invii-giro', '20 6,7 * * 1-5', $cron$
do $body$
declare r record; tok text;
begin
  select valore into tok from public.s_config where chiave = 'promemoria_invii_token';
  if coalesce(tok, '') = '' then
    raise exception 'promemoria-invii-giro: manca s_config.promemoria_invii_token';
  end if;
  commit;
  perform pg_sleep(20);
  perform http_set_curlopt('CURLOPT_TIMEOUT_MS', '180000');
  select * into r from http((
    'POST',
    'https://utdantrfugnmqsuujxbe.supabase.co/functions/v1/promemoria-invii',
    array[http_header('X-Promemoria-Invii', tok),
          http_header('Authorization', 'Bearer <chiave anon del progetto>')],
    'application/json', '{}')::http_request);
  if r.status <> 200 then
    raise exception 'promemoria-invii-giro: HTTP % %', r.status, left(r.content, 300);
  end if;
end
$body$;
$cron$);
