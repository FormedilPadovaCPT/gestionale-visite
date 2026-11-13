# Estrarre un blocco dal file centrale (`index.html`)

Metodo usato il 13/11/2026 per `esportazioni.js` (secondo modulo, dopo `osservatorio.js`). Si sposta il codice senza cambiarne una riga, dentro una fabbrica che riceve le dipendenze per nome.

1. **Confini del blocco**: righe di inizio e fine, su dichiarazioni di primo livello.
2. **Analisi**: `python tools/analizza_blocco.py <riga_da> <riga_a>` elenca che cosa il blocco usa dal resto del modulo, che cosa il resto usa del blocco, e segnala le dipendenze riassegnate altrove (serve un getter) o dichiarate dopo il blocco (zona morta).
3. **Controllo dei nomi**: l'analisi non vede tutto (il 13/11 aveva saltato `_figSnap`, dichiarato con una destrutturazione). Dopo l'estrazione si passa il file nuovo al compilatore TypeScript dell'asseverazione, che elenca i nomi non trovati:
   `npx tsc --allowJs --checkJs --noEmit --target es2022 --lib es2022,dom --skipLibCheck <file>` (dalla cartella `webapp-asseverazione`).
   I nomi che restano devono essere globali veri della pagina (`XLSX`, quelli di `app-data.js`): ogni altro è una dipendenza da passare.
4. **Nel file centrale** resta la chiamata della fabbrica, nello stesso punto del blocco, e l'`import` in testa al modulo con `?v=1`.
5. **Pubblicazione**: il file nuovo va nelle due liste di `.github/workflows/deploy-pages.yml` (`paths` e copia in `_site`). `test/moduli-pubblicati.test.cjs` fallisce se manca.
6. **Prove**: tutte le `test/*.test.cjs`. Quelle che leggono il testo del blocco da `index.html` vanno fatte leggere anche dal file nuovo.
7. **Verifica nel browser** dopo la pubblicazione: la prova automatica dice se l'app parte; le funzioni del blocco si provano a mano. Per le esportazioni si sostituisce `XLSX.writeFile` con una funzione che registra nome e fogli, così non si scarica niente.

8. **L'analisi sbaglia per eccesso sui nomi corti**: una `const S` o `s` locale in un'altra funzione fa dire «riassegnata altrove» o inventa una dipendenza. Si guarda la riga indicata prima di aggiungere un getter.
9. **Le prove che usano l'inizio del blocco come fine di quello prima** (es. «da `admGeneraReport` a `admGeneraReportOsservatorio`») vanno chiuse su un segno che resta nel file centrale (`window.admGeneraReport = …`).

Fatti: `esportazioni.js` (13/11/2026), `report-osservatorio.js` (13/11/2026, 934 righe).

Blocchi adatti, in ordine: ~~report Osservatorio~~, regole statistiche pure, report attività, committenti, pagina del coordinatore. Da non toccare: salvataggio e maschera del verbale, invio e PDF, accesso.
