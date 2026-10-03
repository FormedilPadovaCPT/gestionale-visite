-- 03/10/2026 (sera) — IMPRESE CHE HANNO L'INDIRIZZO E-MAIL DI UN'ALTRA IMPRESA: l'elenco per la segreteria.
--
-- Dal verbale CPT/26_27/0003 (l'indirizzo dell'impresa principale finito nelle schede di due
-- lavoratori autonomi). Chiesto dall'utente: «bisognerà controllare se esistono imprese che hanno
-- mail di altre imprese».
--
-- Come si riconoscono (il dominio diverso dalla ragione sociale, da solo, non basta: 1.205 indirizzi
-- su 4.435 non somigliano al nome dell'impresa — marchi, sigle, studi):
--   1. lo stesso indirizzo sta su due o più imprese con partita IVA diversa;
--   2. l'indirizzo SOMIGLIA al nome di una di loro e non a quello delle altre: le altre sono sospette
--      (se somiglia a tutte sono società della stessa famiglia; se a nessuna è uno studio che fa da
--      recapito: non entrano nell'elenco);
--   3. si dice che cosa risulta alla Cassa Edile (ceiv_lista): se l'impresa ha dichiarato lo stesso
--      indirizzo alla Cassa non è un errore nostro.
-- Al 03/10/2026: 96 imprese sospette, 30 con lo stesso indirizzo anche alla Cassa.
--
-- La somiglianza è un indizio, non una prova: qui non si corregge niente da soli. La segreteria
-- decide riga per riga (impresa_mail_decidi) e ogni decisione resta scritta, con l'indirizzo tolto.

create table if not exists public.imprese_mail_decisioni (
  id         bigint generated always as identity primary key,
  impresa_id text not null,
  mail       text not null,
  decisione  text not null check (decisione in ('tolto', 'sostituito', 'confermato')),
  nuova_mail text,
  decisa_da  text,
  decisa_il  timestamptz not null default now()
);
create index if not exists imprese_mail_decisioni_impresa on public.imprese_mail_decisioni (impresa_id, mail);
alter table public.imprese_mail_decisioni enable row level security;
drop policy if exists imprese_mail_decisioni_sel on public.imprese_mail_decisioni;
create policy imprese_mail_decisioni_sel on public.imprese_mail_decisioni
  for select to authenticated using ((select public.is_segreteria()));
-- «authenticated» riceve tutti i permessi in automatico sulle tabelle nuove: vanno tolti, o resta
-- la sola RLS a impedire le scritture
revoke all on public.imprese_mail_decisioni from public, anon, authenticated;
grant select on public.imprese_mail_decisioni to authenticated;
comment on table public.imprese_mail_decisioni is
  'Che cosa ha deciso la segreteria sugli indirizzi e-mail sospetti delle imprese (03/10/2026). Si scrive solo da impresa_mail_decidi.';

-- l'indirizzo che l'impresa ha nella lista della Cassa Edile (il più recente fra le righe che ne hanno uno)
create or replace function public._ceiv_mail(p_piva text, p_cf text)
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select lower(trim(l.email))
    from public.ceiv_lista l
   where coalesce(trim(l.email), '') like '%@%'
     and (   (nullif(trim(p_piva), '') is not null and l.piva = trim(p_piva))
          or (coalesce(nullif(trim(p_cf), ''), nullif(trim(p_piva), '')) is not null
              and l.cf = coalesce(nullif(trim(p_cf), ''), nullif(trim(p_piva), ''))))
   order by l.aggiornata_il desc nulls last
   limit 1
$fn$;
revoke all on function public._ceiv_mail(text, text) from public, anon, authenticated;

create or replace function public.imprese_mail_di_altri()
returns table (
  impresa_id          text,
  impresa_nome        text,
  piva                text,
  comune              text,
  colonna             text,
  mail                text,
  titolare_id         text,
  titolare_nome       text,
  condivisa_con       integer,
  in_cassa            boolean,
  mail_cassa          text,
  stessa_della_cassa  boolean,
  n_visite            bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
begin
  if not public.is_segreteria() then
    raise exception 'Riservato alla segreteria.' using errcode = '42501';
  end if;
  return query
  with parole_comuni(s) as (values
    ('costruzioni'),('edile'),('edili'),('edilizia'),('impresa'),('societa'),('geom'),('fratelli'),('figli'),
    ('group'),('gruppo'),('restauri'),('impianti'),('servizi'),('scavi'),('lavori'),('snc'),('sas'),('srls'),
    ('soc'),('coop'),('cooperativa'),('italia'),('veneta'),('veneto'),('padova'),('immobiliare'),('general'),
    ('generali'),('strade'),('stradali')),
  m as (
    select i.impresa_id, i.impresa_nome, nullif(trim(i.piva), '') as piva, nullif(trim(i.impresa_cf), '') as cf, i.comune,
           coalesce(nullif(trim(i.piva), ''), nullif(trim(i.impresa_cf), ''), i.impresa_id) as sogg,
           (array['impresa_email_ref', 'impresa_email2', 'impresa_email3'])[u.pos::int] as colonna,
           lower(trim(u.e)) as mail
      from public.imprese i
     cross join lateral unnest(array[i.impresa_email_ref, i.impresa_email2, i.impresa_email3]) with ordinality as u(e, pos)
     where coalesce(i.elimina, 0) = 0 and coalesce(trim(u.e), '') like '%@%'
  ),
  mm as (
    select q.*,
           exists (
             select 1
               from regexp_split_to_table(lower(regexp_replace(q.impresa_nome, '[^A-Za-z0-9 ]', ' ', 'g')), '\s+') t
              where length(t) >= 4 and t not in (select s from parole_comuni)
                and (q.et like '%' || t || '%' or (length(q.et) >= 4 and t like '%' || q.et || '%') or q.lo like '%' || t || '%')
           ) as somiglia
      from (select m.*,
                   regexp_replace(split_part(split_part(m.mail, '@', 2), '.', 1), '[^a-z0-9]', '', 'g') as et,
                   regexp_replace(split_part(m.mail, '@', 1), '[^a-z0-9]', '', 'g') as lo
              from m) q
  ),
  g as (
    select mm.mail, count(distinct mm.impresa_id) as n, count(distinct mm.impresa_id) filter (where mm.somiglia) as n_som
      from mm group by mm.mail having count(distinct mm.sogg) > 1
  )
  select x.impresa_id, x.impresa_nome, x.piva, x.comune, x.colonna, x.mail,
         tit.impresa_id, tit.impresa_nome, (g.n - 1)::integer,
         c.in_cassa, c.mail_cassa, coalesce(c.mail_cassa = x.mail, false),
         (select count(distinct p.visita_id) from public.visite_imprese_presenti p where p.impresa_id = x.impresa_id)
    from mm x
    join g on g.mail = x.mail
   cross join lateral (select y.impresa_id, y.impresa_nome from mm y where y.mail = x.mail and y.somiglia order by y.impresa_id limit 1) tit
   cross join lateral (
     select exists (select 1 from public.ceiv_lista l
                     where (x.piva is not null and l.piva = x.piva)
                        or (coalesce(x.cf, x.piva) is not null and l.cf = coalesce(x.cf, x.piva))) as in_cassa,
            public._ceiv_mail(x.piva, x.cf) as mail_cassa
   ) c
   where g.n_som between 1 and g.n - 1
     and not x.somiglia
     and not exists (select 1 from public.imprese_mail_decisioni d
                      where d.impresa_id = x.impresa_id and d.mail = x.mail and d.decisione = 'confermato')
   order by coalesce(c.mail_cassa = x.mail, false), x.impresa_nome, x.mail;
end
$fn$;
revoke all on function public.imprese_mail_di_altri() from public, anon;
grant execute on function public.imprese_mail_di_altri() to authenticated;

-- La decisione su una riga: «togli» l'indirizzo, metti al suo posto quello della «cassa», oppure
-- «conferma» che è giusto così (la riga esce dall'elenco). Solo la segreteria; tutto resta scritto.
create or replace function public.impresa_mail_decidi(p_impresa_id text, p_mail text, p_decisione text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r       public.imprese%rowtype;
  v_mail  text := lower(trim(coalesce(p_mail, '')));
  v_nuova text;
  a text; b text; c text;
  messo   boolean := true;   -- vero = non c'è (più) un indirizzo nuovo da mettere
  chi     text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.is_segreteria() then
    raise exception 'Riservato alla segreteria.' using errcode = '42501';
  end if;
  if p_decisione is null or p_decisione not in ('togli', 'cassa', 'conferma') then
    raise exception 'Decisione non prevista: %', coalesce(p_decisione, '(vuota)') using errcode = '22023';
  end if;
  select * into r from public.imprese where impresa_id = p_impresa_id for update;
  if not found then
    raise exception 'Impresa % non trovata.', p_impresa_id using errcode = 'P0002';
  end if;
  a := r.impresa_email_ref; b := r.impresa_email2; c := r.impresa_email3;
  if v_mail = '' or v_mail not in (lower(trim(coalesce(a, ''))), lower(trim(coalesce(b, ''))), lower(trim(coalesce(c, '')))) then
    raise exception 'L''impresa non ha (più) l''indirizzo %: ricarica l''elenco.', coalesce(p_mail, '(vuoto)') using errcode = 'P0001';
  end if;

  if p_decisione = 'conferma' then
    insert into public.imprese_mail_decisioni (impresa_id, mail, decisione, decisa_da)
    values (p_impresa_id, v_mail, 'confermato', chi);
    return jsonb_build_object('ok', true, 'decisione', 'confermato');
  end if;

  if p_decisione = 'cassa' then
    v_nuova := public._ceiv_mail(r.piva, r.impresa_cf);
    if v_nuova is null or v_nuova = v_mail then
      raise exception 'La lista della Cassa Edile non ha un indirizzo diverso per questa impresa.' using errcode = 'P0001';
    end if;
    -- se l'impresa ha già quell'indirizzo in un altro campo, basta togliere quello sbagliato
    messo := v_nuova in (lower(trim(coalesce(a, ''))), lower(trim(coalesce(b, ''))), lower(trim(coalesce(c, ''))));
  end if;

  if lower(trim(coalesce(a, ''))) = v_mail then if messo then a := null; else a := v_nuova; messo := true; end if; end if;
  if lower(trim(coalesce(b, ''))) = v_mail then if messo then b := null; else b := v_nuova; messo := true; end if; end if;
  if lower(trim(coalesce(c, ''))) = v_mail then if messo then c := null; else c := v_nuova; messo := true; end if; end if;

  update public.imprese set impresa_email_ref = a, impresa_email2 = b, impresa_email3 = c where impresa_id = p_impresa_id;
  insert into public.imprese_mail_decisioni (impresa_id, mail, decisione, nuova_mail, decisa_da)
  values (p_impresa_id, v_mail, case when p_decisione = 'cassa' then 'sostituito' else 'tolto' end, v_nuova, chi);
  return jsonb_build_object('ok', true, 'decisione', case when p_decisione = 'cassa' then 'sostituito' else 'tolto' end, 'nuova_mail', v_nuova);
end
$fn$;
revoke all on function public.impresa_mail_decidi(text, text, text) from public, anon;
grant execute on function public.impresa_mail_decidi(text, text, text) to authenticated;
