/* Promemoria «verbali da inviare» al tecnico (13/10/2026, deciso dall'utente).
   Prova il testo della mail (modulo puro della funzione), le regole del SQL,
   il collegamento ?vista=lista&dainviare=1 e i confini: solo al tecnico,
   niente coordinatore in copia, niente «consegnato a mano». */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const dir = path.join(__dirname, '..');
const leggi = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

(async () => {
  const T = await import(pathToFileURL(path.join(dir, 'supabase/functions/promemoria-invii/testo.js')).href);

  const righe = [
    { tecnico_email: 'Franco.Caon@did.formedilpadova.it', tecnico_nome: 'Franco Caon', nr_verbale: 'CPT/26_27/0001', data_visita: '2026-10-02', stato: 'definitivo', cantiere: 'Via Zacco 39', comune: 'PADOVA', impresa: 'GALIAZZO <F.LLI>', giorni: 8 },
    { tecnico_email: 'franco.caon@did.formedilpadova.it', tecnico_nome: 'Franco Caon', nr_verbale: null, data_visita: null, stato: 'bozza', cantiere: 'ROMA_PADOVA', comune: 'PADOVA', impresa: null, giorni: 1 },
    { tecnico_email: 'tommaso.visentini@did.formedilpadova.it', tecnico_nome: 'Tommaso Visentini', nr_verbale: 'CPT/26_27/0031', data_visita: '2026-10-09', stato: 'definitivo', cantiere: 'X', comune: 'ESTE', impresa: 'Y', giorni: 3 },
  ];
  const g = T.raggruppa(righe);
  assert.strictEqual(g.length, 2, 'una mail per tecnico, indirizzo senza maiuscole');
  assert.strictEqual(g[0].definitivi.length, 1); assert.strictEqual(g[0].bozze.length, 1);
  assert.ok(T.oggetto(g[0]).startsWith('FORMEDIL Padova -AREA SICUREZZA E SALUTE- '), 'oggetto col prefisso dell’ufficio');
  assert.strictEqual(T.oggetto(g[0]), 'FORMEDIL Padova -AREA SICUREZZA E SALUTE- Promemoria: 1 verbale da inviare e 1 verbale ancora in bozza');
  assert.strictEqual(T.oggetto(g[1]), 'FORMEDIL Padova -AREA SICUREZZA E SALUTE- Promemoria: 1 verbale da inviare');
  const h = T.html(g[0]);
  assert.ok(h.includes('Buongiorno Franco,'));
  assert.ok(h.includes('GALIAZZO &lt;F.LLI&gt;'), 'i dati del database si scrivono protetti');
  assert.ok(h.includes('02/10/2026') && h.includes('8 giorni') && h.includes('1 giorno'));
  assert.ok(h.includes("va cercato") && h.includes('si manda sempre per mail'), 'senza mail dell’impresa il tecnico la cerca (deciso dall’utente)');
  assert.ok(h.includes(T.LINK) && /\?vista=lista&dainviare=1$/.test(T.LINK));
  assert.ok(!T.html(g[1]).includes('in bozza ('), 'la sezione bozze solo se ce ne sono');
  assert.strictEqual(T.dataIt('2026-10-02T10:00:00Z'), '02/10/2026');

  /* la funzione: solo al tecnico, nessuna copia */
  const fn = leggi('supabase/functions/promemoria-invii/index.ts');
  assert.ok(!/^\s*['`](Cc|Bcc):/m.test(fn), 'nessuna copia: è un promemoria per il tecnico');
  assert.ok(!/coordinatore_email|nicola\.demarco/.test(fn), 'il coordinatore non c’entra');
  assert.ok(/x-promemoria-invii/.test(fn) && /promemoria_invii_token/.test(fn), 'chiamata solo col token del giro');
  assert.ok(/oraRoma\(\) < 8/.test(fn), 'non prima delle 8 italiane');
  assert.ok(/giro-ok/.test(fn) && /tecnico_email: '\*'/.test(fn), 'battito del giro e niente doppioni');
  assert.ok(/promemoria_invii_attivo/.test(fn), 'interruttore');

  /* il SQL: stessa regola della colonna Invio */
  const sql = leggi('supabase/sql/2026_10_13_promemoria_invii.sql');
  assert.ok(/when 1 then 3 when 7 then 2 else 1/.test(sql), 'il lunedì guarda al venerdì');
  assert.ok(/time '08:00'\) at time zone 'Europe\/Rome'/.test(sql), 'ferma da prima delle 8 del giorno lavorativo prima');
  assert.ok(/v\.visita_id !~ '\^V\\d\{4\}-'/.test(sql) && /2026-10-01 00:00:00\+02/.test(sql), 'come _invVecchiaApp: solo visite nate nell’app');
  assert.ok(/b\.inviato_email is true/.test(sql), 'inviato = riga in verbali con inviato_email');
  assert.ok(/revoke execute on function public\.promemoria_invii_elenco\(timestamptz\) from public, anon, authenticated/.test(sql));
  assert.ok(/is_segreteria\(\) or public\.is_coordinatore\(\)/.test(sql), 'il registro lo leggono segreteria e coordinatore');

  /* il collegamento nella mail apre l'elenco col filtro acceso */
  const nt = leggi('notifiche.js');
  assert.ok(/qs\.get\('dainviare'\) === '1'/.test(nt) && /getElementById\('q-dainviare'\)/.test(nt));
  const idx = leggi('index.html');
  assert.ok(/id="q-dainviare"/.test(idx) && /data-view="lista"/.test(idx), 'filtro e vista esistono');

  console.log('promemoria-invii: ok');
})().catch((e) => { console.error(e); process.exit(1); });
