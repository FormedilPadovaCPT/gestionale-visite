-- ============================================================
-- DOCUMENTI DA FIRMARE (21/10/2026, chiesto dall'utente: «per i documenti
-- che richiedono firma del tecnico deve essere possibile firmarli»).
--
-- Si aggancia al registro delle firme che esiste già (s_firme, funzione
-- firma-documenti, riquadro «✍️ Da firmare» di firme.js), invece di farne
-- un secondo:
--   · un documento pubblicato con «richiede la firma» crea, per ciascun
--     destinatario, una riga di s_firme col ruolo nuovo «personale»
--     (tipo «documento», rif «doc:<id>:<email>»: una copia per persona);
--   · la persona legge il PDF e preme «Firmo»: la firma scansionata (se c'è)
--     e «Firmato nell'app il … alle … - Nome» si appongono sulla SUA copia;
--   · per questi documenti la firma prende il posto della presa visione,
--     che non si dà a parte;
--   · una versione nuova, o il ritiro, ritira anche le firme non ancora date.
-- ============================================================

-- il ruolo nuovo nel registro delle firme
alter table public.s_firme drop constraint if exists s_firme_ruolo_check;
alter table public.s_firme add constraint s_firme_ruolo_check
  check (firmatario_ruolo = any (array['presidente', 'direttore', 'rpf', 'docente', 'incaricato', 'personale']));

-- il documento chiede la firma?
alter table public.doc_personale add column if not exists richiede_firma boolean not null default false;

create or replace function public.doc_personale_fermo() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if (new.codice, new.versione, new.titolo, new.descrizione, new.destinatari, new.drive_file_id, new.nome_file, new.sha256, new.md5_drive, new.dimensione_byte, new.pubblicato_il, new.pubblicato_da, new.richiede_firma)
     is distinct from
     (old.codice, old.versione, old.titolo, old.descrizione, old.destinatari, old.drive_file_id, old.nome_file, old.sha256, old.md5_drive, old.dimensione_byte, old.pubblicato_il, old.pubblicato_da, old.richiede_firma) then
    raise exception 'Una versione pubblicata non si modifica: se il documento cambia, se ne pubblica una nuova';
  end if;
  if old.ritirato_il is not null and new.ritirato_il is distinct from old.ritirato_il then
    raise exception 'La versione è già ritirata';
  end if;
  return new;
end $$;

-- le firme non ancora date di una versione escono dagli elenchi (versione nuova o ritiro)
create or replace function public.doc_firme_ritira(p_doc bigint, p_chi text) returns void
language sql security definer set search_path to 'public' as $$
  update s_firme set stato = 'ritirata', ritirata_il = now(), ritirata_da = p_chi
   where tipo = 'documento' and rif like 'doc:' || p_doc || ':%' and stato in ('in_attesa', 'in_coda')
$$;

-- a chi va ancora chiesta la firma: destinatari senza una richiesta viva o già firmata
create or replace function public.doc_firme_mancanti(p_doc bigint) returns setof text
language sql stable security definer set search_path to 'public' as $$
  select e from public.doc_destinatari_email(p_doc) e
   where exists (select 1 from doc_personale d where d.id = p_doc and d.richiede_firma and d.ritirato_il is null)
     and not exists (select 1 from s_firme f where f.tipo = 'documento' and f.rif = 'doc:' || p_doc || ':' || e
                       and f.stato in ('in_attesa', 'in_coda', 'firmata', 'rimandata'))
$$;

-- doc_registra: un parametro in più (richiede_firma). Senza firma resta com'era;
-- con la firma la notifica la manda firma-documenti (mail + 🔔), non questa.
drop function if exists public.doc_registra(text, text, integer, text, text, text[], text, text, text, text, bigint);
create or replace function public.doc_registra(p_email text, p_codice text, p_versione integer, p_titolo text, p_descrizione text,
                                               p_destinatari text[], p_drive_file_id text, p_nome_file text, p_sha256 text,
                                               p_md5 text, p_dimensione bigint, p_richiede_firma boolean default false)
returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare
  io text := lower(btrim(coalesce(p_email, '')));
  nuovo bigint;
  e text;
  vecchio bigint;
  v_titolo text := btrim(coalesce(p_titolo, ''));
begin
  if not (io = any (public.push_destinatari_segreteria())) then
    raise exception 'I documenti al personale li pubblica la segreteria';
  end if;
  if p_versione is distinct from public.doc_prossima_versione(p_codice) then
    raise exception 'Nel frattempo è stata pubblicata un''altra versione di questo documento: ricarica la pagina';
  end if;
  for vecchio in select id from doc_personale where codice = p_codice and ritirato_il is null loop
    perform public.doc_firme_ritira(vecchio, io);
  end loop;
  update doc_personale set ritirato_il = now(), ritirato_da = io where codice = p_codice and ritirato_il is null;
  insert into doc_personale (codice, versione, titolo, descrizione, destinatari, drive_file_id, nome_file, sha256, md5_drive, dimensione_byte, pubblicato_da, richiede_firma)
    values (p_codice, p_versione, v_titolo, nullif(btrim(coalesce(p_descrizione, '')), ''), p_destinatari, p_drive_file_id, p_nome_file,
            lower(p_sha256), nullif(p_md5, ''), p_dimensione, io, coalesce(p_richiede_firma, false))
    returning id into nuovo;
  if not coalesce(p_richiede_firma, false) then
    for e in select public.doc_destinatari_email(nuovo) loop
      if e = io then continue; end if;
      perform public.push_accoda(e, 'doc_da_leggere:' || nuovo, 'Documento da leggere',
        'C''è un documento da leggere nel gestionale: «' || left(v_titolo, 120) || '».', './?vista=documenti', 'doc-' || nuovo);
    end loop;
  end if;
  return nuovo;
end $$;

create or replace function public.doc_ritira(p_doc bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
declare io text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not (io = any (public.push_destinatari_segreteria())) then
    raise exception 'I documenti al personale li ritira la segreteria';
  end if;
  update doc_personale set ritirato_il = now(), ritirato_da = io where id = p_doc and ritirato_il is null;
  if not found then raise exception 'Il documento non c''è o è già ritirato'; end if;
  perform public.doc_firme_ritira(p_doc, io);
end $$;

-- la firma della persona su una versione (l'ultima richiesta non ritirata)
create or replace function public.doc_firma_di(p_doc bigint, p_email text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('id', f.id, 'stato', f.stato, 'firmata_il', f.firmata_il, 'rimandata_il', f.rimandata_il, 'rimandata_motivo', f.rimandata_motivo)
    from s_firme f
   where f.tipo = 'documento' and f.rif = 'doc:' || p_doc || ':' || lower(btrim(coalesce(p_email, ''))) and f.stato <> 'ritirata'
   order by f.richiesta_il desc limit 1
$$;

-- «Ho letto e preso visione»: per i documenti da firmare no, vale la firma
create or replace function public.doc_prendi_visione(p_doc bigint) returns timestamptz
language plpgsql security definer set search_path to 'public' as $$
declare
  io text := lower(coalesce(auth.jwt() ->> 'email', ''));
  p record;
begin
  if not public.doc_destinatario_di(p_doc, io) then
    raise exception 'Questo documento non è fra i tuoi, o è stato sostituito da una versione nuova';
  end if;
  if exists (select 1 from doc_personale where id = p_doc and richiede_firma) then
    raise exception 'Questo documento si firma: usa «Firmo» nel riquadro «Documenti da firmare»';
  end if;
  select * into p from doc_prese_visione where documento_id = p_doc and email = io;
  if not found then
    raise exception 'Apri prima il documento: la presa visione si dà dopo averlo letto';
  end if;
  if p.presa_il is not null then return p.presa_il; end if;
  update doc_prese_visione set presa_il = now() where id = p.id returning presa_il into p.presa_il;
  return p.presa_il;
end $$;

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
        'aperto_il', p.aperto_il, 'presa_il', p.presa_il, 'richiede_firma', d.richiede_firma,
        'firma', case when d.richiede_firma then public.doc_firma_di(d.id, io) end)
        order by (p.presa_il is not null), d.pubblicato_il desc)
      from doc_personale d left join doc_prese_visione p on p.documento_id = d.id and p.email = io
      where d.ritirato_il is null and d.destinatari && gruppi), '[]'::jsonb),
    'precedenti', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'titolo', d.titolo, 'versione', d.versione, 'ritirato_il', d.ritirato_il, 'aperto_il', p.aperto_il, 'presa_il', p.presa_il)
        order by d.ritirato_il desc)
      from doc_prese_visione p join doc_personale d on d.id = p.documento_id
      where p.email = io and d.ritirato_il is not null), '[]'::jsonb)
  );
