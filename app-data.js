// app-data.js — dati statici del Gestionale Visite (codelist, tabelle comuni, mappature).
// Caricato come <script> CLASSICO PRIMA del modulo principale: i const qui sono globali
// e vengono letti dal modulo. NON aggiungere qui logica/funzioni, solo dati.

const COMUNI_PD=['Abano Terme','Agna','Albignasego','Anguillara Veneta','Arquà Petrarca','Arquà Polesine','Arre','Arzergrande','Bagnoli di Sopra','Baone','Barbona','Battaglia Terme','Boara Pisani','Borgoricco','Bovolenta','Brugine','Cadoneghe','Campodarsego','Campodoro','Camposampiero','Campo San Martino','Candiana','Carceri','Cartura','Casale di Scodosia','Casalserugo','Castelbaldo','Cervarese Santa Croce','Chioggia','Cittadella','Codevigo','Conselve','Correzzola','Curtarolo','Due Carrare','Este','Fontaniva','Galliera Veneta','Galzignano Terme','Gazzo','Granze','Guarda Veneta','Legnaro','Limena','Loreggia','Lozzo Atestino','Masi','Massanzago','Megliadino San Fidenzio','Megliadino San Vitale','Merlara','Mestrino','Monselice','Montagnana','Montegrotto Terme','Motta','Noventa Padovana','Ospedaletto Euganeo','Padova','Pernumia','Piacenza d\'Adige','Piazzola sul Brenta','Piombino Dese','Piove di Sacco','Polverara','Ponso','Pontelongo','Ponte San Nicolò','Pozzonovo','Rovolon','Rubano','Saccolongo','San Giorgio delle Pertiche','San Giorgio in Bosco','San Martino di Lupari','San Pietro in Gu','San Pietro Viminario','Sant\'Angelo di Piove di Sacco','Sant\'Elena','Sant\'Urbano','Saonara','Selvazzano Dentro','Solesino','Stanghella','Teolo','Terrassa Padovana','Tombolo','Torre di Mosto','Trebaseleghe','Tribano','Urbana','Veggiano','Vescovana','Vighizzolo d\'Este','Vigodarzere','Vigonovo','Vigonza','Villa del Conte','Villa Estense','Villafranca Padovana','Villanova di Camposampiero','Vo\'']

const CAP_PD={
  'Abano Terme':'35031','Agna':'35021','Albignasego':'35020','Anguillara Veneta':'35022',
  'Arquà Petrarca':'35032','Arquà Polesine':'45031','Arre':'35020','Arzergrande':'35020',
  'Bagnoli di Sopra':'35023','Baone':'35030','Barbona':'35040','Battaglia Terme':'35041',
  'Boara Pisani':'35040','Borgoricco':'35010','Bovolenta':'35024','Brugine':'35020',
  'Cadoneghe':'35010','Campodarsego':'35011','Campodoro':'35010','Camposampiero':'35012',
  'Campo San Martino':'35010','Candiana':'35020','Carceri':'35040','Cartura':'35025',
  'Casale di Scodosia':'35040','Casalserugo':'35020','Castelbaldo':'35040',
  'Cervarese Santa Croce':'35030','Chioggia':'30015','Cittadella':'35013','Codevigo':'35020',
  'Conselve':'35026','Correzzola':'35020','Curtarolo':'35010','Due Carrare':'35020',
  'Este':'35042','Fontaniva':'35014','Galliera Veneta':'35015','Galzignano Terme':'35030',
  'Gazzo':'35010','Granze':'35040','Guarda Veneta':'45030','Legnaro':'35020','Limena':'35010',
  'Loreggia':'35010','Lozzo Atestino':'35034','Masi':'35040','Massanzago':'35010',
  'Megliadino San Fidenzio':'35040','Megliadino San Vitale':'35040','Merlara':'35040',
  'Mestrino':'35035','Monselice':'35043','Montagnana':'35044','Montegrotto Terme':'35036',
  'Motta':'35060','Noventa Padovana':'35027','Ospedaletto Euganeo':'35045','Padova':'35100',
  'Pernumia':'35020','Piacenza d\'Adige':'35040','Piazzola sul Brenta':'35016',
  'Piombino Dese':'35017','Piove di Sacco':'35028','Polverara':'35020','Ponso':'35040',
  'Pontelongo':'35029','Ponte San Nicolò':'35020','Pozzonovo':'35020','Rovolon':'35030',
  'Rubano':'35030','Saccolongo':'35030','San Giorgio delle Pertiche':'35010',
  'San Giorgio in Bosco':'35010','San Martino di Lupari':'35018','San Pietro in Gu':'35010',
  'San Pietro Viminario':'35020','Sant\'Angelo di Piove di Sacco':'35020',
  'Sant\'Elena':'35040','Sant\'Urbano':'35040','Saonara':'35020','Selvazzano Dentro':'35030',
  'Solesino':'35047','Stanghella':'35048','Teolo':'35037','Terrassa Padovana':'35020',
  'Tombolo':'35019','Torre di Mosto':'30020','Trebaseleghe':'35010','Tribano':'35020',
  'Urbana':'35040','Veggiano':'35030','Vescovana':'35040','Vighizzolo d\'Este':'35040',
  'Vigodarzere':'35010','Vigonovo':'35010','Vigonza':'35010','Villa del Conte':'35010',
  'Villa Estense':'35040','Villafranca Padovana':'35010','Villanova di Camposampiero':'35010',
  'Vo\'':'35030'
}

