-- 26/10/2026 — SUL VERBALE: ACCESSO, CICLO, VISITA DEL CICLO E PROGRESSIVO DELLA SERIE
-- Deciso dall'utente: «si aggiorna regola e si mette sul verbale; per le visite in serie, oltre al ciclo calcolato
-- come per tutte le altre, anche il progressivo della serie, es. 4 di 10». Variante A delle proposte grafiche
-- (proposte_grafiche/2026_10_26_verbale-accesso-ciclo-visita): sotto la banda grigia del PDF una riga
-- «Accesso al cantiere 4 · Ciclo di visita 2 · Visita 1 di 3 · Serie 4 di 10». Fino a oggi il ciclo era interno.
--
-- verbale_posizione(visita) dà al PDF (genPDF) i numeri che il client da solo non vede tutti: chi «vede solo le
-- sue» non legge le visite dei colleghi sulla stessa serie. È di sola lettura e dà solo numeri, alle stesse
-- condizioni della policy di visite (is_personale + visite_solo_proprie).
--   ciclo: { numero, visita, di }   «calcolato come per tutte le altre» (utente): di = 3 per le visite 1ª-3ª,
--          5 per la 4ª e la 5ª (che esistono solo se coperte: serie o percorso del Coordinatore, ciclo_regola),
--          null oltre la 5ª (IPC alto che continua): sul verbale resta «Visita 6» senza «di».
--   serie: { n, di, incarico }       solo tipologia 8 con un incarico «Serie di visite»; n = posto della visita fra
--          quelle dell'incarico (data, poi inserimento, poi numero del verbale: le visite importate dello stesso
--          giorno hanno lo stesso created_at e senza spareggio uscivano tutte «1»), la stessa conta di
--          verbale_mancanze (serie completa); di = incarichi.visite_previste o incarichi_previste(tipo_richiesta),
--          di norma 10. Oltre il previsto (solo lo storico: dal 26/10 l'undicesima non si chiude) di = null e sul
--          verbale resta «Serie: visita 50» senza «di» (l'incarico 975 ha più di 50 visite).
-- Chi cambia la conta della serie in verbale_mancanze la cambia anche qui.
create or replace function public.verbale_posizione(p_visita_id text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v record; c record; inc record; di int; n int; inc_id bigint;
  esito jsonb := '{}'::jsonb;
begin
  if not public.is_personale() then return null; end if;
  select x.visita_id, x.data_visita, x.created_at, x.ciclo_id, x.ciclo_visita, x.tipo_accesso, x.incarico_id, x.prot_int,
         x.tecnico_id, x.tecnico2_id, x.cantiere_id
    into v from public.visite x where x.visita_id = p_visita_id and coalesce(x.elimina, 0) = 0;
  if not found then return null; end if;
  if public.solo_proprie() and v.tecnico_id is distinct from public.mio_tecnico_id() and v.tecnico2_id is distinct from public.mio_tecnico_id()
     and not coalesce(v.cantiere_id = any(public.cantieri_extra_miei()), false) then return null; end if;

  if v.ciclo_id is not null and v.ciclo_visita is not null then
    select k.numero into c from public.visite_cicli k where k.ciclo_id = v.ciclo_id;
    if found then
      di := case when v.ciclo_visita <= 3 then 3 when v.ciclo_visita <= 5 then 5 end;
      esito := esito || jsonb_build_object('ciclo', jsonb_build_object('numero', c.numero, 'visita', v.ciclo_visita, 'di', di));
    end if;
  end if;

  if v.tipo_accesso = 8 then
    inc_id := case when coalesce(v.prot_int, '') ~ '^\s*[0-9]{1,18}\s*$' then trim(v.prot_int)::bigint else v.incarico_id end;
    select i.id, coalesce(i.visite_previste, public.incarichi_previste(i.tipo_richiesta))::int as previste
      into inc from public.incarichi i where i.id = inc_id and coalesce(i.tipo_richiesta, '') ilike '%serie%';
    if found then
      select z.k into n
        from (select o.visita_id, row_number() over (order by o.data_visita, o.created_at, o.nr_verbale nulls last, o.visita_id) as k
                from public.visite o
               where coalesce(o.elimina, 0) = 0
                 and (o.visita_id = v.visita_id or o.incarico_id = inc.id or trim(coalesce(o.prot_int, '')) = inc.id::text)) z
       where z.visita_id = v.visita_id;
      esito := esito || jsonb_build_object('serie', jsonb_build_object('n', n, 'di', case when n <= inc.previste then inc.previste end, 'incarico', inc.id));
    end if;
  end if;
  return esito;
end $$;

revoke execute on function public.verbale_posizione(text) from public, anon;
grant execute on function public.verbale_posizione(text) to authenticated;
