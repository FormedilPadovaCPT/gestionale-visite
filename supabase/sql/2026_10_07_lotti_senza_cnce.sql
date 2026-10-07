-- 07/10/2026 — I LOTTI VALGONO PER TUTTI I CANTIERI, NON SOLO PER QUELLI CON IL CNCE (precisato dall'utente)
-- Il pulsante «🧩 Ha più lotti» c'era già su ogni cantiere, ma senza CNCE i lotti si riconoscevano come fratelli
-- solo dallo stesso indirizzo+civico+comune: correggendo l'indirizzo di un lotto («Modifica cantiere») quel lotto
-- spariva dall'elenco degli altri. Ora ogni copia ricorda da quale scheda è nata:
--   · cantieri.lotto_di = id della scheda di partenza del complesso (vuoto sulla scheda di partenza e su tutti gli
--     altri cantieri). La copia di una copia punta sempre alla prima, così il complesso ha una radice sola.
--   · lotti_del_cantiere: stesso complesso (lotto_di), oppure stesso CNCE, oppure senza CNCE stesso indirizzo.
-- Il vincolo: lotto_di deve puntare a un cantiere che esiste (on delete set null: se la segreteria elimina la
-- scheda di partenza i lotti restano, solo senza radice).

begin;

alter table public.cantieri add column if not exists lotto_di text references public.cantieri(cantiere_id) on delete set null;
comment on column public.cantieri.lotto_di is 'Lotti (07/10/2026): id della scheda di partenza del complesso da cui il lotto è stato copiato con «Ha più lotti». Vuoto sulla scheda di partenza.';
create index if not exists idx_cantieri_lotto_di on public.cantieri (lotto_di) where lotto_di is not null;

-- le copie già fatte (nessuna in produzione al 07/10, ma la regola vale anche per loro): la radice si legge dal registro
update public.cantieri k set lotto_di = substring(cc.origine from 'copia di (.+)$')
  from public.cantieri_correzioni cc
 where cc.cantiere_id = k.cantiere_id and cc.origine like 'lotto creato dal verbale come copia di %' and k.lotto_di is null;

create or replace function public.lotti_del_cantiere(p_cantiere_id text)
returns table (cantiere_id text, lotto text, etichetta text, indirizzo text, civico text, comune text,
               visite bigint, ultima_visita date, ultima_impresa text, copia boolean)
language sql stable security definer
set search_path to 'public'
as $$
  -- security definer: il tecnico che vede solo le sue visite deve comunque sapere quanti verbali ha ogni lotto e
  -- con quale impresa, per scegliere quello giusto; restituisce solo conteggi, data e nome dell'impresa principale
  with c as (select k.*, coalesce(k.lotto_di, k.cantiere_id) as radice from public.cantieri k
              where k.cantiere_id = p_cantiere_id
                and ((coalesce(public.is_personale(), false)) or session_user = 'postgres')),
  fr as (
    select k.* from public.cantieri k, c
     where coalesce(k.elimina, 0) = 0
       and (k.cantiere_id = c.cantiere_id
            or coalesce(k.lotto_di, k.cantiere_id) = c.radice
            or (c.cantiere_cnce ilike 'CNCE%' and upper(k.cantiere_cnce) = upper(c.cantiere_cnce))
            or (coalesce(c.cantiere_cnce, '') !~* '^CNCE'
                and lower(regexp_replace(btrim(k.cantiere_indirizzo), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(c.cantiere_indirizzo), '\s+', ' ', 'g'))
                and lower(btrim(k.cantiere_civico)) = lower(btrim(c.cantiere_civico))
                and lower(btrim(coalesce(k.comune_nome, ''))) = lower(btrim(coalesce(c.comune_nome, ''))))))
  select fr.cantiere_id, fr.lotto, fr.cantiere_etichetta, fr.cantiere_indirizzo, fr.cantiere_civico, fr.comune_nome,
         (select count(*) from public.visite v where v.cantiere_id = fr.cantiere_id and v.elimina = 0),
         (select max(v.data_visita) from public.visite v where v.cantiere_id = fr.cantiere_id and v.elimina = 0),
         (select i.impresa_nome from public.visite v left join public.imprese i on i.impresa_id = v.impresa_id
           where v.cantiere_id = fr.cantiere_id and v.elimina = 0 order by v.data_visita desc nulls last limit 1),
         exists (select 1 from public.cantieri_correzioni cc where cc.cantiere_id = fr.cantiere_id and cc.origine like 'lotto creato dal verbale%')
    from fr
   order by (fr.lotto is null), case when fr.lotto ~ '^\d+$' then lpad(fr.lotto, 6, '0') else lower(fr.lotto) end
$$;
revoke execute on function public.lotti_del_cantiere(text) from public, anon;
grant execute on function public.lotti_del_cantiere(text) to authenticated;

create or replace function public.crea_lotto_cantiere(p_cantiere_id text, p_lotto_qui text, p_lotto_nuovo text default null)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  c public.cantieri;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
  qui text := nullif(regexp_replace(btrim(coalesce(p_lotto_qui, '')), '\s+', ' ', 'g'), '');
  nuovo text := nullif(regexp_replace(btrim(coalesce(p_lotto_nuovo, '')), '\s+', ' ', 'g'), '');
  et_prima text;
  j jsonb;
  nuovo_id text;
begin
  if not ((coalesce(public.is_personale(), false) and not coalesce(public.is_viewer(), false)) or session_user = 'postgres') then
    raise exception 'Dividere un cantiere in lotti spetta a chi fa le visite';
  end if;
  select * into c from public.cantieri where cantiere_id = p_cantiere_id for update;
  if not found or coalesce(c.elimina, 0) <> 0 then raise exception 'Cantiere % non trovato', p_cantiere_id; end if;
  if length(coalesce(qui, '')) > 30 or length(coalesce(nuovo, '')) > 30 then raise exception 'Il nome del lotto è troppo lungo: bastano poche lettere (1, 2, A, Palazzina B)'; end if;

  -- 1. la scheda di partenza prende il suo lotto, se non ce l'ha
  if coalesce(btrim(c.lotto), '') = '' then
    if qui is null then raise exception 'Scrivi il nome del lotto di questa scheda (per esempio 1)'; end if;
    if exists (select 1 from public.lotti_del_cantiere(p_cantiere_id) l where l.cantiere_id <> c.cantiere_id and lower(l.lotto) = lower(qui)) then
      raise exception 'Il lotto «%» c''è già in questo complesso', qui;
    end if;
    et_prima := c.cantiere_etichetta;
    update public.cantieri set lotto = qui,
           cantiere_etichetta = public.etichetta_con_lotto(c.cantiere_etichetta, c.cantiere_indirizzo, c.cantiere_civico, qui)
     where cantiere_id = c.cantiere_id
     returning * into c;
    insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da) values
      (c.cantiere_id, 'lotto', null, qui, 'lotto dato dal verbale alla scheda di partenza', chi),
      (c.cantiere_id, 'cantiere_etichetta', et_prima, c.cantiere_etichetta, 'lotto dato dal verbale alla scheda di partenza', chi);
  end if;

  if nuovo is null then
    return jsonb_build_object('ok', true, 'cantiere_id', c.cantiere_id, 'creato', false, 'lotto', c.lotto);
  end if;

  -- 2. la copia identica, col suo lotto e con la radice del complesso
  if exists (select 1 from public.lotti_del_cantiere(p_cantiere_id) l where lower(coalesce(l.lotto, '')) = lower(nuovo)) then
    raise exception 'Il lotto «%» c''è già in questo complesso: sceglilo dall''elenco', nuovo;
  end if;
  nuovo_id := gen_random_uuid()::text;
  j := to_jsonb(c) || jsonb_build_object(
         'cantiere_id', nuovo_id, 'lotto', nuovo, 'lotto_di', coalesce(c.lotto_di, c.cantiere_id),
         'cantiere_etichetta', public.etichetta_con_lotto(c.cantiere_etichetta, c.cantiere_indirizzo, c.cantiere_civico, nuovo),
         'nodo_id', null, 'prot_int', null, 'elimina', 0,
         'created_at', now(), 'updated_at', now(),
         'cantiere_chiuso', false, 'data_chiusura', null, 'chiuso_da', null, 'motivo_chiusura', null, 'note_chiusura', null);
  insert into public.cantieri select * from jsonb_populate_record(null::public.cantieri, j);
  insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da)
  values (nuovo_id, 'lotto', null, nuovo, 'lotto creato dal verbale come copia di ' || c.cantiere_id, chi);
  return jsonb_build_object('ok', true, 'cantiere_id', nuovo_id, 'creato', true, 'lotto', nuovo, 'lotto_partenza', c.lotto);
end $$;
revoke execute on function public.crea_lotto_cantiere(text, text, text) from public, anon;
grant execute on function public.crea_lotto_cantiere(text, text, text) to authenticated;

commit;
