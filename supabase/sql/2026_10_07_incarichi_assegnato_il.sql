-- 07/10/2026 — DA QUANTI GIORNI ASPETTA UN INCARICO (chiesto dall'utente: nel riquadro «Incarichi da evadere» e nella
-- pagina Incarichi si vede da quanti giorni l'incarico è stato dato al tecnico, le serie di visite escluse).
-- Fino a oggi la data dell'assegnazione non c'era: «dal 24/09» era la data della RICHIESTA. Ora:
--   · incarichi.assegnato_il = quando l'incarico è andato al tecnico che lo ha adesso. La scrive il database:
--     all'inserimento se c'è già un tecnico, e ogni volta che il tecnico cambia (riassegnazione = si riparte da zero);
--     tolto il tecnico, torna vuota.
--   · gli incarichi di prima prendono la data di risposta (negli incarichi di Access è l'approvazione, di solito il
--     giorno stesso), se manca quella della richiesta. Il riempimento non tocca aggiornato_il.
--   · la guardia degli incarichi la protegge come il tecnico assegnato: chi non gestisce gli incarichi non la cambia.
-- Il trigger si chiama «trg_incarichi_su_assegnazione» perché i trigger BEFORE girano in ordine alfabetico: deve
-- partire DOPO trg_incarichi_guard, che a un tecnico rimette il tecnico_email di prima.

begin;

alter table public.incarichi add column if not exists assegnato_il timestamptz;
comment on column public.incarichi.assegnato_il is 'Quando l''incarico è stato dato al tecnico attuale (07/10/2026). La scrive il database (trg_incarichi_su_assegnazione); per gli incarichi di prima = data di risposta, altrimenti di richiesta.';

-- riempimento dello storico, senza far scattare aggiornato_il
alter table public.incarichi disable trigger trg_incarichi_touch;
update public.incarichi
   set assegnato_il = (coalesce(data_risposta, data_richiesta)::timestamp + time '12:00') at time zone 'Europe/Rome'
 where assegnato_il is null
   and (nullif(btrim(tecnico_email), '') is not null or nullif(btrim(tecnico_nome), '') is not null)
   and coalesce(data_risposta, data_richiesta) is not null;
alter table public.incarichi enable trigger trg_incarichi_touch;

create or replace function public.tg_incarichi_su_assegnazione()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if nullif(btrim(new.tecnico_email), '') is not null and new.assegnato_il is null then
      new.assegnato_il := now();
    end if;
  elsif lower(btrim(coalesce(new.tecnico_email, ''))) is distinct from lower(btrim(coalesce(old.tecnico_email, ''))) then
    new.assegnato_il := case when nullif(btrim(new.tecnico_email), '') is null then null else now() end;
  end if;
  return new;
end $$;

drop trigger if exists trg_incarichi_su_assegnazione on public.incarichi;
create trigger trg_incarichi_su_assegnazione before insert or update on public.incarichi
  for each row execute function public.tg_incarichi_su_assegnazione();

create or replace function public.tg_incarichi_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if public.is_gestione_incarichi() then return new; end if;
  if coalesce(current_setting('app.incarico_sistema', true),'') = '1' then return new; end if;
  new.stato                  := old.stato;
  new.chiuso_il              := old.chiuso_il;
  new.chiuso_da              := old.chiuso_da;
  new.pratica_chiusa_origine := old.pratica_chiusa_origine;
  new.tecnico_email          := old.tecnico_email;
  new.tecnico_nome           := old.tecnico_nome;
  new.assegnato_il           := old.assegnato_il;   -- 07/10/2026: come il tecnico assegnato
  new.id                     := old.id;
  new.visita_id              := old.visita_id;
  new.eseguito_il            := old.eseguito_il;
  new.eseguito_da            := old.eseguito_da;
  new.visite_previste        := old.visite_previste;
  new.visite_fatte           := old.visite_fatte;
  return new;
end; $function$;

commit;
