-- ============================================================
-- DOCUMENTI CON PRESA VISIONE nel gestionale visite
-- (chiesto dall'utente il 21/10/2026: «metterei l'informativa direttamente
-- in gestionale come documento a ogni tecnico, che se la può vedere e
-- scaricare e ne prende visione»; prima applicazione: le informative
-- sulla chat del team e sui sistemi automatizzati).
--
--   · la segreteria pubblica un PDF per uno o più gruppi (tecnici,
--     Coordinatore, segreteria, chi è nella chat del team); il file va su
--     Drive in «Documenti al personale» e NON si condivide con nessuno:
--     si apre solo passando dalla funzione documenti-personale;
--   · chi lo riceve lo apre o lo scarica dall'app e poi preme «Ho letto e
--     preso visione». La presa visione si può dare solo DOPO aver aperto il
--     file (l'apertura la registra la funzione, non il telefono);
--   · resta scritto chi, quando e QUALE VERSIONE: ogni versione ha la sua
--     impronta (SHA-256) e righe che non si cambiano. Una versione nuova
--     dello stesso documento ritira la precedente e la presa visione si
--     chiede di nuovo;
--   · la segreteria e il Coordinatore vedono chi ha preso visione e chi no.
--
-- DOVE STANNO I PERMESSI: qui. Le tabelle non si leggono e non si scrivono
-- dalle app: solo con le funzioni sotto. Nessuna riga si cancella (regola
-- d'oro 4) e dei file non si cambia niente dopo la pubblicazione.
-- ============================================================

-- ── i documenti: una riga per versione ──
create table if not exists public.doc_personale (
  id              bigint generated always as identity primary key,
  codice          text not null check (codice ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(codice) between 3 and 60),
  versione        integer not null check (versione >= 1),
  titolo          text not null check (char_length(btrim(titolo)) between 3 and 200),
  descrizione     text check (char_length(descrizione) <= 1000),
  destinatari     text[] not null check (cardinality(destinatari) > 0 and destinatari <@ array['tecnici', 'coordinatore', 'segreteria', 'chat']),
  drive_file_id   text not null,
  nome_file       text not null,
  sha256          text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  md5_drive       text,
  dimensione_byte bigint not null check (dimensione_byte > 0),
  pubblicato_il   timestamptz not null default now(),
  pubblicato_da   text not null,
  ritirato_il     timestamptz,
  ritirato_da     text,
  check ((ritirato_il is null) = (ritirato_da is null)),
  unique (codice, versione)
);
comment on table public.doc_personale is
  'Documenti al personale con presa visione (21/10/2026): una riga per versione. Si scrive solo con doc_registra (funzione documenti-personale) e doc_ritira; dei file e della loro impronta non si cambia niente.';
create unique index if not exists ux_doc_personale_in_vigore on public.doc_personale (codice) where ritirato_il is null;

-- ── chi l'ha aperto e chi ha preso visione: una riga per persona e versione ──
create table if not exists public.doc_prese_visione (
  id            bigint generated always as identity primary key,
  documento_id  bigint not null references public.doc_personale(id),
  email         text not null check (email = lower(btrim(email)) and email <> ''),
  aperto_il     timestamptz not null default now(),
  aperture      integer not null default 1,
  presa_il      timestamptz,
  unique (documento_id, email)
);
comment on table public.doc_prese_visione is
  'Documenti al personale (21/10/2026): la prima apertura la registra la funzione documenti-personale (doc_aperto), la presa visione la dà la persona (doc_prendi_visione) e non si toglie.';

-- ── righe che non si cancellano e campi che non cambiano ──
create or replace function public.doc_niente_delete() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  raise exception 'Dei documenti al personale non si cancella niente: una versione si ritira, una presa visione resta';
end $$;
drop trigger if exists trg_doc_personale_no_delete on public.doc_personale;
create trigger trg_doc_personale_no_delete before delete on public.doc_personale for each row execute function public.doc_niente_delete();
drop trigger if exists trg_doc_prese_no_delete on public.doc_prese_visione;
create trigger trg_doc_prese_no_delete before delete on public.doc_prese_visione for each row execute function public.doc_niente_delete();

create or replace function public.doc_personale_fermo() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if (new.codice, new.versione, new.titolo, new.descrizione, new.destinatari, new.drive_file_id, new.nome_file, new.sha256, new.md5_drive, new.dimensione_byte, new.pubblicato_il, new.pubblicato_da)
     is distinct from
     (old.codice, old.versione, old.titolo, old.descrizione, old.destinatari, old.drive_file_id, old.nome_file, old.sha256, old.md5_drive, old.dimensione_byte, old.pubblicato_il, old.pubblicato_da) then
    raise exception 'Una versione pubblicata non si modifica: se il documento cambia, se ne pubblica una nuova';
  end if;
  if old.ritirato_il is not null and new.ritirato_il is distinct from old.ritirato_il then
    raise exception 'La versione è già ritirata';
  end if;
  return new;
end $$;
drop trigger if exists trg_doc_personale_fermo on public.doc_personale;
create trigger trg_doc_personale_fermo before update on public.doc_personale for each row execute function public.doc_personale_fermo();

create or replace function public.doc_prese_ferme() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.documento_id <> old.documento_id or new.email <> old.email or new.aperto_il <> old.aperto_il then
    raise exception 'Chi ha aperto il documento e quando non si cambia';
  end if;
  if old.presa_il is not null and new.presa_il is distinct from old.presa_il then
    raise exception 'La presa visione è già data e non si toglie';
  end if;
  return new;
end $$;
drop trigger if exists trg_doc_prese_ferme on public.doc_prese_visione;
create trigger trg_doc_prese_ferme before update on public.doc_prese_visione for each row execute function public.doc_prese_ferme();

-- ── a quali gruppi appartiene un indirizzo ──
-- Direttore, Presidenza e consiglieri (ruolo «viewer» attivo) non ricevono documenti da qui.
create or replace function public.doc_gruppi_di(p_email text) returns text[]
language sql stable security definer set search_path to 'public' as $$
  with e as (select lower(btrim(coalesce(p_email, ''))) as m)
  select case
    when (select m from e) = '' then '{}'::text[]
    when exists (select 1 from app_ruoli r, e where lower(r.email) = e.m and r.ruolo = 'viewer' and r.stato = 'attivo') then '{}'::text[]
    else array_remove(array[
      case when (select m from e) = any (public.push_destinatari_segreteria()) then 'segreteria' end,
      case when exists (select 1 from s_config c, e where c.chiave = 'coordinatore_email' and lower(c.valore) = e.m) then 'coordinatore' end,
      case when exists (select 1 from tecnici t, e where lower(t.email) = e.m and coalesce(t.attivo, false) and coalesce(t.elimina, 0) = 0) then 'tecnici' end,
      case when public.chat_ruolo_di((select m from e)) is not null then 'chat' end
    ], null)
  end
$$;

-- è fra i destinatari di questa versione, ed è in vigore?
create or replace function public.doc_destinatario_di(p_doc bigint, p_email text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from doc_personale d where d.id = p_doc and d.ritirato_il is null
                   and d.destinatari && public.doc_gruppi_di(p_email))
$$;

-- tutti i destinatari di una versione, adesso
create or replace function public.doc_destinatari_email(p_doc bigint) returns setof text
language sql stable security definer set search_path to 'public' as $$
  select distinct m from (
    select unnest(public.push_destinatari_segreteria()) m
    union select lower(valore) from s_config where chiave = 'coordinatore_email'
    union select lower(btrim(email)) from tecnici where coalesce(attivo, false) and coalesce(elimina, 0) = 0 and coalesce(btrim(email), '') <> ''
    union select public.chat_partecipanti_email()
  ) x where coalesce(m, '') <> '' and public.doc_destinatario_di(p_doc, m)
$$;

-- può aprire il file? destinatari della versione in vigore; segreteria e Coordinatore sempre;
-- di una versione ritirata, anche chi l'aveva aperta (deve poter rivedere che cosa ha letto)
create or replace function public.doc_puo_aprire(p_doc bigint, p_email text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  with e as (select lower(btrim(coalesce(p_email, ''))) as m)
  select (select m from e) <> '' and exists (select 1 from doc_personale where id = p_doc) and (
    public.doc_destinatario_di(p_doc, (select m from e))
    or (select m from e) = any (public.push_destinatari_segreteria())
    or exists (select 1 from s_config c, e where c.chiave = 'coordinatore_email' and lower(c.valore) = e.m)
    or exists (select 1 from doc_prese_visione p, e where p.documento_id = p_doc and p.email = e.m)
  )
$$;

-- ── per la funzione documenti-personale (chiave di servizio) ──
create or replace function public.doc_prossima_versione(p_codice text) returns integer
language sql stable security definer set search_path to 'public' as $$
  select coalesce(max(versione), 0) + 1 from doc_personale where codice = p_codice
$$;

create or replace function public.doc_registra(p_email text, p_codice text, p_versione integer, p_titolo text, p_descrizione text,
                                               p_destinatari text[], p_drive_file_id text, p_nome_file text, p_sha256 text,
                                               p_md5 text, p_dimensione bigint)
returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare
  io text := lower(btrim(coalesce(p_email, '')));
  nuovo bigint;
  e text;
  v_titolo text := btrim(coalesce(p_titolo, ''));
begin
  if not (io = any (public.push_destinatari_segreteria())) then
    raise exception 'I documenti al personale li pubblica la segreteria';
  end if;
  if p_versione is distinct from public.doc_prossima_versione(p_codice) then
    raise exception 'Nel frattempo è stata pubblicata un''altra versione di questo documento: ricarica la pagina';
  end if;
  update doc_personale set ritirato_il = now(), ritirato_da = io where codice = p_codice and ritirato_il is null;
  insert into doc_personale (codice, versione, titolo, descrizione, destinatari, drive_file_id, nome_file, sha256, md5_drive, dimensione_byte, pubblicato_da)
    values (p_codice, p_versione, v_titolo, nullif(btrim(coalesce(p_descrizione, '')), ''), p_destinatari, p_drive_file_id, p_nome_file,
            lower(p_sha256), nullif(p_md5, ''), p_dimensione, io)
    returning id into nuovo;
  -- una notifica a ciascun destinatario (non a chi pubblica): l'evento porta l'id, così il controllo
  -- dei doppioni di push_accoda non ne scarta una di un altro documento
  for e in select public.doc_destinatari_email(nuovo) loop
    if e = io then continue; end if;
    perform public.push_accoda(e, 'doc_da_leggere:' || nuovo, 'Documento da leggere',
      'C''è un documento da leggere nel gestionale: «' || left(v_titolo, 120) || '».', './?vista=documenti', 'doc-' || nuovo);
  end loop;
  return nuovo;
end $$;

-- la funzione registra l'apertura del file (solo per i destinatari della versione in vigore)
create or replace function public.doc_aperto(p_doc bigint, p_email text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare m text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.doc_destinatario_di(p_doc, m) then return; end if;
  insert into doc_prese_visione (documento_id, email) values (p_doc, m)
    on conflict (documento_id, email) do update set aperture = doc_prese_visione.aperture + 1;
end $$;

-- ── dalle app: i miei documenti ──
create or replace function public.doc_miei() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  io text := lower(coalesce(auth.jwt() ->> 'email', ''));
  gruppi text[] := public.doc_gruppi_di(io);
  segr boolean := io = any (public.push_destinatari_segreteria());
  coord boolean := exists (select 1 from s_config where chiave = 'coordinatore_email' and lower(valore) = io);
begin
  return jsonb_build_object(
    'puo', cardinality(gruppi) > 0 or segr or coord,
    'io', io,
    'gruppi', to_jsonb(gruppi),
    'pubblica', segr,
    'quadro', segr or coord,
    'documenti', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'codice', d.codice, 'versione', d.versione, 'titolo', d.titolo, 'descrizione', d.descrizione,
        'pubblicato_il', d.pubblicato_il, 'nome_file', d.nome_file, 'dimensione_byte', d.dimensione_byte, 'sha256', d.sha256,
        'aperto_il', p.aperto_il, 'presa_il', p.presa_il) order by (p.presa_il is not null), d.pubblicato_il desc)
      from doc_personale d left join doc_prese_visione p on p.documento_id = d.id and p.email = io
      where d.ritirato_il is null and d.destinatari && gruppi), '[]'::jsonb),
    'precedenti', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'titolo', d.titolo, 'versione', d.versione, 'ritirato_il', d.ritirato_il, 'aperto_il', p.aperto_il, 'presa_il', p.presa_il)
        order by d.ritirato_il desc)
      from doc_prese_visione p join doc_personale d on d.id = p.documento_id
      where p.email = io and d.ritirato_il is not null), '[]'::jsonb)
  );