const ISTAT_PD={
  'Abano Terme':'028001','Agna':'028002','Albignasego':'028003','Anguillara Veneta':'028004',
  'Arquà Petrarca':'028005','Arre':'028006','Arzergrande':'028007','Bagnoli di Sopra':'028008',
  'Baone':'028009','Barbona':'028010','Battaglia Terme':'028011','Boara Pisani':'028012',
  'Borgo Veneto':'028107','Borgoricco':'028013','Bovolenta':'028014','Brugine':'028015',
  'Cadoneghe':'028016','Campo San Martino':'028020','Campodarsego':'028017','Campodoro':'028018',
  'Camposampiero':'028019','Candiana':'028021','Carmignano di Brenta':'028023','Cartura':'028026',
  'Casale di Scodosia':'028027','Casalserugo':'028028','Castelbaldo':'028029','Cervarese Santa Croce':'028030',
  'Cinto Euganeo':'028031','Cittadella':'028032','Codevigo':'028033','Conselve':'028034',
  'Correzzola':'028035','Curtarolo':'028036','Due Carrare':'028106','Este':'028037',
  'Fontaniva':'028038','Galliera Veneta':'028039','Galzignano Terme':'028040','Gazzo':'028041',
  'Grantorto':'028042','Granze':'028043','Legnaro':'028044','Limena':'028045',
  'Loreggia':'028046','Lozzo Atestino':'028047','Maserà di Padova':'028048','Masi':'028049',
  'Massanzago':'028050','Megliadino San Vitale':'028052','Merlara':'028053','Mestrino':'028054',
  'Monselice':'028055','Montagnana':'028056','Montegrotto Terme':'028057','Noventa Padovana':'028058',
  'Ospedaletto Euganeo':'028059','Padova':'028060','Pernumia':'028061','Piacenza d\'Adige':'028062',
  'Piazzola sul Brenta':'028063','Piombino Dese':'028064','Piove di Sacco':'028065','Polverara':'028066',
  'Ponso':'028067','Ponte San Nicolò':'028069','Pontelongo':'028068','Pozzonovo':'028070',
  'Rovolon':'028071','Rubano':'028072','Saccolongo':'028073','San Giorgio delle Pertiche':'028075',
  'San Giorgio in Bosco':'028076','San Martino di Lupari':'028077','San Pietro Viminario':'028079','San Pietro in Gu':'028078',
  'Sant\'Angelo di Piove di Sacco':'028082','Sant\'Elena':'028083','Sant\'Urbano':'028084','Santa Caterina d\'Este':'028108',
  'Santa Giustina in Colle':'028080','Saonara':'028085','Selvazzano Dentro':'028086','Solesino':'028087',
  'Stanghella':'028088','Teolo':'028089','Terrassa Padovana':'028090','Tombolo':'028091',
  'Torreglia':'028092','Trebaseleghe':'028093','Tribano':'028094','Urbana':'028095',
  'Veggiano':'028096','Vescovana':'028097','Vigodarzere':'028099','Vigonza':'028100',
  'Villa Estense':'028102','Villa del Conte':'028101','Villafranca Padovana':'028103','Villanova di Camposampiero':'028104',
  'Vo\'':'028105'
}

// --- Batch 2: codelist / etichette / palette ---
const ZONE_LBL={1:'Impianti di cantiere',2:'Protezione luoghi di lavoro',3:'Apparecchi di sollevamento',4:'Attrezzature, scale, utensili',5:'Macchine di cantiere',6:'Opere provvisionali',7:'DPI',8:'Documentazione',9:'Soggetti',10:'Formazione'}
const _QPD_NOMI={1:'Q1 Centro',2:'Q2 Nord',3:'Q3 Est',4:'Q4 Sud-Est',5:'Q5 Sud-Ovest',6:'Q6 Ovest'}
const TIPO_IMP_OPT={1:'Affidataria',2:'Affidataria ed esecutrice',3:'Esecutrice'}
const CERTIF_OPT={1:'Asseverata',2:'Certificata OHSAS 18001',3:'UNI EN ISO 45001',4:'Sistema Qualità UNI EN ISO 9001',5:'Certificazione ambientale ISO 14001'}
const CEIV_OPT=['C.E.I.V.','EDILCASSA VENETO','CASSA EDILE BELLUNO','CASSA EDILE VENEZIA','CASSA EDILE VICENZA','ALTRO']
const IMP_LBL={1:'fino a 250.000 €',2:'250.001 – 500.000 €',3:'500.001 – 1.000.000 €',4:'1.000.001 – 1.500.000 €',5:'1.500.001 – 2.500.000 €',6:'2.500.001 – 3.500.000 €',7:'3.500.001 – 5.000.000 €',8:'5.000.001 – 10.000.000 €',11:'non disponibile'}
const TIP_INT_LABELS={1:'Costruzione',2:'Ristrutturazione',3:'Demolizione',4:'Ampliamento',6:'Ripristino',7:'Restauro',8:'Manutenzione'}
const TIP_OPE_LABELS={1:'Industriale',2:'Civile',3:'Commerciale',4:'Agricola',5:'Stradale',6:'Idraulica',7:'Gallerie',8:'Scolastica',9:'Ospedaliera',10:'Sportiva',11:'Ricettiva',12:'Residenziale',13:'Pubbl. utilità',14:'Bonifiche',15:'Impianti',16:'Altro',17:'Infrastrutture'}
const DURATA_LABELS={1:'Fino a 1 mese',2:'Da 1 a 3 mesi',3:'Da 3 a 12 mesi',4:'Da 12 a 24 mesi',5:'Da 24 a 36 mesi',6:'Da 36 a 48 mesi',7:'Oltre 48 mesi',8:'Non presente'}
const TIPO_ACC_LABELS={1:'Su segnalazione',2:'Su richiesta',3:'Protocolli di intesa',4:'RLS/RLST',5:'Programmata',6:'Cantiere qualità',7:'Indicata dal CPT'}
const RPT_PALETTE=['#e7500f','#95C22F','#565c66','#3498db','#9b59b6','#e67e22','#1abc9c','#e74c3c','#f39c12','#2980b9']
const _DASH_C={alto:'#e74c3c',medio:'#f39c12',basso:'#f1c40f',nr:'#95C22F',orange:'#e7500f',grey:'#565c66',green:'#95C22F'}
const _DASH_PIE=['#e7500f','#565c66','#95C22F','#f39c12','#2563eb','#8e44ad','#e74c3c','#1abc9c','#e67e22','#34495e']
const _DASH_MACRO={1:'01 Impianti di cantiere',2:'02 Protezione luoghi di lavoro',3:'03 Apparecchi di sollevamento',4:'04 Attrezzature, scale, utensili',5:'05 Macchine di cantiere',6:'06 Opere provvisionali',7:'07 DPI',8:'08 Documentazione',9:'09 Soggetti',10:'10 Formazione'}
const _DASH_IMPORTO={1:'≤ 250.000',2:'250.001–500.000',3:'500.001–1.000.000',4:'1.000.001–1.500.000',5:'1.500.001–2.500.000',6:'2.500.001–3.500.000',7:'3.500.001–5.000.000',8:'5.000.001–10.000.000',9:'10.000.001–15.000.000',10:'oltre 15.000.000',11:'Non disponibile'}
const OS_ZP={IMP:1,PLL:2,SOL:3,ASU:4,MAC:5,OPE:6,PIN:7,DOC:8,SOG:9,FOR:10}
const OS_ZONE_NAMI={1:'Impianti di cantiere',2:'Protezione luoghi di lavoro',3:'Apparecchi di sollevamento',4:'Attrezzature - scale - utensili',5:'Macchine di cantiere',6:'Opere provvisionali',7:'Disposit. protez. individuali',8:'Documentazione',9:'Soggetti',10:'Formazione'}
const OS_MESI=['ott','nov','dic','gen','feb','mar','apr','mag','giu','lug','ago','set']
const OS_MESI_FULL=['ottobre','novembre','dicembre','gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre']
const OXBRAND=[231,80,15]
const _MESI_IT=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
const _TIP_INT={1:'Costruzione',2:'Ristrutturazione',3:'Demolizione',4:'Ampliamento',6:'Ripristino',7:'Restauro',8:'Manutenzione'}
const _TIP_OPE={1:'Industriale',2:'Civile',3:'Commerciale',4:'Agricola',5:'Stradale',8:'Scolastica',16:'Altro'}
const _DURATA={1:'< 30 gg',2:'30–90 gg',3:'3–6 mesi',4:'6–12 mesi',5:'> 12 mesi'}
const _IMPORTO={1:'≤ 250k',2:'250k–500k',3:'500k–1M',4:'1–1,5M',5:'1,5–2,5M',6:'2,5–3,5M',7:'3,5–5M',8:'5–10M',11:'N/D'}
const _TIPO_ACC={1:'Su segnalazione',2:'Su richiesta',3:'Protocolli di intesa',4:'RLS/RLST',5:'Programmata',6:'Cantiere qualità',7:'Indicata dal CPT'}
const _CCNL_LBL={'1':'Edilizia Industria','2':'Edilizia Artigianato','3':'Metalmeccanico Ind.','4':'Metalmeccanico Art.','5':'Installatori Impianti','6':'Legno','13':'Altro'}
const _CCIA_LBL={'1':'Artigiana','2':'Industriale','3':'Cooperativa','4':'Commerciale','5':'Altro'}
const _CCNL_FULL={1:'Edilizia industria',2:'Edilizia artigianato',3:'Lapidei industria',4:'Lapidei artigianato',5:'Altro/Non edile',6:'Non applicabile'}
const _CCIA_FULL={1:'Iscritto',2:'Non iscritto',3:'Esonero'}

