/* ============================================================
   AIUTO AL PASSAGGIO DEL MOUSE — Gestionale Visite
   (23/09/2026, chiesto dall'utente: «in Access, fermandomi col
   mouse su un tasto, si apriva un pop che spiegava che cosa
   succedeva se lo premevo»)

   Come funziona: ci si ferma mezzo secondo col mouse su un pulsante,
   una voce del menu o un collegamento, e compare una nuvoletta di due
   righe che dice CHE COSA SUCCEDE se si preme. Sul telefono si tiene
   premuto il dito per mezzo secondo. Si sposta il mouse o si tocca
   altrove e sparisce. Non cambia niente del funzionamento: è solo una
   spiegazione.

   Da dove viene il testo, in quest'ordine:
     1. l'attributo data-aiuto="…" messo sull'elemento;
     2. il dizionario qui sotto, per id (es. «btn-final»);
     3. il dizionario per testo del pulsante, chiave «t:» + testo
        normalizzato (senza emoji, minuscolo) — per i pulsanti senza id;
     4. per prefisso del testo, chiave «p:» (per i pulsanti il cui
        testo cambia: «Mostra tutti i 37 cantieri»);
     5. per voce di menu, chiave «v:» + data-view;
     6. l'attributo title, se c'è (la nuvoletta lo mostra al posto del
        fumetto grigio del browser).
   Per aggiungere una spiegazione basta una riga nel dizionario: non
   si tocca il resto dell'app. Lo stesso file, con un altro dizionario,
   sta nell'app segreteria (js/aiuto.js); nell'asseverazione è un
   componente React (src/components/Aiuto.tsx) con la stessa logica.
   ============================================================ */

