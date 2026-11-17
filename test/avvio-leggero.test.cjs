// node test/avvio-leggero.test.cjs
// (17/11/2026, chiesto dall'utente: «l'accensione delle app tramite cellulare è lentissima»)
//  · grafici, PDF ed Excel non si scaricano più all'accensione: li dà librerie.js quando servono,
//    e chi li usa aspetta prima libreria(...);
//  · il service worker serve dalla copia gli script e le immagini, MAI la pagina principale;
//  · le letture dell'accesso partono insieme.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const radice = path.join(__dirname, '..');
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8').replace(/\r\n/g, '\n');
const index = leggi('index.html');
const testa = index.slice(0, index.indexOf('</head>'));

// 1. l'<head> non carica più le librerie pesanti; librerie.js sì, prima del modulo principale
for (const lib of ['chart.umd.min.js', 'jspdf.umd.min.js', 'jspdf.plugin.autotable.min.js', 'xlsx.full.min.js']) {
  assert.ok(!testa.includes(lib), lib + ' non deve più caricarsi all\'accensione');
}
assert.ok(/<script src="librerie\.js\?v=\d+"><\/script>/.test(testa), 'librerie.js si carica nell\'<head>');
const yml = leggi('.github/workflows/deploy-pages.yml');
assert.ok(/ librerie\.js /.test(yml) && /- 'librerie\.js'/.test(yml), 'librerie.js sta fra i file pubblicati');

