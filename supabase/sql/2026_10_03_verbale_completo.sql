-- 03/10/2026 — IL VERBALE SI CHIUDE SOLO SE È COMPLETO, E LO DECIDE IL DATABASE.
--
-- Deciso dall'utente dopo gli errori dei verbali CPT/26_27/0001 e 0002: «tutti i campi
-- richiesti dall'Osservatorio come obbligatori devono essere obbligatori anche per noi».
-- Fino a oggi i controlli di chiusura stavano solo nella pagina: il database accettava
-- qualunque riga come «definitivo», e una pagina rimasta aperta da prima di una correzione
-- saltava tutte le correzioni successive.
--
--   verbale_mancanze(visita_id)  → elenco di ciò che manca (jsonb: cosa, tab, campo, testo)
--   chiudi_verbale(visita_id)    → mette «definitivo» solo se l'elenco è vuoto
--   trg_visite_chiusura_solo_completa → il passaggio a «definitivo» è accettato solo da
--                                  chiudi_verbale; le scritture senza utente (importazioni,
--                                  manutenzione) e i verbali già definitivi non sono toccati.
--
-- Regole (analisi in Gestionale_Visite_APP/manutenzione/2026_10_03_REL_…analisi-e-piano.md):
--   · durata, tipo di opera e importo «non disponibile» non bastano: si stimano (decisione 1);
--   · il committente è obbligatorio, con il tipo pubblico/privato (decisione 2);
--   · il codice fiscale dell'impresa resta com'è (decisione 3).

-- Il tipo di accesso non nasce più «Programmata»: va scelto. Una bozza può non averlo.
alter table public.visite alter column tipo_accesso drop default;
alter table public.visite alter column tipo_accesso drop not null;

