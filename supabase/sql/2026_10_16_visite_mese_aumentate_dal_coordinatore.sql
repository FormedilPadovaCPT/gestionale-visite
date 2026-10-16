-- ============================================================
-- IL COORDINATORE AUMENTA LE VISITE DEL MESE DI UN TECNICO
-- (16/10/2026, chiesto dall'utente: «il coordinatore dovrebbe poter
-- aumentare le visite mensili di un tecnico»; scelta dello stesso giorno:
-- si aggiornano la lettera nel database e la scheda del tecnico, avviso
-- alla segreteria e al tecnico, nessuna integrazione protocollata.)
--
-- Il numero è uno solo: s_incarichi_mensili.cantieri_assegnati, la lettera
-- di incarico del mese che scrive la segreteria. Il trigger
-- trg_s_inc_mensile_sync_target lo ricopia in target_visite_mensili, la
-- scheda «Obiettivo mensile» del tecnico. Il coordinatore NON scrive la
-- scheda: scriverebbe un numero diverso dalla lettera, e al primo
-- salvataggio della segreteria il trigger lo riporterebbe indietro.
--
-- Regole:
-- 1. solo il Coordinatore (is_coordinatore), solo in AUMENTO, solo sulla
--    lettera ancora «aperto» (chiuso, fatturato, pagato = mese finito);
-- 2. il motivo è obbligatorio e resta scritto: tabella
--    s_incarichi_mensili_aumenti (chi, quando, da, a, motivo) e una riga
--    nelle annotazioni interne della lettera, che la segreteria vede nella
--    maschera e che NON vanno in lettera;
-- 3. notifica push al tecnico e alla segreteria, testo fisso dal database;
-- 4. la lettera già protocollata non si rifà: se la segreteria la
--    rigenera, esce col numero nuovo.
-- ============================================================

create table if not exists public.s_incarichi_mensili_aumenti (
  id           bigint generated always as identity primary key,
  incarico_id  bigint not null references public.s_incarichi_mensili(id) on delete cascade,
  tecnico_id   text not null,
  anno         integer not null,
  mese         integer not null,
  da           integer not null,
  a            integer not null,
  motivo       text not null,
  fatto_da     text not null,
  fatto_il     timestamptz not null default now(),
  constraint s_inc_aumenti_solo_aumento check (a > da),
  constraint s_inc_aumenti_motivo check (length(trim(motivo)) >= 5)
);
create index if not exists s_inc_aumenti_incarico_idx on public.s_incarichi_mensili_aumenti (incarico_id);
create index if not exists s_inc_aumenti_mese_idx on public.s_incarichi_mensili_aumenti (anno, mese);

comment on table public.s_incarichi_mensili_aumenti is
  'Aumenti delle visite del mese decisi dal Coordinatore (16/10/2026). Si scrive solo da s_inc_mensile_aumenta; non si modifica né si cancella.';

alter table public.s_incarichi_mensili_aumenti enable row level security;
revoke all on public.s_incarichi_mensili_aumenti from anon, public;
grant select on public.s_incarichi_mensili_aumenti to authenticated;

-- la vedono segreteria, coordinatore, Direttore e il tecnico interessato
-- (le stesse persone che vedono la lettera); nessuna scrittura diretta
drop policy if exists s_inc_aumenti_sel on public.s_incarichi_mensili_aumenti;
create policy s_inc_aumenti_sel on public.s_incarichi_mensili_aumenti for select to authenticated
  using ((select public.is_segreteria()) or (select public.is_coordinatore()) or (select public.is_direttore())
      or tecnico_id = (select public.s_mio_tecnico_id()));

create or replace function public.s_inc_mensile_aumenta(p_incarico_id bigint, p_nuovo integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  i      record;
  v_io   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_mot  text := nullif(trim(coalesce(p_motivo, '')), '');
  v_da   integer;
  v_mail text;
  v_mese text;
  v_oggi text := to_char(now() at time zone 'Europe/Rome', 'DD/MM/YYYY');
begin
  if not public.is_coordinatore() then
    raise exception 'Le visite del mese le aumenta solo il Coordinatore.' using errcode = '42501';
  end if;
  if v_mot is null or length(v_mot) < 5 then
    raise exception 'Scrivi il motivo dell''aumento: resta scritto e lo legge la segreteria.' using errcode = '22023';
  end if;
  select * into i from public.s_incarichi_mensili where id = p_incarico_id for update;
  if not found then
    raise exception 'Lettera di incarico non trovata.' using errcode = 'P0002';
  end if;
  if i.stato <> 'aperto' then
    raise exception 'La lettera di questo mese è già «%»: il mese è chiuso e le visite non si aumentano più.', i.stato using errcode = '22023';
  end if;
  v_da := coalesce(i.cantieri_assegnati, 0);
  if p_nuovo is null or p_nuovo <= v_da then
    raise exception 'Il numero nuovo deve essere più alto di quello attuale (%).', v_da using errcode = '22023';
  end if;
  if p_nuovo > 200 then
    raise exception 'Il numero nuovo (%) non è credibile: controlla di averlo scritto giusto.', p_nuovo using errcode = '22023';
  end if;

  update public.s_incarichi_mensili
     set cantieri_assegnati = p_nuovo,
         aggiornato_da = v_io,
         updated_at = now(),
         note_interne = concat_ws(E'\n', nullif(note_interne, ''),
           v_oggi || ' — il Coordinatore ha aumentato le visite del mese da ' || v_da || ' a ' || p_nuovo || ': ' || v_mot)
   where id = p_incarico_id;

  insert into public.s_incarichi_mensili_aumenti (incarico_id, tecnico_id, anno, mese, da, a, motivo, fatto_da)
  values (i.id, i.tecnico_id, i.anno, i.mese, v_da, p_nuovo, v_mot, v_io);

  v_mese := (array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'])[i.mese];

  -- al tecnico: testo fisso, senza nomi (si legge a schermo bloccato)
  select lower(t.email) into v_mail from public.tecnici t where t.tecnico_id = i.tecnico_id;
  v_mail := coalesce(nullif(v_mail, ''), lower(nullif(i.tecnico_email, '')));
  if coalesce(v_mail, '') <> '' and v_mail <> v_io then
    perform public.push_accoda(v_mail, 'visite_aumentate:' || i.id || ':' || p_nuovo,
      'Visite del mese aumentate',
      'Il Coordinatore ha portato le tue visite di ' || v_mese || ' da ' || v_da || ' a ' || p_nuovo || '.',
      './', 'visite-aumentate-' || i.id);
  end if;

  -- alla segreteria (destinatari da app_ruoli, mai chi agisce)
  perform public.push_alla_segreteria('visite_aumentate',
    'Visite del mese aumentate',
    'Il Coordinatore ha aumentato le visite di ' || v_mese || ' di una lettera di incarico, da ' || v_da || ' a ' || p_nuovo || '. Il motivo è nelle annotazioni interne.',
    'visite-aumentate-' || i.id || '-' || p_nuovo);

  return jsonb_build_object('ok', true, 'incarico_id', i.id, 'da', v_da, 'a', p_nuovo);
end $function$;

revoke execute on function public.s_inc_mensile_aumenta(bigint, integer, text) from public, anon;
grant execute on function public.s_inc_mensile_aumenta(bigint, integer, text) to authenticated;
