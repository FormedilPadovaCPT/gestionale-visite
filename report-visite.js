/* ============================================================
   Report visite: il PDF del «Report attività» della Zona Segreteria (admGeneraReport), coi suoi grafici rpt*. Mette window.admGeneraReport.

   MODULO ESTRATTO DAL FILE CENTRALE index.html (revisione di tenuta del 13/11/2026).
   Il codice è lo stesso che stava nel file centrale: nessuna riga è cambiata. Vive
   dentro una fabbrica che riceve dal modulo inline le sole cose di cui ha bisogno:
   se manca una dipendenza si vede alla prima chiamata.

   Chi lo usa (index.html):
     import { creaReportVisite } from './report-visite.js'
     creaReportVisite({ $, sb, sbTutte, S, ADMIN_EMAIL, toast, CEIV_STAT_COL, CEIV_STAT_ORD, GRAD_UTILITA, NOTA_VECCHIO_PARAMETRO, _maiuscola, ceivFotoRif, ceivStatVisita, comuneStat, datiCantiereMancanti, datiCantiereStat, gradimentoDati, ipcPerCeiv, ipcPerMese, notaCeivFotoBreve, rptVociNc })
   ⚠️ Un file nuovo va aggiunto alle due liste di .github/workflows/deploy-pages.yml
   (paths e copia in _site): senza, non viene pubblicato.
   ============================================================ */
export function creaReportVisite({ $, sb, sbTutte, S, ADMIN_EMAIL, toast, CEIV_STAT_COL, CEIV_STAT_ORD, GRAD_UTILITA, NOTA_VECCHIO_PARAMETRO, _maiuscola, ceivFotoRif, ceivStatVisita, comuneStat, datiCantiereMancanti, datiCantiereStat, gradimentoDati, ipcPerCeiv, ipcPerMese, notaCeivFotoBreve, rptVociNc }) {
// ══════════════════════════════════════════════════════════════════
// REPORT PDF COORDINATORE
// ══════════════════════════════════════════════════════════════════

// MACROAREE_NOMI rimosso: si usa ZONE_LBL (già in scope) + lookup dinamico da checklist_voci

// Colori standard checklist (usati in tutti i grafici NC+/NC-/OSS/VER/NA)

// Colori Cassa Edile / CEIV (C.E.I.V. ha sempre rgb 59,51,101)

// ── Canvas helpers ──────────────────────────────────────────────────

// Supersampling dei grafici del report: il canvas viene creato a RPT_SS volte
// le dimensioni logiche e poi scalato, cosi' testi e linee restano nitidi in stampa
// (a 4x si ottengono ~400-500 dpi sulle immagini inserite nel PDF).
const RPT_SS=4
const RPT_INK='#2b2f36',RPT_MUTED='#8a9099',RPT_SOFT='#b9bec6',RPT_GRID='#ececee',RPT_AXIS='#d8dadd',RPT_ORANGE='#e7500f'
function _mkCanvas(w,h){
  const c=document.createElement('canvas')
  c.width=Math.round(w*RPT_SS);c.height=Math.round(h*RPT_SS)
  const ctx=c.getContext('2d')
  ctx.scale(RPT_SS,RPT_SS)
  ctx.textBaseline='alphabetic'
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h)
  return{canvas:c,ctx}
}
// Titolo standard dei grafici: allineato a sinistra + trattino arancione.
// Ritorna la Y da cui parte il contenuto.
function _rptTitle(ctx,title,w){
  ctx.fillStyle=RPT_INK;ctx.font='bold 11px Arial';ctx.textAlign='left'
  const words=String(title||'').split(' ')
  let line='',lines=[]
  words.forEach(word=>{
    const t=line?line+' '+word:word
    if(ctx.measureText(t).width>w-12&&line){lines.push(line);line=word}else line=t
  })
  if(line)lines.push(line)
  let ty=13
  lines.slice(0,2).forEach(l=>{ctx.fillText(l,4,ty);ty+=13})
  ctx.fillStyle=RPT_ORANGE
  ctx.fillRect(4,ty-8,22,2.4)
  return ty+8
}
function _rptRound(ctx,x,y,w,h,r){
  const rr=Math.min(r,h/2,w/2)
  ctx.beginPath()
  ctx.moveTo(x,y)
  ctx.lineTo(x+w-rr,y);ctx.arcTo(x+w,y,x+w,y+rr,rr)
  ctx.lineTo(x+w,y+h-rr);ctx.arcTo(x+w,y+h,x+w-rr,y+h,rr)
  ctx.lineTo(x,y+h);ctx.closePath()
}
// Donut chart → dataURL (ciambella a sinistra, legenda a destra)
function rptDonut({data,labels,colors,title,w=380,h=240,maxLbl=28}){
  const{canvas,ctx}=_mkCanvas(w,h)
  const total=data.reduce((s,v)=>s+(v||0),0)
  const top=_rptTitle(ctx,title,w)
  if(!total){
    ctx.fillStyle=RPT_SOFT;ctx.font='11px Arial';ctx.textAlign='center'
    ctx.fillText('Nessun dato',w/2,(h+top)/2);return canvas.toDataURL()
  }
  const availH=h-top-8
  const r=Math.min(availH/2-4,64),ri=r*0.62
  const cx=r+18,cy=top+availH/2
  let ang=-Math.PI/2
  data.forEach((v,i)=>{
    if(!v)return
    const sl=(v/total)*Math.PI*2
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,ang,ang+sl)
    ctx.closePath()
    ctx.fillStyle=(colors&&colors[i])||RPT_PALETTE[i%RPT_PALETTE.length]
    ctx.fill()
    ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke()
    ang+=sl
  })
  ctx.beginPath();ctx.arc(cx,cy,ri,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill()
  ctx.fillStyle=RPT_INK;ctx.font='bold 16px Arial';ctx.textAlign='center'
  ctx.fillText(total,cx,cy+2)
  ctx.fillStyle=RPT_MUTED;ctx.font='8px Arial'
  ctx.fillText('totale',cx,cy+13)
  // legenda: 1 colonna, 2 se il canvas e' largo
  const items=[]
  data.forEach((v,i)=>{if(v||data.length<=4)items.push(i)})
  const legX=cx+r+18
  const nCols=(w-legX>330&&items.length>4)?2:1
  const colW=(w-legX-6)/nCols
  const rowH=17
  const perCol=Math.ceil(items.length/nCols)
  const legTop=cy-(perCol*rowH)/2+11
  items.forEach((idx,k)=>{
    const col=Math.floor(k/perCol),row=k%perCol
    const lx=legX+col*colW,ly=legTop+row*rowH
    ctx.beginPath();ctx.arc(lx+4,ly-3.5,4.2,0,Math.PI*2)
    ctx.fillStyle=(colors&&colors[idx])||RPT_PALETTE[idx%RPT_PALETTE.length];ctx.fill()
    let lbl=String((labels&&labels[idx])||'')
    if(lbl.length>maxLbl)lbl=lbl.substring(0,maxLbl-1)+'…'
    const v=data[idx]||0,pct=Math.round(v/total*100)
    ctx.fillStyle=RPT_INK;ctx.font='9.5px Arial';ctx.textAlign='left'
    ctx.fillText(lbl,lx+13,ly)
    const lw=ctx.measureText(lbl).width
    ctx.font='bold 9.5px Arial'
    ctx.fillText(' '+v,lx+13+lw,ly)
    const vw=ctx.measureText(' '+v).width
    ctx.fillStyle=RPT_MUTED;ctx.font='8.5px Arial'
    ctx.fillText(' ('+pct+'%)',lx+13+lw+vw,ly)
  })
  return canvas.toDataURL()
}
// Horizontal bar chart → dataURL (tinta unica, griglia leggera)
function rptBar({data,labels,colors,title,w=460,h}){
  const n=data.length||1
  const padB=10,padL=132,padR=34
  let barH=17,gap=6
  const padT0=34
  const autoH=padT0+n*(barH+gap)+padB
  const ch=h||Math.max(84,Math.min(autoH,290))
  const{canvas,ctx}=_mkCanvas(w,ch)
  const padT=_rptTitle(ctx,title,w)
  const avail=ch-padT-padB
  if(n*(barH+gap)>avail){
    const pitch=avail/n
    gap=Math.min(6,pitch*.26)
    barH=Math.max(2,pitch-gap)
  }
  const lblF=Math.max(6.5,Math.min(9.5,barH*.62))
  const maxV=Math.max(...data.map(v=>v||0),1)
  const bw=w-padL-padR
  // griglia verticale leggera (quarti)
  ctx.strokeStyle=RPT_GRID;ctx.lineWidth=1
  for(let q=1;q<=4;q++){
    const gx=padL+bw*q/4
    ctx.beginPath();ctx.moveTo(gx,padT-3);ctx.lineTo(gx,padT+n*(barH+gap)-gap+3);ctx.stroke()
  }
  ctx.strokeStyle=RPT_AXIS;ctx.beginPath();ctx.moveTo(padL,padT-3);ctx.lineTo(padL,padT+n*(barH+gap)-gap+3);ctx.stroke()
  data.forEach((v,i)=>{
    const y=padT+i*(barH+gap)
    const bLen=bw*((v||0)/maxV)
    if(bLen>0){
      ctx.fillStyle=(colors&&colors[i])||RPT_ORANGE
      _rptRound(ctx,padL,y,bLen,barH,Math.min(2.5,barH/2))
      ctx.fill()
    }
    ctx.fillStyle='#565c66';ctx.font=lblF.toFixed(1)+'px Arial';ctx.textAlign='right'
    ctx.fillText(String((labels&&labels[i])||'').substring(0,26),padL-6,y+barH/2+lblF*.36)
    if(v){
      ctx.fillStyle=RPT_INK;ctx.font='bold '+(lblF*.95).toFixed(1)+'px Arial';ctx.textAlign='left'
      ctx.fillText(v,padL+bLen+4,y+barH/2+lblF*.36)
    }
  })
  return canvas.toDataURL()
}
/* Colonne impilate col totale in cima e la legenda sotto (19/10/2026): è il grafico
   «IPC per n° accesso al cantiere» della pagina Statistiche, portato nel report.
   cols = [{label, segs:[…]}], un segmento per colore. → dataURL */
