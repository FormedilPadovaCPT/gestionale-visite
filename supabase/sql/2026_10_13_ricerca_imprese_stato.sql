-- ============================================================
-- LE RICERCHE DELLE IMPRESE DICONO LO STATO DELL'IMPRESA
-- (13/10/2026, chiesto dall'utente: «oltre a vedere il bollino ceiv se
-- iscritta si potrebbe indicare anche lo stato impresa se cessata sospesa»)
--
-- Due fatti diversi, tutti e due nei risultati:
--   stato_cassa  = che cosa dice la lista della Cassa Edile (Attiva,
--                  Sospesa, Cessata, Non iscritta). Attiva o sospesa =
--                  iscritta (regola del 01/10/2026);
--   cessata_il   = cessazione nel Registro Imprese, la scrive la
--                  segreteria nella scheda (dal 04/10/2026), con la fonte.
-- Il tipo di ritorno cambia, quindi le funzioni si ricreano. Le colonne
-- nuove stanno in fondo: chi legge per nome non se ne accorge.
-- ============================================================

drop function if exists public.rubrica_imprese_cerca(text, integer);
create function public.rubrica_imprese_cerca(p_q text default null::text, p_limit integer default 50)
 returns table(impresa_id text, impresa_nome text, piva text, impresa_cf text, comune text, indirizzo text,
   impresa_email_ref text, impresa_telefono text, contratto_ccnl text, tipo_iscrizione_ccia text,
   cassa_edile text, cod_ceiv text, contatti_riservati text[],
   stato_cassa text, cessata_il date, cessata_fonte text)
 language sql stable security definer set search_path to 'public'
as $function$
  select
    i.impresa_id, i.impresa_nome, i.piva, i.impresa_cf, i.comune, i.indirizzo,
    case when public.is_segreteria() or not ('impresa_email_ref'=any(i.contatti_riservati)) then i.impresa_email_ref else null end,
    case when public.is_segreteria() or not ('impresa_telefono'=any(i.contatti_riservati)) then i.impresa_telefono else null end,
    i.contratto_ccnl, i.tipo_iscrizione_ccia, i.cassa_edile, i.cod_ceiv,
    i.contatti_riservati,
    i.stato_cassa, i.cessata_il, i.cessata_fonte
  from public.imprese i
  where i.elimina = 0
    and public.is_personale()
    and (
      p_q is null or p_q = ''
      or i.impresa_nome ilike '%'||p_q||'%' or i.piva ilike '%'||p_q||'%'
      or i.impresa_cf ilike '%'||p_q||'%' or i.comune ilike '%'||p_q||'%'
      or (public.is_segreteria() and (
        i.impresa_email_ref ilike '%'||p_q||'%' or i.impresa_email2 ilike '%'||p_q||'%' or i.impresa_email3 ilike '%'||p_q||'%'
        or i.impresa_telefono ilike '%'||p_q||'%' or i.impresa_telefono2 ilike '%'||p_q||'%'
      ))
      or (not public.is_segreteria() and (
        (not ('impresa_email_ref'=any(i.contatti_riservati)) and i.impresa_email_ref ilike '%'||p_q||'%')
        or (not ('impresa_telefono'=any(i.contatti_riservati)) and i.impresa_telefono ilike '%'||p_q||'%')
      ))
    )
  order by i.impresa_nome nulls last
  limit p_limit;
$function$;
revoke execute on function public.rubrica_imprese_cerca(text, integer) from public, anon;
grant execute on function public.rubrica_imprese_cerca(text, integer) to authenticated, service_role;

drop function if exists public.s_cerca_imprese(text, integer);
create function public.s_cerca_imprese(p_testo text, p_limite integer default 40)
 returns table(impresa_id text, impresa_nome text, comune text, prov text, cod_ceiv text, piva text, stato text,
   pec text, impresa_email_ref text, impresa_cf text, indirizzo text, cap text,
   stato_cassa text, cessata_il date, cessata_fonte text)
 language sql stable security definer set search_path to 'public'
as $function$
  select i.impresa_id, i.impresa_nome, i.comune, i.prov,
         i.cod_ceiv, i.piva, i.stato, i.pec, i.impresa_email_ref,
         i.impresa_cf, i.indirizzo, i.cap,
         i.stato_cassa, i.cessata_il, i.cessata_fonte
  from imprese i
  where public.is_segreteria()
    and coalesce(i.elimina::int,0) = 0
    and (
      i.impresa_nome ilike '%' || p_testo || '%'
      or i.impresa_id ilike p_testo || '%'
      or i.piva ilike p_testo || '%'
      or i.impresa_cf ilike p_testo || '%'
      or i.cod_ceiv ilike p_testo || '%'
      or i.ragione_sociale2 ilike '%' || p_testo || '%'
    )
  order by i.impresa_nome
  limit greatest(1, least(p_limite, 100));
$function$;
revoke execute on function public.s_cerca_imprese(text, integer) from public, anon;
grant execute on function public.s_cerca_imprese(text, integer) to authenticated, service_role;