// --- Batch 3: blocchi dati multi-riga ---
const LAV_DATA={
  'Canalizzazioni':{
    'Posa manufatti e lavori a fondo scavo':['assemblaggio, saldatura, sigillatura e rivestimento','deposito provvisorio del materiale/tubazioni','formazione del letto di appoggio','movimento macchine operatrici','posa coppelle di protezione','posizionamento manufatti a fondo scavo','realizzazioni pozzetti, camerette, nicchie, ecc.'],
    'Rinterri, rifiniture e ripristini stradali':['formazione pozzetti, chiusini','movimento macchine operatrici','pulizia e sgombero area','reinterri e compattamento','rullatura','stesura manto bituminoso'],
    'Scavi e movimenti terra':['deposito provvisorio materiali di scavo','esercizio impianti aggottamento','ispezioni ricerca sottosuolo','movimento autocarri e macchine operatrici','posa paratie e sostegni contro terra','predisposizione paratie e sostegni contro terra','preparazione, delimitazione e sgombero area','scavo a sezione obbligata','taglio e demolizione manto stradale','valutazione ambientale: vegetale, colturale, archeologico, urbano, geomorfologico']
  },
  'Costruzioni edili in genere':{
    'Coperture':['approvigionamento e trasporto interno materiali','formazione ponteggi, piattaforme e piani di lavoro','movimento macchine operatrici ed impianti di sollevamento','posa di accessori (grondaie, scossaline, camini, ecc.)','posa manto di copertura','predisposizione appoggi','preparazione botole e asole','pulizia e movimentazione dei residui','realizzazione struttura di copertura','stesura matte, primer, impermeabilizzanti','taglio, demolizione, scanalatura calcestruzzo e murature','tracciamenti'],
    'Demolizioni':['accertamenti ed assaggi delle strutture','demolizioni rimozione materiali di sovrastrutture e strutture non portanti','demolizioni meccanizzate','demolizioni strutture portanti','formazione ponteggi, piattaforme e piani di lavoro','movimento macchine operatrici ed impianti di sollevamento','preparazione percorsi e depositi','preparazione, delimitazione e sgombero area','protezione botole e asole','rafforzamenti e risanamenti provvisori, puntellamenti strutture da salvaguardare','rimozione e sgombero macerie'],
    'Impianti dell\'opera in costruzione':['approvigionamento e trasporto interno materiali','formazione ponteggi, piattaforme e piani di lavoro','movimento macchine operatrici ed impianti di sollevamento','posa sanitari, corpi radianti','posizionamento terminali e apparecchi utilizzatori','predisposizione letto d\'appoggio','preparazione, delimitazione e sgombero area','protezione delle aperture verso il vuoto o vani','pulizia e movimentazione dei residui','realizzazione impianti','taglio, demolizione, scanalatura calcestruzzo e murature','tracciamenti'],
    'Manutenzione e riparazione':['confezione malte','definizione e realizzazione accessi ai posti di lavoro','formazione ponteggi, piattaforme e piani di lavoro','manutenzione opere in ferro','preparazione, delimitazione e sgombero area','pulizia delle superfici esterne (idropitture - sabbiature)','revisione delle coperture','rifacimento dei manti di copertura','ripristini minori e rappezzi','sollevamento e trasporto dei materiali','sostituzione di grondaie, pluviali e faldali','stesura malte e vernici'],
    'Murature, intonaci, finiture e opere esterne':['allacciamenti','approvigionamento e trasporto interno materiali','confezione malte ed intonaci (tradizionali e industriali)','formazione intonaci (tradizionali e industriali)','formazione ponteggi, piattaforme e piani di lavoro','movimento macchine operatrici ed impianti di sollevamento','posa laterizi/pietre','posa serramenti, ringhiere','predisposizione letto d\'appoggio','preparazione, delimitazione e sgombero area','protezione delle aperture verso il vuoto o vani','pulizia e movimentazione dei residui','sistemazione area esterna','stesura malte, polveri, vernici','tracciamenti'],
    'Prefabbricati':['allestimento delle protezioni in opera','movimento macchine operatrici','predisposizione delle protezioni a piè d\'opera','preparazione, delimitazione e sgombero area','sollevamento e posa in opera pilastri','sollevamento e posa in opera rampe di scale','sollevamento e posa in opera setti o pannelli verticali','sollevamento e posa in opera solai orizzontali','sollevamento e posa in opera travi','sorveglianza e controllo delle operazioni','sostegno e puntellatura degli elementi isolati','stoccaggio elementi strutturali'],
    'Ristrutturazioni':['approvigionamento e trasporto interno materiali','confezione malte ed intonaci (tradizionali e industriali)','demolizione strutture portanti','demolizione strutture non portanti','formazione intonaci (tradizionali e industriali)','formazione nuove strutture portanti','formazione ponteggi, piattaforme e piani di lavoro','formazione tagli e scanalature di ancoraggio','interventi di consolidamento strutturale','movimento macchine operatrici ed impianti di sollevamento','posa laterizi/pietre','posa serramenti, ringhiere, sanitari, corpi radianti','preparazione, delimitazione e sgombero area','protezione botole e asole','pulizia e movimentazione dei residui','puntellamento strutture da demolire e/o salvaguardare','rimozione e sgombero macerie','rimozione manuale materiali e sovrastrutture','stesura malte, polveri, vernici','tracciamenti'],
    'Scavi di sbancamento e di fondazione':['carico e rimozione materiali di scavo','deposito provvisorio materiali di scavo','esercizio impianti di aggottamento','interventi con attrezzi manuali per regolarizzazione superficie di scavo e pulizia','movimento macchine operatrici','predisposizioni paratie sostegno contra terra ed opere di carpenteria per la messa in opera','predisposizione, ancoraggio e posa di passerelle, parapetti e andatoie provvisorie','preparazione, delimitazione e sgombero area','ripristino viabilità e pulizia','scavi di fondazione','tracciamento'],
    'Strutture in c.a. tradizionali':['approvigionamento, lavorazione e posa armature metalliche','disarmo delle casserature','formazione ponteggi, piattaforme e piani di lavoro','getto calcestruzzo','movimento macchine operatrici','preparazione delimitazione e sgombero area','preparazione e posa casserature','protezione botole e asole','pulizia e movimentazione delle casserature','ripristino viabilità','sorveglianza e controllo della presa']
  },
  'Costruzioni stradali in genere':{
    'Manti bituminosi':['finitura manuale','fornitura del conglomerato bituminoso','movimento autocarri e macchine operatrici','preparazione fondo','preparazione, delimitazione e pulizia area','pulizia finale (anche con macchina spazzolatrice - aspiratrice)','rullaggio','stesura manto con vibrofinitrice'],
    'Opere di completamento':['fornitura e posa di attrezzature di servizio (banchine, marciapiedi, paletti, impianti di illuminazione e segnalazione, guard-rails, spartitraffico, sistemazioni a verde, ecc.)','fornitura e posa pozzetti, tombini e chiusini; formazione basamenti e strutture di sostegno per le attrezzature di servizio','realizzazione vani di ispezione per utenze sotterranee sulla superficie stradale','realizzazione canali di raccolta e smaltimento delle acque meteoriche'],
    'Rifacimento manti':['demolizione manti con escavatore','finitura manuale','fornitura del conglomerato bituminoso','fresatura','movimento autocarri e macchine operatrici','preparazione fondo','preparazione, delimitazione e pulizia area','pulizia finale e apertura al traffico','pulizia fondo e bordo area (moto-scopa e pulizia manuale)','rifilatura manti','rullaggio','stesura manto con vibrofinitrice','trasporto materiali di risulta'],
    'Scavi di sbancamento, fondazione e movimento terra':['carico e rimozione materiali di scavo','deposito provvisorio materiali di scavo','formazione rilevati, cassonetti e costipatura','ispezioni ricerca sottosuolo','movimento autocarri e macchine operatrici','predisposizione e posa sostegni contro terra','preparazione, delimitazione e sgombero area','scavi di fondazione','scavi di sbancamento','valutazione ambientale: vegetale, colturale, archeologico, urbano, geomorfologico'],
    'Strutture in c.a. industrializzate':['approvvigionamento e posa ferro lavorato','chiusura delle casseforme e regolazione','disarmo e rimozione casseforme','getto calcestruzzo','movimento macchine operatrici','preparazione e posa casseforme','preparazione e posa ponteggi, piattaforme e piani di lavoro','preparazione, delimitazione, sgombero area','pulizia, preparazione e rotazione delle casseforme','rotazione ponteggi, piattaforme e piani di lavoro'],
    'Strutture prefabbricate':['allestimento e/o completamento delle protezioni in opera','movimento macchine operatrici','opere di completamento','predisposizione delle protezioni a piè d\'opera','preparazione, delimitazione, sgombero area','sollevamento e posa in opera degli elementi di impalcato','sollevamento e posa in opera di conci prefabbricati','sollevamento e posa in opera di travi','sorveglianza e controllo delle operazioni','stoccaggio elementi strutturali prefabbricati']
  },
  'Fognature, pozzi e gallerie':{
    'Gallerie':['attività di scavo con utensili ad aria compressa','attività di scavo manuale','esercizio apparecchi di sollevamento (montacarichi)','esercizio impianti di ventilazione, illuminazione, eduzione acqua','infossaggio','movimento ed esercizio macchine operatrici','opere di finitura','posa in opera di carpenterie e/o strutture di sostegno','predisposizione sostegni e carpenterie','preparazione, delimitazione, sgombero area','rimozione, trasporto e sollevamento del materiale di scavo','rivestimento in calcestruzzo'],
    'Pozzi':['attività di scavo meccanico','esercizio apparecchi di sollevamento (montacarichi)','movimento ed esercizio macchine operatrici','posa in opera di carpenterie e/o strutture di sostegno','predisposizione sostegni e carpenterie','preparazione, delimitazione, sgombero area','rimozione, sollevamento deposito e trasporto materiali di scavo','rivestimento di sostegno in calcestruzzo','rivestimento in muratura e finiture','scavo con utensili manuali','valutazione ambientale: vegetale, colturale, archeologico, urbano, geomorfologico']
  },
  'Fondazioni speciali':{
    'Jet grouting':['confezionamento miscela d\'iniezione','iniezione della miscela di iniezione ad alta pressione','ispezioni ricerca sottosuolo','perforazione del terreno','predisposizione macchine ed impianti','preparazione del piano di lavoro e posizionamento della sonda di perforazione','preparazione, delimitazione, sgombero area','pulizia e sgombero area','recupero delle aste','tracciamenti','valutazione ambientale: vegetale, colturale, archeologico, urbano, geomorfologico'],
    'Micropali':['infissione dei tiranti metallici','iniezione della miscela strutturale','ispezioni ricerca sottosuolo','messa in tensione dei tiranti metallici','movimentazione autocarri e macchine operatrici','perforazione del terreno','posizionamento dell\'escavatore (sonda di perforazione)','predisposizione macchine ed impianti','preparazione del piano di lavoro dell\'escavatore','preparazione, delimitazione, sgombero area','pulizia e sgombero area','tracciamenti','valutazione ambientale: vegetale, colturale, archeologico, urbano, geomorfologico'],
    'Pali battuti':['infissione','ispezioni ricerca sottosuolo','movimentazione autocarri e macchine operatrici','posizionamento del battipalo','predisposizione macchine ed impianti','preparazione del piano di lavoro','preparazione, delimitazione, sgombero area','pulizia e sgombero area','tracciamenti e infossamento del palo','trasporto e posizionamento del palo','valutazione ambientale: vegetale, colturale, archeologico, urbano, geomorfologico'],
    'Pali trivellati':['estrazione dell\'avampozzo mediante attrezzatura vibrante','getto del calcestruzzo','infossaggio tubo di rivestimento (avampozzo) mediante attrezzatura vibrante','ispezioni ricerca sottosuolo','movimentazione autocarri e macchine operatrici','posa in opera della camicia a perdere','posizionamento dell\'escavatore','predisposizione macchine ed impianti','preparazione del piano di lavoro dell\'escavatore','preparazione, delimitazione, sgombero area','pulizia e sgombero area','scavo del palo','tracciamenti','trasporto e posa delle gabbie di armatura','trivellazione del terreno (preforo)','valutazione ambientale: vegetale, culturale, archeologica, urbana, geomorfologica'],
    'Paratie monolitiche':['allontanamento del materiale di scavo','estrazione dei setti giunto','getti di calcestruzzo e recupero fango bentonitico','ispezioni ricerca sottosuolo','movimentazione autocarri e macchine operatrici','posa dei setti-giunto','predisposizione macchine ed impianti','preparazione e posa gabbie metalliche di armatura','preparazione, delimitazione, sgombero area','pulizia e sgombero area','scavo della trincea guida, getto e riempimento con inerti','scavo di profondità con l\'impiego di fango bentonitico','valutazione ambientale: vegetale, colturale, archeologico, urbano, geomorfologico']
  },
  'Gallerie':{
    'Opere strutturali per il rivestimento':['approvvigionamento e posa ferro','attività di scavo con esplosivi','disarmo delle casseforme','formazione piani di lavoro e sistemi di accesso','getto calcestruzzo','movimentazione e pulizia delle casseforme','movimento ed esercizio macchine operatrici','predisposizione vie di accesso','preparazione delimitazione e sgombero area','preparazione e posa casseforme','ripristino viabilità','sorveglianza e controllo della posa','vibrazione calcestruzzo'],
    'Scavi di avanzamento e rivestimento di prima fase':['attività di scavo con esplosivi (caricamento, brillamento, sfumo)','attività di scavo meccanico','disgaggio di sicurezza','esercizio apparecchi di sollevamento - trasporto','esercizio impianti aggottamento','movimento ed esercizio macchine operatrici','perforazione di rocce','posa in opera di carpenterie e/o strutture di sostegno','predisposizione vie di accesso al fronte dello scavo','predisposizioni paratie, sostegni e carpenterie','preparazione, delimitazione e sgombero area','rimozione, trasporto e deposito materiali di scavo','rivestimento di prima fase con calcestruzzo proiettato','valutazione ambientale: vegetale, colturale, archeologico, urbano, geomorfologico']
  },
  'Impermeabilizzazioni':{
    'Bitume e guaine su muri e solai':['preparazione, delimitazione, sgombero area','stesura, riscaldamento e incollaggio delle guaine','trattamento delle superfici con asfalto bitume, primer a caldo','trattamento di finitura delle superfici','valutazione ambientale'],
    'Impermeabilizzazioni di terre (geomembrane)':['preparazione, delimitazione, sgombero area','stesura, riscaldamento e incollaggio delle guaine','trattamento delle superfici con asfalto bitume, primer a caldo','trattamento di finitura delle superfici','valutazione ambientale']
  },
  'Lavorazioni ferroviarie':{
    'Approvvigionamento e posa traversine e binari':['delimitazione aree di deposito e preassemblaggio','formazione dei carrelli e trasporto in opera','formazione dei convogli e carrelli','formazione tronchi di binario su traversine','movimento macchine operatrici','posa in opera, collegamenti e regolazioni','preparazione e sgombero area','regolazione e taglio binari','trasporto e posa rotaie','trasporto e posa traversine'],
    'Compattamento, livellamento e opere di finitura':['fornitura e stesura inerti','livellamento e compattamento con rincalzatrice','movimento macchine operatrici','posa cordoli, pozzetti, chiusini, finitura (getto)','pulizia e sgombero area','rullatura','stesura manto bituminoso'],
    'Scavi, demolizioni e sottofondi':['carico e rimozioni materiali di risulta','demolizioni preesistenze e scavi','formazione cassonetti, livellamento','getto calcestruzzo','ispezione ricerca sottosuolo','movimento ed esercizio macchine operatrici ed autocarri','preparazione, delimitazione, sgombero area','stesura stabilizzato, compattamento','valutazione ambientale: vegetale, culturale, archeologico, urbano, geomorfologico']
  },
  'Verniciature industriali':{
    'Sabbiatura e idropulitura':['messa in opera delle protezioni di contenimento dei prodotti impiegati','preparazione, delimitazione, sgombero area','pulizia area','raccolta del materiale disperso','trattamento delle superfici (sabbiatura e/o idropulitura)'],
    'Verniciatura':['preparazione dei prodotti (primer, vernici ecc.)','preparazione delle superfici','preparazione, delimitazione, sgombero area','pulizia e manutenzione delle attrezzature','pulizia e sgombero area','trattamento delle superfici a pennello','trattamento delle superfici a spruzzo']
  }
}

