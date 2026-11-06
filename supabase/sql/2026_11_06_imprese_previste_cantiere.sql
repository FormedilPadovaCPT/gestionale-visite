-- (06/11/2026, chiesto dall'utente sulla richiesta di visita Galiazzo)
-- IMPRESE PREVISTE ANCHE SUI CANTIERI SENZA CNCE.
-- Fino a oggi cantiere_imprese_previste era solo la lista della Cassa Edile, legata al codice CNCE:
-- il tecnico, scelto il cantiere, si trovava nel passo Imprese le imprese previste da aggiungere.
-- Un cantiere che la Cassa non conosce (aperto dalla segreteria da una richiesta) non ne aveva.
-- Ora una riga può essere legata al CANTIERE (cantiere_id) invece che al CNCE, e dice chi l'ha
-- messa (fonte): 'cassa' = lista della Cassa Edile, 'segreteria' = indicata dall'ufficio.
-- impresa_cf contiene l'impresa_id dell'anagrafica, come nelle righe della Cassa.
-- Niente indice unico su (cantiere_id, impresa_cf): fondi_cantieri e fondi_imprese spostano le righe
-- in blocco e un indice unico le farebbe fallire; il doppione lo evita l'app prima di inserire.

alter table public.cantiere_imprese_previste
  add column if not exists cantiere_id text references public.cantieri(cantiere_id),
  add column if not exists fonte text not null default 'cassa',
  add column if not exists inserita_da text default (auth.jwt() ->> 'email');

alter table public.cantiere_imprese_previste alter column cnce drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cip_cnce_o_cantiere') then
    alter table public.cantiere_imprese_previste
      add constraint cip_cnce_o_cantiere check (nullif(btrim(cnce), '') is not null or cantiere_id is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cip_fonte_valida') then
    alter table public.cantiere_imprese_previste
      add constraint cip_fonte_valida check (fonte in ('cassa', 'segreteria'));
  end if;
end $$;

create index if not exists idx_cip_cantiere on public.cantiere_imprese_previste (cantiere_id) where cantiere_id is not null;

-- Il primo import della Cassa (import_ceiv/02_imprese_previste.sql) faceva TRUNCATE della tabella:
-- rifatto oggi cancellerebbe le imprese indicate dalla segreteria. Si ferma prima.
create or replace function public.tg_cip_no_truncate() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if exists (select 1 from public.cantiere_imprese_previste where fonte <> 'cassa') then
    raise exception 'In cantiere_imprese_previste ci sono imprese indicate dalla segreteria: non si svuota la tabella. Per rifare la lista della Cassa: delete ... where fonte = ''cassa''';
  end if;
  return null;
end $$;
drop trigger if exists trg_cip_no_truncate on public.cantiere_imprese_previste;
create trigger trg_cip_no_truncate before truncate on public.cantiere_imprese_previste
  for each statement execute function public.tg_cip_no_truncate();

-- La scheda dell'impresa (app segreteria) elenca i cantieri in cui è prevista: anche quelli legati per cantiere.
do $$
declare d text; vecchio text := 'left join cantieri c on c.cantiere_cnce = cip.cnce';
begin
  select pg_get_functiondef('public.s_scheda_impresa'::regproc) into d;
  if position(vecchio in d) = 0 then
    if position('c.cantiere_id = cip.cantiere_id' in d) = 0 then raise exception 's_scheda_impresa: non trovo la join da correggere'; end if;
  else
    execute replace(d, vecchio, 'left join cantieri c on (c.cantiere_cnce = cip.cnce or c.cantiere_id = cip.cantiere_id)');
  end if;
end $$;
