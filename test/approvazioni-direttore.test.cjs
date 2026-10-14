// node test/approvazioni-direttore.test.cjs
// (12/10/2026, chiesto dall'utente) Il preventivo 5.D.2 dell'asseverazione esce a firma del Direttore:
// prima di prendere numero, timbro e firma lo approva lui nella pagina Direzione. Qui: il riquadro
// «Preventivi da approvare» c'è, i pulsanti li vede solo il Direttore, «Approvo» si accende dopo
// aver letto la bozza, «Rimando» chiede la nota, e il numero sul pulsante del menu li conta.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = fs.readFileSync(path.join(__dirname, '..', 'direzione.js'), 'utf8').replace(/\r\n/g, '\n');

assert.ok(/async function approvazioniBox\(R, anteprima\)/.test(dir), 'manca il riquadro dei preventivi da approvare');
assert.ok(/try \{ await approvazioniBox\(Rv, _come\); \}/.test(dir), 'la pagina Direzione deve disegnarlo');
assert.ok(/const direttore = !anteprima && R\.direttore;\n\s+const guarda = anteprima === 'direttore' && R\.segr;\n\s+if \(!direttore && !guarda\) \{ host\.innerHTML = ''; return; \}/.test(dir),
  'lo vede solo il Direttore, e la segreteria nell’anteprima «Vedi come… Direttore»');
assert.ok(/\$\{direttore \? `<button class="btn-primary btn-sm" type="button" data-appr-si=/.test(dir), 'i pulsanti di decisione solo al Direttore: alla segreteria il server li rifiuterebbe');
assert.ok(/data-appr-si="\$\{r\.id\}" \$\{letta \? '' : 'disabled/.test(dir) && /_lette\.add\(r\.id\)/.test(dir), '«Approvo» si accende solo dopo aver aperto la bozza');
assert.ok(/createSignedUrl\(percorso, 600\)/.test(dir) && /storage\.from\('approvazioni-direttore'\)/.test(dir), 'la bozza si apre dal bucket privato con un indirizzo a tempo');
assert.ok(/chiama\(\{ azione: 'approva', id: r\.id \}\)/.test(dir) && /chiama\(\{ azione: 'rimanda', id: r\.id, nota: nota\.trim\(\) \}\)/.test(dir), 'decide la funzione approvazione-direttore');
assert.ok(/if \(nota\.trim\(\)\.length < 3\)/.test(dir), 'chi rimanda scrive che cosa cambiare');
assert.ok(/if \(error\) \{\n\s+host\.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>📑 Documenti da approvare<\/h3><p[^>]*>Non sono riuscito a leggere/.test(dir),
  'un errore di lettura si dice, non diventa «niente da approvare»');
assert.ok(/if \(R\.direttore\) \{\n\s+const \{ count \} = await window\.sb\.from\('s_approvazioni_direttore'\)\.select\('id', \{ count: 'exact', head: true \}\)\.eq\('stato', 'in_attesa'\);/.test(dir),
  'il numero sul pulsante «Direzione» conta anche i preventivi in attesa');
// ogni testo che viene dal database passa da esc()
for (const campo of ['r.titolo', 'r.nota', 'error.message']) {
  assert.ok(dir.includes('esc(' + campo + ')'), `${campo} deve passare da esc()`);
}
console.log('approvazioni-direttore: ok');