function rptStackedCols({cols,segColors,segLabels,title,w=400,h=280}){
  const{canvas,ctx}=_mkCanvas(w,h)
  const padT=_rptTitle(ctx,title,w)+12
  const padL=34,padR=10,padB=cols.some(c=>c.nota)?50:40
  const n=cols.length||1
  const ph=h-padT-padB,pw=w-padL-padR
  const tot=c=>c.segs.reduce((a,x)=>a+(x||0),0)
  const raw=Math.max(...cols.map(tot),1)
  const step=Math.max(1,Math.ceil(raw/4/Math.pow(10,Math.floor(Math.log10(raw/4||1))))*Math.pow(10,Math.floor(Math.log10(raw/4||1))))
  const ymax=step*Math.ceil(raw/step)
  ctx.lineWidth=1;ctx.font='8.5px Arial';ctx.textAlign='right'
  for(let v=0;v<=ymax;v+=step){
    const gy=padT+ph-ph*v/ymax
    ctx.strokeStyle=v?RPT_GRID:RPT_AXIS;ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(padL+pw,gy);ctx.stroke()
    ctx.fillStyle='#8a8f96';ctx.fillText(String(v),padL-4,gy+3)
  }
  const slot=pw/n,bw=Math.min(46,slot*.6)
  cols.forEach((c,i)=>{
    const x=padL+i*slot+(slot-bw)/2
    let base=0
    c.segs.forEach((v,si)=>{
      if(!v)return
      const bh=ph*v/ymax
      ctx.fillStyle=segColors[si];ctx.fillRect(x,padT+ph-base-bh,bw,bh)
      base+=bh
    })
    const t=tot(c)
    if(t){ctx.fillStyle=RPT_INK;ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(String(t),x+bw/2,padT+ph-base-4)}
    ctx.fillStyle='#565c66';ctx.font='9px Arial';ctx.textAlign='center'
    ctx.fillText(String(c.label||''),x+bw/2,padT+ph+13)
    if(c.nota){ctx.fillStyle=RPT_ORANGE;ctx.font='bold 8.5px Arial';ctx.fillText(String(c.nota),x+bw/2,padT+ph+24)}
  })
  let lx=padL
  const ly=h-10
  ctx.font='8.5px Arial';ctx.textAlign='left'
  segLabels.forEach((sl,si)=>{
    ctx.fillStyle=segColors[si];ctx.fillRect(lx,ly-7,8,8)
    ctx.fillStyle='#565c66';ctx.fillText(sl,lx+11,ly)
    lx+=11+ctx.measureText(sl).width+14
  })
  return canvas.toDataURL()
}
/* Barre orizzontali al 100% (19/10/2026): per confrontare gruppi di dimensioni diverse, come
   le visite a imprese iscritte e non iscritte alla Cassa. rows=[{label,segs:[…],nota}] → dataURL */
function rptPercentBars({rows,segColors,segLabels,title,w=640,h=150}){
  const{canvas,ctx}=_mkCanvas(w,h)
  const padT=_rptTitle(ctx,title,w)+4
  const padL=170,padR=110,padB=22
  const n=rows.length||1
  const gap=6,barH=Math.max(8,Math.min(20,(h-padT-padB-gap*(n-1))/n))
  const bw=w-padL-padR
  rows.forEach((r,i)=>{
    const y=padT+i*(barH+gap)
    const tot=r.segs.reduce((a,x)=>a+(x||0),0)||1
    let x=padL
    r.segs.forEach((v,si)=>{
      if(!v)return
      const len=bw*v/tot
      ctx.fillStyle=segColors[si];ctx.fillRect(x,y,len,barH)
      if(len>22){ctx.fillStyle=si>=2?'#fff':'#2b2f36';ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillText(Math.round(v/tot*100)+'%',x+len/2,y+barH/2+3)}
      x+=len
    })
    ctx.fillStyle='#565c66';ctx.font='9px Arial';ctx.textAlign='right'
    ctx.fillText(String(r.label||'').substring(0,34),padL-6,y+barH/2+3.3)
    if(r.nota){ctx.fillStyle=RPT_INK;ctx.font='bold 9px Arial';ctx.textAlign='left';ctx.fillText(String(r.nota),padL+bw+6,y+barH/2+3.3)}
  })
  let lx=padL
  const ly=h-6
  ctx.font='8.5px Arial';ctx.textAlign='left'
  segLabels.forEach((sl,si)=>{
    ctx.fillStyle=segColors[si];ctx.fillRect(lx,ly-7,8,8)
    ctx.fillStyle='#565c66';ctx.fillText(sl,lx+11,ly)
    lx+=11+ctx.measureText(sl).width+14
  })
  return canvas.toDataURL()
}
// Barre orizzontali impilate (per i rilievi delle macro aree) → dataURL
function rptStacked({rows,segColors,segLabels,title,w=600,h}){
  const n=rows.length||1
  const padB=24,padL=150,padR=40
  const barH=15,gap=7
  const ch=h||(34+n*(barH+gap)+padB)
  const{canvas,ctx}=_mkCanvas(w,ch)
  const padT=_rptTitle(ctx,title,w)
  const maxV=Math.max(...rows.map(r=>r.segs.reduce((s,x)=>s+(x||0),0)),1)
  const bw=w-padL-padR
  ctx.strokeStyle=RPT_GRID;ctx.lineWidth=1
  for(let q=1;q<=4;q++){
    const gx=padL+bw*q/4
    ctx.beginPath();ctx.moveTo(gx,padT-3);ctx.lineTo(gx,padT+n*(barH+gap)-gap+3);ctx.stroke()
  }
  ctx.strokeStyle=RPT_AXIS;ctx.beginPath();ctx.moveTo(padL,padT-3);ctx.lineTo(padL,padT+n*(barH+gap)-gap+3);ctx.stroke()
  rows.forEach((r,i)=>{
    const y=padT+i*(barH+gap)
    const tot=r.segs.reduce((s,x)=>s+(x||0),0)
    let x=padL
    r.segs.forEach((v,si)=>{
      if(!v)return
      const len=bw*(v/maxV)
      ctx.fillStyle=segColors[si]
      ctx.fillRect(x,y,len,barH)
      x+=len
    })
    ctx.fillStyle='#565c66';ctx.font='9px Arial';ctx.textAlign='right'
    ctx.fillText(String(r.label||'').substring(0,28),padL-6,y+barH/2+3.3)
    if(tot){
      ctx.fillStyle=RPT_INK;ctx.font='bold 8.6px Arial';ctx.textAlign='left'
      ctx.fillText(tot,x+4,y+barH/2+3.2)
    }
  })
  // legenda in basso
  let lx=padL
  const ly=padT+n*(barH+gap)-gap+16
  segLabels.forEach((sl,si)=>{
    ctx.fillStyle=segColors[si];ctx.fillRect(lx,ly-7,8,8)
    ctx.fillStyle='#565c66';ctx.font='8.5px Arial';ctx.textAlign='left'
    ctx.fillText(sl,lx+11,ly)
    lx+=11+ctx.measureText(sl).width+16
  })
  return canvas.toDataURL()
}
// Monthly vertical bar chart → dataURL
/* 30/09/2026: i mesi sono quelli del periodo scelto e nel suo ordine (l'esercizio va da ottobre a
   settembre). Prima erano sempre Gen-Dic col titolo «Andamento mensile 2025», e ottobre 2025 stava
   in fondo accanto a settembre 2026. */