end $$;

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
      'richiede_firma', d.richiede_firma,
      'firme_mancanti', case when d.richiede_firma and d.ritirato_il is null then (select count(*) from public.doc_firme_mancanti(d.id)) else 0 end,
      'persone', coalesce((select jsonb_agg(jsonb_build_object(
          'email', q.m, 'nome', public.chat_nome_di(q.m), 'aperto_il', p.aperto_il, 'presa_il', p.presa_il,
          'firma', case when d.richiede_firma then public.doc_firma_di(d.id, q.m) end,
          'destinatario', d.ritirato_il is null and public.doc_destinatario_di(d.id, q.m)) order by public.chat_nome_di(q.m))
        from (select public.doc_destinatari_email(d.id) m union select email from doc_prese_visione where documento_id = d.id
              union select split_part(rif, ':', 3) from s_firme where tipo = 'documento' and rif like 'doc:' || d.id || ':%' and stato = 'firmata') q
        left join doc_prese_visione p on p.documento_id = d.id and p.email = q.m), '[]'::jsonb)
    ) x
    from doc_personale d
    order by d.pubblicato_il desc
    limit 60
  ) y), '[]'::jsonb);
end $$;

revoke all on function public.doc_firme_ritira(bigint, text) from public, anon, authenticated;
revoke all on function public.doc_firme_mancanti(bigint) from public, anon, authenticated;
revoke all on function public.doc_firma_di(bigint, text) from public, anon, authenticated;
revoke all on function public.doc_registra(text, text, integer, text, text, text[], text, text, text, text, bigint, boolean) from public, anon, authenticated;
grant execute on function public.doc_firme_mancanti(bigint), public.doc_registra(text, text, integer, text, text, text[], text, text, text, text, bigint, boolean) to service_role;
