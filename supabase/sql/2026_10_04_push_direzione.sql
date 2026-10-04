-- ============================================================
-- NOTIFICHE AL DIRETTORE E ALLA PRESIDENZA PER LE LORO COSE DA FARE
-- (04/10/2026, chiesto dall'utente: «le notifiche devono arrivare al
-- direttore per le sue cose da fare ed anche alla Presidenza se ne hanno
-- da visualizzare»)
--
-- Prima di oggi al Direttore non arrivava nessuna notifica: le cose che
-- aspettano lui le vedeva solo aprendo la pagina Direzione. Ora:
--   · AUTORIZZAZIONI dei servizi CPT: quando la segreteria chiede il visto
--     (aut_stato → 'richiesta') su segnalazioni, consulenze, visite
--     richieste e serie, conferenze di cantiere, attestazioni DM 132;
--   · CANTIERI CRITICI: quando un caso viene demandato al Direttore
--     (evento 'demandata', dati.chi = 'direttore') — e alla Presidenza
--     (dati.chi = 'presidenza'), che lo riceveva già da
--     s_critico_coinvolgi_presidenza: push_accoda scarta il doppione;
--   · QUESTIONI del registro s_decisioni: quando una questione diventa
--     «aperta» per il Direttore o la Presidenza, e la mattina del giorno in
--     cui torna una questione rinviata (giro pg_cron delle 8:30).
--
-- I testi sono GENERICI come tutte le notifiche del gestionale: si leggono
-- anche a telefono bloccato. Il dettaglio sta nella pagina Direzione, dove
-- porta il tocco (./?vista=direzione). Le questioni della «commissione» non
-- notificano: non c'è un elenco di persone a cui mandarle.
-- Chi provoca l'evento non riceve la propria notifica.
-- ============================================================

-- a chi: gli indirizzi stanno in s_config (gli stessi di is_direttore e della Presidenza)
create or replace function public.push_destinatari_direzione(p_chi text)
returns text[]
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(array_agg(distinct lower(trim(valore))) filter (where coalesce(trim(valore), '') <> ''), '{}')
    from s_config
   where (p_chi = 'direttore'  and chiave = 'direttore_email')
      or (p_chi = 'presidenza' and chiave in ('presidente_email', 'vicepresidente_email'));
$$;
revoke all on function public.push_destinatari_direzione(text) from public, anon, authenticated;