end $$;

-- «Ho letto e preso visione»: solo chi è destinatario, solo dopo aver aperto il file, una volta
create or replace function public.doc_prendi_visione(p_doc bigint) returns timestamptz
language plpgsql security definer set search_path to 'public' as $$
declare
  io text := lower(coalesce(auth.jwt() ->> 'email', ''));
  p record;
begin
  if not public.doc_destinatario_di(p_doc, io) then
    raise exception 'Questo documento non è fra i tuoi, o è stato sostituito da una versione nuova';
  end if;
  select * into p from doc_prese_visione where documento_id = p_doc and email = io;
  if not found then
    raise exception 'Apri prima il documento: la presa visione si dà dopo averlo letto';
  end if;
  if p.presa_il is not null then return p.presa_il; end if;
  update doc_prese_visione set presa_il = now() where id = p.id returning presa_il into p.presa_il;
  return p.presa_il;
end $$;

-- ── il quadro: chi ha preso visione e chi no (segreteria e Coordinatore) ──
create or replace function public.doc_quadro() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare io text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not (io = any (public.push_destinatari_segreteria())
          or exists (select 1 from s_config where chiave = 'coordinatore_email' and lower(valore) = io)) then
    raise exception 'Il quadro delle prese visione lo vedono la segreteria e il Coordinatore';
  end if;
  return coalesce((select jsonb_agg(x order by (x->>'in_vigore')::boolean desc, x->>'pubblicato_il' desc) from (
    select jsonb_build_object(
      'id', d.id, 'codice', d.codice, 'versione', d.versione, 'titolo', d.titolo, 'destinatari', to_jsonb(d.destinatari),
      'pubblicato_il', d.pubblicato_il, 'pubblicato_da', public.chat_nome_di(d.pubblicato_da),
      'ritirato_il', d.ritirato_il, 'in_vigore', d.ritirato_il is null, 'sha256', d.sha256, 'nome_file', d.nome_file,
      'persone', coalesce((select jsonb_agg(jsonb_build_object(
          'email', q.m, 'nome', public.chat_nome_di(q.m), 'aperto_il', p.aperto_il, 'presa_il', p.presa_il,
          'destinatario', d.ritirato_il is null and public.doc_destinatario_di(d.id, q.m)) order by public.chat_nome_di(q.m))
        from (select public.doc_destinatari_email(d.id) m union select email from doc_prese_visione where documento_id = d.id) q
        left join doc_prese_visione p on p.documento_id = d.id and p.email = q.m), '[]'::jsonb)
    ) x
    from doc_personale d
    order by d.pubblicato_il desc
    limit 60
  ) y), '[]'::jsonb);
