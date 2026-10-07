-- 07/10/2026 — IL COMPLESSO SI VEDE E SI SISTEMA: lotti nell'elenco e nella scheda, unione che riconosce i lotti,
-- visite da dividere fra i lotti (deciso dall'utente: «apro il CNCE principale e vedo tutti i cantieri suddivisi per
-- lotto»; «il conteggio che va sul verbale è quello del singolo lotto», il generale del complesso si vede accanto).
-- Il problema che risolve: i cantieri importati dalle visite vecchie hanno il lotto scritto DENTRO l'indirizzo
-- («via De Gasperi - Lotto 14»: 113 schede attive al 07/10, 31 con CNCE) e l'unione li fondeva in una scheda sola.
--   · adotta_lotto_cantiere(master, cantiere, lotto, lotto_master): una scheda esistente diventa lotto del complesso
--     di un'altra, senza fonderla: prende CNCE e radice del principale, il lotto esce dall'indirizzo ed entra nel
--     campo e nell'etichetta. Solo segreteria (è la strada dell'unione).
--   · lotti_acc_complesso(cantiere): per ogni visita del complesso il numero d'ordine sul suo lotto e sul complesso
--     intero (security definer: solo numeri, servono a chi vede solo le sue visite per leggere il conto giusto).
--   · visite_complesso(cantiere): le visite di tutti i lotti del complesso, coi permessi di chi legge, con lotto,
--     accesso sul lotto e sul complesso e l'indirizzo com'era scritto nel modulo originale (serve a dividerle).
--   · sposta_visite_in_lotti(cantiere, lotto_qui, assegnazioni): la segreteria assegna le visite di una scheda ai
--     lotti (esistenti o nuovi, creati con crea_lotto_cantiere); i verbali definitivi tengono il numero di accesso
--     stampato (regola del 01/10), le bozze lo riprendono dal lotto. Tutto in cantieri_correzioni.

begin;

-- ── 1. una scheda esistente diventa lotto del complesso di un'altra ──
create or replace function public.adotta_lotto_cantiere(p_master_id text, p_cantiere_id text, p_lotto text, p_lotto_master text default '1')
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  m public.cantieri;
  c public.cantieri;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  lot text := nullif(regexp_replace(btrim(coalesce(p_lotto, '')), '\s+', ' ', 'g'), '');
  lm  text := nullif(regexp_replace(btrim(coalesce(p_lotto_master, '')), '\s+', ' ', 'g'), '');
  radice text;
  ind_pulito text;
  prima_ind text; prima_et text; prima_cnce text;
  orig text;
