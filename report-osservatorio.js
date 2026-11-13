/* ============================================================
   Report Osservatorio: il PDF che replica il «REPORT ATTIVITA'» dell'Osservatorio
   nazionale delle visite in cantiere (pulsante «📑 Report Osservatorio» della Zona
   Segreteria, funzione admGeneraReportOsservatorio).

   TERZO MODULO ESTRATTO DAL FILE CENTRALE index.html (13/11/2026, revisione di
   tenuta), dopo osservatorio.js ed esportazioni.js. Il codice è lo stesso che stava
   fra «REPORT OSSERVATORIO – REPLICA FEDELE» e osSetAnnoEdile: nessuna riga è
   cambiata. Vive dentro una fabbrica che riceve dal modulo inline le sole cose di
   cui ha bisogno: se manca una dipendenza si vede alla prima chiamata.

   Chi lo usa (index.html):
     import { creaReportOsservatorio } from './report-osservatorio.js'
     creaReportOsservatorio({ $, sb, S, ADMIN_EMAIL, toast, datiCantiereStat, datiCantiereMancanti, NOTA_VECCHIO_PARAMETRO })
   Non restituisce niente: mette window.admGeneraReportOsservatorio.

   Dai globali della pagina usa: jspdf, e da app-data.js le tabelle OS_* (OS_MESI,
   OS_ZP, OS_SUB …) e la veste OX* (OXBRAND, OXC, OXD, OXT).
   La regola dei dati del cantiere resta una sola e resta in index.html
   (datiCantiereStat, datiCantiereMancanti, NOTA_VECCHIO_PARAMETRO): qui arriva da fuori.
   ⚠️ Un file nuovo va aggiunto alle due liste di .github/workflows/deploy-pages.yml
   (paths e copia in _site): senza, non viene pubblicato.
   ============================================================ */
