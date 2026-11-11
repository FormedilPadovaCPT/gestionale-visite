-- 2026_11_11_persone_cf_solo_se_vuoto.sql
-- (11/11/2026, deciso dall'utente) Il codice fiscale di una persona: il tecnico lo SCRIVE dove manca
-- (scheda nuova o scheda senza), ma CAMBIARE o CANCELLARE un codice già scritto resta della segreteria.
-- La pagina del gestionale lo rispetta (persone-omonimi.js, cfScrivibile); questo trigger fa sì che lo
-- rispetti anche chi scrive senza passare dalla pagina. Le funzioni di servizio (auth.uid() nullo,
-- service role) non sono toccate.
-- Il nome comincia con «0z» per girare DOPO trg_persone_0_norm_cf: si confronta il codice già normalizzato.

create or replace function public.tg_persone_cf_solo_se_vuoto()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(old.cf, '') <> ''
     and coalesce(new.cf, '') is distinct from coalesce(old.cf, '')
     and auth.uid() is not null
     and not public.is_segreteria() then
    raise exception 'Il codice fiscale di questa persona è già scritto: lo cambia solo la segreteria.'
      using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function public.tg_persone_cf_solo_se_vuoto() from public, anon;

drop trigger if exists trg_persone_0z_cf_solo_se_vuoto on public.persone;
create trigger trg_persone_0z_cf_solo_se_vuoto
  before update of cf on public.persone
  for each row execute function public.tg_persone_cf_solo_se_vuoto();
