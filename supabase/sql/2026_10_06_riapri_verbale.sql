-- 06/10/2026 — LA SEGRETERIA RIAPRE UN VERBALE DEFINITIVO, CHE TORNA IN BOZZA AL TECNICO
-- (chiesto dall'utente: «quando schiaccio definitivo su un verbale riesco comunque a cambiare i dati e a rischiacciare
-- definitivo»; «la segreteria dovrebbe poter riaprire il verbale definitivo del tecnico che lo vede poi in bozza pronto
-- da correggere»). È la «rettifica dichiarata» decisa il 03/10: un definitivo non si cambia in silenzio.
--   · riapri_verbale(visita, motivo): solo segreteria; il verbale torna «bozza» (stesso numero, stesso tecnico), il
--     motivo resta scritto in visite_riaperture, e al tecnico arriva la notifica sul telefono;
--   · chiudi_verbale: richiudendo, la riapertura si segna come richiusa.
-- Mentre è in bozza il verbale resta fuori da statistiche e Osservatorio, come ogni bozza.

begin;

create table if not exists public.visite_riaperture (
  id bigserial primary key,
  visita_id text not null references public.visite(visita_id) on delete cascade,
  nr_verbale text,
  motivo text not null,
  riaperto_da text not null,
  riaperto_il timestamptz not null default now(),
  richiuso_il timestamptz
);
create index if not exists visite_riaperture_visita on public.visite_riaperture (visita_id);
alter table public.visite_riaperture enable row level security;
drop policy if exists visite_riaperture_lettura on public.visite_riaperture;
-- il tecnico legge il motivo della riapertura del suo verbale (come legge il verbale); scrive solo il database
create policy visite_riaperture_lettura on public.visite_riaperture for select to authenticated
  using ((select public.is_personale()) and exists (select 1 from public.visite v where v.visita_id = visite_riaperture.visita_id));
revoke all on public.visite_riaperture from public, anon, authenticated;
grant select on public.visite_riaperture to authenticated;
revoke all on sequence public.visite_riaperture_id_seq from public, anon, authenticated;

create or replace function public.riapri_verbale(p_visita_id text, p_motivo text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v record;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  mail_tec text;
begin
  if not (coalesce(public.is_segreteria(), false) or session_user = 'postgres') then
    raise exception 'Riaprire un verbale definitivo spetta alla segreteria';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Scrivi che cosa va corretto: il tecnico lo legge quando riapre la bozza';
  end if;
  select visita_id, nr_verbale, stato, elimina, tecnico_id into v from public.visite where visita_id = p_visita_id for update;
  if not found then raise exception 'Verbale % non trovato', p_visita_id; end if;
  if coalesce(v.elimina, 0) <> 0 then raise exception 'Il verbale % è eliminato', coalesce(v.nr_verbale, p_visita_id); end if;
  if v.stato is distinct from 'definitivo' then
    raise exception 'Il verbale % non è definitivo (è «%»): non c''è niente da riaprire', coalesce(v.nr_verbale, p_visita_id), coalesce(v.stato, '—');
  end if;

  update public.visite set stato = 'bozza' where visita_id = p_visita_id;
  insert into public.visite_riaperture (visita_id, nr_verbale, motivo, riaperto_da)
  values (p_visita_id, v.nr_verbale, btrim(p_motivo), chi);

  -- la notifica al tecnico: se non parte, la riapertura resta valida (il verbale è comunque fra le sue bozze)
  begin
    select lower(email) into mail_tec from public.tecnici where tecnico_id = v.tecnico_id;
    if coalesce(mail_tec, '') <> '' then
      perform public.push_accoda(mail_tec, 'verbale_riaperto', 'Verbale riaperto',
        'La segreteria ha riaperto il verbale ' || coalesce(v.nr_verbale, '') || ': lo trovi fra le bozze da correggere. ' || left(btrim(p_motivo), 140),
        './?vista=lista', 'riapertura-' || p_visita_id);
    end if;
  exception when others then raise warning 'riapri_verbale (notifica): %', sqlerrm;
  end;
  return jsonb_build_object('ok', true, 'nr_verbale', v.nr_verbale, 'notifica', coalesce(mail_tec, '') <> '');
end $$;
revoke execute on function public.riapri_verbale(text, text) from public, anon;
grant execute on function public.riapri_verbale(text, text) to authenticated;

-- la riapertura segnata come richiusa: chiudi_verbale gira coi permessi del tecnico, che qui può solo leggere
create or replace function public.riapertura_richiusa(p_visita_id text)
returns void
language sql security definer
set search_path to 'public'
as $$
  update public.visite_riaperture r set richiuso_il = now()
   where r.visita_id = p_visita_id and r.richiuso_il is null
     and exists (select 1 from public.visite v where v.visita_id = p_visita_id and v.stato = 'definitivo');
$$;
revoke execute on function public.riapertura_richiusa(text) from public, anon;
grant execute on function public.riapertura_richiusa(text) to authenticated;

-- chiudi_verbale di prima, più la riapertura segnata come richiusa
create or replace function public.chiudi_verbale(p_visita_id text)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  st text;
  manca jsonb;
begin
  select stato into st from public.visite where visita_id = p_visita_id for update;
  if not found then
    raise exception 'Verbale % non trovato, oppure non visibile a chi lo chiede.', p_visita_id using errcode = 'P0002';
  end if;
  if st = 'definitivo' then
    return jsonb_build_object('ok', true, 'gia_definitivo', true, 'mancanze', '[]'::jsonb);
  end if;
  manca := public.verbale_mancanze(p_visita_id);
  if jsonb_array_length(manca) > 0 then
    return jsonb_build_object('ok', false, 'mancanze', manca);
  end if;
  perform set_config('app.chiusura_verbale', p_visita_id, true);
  update public.visite set stato = 'definitivo' where visita_id = p_visita_id;
  perform set_config('app.chiusura_verbale', '', true);
  -- (06/10/2026) se era stato riaperto dalla segreteria, la riapertura è chiusa
  perform public.riapertura_richiusa(p_visita_id);
  return jsonb_build_object('ok', true, 'mancanze', '[]'::jsonb);
end
$$;

commit;
