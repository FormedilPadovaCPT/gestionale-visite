/* ============================================================
   Estrazione XML per l'Osservatorio nazionale (ex CNCPT / Formedil).

   PRIMO MODULO ESTRATTO DAL MONOLITE index.html (05/09/2026, audit).
   Il codice e' lo stesso che stava fra i marcatori «ESTRAZIONE XML
   OSSERVATORIO» e «window.admExportOsservatorio»: qui vive dentro una
   fabbrica che riceve dal modulo inline le sole cose di cui ha bisogno
   (client Supabase, stato, helper del DOM). Niente variabili globali
   implicite: se manca una dipendenza si vede alla prima chiamata, non
   in produzione tre settimane dopo.

   Chi lo usa (index.html):
     import { creaOsservatorio } from './osservatorio.js'
     const { _inChunks, _splitFigura, _figSnap, _ordinaNomeCognomeDaCF } =
       creaOsservatorio({ sb, S, ADMIN_EMAIL, $, vGet, vSet, toast })

   _inChunks, _splitFigura, _figSnap e _ordinaNomeCognomeDaCF servono
   anche fuori dall'Osservatorio (rubrica, committenti, persone): per
   questo vengono restituiti. admExportOsservatorio e admOssTuttoArchivio
   si agganciano a window per gli onclick inline del pannello Segreteria.
   ============================================================ */

