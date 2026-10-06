-- 06/10/2026 — ANAGRAFICA IMPRESE PER LA SEGRETERIA: elenco ordinabile, possibili doppioni, unione con la
-- scelta dei valori, eliminazione delle schede inutilizzate (chiesto dall'utente: «un sacco di anagrafiche
-- sporche… un sistema per cercare duplicati imprese ed eventualmente poter unire… e poi dovrei anche poter
-- eliminare imprese come segreteria»; deciso: nel gestionale; con collegamenti si unisce, se completamente
-- inutilizzata si può eliminare).
--
--   piva_valida(text)              la cifra di controllo della partita IVA (null se non ha 11 cifre)
--   impresa_nome_norm(text)        il nome senza forma giuridica, punteggiatura e parole vuote
--   imprese_collegamenti(text[])   per ogni impresa: verbali, persone, altro e il dettaglio per tabella
--   imprese_elenco(...)            l'elenco a pagine, ordinabile e filtrabile
--   imprese_doppioni(...)          i gruppi di possibili doppioni, dal più sicuro al meno sicuro
--   imprese_doppioni_diverse(text[])  «non sono doppioni»: la decisione resta e il gruppo non torna
--   imprese_unisci(...)            fondi_imprese + i valori scelti dalla segreteria sulla principale
--   impresa_elimina(text, text)    solo se non ha niente collegato; copia in archivio.imprese_eliminate
--
-- Tutto riservato alla segreteria (s_unioni_autorizzato, come fondi_imprese). L'unione resta fondi_imprese:
-- qui non si sposta niente di nuovo, si sceglie solo quale valore tenere dove le schede sono diverse.

begin;

-- ── la partita IVA italiana: 11 cifre, l'ultima di controllo ─────────────────────────────────────
-- Due partite IVA valide non possono differire di una cifra sola: la cifra di controllo se ne accorge.
-- Le cifre 8-10 sono l'ufficio delle Entrate che l'ha rilasciata: 001-121, oppure 888 e 999. La cifra di
-- controllo da sola non basta: la P.IVA sbagliata di Edil Tognetto (50005111716) la supera, ma ha l'ufficio 171.
create or replace function public.piva_valida(p text)
returns boolean
language sql immutable
set search_path to 'public'
as $$
  select case
    when p is null then null
    when regexp_replace(upper(btrim(p)), '^IT', '') !~ '^[0-9]{11}$' then null
    when regexp_replace(upper(btrim(p)), '^IT', '') = '00000000000' then false
    when substr(regexp_replace(upper(btrim(p)), '^IT', ''), 8, 3) not in ('888', '999')
         and substr(regexp_replace(upper(btrim(p)), '^IT', ''), 8, 3)::int not between 1 and 121 then false
    else (
      with c as (select regexp_replace(upper(btrim(p)), '^IT', '') as s)
      select (sum(case when k % 2 = 1 then substr(c.s, k, 1)::int
                       else case when substr(c.s, k, 1)::int * 2 > 9 then substr(c.s, k, 1)::int * 2 - 9
                                 else substr(c.s, k, 1)::int * 2 end end)
              + substr(c.s, 11, 1)::int) % 10 = 0
      from c, generate_series(1, 10) k group by c.s)
  end
$$;

-- ── il nome che serve a confrontare: senza forma giuridica, punteggiatura, accenti e parole vuote ──
create or replace function public.impresa_nome_norm(p text)
returns text
language sql immutable
set search_path to 'public'
as $$
  select nullif(replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(lower(coalesce(p, '')), 'àáâäèéêëìíîïòóôöùúûü''’`', 'aaaaeeeeiiiioooouuuu   '),
          '\.', '', 'g'),                                   -- s.r.l. → srl
        '[^a-z0-9]+', ' ', 'g'),
      '(^| )(srl|srls|snc|sas|spa|ss|sapa|scarl|scrl|arl|soc|societa|cooperativa|coop|semplificata|unipersonale|in|liquidazione|di|de|e|ed|c|f|lli|dei|della|del|degli|ditta|ing|geom|arch)(?= |$)', ' ', 'g'),
    ' ', ''), '')
