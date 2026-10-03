// node test/comuni-istat.test.cjs
// (03/10/2026) Il codice ISTAT del comune.
//   · comuni_istat è l'elenco ISTAT dei comuni italiani (supabase/dati/comuni_istat.csv), non più la sola
//     provincia di Padova: un cantiere fuori provincia prende il suo codice;
//   · i comuni soppressi portano il codice del tempo della visita (deciso dall'utente): Carceri e
//     Vighizzolo d'Este fino al 21/01/2024 hanno il loro, dal 22/01/2024 quello di Santa Caterina d'Este;
//   · nella scheda del cantiere, cambiando comune cambia anche il codice.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const radice = path.join(__dirname, '..');
const leggi = (...p) => fs.readFileSync(path.join(radice, ...p), 'utf8');

/* ── il file dei comuni ── */
const righe = leggi('supabase', 'dati', 'comuni_istat.csv').split(/\r?\n/).filter(Boolean);
assert.strictEqual(righe[0], 'cod;nome;prov;regione');
const comuni = righe.slice(1).map((r) => r.split(';'));
assert.ok(comuni.length > 7500 && comuni.length < 8500, 'mi aspetto circa 7.900 comuni, ne trovo ' + comuni.length);
for (const c of comuni) {
  assert.strictEqual(c.length, 4, 'riga con un numero di campi diverso da 4: ' + c.join(';'));
  assert.ok(/^\d{6}$/.test(c[0]), 'codice non di 6 cifre: ' + c.join(';'));
  assert.ok(c[1].trim().length >= 2 && !/"/.test(c[1]), 'nome non valido: ' + c.join(';'));
}
const norm = (s) => s.trim().toUpperCase().replace(/[àÀ]/g, 'A').replace(/[èéÈÉ]/g, 'E').replace(/[ìÌ]/g, 'I').replace(/[òÒ]/g, 'O').replace(/[ùÙ]/g, 'U').replace(/[^A-Z0-9]+/g, ' ').trim();
const perNome = new Map();
for (const c of comuni) { const k = norm(c[1]); assert.ok(!perNome.has(k), 'due comuni che il database confonderebbe: ' + c[1] + ' e ' + (perNome.get(k) || [])[1]); perNome.set(k, c); }
assert.strictEqual(new Set(comuni.map((c) => c[0])).size, comuni.length, 'codici ripetuti');
const cod = (nome) => (perNome.get(norm(nome)) || [])[0];
assert.strictEqual(cod('Padova'), '028060');
assert.strictEqual(cod("Santa Caterina d'Este"), '028108');
assert.strictEqual(cod('Borgo Veneto'), '028107');
assert.strictEqual(cod('DOLO'), '027012');
assert.strictEqual(cod('Bassano del Grappa'), '024012');
assert.strictEqual(cod("Vo'"), '028105');
assert.strictEqual(comuni.filter((c) => c[2] === 'PD').length, 101, 'la provincia di Padova ha 101 comuni');
// i soppressi non sono nell'elenco di oggi: li tiene la tabella, col codice del tempo
for (const n of ['Carceri', "Vighizzolo d'Este", 'Saletto', 'Megliadino San Fidenzio', "Santa Margherita d'Adige"]) assert.strictEqual(cod(n), undefined, n + ' è un comune soppresso');
// gli omonimi restano fuori: dal solo nome non si sa quale sia
for (const n of ['Castro', 'Livo', 'Peglio', 'Samone', 'San Teodoro', 'Paterno']) assert.strictEqual(cod(n), undefined, n + ' è un nome di due comuni');

/* ── il caricatore si ferma se qualcosa non torna, e non tocca i soppressi ── */
const car = leggi('supabase', 'dati', 'carica_comuni_istat.sql');
assert.ok(/\\set ON_ERROR_STOP on/.test(car) && /^begin;/m.test(car) && /^commit;/m.test(car), 'il caricamento deve essere una sola transazione che si ferma al primo errore');
assert.ok(/i\.soppresso_il is null and i\.cod <> c\.cod/.test(car) && /codici diversi da quelli in tabella/.test(car), 'un codice diverso da quello in tabella deve fermare il caricamento');
assert.ok(/i\.soppresso_il is not null[\s\S]{0,200}soppressi/.test(car), 'un comune soppresso ridato per esistente deve fermare il caricamento');
assert.ok(/on conflict \(nome\) do update set prov = excluded\.prov, regione = excluded\.regione, fonte = excluded\.fonte;/.test(car), 'il codice di una riga che c’è già non si riscrive');
const wf = leggi('.github', 'workflows', 'carica-comuni.yml');
assert.ok(/paths:\s+- 'supabase\/dati\/comuni_istat\.csv'\s+- 'supabase\/dati\/carica_comuni_istat\.sql'/.test(wf), 'il caricamento deve partire solo quando cambia l’elenco dei comuni');
assert.ok(/psql "\$DB_URL" -v ON_ERROR_STOP=1 -f supabase\/dati\/carica_comuni_istat\.sql/.test(wf));

/* ── il codice a una data ── */
const sql = leggi('supabase', 'sql', '2026_10_03_comuni_istat_completo.sql');
assert.ok(/case when i\.soppresso_il is not null and coalesce\(p_data, current_date\) >= i\.soppresso_il then i\.cod_attuale else i\.cod end/.test(sql), 'fino al giorno prima della fusione vale il codice del comune, dopo quello del comune nuovo');
assert.ok(/set cod = '028022', soppresso_il = date '2024-01-22', cod_attuale = '028108'/.test(sql), 'Carceri');
assert.ok(/revoke execute on function public\.calcola_comune_cod_al\(text, date\) from public, anon/.test(sql));
const ctrl = leggi('supabase', 'sql', '2026_10_03_osservatorio_controllo.sql');
assert.ok(/\('comune-soppresso',\s+'cantiere', false,/.test(ctrl), 'il codice non valido alla data della visita è un avviso del controllo');
assert.ok(/calcola_comune_cod_al\(c\.comune_nome, cd\.d1\)/.test(ctrl) && /calcola_comune_cod_al\(c\.comune_nome, cd\.d2\)/.test(ctrl));

/* ── la scheda del cantiere: cambiando comune cambia il codice ── */
const html = leggi('index.html');
const cambio = html.match(/sel\.onchange=\(\)=>\{[\s\S]*?\r?\n  \}/);
assert.ok(cambio, 'non trovo il cambio di comune nella scheda del cantiere');
assert.ok(/if\(codEl\)\{codEl\.value=istat\}/.test(cambio[0]), 'cambiando comune il codice deve diventare quello del comune scelto');
assert.ok(!/if\(codEl&&!codEl\.value\)/.test(cambio[0]), 'il codice del comune di prima non deve restare');

console.log('comuni-istat: ok (' + comuni.length + ' comuni)');