const PREF_LBL={
  'IMP_LOG':'Logistica','IMP_IGS':'Apprestamenti igienico-sanitari e di sicurezza',
  'IMP_ELE':'Impianti elettrici','IMP_AGI':'Agibilità del cantiere',
  'IMP_CON':'Contiguità e interferenze','IMP_ORG':'Organizzazione','IMP_SEG':'Segnaletica',
  'PLL_PER':'Protezione perimetrale','PLL_OCA':'Opere in calcestruzzo armato',
  'PLL_SCA':'Scavi','PLL_DEM':'Demolizioni',
  'ASU_ATT':'Attrezzature','ASU_SCA':'Scale','ASU_UTE':'Utensili',
  'MAC_MMT':'Macchine movimento terra','MAC_MMM':'Macchine movimento materiali',
  'MAC_MAS':'Macchine asservimento',
  'OPE_POT':'Ponteggi tubolari','OPE_POF':'Ponteggi a telaio prefabbricato',
  'OPE_POS':'Ponti su cavalletti','OPE_POC':'Ponti su ruote','OPE_DPC':'Disposizioni contro cadute',
  'PIN_TES':'Protezione testa','PIN_OCC':'Protezione occhi','PIN_UDI':'Protezione udito',
  'PIN_RES':'Protezione vie respiratorie','PIN_MAN':'Protezione mani',
  'PIN_PIE':'Protezione piedi','PIN_IND':'Indumenti protezione','PIN_CAD':'Protezione anticaduta',
  'DOC_GEN':'Documentazione generale','DOC_GEN_SOL':'Apparecchi di sollevamento',
  'DOC_MA4':'Macchine e attrezzature','DOC_PON':'Ponteggi','DOC_ELE':'Impianti elettrici',
  'SOG_FIG':'Figure di cantiere',
  'FOR_BAS':'Formazione base','FOR_FIG':'Figure specifiche',
  'FOR_RIS':'Rischi specifici','FOR_ATM':'Attrezzature e macchine'
}

