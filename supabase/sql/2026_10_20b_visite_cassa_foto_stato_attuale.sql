-- 20/10/2026 (sera) — FOTO DELLO STATO IN CASSA ANCHE PER IL 2025-26, CON LO STATO ATTUALE
-- Decisione dell'utente: «per il 25 26 possiamo mettere automaticamente lo stato attuale e salviamo così
-- i dati per tutte le ceiv». Per le visite dell'esercizio 2025-26 (dal 01/10/2025) che nessuna lista
-- conservata copre (lo storico parte dal 30/08/2026), la foto si riempie UNA VOLTA con lo stato del giorno
-- in cui si scrive, e da lì resta ferma come le altre.
-- Deve restare distinguibile: colonna `riferimento`
--   data_visita   = stato alla data della visita (storico o chiusura del verbale)
--   stato_attuale = stato del giorno della foto (stato_al), NON alla data della visita
-- La regola resta cassa_stato_al; cassa_stato_foto aggiunge solo il ripiego dichiarato.
-- Le visite prima del 01/10/2025 restano senza foto. Se un giorno si caricano nello storico le liste vecchie,
-- i verbali 2025-26 chiusi DOPO quel giorno useranno la lista alla data; le foto già scritte non cambiano.

alter table public.visite_cassa_foto
  add column if not exists riferimento text not null default 'data_visita',
  add column if not exists stato_al date;
alter table public.visite_cassa_foto drop constraint if exists visite_cassa_foto_riferimento_ck;
alter table public.visite_cassa_foto add constraint visite_cassa_foto_riferimento_ck
  check (riferimento in ('data_visita', 'stato_attuale'));
-- le 198 foto già scritte sono alla data della visita (il blocco non guarda ancora stato_al)
update public.visite_cassa_foto set stato_al = data_visita where stato_al is null;

comment on column public.visite_cassa_foto.riferimento is
  'data_visita = stato alla data della visita; stato_attuale = stato del giorno della foto (stato_al), non alla data della visita: per il 2025-26 senza liste conservate (decisione dell''utente del 20/10/2026)';
comment on column public.visite_cassa_foto.stato_al is 'Il giorno a cui si riferisce lo stato fotografato';

create or replace function public.visite_cassa_foto_immutabile()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.visite where visita_id = old.visita_id) then
      raise exception 'La foto dello stato in Cassa di un verbale non si cancella (regola d''oro 7): verbale %, impresa %.',
        old.visita_id, old.impresa_id_foto using errcode = '42501';
    end if;
    return old;
  end if;
  if (new.visita_id, new.impresa_id_foto, new.data_visita, new.stato, new.cassa, new.cod_ceiv, new.fonte,
      new.lista_del, new.iscritta_ceiv, new.nota, new.modo, new.fotografato_il, new.riferimento, new.stato_al)
     is distinct from
     (old.visita_id, old.impresa_id_foto, old.data_visita, old.stato, old.cassa, old.cod_ceiv, old.fonte,
      old.lista_del, old.iscritta_ceiv, old.nota, old.modo, old.fotografato_il, old.riferimento, old.stato_al) then
    raise exception 'La foto dello stato in Cassa di un verbale non si riscrive (regola d''oro 7): verbale %, impresa %. Si può spostare solo l''impresa (unioni, cambio di chiave).',
      old.visita_id, old.impresa_id_foto using errcode = '42501';
  end if;
  return new;
end $$;

-- ── Stato da fotografare: alla data della visita se c'è una lista; per il 2025-26 senza lista, lo stato di oggi ──
create or replace function public.cassa_stato_foto(p_impresa text, p_data date)
returns table (stato text, cassa text, cod_ceiv text, fonte text, lista_del date, iscritta_ceiv boolean, nota text,
               riferimento text, stato_al date)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
declare
  c record;
  a record;