create or replace function public.verbale_mancanze(p_visita_id text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  v record;
  c record;
  r record;
  n int;
  elenco text;
  esito jsonb := '[]'::jsonb;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into v from public.visite where visita_id = p_visita_id;
  if not found then
    raise exception 'Verbale % non trovato, oppure non visibile a chi lo chiede.', p_visita_id using errcode = 'P0002';
  end if;

  -- ── PASSO VISITA ────────────────────────────────────────────────────────────
  if v.data_visita > oggi then
    esito := esito || jsonb_build_object('cosa','data-futura','tab',0,'campo','f-data',
      'testo','La data della visita ('||to_char(v.data_visita,'DD/MM/YYYY')||') è nel futuro.');
  end if;
  if v.ora_visita is null then
    esito := esito || jsonb_build_object('cosa','ora-inizio','tab',0,'campo','f-da',
      'testo','Manca l''ora di inizio della visita.');
  end if;
  if v.ora_fine is null then
    esito := esito || jsonb_build_object('cosa','ora-fine','tab',0,'campo','f-a',
      'testo','Manca l''ora di fine della visita.');
  end if;
  if v.ora_visita is not null and v.ora_fine is not null and v.ora_fine <= v.ora_visita then
    esito := esito || jsonb_build_object('cosa','orari','tab',0,'campo','f-a',
      'testo','L''ora di fine ('||to_char(v.ora_fine,'HH24:MI')||') non è dopo l''ora di inizio ('||to_char(v.ora_visita,'HH24:MI')||').');
  end if;
  if v.tipo_accesso is null then
    esito := esito || jsonb_build_object('cosa','tipo-accesso','tab',0,'campo','f-tipo',
      'testo','Manca la tipologia di accesso: va scelta, la chiede l''Osservatorio nazionale.');
  end if;
  if coalesce(trim(v.nom_ppre),'') = '' and coalesce(trim(v.ppre_cog),'') = '' then
    esito := esito || jsonb_build_object('cosa','persona-presente','tab',0,'campo','f-ppre-cog',
      'testo','Manca la persona presente alla visita.');
  elsif coalesce(trim(v.qual_ppre),'') = '' then
    esito := esito || jsonb_build_object('cosa','persona-qualifica','tab',0,'campo','f-qual-ppre',
      'testo','Manca la qualifica della persona presente («In qualità di»).');
  end if;

  -- ── PASSO CANTIERE: la scheda del cantiere deve essere completa ─────────────
  select k.*, m.committente_id as comm_id, m.committente_tipo as comm_tipo
    into c
    from public.cantieri k
    left join public.committenti m
      on m.committente_id = k.cantiere_committente_id and coalesce(m.elimina,0) = 0
   where k.cantiere_id = v.cantiere_id;
  if not found then
    esito := esito || jsonb_build_object('cosa','cantiere','tab',1,'campo','f-cant-search',
      'testo','Il cantiere del verbale non è in archivio: sceglilo di nuovo.');
  else
    if length(trim(coalesce(c.cantiere_indirizzo,''))) < 2 or trim(coalesce(c.cantiere_civico,'')) = '' then
      esito := esito || jsonb_build_object('cosa','cantiere-indirizzo','tab',1,'campo','scheda-cantiere',
        'testo','Scheda del cantiere: mancano indirizzo o civico (se il civico non c''è si scrive SNC).');
    end if;
    if coalesce(c.cantiere_comune_cod,'') !~ '^[0-9]{6}$' then
      esito := esito || jsonb_build_object('cosa','cantiere-comune','tab',1,'campo','scheda-cantiere',
        'testo','Scheda del cantiere: manca il comune (con il suo codice ISTAT). È obbligatorio per l''Osservatorio.');
    end if;
    if c.cantiere_tip_int is null or c.cantiere_tip_int not between 1 and 4 then
      esito := esito || jsonb_build_object('cosa','cantiere-intervento','tab',1,'campo','scheda-cantiere',
        'testo', case when c.cantiere_tip_int is null
          then 'Scheda del cantiere: manca il tipo di intervento (costruzione, ristrutturazione, demolizione, ampliamento).'
          else 'Scheda del cantiere: il tipo di intervento è «Altro», che la codifica nazionale non prevede. Scegli fra costruzione, ristrutturazione, demolizione, ampliamento.' end);
    end if;
    if c.cantiere_tip_ope is null or c.cantiere_tip_ope not between 1 and 16 then
      esito := esito || jsonb_build_object('cosa','cantiere-opera','tab',1,'campo','scheda-cantiere',
        'testo','Scheda del cantiere: manca il tipo di opera (civile, industriale, stradale…).');
    elsif c.cantiere_tip_ope = 16 and coalesce(trim(c.cantiere_tip_ope_altro),'') = '' then
      esito := esito || jsonb_build_object('cosa','cantiere-opera-altro','tab',1,'campo','scheda-cantiere',
        'testo','Scheda del cantiere: il tipo di opera è «Altro» senza descrizione. Scrivi di che opera si tratta, oppure scegli una voce dell''elenco.');
    end if;
    if c.cantiere_durata is null or c.cantiere_durata not between 1 and 6 then
      esito := esito || jsonb_build_object('cosa','cantiere-durata','tab',1,'campo','scheda-cantiere',
        'testo', case when c.cantiere_durata = 7
          then 'Scheda del cantiere: la durata dei lavori è «Non disponibile». Serve una fascia: se non la conosci, stimala.'
          else 'Scheda del cantiere: manca la durata dei lavori. Se non la conosci, stimala.' end);
    end if;
    if c.cantiere_importo is null or c.cantiere_importo not between 1 and 10 then
      esito := esito || jsonb_build_object('cosa','importo','tab',1,'campo','f-importo',
        'testo', case when c.cantiere_importo = 11
          then 'L''importo dei lavori è «Non disponibile». Serve una fascia: se non lo conosci, stimalo.'
          else 'Manca l''importo dei lavori. Se non lo conosci, scegli la fascia che stimi.' end);
    end if;
    if c.comm_id is null then
      esito := esito || jsonb_build_object('cosa','committente','tab',1,'campo','f-comm-search',
        'testo','Manca il committente: un committente c''è sempre. Cercalo, oppure crealo con «+ Nuovo».');
    elsif c.comm_tipo is null or c.comm_tipo not in (1,2) then
      esito := esito || jsonb_build_object('cosa','committente-tipo','tab',1,'campo','btn-edit-comm',
        'testo','Il committente non dice se è pubblico o privato: aprilo con «✏️ Modifica» e indicalo.');
    end if;
  end if;
  if v.coord is null then
    esito := esito || jsonb_build_object('cosa','coordinamento','tab',1,'campo','f-coord',
      'testo','Coordinamento della sicurezza (CSP/CSE): indica se c''è oppure no.');
  end if;
  if not exists (select 1 from public.visite_lavorazioni l where l.visita_id = v.visita_id) then
    esito := esito || jsonb_build_object('cosa','lavorazioni','tab',1,'campo','lav-sel-genere',
      'testo','Mancano le lavorazioni in corso: ne serve almeno una. Scegli genere, fase e lavorazione e premi «+ Aggiungi».');
  end if;

  -- ── PASSO IMPRESE ───────────────────────────────────────────────────────────
  select count(*) into n from public.visite_imprese_presenti p where p.visita_id = v.visita_id;
  if n = 0 then
    esito := esito || jsonb_build_object('cosa','imprese','tab',2,'campo','im-search-0',
      'testo','Nel verbale non c''è nessuna impresa.');
  else
    if not exists (select 1 from public.visite_imprese_presenti p
                    where p.visita_id = v.visita_id and p.is_principale and p.impresa_id = v.impresa_id) then
      esito := esito || jsonb_build_object('cosa','impresa-principale','tab',2,'campo','im-search-0',
        'testo','L''impresa principale del verbale non coincide con la prima dell''elenco delle imprese: risalva il passo Imprese.');
    end if;
    for r in
      select coalesce(p.ordine,0) as ordine, i.impresa_nome
        from public.visite_imprese_presenti p
        join public.imprese i on i.impresa_id = p.impresa_id
       where p.visita_id = v.visita_id and p.tipo_imp is null
       order by p.ordine
    loop
      esito := esito || jsonb_build_object('cosa','ruolo','tab',2,'campo','im-tipo-'||r.ordine,
        'testo','Manca il ruolo dell''impresa «'||r.impresa_nome||'» (campo «Tipologia»): lo chiede l''Osservatorio.');
    end loop;
    if not exists (
      select 1 from public.visite_imprese_presenti p
        join public.imprese i on i.impresa_id = p.impresa_id
       where p.visita_id = v.visita_id
         and (coalesce(trim(i.impresa_email_ref),'') <> '' or coalesce(trim(i.impresa_email2),'') <> '' or coalesce(trim(i.impresa_email3),'') <> '')
    ) then
      esito := esito || jsonb_build_object('cosa','email-impresa','tab',2,'campo','im-email_verbale-0',
        'testo','Nessuna impresa del verbale ha un indirizzo e-mail: il verbale non arriverebbe a nessuna impresa. Chiedilo in cantiere e scrivilo nella riga dell''impresa.');
    end if;
  end if;

  -- ── CHECK-LIST ──────────────────────────────────────────────────────────────
  if not exists (select 1 from public.visite_checklist k
                  where k.visita_id = v.visita_id and k.valore in ('VER','OSS','NC-','NC+')) then
    esito := esito || jsonb_build_object('cosa','checklist','tab',3,'campo',null,
      'testo','La check-list è vuota: serve almeno una voce valutata, altrimenti la visita non entra nell''Osservatorio.');
  end if;
  select count(*), string_agg('«'||descr||'»', '; ') filter (where pos <= 6)
    into n, elenco
    from (
      select coalesce(vo.descrizione, k.codice) as descr, row_number() over (order by k.codice) as pos
        from public.visite_checklist k
        left join public.checklist_voci vo on vo.codice = k.codice
       where k.visita_id = v.visita_id
         and k.valore in ('NC+','NC-')
         and coalesce(trim(k.nota),'') = ''
         and not exists (
           select 1 from public.visite_checklist g
            where g.visita_id = k.visita_id
              and g.codice = regexp_replace(k.codice, '_[^_]+$', '') || '_N'
              and coalesce(trim(g.nota),'') <> '')
    ) s;
  if n > 0 then
    esito := esito || jsonb_build_object('cosa','nc-senza-nota','tab',3,'campo',null,
      'testo', case when n = 1 then 'Una non conformità è' else n||' non conformità sono' end
        ||' senza una nota che la descriva: '||elenco||case when n > 6 then '…' else '' end
        ||'. Scrivi la nota sulla voce o nella nota del suo gruppo.');
  end if;

  -- ── DOPPIONE ────────────────────────────────────────────────────────────────
  select string_agg(o.nr_verbale, ', ') into elenco
    from public.visite o
   where o.visita_id <> v.visita_id and coalesce(o.elimina,0) = 0 and o.stato = 'definitivo'
     and o.cantiere_id = v.cantiere_id and o.data_visita = v.data_visita
     and o.impresa_id = v.impresa_id and o.tecnico_id = v.tecnico_id;
  if elenco is not null then
    esito := esito || jsonb_build_object('cosa','doppione','tab',0,'campo','f-data',
      'testo','Esiste già il verbale '||elenco||' dello stesso tecnico, nello stesso giorno, sullo stesso cantiere e con la stessa impresa principale. Se è un doppione, questo non va chiuso; se sono davvero due visite, chiama la segreteria.');
  end if;

  return esito;
end
$fn$;

revoke execute on function public.verbale_mancanze(text) from public, anon;
grant execute on function public.verbale_mancanze(text) to authenticated, service_role;

create or replace function public.chiudi_verbale(p_visita_id text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  st text;
  manca jsonb;
begin
  select stato into st from public.visite where visita_id = p_visita_id for update;
  if not found then
    raise exception 'Verbale % non trovato, oppure non visibile a chi lo chiede.', p_visita_id using errcode = 'P0002';
  end if;
  if st = 'definitivo' then
    return jsonb_build_object('ok', true, 'gia_definitivo', true, 'mancanze', '[]'::jsonb);
  end if;
  manca := public.verbale_mancanze(p_visita_id);
  if jsonb_array_length(manca) > 0 then
    return jsonb_build_object('ok', false, 'mancanze', manca);
  end if;
  perform set_config('app.chiusura_verbale', p_visita_id, true);
  update public.visite set stato = 'definitivo' where visita_id = p_visita_id;
  perform set_config('app.chiusura_verbale', '', true);
  return jsonb_build_object('ok', true, 'mancanze', '[]'::jsonb);
end
$fn$;

revoke execute on function public.chiudi_verbale(text) from public, anon;
grant execute on function public.chiudi_verbale(text) to authenticated, service_role;

-- Il passaggio a «definitivo» fatto da una persona passa solo da chiudi_verbale.
-- Non tocca: le scritture senza utente (importazioni, manutenzione) e chi risalva un
-- verbale che era già definitivo.
create or replace function public.tg_visite_chiusura_solo_completa()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.stato = 'definitivo'
     and (tg_op = 'INSERT' or old.stato is distinct from 'definitivo')
     and auth.uid() is not null
     and coalesce(current_setting('app.chiusura_verbale', true), '') <> new.visita_id then
    raise exception 'Questa pagina del gestionale non è aggiornata e da qui il verbale non si può chiudere. Premi «Salva bozza», ricarica la pagina, riapri la bozza e chiudila da lì: non perdi niente.'
      using errcode = 'P0001';
  end if;
  return new;
end
$fn$;

revoke execute on function public.tg_visite_chiusura_solo_completa() from public, anon, authenticated;

drop trigger if exists trg_visite_chiusura_solo_completa on public.visite;
create trigger trg_visite_chiusura_solo_completa
  before insert or update of stato on public.visite
  for each row execute function public.tg_visite_chiusura_solo_completa();