begin
  if not public.s_unioni_autorizzato() then raise exception 'Operazione consentita solo alla segreteria'; end if;
  if lot is null then raise exception 'Scrivi il nome del lotto della scheda da riconoscere (per esempio 2)'; end if;
  if length(lot) > 30 or length(coalesce(lm, '')) > 30 then raise exception 'Il nome del lotto è troppo lungo: bastano poche lettere (1, 2, A, Palazzina B)'; end if;
  if p_master_id = p_cantiere_id then raise exception 'Una scheda non può essere un lotto di sé stessa'; end if;
  select * into m from public.cantieri where cantiere_id = p_master_id for update;
  if not found or coalesce(m.elimina, 0) <> 0 then raise exception 'Cantiere principale % non trovato', p_master_id; end if;
  select * into c from public.cantieri where cantiere_id = p_cantiere_id for update;
  if not found or coalesce(c.elimina, 0) <> 0 then raise exception 'Cantiere % non trovato', p_cantiere_id; end if;
  if coalesce(c.cantiere_cnce, '') ~* '^CNCE' and coalesce(m.cantiere_cnce, '') ~* '^CNCE'
     and upper(btrim(c.cantiere_cnce)) <> upper(btrim(m.cantiere_cnce)) then
    raise exception 'Le due schede hanno codici CNCE diversi (% e %): per la Cassa Edile sono due cantieri, non due lotti di uno', m.cantiere_cnce, c.cantiere_cnce;
  end if;
  if exists (select 1 from public.visite v where v.cantiere_id = p_cantiere_id and v.elimina = 0 and v.stato = 'definitivo') is false
     and not exists (select 1 from public.visite v where v.cantiere_id = p_cantiere_id) then
    null;   -- anche una scheda senza visite si può riconoscere come lotto: resta la sua storia in cantieri_correzioni
  end if;

  -- la scheda principale prende il suo lotto, se non ce l'ha (stessa strada del tecnico)
  if coalesce(btrim(m.lotto), '') = '' then
    if lm is null then raise exception 'Scrivi il nome del lotto della scheda principale (per esempio 1)'; end if;
    perform public.crea_lotto_cantiere(p_master_id, lm, null);
    select * into m from public.cantieri where cantiere_id = p_master_id;
  end if;
  radice := coalesce(m.lotto_di, m.cantiere_id);
  if exists (select 1 from public.lotti_del_cantiere(p_master_id) l where l.cantiere_id <> p_cantiere_id and lower(coalesce(l.lotto, '')) = lower(lot)) then
    raise exception 'Il lotto «%» c''è già in questo complesso', lot;
  end if;

  prima_ind := c.cantiere_indirizzo; prima_et := c.cantiere_etichetta; prima_cnce := c.cantiere_cnce;
  -- il lotto esce dall'indirizzo («via De Gasperi - Lotto 14» → «via De Gasperi»); se non resta niente vale quello del principale
  ind_pulito := nullif(btrim(regexp_replace(coalesce(c.cantiere_indirizzo, ''), '\s*[-–—(]*\s*lott[oi]\M.*$', '', 'i'), ' -–—,('), '');
  ind_pulito := coalesce(ind_pulito, m.cantiere_indirizzo);
  update public.cantieri
     set lotto = lot, lotto_di = radice,
         cantiere_cnce = coalesce(nullif(btrim(cantiere_cnce), ''), m.cantiere_cnce),
         cantiere_indirizzo = ind_pulito,
         cantiere_etichetta = public.etichetta_con_lotto(cantiere_etichetta, ind_pulito, cantiere_civico, lot)
   where cantiere_id = p_cantiere_id
   returning * into c;
  orig := 'lotto riconosciuto dall''unione: scheda adottata nel complesso di ' || p_master_id;
  insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da) values
    (p_cantiere_id, 'lotto', null, lot, orig, chi),
    (p_cantiere_id, 'lotto_di', null, radice, orig, chi);
  if prima_ind is distinct from c.cantiere_indirizzo then
    insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da) values (p_cantiere_id, 'cantiere_indirizzo', prima_ind, c.cantiere_indirizzo, orig, chi);
  end if;
  if prima_et is distinct from c.cantiere_etichetta then
    insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da) values (p_cantiere_id, 'cantiere_etichetta', prima_et, c.cantiere_etichetta, orig, chi);
  end if;
  if prima_cnce is distinct from c.cantiere_cnce then
    insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da) values (p_cantiere_id, 'cantiere_cnce', prima_cnce, c.cantiere_cnce, orig, chi);
  end if;
  return jsonb_build_object('ok', true, 'cantiere_id', p_cantiere_id, 'lotto', lot, 'lotto_master', m.lotto, 'radice', radice,
                            'indirizzo', c.cantiere_indirizzo, 'etichetta', c.cantiere_etichetta, 'cnce', c.cantiere_cnce);
end $$;
revoke execute on function public.adotta_lotto_cantiere(text, text, text, text) from public, anon;
grant execute on function public.adotta_lotto_cantiere(text, text, text, text) to authenticated;