export function creaReportOsservatorio({ $, sb, S, ADMIN_EMAIL, toast, datiCantiereStat, datiCantiereMancanti, NOTA_VECCHIO_PARAMETRO }) {
// ══════════════════════════════════════════════════════════════════
// REPORT OSSERVATORIO – REPLICA FEDELE 1:1 (19 pagine)
// Riproduce il "REPORT ATTIVITA'" dell'Osservatorio Visite Cantiere:
// copertina, quadro di sintesi, e per ogni dimensione (Importo lavori,
// Tipo intervento, Tipo opera, Tipo committente, Tipo visita, Ruolo
// impresa) le schede mensile / per-area / matrice prima-ultima visita.
// ══════════════════════════════════════════════════════════════════

// Mappa prefisso codice checklist → zona osservatorio (1-10)
// ══════════════════════════════════════════════════════════════
// ── REPORT OSSERVATORIO CNCPT — replica 1:1 del "REPORT ATTIVITA'" ──
// Layout, ordine, criteri e tipi di grafico identici al report
// nazionale (admin_CPT_paXXX): quadro di sintesi (schede 1 e 3),
// poi 4 dimensioni con 3 schede + 2 dimensioni con 2 schede.
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// ── REPORT OSSERVATORIO — replica 1:1 del "REPORT ATTIVITA'" ──
// Struttura, ordine, criteri e tipi di grafico identici al report
// nazionale CNCPT; veste grafica brand Formedil (cfr. Formedil Venezia).
// ══════════════════════════════════════════════════════════════
function osMeseEdile(m0){return (m0>=9)?(m0-9):(m0+3)}
// Aggregazione codici importo 1-11 → 5 classi del report + nd
function osImportoClass(code){
  code=parseInt(code,10)
  if(!code||code===11)return 0
  if(code===1)return 1
  if(code===2)return 2
  if(code<=4)return 3
  if(code<=7)return 4
  return 5
}
// ── formattazioni ──
function oxIt(n,d){return (n==null||isNaN(n))?'':Number(n).toFixed(d==null?1:d).replace('.',',')}
function oxPct(n){return oxIt(n,1)}
function oxN(n){return n?String(n):''}

// ── palette brand Formedil ──

// ── definizione dimensioni di analisi (ordine identico all'originale) ──
// mappatura categorie report ← codifiche Osservatorio
function oxCatOf(v,c,ruolo,vecchio){
  /* 01/10/2026 (deciso dall'utente): importo, intervento, opera e committente sono quelli della scheda
     del cantiere, come nel modello nazionale e nel file che va all'Osservatorio (datiCantiereStat).
     vecchio=true: il dichiarato in ogni visita, per ristampare il report com'era. */
  const dc=datiCantiereStat(v,v.cantieri,vecchio)
  const ti=parseInt(dc.tipint,10)||0
  const to=parseInt(dc.tipope,10)||0
  const tipope=(to===2)?1:([1,3,6,14,15].includes(to)?2:([5,9,10,11].includes(to)?3:(to===4?4:(to===8?5:(to>0?6:0)))))
  const ct=parseInt(dc.commtipo,10)||0
  // il report dell'Osservatorio usa il tipo di visita nazionale, come l'esportazione (30/09/2026)
  const ta=parseInt(v.tipo_accesso_naz!=null?v.tipo_accesso_naz:v.tipo_accesso,10)||0
  return{
    importo:osImportoClass(dc.importo),
    tipint:[1,2,3,4,6,7,8].includes(ti)?ti:0,
    tipope:tipope,
    commtipo:(ct===1||ct===2)?ct:0,
    tipvisita:[1,3,4,7].includes(ta)?1:([2,5,6].includes(ta)?2:0),
    ruolo:[1,2,3].includes(ruolo)?ruolo:0
  }
}

/* 01/10/2026 — Tre calcoli riallineati al modello nazionale (report di Formedil Venezia 2024-25).
   1. Ruolo dell'impresa: si legge il ruolo scritto per esteso, nella scala a tre valori dell'Osservatorio
      (subappaltatrice, autonomo e fornitrice confluiscono in «esecutrice», come nell'XML). Il codice
      tipo_imp e' solo la riserva: le importazioni l'avevano scritto con significati diversi.
   2. Visite secondo l'esito: «presenza NC-» e «presenza NC+» contano ogni visita che ne ha almeno una,
      quindi una visita con entrambe sta in tutte e due le colonne (a Venezia la somma fa 756 su 627 visite).
   3. Frequenza visite stesso cantiere/impresa: l'ordine della visita si conta su TUTTA la storia del
      cantiere con quell'impresa, non nel solo periodo (a Venezia le prime visite sono 432 su 477 cantieri:
      contando nel periodo sarebbe impossibile). */
const OX_RUOLO_NAZ={'affidataria':1,'affidataria ed esecutrice':2,'esecutrice':3,'subappaltatrice':3,'lavoratore autonomo':3,'fornitrice':3}
function oxRuoloNaz(r){
  const t=String((r&&r.ruolo)||'').trim().toLowerCase()
  if(OX_RUOLO_NAZ[t])return OX_RUOLO_NAZ[t]
  const k=parseInt(r&&r.tipo_imp,10)||0
  return k>=3?3:k
}
// V: visite con ncp, ncm, oss → [nessuna OSS e/o NC, presenza solo OSS, presenza NC-, presenza NC+]
function oxEsitiVisite(V){
  const e=[0,0,0,0]
  ;(V||[]).forEach(v=>{
    if(v.ncp>0)e[3]++
    if(v.ncm>0)e[2]++
    if(!(v.ncp>0)&&!(v.ncm>0)){if(v.oss>0)e[1]++;else e[0]++}
  })
  return e
}
// righe {visita_id,data_visita,cantiere_id,impresa_id} di tutta la storia → {visita_id: ordine da 0}
function oxOrdineStoria(righe){
  const g={}
  ;(righe||[]).forEach(r=>{
    const k=(r.cantiere_id||r.visita_id)+'|'+(r.impresa_id||'')
    ;(g[k]=g[k]||[]).push(r)
  })
  const ord={}
  Object.values(g).forEach(a=>{
    a.sort((x,y)=>(x.data_visita||'').localeCompare(y.data_visita||'')||String(x.visita_id).localeCompare(String(y.visita_id)))
    a.forEach((r,i)=>{ord[r.visita_id]=i})
  })
  return ord
}

// ══════════ GRAFICI CANVAS ══════════
// Disegno a OXK px per mm (con supersampling OXSS): font in px coerenti.
const OXK=4
const OXSS=3   // supersampling grafici Osservatorio (era 2): ~300 dpi in stampa
function oxCv(w,h){
  const c=document.createElement('canvas')
  c.width=Math.round(w*OXK*OXSS);c.height=Math.round(h*OXK*OXSS)
  const g=c.getContext('2d');g.scale(OXSS,OXSS)
  const W=w*OXK,H=h*OXK
  g.fillStyle='#fff';g.fillRect(0,0,W,H)
  g.strokeStyle='#d4d7db';g.lineWidth=1;g.strokeRect(.5,.5,W-1,H-1)
  return[c,g,W,H]
}
function oxNice(m){
  if(m<=0)return 1
  const p=Math.pow(10,Math.floor(Math.log10(m)))
  const f=m/p
  const n=f<=1?1:f<=2?2:f<=2.5?2.5:f<=4?4:f<=5?5:f<=8?8:10
  return n*p
}
function oxWrapTxt(g,t,maxW,maxLines){
  // spezza prima sugli spazi; le parole piu' lunghe dello spazio disponibile
  // vengono divise carattere per carattere (con trattino) per non uscire dal riquadro
  const raw=String(t).split(' ')
  const words=[]
  raw.forEach(w=>{
    if(g.measureText(w).width<=maxW){words.push(w);return}
    let cur=''
    for(const ch of w){
      if(g.measureText(cur+ch+'-').width>maxW&&cur){words.push(cur+'-');cur=ch}
      else cur+=ch
    }
    if(cur)words.push(cur)
  })
  const lines=[]
  let cur=''
  words.forEach(w=>{
    const brk=cur.endsWith('-')
    const test=brk?cur+w:(cur?cur+' '+w:w)
    if(brk||(g.measureText(test).width>maxW&&cur)){
      if(brk){lines.push(cur);cur=w}else{lines.push(cur);cur=w}
    }else cur=test
  })
  if(cur)lines.push(cur)
  const max=maxLines||2
  if(lines.length>max){
    const out=lines.slice(0,max)
    let last=out[max-1]
    while(last.length>1&&g.measureText(last+'\u2026').width>maxW)last=last.slice(0,-1)
    out[max-1]=last+'\u2026'
    return out
  }
  return lines
}
// grafico a barre raggruppate (serie multiple, etichette valori, linea opzionale)
function oxBars(o){
  const[c,g,W,H]=oxCv(o.w,o.h)
  const F=o.fontScale||1
  let top=8
  if(o.title){
    g.fillStyle=OXC.gr;g.font='bold '+Math.round(12*F)+'px Helvetica,Arial';g.textAlign='center'
    g.fillText(o.title,W/2,16)
    top=26
  }
  const catFont=Math.round((o.catFont||8.5)*F)
  const catLines=o.catLines||2
  const legB=o.legend==='bottom'?18:0
  const legR=o.legend==='right'?Math.min(120,W*.3):0
  const padL=34,padR=8+legR
  const padB=6+catLines*(catFont+2)+legB
  const px=padL,pw=W-padL-padR,py=top,ph=H-top-padB
  const ser=o.series
  let max=0
  if(o.stacked){for(let i=0;i<o.cats.length;i++){let t=0;ser.forEach(s=>{t+=s.data[i]||0});if(t>max)max=t}}
  else ser.forEach(s=>s.data.forEach(v=>{if(v>max)max=v}))
  /* la linea ha una scala sua, come l'asse secondario del modello: sulla scala delle barre (centinaia
     di visite) una media di 5-15 verifiche restava schiacciata sul fondo e non si leggeva */
  let lmax=0
  if(o.lineData)o.lineData.forEach(v=>{if(v!=null&&v>lmax)lmax=v})
  lmax=oxNice(lmax||1)
  const ymax=oxNice(max||1)
  // griglia + asse Y
  g.strokeStyle='#e2e4e7';g.lineWidth=1
  g.fillStyle='#8a8f96';g.font=Math.round(8.5*F)+'px Helvetica,Arial';g.textAlign='right'
  const steps=4
  for(let i=0;i<=steps;i++){
    const yy=py+ph-ph*i/steps
    g.beginPath();g.moveTo(px,yy);g.lineTo(px+pw,yy);g.stroke()
    const val=ymax*i/steps
    g.fillText(o.fmtAxis?o.fmtAxis(val):(val%1?oxIt(val,1):String(val)),px-4,yy+3)
  }
  const n=o.cats.length,k=ser.length
  const slot=pw/n,grpW=slot*(o.stacked?.5:.72),bw=o.stacked?grpW:grpW/k
  for(let i=0;i<n;i++){
    let base=0
    for(let j=0;j<k;j++){
      const v=ser[j].data[i]||0
      const bh=ymax?v/ymax*ph:0
      const x=px+i*slot+(slot-grpW)/2+(o.stacked?0:j*bw)
      const col=(ser[j].colors&&ser[j].colors[i])||ser[j].color
      g.fillStyle=col
      if(bh>0)g.fillRect(x,py+ph-base-bh,Math.max(bw-2,2),bh)
      if(o.stacked)base+=bh
      if(o.labels!==false){
        const lbl=o.fmt?o.fmt(v):(v?String(v):(o.zeroLbl||''))
        if(lbl!==''){
          g.fillStyle='#4a4f57';g.font=Math.round(8.5*F)+'px Helvetica,Arial';g.textAlign='center'
          g.fillText(lbl,x+bw/2,py+ph-bh-3)
        }
      }
    }
    // corpo adattivo: se lo slot e' stretto rimpicciolisco l'etichetta (min 5px)
    let cf=catFont
    g.font=cf+'px Helvetica,Arial'
    const longest=String(o.cats[i]).split(' ').reduce((a,w)=>g.measureText(w).width>g.measureText(a).width?w:a,'')
    while(cf>5&&g.measureText(longest).width>slot-4){cf--;g.font=cf+'px Helvetica,Arial'}
    g.fillStyle=OXC.gr;g.textAlign='center'
    oxWrapTxt(g,o.cats[i],slot-4,catLines).forEach((ln,li)=>{
      g.fillText(ln,px+i*slot+slot/2,py+ph+cf+3+li*(cf+2))
    })
  }
  // linea di tendenza
  if(o.lineData){
    g.strokeStyle=o.lineColor||OXC.ncp;g.lineWidth=2;g.beginPath()
    let started=false
    for(let i=0;i<n;i++){
      const v=o.lineData[i]
      if(v==null)continue
      const x=px+i*slot+slot/2,y=py+ph-(v/lmax*ph)
      if(!started){g.moveTo(x,y);started=true}else g.lineTo(x,y)
    }
    g.stroke()
  }
  // legenda
  const sq=Math.round(8*F)
  if(o.legend==='bottom'){
    g.font=Math.round(9*F)+'px Helvetica,Arial';g.textAlign='left'
    let tot=0;ser.forEach(s=>tot+=g.measureText(s.label).width+sq+16)
    let lx=(W-tot)/2
    ser.forEach(s=>{
      g.fillStyle=s.color;g.fillRect(lx,H-sq-6,sq,sq)
      g.fillStyle=OXC.gr;g.fillText(s.label,lx+sq+3,H-7)
      lx+=g.measureText(s.label).width+sq+16
    })
  }else if(o.legend==='right'){
    g.font=Math.round(9*F)+'px Helvetica,Arial';g.textAlign='left'
    let ly=top+6
    ser.forEach(s=>{
      g.fillStyle=s.color;g.fillRect(W-legR+4,ly,sq,sq)
      g.fillStyle=OXC.gr;g.fillText(s.label,W-legR+sq+7,ly+sq-1)
      ly+=sq+6
    })
  }
  return c.toDataURL('image/png')
}
// torta 3D (stile report originale, colori Formedil)
function oxPie3D(o){
  const[c,g,W,H]=oxCv(o.w,o.h)
  let top=4
  if(o.title){
    g.fillStyle=OXC.gr;g.font='bold 11px Helvetica,Arial';g.textAlign='center'
    g.fillText(o.title,W/2,14);top=20
  }
  const legW=o.noLegend?0:Math.min(W*.42,150)
  const tot=o.data.reduce((s,x)=>s+(x||0),0)
  const cx=(W-legW)/2,cy=top+(H-top)/2-5
  const rx=Math.min((W-legW)/2-16,(H-top)/2-16),ry=rx*.5,dp=Math.max(rx*.2,8)
  function shade(hex,f){
    const r=parseInt(hex.slice(1,3),16),gg=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
    return'rgb('+Math.round(r*f)+','+Math.round(gg*f)+','+Math.round(b*f)+')'
  }
  if(tot>0&&rx>10){
    let a0=-Math.PI/2
    const segs=o.data.map((v,i)=>{
      const a1=a0+(v||0)/tot*Math.PI*2
      const s={v:v||0,a0:a0,a1:a1,col:o.colors[i%o.colors.length]}
      a0=a1;return s
    })
    segs.forEach(s=>{
      const f0=Math.max(s.a0,0),f1=Math.min(s.a1,Math.PI)
      if(f1<=f0||s.v===0)return
      g.fillStyle=shade(s.col,.72)
      g.beginPath()
      g.ellipse(cx,cy,rx,ry,0,f0,f1)
      g.ellipse(cx,cy+dp,rx,ry,0,f1,f0,true)
      g.closePath();g.fill()
    })
    segs.forEach(s=>{
      if(s.v===0)return
      g.fillStyle=s.col;g.strokeStyle='#fff';g.lineWidth=1.2
      g.beginPath();g.moveTo(cx,cy)
      g.ellipse(cx,cy,rx,ry,0,s.a0,s.a1)
      g.closePath();g.fill();g.stroke()
    })
    g.font='9px Helvetica,Arial';g.textAlign='center'
    segs.forEach(s=>{
      if(s.v===0)return
      const frac=(s.a1-s.a0)/(Math.PI*2)
      if(frac<0.03)return
      const am=(s.a0+s.a1)/2
      const lx=cx+Math.cos(am)*rx*.62,ly=cy+Math.sin(am)*ry*.62
      g.fillStyle=o.lblColor||'#fff'
      g.fillText(o.fmt?o.fmt(s.v):String(s.v),lx,ly+3)
    })
  }else{
    g.fillStyle='#999';g.font='10px Helvetica,Arial';g.textAlign='center'
    g.fillText('n.d.',cx,cy)
  }
  // legenda a destra
  g.font='8.5px Helvetica,Arial';g.textAlign='left'
  let ly=top+8
  ;(o.noLegend?[]:o.labels).forEach((lb,i)=>{
    if(ly>H-6)return
    g.fillStyle=o.colors[i%o.colors.length];g.fillRect(W-legW+4,ly-7,8,8)
    g.fillStyle=OXC.gr
    const lines=oxWrapTxt(g,lb,legW-20,2)
    lines.forEach((ln,li)=>g.fillText(ln,W-legW+16,ly+li*10))
    ly+=Math.max(13,lines.length*10+4)
  })
  return c.toDataURL('image/png')
}
// mini-grafico scheda 2: barre verdi + linea rossa di tendenza
function oxMiniCombo(o){
  return oxBars({w:o.w,h:o.h,title:o.title,cats:o.cats,
    series:[{label:'',color:OXC.ve,data:o.bars}],
    lineData:o.line,lineColor:OXC.ncp,labels:false,
    fontScale:.82,catFont:7,catLines:2})
}
// mini-grafico NC+/NC- (rosso/giallo) con legenda
function oxMiniNC(o){
  return oxBars({w:o.w,h:o.h,title:o.title,cats:o.cats,
    series:[{label:'NC+',color:OXC.ncp,data:o.ncp},{label:'NC-',color:OXC.ncm,data:o.ncm}],
    legend:'right',labels:false,
    fontScale:.82,catFont:7,catLines:2})
}

// ══════════ ELEMENTI PDF (brand Formedil) ══════════
function oxHeader(doc,anno,titolo){
  doc.setFillColor(OXBRAND[0],OXBRAND[1],OXBRAND[2])
  doc.rect(10,6,190,4.6,'F')
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(6.2)
  doc.text('FORMEDIL PADOVA',12,9.2)
  doc.setFillColor(OXBRAND[0],OXBRAND[1],OXBRAND[2])
  doc.rect(10,13,190,8,'F')
  doc.setFontSize(11)
  doc.text(titolo,12,18.4)
  doc.setFontSize(9)
  doc.text(anno,198,18.4,{align:'right'})
}
// testo scritto in fondo a ogni pagina quando il report e' stampato col vecchio parametro (vedi datiCantiereStat)
let _oxNotaVecchio=''
function oxFooter(doc,pg){
  doc.setFillColor(OXBRAND[0],OXBRAND[1],OXBRAND[2])
  doc.rect(10,282,190,4,'F')
  doc.setTextColor(130,130,130);doc.setFont('helvetica','normal');doc.setFontSize(7)
  doc.text('Pagina '+pg,105,291.5,{align:'center'})
  if(_oxNotaVecchio){doc.setFontSize(6);doc.setFont('helvetica','bold');doc.setTextColor(196,63,10);doc.text(_oxNotaVecchio,105,294.6,{align:'center'});doc.setFont('helvetica','normal')}
}
function oxSec(doc,txt,y,sub){
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(86,92,102)
  doc.text(txt,12,y)
  if(sub){
    const wT=doc.getTextWidth(txt)
    doc.setFont('helvetica','italic');doc.setFontSize(6.8);doc.setTextColor(120,125,132)
    doc.text(' '+sub,12+wT,y)
  }
}
function oxNote(doc,y){
  doc.setFont('helvetica','bolditalic');doc.setFontSize(6.2);doc.setTextColor(86,92,102)
  doc.text("* alcuni enti registrano esclusivamente le verifiche con osservazioni o inadempienze. In questo caso l'universo delle verifiche a fini statistici non corrisponde a quello effettivamente analizzato durante la visita.",12,y,{maxWidth:186})
}
function oxTbl(doc,opt){
  const base={
    theme:'plain',
    styles:{font:'helvetica',fontSize:6,cellPadding:{top:.7,bottom:.7,left:1,right:1},textColor:[60,65,72],fillColor:[255,255,255],halign:'center'},
    headStyles:{fillColor:OXT.hdrF,textColor:OXT.hdrT,fontStyle:'bold',halign:'center',fontSize:5.8},
    alternateRowStyles:{fillColor:OXT.alt},
    margin:{left:12,right:12}
  }
  doc.autoTable(Object.assign({},base,opt,{
    styles:Object.assign({},base.styles,opt.styles||{}),
    headStyles:Object.assign({},base.headStyles,opt.headStyles||{})
  }))
}

// ══════════ FUNZIONE PRINCIPALE ══════════
async function admGeneraReportOsservatorio(){
  if(!S.user||S.user.email!==ADMIN_EMAIL){toast('Accesso negato','err');return}
  const dal=($('sgr-dal')?.value)||''
  const al=($('sgr-al')?.value)||''
  if(!dal||!al){toast('Seleziona entrambe le date prima di generare il report','err');return}
  // stampa col vecchio parametro (dichiarato in ogni visita): vedi datiCantiereStat
  const vecchio=!!($('sgr-vecchio')&&$('sgr-vecchio').checked)
  _oxNotaVecchio=vecchio?NOTA_VECCHIO_PARAMETRO:''
  toast('Elaborazione report Osservatorio in corso…','ok')
  try{
    // ── 1. visite + cantiere/committente ──
    const visite=[]
    for(let from=0;;from+=1000){
      const{data:b,error:e1}=await sb.from('visite').select([
        'visita_id','data_visita','cantiere_id','impresa_id','comm_tipo','tipo_accesso','tipo_accesso_naz',
        'vis_tip_int','vis_tip_ope','vis_importo',
        'cantieri(cantiere_tip_int,cantiere_tip_ope,cantiere_importo,cantiere_durata,cantiere_committente_id,committenti(committente_tipo))'
      ].join(',')).gte('data_visita',dal).lte('data_visita',al).eq('elimina',0)
        .order('visita_id').range(from,from+999)
      if(e1)throw e1
      if(b&&b.length)visite.push(...b)
      if(!b||b.length<1000)break
    }
    if(!visite||!visite.length){toast('Nessuna visita nel periodo selezionato','warn');return}
    const vids=visite.map(v=>v.visita_id)

    // ── 2. voci checklist: zona + verifiche potenziali ──
    const{data:voci,error:eVoci}=await sb.from('checklist_voci').select('codice,zona_osserv,is_nota,prefisso')
    if(eVoci)throw eVoci
    /* 01/10/2026: la sottoarea e' il prefisso della voce (prima si ricavava spezzando il codice, e
       «DOC_GEN_SOL» finiva dentro «Generale»); le verifiche potenziali sono quelle nazionali */
    const cod2zona={},cod2sub={},zonaPot=Object.assign({},OS_POT_NAZ)
    ;(voci||[]).forEach(v=>{
      if(!v.codice)return
      const z=v.zona_osserv||OS_ZP[v.codice.substring(0,3).toUpperCase()]
      if(!z)return
      cod2zona[v.codice]=z
      if(v.prefisso)cod2sub[v.codice]=OS_SUB_ALIAS[v.prefisso]||v.prefisso
    })

    // ── 3. esiti checklist per visita ──
    const chk=[]
    for(let i=0;i<vids.length;i+=100){
      const ids=vids.slice(i,i+100)
      for(let from=0;;from+=1000){
        const{data:b,error:e2}=await sb.from('visite_checklist').select('visita_id,codice,valore')
          .in('visita_id',ids).order('id').range(from,from+999)
        if(e2)throw e2
        if(b&&b.length)chk.push(...b)
        if(!b||b.length<1000)break
      }
    }
    const RANK={VER:0,OSS:1,'NC-':2,'NC+':3}

    // ── 4. ruolo impresa principale per visita ──
    const ruoloByVis={}
    for(let i=0;i<vids.length;i+=100){
      const b=[]
      for(let from=0;;from+=1000){
        const{data:bb,error:e3}=await sb.from('visite_imprese_presenti').select('visita_id,tipo_imp,ruolo,is_principale')
          .in('visita_id',vids.slice(i,i+100)).order('id').range(from,from+999)
        if(e3)throw e3
        if(bb&&bb.length)b.push(...bb)
        if(!bb||bb.length<1000)break
      }
      ;(b||[]).forEach(r=>{
        if(ruoloByVis[r.visita_id]===undefined||r.is_principale)ruoloByVis[r.visita_id]=oxRuoloNaz(r)
      })
    }

    // ── 4b. ordine di ogni visita nella storia del cantiere con quell'impresa (fino alla fine del periodo) ──
    const storia=[]
    for(let from=0;;from+=1000){
      const{data:b,error:e4}=await sb.from('visite').select('visita_id,data_visita,cantiere_id,impresa_id')
        .lte('data_visita',al).eq('elimina',0).order('visita_id').range(from,from+999)
      if(e4)throw e4
      if(b&&b.length)storia.push(...b)
      if(!b||b.length<1000)break
    }
    const ordStoria=oxOrdineStoria(storia)

    // ── 5. pre-elaborazione per visita ──
    const zoneByVis={},subByVis={},codByVis={}
    chk.forEach(({visita_id,codice,valore})=>{
      if(!codice||valore==null)return
      const r=RANK[valore]
      if(r===undefined)return // esclude NA e note
      const z=cod2zona[codice]||OS_ZP[codice.substring(0,3).toUpperCase()]
      if(!z)return
      const zo=(zoneByVis[visita_id]=zoneByVis[visita_id]||{})
      const zz=(zo[z]=zo[z]||{ver:0,oss:0,ncm:0,ncp:0})
      const subKey=cod2sub[codice]||codice.split('_').slice(0,2).join('_')
      const so=(subByVis[visita_id]=subByVis[visita_id]||{})
      const ss=(so[subKey]=so[subKey]||{ver:0,oss:0,ncm:0,ncp:0,zona:z})
      if(r===0){zz.ver++;ss.ver++}else if(r===1){zz.oss++;ss.oss++}else if(r===2){zz.ncm++;ss.ncm++}else{zz.ncp++;ss.ncp++}
      const cm=(codByVis[visita_id]=codByVis[visita_id]||{})
      cm[codice]=Math.max(cm[codice]===undefined?-1:cm[codice],r)
    })

    const V=visite.map(v=>{
      const c=v.cantieri||{}
      const m0=v.data_visita?parseInt(v.data_visita.split('-')[1],10)-1:null
      const z=zoneByVis[v.visita_id]||{}
      let ncp=0,ncm=0,oss=0,ver=0
      Object.values(z).forEach(o=>{ncp+=o.ncp;ncm+=o.ncm;oss+=o.oss;ver+=o.ver})
      return{
        id:v.visita_id,data:v.data_visita,mese:m0==null?null:osMeseEdile(m0),
        cant:v.cantiere_id||v.visita_id,
        grp:(v.cantiere_id||v.visita_id)+'|'+(v.impresa_id||''),
        cat:oxCatOf(v,c,ruoloByVis[v.visita_id],vecchio),
        zone:z,sub:subByVis[v.visita_id]||{},cod:codByVis[v.visita_id]||{},
        ncp:ncp,ncm:ncm,oss:oss,ver:ver,
        esito:ncp>0?3:ncm>0?2:oss>0?1:0
      }
    })
    const nV=V.length
    const nCant=new Set(V.map(v=>v.cant)).size

    function oxAnnoLbl(){
      const d=dal.split('-').map(Number),a=al.split('-').map(Number)
      if(d[1]===10&&d[2]===1&&a[1]===9&&a[2]===30&&a[0]===d[0]+1)return'Anno edile '+d[0]+'-'+a[0]
      const f=s=>s.split('-').reverse().join('/')
      return'Periodo '+f(dal)+' - '+f(al)
    }
    const anno=oxAnnoLbl()

    OXD.forEach(d=>{
      d._nd=V.some(v=>v.cat[d.key]===0)
      d._cats=d.cats.concat(d._nd?[0]:[])
      d._lbl=c=>c===0?'nd':d.lbl[c]
    })
    function catIdx(d,v){return d._cats.indexOf(v.cat[d.key])}

    const zonaTot={};for(let z=1;z<=10;z++)zonaTot[z]={ver:0,oss:0,ncm:0,ncp:0,vis:new Set()}
    V.forEach(v=>Object.entries(v.zone).forEach(([z,o])=>{
      const t=zonaTot[z];if(!t)return
      t.ver+=o.ver;t.oss+=o.oss;t.ncm+=o.ncm;t.ncp+=o.ncp;t.vis.add(v.id)
    }))
    let G={ver:0,oss:0,ncm:0,ncp:0}
    Object.values(zonaTot).forEach(t=>{G.ver+=t.ver;G.oss+=t.oss;G.ncm+=t.ncm;G.ncp+=t.ncp})
    const Gtot=G.ver+G.oss+G.ncm+G.ncp

    const byGrp={}
    V.forEach(v=>{(byGrp[v.grp]=byGrp[v.grp]||[]).push(v)})
    Object.values(byGrp).forEach(a=>a.sort((x,y)=>(x.data||'').localeCompare(y.data||'')))
    // frequenza: ordine sulla storia intera (byGrp, nel solo periodo, resta per le matrici delle schede 3)
    const freq=[0,0,0,0]
    V.forEach(v=>{freq[Math.min(ordStoria[v.id]||0,3)]++})

    // ════════ PDF ════════
    const{jsPDF}=window.jspdf
    // (13/11/2026) compress:true: i grafici entrano compressi SENZA perdita (stessi pixel): il PDF passa da ~150 MB a ~3 MB
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true})
    let pg=0
    const newPage=first=>{if(!first)doc.addPage();pg++}

    // ── PAGINA 1: COPERTINA ──
    newPage(true)
    doc.setFillColor(OXBRAND[0],OXBRAND[1],OXBRAND[2])
    doc.rect(10,10,190,5,'F')
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(6.5)
    doc.text('FORMEDIL PADOVA',12,13.5)
    doc.setTextColor(86,92,102);doc.setFontSize(16)
    doc.text('OSSERVATORIO VISITE CANTIERE',105,55,{align:'center'})
    doc.setDrawColor(OXBRAND[0],OXBRAND[1],OXBRAND[2]);doc.setLineWidth(.8)
    doc.line(55,62,155,62)
    doc.setFontSize(26);doc.setTextColor(231,80,15)
    doc.text("REPORT ATTIVITA'",105,125,{align:'center'})
    doc.setFont('helvetica','normal');doc.setFontSize(14);doc.setTextColor(86,92,102)
    doc.text(anno,105,137,{align:'center'})
    doc.setFontSize(11)
    doc.text('Formedil Padova - Centro per la Formazione e la Sicurezza Edile di Padova',105,180,{align:'center'})
    doc.setFontSize(9);doc.setTextColor(140,140,140)
    doc.text('Emesso il '+new Date().toLocaleString('it-IT'),105,235,{align:'center'})
    if(vecchio){
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(196,63,10)
      doc.text('STAMPA COL VECCHIO PARAMETRO',105,150,{align:'center'})
      doc.setFont('helvetica','normal');doc.setFontSize(8.5)
      doc.text('Importo, tipo di intervento, tipo di opera e committente sono quelli dichiarati in ogni visita,',105,156,{align:'center'})
      doc.text('non quelli della scheda del cantiere: i numeri di queste sezioni sono diversi dal report corrente',105,160.5,{align:'center'})
      doc.text("e da quelli che l'Osservatorio nazionale ricava dai nostri dati.",105,165,{align:'center'})
    }
    oxFooter(doc,pg)

    // ── PAGINA 2: QUADRO DI SINTESI - scheda 1 ──
    newPage()
    oxHeader(doc,anno,'QUADRO DI SINTESI - scheda 1')
    const visM=Array(12).fill(0),cantM=Array(12).fill(null).map(()=>new Set())
    V.forEach(v=>{if(v.mese!=null){visM[v.mese]++;cantM[v.mese].add(v.cant)}})
    oxTbl(doc,{startY:26,margin:{left:12},tableWidth:48,
      head:[['mesi','visite','cantieri']],
      body:OS_MESI.map((m,i)=>[m,oxN(visM[i]),oxN(cantM[i].size)]).concat([['TOTALE',String(nV),String(nCant)]]),
      didParseCell:d=>{if(d.section==='body'&&d.row.index===12){d.cell.styles.fontStyle='bold';d.cell.styles.fillColor=OXT.tot}}})
    doc.addImage(oxBars({w:134,h:50,title:"ATTIVITA' MENSILE VISITE",cats:OS_MESI,
      series:[{label:'',color:OXC.ar,data:visM}],fmt:oxN}),'PNG',64,26,134,50)
    let y2=Math.max(doc.lastAutoTable.finalY,78)+6
    oxSec(doc,'FREQUENZA VISITE STESSO CANTIERE/IMPRESA',y2)
    doc.text("VISITE SECONDO L'ESITO DELLE VERIFICHE *",78,y2)
    doc.text('ESITO VERIFICHE *',146,y2)
    const esitiVis=oxEsitiVisite(V)
    const freqLbl=['prime visite','seconde visite','terze visite','visite oltre la terza']
    const esitoVisLbl=['nessuna OSS e/o NC','presenza solo OSS','presenza NC-','presenza NC+']
    const esitoVerLbl=['nessuna OSS e/o NC','OSS','NC-','NC+']
    oxTbl(doc,{startY:y2+2,margin:{left:12},tableWidth:60,
      head:[['prime viste','seconde visite','terze visite','visite oltre la terza']],
      body:[[oxN(freq[0]),oxN(freq[1]),oxN(freq[2]),oxN(freq[3])]],styles:{fontSize:5.4},headStyles:{fontSize:5}})
    oxTbl(doc,{startY:y2+2,margin:{left:78},tableWidth:60,
      head:[['nessuna OSS e/o NC','presenza solo OSS','presenza NC-','presenza NC+']],
      body:[[oxN(esitiVis[0]),oxN(esitiVis[1]),oxN(esitiVis[2]),oxN(esitiVis[3])]],styles:{fontSize:5.4},headStyles:{fontSize:5}})
    oxTbl(doc,{startY:y2+2,margin:{left:146},tableWidth:52,
      head:[['nessuna OSS e/o NC','OSS','NC-','NC+']],
      body:[[oxN(G.ver),oxN(G.oss),oxN(G.ncm),oxN(G.ncp)]],styles:{fontSize:5.4},headStyles:{fontSize:5}})
    const yC=y2+15
    doc.addImage(oxPie3D({w:60,h:38,data:freq,labels:freqLbl,colors:OXC.pie}),'PNG',12,yC,60,38)
    doc.addImage(oxBars({w:60,h:38,cats:esitoVisLbl,series:[{label:'',color:OXC.ar,data:esitiVis}],fmt:oxN,fontScale:.85,catFont:6.5}),'PNG',78,yC,60,38)
    doc.addImage(oxBars({w:52,h:38,cats:esitoVerLbl,series:[{label:'',color:'#fff',colors:OXC.esiti,data:[G.ver,G.oss,G.ncm,G.ncp]}],fmt:oxN,fontScale:.85,catFont:6.5}),'PNG',146,yC,52,38)
    let y3=yC+42
    oxSec(doc,'ESITO VERIFICHE PER AREA CANTIERE *',y3)
    const areaBody=[]
    for(let z=1;z<=10;z++){
      const o=zonaTot[z],tot=o.ver+o.oss+o.ncm+o.ncp
      areaBody.push([OS_ZONE_NAMI[z],oxN(tot),oxN(o.ver),oxN(o.oss),oxN(o.ncm),oxN(o.ncp),
        tot?oxPct(o.ncm/tot*100):'0,0',tot?oxPct(o.ncp/tot*100):'0,0'])
    }
    areaBody.push(['TOTALE',oxN(Gtot),oxN(G.ver),oxN(G.oss),oxN(G.ncm),oxN(G.ncp),
      Gtot?oxPct(G.ncm/Gtot*100):'0,0',Gtot?oxPct(G.ncp/Gtot*100):'0,0'])
    oxTbl(doc,{startY:y3+2,
      head:[['','verifiche','nessuna OSS/NC','OSS','NC-','NC+','% NC- su totale','% NC+ su totale']],
      body:areaBody,columnStyles:{0:{halign:'left',cellWidth:60}},
      didParseCell:d=>{if(d.section==='body'&&d.row.index===10){d.cell.styles.fontStyle='bold';d.cell.styles.fillColor=OXT.tot}}})
    let y4=doc.lastAutoTable.finalY+4
    const pNCm=[],pNCp=[]
    for(let z=1;z<=10;z++){const o=zonaTot[z],tot=o.ver+o.oss+o.ncm+o.ncp
      pNCp.push(tot?o.ncp/tot*100:0);pNCm.push(tot?o.ncm/tot*100:0)}
    doc.addImage(oxBars({w:186,h:52,title:'% verifiche con inadempienze NC+ e NC- su verifiche totali',
      cats:Object.values(OS_ZONE_NAMI),
      series:[{label:'NC+',color:OXC.ncp,data:pNCp},{label:'NC-',color:OXC.ncm,data:pNCm}],
      legend:'right',fmt:v=>oxIt(v,1),catFont:7,catLines:3}),'PNG',12,y4,186,52)
    oxNote(doc,y4+57)
    oxFooter(doc,pg)

    // ── PAGINA 3: QUADRO DI SINTESI - scheda 3 ──
    newPage()
    oxHeader(doc,anno,'QUADRO DI SINTESI - scheda 3')
    oxSec(doc,'RIEPILOGO VISITE E VERIFICHE PER AREA E SOTTOAREA CANTIERE',25)
    const subAgg={}
    V.forEach(v=>Object.entries(v.sub).forEach(([k,o])=>{
      const a=(subAgg[k]=subAgg[k]||{zona:o.zona,ver:0,oss:0,ncm:0,ncp:0,vis:new Set()})
      a.ver+=o.ver;a.oss+=o.oss;a.ncm+=o.ncm;a.ncp+=o.ncp;a.vis.add(v.id)
    }))
    const s3body=[],boldRows=[]
    for(let z=1;z<=10;z++){
      const zt=zonaTot[z],zVisN=zt.vis.size
      Object.keys(OS_SUB).filter(k=>OS_ZP[k.substring(0,3)]===z).forEach(k=>{
        const a=subAgg[k]
        if(!a){s3body.push([OS_SUB[k],'',oxPct(0),'','','','','','','','','']);return}
        const tot=a.ver+a.oss+a.ncm+a.ncp
        s3body.push([OS_SUB[k],oxN(a.vis.size),zVisN?oxPct(a.vis.size/zVisN*100):'0,0',
          oxN(tot),oxN(a.ver),oxN(a.oss),oxN(a.ncm),oxN(a.ncp),
          tot?oxPct(a.ver/tot*100):'',tot?oxPct(a.oss/tot*100):'',tot?oxPct(a.ncm/tot*100):'',tot?oxPct(a.ncp/tot*100):''])
      })
      const tot=zt.ver+zt.oss+zt.ncm+zt.ncp
      boldRows.push(s3body.length)
      s3body.push([OS_ZONE_NAMI[z].toUpperCase(),oxN(zVisN),nV?oxPct(zVisN/nV*100):'0,0',
        oxN(tot),oxN(zt.ver),oxN(zt.oss),oxN(zt.ncm),oxN(zt.ncp),
        tot?oxPct(zt.ver/tot*100):'',tot?oxPct(zt.oss/tot*100):'',tot?oxPct(zt.ncm/tot*100):'',tot?oxPct(zt.ncp/tot*100):''])
    }
    boldRows.push(s3body.length)
    s3body.push(['TOTALE',String(nV),'100,0',oxN(Gtot),oxN(G.ver),oxN(G.oss),oxN(G.ncm),oxN(G.ncp),
      Gtot?oxPct(G.ver/Gtot*100):'',Gtot?oxPct(G.oss/Gtot*100):'',Gtot?oxPct(G.ncm/Gtot*100):'',Gtot?oxPct(G.ncp/Gtot*100):''])
    oxTbl(doc,{startY:28,
      head:[[
        {content:'',rowSpan:2},{content:'VISITE',colSpan:2},{content:'VERIFICHE - numero',colSpan:5},{content:'VERIFICHE - distribuzione %',colSpan:4}],
        ['n. visite','% sottoarea su area e area su totale','n. verifiche totali','senza oss/nc*','con oss','con nc-','con nc+','senza oss/nc*','con oss','con nc-','con nc+']],
      body:s3body,styles:{fontSize:5.2,cellPadding:{top:.5,bottom:.5,left:.8,right:.8}},
      headStyles:{fontSize:5},
      columnStyles:{0:{halign:'left',cellWidth:48}},
      didParseCell:d=>{if(d.section==='body'&&boldRows.includes(d.row.index)){d.cell.styles.fontStyle='bold';d.cell.styles.fillColor=OXT.tot}}})
    doc.setFont('helvetica','bolditalic');doc.setFontSize(5.8);doc.setTextColor(86,92,102)
    doc.text("* l'assenza sistematica di verifiche senza osservazioni o inadempienze indica la scelta dell'ente di non documentare le verifiche prive di problematiche. In questo caso ne risentiranno le analisi statistiche sull'esito globale delle visite",12,doc.lastAutoTable.finalY+4,{maxWidth:186})
    oxFooter(doc,pg)

    // ════════ PAGINE PER DIMENSIONE ════════
    for(const d of OXD){
      const cats=d._cats,k=cats.length
      const lbls=cats.map(c=>d._lbl(c))
      // come nel modello: «nd» sta nelle tabelle, non nei grafici, nel coefficiente e nelle medie
      const kk=d.cats.length,lblsG=lbls.slice(0,kk)

      // ───── SCHEDA 1 ─────
      newPage()
      oxHeader(doc,anno,d.title+' - scheda 1')
      oxSec(doc,'VISITE E CANTIERI PER MESE',25,d.sub)
      const visMx=OS_MESI.map(()=>cats.map(()=>0))
      const cantMx=OS_MESI.map(()=>cats.map(()=>new Set()))
      const totVis=cats.map(()=>0),totCantS=cats.map(()=>new Set())
      V.forEach(v=>{
        const i=catIdx(d,v);if(i<0)return
        totVis[i]++;totCantS[i].add(v.cant)
        if(v.mese!=null){visMx[v.mese][i]++;cantMx[v.mese][i].add(v.cant)}
      })
      const totCant=totCantS.map(s=>s.size)
      const sumVis=totVis.reduce((s,x)=>s+x,0),sumCant=new Set(V.map(v=>v.cant)).size
      const s1head=[[{content:'mesi',rowSpan:2},{content:'VISITE',colSpan:k+1},{content:'CANTIERI',colSpan:k+1}],
        [...lbls,'Totale',...lbls,'Totale']]
      const s1body=OS_MESI_FULL.map((m,i)=>{
        const vr=visMx[i],cr=cantMx[i].map(s=>s.size)
        return[m,...vr.map(oxN),oxN(vr.reduce((s,x)=>s+x,0)),...cr.map(oxN),oxN(cr.reduce((s,x)=>s+x,0))]
      })
      s1body.push(['TOTALE',...totVis.map(oxN),String(sumVis),...totCant.map(oxN),oxN(sumCant)])
      s1body.push(['Distribuzione %',...totVis.map(x=>sumVis?oxPct(x/sumVis*100):'0,0'),'100,0',
        ...totCant.map(x=>sumCant?oxPct(x/sumCant*100):'0,0'),'100,0'])
      oxTbl(doc,{startY:27,head:s1head,body:s1body,
        styles:{fontSize:5.1,cellPadding:{top:.5,bottom:.5,left:.5,right:.5}},headStyles:{fontSize:4.9},
        columnStyles:{0:{halign:'left',cellWidth:17}},
        didParseCell:dd=>{if(dd.section==='body'&&dd.row.index>=12){dd.cell.styles.fontStyle=dd.row.index===13?'bolditalic':'bold';dd.cell.styles.fillColor=OXT.tot}}})
      let yy=doc.lastAutoTable.finalY+4
      doc.addImage(oxBars({w:96,h:48,title:'VISITE E CANTIERI PER '+d.title.replace(' CANTIERE',''),
        cats:lblsG,series:[{label:'VISITE',color:OXC.s1,data:totVis.slice(0,kk)},{label:'CANTIERI',color:OXC.s2,data:totCant.slice(0,kk)}],
        legend:'bottom',fmt:oxN,fontScale:.85,catFont:6.5}),'PNG',12,yy,96,48)
      doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(86,92,102)
      doc.text('COEFFICIENTE VISITE/CANTIERI',155,yy+2,{align:'center'})
      oxTbl(doc,{startY:yy+3,margin:{left:112},tableWidth:86,
        head:[lblsG],body:[totVis.slice(0,kk).map((x,i)=>totCant[i]?oxIt(x/totCant[i],1):'-')],
        styles:{fontSize:5},headStyles:{fontSize:4.8}})
      // la torta del modello rappresenta i coefficienti visite/cantieri, non le visite
      doc.addImage(oxPie3D({w:86,h:34,data:totVis.slice(0,kk).map((x,i)=>totCant[i]?x/totCant[i]:0),labels:lblsG,colors:OXC.pie,fmt:v=>oxIt(v,1)}),'PNG',112,yy+13,86,34)
      yy+=52
      oxSec(doc,'INADEMPIENZE RILEVATE',yy,d.sub)
      const ncpMx=OS_MESI.map(()=>cats.map(()=>0)),ncmMx=OS_MESI.map(()=>cats.map(()=>0))
      const ncpCat=cats.map(()=>0),ncmCat=cats.map(()=>0)
      V.forEach(v=>{
        const i=catIdx(d,v);if(i<0)return
        ncpCat[i]+=v.ncp;ncmCat[i]+=v.ncm
        if(v.mese!=null){ncpMx[v.mese][i]+=v.ncp;ncmMx[v.mese][i]+=v.ncm}
      })
      const sumNcp=ncpCat.reduce((s,x)=>s+x,0),sumNcm=ncmCat.reduce((s,x)=>s+x,0)
      const s1bhead=[[{content:'mesi',rowSpan:2},{content:'NC+',colSpan:k+1},{content:'NC-',colSpan:k+1}],
        [...lbls,'Totale',...lbls,'Totale']]
      const s1bbody=OS_MESI_FULL.map((m,i)=>{
        const p=ncpMx[i],q=ncmMx[i]
        return[m,...p.map(oxN),oxN(p.reduce((s,x)=>s+x,0)),...q.map(oxN),oxN(q.reduce((s,x)=>s+x,0))]
      })
      s1bbody.push(['TOTALE',...ncpCat.map(oxN),oxN(sumNcp),...ncmCat.map(oxN),oxN(sumNcm)])
      s1bbody.push(['Distribuzione %',...ncpCat.map(x=>sumNcp?oxPct(x/sumNcp*100):'0,0'),'100,0',
        ...ncmCat.map(x=>sumNcm?oxPct(x/sumNcm*100):'0,0'),'100,0'])
      oxTbl(doc,{startY:yy+2,head:s1bhead,body:s1bbody,
        styles:{fontSize:5.1,cellPadding:{top:.5,bottom:.5,left:.5,right:.5}},headStyles:{fontSize:4.9},
        columnStyles:{0:{halign:'left',cellWidth:17}},
        didParseCell:dd=>{if(dd.section==='body'&&dd.row.index>=12){dd.cell.styles.fontStyle=dd.row.index===13?'bolditalic':'bold';dd.cell.styles.fillColor=OXT.tot}}})
      yy=doc.lastAutoTable.finalY+4
      doc.addImage(oxBars({w:96,h:44,title:'INADEMPIENZE PER '+d.title.replace(' CANTIERE',''),
        cats:lblsG,series:[{label:'NC+',color:OXC.ncp,data:ncpCat.slice(0,kk)},{label:'NC-',color:OXC.ncm,data:ncmCat.slice(0,kk)}],
        legend:'bottom',fmt:oxN,fontScale:.85,catFont:6.5}),'PNG',12,yy,96,44)
      doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(86,92,102)
      doc.text('MEDIA INADEMPIENZE PER VISITA',155,yy+2,{align:'center'})
      oxTbl(doc,{startY:yy+3,margin:{left:112},tableWidth:86,
        head:[['',...lblsG]],
        body:[['NC+',...d.cats.map((c,i)=>totVis[i]?oxIt(ncpCat[i]/totVis[i],1):'-')],
              ['NC-',...d.cats.map((c,i)=>totVis[i]?oxIt(ncmCat[i]/totVis[i],1):'-')]],
        styles:{fontSize:5},headStyles:{fontSize:4.8},columnStyles:{0:{fontStyle:'bold'}}})
      // barre impilate, come nel modello
      doc.addImage(oxBars({w:86,h:28,cats:lblsG,stacked:true,
        series:[{label:'NC+',color:OXC.ncp,data:d.cats.map((c,i)=>totVis[i]?ncpCat[i]/totVis[i]:0)},
                {label:'NC-',color:OXC.ncm,data:d.cats.map((c,i)=>totVis[i]?ncmCat[i]/totVis[i]:0)}],
        legend:'right',labels:false,fmtAxis:v=>oxIt(v,1),fontScale:.8,catFont:6}),'PNG',112,yy+15,86,28)
      oxFooter(doc,pg)

      // ───── SCHEDA 2 ─────
      newPage()
      oxHeader(doc,anno,d.title+' - scheda 2')
      oxSec(doc,'VISITE PER AREA CANTIERE E MEDIA VERIFICHE PER VISITA *',25)
      const zVis={},zVer={}
      for(let z=1;z<=10;z++){zVis[z]=cats.map(()=>0);zVer[z]=cats.map(()=>0)}
      V.forEach(v=>{
        const i=catIdx(d,v);if(i<0)return
        Object.entries(v.zone).forEach(([z,o])=>{
          if(!zVis[z])return
          zVis[z][i]++;zVer[z][i]+=(o.ver+o.oss+o.ncm+o.ncp)
        })
      })
      const s2head=[[{content:'',rowSpan:2},{content:'N. verifiche potenziali',rowSpan:2},{content:'NUMERO VISITE',colSpan:k+1},{content:'MEDIA VERIFICHE PER VISITA',colSpan:k+1}],
        [...lbls,'Totale',...lbls,'Totale']]
      const s2body=[]
      const totVerZ=cats.map(()=>0)
      for(let z=1;z<=10;z++){
        const vz=zVis[z],vr=zVer[z]
        vr.forEach((x,i)=>{totVerZ[i]+=x})
        const tv=vz.reduce((s,x)=>s+x,0),tr=vr.reduce((s,x)=>s+x,0)
        s2body.push([OS_ZONE_NAMI[z],oxN(zonaPot[z]),
          ...vz.map(oxN),oxN(tv),
          ...vz.map((x,i)=>x?oxIt(vr[i]/x,1):''),tv?oxIt(tr/tv,1):''])
      }
      const potTot=Object.values(zonaPot).reduce((s,x)=>s+x,0)
      s2body.push(['TOTALE',oxN(potTot),
        ...totVis.map(oxN),String(sumVis),
        ...cats.map((c,i)=>totVis[i]?oxIt(totVerZ[i]/totVis[i],1):''),sumVis?oxIt(Gtot/sumVis,1):''])
      oxTbl(doc,{startY:27,head:s2head,body:s2body,
        styles:{fontSize:5,cellPadding:{top:.5,bottom:.5,left:.5,right:.5}},headStyles:{fontSize:4.8},
        columnStyles:{0:{halign:'left',cellWidth:34}},
        didParseCell:dd=>{if(dd.section==='body'&&dd.row.index===10){dd.cell.styles.fontStyle='bold';dd.cell.styles.fillColor=OXT.tot}}})
      let ys=doc.lastAutoTable.finalY+3
      doc.setFont('helvetica','italic');doc.setFontSize(5.6);doc.setTextColor(120,125,132)
      doc.text('Grafici area cantiere (barre verticali per numero visite, linea di tendenza per media verifiche per visita)',12,ys)
      ys+=2
      const miniZones=[1,2,3,4,5,6,7,8,10]
      const miniLbls=lblsG
      const mW=61
      // altezza adattiva: le 3 righe di grafici + la sezione successiva devono stare in pagina
      const pitch1=Math.max(20,Math.min(28,(150-ys)/3))
      const mH=pitch1-2
      miniZones.forEach((z,mi)=>{
        const col=mi%3,row=Math.floor(mi/3)
        const bars=zVis[z].slice(0,kk),line=bars.map((x,i)=>x?zVer[z][i]/x:null)
        doc.addImage(oxMiniCombo({w:mW,h:mH,title:OS_ZONE_NAMI[z].toUpperCase(),cats:miniLbls,bars:bars,line:line}),
          'PNG',12+col*63,ys+row*pitch1,mW,mH)
      })
      ys+=3*pitch1+3
      oxSec(doc,'VISITE PER AREA CANTIERE. PERCENTUALE INADEMPIENZE SU VERIFICHE EFFETTUATE *',ys)
      const zNcp={},zNcm={}
      for(let z=1;z<=10;z++){zNcp[z]=cats.map(()=>0);zNcm[z]=cats.map(()=>0)}
      V.forEach(v=>{
        const i=catIdx(d,v);if(i<0)return
        Object.entries(v.zone).forEach(([z,o])=>{if(zNcp[z]){zNcp[z][i]+=o.ncp;zNcm[z][i]+=o.ncm}})
      })
      const s2bhead=[[{content:'',rowSpan:2},{content:'NC+',colSpan:k+1},{content:'NC-',colSpan:k+1}],
        [...lbls,'Totale',...lbls,'Totale']]
      const s2bbody=[]
      for(let z=1;z<=10;z++){
        const vr=zVer[z],p=zNcp[z],q=zNcm[z]
        const tr=vr.reduce((s,x)=>s+x,0),tp=p.reduce((s,x)=>s+x,0),tq=q.reduce((s,x)=>s+x,0)
        s2bbody.push([OS_ZONE_NAMI[z],
          ...p.map((x,i)=>(x&&vr[i])?oxPct(x/vr[i]*100):''),(tp&&tr)?oxPct(tp/tr*100):'',
          ...q.map((x,i)=>(x&&vr[i])?oxPct(x/vr[i]*100):''),(tq&&tr)?oxPct(tq/tr*100):''])
      }
      s2bbody.push(['TOTALE',
        ...cats.map((c,i)=>{const vr=totVerZ[i];let p=0;for(let z=1;z<=10;z++)p+=zNcp[z][i];return(p&&vr)?oxPct(p/vr*100):''}),
        Gtot?oxPct(G.ncp/Gtot*100):'',
        ...cats.map((c,i)=>{const vr=totVerZ[i];let q=0;for(let z=1;z<=10;z++)q+=zNcm[z][i];return(q&&vr)?oxPct(q/vr*100):''}),
        Gtot?oxPct(G.ncm/Gtot*100):''])
      oxTbl(doc,{startY:ys+2,head:s2bhead,body:s2bbody,
        styles:{fontSize:5,cellPadding:{top:.5,bottom:.5,left:.5,right:.5}},headStyles:{fontSize:4.8},
        columnStyles:{0:{halign:'left',cellWidth:34}},
        didParseCell:dd=>{if(dd.section==='body'&&dd.row.index===10){dd.cell.styles.fontStyle='bold';dd.cell.styles.fillColor=OXT.tot}}})
      ys=doc.lastAutoTable.finalY+2
      // la nota di chiusura sta sotto i grafici: comprimo le righe quanto serve
      const NOTE_Y=274            // riga della nota: 2 righe di testo sopra la barra a y=282
      const pitch2=Math.max(12,Math.min(28,(NOTE_Y-6-ys)/3))
      const mH2=pitch2-2
      miniZones.forEach((z,mi)=>{
        const col=mi%3,row=Math.floor(mi/3)
        const vr=zVer[z]
        const pp=zNcp[z].slice(0,kk).map((x,i)=>vr[i]?x/vr[i]*100:0)
        const qq=zNcm[z].slice(0,kk).map((x,i)=>vr[i]?x/vr[i]*100:0)
        doc.addImage(oxMiniNC({w:mW,h:mH2,title:OS_ZONE_NAMI[z].toUpperCase(),cats:miniLbls,ncp:pp,ncm:qq}),
          'PNG',12+col*63,ys+row*pitch2,mW,mH2)
      })
      oxNote(doc,Math.max(ys+3*pitch2+4,NOTE_Y-6))
      oxFooter(doc,pg)

      // ───── SCHEDA 3 ─────
      if(d.schede>=3){
        newPage()
        oxHeader(doc,anno,d.title+' - scheda 3')
        doc.setFont('helvetica','bold');doc.setFontSize(6.6);doc.setTextColor(86,92,102)
        doc.text('ANALISI VERIFICHE DELLE VISITE MULTIPLE STESSO CANTIERE-IMPRESA NEL PERIODO. CONFRONTO TRA PRIMA E ULTIMA VISITA DELLA STESSA VERIFICA*',12,25)
        let ym=31
        const esitoLblS=['nessun oss/nc','oss','nc-','nc+']
        for(const c of (d.s3cats||d.cats)){
          const mx=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]
          Object.values(byGrp).forEach(arr=>{
            if(arr.length<2)return
            if(arr[arr.length-1].cat[d.key]!==c)return
            const A=arr[0].cod,B=arr[arr.length-1].cod
            Object.keys(A).forEach(code=>{
              if(B[code]===undefined)return
              mx[A[code]][B[code]]++
            })
          })
          const mtot=mx.flat().reduce((s,x)=>s+x,0)
          let migl=0,stp=0,stn=0,pegg=0
          for(let r=0;r<4;r++)for(let j=0;j<4;j++){
            if(j<r)migl+=mx[r][j];else if(j>r)pegg+=mx[r][j]
            else if(r===0)stp+=mx[r][j];else stn+=mx[r][j]
          }
          if(ym>238){oxFooter(doc,pg);newPage();oxHeader(doc,anno,d.title+' - scheda 3 (segue)');ym=27}
          doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(231,80,15)
          doc.text(d.blk[c]||d.lbl[c].toUpperCase(),60,ym,{align:'center'})
          doc.setFontSize(5.6);doc.setTextColor(86,92,102)
          doc.text('esito ultima visita',38,ym+4)
          doc.text('composizione %',86,ym+4)
          const heat=dd=>{
            if(dd.section!=='body'||dd.column.index===0)return
            const r=dd.row.index,j=dd.column.index-1
            dd.cell.styles.fillColor=j<r?OXT.heatG:(j>r?OXT.heatO:OXT.heatC)
          }
          oxTbl(doc,{startY:ym+5,margin:{left:12},tableWidth:54,
            head:[['esito prima visita',...esitoLblS]],
            body:esitoLblS.map((e,r)=>[e,...mx[r].map(x=>x?String(x):'')]),
            styles:{fontSize:5,cellPadding:{top:.9,bottom:.9,left:.5,right:.5}},headStyles:{fontSize:4.6},
            columnStyles:{0:{halign:'left',fontStyle:'bold',cellWidth:16}},didParseCell:heat})
          // totale delle verifiche confrontate, sotto la matrice come nel modello
          doc.setFont('helvetica','normal');doc.setFontSize(5.2);doc.setTextColor(86,92,102)
          doc.text(String(mtot),65,doc.lastAutoTable.finalY+3,{align:'right'})
          oxTbl(doc,{startY:ym+5,margin:{left:70},tableWidth:50,
            head:[['',...esitoLblS]],
            body:esitoLblS.map((e,r)=>[e,...mx[r].map(x=>(mtot&&x)?oxPct(x/mtot*100):'-')]),
            styles:{fontSize:5,cellPadding:{top:.9,bottom:.9,left:.5,right:.5}},headStyles:{fontSize:4.6},
            columnStyles:{0:{halign:'left',fontStyle:'bold',cellWidth:14}},didParseCell:heat})
          const sumLbl=['miglioramento','stabilità positiva','stabilità negativa','peggioramento']
          const sumVal=[migl,stp,stn,pegg]
          oxTbl(doc,{startY:ym+5,margin:{left:126},tableWidth:42,
            body:sumLbl.map((s,i)=>[s,mtot?oxPct(sumVal[i]/mtot*100):'-']),
            styles:{fontSize:5.2,cellPadding:{top:1.1,bottom:1.1,left:1,right:1}},
            columnStyles:{0:{halign:'left',cellWidth:28}},
            didParseCell:dd=>{
              if(dd.column.index===1){
                dd.cell.styles.fillColor=[OXT.heatG,OXT.heatN,OXT.heatC,OXT.heatO][dd.row.index]
              }
            }})
          doc.addImage(oxPie3D({w:26,h:22,data:sumVal,labels:sumLbl,colors:OXC.trans,noLegend:true,fmt:()=>''}),'PNG',172,ym+3,26,22)
          doc.setFontSize(4);doc.setFont('helvetica','normal');doc.setTextColor(86,92,102)
          const lgX=[172,185,172,185],lgY=[ym+28,ym+28,ym+31,ym+31]
          sumLbl.forEach((s,i)=>{
            const rgb=OXC.trans[i].match(/\w\w/g).map(x=>parseInt(x,16))
            doc.setFillColor(rgb[0],rgb[1],rgb[2])
            doc.rect(lgX[i],lgY[i]-1.6,1.9,1.9,'F')
            doc.text(s,lgX[i]+2.6,lgY[i])
          })
          ym+=37
        }
        oxNote(doc,Math.min(ym+2,272))
        oxFooter(doc,pg)
      }
    }

    const fname='Report_Osservatorio_'+dal+'_'+al+(vecchio?'_vecchio-parametro':'')+'.pdf'
    doc.save(fname)
    toast('Report Osservatorio generato ('+pg+' pagine): '+fname,'ok')
    const manca=vecchio?'':datiCantiereMancanti(visite.map(v=>({c:v.cantieri})))
    if(manca)toast('Schede dei cantieri incomplete (numero di visite): '+manca+'. Nel report sono «nd», come risulteranno all\u2019Osservatorio.','warn',15000)
  }catch(e){
    console.error('admGeneraReportOsservatorio:',e)
    toast('Errore generazione report: '+(e.message||e),'err')
  }finally{_oxNotaVecchio=''}
}
window.admGeneraReportOsservatorio = admGeneraReportOsservatorio
}
