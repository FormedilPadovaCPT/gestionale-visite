-- ============================================================
-- «🏁 Cantiere finito» dalla pagina Scadenze (23/10/2026, chiesto dall'utente:
-- «la proposta di chiusura cantiere … si potrebbe fare proprio dalla pagina
-- scadenze prendendo una visita e segnalando per chiusura proprio quel cantiere»).
--
-- Si riusa la proposta di chiusura del 23/09 (cantieri_proposte_chiusura,
-- proponi_chiusura_cantiere, respingi_proposta_chiusura, trigger
-- proposta_chiusura_accolta). Cambiano tre cose:
--   1. la proposta porta la DATA in cui il tecnico ha visto il cantiere finito
--      (fine_constatata_il): non nel futuro, non prima dell'ultima visita;
--   2. finché la proposta è aperta il rientro esce dai rientri dovuti. Le tre
--      liste devono coincidere (regola dell'08/09/2026): pagina Scadenze
--      (loadScadenze), lettera di incarico mensile (segreteria, datiLettera) e
--      promemoria del lunedì (questa funzione ricontrolli_pendenti);
--   3. decide chi decideva già: segreteria o Coordinatore (chiudi_cantiere /
--      respingi_proposta_chiusura, invariate). Respinta, il rientro torna.
-- ============================================================

alter table public.cantieri_proposte_chiusura
  add column if not exists fine_constatata_il date;

comment on column public.cantieri_proposte_chiusura.fine_constatata_il is
  'Giorno in cui chi propone ha visto il cantiere finito (23/10/2026). Vuota sulle proposte di prima.';

-- la firma cambia (terzo parametro facoltativo): la vecchia si toglie, altrimenti
-- PostgREST vedrebbe due funzioni con lo stesso nome
drop function if exists public.proponi_chiusura_cantiere(text, text);

create or replace function public.proponi_chiusura_cantiere(p_cantiere_id text, p_motivo text, p_fine_il date default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_nome  text;
  v_id    bigint;
  v_prec  record;
  v_oggi  date := (now() at time zone 'Europe/Rome')::date;
  v_ultima date;
begin
  if not public.is_personale() then raise exception 'Operazione riservata al personale'; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'Scrivi perché il cantiere va chiuso'; end if;
  if not exists (select 1 from public.cantieri where cantiere_id = p_cantiere_id and coalesce(elimina,0) = 0) then
    raise exception 'Cantiere inesistente';
  end if;
  if exists (select 1 from public.cantieri where cantiere_id = p_cantiere_id and cantiere_chiuso is true) then
    raise exception 'Il cantiere è già chiuso';
  end if;
  if p_fine_il is not null then
    if p_fine_il > v_oggi then raise exception 'La data in cui hai visto il cantiere finito non può essere nel futuro'; end if;
    select max(data_visita) into v_ultima from public.visite where cantiere_id = p_cantiere_id and coalesce(elimina,0) = 0;
    if v_ultima is not null and p_fine_il < v_ultima then
      raise exception 'La data non può essere prima dell''ultima visita (%)', to_char(v_ultima, 'DD/MM/YYYY');
    end if;
  end if;
  select * into v_prec from public.cantieri_proposte_chiusura where cantiere_id = p_cantiere_id and esito is null;
  if found then
    return jsonb_build_object('ok', true, 'gia_proposta', true, 'id', v_prec.id,
      'proposta_da', v_prec.proposta_nome, 'proposta_il', v_prec.proposta_il);
  end if;
  select trim(coalesce(tecnico_nome,'')||' '||coalesce(tecnico_cognome,'')) into v_nome
    from public.tecnici where lower(email) = v_email limit 1;
  insert into public.cantieri_proposte_chiusura(cantiere_id, proposta_da, proposta_nome, motivo, fine_constatata_il)
  values (p_cantiere_id, v_email, nullif(v_nome,''), trim(p_motivo), p_fine_il)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'gia_proposta', false, 'id', v_id);
end $function$;

revoke all on function public.proponi_chiusura_cantiere(text, text, date) from public, anon;
grant execute on function public.proponi_chiusura_cantiere(text, text, date) to authenticated, service_role;

-- promemoria del lunedì: il cantiere con una proposta di chiusura aperta non è
-- un rientro dovuto (come in Scadenze e nella lettera di incarico)
create or replace function public.ricontrolli_pendenti(p_giorni_imminenti integer default 7)
 returns table(tecnico_id text, tecnico_email text, tecnico_nome text, cantiere_id text, cantiere_label text, nr_verbale text, data_visita date, acc integer, ipc text, data_rientro date, tipo text, giorni_diff integer, categoria text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with ultime as (
    select distinct on (v.cantiere_id) v.*
    from public.visite v
    join public.cantieri c on c.cantiere_id = v.cantiere_id
    where coalesce(v.elimina,0)=0
      and coalesce(c.cantiere_chiuso,false)=false
      and not exists (select 1 from public.cantieri_proposte_chiusura pc
                       where pc.cantiere_id = v.cantiere_id and pc.esito is null)
    order by v.cantiere_id, v.data_visita desc, v.nr_verbale desc
  ),
  calc as (
    select coalesce(pt.a_tecnico_id, u.tecnico_id) as tecnico_id, u.cantiere_id, u.nr_verbale, u.data_visita,
      u.data_ritorno as data_ritorno_valida,
      nullif(regexp_replace(coalesce(u.acc_cant::text,''),'\D','','g'),'')::int as acc,
      upper(coalesce(nullif(trim(u.ipc),''),'NR')) as ipc,
      u.ciclo_visita, u.ciclo_rientro_giorni
    from ultime u
    left join public.v_pendenze_titolari pt on pt.visita_id = u.visita_id
  ),
  g as (
    select c.*,
      public.visita_rientro_giorni(c.acc, c.ipc, c.ciclo_visita, c.ciclo_rientro_giorni) as giorni,
      case public.visita_rientro_giorni(c.acc, c.ipc, c.ciclo_visita, c.ciclo_rientro_giorni)
        when 3 then case when coalesce(c.ciclo_visita, c.acc, 1) <= 1 then 'urgente' else 'immediata' end
        when 22 then 'ordinaria' end as tipo
    from calc c
  ),
  eff as (
    select g.*,
      case
        when g.giorni is null then null
        when g.data_ritorno_valida is not null then g.data_ritorno_valida
        else g.data_visita + g.giorni
      end as eff_ritorno
    from g
  )
  select e.tecnico_id, t.email,
    trim(coalesce(t.tecnico_cognome,'')||' '||coalesce(t.tecnico_nome,'')),
    e.cantiere_id,
    (case
      when nullif(trim(ca.cantiere_indirizzo),'') is not null
        then trim(concat_ws(' ', ca.cantiere_indirizzo, ca.cantiere_civico))
             || case when nullif(trim(ca.comune_nome),'') is not null then ', '||ca.comune_nome else '' end
      else coalesce(
             nullif(trim(ca.cantiere_etichetta),'')
               || case when nullif(trim(ca.comune_nome),'') is not null then ', '||ca.comune_nome else '' end,
             ca.cantiere_etichetta,
             ca.comune_nome
           )
    end) || case when nullif(trim(ca.lotto),'') is not null then ' – lotto '||trim(ca.lotto) else '' end,
    e.nr_verbale,
    e.data_visita, e.acc, e.ipc,
    e.eff_ritorno, e.tipo,
    (e.eff_ritorno - current_date),
    case
      when e.eff_ritorno <= current_date then 'urgente'
      when e.eff_ritorno <= current_date + p_giorni_imminenti then 'imminente'
      else 'futuro'
    end
  from eff e
  left join public.tecnici t on t.tecnico_id = e.tecnico_id
  left join public.cantieri ca on ca.cantiere_id = e.cantiere_id
  where e.eff_ritorno is not null
$function$;

revoke all on function public.ricontrolli_pendenti(integer) from public, anon, authenticated;
grant execute on function public.ricontrolli_pendenti(integer) to service_role;