$$;

-- ── che cosa è collegato a ogni impresa ──────────────────────────────────────────────────────────
-- Le stesse tabelle che fondi_imprese sposta (ogni colonna impresa_id), più l'impresa d'origine degli
-- incarichi e le imprese previste dei cantieri CNCE (per codice fiscale, solo se nessun'altra impresa
-- attiva ha lo stesso codice). Non contano: lo storico delle modifiche, le decisioni sulle e-mail e
-- sui doppioni (sono note SULLA scheda), ATECO e certificazioni (sono dati DELLA scheda).
create or replace function public.imprese_collegamenti(p_ids text[])
returns table(impresa_id text, verbali int, persone int, altro int, dettaglio jsonb)
language plpgsql stable security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  r record;
  d jsonb := '{}'::jsonb;   -- impresa_id -> {tabella: n}
  x record;
begin
  if not public.s_unioni_autorizzato() then
    raise exception 'Operazione consentita solo alla segreteria';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;
  for r in
    select c.table_name as t, c.column_name as col
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and tb.table_type = 'BASE TABLE'
       and (c.column_name = 'impresa_id' or (c.table_name = 'incarichi' and c.column_name = 'impresa_id_origine'))
       and c.table_name not in ('imprese', 's_unioni_log', 's_impresa_audit', 'imprese_mail_decisioni',
                                'imprese_ateco', 'imprese_certificazioni', 'visite', 'visite_imprese_presenti')
  loop
    for x in execute format('select %1$I::text as id, count(*)::int as n from public.%2$I where %1$I = any($1) group by 1', r.col, r.t) using p_ids
    loop
      d := jsonb_set(d, array[x.id], coalesce(d -> x.id, '{}'::jsonb) || jsonb_build_object(r.t, x.n));
    end loop;
  end loop;
  -- imprese previste dei cantieri CNCE: si legano per codice fiscale
  for x in
    select i.impresa_id as id, count(*)::int as n
      from public.imprese i
      join public.cantiere_imprese_previste p on upper(btrim(p.impresa_cf)) = upper(btrim(i.impresa_cf))
     where i.impresa_id = any(p_ids) and coalesce(btrim(i.impresa_cf), '') <> ''
       and not exists (select 1 from public.imprese o where o.impresa_id <> i.impresa_id and o.elimina = 0
                         and upper(btrim(o.impresa_cf)) = upper(btrim(i.impresa_cf)))
     group by 1
  loop
    d := jsonb_set(d, array[x.id], coalesce(d -> x.id, '{}'::jsonb) || jsonb_build_object('cantiere_imprese_previste', x.n));
  end loop;
  return query
    select q.id,
           (select count(distinct v.visita_id)::int from (
              select visita_id from public.visite where visite.impresa_id = q.id
              union select visita_id from public.visite_imprese_presenti p where p.impresa_id = q.id) v),
           coalesce((d -> q.id ->> 'persone_imprese')::int, 0),
           coalesce((select sum(value::int)::int from jsonb_each_text(coalesce(d -> q.id, '{}'::jsonb)) where key <> 'persone_imprese'), 0),
           coalesce(d -> q.id, '{}'::jsonb)
      from unnest(p_ids) as q(id);
end $$;

-- ── l'elenco: a pagine, ordinabile, filtrabile ───────────────────────────────────────────────────
create or replace function public.imprese_elenco(
  p_testo text default null, p_ordina text default 'nome', p_desc boolean default false,
  p_segnale text default null, p_limite int default 100, p_da int default 0)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  t text := nullif(btrim(coalesce(p_testo, '')), '');
  res jsonb;
  tot int;
  ids text[];
