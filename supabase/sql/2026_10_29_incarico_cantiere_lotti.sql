-- 29/10/2026 — L'INCARICO VALE PER IL SUO CANTIERE (o per tutti i lotti del complesso), E LA VISITA LO EREDITA
-- (deciso dall'utente: «l'incarico è sempre puntuale, una impresa che chiede una serie di visite la chiede per un
-- cantiere specifico»; «una richiesta può essere fatta dall'impresa solo per un cantiere»; «la segreteria quando apre
-- un incarico deve poter inserire tutti i dati, anche il lotto»; «per i lotti selezionarne uno o eventualmente
-- autorizzarli tutti, es. cantieri del tram dove i lotti si spostano continuamente, e quando si arriva a 10 visite si
-- chiude come sempre»; «serve un metodo che non possa generare errori e che sia pratico per il tecnico»).
--
-- Prima di oggi nessuno dei 1.081 incarichi aveva un cantiere: la pratica portava indirizzo e comune scritti a mano,
-- e il tecnico doveva digitare il numero dell'incarico. Su 17 visite in serie dal 01/10 solo 5 erano agganciate.
--   1. incarichi.tutti_i_lotti e s_visite_richieste.cantiere_id / tutti_i_lotti: la segreteria sceglie nella pratica
--      il cantiere dall'anagrafica e, se è un complesso a lotti, un lotto oppure tutti;
--   2. incarico_vale_per_cantiere: la sola regola, usata dal gestionale, dal verbale e dalla chiusura del cantiere.
--      Il complesso è quello di lotti_del_cantiere, quindi valgono anche i lotti creati dopo l'incarico;
--   3. incarichi_per_cantiere: gli incarichi aperti del tecnico che valgono per il cantiere scelto (aggancio
--      automatico nel gestionale, niente numero da scrivere);
--   4. verbale_mancanze: un verbale agganciato a un incarico che vale per un altro cantiere non si chiude, e il
--      messaggio «incarico-mancante» non dice più di scrivere il numero (il campo non si vede più nel verbale);
--   5. incarichi_del_cantiere: chiudere un lotto non chiude un incarico che vale per tutti i lotti, se ne restano
--      aperti altri;
--   6. tg_incarichi_guard: cantiere, lotti e impresa dell'incarico li cambia solo la segreteria;
--   7. visite_previste presa da incarichi_previste anche sugli incarichi creati dall'app (1083 era nato senza).
-- Gli incarichi senza cantiere (tutti quelli di prima) restano come prima: il controllo vale da quando c'è il cantiere.
-- La funzione verbale_mancanze di partenza è quella di 2026_10_26_verbale_mancanze_incarico.sql, md5 confrontato
-- con la produzione il 29/10/2026 (1102febdb9f9afdf07c75b5b8847f23d).

begin;

alter table public.incarichi add column if not exists tutti_i_lotti boolean not null default false;
comment on column public.incarichi.tutti_i_lotti is
  'true = l''incarico vale per tutti i lotti del complesso di cantiere_id (lotti_del_cantiere), anche quelli creati dopo; false = solo per cantiere_id. Lo sceglie la segreteria (29/10/2026).';
comment on column public.incarichi.cantiere_id is
  'Il cantiere (o il lotto) per cui vale l''incarico, scelto dalla segreteria dall''anagrafica. Null sugli incarichi nati prima del 29/10/2026: per loro il controllo del cantiere non vale.';

alter table public.s_visite_richieste add column if not exists cantiere_id text;
alter table public.s_visite_richieste add column if not exists tutti_i_lotti boolean not null default false;
comment on column public.s_visite_richieste.cantiere_id is
  'Il cantiere (o lotto) dell''anagrafica scelto dalla segreteria per la richiesta; passa all''incarico (29/10/2026).';

