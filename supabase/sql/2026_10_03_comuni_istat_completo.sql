-- 03/10/2026 (terzo giro) — comuni_istat diventa l'elenco ISTAT dei comuni italiani, e i comuni soppressi
-- portano il codice del tempo (migrazione comuni_istat_completo_e_soppressi_2026_10_03, già applicata).
--
-- Deciso dall'utente: (1) sì all'elenco completo dell'ISTAT; (2) i comuni soppressi «devono avere il codice
-- del tempo in cui è stato fatto il verbale».
--
-- · comuni_istat: colonne prov, regione, fonte, soppresso_il, cod_attuale. Un comune soppresso tiene il SUO
--   codice in cod e quello del comune in cui è confluito in cod_attuale: fino al giorno prima di soppresso_il
--   vale cod, da quel giorno vale cod_attuale.
--     Santa Caterina d'Este (028108) dal 22/01/2024: Carceri (028022), Vighizzolo d'Este (028098)
--     Borgo Veneto (028107) dal 17/02/2018: Megliadino San Fidenzio (028051), Saletto (028074),
--                                            Santa Margherita d'Adige (028081)
-- · calcola_comune_cod_al(comune, data): il codice a una data. calcola_comune_cod(comune) = quello di oggi
--   (lo usa il trigger cantiere_autofill sui cantieri nuovi).
-- · cantieri dei comuni soppressi: codice valido alla data dell'ultima visita (copia di prima in
--   archivio.bk_2026_10_03b_cantieri_comune_cod). In pratica: 3 cantieri di Vighizzolo d'Este 028098 → 028108
--   (visitati nel 2024, dopo la fusione, o mai); i 4 di Carceri erano già a 028108.
-- · osservatorio_controllo: avviso «comune-soppresso» se il codice del cantiere non è quello valido alla data
--   delle visite del periodo (vedi 2026_10_03_osservatorio_controllo.sql).
-- · L'elenco completo lo carica supabase/dati/carica_comuni_istat.sql (workflow «Carica comuni ISTAT»).

alter table public.comuni_istat
  add column if not exists prov text,
  add column if not exists regione text,
  add column if not exists soppresso_il date,
  add column if not exists cod_attuale text,
  add column if not exists fonte text;
create index if not exists comuni_istat_nome_norm_idx on public.comuni_istat (nome_norm);
alter table public.comuni_istat drop constraint if exists comuni_istat_soppresso_chk;
alter table public.comuni_istat add constraint comuni_istat_soppresso_chk
  check ((soppresso_il is null and cod_attuale is null) or (soppresso_il is not null and cod_attuale ~ '^[0-9]{6}$'));

insert into public.comuni_istat (nome, cod) select 'Carceri', '028022' where not exists (select 1 from public.comuni_istat where nome = 'Carceri');
update public.comuni_istat set cod = '028022', soppresso_il = date '2024-01-22', cod_attuale = '028108', prov = 'PD', regione = 'Veneto', fonte = 'comune soppresso: fusione in Santa Caterina d''Este' where nome = 'Carceri';
update public.comuni_istat set soppresso_il = date '2024-01-22', cod_attuale = '028108', prov = 'PD', regione = 'Veneto', fonte = 'comune soppresso: fusione in Santa Caterina d''Este' where nome = 'Vighizzolo d''Este' and cod = '028098';
update public.comuni_istat set soppresso_il = date '2018-02-17', cod_attuale = '028107', prov = 'PD', regione = 'Veneto', fonte = 'comune soppresso: fusione in Borgo Veneto'
 where (nome, cod) in (('Megliadino San Fidenzio', '028051'), ('Saletto', '028074'), ('Santa Margherita d''Adige', '028081'));

create or replace function public.calcola_comune_cod_al(p_comune text, p_data date)
returns text language sql stable set search_path = public as $$
  select case when i.soppresso_il is not null and coalesce(p_data, current_date) >= i.soppresso_il then i.cod_attuale else i.cod end
    from public.comuni_istat i
   where i.nome_norm = btrim(regexp_replace(upper(translate(btrim(p_comune),'àèéìòùÀÈÉÌÒÙ','AEEIOUAEEIOU')),'[^A-Z0-9]+',' ','g'))
   limit 1
$$;
revoke execute on function public.calcola_comune_cod_al(text, date) from public, anon;
grant execute on function public.calcola_comune_cod_al(text, date) to authenticated, service_role;

create or replace function public.calcola_comune_cod(p_comune text)
returns text language sql stable set search_path = public as $$
  select public.calcola_comune_cod_al(p_comune, current_date)
$$;

create table if not exists archivio.bk_2026_10_03b_cantieri_comune_cod as
select c.cantiere_id, c.comune_nome, c.cantiere_comune_cod, now() as copiato_il
  from public.cantieri c
  join public.comuni_istat i on i.nome_norm = btrim(regexp_replace(upper(translate(btrim(c.comune_nome),'àèéìòùÀÈÉÌÒÙ','AEEIOUAEEIOU')),'[^A-Z0-9]+',' ','g'))
 where i.soppresso_il is not null;
revoke all on archivio.bk_2026_10_03b_cantieri_comune_cod from public, anon, authenticated;
update public.cantieri c
   set cantiere_comune_cod = public.calcola_comune_cod_al(c.comune_nome,
         coalesce((select max(v.data_visita) from public.visite v where v.cantiere_id = c.cantiere_id and v.elimina = 0), current_date))
 where c.cantiere_id in (select cantiere_id from archivio.bk_2026_10_03b_cantieri_comune_cod)
   and c.cantiere_comune_cod is distinct from public.calcola_comune_cod_al(c.comune_nome,
         coalesce((select max(v.data_visita) from public.visite v where v.cantiere_id = c.cantiere_id and v.elimina = 0), current_date));
