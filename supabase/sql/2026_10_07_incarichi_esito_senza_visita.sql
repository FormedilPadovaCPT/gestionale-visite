-- 07/10/2026 — INCARICO CON ESITO SENZA VISITA: «CANTIERE FINITO / NON TROVATO» (piano approvato dall'utente).
-- Il tecnico va sul posto ma il cantiere è finito, o all'indirizzo non c'è: non c'è niente da verbalizzare, quindi
-- l'incarico restava aperto per sempre (si chiudeva solo con un verbale) e l'unico gesto era «✋ Non posso», che vuol
-- dire «non sono disponibile» e porta alla riassegnazione. Ora:
--   · incarichi.esito_senza_visita ('cantiere_finito' | 'cantiere_non_trovato' | 'altro'), esito_data (quando è andato),
--     esito_nota (che cosa ha trovato, obbligatoria), esito_il / esito_da;
--   · incarico_esito_senza_visita(id, esito, data, nota): la usa il tecnico a cui l'incarico è assegnato (o la
--     segreteria). L'incarico passa a «eseguito» senza verbale: la segreteria lo trova fra quelli da chiudere, con la
--     nota. La pratica dei servizi collegata riceve l'esito nelle note dell'ufficio; una segnalazione passa a
--     «eseguita» come per una visita, col testo giusto;
--   · incarico_esito_annulla(id): il tecnico ritira l'esito finché la segreteria non ha chiuso l'incarico;
--   · incarichi_set_stato: riaprendo un incarico con esito, l'esito si toglie (non si paga due volte); se l'uscita è
--     già stata registrata per il pagamento, la riapertura si ferma e lo dice.
-- L'uscita si paga come una visita (deciso dall'utente): lo fa il calcolo delle prestazioni della segreteria
-- (2026_10_07_prestazioni_senza_visita.sql). Nelle statistiche e nell'Osservatorio non conta: il verbale non c'è.

begin;

alter table public.incarichi add column if not exists esito_senza_visita text
  check (esito_senza_visita in ('cantiere_finito', 'cantiere_non_trovato', 'altro'));
alter table public.incarichi add column if not exists esito_data date;
alter table public.incarichi add column if not exists esito_nota text;
alter table public.incarichi add column if not exists esito_il timestamptz;
alter table public.incarichi add column if not exists esito_da text;
comment on column public.incarichi.esito_senza_visita is 'Esito senza verbale dichiarato dal tecnico (07/10/2026): cantiere_finito | cantiere_non_trovato | altro. Si paga come una visita.';

-- la guardia: chi non gestisce gli incarichi non scrive l'esito a mano (passa dalla funzione)
create or replace function public.tg_incarichi_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if public.is_gestione_incarichi() then return new; end if;
  if coalesce(current_setting('app.incarico_sistema', true),'') = '1' then return new; end if;
  new.stato                  := old.stato;
  new.chiuso_il              := old.chiuso_il;
  new.chiuso_da              := old.chiuso_da;
  new.pratica_chiusa_origine := old.pratica_chiusa_origine;
  new.tecnico_email          := old.tecnico_email;
  new.tecnico_nome           := old.tecnico_nome;
  new.assegnato_il           := old.assegnato_il;   -- 07/10/2026: come il tecnico assegnato
  new.id                     := old.id;
  new.visita_id              := old.visita_id;
  new.eseguito_il            := old.eseguito_il;
  new.eseguito_da            := old.eseguito_da;
  new.visite_previste        := old.visite_previste;
  new.visite_fatte           := old.visite_fatte;
  new.esito_senza_visita     := old.esito_senza_visita;   -- 07/10/2026: si scrive solo con incarico_esito_senza_visita
  new.esito_data             := old.esito_data;
  new.esito_nota             := old.esito_nota;
  new.esito_il               := old.esito_il;
  new.esito_da               := old.esito_da;
  return new;
end; $function$;

