-- 08/10/2026 — VERBALE COMPLETO: ANCHE LE OSSERVAZIONI DEL TECNICO (deciso dall'utente: «rendi obbligatorio anche
-- l'inserimento delle osservazioni del tecnico, quelle visibili nel report della scheda cantiere»).
-- È la colonna visite.oss_tec (campo «Osservazioni (visibili nel report / PDF)», passo Note). Le osservazioni
-- INTERNE (oss_tec_int) restano facoltative. Vale alla chiusura: i definitivi già chiusi non si toccano.
-- La funzione è quella in produzione (identica a 2026_10_06_verbale_mancanze_codice_istat.sql, confrontata
-- prima di scrivere) con un controllo in più, prima di quello dei doppioni. I permessi restano quelli di prima.

begin;

CREATE OR REPLACE FUNCTION public.verbale_mancanze(p_visita_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    -- (06/10/2026, deciso dall'utente) il comune deve avere anche il codice ISTAT, che l'Osservatorio chiede.
    -- Il 03/10 bastava il nome perché l'elenco aveva solo la provincia di Padova; ora l'elenco ISTAT è
    -- completo e la scheda ha «➕ Altro comune»: il codice lo mette il gestionale scegliendo il comune.
    if trim(coalesce(c.comune_nome,'')) = '' then
      esito := esito || jsonb_build_object('cosa','cantiere-comune','tab',1,'campo','scheda-cantiere',
        'testo','Scheda del cantiere: manca il comune. È obbligatorio per l''Osservatorio.');
    elsif coalesce(c.cantiere_comune_cod,'') !~ '^[0-9]{6}$' then
      esito := esito || jsonb_build_object('cosa','cantiere-comune','tab',1,'campo','scheda-cantiere',
        'testo','Scheda del cantiere: il comune «'||trim(c.comune_nome)||'» non ha il codice ISTAT, che l''Osservatorio chiede. Apri la scheda e scegli il comune dalla tendina (se è fuori provincia: «➕ Altro comune»).');
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

  -- (08/10/2026, deciso dall'utente) le osservazioni del tecnico, quelle che escono nel report della scheda del
  -- cantiere e nel PDF, sono obbligatorie: senza, il verbale non si chiude. Le osservazioni interne restano facoltative.
  if coalesce(trim(v.oss_tec),'') = '' then
    esito := esito || jsonb_build_object('cosa','osservazioni','tab',13,'campo','f-oss-tec',
      'testo','Mancano le osservazioni del tecnico, quelle che vanno nel report e nel PDF: scrivi che cosa hai visto in cantiere.');
  end if;

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
$function$;

commit;