-- ── 2. i numeri d'ordine delle visite: sul lotto e sul complesso ──
create or replace function public.lotti_acc_complesso(p_cantiere_id text)
returns table (visita_id text, cantiere_id text, data_visita date, acc_lotto bigint, acc_complesso bigint)
language sql stable security definer
set search_path to 'public'
as $$
  -- security definer: solo numeri e date. Chi vede solo le sue visite deve comunque leggere il conto giusto del
  -- lotto e del complesso, che dipende anche dalle visite degli altri tecnici (il riepilogo del verbale lo usa).
  with l as (select l.cantiere_id from public.lotti_del_cantiere(p_cantiere_id) l)
  select v.visita_id, v.cantiere_id, v.data_visita,
         row_number() over (partition by v.cantiere_id order by v.data_visita, v.visita_id),
         row_number() over (order by v.data_visita, v.visita_id)
    from public.visite v join l on l.cantiere_id = v.cantiere_id
   where v.elimina = 0
$$;
revoke execute on function public.lotti_acc_complesso(text) from public, anon;
grant execute on function public.lotti_acc_complesso(text) to authenticated;

-- ── 3. le visite di tutto il complesso, coi permessi di chi legge ──
create or replace function public.visite_complesso(p_cantiere_id text)
returns table (visita_id text, cantiere_id text, lotto text, nr_verbale text, data_visita date, stato text, acc_cant text,
               acc_lotto bigint, acc_complesso bigint, tecnico text, impresa text, indirizzo_originale text)
language sql stable
set search_path to 'public'
as $$
  -- security invoker: le visite passano dalle policy (chi vede solo le sue vede le sue); lotti e numeri d'ordine
  -- arrivano dalle due funzioni definer. L'indirizzo originale è la cella «indirizzo cantiere» della riga del modulo.
  select v.visita_id, v.cantiere_id, l.lotto, v.nr_verbale, v.data_visita, v.stato, v.acc_cant,
         a.acc_lotto, a.acc_complesso,
         nullif(btrim(concat_ws(' ', t.tecnico_nome, t.tecnico_cognome)), ''),
         i.impresa_nome,
         (select m.valori ->> (h.ord - 1)::int
            from public.visite_modulo_originale m
            join public.visite_modulo_fonti f on f.fonte_id = m.fonte_id
            cross join lateral (select ord from jsonb_array_elements_text(to_jsonb(f.intestazioni)) with ordinality as t(nome, ord)
                                 where t.nome ~* 'indirizzo.*cantiere' order by ord limit 1) h
           where m.visita_id = v.visita_id limit 1)
    from public.visite v
    join public.lotti_del_cantiere(p_cantiere_id) l on l.cantiere_id = v.cantiere_id
    left join public.lotti_acc_complesso(p_cantiere_id) a on a.visita_id = v.visita_id
    left join public.tecnici t on t.tecnico_id = v.tecnico_id
    left join public.imprese i on i.impresa_id = v.impresa_id
   where v.elimina = 0
   order by (l.lotto is null), case when l.lotto ~ '^\d+$' then lpad(l.lotto, 6, '0') else lower(l.lotto) end, v.data_visita desc, v.visita_id desc
$$;
revoke execute on function public.visite_complesso(text) from public, anon;
grant execute on function public.visite_complesso(text) to authenticated;

