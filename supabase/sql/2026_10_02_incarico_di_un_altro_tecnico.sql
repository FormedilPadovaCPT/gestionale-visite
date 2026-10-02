-- 02/10/2026 — Un tecnico non può agganciare alla sua visita l'incarico di un altro.
--
-- Regola dell'utente: «non deve essere possibile per un tecnico inserire il numero
-- di un altro; deve bloccarsi con un messaggio […] la segreteria, se corretto, deve
-- eventualmente riassegnare al tecnico giusto».
--
-- Prima: l'aggancio visita → incarico avveniva sul solo numero scritto nel
-- Protocollo interno (tg_visite_incarico_id, tg_visite_aggancia_incarico), senza
-- guardare di chi fosse l'incarico: scrivendo a mano il numero di un incarico
-- altrui lo si evadeva.
--
-- Che cosa NON blocca, e perché:
--   · la segreteria (is_gestione_incarichi): gestisce gli incarichi di tutti;
--   · le scritture senza utente (importazioni, manutenzione): niente jwt;
--   · gli incarichi senza tecnico (582 storici di Access): non sono «di un altro»;
--   · una visita il cui Protocollo interno NON cambia: lo storico non si tocca,
--     e chi corregge un vecchio verbale non deve trovarsi bloccato;
--   · il testo libero e i numeri che non corrispondono a nessun incarico.

-- Di chi è un incarico, visto da chi sta compilando. Non rivela altro.
create or replace function public.incarico_di_chi(p_id bigint)
returns text
language sql stable security definer
set search_path to 'public'
as $$
  select case
    when not exists (select 1 from public.incarichi i where i.id = p_id) then 'inesistente'
    when public.is_gestione_incarichi() then 'gestione'
    else (select case
                   when coalesce(i.tecnico_email,'') = '' then 'non_assegnato'
                   when lower(i.tecnico_email) = lower(coalesce(auth.jwt() ->> 'email','')) then 'mio'
                   else 'altrui'
                 end
          from public.incarichi i where i.id = p_id)
  end;
$$;

revoke all on function public.incarico_di_chi(bigint) from public, anon;
grant execute on function public.incarico_di_chi(bigint) to authenticated;

create or replace function public.tg_visite_incarico_altrui()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_mail text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_di   text;
begin
  if v_mail = '' then return new; end if;                                   -- importazioni, manutenzione
  if new.prot_int is null or new.prot_int !~ '^\s*[0-9]{1,18}\s*$' then return new; end if;
  if TG_OP = 'UPDATE' and new.prot_int is not distinct from old.prot_int then return new; end if;
  if public.is_gestione_incarichi() then return new; end if;

  select lower(coalesce(i.tecnico_email,'')) into v_di
  from public.incarichi i where i.id = trim(new.prot_int)::bigint;
  if not found or v_di = '' or v_di = v_mail then return new; end if;

  raise exception 'L''incarico n. % è assegnato a un altro tecnico: non puoi agganciarlo alla tua visita. Contatta la segreteria: se è corretto che lo faccia tu, te lo riassegna.', trim(new.prot_int)
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_visite_incarico_altrui on public.visite;
create trigger trg_visite_incarico_altrui
  before insert or update of prot_int on public.visite
  for each row execute function public.tg_visite_incarico_altrui();