begin
  if not public.s_unioni_autorizzato() then
    raise exception 'Operazione consentita solo alla segreteria';
  end if;
  if p_ordina not in ('nome', 'cf', 'piva', 'comune', 'indirizzo', 'ceiv', 'verbali') then
    raise exception 'Ordinamento non previsto: %', p_ordina;
  end if;
  if p_segnale is not null and p_segnale not in ('piva_non_valida', 'senza_piva', 'cessate') then
    raise exception 'Filtro non previsto: %', p_segnale;
  end if;
  p_limite := least(greatest(coalesce(p_limite, 100), 1), 500);
  p_da := greatest(coalesce(p_da, 0), 0);

  create temp table if not exists _imp_el (impresa_id text primary key, verbali int) on commit drop;
  truncate _imp_el;
  insert into _imp_el
  select i.impresa_id, coalesce(vv.n, 0)
    from public.imprese i
    left join (select x.impresa_id, count(distinct x.visita_id)::int n from (
                 select impresa_id, visita_id from public.visite
                 union select impresa_id, visita_id from public.visite_imprese_presenti) x group by 1) vv
      on vv.impresa_id = i.impresa_id
   where i.elimina = 0
     and (t is null or i.impresa_nome ilike '%' || t || '%' or i.ragione_sociale2 ilike '%' || t || '%'
          or i.piva ilike '%' || t || '%' or i.impresa_cf ilike '%' || t || '%' or i.impresa_id ilike '%' || t || '%'
          or i.comune ilike '%' || t || '%' or i.indirizzo ilike '%' || t || '%' or i.cod_ceiv ilike '%' || t || '%')
     and (p_segnale is null
          or (p_segnale = 'senza_piva' and coalesce(btrim(i.piva), '') = '')
          or (p_segnale = 'piva_non_valida' and coalesce(btrim(i.piva), '') <> '' and coalesce(public.piva_valida(i.piva), false) = false)
          or (p_segnale = 'cessate' and i.cessata_il is not null));
  select count(*) into tot from _imp_el;

  select array_agg(e.impresa_id order by e.ord) into ids from (
    select e.impresa_id, row_number() over (order by
        case when not p_desc then case p_ordina
          when 'nome' then lower(btrim(i.impresa_nome)) when 'cf' then nullif(upper(btrim(i.impresa_cf)), '')
          when 'piva' then nullif(btrim(i.piva), '') when 'comune' then nullif(upper(btrim(i.comune)), '')
          when 'indirizzo' then nullif(lower(btrim(i.indirizzo)), '') when 'ceiv' then nullif(btrim(i.cod_ceiv), '') end end asc nulls last,
        case when p_desc then case p_ordina
          when 'nome' then lower(btrim(i.impresa_nome)) when 'cf' then nullif(upper(btrim(i.impresa_cf)), '')
          when 'piva' then nullif(btrim(i.piva), '') when 'comune' then nullif(upper(btrim(i.comune)), '')
          when 'indirizzo' then nullif(lower(btrim(i.indirizzo)), '') when 'ceiv' then nullif(btrim(i.cod_ceiv), '') end end desc nulls last,
        case when p_ordina = 'verbali' and not p_desc then e.verbali end asc,
        case when p_ordina = 'verbali' and p_desc then e.verbali end desc,
        lower(btrim(i.impresa_nome)), i.impresa_id) as ord
      from _imp_el e join public.imprese i on i.impresa_id = e.impresa_id) e
   where e.ord > p_da and e.ord <= p_da + p_limite;

  select jsonb_agg(jsonb_build_object(
           'impresa_id', i.impresa_id, 'impresa_nome', i.impresa_nome, 'impresa_cf', i.impresa_cf, 'piva', i.piva,
           'piva_valida', public.piva_valida(i.piva), 'comune', i.comune, 'prov', i.prov, 'indirizzo', i.indirizzo,
           'cod_ceiv', i.cod_ceiv, 'stato_cassa', i.stato_cassa, 'cessata_il', i.cessata_il,
           'verbali', c.verbali, 'persone', c.persone, 'altro', c.altro, 'dettaglio', c.dettaglio)
         order by array_position(ids, i.impresa_id))
    into res
    from public.imprese i
    join public.imprese_collegamenti(ids) c on c.impresa_id = i.impresa_id
   where i.impresa_id = any(ids);

  return jsonb_build_object('totale', tot, 'da', p_da, 'righe', coalesce(res, '[]'::jsonb));
