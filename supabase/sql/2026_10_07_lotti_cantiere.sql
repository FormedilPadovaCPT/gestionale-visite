-- 07/10/2026 — LOTTI DEL CANTIERE GUIDATI DAL VERBALE (deciso dall'utente)
-- Il tecnico parte dal cantiere CNCE caricato dalla lista della Cassa e scopre sul posto che il complesso ha più
-- lotti. Con «🧩 Ha più lotti» la scheda di partenza diventa uno dei lotti (nome proposto «1») e, se oggi è in un
-- altro lotto, nasce una COPIA IDENTICA della scheda (indirizzo, comune, CNCE, committente, intervento, opera,
-- importo e durata compresi: «uguali», deciso dall'utente) con il suo nome di lotto. Le imprese stanno sulla visita,
-- non sul cantiere: ogni lotto ha le sue. Lo fa il tecnico (deciso dall'utente): l'operazione non cancella niente
-- e resta scritta in cantieri_correzioni.
--   · etichetta_con_lotto(etichetta, indirizzo, civico, lotto): «… – lotto 2», al massimo 50 caratteri. Per
--     Formedil il cantiere è comune+indirizzo+civico+etichetta: due lotti con la stessa etichetta sarebbero uno solo.
--   · crea_lotto_cantiere(cantiere, lotto_di_questa_scheda, lotto_nuovo): la scheda prende il suo lotto se non ne ha
--     uno; con lotto_nuovo crea la copia e ne restituisce l'id.
--   · lotti_del_cantiere(cantiere): i lotti dello stesso complesso (stesso CNCE; senza CNCE, stesso indirizzo,
--     civico e comune), con le visite e l'ultima impresa principale: la scelta del tecnico alle visite dopo.
--   · togli_lotto_cantiere(cantiere): toglie un lotto creato per sbaglio, solo se è una copia fatta da qui e non ha
--     niente collegato. È una cancellazione vera: una scheda vuota appena nata non ha storia, ma la riga intera resta
--     scritta in cantieri_correzioni.
-- Più la sistemazione dei 9 cantieri che avevano già il lotto (lotto scritto anche nell'indirizzo, etichette vuote).

begin;

create or replace function public.etichetta_con_lotto(p_et text, p_ind text, p_civ text, p_lotto text)
returns text
language sql immutable
set search_path to 'public'
as $$
  with b as (
    select coalesce(
             nullif(btrim(regexp_replace(coalesce(p_et, ''), '\s*[–-]?\s*\(?\s*lott[oi]\M.*$', '', 'i')), ''),
             btrim(concat_ws(' ', regexp_replace(btrim(coalesce(p_ind, '')), '\s+', ' ', 'g'),
                   case when btrim(coalesce(p_civ, '')) ~* '^s\.?\s*n\.?\s*c?\.?$' then null else nullif(btrim(p_civ), '') end))
           ) as base,
           ' – lotto ' || btrim(coalesce(p_lotto, '')) as coda
  )
  select case when btrim(coalesce(p_lotto, '')) = '' then nullif(left(base, 50), '')
              else btrim(left(base, greatest(8, 50 - length(coda)))) || coda end
    from b
$$;

-- i lotti dello stesso complesso
create or replace function public.lotti_del_cantiere(p_cantiere_id text)
returns table (cantiere_id text, lotto text, etichetta text, indirizzo text, civico text, comune text,
               visite bigint, ultima_visita date, ultima_impresa text, copia boolean)
language sql stable security definer
set search_path to 'public'
as $$
  -- security definer: il tecnico che vede solo le sue visite deve comunque sapere quanti verbali ha ogni lotto e
  -- con quale impresa, per scegliere quello giusto; restituisce solo conteggi, data e nome dell'impresa principale
  with c as (select * from public.cantieri where cantiere_id = p_cantiere_id
              and ((coalesce(public.is_personale(), false)) or session_user = 'postgres')),
  fr as (
    select k.* from public.cantieri k, c
     where coalesce(k.elimina, 0) = 0
       and (k.cantiere_id = c.cantiere_id
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

  -- 2. la copia identica, col suo lotto
  if exists (select 1 from public.lotti_del_cantiere(p_cantiere_id) l where lower(coalesce(l.lotto, '')) = lower(nuovo)) then
    raise exception 'Il lotto «%» c''è già in questo complesso: sceglilo dall''elenco', nuovo;
  end if;
  nuovo_id := gen_random_uuid()::text;
  j := to_jsonb(c) || jsonb_build_object(
         'cantiere_id', nuovo_id, 'lotto', nuovo,
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

create or replace function public.togli_lotto_cantiere(p_cantiere_id text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  c public.cantieri;
  chi text := coalesce(auth.jwt() ->> 'email', 'sistema (' || session_user || ')');
begin
  if not ((coalesce(public.is_personale(), false) and not coalesce(public.is_viewer(), false)) or session_user = 'postgres') then
    raise exception 'Togliere un lotto spetta a chi fa le visite';
  end if;
  select * into c from public.cantieri where cantiere_id = p_cantiere_id for update;
  if not found then raise exception 'Cantiere % non trovato', p_cantiere_id; end if;
  if not exists (select 1 from public.cantieri_correzioni cc where cc.cantiere_id = p_cantiere_id and cc.origine like 'lotto creato dal verbale%') then
    raise exception 'Si toglie solo un lotto creato da «Ha più lotti»: questa scheda ha una storia sua, la toglie la segreteria';
  end if;
  if exists (select 1 from public.visite v where v.cantiere_id = p_cantiere_id) then
    raise exception 'Il lotto % ha già delle visite: non si toglie', coalesce(c.lotto, '');
  end if;
  insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da)
  values (p_cantiere_id, 'scheda', to_jsonb(c)::text, null, 'lotto tolto dal verbale (creato per sbaglio)', chi);
  begin
    delete from public.cantieri where cantiere_id = p_cantiere_id;
  exception when foreign_key_violation then
    raise exception 'Il lotto % ha già qualcosa collegato (incarico, segnalazione…): non si toglie', coalesce(c.lotto, '');
  end;
  return jsonb_build_object('ok', true, 'lotto', c.lotto);
end $$;
revoke execute on function public.togli_lotto_cantiere(text) from public, anon;
grant execute on function public.togli_lotto_cantiere(text) to authenticated;

-- ── i 9 cantieri che avevano già il lotto: lotto fuori dall'indirizzo, etichetta col lotto ──
create table if not exists archivio.bk_2026_10_07_cantieri_lotti as
  select * from public.cantieri where coalesce(btrim(lotto), '') <> '' and coalesce(elimina, 0) = 0;

with nuovi (cantiere_id, ind, et) as (values
  ('V2526C-78bf2b5329ca', 'VIA GIOVANNI BOCCACCIO', 'Via Boccaccio PADOVA - lotto 2 (Furlan)'),
  ('XLSC-798', 'VIA GIOVANNI BOCCACCIO', null),
  ('06c5c5cc-cd53-44e4-bc1e-ae4afa1ad925', 'Via Sturzo', 'Via Sturzo – lotto 2'),
  ('e9b3807d-b22e-4b47-8068-8a042e0e894b', 'Via G. Guareschi', 'Via G. Guareschi – lotto A'),
  ('V2526C-7d63d144a1f8', null, 'Via Milano 10 – lotto eden 2'),
  ('CNCEC9012480213', null, 'VIA MILANO SNC LDM HOME SRL – lotto eden 3')
), diff as (
  select n.cantiere_id, 'cantiere_indirizzo' as campo, c.cantiere_indirizzo as prima, n.ind as dopo
    from nuovi n join public.cantieri c using (cantiere_id) where n.ind is not null and n.ind is distinct from c.cantiere_indirizzo
  union all
  select n.cantiere_id, 'cantiere_etichetta', c.cantiere_etichetta, n.et
    from nuovi n join public.cantieri c using (cantiere_id) where n.et is not null and n.et is distinct from c.cantiere_etichetta
), reg as (
  insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da)
  select cantiere_id, campo, prima, dopo, 'lotti: lotto tolto dall''indirizzo, etichetta col lotto (07/10/2026, deciso dall''utente)', 'segreteria, da riga di comando'
    from diff returning 1
)
update public.cantieri c
   set cantiere_indirizzo = coalesce(n.ind, c.cantiere_indirizzo),
       cantiere_etichetta = coalesce(n.et, c.cantiere_etichetta)
  from nuovi n
 where n.cantiere_id = c.cantiere_id;

select jsonb_build_object(
  'prova_etichetta', jsonb_build_array(
     public.etichetta_con_lotto('Via Boccaccio PADOVA - lotto 5 (Furlan)', 'x', 'snc', '6'),
     public.etichetta_con_lotto(null, 'Via Roma', '12', '2'),
     public.etichetta_con_lotto('VIA G. VERDI SNC AUTOSTORE SRL CNCEC9', 'VIA G. VERDI', 'SNC', '1')),
  'lotti_boccaccio', (select count(*) from public.lotti_del_cantiere('7533')),
  'corretti', (select count(*) from public.cantieri_correzioni where origine like 'lotti: lotto tolto%'),
  'copiati', (select count(*) from archivio.bk_2026_10_07_cantieri_lotti)
) as esito;

commit;