-- ── 1. autorizzazioni ─────────────────────────────────────────
create or replace function public.push_da_autorizzazioni()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare v_e text; v_io text := lower(coalesce(auth.jwt() ->> 'email', '')); v_j jsonb := to_jsonb(new);
begin
  begin
    -- le colonne si leggono dal jsonb: la funzione serve cinque tabelle e «corsia» esiste solo nelle consulenze
    -- (come in s_direzione_in_attesa: delle consulenze si autorizzano solo quelle in uscita)
    if new.aut_stato = 'richiesta'
       and (tg_op = 'INSERT' or old.aut_stato is distinct from 'richiesta')
       and coalesce(v_j ->> 'stato', '') not in ('chiusa', 'scartata')
       and (tg_table_name <> 's_consulenze' or v_j ->> 'corsia' = 'uscita') then
      foreach v_e in array push_destinatari_direzione('direttore') loop
        if v_e <> v_io then
          perform push_accoda(v_e, 'autorizzazione', 'Un servizio da autorizzare',
            'C''è una richiesta che aspetta il tuo visto nella pagina Direzione.',
            './?vista=direzione', 'aut-' || tg_table_name || '-' || new.id);
        end if;
      end loop;
    end if;
  exception when others then raise warning 'push_da_autorizzazioni: %', sqlerrm; end;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['s_segnalazioni', 's_consulenze', 's_visite_richieste', 's_conferenze_cantiere', 's_attestazioni_dm132'] loop
    execute format('drop trigger if exists trg_push_autorizzazione on public.%I', t);
    execute format('create trigger trg_push_autorizzazione after insert or update of aut_stato on public.%I
                    for each row execute function public.push_da_autorizzazioni()', t);
  end loop;
end $$;

-- ── 2. cantieri critici demandati (si aggiunge un ramo alla funzione che c'era) ──
create or replace function public.push_da_critici_eventi()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare v_a text; v_e text; v_chi text; v_io text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  begin
    if new.visibile_tecnico and new.tipo in ('decisione', 'risposta_tecnico', 'visita_riprogrammata', 'conferenza_proposta', 'segnalazione_organi') then
      select lower(segnalato_da) into v_a from s_cantieri_critici where id = new.critico_id and storico_rif is null;
      if coalesce(v_a, '') <> '' and v_a <> lower(coalesce(new.autore, '')) then
        perform push_accoda(v_a, 'critico_risposta', 'Aggiornamento sulla tua segnalazione',
          'C''è una novità su una tua segnalazione: la trovi in «Accesso negato al cantiere».', './?vista=dashboard', 'critico-' || new.critico_id);
      end if;
    end if;
    -- (04/10/2026) il caso passato al Direttore o alla Presidenza: avvisa chi deve decidere
    if new.tipo = 'demandata' then
      v_chi := new.dati ->> 'chi';
      if v_chi in ('direttore', 'presidenza') then
        foreach v_e in array push_destinatari_direzione(v_chi) loop
          if v_e <> v_io and v_e <> lower(coalesce(new.autore, '')) then
            if v_chi = 'direttore' then
              perform push_accoda(v_e, 'critico_direttore', 'Cantieri critici — serve la tua conferma',
                'C''è un caso che aspetta la tua conferma nella pagina Direzione.', './?vista=direzione', 'critico-dir-' || new.critico_id);
            else
              perform push_accoda(v_e, 'critico_presidenza', 'Cantieri critici — la Presidenza è coinvolta',
                'C''è un caso da valutare nella pagina Presidenza.', './?vista=direzione', 'critico-pres-' || new.critico_id);
            end if;
          end if;
        end loop;
      end if;
    end if;
  exception when others then raise warning 'push_da_critici_eventi: %', sqlerrm; end;
  return null;
end $function$;

-- ── 3. questioni del registro ─────────────────────────────────
create or replace function public.push_da_decisioni()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare v_e text; v_io text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  begin
    if new.stato = 'aperta' and new.decisore in ('direttore', 'presidenza')
       and (tg_op = 'INSERT' or old.stato is distinct from 'aperta') then
      foreach v_e in array push_destinatari_direzione(new.decisore) loop
        if v_e <> v_io then
          perform push_accoda(v_e, 'decisione_nuova', 'Una questione da decidere',
            'C''è una questione che aspetta la tua decisione nella pagina '
              || case when new.decisore = 'presidenza' then 'Presidenza' else 'Direzione' end || '.',
            './?vista=direzione', 'decisione-' || new.id);
        end if;
      end loop;
    end if;
  exception when others then raise warning 'push_da_decisioni: %', sqlerrm; end;
  return null;
end $$;

drop trigger if exists trg_push_decisioni on public.s_decisioni;
create trigger trg_push_decisioni after insert or update of stato on public.s_decisioni
  for each row execute function public.push_da_decisioni();

-- ── 4. la mattina in cui torna una questione rinviata ─────────
create or replace function public.push_decisioni_rinviate_oggi()
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare r record; v_e text; n integer := 0;
begin
  for r in select decisore, count(*) as quante from s_decisioni
            where stato = 'rinviata' and rinviata_al = (now() at time zone 'Europe/Rome')::date
              and decisore in ('direttore', 'presidenza')
            group by decisore loop
    foreach v_e in array push_destinatari_direzione(r.decisore) loop
      perform push_accoda(v_e, 'decisione_rinvio',
        case when r.quante = 1 then 'Torna oggi una questione rinviata' else 'Tornano oggi ' || r.quante || ' questioni rinviate' end,
        'La trovi nella pagina ' || case when r.decisore = 'presidenza' then 'Presidenza' else 'Direzione' end || ', fra quelle in attesa.',
        './?vista=direzione', 'rinvio-' || r.decisore || '-' || (now() at time zone 'Europe/Rome')::date);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.push_decisioni_rinviate_oggi() from public, anon, authenticated;

select cron.unschedule('push-decisioni-rinviate') where exists (select 1 from cron.job where jobname = 'push-decisioni-rinviate');
-- 06:30 UTC = 8:30 a Roma con l'ora legale, 7:30 con quella solare: comunque prima dell'ufficio
select cron.schedule('push-decisioni-rinviate', '30 6 * * *', $cron$ select public.push_decisioni_rinviate_oggi(); $cron$);
