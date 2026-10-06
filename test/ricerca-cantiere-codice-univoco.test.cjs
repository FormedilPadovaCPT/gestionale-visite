// node test/ricerca-cantiere-codice-univoco.test.cjs
// (06/10/2026) «NDM-viadellanavigazioneinterna34-CAR: perché non trova questo cantiere tramite il codice univoco che
// invece è presente?» — nessuna ricerca dei cantieri guardava nodo_id (il codice univoco). Ogni ricerca che cerca
// per indirizzo e CNCE deve cercare anche il codice univoco.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
let trovate = 0;
for (const f of ['index.html', 'diniego-accesso.js']) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  const filtri = s.match(/\.or\(`[^`]*cantiere_cnce\.ilike[^`]*`\)/g) || [];
  for (const o of filtri) {
    trovate++;
    assert.ok(/nodo_id\.ilike\./.test(o), f + ': questa ricerca dei cantieri non guarda il codice univoco:\n' + o);
  }
}
assert.ok(trovate >= 6, 'mi aspetto almeno sei ricerche dei cantieri, ne ho trovate ' + trovate);
console.log('ok — le ' + trovate + ' ricerche dei cantieri guardano anche il codice univoco');
