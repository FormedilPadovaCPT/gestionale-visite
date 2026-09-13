/* genPDF del Gestionale Visite com'era FINO AL 13/09/2026 (grafica con bande arancioni e tabelle a griglia).
   Estratta identica dal commit 2fc6efe (tag verbale-precedente-2026-09-13), prima dello stile «ciclo con rilievi».
   Non si carica da nessuna parte: si rimette in index.html con tools/ripristina_verbale_precedente.py. */
async function genPDF(vid, output='save'){
  if(_pdfInProgress&&output==='save'){toast('PDF già in generazione, attendi…','warn');return}
  _pdfInProgress=true
  toast('Generazione PDF…')
  try{
    if(!vid){toast('ID visita mancante','err');_pdfInProgress=false;return}
    if(!window.jspdf?.jsPDF){toast('Libreria PDF non caricata — ricarica la pagina','err');_pdfInProgress=false;return}
    // Ricarica sempre voci dal DB per avere articolo/importo_sanzione aggiornati
    {
      const{data:vd}=await sb.from('checklist_voci').select('*').order('ordine')
      if(vd?.length) S.voci=vd
    }

    const{data:v,error:eV}=await sb.from('visite').select(`*,tecnici!visite_tecnico_id_fkey(*),cantieri(*,committenti(*)),imprese(*)`).eq('visita_id',vid).single()
    if(eV)throw new Error('Errore caricamento visita: '+eV.message)
    const{data:chk}=await sb.from('visite_checklist').select('codice,valore,nota').eq('visita_id',vid)
    const{data:lavs}=await sb.from('visite_lavorazioni').select('genere,fase,lavorazione').eq('visita_id',vid)
    const{data:imps}=await sb.from('visite_imprese_presenti').select('*,imprese(impresa_nome,impresa_cf,piva,impresa_email_ref)').eq('visita_id',vid).order('ordine')

    if(!v){toast('Visita non trovata','err');return}

    // Rettifica: dicitura sul PDF se è in corso un reinvio rettificato
    // oppure se l'ultimo invio registrato è una rettifica
    let _rettBanner=null
    try{
      if(window._evRettifica){
        _rettBanner='Sostituisce integralmente il verbale trasmesso il '+(window._evRettifica.dataPrimoInvio||'')
      }else{
        const{data:_ri}=await sb.from('verbali').select('tipo,inviato_at').eq('visita_id',vid).eq('inviato_email',true).order('inviato_at',{ascending:false}).limit(2)
        if(_ri&&_ri[0]?.tipo==='rettifica'){
          const _fmtR=iso=>{const d=new Date(iso);return isNaN(d)?'':`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`}
          _rettBanner=_ri[1]?('Sostituisce integralmente il verbale trasmesso il '+_fmtR(_ri[1].inviato_at)):('Rettifica trasmessa il '+_fmtR(_ri[0].inviato_at))
        }
      }
    }catch(_rb){console.warn('banner rettifica:',_rb)}

    // S.voci già garantito caricato sopra (before try)
    if(false){
    }

    const{jsPDF}=window.jspdf
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
    const PW=210,L=14,W=PW-28
    let y=0

    const ORANGE=[231,80,15],GREY=[86,92,102],WHITE=[255,255,255],BLUE=[149,194,47]
    const setFont=(style='normal',sz=9,color=GREY)=>{doc.setFont('helvetica',style);doc.setFontSize(sz);doc.setTextColor(...color)}
    const ln=(h=5)=>{y+=h}
    const hLine=(color=GREY,lw=0.3)=>{doc.setDrawColor(...color);doc.setLineWidth(lw);doc.line(L,y,PW-L,y)}

    // Lookup maps
    const TIPO_ACC={1:'Su segnalazione',2:'Su richiesta',3:'Per protocolli di intesa',4:'Indicata da RLS/RLST',5:'Programmata',6:'Cantiere qualità',7:'Indicata dal CPT'}
    const TIP_INT={1:'Costruzione',2:'Ristrutturazione',3:'Demolizione',4:'Ampliamento',5:'Altro'}
    const TIP_OPE={1:'Industriale',2:'Civile',3:'Commerciale',5:'Stradale',8:'Scolastica',16:'Altro'}
    const IMP_LBL={1:'fino a 250.000',2:'da 250.001 a 500.000',3:'da 500.001 a 1.000.000',4:'da 1.000.001 a 1.500.000',5:'da 1.500.001 a 2.500.000',6:'da 2.500.001 a 3.500.000',7:'da 3.500.001 a 5.000.000',8:'da 5.000.001 a 10.000.000',9:'da 10.000.001 a 15.000.000',10:'oltre 15.000.000',11:'non disponibile'}
    const DUR_LBL={1:'< 30 giorni',2:'da 30 a 90 giorni',3:'da 3 a 6 mesi',4:'da 6 a 12 mesi',5:'> 12 mesi'}
    const PREF_LBL={
      'IMP_LOG':'Logistica','IMP_IGS':'Apprestamenti igienico-sanitari e di sicurezza',
      'IMP_ELE':'Impianti elettrici','IMP_AGI':'Agibilità del cantiere',
      'IMP_ORG':'Organizzazione del lavoro','IMP_SEG':'Segnaletica','IMP_CON':'Condizioni al contorno',
      'PLL_SCA':'Aree di scavo','PLL_DEM':'Aree di demolizione','PLL_OCA':'Altre aree di pericolo','PLL_PER':'Opere in c.a.',
      'SOL_GRU':'Gru','SOL_AUT':'Autogru / Gru su autocarro','SOL_ARG':'Argano',
      'SOL_PIA':'Piattaforme di lavoro elevabili','SOL_ASO':'Altri apparecchi di sollevamento',
      'ASU_ATT':'Attrezzature','ASU_SCA':'Scale','ASU_UTE':'Utensili',
      'MAC_MAS':'Macchine movimento terra','MAC_MMM':'Macchine movimentazione materiale','MAC_MMT':'Macchine stradali',
      'OPE_POF':'Ponteggi fissi','OPE_POS':'Ponteggi sospesi','OPE_POC':'Ponti su cavalletti',
      'OPE_POT':'Ponti su ruote – trabattelli','OPE_DPC':'Altri DPC',
      'PIN_IND':'Indumenti di protezione','PIN_TES':'Protezione della testa','PIN_PIE':'Protezione dei piedi',
      'PIN_MAN':'Protezione delle mani','PIN_UDI':'Protezione dell\'udito',
      'PIN_CAD':'Protezione controllo caduta dall\'alto','PIN_OCC':'Protezione degli occhi',
      'PIN_RES':'Protezione delle vie respiratorie',
      'DOC_GEN':'Generale','DOC_GEN_SOL':'Apparecchi di sollevamento','DOC_MA4':'Macchine e attrezzature',
      'DOC_ELE':'Impianto elettrico e di terra','DOC_PON':'Ponteggi',
      'SOG_FIG':'Nomine di figura di sistema',
      'FOR_BAS':'Formazione di base','FOR_FIG':'Figura di sistema',
      'FOR_RIS':'Form./addes. rischi specifici','FOR_ATM':'Form./addes. attrezzature/macchine'
    }

    // Data helpers
    const _mesi=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
    const _gg=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato']
    const fmtLeggibile=s=>{if(!s)return '';const d=new Date(s+'T00:00:00');if(isNaN(d))return s;return `${_gg[d.getDay()]} ${d.getDate()} ${_mesi[d.getMonth()]} ${d.getFullYear()}`}
    const oggi=new Date()
    const dataOggi=`${oggi.getDate().toString().padStart(2,'0')}/${(oggi.getMonth()+1).toString().padStart(2,'0')}/${oggi.getFullYear()}`

    // Dati principali
    const cant=v.cantieri||{}
    const impPrinc=imps&&imps.length?imps[0]:null
    const impNome=impPrinc?.imprese?.impresa_nome||v.imprese?.impresa_nome||''
    const impCF=impPrinc?.imprese?.impresa_cf||v.imprese?.impresa_cf||''
    const impEmail=impPrinc?.imprese?.impresa_email_ref||v.imprese?.impresa_email_ref||''
    const impRuolo=impPrinc?.ruolo||''
    const tecNome=v.tecnici?`${v.tecnici.tecnico_nome||''} ${v.tecnici.tecnico_cognome||''}`.trim():''
    const tecEmail=v.tecnici?.email||''
    // Secondo tecnico
    let tec2Nome='',tec2Email=''
    if(v.tecnico2_id){
      const{data:t2}=await sb.from('tecnici').select('tecnico_nome,tecnico_cognome,email').eq('tecnico_id',v.tecnico2_id).maybeSingle()
      if(t2){tec2Nome=`${t2.tecnico_nome||''} ${t2.tecnico_cognome||''}`.trim();tec2Email=t2.email||''}
    }
    const nomStagePDF=v.stage_vis&&v.nom_stage?v.nom_stage:''
    const cantLabel=cant.cantiere_etichetta||`${cant.cantiere_indirizzo||''} ${cant.cantiere_civico||''}`.trim()
    const comuneLabel=cant.comune_nome||''
    const cantDetail=[cantLabel,comuneLabel].filter(Boolean).join(' – ')

    // chkMap
    const chkMap={};(chk||[]).forEach(r=>{chkMap[r.codice]={valore:r.valore,nota:r.nota}})

    // ════════════════════════════════════════════════
    // PAGINA 1 – LETTERA DI ACCOMPAGNAMENTO
    // ════════════════════════════════════════════════
    y=14
    doc.setFillColor(...ORANGE);doc.rect(0,0,PW,20,'F')
    setFont('bold',15,WHITE);doc.text('FORMEDIL PADOVA',L,10)
    setFont('normal',7,WHITE);doc.text('Scuola Costruzioni Giuseppe Jappelli  ·  Ente unico formazione e sicurezza',L,16)
    setFont('bold',9,WHITE);doc.text('Area Sicurezza e Salute',PW-L,10,{align:'right'})
    y=28

    setFont('normal',10,GREY);doc.text(dataOggi,PW-L,y,{align:'right'})
    y+=10

    if(_rettBanner){
      doc.setDrawColor(...ORANGE);doc.setLineWidth(0.5);doc.setFillColor(253,236,228)
      doc.roundedRect(L,y-4,W,13,1.5,1.5,'FD')
      setFont('bold',10,ORANGE);doc.text('VERBALE RETTIFICATO',L+4,y+1.5)
      setFont('normal',8.5,[120,60,30]);doc.text(_rettBanner,L+4,y+6.5)
      y+=17
    }

    setFont('normal',10,[50,50,50]);doc.text('Spett.le impresa',PW-L-65,y)
    if(impNome){setFont('bold',10,[30,30,30]);doc.text(impNome,PW-L-65,y+6)}
    y+=20

    setFont('bold',11,[30,30,30]);doc.text('Prevenzione Infortuni',L,y);y+=6
    if(cantDetail){setFont('normal',10,[50,50,50]);doc.text('Cantiere di '+cantDetail,L,y);y+=8}
    y+=6

    const dataLeg=fmtLeggibile(v.data_visita)
    const corpo=` Il giorno ${dataLeg||fmtDate(v.data_visita)||'–'} è passato nel vostro cantiere in oggetto, per fornirvi utili consigli in materia di prevenzione infortuni, uno dei nostri tecnici${tecNome?', '+tecNome:''}.

 Egli si è soffermato ad illustrare al VS personale in cantiere le più importanti norme che devono essere tenute presenti per garantire la sicurezza durante le varie fasi lavorative, con particolare riferimento a quelle in corso.

 In base a quanto previsto dalle norme che regolano il funzionamento dello scrivente Comitato Paritetico Territoriale potrà essere effettuata, entro breve termine, una successiva visita per constatare che i consigli forniti siano stati correttamente attuati.`

    setFont('normal',10,[40,40,40])
    const bodyLines=doc.splitTextToSize(corpo,W)
    doc.text(bodyLines,L,y);y+=bodyLines.length*5+14

    setFont('normal',10,[40,40,40]);doc.text('Distinti saluti.',L+10,y);y+=10

    // ── QR CODE a destra + firma a sinistra ──
    const qrSize=32, qrX=PW-L-qrSize, qrY=y
    try{
      const _qrResp=await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=320x320&color=e7500f&bgcolor=ffffff&data=${encodeURIComponent('https://formedilpadovacpt.github.io/servizi/#')}`)
      if(_qrResp.ok){
        const _qrBlob=await _qrResp.blob()
        const _qrB64=await new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(_qrBlob)})
        doc.addImage(_qrB64,'PNG',qrX,qrY,qrSize,qrSize)
        setFont('bold',5,ORANGE);doc.text('FORMEDIL PADOVA · CPT',qrX+qrSize/2,qrY+qrSize+3,{align:'center'})
        setFont('normal',4.5,GREY);doc.text('I NOSTRI SERVIZI',qrX+qrSize/2,qrY+qrSize+6.5,{align:'center'})
        setFont('normal',3.8,[150,150,150]);doc.text('formedilpadovacpt.github.io/servizi/#',qrX+qrSize/2,qrY+qrSize+9.5,{align:'center'})
      }
    }catch(_eQR){console.warn('QR fetch non riuscito',_eQR)}

    // Firma testuale a sinistra
    const _firmaW=qrX-L-5
    setFont('bold',8,[40,40,40]);doc.text('Renato Squizzato',L,y+4)
    setFont('bold',7,ORANGE);doc.text('Area Sicurezza e Salute | FORMEDIL PADOVA',L,y+9)
    setFont('normal',7,GREY)
    doc.text('Via Basilicata 10 – 35127 Padova (PD)',L,y+14,{maxWidth:_firmaW})
    doc.text('email: cpt@formedilpadova.it · cptpd@did.formedilpadova.it',L,y+18.5,{maxWidth:_firmaW})
    doc.text('www.formedilpadova.it   Tel. 049 - 761168 (int.4)',L,y+23,{maxWidth:_firmaW})
    setFont('normal',6,[130,130,130])
    doc.text('Organismo Accreditato Regione Veneto per la formazione – L.R. n. 19/02 cod. AO119 – per i servizi al lavoro cod. L236',L,y+28,{maxWidth:_firmaW})

    // Disclaimer GDPR
    y=qrY+qrSize+14
    setFont('italic',5.5,[150,150,150])
    const _privTxt='Ai sensi del Regolamento (UE) 2016/679 (GDPR) relativo alla protezione delle persone fisiche con riguardo al trattamento dei dati personali, la presente comunicazione è destinata unicamente alle persone sopra indicate e le informazioni in essa contenute sono da considerarsi strettamente riservate. Se avete ricevuto questo messaggio per errore, siete pregati di rispedirlo al mittente, distruggendo qualunque copia in Vostro possesso, grazie.'
    doc.text(doc.splitTextToSize(_privTxt,W),L,y)

    // ════════════════════════════════════════════════
    // PAGINA 2 – DATI VISITA + CHECKLIST
    // ════════════════════════════════════════════════
    doc.addPage();y=10

    // Header
    doc.setFillColor(...ORANGE);doc.rect(0,0,PW,20,'F')
    setFont('bold',16,WHITE);doc.text('FORMEDIL PADOVA',L,11)
    setFont('normal',7,WHITE);doc.text('ENTE UNICO FORMAZIONE E SICUREZZA',L,17)
    setFont('bold',13,WHITE);doc.text('VERBALE DI SOPRALLUOGO IN CANTIERE',PW-L,11,{align:'right'})
    setFont('normal',7,WHITE);doc.text('Area Sicurezza e Salute',PW-L,17,{align:'right'})
    y=24

    // Riga tecnico/data/tipo – eventuale 2° tecnico e stagista su righe separate
    const _bodyRiga1=[
      {content:tecNome||'–',styles:{fontStyle:'bold'}},
      fmtDate(v.data_visita),
      TIPO_ACC[v.tipo_accesso]||'–',
      v.acc_cant?String(v.acc_cant):'–',
      cant.cantiere_etichetta||'–',
      v.nr_verbale||'–'
    ]
    const _tecBody=[_bodyRiga1]
    if(tec2Nome||nomStagePDF){
      _tecBody.push([
        tec2Nome?{content:'2° '+tec2Nome,styles:{fontSize:7,textColor:[80,80,80]}}:{content:'',styles:{textColor:[180,180,180]}},
        '','','',
        nomStagePDF?{content:'Stagista: '+nomStagePDF,styles:{fontSize:7,textColor:[80,80,80]}}:'',
        ''
      ])
    }
    doc.autoTable({startY:y,
      head:[['TECNICO','DATA','TIPOLOGIA VISITA','N° ACCESSO','ETICHETTA CANTIERE','NR VISITA']],
      body:_tecBody,
      styles:{fontSize:8,cellPadding:2},
      headStyles:{fillColor:GREY,textColor:WHITE,fontStyle:'bold',fontSize:7},
      columnStyles:{0:{cellWidth:38},1:{cellWidth:20},2:{cellWidth:34},3:{cellWidth:16,halign:'center'},5:{cellWidth:18,halign:'center'}},
      margin:{left:L,right:L},tableWidth:W,theme:'grid'
    })
    y=doc.lastAutoTable.finalY+3

    // ── IMPRESE PRESENTI (tutte) ──
    const LBL=[240,241,243]        // grigio chiarissimo per celle-etichetta
    const HDR=[214,217,222]        // grigio chiaro per barre di sezione
    const HDRTXT=[70,76,86]        // testo scuro su barra grigia
    doc.setFillColor(...HDR);doc.rect(L,y,W,5.5,'F')
    setFont('bold',8,HDRTXT);doc.text('Imprese presenti in cantiere',L+2,y+4);y+=7

    const impsRows=[]
    ;(imps||[]).forEach((im,i)=>{
      const nome=im.imprese?.impresa_nome||'–'
      const ruolo=TIPO_IMP_OPT[im.tipo_imp]||im.ruolo||'–'
      const cf=im.imprese?.impresa_cf||'–'
      const piva=im.imprese?.piva||(im.impresa_id&&!/^\d{1,6}$/.test(im.impresa_id)?im.impresa_id:'')||''
      const email=im.imprese?.impresa_email_ref||'–'
      const nomeCell=`${i+1}. ${nome}`
      const nrLav=+im.nr_lav||0
      impsRows.push([
        {content:nomeCell,styles:{fontStyle:'bold'}},
        {content:ruolo,styles:{halign:'center'}},
        {content:piva||'–'},
        {content:cf},
        {content:String(nrLav),styles:{halign:'center'}},
        {content:email,styles:{fontSize:6.5}}
      ])
      const _noteImp=(im.note_fasilav||'').trim()
      if(_noteImp)impsRows.push([{content:'Note fasi/lavorazione (questa impresa): '+_noteImp,colSpan:6,styles:{fontSize:7,fontStyle:'italic',textColor:[90,90,90],fillColor:[248,248,248]}}])
    })
    if(!impsRows.length) impsRows.push([{content:'Nessuna impresa registrata',colSpan:6,styles:{halign:'center',textColor:[180,180,180]}}])

    doc.autoTable({startY:y,
      head:[[
        {content:'Ragione sociale',styles:{fontStyle:'bold'}},
        {content:'Ruolo',styles:{fontStyle:'bold',cellWidth:24,halign:'center'}},
        {content:'P.IVA',styles:{fontStyle:'bold',cellWidth:26}},
        {content:'Cod. fiscale',styles:{fontStyle:'bold',cellWidth:28}},
        {content:'N° lav.',styles:{fontStyle:'bold',cellWidth:14,halign:'center'}},
        {content:'Email verbale',styles:{fontStyle:'bold',cellWidth:40}}
      ]],
      body:impsRows,
      styles:{fontSize:7.5,cellPadding:1.8},
      columnStyles:{2:{cellWidth:26,fontSize:9,fontStyle:'bold'},3:{cellWidth:28,fontSize:9,fontStyle:'bold'}},
      headStyles:{fillColor:LBL,textColor:GREY,fontStyle:'bold',fontSize:7},
      margin:{left:L,right:L},tableWidth:W,theme:'grid'
    })
    y=doc.lastAutoTable.finalY+3

    // ── FIGURE DI SISTEMA ──
    const figureRows=[]
    const _addFig=(ruolo,nome,email,tel)=>{if(!nome&&!email&&!tel)return;figureRows.push([ruolo,nome||'–',email||'–',tel||'–'])}
    if(v.nom_ppre){_addFig('Persona presente',v.nom_ppre+(v.qual_ppre?' ('+v.qual_ppre+')':''),'',v.tel_ppre||'')}
    _addFig('Resp. dei lavori',v.resp_lav,v.rl_email,v.rl_tel)
    _addFig('CSP',v.csp,v.csp_email,v.csp_tel)
    _addFig('CSE',v.cse,v.cse_email,v.cse_tel)

    if(figureRows.length){
      doc.setFillColor(...HDR);doc.rect(L,y,W,5.5,'F')
      setFont('bold',8,HDRTXT);doc.text('Figure di sistema',L+2,y+4);y+=7
      doc.autoTable({startY:y,
        head:[[
          {content:'Ruolo',styles:{fontStyle:'bold',cellWidth:32}},
          {content:'Nominativo',styles:{fontStyle:'bold',cellWidth:55}},
          {content:'Email',styles:{fontStyle:'bold'}},
          {content:'Tel.',styles:{fontStyle:'bold',cellWidth:28}}
        ]],
        body:figureRows,
        styles:{fontSize:7.5,cellPadding:1.8},
        headStyles:{fillColor:LBL,textColor:GREY,fontStyle:'bold',fontSize:7},
        margin:{left:L,right:L},tableWidth:W,theme:'grid'
      })
      y=doc.lastAutoTable.finalY+3
    }

    // Sezione cantiere
    doc.setFillColor(...HDR);doc.rect(L,y,W,5.5,'F')
    setFont('bold',8,HDRTXT);doc.text('Dati del cantiere',L+2,y+4);y+=7
    const _lavTextC=lavs&&lavs.length?lavs.map(l=>[l.genere,l.fase,l.lavorazione].filter(Boolean).join(' - ')).filter(Boolean).join('; '):'–'
    const _noteLavC=(v.note_lav||'').trim()||'–'

    const tipInt=TIP_INT[cant.cantiere_tip_int]||'–'
    const tipOpe=TIP_OPE[cant.cantiere_tip_ope]||'–'
    const impLbl=IMP_LBL[cant.cantiere_importo]||'–'
    const durLbl=DUR_LBL[cant.cantiere_durata]||'–'

    // Tabella cantiere: layout 4 colonne uniforme (label 40mm | val 50mm | label 40mm | val auto)
    doc.autoTable({startY:y,
      body:[
        [{content:'Indirizzo',styles:{fontStyle:'bold',fillColor:LBL}},{content:cant.cantiere_indirizzo||'–'},{content:'N° civico',styles:{fontStyle:'bold',fillColor:LBL}},{content:cant.cantiere_civico||'–'}],
        [{content:'Comune',styles:{fontStyle:'bold',fillColor:LBL}},{content:cant.comune_nome||'–'},{content:'CAP',styles:{fontStyle:'bold',fillColor:LBL}},{content:cant.cantiere_cap||'–'}],
        [{content:'Tipo intervento',styles:{fontStyle:'bold',fillColor:LBL}},{content:tipInt},{content:'Tipo opera',styles:{fontStyle:'bold',fillColor:LBL}},{content:tipOpe}],
        [{content:'Importo lavori (€)',styles:{fontStyle:'bold',fillColor:LBL}},{content:impLbl},{content:'Durata cantiere',styles:{fontStyle:'bold',fillColor:LBL}},{content:durLbl}],
        [{content:'Codice CNCE',styles:{fontStyle:'bold',fillColor:LBL}},{content:cant.cantiere_cnce||'–'},{content:'Codice univoco',styles:{fontStyle:'bold',fillColor:LBL}},{content:cant.nodo_id||'–'}],
        [{content:'N° imprese in cantiere',styles:{fontStyle:'bold',fillColor:LBL}},{content:String((imps||[]).filter(im=>im.impresa_id).length||v.nr_imp||1)},{content:'Totale lavoratori',styles:{fontStyle:'bold',fillColor:LBL}},{content:String((imps||[]).reduce((s,im)=>s+(+im.nr_lav||0),0)||v.nr_lavoratori||0)}],
        [{content:'Lavorazioni in corso',styles:{fontStyle:'bold',fillColor:LBL}},{content:_lavTextC,colSpan:3}],
        [{content:'Note lavorazioni',styles:{fontStyle:'bold',fillColor:LBL}},{content:_noteLavC,colSpan:3}]
      ],
      styles:{fontSize:7.5,cellPadding:1.8},
      columnStyles:{0:{cellWidth:40},1:{cellWidth:50},2:{cellWidth:40}},
      margin:{left:L,right:L},tableWidth:W,theme:'grid'
    })
    y=doc.lastAutoTable.finalY+3

    // Sezione visita (lavorazioni + IPC + note tecnico)
    doc.setFillColor(...HDR);doc.rect(L,y,W,5.5,'F')
    setFont('bold',8,HDRTXT);doc.text('Dati della visita',L+2,y+4);y+=7


    // IPC – Indice di Pericolosità del Cantiere
    const _cntNCp=(chk||[]).filter(r=>r.valore==='NC+').length
    const _cntNCn=(chk||[]).filter(r=>r.valore==='NC-').length
    const _cntOSS=(chk||[]).filter(r=>r.valore==='OSS').length
    const _cntVER=(chk||[]).filter(r=>r.valore==='VER').length
    // Logica IPC ufficiale Formedil (identica a calcIPC dell'app):
    //  ALTO  = almeno 1 NC+  oppure più di 3 NC-
    //  MEDIO = più di 6 OSS  oppure da 1 a 3 NC-
    //  BASSO = da 1 a 6 OSS
    //  NR    = nessun rilievo
    let ipcLabel,ipcBg,ipcTxt
    if(_cntNCp>=1||_cntNCn>3){ipcLabel='ALTO';ipcBg=[200,30,30];ipcTxt=WHITE}
    else if(_cntOSS>6||(_cntNCn>=1&&_cntNCn<=3)){ipcLabel='MEDIO';ipcBg=[231,80,15];ipcTxt=WHITE}
    else if(_cntOSS>=1&&_cntOSS<=6){ipcLabel='BASSO';ipcBg=[210,170,0];ipcTxt=WHITE}
    else{ipcLabel='NESSUN RILIEVO';ipcBg=[39,174,96];ipcTxt=WHITE}
    const ipcDetail=`NC+: ${_cntNCp}   NC-: ${_cntNCn}   OSS: ${_cntOSS}   VER: ${_cntVER}`
    doc.autoTable({startY:y,
      body:[[
        {content:'IPC – Indice di Pericolosità del Cantiere',styles:{fontStyle:'bold',fillColor:LBL,cellWidth:90}},
        {content:ipcLabel,styles:{fontStyle:'bold',fillColor:ipcBg,textColor:ipcTxt,halign:'center',cellWidth:32}},
        {content:ipcDetail,styles:{fontSize:7,fillColor:[248,248,248],halign:'center'}}
      ]],
      styles:{fontSize:8,cellPadding:2.5},
      margin:{left:L,right:L},tableWidth:W,theme:'grid'
    })
    y=doc.lastAutoTable.finalY+2

    // Testo IPC – riga di commento in base al livello di pericolosità
    const ipcMsg=ipcLabel==='ALTO'||ipcLabel==='MEDIO'
      ?"Per quanto osservato in cantiere, si invita l'impresa ad attivare immediatamente le procedure atte ad eliminare i rischi riscontrati. Si precisa che l'attività di consulenza tecnica erogata non solleva l'Impresa dalle proprie responsabilità per il mancato adempimento delle prescrizioni di legge."
      :ipcLabel==='BASSO'
      ?"Vogliate tener conto delle osservazioni sopra riportate. Si invita l'impresa ad attivare le procedure atte ad eliminare i rischi riscontrati. Si precisa che l'attività di consulenza tecnica erogata non solleva l'Impresa dalle proprie responsabilità per il mancato adempimento delle prescrizioni di legge."
      :"Il cantiere risulta in buone condizioni di sicurezza." 
    const ipcMsgFill=(ipcLabel==='ALTO'||ipcLabel==='MEDIO')?[255,220,220]:ipcLabel==='BASSO'?[255,250,180]:[220,245,220]
    const ipcMsgLine=(ipcLabel==='ALTO'||ipcLabel==='MEDIO')?[200,0,0]:ipcLabel==='BASSO'?[190,150,0]:[39,130,60]
    doc.autoTable({startY:y,
      body:[[{content:ipcMsg}]],
      styles:{fontSize:7.5,cellPadding:2,fontStyle:'italic',textColor:[50,50,50],fillColor:ipcMsgFill,lineColor:ipcMsgLine,lineWidth:0.5},
      margin:{left:L,right:L},tableWidth:W,theme:'grid'
    })
    y=doc.lastAutoTable.finalY+2

    // Osservazioni del tecnico (se presenti) – colorate in base all'IPC rilevato,
    // titolo in alto a tutta larghezza per lasciare più spazio al testo inserito.
    if(v.oss_tec){
      const ossHdr=(ipcLabel==='ALTO')?[235,180,180]:(ipcLabel==='MEDIO')?[250,205,160]:(ipcLabel==='BASSO')?[245,233,160]:[200,228,200]
      const ossBody=(ipcLabel==='ALTO')?[252,235,235]:(ipcLabel==='MEDIO')?[255,243,224]:(ipcLabel==='BASSO')?[255,251,228]:[233,246,233]
      const ossLine=(ipcLabel==='ALTO')?[200,0,0]:(ipcLabel==='MEDIO')?[210,90,15]:(ipcLabel==='BASSO')?[190,150,0]:[39,130,60]
      doc.autoTable({startY:y,
        body:[
          [{content:`Osservazioni del tecnico  ·  IPC ${ipcLabel}`,styles:{fontStyle:'bold',fillColor:ossHdr,textColor:[50,50,50]}}],
          [{content:v.oss_tec,styles:{fillColor:ossBody}}]
        ],
        styles:{fontSize:7.5,cellPadding:1.8,lineColor:ossLine,lineWidth:0.7},
        margin:{left:L,right:L},tableWidth:W,theme:'grid'
      })
      y=doc.lastAutoTable.finalY+2
    }
    y+=2

    // Box metodologia – non spezzare tra le pagine: se non entra intero, vai a pagina nuova
    if(y+30>282){doc.addPage();y=15}
    const metodologia=[
      'METODOLOGIA DI VALUTAZIONE INTERNA – CNCPT. CRITERI DI GIUDIZIO CHE IL TECNICO USA NELL\'EFFETTUAZIONE DELLA VISITA DI CONSULENZA TECNICA IN CANTIERE',
      'NC+  inadempienze che espongono i lavoratori ad un rischio grave ed imminente (mancanza totale di parapetti su un ponteggio esteso);',
      'NC-  inadempienze che espongono i lavoratori ad un rischio generico (mancanza totale recinzione di cantiere);',
      'OSS  inadempienze la cui presenza non espone ad alcun rischio diretto (mancanza ricovero per attrezzi);'
    ]
    doc.setDrawColor(...ORANGE);doc.setLineWidth(0.5)
    doc.setFillColor(240,241,243);doc.rect(L,y,W,26,'FD')
    setFont('bold',7,ORANGE);doc.text(metodologia[0],L+2,y+4,{maxWidth:W-4})
    setFont('normal',7,GREY)
    doc.text(metodologia[1],L+2,y+11,{maxWidth:W-4})
    doc.text(metodologia[2],L+2,y+16,{maxWidth:W-4})
    doc.text(metodologia[3],L+2,y+21,{maxWidth:W-4})
    y+=30

    // ════════════════════════════════════════════════
    // CHECKLIST COMPLETA – TUTTE LE VOCI
    // ════════════════════════════════════════════════
    // Header sezione
    doc.setFillColor(...ORANGE);doc.rect(L,y,W,6,'F')
    setFont('bold',8,WHITE);doc.text('Verifiche effettuate',L+2,y+4.3)
    y+=8

    // Note di fine sottoarea: nei verbali importati la nota non sta sulla singola
    // voce ma in coda alla sottoarea (voci con is_nota, codici *_N / *_M)
    const noteByPref={}
    ;(S.voci||[]).filter(vv=>vv.is_nota).forEach(vv=>{
      const r=chkMap[vv.codice]||{}
      const txt=(r.nota||'').trim()
      if(!txt)return
      const p=vv.prefisso||'_'
      const z=vv.zona_osserv
      if(!noteByPref[z])noteByPref[z]={}
      noteByPref[z][p]=(noteByPref[z][p]?noteByPref[z][p]+' ':'')+txt
    })

    // Raggruppa per zona e prefisso
    const vociByZona={}
    ;(S.voci||[]).filter(vv=>!vv.is_nota).forEach(vv=>{
      const z=vv.zona_osserv
      if(!vociByZona[z])vociByZona[z]={}
      const p=vv.prefisso||'_'
      if(!vociByZona[z][p])vociByZona[z][p]=[]
      vociByZona[z][p].push(vv)
    })

    let totalSanzione=0  // accumula sanzioni per OSS/NC+/NC-

    for(const zona of Object.keys(vociByZona).map(Number).sort((a,b)=>a-b)){
      const zonaLbl=(ZONE_LBL[zona]||String(zona)).toUpperCase()
      const prefissi=vociByZona[zona]

      // Verifica se la zona ha almeno un rilievo valorizzato
      const zonaHasRows=Object.values(prefissi).some(voci=>
        voci.some(vv=>{const r=chkMap[vv.codice]||{};return r.valore&&r.valore!=='NA'})
      )||Object.keys(noteByPref[zona]||{}).length>0
      if(!zonaHasRows) continue

      // Intestazione zona (sfondo grigio)
      doc.autoTable({startY:y,
        head:[[{content:zonaLbl,colSpan:3,styles:{halign:'left'}}]],
        body:[],
        styles:{fontSize:7.5,cellPadding:2},
        headStyles:{fillColor:GREY,textColor:WHITE,fontStyle:'bold',fontSize:8},
        columnStyles:{0:{cellWidth:55},1:{cellWidth:12,halign:'center'},2:{cellWidth:W-67}},
        margin:{left:L,right:L},tableWidth:W,theme:'grid'
      })
      y=doc.lastAutoTable.finalY

      for(const [pref,voci] of Object.entries(prefissi)){
        const prefLbl=PREF_LBL[pref]||pref
        // Solo voci con rilievo valorizzato (escludo n.v.)
        const rows=[]
        for(const vv of voci){
          const r=chkMap[vv.codice]||{}
          const val=r.valore&&r.valore!=='NA'?r.valore:null
          if(!val) continue
          const isViolazione=['OSS','NC+','NC-'].includes(val)
          if(isViolazione&&vv.importo_sanzione) totalSanzione+=Number(vv.importo_sanzione)
          rows.push([vv.descrizione||'', val, r.nota||''])
          // Riga articolo di legge subito sotto la voce (colSpan 3) per OSS/NC+/NC-
          if(isViolazione&&vv.articolo){
            rows.push([{
              content: vv.articolo,
              colSpan:3,
              styles:{fontSize:6.5,fontStyle:'italic',textColor:[160,90,20],fillColor:[255,248,240],cellPadding:{top:0,bottom:2,left:8,right:2}}
            }])
          }
        }

        // nota di sottoarea (verbali importati): va stampata anche senza rilievi
        const notaPref=(noteByPref[zona]||{})[pref]||''
        if(notaPref){
          rows.push([{
            content:'Nota: '+notaPref,
            colSpan:3,
            styles:{fontSize:6.8,fontStyle:'italic',textColor:[70,70,70],fillColor:[247,247,247],cellPadding:{top:1.5,bottom:1.5,left:4,right:2}}
          }])
        }
        if(!rows.length) continue  // nessun rilievo ne' nota in questo sottogruppo → salta

        doc.autoTable({startY:y,
          head:[[{content:prefLbl,colSpan:3,styles:{halign:'left',fontStyle:'bold'}}]],
          body:rows,
          styles:{fontSize:7,cellPadding:1.5},
          headStyles:{fillColor:[230,230,230],textColor:[50,50,50],fontStyle:'bold',fontSize:7},
          columnStyles:{
            0:{cellWidth:55},
            1:{cellWidth:12,halign:'center'},
            2:{cellWidth:W-67}
          },
          margin:{left:L,right:L},tableWidth:W,theme:'grid',
          didParseCell:(d)=>{
            if(d.section==='body'){
              if(d.column.index===1){
                const val=d.cell.raw
                if(val==='NC+'){d.cell.styles.textColor=[200,30,30];d.cell.styles.fontStyle='bold'}
                else if(val==='NC-'){d.cell.styles.textColor=[231,80,15];d.cell.styles.fontStyle='bold'}
                else if(val==='OSS'){d.cell.styles.textColor=[160,120,0];d.cell.styles.fontStyle='bold'}
                else if(val==='VER'){d.cell.styles.textColor=[39,174,96];d.cell.styles.fontStyle='bold'}
              }
              // Articolo di legge nella colonna descrizione: seconda riga in corsivo grigio
              if(d.column.index===0&&typeof d.cell.raw==='string'&&d.cell.raw.includes('\n')){
                d.cell.styles.fontSize=7
              }
            }
          }
        })
        y=doc.lastAutoTable.finalY
      }
      y+=2
    }

    // NOTE: le Osservazioni del tecnico sono già incluse nella sezione Dati della visita
    // Le Note per il mittente non vengono incluse nel verbale

    // RIQUADRO SANZIONI – solo se ci sono violazioni con importo
    if(totalSanzione>0){
      const fmtEur=(n)=>n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})
      const sanzRidotta=totalSanzione/4
      // Intestazione
      doc.setFillColor(...ORANGE)
      doc.rect(L,y,W,6,'F')
      setFont('bold',8,WHITE)
      doc.text('STIMA DELLE SANZIONI APPLICABILI',L+2,y+4.2)
      y+=8
      doc.autoTable({startY:y,
        body:[
          ['Sanzione massima potenziale pari a:','€ '+fmtEur(totalSanzione)],
          ['Sanzione ridotta di 1/4 pari a:','€ '+fmtEur(sanzRidotta)]
        ],
        styles:{fontSize:8,cellPadding:3},
        columnStyles:{0:{cellWidth:W-50},1:{cellWidth:50,halign:'right',fontStyle:'bold'}},
        margin:{left:L,right:L},tableWidth:W,theme:'grid',
        didParseCell:(d)=>{
          if(d.column.index===1){
            d.cell.styles.textColor=d.row.index===0?[180,30,30]:[180,80,30]
          }
        }
      })
      y=doc.lastAutoTable.finalY+4
    }

    // FOTO – griglia 2×2 (~70×70 mm per foto)
    const FOTO_TIPI=['foto1','foto2','foto3','foto4','privacy']
    const imgMap={}

    // 1. Usa base64 già in memoria (sessione corrente, dopo selezione file)
    for(const tipo of FOTO_TIPI){
      if(S.foto[tipo]?.base64) imgMap[tipo]='data:image/jpeg;base64,'+S.foto[tipo].base64
    }

    // 1b. Riusa le foto già decodificate in una precedente generazione di QUESTA visita
    for(const tipo of FOTO_TIPI){
      if(!imgMap[tipo]&&_fotoPdfCache[vid+'_'+tipo]) imgMap[tipo]=_fotoPdfCache[vid+'_'+tipo]
    }

    // 2. Per gli slot ancora vuoti: recupera metadati foto da DB + S.foto in memoria
    const slotMancanti=FOTO_TIPI.filter(t=>!imgMap[t])
    if(slotMancanti.length){
      try{
        // Query DB — seleziona anche thumb_url per download diretto (no Edge Function)
        const{data:fotoRec,error:fotoErr}=await sb.from('visite_foto')
          .select('tipo,drive_file_id,thumb_url')
          .eq('visita_id',vid)
          .in('tipo',slotMancanti)
        if(fotoErr) console.warn('visite_foto select errore:',fotoErr.message)

        // Unisce metadati DB + S.foto in memoria (visitata aperta o caricata da loadFotoExisting)
        const fotoMeta={}
        for(const fr of (fotoRec||[])){
          fotoMeta[fr.tipo]={fileId:fr.drive_file_id,thumb:fr.thumb_url}
        }
        for(const tipo of slotMancanti){
          if(!fotoMeta[tipo]&&(S.foto[tipo]?.thumb||S.foto[tipo]?.fileId)){
            fotoMeta[tipo]={fileId:S.foto[tipo].fileId,thumb:S.foto[tipo].thumb}
          }
        }

        const voci=Object.entries(fotoMeta)
        if(voci.length){
          toast('Recupero foto da Drive…')
          for(const [tipo,meta] of voci){
            // ── Tentativo 1: thumb_url pubblico, fetch diretto dal browser (veloce) ──
            if(meta.thumb){
              try{
                const b64=await fetchImageBase64(meta.thumb)
                if(b64){
                  imgMap[tipo]='data:image/jpeg;base64,'+b64
                  console.log('foto thumb OK:',tipo)
                  continue
                }
              }catch(e2){console.warn('foto thumb errore:',tipo,e2.message)}
            }
            // ── Tentativo 2: download via Edge Function (con timeout 12 s) ──
            if(meta.fileId){
              const{data:{session}}=await sb.auth.getSession()
              const token=session?.access_token
              if(token){
                try{
                  const ctrl=new AbortController()
                  const tId=setTimeout(()=>ctrl.abort(),12000)
                  let dlRes
                  try{
                    dlRes=await fetch(`${SB_URL}/functions/v1/upload-foto`,{
                      method:'POST',signal:ctrl.signal,
                      headers:{Authorization:`Bearer ${token}`,apikey:SB_KEY,'Content-Type':'application/json'},
                      body:JSON.stringify({download:true,file_id:meta.fileId})
                    })
                  }finally{clearTimeout(tId)}
                  const dlData=await dlRes.json()
                  if(dlData.ok&&dlData.base64){
                    imgMap[tipo]='data:image/jpeg;base64,'+dlData.base64
                    console.log('foto Edge Function OK:',tipo)
                  } else {
                    console.warn('foto Edge Function ERRORE:',tipo,dlData.error||dlRes.status)
                  }
                }catch(e2){
                  if(e2.name==='AbortError') console.warn('foto Edge Function TIMEOUT:',tipo)
                  else console.warn('foto Edge Function errore:',tipo,e2.message)
                }
              }
            }
          }
        }
      }catch(e){console.warn('foto lookup:',e)}
    }

    // Memorizza in cache di sessione le foto risolte: le riedizioni successive
    // del PDF le ritroveranno anche se Drive non risponde o S.foto è vuoto.
    for(const tipo of FOTO_TIPI){ if(imgMap[tipo]) _fotoPdfCache[vid+'_'+tipo]=imgMap[tipo] }

    const hasFoto=FOTO_TIPI.some(t=>imgMap[t])
    if(hasFoto){
      if(y>115){doc.addPage();y=15}
      doc.setFillColor(...ORANGE);doc.rect(L,y,W,6,'F')
      setFont('bold',9,WHITE);doc.text('DOCUMENTAZIONE FOTOGRAFICA',L+2,y+4.5)
      ln(10)
      // Griglia a 2 colonne, celle 70×70 mm centrate; foto1..foto4 + eventuale foto privacy/firma
      const FW=70,FH=70,FGAP=12
      const fx=L+(W-2*FW-FGAP)/2
      const _phF=doc.internal.pageSize.getHeight()
      const FOTO_LBL={privacy:'Informativa privacy / firma'}
      // Legge larghezza e altezza dall'header JPEG (sincrono, nessun Image element)
      const jpegSize=dataUri=>{
        try{
          const b64=dataUri.includes(',')?dataUri.split(',')[1]:dataUri
          // Analizza solo i primi 6000 caratteri base64 (~4.5KB) per trovare l'header SOF — evita loop su immagini grandi
          const bytes=Uint8Array.from(atob(b64.substring(0,6000)),c=>c.charCodeAt(0))
          let j=2
          while(j<bytes.length-9){
            if(bytes[j]!==0xFF)break
            const m=bytes[j+1]
            const segLen=(bytes[j+2]<<8)|bytes[j+3]
            if((m>=0xC0&&m<=0xC3)||(m>=0xC5&&m<=0xC7)||(m>=0xC9&&m<=0xCB)||(m>=0xCD&&m<=0xCF)){
              return{w:(bytes[j+7]<<8)|bytes[j+8],h:(bytes[j+5]<<8)|bytes[j+6]}
            }
            j+=2+segLen
          }
        }catch(e){}
        return{w:4,h:3}  // fallback proporzione 4:3
      }
      // Disegna solo gli slot presenti, in ordine (privacy in coda), a 2 per riga con a-capo pagina
      const _present=FOTO_TIPI.filter(t=>imgMap[t])
      let _col=0,_rowTop=y
      for(let i=0;i<_present.length;i++){
        if(_col===0 && _rowTop+FH+FGAP>_phF-15){doc.addPage();y=15;_rowTop=y}
        const _tipo=_present[i]
        const uri=imgMap[_tipo]
        const px=fx+_col*(FW+FGAP), py=_rowTop
        try{
          // Comprimi la foto al volo (max 800px) prima di aggiungerla al PDF — evita rallentamenti con foto originali
          const b64orig=uri.includes(',')?uri.split(',')[1]:uri
          const b64pdf=await compressImageBase64(b64orig,800,0.7)
          const pdfUri='data:image/jpeg;base64,'+b64pdf
          const{w,h}=jpegSize(pdfUri)
          // Fit proporzionale dentro la cella FW×FH (contain, centrato)
          const ratio=w/h
          let iw,ih
          if(ratio>=1){iw=FW;ih=FW/ratio}else{ih=FH;iw=FH*ratio}
          const ox=(FW-iw)/2, oy=(FH-ih)/2
          doc.addImage(pdfUri,'JPEG',px+ox,py+oy,iw,ih,undefined,'FAST')
          if(FOTO_LBL[_tipo]){setFont('normal',7,GREY);doc.text(FOTO_LBL[_tipo],px+FW/2,py+FH+4,{align:'center'})}
        }catch(e){/* formato non supportato */}
        _col++
        if(_col===2){_col=0;_rowTop+=FH+FGAP}
      }
      y=_rowTop+(_col===1?FH+FGAP:0)+10
    }

    // FIRMA – carica immagini firma da Supabase Storage
    if(y>255){doc.addPage();y=15}
    y=Math.max(y,260)
    hLine();ln(5)
    setFont('normal',8,GREY)

    // Recupera base64 firma da Storage (usa cache sessione _firmaCache)
    const _getFirmaB64=async(email)=>{
      if(!email)return null
      const fUrl=_firmaCache[email]
      if(!fUrl)return null
      try{
        const sUrl=await getFirmaSignedUrl(fUrl)
        if(!sUrl)return null
        return await fetchImageBase64(sUrl)
      }catch(e){return null}
    }

    const _drawFirma=async(nome,email,xPos,halfW)=>{
      setFont('normal',8,GREY)
      doc.text(`Tecnico: ${nome||'–'}`,xPos,y,{maxWidth:halfW-4})
      const fb64=await _getFirmaB64(email)
      if(fb64){
        try{
          const fmt=fb64.startsWith('/9j')?'JPEG':'PNG'
          doc.addImage('data:image/'+fmt.toLowerCase()+';base64,'+fb64,fmt,xPos,y+3,42,14,undefined,'FAST')
        }catch(e){doc.text('Firma: ___________________________',xPos,y+10)}
      }else{
        doc.text('Firma: ___________________________',xPos,y+10)
      }
    }

    if(tec2Nome){
      const half=(W-4)/2
      await _drawFirma(tecNome,tecEmail,L,half)
      await _drawFirma(tec2Nome,tec2Email,L+half+4,half)
    }else{
      await _drawFirma(tecNome,tecEmail,L,W)
    }
    // ── CAMPAGNA INFORMATIVA (coda verbale) ──
    try{
      const _cmp=await getCampagnaAttiva()
      const _cmpPos=(window._campagnaTarget!==undefined&&window._campagnaTarget!==null)?window._campagnaTarget:(_cmp?_cmp.posizione:null)
      if(_cmp&&(_cmpPos==='verbale'||_cmpPos==='entrambi')){
        const _PH=doc.internal.pageSize.getHeight()
        if(y>_PH-70){doc.addPage();y=16}else{ln(10)}
        hLine(ORANGE,0.6);ln(8)
        setFont('bold',12,ORANGE)
        const _ttl=doc.splitTextToSize(_cmp.titolo||'',W)
        doc.text(_ttl,L,y);y+=_ttl.length*5.5+3
        if(_cmp.testo){
          setFont('normal',9,[40,40,40])
          const _tl=doc.splitTextToSize(_cmp.testo,W)
          if(y+_tl.length*4.5>_PH-20){doc.addPage();y=16}
          doc.text(_tl,L,y);y+=_tl.length*4.5+5
        }
        for(const [_iu,_ifid] of [[_cmp.img1_url,_cmp.img1_file_id],[_cmp.img2_url,_cmp.img2_file_id]].filter(x=>x[0]||x[1])){
          try{
            let _d=null
            if(_ifid){
              try{
                const{data:{session:_ss}}=await sb.auth.getSession()
                const _tk=_ss?.access_token
                if(_tk){
                  const _dr=await fetch(`${SB_URL}/functions/v1/upload-foto`,{method:'POST',headers:{Authorization:`Bearer ${_tk}`,apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({download:true,file_id:_ifid})})
                  const _dd=await _dr.json()
                  if(_dd.ok&&_dd.base64)_d='data:image/jpeg;base64,'+_dd.base64
                }
              }catch(_ed){console.warn('download img campagna Drive:',_ed)}
            }
            if(!_d){
              if(!_iu)continue
              const _r=await fetch(_iu);if(!_r.ok)continue
              const _b=await _r.blob()
              _d=await new Promise(res=>{const fr=new FileReader();fr.onload=e=>res(e.target.result);fr.readAsDataURL(_b)})
            }
            const _im=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=_d})
            let _w=W,_h=_w*_im.height/_im.width
            const _maxH=_PH-36
            if(_h>_maxH){_h=_maxH;_w=_h*_im.width/_im.height}
            if(y+_h>_PH-18){doc.addPage();y=16}
            const _fmt=_d.slice(0,30).includes('png')?'PNG':'JPEG'
            doc.addImage(_d,_fmt,L+(W-_w)/2,y,_w,_h)
            y+=_h+5
          }catch(_ei){console.warn('img campagna PDF:',_ei)}
        }
        const _lnks=[[_cmp.link1_label,_cmp.link1_url],[_cmp.link2_label,_cmp.link2_url]].filter(x=>x[1])
        if(_lnks.length){
          if(y>_PH-16){doc.addPage();y=16}
          setFont('normal',9,[37,99,235])
          let _lx=L
          _lnks.forEach(([_lb,_url])=>{
            const _t=_lb||_url
            doc.textWithLink(_t,_lx,y,{url:_url})
            const _tw=doc.getTextWidth(_t)
            doc.setDrawColor(37,99,235);doc.setLineWidth(0.2);doc.line(_lx,y+1,_lx+_tw,y+1)
            _lx+=_tw+16
          })
          y+=8
        }
      }
    }catch(_ec){console.warn('campagna PDF:',_ec)}

    ln(22)
    hLine([220,220,220],0.2);ln(4)
    setFont('normal',7,[180,180,180])
    doc.text(`Generato il ${new Date().toLocaleString('it-IT')} – Formedil Padova CPT`,PW/2,y,{align:'center'})

    // Salva PDF su Drive in background (non bloccante)
    const _uploadPdfDrive=async(b64)=>{
      try{
        const{data:{session}}=await sb.auth.getSession()
        const tkn=session?.access_token
        const r=await fetch(`${SB_URL}/functions/v1/upload-pdf`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${tkn}`,'apikey':SB_KEY},
          body:JSON.stringify({pdf_base64:b64,nr_verbale:v.nr_verbale,data_visita:v.data_visita,visita_id:vid})
        })
        const d=await r.json()
        if(d.ok)toast('PDF salvato su Drive ✓','ok')
        else console.warn('upload-pdf:',d.error)
      }catch(e){console.warn('upload-pdf:',e)}
    }

    if(output==='base64'){
      // NON chiamare _uploadPdfDrive qui: il gestore send-verbale lo gestisce
      // esplicitamente; un doppio upload concorrente blocca la Edge Function
      return doc.output('datauristring')
    }
    const pdfB64=doc.output('datauristring').split(',')[1]
    const _slugPdf=s=>(s||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim()
    const _primaImpPdf=imps&&imps.length?imps[0].imprese?.impresa_nome||'':''
    // Nome file: Verb_<ultime 4 cifre> - ragione sociale (max 30) - comune - tecnico - data
    const _codePdf=(v.nr_verbale||'').replace(/\D/g,'').slice(-4)||_slugPdf(v.nr_verbale||vid)
    const _ragPdf=_slugPdf(_primaImpPdf).slice(0,30).trim()
    const _comPdf=_slugPdf(comuneLabel)
    const _tecPdf=_slugPdf([v.tecnici?.tecnico_nome,v.tecnici?.tecnico_cognome].filter(Boolean).join(' '))
    const _dPdf=v.data_visita?new Date(v.data_visita+'T00:00:00'):null
    const _dataFPdf=_dPdf&&!isNaN(_dPdf)?`${String(_dPdf.getDate()).padStart(2,'0')}-${String(_dPdf.getMonth()+1).padStart(2,'0')}-${_dPdf.getFullYear()}`:''
    const _pdfName=[`Verb_${_codePdf}`,_ragPdf,_comPdf,_tecPdf,_dataFPdf].filter(Boolean).join(' - ')+'.pdf'
    doc.save(_pdfName)
    toast('PDF generato','ok')
    _uploadPdfDrive(pdfB64)   // upload in background
  }catch(e){toast('Errore PDF: '+e.message,'err');console.error(e)}
  finally{_pdfInProgress=false}
}
