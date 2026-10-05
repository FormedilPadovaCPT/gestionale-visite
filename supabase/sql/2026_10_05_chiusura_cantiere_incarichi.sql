-- 05/10/2026 — Chiudendo un cantiere si chiudono anche i suoi incarichi (richiesta dell'utente:
-- «quando si chiude un cantiere, se ci sono incarichi assegnati su quel cantiere, si chiudono in
-- automatico dicendo: ok, chiudo cantiere e incarico x»).
--
-- Un incarico appartiene a un cantiere se: incarichi.cantiere_id = il cantiere, oppure una sua visita
-- (visite.incarico_id) sta su quel cantiere, oppure la visita registrata sull'incarico (incarichi.visita_id)
-- sta su quel cantiere. incarichi.cantiere_id è vuoto su tutti i 1.081 incarichi al 05/10: il legame vero
-- passa dalle visite.
--
-- ⚠️ Un incarico si chiude solo quando si chiude l'ULTIMO dei suoi cantieri. Al 05/10, 9 dei 28 incarichi
-- aperti hanno visite su più cantieri (la serie Vittadello del tram: 52 visite su 23 cantieri): chiudere uno
-- di quei cantieri non chiude la serie, e la conferma lo dice.
-- Restano fuori gli incarichi di STAGE: si chiudono quando parte la relazione (stage-relazione.js).
--
-- La chiusura si annota sull'incarico (chiuso_dal_cantiere, stato_prima_chiusura), così «Riapri cantiere»
-- riapre gli incarichi chiusi con lui, e solo quelli, nello stato in cui erano. Chi chiude o riapre un
-- incarico a mano (incarichi_set_stato) cancella l'annotazione: da lì in poi l'incarico non segue il cantiere.
--
-- ⚠️ Correzione dello stesso giorno: la tabella incarichi ha la protezione tg_incarichi_guard, che rimette stato
-- e chiusura com'erano se chi scrive non è is_gestione_incarichi() — cioè la sola segreteria. Il COORDINATORE può
-- chiudere cantieri ma non è «gestione incarichi»: senza il permesso di sistema la protezione annullava la chiusura
-- degli incarichi in silenzio, mentre l'avviso diceva «chiuso». Le due funzioni ora alzano app.incarico_sistema
-- (la deroga che la protezione prevede) solo per questo aggiornamento, e l'elenco dei chiusi/riaperti si legge da
-- RETURNING, cioè da quello che è stato davvero scritto. Scoperto chiudendo l'arretrato #1072 da amministratore.

alter table public.incarichi
  add column if not exists chiuso_dal_cantiere text,
  add column if not exists stato_prima_chiusura text;

comment on column public.incarichi.chiuso_dal_cantiere is
  'Cantiere la cui chiusura ha chiuso questo incarico (chiudi_cantiere, dal 05/10/2026); lo usa riapri_cantiere per riaprirlo.';
comment on column public.incarichi.stato_prima_chiusura is
  'Stato dell''incarico (aperto/eseguito) prima che lo chiudesse la chiusura del cantiere; riapri_cantiere lo rimette.';

-- Gli incarichi ancora aperti (aperto o eseguito) di un cantiere, con quanti ALTRI cantieri aperti hanno.
-- si_chiude = true quando questo è l'ultimo cantiere aperto dell'incarico e non è uno stage.
create or replace function public.incarichi_del_cantiere(p_cantiere_id text)
returns table (id bigint, stato text, tipo_richiesta text, tecnico_nome text, impresa text,
               altri_cantieri_aperti int, stage boolean, si_chiude boolean)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not (public.is_segreteria() or public.is_coordinatore()) then
    raise exception 'Operazione consentita solo al coordinatore o alla segreteria';
  end if;
  return query
  with legati as (
    select i.id as inc from public.incarichi i where i.cantiere_id = p_cantiere_id
    union
    select v.incarico_id from public.visite v
     where v.cantiere_id = p_cantiere_id and v.incarico_id is not null and coalesce(v.elimina,0) = 0
    union
    select i.id from public.incarichi i join public.visite v on v.visita_id = i.visita_id
     where v.cantiere_id = p_cantiere_id
  ), cantieri_inc as (
    -- tutti i cantieri di ciascun incarico, dalle stesse tre strade
    select i.id as inc, i.cantiere_id as cid from public.incarichi i join legati l on l.inc = i.id where i.cantiere_id is not null
    union
    select v.incarico_id, v.cantiere_id from public.visite v join legati l on l.inc = v.incarico_id
     where v.cantiere_id is not null and coalesce(v.elimina,0) = 0
    union
    select i.id, v.cantiere_id from public.incarichi i join legati l on l.inc = i.id join public.visite v on v.visita_id = i.visita_id
     where v.cantiere_id is not null
  ), altri as (
    select ci.inc, count(distinct ci.cid)::int as n
      from cantieri_inc ci join public.cantieri c on c.cantiere_id = ci.cid
     where ci.cid <> p_cantiere_id and coalesce(c.cantiere_chiuso,false) = false and coalesce(c.elimina,0) = 0
     group by ci.inc
  )
  select i.id, i.stato, i.tipo_richiesta, i.tecnico_nome, i.impresa,
         coalesce(a.n, 0), (i.stage_elenco_id is not null),
         (coalesce(a.n, 0) = 0 and i.stage_elenco_id is null)
    from public.incarichi i join legati l on l.inc = i.id left join altri a on a.inc = i.id
   where i.stato in ('aperto','eseguito')
   order by i.id;
end $$;

