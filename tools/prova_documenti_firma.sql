-- Prova dei documenti DA FIRMARE nel database (21/10/2026), dopo 2026_10_21_documenti_firma.sql.
-- Blocco unico che finisce SEMPRE con un'eccezione: niente resta scritto (tabelle, coda push).
-- Esito atteso: «PROVA FIRME: tutto come previsto». Riuscita il 21/10/2026 (8 firme da chiedere: chi è nella chat).
do $$
declare segr text := 'cptpd@did.formedilpadova.it'; tec text := 'franco.caon@did.formedilpadova.it';
  d1 bigint; d2 bigint; n integer; j jsonb; rifiutato boolean; log text := ''; h text := repeat('d', 64);
begin
  d1 := public.doc_registra(segr, 'prova-firma', 1, 'Documento da firmare di prova', null, array['chat'], 'x', 'x_v01.pdf', h, null, 100, true);
  select count(*) into n from push_coda where evento = 'doc_da_leggere:' || d1;
  if n <> 0 then raise exception 'FALLITA F1: notifica «da leggere» per un documento da firmare'; end if;
  select count(*) into n from public.doc_firme_mancanti(d1);
  if n < 2 then raise exception 'FALLITA F2: mancanti %', n; end if;
  log := log || 'F1-F2 nessuna notifica doppia, ' || n || ' firme da chiedere; ';
  -- come farebbe firma-documenti: la riga del tecnico
  insert into s_firme (tipo, rif, titolo, nome_file, file_originale, sha256_originale, riquadro, firmatario_email, firmatario_ruolo, ordine, stato, richiesta_da)
    values ('documento', 'doc:' || d1 || ':' || tec, 'Documento da firmare di prova', 'x.pdf', 'originali/x.pdf', h, '{"pagina":0,"x":1,"y":1,"w":1,"h":1}', tec, 'personale', 1, 'in_attesa', segr);
  if exists (select 1 from public.doc_firme_mancanti(d1) e where e = tec) then raise exception 'FALLITA F3: il tecnico con la richiesta risulta ancora mancante'; end if;
  perform set_config('request.jwt.claims', json_build_object('email', tec, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.doc_miei();
  if not exists (select 1 from jsonb_array_elements(j->'documenti') x where (x->>'id')::bigint = d1 and x->'firma'->>'stato' = 'in_attesa') then raise exception 'FALLITA F4: il tecnico non vede la firma da fare'; end if;
  rifiutato := false;
  begin perform public.doc_prendi_visione(d1); exception when others then rifiutato := true; end;
  if not rifiutato then raise exception 'FALLITA F5: presa visione su un documento da firmare'; end if;
  log := log || 'F3-F5 richiesta vista, presa visione rifiutata; ';
  execute 'reset role';
  d2 := public.doc_registra(segr, 'prova-firma', 2, 'Documento da firmare di prova', null, array['chat'], 'y', 'x_v02.pdf', repeat('e', 64), null, 100, true);
  if exists (select 1 from s_firme where rif = 'doc:' || d1 || ':' || tec and stato = 'in_attesa') then raise exception 'FALLITA F6: la firma della versione vecchia è ancora da fare'; end if;
  log := log || 'F6 versione nuova: firma vecchia ritirata; ';
  insert into s_firme (tipo, rif, titolo, nome_file, file_originale, sha256_originale, riquadro, firmatario_email, firmatario_ruolo, ordine, stato, richiesta_da)
    values ('documento', 'x', 'x', 'x', 'originali/x', h, '{}', tec, 'personale', 1, 'in_attesa', segr);
  log := log || 'F7 ruolo personale accettato; ';
  raise exception 'PROVA FIRME: tutto come previsto — %', log;
end $$;
