/* ============================================================
   Esportazioni e importazione Excel della Zona Segreteria:
   - «Esporta Excel» dei verbali (admEsportaExcel) e ricarica da file .xlsx;
   - elenco dei cantieri visitati per la Cassa Edile (Excel, PDF, mail);
   - elenco delle imprese per la Cassa Edile (Excel, PDF, mail).

   SECONDO MODULO ESTRATTO DAL FILE CENTRALE index.html (13/11/2026, revisione
   di tenuta). Il codice è lo stesso che stava fra «EXCEL EXPORT / IMPORT» e
   l'import degli incarichi: nessuna riga è cambiata. Vive dentro una fabbrica
   che riceve dal modulo inline le sole cose di cui ha bisogno, come
   osservatorio.js: se manca una dipendenza si vede alla prima chiamata.

   Chi lo usa (index.html):
     import { creaEsportazioni } from './esportazioni.js'
     creaEsportazioni({ $, sb, sbTutte, toast, today, fmtDate, esc, initForm, navTo, _figSnap })
   Non restituisce niente: i sei pulsanti della Cassa Edile li mette su window
   (window.ceivEsportaExcel …), gli altri si agganciano ai loro elementi.

   Dai globali della pagina usa: XLSX, jspdf, CeivImprese, CEIVCORE, __isCoord, e da app-data.js
   _CHK_PREF e impDaRigaDb. _figSnap viene da osservatorio.js, passando da index.html.
   ⚠️ Un file nuovo va aggiunto alle due liste di .github/workflows/deploy-pages.yml
   (paths e copia in _site): senza, non viene pubblicato.
   ============================================================ */
