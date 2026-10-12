-- (12/10/2026, chiesto dall'utente) «Verbale non consegnato»: il più delle volte l'indirizzo è
-- scritto male. Dal riquadro del tecnico si corregge l'indirizzo DOVE STA — sulla visita e in
-- anagrafica — e poi si ritrasmette il verbale solo a quello giusto.
--
-- Dove può stare l'indirizzo respinto (verificato sul database il 12/10):
--   visite         comm_email, rl_email, csp_email, cse_email, email_coor  (SOLO la visita del rimbalzo:
--                  le altre visite sono verbali già spediti e restano come sono stati scritti)
--   persone        email, email2, email3   (la rubrica: da lì le prossime visite prendono l'indirizzo)
--   imprese        impresa_email_ref, impresa_email2, impresa_email3
--   committenti    email
-- Si sostituisce solo il valore uguale a quello respinto (maiuscole e spazi ignorati), colonna per
-- colonna: niente altro cambia (regola del 04/10, «aprire e salvare non cambia niente»).
-- Ogni sostituzione resta in `mail_correzioni`, con il prima e il dopo.
-- Il rimbalzo NON si chiude qui: lo chiude chi ritrasmette (o decide di non farlo), con la nota.

create table if not exists public.mail_correzioni (
  id           bigint generated always as identity primary key,
  respinta_id  bigint references public.s_mail_respinte(id),
  visita_id    text,
  nr_verbale   text,
  vecchia      text not null,
  nuova        text not null,
  dove         jsonb not null default '[]'::jsonb,   -- [{tabella, chiave, colonna}]
  fatta_da     text not null,
  fatta_il     timestamptz not null default now()
);
create index if not exists mail_correzioni_visita on public.mail_correzioni (visita_id);
alter table public.mail_correzioni enable row level security;
drop policy if exists mail_correzioni_lettura on public.mail_correzioni;
create policy mail_correzioni_lettura on public.mail_correzioni for select to authenticated
  using ((select is_personale()));
-- si scrive solo dalla funzione qui sotto
revoke insert, update, delete on public.mail_correzioni from anon, authenticated;

create or replace function public.mail_respinta_correggi(p_id bigint, p_nuova text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_chi   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_r     public.s_mail_respinte;
  v_old   text;
  v_new   text := lower(btrim(coalesce(p_nuova, '')));
  v_dove  jsonb := '[]'::jsonb;
  v_col   text;
  v_k     text;
begin
  select * into v_r from public.s_mail_respinte where id = p_id for update;
  if v_r.id is null then raise exception 'Rimbalzo % non trovato', p_id; end if;
  if not (public.is_segreteria() or lower(coalesce(v_r.tecnico_email, '')) = v_chi) then
    raise exception 'Non autorizzato: l''indirizzo lo corregge il tecnico del verbale o la segreteria';
  end if;
  if v_r.stato not in ('nuova', 'avvisato') then
    raise exception 'Questo rimbalzo è già chiuso (%)', v_r.stato;
  end if;
  v_old := lower(btrim(coalesce(v_r.destinatario, '')));
  if v_new !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception '«%» non sembra un indirizzo e-mail valido', p_nuova;
  end if;
  if v_new = v_old then
    raise exception 'È lo stesso indirizzo che è stato respinto: scrivi quello corretto';
  end if;

  -- la visita del rimbalzo
  if v_r.visita_id is not null then
    foreach v_col in array array['comm_email', 'rl_email', 'csp_email', 'cse_email', 'email_coor'] loop
      execute format('update public.visite set %1$I = $1 where visita_id = $2 and lower(btrim(%1$I)) = $3 returning visita_id', v_col)
        into v_k using v_new, v_r.visita_id, v_old;
      if v_k is not null then v_dove := v_dove || jsonb_build_object('tabella', 'visite', 'chiave', v_k, 'colonna', v_col); end if;
      v_k := null;
    end loop;
  end if;

  -- la rubrica delle persone
  foreach v_col in array array['email', 'email2', 'email3'] loop
    for v_k in execute format('update public.persone set %1$I = $1 where lower(btrim(%1$I)) = $2 returning persona_id::text', v_col)
      using v_new, v_old loop
      v_dove := v_dove || jsonb_build_object('tabella', 'persone', 'chiave', v_k, 'colonna', v_col);
    end loop;
  end loop;

  -- le imprese
  foreach v_col in array array['impresa_email_ref', 'impresa_email2', 'impresa_email3'] loop
    for v_k in execute format('update public.imprese set %1$I = $1 where lower(btrim(%1$I)) = $2 returning impresa_id::text', v_col)
      using v_new, v_old loop
      v_dove := v_dove || jsonb_build_object('tabella', 'imprese', 'chiave', v_k, 'colonna', v_col);
    end loop;
  end loop;

  -- i committenti
  for v_k in update public.committenti set email = v_new where lower(btrim(email)) = v_old returning committente_id::text loop
    v_dove := v_dove || jsonb_build_object('tabella', 'committenti', 'chiave', v_k, 'colonna', 'email');
  end loop;

  insert into public.mail_correzioni (respinta_id, visita_id, nr_verbale, vecchia, nuova, dove, fatta_da)
  values (v_r.id, v_r.visita_id, v_r.nr_verbale, v_r.destinatario, v_new, v_dove, v_chi);

  -- (12/10/2026, dai dati veri: il verbale 0030 ha due rimbalzi dello stesso indirizzo) gli altri
  -- rimbalzi aperti dello stesso indirizzo sullo stesso verbale sono la stessa cosa: si chiudono qui
  update public.s_mail_respinte
     set stato = 'risolta', risolta_il = now(), risolta_da = v_chi,
         risolta_note = left(format('Stesso indirizzo del rimbalzo n° %s, corretto in %s.', v_r.id, v_new), 500)
   where id <> v_r.id and stato in ('nuova', 'avvisato')
     and lower(btrim(destinatario)) = v_old
     and visita_id is not distinct from v_r.visita_id;

  return jsonb_build_object('vecchia', v_r.destinatario, 'nuova', v_new, 'dove', v_dove,
    'visita_id', v_r.visita_id, 'nr_verbale', v_r.nr_verbale, 'ruolo', v_r.ruolo);
end $$;
revoke execute on function public.mail_respinta_correggi(bigint, text) from public, anon;
grant execute on function public.mail_respinta_correggi(bigint, text) to authenticated;