function rptMonthly({data,labels,titolo,w=580,h=155}){
  const{canvas,ctx}=_mkCanvas(w,h)
  const months=labels
  const maxV=Math.max(...data,1)
  const padL=30,padR=10,padB=24
  const padT=_rptTitle(ctx,titolo,w)
  const plotH=h-padT-padB
  // griglia orizzontale su passi "puliti"
  const step=maxV>40?Math.ceil(maxV/4/10)*10:(maxV>8?Math.ceil(maxV/4/2)*2:2)
  ctx.strokeStyle=RPT_GRID;ctx.lineWidth=1
  ctx.fillStyle=RPT_SOFT;ctx.font='7.5px Arial';ctx.textAlign='right'
  for(let v=step;v<=maxV;v+=step){
    const gy=h-padB-plotH*(v/maxV)
    ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(w-padR,gy);ctx.stroke()
    ctx.fillText(v,padL-4,gy+2.5)
  }
  ctx.strokeStyle=RPT_AXIS
  ctx.beginPath();ctx.moveTo(padL,h-padB);ctx.lineTo(w-padR,h-padB);ctx.stroke()
  const bw=(w-padL-padR)/Math.max(data.length,1)
  data.forEach((v,i)=>{
    const x=padL+i*bw+bw*0.18
    const barW=bw*0.64
    const barHpx=plotH*(v/maxV)||0
    const y=h-padB-barHpx
    if(v>0){
      ctx.fillStyle=RPT_ORANGE
      _rptRound(ctx,x,y,barW,barHpx,2.5)
      ctx.fill()
      ctx.fillStyle='#565c66';ctx.font='bold 8.5px Arial';ctx.textAlign='center'
      ctx.fillText(v,x+barW/2,y-3)
    }
    ctx.fillStyle=RPT_MUTED;ctx.font='9px Arial';ctx.textAlign='center'
    ctx.fillText(months[i],x+barW/2,h-padB+11)
  })
  return canvas.toDataURL()
}

// Checklist aggregation per macro area
// prefToZone: { 'IMP': 1, 'SOL': 3, 'ASU': 4, ... } costruito da checklist_voci
function rptAggregateMacro(chkAll, prefToZone){
  // Inizializza tutte e 10 le zone
  const res={}
  for(let z=1;z<=10;z++) res[z]={ncp:0,ncm:0,oss:0,ver:0}
  ;(chkAll||[]).forEach(({codice,valore})=>{
    if(!codice||codice.length<3)return
    const pref=codice.substring(0,3).toUpperCase()
    const zona=prefToZone[pref]
    if(!zona)return
    if(valore==='NC+')res[zona].ncp++
    else if(valore==='NC-')res[zona].ncm++
    else if(valore==='OSS')res[zona].oss++
    else if(valore==='VER')res[zona].ver++
  })
  return res
}

/* 01/10/2026 — IPC per macro area, come i grafici «Macroaree di valutazione» del foglio Google
   (chiesto dall'utente). Per ogni visita e per ogni area si contano i rilievi di QUELL'AREA e si
   applica la scala dell'IPC generale: almeno una NC+ o piu' di 3 NC- = alto; da 1 a 3 NC- o piu'
   di 6 osservazioni = medio; da 1 a 6 osservazioni = basso; solo voci conformi = nessun rilievo.
   Un'area senza voci valutate (tutte «non applicabile») non entra nel grafico: null.
   Verificato sul 2025-26: coincide col foglio su tutte e dieci le aree. */
/* IPC per n° accesso al cantiere: classi e conteggio come _dashRenderAccesso della pagina
   Statistiche; un IPC diverso da ALTO/MEDIO/BASSO vale «Nessun Rilievo», come nei KPI */
function rptIpcPerAccesso(visite){
  const lab=n=>{n=+n||0;if(n<=0)return'Non ind.';if(n>=5)return'5°+';return n+'°'}
  const ord=['1°','2°','3°','4°','5°+','Non ind.']
  const idx={NR:0,BASSO:1,MEDIO:2,ALTO:3}
  const g={}
  ;(visite||[]).forEach(v=>{
    const k=lab(v.acc_cant)
    const i=idx[['ALTO','MEDIO','BASSO'].indexOf(v.ipc)>=0?v.ipc:'NR']
    ;(g[k]=g[k]||[0,0,0,0])[i]++
  })
  return ord.filter(k=>g[k]).map(k=>({label:k,segs:g[k]}))
}
function rptIpcLivello(d){
  if(d.ncp>=1||d.ncm>3)return 'ALTO'
  if(d.ncm>=1||d.oss>6)return 'MEDIO'
  if(d.oss>=1)return 'BASSO'
  if(d.ver>=1)return 'NR'
  return null
}
// chkAll: righe {visita_id,codice,valore}; ritorna {zona:{ALTO,MEDIO,BASSO,NR}} in numero di VISITE
function rptIpcMacro(chkAll,prefToZone){
  const perVis={}
  ;(chkAll||[]).forEach(({visita_id,codice,valore})=>{
    if(!visita_id||!codice||codice.length<3)return
    const zona=prefToZone[codice.substring(0,3).toUpperCase()]
    if(!zona)return
    const k=valore==='NC+'?'ncp':valore==='NC-'?'ncm':valore==='OSS'?'oss':valore==='VER'?'ver':null
    if(!k)return
    const key=visita_id+'|'+zona
    if(!perVis[key])perVis[key]={zona,ncp:0,ncm:0,oss:0,ver:0}
    perVis[key][k]++
  })
  const res={}
  for(let z=1;z<=10;z++)res[z]={ALTO:0,MEDIO:0,BASSO:0,NR:0}
  Object.values(perVis).forEach(d=>{const l=rptIpcLivello(d);if(l&&res[d.zona])res[d.zona][l]++})
  return res
}