end $$;

-- ── le decisioni «non sono doppioni»: una riga per coppia ────────────────────────────────────────
create table if not exists public.imprese_doppioni_decisioni (
  a text not null,
  b text not null,
  decisa_da text not null,
  decisa_il timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.imprese_doppioni_decisioni enable row level security;
drop policy if exists imprese_doppioni_decisioni_lettura on public.imprese_doppioni_decisioni;
create policy imprese_doppioni_decisioni_lettura on public.imprese_doppioni_decisioni
  for select to authenticated using (public.is_segreteria());
revoke all on public.imprese_doppioni_decisioni from public, anon, authenticated;
grant select on public.imprese_doppioni_decisioni to authenticated;

create or replace function public.imprese_doppioni_diverse(p_ids text[])
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  n int;
begin
  if not public.s_unioni_autorizzato() then
    raise exception 'Operazione consentita solo alla segreteria';
  end if;
  p_ids := array(select distinct x from unnest(p_ids) x where coalesce(btrim(x), '') <> '');
  if coalesce(array_length(p_ids, 1), 0) < 2 then
    raise exception 'Servono almeno due imprese';
  end if;
  insert into public.imprese_doppioni_decisioni (a, b, decisa_da)
  select x, y, coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')')
    from unnest(p_ids) x, unnest(p_ids) y
   where x < y
  on conflict (a, b) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'coppie', n);
end $$;

-- ── i possibili doppioni ─────────────────────────────────────────────────────────────────────────
-- 1 stessa partita IVA o codice fiscale (anche quando il codice di una scheda è la P.IVA dell'altra, o la stessa P.IVA
--   senza gli zeri iniziali)
-- 2 codici di 11 cifre che differiscono di una cifra sola (due P.IVA valide non possono: una è sbagliata)
-- 3 stesso nome nello stesso comune
-- 4 stesso nome in comuni diversi, o senza comune
-- Lo stesso gruppo di schede compare una volta sola, al livello più sicuro. Un gruppo sparisce quando
-- tutte le sue coppie sono state dichiarate «non sono doppioni».
create or replace function public.imprese_doppioni(p_livello int default null, p_limite int default 30, p_da int default 0)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  conteggi jsonb;
  res jsonb;
  tot int;
  ids text[];
