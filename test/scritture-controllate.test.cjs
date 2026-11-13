// (13/11/2026) NESSUNA SCRITTURA CON L'ESITO NON LETTO nel gestionale.
// supabase-js non lancia quando il database rifiuta: restituisce `error`. Un
// `await sb.from(...).update(...)` il cui risultato non viene assegnato dice «fatto» anche
// quando non è vero. Le ultime 9 sono state corrette il 13/11/2026; questa prova fallisce
// se ne ricompare una, in index.html o in un modulo. Le scritture passano da `scrivi(q, cosa)`
// oppure leggono `error` da sé.
// Il gestionale non usa i punti e virgola: l'istruzione finisce al «;» o a fine riga a
// parentesi bilanciate (se la riga dopo non continua con un punto).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const radice = path.resolve(__dirname, '..');

function fineIstruzione(t, i) {
  let liv = 0;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if ('([{'.includes(c)) liv++;
    else if (')]}'.includes(c)) { liv--; if (liv < 0) return j - 1; }
    else if (liv === 0 && c === ';') return j;
    else if (liv === 0 && c === '\n') { if (!/^\s*\./.test(t.slice(j + 1, j + 40))) return j; }
    else if (c === '\'' || c === '"' || c === '`') {
      const q = c; j++;
      while (j < t.length && t[j] !== q) { if (t[j] === '\\') j++; j++; }
    }
  }
  return t.length - 1;
}
function scrittureNonControllate(t) {
  const out = [];
  const re = /await\s+(?:window\.)?sb\s*\.\s*(from|rpc)\(/g;
  let m;
  while ((m = re.exec(t))) {
    let k = m.index - 1;
    while (k >= 0 && ' \t'.includes(t[k])) k--;
    const prima = t.slice(Math.max(0, k - 60), k + 1);
    // il risultato è assegnato, restituito o passato a qualcosa (scrivi(…), Promise.all([…]), …)
    if (/(=|return|\(|,|\[|:|\?|&&|\|\||await)$/.test(prima) && !/(\)|else|\{|;|\})$/.test(prima)) continue;
    const istr = t.slice(m.index, fineIstruzione(t, m.index) + 1);
    if (m[1] === 'from' && !/\.(insert|update|delete|upsert)\(/.test(istr)) continue;   // una lettura buttata non fa danni
    if (m[1] === 'rpc') continue;                                                    // le funzioni: vedi nota in fondo
    out.push({ riga: t.slice(0, m.index).split('\n').length, testo: istr.replace(/\s+/g, ' ').slice(0, 110) });
  }
  return out;
}

// la prova sa fallire
const rotto = "async function f(){\n  await sb.from('x').update({a:1}).eq('id',1)\n  if(y) await sb.from('x').delete().eq('id',2)\n  await window.sb.from('x')\n    .insert({a:1})\n}";
assert.strictEqual(scrittureNonControllate(rotto).length, 3, 'il rilevatore non vede le scritture non controllate');
const sano = "async function f(){\n  const{error}=await sb.from('x').update({a:1}).eq('id',1)\n  await scrivi(sb.from('x').delete().eq('id',2),'x')\n  await sb.from('x').select('*')\n}";
assert.deepStrictEqual(scrittureNonControllate(sano), []);

const colpevoli = [];
const file = ['index.html'].concat(fs.readdirSync(radice).filter((n) => n.endsWith('.js') && n !== 'sanzioni-voci.js'));
for (const f of file) {
  for (const s of scrittureNonControllate(fs.readFileSync(path.join(radice, f), 'utf8'))) colpevoli.push(f + ':' + s.riga + ' ' + s.testo);
}
assert.deepStrictEqual(colpevoli, [], 'scritture il cui esito non viene letto: passale da scrivi(q, cosa) o leggi error');
assert.ok(/async function scrivi\(q,cosa\)\{const\{data,error\}=await q;if\(error\)throw new Error/.test(fs.readFileSync(path.join(radice, 'index.html'), 'utf8')),
  'scrivi() non trovata in index.html');
console.log('scritture-controllate: ' + file.length + ' file, nessuna scrittura con l\'esito non letto');
// Nota: le chiamate a funzioni del database (sb.rpc) non sono contate qui — nel gestionale
// quelle che scrivono restituiscono un esito che il codice legge, e contarle tutte darebbe
// falsi allarmi sulle funzioni di sola lettura chiamate per il loro effetto sulla pagina.
