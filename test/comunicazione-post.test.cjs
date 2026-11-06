// node test/comunicazione-post.test.cjs
// (06/11/2026, chiesto dall'utente) I post per i social passano dal gestionale prima di uscire: il Coordinatore
// dà il visto (e il post va comunque al Direttore) o chiede modifiche; il Direttore approva, approva con
// indicazioni o non approva. Qui: la pagina «📣 Comunicazione» c'è nel menu di Coordinatore e Direttore e
// in nessun altro, ognuno vede e decide i suoi, i pulsanti non li vede chi guarda in anteprima, le note
// obbligatorie lo sono anche qui, e il testo del post esce ripulito.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const leggi = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const js = leggi('comunicazione-post.js');
const html = leggi('index.html');
const veste = leggi('veste-v2.js');
const deploy = leggi('.github/workflows/deploy-pages.yml');

const C = require('../comunicazione-post.js');

// funzioni pure
const righe = [
  { id: 1, verso: 'coordinatore', stato: 'in_attesa', richiesto_il: '2026-11-06T09:00:00Z' },
  { id: 2, verso: 'direttore', stato: 'in_attesa', richiesto_il: '2026-11-06T08:00:00Z' },
  { id: 3, verso: 'direttore', stato: 'approvato', deciso_il: '2026-11-05T10:00:00Z' },
  { id: 4, verso: 'coordinatore', stato: 'ritirato', deciso_il: '2026-11-05T11:00:00Z' },
];
assert.deepStrictEqual(C.daVedere(righe, { coord: true }).map((r) => r.id), [1], 'il Coordinatore vede i suoi');
assert.deepStrictEqual(C.daVedere(righe, { direttore: true }).map((r) => r.id), [2], 'il Direttore vede i suoi');
assert.deepStrictEqual(C.daVedere(righe, { segr: true }).map((r) => r.id), [2, 1], 'la segreteria li vede tutti, dal più vecchio');
assert.deepStrictEqual(C.daVedere(righe, {}).map((r) => r.id), [], 'un tecnico niente');
assert.deepStrictEqual(C.decisiDiRecente(righe, { direttore: true }).map((r) => r.id), [3], 'fra i decisi niente ritirati, e solo i propri');
assert.deepStrictEqual(C.immaginiDi({ immagine_url: 'https://x/a.jpg', immagini: ['https://x/b.jpg', { url: 'https://x/c.jpg' }, 'javascript:alert(1)'] }),
  ['https://x/a.jpg', 'https://x/b.jpg', 'https://x/c.jpg'], 'copertina, poi carosello; solo indirizzi https');
assert.ok(C.videoOk('https://www.youtube.com/watch?v=abc') && C.videoOk('https://youtu.be/abc') && !C.videoOk('javascript:alert(1)') && !C.videoOk('https://altro.it/v'), 'il video solo da YouTube');

// la pagina e il menu
assert.ok(/<button data-view="comunicazione" id="nav-comunicazione" style="display:none">📣 Comunicazione<span id="nav-com-badge"/.test(html), 'la voce del menu, nascosta finché la veste non la mostra');
assert.ok(/<section id="view-comunicazione" class="hidden"><\/section>/.test(html), 'la pagina');
assert.ok(/\$\('view-comunicazione'\)\?\.classList\.toggle\('hidden',view!=='comunicazione'\)/.test(html), 'navTo la mostra e la nasconde');
assert.ok(/if\(view==='comunicazione'&&window\.comunicazionePost\)window\.comunicazionePost\.apri\(\)/.test(html), 'aprendola si carica');
assert.ok(/<script src="comunicazione-post\.js\?v=\d+"><\/script>/.test(html), 'lo script è caricato');
assert.ok(/direttore: +\{ nome: 'Direttore', +menu: \['direzione', 'comunicazione',/.test(veste), 'nel menu del Direttore');
assert.ok(/coordinatore: \{ nome: 'Coordinatore', +menu: \[[^\]]*'\|', 'comunicazione', 'admin'\]/.test(veste), 'nel menu del Coordinatore');
for (const r of ['segreteria', 'tecnico', 'docente', 'presidenza', 'consigliere']) {
  const riga = veste.split('\n').find((l) => new RegExp(`^\\s+${r}: +\\{ nome:`).test(l)) || '';
  assert.ok(riga && !riga.includes("'comunicazione'"), `non nel menu di ${r}`);
}
assert.ok(/comunicazione-post\.js post-formato\.js/.test(deploy) && /- 'comunicazione-post\.js'/.test(deploy) && /- 'post-formato\.js'/.test(deploy), 'i due file vanno pubblicati');
assert.ok(fs.existsSync(path.join(__dirname, '..', 'post-formato.js')), 'la copia della formattazione c\'è (la tiene allineata verifica-post-formato.mjs della segreteria)');

// le decisioni
assert.ok(/const pulsanti = !_come && \(Rv\.coord \|\| Rv\.direttore\);/.test(js), 'i pulsanti solo a chi decide davvero, non nell\'anteprima');
assert.ok(/const mio = pulsanti && r\.verso === verso\(R\);/.test(js), 'e solo sui propri passaggi');
assert.ok(/radice\.sb\.rpc\('s_post_decidi', \{ p_passaggio: id, p_esito: esito, p_nota: nota \? nota\.trim\(\) : null \}\)/.test(js), 'decide il database');
assert.ok(/if \(nota\.trim\(\)\.length < 3\) \{ avviso\('Scrivi due righe/.test(js), 'modifiche, indicazioni e «non approvo» vogliono la nota');
for (const e of ['visto', 'modifiche', 'approvato', 'approvato_indicazioni', 'non_approvato']) {
  assert.ok(js.includes(`data-cp-esito="${e}"`), `c'è il pulsante «${e}»`);
}
assert.ok(/if \(error\) throw new Error\(error\.message\);/.test(js) && /Non sono riuscito a leggere i post da vedere/.test(js), 'una lettura fallita si dice, non diventa «nessun post»');
// i testi dal database passano da esc() o dal convertitore che ripulisce prima di formattare
for (const campo of ['t.titolo || \'Post\'', 'r.nota_richiesta', 'vc.nota', 't.verifica', 't.fonte', 't.norma', 't.hashtag', 'r.nota', 'e.message']) {
  assert.ok(js.includes('esc(' + campo + ')'), `${campo} deve passare da esc()`);
}
assert.ok(/const tgHtml = F \? F\.postInTelegramHtml\(tg\) : esc\(tg\);/.test(js), 'senza il convertitore il testo esce ripulito');
const F = fs.readFileSync(path.join(__dirname, '..', 'post-formato.js'), 'utf8');
assert.ok(/export function postInTelegramHtml/.test(F), 'la copia è quella con le esportazioni');
console.log('comunicazione-post: ok');
