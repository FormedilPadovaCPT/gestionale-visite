-- (03/11/2026, chiesto dall'utente) UNA FATTURA SI APPROVA SOLO A PENDENZE CHIUSE.
-- «Quando la fattura arriva al coordinatore, per poterla approvare devono essere chiusi eventuali verbali da
-- sistemare o altre pendenze che riguardano quella fattura e che l'app gli mette nella Zona Coordinatore.»
-- Dal 20/10 bloccavano già le questioni aperte e i verbali riaperti. Mancava la visita FUORI PROCEDURA ancora da
-- decidere (fp_tipo presente, fp_esito vuoto): il Coordinatore la approva o no, e finché non lo fa la fattura che
-- la comprende non va in pagamento, né dal gestionale né dai mandati della segreteria (stessa funzione).
-- La visita NON approvata entra invece fra i «Verbali da sistemare» (riepilogo-verbali.js), dove si fa passare o
-- si segnala al tecnico: è la decisione del 13/10 «la visita non approvata entra nel controllo dei verbali».

create or replace function public.fattura_questioni_aperte(p_fatture bigint[])
 returns table(fattura_id bigint, visita_id text, nr_verbale text, motivo text, dal timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.fattura_id, q.visita_id, q.nr_verbale,
         case q.esito when 'segnalata' then 'segnalato al tecnico, in attesa della risposta'
                      else 'il tecnico ha risposto, manca la decisione del Coordinatore' end,
         q.aperta_il
    from public.s_prestazioni p
    join public.visite_questioni q on q.visita_id = p.visita_id and q.esito in ('segnalata', 'risposta')
   where p.fattura_id = any (p_fatture)
     and (public.is_coordinatore() or public.is_segreteria() or public.is_amministrazione() or session_user = 'postgres')
  union all
  select p.fattura_id, r.visita_id, r.nr_verbale, 'verbale riaperto e non ancora richiuso dal tecnico', r.riaperto_il
    from public.s_prestazioni p
    join public.visite_riaperture r on r.visita_id = p.visita_id and r.richiuso_il is null
   where p.fattura_id = any (p_fatture)
     and (public.is_coordinatore() or public.is_segreteria() or public.is_amministrazione() or session_user = 'postgres')
  union all
  select p.fattura_id, v.visita_id, v.nr_verbale, 'visita fuori procedura da approvare o no dal Coordinatore', v.data_visita::timestamptz
    from public.s_prestazioni p
    join public.visite v on v.visita_id = p.visita_id and v.fp_tipo is not null and v.fp_esito is null and v.elimina = 0
   where p.fattura_id = any (p_fatture)
     and (public.is_coordinatore() or public.is_segreteria() or public.is_amministrazione() or session_user = 'postgres')
  order by 1, 3
$function$;

create or replace function public.fatture_blocco_questioni()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  elenco text;
begin
  if new.stato in ('approvata', 'mandato') and new.stato is distinct from old.stato then
    select string_agg(distinct coalesce(x.nr_verbale, x.visita_id) || ' (' || x.motivo || ')', ', ') into elenco
      from public.fattura_questioni_aperte(array[new.id]) x;
    if elenco is not null then
      raise exception 'La fattura % non può andare in pagamento: ci sono verbali con pendenze aperte: %. Si chiudono nella Zona Coordinatore («Verbali da sistemare», «Visite fuori procedura»).',
        coalesce(new.numero, new.id::text), elenco;
    end if;
  end if;
  return new;
end $function$;