const CHK_COLORS={
  ncp:'#d50000',  // NC+  rosso vivo
  ncm:'#e7500f',  // NC-  arancio Formedil
  oss:'#c8a000',  // OSS  giallo ocra
  ver:'#95C22F',  // VER  verde Formedil
  na :'#565c66'   // NA   grigio Formedil
}

const CEIV_COLOR_MAP={
  'C.E.I.V.'          :'#3b3365',
  'EDILCASSA VENETO'  :'#e7500f',
  'CASSA EDILE BELLUNO':'#3498db',
  'CASSA EDILE VENEZIA':'#2ecc71',
  'CASSA EDILE VICENZA':'#9b59b6',
  'ALTRO'             :'#f39c12',
  'Non iscritto'      :'#565c66'
}

const OXC={
  ar:'#e7500f',gr:'#565c66',ve:'#95C22F',
  s1:'#e7500f',s2:'#95C22F',
  ncp:'#e02b20',ncm:'#FFC000',
  pie:['#e7500f','#95C22F','#565c66','#f29b6b','#c5dd92','#9aa0a8','#7a3c14','#5d7a1e'],
  esiti:['#c5dd92','#9aa0a8','#FFC000','#e02b20'],
  trans:['#95C22F','#eef3e2','#fdeadd','#f08a4b']
}

