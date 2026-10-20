-- ============================================================
-- QUESTIONI SUI VERBALI: ANCHE LA SEGRETERIA SEGNALA, FA PASSARE E CHIUDE
-- (20/10/2026, sera, deciso dall'utente: «anche la segreteria può
-- segnalare al tecnico, far passare e chiudere le questioni, con Nicola
-- che vede tutto nello stesso elenco»).
--
-- Sostituisce i controlli di 2026_10_20_questioni_verbali.sql:
--   · vq_segnala / vq_passa / vq_chiudi: is_coordinatore() OR is_segreteria();
--   · la notifica al tecnico dice chi gli scrive (il Coordinatore o la segreteria);
--   · la risposta del tecnico avvisa il Coordinatore e, se la questione l'ha
--     aperta qualcun altro (la segreteria), anche chi l'ha aperta.
-- È il primo passo della regola del 07/08/2026 (controllo preventivo della
-- segreteria) che entra nello stesso registro del Coordinatore.
-- ============================================================

create or replace function public.vq_chi_scrive()
returns text language sql stable security definer set search_path to 'public' as $$
  select case when coalesce(public.is_coordinatore(), false) then 'Il Coordinatore' else 'La segreteria' end
$$;
revoke all on function public.vq_chi_scrive() from public, anon, authenticated;

