-- 05/10/2026 — Riaprendo un cantiere tornano aperte SOLO le visite che si erano chiuse insieme a lui
-- (richiesta dell'utente: «se riapro devono tornare le visite riaperte», cioè quelle chiuse dal cantiere).
-- Prima riapri_cantiere riapriva TUTTE le visite chiuse del cantiere, anche quelle chiuse una per una prima
-- della chiusura del cantiere (nella prova del 05/10: 5 chiuse col cantiere, 8 riaperte).
--
-- Stessa logica degli incarichi (2026_10_05_chiusura_cantiere_incarichi.sql): chiudi_cantiere annota sulla visita
-- quale cantiere l'ha chiusa (visite.chiusa_dal_cantiere), riapri_cantiere riapre solo quelle.
--
-- Lo STORICO, letto il 05/10 sul database: delle 1.723 visite chiuse, si sono chiuse INSIEME al loro cantiere
-- quelle senza una data di chiusura propria (i riordini del 29/09: importazione storica, inattivi da 13 mesi, fine
-- CEIV) o con la stessa data del cantiere (chiudi_cantiere) — circa 1.450, che prendono l'annotazione qui sotto.
-- Restano senza annotazione, e quindi chiuse se il cantiere si riapre, le visite con una data di chiusura PROPRIA e
-- diversa da quella del cantiere (11 al 05/10, chiuse fra il 24/07 e il 04/08) e quelle chiuse su cantieri aperti.
-- Il riempimento non tocca updated_at né il registro delle modifiche (session_replication_role = replica): è
-- un'annotazione, non una modifica della visita.

alter table public.visite add column if not exists chiusa_dal_cantiere text;
comment on column public.visite.chiusa_dal_cantiere is
  'Cantiere la cui chiusura ha chiuso questa visita (chiudi_cantiere, dal 05/10/2026; storico annotato quel giorno): riapri_cantiere riapre solo queste.';

set local session_replication_role = replica;
update public.visite v
   set chiusa_dal_cantiere = v.cantiere_id
  from public.cantieri c
 where c.cantiere_id = v.cantiere_id
   and c.cantiere_chiuso is true
   and v.chiusa is true
   and v.chiusa_dal_cantiere is null
   and (v.data_chiusura is null or v.data_chiusura = c.data_chiusura);
set local session_replication_role = origin;

create or replace function public.chiudi_cantiere(p_cantiere_id text, p_motivo text default 'termini_lavori', p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_visite int;
  v_inc jsonb;
  v_chiusi jsonb;
  v_restano jsonb;
begin
  if not (public.is_segreteria() or public.is_coordinatore()) then
    raise exception 'Operazione consentita solo al coordinatore o alla segreteria';
  end if;
  if not exists (select 1 from public.cantieri where cantiere_id = p_cantiere_id) then
    raise exception 'Cantiere inesistente';
  end if;

  -- gli incarichi si leggono PRIMA di chiudere il cantiere: «altri cantieri aperti» non deve contare questo
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_inc from public.incarichi_del_cantiere(p_cantiere_id) t;

  update public.cantieri
     set cantiere_chiuso = true,
         data_chiusura   = now(),
         chiuso_da       = v_email,
         motivo_chiusura = coalesce(p_motivo,'termini_lavori'),
         note_chiusura   = nullif(trim(coalesce(p_note,'')),''),
         updated_at      = now()
   where cantiere_id = p_cantiere_id;

  -- le visite chiuse qui portano il nome del cantiere che le ha chiuse (05/10/2026): la riapertura riapre solo queste
  update public.visite
     set chiusa              = true,
         data_chiusura       = now(),
         chiusa_dal_cantiere = p_cantiere_id
   where cantiere_id = p_cantiere_id
     and coalesce(chiusa,false) = false
     and coalesce(elimina,0) = 0;
  get diagnostics v_visite = row_count;

  perform set_config('app.incarico_sistema', '1', true);
  with chiusi as (
    update public.incarichi i
       set stato_prima_chiusura = i.stato,
           chiuso_dal_cantiere  = p_cantiere_id,
           stato     = 'chiuso',
           chiuso_il = coalesce(i.chiuso_il, now()),
           chiuso_da = coalesce(i.chiuso_da, v_email)
      from jsonb_to_recordset(v_inc) as t(id bigint, si_chiude boolean)
     where t.id = i.id and t.si_chiude and i.stato in ('aperto','eseguito')
    returning i.id, i.tipo_richiesta, i.tecnico_nome, i.impresa, i.stato
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo_richiesta, 'tecnico', tecnico_nome, 'impresa', impresa) order by id)
                  filter (where stato = 'chiuso'), '[]'::jsonb)
    into v_chiusi from chiusi;
  perform set_config('app.incarico_sistema', '', true);

  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'tipo', t.tipo_richiesta, 'tecnico', t.tecnico_nome,
                    'altri_cantieri_aperti', t.altri_cantieri_aperti, 'stage', t.stage) order by t.id), '[]'::jsonb)
    into v_restano
    from jsonb_to_recordset(v_inc) as t(id bigint, tipo_richiesta text, tecnico_nome text, altri_cantieri_aperti int, stage boolean, si_chiude boolean)
   where not t.si_chiude;

  return jsonb_build_object('ok', true, 'cantiere_id', p_cantiere_id,
                            'visite_chiuse', v_visite, 'chiuso_da', v_email,
                            'incarichi_chiusi', v_chiusi, 'incarichi_restano', v_restano);
end $$;

create or replace function public.riapri_cantiere(p_cantiere_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_visite int;
  v_restano int;
  v_riaperti jsonb;
begin
  if not (public.is_segreteria() or public.is_coordinatore()) then
    raise exception 'Operazione consentita solo al coordinatore o alla segreteria';
  end if;

  update public.cantieri
     set cantiere_chiuso = false, data_chiusura = null, chiuso_da = null,
         motivo_chiusura = null, updated_at = now()
   where cantiere_id = p_cantiere_id;

  -- solo le visite chiuse DA questo cantiere (05/10/2026); quelle chiuse una per una restano chiuse
  update public.visite set chiusa = false, data_chiusura = null, chiusa_dal_cantiere = null
   where cantiere_id = p_cantiere_id and chiusa = true and chiusa_dal_cantiere = p_cantiere_id;
  get diagnostics v_visite = row_count;
  select count(*) into v_restano from public.visite
   where cantiere_id = p_cantiere_id and chiusa = true and coalesce(elimina,0) = 0;

  -- solo gli incarichi chiusi DA questo cantiere, nello stato che avevano
  perform set_config('app.incarico_sistema', '1', true);
  with r as (
    update public.incarichi
       set stato = coalesce(stato_prima_chiusura, 'aperto'),
           chiuso_il = null, chiuso_da = null,
           chiuso_dal_cantiere = null, stato_prima_chiusura = null
     where chiuso_dal_cantiere = p_cantiere_id and stato = 'chiuso'
    returning id, tipo_richiesta, tecnico_nome, stato
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'tipo', r.tipo_richiesta, 'tecnico', r.tecnico_nome) order by r.id)
                  filter (where r.stato <> 'chiuso'), '[]'::jsonb)
    into v_riaperti from r;
  perform set_config('app.incarico_sistema', '', true);

  return jsonb_build_object('ok', true, 'cantiere_id', p_cantiere_id, 'visite_riaperte', v_visite,
                            'visite_restano_chiuse', v_restano, 'incarichi_riaperti', v_riaperti);
end $$;