begin
  if not public.s_unioni_autorizzato() then
    raise exception 'Operazione consentita solo alla segreteria';
  end if;
  p_limite := least(greatest(coalesce(p_limite, 30), 1), 200);
  p_da := greatest(coalesce(p_da, 0), 0);

  create temp table if not exists _dop (livello int, chiave text, membri text[]) on commit drop;
  truncate _dop;
  with i as (
    select impresa_id, upper(btrim(comune)) as comune, public.impresa_nome_norm(impresa_nome) as norm,
           -- (le P.IVA a 9-10 cifre sono quelle a cui un foglio Excel ha tolto gli zeri iniziali: si rimettono)
           array_remove(array[
             case when regexp_replace(upper(btrim(coalesce(piva, ''))), '^IT', '') ~ '^[0-9]{9,11}$' then lpad(regexp_replace(upper(btrim(piva)), '^IT', ''), 11, '0') end,
             case when upper(btrim(coalesce(impresa_cf, ''))) ~ '^[0-9]{9,11}$' then lpad(upper(btrim(impresa_cf)), 11, '0')
                  when upper(btrim(coalesce(impresa_cf, ''))) ~ '^[A-Z0-9]{16}$' then upper(btrim(impresa_cf)) end,
             case when btrim(impresa_id) ~ '^[0-9]{9,11}$' then lpad(btrim(impresa_id), 11, '0') end], null) as codici
      from public.imprese where elimina = 0
  ),
  cod as (select distinct i.impresa_id, c as codice from i, unnest(i.codici) c),
  g1 as (
    select 1 as livello, codice as chiave, array_agg(distinct impresa_id order by impresa_id) as membri
      from cod group by codice having count(distinct impresa_id) > 1
  ),
  g2 as (
    select 2, k.chiave, array_agg(distinct k.impresa_id order by k.impresa_id)
      from (select cod.impresa_id, cod.codice, overlay(cod.codice placing '_' from p for 1) as chiave
              from cod, generate_series(1, 11) p where cod.codice ~ '^[0-9]{11}$') k
     group by k.chiave having count(distinct k.impresa_id) > 1 and count(distinct k.codice) > 1
  ),
  g3 as (
    select 3, norm || ' · ' || comune, array_agg(impresa_id order by impresa_id)
      from i where length(norm) >= 4 and coalesce(comune, '') <> ''
     group by norm, comune having count(*) > 1
  ),
  g4 as (
    select 4, norm, array_agg(impresa_id order by impresa_id)
      from i where length(norm) >= 4
     group by norm having count(*) > 1 and count(distinct coalesce(comune, '')) > 1
  ),
  tutti as (select * from g1 union all select * from g2 union all select * from g3 union all select * from g4),
  unici as (select distinct on (membri) livello, chiave, membri from tutti order by membri, livello)
  insert into _dop
  select u.livello, u.chiave, u.membri from unici u
   where exists (select 1 from unnest(u.membri) x, unnest(u.membri) y
                  where x < y and not exists (select 1 from public.imprese_doppioni_decisioni d where d.a = x and d.b = y));

  select jsonb_object_agg(livello::text, n) into conteggi from (select livello, count(*) n from _dop group by livello) c;
  select count(*) into tot from _dop where p_livello is null or livello = p_livello;

  create temp table if not exists _dop_pag (ord int, livello int, chiave text, membri text[]) on commit drop;
  truncate _dop_pag;
  insert into _dop_pag
  select ord, livello, chiave, membri from (
    select row_number() over (order by d.livello,
             (select min(lower(btrim(i.impresa_nome))) from public.imprese i where i.impresa_id = any(d.membri)), d.chiave) as ord,
           d.* from _dop d where p_livello is null or d.livello = p_livello) x
   where ord > p_da and ord <= p_da + p_limite;

  select array_agg(distinct m) into ids from _dop_pag, unnest(membri) m;

  create temp table if not exists _dop_col (impresa_id text primary key, verbali int, persone int, altro int, dettaglio jsonb) on commit drop;
  truncate _dop_col;
  insert into _dop_col select * from public.imprese_collegamenti(ids);

  select jsonb_agg(jsonb_build_object(
           'livello', g.livello, 'chiave', g.chiave,
           'membri', (select jsonb_agg(jsonb_build_object(
                         'impresa_id', i.impresa_id, 'impresa_nome', i.impresa_nome, 'ragione_sociale2', i.ragione_sociale2,
                         'impresa_cf', i.impresa_cf, 'piva', i.piva, 'piva_valida', public.piva_valida(i.piva),
                         'indirizzo', i.indirizzo, 'comune', i.comune, 'cap', i.cap, 'prov', i.prov,
                         'cod_ceiv', i.cod_ceiv, 'stato_cassa', i.stato_cassa, 'cessata_il', i.cessata_il,
                         'impresa_email_ref', i.impresa_email_ref, 'impresa_telefono', i.impresa_telefono,
                         'creata_il', i.created_at,
                         'verbali', c.verbali, 'persone', c.persone, 'altro', c.altro, 'dettaglio', c.dettaglio)
                       order by i.impresa_nome, i.impresa_id)
                        from public.imprese i join _dop_col c on c.impresa_id = i.impresa_id
                       where i.impresa_id = any(g.membri)))
         order by g.ord)
    into res
    from _dop_pag g;

  return jsonb_build_object('conteggi', coalesce(conteggi, '{}'::jsonb), 'totale', tot, 'da', p_da, 'gruppi', coalesce(res, '[]'::jsonb));
end $$;

