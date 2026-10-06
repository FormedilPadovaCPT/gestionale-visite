-- 06/10/2026 — LE ETICHETTE DEI CANTIERI PERDONO IL PREFISSO «CANTIERE DI» (deciso dall'utente)
-- L'importazione dalla Cassa Edile scriveva l'etichetta come «CANTIERE DI  VIA BUSA 3 PAGANO CLAUDIO CNCEC901267»,
-- troncata a 50 caratteri. L'etichetta è il dato che Formedil chiede per l'Osservatorio (cantiereEtichetta) ed è
-- quello che il gestionale mostra negli elenchi al posto dell'indirizzo: il prefisso non dice niente e ruba spazio.
-- Si toglie solo il prefisso iniziale e si normalizzano gli spazi doppi; il testo troncato resta com'è, perché
-- l'originale non c'è più. Le etichette che non cominciano così (descrizioni dei lavori, indirizzi dei tecnici) e
-- le 4 che hanno «cantiere» in mezzo al testo non si toccano.
-- Traccia (regola d'oro 7): copia in archivio.bk_2026_10_06_cantieri_etichette e una riga per cantiere in
-- public.cantieri_correzioni (prima/dopo).

begin;

create table archivio.bk_2026_10_06_cantieri_etichette as
  select cantiere_id, cantiere_etichetta, now() as copiato_il
    from public.cantieri
   where cantiere_etichetta ~* '^\s*cantiere\s+di\s+';

with p as (
  select cantiere_id, cantiere_etichetta as prima,
         regexp_replace(btrim(regexp_replace(cantiere_etichetta, '^\s*cantiere\s+di\s+', '', 'i')), '\s+', ' ', 'g') as dopo
    from public.cantieri
   where cantiere_etichetta ~* '^\s*cantiere\s+di\s+'
)
insert into public.cantieri_correzioni (cantiere_id, campo, prima, dopo, origine, fatto_da)
select cantiere_id, 'cantiere_etichetta', prima, dopo,
       'etichette: tolto il prefisso «CANTIERE DI» dell''importazione Cassa (06/10/2026, deciso dall''utente)',
       'segreteria, da riga di comando'
  from p
 where dopo <> '' and dopo <> prima;

update public.cantieri c
   set cantiere_etichetta = regexp_replace(btrim(regexp_replace(cantiere_etichetta, '^\s*cantiere\s+di\s+', '', 'i')), '\s+', ' ', 'g')
 where cantiere_etichetta ~* '^\s*cantiere\s+di\s+'
   and btrim(regexp_replace(cantiere_etichetta, '^\s*cantiere\s+di\s+', '', 'i')) <> '';

select jsonb_build_object(
  'copiate', (select count(*) from archivio.bk_2026_10_06_cantieri_etichette),
  'corrette', (select count(*) from public.cantieri_correzioni where origine like 'etichette: tolto il prefisso%'),
  'restano_col_prefisso', (select count(*) from public.cantieri where cantiere_etichetta ~* '^\s*cantiere\s+di\s+'),
  'esempio', (select jsonb_build_array(prima, dopo) from public.cantieri_correzioni where origine like 'etichette: tolto il prefisso%' limit 1)
) as esito;

commit;
