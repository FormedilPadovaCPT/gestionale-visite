-- 20/10/2026 — LO STATO IN CASSA EDILE FOTOGRAFATO NEL VERBALE
-- Chiesto dall'utente preparando le statistiche per la Commissione Salute e Sicurezza:
-- «nei verbali questo dato dovrebbe essere fotografato e cristallizzato al momento della visita».
-- Prima le statistiche leggevano imprese.stato_cassa, che cambia a ogni lista mensile della Cassa:
-- una visita di marzo a un'impresa sospesa a ottobre risultava «sospesa».
--
-- Disegno:
--   * visite_cassa_foto: una riga per visita × impresa presente, scritta SOLO dal database e mai riscritta
--     (regola d'oro 7). Tabella a parte perché salva_figli_verbale cancella e riscrive
--     visite_imprese_presenti a ogni salvataggio: una colonna lì si perderebbe alla prima riapertura.
--   * cassa_stato_al(impresa, data): la regola, una sola. Vale la lista della Cassa valida alla data
--     della visita (l'ultima caricata in quel giorno o prima), non quella del giorno della chiusura.
--     Fra più posizioni C.E.I.V. della stessa impresa (unioni di schede) si prende la migliore,
--     come ceiv_aggancio: Attiva, Sospesa, Cessata, Non iscritta.
--     Chi non è nella lista è «Non in lista» (fonte anagrafica): non C.E.I.V.
--     Prima della prima lista conservata non si ricostruisce niente e NON si scrive nessuna riga:
--     così, se un giorno si caricano nello storico le liste più vecchie, quei verbali si possono ancora riempire.
--   * Si fotografa quando il verbale diventa definitivo (anche dentro chiudi_verbale, che resta com'è)
--     e quando a un verbale già definitivo si aggiunge un'impresa. Chi è già fotografato non si tocca.
--   * Unioni e cambio di chiave spostano impresa_id da sole (aggiornano ogni tabella con quella colonna);
--     impresa_id_foto resta quello del giorno della foto. Per questo niente chiave esterna verso imprese:
--     una seconda relazione visite↔imprese confonderebbe gli embed di PostgREST.

create table if not exists public.visite_cassa_foto (
  id              bigint generated always as identity primary key,
  visita_id       text not null references public.visite(visita_id) on delete cascade,
  impresa_id      text not null,
  impresa_id_foto text not null,
  data_visita     date,
  stato           text,
  cassa           text,
  cod_ceiv        text,
  fonte           text not null check (fonte in ('lista', 'manuale', 'anagrafica')),
  lista_del       date,
  iscritta_ceiv   boolean not null,
  nota            text,
  modo            text not null check (modo in ('chiusura', 'recupero')),
  fotografato_il  timestamptz not null default now(),
  constraint visite_cassa_foto_un unique (visita_id, impresa_id_foto)
);
create index if not exists visite_cassa_foto_impresa on public.visite_cassa_foto (impresa_id);

comment on table public.visite_cassa_foto is
  'Stato in Cassa Edile di ogni impresa presente, alla data della visita. Scritta dal database quando il verbale diventa definitivo (cassa_foto_verbale), mai riscritta. 20/10/2026.';
comment on column public.visite_cassa_foto.fonte is
  'lista = stato nella lista della Cassa; manuale = scritto dalla segreteria dopo la verifica diretta; anagrafica = impresa non in lista (cassa letta dall''anagrafica)';
comment on column public.visite_cassa_foto.iscritta_ceiv is
  'Attiva o Sospesa da lista o da verifica della segreteria = iscritta; tutto il resto no (regola del 01/10/2026)';

-- ── La foto non si riscrive: si può spostare solo impresa_id (unioni, cambio di chiave) ──
create or replace function public.visite_cassa_foto_immutabile()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    -- si cancella solo con il verbale (cascade): allora la visita non c'è già più
    if exists (select 1 from public.visite where visita_id = old.visita_id) then
      raise exception 'La foto dello stato in Cassa di un verbale non si cancella (regola d''oro 7): verbale %, impresa %.',
        old.visita_id, old.impresa_id_foto using errcode = '42501';
    end if;
    return old;
  end if;
  if (new.visita_id, new.impresa_id_foto, new.data_visita, new.stato, new.cassa, new.cod_ceiv, new.fonte,
      new.lista_del, new.iscritta_ceiv, new.nota, new.modo, new.fotografato_il)
     is distinct from
     (old.visita_id, old.impresa_id_foto, old.data_visita, old.stato, old.cassa, old.cod_ceiv, old.fonte,
      old.lista_del, old.iscritta_ceiv, old.nota, old.modo, old.fotografato_il) then
    raise exception 'La foto dello stato in Cassa di un verbale non si riscrive (regola d''oro 7): verbale %, impresa %. Si può spostare solo l''impresa (unioni, cambio di chiave).',
      old.visita_id, old.impresa_id_foto using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_visite_cassa_foto_immutabile on public.visite_cassa_foto;
create trigger trg_visite_cassa_foto_immutabile
  before update or delete on public.visite_cassa_foto
  for each row execute function public.visite_cassa_foto_immutabile();

-- ── La regola: stato in Cassa di un'impresa a una data ──
create or replace function public.cassa_stato_al(p_impresa text, p_data date)
returns table (stato text, cassa text, cod_ceiv text, fonte text, lista_del date, iscritta_ceiv boolean, nota text)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
declare
  v_lista date;
  v_prima date;
  v_corrente date;
  r record;
  l record;
  i record;
  _ord constant text[] := array['Attiva', 'Sospesa', 'Cessata', 'Non iscritta'];
begin
  -- la lista valida alla data: l'ultima registrata nello storico in quel giorno o prima
  select max(d) into v_lista from (
    select s.visto_dal as d from public.imprese_cassa_storico s where s.fonte = 'lista' and s.visto_dal <= p_data
    union all
    select s.visto_fino from public.imprese_cassa_storico s where s.fonte = 'lista' and s.visto_fino <= p_data) x;

  if p_data is null or v_lista is null then
    select min(s.visto_dal) into v_prima from public.imprese_cassa_storico s where s.fonte = 'lista';
    return query select null::text, null::text, null::text, 'nessuna'::text, null::date, null::boolean,
      case when p_data is null then 'Visita senza data: stato in Cassa non ricostruibile.'
           else 'Visita del ' || to_char(p_data, 'DD/MM/YYYY') || ', prima della prima lista della Cassa conservata nello storico ('
                || coalesce(to_char(v_prima, 'DD/MM/YYYY'), 'nessuna') || '): stato alla data della visita non ricostruibile.' end;
    return;
  end if;

  -- per ogni posizione C.E.I.V. la riga più recente valida alla data; fra le posizioni, la migliore
  select q.* into r from (
    select distinct on (coalesce(s.cod_ceiv, '')) s.*
      from public.imprese_cassa_storico s
     where s.impresa_id = p_impresa
       and s.fonte in ('lista', 'manuale')
       and s.visto_dal <= p_data
       and (s.attuale or s.visto_fino >= v_lista)
     order by coalesce(s.cod_ceiv, ''), s.visto_dal desc, s.id desc) q
  order by coalesce(array_position(_ord, q.stato), 99), q.visto_dal desc, q.id desc
  limit 1;

  if found then
    return query select r.stato, coalesce(nullif(btrim(r.cassa), ''), 'C.E.I.V.'), r.cod_ceiv, r.fonte, v_lista,
      (r.stato in ('Attiva', 'Sospesa')),
      case when r.fonte = 'manuale'
           then 'Stato scritto dalla segreteria il ' || to_char(r.visto_dal, 'DD/MM/YYYY') || ' (ultima lista della Cassa prima della visita: '
                || to_char(v_lista, 'DD/MM/YYYY') || ').'
           else 'Lista della Cassa del ' || to_char(v_lista, 'DD/MM/YYYY') || '.' end;
    return;
  end if;

  -- nessuna riga di storico: se la lista in vigore era già quella valida alla data, la si guarda direttamente
  -- (un'impresa entrata in anagrafica dopo il caricamento, con codice fiscale o partita IVA della lista)
  select max(aggiornata_il) into v_corrente from public.ceiv_lista;
  if v_corrente is not null and v_corrente <= p_data and v_corrente >= v_lista then
    select x.codice, coalesce(x.stato, 'Non iscritta') as st into l
      from public.imprese m
      join public.ceiv_lista x
        on x.cf = m.impresa_id or x.piva = m.impresa_id
        or (nullif(btrim(m.piva), '') is not null and x.piva = m.piva)
        or (nullif(btrim(m.impresa_cf), '') is not null and x.cf = m.impresa_cf)
     where m.impresa_id = p_impresa
     order by coalesce(array_position(_ord, coalesce(x.stato, 'Non iscritta')), 99)
     limit 1;
    if found then
      return query select l.st, 'C.E.I.V.'::text, l.codice, 'lista'::text, v_corrente, (l.st in ('Attiva', 'Sospesa')),
        'Lista della Cassa del ' || to_char(v_corrente, 'DD/MM/YYYY') || ' (trovata per codice fiscale o partita IVA, non ancora nello storico).';
      return;
    end if;
  end if;

  -- non in lista: non C.E.I.V.
  select m.cassa_edile, m.stato_cassa into i from public.imprese m where m.impresa_id = p_impresa;
  return query select 'Non in lista'::text, nullif(btrim(i.cassa_edile), ''), null::text, 'anagrafica'::text, v_lista, false,
    'Non nella lista della Cassa del ' || to_char(v_lista, 'DD/MM/YYYY') || '.'
    || coalesce(' In anagrafica: ' || nullif(btrim(i.stato_cassa), '') || '.', '')
    || coalesce(' Cassa indicata in anagrafica: ' || nullif(btrim(i.cassa_edile), '') || '.', '');
end $$;

-- ── La foto di un verbale: solo se definitivo, solo le imprese non ancora fotografate ──
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
         (visita_id, impresa_id, impresa_id_foto, data_visita, stato, cassa, cod_ceiv, fonte, lista_del, iscritta_ceiv, nota, modo)
  select v.visita_id, p.impresa_id, p.impresa_id, v.data_visita, c.stato, c.cassa, c.cod_ceiv, c.fonte, c.lista_del,
         c.iscritta_ceiv, c.nota, coalesce(p_modo, 'chiusura')
    from (select distinct vp.impresa_id from public.visite_imprese_presenti vp
           where vp.visita_id = v.visita_id and coalesce(btrim(vp.impresa_id), '') <> '') p
   cross join lateral public.cassa_stato_al(p.impresa_id, v.data_visita) c
   where c.fonte <> 'nessuna'
     and not exists (select 1 from public.visite_cassa_foto f
                      where f.visita_id = v.visita_id and (f.impresa_id = p.impresa_id or f.impresa_id_foto = p.impresa_id))
  on conflict (visita_id, impresa_id_foto) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Quando scatta: il verbale diventa definitivo, o a un definitivo si aggiunge un'impresa ──
-- Un errore della foto non deve impedire di chiudere un verbale: si avvisa e la riga manca
-- (la ritrova cassa_foto_recupera, e il controllo del lunedì conta i definitivi senza foto).
create or replace function public.tg_visite_cassa_foto()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  begin
    perform public.cassa_foto_verbale(new.visita_id, 'chiusura');
  exception when others then
    raise warning 'foto dello stato in Cassa non scritta per il verbale %: %', new.visita_id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists trg_visite_zz_cassa_foto on public.visite;
create trigger trg_visite_zz_cassa_foto
  after update of stato on public.visite
  for each row when (new.stato = 'definitivo' and old.stato is distinct from 'definitivo')
  execute function public.tg_visite_cassa_foto();

create or replace function public.tg_vip_cassa_foto()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v text;
begin
  for v in select distinct n.visita_id from nuove n
             join public.visite x on x.visita_id = n.visita_id and x.stato = 'definitivo' loop
    begin
      perform public.cassa_foto_verbale(v, 'chiusura');
    exception when others then
      raise warning 'foto dello stato in Cassa non scritta per il verbale %: %', v, sqlerrm;
    end;
  end loop;
  return null;
end $$;

drop trigger if exists trg_vip_zz_cassa_foto on public.visite_imprese_presenti;
create trigger trg_vip_zz_cassa_foto
  after insert on public.visite_imprese_presenti
  referencing new table as nuove
  for each statement execute function public.tg_vip_cassa_foto();

-- ── Recupero: i definitivi già chiusi dal giorno indicato (dalla prima lista conservata, di norma) ──
create or replace function public.cassa_foto_recupera(p_dal date)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v record;
  n integer := 0;
  nv integer := 0;
  k integer;
begin
  for v in select visita_id from public.visite
            where stato = 'definitivo' and coalesce(elimina, 0) = 0 and data_visita >= p_dal
            order by data_visita, visita_id loop
    k := public.cassa_foto_verbale(v.visita_id, 'recupero');
    n := n + k;
    if k > 0 then nv := nv + 1; end if;
  end loop;
  return jsonb_build_object('dal', p_dal, 'verbali_fotografati', nv, 'righe', n);
end $$;

-- ── Lettura per statistiche e query a mano: la foto quando c'è, lo stato di oggi quando manca ──
create or replace view public.v_visite_cassa with (security_invoker = true) as
select p.visita_id, v.data_visita, p.impresa_id, p.is_principale,
       f.stato as stato_foto, f.fonte, f.lista_del, f.iscritta_ceiv, f.cod_ceiv as cod_ceiv_foto,
       m.stato_cassa as stato_oggi,
       (f.fonte is not null) as da_foto,
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
  'Stato in Cassa per visita e impresa presente: foto alla data della visita (da_foto = true) o, se manca, stato di oggi. categoria: attiva | sospesa | non_ceiv. 20/10/2026.';

-- ── Permessi: si legge come le imprese presenti, si scrive solo dal database ──
alter table public.visite_cassa_foto enable row level security;
revoke all on public.visite_cassa_foto from anon, authenticated;
grant select on public.visite_cassa_foto to authenticated;
drop policy if exists visite_cassa_foto_sel on public.visite_cassa_foto;
create policy visite_cassa_foto_sel on public.visite_cassa_foto
  for select to authenticated using ((select public.is_personale()));
drop policy if exists visite_cassa_foto_solo_proprie on public.visite_cassa_foto;
create policy visite_cassa_foto_solo_proprie on public.visite_cassa_foto
  as restrictive for all to authenticated
  using ((not (select public.solo_proprie())) or exists (select 1 from public.visite x where x.visita_id = visite_cassa_foto.visita_id));

revoke all on public.v_visite_cassa from anon;
grant select on public.v_visite_cassa to authenticated;

revoke all on function public.cassa_stato_al(text, date) from public, anon, authenticated;
revoke all on function public.cassa_foto_verbale(text, text) from public, anon, authenticated;
revoke all on function public.cassa_foto_recupera(date) from public, anon, authenticated;
revoke all on function public.tg_visite_cassa_foto() from public, anon, authenticated;
revoke all on function public.tg_vip_cassa_foto() from public, anon, authenticated;
revoke all on function public.visite_cassa_foto_immutabile() from public, anon, authenticated;