end $$;

-- ── ritirare una versione senza sostituirla (segreteria) ──
create or replace function public.doc_ritira(p_doc bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
declare io text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not (io = any (public.push_destinatari_segreteria())) then
    raise exception 'I documenti al personale li ritira la segreteria';
  end if;
  update doc_personale set ritirato_il = now(), ritirato_da = io where id = p_doc and ritirato_il is null;
  if not found then raise exception 'Il documento non c''è o è già ritirato'; end if;
end $$;

-- ── RLS: nessun accesso diretto dalle app ──
alter table public.doc_personale enable row level security;
alter table public.doc_prese_visione enable row level security;
revoke all on public.doc_personale, public.doc_prese_visione from anon, authenticated;

-- ── permessi sulle funzioni ──
revoke all on function public.doc_niente_delete() from public, anon, authenticated;
revoke all on function public.doc_personale_fermo() from public, anon, authenticated;
revoke all on function public.doc_prese_ferme() from public, anon, authenticated;
revoke all on function public.doc_gruppi_di(text) from public, anon, authenticated;
revoke all on function public.doc_destinatario_di(bigint, text) from public, anon, authenticated;
revoke all on function public.doc_destinatari_email(bigint) from public, anon, authenticated;
revoke all on function public.doc_puo_aprire(bigint, text) from public, anon, authenticated;
revoke all on function public.doc_prossima_versione(text) from public, anon, authenticated;
revoke all on function public.doc_registra(text, text, integer, text, text, text[], text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.doc_aperto(bigint, text) from public, anon, authenticated;
revoke all on function public.doc_miei() from public, anon;
revoke all on function public.doc_prendi_visione(bigint) from public, anon;
revoke all on function public.doc_quadro() from public, anon;
revoke all on function public.doc_ritira(bigint) from public, anon;
grant execute on function public.doc_miei() to authenticated;
grant execute on function public.doc_prendi_visione(bigint) to authenticated;
grant execute on function public.doc_quadro() to authenticated;
grant execute on function public.doc_ritira(bigint) to authenticated;
grant execute on function public.doc_puo_aprire(bigint, text), public.doc_prossima_versione(text),
  public.doc_registra(text, text, integer, text, text, text[], text, text, text, text, bigint), public.doc_aperto(bigint, text) to service_role;
