-- ============================================================
-- QUESTIONI SUI VERBALI — dal riepilogo «Verbali da sistemare» al tecnico,
-- fino alla risoluzione; e niente pagamento finché una è aperta
-- (20/10/2026, chiesto dall'utente: «il coordinatore deve anche poter
-- segnalare al tecnico per cose futili; se decide le può far passare,
-- altrimenti bisogna gestire il processo fino alla risoluzione. Quando
-- risultano questioni aperte sui verbali questi non possono andare in
-- pagamento»).
--
-- Il riepilogo del mese (riepilogo-verbali.js) elenca i verbali che il
-- controllo al salvataggio segnala. Per ognuno il Coordinatore decide:
--   · «Fai passare»      → riga chiusa subito, esito 'passata';
--   · «Segnala al tecnico» → riga aperta, esito 'segnalata', notifica al
--     tecnico; se serve correggere, il verbale torna in bozza (riapertura,
--     come quella della segreteria, registrata in visite_riaperture);
--   · il tecnico risponde dalla pagina Oggi («Sistemo» oppure «Va bene
--     così, perché…») → esito 'risposta', notifica al Coordinatore;
--   · il Coordinatore chiude: 'risolta' o 'passata', con una nota.
-- La riga non si cancella mai: è la traccia di come è stato gestito il
-- verbale (regola d'oro 4).
--
-- ⚠️ L'UNITÀ È IL VERBALE, NON LA PERSONA: nessuna funzione qui conta o
-- confronta le questioni per tecnico. Un totale per tecnico farebbe di
-- questo registro una valutazione delle prestazioni (sigla VAL; Reg. UE
-- 2024/1689, Allegato III punto 4), che l'ente ha deciso di non fare.
--
-- ⚠️ IL BLOCCO DEL PAGAMENTO STA QUI, NON NELLE PAGINE: una fattura che
-- copre (tramite s_prestazioni) un verbale con una questione aperta, o un
-- verbale riaperto e non ancora richiuso, non passa a «approvata» né a
-- «mandato». È il «mandato che non parte» della regola del 07/08/2026,
-- reso automatico. I passaggi dopo il mandato (pagamento) non si toccano:
-- il mandato è già uscito.
-- ============================================================

create table if not exists public.visite_questioni (
  id            bigint generated always as identity primary key,
  visita_id     text not null references public.visite(visita_id),
  nr_verbale    text,
  tecnico_id    text,
  esito         text not null check (esito in ('segnalata', 'risposta', 'risolta', 'passata')),
  problemi      text,           -- gli avvisi del controllo quando il Coordinatore ha deciso (fotografia)
  messaggio     text,           -- quello che il Coordinatore ha scritto al tecnico
  riaperto      boolean not null default false,
  risposta_tipo text check (risposta_tipo in ('sistemo', 'va_bene')),
  risposta      text,
  risposta_il   timestamptz,
  aperta_da     text not null,
  aperta_il     timestamptz not null default now(),
  chiusa_da     text,
  chiusa_il     timestamptz,
  nota_chiusura text
);
comment on table public.visite_questioni is
  'Questioni sui verbali dal riepilogo «Verbali da sistemare» (20/10/2026): segnalata/risposta = aperta, blocca approvazione e mandato della fattura; risolta/passata = chiusa. Si scrive solo con le funzioni vq_*. Per verbale, mai totali per tecnico.';

-- una sola questione aperta per verbale
create unique index if not exists ux_visite_questioni_aperta
  on public.visite_questioni (visita_id) where esito in ('segnalata', 'risposta');
create index if not exists ix_visite_questioni_visita on public.visite_questioni (visita_id);

alter table public.visite_questioni enable row level security;
drop policy if exists visite_questioni_sel on public.visite_questioni;
create policy visite_questioni_sel on public.visite_questioni for select to authenticated
  using (public.is_coordinatore() or public.is_segreteria() or tecnico_id = public.mio_tecnico_id());
revoke all on public.visite_questioni from anon, authenticated;
grant select on public.visite_questioni to authenticated;

-- ── il Coordinatore segnala al tecnico ──
create or replace function public.vq_segnala(p_visita_id text, p_problemi text, p_messaggio text, p_riapri boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v record;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  mail_tec text;
  nuovo bigint;
begin
  if not (coalesce(public.is_coordinatore(), false) or session_user = 'postgres') then
    raise exception 'Segnalare un verbale al tecnico spetta al Coordinatore';
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
    values (p_visita_id, v.nr_verbale, 'Segnalazione del Coordinatore: ' || btrim(p_messaggio), chi);
  end if;

  insert into public.visite_questioni (visita_id, nr_verbale, tecnico_id, esito, problemi, messaggio, riaperto, aperta_da)
  values (p_visita_id, v.nr_verbale, v.tecnico_id, 'segnalata', nullif(btrim(coalesce(p_problemi, '')), ''), btrim(p_messaggio), coalesce(p_riapri, false), chi)
  returning id into nuovo;

  -- la notifica: se non parte, la segnalazione resta valida (il tecnico la trova in Oggi)
  begin
    select lower(email) into mail_tec from public.tecnici where tecnico_id = v.tecnico_id;
    if coalesce(mail_tec, '') <> '' then
      perform public.push_accoda(mail_tec, 'verbale_questione', 'Un verbale da sistemare',
        'Il Coordinatore ti ha segnalato una cosa da sistemare sul verbale ' || coalesce(v.nr_verbale, '') || ': la trovi nella pagina Oggi.',
        './?vista=dashboard', 'questione-' || nuovo);
    end if;
  exception when others then raise warning 'vq_segnala (notifica): %', sqlerrm;
  end;
  return jsonb_build_object('ok', true, 'id', nuovo, 'nr_verbale', v.nr_verbale, 'riaperto', coalesce(p_riapri, false),
    'notifica', coalesce(mail_tec, '') <> '', 'email_tecnico', mail_tec);
end $$;

-- ── il Coordinatore lo fa passare (subito, o chiudendo una segnalazione) ──
create or replace function public.vq_passa(p_visita_id text, p_problemi text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v record;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  aperta bigint;
  nota text := coalesce(nullif(btrim(coalesce(p_nota, '')), ''), 'Fatto passare dal Coordinatore');
begin
  if not (coalesce(public.is_coordinatore(), false) or session_user = 'postgres') then
    raise exception 'Far passare un verbale segnalato spetta al Coordinatore';
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

-- ── il tecnico risponde ──
create or replace function public.vq_rispondi(p_id bigint, p_tipo text, p_testo text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  q record;
  coord text;
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
    raise exception 'Scrivi perché va bene così: il Coordinatore lo legge per decidere';
  end if;
  update public.visite_questioni
     set esito = 'risposta', risposta_tipo = p_tipo, risposta = nullif(btrim(coalesce(p_testo, '')), ''), risposta_il = now()
   where id = p_id;
  begin
    select lower(valore) into coord from public.s_config where chiave = 'coordinatore_email';
    if coalesce(coord, '') <> '' then
      perform public.push_accoda(coord, 'verbale_questione_risposta', 'Risposta su un verbale da sistemare',
        'Il tecnico ha risposto alla segnalazione sul verbale ' || coalesce(q.nr_verbale, '') || ': la trovi nella Zona Coordinatore.',
        './?vista=admin', 'questione-risp-' || p_id);
    end if;
  exception when others then raise warning 'vq_rispondi (notifica): %', sqlerrm;
  end;
  return jsonb_build_object('ok', true, 'nr_verbale', q.nr_verbale);
end $$;

-- ── il Coordinatore chiude ──
create or replace function public.vq_chiudi(p_id bigint, p_esito text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  q record;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
begin
  if not (coalesce(public.is_coordinatore(), false) or session_user = 'postgres') then
    raise exception 'Chiudere una segnalazione spetta al Coordinatore';
  end if;
  if p_esito not in ('risolta', 'passata') then raise exception 'Esito non previsto: %', p_esito; end if;
  select * into q from public.visite_questioni where id = p_id for update;
  if not found then raise exception 'Segnalazione % non trovata', p_id; end if;
  if q.esito not in ('segnalata', 'risposta') then
    raise exception 'La segnalazione sul verbale % è già chiusa', coalesce(q.nr_verbale, '');
  end if;
  update public.visite_questioni
     set esito = p_esito, chiusa_da = chi, chiusa_il = now(),
         nota_chiusura = coalesce(nullif(btrim(coalesce(p_nota, '')), ''), case p_esito when 'risolta' then 'Risolta' else 'Fatta passare dal Coordinatore' end)
   where id = p_id;
  return jsonb_build_object('ok', true, 'nr_verbale', q.nr_verbale);
end $$;

-- ── che cosa ferma il pagamento di queste fatture ──
create or replace function public.fattura_questioni_aperte(p_fatture bigint[])
returns table (fattura_id bigint, visita_id text, nr_verbale text, motivo text, dal timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select p.fattura_id, q.visita_id, q.nr_verbale,
         case q.esito when 'segnalata' then 'segnalato al tecnico, in attesa della risposta'
                      else 'il tecnico ha risposto, manca la decisione del Coordinatore' end,
         q.aperta_il
    from public.s_prestazioni p
    join public.visite_questioni q on q.visita_id = p.visita_id and q.esito in ('segnalata', 'risposta')
   where p.fattura_id = any (p_fatture)
     and (public.is_coordinatore() or public.is_segreteria() or public.is_amministrazione() or session_user = 'postgres')
  union all
  select p.fattura_id, r.visita_id, r.nr_verbale, 'verbale riaperto e non ancora richiuso dal tecnico', r.riaperto_il
    from public.s_prestazioni p
    join public.visite_riaperture r on r.visita_id = p.visita_id and r.richiuso_il is null
   where p.fattura_id = any (p_fatture)
     and (public.is_coordinatore() or public.is_segreteria() or public.is_amministrazione() or session_user = 'postgres')
  order by 1, 3
$$;

create or replace function public.fatture_blocco_questioni()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  elenco text;
begin
  if new.stato in ('approvata', 'mandato') and new.stato is distinct from old.stato then
    select string_agg(distinct coalesce(x.nr_verbale, x.visita_id), ', ') into elenco
      from public.fattura_questioni_aperte(array[new.id]) x;
    if elenco is not null then
      raise exception 'La fattura % non può andare in pagamento: ci sono verbali con questioni aperte (%). Si chiudono dal riepilogo «Verbali da sistemare» nella Zona Coordinatore.',
        coalesce(new.numero, new.id::text), elenco;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_fatture_blocco_questioni on public.s_fatture_tecnici;
create trigger trg_fatture_blocco_questioni before update of stato on public.s_fatture_tecnici
  for each row execute function public.fatture_blocco_questioni();

revoke all on function public.vq_segnala(text, text, text, boolean) from public, anon;
revoke all on function public.vq_passa(text, text, text) from public, anon;
revoke all on function public.vq_rispondi(bigint, text, text) from public, anon;
revoke all on function public.vq_chiudi(bigint, text, text) from public, anon;
revoke all on function public.fattura_questioni_aperte(bigint[]) from public, anon;
revoke all on function public.fatture_blocco_questioni() from public, anon, authenticated;
grant execute on function public.vq_segnala(text, text, text, boolean) to authenticated;
grant execute on function public.vq_passa(text, text, text) to authenticated;
grant execute on function public.vq_rispondi(bigint, text, text) to authenticated;
grant execute on function public.vq_chiudi(bigint, text, text) to authenticated;
grant execute on function public.fattura_questioni_aperte(bigint[]) to authenticated;