create or replace function public.vq_segnala(p_visita_id text, p_problemi text, p_messaggio text, p_riapri boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v record;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  mail_tec text;
  nuovo bigint;
begin
  if not (coalesce(public.is_coordinatore(), false) or coalesce(public.is_segreteria(), false) or session_user = 'postgres') then
    raise exception 'Segnalare un verbale al tecnico spetta al Coordinatore o alla segreteria';
  end if;
  if length(btrim(coalesce(p_messaggio, ''))) < 5 then
    raise exception 'Scrivi al tecnico che cosa va sistemato: è il messaggio che legge';
  end if;
  select visita_id, nr_verbale, stato, elimina, tecnico_id into v from public.visite where visita_id = p_visita_id for update;
  if not found then raise exception 'Verbale % non trovato', p_visita_id; end if;
  if coalesce(v.elimina, 0) <> 0 then raise exception 'Il verbale % è eliminato', coalesce(v.nr_verbale, p_visita_id); end if;
  if exists (select 1 from public.visite_questioni q where q.visita_id = p_visita_id and q.esito in ('segnalata', 'risposta')) then
    raise exception 'Sul verbale % c''è già una segnalazione aperta', coalesce(v.nr_verbale, p_visita_id);
  end if;
  if coalesce(p_riapri, false) then
    if v.stato is distinct from 'definitivo' then
      raise exception 'Il verbale % non è definitivo (è «%»): è già fra le bozze del tecnico', coalesce(v.nr_verbale, p_visita_id), coalesce(v.stato, '—');
    end if;
    update public.visite set stato = 'bozza' where visita_id = p_visita_id;
    insert into public.visite_riaperture (visita_id, nr_verbale, motivo, riaperto_da)
    values (p_visita_id, v.nr_verbale, 'Segnalazione sul verbale: ' || btrim(p_messaggio), chi);
  end if;
  insert into public.visite_questioni (visita_id, nr_verbale, tecnico_id, esito, problemi, messaggio, riaperto, aperta_da)
  values (p_visita_id, v.nr_verbale, v.tecnico_id, 'segnalata', nullif(btrim(coalesce(p_problemi, '')), ''), btrim(p_messaggio), coalesce(p_riapri, false), chi)
  returning id into nuovo;
  begin
    select lower(email) into mail_tec from public.tecnici where tecnico_id = v.tecnico_id;
    if coalesce(mail_tec, '') <> '' then
      perform public.push_accoda(mail_tec, 'verbale_questione', 'Un verbale da sistemare',
        public.vq_chi_scrive() || ' ti ha segnalato una cosa da sistemare sul verbale ' || coalesce(v.nr_verbale, '') || ': la trovi nella pagina Oggi.',
        './?vista=dashboard', 'questione-' || nuovo);
    end if;
  exception when others then raise warning 'vq_segnala (notifica): %', sqlerrm;
  end;
  return jsonb_build_object('ok', true, 'id', nuovo, 'nr_verbale', v.nr_verbale, 'riaperto', coalesce(p_riapri, false),
    'notifica', coalesce(mail_tec, '') <> '', 'email_tecnico', mail_tec);
end $$;

create or replace function public.vq_passa(p_visita_id text, p_problemi text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v record;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  aperta bigint;
  nota text := coalesce(nullif(btrim(coalesce(p_nota, '')), ''), 'Fatto passare');
begin
  if not (coalesce(public.is_coordinatore(), false) or coalesce(public.is_segreteria(), false) or session_user = 'postgres') then
    raise exception 'Far passare un verbale segnalato spetta al Coordinatore o alla segreteria';
  end if;
  select visita_id, nr_verbale, elimina, tecnico_id into v from public.visite where visita_id = p_visita_id;
  if not found then raise exception 'Verbale % non trovato', p_visita_id; end if;
  select id into aperta from public.visite_questioni where visita_id = p_visita_id and esito in ('segnalata', 'risposta') for update;
  if aperta is not null then
    update public.visite_questioni set esito = 'passata', chiusa_da = chi, chiusa_il = now(), nota_chiusura = nota where id = aperta;
  else
    insert into public.visite_questioni (visita_id, nr_verbale, tecnico_id, esito, problemi, aperta_da, chiusa_da, chiusa_il, nota_chiusura)
    values (p_visita_id, v.nr_verbale, v.tecnico_id, 'passata', nullif(btrim(coalesce(p_problemi, '')), ''), chi, chi, now(), nota)
    returning id into aperta;
  end if;
  return jsonb_build_object('ok', true, 'id', aperta, 'nr_verbale', v.nr_verbale);
end $$;

create or replace function public.vq_rispondi(p_id bigint, p_tipo text, p_testo text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  q record;
  coord text;
  a text;
begin
  select * into q from public.visite_questioni where id = p_id for update;
  if not found then raise exception 'Segnalazione % non trovata', p_id; end if;
  if q.tecnico_id is distinct from public.mio_tecnico_id() and session_user <> 'postgres' then
    raise exception 'Alla segnalazione risponde il tecnico che ha fatto il verbale';
  end if;
  if q.esito not in ('segnalata', 'risposta') then
    raise exception 'La segnalazione sul verbale % è già chiusa', coalesce(q.nr_verbale, '');
  end if;
  if p_tipo not in ('sistemo', 'va_bene') then raise exception 'Risposta non prevista: %', p_tipo; end if;
  if p_tipo = 'va_bene' and length(btrim(coalesce(p_testo, ''))) < 5 then
    raise exception 'Scrivi perché va bene così: chi ti ha scritto lo legge per decidere';
  end if;
  update public.visite_questioni
     set esito = 'risposta', risposta_tipo = p_tipo, risposta = nullif(btrim(coalesce(p_testo, '')), ''), risposta_il = now()
   where id = p_id;
  -- avvisa il Coordinatore, e chi ha aperto la questione se è un altro (la segreteria)
  begin
    select lower(valore) into coord from public.s_config where chiave = 'coordinatore_email';
    for a in select distinct x from unnest(array[coord, lower(q.aperta_da)]) x where coalesce(x, '') like '%@%' loop
      perform public.push_accoda(a, 'verbale_questione_risposta', 'Risposta su un verbale da sistemare',
        'Il tecnico ha risposto alla segnalazione sul verbale ' || coalesce(q.nr_verbale, '') || ': la trovi nel riepilogo «Verbali da sistemare».',
        './?vista=admin', 'questione-risp-' || p_id);
    end loop;
  exception when others then raise warning 'vq_rispondi (notifica): %', sqlerrm;
  end;
  return jsonb_build_object('ok', true, 'nr_verbale', q.nr_verbale);
end $$;

create or replace function public.vq_chiudi(p_id bigint, p_esito text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  q record;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
begin
  if not (coalesce(public.is_coordinatore(), false) or coalesce(public.is_segreteria(), false) or session_user = 'postgres') then
    raise exception 'Chiudere una segnalazione spetta al Coordinatore o alla segreteria';
  end if;
  if p_esito not in ('risolta', 'passata') then raise exception 'Esito non previsto: %', p_esito; end if;
  select * into q from public.visite_questioni where id = p_id for update;
  if not found then raise exception 'Segnalazione % non trovata', p_id; end if;
  if q.esito not in ('segnalata', 'risposta') then
    raise exception 'La segnalazione sul verbale % è già chiusa', coalesce(q.nr_verbale, '');
  end if;
  update public.visite_questioni
     set esito = p_esito, chiusa_da = chi, chiusa_il = now(),
         nota_chiusura = coalesce(nullif(btrim(coalesce(p_nota, '')), ''), case p_esito when 'risolta' then 'Risolta' else 'Fatto passare' end)
   where id = p_id;
  return jsonb_build_object('ok', true, 'nr_verbale', q.nr_verbale);
end $$;

comment on table public.visite_questioni is
  'Questioni sui verbali dal riepilogo «Verbali da sistemare» (20/10/2026): le aprono e chiudono Coordinatore e segreteria (vq_*), risponde il tecnico. segnalata/risposta = aperta, blocca approvazione e mandato della fattura; risolta/passata = chiusa. Per verbale, mai totali per tecnico.';
