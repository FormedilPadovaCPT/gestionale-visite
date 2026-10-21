-- ============================================================
-- CHAT DEL TEAM nel gestionale visite, al posto del gruppo WhatsApp
-- (scelte dell'utente del 20/10/2026, costruita il 21/10/2026).
--
--   · gruppo unico, un solo livello: chi c'è partecipa (legge e scrive);
--   · il Coordinatore e la segreteria ci sono sempre; i tecnici li ammette
--     e li toglie il Coordinatore; il Direttore no, né Presidenza e
--     consiglieri (chiunque abbia un ruolo «viewer» attivo resta fuori,
--     anche se per errore fosse stato ammesso);
--   · chi viene tolto non vede più niente, né storia né file; i suoi
--     messaggi restano, col suo nome;
--   · messaggi e file si tengono per anni, senza scadenza;
--   · chi scrive può cancellare il proprio messaggio: per tutti resta
--     «messaggio cancellato»; testo e file restano nel database e su Drive
--     (regola d'oro 4) e nessuno li vede più dall'app.
--
-- DOVE STANNO I PERMESSI: qui, non nella maschera.
--   · chat_membri: si legge (Coordinatore e segreteria), si scrive solo con
--     chat_ammetti / chat_togli; le righe non si cancellano mai (regola 7:
--     ammesso da/il, rimosso da/il).
--   · chat_messaggi: solo i dati «di busta» (chi, quando, che tipo, se è
--     cancellato). Si legge se si è nella chat (RLS) ed è la tabella che
--     Realtime trasmette: il contenuto non viaggia mai per Realtime.
--   · chat_contenuti: testo e file. Nessun accesso diretto dalle app: si
--     legge solo con chat_elenco, che lo nasconde se il messaggio è
--     cancellato; si scrive solo con chat_scrivi (testo) o dalla funzione
--     chat-team (foto e video, con la chiave di servizio), così nessuno può
--     agganciare a un messaggio un file di Drive qualsiasi.
--
-- ACCENSIONE: s_config.chat_team_accesa = 'no' finché l'utente non dice di
-- accenderla. Spenta, la pagina la vede la segreteria e chi è scritto in
-- s_config.chat_team_prova (indirizzi separati da virgola); le notifiche
-- vanno solo a chi la vede.
-- ============================================================

insert into public.s_config (chiave, valore) values ('chat_team_accesa', 'no')
  on conflict (chiave) do nothing;
insert into public.s_config (chiave, valore) values ('chat_team_prova', '')
  on conflict (chiave) do nothing;

-- ── chi è nella chat (oltre a Coordinatore e segreteria, che ci sono sempre) ──
create table if not exists public.chat_membri (
  id          bigint generated always as identity primary key,
  email       text not null check (email = lower(btrim(email)) and email <> ''),
  tecnico_id  text references public.tecnici(tecnico_id),
  ammesso_da  text not null,
  ammesso_il  timestamptz not null default now(),
  rimosso_da  text,
  rimosso_il  timestamptz,
  check ((rimosso_da is null) = (rimosso_il is null))
);
comment on table public.chat_membri is
  'Chat del team (21/10/2026): tecnici ammessi dal Coordinatore. Una riga per ogni ammissione; la rimozione chiude la riga (rimosso_da/il), non la cancella. Si scrive solo con chat_ammetti / chat_togli.';
create unique index if not exists ux_chat_membri_attivo on public.chat_membri (email) where rimosso_il is null;

-- ── i messaggi: la busta ──
create table if not exists public.chat_messaggi (
  id             bigint generated always as identity primary key,
  autore_email   text not null,
  autore_nome    text not null,
  autore_ruolo   text not null check (autore_ruolo in ('coordinatore', 'segreteria', 'tecnico')),
  tipo           text not null check (tipo in ('testo', 'foto', 'video')),
  stato_file     text check (stato_file in ('in_caricamento', 'pronto', 'fallito')),
  creato_il      timestamptz not null default now(),
  cancellato_il  timestamptz,
  cancellato_da  text,
  check ((tipo = 'testo') = (stato_file is null))
);
comment on table public.chat_messaggi is
  'Chat del team (21/10/2026): chi, quando, che tipo, se cancellato. Il contenuto sta in chat_contenuti. È la tabella che Realtime trasmette.';
create index if not exists ix_chat_messaggi_creato on public.chat_messaggi (creato_il desc);

-- ── i messaggi: il contenuto ──
create table if not exists public.chat_contenuti (
  messaggio_id        bigint primary key references public.chat_messaggi(id),
  testo               text check (char_length(testo) <= 4000),
  drive_file_id       text,
  drive_anteprima_id  text,
  nome_file           text,
  mime                text,
  dimensione_byte     bigint check (dimensione_byte is null or dimensione_byte <= 104857600),
  larghezza           integer,
  altezza             integer,
  durata_s            numeric,
  caricato_il         timestamptz
);
comment on table public.chat_contenuti is
  'Chat del team (21/10/2026): testo e file dei messaggi. Nessun accesso diretto: si legge con chat_elenco (che nasconde i cancellati), si scrive con chat_scrivi o dalla funzione chat-team. Limite video 100 MB.';

-- ── righe che non si cancellano (regola d'oro 4) ──
create or replace function public.chat_niente_delete() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  raise exception 'Nella chat del team non si cancella niente dal database: un messaggio si segna come cancellato, un membro si toglie con chat_togli';
end $$;
drop trigger if exists trg_chat_membri_no_delete on public.chat_membri;
create trigger trg_chat_membri_no_delete before delete on public.chat_membri for each row execute function public.chat_niente_delete();
drop trigger if exists trg_chat_messaggi_no_delete on public.chat_messaggi;
create trigger trg_chat_messaggi_no_delete before delete on public.chat_messaggi for each row execute function public.chat_niente_delete();
drop trigger if exists trg_chat_contenuti_no_delete on public.chat_contenuti;
create trigger trg_chat_contenuti_no_delete before delete on public.chat_contenuti for each row execute function public.chat_niente_delete();

-- ── chi è chi ──
create or replace function public.chat_nome_di(p_email text) returns text
language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select nullif(btrim(concat_ws(' ', t.tecnico_nome, t.tecnico_cognome)), '') from tecnici t
      where lower(t.email) = lower(p_email) order by coalesce(t.attivo, false) desc limit 1),
    (select nullif(btrim(r.nome), '') from app_ruoli r where lower(r.email) = lower(p_email) limit 1),
    p_email)
$$;

create or replace function public.chat_cognome_di(p_email text) returns text
language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select nullif(btrim(t.tecnico_cognome), '') from tecnici t
      where lower(t.email) = lower(p_email) order by coalesce(t.attivo, false) desc limit 1),
    'Segreteria')
