// node test/comuni-soppressi.test.cjs
// (07/10/2026, chiesto dall'utente: «dall'elenco comuni che posso scegliere per le nuove visite bisognerebbe togliere i
// vecchi comuni che ora son fusi in un altro».) Saletto, Megliadino San Fidenzio e Santa Margherita d'Adige sono
// Borgo Veneto dal 17/02/2018; Carceri e Vighizzolo d'Este sono Santa Caterina d'Este dal 22/01/2024. La tendina dei
// cantieri nuovi non li elenca; le schede che li hanno già li mostrano «com'è scritto» con il comune in cui sono
// confluiti, e aprire e salvare non cambia niente.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const dati = fs.readFileSync(path.join(dir, 'app-data.js'), 'utf8');

const ctx = {}; vm.createContext(ctx);
vm.runInContext(dati + '\nthis.PD=COMUNI_PD;this.CAP=CAP_PD;this.ISTAT=ISTAT_PD;this.SOPP=COMUNI_SOPPRESSI;this.conf=comuneConfluito;', ctx);
const vecchi = ['Saletto', 'Megliadino San Fidenzio', 'Santa Margherita d\'Adige', 'Carceri', 'Vighizzolo d\'Este'];
vecchi.forEach((v) => assert.ok(!ctx.PD.includes(v), 'la tendina non elenca più ' + v));
['Borgo Veneto', 'Santa Caterina d\'Este', 'Megliadino San Vitale', 'Padova'].forEach((v) => assert.ok(ctx.PD.includes(v), 'la tendina elenca ' + v));
assert.ok(ctx.CAP['Carceri'] === '35040' && ctx.CAP['Vighizzolo d\'Este'] === '35040', 'il CAP dei soppressi resta per le schede che li hanno');
assert.ok(!ctx.ISTAT['Carceri'], 'il codice ISTAT di un comune soppresso non si propone');
assert.strictEqual(Object.keys(ctx.SOPP).length, 5);
/* gli oggetti nati nel vm hanno un altro prototipo: si confrontano come JSON */
const j = (x) => JSON.stringify(x);
assert.strictEqual(j(ctx.conf('CARCERI')), j({ in: 'Santa Caterina d\'Este', dal: '2024-01-22' }), 'il nome si riconosce anche maiuscolo');
assert.strictEqual(j(ctx.conf('Vighizzolo d Este')), j({ in: 'Santa Caterina d\'Este', dal: '2024-01-22' }), 'anche senza apostrofo');
assert.strictEqual(j(ctx.conf('Santa Margherita d\'Adige')), j({ in: 'Borgo Veneto', dal: '2018-02-17' }));
assert.strictEqual(ctx.conf('Borgo Veneto'), null, 'un comune attuale non è confluito in niente');
assert.strictEqual(ctx.conf('Este'), null);

/* la scheda di un cantiere che ha ancora il comune vecchio: la tendina lo mostra com'è scritto, con dove è confluito */
assert.ok(/const _conf = typeof comuneConfluito === 'function' \? comuneConfluito\(_cn\) : null/.test(html), 'Modifica cantiere riconosce il soppresso');
assert.ok(/\(com\\'è scritto: dal ' \+ fmtDate\(_conf\.dal\) \+ ' è ' \+ _conf\.in \+ '\)'/.test(html), 'e dice dove è confluito senza cambiarlo');
/* un cantiere nuovo proposto da un incarico con un comune vecchio: si propone quello attuale, dicendolo */
assert.ok(/è '\+_conf\.in\+': proposto quello'/.test(html), 'cantiere nuovo da incarico: proposto il comune attuale');
assert.ok(/<script src="app-data\.js\?v=14"><\/script>/.test(html), 'versione dei dati alzata');

console.log('ok — comuni soppressi fuori dalla tendina, dentro le schede che li hanno');