// 2. librerie.js: stessi indirizzi e impronte di prima; un errore si può ritentare
const lib = leggi('librerie.js');
for (const h of ['sha512-CQBWl4fJHWbryGE', 'sha512-qZvrmS2ekKPF2m', 'sha512-2/YdOMV+YNpanLCF', 'sha512-r22gChDnGvBylk90']) assert.ok(lib.includes(h), 'impronta ' + h);
function prova(sorgente) {
  const aggiunti = [];
  const finestra = {};
  const documento = {
    createElement: () => ({ remove() {} }),
    head: { appendChild: (s) => { aggiunti.push(s); } },
  };
  vm.runInNewContext(sorgente, { window: finestra, document: documento, Promise, Error });
  return { finestra, aggiunti };
}
(async () => {
  const { finestra, aggiunti } = prova(lib);
  const tic = () => new Promise((r) => setTimeout(r, 0));
  // primo tentativo: la rete fallisce
  const p1 = finestra.libreria('xlsx');
  await tic();
  assert.strictEqual(aggiunti.length, 1);
  aggiunti[0].onerror();
  await assert.rejects(p1, /Non riesco a scaricare xlsx\.full\.min\.js/);
  // secondo tentativo: riparte da capo e va
  const p2 = finestra.libreria('xlsx');
  await tic();
  assert.strictEqual(aggiunti.length, 2, 'dopo un errore si riprova davvero');
  finestra.XLSX = { utils: {} };
  aggiunti[1].onload();
  await p2;
  // già pronta: nessun altro scaricamento
  await finestra.libreria('xlsx');
  assert.strictEqual(aggiunti.length, 2);
  // pdf: jsPDF poi autotable, in fila
  const p3 = finestra.libreria('pdf');
  await tic();
  assert.ok(/jspdf\.umd/.test(aggiunti[2].src));
  aggiunti[2].onload();
  await tic();
  assert.ok(/autotable/.test(aggiunti[3].src), 'autotable dopo jsPDF');
  finestra.jspdf = { jsPDF: { API: { autoTable() {} } } };
  aggiunti[3].onload();
  await p3;
  await assert.rejects(finestra.libreria('nonesiste'), /sconosciuta/);

  // 3. chi usa le librerie aspetta prima libreria(...)
  const attende = (src, inizio, lib, quanto = 400) => {
    const i = src.indexOf(inizio);
    assert.ok(i >= 0, 'non trovo ' + inizio);
    assert.ok(src.slice(i, i + quanto).includes("libreria('" + lib + "')"), inizio + ' deve aspettare libreria(\'' + lib + '\')');
  };
  attende(index, 'async function genPDF(', 'pdf', 500);
  attende(index, 'async function incImportaFile(', 'xlsx', 400);
  attende(index, 'function _mkChart(id,cfg){', 'chart', 300);
  const esp = leggi('esportazioni.js');
  attende(esp, 'async function admEsportaExcel(){', 'xlsx', 120);
  attende(esp, 'async function ceivEsportaExcel(){', 'xlsx', 600);
  attende(esp, 'async function ceivEsportaPdf(){', 'pdf', 600);
  attende(esp, 'async function _ceiviWb(data){', 'xlsx', 80);
  attende(esp, 'async function ceivImpPdf(){', 'pdf', 200);
  attende(esp, 'function _admReadXlsx(file){', 'xlsx', 200);
  attende(leggi('report-visite.js'), 'async function admGeneraReport(){', 'pdf', 120);
  attende(leggi('report-osservatorio.js'), 'async function admGeneraReportOsservatorio(){', 'pdf', 120);
  const stage = leggi('stage-relazione.js');
  assert.strictEqual((stage.match(/await window\.libreria\('pdf'\)/g) || []).length, 2, 'relazione stage: PDF e salvataggio aspettano jsPDF');
  assert.ok(!/Libreria PDF non caricata/.test(index + stage), 'niente più «ricarica la pagina» per una libreria che si scarica da sola');
  // nessun uso «a freddo»: ogni file che nomina XLSX/jspdf/Chart chiama anche libreria()
  for (const f of fs.readdirSync(radice).filter((x) => x.endsWith('.js') && !x.startsWith('_'))) {
    const s = leggi(f);
    if (/\bXLSX\.|window\.jspdf/.test(s) && !['ceiv-imprese.js', 'verbale-pdf.js', 'librerie.js'].includes(f)) {
      assert.ok(/window\.libreria\(/.test(s), f + ' usa XLSX o jsPDF senza aspettare libreria()');
    }
  }

  // 4. service worker: copie sì, la pagina principale mai
  const sw = leggi('sw.js');
  assert.ok(/if \(req\.method !== 'GET' \|\| req\.mode === 'navigate'\) return;/.test(sw), 'la pagina principale arriva sempre dalla rete');
  assert.ok(/if \(url\.origin !== self\.location\.origin\) return;/.test(sw), 'Supabase e CDN non si toccano');
  assert.ok(/new URL\(self\.registration\.scope\)\.pathname/.test(sw), 'le altre app del dominio non si toccano');
  assert.ok(/e\.waitUntil\(aggiorna\(cache, req\)/.test(sw), 'una copia vecchia si ricontrolla in sottofondo');
  assert.ok(!/\.html/.test(sw.match(/DA_COPIARE = (.*)/)[1]), 'l\'HTML non si copia');
  assert.ok(/register\('sw\.js\?v=3'\)/.test(leggi('notifiche.js')), 'il service worker nuovo si registra');
  // prova del gestore: una navigazione non viene intercettata, uno script sì
  const ascolta = {};
  const ctx = { self: { addEventListener: (t, f) => { ascolta[t] = f; }, location: { origin: 'https://x.github.io' }, registration: { scope: 'https://x.github.io/gestionale-visite/' }, navigator: {} }, caches: {}, fetch: () => {}, URL, Date, console };
  vm.runInNewContext(sw, ctx);
  const evento = (url, mode) => { let preso = false; ascolta.fetch({ request: { method: 'GET', mode, url }, respondWith: () => { preso = true; } }); return preso; };
  assert.strictEqual(evento('https://x.github.io/gestionale-visite/', 'navigate'), false, 'la pagina: dalla rete');
  assert.strictEqual(evento('https://x.github.io/gestionale-visite/index.html', 'navigate'), false);
  assert.strictEqual(evento('https://x.github.io/gestionale-visite/mappa.js?v=3', 'no-cors'), true, 'uno script: dalla copia');
  assert.strictEqual(evento('https://x.github.io/segreteria/js/app.js', 'no-cors'), false, 'altra app: non si tocca');
  assert.strictEqual(evento('https://cdnjs.cloudflare.com/ajax/libs/x.js', 'no-cors'), false, 'CDN: non si tocca');
  assert.strictEqual(evento('https://x.github.io/gestionale-visite/sw.js?v=3', 'no-cors'), false, 'sw.js: mai');

  // 5. le letture dell'accesso partono insieme, prima di aspettarne una
  const login = index.slice(index.indexOf('async function onLogin(user){'), index.indexOf('// ── Accesso VIEWER'));
  for (const q of ["_pRuolo=_subito(sb.from('app_ruoli')", "_pPwd=_subito(sb.rpc('deve_cambiare_password'))", "_pTec=_subito(sb.from('tecnici')", "_pCoord=_subito(sb.rpc('is_coordinatore'))", "_pVoci=_subito(sb.from('checklist_voci')"]) {
    assert.ok(login.includes(q), 'parte all\'accesso: ' + q);
  }
  assert.ok(!/await /.test(login), 'nessuna attesa prima che siano partite tutte');
  console.log('avvio-leggero: ok');
})().catch((e) => { console.error(e); process.exit(1); });
