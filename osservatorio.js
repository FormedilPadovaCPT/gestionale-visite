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
   questo vengono restituiti. admExportOsservatorio, admOssControlla, admOssTessera e admOssTuttoArchivio
   si agganciano a window per gli onclick inline del pannello Segreteria.
   ============================================================ */

export function creaOsservatorio({ sb, S, ADMIN_EMAIL, $, vGet, vSet, toast }) {
  for (const [nome, v] of Object.entries({ sb, S, ADMIN_EMAIL, $, vGet, vSet, toast })) {
    if (v === undefined) throw new Error('osservatorio.js: manca la dipendenza ' + nome)
  }

  // ── ESTRAZIONE XML OSSERVATORIO ─────────────────────────────
  // Mappatura voce checklist gestionale → ValutazioneID ufficiale Osservatorio (form CNCPT)
  const CHK2OSS={"IMP_LOG_001":1,"IMP_LOG_002":2,"IMP_LOG_003":3,"IMP_LOG_004":4,"IMP_LOG_005":5,"IMP_LOG_006":6,"IMP_LOG_007":202,"IMP_LOG_008":8,"IMP_LOG_009":9,"IMP_IGS_001":10,"IMP_IGS_002":11,"IMP_IGS_009":200,"IMP_IGS_003":12,"IMP_IGS_004":13,"IMP_IGS_005":14,"IMP_IGS_006":15,"IMP_IGS_008":201,"IMP_IGS_007":16,"IMP_ELE_001":17,"IMP_ELE_002":18,"IMP_ELE_003":19,"IMP_ELE_004":20,"IMP_ELE_005":21,"IMP_ELE_006":22,"IMP_ELE_007":23,"IMP_ELE_008":24,"IMP_AGI_001":25,"IMP_AGI_002":26,"IMP_AGI_003":27,"IMP_ORG_001":28,"IMP_ORG_002":29,"IMP_ORG_003":30,"IMP_ORG_004":31,"IMP_ORG_005":32,"IMP_ORG_006":33,"IMP_SEG_001":34,"IMP_SEG_002":35,"IMP_SEG_003":36,"IMP_CON_001":203,"IMP_CON_002":204,"IMP_CON_003":205,"IMP_CON_004":206,"PLL_SCA_001":37,"PLL_SCA_002":38,"PLL_SCA_003":39,"PLL_SCA_004":207,"PLL_SCA_005":208,"PLL_SCA_006":209,"PLL_SCA_007":210,"PLL_DEM_001":40,"PLL_DEM_002":41,"PLL_DEM_003":42,"PLL_DEM_004":214,"PLL_DEM_005":211,"PLL_DEM_006":212,"PLL_DEM_007":213,"PLL_OCA_001":215,"PLL_OCA_002":216,"PLL_OCA_003":217,"PLL_OCA_004":218,"PLL_OCA_005":240,"PLL_PER_001":43,"PLL_PER_002":44,"PLL_PER_003":45,"PLL_PER_004":46,"SOL_GRU_001":47,"SOL_GRU_002":48,"SOL_GRU_003":49,"SOL_GRU_004":50,"SOL_GRU_005":51,"SOL_GRU_006":52,"SOL_GRU_007":53,"SOL_GRU_008":54,"SOL_GRU_009":55,"SOL_GRU_010":56,"SOL_AUT_002":58,"SOL_AUT_003":59,"SOL_AUT_004":60,"SOL_AUT_005":61,"SOL_AUT_006":62,"SOL_AUT_007":63,"SOL_AUT_008":64,"SOL_AUT_009":65,"SOL_AUT_010":66,"SOL_AUT_011":67,"SOL_ARG_002":69,"SOL_ARG_003":70,"SOL_ARG_004":71,"SOL_ARG_005":72,"SOL_ARG_006":73,"SOL_ARG_007":241,"SOL_ASO_001":50,"SOL_ASO_002":51,"SOL_ASO_003":52,"SOL_ASO_004":53,"SOL_PIA_001":74,"SOL_PIA_002":75,"SOL_PIA_003":76,"SOL_PIA_004":77,"SOL_PIA_005":78,"SOL_PIA_006":242,"ASU_ATT_001":79,"ASU_ATT_002":80,"ASU_ATT_003":81,"ASU_ATT_004":82,"ASU_ATT_005":83,"ASU_ATT_006":84,"ASU_ATT_007":85,"ASU_ATT_008":86,"ASU_ATT_009":87,"ASU_ATT_010":88,"ASU_ATT_011":89,"ASU_ATT_012":90,"ASU_ATT_013":219,"ASU_SCA_001":91,"ASU_SCA_002":92,"ASU_SCA_003":93,"ASU_SCA_004":94,"ASU_UTE_001":95,"ASU_UTE_002":221,"ASU_UTE_003":97,"ASU_UTE_004":98,"ASU_UTE_005":99,"ASU_UTE_006":100,"ASU_UTE_007":101,"ASU_UTE_008":102,"ASU_UTE_009":103,"ASU_UTE_010":104,"ASU_UTE_011":105,"ASU_UTE_012":106,"ASU_UTE_013":107,"ASU_UTE_014":108,"ASU_UTE_015":222,"ASU_UTE_016":223,"MAC_MMT_001":109,"MAC_MMT_002":110,"MAC_MMT_003":111,"MAC_MMT_004":112,"MAC_MMT_005":113,"MAC_MMT_006":114,"MAC_MMT_007":115,"MAC_MMM_001":117,"MAC_MMM_002":118,"MAC_MMM_003":119,"MAC_MMM_004":120,"MAC_MMM_005":121,"MAC_MMM_006":122,"MAC_MAS_001":123,"MAC_MAS_002":124,"MAC_MAS_003":125,"MAC_MAS_004":126,"MAC_MAS_005":127,"MAC_MAS_006":128,"OPE_POF_001":129,"OPE_POF_002":130,"OPE_POF_003":131,"OPE_POF_004":132,"OPE_POF_005":133,"OPE_POF_006":134,"OPE_POF_007":135,"OPE_POF_008":136,"OPE_POF_010":224,"OPE_POF_011":225,"OPE_POF_012":226,"OPE_POF_013":227,"OPE_POF_014":228,"OPE_POF_015":229,"OPE_POF_016":230,"OPE_POF_017":232,"OPE_POF_018":233,"OPE_POF_019":234,"OPE_POF_020":235,"OPE_POF_021":236,"OPE_POF_022":231,"OPE_POF_009":137,"MAC_MMT_008":116,"OPE_POS_001":138,"OPE_POS_002":139,"OPE_POS_003":140,"OPE_POS_004":141,"OPE_POS_005":142,"OPE_POS_006":143,"OPE_POS_007":144,"OPE_POS_008":237,"OPE_POC_001":145,"OPE_POC_002":146,"OPE_POC_003":147,"OPE_POC_004":238,"OPE_POT_001":148,"OPE_POT_002":149,"OPE_POT_003":150,"OPE_POT_004":151,"OPE_POT_005":152,"OPE_POT_006":153,"OPE_POT_007":154,"OPE_POT_008":155,"OPE_POT_009":239,"OPE_DPC_001":156,"OPE_DPC_002":157,"OPE_DPC_003":158,"OPE_DPC_005":159,"OPE_DPC_006":160,"PIN_IND_001":161,"PIN_IND_002":162,"PIN_TES_001":163,"PIN_TES_002":164,"PIN_PIE_001":165,"PIN_PIE_002":166,"PIN_MAN_001":167,"PIN_MAN_002":168,"PIN_MAN_003":169,"PIN_UDI_001":170,"PIN_UDI_002":171,"PIN_CAD_001":172,"PIN_CAD_002":173,"PIN_CAD_003":174,"PIN_CAD_004":175,"PIN_OCC_001":176,"PIN_OCC_002":177,"PIN_OCC_003":178,"PIN_RES_001":179,"PIN_RES_002":180,"DOC_GEN_001":199,"DOC_GEN_002":196,"DOC_GEN_003":198,"DOC_GEN_004":250,"DOC_GEN_005":245,"DOC_GEN_006":249,"DOC_GEN_008":244,"DOC_GEN_009":251,"DOC_GEN_010":243,"DOC_GEN_011":248,"DOC_GEN_012":253,"DOC_GEN_013":252,"DOC_GEN_014":246,"DOC_GEN_015":247,"DOC_GEN_SOL_001":255,"DOC_GEN_SOL_002":257,"DOC_GEN_SOL_003":260,"DOC_GEN_SOL_004":261,"DOC_GEN_SOL_005":256,"DOC_GEN_SOL_006":258,"DOC_GEN_SOL_007":262,"DOC_GEN_SOL_008":195,"DOC_GEN_SOL_009":254,"DOC_GEN_SOL_010":259,"DOC_MA4_001":263,"DOC_MA4_002":264,"DOC_MA4_003":265,"DOC_MA4_004":266,"DOC_MA4_005":269,"DOC_MA4_006":267,"DOC_MA4_007":268,"DOC_MA4_008":271,"DOC_MA4_009":272,"DOC_ELE_001":274,"DOC_ELE_002":275,"DOC_ELE_003":273,"DOC_ELE_004":277,"DOC_ELE_005":278,"DOC_ELE_006":276,"DOC_PON_001":281,"DOC_PON_002":283,"DOC_PON_003":280,"DOC_PON_004":284,"DOC_PON_005":279,"DOC_PON_006":282,"SOG_FIG_001":288,"SOG_FIG_002":294,"SOG_FIG_003":292,"SOG_FIG_004":293,"SOG_FIG_005":290,"SOG_FIG_006":286,"SOG_FIG_007":285,"SOG_FIG_008":291,"SOG_FIG_009":287,"SOG_FIG_010":289,"FOR_BAS_001":189,"FOR_FIG_001":295,"FOR_FIG_002":296,"FOR_FIG_003":297,"FOR_FIG_004":302,"FOR_FIG_005":303,"FOR_FIG_006":304,"FOR_FIG_007":301,"FOR_FIG_008":300,"FOR_FIG_009":299,"FOR_FIG_010":298,"FOR_RIS_001":313,"FOR_RIS_002":314,"FOR_RIS_003":305,"FOR_RIS_004":310,"FOR_RIS_005":311,"FOR_RIS_006":306,"FOR_RIS_007":309,"FOR_RIS_008":308,"FOR_RIS_009":307,"FOR_RIS_010":312,"FOR_ATM_001":317,"FOR_ATM_002":315,"FOR_ATM_003":318,"FOR_ATM_004":323,"FOR_ATM_005":322,"FOR_ATM_006":316,"FOR_ATM_007":319,"FOR_ATM_008":320,"FOR_ATM_009":321,"FOR_ATM_010":270,"SOL_AUT_001":57,"SOL_ARG_001":68,"DOC_GEN_007":197,"DOC_PON_007":247}
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

  /* ══ (03/10/2026) ESPORTAZIONE SENZA VALORI DI RIPIEGO ═══════════════════
     Fino a oggi, dove mancava un dato obbligatorio, qui si metteva un valore
     di ripiego (ruolo → 2, tipo di intervento → 8, opera → 16, importo → 11,
     durata → 7, tipo del committente → 3) e lo si diceva a file già scaricati.
     Da oggi una visita a cui manca un dato obbligatorio per l'Osservatorio
     NON ESCE, e lo si dice prima.
       · Che cosa è «pronto» lo decide il database: osservatorio_controllo()
         (supabase/sql/2026_10_03_osservatorio_controllo.sql). Senza la sua
         risposta non si esporta.
       · Le funzioni oss* qui sotto sono pure e NON hanno ripieghi: se un dato
         manca restituiscono null o l'elenco di ciò che manca. Sono la seconda
         rete: se scartano una visita che il database dava per pronta, le due
         regole non sono più allineate, e il riepilogo lo dice.
       · Cantieri, imprese, committenti e tecnici escono solo se li cita una
         visita esportata. */
  const TIPO_MAP={1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:2,9:3,10:2,11:2,12:3}
  const RUOLO_MAP={'affidataria':1,'affidataria ed esecutrice':2,'esecutrice':3,'subappaltatrice':3,'lavoratore autonomo':3,'fornitrice':3}
  const TIPOIMP_MAP={1:1,2:2,3:3,4:3,5:3}   // visite_imprese_presenti.tipo_imp → ruolo nazionale
  const RANK={1:3,2:2,3:1}
  // riga principale di visite_imprese_presenti → 1 affidataria, 2 affidataria ed esecutrice, 3 esecutrice; null se non si sa
  function ossRuolo(riga){
    if(!riga)return null
    return RUOLO_MAP[String(riga.ruolo||'').trim().toLowerCase()]||TIPOIMP_MAP[+riga.tipo_imp]||null
  }
  // Il tipo di visita per l'Osservatorio lo calcola il database (visite.tipo_accesso_naz, 30/09/2026):
  // serie, asseverazione e attestazione/consulenza → 2 «Su richiesta»; stage e progetti SPISAL → 3
  // «Per protocolli di intesa». TIPO_MAP è la stessa conversione. Senza tipo di accesso: null.
  function ossTipoVisita(v){
    const n=+(v&&v.tipo_accesso_naz)
    if(n>=1&&n<=7)return n
    return TIPO_MAP[+(v&&v.tipo_accesso)]||null
  }
  // che cosa manca alla scheda del cantiere per l'Osservatorio (codici uguali a osservatorio_controllo)
  function ossCantiereManca(c){
    const manca=[]
    if(!c)return['cantiere']
    const ti=+c.cantiere_tip_int||0,to=+c.cantiere_tip_ope||0,im=+c.cantiere_importo||0,du=+c.cantiere_durata||0
    if(String(c.cantiere_indirizzo||'').trim().length<2)manca.push('cantiere-indirizzo')
    if(!String(c.cantiere_civico||'').trim())manca.push('cantiere-civico')
    if(!/^\d{6}$/.test(String(c.cantiere_comune_cod||'')))manca.push('cantiere-comune')
    if(ti<1||ti>4)manca.push('cantiere-intervento')     // 5 «Altro» era nostro: la tabella nazionale non lo prevede
    if(to<1||to>16)manca.push('cantiere-opera')          // codifica nazionale 1-16 (30/09/2026)
    if(im<1||im>11)manca.push('cantiere-importo')        // 11 = non disponibile (ammesso)
    if(du<1||du>7)manca.push('cantiere-durata')          // 7 = non disponibile (ammesso)
    return manca
  }
  // tabella 6 del manuale: 1 Pubblico, 2 Privato, 3 Non disponibile. Senza tipo: null (prima usciva 3)
  function ossCommittenteTipo(co){const t=+(co&&co.committente_tipo);return t===1||t===2||t===3?t:null}
  // check-list → valutazioni per visita (dedup sull'id dell'Osservatorio, vale l'esito peggiore)
  function ossValutazioni(chk){
    const valPerVisita={}
    ;(chk||[]).forEach(r=>{
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
    return valPerVisita
  }
  /* Quali visite escono. ferme = Set degli id che il database non dà per pronti.
     Restituisce {esporta:[{v,vals,ruolo,tipo}], scarti:[{v,perche:[codici]}]}: gli scarti sono
     visite che il database dava per pronte e che qui non hanno tutto. */
  function ossScegli({visite,ferme,valPerVisita,ruoloRiga,cantMap,commMap,impMap,tecMap}){
    const esporta=[],scarti=[]
    ;(visite||[]).forEach(v=>{
      if(ferme&&ferme.has(v.visita_id))return
      const perche=[]
      const vals=valPerVisita[v.visita_id]
      if(!vals||!Object.keys(vals).length)perche.push('checklist')
      const imp=impMap[v.impresa_id]
      if(!imp||String(imp.impresa_nome||'').trim().length<2)perche.push('impresa')
      const ruolo=ossRuolo(ruoloRiga[v.visita_id])
      if(!ruolo)perche.push('ruolo')
      const tipo=ossTipoVisita(v)
      if(!tipo)perche.push('tipo-visita')
      const tec=tecMap[v.tecnico_id]
      if(!tec||!String(tec.tecnico_cognome||'').trim())perche.push('tecnico')
      const c=cantMap[v.cantiere_id]
      perche.push(...ossCantiereManca(c))
      const cid=c?String(c.cantiere_committente_id||'').trim():''
      if(cid){
        const co=commMap[cid]
        if(!co||String(co.committente_nome||'').trim().length<2)perche.push('committente')
        else if(!ossCommittenteTipo(co))perche.push('committente-tipo')
      }
      if(perche.length)scarti.push({v,perche})
      else esporta.push({v,vals,ruolo,tipo})
    })
    return{esporta,scarti}
  }
  // I cinque file, con le sole visite scelte e le sole anagrafiche che quelle visite citano.
  function ossXml({esporta,cantMap,commMap,impMap,tecMap}){
    let xv='<?xml version="1.0" encoding="utf-8"?>\n<visite>\n'
    let nVal=0
    const cantIds=new Set(),impIds=new Set(),tecIds=new Set()
    esporta.forEach(({v,vals,ruolo,tipo})=>{
      cantIds.add(v.cantiere_id);impIds.add(v.impresa_id);tecIds.add(v.tecnico_id)
      xv+='<visita>'
      xv+=_xel('elimina',0)
      xv+=_xel('visitaId',v.visita_id,50)+_xel('cantiereId',v.cantiere_id,50)+_xel('impresaId',v.impresa_id,50)+_xel('tecnicoId',v.tecnico_id,50)
      if(v.tecnico2_id&&tecMap[v.tecnico2_id]){xv+=_xel('secondoTecnicoId',v.tecnico2_id,50);tecIds.add(v.tecnico2_id)}
      xv+=_xel('visitaImpresaRuolo',ruolo)
      /* (03/10/2026) visitaImpresaEmailRefVis è l'e-mail del referente DELL'IMPRESA in quella visita.
         Qui ci finiva quella del committente (41 visite nell'invio del 22/07/2026). Un indirizzo
         legato alla singola visita non lo registriamo: il campo è facoltativo e non si esporta;
         l'e-mail dell'impresa va già nel file delle imprese (impresaEmailRef). */
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
    })
    xv+='</visite>'
    // ── XML CANTIERI ──
    let xc='<?xml version="1.0" encoding="utf-8"?>\n<cantieri>\n'
    const commIds=new Set()
    ;[...cantIds].forEach(id=>{
      const c=cantMap[id]
      xc+='<cantiere>'+_xel('elimina',0)+_xel('cantiereId',c.cantiere_id,50)
      xc+=_xel('cantiereIndirizzo',String(c.cantiere_indirizzo).trim(),200)+_xel('cantiereCivico',String(c.cantiere_civico).trim(),50)
      if(c.cantiere_etichetta)xc+=_xel('cantiereEtichetta',c.cantiere_etichetta,50)
      if(c.cantiere_cnce)xc+=_xel('cantiereCNCE',c.cantiere_cnce,50)
      xc+=_xel('cantiereComuneCod',c.cantiere_comune_cod)
      if(c.cantiere_cap)xc+=_xel('cantiereCap',c.cantiere_cap,5)
      xc+=_xel('cantiereTipInt',+c.cantiere_tip_int)+_xel('cantiereTipOpe',+c.cantiere_tip_ope)
      if(c.cantiere_tip_ope_altro)xc+=_xel('cantiereTipOpeAltro',c.cantiere_tip_ope_altro,128)
      xc+=_xel('cantiereImporto',+c.cantiere_importo)+_xel('cantiereDurata',+c.cantiere_durata)
      const cid=String(c.cantiere_committente_id||'').trim()
      if(cid){xc+=_xel('cantiereCommittenteId',cid,50);commIds.add(cid)}
      xc+='</cantiere>\n'
    })
    xc+='</cantieri>'
    // ── XML IMPRESE ──
    const CCIA_MAP={'artigiana':1,'industriale':2,'cooperativa':3,'commerciale':4,'altro':5}
    const CCNL_MAP={'edilizia industria':1,'edilizia artigianato':2}
    let xi='<?xml version="1.0" encoding="utf-8"?>\n<imprese>\n'
    ;[...impIds].forEach(id=>{
      const im=impMap[id]
      xi+='<impresa>'+_xel('elimina',0)+_xel('impresaId',im.impresa_id,50)+_xel('impresaNome',String(im.impresa_nome).trim(),256)
      if(im.impresa_cf)xi+=_xel('impresaCF',String(im.impresa_cf).slice(0,16))
      if(im.impresa_email_ref)xi+=_xel('impresaEmailRef',im.impresa_email_ref,128)
      const rawCcia=String(im.tipo_iscrizione_ccia||'').trim()
      const ccia=/^[1-5]$/.test(rawCcia)?+rawCcia:CCIA_MAP[rawCcia.toLowerCase()]
      // lo schema dell'Osservatorio ammette solo 1, 2, 3: un 4 o un 5 farebbe scartare il file (il campo e' facoltativo)
      if(ccia&&ccia<=3)xi+=_xel('tipoIscrizioneCcia',ccia)
      const rawCcnl=String(im.contratto_ccnl||'').trim()
      const ccnl=/^([1-9]|1[0-3])$/.test(rawCcnl)?+rawCcnl:CCNL_MAP[rawCcnl.toLowerCase()]
      if(ccnl){xi+=_xel('contrattoCcnl',ccnl);if(im.contratto_ccnl_altro)xi+=_xel('contrattoCcnlAltro',im.contratto_ccnl_altro,128)}
      xi+='</impresa>\n'
    })
    xi+='</imprese>'
    // ── XML COMMITTENTI ──
    let xm='<?xml version="1.0" encoding="utf-8"?>\n<committenti>\n'
    ;[...commIds].forEach(id=>{
      const co=commMap[id]
      xm+='<committente>'+_xel('elimina',0)+_xel('committenteId',co.committente_id,50)+_xel('committenteNome',String(co.committente_nome).trim(),256)+_xel('committenteTipo',ossCommittenteTipo(co))+'</committente>\n'
    })
    xm+='</committenti>'
    // ── XML TECNICI ──
    let xt='<?xml version="1.0" encoding="utf-8"?>\n<tecnici>\n'
    ;[...tecIds].forEach(id=>{
      const t=tecMap[id]
      xt+='<tecnico>'+_xel('elimina',0)+_xel('tecnicoId',t.tecnico_id,50)+_xel('tecnicoCognome',String(t.tecnico_cognome).trim(),256)
      if(t.tecnico_nome)xt+=_xel('tecnicoNome',t.tecnico_nome,256)
      xt+='</tecnico>\n'
    })
    xt+='</tecnici>'
    return{xv,xc,xi,xm,xt,nVis:esporta.length,nVal,nCant:cantIds.size,nImp:impIds.size,nComm:commIds.size,nTec:tecIds.size}
  }

  // ── Il controllo e il suo elenco ──────────────────────────────
  async function _ossLeggiControllo(dal,al,dettaglio){
    const{data,error}=await sb.rpc('osservatorio_controllo',{p_dal:dal,p_al:al,p_dettaglio:dettaglio!==false})
    if(error)throw new Error('non sono riuscito a controllare i dati obbligatori ('+error.message+'). Senza controllo non si esporta: riprova')
    if(!data||typeof data.definitive!=='number')throw new Error('il controllo dei dati obbligatori ha risposto in modo inatteso. Senza controllo non si esporta')
    return data
  }
  const _ossData=d=>{const m=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:String(d||'')}
  const _ossBreve=t=>String(t||'').replace(/^Scheda del cantiere: /,'').replace(/\s*\(.*\)\s*$/,'')
  const _OSS_DI_VISITA=['impresa','ruolo','tipo-visita','checklist','tecnico','cantiere']
  // (05/10/2026) i numeri di verbale del cantiere nel periodo; se il database non li manda, il solo conteggio
  const _ossVerbali=c=>(c.verbali&&c.verbali.length)?c.verbali.map(_xesc).join('<br>'):String(c.visite||'')
  function _ossElenco(ctrl,o){
    o=o||{}
    const testo={};(ctrl.motivi||[]).forEach(m=>{testo[m.cosa]=m.testo})
    const cosa=l=>(l||[]).map(k=>_xesc(_ossBreve(testo[k]||k))).join(' · ')
    const blocchi=(ctrl.motivi||[]).filter(m=>m.blocca),avvisi=(ctrl.motivi||[]).filter(m=>!m.blocca)
    const th='style="text-align:left;padding:3px 8px;color:rgba(255,255,255,.5);font-weight:600;border-bottom:1px solid rgba(255,255,255,.15)"'
    const td='style="padding:3px 8px;border-bottom:1px solid rgba(255,255,255,.07);vertical-align:top"'
    let h=`Dal <b>${_ossData(ctrl.dal)}</b> al <b>${_ossData(ctrl.al)}</b>: <b>${ctrl.definitive}</b> visite definitive · <b style="color:#95C22F">${ctrl.pronte} pronte</b>`
    if(ctrl.ferme)h+=` · <b style="color:#f39c12">${ctrl.ferme} ferme</b>`
    if(ctrl.con_avvisi)h+=` · ${ctrl.con_avvisi} pronte con un «Non disponibile»`
    h+='<br>'
    if(ctrl.non_definitive)h+=`<span style="color:#f39c12">⚠ ${ctrl.non_definitive} visite del periodo sono ancora bozze: restano fuori finché non si chiudono.</span><br>`
    if(!ctrl.definitive)return h+'Nessuna visita definitiva nel periodo.'
    if(!ctrl.ferme&&!(o.scarti&&o.scarti.length))h+='<span style="color:#95C22F">✔ Tutte le visite definitive hanno i dati obbligatori per l\'Osservatorio.</span><br>'
    if(ctrl.ferme){
      h+='<div style="margin-top:8px"><b style="color:#f39c12">Perché sono ferme</b> (una visita ferma non entra nei file finché il dato non c\'è):</div>'
      h+=blocchi.map(m=>`• ${_xesc(m.testo)} — <b>${m.visite}</b> ${m.visite===1?'visita':'visite'}${m.dove==='cantiere'?', '+m.cantieri+(m.cantieri===1?' cantiere':' cantieri'):''}`).join('<br>')+'<br>'
      const cf=(ctrl.cantieri||[]).filter(c=>(c.blocchi||[]).length)
      if(cf.length){
        h+=`<div style="margin-top:10px"><b>Cantieri da completare (${cf.length})</b> — «✏️ Scheda» apre la scheda del cantiere: salvata, l'elenco si aggiorna da solo.</div>`
        h+=`<div style="max-height:340px;overflow:auto;margin-top:4px"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th ${th}>Cantiere</th><th ${th}>Comune</th><th ${th}>Verbali</th><th ${th}>Che cosa manca</th><th ${th}></th></tr>`
        h+=cf.map(c=>`<tr><td ${td}>${_xesc(c.cantiere||c.cantiere_id)}</td><td ${td}>${_xesc(c.comune||'')}</td><td ${td}>${_ossVerbali(c)}</td><td ${td}>${cosa(c.blocchi)}</td><td ${td}><button class="btn-outline btn-sm" data-oss-cant="${_xesc(c.cantiere_id)}" data-aiuto="Apre la scheda del cantiere per completare il dato che manca. Salvata la scheda, il controllo si rifà da solo.">✏️ Scheda</button></td></tr>`).join('')
        h+='</table></div>'
      }
      const vf=(ctrl.visite||[]).filter(v=>(v.blocchi||[]).some(k=>_OSS_DI_VISITA.includes(k)))
      if(vf.length){
        h+=`<div style="margin-top:10px"><b>Verbali da completare (${vf.length})</b> — «✏️ Verbale» lo apre in modifica: dopo la correzione va salvato.</div>`
        h+=`<div style="max-height:260px;overflow:auto;margin-top:4px"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th ${th}>Verbale</th><th ${th}>Data</th><th ${th}>Tecnico</th><th ${th}>Impresa</th><th ${th}>Che cosa manca</th><th ${th}></th></tr>`
        h+=vf.map(v=>`<tr><td ${td}>${_xesc(v.nr_verbale||v.visita_id)}</td><td ${td}>${_ossData(v.data)}</td><td ${td}>${_xesc(v.tecnico||'')}</td><td ${td}>${_xesc(v.impresa||'')}</td><td ${td}>${cosa((v.blocchi||[]).filter(k=>_OSS_DI_VISITA.includes(k)))}</td><td ${td}><button class="btn-outline btn-sm" data-oss-vis="${_xesc(v.visita_id)}" data-aiuto="Apre il verbale definitivo in modifica, dopo una conferma. Corretto il dato, va salvato di nuovo.">✏️ Verbale</button></td></tr>`).join('')
        h+='</table></div>'
      }
    }
    if(o.scarti&&o.scarti.length){
      h+=`<div style="margin-top:10px;color:#e74c3c"><b>⚠ ${o.scarti.length} visite scartate dal controllo dell'esportazione</b>: il database le dava per pronte, ma al momento di scrivere i file mancava un dato. Non sono nei file. Va segnalato a chi mantiene il gestionale.<br>`
      h+=o.scarti.slice(0,40).map(s=>_xesc(s.v.nr_verbale||s.v.visita_id)+' ('+s.perche.map(k=>_xesc(_ossBreve(testo[k]||k))).join(', ')+')').join('; ')+(o.scarti.length>40?'…':'')+'</div>'
    }
    if(avvisi.length){
      const ca=(ctrl.cantieri||[]).filter(c=>(c.avvisi||[]).length)
      h+=`<details style="margin-top:10px"><summary style="cursor:pointer;color:rgba(255,255,255,.6)">ℹ Escono lo stesso, con un dato «Non disponibile» o incompleto (${avvisi.map(m=>m.cantieri).reduce((a,b)=>a+b,0)} segnalazioni su ${ca.length||'alcuni'} cantieri)</summary>`
      h+=avvisi.map(m=>`• ${_xesc(m.testo)} — ${m.cantieri} ${m.cantieri===1?'cantiere':'cantieri'}, ${m.visite} ${m.visite===1?'visita':'visite'}`).join('<br>')
      if(ca.length){
        h+=`<div style="max-height:260px;overflow:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th ${th}>Cantiere</th><th ${th}>Comune</th><th ${th}>Verbali</th><th ${th}>Che cosa</th><th ${th}></th></tr>`
        h+=ca.map(c=>`<tr><td ${td}>${_xesc(c.cantiere||c.cantiere_id)}</td><td ${td}>${_xesc(c.comune||'')}</td><td ${td}>${_ossVerbali(c)}</td><td ${td}>${cosa(c.avvisi)}</td><td ${td}><button class="btn-outline btn-sm" data-oss-cant="${_xesc(c.cantiere_id)}" data-aiuto="Apre la scheda del cantiere per completare il dato che manca. Salvata la scheda, il controllo si rifà da solo.">✏️ Scheda</button></td></tr>`).join('')
        h+='</table></div>'
      }
      h+='</details>'
    }
    return h
  }
  // un solo ascoltatore per i pulsanti dell'elenco e della tessera: gli id non passano da un onclick scritto a mano
  function _ossClick(e){
    const b=e.target&&e.target.closest?e.target.closest('[data-oss-cant],[data-oss-vis],[data-oss-az],[data-oss-dal]'):null
    if(!b)return
    // (05/10/2026) salvata la scheda, l'elenco si rifà da solo (saveCantiere guarda _ossRicontrolla)
    if(b.dataset.ossCant){if(typeof window.admEditCantiere==='function'){window._ossRicontrolla=b.dataset.ossCant;window._ossDopoScheda=b.closest('#oss-sis')?_sisDopoScheda:admOssControlla;window._mcGeoFrom=null;window.admEditCantiere(b.dataset.ossCant)}return}
    if(b.dataset.ossVis){if(typeof window.modificaVisitaCoord==='function')window.modificaVisitaCoord(b.dataset.ossVis);return}
    if(b.dataset.ossAz==='scarica'){_ossScarica();return}
    if(b.dataset.ossDal){vSet('oss-dal',b.dataset.ossDal);vSet('oss-al',b.dataset.ossAl);admOssControlla();const r=$('oss-report');if(r&&r.scrollIntoView)r.scrollIntoView({behavior:'smooth',block:'center'})}
  }
  function _ossAscolta(el){if(el&&!el._ossAscolta){el.addEventListener('click',_ossClick);el._ossAscolta=true}}

  let _ossPronti=null   // file già costruiti, in attesa di «Scarica lo stesso»
  function _ossScarica(){
    if(!_ossPronti){toast('Non ci sono file pronti: premi «Genera file XML»','warn');return}
    const p=_ossPronti
    p.files.forEach((f,i)=>setTimeout(()=>_xdl(f[0],f[1]),i*600))
    toast('File XML scaricati: '+p.nVis+' visite','ok')
    const s=$('oss-scarica-box')
    if(s)s.innerHTML=`<b style="color:#95C22F">✔ Scaricati 5 file con ${p.nVis} visite.</b> <span style="color:rgba(255,255,255,.55)">Se il browser chiede il permesso per i «download multipli», autorizzalo, altrimenti salva solo il primo.</span>`
  }

  /* «🔎 Controlla»: solo l'elenco, senza leggere tutto e senza scaricare niente. */
  async function admOssControlla(){
    if(!S.user||S.user.email!==ADMIN_EMAIL){toast('Accesso negato','err');return}
    const dal=vGet('oss-dal'),al=vGet('oss-al'),rep=$('oss-report')
    if(!dal||!al){toast('Imposta le date Dal e Al','warn');return}
    _ossPronti=null
    _ossAscolta(rep)
    // (06/10/2026) rifacendo lo stesso controllo l'elenco non si chiude: restano aperte le sezioni,
    // lo scorrimento delle tabelle e la posizione della pagina
    const stesso=rep&&rep.dataset.ossPeriodo===dal+'|'+al&&rep.querySelector('table')
    const aperti=stesso?[...rep.querySelectorAll('details')].map(d=>d.open):[]
    const scorr=stesso?[...rep.querySelectorAll('div[style*="overflow:auto"]')].map(d=>d.scrollTop):[]
    const y=window.scrollY
    if(rep){if(stesso)rep.style.opacity='.55';else rep.innerHTML='⏳ Controllo dei dati obbligatori…'}
    try{
      const ctrl=await _ossLeggiControllo(dal,al,true)
      if(rep){
        rep.innerHTML=_ossElenco(ctrl);rep.dataset.ossPeriodo=dal+'|'+al;rep.style.opacity=''
        if(stesso){
          rep.querySelectorAll('details').forEach((d,i)=>{if(aperti[i])d.open=true})
          rep.querySelectorAll('div[style*="overflow:auto"]').forEach((d,i)=>{if(scorr[i])d.scrollTop=scorr[i]})
          window.scrollTo(0,y)
        }
      }
    }catch(e){
      if(rep){rep.style.opacity='';delete rep.dataset.ossPeriodo}
      console.error('admOssControlla:',e)
      if(rep)rep.innerHTML='<span style="color:#e74c3c">Errore: '+_xesc(e.message||e)+'</span>'
    }
  }
  window.admOssControlla=admOssControlla

  /* ══ «🛠 Sistema in tabella» (06/10/2026, chiesto dall'utente) ═══════════════════════════
     Tutti gli esercizi in un elenco solo. Per ogni cantiere, i campi della scheda che
     l'Osservatorio non accetta, ciascuno con una tendina delle sole voci ammesse: scelta la
     voce si salva SUBITO quel campo e nient'altro.
     Perché non si perdano dati (richiesta esplicita dell'utente):
     - si scrive solo da oss_correggi_cantiere, che confronta il valore letto qui («prima»)
       con quello di adesso e, se nel frattempo è cambiato, NON scrive e lo dice;
     - ogni correzione va nel registro cantieri_correzioni col valore di prima;
     - copia dei campi presa prima di cominciare (archivio.bk_2026_10_06_*).
     Il suggerimento (dal verbale o dalle note del tecnico) è solo un pulsante: non si salva
     mai da solo. La riga sistemata resta al suo posto, verde: l'elenco non si ridisegna. */
  const _SIS_OPZ={
    cantiere_tip_int:[[1,'Costruzione'],[2,'Ristrutturazione'],[3,'Demolizione'],[4,'Ampliamento']],
    cantiere_tip_ope:[[2,'Civile'],[1,'Industriale'],[3,'Commerciale'],[4,'Ospedaliera'],[5,'Stradale'],[6,'Rurale'],[7,'Funeraria'],[8,'Scolastica'],[9,'Ferroviaria'],[10,'Marittima'],[11,'Fluviale'],[12,'Sportiva'],[13,'Carceraria'],[14,'Campi eolici'],[15,'Fotovoltaica'],[16,'Altro']],
    cantiere_importo:[[1,'fino a 250.000'],[2,'da 250.001 a 500.000'],[3,'da 500.001 a 1.000.000'],[4,'da 1.000.001 a 1.500.000'],[5,'da 1.500.001 a 2.500.000'],[6,'da 2.500.001 a 3.500.000'],[7,'da 3.500.001 a 5.000.000'],[8,'da 5.000.001 a 10.000.000'],[9,'da 10.000.001 a 15.000.000'],[10,'oltre 15.000.000'],[11,'non disponibile']],
    cantiere_durata:[[1,'Fino a 3 mesi'],[2,'Da 3 a 12 mesi'],[3,'Da 12 a 24 mesi'],[4,'Da 24 a 36 mesi'],[5,'Da 36 a 48 mesi'],[6,'Oltre 48 mesi'],[7,'Non disponibile']],
    committente_tipo:[[1,'Pubblico'],[2,'Privato'],[3,'Non disponibile']]
  }
  /* che cosa si corregge per ogni motivo del controllo: campo, voci ammesse, quando è a posto */
  const _SIS_REGOLE={
    'cantiere-intervento':{campo:'cantiere_tip_int',voci:[1,2,3,4],ok:v=>v>=1&&v<=4,nome:'Tipo di intervento'},
    'cantiere-opera':{campo:'cantiere_tip_ope',voci:null,ok:v=>v>=1&&v<=16,nome:'Tipo di opera'},
    'cantiere-importo':{campo:'cantiere_importo',voci:null,ok:v=>v>=1&&v<=11,nome:'Importo dei lavori'},
    'cantiere-durata':{campo:'cantiere_durata',voci:null,ok:v=>v>=1&&v<=7,nome:'Durata dei lavori'},
    'committente-tipo':{campo:'committente_tipo',voci:null,ok:v=>v>=1&&v<=3,nome:'Committente pubblico o privato'},
    'cantiere-civico':{campo:'cantiere_civico',testo:true,ok:v=>String(v??'').trim()!=='',nome:'Civico'},
    'importo-nd':{campo:'cantiere_importo',voci:[1,2,3,4,5,6,7,8,9,10],ok:v=>v>=1&&v<=10,nome:'Importo dei lavori'},
    'durata-nd':{campo:'cantiere_durata',voci:[1,2,3,4,5,6],ok:v=>v>=1&&v<=6,nome:'Durata dei lavori'},
    'committente-nd':{campo:'committente_tipo',voci:[1,2],ok:v=>v===1||v===2,nome:'Committente pubblico o privato'},
    'opera-altro':{campo:'cantiere_tip_ope',voci:null,altro:true,ok:(v,r)=>v!==16||String(r.v.cantiere_tip_ope_altro??'').trim()!=='',nome:'Tipo di opera'}
  }
  const _SIS_FUORI={cantiere_tip_int:{5:'Altro'}}   // valori vecchi che la scheda non offre più: si mostrano con la loro parola
  const _SIS_NUM=new Set(['cantiere_tip_int','cantiere_tip_ope','cantiere_importo','cantiere_durata','committente_tipo'])
  /* parole delle note che indicano il tipo di intervento: un suggerimento, mai una decisione */
  const _SIS_PAROLE=[[3,/demoli/i],[4,/ampliament|sopraelev/i],[2,/ristruttur|manutenzion|rifaciment|restaur|risanament|riqualific|adeguament|consolidament|cappotto|rifacimento/i],[1,/nuova costruzione|nuovo edificio|nuove? (?:unit|villett|palazzin|capannon|fabbricat|abitazion)/i]]
  function _sisSuggerisciIntervento(testo){
    const trovati=_SIS_PAROLE.filter(([,re])=>re.test(testo||'')).map(([v,re])=>({v,parola:(String(testo).match(re)||[''])[0]}))
    const valori=[...new Set(trovati.map(t=>t.v))]
    return valori.length===1?{val:valori[0],da:'dalle note: «'+trovati[0].parola+'»'}:null   // due indizi diversi = nessun suggerimento
  }
  function _sisEsercizi(oggi){
    const a=ossEsercizi(oggi)[0].dal.slice(0,4)*1,out=[]
    for(let y=2019;y<=a;y++)out.push({nome:y+'-'+String(y+1).slice(2),dal:y+'-10-01',al:(y+1)+'-09-30'})
    return out
  }
  const _sisAperto=r=>[...r.blocchi,...r.avvisi].filter(k=>_SIS_REGOLE[k]&&!_sisRisolto(r,k))
  function _sisRisolto(r,k){const g=_SIS_REGOLE[k];if(!g)return false;const v=r.v[g.campo];return g.testo?g.ok(v):g.ok(v==null?NaN:Number(v),r)}
  const _sisRigaFerma=r=>[...r.blocchi].some(k=>!_SIS_REGOLE[k]||!_sisRisolto(r,k))

  let _sis=null   // {righe:Map, esercizi:[], visiteVerbale:[], filtroEs:'', filtroCosa:'blocchi'}

  async function _sisCarica(avanza){
    const righe=new Map(),esercizi=[],visiteVerbale=[],testi={}
    for(const es of _sisEsercizi()){
      avanza&&avanza('Controllo l\'esercizio '+es.nome+'…')
      const c=await _ossLeggiControllo(es.dal,es.al,true)
      if(!c.definitive)continue
      ;(c.motivi||[]).forEach(m=>{testi[m.cosa]=m.testo})
      esercizi.push({...es,ferme:c.ferme,definitive:c.definitive})
      for(const x of (c.cantieri||[])){
        let r=righe.get(x.cantiere_id)
        if(!r){r={id:x.cantiere_id,cantiere:x.cantiere||x.cantiere_id,comune:x.comune||'',esercizi:[],verbali:[],visitePerEs:{},blocchi:new Set(),avvisi:new Set(),v:{},note:[],sugg:{},stato:{}};righe.set(x.cantiere_id,r)}
        r.esercizi.push(es.nome)
        r.visitePerEs[es.nome]=(x.blocchi||[]).length?x.visite:0
        ;(x.verbali||[]).forEach(n=>{if(!r.verbali.includes(n))r.verbali.push(n)})
        ;(x.blocchi||[]).forEach(k=>r.blocchi.add(k))
        ;(x.avvisi||[]).forEach(k=>r.avvisi.add(k))
      }
      ;(c.visite||[]).filter(v=>(v.blocchi||[]).some(k=>_OSS_DI_VISITA.includes(k))).forEach(v=>visiteVerbale.push({...v,esercizio:es.nome}))
    }
    const ids=[...righe.keys()]
    if(ids.length){
      avanza&&avanza('Leggo le schede di '+ids.length+' cantieri…')
      const cant=await _inChunks('cantieri','cantiere_id,cantiere_tip_int,cantiere_tip_ope,cantiere_tip_ope_altro,cantiere_importo,cantiere_durata,cantiere_civico,cantiere_descrizione,cantiere_committente_id','cantiere_id',ids)
      const comm={}
      const cids=[...new Set(cant.map(c=>String(c.cantiere_committente_id||'').trim()).filter(Boolean))]
      if(cids.length)(await _inChunks('committenti','committente_id,committente_tipo','committente_id',cids)).forEach(m=>{comm[m.committente_id]=m.committente_tipo})
      cant.forEach(c=>{
        const r=righe.get(c.cantiere_id);if(!r)return
        const cid=String(c.cantiere_committente_id||'').trim()
        r.v={cantiere_tip_int:c.cantiere_tip_int,cantiere_tip_ope:c.cantiere_tip_ope,cantiere_tip_ope_altro:c.cantiere_tip_ope_altro,cantiere_importo:c.cantiere_importo,
             cantiere_durata:c.cantiere_durata,cantiere_civico:c.cantiere_civico,committente_tipo:cid?(comm[cid]??null):null}
        r.letto=true
        if(c.cantiere_descrizione)r.note.push('Scheda: '+c.cantiere_descrizione)
      })
      avanza&&avanza('Leggo le note dei verbali…')
      const vis=await _inChunks('visite','visita_id,cantiere_id,nr_verbale,data_visita,note_lav,oss_tec,vis_tip_int,vis_tip_ope,vis_importo,vis_durata','cantiere_id',ids,q=>q.or('elimina.is.null,elimina.eq.0'))
      vis.sort((a,b)=>String(b.data_visita||'').localeCompare(String(a.data_visita||'')))
      vis.forEach(v=>{
        const r=righe.get(v.cantiere_id);if(!r)return
        const t=[v.note_lav,v.oss_tec].map(s=>String(s||'').trim()).filter(Boolean).join(' — ')
        if(t)r.note.push((v.nr_verbale||'')+': '+t)
        const prendi=(campo,val,ok)=>{if(!r.sugg[campo]&&val!=null&&ok(val))r.sugg[campo]={val,da:'dal verbale '+(v.nr_verbale||'')}}
        prendi('cantiere_tip_int',v.vis_tip_int,x=>x>=1&&x<=4)
        prendi('cantiere_tip_ope',v.vis_tip_ope,x=>x>=1&&x<=15)
        prendi('cantiere_importo',v.vis_importo,x=>x>=1&&x<=10)
        prendi('cantiere_durata',v.vis_durata,x=>x>=1&&x<=6)
      })
      righe.forEach(r=>{if(!r.sugg.cantiere_tip_int){const s=_sisSuggerisciIntervento(r.note.join(' '));if(s)r.sugg.cantiere_tip_int=s}})
    }
    return{righe,esercizi,visiteVerbale,testi}
  }

  function _sisControllo(r,k){
    const g=_SIS_REGOLE[k],campo=g.campo,val=r.v[campo],st=r.stato[campo]||''
    const stato=`<span data-sis-st="${_xesc(campo)}" style="margin-left:4px">${st}</span>`
    if(g.testo){
      return `<input data-sis-campo="${campo}" value="${_xesc(val??'')}" placeholder="civico" style="width:70px"> <button class="btn-outline btn-sm" data-sis-snc="1" data-aiuto="Scrive «SNC» (senza numero civico) nella scheda del cantiere, subito.">SNC</button>${stato}`
    }
    const voci=(g.voci||_SIS_OPZ[campo].map(o=>o[0]))
    const etich=Object.fromEntries(_SIS_OPZ[campo])
    const sel=val!=null&&voci.includes(Number(val))?Number(val):''
    let h=`<select data-sis-campo="${campo}" style="max-width:190px"><option value="">${val!=null&&!voci.includes(Number(val))?_xesc('ora: '+(etich[val]||(_SIS_FUORI[campo]||{})[val]||val)+' — scegli'):'— scegli —'}</option>${voci.map(n=>`<option value="${n}"${n===sel?' selected':''}>${_xesc(etich[n]||n)}</option>`).join('')}</select>`
    const s=r.sugg[campo]
    if(s&&voci.includes(s.val)&&!_sisRisolto(r,k))h+=` <button class="btn-outline btn-sm" data-sis-sugg="${campo}" data-sis-val="${s.val}" title="${_xesc(s.da)}" data-aiuto="Un suggerimento: premendolo si salva questa voce. Prima guarda le note del tecnico.">💡 ${_xesc(etich[s.val]||s.val)}</button>`
    if(g.altro)h+=` <input data-sis-campo="cantiere_tip_ope_altro" value="${_xesc(r.v.cantiere_tip_ope_altro??'')}" placeholder="oppure descrivi l'opera «Altro»" style="width:170px"><span data-sis-st="cantiere_tip_ope_altro"></span>`
    return h+stato
  }
  function _sisRigaHtml(r){
    const aperti=[...r.blocchi,...r.avvisi]
    const fatto=!_sisAperto(r).length&&!_sisRigaFerma(r)
    const td='style="padding:5px 8px;border-bottom:1px solid rgba(127,127,127,.2);vertical-align:top"'
    const campi=aperti.filter(k=>_SIS_REGOLE[k]).filter((k,i,a)=>a.findIndex(x=>_SIS_REGOLE[x].campo===_SIS_REGOLE[k].campo)===i)
      .map(k=>`<div style="margin:2px 0"><span style="display:inline-block;min-width:150px;${r.blocchi.has(k)?'font-weight:600':'opacity:.75'}">${_xesc(_SIS_REGOLE[k].nome)}${r.blocchi.has(k)?'':' <span style="font-weight:400">(non disp.)</span>'}</span> ${_sisControllo(r,k)}</div>`).join('')
    const altri=aperti.filter(k=>!_SIS_REGOLE[k])
    const note=r.note.join(' · ')
    return `<tr data-sis-riga="${_xesc(r.id)}" style="${fatto?'background:rgba(149,194,47,.15)':''}">
      <td ${td}>${fatto?'<b data-sis-fatto="1" style="color:#5a8f00">✔ sistemato</b><br>':''}<b>${_xesc(r.cantiere)}</b><br><span style="opacity:.7">${_xesc(r.comune)} · ${_xesc(r.esercizi.join(', '))}</span><br><span style="opacity:.7">${r.verbali.map(_xesc).join(', ')}</span></td>
      <td ${td} title="${_xesc(note)}"><span style="opacity:.85">${_xesc(note.length>260?note.slice(0,260)+'…':note)||'<i>nessuna nota</i>'}</span></td>
      <td ${td}>${campi}${altri.length?`<div style="opacity:.75;margin-top:2px">Dalla scheda: ${altri.map(k=>_xesc(_ossBreve(_sis.testi[k]||k))).join(', ')}</div>`:''}</td>
      <td ${td}><button class="btn-outline btn-sm" data-oss-cant="${_xesc(r.id)}" data-aiuto="Apre la scheda completa del cantiere. Salvata, la riga si aggiorna da sola.">✏️ Scheda</button></td></tr>`
  }
  function _sisVisibili(){
    const fe=_sis.filtroEs,fc=_sis.filtroCosa
    return[..._sis.righe.values()].filter(r=>(!fe||r.esercizi.includes(fe))&&(fc==='tutti'?(r.blocchi.size||r.avvisi.size):fc==='blocchi'?r.blocchi.size:(r.blocchi.has(fc)||r.avvisi.has(fc))))
      .sort((a,b)=>(b.blocchi.size>0)-(a.blocchi.size>0)||a.comune.localeCompare(b.comune)||a.cantiere.localeCompare(b.cantiere))
  }
  function _sisContatori(){
    const box=$('oss-sis-conta');if(!box||!_sis)return
    const ferme=[..._sis.righe.values()].filter(_sisRigaFerma)
    const perEs=_sis.esercizi.map(es=>{const n=ferme.filter(r=>r.visitePerEs[es.nome]).length;return `${es.nome}: <b>${n}</b>`}).join(' · ')
    const avv=[..._sis.righe.values()].filter(r=>!_sisRigaFerma(r)&&_sisAperto(r).length).length
    box.innerHTML=`Cantieri che fermano visite: <b style="color:#e67e22">${ferme.length}</b> (${perEs}) · con un «Non disponibile» da migliorare: ${avv}`
  }
  function _sisDisegna(){
    const box=$('oss-sis-righe');if(!box)return
    const vv=_sisVisibili()
    const th='style="text-align:left;padding:5px 8px;border-bottom:1px solid rgba(127,127,127,.35)"'
    box.innerHTML=vv.length?`<table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th ${th}>Cantiere · esercizi · verbali</th><th ${th} style="width:32%">Note del tecnico</th><th ${th}>Da sistemare</th><th ${th}></th></tr>${vv.map(_sisRigaHtml).join('')}</table>`
      :'<p>Niente da sistemare con questi filtri.</p>'
    _sisContatori()
  }
  function _sisRiga(id){return _sis&&_sis.righe.get(id)}
  function _sisStato(tr,campo,html){const s=tr&&tr.querySelector(`[data-sis-st="${campo}"]`);if(s)s.innerHTML=html}
  /* la riga resta dov'è: cambiano solo il colore e la scritta, il fuoco resta dove l'hai lasciato */
  function _sisAggiornaRiga(r){
    const tr=document.querySelector(`#oss-sis-righe tr[data-sis-riga="${CSS.escape(r.id)}"]`);if(!tr)return
    const fatto=!_sisAperto(r).length&&!_sisRigaFerma(r)
    tr.style.background=fatto?'rgba(149,194,47,.15)':''
    const primo=tr.querySelector('td');if(!primo)return
    const segno=primo.querySelector('[data-sis-fatto]')
    if(fatto&&!segno)primo.insertAdjacentHTML('afterbegin','<b data-sis-fatto="1" style="color:#5a8f00">✔ sistemato</b><br>')
    if(!fatto&&segno){segno.nextSibling&&segno.nextSibling.remove();segno.remove()}
    _sisContatori()
  }
  async function _sisSalva(r,campo,valore,el){
    const prima=r.v[campo]
    const dopo=String(valore??'').trim()
    if(dopo===String(prima??'').trim())return
    const tr=el&&el.closest('tr')
    if(!dopo){_sisStato(tr,campo,'<span style="color:#c0392b">vuoto: da qui si scrive, non si cancella</span>');if(el)el.value=prima??'';return}
    _sisStato(tr,campo,'⏳')
    const{data,error}=await sb.rpc('oss_correggi_cantiere',{p_cantiere:r.id,p_campo:campo,p_prima:prima==null?null:String(prima),p_dopo:dopo})
    if(error){
      _sisStato(tr,campo,'<span style="color:#c0392b">✖ non salvato: '+_xesc(error.message)+'</span>')
      if(el)el.value=(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===String(prima)))?'':(prima??'')   // fuori elenco: torna su «ora: … — scegli»
      toast('Non salvato: '+error.message,'err')
      return
    }
    r.v[campo]=_SIS_NUM.has(campo)?Number(dopo):dopo
    r.stato[campo]='<span style="color:#5a8f00">✔</span>'
    _sisStato(tr,campo,r.stato[campo])
    if(data&&data.invariato)_sisStato(tr,campo,'<span style="color:#5a8f00">✔ era già così</span>')
    _sisAggiornaRiga(r)
  }
  /* dopo «✏️ Scheda»: si rilegge quel cantiere e si ridisegna la sua riga */
  async function _sisDopoScheda(id){
    const r=_sisRiga(id);if(!r)return
    const{data:c,error}=await sb.from('cantieri').select('cantiere_tip_int,cantiere_tip_ope,cantiere_tip_ope_altro,cantiere_importo,cantiere_durata,cantiere_civico,cantiere_committente_id').eq('cantiere_id',id).maybeSingle()
    if(error||!c){toast('Scheda salvata, ma non sono riuscito a rileggerla: premi «🔄 Ricarica»','warn');return}
    let ct=null;const cid=String(c.cantiere_committente_id||'').trim()
    if(cid){const{data:m,error:e2}=await sb.from('committenti').select('committente_tipo').eq('committente_id',cid).maybeSingle();if(e2){toast('Non sono riuscito a rileggere il committente: premi «🔄 Ricarica»','warn');return}ct=m?m.committente_tipo:null}
    Object.assign(r.v,c,{committente_tipo:ct})
    if(r.blocchi.size){   // i motivi che si sistemano solo dalla scheda: li ridice il database
      try{
        const es=_sis.esercizi.filter(e=>r.esercizi.includes(e.nome))
        const nuovi=new Set(),nuoviAvv=new Set()
        for(const e of es){const k=await _ossLeggiControllo(e.dal,e.al,true);const x=(k.cantieri||[]).find(z=>z.cantiere_id===id);if(x){(x.blocchi||[]).forEach(b=>nuovi.add(b));(x.avvisi||[]).forEach(b=>nuoviAvv.add(b))}}
        r.blocchi=new Set([...r.blocchi].filter(b=>_SIS_REGOLE[b]||nuovi.has(b)));r.avvisi=new Set([...r.avvisi].filter(b=>_SIS_REGOLE[b]||nuoviAvv.has(b)))
      }catch(e){toast('Non sono riuscito a ricontrollare il cantiere: premi «🔄 Ricarica»','warn')}
    }
    const tr=document.querySelector(`#oss-sis-righe tr[data-sis-riga="${CSS.escape(id)}"]`)
    if(tr)tr.outerHTML=_sisRigaHtml(r)
    _sisContatori()
  }
  function _sisAscolta(box){
    if(box._sisAscolta)return;box._sisAscolta=true
    const prendi=el=>{const tr=el.closest('tr[data-sis-riga]');return tr?_sisRiga(tr.dataset.sisRiga):null}
    // le tendine si salvano poco dopo la scelta: con le frecce da tastiera non si salva ogni voce attraversata
    box.addEventListener('change',e=>{
      const el=e.target
      if(el.id==='oss-sis-es'){_sis.filtroEs=el.value;_sisDisegna();return}
      if(el.id==='oss-sis-cosa'){_sis.filtroCosa=el.value;_sisDisegna();return}
      const campo=el.dataset&&el.dataset.sisCampo,r=campo&&prendi(el);if(!r)return
      clearTimeout(el._sisT)
      if(el.tagName==='SELECT')el._sisT=setTimeout(()=>_sisSalva(r,campo,el.value,el),600)
      else _sisSalva(r,campo,el.value,el)
    })
    box.addEventListener('focusout',e=>{const el=e.target;if(el._sisT){clearTimeout(el._sisT);el._sisT=null;const r=prendi(el);if(r)_sisSalva(r,el.dataset.sisCampo,el.value,el)}})
    box.addEventListener('keydown',e=>{const el=e.target;if(e.key==='Enter'&&el.tagName==='INPUT'&&el.dataset.sisCampo){e.preventDefault();el.blur()}})
    box.addEventListener('click',e=>{
      const b=e.target.closest('[data-sis-sugg],[data-sis-snc],[data-sis-az]');if(!b)return
      if(b.dataset.sisAz==='ricarica'){admOssSistema();return}
      const r=prendi(b);if(!r)return
      if(b.dataset.sisSnc){const inp=b.parentElement.querySelector('input[data-sis-campo]');if(inp)inp.value='SNC';_sisSalva(r,'cantiere_civico','SNC',inp);return}
      const campo=b.dataset.sisSugg,sel=b.parentElement.querySelector(`select[data-sis-campo="${campo}"]`)
      if(sel)sel.value=b.dataset.sisVal
      _sisSalva(r,campo,b.dataset.sisVal,sel).then(()=>{if(String(r.v[campo])===String(b.dataset.sisVal))b.remove()})
    })
  }

  async function admOssSistema(){
    if(!S.user||S.user.email!==ADMIN_EMAIL){toast('Accesso negato','err');return}
    const rep=$('oss-report');if(!rep)return
    _ossAscolta(rep)
    delete rep.dataset.ossPeriodo
    rep.innerHTML='<div id="oss-sis"><span id="oss-sis-passo">⏳ Preparo l\'elenco…</span></div>'
    try{
      const dati=await _sisCarica(t=>{const p=$('oss-sis-passo');if(p)p.textContent='⏳ '+t})
      _sis={...dati,filtroEs:'',filtroCosa:'blocchi'}
    }catch(e){
      console.error('admOssSistema:',e)
      rep.innerHTML='<span style="color:#e74c3c">Non sono riuscito a preparare l\'elenco: '+_xesc(e.message||e)+'. Non ho scritto niente.</span>'
      return
    }
    const motivi=[...new Set([..._sis.righe.values()].flatMap(r=>[...r.blocchi,...r.avvisi]))]
    const box=$('oss-sis')
    box.innerHTML=`<div style="margin:4px 0 8px"><b>🛠 Sistema in tabella</b> — tutti gli esercizi. Scegli la voce e si salva subito <b>solo quel campo</b>; se nel frattempo qualcuno l'ha cambiato non scrive e lo dice. Ogni correzione resta nel registro col valore di prima. Il 💡 è un suggerimento: si salva solo se lo premi.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
        <label>Esercizio <select id="oss-sis-es"><option value="">tutti</option>${_sis.esercizi.map(e=>`<option value="${e.nome}">${e.nome}</option>`).join('')}</select></label>
        <label>Che cosa <select id="oss-sis-cosa"><option value="blocchi">solo quello che ferma le visite</option><option value="tutti">anche i «Non disponibile»</option>${motivi.map(k=>`<option value="${_xesc(k)}">${_xesc(_ossBreve(_sis.testi[k]||k))}</option>`).join('')}</select></label>
        <button class="btn-outline btn-sm" data-sis-az="ricarica" data-aiuto="Rilegge tutto dal database: serve se qualcun altro sta correggendo le stesse schede.">🔄 Ricarica</button>
      </div>
      <div id="oss-sis-conta" style="margin-bottom:6px"></div>
      ${_sis.visiteVerbale.length?`<div style="margin-bottom:6px;opacity:.85">⚠ ${_sis.visiteVerbale.length} verbali fermi per dati del verbale (non della scheda): ${_sis.visiteVerbale.slice(0,30).map(v=>_xesc(v.nr_verbale||v.visita_id)).join(', ')}${_sis.visiteVerbale.length>30?'…':''} — si sistemano da «🔎 Controlla» del loro esercizio, con «✏️ Verbale».</div>`:''}
      <div id="oss-sis-righe" style="max-height:620px;overflow:auto"></div>`
    // i nomi dei motivi nel filtro: il testo breve del controllo
    const sel=$('oss-sis-cosa');if(sel)[...sel.options].forEach(o=>{if(_SIS_REGOLE[o.value])o.textContent=_SIS_REGOLE[o.value].nome+(o.value.endsWith('-nd')||o.value==='opera-altro'?' (non disp. / Altro)':'')})
    _sisAscolta(box)
    _sisDisegna()
  }
  window.admOssSistema=admOssSistema

  /* Tessera «Pronti per l'Osservatorio»: l'esercizio in corso e quello prima, tutto l'anno.
     L'esercizio va dal 1/10 al 30/9. Se la lettura fallisce lo si dice: mai uno zero al posto di un errore. */
  function ossEsercizi(oggi){
    const d=oggi||new Date(),a=d.getMonth()>=9?d.getFullYear():d.getFullYear()-1
    const es=y=>({nome:y+'-'+String(y+1).slice(2),dal:y+'-10-01',al:(y+1)+'-09-30'})
    return[es(a),es(a-1)]
  }
  async function admOssTessera(){
    const box=$('oss-tessera');if(!box)return
    if(!S.user||S.user.email!==ADMIN_EMAIL){box.innerHTML='';return}
    _ossAscolta(box)
    box.innerHTML='<span style="color:rgba(255,255,255,.45)">⏳ Conto le visite pronte per l\'Osservatorio…</span>'
    const righe=[]
    for(const es of ossEsercizi()){
      try{
        const c=await _ossLeggiControllo(es.dal,es.al,false)
        let r=`<b>Esercizio ${es.nome}</b>: ${c.definitive} visite definitive`
        if(c.definitive){
          r+=` · <b style="color:#95C22F">${c.pronte} pronte</b>`
          r+=c.ferme?` · <b style="color:#f39c12">${c.ferme} da sistemare</b>`:' · nessuna da sistemare'
          if(c.con_avvisi)r+=` · ${c.con_avvisi} con un «Non disponibile»`
        }
        if(c.non_definitive)r+=` · ${c.non_definitive} bozze`
        if(c.definitive||c.non_definitive)r+=` <button class="btn-outline btn-sm" style="margin-left:6px" data-oss-dal="${es.dal}" data-oss-al="${es.al}" data-aiuto="Mette nelle date questo esercizio e mostra, qui sotto, le visite che non possono ancora andare all'Osservatorio. Non scarica niente.">Vedi l'elenco</button>`
        righe.push(r)
      }catch(e){
        console.warn('admOssTessera, esercizio '+es.nome+': '+((e&&e.message)||e))
        righe.push(`<b>Esercizio ${es.nome}</b>: <span style="color:#e74c3c">non sono riuscito a leggere (${_xesc(e.message||e)})</span>`)
      }
    }
    box.innerHTML='<div style="font-weight:700;margin-bottom:4px">🎯 Pronti per l\'Osservatorio</div>'+righe.join('<br>')
  }
  window.admOssTessera=admOssTessera

  async function admExportOsservatorio(){
    if(!S.user||S.user.email!==ADMIN_EMAIL){toast('Accesso negato','err');return}
    const dal=vGet('oss-dal'),al=vGet('oss-al')
    const rep=$('oss-report')
    if(!dal||!al){toast('Imposta le date Dal e Al','warn');return}
    const btn=$('oss-genera');const _t=btn.textContent;btn.disabled=true;btn.textContent='⏳ Estrazione…'
    _ossPronti=null
    _ossAscolta(rep)
    if(rep){rep.innerHTML='Estrazione in corso…';delete rep.dataset.ossPeriodo}
    try{
      const _passo=(t)=>{if(rep)rep.innerHTML='⏳ '+t}
      // 0. che cosa è pronto lo dice il database: senza la sua risposta non si esporta
      _passo('Controllo dei dati obbligatori…')
      const ctrl=await _ossLeggiControllo(dal,al,true)
      if(!ctrl.definitive){if(rep)rep.innerHTML=_ossElenco(ctrl);toast('Nessuna visita definitiva nell\'intervallo','warn');return}
      const ferme=new Set((ctrl.visite||[]).map(x=>x.visita_id))
      if(ferme.size!==ctrl.ferme)throw new Error('il controllo dice '+ctrl.ferme+' visite ferme ma ne elenca '+ferme.size+'. Senza un elenco completo non si esporta')
      // 1. visite definitive nell'intervallo (nessun tetto: si pagina finche' finiscono)
      const visite=[]
      for(let vfrom=0;;vfrom+=1000){
        const{data:vs,error:ev}=await sb.from('visite')
          .select('visita_id,nr_verbale,cantiere_id,impresa_id,tecnico_id,tecnico2_id,tipo_accesso,tipo_accesso_naz,data_visita,ora_visita,ora_fine,nr_imp,nr_lavoratori,nr_ind,resp_lav,csp,cse,coord,note_lav,rl_nome,rl_cog,csp_nome,csp_cog,cse_nome,cse_cog')
          .eq('elimina',0).eq('stato','definitivo').gte('data_visita',dal).lte('data_visita',al)
          .order('data_visita').order('visita_id').range(vfrom,vfrom+999)
        if(ev)throw new Error(ev.message)
        visite.push(...(vs||[]))
        _passo('Lettura visite: '+visite.length+'…')
        if(!vs||vs.length<1000)break
      }
      /* fra il controllo e la lettura qualcuno può aver chiuso un verbale: una visita che il
         controllo non ha visto non si esporta alla cieca. Si rifà da capo. */
      if(visite.length!==ctrl.definitive)throw new Error('mentre leggevo, le visite definitive del periodo sono cambiate ('+ctrl.definitive+' al controllo, '+visite.length+' alla lettura). Premi di nuovo «Genera file XML»')
      const buone=visite.filter(v=>!ferme.has(v.visita_id))
      const vids=buone.map(v=>v.visita_id)
      // 2. checklist, ruolo impresa principale
      _passo(buone.length+' visite pronte su '+visite.length+'. Lettura check-list…')
      const chk=vids.length?await _inChunks('visite_checklist','visita_id,codice,valore,nota','visita_id',vids,
        null,(n)=>_passo('Lettura check-list: '+n.toLocaleString('it-IT')+' righe…')):[]
      _passo(chk.length.toLocaleString('it-IT')+' righe di check-list. Lettura anagrafiche…')
      const vip=vids.length?await _inChunks('visite_imprese_presenti','visita_id,ruolo,tipo_imp,is_principale','visita_id',vids,q=>q.eq('is_principale',true)):[]
      const ruoloRiga={};vip.forEach(r=>{if(!ruoloRiga[r.visita_id])ruoloRiga[r.visita_id]=r})
      // 3. anagrafiche collegate
      const mappa=(righe,k)=>{const m={};righe.forEach(r=>{m[String(r[k])]=r});return m}
      const cantIds=[...new Set(buone.map(v=>v.cantiere_id).filter(Boolean))]
      const cants=cantIds.length?await _inChunks('cantieri','cantiere_id,cantiere_indirizzo,cantiere_civico,cantiere_etichetta,cantiere_cnce,cantiere_comune_cod,cantiere_cap,cantiere_tip_int,cantiere_tip_ope,cantiere_tip_ope_altro,cantiere_importo,cantiere_durata,cantiere_committente_id,comune_nome','cantiere_id',cantIds):[]
      const commIds=[...new Set(cants.map(c=>String(c.cantiere_committente_id||'').trim()).filter(Boolean))]
      const comms=commIds.length?await _inChunks('committenti','committente_id,committente_nome,committente_tipo','committente_id',commIds,q=>q.eq('elimina',0)):[]
      const impIds=[...new Set(buone.map(v=>v.impresa_id).filter(Boolean))]
      const imps=impIds.length?await _inChunks('imprese','impresa_id,impresa_nome,impresa_cf,impresa_email_ref,tipo_iscrizione_ccia,contratto_ccnl,contratto_ccnl_altro','impresa_id',impIds):[]
      const tecIds=[...new Set(buone.flatMap(v=>[v.tecnico_id,v.tecnico2_id]).filter(Boolean))]
      const tecs=tecIds.length?await _inChunks('tecnici','tecnico_id,tecnico_cognome,tecnico_nome','tecnico_id',tecIds):[]
      const cantMap=mappa(cants,'cantiere_id'),commMap=mappa(comms,'committente_id'),impMap=mappa(imps,'impresa_id'),tecMap=mappa(tecs,'tecnico_id')
      // 4. quali escono (nessun valore di ripiego) e i cinque file
      const valPerVisita=ossValutazioni(chk)
      const{esporta,scarti}=ossScegli({visite:buone,ferme:null,valPerVisita,ruoloRiga,cantMap,commMap,impMap,tecMap})
      const x=ossXml({esporta,cantMap,commMap,impMap,tecMap})
      const tag=dal.replace(/-/g,'')+'_'+al.replace(/-/g,'')
      const files=[['Visite_'+tag+'.xml',x.xv],['Cantieri_'+tag+'.xml',x.xc],['Imprese_'+tag+'.xml',x.xi],['Committenti_'+tag+'.xml',x.xm],['Tecnici_'+tag+'.xml',x.xt]]
      const _peso=files.reduce((t,f)=>t+f[1].length,0)
      const fuori=ferme.size+scarti.length+(ctrl.non_definitive||0)
      // ── riepilogo ──
      let h=''
      if(!x.nVis){
        h+='<b style="color:#e74c3c">Nessuna visita del periodo ha tutti i dati obbligatori: non c\'è niente da scaricare.</b><br>'
      }else if(fuori){
        /* se qualcosa resta fuori i file NON si scaricano da soli: prima si legge l'elenco */
        _ossPronti={files,nVis:x.nVis}
        h+=`<div id="oss-scarica-box" style="margin-bottom:8px"><b style="color:#f39c12">I file sono pronti ma non completi: ${x.nVis} visite su ${visite.length} definitive.</b> Restano fuori le visite dell'elenco qui sotto. Se le sistemi prima, l'invio è completo.<br>`
        h+=`<button class="btn-outline btn-sm" style="margin-top:6px" data-oss-az="scarica" data-aiuto="Scarica i cinque file con le sole visite pronte: quelle dell'elenco restano fuori dall'invio.">⬇ Scarica lo stesso i 5 file con le sole ${x.nVis} visite pronte</button></div>`
      }else{
        files.forEach((f,i)=>setTimeout(()=>_xdl(f[0],f[1]),i*600))
        h+=`<b style="color:#95C22F">✔ Estrazione completata (${_ossData(dal)} → ${_ossData(al)})</b> <span style="color:rgba(255,255,255,.45)">— 5 file, ${(_peso/1048576).toFixed(1)} MB</span><br>`
        h+=`<span style="color:rgba(255,255,255,.55)">Il browser scarica cinque file di seguito: se chiede il permesso per i «download multipli», autorizzalo, altrimenti ne salva solo il primo.</span><br>`
        toast('File XML generati: '+x.nVis+' visite','ok')
      }
      h+=`Nei file: visite <b>${x.nVis}</b> · cantieri <b>${x.nCant}</b> · imprese <b>${x.nImp}</b> · committenti <b>${x.nComm}</b> · tecnici <b>${x.nTec}</b> <span style="color:rgba(255,255,255,.45)">(solo le anagrafiche citate dalle visite esportate)</span><br>`
      h+=`<span style="color:rgba(255,255,255,.55)">Righe lette: check-list <b>${chk.length.toLocaleString('it-IT')}</b> · valutazioni scritte <b>${x.nVal.toLocaleString('it-IT')}</b>. Nessun valore di ripiego: un dato obbligatorio che manca tiene fuori la visita.</span><br>`
      h+='<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)">'+_ossElenco(ctrl,{scarti})+'</div>'
      if(rep)rep.innerHTML=h
    }catch(e){
      console.error('admExportOsservatorio:',e)
      _ossPronti=null
      if(rep)rep.innerHTML='<span style="color:#e74c3c">Errore: '+_xesc(e.message||e)+'</span>'
      toast('Errore estrazione: '+(e.message||e),'err')
    }finally{btn.disabled=false;btn.textContent=_t}
  }
  window.admExportOsservatorio=admExportOsservatorio

  return {
    _inChunks, _splitFigura, _figSnap, _ordinaNomeCognomeDaCF, _splitNome,
    _xesc, _xel, _xdl, admOssTuttoArchivio, admExportOsservatorio, admOssControlla, admOssTessera,
    ossRuolo, ossTipoVisita, ossCantiereManca, ossCommittenteTipo, ossValutazioni, ossScegli, ossXml, ossEsercizi, _ossElenco,
    _SIS_OPZ, _SIS_REGOLE, _sisRisolto, _sisRigaFerma, _sisSuggerisciIntervento, _sisEsercizi, _sisCarica, _sisSalva, _sisRigaHtml,
    CHK2OSS, _OSS_ESITO, _PK_CHUNK, TIPO_MAP, RUOLO_MAP,
  }
}
