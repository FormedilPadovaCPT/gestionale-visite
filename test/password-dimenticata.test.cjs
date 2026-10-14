// «Password dimenticata?» (14/10/2026): il giro nella schermata di accesso e la funzione che manda il codice.
// Prove sulla forma del sorgente: la funzione gira solo su Supabase, e il giro vero (codice per mail,
// verifyOtp, updateUser) è stato provato sul sito con l'account della segreteria.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const qui = __dirname;
const html = fs.readFileSync(path.join(qui, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const aiuto = fs.readFileSync(path.join(qui, '..', 'aiuto.js'), 'utf8');
const fnPath = path.join(qui, '..', '..', 'segreteria-app', 'supabase', 'functions', 'password-dimenticata', 'index.ts');
let n = 0;
const prova = (nome, f) => { f(); n += 1; console.log('ok -', nome); };

prova('la schermata di accesso ha il link e i campi', () => {
  for (const id of ['link-pwd-dimenticata', 'box-recupero', 'rp-email', 'btn-rp-codice', 'rp-passo2', 'rp-codice', 'rp-nuova', 'rp-ripeti', 'btn-rp-salva']) {
    assert.ok(html.includes(`id="${id}"`), `manca #${id}`);
  }
  for (const id of ['link-pwd-dimenticata', 'btn-rp-codice', 'btn-rp-salva']) assert.ok(aiuto.includes(`'${id}':`), `nuvoletta ${id}`);
});

prova('il giro: codice per mail, verifica, password nuova, richiesta di cambio chiusa', () => {
  const i = html.indexOf("$('btn-rp-salva')?.addEventListener");
  assert.ok(i > 0);
  const js = html.slice(i, i + 3000);
  assert.match(html, /sb\.functions\.invoke\('password-dimenticata',\{body:\{email:em\}\}\)/);
  assert.ok(js.indexOf('S.cambioPwd=true') < js.indexOf('verifyOtp'), 'onAuthStateChange non deve aprire l\'app prima del cambio');
  assert.match(js, /sb\.auth\.verifyOtp\(\{email:em,token:cod,type:'recovery'\}\)/);
  assert.match(js, /sb\.auth\.updateUser\(\{password:p1\}\)/);
  assert.match(js, /sb\.rpc\('password_cambiata'\)/);
  assert.match(js, /if\(p1\.length<10\)/, 'stesse regole del cambio obbligatorio');
  assert.match(js, /await sb\.auth\.signOut\(\)/, 'se la password non cambia, si esce');
});

prova('la funzione: stessa risposta per tutti, codice da Supabase senza la sua mail, mail dalla casella dell\'ente', { skip: false } && (() => {
  if (!fs.existsSync(fnPath)) { console.log('  (segreteria-app non è accanto: saltata)'); return; }
  const fn = fs.readFileSync(fnPath, 'utf8');
  assert.match(fn, /sb\.rpc\('recupero_password_ammesso'/);
  assert.match(fn, /sb\.auth\.admin\.generateLink\(\{ type: 'recovery', email \}\)/);
  assert.match(fn, /if \(ammesso !== 'ok'\) \{\s*await registra\('sconosciuto'\)\s*return json\(\{ ok: true, messaggio: RISPOSTA \}\)/, 'indirizzo sconosciuto: risposta uguale');
  assert.match(fn, /oggettoUfficio\('Codice per scegliere una nuova password'\)/);
  assert.match(fn, /gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/send/);
  assert.doesNotMatch(fn, /resetPasswordForEmail/, 'non si usa la mail di Supabase');
}));

console.log(`${n} prove passate`);
