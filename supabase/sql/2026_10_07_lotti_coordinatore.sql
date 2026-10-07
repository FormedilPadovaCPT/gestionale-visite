-- 07/10/2026 — ANCHE IL COORDINATORE DIVIDE LE VISITE IN LOTTI (chiesto dall'utente: «dai la possibilità anche al
-- coordinatore di separare visite in lotti come la segreteria»).
--   · sposta_visite_in_lotti: autorizzata a segreteria (s_unioni_autorizzato) e coordinatore (is_coordinatore).
--   · visite_modulo_originale e visite_modulo_fonti: lettura anche al coordinatore, perché nella finestra «Dividi» legge
--     l'indirizzo com'era scritto nel modulo originale. Sono righe del modulo Google delle visite: dati che il
--     coordinatore già vede nei verbali.
-- L'unione dei cantieri («Unisci come lotti», adotta_lotto_cantiere) resta della segreteria.

begin;

create or replace function public.sposta_visite_in_lotti(p_cantiere_id text, p_lotto_qui text, p_assegnazioni jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  c public.cantieri;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  qui text := nullif(regexp_replace(btrim(coalesce(p_lotto_qui, '')), '\s+', ' ', 'g'), '');
  a record;
  dest text;
  mappa jsonb := '{}'::jsonb;    -- nome lotto (minuscolo) → cantiere_id
  creati jsonb := '[]'::jsonb;
  spostate int := 0;
  ricalcolate int := 0;
  r jsonb;
  k text;
  toccati text[];
begin
  if not (public.s_unioni_autorizzato() or coalesce(public.is_coordinatore(), false)) then
    raise exception 'Dividere le visite in lotti spetta alla segreteria o al coordinatore';
  end if;
  if p_assegnazioni is null or jsonb_typeof(p_assegnazioni) <> 'array' or jsonb_array_length(p_assegnazioni) = 0 then
    raise exception 'Nessuna visita da spostare';
  end if;
  select * into c from public.cantieri where cantiere_id = p_cantiere_id for update;
  if not found or coalesce(c.elimina, 0) <> 0 then raise exception 'Cantiere % non trovato', p_cantiere_id; end if;

  -- la scheda di partenza prende il suo lotto, se non ce l'ha
  if coalesce(btrim(c.lotto), '') = '' then
    if qui is null then raise exception 'Scrivi il nome del lotto di questa scheda (per esempio 1)'; end if;
    perform public.crea_lotto_cantiere(p_cantiere_id, qui, null);
    select * into c from public.cantieri where cantiere_id = p_cantiere_id;
  end if;
  for a in select l.cantiere_id, l.lotto from public.lotti_del_cantiere(p_cantiere_id) l where coalesce(btrim(l.lotto), '') <> '' loop
    mappa := mappa || jsonb_build_object(lower(a.lotto), a.cantiere_id);
  end loop;

  perform set_config('app.incarico_sistema', '1', true);
  for a in select x ->> 'visita_id' as visita_id, nullif(regexp_replace(btrim(coalesce(x ->> 'lotto', '')), '\s+', ' ', 'g'), '') as lotto
             from jsonb_array_elements(p_assegnazioni) x loop
    if a.visita_id is null or a.lotto is null then raise exception 'Ogni riga deve avere la visita e il lotto'; end if;
    if length(a.lotto) > 30 then raise exception 'Il nome del lotto è troppo lungo: bastano poche lettere (1, 2, A, Palazzina B)'; end if;
    if not exists (select 1 from public.visite v where v.visita_id = a.visita_id and v.cantiere_id = p_cantiere_id and v.elimina = 0) then
      raise exception 'La visita % non è su questa scheda', a.visita_id;
    end if;
    k := lower(a.lotto);
    dest := mappa ->> k;
    if dest is null then
      r := public.crea_lotto_cantiere(p_cantiere_id, null, a.lotto);
      dest := r ->> 'cantiere_id';
      mappa := mappa || jsonb_build_object(k, dest);
      creati := creati || jsonb_build_object('lotto', a.lotto, 'cantiere_id', dest);
    end if;
    if dest = p_cantiere_id then continue; end if;   -- resta dov'è
    update public.visite set cantiere_id = dest where visita_id = a.visita_id;
    spostate := spostate + 1;
    insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da)
    values (dest, 'visita ' || a.visita_id, p_cantiere_id, dest, 'visita spostata sul lotto ' || a.lotto || ' dalla divisione in lotti', chi);
  end loop;

  -- il numero di accesso: i definitivi tengono quello stampato (01/10), le bozze lo riprendono dal loro lotto
  toccati := array(select distinct value from jsonb_each_text(mappa)) || p_cantiere_id;
  with n as (
    select v.visita_id, row_number() over (partition by v.cantiere_id order by v.data_visita, v.visita_id) as acc
      from public.visite v where v.cantiere_id = any(toccati) and v.elimina = 0)
  update public.visite v set acc_cant = n.acc::text
    from n where n.visita_id = v.visita_id and coalesce(v.stato, '') <> 'definitivo' and v.acc_cant is distinct from n.acc::text;
  get diagnostics ricalcolate = row_count;

  return jsonb_build_object('ok', true, 'spostate', spostate, 'lotti_creati', creati, 'accessi_ricalcolati', ricalcolate, 'lotto_partenza', c.lotto);
end $$;
revoke execute on function public.sposta_visite_in_lotti(text, text, jsonb) from public, anon;
grant execute on function public.sposta_visite_in_lotti(text, text, jsonb) to authenticated;

-- il modulo originale lo legge anche il coordinatore (serve alla finestra «Dividi»)
drop policy if exists modulo_originale_segreteria_sel on public.visite_modulo_originale;
create policy modulo_originale_segreteria_sel on public.visite_modulo_originale for select to authenticated
  using ((select public.is_segreteria()) or (select coalesce(public.is_coordinatore(), false)));
drop policy if exists modulo_fonti_segreteria_sel on public.visite_modulo_fonti;
create policy modulo_fonti_segreteria_sel on public.visite_modulo_fonti for select to authenticated
  using ((select public.is_segreteria()) or (select coalesce(public.is_coordinatore(), false)));

commit;