create or replace function public.incarico_esito_senza_visita(p_id bigint, p_esito text, p_data date, p_nota text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  i public.incarichi;
  chi text := lower(coalesce(auth.jwt() ->> 'email', ''));
  nota text := btrim(coalesce(p_nota, ''));
  etichetta text;
  riga text;
begin
  select * into i from public.incarichi where id = p_id for update;
  if not found then raise exception 'Incarico % non trovato', p_id; end if;
  if not (public.is_gestione_incarichi() or (chi <> '' and lower(coalesce(i.tecnico_email, '')) = chi)) then
    raise exception 'L''esito lo scrive il tecnico a cui è assegnato l''incarico';
  end if;
  if i.stato <> 'aperto' then raise exception 'L''incarico n° % non è più aperto', p_id; end if;
  if p_esito not in ('cantiere_finito', 'cantiere_non_trovato', 'altro') then raise exception 'Esito non valido'; end if;
  if p_data is null or p_data > current_date then raise exception 'Serve la data in cui sei andato, non nel futuro'; end if;
  if length(nota) < 10 then raise exception 'Scrivi che cosa hai trovato (almeno qualche parola): è quello che legge la segreteria'; end if;
  etichetta := case p_esito when 'cantiere_finito' then 'cantiere già finito'
                            when 'cantiere_non_trovato' then 'nessun cantiere all''indirizzo' else 'visita non possibile' end;

  perform set_config('app.incarico_sistema', '1', true);
  update public.incarichi set
    stato = 'eseguito', eseguito_il = now(), eseguito_da = coalesce(nullif(chi, ''), session_user),
    esito_senza_visita = p_esito, esito_data = p_data, esito_nota = left(nota, 2000),
    esito_il = now(), esito_da = coalesce(nullif(chi, ''), session_user),
    presa_visione_il = coalesce(presa_visione_il, now()), presa_visione_da = coalesce(presa_visione_da, nullif(chi, '')),
    accettato_il = coalesce(accettato_il, now()), accettato_da = coalesce(accettato_da, nullif(chi, ''))
  where id = p_id;
  perform set_config('app.incarico_sistema', '', true);

  -- la pratica dei servizi collegata riceve l'esito nelle note dell'ufficio
  riga := to_char(current_date, 'DD/MM/YYYY') || ' — esito del tecnico senza visita (incarico n° ' || p_id || ', sopralluogo del '
          || to_char(p_data, 'DD/MM/YYYY') || '): ' || etichetta || '. ' || nota;
  update public.s_visite_richieste set note_ufficio = concat_ws(E'\n', note_ufficio, riga), updated_at = now() where incarico_id = p_id;
  update public.s_segnalazioni set note_ufficio = concat_ws(E'\n', note_ufficio, riga), updated_at = now() where incarico_id = p_id;
  update public.s_consulenze set note_ufficio = concat_ws(E'\n', note_ufficio, riga), updated_at = now() where incarico_id = p_id;
  update public.s_conferenze_cantiere set note_ufficio = concat_ws(E'\n', note_ufficio, riga), updated_at = now() where incarico_id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id, 'esito', p_esito, 'etichetta', etichetta);
end $function$;
revoke execute on function public.incarico_esito_senza_visita(bigint, text, date, text) from public, anon;
grant execute on function public.incarico_esito_senza_visita(bigint, text, date, text) to authenticated;