window.AIUTO_TESTI = {
  /* ── cambio password obbligatorio (27/09/2026) ── */
  'btn-pwd-salva': 'Sostituisce subito la tua password con quella nuova e apre l\'app. Da ora entri solo con la nuova: la vecchia non vale più, e la richiesta della segreteria si chiude.',
  'link-pwd-esci': 'Esci senza cambiare la password: torni alla schermata di accesso, e al prossimo ingresso il cambio ti verrà chiesto di nuovo.',
  /* ── menu ── */
  'v:dashboard': 'Torna alla pagina iniziale: pulsanti rapidi, avvisi, il tuo obiettivo del mese e la mappa dei cantieri aperti con l\'IPC dell\'ultima visita.',
  'v:statistiche': 'Contatori, grafici e tabelle delle visite (per esercizio, tecnico, IPC, comuni, imprese ricorrenti). Si calcolano quando apri la scheda.',
  'f-note-for-sn': 'Con la casella spuntata, quando mandi il verbale l\'impresa riceve nella stessa mail le prossime date dei corsi che mancano, con la quota vera (gratuita o scontata per le imprese iscritte alla Cassa Edile), e l\'ufficio corsi riceve da solo una segnalazione con i contatti dell\'impresa e la tua nota.',
  'f-note-for-tipi': 'Quale formazione manca: spunta una o più voci. Servono a scegliere i corsi da proporre all\'impresa; la nota qui sotto la legge solo l\'ufficio corsi, non l\'impresa: scrivi liberamente.',
  'v:direzione': 'La pagina della Direzione: autorizzazioni dei servizi CPT in attesa del visto, conferme richieste sui cantieri critici e le questioni aperte da coordinatore e segreteria, con i giorni di attesa. Si risponde da qui.',
  'nav-direzione': 'La pagina della Direzione: autorizzazioni dei servizi CPT in attesa del visto, conferme richieste sui cantieri critici e le questioni aperte da coordinatore e segreteria, con i giorni di attesa. Si risponde da qui.',
  'v:appuntamenti': 'Il calendario d\'ufficio, alimentato dalla segreteria: date di attività, commissioni e altri impegni utili. Lo vede solo il Direttore.',
  'nav-appuntamenti': 'Il calendario d\'ufficio, alimentato dalla segreteria: date di attività, commissioni e altri impegni utili. Lo vede solo il Direttore.',
  'card-k-ceivmin': 'Visite fatte nell\'esercizio scelto (tutti i tecnici) contro il minimo della regola CEIV: 100 visite ogni 50.000 euro di contributi Cassa Edile. Il minimo lo imposta la segreteria nella sua Zona.',
  'v:form': 'Apre un verbale nuovo. Dal telefono ti propone i cantieri vicino a te; il numero del verbale nasce dal giorno di apertura e non si assegna due volte.',
  'v:lista': 'L\'elenco dei tuoi verbali, bozze comprese. Da ogni riga apri la scheda, il PDF, la mail all\'impresa o una visita di ritorno.',
  'v:cantieri': 'Tutti i cantieri conosciuti, con stato e ultima visita. Da qui parte la mappa, il navigatore e il giro a tappe.',
  'v:rubrica': 'Imprese, persone e committenti che l\'app conosce. Serve per correggere un nome scritto male o unire due schede doppie.',
  'v:scadenze': 'I cantieri con non conformità da rivedere: la regola Formedil calcola quando tornare. Dal telefono li vedi sulla mappa.',
  'v:incarichi': 'Le visite che la segreteria ti ha assegnato: serie di visite, richieste delle imprese, stage, segnalazioni. Si accettano o si rifiutano da qui.',
  'nav-assev': 'Apre in un\'altra scheda l\'app dell\'asseverazione MOG. Il gestionale resta aperto qui: le visite si registrano sempre in questa app, le pratiche di asseverazione nell\'altra.',
  'nav-admin': 'La Zona Coordinatore: statistiche su un periodo a scelta, bacheca avvisi, fatture dei tecnici da approvare e cantieri critici.',
  'nav-committenti': 'L\'anagrafica dei committenti, con la ricerca dei duplicati e l\'unione delle schede.',
  'nav-segreteria': 'Le funzioni della segreteria: riapertura dei verbali definitivi, chiusura dei cantieri, importazioni e report.',
  'btn-manuale': 'Scarica il manuale d\'uso nell\'ultima versione pubblicata. Non serve tenerne una copia: qui trovi sempre quello aggiornato.',
  'btn-firme': 'Le firme scansionate dei tecnici, quelle che finiscono sui verbali in PDF. Ognuno vede e cambia solo la propria.',
  'btn-logout': 'Esci dall\'app su questo dispositivo. Le bozze salvate restano; quello che stavi scrivendo senza salvare no.',

  /* ── dashboard ── */
  'btn-segnala-dash': 'Segnala alla segreteria un cantiere attivo che hai visto passando: prende la posizione dal GPS e apre una scheda breve. Non è un verbale.',
  'btn-dove-sono': 'Legge il GPS e ti dice indirizzo, comune e quartiere di Padova in cui sei. Non salva niente: da lì puoi prendere un appunto sul posto.',
  'btn-appunti': 'I tuoi appunti di cantiere, con l\'indirizzo preso dal GPS: li vedi solo tu, e li rileggi a casa quando scrivi il verbale.',
  'ap-salva': 'Salva l\'appunto a tuo nome: lo vedi solo tu. Se manca la linea non si perde: il testo resta nel telefono e riprovi.',
  'ap-elimina': 'Elimina l\'appunto e le sue foto: dall\'app non si recupera (le foto vanno nel cestino di Drive).',
  'ap-foto-btn': 'Scatta o scegli una o più foto: vanno su Drive senza link pubblico e le vedi solo tu. Se l\'appunto non è ancora salvato, lo salva prima.',
  'btn-qr-servizi':'Mostra sullo schermo il codice QR del portale servizi, da far inquadrare all\'impresa in cantiere: da lì l\'impresa manda richieste e segnalazioni.',
  'btn-servizi-cpt': 'Apre il portale servizi pubblico, quello che vedono le imprese.',
  't:registra una visita stage senza verbale': 'Per gli stage fuori provincia, dove non si fa il verbale: registra che la visita è stata fatta, così l\'incarico si chiude e la visita conta.',
  't:la mia zona': 'Filtra i cantieri sulla tua zona di competenza.',
  'ntf-attiva': 'Chiede al telefono il permesso di mandarti notifiche: nuovo incarico, avviso del coordinatore, risposta dell\'ufficio, fattura pagata. Le mail restano, questo è in più.',
  'ntf-prova': 'Manda una notifica di prova a questo dispositivo e aspetta che confermi di averla mostrata: se non arriva, quasi sempre è una modalità del telefono che le blocca.',
  'ntf-spegni': 'Spegne le notifiche su questo dispositivo. Sugli altri tuoi dispositivi restano come sono.',
  'ntf-installa': 'Mette l\'icona «Visite» sulla schermata del telefono: si apre come un\'app, senza passare dal browser.',

  /* ── verbale ── */
  'btn-new-cant': 'Crea un cantiere nuovo in anagrafica. Prima cerca: se esiste già, meglio usarlo che crearne un doppione.',
  'btn-edit-cant': 'Corregge e completa i dati del cantiere selezionato: indirizzo, comune, tipo di intervento e di opera, durata, importo, committente, posizione. Vale per tutte le visite di quel cantiere, anche quelle passate. Con la scheda incompleta il verbale non si chiude.',
  'btn-ora-inizio': 'Riscrive nel campo l\'ora di adesso. L\'ora di inizio si compila da sola quando apri il verbale nuovo: se la visita è cominciata a un\'altra ora, correggila.',
  'btn-ora-fine': 'Scrive l\'ora di adesso come ora di fine della visita. Se lasci il campo vuoto e chiudi il verbale nel giorno della visita, ci va l\'ora in cui lo chiudi.',
  'btn-imp-senza-cf': 'Elenca le imprese che compaiono in almeno un verbale e non hanno il codice fiscale, dalla visita più recente. Solo lettura: non cambia niente finché non premi «Salva» su una riga.',
  't:= p.iva': 'Copia la partita IVA nel campo del codice fiscale: per una società di norma coincidono. Non salva: se è giusto, premi «Salva».',
  'btn-new-comm': 'Crea un committente nuovo. Cerca prima per nome: i doppioni poi vanno uniti a mano.',
  'btn-edit-comm': 'Completa o corregge i dati del committente selezionato.',
  'btn-save-comm': 'Salva le modifiche al committente.',
  'btn-clear-comm': 'Toglie il committente dal verbale senza cancellarlo dall\'anagrafica.',
  'btn-add-lav': 'Aggiunge un lavoratore incontrato in cantiere: nome, impresa, qualifica. Se è già in anagrafica lo ritrovi scrivendo il cognome.',
  'btn-add-imp': 'Aggiunge un\'altra impresa presente in cantiere (subappalto, lavoratori autonomi). La prima è l\'affidataria.',
  'btn-foto-upload-all': 'Carica su Drive tutte le foto del verbale, nella cartella del cantiere. Le foto restano sul telefono finché non sono caricate.',
  'btn-bozza': 'Salva il verbale come bozza: lo ritrovi in «Visite» e lo puoi completare dopo. Non parte niente all\'impresa.',
  'btn-final': 'Salva il verbale e prova a chiuderlo come definitivo. Se manca qualcosa di obbligatorio resta bozza e compare l\'elenco di tutto ciò che manca: tocchi una riga e vai al campo. Chiuso, non si modifica più (solo la segreteria può riaprirlo) e va al coordinatore per il controllo.',
  'btn-pdf': 'Genera il PDF del verbale con la tua firma e il logo dell\'ente. Dalla bozza esce con la scritta «bozza».',
  'f-prot-inc': 'Scegli l\'incarico da cui nasce la visita: lo accetti, e si compilano da soli numero della richiesta, impresa e cantiere (se la segreteria li ha indicati). Se ne avevi già scelti altri, ti chiede prima di sostituirli.',
  'btn-email-verbale': 'Prepara la mail all\'impresa con il verbale allegato. Se la mail torna indietro, lo vedi in Dashboard nel riquadro dei verbali non consegnati.',
  't:tutto ver': 'Mette «verificato» su tutte le voci della macroarea in un colpo: poi correggi solo quelle non conformi.',
  'btn-prev': 'Torna al passo precedente del verbale. Quello che hai scritto resta.',
  'btn-next': 'Va al passo successivo. I campi obbligatori mancanti vengono segnalati.',
  'btn-rett-si': 'Rimanda all\'impresa il verbale corretto, segnando che è una rettifica del precedente.',
  'btn-rett-no': 'Salva la correzione senza rimandare niente all\'impresa.',
  'btn-ev-extra': 'Aggiunge ai destinatari un indirizzo che non è fra le figure del verbale. Parte insieme agli altri; lo togli con ✕ prima dell\'invio.',
  'btn-ev-invia': 'Manda adesso la mail con il verbale.',

  /* ── visite e cantieri ── */
  'btn-cerca': 'Cerca fra i tuoi verbali per impresa, cantiere, comune o numero.',
  /* ── ricerca fra i cantieri: quello che c'è ma non si vede (30/09/2026) ── */
  't:mostra anche i chiusi': 'La ricerca ha trovato cantieri chiusi, che di norma l\'elenco non mostra. Spunta «Includi chiusi 🔒» e rifà la ricerca: li riconosci dal lucchetto. Non riapre nessun cantiere.',
  't:togli i filtri': 'Alcuni cantieri trovati sono nascosti dai filtri (la tua zona, i comuni, il tipo di opera…). Li azzera e passa a tutta la provincia, comprese le sedi fuori provincia; la ricerca resta.',
  /* ── stato dell'invio nell'elenco Visite (30/09/2026) ── */
  'q-dainviare': 'Lascia nell\'elenco solo i verbali definitivi che non risultano ancora mandati all\'impresa. Premilo di nuovo per rivedere tutte le visite.',
  't:da inviare': 'Questo verbale è definitivo ma non è ancora partito. Apre la finestra di invio con i destinatari: la mail parte solo quando premi «Invia», e qui compare la spunta verde con la data.',
  'btn-nuovo-cant-lista': 'Crea un cantiere nuovo senza aprire un verbale.',
  'btn-cerca-cant': 'Cerca un cantiere per indirizzo, comune, impresa o codice.',
  'btn-tutti-cant': 'Toglie i filtri e mostra l\'elenco completo.',
  'p:mostra tutti i': 'L\'elenco è tagliato per non appesantire la pagina: questo lo completa.',
  't:giro a tappe sul navigatore': 'Manda al navigatore del telefono i cantieri spuntati, nell\'ordine più breve partendo da dove sei.',
  'btn-fondi-sel': 'Unisce i cantieri spuntati in uno solo: le visite di tutti passano sul cantiere che scegli come principale. Non si torna indietro da soli: chiedi alla segreteria se hai dubbi.',
  't:nuova visita di ritorno': 'Apre un verbale nuovo già compilato con cantiere, imprese e le non conformità da rivedere: si controlla se sono state chiuse.',
  't:riapri': 'Riporta il verbale a bozza per correggerlo. Solo la segreteria può farlo su un verbale definitivo.',
  't:chiudi cantiere (fine lavori)': 'Segna il cantiere come finito: sparisce dalle scadenze e dai cantieri attivi. Le visite fatte restano.',
  'p:chiudi cantiere': 'Segna il cantiere come finito: sparisce dalle scadenze e dai cantieri attivi. Le visite fatte restano.',
  /* codice univoco del cantiere (codice-univoco.js, 23/09/2026) */
  'btn-cod-uni-proponi': 'Propone il codice univoco del cantiere: iniziali del tecnico, strada e civico, sigla dell\'impresa principale. Lo correggi prima di salvarlo; se il cantiere ha già un codice non lo tocca.',
  'btn-mc-cod-uni-proponi': 'Scrive nel campo il codice proposto: iniziali del tecnico, strada e civico, sigla dell\'impresa principale. Correggilo se serve: si salva insieme al cantiere.',
  /* proposta di chiusura (proposte-chiusura.js, 23/09/2026) */
  't:proponi chiusura': 'Dici alla segreteria che il cantiere è finito, con due parole sul perché. Non chiude niente: decide la segreteria, e fino ad allora il cantiere resta attivo.',
  't:proponi chiusura alla segreteria': 'Dici alla segreteria che il cantiere è finito, con due parole sul perché. Non chiude niente: decide la segreteria, e fino ad allora il cantiere resta attivo.',
  't:respingi la proposta': 'Il cantiere resta aperto. Ti chiede il motivo, che resta scritto accanto alla proposta per chi l\'ha fatta.',
  't:apri scheda': 'Apre la scheda del cantiere: dati, visite fatte e pulsanti per una nuova visita.',
  'btn-mc-geo-gps': 'Prende la posizione dal GPS del dispositivo e la mette sul cantiere: fallo quando sei sul posto.',
  'btn-mc-geo-auto': 'Azzera la posizione: l\'app la ricalcola dall\'indirizzo scritto.',
  'btn-mc-geo-open': 'Apre la posizione in Google Maps per controllarla.',
  'btn-mc-geo-paste': 'Applica le coordinate incollate dal navigatore o da Maps.',
  'btn-mc-save': 'Salva il cantiere.',
  'btn-mi-save': 'Salva l\'impresa. La partita IVA è la chiave: se esiste già, l\'app ti propone la scheda esistente.',
  /* ── dati ufficiali dell'impresa (03/10/2026) ── */
  'btn-mi-ufficiali': 'Cerca la P.IVA o il codice fiscale scritti qui sopra in InfoCamere (società, lun-ven 8-18) e in VIES (sempre). Ti mostra i dati ufficiali accanto ai tuoi: scegli tu che cosa riportare, e poi salvi.',
  'btn-ei-ufficiali': 'Confronta la scheda con i dati ufficiali di InfoCamere (società, lun-ven 8-18) e VIES (sempre). Riporti solo quello che spunti, e non salva da solo. Il codice fiscale, che è la chiave, da qui non si cambia.',
  'btn-ei-save': 'Salva le modifiche all\'impresa.',
  'btn-ec-save': 'Salva le modifiche al cantiere.',
  'btn-mc-comm-save': 'Salva il committente.',

  /* ── rubrica ── */
  'rub-dedup-btn': 'Cerca le persone che sembrano la stessa (nome simile, stessa impresa) e le propone da unire. Decidi tu; «Non sono duplicati» ferma la proposta per sempre.',
  'btn-rub-unisci': 'Unisce le schede spuntate sulla principale: i verbali che le citavano passano tutti sulla scheda che resta.',
  'btn-comm-dup': 'Evidenzia i committenti con nome simile, per unirli.',
  't:non sono duplicati': 'Conferma che sono persone diverse: l\'app non le proporrà più da unire.',

  /* ── incarichi ── */
  't:fai la visita': 'Accetta l\'incarico e apre subito il verbale con cantiere, impresa e, per gli stage, l\'allievo già compilati.',
  't:accetto': 'Accetti l\'incarico: la segreteria lo vede e l\'incarico passa fra quelli da fare.',
  't:non posso': 'Rifiuti l\'incarico dicendo il motivo: torna alla segreteria, che lo riassegna.',
  't:relazione': 'Per le visite stage: compila la relazione della visita, chiude l\'incarico e la manda alla Scuola.',
  't:completato': 'Chiude l\'incarico come fatto. Se c\'è un verbale collegato, si chiude da solo quando il verbale è definitivo.',
  't:riassegna': 'Passa l\'incarico a un altro tecnico. Chi lo riceve lo trova nei suoi incarichi e, se ha le notifiche, gli arriva un avviso.',
  'inc-f-reset': 'Toglie i filtri dell\'elenco incarichi.',
  't:presa visione': 'Segna che hai letto l\'avviso del coordinatore: sparisce dalla tua Dashboard.',

  /* ── segnalazioni e accesso negato ── */
  'segn-salva': 'Manda la segnalazione alla segreteria, con posizione e foto. Da lì può nascere una richiesta di visita.',
  'srel-solopdf': 'Mostra la relazione in PDF senza chiudere l\'incarico né inviare niente.',
  'srel-salva': 'Salva la relazione, chiude l\'incarico e la manda alla Scuola: dopo non si modifica.',
  'din-salva': 'Registra l\'accesso negato: la segreteria lo riceve e apre il caso fra i cantieri critici, con la lettera all\'impresa già pronta.',
  'qr-servizi-invia': 'Manda all\'impresa il link del portale servizi per mail, invece di far inquadrare il QR.',

  /* ── coordinatore ── */
  't:approva': 'Approva la fattura del tecnico: passa all\'Amministrazione per il mandato di pagamento. Prima controlla i verbali del mese.',
  't:stand-by': 'Ferma la fattura: il mandato non viene generato finché non risolvi con il tecnico. Il motivo resta scritto.',
  't:aggiorna statistiche': 'Ricalcola i contatori sul periodo scelto.',
  't:pubblica': 'Pubblica l\'avviso in bacheca: tutti i tecnici lo vedono in cima alla Dashboard, e chi ha le notifiche riceve un avviso.',
  'adm-prom-send': 'Manda adesso il promemoria ai tecnici selezionati.',
  't:salva campagna': 'Salva l\'obiettivo mensile di visite: i tecnici lo vedono nella barra della Dashboard.',
  't:esporta excel': 'Scarica l\'elenco in Excel, con i filtri applicati.',
  't:esporta pdf': 'Scarica l\'elenco in PDF, con i filtri applicati.',
  't:invia a ceiv': 'Genera Excel e PDF dell\'elenco cantieri del periodo e li spedisce subito alla Cassa Edile. Chiede conferma; la mail non si richiama.',
  't:excel imprese': 'Scarica l\'Excel per la Cassa Edile: una riga per ogni impresa o autonomo trovato in cantiere, con P.IVA o codice fiscale e lavoratori.',
  't:pdf imprese': 'Scarica il PDF per la Cassa Edile: una scheda per sopralluogo con le imprese presenti e il totale dei lavoratori.',
  't:invia imprese a ceiv': 'Genera i due file delle imprese presenti e li spedisce subito all\'indirizzo «Email CEIV». Chiede conferma; la mail non si richiama: prima guarda i file.',
  't:genera report pdf': 'Genera il report delle statistiche in PDF, quello che va alla Commissione. Cinque pagine: l\'ultima ha l\'IPC di ogni macroarea della checklist.',
  'p:report osservatorio': 'Genera il report per l\'Osservatorio nazionale, nel formato richiesto da FORMEDIL.',
  'btn-adm-load-xlsx': 'Apre nel modulo la visita letta dal file Excel, per controllarla prima di salvarla.',
  'oss-controlla': 'Conta le visite definitive del periodo e mostra quali non possono andare all\'Osservatorio e perché, con il pulsante per aprire la scheda da completare. Non scarica e non cambia niente.',
  'oss-genera': 'Prepara i cinque file XML con le sole visite che hanno tutti i dati obbligatori: nessun valore di ripiego. Se qualcuna resta fuori, prima ti mostra l\'elenco e i file li scarichi tu con un secondo pulsante.',
  'oss-tutto': 'Mette nelle due date la prima e l\'ultima visita definitiva dell\'archivio. Non scarica niente.',
  't:archivia': 'Mette il cantiere critico in archivio: resta consultabile ma non compare più fra quelli aperti.',
  'ccc-salva-dec': 'Salva la decisione del coordinatore sul caso: la segreteria la vede e prepara la lettera o la segnalazione.',
  'ccc-salva-merito': 'Salva la valutazione nel merito del caso.',
  'ccc-salva-risposta': 'Salva la risposta al caso.',
  'rv-vai': 'Apre il verbale da sistemare.',
};