$$;

-- il ruolo nella chat di un indirizzo: null = fuori
create or replace function public.chat_ruolo_di(p_email text) returns text
language sql stable security definer set search_path to 'public' as $$
  with e as (select lower(btrim(coalesce(p_email, ''))) as m)
  select case
    when (select m from e) = '' then null
    -- Direttore, Presidenza, consiglieri: mai, qualunque cosa dica il resto
    when exists (select 1 from app_ruoli r, e where lower(r.email) = e.m and r.ruolo = 'viewer' and r.stato = 'attivo') then null
    when exists (select 1 from s_config c, e where c.chiave = 'coordinatore_email' and lower(c.valore) = e.m) then 'coordinatore'
    when exists (select 1 from app_ruoli r, e where lower(r.email) = e.m and r.ruolo in ('segreteria', 'admin') and r.stato = 'attivo') then 'segreteria'
    when exists (select 1 from chat_membri cm, e where cm.email = e.m and cm.rimosso_il is null)
     and exists (select 1 from tecnici t, e where lower(t.email) = e.m and coalesce(t.attivo, false) and coalesce(t.elimina, 0) = 0) then 'tecnico'
    else null
  end
$$;

create or replace function public.chat_ruolo() returns text
language sql stable security definer set search_path to 'public' as $$
  select public.chat_ruolo_di(auth.jwt() ->> 'email')
