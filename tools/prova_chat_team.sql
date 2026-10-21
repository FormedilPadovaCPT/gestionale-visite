-- Prova della chat del team nel database (21/10/2026): casi giusti e casi rotti apposta.
-- Gira come blocco unico e finisce SEMPRE con un'eccezione che porta fuori l'esito:
-- tutto ciò che ha scritto viene annullato (niente resta nelle tabelle né nella coda push).
-- Si lancia così com'è con execute_sql. L'esito atteso è «PROVA CHAT: tutto come previsto».
do $$
declare
  coord text := (select lower(valore) from s_config where chiave = 'coordinatore_email');
  segr  text := 'cptpd@did.formedilpadova.it';
  tec   text := 'prova.tecnico@did.formedilpadova.it';
  dir   text := 'direzione@formedilpadova.it';
  log   text := '';
  id_segr bigint; id_tec bigint; n integer; t text; rifiutato boolean;

begin
  -- per diventare qualcuno: gli stessi claims che mette Supabase + ruolo authenticated

  -- 1. il Coordinatore ammette il tecnico di prova
  perform set_config('request.jwt.claims', json_build_object('email', coord, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.chat_ammetti('TEC-PROVA-2026');
  log := log || '1 ammesso; ';

  -- 2. il tecnico scrive e legge
  perform set_config('request.jwt.claims', json_build_object('email', tec, 'role', 'authenticated')::text, true);
  id_tec := public.chat_scrivi('Messaggio di prova del tecnico');
  select count(*) into n from public.chat_elenco(null, null, 50) e where e.id = id_tec and e.testo = 'Messaggio di prova del tecnico';
  if n <> 1 then raise exception 'FALLITA 2: il tecnico non rilegge il suo messaggio'; end if;
  log := log || '2 tecnico scrive e legge; ';

  -- 3. la segreteria scrive; il tecnico prova a cancellare il messaggio della segreteria → rifiutato
  perform set_config('request.jwt.claims', json_build_object('email', segr, 'role', 'authenticated')::text, true);
  id_segr := public.chat_scrivi('Messaggio di prova della segreteria');
  perform set_config('request.jwt.claims', json_build_object('email', tec, 'role', 'authenticated')::text, true);
  rifiutato := false;
  begin perform public.chat_cancella(id_segr); exception when others then rifiutato := true; t := sqlerrm; end;
  if not rifiutato then raise exception 'FALLITA 3: il tecnico ha cancellato un messaggio non suo'; end if;
  log := log || '3 cancellare un messaggio altrui: rifiutato (' || t || '); ';

  -- 4. il tecnico prova ad ammettersi o a togliere qualcuno → rifiutato
  rifiutato := false;
  begin perform public.chat_togli('TEC-PROVA-2026'); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 4: un tecnico ha tolto qualcuno dalla chat'; end if;
  log := log || '4 tecnico che toglie: rifiutato; ';

  -- 5. scritture dirette sulle tabelle → rifiutate
  rifiutato := false;
  begin insert into public.chat_messaggi (autore_email, autore_nome, autore_ruolo, tipo) values (tec, 'x', 'tecnico', 'testo'); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5a: insert diretto in chat_messaggi'; end if;
  rifiutato := false;
  begin update public.chat_messaggi set cancellato_il = now() where id = id_segr; exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5b: update diretto di chat_messaggi'; end if;
  rifiutato := false;
  begin perform 1 from public.chat_contenuti limit 1; exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5c: lettura diretta di chat_contenuti'; end if;
  rifiutato := false;
  begin perform public.chat_file_nuovo(tec, 'foto', 'x', 'image/jpeg', 10); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 5d: un utente crea un messaggio-file senza passare dalla funzione chat-team'; end if;
  log := log || '5 scritture e letture dirette: rifiutate; ';

  -- 6. il tecnico cancella il suo: per tutti resta «cancellato», senza testo
  perform public.chat_cancella(id_tec);
  perform set_config('request.jwt.claims', json_build_object('email', segr, 'role', 'authenticated')::text, true);
  select count(*) into n from public.chat_elenco(null, null, 50) e where e.id = id_tec and e.cancellato and e.testo is null;
  if n <> 1 then raise exception 'FALLITA 6: il messaggio cancellato si legge ancora'; end if;
  log := log || '6 cancellato: testo nascosto agli altri; ';

  -- 7. il Coordinatore toglie il tecnico: niente più lettura né scrittura, i suoi messaggi restano
  perform set_config('request.jwt.claims', json_build_object('email', coord, 'role', 'authenticated')::text, true);
  perform public.chat_togli('TEC-PROVA-2026');
  perform set_config('request.jwt.claims', json_build_object('email', tec, 'role', 'authenticated')::text, true);
  rifiutato := false;
  begin perform 1 from public.chat_elenco(null, null, 50); exception when others then rifiutato := true; t := sqlerrm; end;
  if not rifiutato then raise exception 'FALLITA 7a: il tecnico tolto legge ancora la chat'; end if;
  rifiutato := false;
  begin perform public.chat_scrivi('ci sono ancora?'); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 7b: il tecnico tolto scrive ancora'; end if;
  select count(*) into n from public.chat_messaggi;
  if n <> 0 then raise exception 'FALLITA 7c: il tecnico tolto vede % messaggi nella tabella (Realtime)', n; end if;
  perform set_config('request.jwt.claims', json_build_object('email', segr, 'role', 'authenticated')::text, true);
  select count(*) into n from public.chat_elenco(null, null, 50) e where e.id = id_tec;
  if n <> 1 then raise exception 'FALLITA 7d: il messaggio del tecnico tolto è sparito'; end if;
  log := log || '7 tecnico tolto: non legge (' || t || '), non scrive, non vede righe; i suoi messaggi restano; ';

  -- 8. il Direttore non entra, nemmeno per errore
  perform set_config('request.jwt.claims', json_build_object('email', dir, 'role', 'authenticated')::text, true);
  rifiutato := false;
  begin perform 1 from public.chat_elenco(null, null, 50); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 8a: il Direttore legge la chat'; end if;
  if (public.chat_stato() ->> 'partecipa')::boolean then raise exception 'FALLITA 8b: chat_stato dice che il Direttore partecipa'; end if;
  log := log || '8 Direttore: fuori; ';

  -- 9. niente si cancella davvero, nemmeno da amministratore
  execute 'reset role';
  rifiutato := false;
  begin delete from public.chat_messaggi where id = id_segr; exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA 9: delete riuscito su chat_messaggi'; end if;
  log := log || '9 delete fisico: rifiutato; ';

  -- 10. la storia dei movimenti: ammesso e tolto, riga chiusa e non cancellata
  select count(*) into n from public.chat_membri where email = tec and rimosso_il is not null and ammesso_da = coord and rimosso_da = coord;
  if n <> 1 then raise exception 'FALLITA 10: movimenti non registrati'; end if;
  log := log || '10 movimenti storicizzati';

  raise exception 'PROVA CHAT: tutto come previsto — %', log;
end $$;