revoke all on function public.incarichi_del_cantiere(text) from public, anon;
grant execute on function public.incarichi_del_cantiere(text) to authenticated;

create or replace function public.chiudi_cantiere(p_cantiere_id text, p_motivo text default 'termini_lavori', p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_visite int;
  v_inc jsonb;
  v_chiusi jsonb;
  v_restano jsonb;
begin
  if not (public.is_segreteria() or public.is_coordinatore()) then
    raise exception 'Operazione consentita solo al coordinatore o alla segreteria';
  end if;
  if not exists (select 1 from public.cantieri where cantiere_id = p_cantiere_id) then
    raise exception 'Cantiere inesistente';
  end if;

  -- gli incarichi si leggono PRIMA di chiudere il cantiere: «altri cantieri aperti» non deve contare questo
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_inc from public.incarichi_del_cantiere(p_cantiere_id) t;

  update public.cantieri
     set cantiere_chiuso = true,
         data_chiusura   = now(),
         chiuso_da       = v_email,
         motivo_chiusura = coalesce(p_motivo,'termini_lavori'),
         note_chiusura   = nullif(trim(coalesce(p_note,'')),''),
         updated_at      = now()
   where cantiere_id = p_cantiere_id;

  update public.visite
     set chiusa        = true,
         data_chiusura = now()
   where cantiere_id = p_cantiere_id
     and coalesce(chiusa,false) = false
     and coalesce(elimina,0) = 0;
  get diagnostics v_visite = row_count;

  perform set_config('app.incarico_sistema', '1', true);
  with chiusi as (
    update public.incarichi i
       set stato_prima_chiusura = i.stato,
           chiuso_dal_cantiere  = p_cantiere_id,
           stato     = 'chiuso',
           chiuso_il = coalesce(i.chiuso_il, now()),
           chiuso_da = coalesce(i.chiuso_da, v_email)
      from jsonb_to_recordset(v_inc) as t(id bigint, si_chiude boolean)
     where t.id = i.id and t.si_chiude and i.stato in ('aperto','eseguito')
    returning i.id, i.tipo_richiesta, i.tecnico_nome, i.impresa, i.stato
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo_richiesta, 'tecnico', tecnico_nome, 'impresa', impresa) order by id)
                  filter (where stato = 'chiuso'), '[]'::jsonb)
    into v_chiusi from chiusi;
  perform set_config('app.incarico_sistema', '', true);
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'tipo', t.tipo_richiesta, 'tecnico', t.tecnico_nome,
                    'altri_cantieri_aperti', t.altri_cantieri_aperti, 'stage', t.stage) order by t.id), '[]'::jsonb)
    into v_restano
    from jsonb_to_recordset(v_inc) as t(id bigint, tipo_richiesta text, tecnico_nome text, altri_cantieri_aperti int, stage boolean, si_chiude boolean)
   where not t.si_chiude;

  return jsonb_build_object('ok', true, 'cantiere_id', p_cantiere_id,
                            'visite_chiuse', v_visite, 'chiuso_da', v_email,
                            'incarichi_chiusi', v_chiusi, 'incarichi_restano', v_restano);
end $$;

create or replace function public.riapri_cantiere(p_cantiere_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_visite int;
  v_riaperti jsonb;
begin
  if not (public.is_segreteria() or public.is_coordinatore()) then
    raise exception 'Operazione consentita solo al coordinatore o alla segreteria';
  end if;

  update public.cantieri
     set cantiere_chiuso = false, data_chiusura = null, chiuso_da = null,
         motivo_chiusura = null, updated_at = now()
   where cantiere_id = p_cantiere_id;

  update public.visite set chiusa = false, data_chiusura = null
   where cantiere_id = p_cantiere_id and chiusa = true;
  get diagnostics v_visite = row_count;

  -- solo gli incarichi chiusi DA questo cantiere, nello stato che avevano
  perform set_config('app.incarico_sistema', '1', true);
  with r as (
    update public.incarichi
       set stato = coalesce(stato_prima_chiusura, 'aperto'),
           chiuso_il = null, chiuso_da = null,
           chiuso_dal_cantiere = null, stato_prima_chiusura = null
     where chiuso_dal_cantiere = p_cantiere_id and stato = 'chiuso'
    returning id, tipo_richiesta, tecnico_nome, stato
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'tipo', r.tipo_richiesta, 'tecnico', r.tecnico_nome) order by r.id)
                  filter (where r.stato <> 'chiuso'), '[]'::jsonb)
    into v_riaperti from r;
  perform set_config('app.incarico_sistema', '', true);

  return jsonb_build_object('ok', true, 'cantiere_id', p_cantiere_id, 'visite_riaperte', v_visite,
                            'incarichi_riaperti', v_riaperti);
end $$;

-- Un incarico chiuso o riaperto a mano non è più «chiuso dal cantiere»: la riapertura del cantiere non deve
-- toccarlo dopo.
create or replace function public.incarichi_set_stato(p_id bigint, p_stato text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_gestione_incarichi() then
    raise exception 'Operazione riservata alla segreteria/coordinatore';
  end if;
  if p_stato not in ('aperto','eseguito','chiuso') then raise exception 'stato non valido'; end if;
  update public.incarichi set
    stato = p_stato,
    chiuso_il = case when p_stato='chiuso' then coalesce(chiuso_il, now()) else null end,
    chiuso_da = case when p_stato='chiuso' then coalesce(chiuso_da, auth.jwt() ->> 'email') else null end,
    chiuso_dal_cantiere = null,
    stato_prima_chiusura = null
  where id = p_id;
end; $$;