$$;

create or replace function public.chat_partecipa() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.chat_ruolo() is not null
$$;

-- la pagina si vede se si è nella chat E (è accesa, o si è segreteria, o si è fra chi la prova)
create or replace function public.chat_visibile_di(p_email text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.chat_ruolo_di(p_email) is not null and (
    coalesce((select lower(valore) from s_config where chiave = 'chat_team_accesa'), 'no') = 'si'
    or public.chat_ruolo_di(p_email) = 'segreteria'
    or lower(btrim(p_email)) = any (string_to_array(replace(lower(coalesce((select valore from s_config where chiave = 'chat_team_prova'), '')), ' ', ''), ','))
  )
$$;

-- tutti quelli che sono nella chat adesso
create or replace function public.chat_partecipanti_email() returns setof text
language sql stable security definer set search_path to 'public' as $$
  select distinct m from (
    select lower(valore) m from s_config where chiave = 'coordinatore_email'
    union select unnest(public.push_destinatari_segreteria())
    union select email from chat_membri where rimosso_il is null
  ) x where public.chat_ruolo_di(m) is not null
$$;

-- ── RLS ──
alter table public.chat_membri enable row level security;
alter table public.chat_messaggi enable row level security;
alter table public.chat_contenuti enable row level security;
drop policy if exists chat_membri_sel on public.chat_membri;
create policy chat_membri_sel on public.chat_membri for select to authenticated
  using (public.is_coordinatore() or public.is_segreteria());
drop policy if exists chat_messaggi_sel on public.chat_messaggi;
create policy chat_messaggi_sel on public.chat_messaggi for select to authenticated
  using (public.chat_partecipa());
-- chat_contenuti: RLS accesa e nessuna policy → dalle app non si legge e non si scrive
revoke all on public.chat_membri, public.chat_messaggi, public.chat_contenuti from anon, authenticated;
grant select on public.chat_membri, public.chat_messaggi to authenticated;

-- ── che cosa vede chi apre l'app ──
create or replace function public.chat_stato() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  io text := lower(coalesce(auth.jwt() ->> 'email', ''));
  r text := public.chat_ruolo_di(io);
begin
  if r is null then
    return jsonb_build_object('partecipa', false, 'visibile', false);
  end if;
  return jsonb_build_object(
    'partecipa', true,
    'ruolo', r,
    'io', io,
    'visibile', public.chat_visibile_di(io),
    'accesa', coalesce((select lower(valore) from s_config where chiave = 'chat_team_accesa'), 'no') = 'si',
    'partecipanti', coalesce((select jsonb_agg(jsonb_build_object('email', e, 'nome', public.chat_nome_di(e), 'ruolo', public.chat_ruolo_di(e)) order by public.chat_nome_di(e))
                               from public.chat_partecipanti_email() e), '[]'::jsonb),
    'ultimo_id', (select max(id) from chat_messaggi)
  );
end $$;

-- ── i messaggi, col contenuto nascosto se cancellati ──
create or replace function public.chat_elenco(p_prima_di bigint default null, p_dopo_di bigint default null, p_limite integer default 50)
returns table (
  id bigint, autore_email text, autore_nome text, autore_ruolo text, tipo text, stato_file text,
  creato_il timestamptz, cancellato boolean, mio boolean, testo text, nome_file text, mime text,
  dimensione_byte bigint, larghezza integer, altezza integer, durata_s numeric, ha_anteprima boolean
)
language plpgsql stable security definer set search_path to 'public' as $$
declare io text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if public.chat_ruolo_di(io) is null then
    raise exception 'Non sei nella chat del team';
  end if;
  return query
  select * from (
    select m.id, m.autore_email, m.autore_nome, m.autore_ruolo, m.tipo,
           case when m.cancellato_il is null then m.stato_file end,
           m.creato_il, m.cancellato_il is not null, m.autore_email = io,
           case when m.cancellato_il is null then c.testo end,
           case when m.cancellato_il is null then c.nome_file end,
           case when m.cancellato_il is null then c.mime end,
           case when m.cancellato_il is null then c.dimensione_byte end,
           case when m.cancellato_il is null then c.larghezza end,
           case when m.cancellato_il is null then c.altezza end,
           case when m.cancellato_il is null then c.durata_s end,
           m.cancellato_il is null and c.drive_anteprima_id is not null
      from chat_messaggi m left join chat_contenuti c on c.messaggio_id = m.id
     where (p_prima_di is null or m.id < p_prima_di)
       and (p_dopo_di is null or m.id > p_dopo_di)
     order by case when p_dopo_di is null then -m.id else m.id end
     limit least(greatest(coalesce(p_limite, 50), 1), 200)
  ) x order by 1;
end $$;

-- ── scrivere un messaggio di testo ──
create or replace function public.chat_scrivi(p_testo text) returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare
  io text := lower(coalesce(auth.jwt() ->> 'email', ''));
  r text := public.chat_ruolo_di(io);
  t text := btrim(coalesce(p_testo, ''));
  nuovo bigint;
begin
  if r is null then raise exception 'Non sei nella chat del team: il messaggio non è partito'; end if;
  if t = '' then raise exception 'Il messaggio è vuoto'; end if;
  if char_length(t) > 4000 then raise exception 'Il messaggio è troppo lungo (al massimo 4000 caratteri)'; end if;
  insert into chat_messaggi (autore_email, autore_nome, autore_ruolo, tipo)
    values (io, public.chat_nome_di(io), r, 'testo') returning id into nuovo;
  insert into chat_contenuti (messaggio_id, testo) values (nuovo, t);
  return nuovo;
end $$;

-- ── cancellare il proprio messaggio: per tutti resta «messaggio cancellato» ──
create or replace function public.chat_cancella(p_id bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  io text := lower(coalesce(auth.jwt() ->> 'email', ''));
  m record;
begin
  if public.chat_ruolo_di(io) is null then raise exception 'Non sei nella chat del team'; end if;
  select * into m from chat_messaggi where id = p_id;
  if not found then raise exception 'Messaggio non trovato'; end if;
  if m.autore_email <> io then raise exception 'Si può cancellare solo un messaggio proprio'; end if;
  if m.cancellato_il is not null then return; end if;
  update chat_messaggi set cancellato_il = now(), cancellato_da = io where id = p_id;
end $$;

-- ── il Coordinatore ammette e toglie ──
create or replace function public.chat_ammetti(p_tecnico_id text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  io text := lower(coalesce(auth.jwt() ->> 'email', ''));
  t record;
  m text;
begin
  if not coalesce(public.is_coordinatore(), false) then
    raise exception 'Chi è nella chat del team lo decide il Coordinatore';
  end if;
  select * into t from tecnici where tecnico_id = p_tecnico_id;
  if not found then raise exception 'Tecnico non trovato'; end if;
  m := lower(btrim(coalesce(t.email, '')));
  if m = '' then raise exception 'Il tecnico non ha un indirizzo e-mail: senza non può entrare nell''app'; end if;
  if not coalesce(t.attivo, false) or coalesce(t.elimina, 0) <> 0 then
    raise exception 'Il tecnico non è attivo';
  end if;
  if exists (select 1 from app_ruoli where lower(email) = m and ruolo = 'viewer' and stato = 'attivo') then
    raise exception 'Direttore, Presidenza e consiglieri non sono nella chat del team';
  end if;
  if public.chat_ruolo_di(m) in ('coordinatore', 'segreteria') then
    raise exception 'Coordinatore e segreteria sono sempre nella chat';
  end if;
  if exists (select 1 from chat_membri where email = m and rimosso_il is null) then
    raise exception 'È già nella chat';
  end if;
  insert into chat_membri (email, tecnico_id, ammesso_da) values (m, t.tecnico_id, io);
end $$;

create or replace function public.chat_togli(p_tecnico_id text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  io text := lower(coalesce(auth.jwt() ->> 'email', ''));
  n integer;
begin
  if not coalesce(public.is_coordinatore(), false) then
    raise exception 'Chi è nella chat del team lo decide il Coordinatore';
  end if;
  update chat_membri set rimosso_da = io, rimosso_il = now()
   where rimosso_il is null
     and (tecnico_id = p_tecnico_id or email = (select lower(email) from tecnici where tecnico_id = p_tecnico_id));
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Non è nella chat'; end if;
end $$;

-- ── il quadro del riquadro «Chi è nella chat» (Coordinatore e segreteria) ──
create or replace function public.chat_membri_quadro() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  coord_mail text := (select lower(valore) from s_config where chiave = 'coordinatore_email');
  segr text[] := public.push_destinatari_segreteria();
  a integer := extract(year from (now() at time zone 'Europe/Rome'))::int;
  me integer := extract(month from (now() at time zone 'Europe/Rome'))::int;
begin
  if not (coalesce(public.is_coordinatore(), false) or coalesce(public.is_segreteria(), false)) then
    raise exception 'Il quadro della chat lo vedono il Coordinatore e la segreteria';
  end if;
  return jsonb_build_object(
    'accesa', coalesce((select lower(valore) from s_config where chiave = 'chat_team_accesa'), 'no') = 'si',
    'fissi', coalesce((select jsonb_agg(jsonb_build_object('email', e, 'nome', public.chat_nome_di(e), 'ruolo', public.chat_ruolo_di(e)))
                         from (select coord_mail e union select unnest(segr)) f where public.chat_ruolo_di(e) is not null), '[]'::jsonb),
    'tecnici', coalesce((select jsonb_agg(x order by x->>'cognome', x->>'nome') from (
        select jsonb_build_object(
          'tecnico_id', t.tecnico_id, 'nome', t.tecnico_nome, 'cognome', t.tecnico_cognome, 'email', lower(t.email),
          'dentro', cm.id is not null, 'dal', cm.ammesso_il,
          'incarico_mese', exists (select 1 from s_incarichi_mensili i where i.tecnico_id = t.tecnico_id and i.anno = a and i.mese = me)
        ) x
          from tecnici t
          left join chat_membri cm on cm.email = lower(t.email) and cm.rimosso_il is null
         where coalesce(t.attivo, false) and coalesce(t.elimina, 0) = 0 and coalesce(btrim(t.email), '') <> ''
           and lower(t.email) <> coalesce(coord_mail, '') and not (lower(t.email) = any (segr))
           and not exists (select 1 from app_ruoli r where lower(r.email) = lower(t.email) and r.ruolo = 'viewer' and r.stato = 'attivo')
      ) q), '[]'::jsonb),
    'movimenti', coalesce((select jsonb_agg(v order by v->>'quando' desc) from (
        select jsonb_build_object('quando', cm.ammesso_il, 'cosa', 'ammesso', 'chi', public.chat_nome_di(cm.email), 'da', public.chat_nome_di(cm.ammesso_da)) v from chat_membri cm
        union all
        select jsonb_build_object('quando', cm.rimosso_il, 'cosa', 'tolto', 'chi', public.chat_nome_di(cm.email), 'da', public.chat_nome_di(cm.rimosso_da)) from chat_membri cm where cm.rimosso_il is not null
      ) mv), '[]'::jsonb)
  );
end $$;

-- ── per la funzione chat-team (chiave di servizio): un messaggio con un file ──
create or replace function public.chat_file_nuovo(p_email text, p_tipo text, p_testo text, p_mime text, p_dimensione bigint,
                                                  p_larghezza integer default null, p_altezza integer default null, p_durata numeric default null)
returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare
  m text := lower(btrim(coalesce(p_email, '')));
  r text := public.chat_ruolo_di(m);
  nuovo bigint;
begin
  if r is null then raise exception 'Non sei nella chat del team'; end if;
  if p_tipo not in ('foto', 'video') then raise exception 'Tipo di file non previsto'; end if;
  if p_dimensione is not null and p_dimensione > 104857600 then
    raise exception 'Il file supera i 100 MB: condividi un link di Drive';
  end if;
  if char_length(coalesce(p_testo, '')) > 4000 then raise exception 'Il testo è troppo lungo'; end if;
  insert into chat_messaggi (autore_email, autore_nome, autore_ruolo, tipo, stato_file)
    values (m, public.chat_nome_di(m), r, p_tipo, 'in_caricamento') returning id into nuovo;
  insert into chat_contenuti (messaggio_id, testo, mime, dimensione_byte, larghezza, altezza, durata_s)
    values (nuovo, nullif(btrim(coalesce(p_testo, '')), ''), p_mime, p_dimensione, p_larghezza, p_altezza, p_durata);
  return nuovo;
end $$;

-- ── notifica: testo fisso, senza nomi, a chi la chat la vede ──
create or replace function public.chat_push_nuovo() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare e text;
begin
  for e in select public.chat_partecipanti_email() loop
    if e = new.autore_email or not public.chat_visibile_di(e) then continue; end if;
    perform public.push_accoda(e, 'chat_team', 'Chat del team', 'C''è un messaggio nuovo nella chat del team.', './?vista=chat', 'chat-team');
  end loop;
  return new;
exception when others then
  raise warning 'chat_push_nuovo: %', sqlerrm;
  return new;
end $$;
drop trigger if exists trg_chat_push_nuovo on public.chat_messaggi;
create trigger trg_chat_push_nuovo after insert on public.chat_messaggi for each row execute function public.chat_push_nuovo();

-- ── Realtime: solo la busta ──
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messaggi') then
    alter publication supabase_realtime add table public.chat_messaggi;
  end if;
end $$;

-- ── permessi sulle funzioni ──
revoke all on function public.chat_niente_delete() from public, anon, authenticated;
revoke all on function public.chat_push_nuovo() from public, anon, authenticated;
revoke all on function public.chat_nome_di(text) from public, anon, authenticated;
revoke all on function public.chat_cognome_di(text) from public, anon, authenticated;
revoke all on function public.chat_ruolo_di(text) from public, anon, authenticated;
revoke all on function public.chat_visibile_di(text) from public, anon, authenticated;
revoke all on function public.chat_partecipanti_email() from public, anon, authenticated;
revoke all on function public.chat_file_nuovo(text, text, text, text, bigint, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.chat_ruolo() from public, anon;
revoke all on function public.chat_partecipa() from public, anon;
revoke all on function public.chat_stato() from public, anon;
revoke all on function public.chat_elenco(bigint, bigint, integer) from public, anon;
revoke all on function public.chat_scrivi(text) from public, anon;
revoke all on function public.chat_cancella(bigint) from public, anon;
revoke all on function public.chat_ammetti(text) from public, anon;
revoke all on function public.chat_togli(text) from public, anon;
revoke all on function public.chat_membri_quadro() from public, anon;
grant execute on function public.chat_ruolo() to authenticated;
grant execute on function public.chat_partecipa() to authenticated;
grant execute on function public.chat_stato() to authenticated;
grant execute on function public.chat_elenco(bigint, bigint, integer) to authenticated;
grant execute on function public.chat_scrivi(text) to authenticated;
grant execute on function public.chat_cancella(bigint) to authenticated;
grant execute on function public.chat_ammetti(text) to authenticated;
grant execute on function public.chat_togli(text) to authenticated;
grant execute on function public.chat_membri_quadro() to authenticated;
grant execute on function public.chat_ruolo_di(text), public.chat_cognome_di(text), public.chat_file_nuovo(text, text, text, text, bigint, integer, integer, numeric) to service_role;