export function creaEsportazioni({ $, sb, sbTutte, toast, today, fmtDate, esc, initForm, navTo, _figSnap }) {
// ── EXCEL EXPORT / IMPORT ──

function _chkMacroArea(c){return _CHK_PREF[c.substring(0,7)]||_CHK_PREF[c.substring(0,6)]||c.split('_').slice(0,2).join('_')}
function _xlsxValLabel(v){
  if(!v||v==='NA')return 'N/A'
  if(v==='VER')return 'Verificato'
  if(v==='NC-')return 'NC lieve'
  if(v==='NC+')return 'NC grave'
  if(v==='OSS')return 'Osservazione'
  if(v==='NP')return 'Non presente'
  return v
}
async function _loadSnapForVerbale(verbale){
  const nr=verbale.trim().toUpperCase()
  const{data:vRow,error}=await sb.from('visite').select('visita_id').eq('nr_verbale',nr).maybeSingle()
  if(error||!vRow)throw new Error('Verbale non trovato: '+nr)
  const vid=vRow.visita_id
  const{data:snapRow,error:eSnap}=await sb.from('visite_snapshot').select('snapshot').eq('visita_id',vid).maybeSingle()
  if(eSnap)throw new Error('non sono riuscito a leggere la copia salvata del verbale ('+eSnap.message+'): non la ricostruisco dai dati attuali, riprova')
  if(snapRow?.snapshot)return snapRow.snapshot
  const{data:v}=await sb.from('visite').select('*,tecnici!visite_tecnico_id_fkey(*),cantieri(*)').eq('visita_id',vid).single()
  if(!v)throw new Error('Dati non trovati')
  const{data:chkRows}=await sb.from('visite_checklist').select('codice,valore,nota').eq('visita_id',vid)
  const{data:lavRows}=await sb.from('visite_lavorazioni').select('genere,fase,lavorazione').eq('visita_id',vid)
  const{data:impRows}=await sb.from('visite_imprese_presenti').select('*,imprese(impresa_nome,impresa_cf,piva,indirizzo,comune)').eq('visita_id',vid).order('ordine')
  const checklist={},note_checklist={}
  ;(chkRows||[]).forEach(r=>{checklist[r.codice]=r.valore||'NA';if(r.nota)note_checklist[r.codice]=r.nota})
  const cant=v.cantieri||{}
  return{visita_id:vid,nr_verbale_origine:v.nr_verbale||'',
    data_visita:v.data_visita||null,ora_visita:v.ora_visita||null,ora_fine:v.ora_fine||null,
    tipo_accesso:v.tipo_accesso||null,acc_cant:v.acc_cant||null,
    rlst_sn:v.rlst_sn,stage_vis:v.stage_vis,nom_stage:v.nom_stage||null,
    ppre_nome:v.ppre_nome||null,ppre_cog:v.ppre_cog||null,qual_ppre:v.qual_ppre||null,tel_ppre:v.tel_ppre||null,
    tecnico_email:v.tecnici?.email||null,
    tec_display:v.tecnici?(v.tecnici.tecnico_nome+' '+v.tecnici.tecnico_cognome).trim():null,
    cantiere_id:v.cantiere_id||null,
    cantiere_label:cant.cantiere_etichetta||((cant.cantiere_indirizzo||'')+' '+(cant.cantiere_civico||'')).trim(),
    cantiere_detail:cant.comune_nome||null,prot_int:cant.prot_int||null,cnce:cant.cantiere_cnce||null,cod_uni:cant.nodo_id||null,
    comm_tipo_sogg:v.comm_tipo_sogg||null,comm_tipo:v.comm_tipo||null,
    comm_nome:v.comm_nome||null,comm_cog:v.comm_cog||null,comm_cf:v.comm_cf||null,
    comm_email:v.comm_email||null,comm_tel:v.comm_tel||null,
    comm_rag_soc:v.comm_rag_soc||null,comm_piva:v.comm_piva||null,coord:v.coord||false,
    ..._figSnap('rl',v.rl_titolo,v.rl_nome,v.rl_cog,v.resp_lav),rl_email:v.rl_email||null,rl_tel:v.rl_tel||null,
    ..._figSnap('csp',v.csp_titolo,v.csp_nome,v.csp_cog,v.csp),csp_email:v.csp_email||null,csp_tel:v.csp_tel||null,
    ..._figSnap('cse',v.cse_titolo,v.cse_nome,v.cse_cog,v.cse),cse_email:v.cse_email||null,cse_tel:v.cse_tel||null,
    nr_imp:v.nr_imp||0,nr_ind:v.nr_ind||0,nr_lavoratori:v.nr_lavoratori||0,nr_lavoratori_stranieri:v.nr_lavoratori_stranieri||0,
    importo:v.importo||null,costi:v.costi||null,stato_lav:v.stato_lav||null,
    imprese:(impRows||[]).map(impDaRigaDb),
    checklist,note_checklist,
    lavorazioni:(lavRows||[]).map(l=>({genere:l.genere,fase:l.fase,lavorazione:l.lavorazione})),
    oss_tec:v.oss_tec||null,oss_int:v.oss_tec_int||null,
    note_for_sn:v.note_for_sn||false,note_for_m:v.note_for_m||null,note_for_tipi:v.note_for_tipi||null,
    segnalazione:v.segnalazione||false,data_ritorno:v.data_ritorno||null,
    exported_at:new Date().toISOString()
  }
}
let _chkVociCache=null
async function _getChkVoci(){
  if(_chkVociCache)return _chkVociCache
  const{data}=await sb.from('checklist_voci').select('codice,descrizione').order('ordine')
  _chkVociCache={}
  ;(data||[]).forEach(r=>{_chkVociCache[r.codice]=r.descrizione||r.codice})
  return _chkVociCache
}
async function admEsportaExcel(){
  const verbale=($('adm-excel-verbale')?.value||'').trim()
  const msgEl=$('adm-excel-exp-msg')
  const btn=$('btn-adm-excel-exp')
  if(!verbale){
    if(msgEl){msgEl.textContent='Inserisci il numero verbale.';msgEl.style.display='block';msgEl.style.color='#e74c3c'}
    return
  }
  btn.disabled=true;btn.textContent='Generazione...'
  if(msgEl)msgEl.style.display='none'
  try{
    toast('Recupero dati visita...')
    const snap=await _loadSnapForVerbale(verbale)
    const voci=await _getChkVoci()
    const wb=XLSX.utils.book_new()
    const TACC={'1':'Su segnalazione','2':'Su richiesta','3':'Protocolli intesa','4':'RLS/RLST','5':'Programmata','6':'Cantiere qualita','7':'Dal CPT','8':'Visite in serie','9':'Stage ASL','10':'Asseverazione','11':'Attestazione consulenza','12':'Progetto SPISAL'}
    const ILBL={'1':'fino a 250k','2':'250k-500k','3':'500k-1M','4':'1-1,5M','5':'1,5-2,5M','6':'2,5-3,5M','7':'3,5-5M','8':'5-10M','11':'N/D'}
    const ws1Data=[['Campo','Valore'],
      ['N. Verbale',snap.nr_verbale_origine||''],
      ['Data visita',snap.data_visita||''],
      ['Ora inizio',snap.ora_visita||''],
      ['Ora fine',snap.ora_fine||''],
      ['Tipo accesso',TACC[String(snap.tipo_accesso)]||snap.tipo_accesso||''],
      ['Accesso cantiere',snap.acc_cant||''],
      ['RLST presente',(snap.rlst_sn==='1'||snap.rlst_sn===true)?'Si':'No'],
      ['Stagista presente',(snap.stage_vis==='1'||snap.stage_vis===true)?'Si':'No'],
      ['Nome stagista',snap.nom_stage||''],
      ['Pers. presente - Nome',snap.ppre_nome||''],
      ['Pers. presente - Cognome',snap.ppre_cog||''],
      ['Pers. presente - Qualifica',snap.qual_ppre||''],
      ['Pers. presente - Tel.',snap.tel_ppre||''],
      ['Tecnico',snap.tec_display||snap.tecnico_email||''],
      ['Cantiere',snap.cantiere_label||''],
      ['Cantiere dettaglio',snap.cantiere_detail||''],
      ['Prot. interno',snap.prot_int||''],
      ['CNCE',snap.cnce||''],
      ['Cod. Unico',snap.cod_uni||''],
      ['Committente tipo',(snap.comm_tipo==='1'||snap.comm_tipo===1)?'Pubblico':(snap.comm_tipo==='2'||snap.comm_tipo===2)?'Privato':'N/D'],
      ['Committente soggetto',snap.comm_tipo_sogg==='PG'?'Persona giuridica':'Persona fisica'],
      ['Committente nome',snap.comm_nome||''],
      ['Committente cognome',snap.comm_cog||''],
      ['Committente CF',snap.comm_cf||''],
      ['Committente email',snap.comm_email||''],
      ['Committente tel.',snap.comm_tel||''],
      ['Committente rag. soc.',snap.comm_rag_soc||''],
      ['Committente P.IVA',snap.comm_piva||''],
      ['Coordinamento',snap.coord?'Si':'No'],
      ['RL - Nome',snap.rl_nome||''],['RL - Email',snap.rl_email||''],['RL - Tel.',snap.rl_tel||''],
      ['CSP - Nome',snap.csp_nome||''],['CSP - Email',snap.csp_email||''],['CSP - Tel.',snap.csp_tel||''],
      ['CSE - Nome',snap.cse_nome||''],['CSE - Email',snap.cse_email||''],['CSE - Tel.',snap.cse_tel||''],
      ['N. imprese',snap.nr_imp||''],['N. lav. indip.',snap.nr_ind||''],
      ['N. lavoratori',snap.nr_lavoratori||''],['N. lav. stranieri',snap.nr_lavoratori_stranieri||''],
      ['Importo lavori',ILBL[String(snap.importo)]||snap.importo||''],
      ['Tipo lavorazione',snap.stato_lav||''],
      ['Segnalazione',snap.segnalazione?'Si':'No'],
      ['Data ritorno',snap.data_ritorno||''],
      ['Osservazioni tecniche',snap.oss_tec||''],
      ['Note interne',snap.oss_int||''],
      ['Note per mail',snap.note_for_m||'']
    ]
    const ws1=XLSX.utils.aoa_to_sheet(ws1Data)
    ws1['!cols']=[{wch:30},{wch:60}]
    XLSX.utils.book_append_sheet(wb,ws1,'Visita')
    const ws2Data=[['#','Ragione sociale','P.IVA','CF','Indirizzo','Comune','Attivita','Capo nome','Capo cognome','Badge','Tipo','Princ.']]
    ;(snap.imprese||[]).forEach((im,i)=>{
      ws2Data.push([i+1,im.impresa_nome||'',im.piva||'',im.cf_imp||'',im.ind_imp||'',im.com_imp||'',im.att||'',im.capo_nome||'',im.capo_cog||'',im.badge||'',im.tipo_imp||'',im.is_principale?'Si':'No'])
    })
    const ws2=XLSX.utils.aoa_to_sheet(ws2Data)
    ws2['!cols']=[{wch:4},{wch:30},{wch:14},{wch:16},{wch:24},{wch:16},{wch:14},{wch:14},{wch:14},{wch:10},{wch:8},{wch:6}]
    XLSX.utils.book_append_sheet(wb,ws2,'Imprese')
    const ws3Data=[['Genere','Fase','Lavorazione']]
    ;(snap.lavorazioni||[]).forEach(l=>{ws3Data.push([l.genere||'',l.fase||'',l.lavorazione||''])})
    const ws3=XLSX.utils.aoa_to_sheet(ws3Data)
    ws3['!cols']=[{wch:28},{wch:28},{wch:50}]
    XLSX.utils.book_append_sheet(wb,ws3,'Lavorazioni')
    // Legge checklist DIRETTAMENTE dal DB (piu' affidabile dello snap)
    const{data:chkDirect}=await sb.from('visite_checklist').select('codice,valore,nota').eq('visita_id',snap.visita_id)
    const chkMap={},notaMap={}
    ;(chkDirect||[]).forEach(r=>{chkMap[r.codice]=r.valore||'NA';if(r.nota)notaMap[r.codice]=r.nota})
    // Merge con snap.checklist per voci eventualmente non in DB
    Object.entries(snap.checklist||{}).forEach(([c,v])=>{if(!chkMap[c])chkMap[c]=v})
    Object.entries(snap.note_checklist||{}).forEach(([c,n])=>{if(!notaMap[c])notaMap[c]=n})
    // Lista completa codici: prima voci DB, poi eventuali extra
    const allCodes=Object.keys(voci).length>0?Object.keys(voci):Object.keys(chkMap)
    Object.keys(chkMap).forEach(c=>{if(!allCodes.includes(c))allCodes.push(c)})
    const ws4Data=[['Codice','Macro-area','Descrizione','Esito','Nota']]
    allCodes.sort().forEach(cod=>{
      ws4Data.push([cod,_chkMacroArea(cod),voci[cod]||cod,_xlsxValLabel(chkMap[cod]||'NA'),notaMap[cod]||''])
    })
    const ws4=XLSX.utils.aoa_to_sheet(ws4Data)
    ws4['!cols']=[{wch:16},{wch:28},{wch:50},{wch:18},{wch:60}]
    XLSX.utils.book_append_sheet(wb,ws4,'Checklist')
    const fname='visita_'+(snap.nr_verbale_origine||'export').replace(/\//g,'-')+'.xlsx'
    XLSX.writeFile(wb,fname)
    toast('Excel scaricato: '+fname,'ok')
    if(msgEl){msgEl.textContent='File scaricato: '+fname;msgEl.style.display='block';msgEl.style.color='#27ae60'}
  }catch(e){
    console.error('admEsportaExcel:',e)
    toast('Errore: '+e.message,'err')
    if(msgEl){msgEl.textContent='Errore: '+e.message;msgEl.style.display='block';msgEl.style.color='#e74c3c'}
  }finally{btn.disabled=false;btn.textContent='Esporta Excel'}
}
document.getElementById('btn-adm-excel-exp')?.addEventListener('click',admEsportaExcel);

/* ===== CEIV core + wrappers (estrazione cantieri CNCE) ===== */
// CEIV core – logica pura condivisa (browser + Node test)
(function (root) {
  const CEIV_IPC_LBL = { ALTO: 'Alto', MEDIO: 'Medio', BASSO: 'Basso', NR: 'Nessun Rilievo' };
  const _num = (x) => (x === null || x === undefined || x === '' ? 0 : Number(x) || 0);
  const _fmtDate = (d) => {
    if (!d) return '';
    const s = String(d).slice(0, 10);
    const [y, m, g] = s.split('-');
    return g ? `${g}/${m}/${y}` : s;
  };
  function normalizeRows(visRows, vipByVisita) {
    return (visRows || []).map((v) => {
      const c = v.cantieri || {}, t = v.tecnici || {}, ip = v.imprese || {};
      let pres = (vipByVisita[v.visita_id] || []).slice();
      pres.sort((a, b) => (b.is_principale ? 1 : 0) - (a.is_principale ? 1 : 0) || (a.ordine || 0) - (b.ordine || 0));
      let imprese = pres.map((p) => ({
        nome: (p.imprese && p.imprese.impresa_nome) || '',
        piva: (p.imprese && p.imprese.piva) || '',
        mail: (p.imprese && p.imprese.impresa_email_ref) || '',
        nlav: (p.nr_lav === null || p.nr_lav === undefined) ? '' : p.nr_lav,
      }));
      if (!imprese.length && (ip.impresa_nome || ip.piva)) {
        imprese = [{ nome: ip.impresa_nome || '', piva: ip.piva || '', mail: ip.impresa_email_ref || '', nlav: v.nr_lavoratori == null ? '' : v.nr_lavoratori }];
      }
      const nDipImp = v.nr_lavoratori == null ? '' : v.nr_lavoratori;
      const otherLav = imprese.slice(1).reduce((s, x) => s + _num(x.nlav), 0);
      const lavTot = (_num(nDipImp) || _num(imprese[0] && imprese[0].nlav)) + otherLav;
      const tecnico = [t.tecnico_nome, t.tecnico_cognome].filter(Boolean).join(' ');
      const committente = v.comm_rag_soc || [v.comm_nome, v.comm_cog].filter(Boolean).join(' ') || '';
      const indirizzo = [c.cantiere_indirizzo, c.cantiere_civico].filter(Boolean).join(' ');
      return {
        cnce: c.cantiere_cnce || '', lotto: String(c.lotto || '').trim(), data: v.data_visita || '', tecnico,
        acc: v.acc_cant || '', indirizzo, comune: c.comune_nome || '',
        nrImp: v.nr_imp == null ? 0 : v.nr_imp, nrInd: v.nr_ind == null ? 0 : v.nr_ind,
        lavTot, nDipImp, verbale: v.nr_verbale || '',
        ipc: CEIV_IPC_LBL[v.ipc] || v.ipc || '',
        committente, commPiva: v.comm_piva || v.comm_cf || '', imprese,
      };
    });
  }
  const Q_HEADER = ['ks_CodCEIV', 'Data sopralluogo', '12', '13', '16', '17', '25', '26', '27',
    '35', '36', '40', '54', '57',
    'IVA1', 'Lav1', 'Mail1', 'IVA2', 'Lav2', 'Mail2', 'IVA3', 'Lav3', 'Mail3', 'IVA4', 'Lav4', 'Mail4',
    'Ragione Sociale Impresa'];
  /* (07/10/2026, chiesto dall'utente) per la Cassa tutte le visite stanno sotto il CNCE unico, ma distinte per
     lotto: l'ordine è CNCE, lotto, data; il tracciato Excel resta quello concordato, il lotto va accanto
     all'indirizzo («Via Roma 12 – lotto 2»); nel PDF ogni lotto ha la sua fascia dentro il cantiere. */
  const _ordLotto = (l) => { const s = String(l || '').trim(); return /^\d+$/.test(s) ? s.padStart(6, '0') : s.toLowerCase(); };
  const indirizzoConLotto = (r) => (r.indirizzo || '') + (r.lotto ? ' – lotto ' + r.lotto : '');
  function buildExcelAoa(data) {
    const sorted = data.slice().sort((a, b) =>
      (a.cnce || '').localeCompare(b.cnce || '') || _ordLotto(a.lotto).localeCompare(_ordLotto(b.lotto)) || (b.data || '').localeCompare(a.data || ''));
    const aoa = [Q_HEADER.slice()];
    sorted.forEach((r) => {
      const im = r.imprese || [];
      const p1 = im[0] || {}, s = im.slice(1);
      const sub = (i) => s[i] || {};
      aoa.push([
        r.cnce, _fmtDate(r.data), r.tecnico, r.acc, indirizzoConLotto(r), r.comune,
        r.nrImp, r.nrInd, r.lavTot,
        p1.nome || '', p1.piva || '', p1.nlav === undefined ? '' : p1.nlav, r.verbale, r.ipc,
        sub(0).piva || '', sub(0).nlav ?? '', sub(0).mail || '',
        sub(1).piva || '', sub(1).nlav ?? '', sub(1).mail || '',
        sub(2).piva || '', sub(2).nlav ?? '', sub(2).mail || '',
        sub(3).piva || '', sub(3).nlav ?? '', sub(3).mail || '',
        r.committente,
      ]);
    });
    return aoa;
  }
  const Q_COLW = [16, 12, 20, 5, 26, 16, 5, 5, 6, 28, 14, 5, 14, 14, 14, 5, 22, 14, 5, 22, 14, 5, 22, 14, 5, 22, 28];
  function drawPdf(doc, data, dalFmt, alFmt) {
    const PW = 210, M = 12, BOT = 282, W = PW - M * 2;
    const IPC_COL = { 'Alto': [192, 57, 43], 'Medio': [230, 126, 34], 'Basso': [217, 164, 0], 'Nessun Rilievo': [122, 165, 39] };
    const groups = {};
    data.forEach((r) => { (groups[r.cnce] = groups[r.cnce] || []).push(r); });
    const keys = Object.keys(groups).sort((a, b) => {
      const ca = (groups[a][0].comune || ''), cb = (groups[b][0].comune || '');
      return ca.localeCompare(cb) || a.localeCompare(b);
    });
    keys.forEach((k) => groups[k].sort((a, b) => _ordLotto(a.lotto).localeCompare(_ordLotto(b.lotto)) || (b.data || '').localeCompare(a.data || '')));
    let page = 0;
    const header = () => {
      page++;
      doc.setFillColor(231, 80, 15); doc.rect(0, 0, PW, 15, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('FORMEDIL PADOVA – Area Sicurezza e Salute', 6, 9.5);
      doc.text(`Periodo: ${dalFmt} – ${alFmt}`, 204, 9.5, { align: 'right' });
      doc.setTextColor(40, 40, 40); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('LISTA VISITE CANTIERI DA LISTA C.E.I.V.', 105, 23, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    };
    const footer = () => {
      doc.setDrawColor(231, 80, 15); doc.setLineWidth(0.3); doc.line(M, 290, PW - M, 290);
      doc.setFontSize(7); doc.setTextColor(160, 160, 160); doc.setFont('helvetica', 'normal');
      doc.text('Formedil Padova – Estrazione C.E.I.V. cantieri con codice CNCE – uso interno', 105, 293.5, { align: 'center' });
      doc.text(String(page), 204, 293.5);
    };
    header(); footer(); let y = 30;
    const newPage = () => { doc.addPage(); header(); footer(); y = 30; };
    const wrapLines = (txt, size, bold, maxW) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      return doc.splitTextToSize(String(txt ?? ''), maxW);
    };
    const XL = M + 27; // colonna dei valori (dopo le etichette)
    keys.forEach((k) => {
      const rows = groups[k];
      const r0 = rows[0];
      // ── fascia cantiere ──
      if (y + 34 > BOT) newPage();
      doc.setFillColor(86, 92, 102); doc.rect(M, y, W, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text('Cantiere CNCE  ' + k, M + 2.5, y + 5.4);
      const lottiQui = [...new Set(rows.map((r) => r.lotto).filter(Boolean))];
      const nvis = rows.length + (rows.length === 1 ? ' visita' : ' visite') + (lottiQui.length ? ' in ' + lottiQui.length + (lottiQui.length === 1 ? ' lotto' : ' lotti') : '');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      const loc = [(r0.comune || '').toUpperCase(), r0.indirizzo || ''].filter(Boolean).join(' – ');
      doc.text((loc ? loc + '   ·   ' : '') + nvis, PW - M - 2.5, y + 5.4, { align: 'right', maxWidth: 105 });
      y += 11;
      // ── schede visita, con la fascia del lotto quando il cantiere ne ha ──
      let lottoCorrente = null;
      rows.forEach((r, ri) => {
        if (lottiQui.length && r.lotto !== lottoCorrente) {
          lottoCorrente = r.lotto;
          if (y + 8 > BOT) newPage();
          const nl = rows.filter((x) => x.lotto === r.lotto).length;
          doc.setFillColor(253, 236, 226); doc.rect(M, y, W, 5.6, 'F');
          doc.setTextColor(179, 58, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
          doc.text(r.lotto ? 'Lotto ' + r.lotto : 'Senza lotto', M + 2.5, y + 4);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
          doc.text(nl + (nl === 1 ? ' visita' : ' visite') + '  ·  accesso n° contato sul lotto', PW - M - 2.5, y + 4, { align: 'right' });
          y += 7;
        }
        const impresa = ((r.imprese[0] && r.imprese[0].nome) || '').toUpperCase();
        const committente = (r.committente || '–') + (r.commPiva ? '   ·   P.IVA/CF ' + r.commPiva : '');
        const numeri = 'Imprese ' + r.nrImp + '    ·    Ditte individuali ' + r.nrInd + '    ·    Lavoratori totali ' + r.lavTot + (r.nDipImp === '' ? '' : '    ·    Dipendenti impresa ' + r.nDipImp);
        const sub = r.imprese.slice(1).filter((x) => x.piva || x.nome);
        const subTxt = sub.map((x) => (x.piva || x.nome || '–') + (x.nlav === '' ? '' : ' (' + x.nlav + ' lav)')).join('    ·    ');
        const impL = wrapLines(impresa || '–', 8.6, true, W - (XL - M) - 3);
        const comL = wrapLines(committente, 8, false, W - (XL - M) - 3);
        const subL = sub.length ? wrapLines(subTxt, 7.5, false, W - (XL - M) - 3) : [];
        const cardH = 3.6 + 5.4 + impL.length * 4.2 + comL.length * 4 + 3.8 + (subL.length ? subL.length * 3.6 : 0) + 2;
        if (y + cardH > BOT) newPage();
        if (ri % 2 === 0) { doc.setFillColor(250, 246, 242); doc.rect(M, y, W, cardH, 'F'); }
        let yy = y + 5;
        // riga 1: data · verbale · tecnico   |   pill IPC + accesso
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
        let x = M + 2.5;
        const dtx = _fmtDate(r.data);
        doc.text(dtx, x, yy); x += doc.getTextWidth(dtx) + 3.5;
        doc.setTextColor(231, 80, 15);
        const vtx = 'Verbale ' + (r.verbale || '–');
        doc.text(vtx, x, yy); x += doc.getTextWidth(vtx) + 3.5;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(86, 92, 102);
        doc.text(r.tecnico || '', x, yy);
        let rx = PW - M - 2.5;
        doc.setFontSize(7.5); doc.setTextColor(130, 130, 130);
        const acc = 'Accesso n° ' + (r.acc === '' || r.acc === null || r.acc === undefined ? '–' : r.acc);
        doc.text(acc, rx, yy, { align: 'right' }); rx -= doc.getTextWidth(acc) + 4;
        if (r.ipc) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
          const pw2 = doc.getTextWidth(r.ipc) + 5;
          const col = IPC_COL[r.ipc] || [120, 120, 120];
          doc.setFillColor(col[0], col[1], col[2]);
          doc.roundedRect(rx - pw2, yy - 3.3, pw2, 4.6, 1.2, 1.2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(r.ipc, rx - pw2 / 2, yy, { align: 'center' });
        }
        yy += 5.4;
        const lab = (t) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(160, 160, 160); doc.text(t, M + 2.5, yy); };
        // impresa principale
        lab('IMPRESA');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); doc.setTextColor(30, 30, 30);
        impL.forEach((ln, i) => { doc.text(ln, XL, yy); if (i < impL.length - 1) yy += 4.2; });
        yy += 4.2;
        // committente
        lab('COMMITTENTE');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
        comL.forEach((ln, i) => { doc.text(ln, XL, yy); if (i < comL.length - 1) yy += 4; });
        yy += 4;
        // conteggi
        doc.setFontSize(7.5); doc.setTextColor(130, 130, 130);
        doc.text(numeri, XL, yy); yy += 3.8;
        // altre imprese presenti
        if (subL.length) {
          lab('ALTRE IMPRESE');
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130, 130, 130);
          subL.forEach((ln, i) => { doc.text(ln, XL, yy); if (i < subL.length - 1) yy += 3.6; });
          yy += 3.6;
        }
        y += cardH;
      });
      y += 6;
    });
    return doc;
  }

  const api = { normalizeRows, buildExcelAoa, drawPdf, Q_HEADER, Q_COLW, CEIV_IPC_LBL, _fmtDate, indirizzoConLotto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CEIVCORE = api;
})(typeof window !== 'undefined' ? window : globalThis);


// ═══════════════════════════════════════════════════════════════
//  ESTRAZIONE CEIV – wrapper UI (usa window.CEIVCORE, sb, XLSX, jspdf)
// ═══════════════════════════════════════════════════════════════
function _ceivStatus(msg, err){ const el=$('ceiv-status'); if(el){ el.textContent=msg||''; el.style.color=err?'#e74c3c':'rgba(255,255,255,.6)'; } }
function _ceivPeriodo(){
  const dal=($('ceiv-dal')?.value)||'', al=($('ceiv-al')?.value)||'';
  return { dal: dal||'1900-01-01', al: al||today(), errore: window.CeivImprese.controllaPeriodo(dal, al, today()),
    etichetta: (dal?fmtDate(dal):'inizio') + ' – ' + (al?fmtDate(al):fmtDate(today())) };
}
// una data fuori misura (anno 0206) ferma l'estrazione invece di estrarre tutto lo storico
function _ceivPeriodoOk(p, stato){ if(!p.errore) return true; stato(p.errore, true); toast('Controlla le date','warn'); return false; }
async function _ceivFetch(dal, al){
  const vis = await sbTutte((da,a)=>sb.from('visite')
    .select('visita_id,nr_verbale,data_visita,ipc,acc_cant,nr_imp,nr_ind,nr_lavoratori,impresa_id,comm_rag_soc,comm_piva,comm_cf,comm_nome,comm_cog,tecnici!visite_tecnico_id_fkey(tecnico_nome,tecnico_cognome),cantieri!inner(cantiere_cnce,cantiere_indirizzo,cantiere_civico,comune_nome,lotto),imprese!visite_impresa_id_fkey(impresa_nome,piva,impresa_email_ref)')
    .gte('data_visita', dal).lte('data_visita', al).eq('elimina', 0)
    .ilike('cantieri.cantiere_cnce', 'cnce%')
    .order('data_visita', { ascending:false }).order('visita_id').range(da,a));
  const rows = vis||[];
  const byVis = {};
  const ids = rows.map(r=>r.visita_id);
  for(let i=0;i<ids.length;i+=100){
    const { data:bb, error:e2 } = await sb.from('visite_imprese_presenti')
      .select('visita_id,ordine,is_principale,nr_lav,imprese!visite_imprese_presenti_impresa_id_fkey(impresa_nome,piva,impresa_email_ref)')
      .in('visita_id', ids.slice(i,i+100));
    if(e2) throw e2;
    (bb||[]).forEach(r=>{ (byVis[r.visita_id]=byVis[r.visita_id]||[]).push(r); });
  }
  return window.CEIVCORE.normalizeRows(rows, byVis);
}
function _ceivFname(kind, ext){
  const p=_ceivPeriodo();
  const d=(p.dal==='1900-01-01'?'tutto':p.dal)+'_'+p.al;
  return `CEIV_Cantieri_CNCE_${kind}_${d}.${ext}`;
}
function _ceivBuildWb(data){
  const aoa = window.CEIVCORE.buildExcelAoa(data);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = window.CEIVCORE.Q_COLW.map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, 'CantieriCNCE');
  return wb;
}
function _ceivBuildDoc(data, p){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  window.CEIVCORE.drawPdf(doc, data, (p.dal==='1900-01-01'?'inizio':fmtDate(p.dal)), fmtDate(p.al));
  return doc;
}
async function ceivEsportaExcel(){
  if(!window.__isCoord){ toast('Funzione riservata alla segreteria','err'); return; }
  const p=_ceivPeriodo(); if(!_ceivPeriodoOk(p,_ceivStatus)) return; _ceivStatus('⏳ Estrazione dati…');
  try{
    const data = await _ceivFetch(p.dal, p.al);
    if(!data.length){ _ceivStatus('Nessuna visita su cantieri con codice CNCE nel periodo.', true); toast('Nessuna visita trovata','warn'); return; }
    XLSX.writeFile(_ceivBuildWb(data), _ceivFname('Q','xlsx'));
    _ceivStatus(`✓ Excel generato: ${data.length} visite.`);
    toast('Excel CEIV scaricato ✓','ok');
  }catch(e){ console.error('ceivEsportaExcel',e); _ceivStatus('Errore: '+(e.message||e), true); toast('Errore: '+(e.message||e),'err'); }
}
async function ceivEsportaPdf(){
  if(!window.__isCoord){ toast('Funzione riservata alla segreteria','err'); return; }
  const p=_ceivPeriodo(); if(!_ceivPeriodoOk(p,_ceivStatus)) return; _ceivStatus('⏳ Estrazione dati…');
  try{
    const data = await _ceivFetch(p.dal, p.al);
    if(!data.length){ _ceivStatus('Nessuna visita su cantieri con codice CNCE nel periodo.', true); toast('Nessuna visita trovata','warn'); return; }
    _ceivBuildDoc(data, p).save(_ceivFname('R','pdf'));
    _ceivStatus(`✓ PDF generato: ${data.length} visite.`);
    toast('PDF CEIV scaricato ✓','ok');
  }catch(e){ console.error('ceivEsportaPdf',e); _ceivStatus('Errore: '+(e.message||e), true); toast('Errore: '+(e.message||e),'err'); }
}
async function ceivInviaMail(){
  if(!window.__isCoord){ toast('Funzione riservata alla segreteria','err'); return; }
  const to=($('ceiv-mail-to')?.value||'').trim();
  const cc=($('ceiv-mail-cc')?.value||'').trim();
  if(!to){ _ceivStatus('Inserisci l’email del destinatario CEIV.', true); toast('Manca l’email CEIV','warn'); return; }
  const p=_ceivPeriodo(); if(!_ceivPeriodoOk(p,_ceivStatus)) return; _ceivStatus('⏳ Estrazione dati…');
  try{
    const data = await _ceivFetch(p.dal, p.al);
    if(!data.length){ _ceivStatus('Nessuna visita su cantieri con codice CNCE nel periodo.', true); toast('Nessuna visita trovata','warn'); return; }
    if(!confirm('Invio a CEIV\n\nA: '+to+(cc?'\nIn copia: '+cc:'')+'\nPeriodo: '+p.etichetta+'\nVisite: '+data.length+
      '\nAllegati: '+_ceivFname('Q','xlsx')+' e '+_ceivFname('R','pdf')+
      '\n\nLa mail parte SUBITO e non si richiama. Hai gia\u2019 guardato i due file?\n\nOK = invia, Annulla = non inviare')){
      _ceivStatus('Invio annullato: non e\u2019 partito niente.'); return; }
    _ceivStatus('⏳ Generazione allegati…');
    const xlsxB64 = XLSX.write(_ceivBuildWb(data), { type:'base64', bookType:'xlsx' });
    const pdfB64 = _ceivBuildDoc(data, p).output('datauristring').split(',')[1];
    _ceivStatus('⏳ Invio email a CEIV…');
    const { data:res, error } = await sb.functions.invoke('send-ceiv', { body:{
      to:[to], cc: cc?[cc]:[], periodo: p.etichetta, nRighe: data.length,
      attachments:[
        { name:_ceivFname('Q','xlsx'), b64:xlsxB64, mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { name:_ceivFname('R','pdf'),  b64:pdfB64,  mime:'application/pdf' },
      ] } });
    if(error) throw error;
    if(res && res.error) throw new Error(res.error);
    _ceivStatus(`✓ Email inviata a ${to} (${data.length} visite).`);
    toast('Email CEIV inviata ✓','ok');
  }catch(e){ console.error('ceivInviaMail',e); _ceivStatus('Errore invio: '+(e.message||e), true); toast('Errore invio: '+(e.message||e),'err'); }
}
window.ceivEsportaExcel=ceivEsportaExcel;
window.ceivEsportaPdf=ceivEsportaPdf;
window.ceivInviaMail=ceivInviaMail;

// ═══════════════════════════════════════════════════════════════
//  ESTRAZIONE CEIV – imprese presenti per cantiere (usa window.CeivImprese, ceiv-imprese.js)
// ═══════════════════════════════════════════════════════════════
function _ceiviStatus(msg, err){ const el=$('ceivi-status'); if(el){ el.textContent=msg||''; el.style.color=err?'#e74c3c':'rgba(255,255,255,.6)'; } }
function _ceiviPeriodo(){
  const dal=($('ceivi-dal')?.value)||'', al=($('ceivi-al')?.value)||'';
  return { dal: dal||'1900-01-01', al: al||today(), tutto: !dal, errore: window.CeivImprese.controllaPeriodo(dal, al, today()),
    dalFmt: dal?fmtDate(dal):'inizio', alFmt: fmtDate(al||today()),
    etichetta: (dal?fmtDate(dal):'inizio') + ' – ' + fmtDate(al||today()) };
}
async function _ceiviFetch(dal, al){
  const vis = await sbTutte((da,a)=>sb.from('visite')
    .select('visita_id,nr_verbale,data_visita,stato,nr_imp,nr_ind,nr_lavoratori,altre_imp_text,impresa_id,comm_rag_soc,comm_nome,comm_cog,tecnici!visite_tecnico_id_fkey(tecnico_nome,tecnico_cognome),cantieri!inner(cantiere_cnce,lotto,cantiere_indirizzo,cantiere_civico,comune_nome),imprese!visite_impresa_id_fkey(impresa_nome,piva,impresa_cf,cassa_edile,stato_cassa,cod_ceiv)')
    .gte('data_visita', dal).lte('data_visita', al).eq('elimina', 0)
    .ilike('cantieri.cantiere_cnce', 'cnce%')
    .order('data_visita', { ascending:false }).order('visita_id').range(da,a));
  const rows = vis||[];
  const byVis = {};
  const ids = rows.map(r=>r.visita_id);
  for(let i=0;i<ids.length;i+=100){
    const { data:bb, error:e2 } = await sb.from('visite_imprese_presenti')
      .select('visita_id,impresa_id,ordine,is_principale,ruolo,tipo_imp,nr_lav,imprese!visite_imprese_presenti_impresa_id_fkey(impresa_nome,piva,impresa_cf,cassa_edile,stato_cassa,cod_ceiv)')
      .in('visita_id', ids.slice(i,i+100));
    if(e2) throw e2;   // senza le imprese l'estrazione sarebbe falsa: meglio fermarsi che uscire a metà
    (bb||[]).forEach(r=>{ (byVis[r.visita_id]=byVis[r.visita_id]||[]).push(r); });
  }
  return window.CeivImprese.normalizza(rows, byVis);
}
function _ceiviFname(ext){
  const p=_ceiviPeriodo();
  return `CEIV_Imprese_per_cantiere_${p.tutto?'tutto':p.dal}_${p.al}.${ext}`;
}
// La libreria Excel dell'app non scrive i colori: per lo stato in Cassa (verde attiva, giallo sospesa,
// grigio non iscritta) si carica, solo qui, la sua variante con gli stili, senza toccare quella dell'app.
let _xlsxStile=null;
function _caricaXlsxStile(){
  if(_xlsxStile) return _xlsxStile;
  _xlsxStile=new Promise((ok,ko)=>{
    const orig=window.XLSX, s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
    s.integrity='sha384-OUW9euuUyxyHcAhTqbhI+Iyb8LMssXt/cpz0yXhs9UWG2/R/uaWdakx/4cfww7Vb';
    s.crossOrigin='anonymous';
    s.onload=()=>{ const X=window.XLSX; window.XLSX=orig; (X&&X!==orig)?ok(X):ko(new Error('libreria dei colori non caricata')); };
    s.onerror=()=>{ window.XLSX=orig; ko(new Error('libreria dei colori non raggiungibile')); };
    document.head.appendChild(s);
  }).catch(e=>{ _xlsxStile=null; throw e; });
  return _xlsxStile;
}
// → { X, wb, colori }: X è la libreria con cui va SCRITTO il file (solo quella con gli stili scrive i colori)
async function _ceiviWb(data){
  let X=XLSX, colori=true;
  try{ X=await _caricaXlsxStile(); }catch(e){ console.warn('Excel CEIV senza colori:',e); X=XLSX; colori=false; }
  const wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet(window.CeivImprese.righeExcel(data));
  ws['!cols'] = window.CeivImprese.LARGHEZZE.map(w=>({wch:w}));
  if(colori) window.CeivImprese.coloriExcel(data).forEach(k=>{
    const cella = ws[X.utils.encode_cell({ r:k.r, c:k.c })];
    if(cella) cella.s = { fill:{ patternType:'solid', fgColor:{ rgb:k.colore } } };
  });
  X.utils.book_append_sheet(wb, ws, 'ImpresePerCantiere');
  return { X, wb, colori };
}
function _ceiviDoc(data, p){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  return window.CeivImprese.disegnaPdf(doc, data, p.dalFmt, p.alFmt);
}
function _ceiviEsito(data){
  const c = window.CeivImprese.conta(data);
  return `${c.sopralluoghi} sopralluoghi su ${c.cantieri} cantieri, ${c.righe} righe di imprese`+
    (c.daGuardare?` — ${c.daGuardare} sopralluoghi con una nota da guardare (colonna «Note»)`:'');
}
async function _ceiviDati(){
  if(!window.__isCoord){ toast('Funzione riservata alla segreteria','err'); return null; }
  const p=_ceiviPeriodo(); if(!_ceivPeriodoOk(p,_ceiviStatus)) return null; _ceiviStatus('⏳ Estrazione dati…');
  const data = await _ceiviFetch(p.dal, p.al);
  if(!data.length){ _ceiviStatus('Nessuna visita su cantieri con codice CNCE nel periodo.', true); toast('Nessuna visita trovata','warn'); return null; }
  return { p, data };
}
async function ceivImpExcel(){
  try{
    const r = await _ceiviDati(); if(!r) return;
    const x = await _ceiviWb(r.data);
    x.X.writeFile(x.wb, _ceiviFname('xlsx'));
    _ceiviStatus('✓ Excel generato: '+_ceiviEsito(r.data)+'.'+(x.colori?'':' ⚠️ Senza i colori della Cassa Edile: la libreria che li scrive non si è caricata.')); toast('Excel imprese scaricato ✓','ok');
  }catch(e){ console.error('ceivImpExcel',e); _ceiviStatus('Non sono riuscito a leggere i dati: '+(e.message||e), true); toast('Errore: '+(e.message||e),'err'); }
}
async function ceivImpPdf(){
  try{
    const r = await _ceiviDati(); if(!r) return;
    _ceiviDoc(r.data, r.p).save(_ceiviFname('pdf'));
    _ceiviStatus('✓ PDF generato: '+_ceiviEsito(r.data)+'.'); toast('PDF imprese scaricato ✓','ok');
  }catch(e){ console.error('ceivImpPdf',e); _ceiviStatus('Non sono riuscito a leggere i dati: '+(e.message||e), true); toast('Errore: '+(e.message||e),'err'); }
}
async function ceivImpInvia(){
  const to=($('ceiv-mail-to')?.value||'').trim();
  const cc=($('ceiv-mail-cc')?.value||'').trim();
  if(!to){ _ceiviStatus('Scrivi l’indirizzo nel campo «Email CEIV» dell’estrazione qui sopra.', true); toast('Manca l’email CEIV','warn'); return; }
  try{
    const r = await _ceiviDati(); if(!r) return;
    if(!confirm('Invio a CEIV – imprese presenti per cantiere\n\nA: '+to+(cc?'\nIn copia: '+cc:'')+'\nPeriodo: '+r.p.etichetta+'\n'+_ceiviEsito(r.data)+
      '\nAllegati: '+_ceiviFname('xlsx')+' e '+_ceiviFname('pdf')+
      '\n\nLa mail parte SUBITO e non si richiama. Hai gia’ guardato i due file?\n\nOK = invia, Annulla = non inviare')){
      _ceiviStatus('Invio annullato: non e’ partito niente.'); return; }
    _ceiviStatus('⏳ Generazione allegati…');
    const x = await _ceiviWb(r.data);
    const xlsxB64 = x.X.write(x.wb, { type:'base64', bookType:'xlsx' });
    const pdfB64 = _ceiviDoc(r.data, r.p).output('datauristring').split(',')[1];
    _ceiviStatus('⏳ Invio email a CEIV…');
    const { data:res, error } = await sb.functions.invoke('send-ceiv', { body:{
      to:[to], cc: cc?[cc]:[], periodo: r.p.etichetta, nRighe: r.data.length,
      attachments:[
        { name:_ceiviFname('xlsx'), b64:xlsxB64, mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { name:_ceiviFname('pdf'),  b64:pdfB64,  mime:'application/pdf' },
      ] } });
    if(error) throw error;
    if(res && res.error) throw new Error(res.error);
    _ceiviStatus(`✓ Email inviata a ${to}: `+_ceiviEsito(r.data)+'.');
    toast('Email CEIV inviata ✓','ok');
  }catch(e){ console.error('ceivImpInvia',e); _ceiviStatus('Invio non riuscito: '+(e.message||e), true); toast('Errore invio: '+(e.message||e),'err'); }
}
window.ceivImpExcel=ceivImpExcel;
window.ceivImpPdf=ceivImpPdf;
window.ceivImpInvia=ceivImpInvia;



let _xlsxPending=null
function _parseXlsxSnap(wb){
  const snap={}
  const ws1=wb.Sheets['Visita']
  if(ws1){
    const rows=XLSX.utils.sheet_to_json(ws1,{header:1,defval:''})
    const m={}
    rows.slice(1).forEach(r=>{if(r[0])m[String(r[0]).trim()]=String(r[1]??'').trim()})
    snap.nr_verbale_origine=m['N. Verbale']||''
    snap.data_visita=m['Data visita']||null
    snap.ora_visita=m['Ora inizio']||null
    snap.ora_fine=m['Ora fine']||null
    const ta={'Su segnalazione':'1','Su richiesta':'2','Protocolli intesa':'3','RLS/RLST':'4','Programmata':'5','Cantiere qualita':'6','Dal CPT':'7','Visite in serie':'8','Stage ASL':'9','Asseverazione':'10','Attestazione consulenza':'11','Progetto SPISAL':'12'}
    snap.tipo_accesso=ta[m['Tipo accesso']]||null
    snap.rlst_sn=m['RLST presente']==='Si'?'1':'0'
    snap.stage_vis=m['Stagista presente']==='Si'?'1':'0'
    snap.nom_stage=m['Nome stagista']||null
    snap.ppre_nome=m['Pers. presente - Nome']||null
    snap.ppre_cog=m['Pers. presente - Cognome']||null
    snap.qual_ppre=m['Pers. presente - Qualifica']||null
    snap.tel_ppre=m['Pers. presente - Tel.']||null
    snap.tec_display=m['Tecnico']||null
    snap.cantiere_label=m['Cantiere']||null
    snap.cantiere_detail=m['Cantiere dettaglio']||null
    snap.prot_int=m['Prot. interno']||null
    snap.cnce=m['CNCE']||null
    snap.cod_uni=m['Cod. Unico']||null
    snap.comm_tipo=m['Committente tipo']==='Pubblico'?'1':m['Committente tipo']==='Privato'?'2':null
    snap.comm_tipo_sogg=m['Committente soggetto']==='Persona giuridica'?'PG':'PF'
    snap.comm_nome=m['Committente nome']||null
    snap.comm_cog=m['Committente cognome']||null
    snap.comm_cf=m['Committente CF']||null
    snap.comm_email=m['Committente email']||null
    snap.comm_tel=m['Committente tel.']||null
    snap.comm_rag_soc=m['Committente rag. soc.']||null
    snap.comm_piva=m['Committente P.IVA']||null
    snap.coord=m['Coordinamento']==='Si'
    snap.rl_nome=m['RL - Nome']||null;snap.rl_email=m['RL - Email']||null;snap.rl_tel=m['RL - Tel.']||null
    snap.csp_nome=m['CSP - Nome']||null;snap.csp_email=m['CSP - Email']||null;snap.csp_tel=m['CSP - Tel.']||null
    snap.cse_nome=m['CSE - Nome']||null;snap.cse_email=m['CSE - Email']||null;snap.cse_tel=m['CSE - Tel.']||null
    snap.nr_imp=parseInt(m['N. imprese'])||0
    snap.nr_lavoratori=parseInt(m['N. lavoratori'])||0
    snap.nr_lavoratori_stranieri=parseInt(m['N. lav. stranieri'])||0
    snap.stato_lav=m['Tipo lavorazione']||null
    snap.segnalazione=m['Segnalazione']==='Si'
    snap.data_ritorno=m['Data ritorno']||null
    snap.oss_tec=m['Osservazioni tecniche']||null
    snap.oss_int=m['Note interne']||null
    snap.note_for_m=m['Note per mail']||null
  }
  const ws2=wb.Sheets['Imprese']
  if(ws2){
    const rows=XLSX.utils.sheet_to_json(ws2,{header:1,defval:''})
    snap.imprese=rows.slice(1).filter(r=>r[1]).map((r,i)=>({
      impresa_nome:String(r[1]||''),piva:String(r[2]||''),cf_imp:String(r[3]||''),
      ind_imp:String(r[4]||''),com_imp:String(r[5]||''),att:String(r[6]||''),
      capo_nome:String(r[7]||''),capo_cog:String(r[8]||''),badge:String(r[9]||''),
      tipo_imp:String(r[10]||''),is_principale:i===0,certif:[],ceiv:'',stage_imp:'',note_fasilav:'',pat:''
    }))
  }
  const ws3=wb.Sheets['Lavorazioni']
  if(ws3){
    const rows=XLSX.utils.sheet_to_json(ws3,{header:1,defval:''})
    snap.lavorazioni=rows.slice(1).filter(r=>r[0]).map(r=>({genere:String(r[0]||''),fase:String(r[1]||''),lavorazione:String(r[2]||'')}))
  }
  const ws4=wb.Sheets['Checklist']
  if(ws4){
    const rows=XLSX.utils.sheet_to_json(ws4,{header:1,defval:''})
    snap.checklist={};snap.note_checklist={}
    const em={'Verificato':'VER','NC lieve':'NC-','NC grave':'NC+','Osservazione':'OSS','Non presente':'NP','N/A':'NA'}
    rows.slice(1).forEach(r=>{
      const cod=String(r[0]||'').trim();if(!cod)return
      snap.checklist[cod]=em[String(r[3]||'')]||'NA'
      const nota=String(r[4]||'').trim();if(nota)snap.note_checklist[cod]=nota
    })
  }
  return snap
}
function _admXlsxShowPreview(snap,fname){
  _xlsxPending=snap
  const ni=(snap.imprese||[]).length,nl=(snap.lavorazioni||[]).length,nc=Object.keys(snap.checklist||{}).length
  const el=document.getElementById('adm-xlsx-info')
  if(el)el.innerHTML='<b>File:</b> '+esc(fname)+'<br><b>Verbale:</b> '+esc(snap.nr_verbale_origine||'?')+'<br><b>Data:</b> '+(snap.data_visita||'?')+'<br><b>Imprese:</b> '+ni+' | <b>Lavorazioni:</b> '+nl+' | <b>Checklist:</b> '+nc+' voci'
  const p=document.getElementById('adm-xlsx-preview');if(p)p.style.display=''
}
function _admReadXlsx(file){
  const reader=new FileReader()
  reader.onload=function(e){
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'})
      _admXlsxShowPreview(_parseXlsxSnap(wb),file.name)
    }catch(err){console.error(err);toast('Errore lettura xlsx: '+err.message,'err')}
  }
  reader.readAsArrayBuffer(file)
}
const _dz=document.getElementById('adm-drop-xlsx')
const _fi=document.getElementById('adm-file-xlsx')
if(_dz){
  _dz.addEventListener('click',function(){if(_fi)_fi.click()})
  _dz.addEventListener('dragover',function(e){e.preventDefault();_dz.style.borderColor='#e7500f'})
  _dz.addEventListener('dragleave',function(){_dz.style.borderColor='rgba(255,255,255,.25)'})
  _dz.addEventListener('drop',function(e){
    e.preventDefault();_dz.style.borderColor='rgba(255,255,255,.25)'
    const f=e.dataTransfer?.files?.[0]
    if(f&&f.name.endsWith('.xlsx'))_admReadXlsx(f)
    else toast('Seleziona un file .xlsx','warn')
  })
}
if(_fi)_fi.addEventListener('change',function(e){const f=e.target.files?.[0];if(f)_admReadXlsx(f);e.target.value=''})
document.getElementById('btn-adm-load-xlsx')?.addEventListener('click',function(){
  if(!_xlsxPending){toast('Nessun file','warn');return}
  const snap=Object.assign({},_xlsxPending);delete snap.visita_id
  const p=document.getElementById('adm-xlsx-preview');if(p)p.style.display='none'
  _xlsxPending=null;if(_fi)_fi.value=''
  snap._tieniNumero=true
  ;(async function(){
    try{await initForm(snap);navTo('form');toast('Visita caricata da Excel: controlla tecnico e cantiere, poi salva','ok')}
    catch(err){toast('Errore nel caricamento: '+err.message,'err');console.error('import xlsx:',err)}
  })()
})
document.getElementById('btn-adm-cancel-xlsx')?.addEventListener('click',function(){
  const p=document.getElementById('adm-xlsx-preview');if(p)p.style.display='none'
  _xlsxPending=null;if(_fi)_fi.value=''
})


// ══ INCARICHI AI TECNICI ═════════════════════════════════════════════
}
