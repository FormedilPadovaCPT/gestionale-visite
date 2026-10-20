-- ============================================================
-- CICLI DI VISITA AL CANTIERE («processo di consulenza» della procedura CNCPT)
-- 20/10/2026, proposta della Segreteria d'Area del 16/10/2026 (Prot_26-27_0033), rivista il 17/10
-- (pagina «Cicli di visita al cantiere»), approvata e messa in costruzione il 20/10/2026.
--
-- Il numero di ACCESSO al cantiere (visite.acc_cant) non cambia: continua sempre, va sul PDF e
-- all'Osservatorio. Accanto si aggiunge il CICLO: il percorso di una-tre visite su una fase del lotto,
-- che si chiude secondo la regola Formedil e riparte dopo una chiusura o quando il cantiere è cambiato
-- in modo sostanziale (imprese esecutrici stravolte E fasi di lavoro nuove, come nella bozza CNCPT
-- PO 01 del 2010). La regola dei ritorni si legge sulla VISITA DEL CICLO, non sull'accesso.
--
-- Regole (tutte dalla proposta):
--  · per lotto (cantiere_id); dalle visite dal 01/10/2026; asseverazioni (tipo 10) escluse; solo
--    verbali definitivi non eliminati;
--  · un ciclo si apre al primo accesso, alla prima visita dopo un ciclo chiuso (automatico), o con un
--    cambio sostanziale mentre il ciclo è aperto: lo PROPONE il programma alla chiusura del verbale e lo
--    CONFERMA il tecnico (visite.ciclo_scelta); contro la proposta serve il motivo. Più verbali lo
--    stesso giorno sullo stesso lotto = stessa visita del ciclo;
--  · il confronto è fra le imprese che eseguono (ruolo diverso da «affidataria» e «fornitrice») di
--    TUTTO il ciclo aperto e quelle della visita, e fra le FASI delle lavorazioni (non le voci);
--  · regola sulla visita del ciclo (ciclo_regola): 1ª-2ª come Formedil; 3ª con IPC medio il ciclo si
--    FERMA e il caso va al Coordinatore; 4ª e 5ª solo autorizzate (percorso del Coordinatore o dentro
--    una serie); dopo la 5ª con IPC medio, e con IPC alto dalla 3ª, cantiere CRITICO (proposto);
--    archiviazione con IPC assente o basso = ciclo RISOLTO;
--  · esiti del ciclo: risolto | superato (cantiere cambiato) | in_percorso (visite 4ª-5ª, serie,
--    conferenza, Commissione, con l'esito del percorso) | critico | non_risolto (nessun seguito);
--  · i compensi dei tecnici NON dipendono dal ciclo (decisione rimandata al Direttore): qui non c'è
--    niente sulle fatture.
--
-- Chi scrive: il database (trigger su visite → ciclo_ricalcola_lotto, idempotente: rilegge le visite
-- del lotto in ordine di data e rifà i cicli, tenendo le decisioni del Coordinatore); il tecnico scrive
-- solo ciclo_scelta/ciclo_motivo*; il Coordinatore ciclo_percorso, ciclo_percorso_esito, ciclo_correggi.
-- Lettura per tutti i consumatori della regola: visite.ciclo_visita + visite.ciclo_rientro_giorni
-- (null = nessun rientro dovuto). Le visite storiche (senza ciclo) restano sulla regola per accesso.
-- ============================================================

-- ── 1. la tabella dei cicli ──
create table if not exists public.visite_cicli (
  ciclo_id          bigserial primary key,
  cantiere_id       text not null references public.cantieri(cantiere_id) on update cascade on delete cascade,
  numero            smallint not null,                     -- progressivo del ciclo sul lotto (dal 01/10/2026)
  prima_visita_id   text not null unique,                  -- la visita che lo apre: è la chiave stabile
  ultima_visita_id  text,
  aperto_il         date not null,
  chiuso_il         date,
  stato             text not null default 'aperto' check (stato in ('aperto','fermo','chiuso')),
  esito             text check (esito is null or esito in ('risolto','superato','in_percorso','critico','non_risolto')),
  n_visite          smallint not null default 0,
  ipc_inizio        text,
  ipc_fine          text,
  in_serie          boolean not null default false,        -- almeno una visita in serie (tipo 8 o incarico «Serie di visite»)
  fermo_il          date,                                  -- 3ª visita con IPC medio: il caso è al Coordinatore
  critico_il        date,                                  -- proposto come cantiere critico (IPC alto dalla 3ª, medio dopo la 5ª)
  -- la strada scelta dal Coordinatore quando il ciclo si ferma
  percorso          text check (percorso is null or percorso in ('visite_4_5','serie','conferenza','commissione','nessuno')),
  percorso_da       text,
  percorso_il       timestamptz,
  percorso_nota     text,
  percorso_esito    text check (percorso_esito is null or percorso_esito in ('risolto','non_risolto')),
  percorso_esito_da text,
  percorso_esito_il timestamptz,
  percorso_esito_nota text,
  decisione_id      bigint,                                -- s_decisioni, se il caso è andato alla Commissione
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists visite_cicli_cantiere_idx on public.visite_cicli (cantiere_id, numero);
create index if not exists visite_cicli_stato_idx on public.visite_cicli (stato) where stato <> 'chiuso';
comment on table public.visite_cicli is 'Cicli di visita (processo di consulenza) per lotto, dal 01/10/2026. Li scrive il database (ciclo_ricalcola_lotto); il Coordinatore decide il percorso quando il ciclo si ferma alla 3ª visita.';
comment on column public.visite_cicli.stato is 'aperto = ritorni in corso; fermo = 3ª visita con IPC medio, decide il Coordinatore; chiuso = esito scritto.';
comment on column public.visite_cicli.esito is 'risolto (archiviato secondo la procedura, anche IPC basso) | superato (cantiere cambiato) | in_percorso (chiuso con l''esito del percorso) | critico | non_risolto (nessun seguito).';


-- ── 2. le colonne sul verbale ──
alter table public.visite
  add column if not exists ciclo_id bigint references public.visite_cicli(ciclo_id) on delete set null,
  add column if not exists ciclo_visita smallint,
  add column if not exists ciclo_scelta text,
  add column if not exists ciclo_motivo_tipo text,
  add column if not exists ciclo_motivo text,
  add column if not exists ciclo_proposta jsonb,
  add column if not exists ciclo_divergente boolean,
  add column if not exists ciclo_fonte text,
  add column if not exists ciclo_esito text,
  add column if not exists ciclo_rientro_giorni smallint;
alter table public.visite drop constraint if exists visite_ciclo_scelta_chk;
alter table public.visite add constraint visite_ciclo_scelta_chk check (ciclo_scelta is null or ciclo_scelta in ('continua','nuovo'));
alter table public.visite drop constraint if exists visite_ciclo_motivo_tipo_chk;
alter table public.visite add constraint visite_ciclo_motivo_tipo_chk check (ciclo_motivo_tipo is null or ciclo_motivo_tipo in ('fase_nuova','imprese_nuove','cantiere_cambiato','stessa_fase','stesse_imprese','altro'));
alter table public.visite drop constraint if exists visite_ciclo_fonte_chk;
alter table public.visite add constraint visite_ciclo_fonte_chk check (ciclo_fonte is null or ciclo_fonte in ('programma','tecnico','coordinatore'));
alter table public.visite drop constraint if exists visite_ciclo_esito_chk;
alter table public.visite add constraint visite_ciclo_esito_chk check (ciclo_esito is null or ciclo_esito in ('ritorno','archivia','fermo','critico'));
create index if not exists visite_ciclo_id_idx on public.visite (ciclo_id) where ciclo_id is not null;
-- la policy dei cicli legge visite.ciclo_id, quindi sta dopo le colonne: chi «vede solo le sue» vede solo i cicli con una sua visita
alter table public.visite_cicli enable row level security;
drop policy if exists visite_cicli_sel on public.visite_cicli;
create policy visite_cicli_sel on public.visite_cicli for select to authenticated
  using ((select public.is_personale()) and (not (select public.solo_proprie()) or exists (select 1 from public.visite x where x.ciclo_id = visite_cicli.ciclo_id)));
revoke all on public.visite_cicli from anon;
-- nessuna scrittura diretta: solo le funzioni qui sotto
comment on column public.visite.ciclo_visita is 'Numero della visita dentro il ciclo (1, 2, 3…). Null per le visite storiche, le asseverazioni, le bozze.';
comment on column public.visite.ciclo_scelta is 'Risposta del tecnico alla proposta del programma alla chiusura del verbale: continua | nuovo. Null = vale la proposta.';
comment on column public.visite.ciclo_proposta is 'Che cosa ha proposto il programma e perché (per il Coordinatore): {proposta, chiede, motivo, imprese, fasi}.';
comment on column public.visite.ciclo_divergente is 'Il tecnico ha scelto contro la proposta del programma. Lo vede il Coordinatore nella sua Zona.';
comment on column public.visite.ciclo_esito is 'Esito della regola su questa visita del ciclo: ritorno | archivia | fermo (caso al Coordinatore) | critico.';
comment on column public.visite.ciclo_rientro_giorni is 'Giorni per il rientro dovuto secondo la regola sulla visita del ciclo; null = nessun rientro (archiviazione, ciclo fermo o critico). Lo scrive ciclo_ricalcola_lotto.';

-- ── 3. la regola sulla visita del ciclo ──
-- Giorni, esito (ritorno | archivia | fermo | critico) e tipo (ordinaria | urgente | immediata). p_autorizzata =
-- visite 4ª-5ª coperte da un percorso del Coordinatore o da una serie. Stessa tabella in cicli-visita.js (regola).
create or replace function public.ciclo_regola(p_n integer, p_ipc text, p_autorizzata boolean default false)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case
    when i = 'ALTO' then jsonb_build_object('giorni', 3, 'esito', case when n >= 3 then 'critico' else 'ritorno' end,
                           'tipo', case when n = 1 then 'urgente' else 'immediata' end,
                           'nota', case when n = 1 then 'IPC alto: ritorno urgente entro 3 giorni'
                                        when n = 2 then 'IPC alto alla 2ª visita: ritorno entro 3 giorni e segnalazione immediata alla Segreteria'
                                        else 'IPC alto alla ' || n || 'ª visita: ritorno entro 3 giorni, si propone il cantiere critico' end)
    when i = 'MEDIO' then case
      when n <= 2 then jsonb_build_object('giorni', 22, 'esito', 'ritorno', 'tipo', 'ordinaria', 'nota', 'IPC medio: ritorno a 22 giorni')
      when n >= 5 then jsonb_build_object('giorni', null, 'esito', 'critico', 'tipo', null, 'nota', 'IPC medio dopo la 5ª visita: si propone il cantiere critico')
      when coalesce(p_autorizzata, false) then jsonb_build_object('giorni', 22, 'esito', 'ritorno', 'tipo', 'ordinaria', 'nota', 'IPC medio alla ' || n || 'ª visita, autorizzata: ritorno a 22 giorni')
      else jsonb_build_object('giorni', null, 'esito', 'fermo', 'tipo', null, 'nota', 'IPC medio alla ' || n || 'ª visita: il ciclo si ferma, il caso va al Coordinatore') end
    when i = 'BASSO' then case
      when n = 1 then jsonb_build_object('giorni', 22, 'esito', 'ritorno', 'tipo', 'ordinaria', 'nota', 'IPC basso alla 1ª visita: ritorno a 22 giorni')
      else jsonb_build_object('giorni', null, 'esito', 'archivia', 'tipo', null, 'nota', 'IPC basso: archiviazione, ciclo risolto') end
    else jsonb_build_object('giorni', null, 'esito', 'archivia', 'tipo', null, 'nota', 'Nessun rilievo: archiviazione, ciclo risolto')
  end
  from (select greatest(coalesce(p_n, 1), 1) as n, upper(coalesce(nullif(trim(p_ipc), ''), 'NR')) as i) x
$$;

-- la regola che vale per UNA visita: col ciclo (dal 01/10/2026) i giorni li ha scritti il ricalcolo; senza, l'accesso
create or replace function public.visita_rientro_giorni(p_acc integer, p_ipc text, p_ciclo_visita integer, p_ciclo_rientro_giorni integer)
returns integer language sql immutable set search_path to 'public' as $$
  select case when p_ciclo_visita is null then public.fp_regola_giorni(p_acc, p_ipc) else p_ciclo_rientro_giorni end
$$;

-- ── 4. il confronto: imprese e fasi del ciclo aperto contro quelle della visita ──
create or replace function public.ciclo_confronta(p_imp_ciclo text[], p_fasi_ciclo text[], p_imp text[], p_fasi text[], p_fp_motivo text default null)
returns jsonb language plpgsql immutable set search_path to 'public' as $$
declare
  a text[] := coalesce(p_imp_ciclo, '{}'); b text[] := coalesce(p_imp, '{}');
  fa text[] := coalesce(p_fasi_ciclo, '{}'); fb text[] := coalesce(p_fasi, '{}');
  imp text; fas text; comuni_i int; comuni_f int; prop text; chiede boolean; motivo text;
begin
  select count(*) into comuni_i from unnest(a) x where x = any(b);
  select count(*) into comuni_f from unnest(fa) x where x = any(fb);
  imp := case when cardinality(a) = 0 or cardinality(b) = 0 then 'senza_dati'
              when comuni_i = 0 then 'diverse'
              when comuni_i = cardinality(b) and cardinality(a) = cardinality(b) then 'uguali'
              else 'parziali' end;
  fas := case when cardinality(fa) = 0 or cardinality(fb) = 0 then 'senza_dati'
              when comuni_f = 0 then 'nuove'
              when comuni_f = cardinality(fb) and cardinality(fa) = cardinality(fb) then 'uguali'
              else 'parziali' end;
  if p_fp_motivo in ('fase_nuova', 'impresa_nuova') then
    prop := 'nuovo'; chiede := true;
    motivo := 'all''apertura della visita hai indicato ' || case when p_fp_motivo = 'fase_nuova' then 'una fase di lavoro nuova' else 'un''impresa nuova in cantiere' end;
  elsif imp = 'diverse' and fas = 'nuove' then
    prop := 'nuovo'; chiede := true;
    motivo := 'imprese esecutrici tutte diverse e fasi di lavoro nuove (prima: ' || array_to_string(fa, ', ') || '; ora: ' || array_to_string(fb, ', ') || ')';
  elsif imp in ('uguali', 'parziali') and fas in ('uguali', 'parziali') then
    prop := 'continua'; chiede := false;
    motivo := case when imp = 'uguali' and fas = 'uguali' then 'stesse imprese e stesse fasi' else 'imprese e fasi in parte le stesse del ciclo' end;
  else
    prop := 'continua'; chiede := true;
    motivo := concat_ws('; ',
      case imp when 'diverse' then 'imprese esecutrici tutte diverse' when 'senza_dati' then 'imprese esecutrici non confrontabili' end,
      case fas when 'nuove' then 'fasi di lavoro nuove (prima: ' || array_to_string(fa, ', ') || '; ora: ' || array_to_string(fb, ', ') || ')'
               when 'senza_dati' then 'fasi non confrontabili (lavorazioni mancanti)' end,
      case when imp in ('uguali', 'parziali') then 'stesse imprese' when fas in ('uguali', 'parziali') then 'stesse fasi' end);
  end if;
  return jsonb_build_object('proposta', prop, 'chiede', chiede, 'motivo', motivo, 'imprese', imp, 'fasi', fas,
    'imprese_ciclo', to_jsonb(a), 'imprese_visita', to_jsonb(b), 'fasi_ciclo', to_jsonb(fa), 'fasi_visita', to_jsonb(fb));
end $$;

-- una serie? la visita è «in serie» (tipo 8) o il suo incarico è una serie di visite
create or replace function public.ciclo_visita_in_serie(p_tipo_accesso integer, p_incarico_id bigint)
returns boolean language sql stable set search_path to 'public' as $$
  select coalesce(p_tipo_accesso = 8, false)
      or exists (select 1 from public.incarichi i where i.id = p_incarico_id and i.tipo_richiesta ilike 'serie%')
$$;

-- ── 5. il ricalcolo di un lotto: idempotente, lo chiama il trigger ──
create or replace function public.ciclo_ricalcola_lotto(p_cantiere_id text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v record; r jsonb; prop jsonb; scelta text; fonte text; diverg boolean; azione text;
  imps text[]; fasi text[]; aut boolean;
  numero int := 0; aperti text[] := '{}'; visti text[] := '{}';
  cur_id bigint; cur_prima text; cur_n int; cur_imp text[]; cur_fasi text[]; cur_ipc0 text; cur_ipcf text; cur_serie boolean;
  cur_last date; cur_stato text; cur_esito text; cur_chiuso date; cur_critico date; cur_fermo date; cur_ult text;
  cur_perc text; cur_perc_il date; cur_perc_esito text; cur_perc_esito_il date;
  old_stato text; old_critico date; old_perc text;
  v_coord text; v_cant text; v_etich text; nuovi_fermi bigint[] := '{}'; nuovi_critici bigint[] := '{}';
begin
  if p_cantiere_id is null then return; end if;
  perform set_config('app.cicli_ricalcolo', '1', true);

  for v in
    select x.visita_id, x.data_visita, x.nr_verbale, upper(coalesce(nullif(trim(x.ipc), ''), 'NR')) as ipc,
           x.tipo_accesso, x.incarico_id, x.ciclo_scelta, x.ciclo_fonte, x.fp_tipo, x.fp_motivo_tipo
    from public.visite x
    where x.cantiere_id = p_cantiere_id and coalesce(x.elimina, 0) = 0 and x.stato = 'definitivo'
      and x.data_visita is not null and x.data_visita >= date '2026-10-01'
      and x.tipo_accesso is distinct from 10
    order by x.data_visita, x.nr_verbale nulls last, x.visita_id
  loop
    visti := visti || v.visita_id;
    select coalesce(array_agg(distinct p.impresa_id order by p.impresa_id), '{}') into imps
      from public.visite_imprese_presenti p
     where p.visita_id = v.visita_id and p.impresa_id is not null and coalesce(lower(trim(p.ruolo)), '') not in ('affidataria', 'fornitrice');
    select coalesce(array_agg(distinct lower(trim(l.fase)) order by lower(trim(l.fase))), '{}') into fasi
      from public.visite_lavorazioni l where l.visita_id = v.visita_id and nullif(trim(l.fase), '') is not null;

    -- un ciclo chiuso dal Coordinatore (nessun seguito, o esito del percorso) prima di questa visita è chiuso
    if cur_id is not null and cur_stato <> 'chiuso' then
      if cur_perc = 'nessuno' and cur_perc_il is not null and v.data_visita > cur_perc_il then
        cur_stato := 'chiuso'; cur_esito := 'non_risolto'; cur_chiuso := cur_perc_il;
      elsif cur_perc_esito is not null and cur_perc_esito_il is not null and v.data_visita > cur_perc_esito_il then
        cur_stato := 'chiuso'; cur_esito := 'in_percorso'; cur_chiuso := cur_perc_esito_il;
      end if;
      if cur_stato = 'chiuso' then
        update public.visite_cicli set stato = cur_stato, esito = cur_esito, chiuso_il = cur_chiuso, updated_at = now() where ciclo_id = cur_id;
      end if;
    end if;

    if cur_id is null or cur_stato = 'chiuso' then
      azione := 'apre'; scelta := 'nuovo'; fonte := 'programma'; diverg := false;
      prop := jsonb_build_object('proposta', 'nuovo', 'chiede', false,
        'motivo', case when cur_id is null then 'prima visita del lotto dal 1° ottobre 2026' else 'il ciclo precedente è chiuso' end);
    elsif v.data_visita = cur_last then
      azione := 'stessa'; scelta := 'continua'; fonte := 'programma'; diverg := false;
      prop := jsonb_build_object('proposta', 'continua', 'chiede', false, 'motivo', 'stesso giorno sullo stesso lotto: stessa visita del ciclo');
    else
      prop := public.ciclo_confronta(cur_imp, cur_fasi, imps, fasi, case when v.fp_tipo is not null then v.fp_motivo_tipo end);
      scelta := coalesce(v.ciclo_scelta, prop ->> 'proposta');
      fonte := case when v.ciclo_scelta is null then 'programma' when v.ciclo_fonte = 'coordinatore' then 'coordinatore' else 'tecnico' end;
      diverg := v.ciclo_scelta is not null and v.ciclo_scelta <> (prop ->> 'proposta');
      azione := case when scelta = 'nuovo' then 'apre' else 'continua' end;
    end if;

    if azione = 'apre' then
      if cur_id is not null and cur_stato <> 'chiuso' then   -- il ciclo in corso si chiude come superato: il cantiere è cambiato
        update public.visite_cicli set stato = 'chiuso', esito = 'superato', chiuso_il = v.data_visita, n_visite = cur_n,
          ipc_inizio = cur_ipc0, ipc_fine = cur_ipcf, ultima_visita_id = cur_ult, in_serie = cur_serie,
          fermo_il = cur_fermo, critico_il = cur_critico, updated_at = now() where ciclo_id = cur_id;
      end if;
      numero := numero + 1;
      select c.stato, c.critico_il, c.percorso into old_stato, old_critico, old_perc from public.visite_cicli c where c.prima_visita_id = v.visita_id;
      insert into public.visite_cicli (cantiere_id, numero, prima_visita_id, aperto_il, stato, n_visite)
      values (p_cantiere_id, numero, v.visita_id, v.data_visita, 'aperto', 0)
      on conflict (prima_visita_id) do update set cantiere_id = excluded.cantiere_id, numero = excluded.numero, aperto_il = excluded.aperto_il, updated_at = now()
      returning ciclo_id, percorso, percorso_il::date, percorso_esito, percorso_esito_il::date
        into cur_id, cur_perc, cur_perc_il, cur_perc_esito, cur_perc_esito_il;
      aperti := aperti || v.visita_id;
      cur_prima := v.visita_id; cur_n := 0; cur_imp := '{}'; cur_fasi := '{}'; cur_ipc0 := v.ipc; cur_serie := false;
      cur_critico := null; cur_fermo := null; cur_chiuso := null; cur_esito := null;
    end if;

    if azione <> 'stessa' then cur_n := cur_n + 1; end if;
    cur_imp := array(select distinct u from unnest(cur_imp || imps) u order by u);
    cur_fasi := array(select distinct u from unnest(cur_fasi || fasi) u order by u);
    cur_last := v.data_visita; cur_ipcf := v.ipc; cur_ult := v.visita_id;
    cur_serie := cur_serie or public.ciclo_visita_in_serie(v.tipo_accesso, v.incarico_id);
    aut := cur_serie or cur_perc in ('visite_4_5', 'serie', 'conferenza', 'commissione');
    r := public.ciclo_regola(cur_n, v.ipc, aut);
    case r ->> 'esito'
      when 'archivia' then cur_stato := 'chiuso'; cur_esito := 'risolto'; cur_chiuso := v.data_visita;
      when 'fermo' then cur_stato := 'fermo'; cur_fermo := coalesce(cur_fermo, v.data_visita);
      when 'critico' then cur_stato := 'aperto'; cur_critico := coalesce(cur_critico, v.data_visita);
      else cur_stato := 'aperto';
    end case;

    update public.visite set ciclo_id = cur_id, ciclo_visita = cur_n, ciclo_proposta = prop, ciclo_divergente = diverg,
      ciclo_fonte = fonte, ciclo_esito = r ->> 'esito', ciclo_rientro_giorni = (r ->> 'giorni')::int
     where visita_id = v.visita_id
       and (ciclo_id is distinct from cur_id or ciclo_visita is distinct from cur_n or ciclo_proposta is distinct from prop
            or ciclo_divergente is distinct from diverg or ciclo_fonte is distinct from fonte
            or ciclo_esito is distinct from (r ->> 'esito') or ciclo_rientro_giorni is distinct from (r ->> 'giorni')::int);
    update public.visite_cicli set stato = cur_stato, esito = case when cur_stato = 'chiuso' then cur_esito end, chiuso_il = cur_chiuso,
      n_visite = cur_n, ipc_inizio = cur_ipc0, ipc_fine = cur_ipcf, ultima_visita_id = cur_ult, in_serie = cur_serie,
      fermo_il = cur_fermo, critico_il = cur_critico, updated_at = now()
     where ciclo_id = cur_id;
    if cur_stato = 'fermo' and old_stato is distinct from 'fermo' and not (cur_id = any(nuovi_fermi)) then nuovi_fermi := nuovi_fermi || cur_id; end if;
    if cur_critico is not null and old_critico is null and not (cur_id = any(nuovi_critici)) then nuovi_critici := nuovi_critici || cur_id; end if;
    old_stato := cur_stato; old_critico := cur_critico;
  end loop;

  -- l'ultimo ciclo chiuso dal Coordinatore dopo l'ultima visita
  if cur_id is not null and cur_stato <> 'chiuso' then
    if cur_perc = 'nessuno' and cur_perc_il is not null then
      update public.visite_cicli set stato = 'chiuso', esito = 'non_risolto', chiuso_il = cur_perc_il, updated_at = now() where ciclo_id = cur_id;
    elsif cur_perc_esito is not null and cur_perc_esito_il is not null then
      update public.visite_cicli set stato = 'chiuso', esito = 'in_percorso', chiuso_il = cur_perc_esito_il, updated_at = now() where ciclo_id = cur_id;
    end if;
  end if;

  -- cicli del lotto che non esistono più, e visite che non ne fanno più parte (bozze, eliminate, asseverazioni)
  delete from public.visite_cicli c where c.cantiere_id = p_cantiere_id and not (c.prima_visita_id = any(aperti));
  update public.visite set ciclo_id = null, ciclo_visita = null, ciclo_proposta = null, ciclo_divergente = null, ciclo_fonte = null,
    ciclo_esito = null, ciclo_rientro_giorni = null
   where cantiere_id = p_cantiere_id and not (visita_id = any(visti)) and (ciclo_id is not null or ciclo_visita is not null);
  -- una visita spostata su un altro lotto resta agganciata a un ciclo di questo? no: il ciclo è del lotto
  update public.visite x set ciclo_id = null, ciclo_visita = null, ciclo_esito = null, ciclo_rientro_giorni = null
   from public.visite_cicli c where x.ciclo_id = c.ciclo_id and c.cantiere_id = p_cantiere_id and x.cantiere_id is distinct from p_cantiere_id;

  -- il Coordinatore lo sa: ciclo fermo alla 3ª visita, o cantiere critico proposto
  if cardinality(nuovi_fermi) > 0 or cardinality(nuovi_critici) > 0 then
    begin
      select lower(valore) into v_coord from public.s_config where chiave = 'coordinatore_email';
      select coalesce(nullif(trim(c.cantiere_etichetta), ''), trim(coalesce(c.cantiere_indirizzo, '') || ' ' || coalesce(c.cantiere_civico, '')), '?')
             || case when nullif(trim(c.comune_nome), '') is not null then ' — ' || c.comune_nome else '' end into v_etich
        from public.cantieri c where c.cantiere_id = p_cantiere_id;
      if coalesce(v_coord, '') <> '' then
        if cardinality(nuovi_fermi) > 0 then
          perform public.push_accoda(v_coord, 'ciclo_fermo:' || nuovi_fermi[1], 'Ciclo di visita fermo',
            v_etich || ': 3ª visita con IPC medio non risolto. Decidi il seguito nella Zona Coordinatore (visite 4ª-5ª, serie, conferenza, Commissione).',
            './?vista=admin', 'ciclo-' || nuovi_fermi[1]);
        end if;
        if cardinality(nuovi_critici) > 0 then
          perform public.push_accoda(v_coord, 'ciclo_critico:' || nuovi_critici[1], 'Cantiere critico proposto',
            v_etich || ': IPC alto che persiste o IPC medio dopo la 5ª visita del ciclo. Da valutare come cantiere critico.',
            './?vista=admin', 'ciclo-critico-' || nuovi_critici[1]);
        end if;
      end if;
    exception when others then raise warning 'ciclo_ricalcola_lotto push: %', sqlerrm; end;
  end if;
  perform set_config('app.cicli_ricalcolo', '', true);
end $$;

-- il trigger: ogni cambiamento che può spostare un ciclo rifà il lotto (e il lotto di prima, se la visita è cambiata di lotto)
create or replace function public.tg_visite_cicli()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(current_setting('app.cicli_ricalcolo', true), '') = '1' then return null; end if;
  if tg_op = 'DELETE' then
    if old.data_visita >= date '2026-10-01' then perform public.ciclo_ricalcola_lotto(old.cantiere_id); end if;
    return null;
  end if;
  if coalesce(new.data_visita >= date '2026-10-01', false) or (tg_op = 'UPDATE' and coalesce(old.data_visita >= date '2026-10-01', false)) then
    perform public.ciclo_ricalcola_lotto(new.cantiere_id);
    if tg_op = 'UPDATE' and old.cantiere_id is distinct from new.cantiere_id then perform public.ciclo_ricalcola_lotto(old.cantiere_id); end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_visite_zz_cicli on public.visite;
create trigger trg_visite_zz_cicli after insert or delete or update of stato, elimina, data_visita, cantiere_id, ipc, tipo_accesso, incarico_id, nr_verbale, ciclo_scelta, fp_motivo_tipo
  on public.visite for each row execute function public.tg_visite_cicli();

-- la scelta del tecnico la scrive solo chi può scrivere il verbale; l'esito del ciclo lo scrive solo il ricalcolo
create or replace function public.tg_visite_cicli_campi()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if coalesce(current_setting('app.cicli_ricalcolo', true), '') = '1' then return new; end if;
  if tg_op = 'UPDATE' then
    new.ciclo_id := old.ciclo_id; new.ciclo_visita := old.ciclo_visita; new.ciclo_proposta := old.ciclo_proposta;
    new.ciclo_divergente := old.ciclo_divergente; new.ciclo_esito := old.ciclo_esito; new.ciclo_rientro_giorni := old.ciclo_rientro_giorni;
    if coalesce(current_setting('app.ciclo_correggi', true), '') <> new.visita_id then new.ciclo_fonte := old.ciclo_fonte; end if;
  else
    new.ciclo_id := null; new.ciclo_visita := null; new.ciclo_proposta := null; new.ciclo_divergente := null;
    new.ciclo_esito := null; new.ciclo_rientro_giorni := null; new.ciclo_fonte := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_visite_a_cicli_campi on public.visite;
create trigger trg_visite_a_cicli_campi before insert or update on public.visite for each row execute function public.tg_visite_cicli_campi();

-- ── 6. la proposta per il verbale aperto (la chiama il gestionale nel Riepilogo) ──
-- Confronta imprese e fasi che il tecnico ha nella maschera con il ciclo aperto del lotto (senza questa visita).
create or replace function public.ciclo_proposta(p_cantiere_id text, p_data date, p_visita_id text, p_imprese text[], p_fasi text[],
                                                p_fp_motivo text default null, p_tipo_accesso integer default null, p_ipc text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  ult record; c record; imp_c text[]; fasi_c text[]; prop jsonb; aut boolean; n_cont int; stessa boolean := false;
  fasi_v text[]; imp_v text[];
begin
  if not public.is_personale() then raise exception 'Riservato al personale dell''Area.' using errcode = '42501'; end if;
  if p_cantiere_id is null or p_data is null then return jsonb_build_object('ciclo', null, 'proposta', null, 'chiede', false, 'motivo', 'cantiere o data mancanti'); end if;
  if p_tipo_accesso = 10 then return jsonb_build_object('escluso', true, 'motivo', 'le visite di asseverazione non entrano nei cicli'); end if;
  if p_data < date '2026-10-01' then return jsonb_build_object('escluso', true, 'motivo', 'i cicli partono dalle visite dal 1° ottobre 2026'); end if;
  imp_v := array(select distinct u from unnest(coalesce(p_imprese, '{}')) u where nullif(trim(u), '') is not null order by u);
  fasi_v := array(select distinct lower(trim(u)) from unnest(coalesce(p_fasi, '{}')) u where nullif(trim(u), '') is not null order by 1);
  -- l'ultima altra visita del lotto, fino a questa data
  select v.visita_id, v.data_visita, v.ciclo_id, v.ciclo_visita, upper(coalesce(nullif(trim(v.ipc), ''), 'NR')) as ipc into ult
    from public.visite v
   where v.cantiere_id = p_cantiere_id and coalesce(v.elimina, 0) = 0 and v.stato = 'definitivo' and v.data_visita is not null
     and v.data_visita >= date '2026-10-01' and v.data_visita <= p_data and v.tipo_accesso is distinct from 10
     and (p_visita_id is null or v.visita_id <> p_visita_id)
   order by v.data_visita desc, v.nr_verbale desc nulls last limit 1;
  if not found or ult.ciclo_id is null then
    return jsonb_build_object('ciclo', null, 'proposta', 'nuovo', 'chiede', false, 'motivo', 'prima visita del lotto dal 1° ottobre 2026',
      'visita_se_continua', 1, 'regola', jsonb_build_object('nuovo', public.ciclo_regola(1, p_ipc, false)));
  end if;
  select * into c from public.visite_cicli where ciclo_id = ult.ciclo_id;
  aut := c.in_serie or coalesce(p_tipo_accesso = 8, false) or c.percorso in ('visite_4_5', 'serie', 'conferenza', 'commissione');
  if c.stato = 'chiuso' then
    return jsonb_build_object('ciclo', to_jsonb(c), 'proposta', 'nuovo', 'chiede', false,
      'motivo', 'il ciclo ' || c.numero || ' è chiuso (' || coalesce(c.esito, '') || ' il ' || to_char(c.chiuso_il, 'DD/MM/YYYY') || ')',
      'visita_se_continua', 1, 'regola', jsonb_build_object('nuovo', public.ciclo_regola(1, p_ipc, false)));
  end if;
  if ult.data_visita = p_data then
    stessa := true; n_cont := ult.ciclo_visita;
    prop := jsonb_build_object('proposta', 'continua', 'chiede', false, 'motivo', 'stesso giorno sullo stesso lotto: stessa visita ' || n_cont || ' del ciclo ' || c.numero);
  else
    n_cont := c.n_visite + 1;
    select coalesce(array_agg(distinct p.impresa_id order by p.impresa_id), '{}') into imp_c
      from public.visite_imprese_presenti p join public.visite v on v.visita_id = p.visita_id
     where v.ciclo_id = c.ciclo_id and (p_visita_id is null or v.visita_id <> p_visita_id)
       and p.impresa_id is not null and coalesce(lower(trim(p.ruolo)), '') not in ('affidataria', 'fornitrice');
    select coalesce(array_agg(distinct lower(trim(l.fase)) order by lower(trim(l.fase))), '{}') into fasi_c
      from public.visite_lavorazioni l join public.visite v on v.visita_id = l.visita_id
     where v.ciclo_id = c.ciclo_id and (p_visita_id is null or v.visita_id <> p_visita_id) and nullif(trim(l.fase), '') is not null;
    prop := public.ciclo_confronta(imp_c, fasi_c, imp_v, fasi_v, p_fp_motivo);
  end if;
  return prop || jsonb_build_object('ciclo', to_jsonb(c), 'stessa_visita', stessa, 'visita_se_continua', n_cont, 'autorizzata', aut,
    'ultima', jsonb_build_object('visita_id', ult.visita_id, 'data_visita', ult.data_visita, 'ipc', ult.ipc, 'ciclo_visita', ult.ciclo_visita),
    'regola', jsonb_build_object('continua', public.ciclo_regola(n_cont, p_ipc, aut), 'nuovo', public.ciclo_regola(1, p_ipc, false)));
end $$;

-- ── 7. le decisioni del Coordinatore ──
-- la strada quando il ciclo si ferma alla 3ª visita (o dopo): visite 4ª-5ª, serie, conferenza, Commissione, nessun seguito
create or replace function public.ciclo_percorso(p_ciclo_id bigint, p_percorso text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c record; v_io text := lower(coalesce(auth.jwt() ->> 'email', '')); v_etich text; v_dec bigint; v_tec text; v_mail text; v_ipc text;
begin
  if not public.is_coordinatore() then raise exception 'Il seguito di un ciclo fermo lo decide solo il Coordinatore.' using errcode = '42501'; end if;
  if p_percorso not in ('visite_4_5', 'serie', 'conferenza', 'commissione', 'nessuno') then raise exception 'Percorso non valido.' using errcode = '22023'; end if;
  select * into c from public.visite_cicli where ciclo_id = p_ciclo_id for update;
  if not found then raise exception 'Ciclo non trovato.' using errcode = 'P0002'; end if;
  if c.stato = 'chiuso' then raise exception 'Il ciclo è già chiuso (%).', coalesce(c.esito, '') using errcode = '22023'; end if;
  select coalesce(nullif(trim(k.cantiere_etichetta), ''), trim(coalesce(k.cantiere_indirizzo, '') || ' ' || coalesce(k.cantiere_civico, '')), '?')
         || case when nullif(trim(k.comune_nome), '') is not null then ' — ' || k.comune_nome else '' end into v_etich
    from public.cantieri k where k.cantiere_id = c.cantiere_id;
  if p_percorso = 'commissione' and c.decisione_id is null then
    select string_agg(x.ciclo_visita || 'ª ' || coalesce(nullif(upper(x.ipc), ''), 'NR'), ', ' order by x.ciclo_visita) into v_ipc
      from public.visite x where x.ciclo_id = c.ciclo_id;
    insert into public.s_decisioni (questione, dettaglio, riguarda, decisore, priorita, link, aperta_da, aperta_da_nome, origine, origine_rif)
    values ('Cantiere ' || v_etich || ': dopo ' || c.n_visite || ' visite l''IPC medio non è risolto. Decidere il seguito.',
            'Ciclo di visita n. ' || c.numero || ' sul lotto, aperto il ' || to_char(c.aperto_il, 'DD/MM/YYYY') || '. IPC per visita: ' || coalesce(v_ipc, '') || '.'
              || case when nullif(trim(coalesce(p_nota, '')), '') is not null then ' Nota del Coordinatore: ' || trim(p_nota) else '' end,
            'Gestionale visite, Zona Coordinatore, cicli di visita', 'commissione', 'normale', './?vista=admin', v_io, 'Coordinatore', 'app', 'ciclo:' || c.ciclo_id)
    returning id into v_dec;
  end if;
  update public.visite_cicli set percorso = p_percorso, percorso_da = v_io, percorso_il = now(), percorso_nota = nullif(trim(coalesce(p_nota, '')), ''),
    decisione_id = coalesce(v_dec, decisione_id), updated_at = now() where ciclo_id = p_ciclo_id;
  perform public.ciclo_ricalcola_lotto(c.cantiere_id);
  -- il tecnico dell'ultima visita lo sa
  begin
    select t.email, t.tecnico_id into v_mail, v_tec from public.visite x join public.tecnici t on t.tecnico_id = x.tecnico_id where x.visita_id = c.ultima_visita_id;
    if coalesce(v_mail, '') <> '' and lower(v_mail) <> v_io then
      perform public.push_accoda(lower(v_mail), 'ciclo_percorso:' || p_ciclo_id, 'Ciclo di visita: deciso il seguito',
        v_etich || ': il Coordinatore ha scelto «' || case p_percorso when 'visite_4_5' then 'visite 4ª e 5ª' when 'serie' then 'serie di visite' when 'conferenza' then 'conferenza di cantiere'
          when 'commissione' then 'caso alla Commissione' else 'nessun seguito' end || '»' || case when nullif(trim(coalesce(p_nota, '')), '') is not null then '. ' || left(trim(p_nota), 120) else '.' end,
        './?vista=scadenze', 'ciclo-perc-' || p_ciclo_id);
    end if;
  exception when others then raise warning 'ciclo_percorso push: %', sqlerrm; end;
  return jsonb_build_object('ok', true, 'percorso', p_percorso, 'decisione_id', v_dec);
end $$;

-- com'è finito il percorso (chiude il ciclo con esito «in percorso»)
create or replace function public.ciclo_percorso_esito(p_ciclo_id bigint, p_esito text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c record; v_io text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.is_coordinatore() then raise exception 'L''esito del percorso lo scrive solo il Coordinatore.' using errcode = '42501'; end if;
  if p_esito not in ('risolto', 'non_risolto') then raise exception 'Esito non valido: risolto o non_risolto.' using errcode = '22023'; end if;
  select * into c from public.visite_cicli where ciclo_id = p_ciclo_id for update;
  if not found then raise exception 'Ciclo non trovato.' using errcode = 'P0002'; end if;
  if c.percorso is null or c.percorso = 'nessuno' then raise exception 'Questo ciclo non ha un percorso in corso.' using errcode = '22023'; end if;
  update public.visite_cicli set percorso_esito = p_esito, percorso_esito_da = v_io, percorso_esito_il = now(),
    percorso_esito_nota = nullif(trim(coalesce(p_nota, '')), ''), updated_at = now() where ciclo_id = p_ciclo_id;
  perform public.ciclo_ricalcola_lotto(c.cantiere_id);
  return jsonb_build_object('ok', true, 'esito', p_esito);
end $$;

-- il Coordinatore corregge la scelta del tecnico (continua / nuovo) su una visita
create or replace function public.ciclo_correggi(p_visita_id text, p_scelta text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v record; v_io text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.is_coordinatore() then raise exception 'La scelta del ciclo la corregge solo il Coordinatore.' using errcode = '42501'; end if;
  if p_scelta not in ('continua', 'nuovo') then raise exception 'Scelta non valida: continua o nuovo.' using errcode = '22023'; end if;
  select visita_id, cantiere_id, ciclo_motivo into v from public.visite where visita_id = p_visita_id and stato = 'definitivo' and coalesce(elimina, 0) = 0;
  if not found then raise exception 'Verbale non trovato o non definitivo.' using errcode = 'P0002'; end if;
  perform set_config('app.ciclo_correggi', p_visita_id, true);
  update public.visite set ciclo_scelta = p_scelta, ciclo_fonte = 'coordinatore',
    ciclo_motivo = concat_ws(' — ', nullif(trim(coalesce(v.ciclo_motivo, '')), ''), 'Coordinatore (' || to_char(now(), 'DD/MM/YYYY') || '): ' || coalesce(nullif(trim(p_nota), ''), 'corretto'))
   where visita_id = p_visita_id;
  perform set_config('app.ciclo_correggi', '', true);
  return jsonb_build_object('ok', true);
end $$;

-- quello che vede il Coordinatore nella sua Zona (e la segreteria, in lettura)
create or replace function public.cicli_coord(p_dal date, p_al date)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare j jsonb; es text; ob record;
begin
  if not (public.is_coordinatore() or public.is_segreteria()) then raise exception 'Riservato al Coordinatore e alla segreteria.' using errcode = '42501'; end if;
  es := case when extract(month from current_date) >= 10 then extract(year from current_date)::int else extract(year from current_date)::int - 1 end
        || '/' || case when extract(month from current_date) >= 10 then extract(year from current_date)::int + 1 else extract(year from current_date)::int end;
  select o.esercizio, coalesce(o.visite_minime_manuali, o.visite_minime) as minime,
         (select count(*) from public.visite x where coalesce(x.elimina, 0) = 0 and x.data_visita between (left(es, 4) || '-10-01')::date and (right(es, 4) || '-09-30')::date) as fatte
    into ob from public.visite_obiettivo_esercizio o where o.esercizio = es;
  with cic as (
    select c.*, k.cantiere_etichetta, k.cantiere_indirizzo, k.cantiere_civico, k.comune_nome, k.cantiere_chiuso,
           coalesce(nullif(trim(k.cantiere_etichetta), ''), trim(coalesce(k.cantiere_indirizzo, '') || ' ' || coalesce(k.cantiere_civico, '')), '?')
             || case when nullif(trim(k.comune_nome), '') is not null then ' — ' || k.comune_nome else '' end as etichetta,
           (select i.impresa_nome from public.visite x join public.imprese i on i.impresa_id = x.impresa_id where x.visita_id = c.ultima_visita_id) as impresa,
           (select trim(coalesce(t.tecnico_cognome, '') || ' ' || coalesce(t.tecnico_nome, '')) from public.visite x join public.tecnici t on t.tecnico_id = x.tecnico_id where x.visita_id = c.ultima_visita_id) as tecnico,
           (select x.nr_verbale from public.visite x where x.visita_id = c.ultima_visita_id) as ultimo_verbale,
           (select x.data_visita from public.visite x where x.visita_id = c.ultima_visita_id) as ultima_data,
           (select jsonb_agg(jsonb_build_object('n', x.ciclo_visita, 'ipc', coalesce(nullif(upper(x.ipc), ''), 'NR'), 'data', x.data_visita, 'verbale', x.nr_verbale) order by x.ciclo_visita, x.data_visita)
              from public.visite x where x.ciclo_id = c.ciclo_id) as visite
    from public.visite_cicli c join public.cantieri k on k.cantiere_id = c.cantiere_id
  )
  select jsonb_build_object(
    'budget', case when ob.esercizio is null then null else jsonb_build_object('esercizio', ob.esercizio, 'minime', ob.minime, 'fatte', ob.fatte) end,
    'fermi', coalesce((select jsonb_agg(to_jsonb(c) order by c.fermo_il nulls last, c.ultima_data) from cic c where c.stato = 'fermo'), '[]'::jsonb),
    'in_percorso', coalesce((select jsonb_agg(to_jsonb(c) order by c.percorso_il) from cic c where c.stato <> 'chiuso' and c.percorso is not null and c.percorso <> 'nessuno'), '[]'::jsonb),
    'critici', coalesce((select jsonb_agg(to_jsonb(c) order by c.critico_il) from cic c where c.stato <> 'chiuso' and c.critico_il is not null), '[]'::jsonb),
    'divergenze', coalesce((select jsonb_agg(jsonb_build_object('visita_id', x.visita_id, 'nr_verbale', x.nr_verbale, 'data_visita', x.data_visita,
         'tecnico', trim(coalesce(t.tecnico_cognome, '') || ' ' || coalesce(t.tecnico_nome, '')), 'etichetta', cc.etichetta, 'ciclo_numero', cc.numero, 'ciclo_visita', x.ciclo_visita,
         'scelta', x.ciclo_scelta, 'proposta', x.ciclo_proposta ->> 'proposta', 'motivo_programma', x.ciclo_proposta ->> 'motivo',
         'motivo_tipo', x.ciclo_motivo_tipo, 'motivo', x.ciclo_motivo, 'fonte', x.ciclo_fonte) order by x.data_visita desc)
       from public.visite x join public.tecnici t on t.tecnico_id = x.tecnico_id left join cic cc on cc.ciclo_id = x.ciclo_id
       where coalesce(x.elimina, 0) = 0 and x.data_visita between p_dal and p_al and (x.ciclo_divergente or x.ciclo_fonte = 'coordinatore')), '[]'::jsonb),
    'chieste', (select count(*) from public.visite x where coalesce(x.elimina, 0) = 0 and x.data_visita between p_dal and p_al and (x.ciclo_proposta ->> 'chiede')::boolean),
    'ultime_decisioni', coalesce((select jsonb_agg(to_jsonb(c) order by c.percorso_il desc) from (select * from cic where percorso is not null order by percorso_il desc limit 10) c), '[]'::jsonb)
  ) into j;
  return j;
end $$;

-- ── 8. le statistiche interne: esiti dei cicli, miglioramento dell'IPC, serie ──
-- Stessa visibilità di dash_commissione: a chi non è personale un errore; «vede solo le sue» rispettato.
create or replace function public.dash_cicli_calcolo(p_da date default null, p_a date default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with vis as materialized (select public.solo_proprie() s, public.mio_tecnico_id() me, public.cantieri_extra_miei() cx, public.is_personale() pers),
  liv as (select * from (values ('NR', 0), ('BASSO', 1), ('MEDIO', 2), ('ALTO', 3)) l(ipc, n)),
  c0 as materialized (
    select c.*, coalesce(k.cantiere_chiuso, false) as cantiere_chiuso,
           (select x.ciclo_rientro_giorni from public.visite x where x.visita_id = c.ultima_visita_id) as g,
           (select coalesce(x.data_ritorno, x.data_visita + x.ciclo_rientro_giorni) from public.visite x where x.visita_id = c.ultima_visita_id) as rientro_il,
           (select x.ciclo_esito from public.visite x where x.visita_id = c.ultima_visita_id) as esito_visita,
           (select x.incarico_id from public.visite x where x.visita_id = c.prima_visita_id) as incarico_id,
           li.n as l0, lf.n as lf
    from public.visite_cicli c join public.cantieri k on k.cantiere_id = c.cantiere_id
    cross join vis
    left join liv li on li.ipc = coalesce(c.ipc_inizio, 'NR') left join liv lf on lf.ipc = coalesce(c.ipc_fine, 'NR')
    where (p_da is null or c.aperto_il >= p_da) and (p_a is null or c.aperto_il <= p_a)
      and (not vis.s or c.cantiere_id = any(vis.cx) or exists (select 1 from public.visite x where x.ciclo_id = c.ciclo_id and (x.tecnico_id = vis.me or x.tecnico2_id = vis.me)))
  ),
  c1 as materialized (
    select c.*, case
      when c.stato = 'chiuso' and c.esito = 'risolto' and c.n_visite > 3 then 'risolto_dopo_3'
      when c.stato = 'chiuso' then c.esito
      when c.stato = 'fermo' then 'fermo'
      when c.critico_il is not null then 'critico_aperto'
      when c.percorso is not null and c.percorso <> 'nessuno' then 'in_percorso_aperto'
      when c.cantiere_chiuso then 'cantiere_chiuso'
      when c.g is null then 'aperto_senza_rientro'
      when c.rientro_il >= current_date then 'ritorno_in_attesa'
      else 'ritorno_non_fatto' end as classe
    from c0 c
  ),
  ser as materialized (   -- le serie di visite con cicli nel periodo
    select i.id, i.impresa, i.visite_previste, i.visite_fatte, i.stato,
           count(distinct c.ciclo_id) as cicli, count(distinct c.cantiere_id) as lotti,
           min(c.aperto_il) as dal, max(c.ultima) as al,
           (array_agg(c.ipc_inizio order by c.aperto_il))[1] as ipc_inizio,
           (array_agg(c.ipc_fine order by c.ultima desc))[1] as ipc_fine
    from (select c.*, (select x.data_visita from public.visite x where x.visita_id = c.ultima_visita_id) as ultima from c1 c) c
    join (select distinct x.ciclo_id, x.incarico_id from public.visite x where x.incarico_id is not null) xi on xi.ciclo_id = c.ciclo_id
    join public.incarichi i on i.id = xi.incarico_id
    where i.tipo_richiesta ilike 'serie%'
    group by i.id, i.impresa, i.visite_previste, i.visite_fatte, i.stato
  )
  select jsonb_build_object(
    'dal', date '2026-10-01',
    'cicli', (select count(*) from c1),
    'lotti', (select count(distinct cantiere_id) from c1),
    'visite', (select coalesce(sum(n_visite), 0) from c1),
    'classi', (select coalesce(jsonb_object_agg(classe, n), '{}'::jsonb) from (select classe, count(*) n from c1 group by classe) q),
    'percorsi', (select coalesce(jsonb_agg(jsonb_build_object('percorso', percorso, 'n', n, 'risolti', r, 'non_risolti', nr)), '[]'::jsonb)
                   from (select percorso, count(*) n, count(*) filter (where percorso_esito = 'risolto') r, count(*) filter (where percorso_esito = 'non_risolto') nr
                           from c1 where percorso is not null group by percorso) q),
    'visite_per_ciclo', jsonb_build_object('media', (select round(avg(n_visite)::numeric, 2) from c1),
                           'dist', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select least(n_visite, 5)::text k, count(*) n from c1 group by 1) q)),
    'ipc', (select jsonb_build_object(
              'con_ritorno', count(*) filter (where n_visite > 1),
              'migliorati', count(*) filter (where n_visite > 1 and lf < l0),
              'uguali', count(*) filter (where n_visite > 1 and lf = l0),
              'uguali_basso', count(*) filter (where n_visite > 1 and lf = l0 and lf <= 1),
              'peggiorati', count(*) filter (where n_visite > 1 and lf > l0),
              'matrice', coalesce((select jsonb_agg(jsonb_build_object('da', ipc_inizio, 'a', ipc_fine, 'n', n)) from (select coalesce(ipc_inizio, 'NR') ipc_inizio, coalesce(ipc_fine, 'NR') ipc_fine, count(*) n from c1 where n_visite > 1 group by 1, 2) m), '[]'::jsonb),
              'prima', coalesce((select jsonb_object_agg(ipc, n) from (select coalesce(ipc_inizio, 'NR') ipc, count(*) n from c1 group by 1) q), '{}'::jsonb))
            from c1),
    'serie', (select jsonb_build_object(
               'n', count(*), 'previste', coalesce(sum(visite_previste), 0), 'fatte', coalesce(sum(visite_fatte), 0), 'cicli', coalesce(sum(cicli), 0),
               'migliorate', count(*) filter (where li.n > lf.n), 'peggiorate', count(*) filter (where li.n < lf.n),
               'righe', case when (select pers from vis) then coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'impresa', s.impresa, 'stato', s.stato, 'previste', s.visite_previste, 'fatte', s.visite_fatte,
                           'cicli', s.cicli, 'lotti', s.lotti, 'dal', s.dal, 'al', s.al, 'ipc_inizio', coalesce(s.ipc_inizio, 'NR'), 'ipc_fine', coalesce(s.ipc_fine, 'NR')) order by s.dal), '[]'::jsonb) else '[]'::jsonb end)
             from ser s left join liv li on li.ipc = coalesce(s.ipc_inizio, 'NR') left join liv lf on lf.ipc = coalesce(s.ipc_fine, 'NR')),
    'divergenze', (select count(*) from public.visite x join c1 on c1.ciclo_id = x.ciclo_id where x.ciclo_divergente),
    'chieste', (select count(*) from public.visite x join c1 on c1.ciclo_id = x.ciclo_id where (x.ciclo_proposta ->> 'chiede')::boolean)
  )
$$;

create or replace function public.dash_cicli(p_da date default null, p_a date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_personale() then raise exception 'Riservato al personale dell''Area.' using errcode = '42501'; end if;
  return public.dash_cicli_calcolo(p_da, p_a);
end $$;

-- ── 9. i consumatori della regola passano sulla visita del ciclo ──
-- fuori procedura: con un ciclo, «archiviato» = ciclo chiuso; fermo o critico = nessun avviso (decide il Coordinatore)
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
         v.ciclo_id, v.ciclo_visita, v.ciclo_esito, v.ciclo_rientro_giorni,
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
  select count(*) into n_acc from public.visite v
   where v.cantiere_id = p_cantiere_id and coalesce(v.elimina, 0) = 0 and v.data_visita is not null
     and v.data_visita <= u.data_visita and (p_visita_id is null or v.visita_id <> p_visita_id);
  select count(*) into n_tot from public.visite v
   where v.cantiere_id = p_cantiere_id and coalesce(v.elimina, 0) = 0 and v.data_visita is not null
     and v.data_visita <= p_data and (p_visita_id is null or v.visita_id <> p_visita_id);
  if u.ciclo_visita is not null and u.ciclo_esito in ('fermo', 'critico') then
    return jsonb_build_object('fuori', false, 'archiviato', false, 'ciclo', u.ciclo_esito, 'accesso_nuovo', n_tot + 1,
      'nota', case when u.ciclo_esito = 'fermo' then 'ciclo fermo: il seguito lo decide il Coordinatore' else 'cantiere critico proposto' end,
      'ultima', jsonb_build_object('visita_id', u.visita_id, 'nr_verbale', u.nr_verbale, 'data_visita', u.data_visita,
        'ipc', coalesce(nullif(upper(u.ipc), ''), 'NR'), 'accesso', n_acc, 'ciclo_visita', u.ciclo_visita, 'tecnico', u.tecnico, 'tecnico_id', u.tecnico_id));
  end if;
  giorni := public.visita_rientro_giorni(n_acc, u.ipc, u.ciclo_visita, u.ciclo_rientro_giorni);
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
      'ipc', coalesce(nullif(upper(u.ipc), ''), 'NR'), 'accesso', n_acc, 'ciclo_visita', u.ciclo_visita, 'tecnico', u.tecnico, 'tecnico_id', u.tecnico_id,
      'data_ritorno', u.data_ritorno));
end $$;

-- rientri dovuti: la regola sulla visita del ciclo quando c'è, sull'accesso per lo storico
create or replace function public.fp_rientri_dovuti(p_email text default null)
returns table (cantiere_id text, etichetta text, comune text, visita_id text, nr_verbale text, data_visita date,
               ipc text, accesso integer, rientro_il date, giorni integer, tipo text, tecnico_id text)
language sql stable security definer set search_path to 'public' as $$
  with me as (
    select t.tecnico_id from public.tecnici t
     where p_email is not null and lower(t.email) = lower(p_email)
     order by coalesce(t.attivo, false) desc limit 1
  ), ult as (
    select distinct on (v.cantiere_id) v.cantiere_id, v.visita_id, v.nr_verbale, v.data_visita, v.ipc, v.data_ritorno, v.tecnico_id,
           v.ciclo_visita, v.ciclo_rientro_giorni
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
    select c.*, public.visita_rientro_giorni(c.n, c.ipc, c.ciclo_visita, c.ciclo_rientro_giorni) as g from calc c
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

-- promemoria del lunedì ai tecnici: stessa regola (acc resta l'accesso stampato, per il testo della mail)
create or replace function public.ricontrolli_pendenti(p_giorni_imminenti integer default 7)
returns table(tecnico_id text, tecnico_email text, tecnico_nome text, cantiere_id text, cantiere_label text, nr_verbale text, data_visita date, acc integer, ipc text, data_rientro date, tipo text, giorni_diff integer, categoria text)
language sql stable security definer set search_path to 'public' as $$
  with ultime as (
    select distinct on (v.cantiere_id) v.*
    from public.visite v
    join public.cantieri c on c.cantiere_id = v.cantiere_id
    where coalesce(v.elimina,0)=0
      and coalesce(c.cantiere_chiuso,false)=false
    order by v.cantiere_id, v.data_visita desc, v.nr_verbale desc
  ),
  calc as (
    select coalesce(pt.a_tecnico_id, u.tecnico_id) as tecnico_id, u.cantiere_id, u.nr_verbale, u.data_visita,
      u.data_ritorno as data_ritorno_valida,
      nullif(regexp_replace(coalesce(u.acc_cant::text,''),'\D','','g'),'')::int as acc,
      upper(coalesce(nullif(trim(u.ipc),''),'NR')) as ipc,
      u.ciclo_visita, u.ciclo_rientro_giorni
    from ultime u
    left join public.v_pendenze_titolari pt on pt.visita_id = u.visita_id
  ),
  g as (
    select c.*,
      public.visita_rientro_giorni(c.acc, c.ipc, c.ciclo_visita, c.ciclo_rientro_giorni) as giorni,
      case public.visita_rientro_giorni(c.acc, c.ipc, c.ciclo_visita, c.ciclo_rientro_giorni)
        when 3 then case when coalesce(c.ciclo_visita, c.acc, 1) <= 1 then 'urgente' else 'immediata' end
        when 22 then 'ordinaria' end as tipo
    from calc c
  ),
  eff as (
    select g.*,
      case
        when g.giorni is null then null
        when g.data_ritorno_valida is not null then g.data_ritorno_valida
        else g.data_visita + g.giorni
      end as eff_ritorno
    from g
  )
  select e.tecnico_id, t.email,
    trim(coalesce(t.tecnico_cognome,'')||' '||coalesce(t.tecnico_nome,'')),
    e.cantiere_id,
    (case
      when nullif(trim(ca.cantiere_indirizzo),'') is not null
        then trim(concat_ws(' ', ca.cantiere_indirizzo, ca.cantiere_civico))
             || case when nullif(trim(ca.comune_nome),'') is not null then ', '||ca.comune_nome else '' end
      else coalesce(
             nullif(trim(ca.cantiere_etichetta),'')
               || case when nullif(trim(ca.comune_nome),'') is not null then ', '||ca.comune_nome else '' end,
             ca.cantiere_etichetta,
             ca.comune_nome
           )
    end) || case when nullif(trim(ca.lotto),'') is not null then ' – lotto '||trim(ca.lotto) else '' end,
    e.nr_verbale,
    e.data_visita, e.acc, e.ipc,
    e.eff_ritorno, e.tipo,
    (e.eff_ritorno - current_date),
    case
      when e.eff_ritorno <= current_date then 'urgente'
      when e.eff_ritorno <= current_date + p_giorni_imminenti then 'imminente'
      else 'futuro'
    end
  from eff e
  left join public.tecnici t on t.tecnico_id = e.tecnico_id
  left join public.cantieri ca on ca.cantiere_id = e.cantiere_id
  where e.eff_ritorno is not null
$$;

-- ── 10. permessi ──
revoke execute on function public.ciclo_regola(integer, text, boolean) from public, anon;
revoke execute on function public.visita_rientro_giorni(integer, text, integer, integer) from public, anon;
revoke execute on function public.ciclo_confronta(text[], text[], text[], text[], text) from public, anon;
revoke execute on function public.ciclo_visita_in_serie(integer, bigint) from public, anon;
revoke execute on function public.ciclo_ricalcola_lotto(text) from public, anon, authenticated;
revoke execute on function public.tg_visite_cicli() from public, anon;
revoke execute on function public.tg_visite_cicli_campi() from public, anon;
revoke execute on function public.ciclo_proposta(text, date, text, text[], text[], text, integer, text) from public, anon;
revoke execute on function public.ciclo_percorso(bigint, text, text) from public, anon;
revoke execute on function public.ciclo_percorso_esito(bigint, text, text) from public, anon;
revoke execute on function public.ciclo_correggi(text, text, text) from public, anon;
revoke execute on function public.cicli_coord(date, date) from public, anon;
revoke execute on function public.dash_cicli_calcolo(date, date) from public, anon, authenticated;
revoke execute on function public.dash_cicli(date, date) from public, anon;
grant execute on function public.ciclo_regola(integer, text, boolean) to authenticated;
grant execute on function public.visita_rientro_giorni(integer, text, integer, integer) to authenticated;
grant execute on function public.ciclo_confronta(text[], text[], text[], text[], text) to authenticated;
grant execute on function public.ciclo_visita_in_serie(integer, bigint) to authenticated;
grant execute on function public.ciclo_proposta(text, date, text, text[], text[], text, integer, text) to authenticated;
grant execute on function public.ciclo_percorso(bigint, text, text) to authenticated;
grant execute on function public.ciclo_percorso_esito(bigint, text, text) to authenticated;
grant execute on function public.ciclo_correggi(text, text, text) to authenticated;
grant execute on function public.cicli_coord(date, date) to authenticated;
grant execute on function public.dash_cicli(date, date) to authenticated;

-- ── 11. i cicli delle visite già chiuse dal 01/10/2026 (proposta del programma, nessuna conferma del tecnico) ──
select public.ciclo_ricalcola_lotto(x.cantiere_id)
  from (select distinct v.cantiere_id from public.visite v where coalesce(v.elimina, 0) = 0 and v.data_visita >= date '2026-10-01' and v.cantiere_id is not null) x;
