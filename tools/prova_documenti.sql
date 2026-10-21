-- Prova dei documenti con presa visione nel database (21/10/2026): casi giusti e casi rotti apposta.
-- Gira come blocco unico e finisce SEMPRE con un'eccezione che porta fuori l'esito:
-- tutto ciò che ha scritto viene annullato (niente resta nelle tabelle né nella coda push).
-- Si lancia così com'è con execute_sql. L'esito atteso è «PROVA DOCUMENTI: tutto come previsto».
do $$
declare
  coord text := (select lower(valore) from s_config where chiave = 'coordinatore_email');
  segr  text := 'cptpd@did.formedilpadova.it';
  tec   text := 'franco.caon@did.formedilpadova.it';      -- tecnico attivo e nella chat
  dir   text := 'direzione@formedilpadova.it';            -- Direttore: ruolo viewer
  fuori text := 'enrico.cuccato@did.formedilpadova.it';   -- tecnico non più in servizio
  h1 text := repeat('a', 64); h2 text := repeat('b', 64);
  log text := '';
  d1 bigint; d2 bigint; t1 timestamptz; t2 timestamptz; n integer; j jsonb; t text; rifiutato boolean;
begin
  -- 1. la segreteria pubblica la versione 1 per chi è nella chat (come fa la funzione, con la chiave di servizio)
  d1 := public.doc_registra(segr, 'prova-informativa', 1, 'Informativa di prova', 'Solo per la prova', array['chat'], 'driveprova1', 'prova_v01.pdf', h1, null, 1000);
  select count(*) into n from push_coda where evento = 'doc_da_leggere:' || d1;
  if n < 2 then raise exception 'FALLITA 1: notifiche non accodate (%)', n; end if;
  if exists (select 1 from push_coda where evento = 'doc_da_leggere:' || d1 and email = segr) then raise exception 'FALLITA 1b: notifica a chi ha pubblicato'; end if;
  log := log || '1 pubblicata, ' || n || ' notifiche; ';

  -- 2. chi non è segreteria non pubblica
  rifiutato := false;
  begin perform public.doc_registra(tec, 'prova-altro', 1, 'Altro', null, array['chat'], 'x', 'x.pdf', h2, null, 10); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 2: un tecnico ha pubblicato'; end if;
  log := log || '2 tecnico che pubblica: rifiutato; ';

  -- 3. destinatari giusti: il tecnico sì; Direttore e tecnico fuori servizio no
  if not public.doc_destinatario_di(d1, tec) then raise exception 'FALLITA 3a: il tecnico non è destinatario'; end if;
  if public.doc_destinatario_di(d1, dir) or public.doc_puo_aprire(d1, dir) then raise exception 'FALLITA 3b: il Direttore è destinatario'; end if;
  if public.doc_destinatario_di(d1, fuori) or public.doc_puo_aprire(d1, fuori) then raise exception 'FALLITA 3c: un tecnico fuori servizio è destinatario'; end if;
  perform public.doc_aperto(d1, dir);
  if exists (select 1 from doc_prese_visione where documento_id = d1 and email = dir) then raise exception 'FALLITA 3d: registrata l''apertura di un non destinatario'; end if;
  log := log || '3 destinatari giusti; ';

  -- 4. il tecnico vede il documento da leggere, ma la presa visione senza averlo aperto è rifiutata
  perform set_config('request.jwt.claims', json_build_object('email', tec, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.doc_miei();
  if not exists (select 1 from jsonb_array_elements(j->'documenti') x where (x->>'id')::bigint = d1 and x->>'presa_il' is null) then raise exception 'FALLITA 4a: il tecnico non vede il documento'; end if;
  rifiutato := false;
  begin perform public.doc_prendi_visione(d1); exception when others then rifiutato := true; t := sqlerrm; end;
  if not rifiutato then raise exception 'FALLITA 4b: presa visione senza aver aperto il file'; end if;
  log := log || '4 presa visione prima di aprire: rifiutata (' || t || '); ';

  -- 5. tabelle chiuse alle app: niente lettura né scrittura diretta
  rifiutato := false;
  begin perform 1 from public.doc_personale limit 1; exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5a: lettura diretta di doc_personale'; end if;
  rifiutato := false;
  begin insert into public.doc_prese_visione (documento_id, email) values (d1, tec); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5b: il tecnico si scrive l''apertura da solo'; end if;
  rifiutato := false;
  begin perform public.doc_aperto(d1, tec); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5c: doc_aperto chiamabile dalle app'; end if;
  rifiutato := false;
  begin perform public.doc_quadro(); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5d: il tecnico vede il quadro'; end if;
  rifiutato := false;
  begin perform public.doc_ritira(d1); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5e: il tecnico ritira un documento'; end if;
  log := log || '5 accesso diretto e funzioni d''ufficio: rifiutati; ';

  -- 6. la funzione registra l'apertura (chiave di servizio), poi il tecnico prende visione, una volta sola
  execute 'reset role';
  perform public.doc_aperto(d1, tec);
  perform public.doc_aperto(d1, tec);
  select aperture into n from doc_prese_visione where documento_id = d1 and email = tec;
  if n <> 2 then raise exception 'FALLITA 6a: aperture contate male (%)', n; end if;
  execute 'set local role authenticated';
  t1 := public.doc_prendi_visione(d1);
  t2 := public.doc_prendi_visione(d1);
  if t1 is null or t1 <> t2 then raise exception 'FALLITA 6b: la presa visione non è una sola'; end if;
  log := log || '6 aperto due volte, presa visione una; ';

  -- 7. né la presa visione né il file si cambiano, e niente si cancella
  execute 'reset role';
  rifiutato := false;
  begin update doc_prese_visione set presa_il = null where documento_id = d1 and email = tec; exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 7a: presa visione tolta'; end if;
  rifiutato := false;
  begin update doc_personale set sha256 = h2 where id = d1; exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 7b: impronta del file cambiata'; end if;
  rifiutato := false;
  begin delete from doc_prese_visione where documento_id = d1; exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 7c: presa visione cancellata'; end if;
  rifiutato := false;
  begin delete from doc_personale where id = d1; exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 7d: documento cancellato'; end if;
  log := log || '7 righe ferme e non cancellabili; ';

  -- 8. il Coordinatore vede il quadro, con la presa visione del tecnico
  perform set_config('request.jwt.claims', json_build_object('email', coord, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.doc_quadro();
  if not exists (select 1 from jsonb_array_elements(j) x, jsonb_array_elements(x->'persone') p
                  where (x->>'id')::bigint = d1 and p->>'email' = tec and p->>'presa_il' is not null) then
    raise exception 'FALLITA 8: il quadro non mostra la presa visione';
  end if;
  log := log || '8 quadro del Coordinatore; ';

  -- 9. versione 2: la 1 si ritira, la presa visione si chiede di nuovo, la vecchia resta fra le precedenti
  execute 'reset role';
  rifiutato := false;
  begin perform public.doc_registra(segr, 'prova-informativa', 3, 'Informativa di prova', null, array['chat'], 'driveprova2', 'prova_v02.pdf', h2, null, 1000); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 9a: accettata una versione col numero sbagliato'; end if;
  d2 := public.doc_registra(segr, 'prova-informativa', 2, 'Informativa di prova', null, array['chat'], 'driveprova2', 'prova_v02.pdf', h2, null, 1000);
  if (select ritirato_il from doc_personale where id = d1) is null then raise exception 'FALLITA 9b: la versione 1 è ancora in vigore'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', tec, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.doc_miei();
  if exists (select 1 from jsonb_array_elements(j->'documenti') x where (x->>'id')::bigint = d1) then raise exception 'FALLITA 9c: la versione ritirata è ancora fra i documenti da leggere'; end if;
  if not exists (select 1 from jsonb_array_elements(j->'documenti') x where (x->>'id')::bigint = d2 and x->>'presa_il' is null) then raise exception 'FALLITA 9d: la versione 2 non chiede la presa visione'; end if;
  if not exists (select 1 from jsonb_array_elements(j->'precedenti') x where (x->>'id')::bigint = d1 and x->>'presa_il' is not null) then raise exception 'FALLITA 9e: la presa visione della versione 1 non resta'; end if;
  rifiutato := false;
  begin perform public.doc_prendi_visione(d1); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 9f: presa visione su una versione ritirata'; end if;
  execute 'reset role';
  if not public.doc_puo_aprire(d1, tec) then raise exception 'FALLITA 9g: chi l''aveva letta non può più rivedere la versione 1'; end if;
  log := log || '9 versione nuova: la vecchia ritirata e rivedibile, presa visione da rifare; ';

  raise exception 'PROVA DOCUMENTI: tutto come previsto — %', log;
end $$;