const OXT={
  hdrF:[230,232,235],hdrT:[60,65,72],alt:[244,245,246],tot:[250,224,210],
  heatG:[197,221,146],heatO:[242,155,107],heatC:[253,236,222],heatN:[238,243,226]
}

const OXD=[
  {key:'importo',title:'IMPORTO LAVORI CANTIERE',sub:'(classi di importo in migliaia di euro)',schede:3,
   cats:[1,2,3,4,5],lbl:{1:'Fino a 250',2:'da 251 a 500',3:'da 501 a 1.500',4:'da 1.501 a 5.000',5:'oltre 5.000'},
   blk:{1:'fino a 250.000',2:'da 250.001 a 500.000',3:'da 500.001 a 1.500.000',4:'da 1.500.001 a 5.000.000',5:'oltre 5.000.000'}},
  {key:'tipint',title:'TIPO INTERVENTO',sub:'',schede:3,
   cats:[1,2,3,4,6,7,8],lbl:{1:'costruzione',2:'ristrutturazione',3:'demolizione',4:'ampliamento',6:'consolidamento',7:'messa in sicurezza',8:'demoliz. e ricostruz. post sisma'},
   blk:{1:'COSTRUZIONE',2:'RISTRUTTURAZIONE',3:'DEMOLIZIONE',4:'AMPLIAMENTO',6:'CONSOLIDAMENTO',7:'MESSA IN SICUREZZA',8:'DEMOLIZ. E RICOSTRUZ. POST SISMA'}},
  {key:'tipope',title:'TIPO OPERA',sub:'',schede:3,
   cats:[1,2,3,4,5,6],lbl:{1:'civile',2:'produttivo',3:'trasporti',4:'ospedaliera',5:'scolastico',6:'altro'},
   blk:{1:'CIVILE',2:'PRODUTTIVO',3:'TRASPORTI',4:'OSPEDALIERO',5:'SCOLASTICO',6:'ALTRO'}},
  {key:'commtipo',title:'TIPO COMMITTENTE',sub:'',schede:3,
   cats:[1,2],lbl:{1:'pubblico',2:'privato'},blk:{1:'PUBBLICO',2:'PRIVATO'}},
  {key:'tipvisita',title:'TIPO VISITA',sub:'',schede:2,
   cats:[1,2],lbl:{1:'segnalazione e indicata da enti controllo',2:'concordata con impresa'},blk:{}},
  {key:'ruolo',title:'RUOLO IMPRESA',sub:'',schede:2,
   cats:[1,2,3],lbl:{1:'affidataria',2:'affidataria ed esecutrice',3:'esecutrice'},blk:{}}
]

const FOTO_SLOTS=[
  {tipo:'foto1', label:'Foto 1', icon:'📷', privacy:false},
  {tipo:'foto2', label:'Foto 2', icon:'📷', privacy:false},
  {tipo:'foto3', label:'Foto 3', icon:'📷', privacy:false},
  {tipo:'foto4', label:'Foto 4', icon:'📷', privacy:false},
  {tipo:'privacy', label:'Privacy (firma)', icon:'🔒', privacy:true},
]

// --- Batch 4: TECNICI_LIST, XSD_FILES, OS_SUB, mappe checklist/IPC ---
const MODAL_NO_DISMISS=['modal-verbale']

const TECNICI_LIST=[
  {nome:'Arch. Marco Camuffo',     email:'marco.camuffo@did.formedilpadova.it'},
  {nome:'Arch. Nicola De Marco',   email:'nicola.demarco@did.formedilpadova.it'},
  {nome:'Arch. Tommaso Visentini', email:'tommaso.visentini@did.formedilpadova.it'},
  {nome:'Geom. Mirco Canova',      email:'mirco.canova@did.formedilpadova.it'},
  {nome:'Ing. Paolo Balladore',    email:'paolo.balladore@did.formedilpadova.it'},
  {nome:'P.I. Franco Caon',        email:'franco.caon@did.formedilpadova.it'},
]

const _DM_IPC={
  'NR':   {label:'Nessun rilievo', color:'#95C22F'},
  'BASSO':{label:'Basso',          color:'#f2c200'},
  'MEDIO':{label:'Medio',          color:'#e7500f'},
  'ALTO': {label:'Alto',           color:'#e74c3c'}
}

