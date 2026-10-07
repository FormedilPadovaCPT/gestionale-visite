-- 07/10/2026 — LA FOTO A PROVA DELL'USCITA SENZA VISITA (chiesto dall'utente: «va gestita su Drive come quelle dei
-- verbali»). Il tecnico che registra «🏁 Cantiere finito / non trovato» può allegare fino a 3 foto. Come per i verbali
-- (visite_foto) il file va su Drive con la funzione upload-foto, nella cartella «Foto Verbali CPT», sottocartella
-- dell'incarico «INC-<numero>»; nel database resta solo il riferimento: incarichi_foto.
-- Le vede il personale; le aggiunge il tecnico a cui è assegnato l'incarico (o la segreteria); le toglie la segreteria.

begin;

create table if not exists public.incarichi_foto (
  id bigint generated always as identity primary key,
  incarico_id bigint not null references public.incarichi(id) on delete cascade,
  drive_file_id text not null,
  drive_url text,
  thumb_url text,
  nome_file text,
  dimensione_kb integer,
  caricata_da text default (auth.jwt() ->> 'email'),
  caricata_il timestamptz not null default now()
);
comment on table public.incarichi_foto is 'Foto a prova dell''uscita senza visita di un incarico (07/10/2026): il file sta su Drive (upload-foto, «Foto Verbali CPT»/INC-<id>), qui il riferimento.';
create index if not exists idx_incarichi_foto_incarico on public.incarichi_foto (incarico_id);
create unique index if not exists ux_incarichi_foto_file on public.incarichi_foto (drive_file_id);

alter table public.incarichi_foto enable row level security;
drop policy if exists incarichi_foto_sel on public.incarichi_foto;
create policy incarichi_foto_sel on public.incarichi_foto for select to authenticated using ((select public.is_personale()));
drop policy if exists incarichi_foto_ins on public.incarichi_foto;
create policy incarichi_foto_ins on public.incarichi_foto for insert to authenticated with check (
  (select public.is_gestione_incarichi())
  or exists (select 1 from public.incarichi i where i.id = incarico_id
               and lower(coalesce(i.tecnico_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))));
drop policy if exists incarichi_foto_del on public.incarichi_foto;
create policy incarichi_foto_del on public.incarichi_foto for delete to authenticated using ((select public.is_gestione_incarichi()));
grant select, insert, delete on public.incarichi_foto to authenticated;

commit;
