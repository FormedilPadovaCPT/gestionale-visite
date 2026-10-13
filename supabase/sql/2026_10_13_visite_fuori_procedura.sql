-- (13/10/2026, scelte dell'utente dopo la proposta del 12/10 e la mail al Coordinatore)
-- VISITE FUORI PROCEDURA. La procedura Rev. 4 (§ 4.6) archivia il cantiere alla 2ª visita con IPC
-- assente o basso e dalla 3ª in poi se l'IPC non è alto; dopo l'archiviazione si torna solo a una
-- nuova fase di lavoro, dopo un tempo adeguato. Nel 2025-26 75 visite ordinarie su 584 sono tornate
-- entro 90 giorni su un cantiere archiviato. Regole decise:
--   * vale per le sole VISITE ORDINARIE (tipo accesso 5 «Programmata» e 7 «Dal CPT») senza incarico:
--     serie, asseverazioni, stage, richieste e segnalazioni tornano per definizione;
--   * «tempo adeguato» dopo l'archiviazione: 30 giorni se l'impresa principale dell'ultima visita è
--     iscritta C.E.I.V. ATTIVA, 90 giorni negli altri casi (non iscritta, sospesa, cessata: «non versano
--     contributi e a questo fine non eroghiamo servizi aggiuntivi» — eccezione dichiarata alla regola
--     del 01/10 «sospesa è comunque iscritta», che resta per statistiche e verbali);
--   * rientro ANTICIPATO: quando la regola prevede un rientro (22 giorni, o la data scritta dal
--     tecnico) e si torna più di una settimana prima;
--   * stesso avviso per un tecnico diverso da quello che ha archiviato;
--   * il numero di accesso continua sempre, anche a fase nuova: qui si CONTA, non si legge il dichiarato;
--   * il tecnico fa la visita scrivendo il motivo (interno: mai sul PDF né nella mail all'impresa);
--     il verbale esce segnato «fuori procedura» e il Coordinatore — solo lui — approva o no;
--   * con motivo «fase nuova», alla chiusura si confrontano le lavorazioni con la visita di riferimento;
--   * la segreteria vede i numeri nella pagina degli incarichi mensili (fp_riepilogo).
-- Vale per le visite dal 14/10/2026: lo storico non si rietichetta.

alter table public.visite
  add column if not exists fp_tipo text,
  add column if not exists fp_motivo_tipo text,
  add column if not exists fp_motivo text,
  add column if not exists fp_serie_proposta boolean not null default false,
  add column if not exists fp_rif_visita_id text,
  add column if not exists fp_lavorazioni_uguali boolean,
  add column if not exists fp_esito text,
  add column if not exists fp_esito_da text,
  add column if not exists fp_esito_il timestamptz,
  add column if not exists fp_esito_nota text;
alter table public.visite drop constraint if exists visite_fp_tipo_chk;
alter table public.visite add constraint visite_fp_tipo_chk check (fp_tipo is null or fp_tipo in ('archiviato','anticipato'));
alter table public.visite drop constraint if exists visite_fp_motivo_tipo_chk;
alter table public.visite add constraint visite_fp_motivo_tipo_chk check (fp_motivo_tipo is null or fp_motivo_tipo in ('fase_nuova','impresa_nuova','richiesta','rischio','altro'));
alter table public.visite drop constraint if exists visite_fp_esito_chk;
alter table public.visite add constraint visite_fp_esito_chk check (fp_esito is null or fp_esito in ('approvata','non_approvata'));
comment on column public.visite.fp_tipo is 'Visita fuori procedura: archiviato = cantiere archiviato dalla regola da meno del tempo adeguato; anticipato = più di una settimana prima del rientro dovuto. Lo mette il database (13/10/2026).';
comment on column public.visite.fp_motivo_tipo is 'Perché il tecnico torna: fase_nuova, impresa_nuova, richiesta (impresa o committente), rischio (notato passando), altro. Interno, mai sul PDF.';
comment on column public.visite.fp_esito is 'Decisione del Coordinatore (fp_decidi): approvata | non_approvata.';
create index if not exists visite_fp_tipo_idx on public.visite (fp_tipo) where fp_tipo is not null;

-- ── la regola Formedil, la stessa di calcRientroFormedil nel gestionale e rientroFormedil nella segreteria ──
-- Giorni dopo i quali è dovuto il rientro; null = archiviazione.
create or replace function public.fp_regola_giorni(p_acc integer, p_ipc text)
returns integer language sql immutable set search_path to 'public' as $$
  select case
    when coalesce(p_acc, 1) <= 1 then case when upper(coalesce(p_ipc,'')) = 'ALTO' then 3 when upper(coalesce(p_ipc,'')) in ('MEDIO','BASSO') then 22 end
    when p_acc = 2 then case when upper(coalesce(p_ipc,'')) = 'ALTO' then 3 when upper(coalesce(p_ipc,'')) = 'MEDIO' then 22 end
    else case when upper(coalesce(p_ipc,'')) = 'ALTO' then 3 end
  end
$$;

-- ── il controllo su un cantiere, per una visita a una data ──
-- Versione interna senza controllo del ruolo: la usa il trigger (anche sotto service role).
create or replace function public.fp_controllo_int(p_cantiere_id text, p_data date, p_visita_id text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  u record; n_acc integer; n_tot integer; giorni integer; v_cassa text; v_imp text;
  fin integer; passati integer; dovuto date; tipo text; v_ceiv boolean;
begin
  if p_cantiere_id is null or p_data is null then
    return jsonb_build_object('fuori', false, 'nota', 'cantiere o data mancanti');
  end if;
  select v.visita_id, v.nr_verbale, v.data_visita, v.ipc, v.tecnico_id, v.data_ritorno, v.impresa_id,
         coalesce(t.tecnico_cognome, '') as tecnico
    into u
  from public.visite v left join public.tecnici t on t.tecnico_id = v.tecnico_id
  where v.cantiere_id = p_cantiere_id and coalesce(v.elimina, 0) = 0 and v.data_visita is not null
    and v.data_visita <= p_data and (p_visita_id is null or v.visita_id <> p_visita_id)
  order by v.data_visita desc, v.nr_verbale desc nulls last
  limit 1;
  if not found then
    return jsonb_build_object('fuori', false, 'prima_visita', true, 'accesso_nuovo', 1);
  end if;
  -- accesso CONTATO (continua sempre): le visite del cantiere fino all'ultima compresa
  select count(*) into n_acc from public.visite v
   where v.cantiere_id = p_cantiere_id and coalesce(v.elimina, 0) = 0 and v.data_visita is not null
     and v.data_visita <= u.data_visita and (p_visita_id is null or v.visita_id <> p_visita_id);
  select count(*) into n_tot from public.visite v
   where v.cantiere_id = p_cantiere_id and coalesce(v.elimina, 0) = 0 and v.data_visita is not null
     and v.data_visita <= p_data and (p_visita_id is null or v.visita_id <> p_visita_id);
  giorni := public.fp_regola_giorni(n_acc, u.ipc);
  select i.stato_cassa, i.impresa_nome into v_cassa, v_imp from public.imprese i where i.impresa_id = u.impresa_id;
  v_ceiv := (v_cassa = 'Attiva');
  passati := p_data - u.data_visita;
  if giorni is null then
    fin := case when v_ceiv then 30 else 90 end;
    if passati < fin then tipo := 'archiviato'; end if;
  else
    dovuto := coalesce(u.data_ritorno, u.data_visita + giorni);
    if p_data < dovuto - 7 then tipo := 'anticipato'; end if;
  end if;
  return jsonb_build_object(
    'fuori', tipo is not null, 'tipo', tipo,
    'archiviato', giorni is null, 'finestra_gg', fin, 'giorni_passati', passati,
    'rientro_dovuto', dovuto, 'rientro_giorni', giorni,
    'ceiv_attiva', v_ceiv, 'impresa', v_imp, 'accesso_nuovo', n_tot + 1,
    'ultima', jsonb_build_object('visita_id', u.visita_id, 'nr_verbale', u.nr_verbale, 'data_visita', u.data_visita,
      'ipc', coalesce(nullif(upper(u.ipc), ''), 'NR'), 'accesso', n_acc, 'tecnico', u.tecnico, 'tecnico_id', u.tecnico_id,
      'data_ritorno', u.data_ritorno));
end $$;

create or replace function public.fp_controllo(p_cantiere_id text, p_data date, p_visita_id text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_personale() then
    raise exception 'Riservato al personale dell''Area.' using errcode = '42501';
  end if;
  return public.fp_controllo_int(p_cantiere_id, p_data, p_visita_id);
end $$;

-- ── i rientri dovuti (per l'avviso al tecnico e per il riquadro del Coordinatore) ──
-- Ultima visita per cantiere aperto; la regola dice SE c'è un rientro, data_ritorno (se c'è) dice QUANDO.
-- p_email: solo i cantieri di quel tecnico (titolare della pendenza) o nei comuni della sua zona.
create or replace function public.fp_rientri_dovuti(p_email text default null)
returns table (cantiere_id text, etichetta text, comune text, visita_id text, nr_verbale text, data_visita date,
               ipc text, accesso integer, rientro_il date, giorni integer, tipo text, tecnico_id text)
language sql stable security definer set search_path to 'public' as $$
  with me as (
    select t.tecnico_id from public.tecnici t
     where p_email is not null and lower(t.email) = lower(p_email)
     order by coalesce(t.attivo, false) desc limit 1
  ), ult as (
    select distinct on (v.cantiere_id) v.cantiere_id, v.visita_id, v.nr_verbale, v.data_visita, v.ipc, v.data_ritorno, v.tecnico_id
    from public.visite v join public.cantieri c on c.cantiere_id = v.cantiere_id
    where coalesce(v.elimina, 0) = 0 and v.cantiere_id is not null and v.data_visita is not null
      and coalesce(c.cantiere_chiuso, false) = false
    order by v.cantiere_id, v.data_visita desc, v.nr_verbale desc nulls last
  ), calc as (
    select u.*,
      (select count(*)::integer from public.visite x where x.cantiere_id = u.cantiere_id and coalesce(x.elimina, 0) = 0
         and x.data_visita is not null and x.data_visita <= u.data_visita) as n,
      coalesce(pt.a_tecnico_id, u.tecnico_id) as titolare
    from ult u left join public.v_pendenze_titolari pt on pt.visita_id = u.visita_id
  ), con_regola as (
    select c.*, public.fp_regola_giorni(c.n, c.ipc) as g from calc c
  )
  select r.cantiere_id, cc.cantiere_etichetta, cc.comune_nome, r.visita_id, r.nr_verbale, r.data_visita,
         coalesce(nullif(upper(r.ipc), ''), 'NR'), r.n,
         coalesce(r.data_ritorno, r.data_visita + r.g) as rientro_il,
         (coalesce(r.data_ritorno, r.data_visita + r.g) - current_date)::integer as giorni,
         case when r.g = 3 then 'urgente' else 'ordinaria' end as tipo,
         r.titolare
  from con_regola r join public.cantieri cc on cc.cantiere_id = r.cantiere_id
  where (select public.is_personale())
    and r.g is not null
    and (p_email is null or trim(p_email) = ''
         or r.titolare = (select tecnico_id from me)
         or cc.comune_nome in (select z.comune_nome from public.tecnici_zone z where lower(z.email) = lower(p_email)))
  order by 10, 6
$$;

-- ── il riepilogo per tecnico (Coordinatore e segreteria) ──
create or replace function public.fp_riepilogo(p_dal date, p_al date)
returns table (tecnico_id text, tecnico text, n_ordinarie integer, n_fuori integer, n_attesa integer,
               n_approvate integer, n_non_approvate integer, n_rientri_dovuti integer, n_rientri_scaduti integer)
language sql stable security definer set search_path to 'public' as $$
  with ok as (select public.is_coordinatore() or public.is_segreteria() as si),
  vis as (
    select v.tecnico_id,
      count(*) filter (where v.tipo_accesso in (5, 7) and v.incarico_id is null)::integer as n_ord,
      count(*) filter (where v.fp_tipo is not null)::integer as n_fp,
      count(*) filter (where v.fp_tipo is not null and v.fp_esito is null)::integer as n_att,
      count(*) filter (where v.fp_tipo is not null and v.fp_esito = 'approvata')::integer as n_ok,
      count(*) filter (where v.fp_tipo is not null and v.fp_esito = 'non_approvata')::integer as n_no
    from public.visite v
    where coalesce(v.elimina, 0) = 0 and v.data_visita between p_dal and p_al
    group by v.tecnico_id
  ), rie as (
    select r.tecnico_id,
      count(*) filter (where r.giorni between 0 and 60)::integer as dovuti,
      count(*) filter (where r.giorni < 0 and r.ipc <> 'NR')::integer as scaduti
    from public.fp_rientri_dovuti(null) r group by r.tecnico_id
  )
  select t.tecnico_id, trim(coalesce(t.tecnico_cognome, '') || ' ' || coalesce(t.tecnico_nome, '')),
         coalesce(v.n_ord, 0), coalesce(v.n_fp, 0), coalesce(v.n_att, 0), coalesce(v.n_ok, 0), coalesce(v.n_no, 0),
         coalesce(r.dovuti, 0), coalesce(r.scaduti, 0)
  from public.tecnici t
  left join vis v on v.tecnico_id = t.tecnico_id
  left join rie r on r.tecnico_id = t.tecnico_id
  where (select si from ok)
    and coalesce(t.elimina, 0) = 0
    and (coalesce(t.attivo, false) or v.tecnico_id is not null or r.tecnico_id is not null)
    and t.email !~* '^(cpt|prova)'
  order by 2
$$;

-- ── la decisione del Coordinatore ──
create or replace function public.fp_decidi(p_visita_id text, p_esito text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v record; v_io text := lower(coalesce(auth.jwt() ->> 'email', '')); v_mail text;
begin
  if not public.is_coordinatore() then
    raise exception 'Le visite fuori procedura le approva solo il Coordinatore.' using errcode = '42501';
  end if;
  if p_esito not in ('approvata', 'non_approvata') then
    raise exception 'Esito non valido: approvata o non_approvata.' using errcode = '22023';
  end if;
  select visita_id, nr_verbale, tecnico_id, fp_tipo into v from public.visite where visita_id = p_visita_id for update;
  if not found or v.fp_tipo is null then
    raise exception 'Verbale non trovato, oppure non è una visita fuori procedura.' using errcode = 'P0002';
  end if;
  perform set_config('app.fp_decidi', p_visita_id, true);
  update public.visite set fp_esito = p_esito, fp_esito_da = v_io, fp_esito_il = now(), fp_esito_nota = nullif(trim(coalesce(p_nota, '')), '')
   where visita_id = p_visita_id;
  perform set_config('app.fp_decidi', '', true);
  -- al tecnico arriva la decisione (push, se ha il telefono collegato)
  select lower(t.email) into v_mail from public.tecnici t where t.tecnico_id = v.tecnico_id;
  if coalesce(v_mail, '') <> '' and v_mail <> v_io then
    perform public.push_accoda(v_mail, 'fp_esito:' || p_visita_id,
      case when p_esito = 'approvata' then 'Visita fuori procedura approvata' else 'Visita fuori procedura non approvata' end,
      'Verbale ' || coalesce(v.nr_verbale, '?') || ': il Coordinatore ' || case when p_esito = 'approvata' then 'ha approvato' else 'NON ha approvato' end
        || ' la visita' || case when nullif(trim(coalesce(p_nota, '')), '') is not null then '. ' || left(trim(p_nota), 120) else '.' end,
      './?vista=lista', 'fp-esito-' || p_visita_id);
  end if;
  return jsonb_build_object('ok', true, 'esito', p_esito);
end $$;

-- ── il trigger: lo stato lo mette il database, l'esito solo fp_decidi ──
-- security definer: il trigger gira con i diritti del tecnico che salva, e fp_controllo_int è chiusa ad authenticated
create or replace function public.tg_visite_fuori_procedura()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare j jsonb; ricalcola boolean;
begin
  -- l'esito del Coordinatore non si scrive da fuori
  if tg_op = 'UPDATE' and (new.fp_esito is distinct from old.fp_esito or new.fp_esito_da is distinct from old.fp_esito_da
       or new.fp_esito_il is distinct from old.fp_esito_il or new.fp_esito_nota is distinct from old.fp_esito_nota)
     and coalesce(current_setting('app.fp_decidi', true), '') <> new.visita_id then
    raise exception 'L''esito di una visita fuori procedura lo dà solo il Coordinatore, dalla Zona Coordinatore.' using errcode = '42501';
  end if;
  if coalesce(new.elimina, 0) <> 0 or new.data_visita is null or new.data_visita < date '2026-10-14' then
    return new;
  end if;
  -- solo le visite ordinarie senza incarico
  if new.tipo_accesso is null or new.tipo_accesso not in (5, 7) or new.incarico_id is not null then
    new.fp_tipo := null; new.fp_rif_visita_id := null;
    return new;
  end if;
  ricalcola := tg_op = 'INSERT' or new.fp_tipo is null
    or new.cantiere_id is distinct from old.cantiere_id or new.data_visita is distinct from old.data_visita;
  -- un verbale già chiuso tiene la sua etichetta, a meno che non cambino cantiere o data
  if tg_op = 'UPDATE' and old.stato = 'definitivo' and new.stato = 'definitivo'
     and new.cantiere_id is not distinct from old.cantiere_id and new.data_visita is not distinct from old.data_visita then
    ricalcola := false;
  end if;
  if ricalcola then
    j := public.fp_controllo_int(new.cantiere_id, new.data_visita, new.visita_id);
    if coalesce((j ->> 'fuori')::boolean, false) then
      new.fp_tipo := j ->> 'tipo'; new.fp_rif_visita_id := j -> 'ultima' ->> 'visita_id';
    else
      new.fp_tipo := null; new.fp_rif_visita_id := null;
    end if;
  end if;
  -- alla chiusura, con «fase nuova»: le lavorazioni sono le stesse della visita di riferimento?
  if new.stato = 'definitivo' and (tg_op = 'INSERT' or old.stato is distinct from 'definitivo')
     and new.fp_tipo is not null and new.fp_motivo_tipo = 'fase_nuova' and new.fp_rif_visita_id is not null then
    select case when not exists (select 1 from public.visite_lavorazioni l where l.visita_id = new.visita_id) then null
      else not exists (
        select lower(trim(coalesce(fase, ''))) || '|' || lower(trim(coalesce(lavorazione, ''))) from public.visite_lavorazioni where visita_id = new.visita_id
        except
        select lower(trim(coalesce(fase, ''))) || '|' || lower(trim(coalesce(lavorazione, ''))) from public.visite_lavorazioni where visita_id = new.fp_rif_visita_id)
      and not exists (
        select lower(trim(coalesce(fase, ''))) || '|' || lower(trim(coalesce(lavorazione, ''))) from public.visite_lavorazioni where visita_id = new.fp_rif_visita_id
        except
        select lower(trim(coalesce(fase, ''))) || '|' || lower(trim(coalesce(lavorazione, ''))) from public.visite_lavorazioni where visita_id = new.visita_id)
      end into new.fp_lavorazioni_uguali;
  end if;
  return new;
end $$;
drop trigger if exists trg_visite_zz_fuori_procedura on public.visite;
-- «zz»: dopo trg_visite_incarico_id, che riempie incarico_id da prot_int
create trigger trg_visite_zz_fuori_procedura before insert or update on public.visite
  for each row execute function public.tg_visite_fuori_procedura();

-- ── alla chiusura, il Coordinatore lo sa (push) ──
create or replace function public.push_fp_coordinatore()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_coord text; v_io text := lower(coalesce(auth.jwt() ->> 'email', '')); v_tec text; v_cant text;
begin
  begin
    if new.stato = 'definitivo' and coalesce(new.elimina, 0) = 0 and new.fp_tipo is not null and new.fp_esito is null
       and (tg_op = 'INSERT' or old.stato is distinct from 'definitivo') then
      select lower(valore) into v_coord from public.s_config where chiave = 'coordinatore_email';
      if coalesce(v_coord, '') <> '' and v_coord <> v_io then
        select coalesce(t.tecnico_cognome, '') into v_tec from public.tecnici t where t.tecnico_id = new.tecnico_id;
        select coalesce(c.cantiere_etichetta, trim(coalesce(c.cantiere_indirizzo, '') || ' ' || coalesce(c.cantiere_civico, '')), '') into v_cant
          from public.cantieri c where c.cantiere_id = new.cantiere_id;
        perform public.push_accoda(v_coord, 'fp_nuova:' || new.visita_id, 'Visita fuori procedura',
          'Verbale ' || coalesce(new.nr_verbale, '?') || ' di ' || coalesce(v_tec, '?') || ' su ' || coalesce(v_cant, '?')
            || case when new.fp_tipo = 'archiviato' then ' (cantiere archiviato)' else ' (rientro anticipato)' end
            || case when coalesce(new.fp_lavorazioni_uguali, false) then ', lavorazioni uguali alla visita prima' else '' end
            || ': da approvare nella Zona Coordinatore.',
          './?vista=admin', 'fp-' || new.visita_id);
      end if;
    end if;
  exception when others then raise warning 'push_fp_coordinatore: %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists trg_visite_zz_push_fp on public.visite;
create trigger trg_visite_zz_push_fp after insert or update of stato on public.visite
  for each row execute function public.push_fp_coordinatore();

revoke execute on function public.fp_regola_giorni(integer, text) from public, anon;
revoke execute on function public.fp_controllo_int(text, date, text) from public, anon, authenticated;
revoke execute on function public.fp_controllo(text, date, text) from public, anon;
revoke execute on function public.fp_rientri_dovuti(text) from public, anon;
revoke execute on function public.fp_riepilogo(date, date) from public, anon;
revoke execute on function public.fp_decidi(text, text, text) from public, anon;
revoke execute on function public.tg_visite_fuori_procedura() from public, anon;
revoke execute on function public.push_fp_coordinatore() from public, anon;
grant execute on function public.fp_regola_giorni(integer, text) to authenticated;
grant execute on function public.fp_controllo(text, date, text) to authenticated;
grant execute on function public.fp_rientri_dovuti(text) to authenticated;
grant execute on function public.fp_riepilogo(date, date) to authenticated;
grant execute on function public.fp_decidi(text, text, text) to authenticated;