const XSD_FILES={
  visita:{
    nome:'SchemaVisita.xsd',
    content:`<?xml version="1.0" encoding="utf-8"?>
<xs:schema id="visita" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="visite">
    <xs:complexType>
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:element name="visita">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="elimina" type="xs:short" minOccurs="0" maxOccurs="1" />
              <xs:element name="nodoId" type="xs:string" minOccurs="0" maxOccurs="1" />
              <xs:element name="visitaId" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereId" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="impresaId" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="tecnicoId" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="secondoTecnicoId" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaImpresaRuolo" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaImpresaEmailRefVis" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaImpreseCantiereNum" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:minInclusive value="0"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaLavoratoriCantiereNum" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:minInclusive value="0"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaLavoratoriCantiereAutNum" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:minInclusive value="0"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaTipo" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/><xs:enumeration value="4"/><xs:enumeration value="5"/><xs:enumeration value="6"/><xs:enumeration value="7"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="responsabileLavori" minOccurs="0" maxOccurs="1">
                <xs:complexType>
                  <xs:attribute name="cognomeResponsabileLavori" use="optional"><xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/><xs:minLength value="2"/></xs:restriction></xs:simpleType></xs:attribute>
                  <xs:attribute name="nomeResponsabileLavori" use="optional"><xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/><xs:minLength value="2"/></xs:restriction></xs:simpleType></xs:attribute>
                </xs:complexType>
              </xs:element>
              <xs:element name="coordinamento" minOccurs="0" maxOccurs="1">
                <xs:complexType>
                  <xs:attribute name="tipoPresenzaCoordinamento" use="optional"><xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/></xs:restriction></xs:simpleType></xs:attribute>
                  <xs:attribute name="cognomeCoordinatoreFaseProgettazione" use="optional"><xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/><xs:minLength value="2"/></xs:restriction></xs:simpleType></xs:attribute>
                  <xs:attribute name="nomeCoordinatoreFaseProgettazione" use="optional"><xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/><xs:minLength value="2"/></xs:restriction></xs:simpleType></xs:attribute>
                  <xs:attribute name="cognomeCoordinatoreFaseEsecuzione" use="optional"><xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/><xs:minLength value="2"/></xs:restriction></xs:simpleType></xs:attribute>
                  <xs:attribute name="nomeCoordinatoreFaseEsecuzione" use="optional"><xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/><xs:minLength value="2"/></xs:restriction></xs:simpleType></xs:attribute>
                </xs:complexType>
              </xs:element>
              <xs:element name="visitaLavorazioni" minOccurs="0" maxOccurs="1">
                <xs:complexType><xs:choice><xs:element name="visitaLavorazione" minOccurs="0" maxOccurs="unbounded"><xs:simpleType><xs:restriction base="xs:integer"/></xs:simpleType></xs:element></xs:choice></xs:complexType>
              </xs:element>
              <xs:element name="visitaFasiLavorazioneNotaGen" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="5000"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaValutazioni" minOccurs="1" maxOccurs="1">
                <xs:complexType>
                  <xs:choice>
                    <xs:element name="visitaValutazione" minOccurs="1" maxOccurs="1000">
                      <xs:complexType>
                        <xs:attribute name="visitaZonaId" type="xs:string" use="required"/>
                        <xs:attribute name="visitaZonaEsito" use="optional"><xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/></xs:restriction></xs:simpleType></xs:attribute>
                        <xs:attribute name="visitaZonaNote" use="optional"><xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="1000"/></xs:restriction></xs:simpleType></xs:attribute>
                      </xs:complexType>
                    </xs:element>
                  </xs:choice>
                </xs:complexType>
              </xs:element>
              <xs:element name="visitaData" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:date"><xs:minInclusive value="2016-10-01"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaOraInizio" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:minInclusive value="0"/><xs:maxInclusive value="23"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaMinutiInizio" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:minInclusive value="0"/><xs:maxInclusive value="59"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaOraFine" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:minInclusive value="0"/><xs:maxInclusive value="23"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="visitaMinutiFine" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:minInclusive value="0"/><xs:maxInclusive value="59"/></xs:restriction></xs:simpleType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:choice>
    </xs:complexType>
  </xs:element>
</xs:schema>`
  },
  cantiere:{
    nome:'SchemaCantiere.xsd',
    content:`<?xml version="1.0" encoding="utf-8"?>
<xs:schema id="cantiere" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="cantieri">
    <xs:complexType>
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:element name="cantiere">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="elimina" type="xs:short" minOccurs="0" maxOccurs="1" />
              <xs:element name="nodoId" type="xs:string" minOccurs="0" maxOccurs="1" />
              <xs:element name="cantiereId" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereIndirizzo" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="2"/><xs:maxLength value="200"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereCivico" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereEtichetta" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereCNCE" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereComuneCod" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:length value="6"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereCap" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="5"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereTipInt" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/><xs:enumeration value="4"/><xs:enumeration value="6"/><xs:enumeration value="7"/><xs:enumeration value="8"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereTipOpe" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/><xs:enumeration value="4"/><xs:enumeration value="5"/><xs:enumeration value="6"/><xs:enumeration value="7"/><xs:enumeration value="8"/><xs:enumeration value="9"/><xs:enumeration value="10"/><xs:enumeration value="11"/><xs:enumeration value="12"/><xs:enumeration value="13"/><xs:enumeration value="14"/><xs:enumeration value="15"/><xs:enumeration value="16"/><xs:enumeration value="17"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereTipOpeAltro" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereImporto" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/><xs:enumeration value="4"/><xs:enumeration value="5"/><xs:enumeration value="6"/><xs:enumeration value="7"/><xs:enumeration value="8"/><xs:enumeration value="9"/><xs:enumeration value="10"/><xs:enumeration value="11"/><xs:enumeration value="12"/><xs:enumeration value="13"/><xs:enumeration value="14"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereDurata" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/><xs:enumeration value="4"/><xs:enumeration value="5"/><xs:enumeration value="6"/><xs:enumeration value="7"/><xs:enumeration value="8"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="cantiereCommittenteId" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:choice>
    </xs:complexType>
  </xs:element>
</xs:schema>`
  },
  impresa:{
    nome:'SchemaImpresa.xsd',
    content:`<?xml version="1.0" encoding="utf-8"?>
<xs:schema id="impresa" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="imprese">
    <xs:complexType>
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:element name="impresa">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="elimina" type="xs:short" minOccurs="0" maxOccurs="1" />
              <xs:element name="nodoId" type="xs:string" minOccurs="0" maxOccurs="1" />
              <xs:element name="impresaId" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="impresaNome" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="2"/><xs:maxLength value="256"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="impresaCF" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="16"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="impresaEmailRef" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="tipoIscrizioneCcia" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/><xs:enumeration value="4"/><xs:enumeration value="5"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="contrattoCcnl" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/><xs:enumeration value="4"/><xs:enumeration value="5"/><xs:enumeration value="6"/><xs:enumeration value="7"/><xs:enumeration value="8"/><xs:enumeration value="9"/><xs:enumeration value="10"/><xs:enumeration value="11"/><xs:enumeration value="12"/><xs:enumeration value="13"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="contrattoCcnlAltro" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="128"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="impresaCertificazioni" minOccurs="0" maxOccurs="1">
                <xs:complexType><xs:choice><xs:element name="impresaCertificazione" minOccurs="0" maxOccurs="3"><xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/></xs:restriction></xs:simpleType></xs:element></xs:choice></xs:complexType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:choice>
    </xs:complexType>
  </xs:element>
</xs:schema>`
  },
  committente:{
    nome:'SchemaCommittente.xsd',
    content:`<?xml version="1.0" encoding="utf-8"?>
<xs:schema id="committente" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="committenti">
    <xs:complexType>
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:element name="committente">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="elimina" type="xs:short" minOccurs="0" maxOccurs="1" />
              <xs:element name="committenteId" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="committenteNome" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="2"/><xs:maxLength value="256"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="committenteTipo" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:short"><xs:enumeration value="1"/><xs:enumeration value="2"/><xs:enumeration value="3"/></xs:restriction></xs:simpleType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:choice>
    </xs:complexType>
  </xs:element>
</xs:schema>`
  },
  tecnico:{
    nome:'SchemaTecnico.xsd',
    content:`<?xml version="1.0" encoding="utf-8"?>
<xs:schema id="tecnico" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="tecnici">
    <xs:complexType>
      <xs:choice minOccurs="0" maxOccurs="unbounded">
        <xs:element name="tecnico">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="elimina" type="xs:short" minOccurs="0" maxOccurs="1" />
              <xs:element name="tecnicoId" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="50"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="tecnicoCognome" minOccurs="1" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:minLength value="1"/><xs:maxLength value="256"/></xs:restriction></xs:simpleType>
              </xs:element>
              <xs:element name="tecnicoNome" minOccurs="0" maxOccurs="1">
                <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="256"/></xs:restriction></xs:simpleType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:choice>
    </xs:complexType>
  </xs:element>
</xs:schema>`
  }
}

