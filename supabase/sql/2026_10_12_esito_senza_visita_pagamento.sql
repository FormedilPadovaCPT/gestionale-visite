-- 12/10/2026 — L'USCITA SENZA VERBALE SI PAGA SE LO DECIDE LA SEGRETERIA (chiesto dall'utente: «la segreteria deve
-- poter decidere se pagare la visita al tecnico o no»; il caso che l'ha fatto vedere è l'incarico 978, una serie di
-- visite di luglio con due visite già fatte, chiuso il 07/10 con «cantiere già finito»: tre mesi dopo, non si paga).
-- Fino a oggi l'esito senza visita entrava da solo nella chiusura del mese come una visita (2026_10_07_...).
--   · incarichi.esito_pagare (null = da decidere, true = si paga, false = non si paga), col motivo obbligatorio se
--     non si paga, chi e quando;
--   · incarico_esito_chiudi(id, pagare, motivo): la segreteria decide e chiude l'incarico in un colpo solo, dal
--     cruscotto; se l'uscita è già registrata nella chiusura del mese non la toglie (si chiude quella riga, col motivo);
--   · la guardia protegge le colonne nuove; riaprire l'incarico toglie anche la decisione;
--   · la chiusura del mese (s_prestazioni_calcola_interna, parte e) lascia fuori le uscite «non si paga»: è nella
--     migrazione gemella della segreteria, 2026_10_12_prestazioni_senza_visita_decisione.sql.

begin;

alter table public.incarichi add column if not exists esito_pagare boolean;
alter table public.incarichi add column if not exists esito_pagare_motivo text;
alter table public.incarichi add column if not exists esito_pagare_il timestamptz;
alter table public.incarichi add column if not exists esito_pagare_da text;
comment on column public.incarichi.esito_pagare is
  'Uscita senza verbale (esito_senza_visita): si paga al tecnico? null = la segreteria non ha ancora deciso, true = si paga come una visita, false = non si paga (12/10/2026).';
comment on column public.incarichi.esito_pagare_motivo is 'Perché l''uscita non si paga (obbligatorio se esito_pagare = false).';

/* un «non si paga» senza motivo non è una decisione, è una riga sparita */
alter table public.incarichi drop constraint if exists incarichi_esito_pagare_motivo_chk;
alter table public.incarichi add constraint incarichi_esito_pagare_motivo_chk
  check (esito_pagare is distinct from false or coalesce(btrim(esito_pagare_motivo), '') <> '');

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
  new.esito_senza_visita     := old.esito_senza_visita;   -- 07/10/2026: si scrive solo con incarico_esito_senza_visita
  new.esito_data             := old.esito_data;
  new.esito_nota             := old.esito_nota;
  new.esito_il               := old.esito_il;
  new.esito_da               := old.esito_da;
  new.esito_pagare           := old.esito_pagare;          -- 12/10/2026: lo decide la segreteria (incarico_esito_chiudi)
  new.esito_pagare_motivo    := old.esito_pagare_motivo;
  new.esito_pagare_il        := old.esito_pagare_il;
  new.esito_pagare_da        := old.esito_pagare_da;
  return new;
end; $function$;

create or replace function public.incarico_esito_chiudi(p_id bigint, p_pagare boolean, p_motivo text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare i public.incarichi; v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not public.is_gestione_incarichi() then
    raise exception 'Se pagare un''uscita senza visita lo decide la segreteria';
  end if;
  if p_pagare is null then raise exception 'Scegli se l''uscita si paga o no'; end if;
  select * into i from public.incarichi where id = p_id for update;
  if not found then raise exception 'L''incarico n° % non esiste', p_id; end if;
  if i.esito_senza_visita is null then
    raise exception 'L''incarico n° % non ha un''uscita senza visita da pagare o no', p_id;
  end if;
  if i.stato not in ('eseguito', 'chiuso') then
    raise exception 'L''incarico n° % è «%»: si decide su un''uscita registrata dal tecnico', p_id, i.stato;
  end if;
  if not p_pagare and v_motivo = '' then
    raise exception 'Scrivi perché l''uscita non si paga: è la riga che rileggerà chi se lo chiederà';
  end if;
  if not p_pagare and exists (select 1 from public.s_prestazioni p where p.incarico_id = p_id) then
    raise exception 'L''uscita dell''incarico n° % è già registrata nella chiusura del mese: per non pagarla chiudi quella riga col motivo, dalle fatture dei tecnici', p_id;
  end if;
  update public.incarichi set
    esito_pagare = p_pagare,
    esito_pagare_motivo = nullif(v_motivo, ''),
    esito_pagare_il = now(),
    esito_pagare_da = coalesce(auth.jwt() ->> 'email', session_user),
    stato = 'chiuso',
    chiuso_il = coalesce(chiuso_il, now()),
    chiuso_da = coalesce(chiuso_da, auth.jwt() ->> 'email'),
    chiuso_dal_cantiere = null,
    stato_prima_chiusura = null
  where id = p_id;
end; $function$;
revoke execute on function public.incarico_esito_chiudi(bigint, boolean, text) from public, anon;
grant execute on function public.incarico_esito_chiudi(bigint, boolean, text) to authenticated;

-- riaprire l'incarico toglie l'esito e anche la decisione sul pagamento
create or replace function public.incarichi_set_stato(p_id bigint, p_stato text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_gestione_incarichi() then
    raise exception 'Operazione riservata alla segreteria/coordinatore';
  end if;
  if p_stato not in ('aperto','eseguito','chiuso') then raise exception 'stato non valido'; end if;
  if p_stato = 'aperto'
     and exists (select 1 from public.incarichi where id = p_id and esito_senza_visita is not null)
     and exists (select 1 from public.s_prestazioni p where p.incarico_id = p_id) then
    raise exception 'L''incarico n° % ha un''uscita senza visita già registrata per il pagamento: riaprirlo la farebbe pagare due volte', p_id;
  end if;
  update public.incarichi set
    stato = p_stato,
    chiuso_il = case when p_stato='chiuso' then coalesce(chiuso_il, now()) else null end,
    chiuso_da = case when p_stato='chiuso' then coalesce(chiuso_da, auth.jwt() ->> 'email') else null end,
    chiuso_dal_cantiere = null,
    stato_prima_chiusura = null,
    esito_senza_visita = case when p_stato = 'aperto' then null else esito_senza_visita end,
    esito_data = case when p_stato = 'aperto' then null else esito_data end,
    esito_nota = case when p_stato = 'aperto' then null else esito_nota end,
    esito_il = case when p_stato = 'aperto' then null else esito_il end,
    esito_da = case when p_stato = 'aperto' then null else esito_da end,
    esito_pagare = case when p_stato = 'aperto' then null else esito_pagare end,
    esito_pagare_motivo = case when p_stato = 'aperto' then null else esito_pagare_motivo end,
    esito_pagare_il = case when p_stato = 'aperto' then null else esito_pagare_il end,
    esito_pagare_da = case when p_stato = 'aperto' then null else esito_pagare_da end
  where id = p_id;
end; $function$;

commit;
