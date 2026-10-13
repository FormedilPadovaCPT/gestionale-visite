// node test/firme-generali.test.cjs
// (13/10/2026, lotto 1 del fascicolo corso digitale) Le firme nell'app non sono più del solo Presidente:
// il riquadro «Da firmare» vive in firme.js e serve anche a RPF e docenti dalla pagina Formazione; la
// tabella è s_firme; un docente esterno (ruolo «docente») entra e vede la sola pagina Formazione.
// Qui si controlla che i pezzi stiano dove devono: se uno manca, la pubblicazione si ferma.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const leggi = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const firme = leggi('firme.js');
const formazione = leggi('formazione.js');
const dir = leggi('direzione.js');
const index = leggi('index.html');
const veste = leggi('veste-v2.js');
const deploy = leggi('.github/workflows/deploy-pages.yml');
const aiuto = leggi('aiuto.js');

// ── firme.js: il riquadro condiviso ──
assert.ok(/window\.firmeApp = \{ box, conta, RUOLI, TIPI \}/.test(firme), 'firme.js espone box e conta');
assert.ok(/\.from\('s_firme'\)/.test(firme) && !/from\('s_firme_presidente'\)/.test(firme), 'firme.js legge s_firme, non il nome vecchio');
assert.ok(/functions\.invoke\('firma-documenti'/.test(firme) && !/'firma-presidente'/.test(firme), 'firma la funzione firma-documenti');
assert.ok(/data-firma-si="\$\{r\.id\}" \$\{letto \? '' : 'disabled/.test(firme) && /_letti\.add\(r\.id\)/.test(firme), '«Firmo» si accende solo dopo aver aperto il documento');
assert.ok(/createSignedUrl\(percorso, 600\)/.test(firme) && /storage\.from\(BUCKET\)/.test(firme) && /const BUCKET = 'firme-presidente'/.test(firme), 'il PDF si apre dal bucket privato con un indirizzo a tempo');
assert.ok(/if \(motivo\.trim\(\)\.length < 3\)/.test(firme), 'chi rimanda scrive il motivo');
assert.ok(/Non sono riuscito a leggere i documenti da firmare: \$\{esc\(error\.message\)\}/.test(firme), 'un errore di lettura si dice, non diventa «niente da firmare»');
assert.ok(/\.ilike\('firmatario_email', email\.replace/.test(firme), 'le righe «mie» si scelgono per firmatario, e «_» nell\'indirizzo non è un jolly');
assert.ok(/r\.ordine > 1 \?/.test(firme), 'una firma dopo la prima dice che il documento porta già le firme precedenti');
for (const campo of ['r.titolo', 'error.message', 'r.rimandata_motivo || \'\'', 'o.titolo']) {
  assert.ok(firme.includes('esc(' + campo + ')'), `${campo} deve passare da esc()`);
}

// ── direzione.js delega al riquadro condiviso ──
assert.ok(/await window\.firmeApp\.box\(host, presidente/.test(dir), 'la pagina Presidenza usa il riquadro di firme.js');
assert.ok(!/from\('s_firme_presidente'\)/.test(dir), 'direzione.js non legge più il nome vecchio della tabella');
assert.ok(/from\('s_firme'\)\.select\('id', \{ count: 'exact', head: true \}\)\.eq\('stato', 'in_attesa'\)/.test(dir), 'il numero sul pulsante Presidenza conta le firme in s_firme');
assert.ok(/const guarda = anteprima === 'presidenza' && R\.segr;/.test(dir) && /\{ ruolo: 'presidente', mie: false, pulsanti: false/.test(dir), 'la segreteria in anteprima vede l\'elenco del Presidente senza pulsanti');

// ── la pagina Formazione ──
assert.ok(/<section id="view-formazione" class="hidden">/.test(index) && /id="form-firme"/.test(index), 'index.html ha la vista Formazione');
assert.ok(/<button data-view="formazione" id="nav-formazione"/.test(index), 'il pulsante del menu c\'è');
assert.ok(/'direzione','formazione','admin'/.test(index), 'navTo conosce la vista formazione');
assert.ok(/if\(view==='formazione'&&window\.formazione\)window\.formazione\.carica\(\)/.test(index), 'navTo la carica');
assert.ok(/window\.formazione = \{ carica, badge, VOCI \}/.test(formazione) && /window\.firmeApp\.box\(\$\('form-firme'\)/.test(formazione), 'formazione.js disegna le mie firme');
assert.ok(/\['is_rpf', 'is_docente', 'is_segreteria'\]/.test(formazione), 'i ruoli li dice il database');

// ── l'accesso del docente ──
assert.ok(/S\.docente=!!\(_roleRow&&_roleRow\.ruolo==='docente'&&_roleRow\.stato==='attivo'\)/.test(index), 'onLogin riconosce il ruolo docente');
const ramo = index.slice(index.indexOf('if(S.docente){'), index.indexOf('if(S.viewer){'));
assert.ok(/obbligaCambioPassword\(\)/.test(ramo) && /navTo\('formazione'\)/.test(ramo) && /b\.dataset\.view==='formazione'\?'':'none'/.test(ramo), 'il docente cambia la password se richiesto, vede solo Formazione e ci atterra');
assert.ok(!/from\('tecnici'\)/.test(ramo), 'il docente non passa dalla scheda tecnico');
assert.ok(index.indexOf('if(S.docente){') < index.indexOf("let{data:tec,error:_tecErr}=await sb.from('tecnici')"), 'il ramo docente viene prima della lettura della scheda tecnico, che chiuderebbe l\'account');
assert.ok(/S\.carica=null;S\.docente=false/.test(index), 'un tecnico che entra dopo un docente nella stessa scheda non resta docente');

// ── la veste ──
assert.ok(/docente:\s+\{ nome: 'Docente',\s+menu: \['formazione'\], apre: 'formazione', lettura: true \}/.test(veste), 'RUOLI.docente: la sola pagina Formazione');
assert.ok(/if \(s\.docente\) return 'docente';/.test(veste), 'ruoloVero riconosce il docente');
assert.ok(/'statistiche', 'formazione'\], apre: 'dashboard' \}/.test(veste), 'il tecnico ha Formazione nel menu');
assert.ok(/formazione: '📚 Formazione'/.test(veste), 'l\'etichetta del menu');

// ── pubblicazione e versioni ──
for (const f of ['firme.js', 'formazione.js']) {
  assert.ok(deploy.includes(`      - '${f}'`), `${f} nei paths di deploy-pages.yml`);
  assert.ok(new RegExp(`for f in [^\\n]*\\b${f.replace('.', '\\.')}\\b`).test(deploy), `${f} nel ciclo che copia in _site`);
  assert.ok(new RegExp(`<script src="${f.replace('.', '\\.')}\\?v=\\d+"></script>`).test(index), `${f} caricato da index.html`);
}
assert.ok(index.indexOf('<script src="firme.js?v=') < index.indexOf('<script src="direzione.js?v='), 'firme.js si carica prima di direzione.js, che lo usa');
const v = (f) => Number((index.match(new RegExp(`<script src="${f}\\?v=(\\d+)"`)) || [])[1] || 0);
assert.ok(v('direzione.js') >= 11, 'direzione.js?v= alzato (riquadro firme spostato)');
assert.ok(v('veste-v2.js') >= 40, 'veste-v2.js?v= alzato (ruolo docente)');
assert.ok(v('aiuto.js') >= 27, 'aiuto.js?v= alzato');
assert.ok(/'v:formazione':/.test(aiuto) && /'nav-formazione':/.test(aiuto), 'la nuvoletta della pagina Formazione');

console.log('firme-generali: ok');