const OS_SUB={
  IMP_LOG:'Logistica',IMP_IGS:'Apprestamenti igienico-sanitari',IMP_ELE:'Impianti elettrici',IMP_AGI:'Agibilità del cantiere',IMP_ORG:'Organizzazione del lavoro',IMP_SEG:'Segnaletica',
  PLL_SCA:'Aree di scavo',PLL_DEM:'Aree di demolizione',PLL_PER:'Aree di pericolo',
  SOL_GRU:'Gru',SOL_AUT:'Autogru',SOL_ARG:'Argano',SOL_PIA:'Piattaforme di lavoro elevabili',
  ASU_ATT:'Attrezzature',ASU_SCA:'Scale',ASU_UTE:'Utensili',
  MAC_MMT:'Macchine movimento terra',MAC_MMM:'Macchine movimentazione materiale',MAC_MAS:'Macchine stradali',
  OPE_POF:'Ponteggi fissi',OPE_POS:'Ponteggi sospesi',OPE_POC:'Ponteggi su cavalletti',OPE_POT:'Ponti su ruote - trabattelli',OPE_DPC:'Altri DPC',
  PIN_IND:'Indumenti di protezione',PIN_TES:'Protezione della testa',PIN_PIE:'Protezione dei piedi',PIN_MAN:'Protezione delle mani',PIN_UDI:"Protezione dell'udito",PIN_CAD:'Protezione contro la caduta dall’alto',PIN_OCC:'Protezione degli occhi',PIN_RES:'Protezione delle vie respiratorie',
  DOC_GEN:'Generale',DOC_MA4:'Macchine e attrezzature (art. 71, c4)',DOC_MA8:'Macchine e attrezzature (art. 71, c8)',DOC_DPI:'DPI',DOC_ELE:'Impianto elettrico e di terra',DOC_PON:'Ponteggi',
  SOG_FIG:'Nomine di figura di sistema',
  FOR_BAS:'Formazione di base',FOR_FIG:'Figura di sistema',FOR_RIS:'Form./addes. Rischi specifici',FOR_ATM:'Form./addes. Attrezzature/macchine'
}

const _CHK_PREF={
  'IMP_LOG':'Logistica','IMP_IGS':'Appr. igienico-sanitari',
  'IMP_ELE':'Impianti elettrici','IMP_AGI':'Agibilita cantiere',
  'IMP_ORG':'Organizzazione lavoro','IMP_SEG':'Segnaletica','IMP_CON':'Condizioni al contorno',
  'PLL_SCA':'Aree di scavo','PLL_DEM':'Aree demolizione','PLL_OCA':'Altre aree pericolo','PLL_PER':'Opere in c.a.',
  'SOL_GRU':'Gru','SOL_AUT':'Autogru','SOL_ARG':'Argano',
  'SOL_PIA':'Piattaforme elevabili','SOL_ASO':'Altri sollevatori',
  'ASU_ATT':'Attrezzature','ASU_SCA':'Scale','ASU_UTE':'Utensili',
  'MAC_MAS':'Macchine mov. terra','MAC_MMM':'Macchine mov. materiale','MAC_MMT':'Macchine stradali',
  'OPE_POF':'Ponteggi fissi','OPE_POS':'Ponteggi sospesi','OPE_POC':'Ponti su cavalletti',
  'OPE_POT':'Trabattelli','OPE_DPC':'Altri DPC',
  'PIN_IND':'Indumenti protezione','PIN_TES':'Protezione testa','PIN_PIE':'Protezione piedi',
  'PIN_MAN':'Protezione mani','PIN_UDI':'Protezione udito',
  'PIN_CAD':'Protezione caduta','PIN_OCC':'Protezione occhi','PIN_RES':'Protezione resp.',
  'DOC_GEN':'Doc. generale','DOC_GEN_SOL':'Doc. sollevamento','DOC_MA4':'Doc. macchine',
  'DOC_ELE':'Doc. imp. elettrico','DOC_PON':'Doc. ponteggi',
  'SOG_FIG':'Nomine figure sistema',
  'FOR_BAS':'Formazione base','FOR_FIG':'Form. figura sistema',
  'FOR_RIS':'Form. rischi specifici','FOR_ATM':'Form. attrezzature'
}