export function creaOsservatorio({ sb, S, ADMIN_EMAIL, $, vGet, vSet, toast }) {
  for (const [nome, v] of Object.entries({ sb, S, ADMIN_EMAIL, $, vGet, vSet, toast })) {
    if (v === undefined) throw new Error('osservatorio.js: manca la dipendenza ' + nome)
  }

  // ── ESTRAZIONE XML OSSERVATORIO ─────────────────────────────
  // Mappatura voce checklist gestionale → ValutazioneID ufficiale Osservatorio (form CNCPT)
  const CHK2OSS={"IMP_LOG_001":1,"IMP_LOG_002":2,"IMP_LOG_003":3,"IMP_LOG_004":4,"IMP_LOG_005":5,"IMP_LOG_006":6,"IMP_LOG_007":202,"IMP_LOG_008":8,"IMP_LOG_009":9,"IMP_IGS_001":10,"IMP_IGS_002":11,"IMP_IGS_009":200,"IMP_IGS_003":12,"IMP_IGS_004":13,"IMP_IGS_005":14,"IMP_IGS_006":15,"IMP_IGS_008":201,"IMP_IGS_007":16,"IMP_ELE_001":17,"IMP_ELE_002":18,"IMP_ELE_003":19,"IMP_ELE_004":20,"IMP_ELE_005":21,"IMP_ELE_006":22,"IMP_ELE_007":23,"IMP_ELE_008":24,"IMP_AGI_001":25,"IMP_AGI_002":26,"IMP_AGI_003":27,"IMP_ORG_001":28,"IMP_ORG_002":29,"IMP_ORG_003":30,"IMP_ORG_004":31,"IMP_ORG_005":32,"IMP_ORG_006":33,"IMP_SEG_001":34,"IMP_SEG_002":35,"IMP_SEG_003":36,"IMP_CON_001":203,"IMP_CON_002":204,"IMP_CON_003":205,"IMP_CON_004":206,"PLL_SCA_001":37,"PLL_SCA_002":38,"PLL_SCA_003":39,"PLL_SCA_004":207,"PLL_SCA_005":208,"PLL_SCA_006":209,"PLL_SCA_007":210,"PLL_DEM_001":40,"PLL_DEM_002":41,"PLL_DEM_003":42,"PLL_DEM_004":214,"PLL_DEM_005":211,"PLL_DEM_006":212,"PLL_DEM_007":213,"PLL_OCA_001":215,"PLL_OCA_002":216,"PLL_OCA_003":217,"PLL_OCA_004":218,"PLL_OCA_005":240,"PLL_PER_001":43,"PLL_PER_002":44,"PLL_PER_003":45,"PLL_PER_004":46,"SOL_GRU_001":47,"SOL_GRU_002":48,"SOL_GRU_003":49,"SOL_GRU_004":50,"SOL_GRU_005":51,"SOL_GRU_006":52,"SOL_GRU_007":53,"SOL_GRU_008":54,"SOL_GRU_009":55,"SOL_GRU_010":56,"SOL_AUT_002":58,"SOL_AUT_003":59,"SOL_AUT_004":60,"SOL_AUT_005":61,"SOL_AUT_006":62,"SOL_AUT_007":63,"SOL_AUT_008":64,"SOL_AUT_009":65,"SOL_AUT_010":66,"SOL_AUT_011":67,"SOL_ARG_002":69,"SOL_ARG_003":70,"SOL_ARG_004":71,"SOL_ARG_005":72,"SOL_ARG_006":73,"SOL_ARG_007":241,"SOL_ASO_001":50,"SOL_ASO_002":51,"SOL_ASO_003":52,"SOL_ASO_004":53,"SOL_PIA_001":74,"SOL_PIA_002":75,"SOL_PIA_003":76,"SOL_PIA_004":77,"SOL_PIA_005":78,"SOL_PIA_006":242,"ASU_ATT_001":79,"ASU_ATT_002":80,"ASU_ATT_003":81,"ASU_ATT_004":82,"ASU_ATT_005":83,"ASU_ATT_006":84,"ASU_ATT_007":85,"ASU_ATT_008":86,"ASU_ATT_009":87,"ASU_ATT_010":88,"ASU_ATT_011":89,"ASU_ATT_012":90,"ASU_ATT_013":219,"ASU_SCA_001":91,"ASU_SCA_002":92,"ASU_SCA_003":93,"ASU_SCA_004":94,"ASU_UTE_001":95,"ASU_UTE_002":221,"ASU_UTE_003":97,"ASU_UTE_004":98,"ASU_UTE_005":99,"ASU_UTE_006":100,"ASU_UTE_007":101,"ASU_UTE_008":102,"ASU_UTE_009":103,"ASU_UTE_010":104,"ASU_UTE_011":105,"ASU_UTE_012":106,"ASU_UTE_013":107,"ASU_UTE_014":108,"ASU_UTE_015":222,"ASU_UTE_016":223,"MAC_MMT_001":109,"MAC_MMT_002":110,"MAC_MMT_003":111,"MAC_MMT_004":112,"MAC_MMT_005":113,"MAC_MMT_006":114,"MAC_MMT_007":115,"MAC_MMM_001":117,"MAC_MMM_002":118,"MAC_MMM_003":119,"MAC_MMM_004":120,"MAC_MMM_005":121,"MAC_MMM_006":122,"MAC_MAS_001":123,"MAC_MAS_002":124,"MAC_MAS_003":125,"MAC_MAS_004":126,"MAC_MAS_005":127,"MAC_MAS_006":128,"OPE_POF_001":129,"OPE_POF_002":130,"OPE_POF_003":131,"OPE_POF_004":132,"OPE_POF_005":133,"OPE_POF_006":134,"OPE_POF_007":135,"OPE_POF_008":136,"OPE_POF_010":224,"OPE_POF_011":225,"OPE_POF_012":226,"OPE_POF_013":227,"OPE_POF_014":228,"OPE_POF_015":229,"OPE_POF_016":230,"OPE_POF_017":232,"OPE_POF_018":233,"OPE_POF_019":234,"OPE_POF_020":235,"OPE_POF_021":236,"OPE_POS_001":138,"OPE_POS_002":139,"OPE_POS_003":140,"OPE_POS_004":141,"OPE_POS_005":142,"OPE_POS_006":143,"OPE_POS_007":144,"OPE_POS_008":237,"OPE_POC_001":145,"OPE_POC_002":146,"OPE_POC_003":147,"OPE_POC_004":238,"OPE_POT_001":148,"OPE_POT_002":149,"OPE_POT_003":150,"OPE_POT_004":151,"OPE_POT_005":152,"OPE_POT_006":153,"OPE_POT_007":154,"OPE_POT_008":155,"OPE_POT_009":239,"OPE_DPC_001":156,"OPE_DPC_002":157,"OPE_DPC_003":158,"OPE_DPC_005":159,"OPE_DPC_006":160,"PIN_IND_001":161,"PIN_IND_002":162,"PIN_TES_001":163,"PIN_TES_002":164,"PIN_PIE_001":165,"PIN_PIE_002":166,"PIN_MAN_001":167,"PIN_MAN_002":168,"PIN_MAN_003":169,"PIN_UDI_001":170,"PIN_UDI_002":171,"PIN_CAD_001":172,"PIN_CAD_002":173,"PIN_CAD_003":174,"PIN_CAD_004":175,"PIN_OCC_001":176,"PIN_OCC_002":177,"PIN_OCC_003":178,"PIN_RES_001":179,"PIN_RES_002":180,"DOC_GEN_001":199,"DOC_GEN_002":196,"DOC_GEN_003":198,"DOC_GEN_004":250,"DOC_GEN_005":245,"DOC_GEN_006":249,"DOC_GEN_008":244,"DOC_GEN_009":251,"DOC_GEN_010":243,"DOC_GEN_011":248,"DOC_GEN_012":253,"DOC_GEN_013":252,"DOC_GEN_014":246,"DOC_GEN_015":247,"DOC_GEN_SOL_001":255,"DOC_GEN_SOL_002":257,"DOC_GEN_SOL_003":260,"DOC_GEN_SOL_004":261,"DOC_GEN_SOL_005":256,"DOC_GEN_SOL_006":258,"DOC_GEN_SOL_007":262,"DOC_GEN_SOL_008":195,"DOC_GEN_SOL_009":254,"DOC_GEN_SOL_010":259,"DOC_MA4_001":263,"DOC_MA4_002":264,"DOC_MA4_003":265,"DOC_MA4_004":266,"DOC_MA4_005":269,"DOC_MA4_006":267,"DOC_MA4_007":268,"DOC_MA4_008":271,"DOC_MA4_009":272,"DOC_ELE_001":274,"DOC_ELE_002":275,"DOC_ELE_003":273,"DOC_ELE_004":277,"DOC_ELE_005":278,"DOC_ELE_006":276,"DOC_PON_001":281,"DOC_PON_002":283,"DOC_PON_003":280,"DOC_PON_004":284,"DOC_PON_005":279,"DOC_PON_006":282,"SOG_FIG_001":288,"SOG_FIG_002":294,"SOG_FIG_003":292,"SOG_FIG_004":293,"SOG_FIG_005":290,"SOG_FIG_006":286,"SOG_FIG_007":285,"SOG_FIG_008":291,"SOG_FIG_009":287,"SOG_FIG_010":289,"FOR_BAS_001":189,"FOR_FIG_001":295,"FOR_FIG_002":296,"FOR_FIG_003":297,"FOR_FIG_004":302,"FOR_FIG_005":303,"FOR_FIG_006":304,"FOR_FIG_007":301,"FOR_FIG_008":300,"FOR_FIG_009":299,"FOR_FIG_010":298,"FOR_RIS_001":313,"FOR_RIS_002":314,"FOR_RIS_003":305,"FOR_RIS_004":310,"FOR_RIS_005":311,"FOR_RIS_006":306,"FOR_RIS_007":309,"FOR_RIS_008":308,"FOR_RIS_009":307,"FOR_RIS_010":312,"FOR_ATM_001":317,"FOR_ATM_002":315,"FOR_ATM_003":318,"FOR_ATM_004":323,"FOR_ATM_005":322,"FOR_ATM_006":316,"FOR_ATM_007":319,"FOR_ATM_008":320,"FOR_ATM_009":321,"FOR_ATM_010":270,"SOL_AUT_001":57,"SOL_ARG_001":68,"DOC_GEN_007":197,"DOC_PON_007":247}
  const _OSS_ESITO={'NC+':1,'NC-':2,'OSS':3}  // radio ufficiali; VER = voce verificata senza esito
  function _xesc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'')}
  function _xel(tag,val,max){if(val==null||val==='')return '';let v=String(val);if(max&&v.length>max)v=v.slice(0,max);return `<${tag}>${_xesc(v)}</${tag}>`}
  function _xdl(nome,contenuto){
    const blob=new Blob([contenuto],{type:'application/xml;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nome
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)
  }
  function _splitNome(raw){
    // "Arch. Silvia Niero" → {nome:'Silvia', cognome:'Niero'} (best effort)
    let t=String(raw||'').trim().replace(/^(arch|ing|geom|dott|dott\.ssa|sig|sig\.ra|avv|prof|p\.i|rag)\.?\s+/i,'')
    const parts=t.split(/\s+/).filter(Boolean)
    if(parts.length<2)return null
    return {nome:parts.slice(0,-1).join(' '),cognome:parts[parts.length-1]}
  }
  // ── Figure visita: split "Titolo Nome Cognome" e ordine dedotto dal CF ──
  const _TITOLI_STD=['Sig.','Sig.ra','Dott.','Dott.ssa','Geom.','P.I.','Ing.','Arch.','Avv.','Prof.','Rag.']
  function _splitFigura(raw){
    let t=String(raw||'').trim()
    if(!t)return{titolo:null,nome:null,cognome:null}
    let titolo=null
    const m=t.match(/^(sig\.ra|sig|dott\.ssa|dott|geom|p\.i|ing|arch|avv|prof|rag)\.?\s+/i)
    if(m){
      const k=m[1].toLowerCase().replace(/\./g,'')
      titolo=_TITOLI_STD.find(x=>x.toLowerCase().replace(/\./g,'')===k)||null
      t=t.slice(m[0].length).trim()
    }
    const parts=t.split(/\s+/).filter(Boolean)
    if(!parts.length)return{titolo,nome:null,cognome:null}
    if(parts.length===1)return{titolo,nome:null,cognome:parts[0]}
    return{titolo,nome:parts.slice(0,-1).join(' '),cognome:parts[parts.length-1]}
  }
  function _figSnap(pfx,tit,nome,cog,legacy){
    // usa le parti salvate se presenti, altrimenti split best-effort della stringa storica
    if(nome||cog)return{[pfx+'_titolo']:tit||null,[pfx+'_nome']:nome||null,[pfx+'_cog']:cog||null}
    const s=_splitFigura(legacy)
    return{[pfx+'_titolo']:tit||s.titolo,[pfx+'_nome']:s.nome,[pfx+'_cog']:s.cognome}
  }
  function _cfLet(s,voc){return String(s||'').toUpperCase().replace(/[^A-Z]/g,'').split('').filter(c=>'AEIOU'.includes(c)===voc).join('')}
  function _cfTriCog(cog){return(_cfLet(cog,false)+_cfLet(cog,true)+'XXX').slice(0,3)}
  function _cfTriNome(nome){const c=_cfLet(nome,false);return c.length>=4?c[0]+c[2]+c[3]:(c+_cfLet(nome,true)+'XXX').slice(0,3)}
  function _ordinaNomeCognomeDaCF(full,cf){
    // deduce {nome,cognome} confrontando le triplette del codice fiscale; null se non determinabile
    const t=String(full||'').trim(),f=String(cf||'').toUpperCase()
    if(!t||!/^[A-Z]{6}[0-9]/.test(f))return null
    const parts=t.split(/\s+/).filter(Boolean)
    if(parts.length<2)return null
    for(let i=1;i<parts.length;i++){
      const a=parts.slice(0,i).join(' '),b=parts.slice(i).join(' ')
      if(_cfTriCog(b)===f.slice(0,3)&&_cfTriNome(a)===f.slice(3,6))return{nome:a,cognome:b}
      if(_cfTriCog(a)===f.slice(0,3)&&_cfTriNome(b)===f.slice(3,6))return{nome:b,cognome:a}
    }
    return null
  }
  // Chiave primaria di ogni tabella letta a blocchi: serve per ORDINARE.
  // Senza ORDER BY, LIMIT/OFFSET su PostgreSQL non garantisce lo stesso
  // ordine fra una pagina e l'altra — e allora una riga puo' uscire due
  // volte o non uscire affatto. Con la check-list (100 visite ≈ 5.200
  // righe, cioe' 6 pagine) succede a ogni estrazione.
  const _PK_CHUNK={visite:'visita_id',visite_checklist:'id',visite_imprese_presenti:'id',
    cantieri:'cantiere_id',imprese:'impresa_id',committenti:'committente_id',tecnici:'tecnico_id'}
  async function _inChunks(table,sel,col,ids,extra,avanza){
    // PostgREST restituisce max 1000 righe per richiesta: si spezzano gli id
    // in blocchi da 100 e si pagina finche' la pagina non e' incompleta.
    // Nessun tetto: si legge tutto quello che c'e'.
    const ord=_PK_CHUNK[table]||col
    const out=[]
    for(let i=0;i<ids.length;i+=100){
      let from=0
      for(;;){
        let q=sb.from(table).select(sel).in(col,ids.slice(i,i+100)).order(ord).range(from,from+999)
        if(extra)q=extra(q)
        const{data,error}=await q
        if(error)throw new Error(table+': '+error.message)
        out.push(...(data||[]))
        if(avanza)avanza(out.length)
        if(!data||data.length<1000)break
        from+=1000
      }
    }
    return out
  }
  /* Primo invio: l'intervallo copre tutto quello che c'e' in archivio.
     Le date si chiedono al database (prima e ultima visita definitiva),
     non si scrivono a mano: e' il modo di non lasciare fuori un pezzo. */
  async function admOssTuttoArchivio(){
    const btn=$('oss-tutto');const _t=btn?btn.textContent:''
    if(btn){btn.disabled=true;btn.textContent='⏳'}
    try{
      const[{data:pri},{data:ult}]=await Promise.all([
        sb.from('visite').select('data_visita').eq('elimina',0).eq('stato','definitivo')
          .not('data_visita','is',null).order('data_visita',{ascending:true}).limit(1),
        sb.from('visite').select('data_visita').eq('elimina',0).eq('stato','definitivo')
          .not('data_visita','is',null).order('data_visita',{ascending:false}).limit(1)
      ])
      if(!pri||!pri.length){toast('Nessuna visita definitiva in archivio','warn');return}
      vSet('oss-dal',String(pri[0].data_visita).slice(0,10))
      vSet('oss-al',String(ult[0].data_visita).slice(0,10))
      const rep=$('oss-report')
      if(rep)rep.innerHTML='Intervallo impostato su tutto l\'archivio: <b>'+vGet('oss-dal')+'</b> → <b>'+vGet('oss-al')+'</b>. Premi «Genera file XML».'
    }catch(e){toast('Errore: '+(e.message||e),'err')}
    finally{if(btn){btn.disabled=false;btn.textContent=_t}}
  }
  window.admOssTuttoArchivio=admOssTuttoArchivio

  async function admExportOsservatorio(){
    if(!S.user||S.user.email!==ADMIN_EMAIL){toast('Accesso negato','err');return}
    const dal=vGet('oss-dal'),al=vGet('oss-al')
    const rep=$('oss-report')
    if(!dal||!al){toast('Imposta le date Dal e Al','warn');return}
    const btn=$('oss-genera');const _t=btn.textContent;btn.disabled=true;btn.textContent='⏳ Estrazione…'
    if(rep)rep.innerHTML='Estrazione in corso…'
    try{
      // 1. visite definitive nell'intervallo (nessun tetto: si pagina finche' finiscono)
      const _passo=(t)=>{if(rep)rep.innerHTML='⏳ '+t}
      const visite=[]
      for(let vfrom=0;;vfrom+=1000){
        const{data:vs,error:ev}=await sb.from('visite')
          .select('visita_id,nr_verbale,cantiere_id,impresa_id,tecnico_id,tecnico2_id,tipo_accesso,data_visita,ora_visita,ora_fine,nr_imp,nr_lavoratori,nr_ind,resp_lav,csp,cse,coord,note_lav,comm_email,rl_nome,rl_cog,csp_nome,csp_cog,cse_nome,cse_cog')
          .eq('elimina',0).eq('stato','definitivo').gte('data_visita',dal).lte('data_visita',al)
          .order('data_visita').order('visita_id').range(vfrom,vfrom+999)
        if(ev)throw new Error(ev.message)
        visite.push(...(vs||[]))
        _passo('Lettura visite: '+visite.length+'…')
        if(!vs||vs.length<1000)break
      }
      /* Le NON definitive restano fuori per regola dell'Osservatorio, ma
         nell'invio massiccio bisogna saperlo: si contano e si dichiarano. */
      let nonDef=0
      try{
        const{count}=await sb.from('visite').select('visita_id',{count:'exact',head:true})
          .eq('elimina',0).neq('stato','definitivo').gte('data_visita',dal).lte('data_visita',al)
        nonDef=count||0
      }catch(_e){}
      if(!visite.length){if(rep)rep.innerHTML='Nessuna visita definitiva nell\'intervallo.';toast('Nessuna visita nell\'intervallo','warn');return}
      const vids=visite.map(v=>v.visita_id)
      // 2. checklist, ruolo impresa principale
      _passo(visite.length+' visite lette. Lettura check-list…')
      const chk=await _inChunks('visite_checklist','visita_id,codice,valore,nota','visita_id',vids,
        null,(n)=>_passo('Lettura check-list: '+n.toLocaleString('it-IT')+' righe…'))
      _passo(chk.length.toLocaleString('it-IT')+' righe di check-list. Lettura anagrafiche…')
      const vip=await _inChunks('visite_imprese_presenti','visita_id,ruolo,is_principale','visita_id',vids,q=>q.eq('is_principale',true))
      const ruoloMap={};vip.forEach(r=>{if(!ruoloMap[r.visita_id])ruoloMap[r.visita_id]=r.ruolo})
      // 3. anagrafiche collegate
      const cantIds=[...new Set(visite.map(v=>v.cantiere_id).filter(Boolean))]
      const cants=await _inChunks('cantieri','cantiere_id,cantiere_indirizzo,cantiere_civico,cantiere_etichetta,cantiere_cnce,cantiere_comune_cod,cantiere_cap,cantiere_tip_int,cantiere_tip_ope,cantiere_tip_ope_altro,cantiere_importo,cantiere_durata,cantiere_committente_id,comune_nome','cantiere_id',cantIds)
      const commIds=[...new Set(cants.map(c=>String(c.cantiere_committente_id||'').trim()).filter(Boolean))]
      const comms=commIds.length?await _inChunks('committenti','committente_id,committente_nome,committente_tipo','committente_id',commIds,q=>q.eq('elimina',0)):[]
      const impIds=[...new Set(visite.map(v=>v.impresa_id).filter(Boolean))]
      const imps=await _inChunks('imprese','impresa_id,impresa_nome,impresa_cf,impresa_email_ref,tipo_iscrizione_ccia,contratto_ccnl,contratto_ccnl_altro','impresa_id',impIds)
      const tecIds=[...new Set(visite.flatMap(v=>[v.tecnico_id,v.tecnico2_id]).filter(Boolean))]
      const tecs=await _inChunks('tecnici','tecnico_id,tecnico_cognome,tecnico_nome','tecnico_id',tecIds)

      const W={senzaChk:[],senzaImpresa:[],cantIncompleti:[],ruoloDefault:0,tipoExtra:0}
      // ── checklist → valutazioni per visita (dedup su id osservatorio, esito peggiore) ──
      const RANK={1:3,2:2,3:1}
      const valPerVisita={}
      chk.forEach(r=>{
        const oid=CHK2OSS[r.codice];if(!oid)return
        const val=String(r.valore||'')
        if(val==='NA'||val==='nota'&&!r.nota)return
        const esito=_OSS_ESITO[val]??null
        if(val!=='NC+'&&val!=='NC-'&&val!=='OSS'&&val!=='VER'&&val!=='nota')return
        const m=valPerVisita[r.visita_id]=valPerVisita[r.visita_id]||{}
        const cur=m[oid]
        const nota=(r.nota||'').trim()
        if(!cur)m[oid]={esito,nota}
        else{
          if(esito&&(!cur.esito||RANK[esito]>RANK[cur.esito]))cur.esito=esito
          if(nota)cur.nota=(cur.nota?cur.nota+' · ':'')+nota
        }
      })
      // ── XML VISITE ──
      const TIPO_MAP={1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:5,9:5,10:7}
      const RUOLO_MAP={'affidataria':1,'affidataria ed esecutrice':2,'esecutrice':3,'subappaltatrice':3,'lavoratore autonomo':3}
      let xv='<?xml version="1.0" encoding="utf-8"?>\n<visite>\n'
      let nVis=0,nVal=0
      visite.forEach(v=>{
        const vals=valPerVisita[v.visita_id]
        if(!vals||!Object.keys(vals).length){W.senzaChk.push(v.nr_verbale||v.visita_id);return}
        if(!v.impresa_id){W.senzaImpresa.push(v.nr_verbale||v.visita_id);return}
        const ta=+v.tipo_accesso||0
        if(ta>7)W.tipoExtra++
        const tipo=TIPO_MAP[ta]||5
        let ruolo=RUOLO_MAP[String(ruoloMap[v.visita_id]||'').toLowerCase()]
        if(!ruolo){ruolo=2;W.ruoloDefault++}
        xv+='<visita>'
        xv+=_xel('elimina',0)
        xv+=_xel('visitaId',v.visita_id,50)+_xel('cantiereId',v.cantiere_id,50)+_xel('impresaId',v.impresa_id,50)+_xel('tecnicoId',v.tecnico_id,50)
        if(v.tecnico2_id)xv+=_xel('secondoTecnicoId',v.tecnico2_id,50)
        xv+=_xel('visitaImpresaRuolo',ruolo)
        if(v.comm_email)xv+=_xel('visitaImpresaEmailRefVis',v.comm_email,128)
        if(v.nr_imp!=null)xv+=_xel('visitaImpreseCantiereNum',v.nr_imp)
        if(v.nr_lavoratori!=null)xv+=_xel('visitaLavoratoriCantiereNum',v.nr_lavoratori)
        if(v.nr_ind!=null)xv+=_xel('visitaLavoratoriCantiereAutNum',v.nr_ind)
        xv+=_xel('visitaTipo',tipo)
        const rl=(v.rl_nome&&v.rl_cog)?{nome:v.rl_nome,cognome:v.rl_cog}:_splitNome(v.resp_lav)
        if(rl&&rl.cognome.length>=2&&rl.nome.length>=2)xv+=`<responsabileLavori cognomeResponsabileLavori="${_xesc(rl.cognome.slice(0,128))}" nomeResponsabileLavori="${_xesc(rl.nome.slice(0,128))}" />`
        const csp=(v.csp_nome&&v.csp_cog)?{nome:v.csp_nome,cognome:v.csp_cog}:_splitNome(v.csp),cse=(v.cse_nome&&v.cse_cog)?{nome:v.cse_nome,cognome:v.cse_cog}:_splitNome(v.cse)
        let cAttr=`tipoPresenzaCoordinamento="${v.coord?1:2}"`
        if(csp&&csp.cognome.length>=2&&csp.nome.length>=2)cAttr+=` cognomeCoordinatoreFaseProgettazione="${_xesc(csp.cognome.slice(0,128))}" nomeCoordinatoreFaseProgettazione="${_xesc(csp.nome.slice(0,128))}"`
        if(cse&&cse.cognome.length>=2&&cse.nome.length>=2)cAttr+=` cognomeCoordinatoreFaseEsecuzione="${_xesc(cse.cognome.slice(0,128))}" nomeCoordinatoreFaseEsecuzione="${_xesc(cse.nome.slice(0,128))}"`
        xv+=`<coordinamento ${cAttr} />`
        if(v.note_lav)xv+=_xel('visitaFasiLavorazioneNotaGen',v.note_lav,5000)
        xv+='<visitaValutazioni>'
        Object.entries(vals).forEach(([oid,x])=>{
          let a=`visitaZonaId="${_xesc(oid)}"`
          if(x.esito)a+=` visitaZonaEsito="${x.esito}"`
          if(x.nota)a+=` visitaZonaNote="${_xesc(x.nota.slice(0,1000))}"`
          xv+=`<visitaValutazione ${a} />`
        })
        nVal+=Object.keys(vals).length
        xv+='</visitaValutazioni>'
        xv+=_xel('visitaData',v.data_visita)
        const oi=String(v.ora_visita||'').match(/^(\d{1,2}):(\d{2})/)
        if(oi){xv+=_xel('visitaOraInizio',+oi[1])+_xel('visitaMinutiInizio',+oi[2])}
        const of=String(v.ora_fine||'').match(/^(\d{1,2}):(\d{2})/)
        if(of){xv+=_xel('visitaOraFine',+of[1])+_xel('visitaMinutiFine',+of[2])}
        xv+='</visita>\n'
        nVis++
      })
      xv+='</visite>'
      // ── XML CANTIERI ──
      let xc='<?xml version="1.0" encoding="utf-8"?>\n<cantieri>\n'
      cants.forEach(c=>{
        const miss=[]
        let ti=+c.cantiere_tip_int||0
        if(![1,2,3,4,6,7,8].includes(ti)){miss.push('tipo intervento');ti=8}
        let to=+c.cantiere_tip_ope||0
        if(to<1||to>17){miss.push('tipo opera');to=16}
        let im=+c.cantiere_importo||0
        if(im<1||im>14){miss.push('importo');im=11}
        let du=+c.cantiere_durata||0
        if(du<1||du>8){miss.push('durata');du=8}
        let ind=String(c.cantiere_indirizzo||'').trim();if(ind.length<2){ind=(c.comune_nome||'ND');miss.push('indirizzo')}
        let civ=String(c.cantiere_civico||'').trim()||'SN'
        if(miss.length)W.cantIncompleti.push((c.cantiere_etichetta||ind)+' ('+miss.join(', ')+')')
        xc+='<cantiere>'+_xel('elimina',0)+_xel('cantiereId',c.cantiere_id,50)
        xc+=_xel('cantiereIndirizzo',ind,200)+_xel('cantiereCivico',civ,50)
        if(c.cantiere_etichetta)xc+=_xel('cantiereEtichetta',c.cantiere_etichetta,50)
        if(c.cantiere_cnce)xc+=_xel('cantiereCNCE',c.cantiere_cnce,50)
        if(/^\d{6}$/.test(String(c.cantiere_comune_cod||'')))xc+=_xel('cantiereComuneCod',c.cantiere_comune_cod)
        if(c.cantiere_cap)xc+=_xel('cantiereCap',c.cantiere_cap,5)
        xc+=_xel('cantiereTipInt',ti)+_xel('cantiereTipOpe',to)
        if(c.cantiere_tip_ope_altro)xc+=_xel('cantiereTipOpeAltro',c.cantiere_tip_ope_altro,128)
        xc+=_xel('cantiereImporto',im)+_xel('cantiereDurata',du)
        const cid=String(c.cantiere_committente_id||'').trim()
        if(cid)xc+=_xel('cantiereCommittenteId',cid,50)
        xc+='</cantiere>\n'
      })
      xc+='</cantieri>'
      // ── XML IMPRESE ──
      const CCIA_MAP={'artigiana':1,'industriale':2,'cooperativa':3,'commerciale':4,'altro':5}
      const CCNL_MAP={'edilizia industria':1,'edilizia artigianato':2}
      let xi='<?xml version="1.0" encoding="utf-8"?>\n<imprese>\n'
      imps.forEach(im=>{
        let nome=String(im.impresa_nome||'').trim();if(nome.length<2)nome=(nome+' – ND').trim()
        xi+='<impresa>'+_xel('elimina',0)+_xel('impresaId',im.impresa_id,50)+_xel('impresaNome',nome,256)
        if(im.impresa_cf)xi+=_xel('impresaCF',String(im.impresa_cf).slice(0,16))
        if(im.impresa_email_ref)xi+=_xel('impresaEmailRef',im.impresa_email_ref,128)
        const rawCcia=String(im.tipo_iscrizione_ccia||'').trim()
        const ccia=/^[1-5]$/.test(rawCcia)?+rawCcia:CCIA_MAP[rawCcia.toLowerCase()]
        if(ccia)xi+=_xel('tipoIscrizioneCcia',ccia)
        const rawCcnl=String(im.contratto_ccnl||'').trim()
        const ccnl=/^([1-9]|1[0-3])$/.test(rawCcnl)?+rawCcnl:CCNL_MAP[rawCcnl.toLowerCase()]
        if(ccnl){xi+=_xel('contrattoCcnl',ccnl);if(im.contratto_ccnl_altro)xi+=_xel('contrattoCcnlAltro',im.contratto_ccnl_altro,128)}
        xi+='</impresa>\n'
      })
      xi+='</imprese>'
      // ── XML COMMITTENTI ──
      let xm='<?xml version="1.0" encoding="utf-8"?>\n<committenti>\n'
      comms.forEach(co=>{
        let nome=String(co.committente_nome||'').trim();if(nome.length<2)nome=(nome+' – ND').trim()
        const tipo=[1,2,3].includes(+co.committente_tipo)?+co.committente_tipo:1
        xm+='<committente>'+_xel('elimina',0)+_xel('committenteId',co.committente_id,50)+_xel('committenteNome',nome,256)+_xel('committenteTipo',tipo)+'</committente>\n'
      })
      xm+='</committenti>'
      // ── XML TECNICI ──
      let xt='<?xml version="1.0" encoding="utf-8"?>\n<tecnici>\n'
      tecs.forEach(t=>{
        xt+='<tecnico>'+_xel('elimina',0)+_xel('tecnicoId',t.tecnico_id,50)+_xel('tecnicoCognome',t.tecnico_cognome||'ND',256)
        if(t.tecnico_nome)xt+=_xel('tecnicoNome',t.tecnico_nome,256)
        xt+='</tecnico>\n'
      })
      xt+='</tecnici>'
      // ── download ──
      const tag=dal.replace(/-/g,'')+'_'+al.replace(/-/g,'')
      const files=[['Visite_'+tag+'.xml',xv],['Cantieri_'+tag+'.xml',xc],['Imprese_'+tag+'.xml',xi],['Committenti_'+tag+'.xml',xm],['Tecnici_'+tag+'.xml',xt]]
      files.forEach((f,i)=>setTimeout(()=>_xdl(f[0],f[1]),i*600))
      const _peso=files.reduce((t,f)=>t+f[1].length,0)
      // ── riepilogo ──
      let h=`<b style="color:#95C22F">✔ Estrazione completata (${dal} → ${al})</b> <span style="color:rgba(255,255,255,.45)">— 5 file, ${(_peso/1048576).toFixed(1)} MB</span><br>`
      h+=`<span style="color:rgba(255,255,255,.55)">Il browser scarica cinque file di seguito: se chiede il permesso per i «download multipli», autorizzalo, altrimenti ne salva solo il primo.</span><br>`
      h+=`Visite esportate: <b>${nVis}</b> su ${visite.length} definitive · Cantieri: <b>${cants.length}</b> · Imprese: <b>${imps.length}</b> · Committenti: <b>${comms.length}</b> · Tecnici: <b>${tecs.length}</b><br>`
      h+=`<span style="color:rgba(255,255,255,.55)">Righe lette: check-list <b>${chk.length.toLocaleString('it-IT')}</b> · valutazioni scritte <b>${nVal.toLocaleString('it-IT')}</b>. Nessun limite di righe: le letture sono paginate e ordinate sulla chiave primaria.</span><br>`
      if(nonDef)h+=`<span style="color:#f39c12">⚠ ${nonDef} visite del periodo NON sono definitive e restano fuori dall'invio: chiudile prima di trasmettere.</span><br>`
      if(W.senzaChk.length)h+=`<span style="color:#f39c12">⚠ ${W.senzaChk.length} visite ESCLUSE perché senza checklist compilata (obbligatoria per l'Osservatorio): ${W.senzaChk.slice(0,30).join(', ')}${W.senzaChk.length>30?'…':''}</span><br>`
      if(W.senzaImpresa.length)h+=`<span style="color:#f39c12">⚠ ${W.senzaImpresa.length} visite escluse senza impresa principale: ${W.senzaImpresa.slice(0,20).join(', ')}</span><br>`
      if(W.cantIncompleti.length)h+=`<span style="color:#f39c12">⚠ ${W.cantIncompleti.length} cantieri con dati obbligatori mancanti (esportati con valore di ripiego): ${W.cantIncompleti.slice(0,15).join('; ')}${W.cantIncompleti.length>15?'…':''}</span><br>`
      if(W.ruoloDefault)h+=`<span style="color:#f39c12">⚠ ${W.ruoloDefault} visite senza ruolo impresa: usato "Affidataria ed esecutrice"</span><br>`
      if(W.tipoExtra)h+=`<span style="color:rgba(255,255,255,.5)">ℹ ${W.tipoExtra} visite con tipo accesso locale (visite in serie/stage/asseverazione) ricondotte ai tipi Osservatorio</span><br>`
      if(rep)rep.innerHTML=h
      toast('File XML generati: '+nVis+' visite','ok')
    }catch(e){
      console.error('admExportOsservatorio:',e)
      if(rep)rep.innerHTML='<span style="color:#e74c3c">Errore: '+_xesc(e.message||e)+'</span>'
      toast('Errore estrazione: '+(e.message||e),'err')
    }finally{btn.disabled=false;btn.textContent=_t}
  }
  window.admExportOsservatorio=admExportOsservatorio

  return {
    _inChunks, _splitFigura, _figSnap, _ordinaNomeCognomeDaCF, _splitNome,
    _xesc, _xel, _xdl, admOssTuttoArchivio, admExportOsservatorio,
    CHK2OSS, _OSS_ESITO, _PK_CHUNK,
  }
}