(function () {
  const T = window.AIUTO_TESTI || {};
  const SEL = 'button, a[href], [data-aiuto], [data-view], summary, label[for]';
  const RITARDO = 500;
  let bolla = null, timer = null, corrente = null, titoloTolto = null;

  const norm = (s) => String(s || '')
    .replace(/&[#\w]+;/g, ' ')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{25B6}\u{25C0}\u{23F8}\u{2705}\u{274C}\u{2716}\u{2714}\u{00D7}]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  function testoPer(el) {
    if (!el) return null;
    if (el.dataset && el.dataset.aiuto) return el.dataset.aiuto;
    if (el.id && T[el.id]) return T[el.id];
    const t = norm(el.textContent);
    if (t && T['t:' + t]) return T['t:' + t];
    if (t) for (const k in T) if (k.startsWith('p:') && t.startsWith(k.slice(2))) return T[k];
    if (el.dataset && el.dataset.view && T['v:' + el.dataset.view]) return T['v:' + el.dataset.view];
    if (el.title) return el.title;
    return null;
  }

  function creaBolla() {
    if (bolla) return bolla;
    bolla = document.createElement('div');
    bolla.id = 'aiuto-bolla';
    bolla.setAttribute('role', 'tooltip');
    bolla.style.cssText = 'position:fixed;z-index:2147483000;max-width:320px;background:#565c66;color:#fff;border-left:3px solid #e7500f;padding:8px 11px;border-radius:7px;font:12.5px/1.45 system-ui,Segoe UI,Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25);pointer-events:none;opacity:0;transition:opacity .12s;white-space:normal;text-align:left';
    document.body.appendChild(bolla);
    return bolla;
  }

  function mostra(el, testo) {
    const b = creaBolla();
    b.textContent = testo;
    // il fumetto grigio del browser non deve comparire insieme alla nuvoletta
    if (el.title) { titoloTolto = { el, title: el.title }; el.removeAttribute('title'); }
    const r = el.getBoundingClientRect();
    b.style.left = '0px'; b.style.top = '0px'; b.style.opacity = '0';
    const w = b.offsetWidth, h = b.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    if (y < 8) y = 8;
    b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.opacity = '1';
    corrente = el;
  }

  function nascondi() {
    clearTimeout(timer); timer = null;
    if (bolla) bolla.style.opacity = '0';
    if (titoloTolto) { titoloTolto.el.setAttribute('title', titoloTolto.title); titoloTolto = null; }
    corrente = null;
  }

  function candidato(target) {
    const el = target && target.closest ? target.closest(SEL) : null;
    if (!el || el.disabled) return null;
    return el;
  }

  document.addEventListener('mouseover', (e) => {
    const el = candidato(e.target);
    if (!el) return;
    if (el === corrente) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const testo = testoPer(el);
      if (testo && el.matches(':hover')) mostra(el, testo);
    }, RITARDO);
  });
  document.addEventListener('mouseout', (e) => {
    const el = candidato(e.target);
    if (!el) return;
    const verso = e.relatedTarget;
    if (verso && el.contains(verso)) return;
    nascondi();
  });
  ['mousedown', 'keydown', 'wheel', 'scroll'].forEach((ev) => document.addEventListener(ev, nascondi, { passive: true, capture: true }));

  // Sul telefono: dito fermo per mezzo secondo. Un tocco altrove la chiude.
  let tocco = null;
  document.addEventListener('touchstart', (e) => {
    nascondi();
    const el = candidato(e.target);
    if (!el) return;
    tocco = setTimeout(() => { const testo = testoPer(el); if (testo) mostra(el, testo); }, 550);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => document.addEventListener(ev, () => { clearTimeout(tocco); tocco = null; }, { passive: true }));

  window.aiutoSpiega = testoPer;   /* per chi vuole controllare: aiutoSpiega(document.getElementById('btn-final')) */
})();