-- ── l'unione: fondi_imprese, poi i valori scelti dove le schede erano diverse ────────────────────
-- Si può scegliere solo un valore che una delle schede ha davvero; il valore sostituito sulla
-- principale si scrive nelle sue note (regola d'oro 7: non si sovrascrive senza lasciare traccia).
create or replace function public.imprese_unisci(p_master text, p_dupes text[], p_scelte jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  ammessi text[] := array['impresa_nome', 'piva', 'impresa_cf', 'indirizzo', 'comune', 'cap', 'prov', 'cod_ceiv'];
  etichette jsonb := '{"impresa_nome":"ragione sociale","piva":"P.IVA","impresa_cf":"codice fiscale","indirizzo":"indirizzo","comune":"comune","cap":"CAP","prov":"provincia","cod_ceiv":"codice C.E.I.V."}';
  prima jsonb;
  ris jsonb;
  k text; v text; vecchio text;
  applicate text[] := '{}';
  nota text[] := '{}';
begin
  if not public.s_unioni_autorizzato() then
    raise exception 'Operazione consentita solo alla segreteria';
  end if;
  p_scelte := coalesce(p_scelte, '{}'::jsonb);
  if jsonb_typeof(p_scelte) <> 'object' then
    raise exception 'Scelte non valide';
  end if;
  for k in select jsonb_object_keys(p_scelte) loop
    if not k = any(ammessi) then
      raise exception 'Campo non previsto nell''unione: %', k;
    end if;
  end loop;
  -- i valori di adesso, su tutte le schede: si può scegliere solo fra questi
  select jsonb_object_agg(f, vals) into prima from (
    select f, jsonb_agg(distinct btrim(to_jsonb(i) ->> f)) filter (where nullif(btrim(to_jsonb(i) ->> f), '') is not null) as vals
      from public.imprese i, unnest(ammessi) f
     where i.impresa_id = p_master or i.impresa_id = any(p_dupes)
     group by f) z;
  for k, v in select key, btrim(value #>> '{}') from jsonb_each(p_scelte) loop
    if v is null or v = '' or not exists (select 1 from jsonb_array_elements_text(coalesce(prima -> k, '[]'::jsonb)) e where e = v) then
      raise exception 'Il valore scelto per «%» non è di nessuna delle schede: non ho unito niente', etichette ->> k;
    end if;
  end loop;

  ris := public.fondi_imprese(p_master, p_dupes);

  for k, v in select key, btrim(value #>> '{}') from jsonb_each(p_scelte) loop
    select nullif(btrim(to_jsonb(i) ->> k), '') into vecchio from public.imprese i where i.impresa_id = p_master;
    continue when vecchio is not distinct from v;
    execute format('update public.imprese set %1$I = (jsonb_populate_record(null::public.imprese, jsonb_build_object(%1$L, $1::text))).%1$I where impresa_id = $2', k)
      using v, p_master;
    applicate := array_append(applicate, k);
    if vecchio is not null then
      nota := array_append(nota, (etichette ->> k) || ' prima dell''unione «' || vecchio || '»');
    end if;
  end loop;
  if array_length(nota, 1) is not null then
    update public.imprese
       set note_access = concat_ws(E'\n', nullif(note_access, ''), 'Unione del ' || to_char(now(), 'DD/MM/YYYY') || ': ' || array_to_string(nota, '; '))
     where impresa_id = p_master;
  end if;
  return ris || jsonb_build_object('scelte_applicate', to_jsonb(applicate));
end $$;

-- ── l'eliminazione: solo una scheda che non ha niente collegato ──────────────────────────────────
-- Con verbali, persone, protocolli, corsi, pratiche… non si elimina: si unisce a quella giusta.
-- Nemmeno se è nella lista della Cassa Edile (tornerebbe alla prossima importazione).
-- Prima di cancellare, la scheda e i suoi dati propri (ATECO, certificazioni, decisioni) vanno in
-- archivio.imprese_eliminate: da lì si può rimettere.
create table if not exists archivio.imprese_eliminate (
  id bigserial primary key,
  impresa_id text not null,
  scheda jsonb not null,
  figli jsonb not null,
  motivo text not null,
  eliminata_da text not null,
  eliminata_il timestamptz not null default now()
);
revoke all on archivio.imprese_eliminate from public, anon, authenticated;
revoke all on sequence archivio.imprese_eliminate_id_seq from public, anon, authenticated;

create or replace function public.impresa_elimina(p_impresa_id text, p_motivo text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  sch jsonb;
  c record;
  figli jsonb;
  cosa text;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
begin
  if not public.s_unioni_autorizzato() then
    raise exception 'Operazione consentita solo alla segreteria';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Scrivi perché la elimini: resta nella copia in archivio';
  end if;
  select to_jsonb(i) into sch from public.imprese i where i.impresa_id = p_impresa_id for update;
  if sch is null then
    raise exception 'Impresa % non trovata', p_impresa_id;
  end if;
  if nullif(btrim(sch ->> 'cod_ceiv'), '') is not null then
    raise exception 'È nella lista della Cassa Edile (codice %): non si elimina. Se è un doppione, uniscila a quella giusta.', btrim(sch ->> 'cod_ceiv');
  end if;
  select * into c from public.imprese_collegamenti(array[p_impresa_id]);
  if c.verbali + c.persone + c.altro > 0 then
    select string_agg(x, ', ') into cosa from (
      select case when c.verbali > 0 then c.verbali || ' verbal' || case when c.verbali = 1 then 'e' else 'i' end end as x
      union all select case when c.persone > 0 then c.persone || ' person' || case when c.persone = 1 then 'a' else 'e' end end
      union all select key || ' ' || value from jsonb_each_text(c.dettaglio) where key <> 'persone_imprese') z
     where x is not null;
    raise exception 'Non si elimina: ha collegati %. Se è un doppione, uniscila a quella giusta.', cosa;
  end if;

  figli := jsonb_build_object(
    'imprese_ateco', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.imprese_ateco a where a.impresa_id = p_impresa_id),
    'imprese_certificazioni', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.imprese_certificazioni a where a.impresa_id = p_impresa_id),
    'imprese_mail_decisioni', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.imprese_mail_decisioni a where a.impresa_id = p_impresa_id),
    'imprese_doppioni_decisioni', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.imprese_doppioni_decisioni a where p_impresa_id in (a.a, a.b)));
  insert into archivio.imprese_eliminate (impresa_id, scheda, figli, motivo, eliminata_da)
  values (p_impresa_id, sch, figli, btrim(p_motivo), chi);

  delete from public.imprese_ateco where impresa_id = p_impresa_id;
  delete from public.imprese_certificazioni where impresa_id = p_impresa_id;
  delete from public.imprese_mail_decisioni where impresa_id = p_impresa_id;
  delete from public.imprese_doppioni_decisioni where p_impresa_id in (a, b);
  delete from public.imprese where impresa_id = p_impresa_id;
  return jsonb_build_object('ok', true, 'impresa_id', p_impresa_id, 'nome', sch ->> 'impresa_nome');
end $$;

-- ── permessi: le funzioni controllano da sole che sia la segreteria ──────────────────────────────
revoke execute on function public.piva_valida(text) from public, anon;
revoke execute on function public.impresa_nome_norm(text) from public, anon;
revoke execute on function public.imprese_collegamenti(text[]) from public, anon;
revoke execute on function public.imprese_elenco(text, text, boolean, text, int, int) from public, anon;
revoke execute on function public.imprese_doppioni(int, int, int) from public, anon;
revoke execute on function public.imprese_doppioni_diverse(text[]) from public, anon;
revoke execute on function public.imprese_unisci(text, text[], jsonb) from public, anon;
revoke execute on function public.impresa_elimina(text, text) from public, anon;
grant execute on function public.piva_valida(text), public.impresa_nome_norm(text), public.imprese_collegamenti(text[]),
  public.imprese_elenco(text, text, boolean, text, int, int), public.imprese_doppioni(int, int, int),
  public.imprese_doppioni_diverse(text[]), public.imprese_unisci(text, text[], jsonb), public.impresa_elimina(text, text)
  to authenticated;

commit;
