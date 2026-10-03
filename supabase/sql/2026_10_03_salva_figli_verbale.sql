-- 03/10/2026 (sera) — CHECK-LIST, LAVORAZIONI E IMPRESE DEL VERBALE SI RISCRIVONO IN UN COLPO SOLO.
--
-- Prima la pagina faceva sei chiamate una dopo l'altra (cancella e riscrivi, per tre tabelle). Se la
-- linea cadeva a metà — in cantiere succede — il verbale restava nel database senza check-list, o
-- senza imprese: la pagina lo diceva, ma se il tecnico chiudeva l'app il dato a metà restava.
-- Qui le tre riscritture stanno in UNA transazione: o passano tutte, o non cambia niente.
--
-- Gira coi permessi di chi la chiama (niente SECURITY DEFINER): valgono le stesse regole di prima,
-- comprese «vede solo le sue visite» e la sola lettura.
--
-- Una nota scritta su una voce senza valutazione prende valore «nota», come le 10.918 righe che ci
-- sono già: la colonna «valore» è obbligatoria e la pagina mandava null, cioè il salvataggio
-- falliva senza che si capisse quale voce lo bloccava.

create or replace function public.salva_figli_verbale(
  p_visita_id   text,
  p_checklist   jsonb,
  p_lavorazioni jsonb,
  p_imprese     jsonb
) returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  n_chk int := 0;
  n_lav int := 0;
  n_imp int := 0;
begin
  if p_visita_id is null
     or not exists (select 1 from public.visite where visita_id = p_visita_id) then
    raise exception 'Verbale % non trovato, oppure non visibile a chi lo salva.', p_visita_id
      using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_checklist, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_lavorazioni, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_imprese, '[]'::jsonb)) <> 'array' then
    raise exception 'Check-list, lavorazioni e imprese vanno passate come elenchi.'
      using errcode = '22023';
  end if;

  delete from public.visite_checklist where visita_id = p_visita_id;
  insert into public.visite_checklist (visita_id, codice, valore, nota)
    select p_visita_id,
           x->>'codice',
           coalesce(nullif(x->>'valore', ''), 'nota'),
           nullif(x->>'nota', '')
      from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) x
     where coalesce(x->>'codice', '') <> ''
       and (coalesce(x->>'valore', '') <> '' or coalesce(trim(x->>'nota'), '') <> '');
  get diagnostics n_chk = row_count;

  delete from public.visite_lavorazioni where visita_id = p_visita_id;
  insert into public.visite_lavorazioni (visita_id, genere, fase, lavorazione)
    select p_visita_id,
           coalesce(x->>'genere', ''),
           coalesce(x->>'fase', ''),
           coalesce(x->>'lavorazione', '')
      from jsonb_array_elements(coalesce(p_lavorazioni, '[]'::jsonb)) with ordinality as t(x, pos)
     order by pos;
  get diagnostics n_lav = row_count;

  delete from public.visite_imprese_presenti where visita_id = p_visita_id;
  insert into public.visite_imprese_presenti
         (visita_id, impresa_id, att, nom_prec, badge, pat, note_fasilav,
          nr_lav, nr_lav_str, tipo_imp, ruolo, is_principale, ordine)
    select p_visita_id,
           x->>'impresa_id',
           nullif(x->>'att', ''),
           nullif(x->>'nom_prec', ''),
           nullif(x->>'badge', ''),
           nullif(x->>'pat', ''),
           nullif(x->>'note_fasilav', ''),
           coalesce(nullif(x->>'nr_lav', '')::int, 0),
           coalesce(nullif(x->>'nr_lav_str', '')::int, 0),
           nullif(x->>'tipo_imp', '')::smallint,
           nullif(x->>'ruolo', ''),
           coalesce(nullif(x->>'is_principale', '')::boolean, false),
           coalesce(nullif(x->>'ordine', '')::smallint, (pos - 1)::smallint)
      from jsonb_array_elements(coalesce(p_imprese, '[]'::jsonb)) with ordinality as t(x, pos)
     where coalesce(x->>'impresa_id', '') <> ''
     order by pos;
  get diagnostics n_imp = row_count;

  return jsonb_build_object('ok', true, 'checklist', n_chk, 'lavorazioni', n_lav, 'imprese', n_imp);
end
$function$;

revoke all on function public.salva_figli_verbale(text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.salva_figli_verbale(text, jsonb, jsonb, jsonb) to authenticated;

comment on function public.salva_figli_verbale(text, jsonb, jsonb, jsonb) is
  'Riscrive check-list, lavorazioni e imprese di un verbale in una sola transazione (03/10/2026). Coi permessi di chi chiama.';