-- ── 4. la segreteria divide le visite di una scheda fra i lotti ──
create or replace function public.sposta_visite_in_lotti(p_cantiere_id text, p_lotto_qui text, p_assegnazioni jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  c public.cantieri;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  qui text := nullif(regexp_replace(btrim(coalesce(p_lotto_qui, '')), '\s+', ' ', 'g'), '');
  a record;
  lot text;
  dest text;
  mappa jsonb := '{}'::jsonb;    -- nome lotto (minuscolo) → cantiere_id
  creati jsonb := '[]'::jsonb;
  spostate int := 0;
  ricalcolate int := 0;
  r jsonb;
  k text;
  toccati text[];
begin
  if not public.s_unioni_autorizzato() then raise exception 'Operazione consentita solo alla segreteria'; end if;
  if p_assegnazioni is null or jsonb_typeof(p_assegnazioni) <> 'array' or jsonb_array_length(p_assegnazioni) = 0 then
    raise exception 'Nessuna visita da spostare';
  end if;
  select * into c from public.cantieri where cantiere_id = p_cantiere_id for update;
  if not found or coalesce(c.elimina, 0) <> 0 then raise exception 'Cantiere % non trovato', p_cantiere_id; end if;

  -- la scheda di partenza prende il suo lotto, se non ce l'ha
  if coalesce(btrim(c.lotto), '') = '' then
    if qui is null then raise exception 'Scrivi il nome del lotto di questa scheda (per esempio 1)'; end if;
    perform public.crea_lotto_cantiere(p_cantiere_id, qui, null);
    select * into c from public.cantieri where cantiere_id = p_cantiere_id;
  end if;
  for a in select l.cantiere_id, l.lotto from public.lotti_del_cantiere(p_cantiere_id) l where coalesce(btrim(l.lotto), '') <> '' loop
    mappa := mappa || jsonb_build_object(lower(a.lotto), a.cantiere_id);
  end loop;

  perform set_config('app.incarico_sistema', '1', true);
  for a in select x ->> 'visita_id' as visita_id, nullif(regexp_replace(btrim(coalesce(x ->> 'lotto', '')), '\s+', ' ', 'g'), '') as lotto
             from jsonb_array_elements(p_assegnazioni) x loop
    if a.visita_id is null or a.lotto is null then raise exception 'Ogni riga deve avere la visita e il lotto'; end if;
    if length(a.lotto) > 30 then raise exception 'Il nome del lotto è troppo lungo: bastano poche lettere (1, 2, A, Palazzina B)'; end if;
    if not exists (select 1 from public.visite v where v.visita_id = a.visita_id and v.cantiere_id = p_cantiere_id and v.elimina = 0) then
      raise exception 'La visita % non è su questa scheda', a.visita_id;
    end if;
    k := lower(a.lotto);
    dest := mappa ->> k;
    if dest is null then
      r := public.crea_lotto_cantiere(p_cantiere_id, null, a.lotto);
      dest := r ->> 'cantiere_id';
      mappa := mappa || jsonb_build_object(k, dest);
      creati := creati || jsonb_build_object('lotto', a.lotto, 'cantiere_id', dest);
    end if;
    if dest = p_cantiere_id then continue; end if;   -- resta dov'è
    update public.visite set cantiere_id = dest where visita_id = a.visita_id;
    spostate := spostate + 1;
    insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da)
    values (dest, 'visita ' || a.visita_id, p_cantiere_id, dest, 'visita spostata sul lotto ' || a.lotto || ' dalla divisione in lotti', chi);
  end loop;

  -- il numero di accesso: i definitivi tengono quello stampato (01/10), le bozze lo riprendono dal loro lotto
  toccati := array(select distinct value from jsonb_each_text(mappa)) || p_cantiere_id;
  with n as (
    select v.visita_id, row_number() over (partition by v.cantiere_id order by v.data_visita, v.visita_id) as acc
      from public.visite v where v.cantiere_id = any(toccati) and v.elimina = 0)
  update public.visite v set acc_cant = n.acc::text
    from n where n.visita_id = v.visita_id and coalesce(v.stato, '') <> 'definitivo' and v.acc_cant is distinct from n.acc::text;
  get diagnostics ricalcolate = row_count;

  return jsonb_build_object('ok', true, 'spostate', spostate, 'lotti_creati', creati, 'accessi_ricalcolati', ricalcolate, 'lotto_partenza', c.lotto);
end $$;
revoke execute on function public.sposta_visite_in_lotti(text, text, jsonb) from public, anon;
grant execute on function public.sposta_visite_in_lotti(text, text, jsonb) to authenticated;

commit;