begin
  select * into c from public.cassa_stato_al(p_impresa, p_data);
  if c.fonte <> 'nessuna' then
    return query select c.stato, c.cassa, c.cod_ceiv, c.fonte, c.lista_del, c.iscritta_ceiv, c.nota, 'data_visita'::text, p_data;
    return;
  end if;
  -- prima dell'esercizio 2025-26: niente foto
  if p_data is null or p_data < date '2025-10-01' then
    return query select c.stato, c.cassa, c.cod_ceiv, c.fonte, c.lista_del, c.iscritta_ceiv, c.nota, null::text, null::date;
    return;
  end if;
  select * into a from public.cassa_stato_al(p_impresa, current_date);
  return query select a.stato, a.cassa, a.cod_ceiv, a.fonte, a.lista_del, a.iscritta_ceiv,
    'STATO ATTUALE, NON ALLA DATA DELLA VISITA: per il ' || to_char(p_data, 'DD/MM/YYYY')
      || ' non c''è una lista della Cassa conservata; stato al ' || to_char(current_date, 'DD/MM/YYYY')
      || ' (decisione dell''utente del 20/10/2026). ' || coalesce(a.nota, ''),
    'stato_attuale'::text, current_date;
end $$;

create or replace function public.cassa_foto_verbale(p_visita_id text, p_modo text default 'chiusura')
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v record;
  n integer := 0;
begin
  select visita_id, data_visita, stato into v from public.visite where visita_id = p_visita_id;
  if not found or v.stato is distinct from 'definitivo' then
    return 0;
  end if;
  insert into public.visite_cassa_foto
         (visita_id, impresa_id, impresa_id_foto, data_visita, stato, cassa, cod_ceiv, fonte, lista_del, iscritta_ceiv, nota, modo,
          riferimento, stato_al)
  select v.visita_id, p.impresa_id, p.impresa_id, v.data_visita, c.stato, c.cassa, c.cod_ceiv, c.fonte, c.lista_del,
         c.iscritta_ceiv, c.nota, coalesce(p_modo, 'chiusura'), c.riferimento, c.stato_al
    from (select distinct vp.impresa_id from public.visite_imprese_presenti vp
           where vp.visita_id = v.visita_id and coalesce(btrim(vp.impresa_id), '') <> '') p
   cross join lateral public.cassa_stato_foto(p.impresa_id, v.data_visita) c
   where c.fonte <> 'nessuna'
     and not exists (select 1 from public.visite_cassa_foto f
                      where f.visita_id = v.visita_id and (f.impresa_id = p.impresa_id or f.impresa_id_foto = p.impresa_id))
  on conflict (visita_id, impresa_id_foto) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

drop view if exists public.v_visite_cassa;
create view public.v_visite_cassa with (security_invoker = true) as
select p.visita_id, v.data_visita, p.impresa_id, p.is_principale,
       f.stato as stato_foto, f.fonte, f.lista_del, f.iscritta_ceiv, f.cod_ceiv as cod_ceiv_foto,
       f.riferimento, f.stato_al,
       m.stato_cassa as stato_oggi,
       (f.fonte is not null) as da_foto,
       coalesce(f.riferimento = 'data_visita', false) as alla_data_visita,
       case when f.fonte is not null then
              case when f.iscritta_ceiv and f.stato = 'Attiva' then 'attiva'
                   when f.iscritta_ceiv and f.stato = 'Sospesa' then 'sospesa'
                   else 'non_ceiv' end
            else
              case m.stato_cassa when 'Attiva' then 'attiva' when 'Sospesa' then 'sospesa' else 'non_ceiv' end
       end as categoria
  from public.visite_imprese_presenti p
  join public.visite v on v.visita_id = p.visita_id
  left join public.imprese m on m.impresa_id = p.impresa_id
  left join lateral (
    select z.* from public.visite_cassa_foto z
     where z.visita_id = p.visita_id and z.impresa_id = p.impresa_id
     order by z.iscritta_ceiv desc, case z.stato when 'Attiva' then 0 when 'Sospesa' then 1 else 2 end, z.id
     limit 1) f on true;
comment on view public.v_visite_cassa is
  'Stato in Cassa per visita e impresa presente. da_foto: c''è la foto; alla_data_visita: la foto è alla data della visita (riferimento data_visita), altrimenti è lo stato del giorno stato_al. Senza foto: stato di oggi. categoria: attiva | sospesa | non_ceiv. 20/10/2026.';
revoke all on public.v_visite_cassa from anon;
grant select on public.v_visite_cassa to authenticated;

revoke all on function public.cassa_stato_foto(text, date) from public, anon, authenticated;
revoke all on function public.cassa_foto_verbale(text, text) from public, anon, authenticated;

-- Riempimento, una volta: select public.cassa_foto_recupera(date '2025-10-01');