// jsPDF page header (banda arancione sottile + titolo a sinistra)
function rptPageHeader(doc,title,dalFmt,alFmt,nota){
  doc.setFillColor(231,80,15);doc.rect(0,0,210,6,'F')
  doc.setTextColor(43,47,54);doc.setFontSize(14);doc.setFont('helvetica','bold')
  doc.text(title,12,16.5)
  doc.setFillColor(231,80,15);doc.rect(12,19,22,1.1,'F')
  doc.setFontSize(7.5);doc.setFont('helvetica','normal');doc.setTextColor(138,144,153)
  doc.text('FORMEDIL PADOVA · Area Sicurezza e Salute',198,13,{align:'right'})
  doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(231,80,15)
  doc.text(`Periodo ${dalFmt} – ${alFmt}`,198,18,{align:'right'})
  if(nota){doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(196,63,10);doc.text(nota,12,24)}
  doc.setFont('helvetica','normal');doc.setTextColor(40,40,40)
}

// ── Funzione principale ────────────────────────────────────────────

async function admGeneraReport(){
  if(!S.user||S.user.email!==ADMIN_EMAIL){toast('Accesso negato','err');return}
  const dal=($('sgr-dal')?.value)||''
  const al=($('sgr-al')?.value)||''
  if(!dal||!al){toast('Seleziona entrambe le date prima di generare il report','err');return}
  // stampa col vecchio parametro (dichiarato in ogni visita): vedi datiCantiereStat
  const vecchio=!!($('sgr-vecchio')&&$('sgr-vecchio').checked)
  const notaVecchio=vecchio?NOTA_VECCHIO_PARAMETRO:''
  toast('Elaborazione report in corso…','ok')
  try{

    // ── 1. Visite nel periodo ──
    const visite=await sbTutte((da,a)=>sb.from('visite')
      .select([
        'visita_id','data_visita','ipc','tipo_accesso','rlst_sn','acc_cant',
        'nom_ppre','qual_ppre','cantiere_id','tecnico_id','tecnico2_id',
        'nr_lavoratori','nr_imp','nr_ind','comm_tipo','comm_tipo_sogg',
        'vis_tip_int','vis_tip_ope','vis_durata','vis_importo',
        'tecnici!visite_tecnico_id_fkey(tecnico_nome,tecnico_cognome)',
        'impresa_id','imprese(stato_cassa)','visite_cassa_foto(impresa_id,stato,fonte,iscritta_ceiv,riferimento)',
        'cantieri(cantiere_tip_int,cantiere_tip_ope,cantiere_durata,cantiere_importo,comune_nome,committenti(committente_tipo))'
      ].join(','))
      .gte('data_visita',dal).lte('data_visita',al).eq('elimina',0).order('visita_id').range(da,a))
    if(!visite||!visite.length){toast('Nessuna visita nel periodo selezionato','warn');return}

    // ── 2. Mapping codice-prefix → zona_osserv da checklist_voci ──
    // Le prime 3 lettere del codice identificano la macro area (IMP, SOL, ASU, ...)
    const{data:voceRows,error:eVoci}=await sb.from('checklist_voci').select('codice,zona_osserv,descrizione')
    if(eVoci)throw new Error('non sono riuscito a leggere le voci della checklist ('+eVoci.message+')')
    const prefToZone={}
    ;(voceRows||[]).forEach(v=>{
      if(v.codice&&v.zona_osserv){
        const pref=v.codice.substring(0,3).toUpperCase()
        if(!prefToZone[pref])prefToZone[pref]=v.zona_osserv
      }
    })

    // ── 3. Checklist items per tutte le visite ──
    const visitaIds=visite.map(v=>v.visita_id)
    const chkAll=[]
    for(let i=0;i<visitaIds.length;i+=100){
      for(let from=0;;from+=1000){
        const{data:batch,error:eChk}=await sb.from('visite_checklist')
          .select('visita_id,codice,valore').in('visita_id',visitaIds.slice(i,i+100)).neq('valore','NA')
          .order('id').range(from,from+999)
        /* 01/10/2026: un lotto non letto dava un totale piu' basso senza dirlo. Sono numeri che
           diventano ufficiali: se una lettura fallisce il report non esce */
        if(eChk)throw new Error('non sono riuscito a leggere le check-list ('+eChk.message+'): il report non e\u2019 stato generato')
        if(batch&&batch.length)chkAll.push(...batch)
        if(!batch||batch.length<1000)break
      }
    }

    // ── 4. Iscrizione C.E.I.V.: una riga per VISITA, sull'impresa principale, dalla lista della Cassa ──
    /* 01/10/2026 (deciso dall'utente): prima si contavano le imprese uniche per il campo cassa_edile,
       che vale «C.E.I.V.» anche per sospese, cessate e non iscritte, e non era confrontabile col
       foglio del modulo, che conta le visite */
    const ceivMap={}
    visite.forEach(v=>{const k=ceivStatVisita(v.visite_cassa_foto,v.impresa_id,v.imprese);ceivMap[k]=(ceivMap[k]||0)+1})
    // 20/10/2026: quante visite hanno lo stato in Cassa fotografato alla data della visita
    const ceivNotaRpt=notaCeivFotoBreve(visite.filter(v=>ceivFotoRif(v.visite_cassa_foto,v.impresa_id)==='data_visita').length,
      visite.filter(v=>ceivFotoRif(v.visite_cassa_foto,v.impresa_id)==='stato_attuale').length,visite.length)

    // ── 5. Aggregazioni ──
    const nV=visite.length
    const nAlto=visite.filter(v=>v.ipc==='ALTO').length
    const nMedio=visite.filter(v=>v.ipc==='MEDIO').length
    const nBasso=visite.filter(v=>v.ipc==='BASSO').length
    const nNR=visite.filter(v=>!v.ipc||v.ipc==='NR').length
    const nCant=new Set(visite.map(v=>v.cantiere_id).filter(Boolean)).size
    const nRlst=visite.filter(v=>v.rlst_sn).length

    // Tecnici (per nome, incluso tecnico principale)
    const tecMap={}
    visite.forEach(v=>{
      const n=[v.tecnici?.tecnico_nome,v.tecnici?.tecnico_cognome].filter(Boolean).join(' ')
      if(v.tecnico_id&&n){if(!tecMap[v.tecnico_id])tecMap[v.tecnico_id]={nome:n,cnt:0,rlst:0};tecMap[v.tecnico_id].cnt++;if(v.rlst_sn)tecMap[v.tecnico_id].rlst++}
    })
    const nTec=Object.keys(tecMap).length
    const tecList=Object.values(tecMap).sort((a,b)=>b.cnt-a.cnt).slice(0,8)

    // Mensile
    // Mensile: per data della VISITA, mese per mese dal primo all'ultimo del periodo (al massimo 24)
    const _MESE3=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
    const mesiPeriodo=[]
    {let yy=+dal.substring(0,4),mm=+dal.substring(5,7);const yf=+al.substring(0,4),mf=+al.substring(5,7)
     while((yy<yf||(yy===yf&&mm<=mf))&&mesiPeriodo.length<24){mesiPeriodo.push({k:yy+'-'+String(mm).padStart(2,'0'),l:_MESE3[mm-1]+' '+String(yy).slice(2)});mm++;if(mm>12){mm=1;yy++}}}
    const monthly=mesiPeriodo.map(({k})=>visite.filter(v=>(v.data_visita||'').startsWith(k)).length)
    const titoloMensile='Andamento mensile '+(mesiPeriodo.length?mesiPeriodo[0].l+' – '+mesiPeriodo[mesiPeriodo.length-1].l:'')

    // Tipo accesso
    const accMap={}
    visite.forEach(v=>{const k=+(v.tipo_accesso||0);if(k)accMap[k]=(accMap[k]||0)+1})

    // Tipo intervento / opera / durata / importo / committente: la scheda del cantiere, come nel file per
    // l'Osservatorio (01/10/2026, deciso dall'utente); con la casella «vecchio parametro» il dichiarato in ogni visita
    const dcDi=v=>datiCantiereStat(v,v.cantieri,vecchio)
    const tipIntMap={},tipOpeMap={},durataMap={}
    visite.forEach(v=>{
      const dc=dcDi(v)
      const ti=dc.tipint;if(ti)tipIntMap[ti]=(tipIntMap[ti]||0)+1
      const to=dc.tipope;if(to)tipOpeMap[to]=(tipOpeMap[to]||0)+1
      const du=dc.durata;if(du)durataMap[du]=(durataMap[du]||0)+1
    })

    // Importo lavori / lavoratori / imprese / ditte individuali / tipo visita / committente
    const importoMap={},commMap={'Pubblico':0,'Privato':0,'Non indicato':0}
    const clsLav=[[1,1,'1'],[2,3,'2-3'],[4,5,'4-5'],[6,10,'6-10'],[11,20,'11-20'],[21,9999,'oltre 20']]
    const clsImp=[[0,0,'nessuna'],[1,1,'1'],[2,2,'2'],[3,3,'3'],[4,5,'4-5'],[6,9999,'6 o piu\u2019']]
    const clsInd=[[0,0,'nessuna'],[1,1,'1'],[2,2,'2'],[3,3,'3'],[4,9999,'4 o piu\u2019']]
    const mkCls=cls=>{const m={};cls.forEach(([,,l])=>m[l]=0);return m}
    const lavMap=mkCls(clsLav),impMap=mkCls(clsImp),indMap=mkCls(clsInd)
    let lavTot=0,lavN=0
    const putCls=(m,cls,v)=>{const c=cls.find(([a,b])=>v>=a&&v<=b);if(c)m[c[2]]++}
    visite.forEach(v=>{
      const dc=dcDi(v)
      const kImp=dc.importo||11
      importoMap[kImp]=(importoMap[kImp]||0)+1
      /* 01/10/2026: il committente e' quello collegato alla scheda del cantiere, come nel file per
         l'Osservatorio. Dove l'anagrafica e' sbagliata o manca, si corregge l'anagrafica. */
      const ct=dc.commtipo
      commMap[ct===1?'Pubblico':(ct===2?'Privato':'Non indicato')]++
      if(v.nr_lavoratori!=null&&v.nr_lavoratori!==''){const x=+v.nr_lavoratori;if(x>0){putCls(lavMap,clsLav,x);lavTot+=x;lavN++}}
      if(v.nr_imp!=null&&v.nr_imp!=='')putCls(impMap,clsImp,+v.nr_imp)
      if(v.nr_ind!=null&&v.nr_ind!=='')putCls(indMap,clsInd,+v.nr_ind)
    })
    const lavMedia=lavN?(lavTot/lavN):0

    // Comuni (top 12)
    const comMap={}
    /* 30/09/2026: «PADOVA» e «Padova» contavano come due comuni (251 + 17), e i quartieri di
       Padova («PADOVA - Q1 (Centro storico)») come comuni a sé */
    visite.forEach(v=>{const c=comuneStat(v.cantieri?.comune_nome);if(c)comMap[c]=(comMap[c]||0)+1})
    const comTop=Object.entries(comMap).sort((a,b)=>b[1]-a[1]).slice(0,12)

    // Qualifica persona presente
    const qualMap={}
    visite.forEach(v=>{const q=(v.qual_ppre||'').trim()||'Non indicata';qualMap[q]=(qualMap[q]||0)+1})
    const qualList=Object.entries(qualMap).sort((a,b)=>b[1]-a[1]).slice(0,10)

    // Macro aree (lookup dinamico: prime 3 lettere codice → zona 1-10)
    const macroData=rptAggregateMacro(chkAll,prefToZone)
    const ipcMacro=rptIpcMacro(chkAll,prefToZone)

    // Formatter date
    const fmtD=d=>{if(!d)return'–';const[y,mm,dd]=d.split('-');return`${dd}/${mm}/${y}`}
    const dalFmt=fmtD(dal),alFmt=fmtD(al)

    // ── 6. PDF ──
    const{jsPDF}=window.jspdf
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true})   // (13/11/2026) grafici compressi senza perdita, come nel report Osservatorio
    const M=12,CW=210-M*2,half=(CW-4)/2

    // helper: immagine + cornice card
    const addImg=(img,x,yy,w,h)=>doc.addImage(img,'PNG',x,yy,w,h,undefined,'FAST')
    const card=(x,yy,w,h)=>{
      doc.setFillColor(255,255,255);doc.setDrawColor(229,231,234);doc.setLineWidth(0.25)
      doc.roundedRect(x,yy,w,h,1.8,1.8,'FD')
    }
    const chartCard=(img,x,yy,w,h)=>{card(x,yy,w,h);addImg(img,x+2.5,yy+2.5,w-5,h-5)}

    // helper page footer
    const footer=(pg)=>{
      doc.setDrawColor(231,80,15);doc.setLineWidth(0.4);doc.line(M,289,M+22,289)
      doc.setDrawColor(224,225,228);doc.setLineWidth(0.2);doc.line(M+22,289,210-M,289)
      doc.setFontSize(7);doc.setTextColor(150,155,162);doc.setFont('helvetica','normal')
      doc.text('Formedil Padova – Area Sicurezza e Salute – uso interno',M,293.5)
      doc.text('Pag. '+pg,210-M,293.5,{align:'right'})
    }

    // ════ PAGINA 1 – KPI + Andamento + IPC + Tipo accesso + Tecnici ════
    rptPageHeader(doc,'RAPPORTO VISITE IN CANTIERE',dalFmt,alFmt,notaVecchio)
    let y=28

    // KPI: card bianche con barra colorata a sinistra (la prima piena arancione)
    const kpis=[
      {v:nV,l:'VISITE',c:[231,80,15],fill:true},
      {v:nCant,l:'CANTIERI',c:[86,92,102]},
      {v:nTec,l:'TECNICI',c:[86,92,102]},
      {v:nAlto,l:'IPC ALTO',c:[224,43,32]},
      {v:nMedio,l:'IPC MEDIO',c:[237,125,49]},
      {v:nBasso,l:'IPC BASSO',c:[217,164,0]},
      {v:nNR,l:'NESSUN RILIEVO',c:[122,165,39]}
    ]
    const kGap=3,kw=(CW-kGap*(kpis.length-1))/kpis.length,kh=19
    kpis.forEach((k,i)=>{
      const kx=M+i*(kw+kGap)
      if(k.fill){
        doc.setFillColor(...k.c);doc.roundedRect(kx,y,kw,kh,1.8,1.8,'F')
      }else{
        card(kx,y,kw,kh)
        doc.setFillColor(...k.c);doc.rect(kx,y+1.8,1.3,kh-3.6,'F')
      }
      doc.setFontSize(6.2);doc.setFont('helvetica','bold')
      if(k.fill)doc.setTextColor(255,255,255);else doc.setTextColor(138,144,153)
      doc.text(k.l,kx+kw/2,y+5.7,{align:'center',maxWidth:kw-3})
      doc.setFontSize(15)
      if(k.fill)doc.setTextColor(255,255,255);else doc.setTextColor(...k.c)
      doc.text(String(k.v),kx+kw/2,y+14.6,{align:'center'})
    })
    doc.setTextColor(40,40,40)
    y+=kh+4

    // Andamento mensile (tutta larghezza)
    const monthImg=rptMonthly({data:monthly,labels:mesiPeriodo.map(x=>x.l),titolo:titoloMensile,w:640,h:170})
    chartCard(monthImg,M,y,CW,52);y+=56

    // IPC donut + Tipo accesso donut  (mezza + mezza)
    const ipcImg=rptDonut({
      data:[nAlto,nMedio,nBasso,nNR],
      labels:['Alto','Medio','Basso','Nessun Rilievo'],
      colors:['#E02B20','#ED7D31','#FFC000','#95C22F'],
      title:'Distribuzione IPC',w:400,h:300
    })
    chartCard(ipcImg,M,y,half,68)

    const accKeys=Object.keys(TIPO_ACC_LABELS).map(Number).filter(k=>accMap[k])
    const accImg=rptDonut({
      data:accKeys.map(k=>accMap[k]||0),
      labels:accKeys.map(k=>TIPO_ACC_LABELS[k]),
      colors:RPT_PALETTE,
      title:'Tipologia accesso',w:400,h:300,maxLbl:24
    })
    chartCard(accImg,M+half+4,y,half,68);y+=72

    // Tecnici bar + riquadro RLST (mezza + mezza)
    if(tecList.length){
      const tecImg=rptBar({
        data:tecList.map(t=>t.cnt),
        labels:tecList.map(t=>t.nome),
        title:'Visite per tecnico',w:400,h:260
      })
      chartCard(tecImg,M,y,half,66)
    }
    // riquadro RLST con dettaglio per tecnico
    const rlstPct=nV?Math.round(nRlst/nV*100):0
    const rx0=M+half+4
    card(rx0,y,half,66)
    doc.setFillColor(149,194,47);doc.rect(rx0,y+1.8,1.3,62.4,'F')
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(43,47,54)
    doc.text('Affiancamento RLST',rx0+7,y+9)
    doc.setFillColor(231,80,15);doc.rect(rx0+7,y+11.2,11,0.9,'F')
    doc.setFontSize(17);doc.setTextColor(149,194,47)
    doc.text(rlstPct+'%',rx0+half-7,y+11,{align:'right'})
    doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(138,144,153)
    doc.text(nRlst+' su '+nV+' visite',rx0+half-7,y+15.5,{align:'right'})
    let ty=y+23
    const rlstRowH=Math.min(8,40/Math.max(tecList.length,1))
    const rlstF=rlstRowH<6?6.6:7.6
    tecList.forEach(t=>{
      const p=t.cnt?Math.round((t.rlst||0)/t.cnt*100):0
      doc.setFontSize(rlstF);doc.setFont('helvetica','normal');doc.setTextColor(60,64,70)
      doc.text(String(t.nome).substring(0,24),rx0+7,ty)
      doc.setFont('helvetica','bold');doc.setTextColor(43,47,54)
      doc.text((t.rlst||0)+' su '+t.cnt+' \u00b7 '+p+'%',rx0+half-7,ty,{align:'right'})
      const bx=rx0+7,bwFull=half-14
      doc.setFillColor(238,240,242);doc.roundedRect(bx,ty+1.3,bwFull,1.5,0.75,0.75,'F')
      if(p>0){doc.setFillColor(149,194,47);doc.roundedRect(bx,ty+1.3,Math.max(1.5,bwFull*p/100),1.5,0.75,0.75,'F')}
      ty+=rlstRowH
    })

    footer(1)

    // ════ PAGINA 2 – Tipologie + Territorio ════
    doc.addPage()
    rptPageHeader(doc,'TIPOLOGIE E DISTRIBUZIONE TERRITORIALE',dalFmt,alFmt,notaVecchio)
    y=28

    // Tipo intervento + Durata (mezza + mezza)
    const tiKeys=Object.keys(tipIntMap).map(Number).sort((a,b)=>tipIntMap[b]-tipIntMap[a])
    if(tiKeys.length){
      const tiImg=rptBar({data:tiKeys.map(k=>tipIntMap[k]),labels:tiKeys.map(k=>TIP_INT_LABELS[k]||('Tipo '+k)),title:'Tipologia intervento',w:400,h:210})
      chartCard(tiImg,M,y,half,52)
    }
    const duKeys=Object.keys(durataMap).map(Number).sort((a,b)=>a-b)
    if(duKeys.length){
      const duImg=rptBar({data:duKeys.map(k=>durataMap[k]),labels:duKeys.map(k=>DURATA_LABELS[k]||('Durata '+k)),title:'Durata cantiere',w:400,h:210})
      chartCard(duImg,M+half+4,y,half,52)
    }
    y+=56

    // Tipo opera (tutta larghezza)
    const toKeys=Object.keys(tipOpeMap).map(Number).sort((a,b)=>tipOpeMap[b]-tipOpeMap[a])
    if(toKeys.length){
      const toImg=rptBar({data:toKeys.map(k=>tipOpeMap[k]),labels:toKeys.map(k=>TIP_OPE_LABELS[k]||('Op. '+k)),title:'Tipologia opera',w:640,h:190})
      chartCard(toImg,M,y,CW,52)
    }
    y+=56

    // Iscrizione Cassa Edile / CEIV (tutta larghezza, legenda a due colonne)
    if(Object.keys(ceivMap).length){
      const ceivEntries=CEIV_STAT_ORD.filter(k=>ceivMap[k]).map(k=>[k,ceivMap[k]])
      const ceivImg=rptDonut({
        data:ceivEntries.map(([,n])=>n),
        labels:ceivEntries.map(([k])=>k),
        colors:ceivEntries.map(([k])=>CEIV_STAT_COL[k]||'#999999'),
        title:'Iscrizione C.E.I.V. dell\u2019impresa principale, per visita ('+ceivNotaRpt+')',
        w:640,h:200,maxLbl:26
      })
      chartCard(ceivImg,M,y,CW,52)
      y+=56
    }

    // Titoli tabelle in stile report
    const tblTitle=(t,x)=>{
      doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(43,47,54)
      doc.text(t,x,y+4)
      doc.setFillColor(231,80,15);doc.rect(x,y+6.2,11,0.9,'F')
    }
    tblTitle('Figura presente al sopralluogo',M)
    tblTitle('Distribuzione per Comune',M+half+4)
    y+=10

    const rptTblStyle={
      styles:{fontSize:7.5,cellPadding:1.5,textColor:[60,64,70],lineColor:[236,237,239],lineWidth:0.15},
      headStyles:{fillColor:[86,92,102],textColor:255,fontStyle:'bold',fontSize:7.6},
      alternateRowStyles:{fillColor:[248,248,249]}
    }
    doc.autoTable(Object.assign({},rptTblStyle,{
      startY:y,
      head:[['Qualifica','N.','%']],
      pageBreak:'avoid',
      body:qualList.map(([q,n])=>[q,n,nV?Math.round(n/nV*100)+'%':'–']),
      columnStyles:{1:{halign:'right',cellWidth:11,fontStyle:'bold'},2:{halign:'right',cellWidth:11,textColor:[138,144,153]}},
      margin:{left:M,right:M+half+4},
      tableWidth:half
    }))

    doc.autoTable(Object.assign({},rptTblStyle,{
      startY:y,
      head:[['Comune','Visite','%']],
      pageBreak:'avoid',
      body:comTop.slice(0,10).map(([c,n])=>[c,n,nV?Math.round(n/nV*100)+'%':'–']),
      columnStyles:{1:{halign:'right',cellWidth:13,fontStyle:'bold'},2:{halign:'right',cellWidth:11,textColor:[138,144,153]}},
      margin:{left:M+half+4,right:M},
      tableWidth:half
    }))

    footer(2)

    // ════ PAGINA 3 – Caratteristiche dei cantieri visitati ════
    doc.addPage()
    rptPageHeader(doc,'CARATTERISTICHE DEI CANTIERI E DELLE VISITE',dalFmt,alFmt,notaVecchio)
    y=28

    const impKeys=Object.keys(importoMap).map(Number).sort((a,b)=>a-b)
    if(impKeys.length){
      const impImg=rptBar({data:impKeys.map(k=>importoMap[k]),
        labels:impKeys.map(k=>_DASH_IMPORTO[k]||('Classe '+k)),
        title:'Importo lavori (€)',w:400,h:230})
      chartCard(impImg,M,y,half,58)
    }
    const lavKeys=Object.keys(lavMap).filter(k=>lavMap[k])
    if(lavKeys.length){
      const lavImg=rptBar({data:lavKeys.map(k=>lavMap[k]),labels:lavKeys,
        title:'Lavoratori rilevati in cantiere',w:400,h:230})
      chartCard(lavImg,M+half+4,y,half,58)
    }
    y+=60
    doc.setFontSize(8);doc.setFont('helvetica','italic');doc.setTextColor(138,144,153)
    doc.text('Media lavoratori per visita: '+lavMedia.toFixed(1)+' (su '+lavN+' visite con dato)',M+half+4+half/2,y+1,{align:'center'})
    doc.setTextColor(40,40,40);doc.setFont('helvetica','normal')
    y+=5

    const impPKeys=Object.keys(impMap).filter(k=>impMap[k])
    if(impPKeys.length){
      const ipImg=rptBar({data:impPKeys.map(k=>impMap[k]),labels:impPKeys,
        title:'Numero imprese presenti',w:400,h:200})
      chartCard(ipImg,M,y,half,52)
    }
    const indKeys=Object.keys(indMap).filter(k=>indMap[k])
    if(indKeys.length){
      const idImg=rptBar({data:indKeys.map(k=>indMap[k]),labels:indKeys,
        title:'Ditte individuali presenti',w:400,h:200})
      chartCard(idImg,M+half+4,y,half,52)
    }
    y+=56

    /* 30/09/2026: tolto il grafico «Tipologia di visita» che raggruppava i tipi di accesso (contava la
       programmata come «concordata con l'impresa», e serie, stage e asseverazione come «altro»):
       quello completo, voce per voce, è a pagina 1 */
    const ctKeys=Object.keys(commMap).filter(k=>commMap[k])
    if(ctKeys.length){
      const ctImg=rptDonut({data:ctKeys.map(k=>commMap[k]),labels:ctKeys,
        colors:ctKeys.map(k=>k==='Pubblico'?'#3498db':(k==='Privato'?'#e7500f':'#a9afb8')),
        title:'Tipologia di committente',w:400,h:280,maxLbl:30})
      chartCard(ctImg,M,y,half,66)
    }

    /* 19/10/2026, chiesto dall'utente: il grafico «IPC per n° accesso al cantiere» della pagina
       Statistiche anche nel report. Stesse classi (1°…4°, 5°+, non indicato) e stessi colori dell'IPC */
    const accIpc=rptIpcPerAccesso(visite)
    if(accIpc.length){
      const aiImg=rptStackedCols({cols:accIpc,title:'IPC per n° accesso al cantiere',
        segLabels:['Nessun Rilievo','Basso','Medio','Alto'],segColors:['#95C22F','#FFC000','#ED7D31','#E02B20'],w:400,h:280})
      chartCard(aiImg,M+half+4,y,half,66)
    }

    footer(3)

    // ════ PAGINA 4 – Analisi macro aree ════
    doc.addPage()
    rptPageHeader(doc,'ANALISI PER MACRO AREE DELLA CHECKLIST',dalFmt,alFmt,notaVecchio)
    y=28

    // Sintesi: verifiche totali, esiti conformi, rilievi
    let mTotVer=0,mTotOss=0,mTotNcm=0,mTotNcp=0
    for(let z=1;z<=10;z++){const d=macroData[z]||{ncp:0,ncm:0,oss:0,ver:0};mTotVer+=d.ver;mTotOss+=d.oss;mTotNcm+=d.ncm;mTotNcp+=d.ncp}
    const mTot=mTotVer+mTotOss+mTotNcm+mTotNcp
    const mRil=mTotOss+mTotNcm+mTotNcp
    const sk=[
      {v:mTot,l:'VOCI VERIFICATE',c:[86,92,102]},
      {v:mTotVer,l:'ESITI CONFORMI (VER)',c:[122,165,39]},
      {v:mTotOss,l:'OSSERVAZIONI',c:[217,164,0]},
      {v:mTotNcm,l:'NC-',c:[237,125,49]},
      {v:mTotNcp,l:'NC+',c:[224,43,32]},
      {v:mTot?Math.round(mRil/mTot*100)+'%':'–',l:'% VOCI CON RILIEVO',c:[231,80,15]}
    ]
    const sGap=3,sw=(CW-sGap*(sk.length-1))/sk.length
    sk.forEach((k,i)=>{
      const kx=M+i*(sw+sGap)
      card(kx,y,sw,19)
      doc.setFillColor(...k.c);doc.rect(kx,y+1.8,1.3,15.4,'F')
      doc.setFontSize(6);doc.setFont('helvetica','bold');doc.setTextColor(138,144,153)
      doc.text(k.l,kx+sw/2,y+5.7,{align:'center',maxWidth:sw-3})
      doc.setFontSize(13);doc.setTextColor(...k.c)
      doc.text(String(k.v),kx+sw/2,y+14.6,{align:'center'})
    })
    y+=23

    // Grafico: rilievi per macro area (NC+ / NC- / OSS impilati)
    const zRows=[]
    for(let z=1;z<=10;z++){
      const d=macroData[z]||{ncp:0,ncm:0,oss:0,ver:0}
      zRows.push({label:z+'. '+(ZONE_LBL[z]||('Zona '+z)),segs:[d.ncp,d.ncm,d.oss]})
    }
    const stackImg=rptStacked({
      rows:zRows,
      segColors:[CHK_COLORS.ncp,CHK_COLORS.ncm,CHK_COLORS.oss],
      segLabels:['NC+  non conformità rilevanti','NC-  non conformità lievi','OSS  osservazioni'],
      title:'Rilievi per macro area (NC+ / NC- / OSS)',
      w:640,h:290
    })
    chartCard(stackImg,M,y,CW,82)
    y+=86

    // Tabella riassuntiva
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(43,47,54)
    doc.text('Dettaglio per macro area',M,y+4)
    doc.setFillColor(231,80,15);doc.rect(M,y+6.2,11,0.9,'F')
    y+=10
    const zBody=[]
    for(let z=1;z<=10;z++){
      const d=macroData[z]||{ncp:0,ncm:0,oss:0,ver:0}
      const t=d.ncp+d.ncm+d.oss+d.ver
      const ril=d.ncp+d.ncm+d.oss
      zBody.push([z+'. '+(ZONE_LBL[z]||('Zona '+z)),t,d.ver,d.oss,d.ncm,d.ncp,t?Math.round(ril/t*100)+'%':'–'])
    }
    doc.autoTable(Object.assign({},rptTblStyle,{
      startY:y,
      head:[['Macro area','Verificate','VER','OSS','NC-','NC+','% rilievi']],
      pageBreak:'avoid',
      body:zBody,
      columnStyles:{
        1:{halign:'right',cellWidth:20},
        2:{halign:'right',cellWidth:18,textColor:[122,165,39]},
        3:{halign:'right',cellWidth:16,textColor:[188,142,0]},
        4:{halign:'right',cellWidth:16,textColor:[210,110,40]},
        5:{halign:'right',cellWidth:16,textColor:[224,43,32],fontStyle:'bold'},
        6:{halign:'right',cellWidth:18,fontStyle:'bold'}
      },
      margin:{left:M,right:M}
    }))
    doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(150,155,162)
    doc.text('VER = voce verificata conforme · OSS = osservazione · NC- = non conformità lieve · NC+ = non conformità rilevante. Voci "NA" escluse.',M,doc.lastAutoTable.finalY+4.5)

    footer(4)

    // ════ PAGINA 5 – IPC per macro area: una torta per area, come nel foglio Google ════
    doc.addPage()
    rptPageHeader(doc,'INDICE DI PERICOLOSIT\u00c0 PER MACRO AREA',dalFmt,alFmt,notaVecchio)
    y=28
    // criteri di giudizio, gli stessi dell'IPC generale applicati ai rilievi della singola area
    const crit=[
      {l:'NESSUN RILIEVO',t:'solo voci conformi',c:[122,165,39]},
      {l:'BASSO',t:'da 1 a 6 osservazioni',c:[217,164,0]},
      {l:'MEDIO',t:'pi\u00f9 di 6 osservazioni e/o da 1 a 3 NC-',c:[237,125,49]},
      {l:'ALTO',t:'pi\u00f9 di 3 NC- e/o almeno una NC+',c:[224,43,32]}
    ]
    const cGap=3,cw=(CW-cGap*(crit.length-1))/crit.length
    crit.forEach((k,i)=>{
      const kx=M+i*(cw+cGap)
      card(kx,y,cw,12.5)
      doc.setFillColor(...k.c);doc.rect(kx,y+1.8,1.3,8.9,'F')
      doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(...k.c)
      doc.text(k.l,kx+4,y+5)
      doc.setFontSize(6.6);doc.setFont('helvetica','normal');doc.setTextColor(86,92,102)
      doc.text(k.t,kx+4,y+9.6,{maxWidth:cw-6})
    })
    y+=15.5
    doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(150,155,162)
    doc.text('Ogni grafico conta le visite in cui l\u2019area \u00e8 stata valutata (almeno una voce diversa da \u00abnon applicabile\u00bb): il loro numero \u00e8 al centro.',M,y)
    y+=3
    {
      const ipcH=45,ipcGap=2.8
      for(let z=1;z<=10;z++){
        const d=ipcMacro[z]||{ALTO:0,MEDIO:0,BASSO:0,NR:0}
        const img=rptDonut({
          data:[d.ALTO,d.MEDIO,d.BASSO,d.NR],
          labels:['Alto','Medio','Basso','Nessun Rilievo'],
          colors:['#E02B20','#ED7D31','#FFC000','#95C22F'],
          title:String(z).padStart(2,'0')+'  '+(ZONE_LBL[z]||('Zona '+z)),w:430,h:200
        })
        const col=(z-1)%2,row=Math.floor((z-1)/2)
        chartCard(img,M+col*(half+4),y+row*(ipcH+ipcGap),half,ipcH)
      }
    }

    footer(5)

    // ════ PAGINA 6 – IPC: andamento, iscrizione alla Cassa, inadempienze più frequenti (19/10/2026) ════
    doc.addPage()
    rptPageHeader(doc,'IPC NEL TEMPO, CASSA EDILE, INADEMPIENZE',dalFmt,alFmt,notaVecchio)
    y=28
    const ipcNorm=v=>(['ALTO','MEDIO','BASSO'].indexOf(v.ipc)>=0?v.ipc:'NR')
    const ipcColori=['#95C22F','#FFC000','#ED7D31','#E02B20'],ipcEtich=['Nessun Rilievo','Basso','Medio','Alto']
    const meseLbl=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
    const andam=ipcPerMese(visite.map(v=>({data:v.data_visita,ipc:ipcNorm(v)})))
    if(andam.length){
      const anImg=rptStackedCols({cols:andam.map(x=>{const q=x.mese.split('-');return{label:meseLbl[+q[1]-1]+' '+q[0].slice(2),segs:[x.NR,x.BASSO,x.MEDIO,x.ALTO],nota:x.pctAM+'%'}}),
        title:'Andamento dell\u2019IPC mese per mese (sotto ogni mese: % di visite con IPC alto + medio)',segLabels:ipcEtich,segColors:ipcColori,w:640,h:230})
      chartCard(anImg,M,y,CW,66);y+=70
    }
    const perCassa=ipcPerCeiv(visite.map(v=>({ceiv:ceivStatVisita(v.visite_cassa_foto,v.impresa_id,v.imprese),ipc:ipcNorm(v)})))
    if(perCassa.length){
      const pcImg=rptPercentBars({rows:perCassa.map(x=>({label:_maiuscola(x.classe.replace('C.E.I.V. \u2013 ',''))+' ('+x.n+')',segs:[x.NR,x.BASSO,x.MEDIO,x.ALTO],nota:'alto+medio '+x.pctAM+'%'})),
        title:'IPC secondo l\u2019iscrizione alla Cassa Edile dell\u2019impresa ('+ceivNotaRpt+')',segLabels:ipcEtich,segColors:ipcColori,w:640,h:125})
      chartCard(pcImg,M,y,CW,37);y+=41
    }
    /* gradimento delle visite (19/10/2026): solo totali, dalla stessa funzione della pagina Statistiche.
       Sono numeri che diventano ufficiali: se la lettura fallisce il report non esce */
    const{data:gradRaw,error:eGrad}=await sb.rpc('dash_questionari',{p_da:dal,p_a:al,p_tecnico:null,p_tipo:null,p_ipc:null})
    if(eGrad)throw new Error('non sono riuscito a leggere i questionari di gradimento ('+eGrad.message+'): il report non e\u2019 stato generato')
    const grad=gradimentoDati(gradRaw)
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(43,47,54)
    doc.text('Gradimento delle visite (questionari del portale)',M,y+4)
    doc.setFillColor(231,80,15);doc.rect(M,y+6.2,11,0.9,'F')
    doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(86,92,102)
    doc.text(grad.testo+(grad.pochi?' \u2014 sono pochi: i numeri dicono ancora poco.':''),M,y+11,{maxWidth:CW})
    y+=14
    if(grad.ricevuti){
      const guImg=rptBar({data:grad.utilita,labels:GRAD_UTILITA,colors:['#E02B20','#ED7D31','#FFC000','#95C22F','#5f8f14'],title:'Quanto \u00e8 stata utile la visita',w:400,h:175})
      chartCard(guImg,M,y,half,40)
      if(grad.motivi.length){
        const gmImg=rptBar({data:grad.motivi.map(x=>x.n),labels:grad.motivi.map(x=>x.label),colors:grad.motivi.map(x=>x.positivo===false?'#E02B20':'#95C22F'),title:'Che cosa ha contato (verde: servito \u00b7 rosso: non ha funzionato)',w:400,h:175})
        chartCard(gmImg,M+half+4,y,half,40)
      }
      y+=44
    }
    const voceInfo={};(voceRows||[]).forEach(v=>{voceInfo[v.codice]={descrizione:v.descrizione,zona:v.zona_osserv}})
    const topVoci=rptVociNc(chkAll,voceInfo,10)
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(43,47,54)
    doc.text('Le inadempienze pi\u00f9 frequenti',M,y+4)
    doc.setFillColor(231,80,15);doc.rect(M,y+6.2,11,0.9,'F')
    y+=10
    doc.autoTable(Object.assign({},rptTblStyle,{
      startY:y,
      head:[['#','Voce della check-list','Macro area','NC+','NC-','Visite']],
      pageBreak:'avoid',
      body:topVoci.length?topVoci.map((r,i)=>[i+1,r.descrizione,(r.zona&&ZONE_LBL[r.zona])||'',r.ncp,r.ncm,r.visite]):[['','Nessuna voce con NC+ o NC- nel periodo','','','','']],
      columnStyles:{0:{cellWidth:8,halign:'right'},3:{halign:'right',cellWidth:14,textColor:[224,43,32],fontStyle:'bold'},4:{halign:'right',cellWidth:14,textColor:[210,110,40]},5:{halign:'right',cellWidth:16}},
      margin:{left:M,right:M}
    }))
    doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(150,155,162)
    doc.text('NC+ = non conformit\u00e0 rilevante \u00b7 NC- = non conformit\u00e0 lieve \u00b7 Visite = visite in cui la voce \u00e8 risultata non conforme.',M,doc.lastAutoTable.finalY+4.5)
    footer(6)

    // ── Salva ──
    const fname=`Report_Visite_${dal}_${al}${vecchio?'_vecchio-parametro':''}.pdf`
    doc.save(fname)
    toast(`Report PDF generato: ${fname}`,'ok')
    const manca=vecchio?'':datiCantiereMancanti(visite.map(v=>({c:v.cantieri})))
    if(manca)toast('Schede dei cantieri incomplete (numero di visite): '+manca+'. Nel report sono «non disponibile», come risulteranno all\u2019Osservatorio.','warn',15000)

  }catch(e){
    console.error('admGeneraReport:',e)
    toast('Errore generazione report: '+(e.message||e),'err')
  }
}

window.admGeneraReport = admGeneraReport
}
