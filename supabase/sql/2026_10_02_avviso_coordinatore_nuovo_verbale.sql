-- 02/10/2026 — Notifica al coordinatore a ogni nuovo verbale, con l'interruttore nella sua scheda.
--
-- Chiesto dall'utente: «quando arriva un nuovo verbale nell'app arrivi una notifica al
-- coordinatore, che così può andarlo a vedere», «mettendo la scelta se attivare o no nella
-- scheda del coordinatore».
--
-- Usa l'impianto delle notifiche del 17/09/2026 (push_accoda → push_coda → push-visite):
-- qui si accoda soltanto. Regole di quell'impianto, tenute ferme:
--   · testo fisso e senza nomi (si legge a schermo bloccato);
--   · chi fa l'azione non riceve la propria notifica;
--   · le scritture senza utente (importazioni, manutenzione) non notificano niente.
-- Scatta UNA volta per verbale: quando diventa «definitivo» (non a ogni risalvataggio).
-- Spenta finché il coordinatore, o la segreteria, non la accende.

-- L'interruttore sta in s_config (chiave coord_avviso_verbali = si | no).
create or replace function public.coord_avviso_verbali_stato()
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
  select case when public.is_coordinatore() or public.is_segreteria() then
    jsonb_build_object(
      'attivo', coalesce((select c.valore = 'si' from public.s_config c where c.chiave = 'coord_avviso_verbali'), false),
      'dispositivi', (select count(*) from public.push_iscrizioni i
                       where lower(i.email) = (select lower(c.valore) from public.s_config c where c.chiave = 'coordinatore_email')))
  else null end;
$$;

create or replace function public.coord_avviso_verbali_imposta(p_attivo boolean)
returns boolean
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if not (public.is_coordinatore() or public.is_segreteria()) then
    raise exception 'Riservato al coordinatore e alla segreteria' using errcode = '42501';
  end if;
  insert into public.s_config (chiave, valore, descrizione, updated_at, updated_by)
  values ('coord_avviso_verbali', case when p_attivo then 'si' else 'no' end,
          'Notifica al coordinatore a ogni nuovo verbale definitivo (si/no): si cambia dalla Zona Coordinatore del gestionale',
          now(), coalesce(auth.jwt() ->> 'email', 'sistema'))
  on conflict (chiave) do update
    set valore = excluded.valore, updated_at = now(), updated_by = excluded.updated_by;
  return p_attivo;
end;
$$;

revoke all on function public.coord_avviso_verbali_stato() from public, anon;
revoke all on function public.coord_avviso_verbali_imposta(boolean) from public, anon;
grant execute on function public.coord_avviso_verbali_stato() to authenticated;
grant execute on function public.coord_avviso_verbali_imposta(boolean) to authenticated;

create or replace function public.push_da_visite()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_io    text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_coord text;
begin
  begin
    if new.stato = 'definitivo' and coalesce(new.elimina, 0) = 0
       and (tg_op = 'INSERT' or old.stato is distinct from 'definitivo')
       and v_io <> ''
       and coalesce((select c.valore from s_config c where c.chiave = 'coord_avviso_verbali'), 'no') = 'si' then
      select lower(valore) into v_coord from s_config where chiave = 'coordinatore_email';
      if coalesce(v_coord, '') <> '' and v_coord <> v_io then
        perform push_accoda(v_coord, 'verbale_nuovo', 'Nuovo verbale',
          'È stato registrato un nuovo verbale: lo trovi nell''elenco delle visite.',
          './?vista=lista', 'verbale-' || new.visita_id);
      end if;
    end if;
  exception when others then raise warning 'push_da_visite: %', sqlerrm; end;
  return null;
end;
$$;

-- una funzione di trigger non va esposta via API (regola del 02/10/2026)
revoke all on function public.push_da_visite() from public, anon, authenticated;

drop trigger if exists trg_visite_push_coordinatore on public.visite;
create trigger trg_visite_push_coordinatore
  after insert or update of stato on public.visite
  for each row execute function public.push_da_visite();