create or replace function public.incarico_esito_annulla(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare i public.incarichi; chi text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select * into i from public.incarichi where id = p_id for update;
  if not found then raise exception 'Incarico % non trovato', p_id; end if;
  if not (public.is_gestione_incarichi() or (chi <> '' and lower(coalesce(i.tecnico_email, '')) = chi)) then
    raise exception 'Non autorizzato';
  end if;
  if i.esito_senza_visita is null then raise exception 'L''incarico n° % non ha un esito senza visita', p_id; end if;
  if i.stato <> 'eseguito' then raise exception 'L''incarico n° % è già stato chiuso dalla segreteria: chiedi a lei di riaprirlo', p_id; end if;
  if exists (select 1 from public.s_prestazioni p where p.incarico_id = p_id) then
    raise exception 'L''uscita è già stata registrata per il pagamento: l''esito non si ritira più da qui';
  end if;
  perform set_config('app.incarico_sistema', '1', true);
  update public.incarichi set stato = 'aperto', eseguito_il = null, eseguito_da = null,
         esito_senza_visita = null, esito_data = null, esito_nota = null, esito_il = null, esito_da = null
   where id = p_id;
  perform set_config('app.incarico_sistema', '', true);
  return jsonb_build_object('ok', true, 'id', p_id);
end $function$;
revoke execute on function public.incarico_esito_annulla(bigint) from public, anon;
grant execute on function public.incarico_esito_annulla(bigint) to authenticated;

-- riaprire un incarico con esito toglie l'esito; se l'uscita è già registrata per il pagamento, ci si ferma
create or replace function public.incarichi_set_stato(p_id bigint, p_stato text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_gestione_incarichi() then
    raise exception 'Operazione riservata alla segreteria/coordinatore';
  end if;
  if p_stato not in ('aperto','eseguito','chiuso') then raise exception 'stato non valido'; end if;
  if p_stato = 'aperto'
     and exists (select 1 from public.incarichi where id = p_id and esito_senza_visita is not null)
     and exists (select 1 from public.s_prestazioni p where p.incarico_id = p_id) then
    raise exception 'L''incarico n° % ha un''uscita senza visita già registrata per il pagamento: riaprirlo la farebbe pagare due volte', p_id;
  end if;
  update public.incarichi set
    stato = p_stato,
    chiuso_il = case when p_stato='chiuso' then coalesce(chiuso_il, now()) else null end,
    chiuso_da = case when p_stato='chiuso' then coalesce(chiuso_da, auth.jwt() ->> 'email') else null end,
    chiuso_dal_cantiere = null,
    stato_prima_chiusura = null,
    esito_senza_visita = case when p_stato = 'aperto' then null else esito_senza_visita end,
    esito_data = case when p_stato = 'aperto' then null else esito_data end,
    esito_nota = case when p_stato = 'aperto' then null else esito_nota end,
    esito_il = case when p_stato = 'aperto' then null else esito_il end,
    esito_da = case when p_stato = 'aperto' then null else esito_da end
  where id = p_id;
end; $function$;

-- la segnalazione collegata: «eseguita» come per una visita, ma col testo dell'esito
create or replace function public.s_segnalazione_da_incarico()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_data date; v_cant text; n int;
begin
  begin
    if new.stato = 'eseguito' and old.stato is distinct from 'eseguito' then
      select v.data_visita, v.cantiere_id into v_data, v_cant from visite v where v.visita_id = new.visita_id;
      update s_segnalazioni s
         set stato = 'eseguita',
             data_verbale = coalesce(v_data, s.data_verbale),
             cantiere_id = coalesce(s.cantiere_id, v_cant),
             updated_at = now(),
             aggiornato_da = case when new.esito_senza_visita is not null
                                  then 'automatico: esito senza visita del tecnico (incarico n° ' || new.id || ')'
                                  else 'automatico: visita registrata dal tecnico (incarico n° ' || new.id || ')' end
       where s.incarico_id = new.id
         and s.stato in ('ricevuta', 'istruita', 'autorizzata', 'assegnata', 'riscontrata');
      get diagnostics n = row_count;
      if n > 0 then
        perform push_accoda('cptpd@did.formedilpadova.it', 'segnalazione_eseguita',
          case when new.esito_senza_visita is not null then 'Segnalazione: cantiere finito o non trovato' else 'Segnalazione: visita fatta' end,
          case when new.esito_senza_visita is not null
               then 'Il tecnico è andato sul posto ma non c''era da fare la visita: la sua nota è nella pratica, nell''app Segreteria c''è da decidere il riscontro e chiudere.'
               else 'Il tecnico ha registrato la visita su una segnalazione: nell''app Segreteria c''è da decidere il riscontro e chiudere la pratica.' end,
          './', 'segnalazione-inc-' || new.id);
      end if;
    elsif new.stato = 'aperto' and old.stato = 'eseguito' then
      update s_segnalazioni s
         set stato = 'assegnata', updated_at = now(),
             aggiornato_da = 'automatico: incarico n° ' || new.id || ' riaperto'
       where s.incarico_id = new.id and s.stato = 'eseguita';
    end if;
  exception when others then raise warning 's_segnalazione_da_incarico: %', sqlerrm; end;
  return null;
end $function$;

commit;
