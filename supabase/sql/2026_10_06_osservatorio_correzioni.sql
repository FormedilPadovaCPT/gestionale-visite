-- ============================================================
-- Osservatorio: correzione delle schede dei cantieri direttamente in tabella — 06/10/2026
-- (chiesto dall'utente: «un elenco modificabile istantaneamente con un menu a tendina sui campi
--  che non sono conformi all'osservatorio», e «attento che non si perdano dati»)
--
-- Le schede dei cantieri le scrivono più app (gestionale, segreteria, importazioni). Qui si
-- corregge UN CAMPO ALLA VOLTA, e mai alla cieca:
--   1. COPIA DI SICUREZZA prima di cominciare: archivio.bk_2026_10_06_cantieri_oss e
--      archivio.bk_2026_10_06_committenti_oss (i soli campi che questa funzione può toccare);
--   2. una sola strada per scrivere, oss_correggi_cantiere(cantiere, campo, prima, dopo):
--      - solo la segreteria;
--      - solo i campi dell'Osservatorio (intervento, opera e sua descrizione, importo, durata,
--        civico, tipo del committente) e solo con i valori ammessi;
--      - prende il lucchetto sulla riga e confronta il valore di adesso con quello che la
--        tabella aveva letto («prima»): se nel frattempo è cambiato NON scrive e lo dice;
--      - scrive quel campo e nient'altro;
--   3. ogni correzione va nel registro cantieri_correzioni (prima, dopo, chi, quando): si può
--      sempre rimettere il valore di prima, una riga per volta.
-- Per tornare indietro su tutto: i valori «prima» del registro, o le copie in archivio.
-- ============================================================

-- 1. copie di sicurezza (una volta sola)
create table if not exists archivio.bk_2026_10_06_cantieri_oss as
  select cantiere_id, cantiere_tip_int, cantiere_tip_ope, cantiere_tip_ope_altro, cantiere_importo,
         cantiere_durata, cantiere_civico, cantiere_committente_id, updated_at, now() as copiato_il
    from public.cantieri;
create table if not exists archivio.bk_2026_10_06_committenti_oss as
  select committente_id, committente_tipo, updated_at, now() as copiato_il
    from public.committenti;
revoke all on archivio.bk_2026_10_06_cantieri_oss, archivio.bk_2026_10_06_committenti_oss from public, anon, authenticated;

-- 2. il registro delle correzioni
create table if not exists public.cantieri_correzioni (
  id             bigint generated always as identity primary key,
  cantiere_id    text not null,
  committente_id text,                    -- solo per il tipo del committente
  campo          text not null,
  prima          text,
  dopo           text,
  origine        text not null default 'osservatorio, correzione in tabella',
  fatto_da       text default (auth.jwt() ->> 'email'),
  fatto_il       timestamptz not null default now()
);
comment on table public.cantieri_correzioni is
  'Correzioni delle schede dei cantieri fatte dalla tabella del controllo Osservatorio (dal 06/10/2026): un campo per riga, con il valore di prima. Si scrive solo da oss_correggi_cantiere.';
create index if not exists ix_cantieri_correzioni_cantiere on public.cantieri_correzioni (cantiere_id);
alter table public.cantieri_correzioni enable row level security;
drop policy if exists cantieri_correzioni_sel on public.cantieri_correzioni;
create policy cantieri_correzioni_sel on public.cantieri_correzioni for select to authenticated using ((select public.is_segreteria()));
revoke all on public.cantieri_correzioni from anon;
revoke insert, update, delete on public.cantieri_correzioni from authenticated;
grant select on public.cantieri_correzioni to authenticated;

-- 3. l'unica strada per scrivere
create or replace function public.oss_correggi_cantiere(p_cantiere text, p_campo text, p_prima text, p_dopo text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_dopo  text := nullif(btrim(coalesce(p_dopo, '')), '');
  v_prima text := nullif(btrim(coalesce(p_prima, '')), '');
  v_att   text;
  v_comm  text;
begin
  if not (public.is_segreteria() or session_user = 'postgres') then
    raise exception 'Solo la segreteria corregge le schede da qui';
  end if;
  if p_campo not in ('cantiere_tip_int','cantiere_tip_ope','cantiere_tip_ope_altro','cantiere_importo',
                     'cantiere_durata','cantiere_civico','committente_tipo') then
    raise exception 'Campo non ammesso: %', p_campo;
  end if;
  -- solo i valori che l'Osservatorio accetta
  if v_dopo is null then raise exception 'Valore vuoto: da qui si scrive, non si cancella'; end if;
  if (p_campo = 'cantiere_tip_int'  and v_dopo !~ '^[1-4]$')
  or (p_campo = 'cantiere_tip_ope'  and v_dopo !~ '^([1-9]|1[0-6])$')
  or (p_campo = 'cantiere_importo'  and v_dopo !~ '^([1-9]|1[01])$')
  or (p_campo = 'cantiere_durata'   and v_dopo !~ '^[1-7]$')
  or (p_campo = 'committente_tipo'  and v_dopo !~ '^[1-3]$')
  or (p_campo = 'cantiere_civico'   and length(v_dopo) > 20)
  or (p_campo = 'cantiere_tip_ope_altro' and length(v_dopo) > 128) then
    raise exception 'Valore non ammesso per %: %', p_campo, v_dopo;
  end if;

  if not exists (select 1 from public.cantieri where cantiere_id = p_cantiere) then
    raise exception 'Cantiere inesistente';
  end if;

  if p_campo = 'committente_tipo' then
    select nullif(btrim(cantiere_committente_id), '') into v_comm from public.cantieri where cantiere_id = p_cantiere;
    if v_comm is null then raise exception 'Il cantiere non ha un committente collegato: si sceglie dalla scheda'; end if;
    select committente_tipo::text into v_att from public.committenti where committente_id = v_comm for update;
    if not found then raise exception 'Il committente collegato non è in anagrafica: si sistema dalla scheda'; end if;
    if v_att is distinct from v_prima then
      raise exception 'Nel frattempo il dato è cambiato (ora: %). Ricarica l''elenco: non ho scritto niente', coalesce(v_att, 'vuoto');
    end if;
    if v_att is not distinct from v_dopo then return jsonb_build_object('ok', true, 'invariato', true); end if;
    update public.committenti set committente_tipo = v_dopo::smallint where committente_id = v_comm;
  else
    execute format('select nullif(btrim(%I::text), %L) from public.cantieri where cantiere_id = $1 for update', p_campo, '')
      into v_att using p_cantiere;
    if v_att is distinct from v_prima then
      raise exception 'Nel frattempo il dato è cambiato (ora: %). Ricarica l''elenco: non ho scritto niente', coalesce(v_att, 'vuoto');
    end if;
    if v_att is not distinct from v_dopo then return jsonb_build_object('ok', true, 'invariato', true); end if;
    execute format('update public.cantieri set %I = $1::%s where cantiere_id = $2', p_campo,
                   case when p_campo in ('cantiere_civico', 'cantiere_tip_ope_altro') then 'text' else 'smallint' end)
      using v_dopo, p_cantiere;
  end if;

  insert into public.cantieri_correzioni (cantiere_id, committente_id, campo, prima, dopo)
  values (p_cantiere, v_comm, p_campo, v_att, v_dopo);
  return jsonb_build_object('ok', true, 'campo', p_campo, 'prima', v_att, 'dopo', v_dopo);
end $$;

revoke execute on function public.oss_correggi_cantiere(text, text, text, text) from public, anon;
grant execute on function public.oss_correggi_cantiere(text, text, text, text) to authenticated, service_role;
