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
        h+=`<div style="margin-top:10px"><b>Cantieri da completare (${cf.length})</b> — «✏️ Scheda» apre la scheda del cantiere; poi premi di nuovo «🔎 Controlla».</div>`
        h+=`<div style="max-height:340px;overflow:auto;margin-top:4px"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th ${th}>Cantiere</th><th ${th}>Comune</th><th ${th}>Visite</th><th ${th}>Che cosa manca</th><th ${th}></th></tr>`
        h+=cf.map(c=>`<tr><td ${td}>${_xesc(c.cantiere||c.cantiere_id)}</td><td ${td}>${_xesc(c.comune||'')}</td><td ${td}>${c.visite}</td><td ${td}>${cosa(c.blocchi)}</td><td ${td}><button class="btn-outline btn-sm" data-oss-cant="${_xesc(c.cantiere_id)}" data-aiuto="Apre la scheda del cantiere per completare il dato che manca. Dopo il salvataggio premi di nuovo «🔎 Controlla».">✏️ Scheda</button></td></tr>`).join('')
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
        h+=`<div style="max-height:260px;overflow:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th ${th}>Cantiere</th><th ${th}>Comune</th><th ${th}>Visite</th><th ${th}>Che cosa</th><th ${th}></th></tr>`
        h+=ca.map(c=>`<tr><td ${td}>${_xesc(c.cantiere||c.cantiere_id)}</td><td ${td}>${_xesc(c.comune||'')}</td><td ${td}>${c.visite}</td><td ${td}>${cosa(c.avvisi)}</td><td ${td}><button class="btn-outline btn-sm" data-oss-cant="${_xesc(c.cantiere_id)}" data-aiuto="Apre la scheda del cantiere per completare il dato che manca. Dopo il salvataggio premi di nuovo «🔎 Controlla».">✏️ Scheda</button></td></tr>`).join('')
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
    if(b.dataset.ossCant){if(typeof window.admEditCantiere==='function')window.admEditCantiere(b.dataset.ossCant);return}
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
    if(rep)rep.innerHTML='⏳ Controllo dei dati obbligatori…'
    try{
      const ctrl=await _ossLeggiControllo(dal,al,true)
      if(rep)rep.innerHTML=_ossElenco(ctrl)
    }catch(e){
      console.error('admOssControlla:',e)
      if(rep)rep.innerHTML='<span style="color:#e74c3c">Errore: '+_xesc(e.message||e)+'</span>'
    }
  }
  window.admOssControlla=admOssControlla

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
        console.warn('admOssTessera:',e)
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
    if(rep)rep.innerHTML='Estrazione in corso…'
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
    CHK2OSS, _OSS_ESITO, _PK_CHUNK, TIPO_MAP, RUOLO_MAP,
  }
}