-- 2. LA REGOLA, IN UN POSTO SOLO
create or replace function public.incarico_vale_per_cantiere(p_incarico_id bigint, p_cantiere_id text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- null  = l'incarico non ha un cantiere (incarichi di prima del 29/10/2026): non si giudica;
-- true  = è il suo cantiere, oppure vale per tutti i lotti e questo è un lotto del complesso;
-- false = è un altro cantiere.
declare i record;
begin
  select cantiere_id, tutti_i_lotti into i from public.incarichi where id = p_incarico_id;
  if not found or i.cantiere_id is null then return null; end if;
  if p_cantiere_id is null then return false; end if;
  if p_cantiere_id = i.cantiere_id then return true; end if;
  if not i.tutti_i_lotti then return false; end if;
  return exists (select 1 from public.lotti_del_cantiere(i.cantiere_id) l where l.cantiere_id = p_cantiere_id);
end $function$;
revoke all on function public.incarico_vale_per_cantiere(bigint, text) from public, anon;
grant execute on function public.incarico_vale_per_cantiere(bigint, text) to authenticated;

-- 3. L'AGGANCIO AUTOMATICO NEL GESTIONALE
create or replace function public.incarichi_per_cantiere(p_cantiere_id text)
 returns table(id bigint, etichetta text, tipo_richiesta text, tutti_i_lotti boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- gli incarichi APERTI di chi compila (o di tutti, per segreteria e coordinatore: stesso filtro di
  -- incarichi_miei_aperti) che valgono per questo cantiere; la stessa etichetta della tendina
  select i.id,
         i.id || ' · ' || coalesce(nullif(i.impresa,''), nullif(i.cantiere,''), coalesce(i.tipo_richiesta,'incarico'))
           || coalesce(' (' || nullif(i.comune,'') || ')','')
           || case when coalesce(i.visite_previste,1) > 1
                   then ' — visita ' || (i.visite_fatte + 1) || ' di ' || i.visite_previste
                   else '' end,
         i.tipo_richiesta, i.tutti_i_lotti
    from public.incarichi i
   where i.stato = 'aperto'
     and i.cantiere_id is not null
     and (public.is_gestione_incarichi()
          or lower(coalesce(i.tecnico_email,'')) = lower(coalesce(auth.jwt() ->> 'email','')))
     and public.incarico_vale_per_cantiere(i.id, p_cantiere_id)
   order by i.data_richiesta desc nulls last, i.id desc;
$function$;
revoke all on function public.incarichi_per_cantiere(text) from public, anon;
grant execute on function public.incarichi_per_cantiere(text) to authenticated;

-- 6. CANTIERE, LOTTI E IMPRESA DELL'INCARICO LI CAMBIA SOLO LA SEGRETERIA
CREATE OR REPLACE FUNCTION public.tg_incarichi_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_gestione_incarichi() then return new; end if;
  if coalesce(current_setting('app.incarico_sistema', true),'') = '1' then return new; end if;
  new.stato                  := old.stato;
  new.chiuso_il              := old.chiuso_il;
  new.chiuso_da              := old.chiuso_da;
  new.pratica_chiusa_origine := old.pratica_chiusa_origine;
  new.tecnico_email          := old.tecnico_email;
  new.tecnico_nome           := old.tecnico_nome;
  new.assegnato_il           := old.assegnato_il;   -- 07/10/2026: come il tecnico assegnato
  new.id                     := old.id;
  new.visita_id              := old.visita_id;
  new.eseguito_il            := old.eseguito_il;
  new.eseguito_da            := old.eseguito_da;
  new.visite_previste        := old.visite_previste;
  new.visite_fatte           := old.visite_fatte;
  new.esito_senza_visita     := old.esito_senza_visita;   -- 07/10/2026: si scrive solo con incarico_esito_senza_visita
  new.esito_data             := old.esito_data;
  new.esito_nota             := old.esito_nota;
  new.esito_il               := old.esito_il;
  new.esito_da               := old.esito_da;
  new.esito_pagare           := old.esito_pagare;          -- 12/10/2026: lo decide la segreteria (incarico_esito_chiudi)
  new.esito_pagare_motivo    := old.esito_pagare_motivo;
  new.esito_pagare_il        := old.esito_pagare_il;
  new.esito_pagare_da        := old.esito_pagare_da;
  new.cantiere_id            := old.cantiere_id;           -- 29/10/2026: per che cosa vale l'incarico lo decide la segreteria
  new.tutti_i_lotti          := old.tutti_i_lotti;
  new.impresa_id             := old.impresa_id;
  new.impresa                := old.impresa;
  return new;
end; $function$;

-- 7. LE VISITE PREVISTE ANCHE SUGLI INCARICHI NATI DALL'APP
create or replace function public.tg_incarichi_previste()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.visite_previste is null then new.visite_previste := public.incarichi_previste(new.tipo_richiesta); end if;
  return new;
end $function$;
drop trigger if exists trg_incarichi_previste on public.incarichi;
create trigger trg_incarichi_previste before insert on public.incarichi
  for each row execute function public.tg_incarichi_previste();

-- 5. CHIUDERE UN LOTTO NON CHIUDE L'INCARICO CHE VALE PER TUTTI I LOTTI
CREATE OR REPLACE FUNCTION public.incarichi_del_cantiere(p_cantiere_id text)
 RETURNS TABLE(id bigint, stato text, tipo_richiesta text, tecnico_nome text, impresa text, altri_cantieri_aperti integer, stage boolean, si_chiude boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  if not (public.is_segreteria() or public.is_coordinatore()) then
    raise exception 'Operazione consentita solo al coordinatore o alla segreteria';
  end if;
  return query
  with legati as (
    select i.id as inc from public.incarichi i where i.cantiere_id = p_cantiere_id
    union
    select v.incarico_id from public.visite v
     where v.cantiere_id = p_cantiere_id and v.incarico_id is not null and coalesce(v.elimina,0) = 0
    union
    select i.id from public.incarichi i join public.visite v on v.visita_id = i.visita_id
     where v.cantiere_id = p_cantiere_id
    union
    -- 29/10/2026: l'incarico che vale per tutti i lotti del complesso di cui questo cantiere è un lotto
    select i.id from public.incarichi i
     where i.tutti_i_lotti and i.stato in ('aperto','eseguito')
       and public.incarico_vale_per_cantiere(i.id, p_cantiere_id)
  ), cantieri_inc as (
    -- tutti i cantieri di ciascun incarico, dalle stesse strade
    select i.id as inc, i.cantiere_id as cid from public.incarichi i join legati l on l.inc = i.id where i.cantiere_id is not null
    union
    select v.incarico_id, v.cantiere_id from public.visite v join legati l on l.inc = v.incarico_id
     where v.cantiere_id is not null and coalesce(v.elimina,0) = 0
    union
    select i.id, v.cantiere_id from public.incarichi i join legati l on l.inc = i.id join public.visite v on v.visita_id = i.visita_id
     where v.cantiere_id is not null
    union
    -- 29/10/2026: per l'incarico di tutti i lotti contano anche i lotti dove non si è ancora andati
    select i.id, k.cantiere_id from public.incarichi i join legati l on l.inc = i.id
     cross join lateral public.lotti_del_cantiere(i.cantiere_id) k
     where i.tutti_i_lotti and i.cantiere_id is not null
  ), altri as (
    select ci.inc, count(distinct ci.cid)::int as n
      from cantieri_inc ci join public.cantieri c on c.cantiere_id = ci.cid
     where ci.cid <> p_cantiere_id and coalesce(c.cantiere_chiuso,false) = false and coalesce(c.elimina,0) = 0
     group by ci.inc
  )
  select i.id, i.stato, i.tipo_richiesta, i.tecnico_nome, i.impresa,
         coalesce(a.n, 0), (i.stage_elenco_id is not null),
         (coalesce(a.n, 0) = 0 and i.stage_elenco_id is null)
    from public.incarichi i join legati l on l.inc = i.id left join altri a on a.inc = i.id
   where i.stato in ('aperto','eseguito')
   order by i.id;
end $function$;

-- 4. IL VERBALE SU UN ALTRO CANTIERE NON SI CHIUDE
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
  inc record;
  inc_ok boolean;
  tipo_nome text;
  inc_num bigint;
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

  -- (26/10/2026, deciso dall'utente) LE VISITE CHE NASCONO DA UN INCARICO SI CHIUDONO SOLO CON UN INCARICO IN ESSERE.
  -- Tipologie: 1 su segnalazione, 6 cantiere qualità, 8 adesione servizio visite in serie, 9 stage/ASL,
  -- 11 attestazione/consulenza e monitoraggio, 12 progetto SPISAL. La visita si aggancia all'incarico della
  -- segreteria col Protocollo interno; l'incarico non deve essere chiuso. Per la serie (8) l'incarico dev'essere
  -- una «Serie di visite» e le visite già fatte prima di questa (data, poi inserimento) devono essere meno di quelle
  -- previste (10, incarichi_previste): la decima chiude ancora, l'undicesima no. Finita la serie, se l'impresa
  -- desidera continuare, deve richiedere di nuovo il servizio. Caso: Barzon, via Milano ad Albignasego, serie 966
  -- finita il 26/05/2026 e sei visite fatte dopo, lo 0041 segnato «in serie» senza incarico.
  if v.tipo_accesso in (1,6,8,9,11,12) then
    tipo_nome := case v.tipo_accesso when 1 then 'Su segnalazione' when 6 then 'Cantiere qualità'
      when 8 then 'Adesione servizio visite in serie' when 9 then 'Visita STAGE/ASL'
      when 11 then 'Attestazione / consulenza e monitoraggio' else 'Progetto SPISAL' end;
    inc_ok := false;
    if coalesce(v.prot_int,'') ~ '^\s*[0-9]{1,18}\s*$' then
      select i.id, i.stato, coalesce(i.tipo_richiesta,'') ilike '%serie%' as serie,
             coalesce(i.visite_previste, public.incarichi_previste(i.tipo_richiesta))::int as previste
        into inc
        from public.incarichi i
       where i.id = trim(v.prot_int)::bigint;
      inc_ok := found;
    end if;
    if not inc_ok then
      esito := esito || jsonb_build_object('cosa','incarico-mancante','tab',1,'campo','f-prot-int',
        'testo','La tipologia «'||tipo_nome||'» vale solo per una visita che nasce da un incarico della segreteria: scegli il cantiere dell''incarico (si aggancia da solo), oppure sceglilo da «Parti da un tuo incarico». Se l''incarico non c''è, la visita non si chiude con questa tipologia: l''impresa (o chi segnala) deve fare la richiesta, e la segreteria ti dà l''incarico.');
    elsif inc.stato = 'chiuso' then
      esito := esito || jsonb_build_object('cosa','incarico-chiuso','tab',1,'campo','f-prot-int',
        'testo','L''incarico n. '||inc.id||' è chiuso: non si fanno altre visite «'||tipo_nome||'» su di esso.'
          ||case when v.tipo_accesso = 8 then ' Se l''impresa desidera continuare, deve richiedere di nuovo il servizio con il modulo «Richiesta visita o serie di visite».'
                 else ' Se serve un''altra visita, chiedi alla segreteria un incarico nuovo.' end);
    elsif v.tipo_accesso = 8 and not inc.serie then
      esito := esito || jsonb_build_object('cosa','serie-senza-incarico','tab',1,'campo','f-prot-int',
        'testo','La tipologia è «Adesione servizio visite in serie», ma l''incarico n. '||inc.id||' non è una serie di visite. Se l''impresa non ha una serie attiva, deve chiedere di attivare il servizio con il modulo «Richiesta visita o serie di visite»: fino ad allora non si fanno visite in serie.');
    elsif v.tipo_accesso = 8 then
      select count(*) into n
        from public.visite o
       where o.visita_id <> v.visita_id and coalesce(o.elimina,0) = 0
         and (o.incarico_id = inc.id or trim(coalesce(o.prot_int,'')) = inc.id::text)
         and (o.data_visita < v.data_visita or (o.data_visita = v.data_visita and o.created_at < v.created_at));
      if n >= inc.previste then
        esito := esito || jsonb_build_object('cosa','serie-completa','tab',1,'campo','f-prot-int',
          'testo','La serie di visite n. '||inc.id||' è completa: prevedeva '||inc.previste||' visite e sono già state fatte tutte. Se l''impresa desidera continuare, deve richiedere di nuovo il servizio con il modulo «Richiesta visita o serie di visite»: la nuova serie va autorizzata prima di ripartire con le visite.');
      end if;
    end if;
  end if;
  -- (29/10/2026, deciso dall'utente) L'INCARICO VALE PER IL SUO CANTIERE, o per tutti i lotti del complesso se la
  -- segreteria l'ha dato così: una visita agganciata a un incarico che vale per un altro cantiere non si chiude.
  -- Vale per qualunque tipologia, perché il numero dell'incarico lega la visita alla richiesta dell'impresa.
  -- Gli incarichi senza cantiere (quelli di prima del 29/10/2026) non si giudicano.
  inc_num := case when coalesce(v.prot_int,'') ~ '^\s*[0-9]{1,18}\s*$' then trim(v.prot_int)::bigint else v.incarico_id end;
  if inc_num is not null and v.cantiere_id is not null
     and public.incarico_vale_per_cantiere(inc_num, v.cantiere_id) = false then
    select i.id, i.tutti_i_lotti,
           coalesce(nullif(k.cantiere_etichetta,''), concat_ws(' ', k.cantiere_indirizzo, k.cantiere_civico, k.comune_nome)) as dove
      into inc
      from public.incarichi i left join public.cantieri k on k.cantiere_id = i.cantiere_id
     where i.id = inc_num;
    esito := esito || jsonb_build_object('cosa','incarico-altro-cantiere','tab',1,'campo','f-cant-search',
      'testo','L''incarico n. '||inc.id||' vale per il cantiere «'||coalesce(inc.dove,'?')||'»'
        ||case when inc.tutti_i_lotti then ' e per tutti i lotti del suo complesso' else '' end
        ||': questo verbale è su un altro cantiere. Scegli il cantiere dell''incarico; se la visita è davvero su un altro cantiere, l''impresa deve fare una nuova richiesta per quel cantiere.');
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
