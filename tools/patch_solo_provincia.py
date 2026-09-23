# -*- coding: utf-8 -*-
"""23/09/2026 - Elenco e mappa dei cantieri: di norma solo la provincia di Padova.

Chiesto dall'utente: con la mappa che ora legge tutti i cantieri comparivano
Foggia, Milano, Roma, Torino... - cantieri CNCE/CEIV di imprese padovane fuori
provincia (~40 attivi). Di norma si nascondono; la casella «Includi fuori
provincia», dopo «Includi chiusi», li rimostra.

Come si riconosce la provincia, in ordine: codice ISTAT del comune che
comincia per 028 (tutti i cantieri padovani ce l'hanno, quelli fuori no);
altrimenti CAP 35xxx; altrimenti il nome del comune fra quelli PD di
comuni_cap. Le segnalazioni GPS dei tecnici restano sempre.
"""
import io

CRLF = chr(13) + chr(10)
LF = chr(10)
P = 'index.html'
src = io.open(P, encoding='utf-8', newline='').read()
n0 = len(src)
NL = CRLF if CRLF in src else LF

def sost(vecchio, nuovo, nome):
    global src
    vecchio = vecchio.replace(LF, NL); nuovo = nuovo.replace(LF, NL)
    c = src.count(vecchio)
    assert c == 1, '%s: trovate %d occorrenze' % (nome, c)
    src = src.replace(vecchio, nuovo)

# 1. stato del filtro
sost("""const _clState={comSel:new Set(),ope:'',imp:'',sca:'',orig:'',vis:''}""",
     """const _clState={comSel:new Set(),ope:'',imp:'',sca:'',orig:'',vis:'',fuori:false}""", 'stato')

# 2. campi letti: CAP e codice ISTAT del comune
sost("""cantiere_descrizione,cantiere_importo,data_ult,cantiere_committente_id,cantiere_chiuso'""",
     """cantiere_descrizione,cantiere_importo,data_ult,cantiere_committente_id,cantiere_chiuso,cantiere_cap,cantiere_comune_cod'""", 'selC')

# 3. dopo la lettura: in provincia o no
sost("""  // zona: per Padova usa il quartiere ricavato dallo stradario (come in mappa)
  rows.forEach(r=>{
    let zk=r.comune_nome||''""", """  // provincia di Padova (23/09/2026): codice ISTAT 028…, altrimenti CAP 35…, altrimenti nome del comune
  if(!window.__comuniPD){
    try{
      const{data:cp,error:ecp}=await sb.from('comuni_cap').select('nome_norm').eq('prov','PD').limit(1000)
      if(ecp)throw ecp
      window.__comuniPD=new Set((cp||[]).map(x=>String(x.nome_norm||'').trim().toUpperCase()))
    }catch(e){console.warn('comuni PD:',e);window.__comuniPD=new Set()}
  }
  rows.forEach(r=>{
    const cod=String(r.cantiere_comune_cod||''),cap=String(r.cantiere_cap||'').trim()
    r._inPD=cod.startsWith('028')||(!cod&&/^35\\d{3}$/.test(cap))||(!cod&&window.__comuniPD.has(String(r.comune_nome||'').trim().toUpperCase()))
  })
  // zona: per Padova usa il quartiere ricavato dallo stradario (come in mappa)
  rows.forEach(r=>{
    let zk=r.comune_nome||''""", 'inPD')

# 4. il filtro
sost("""  if(d._segn)return !(s.comSel.size||s.ope||s.imp||s.sca||s.vis||s.orig==='cnce')
""", """  if(d._segn)return !(s.comSel.size||s.ope||s.imp||s.sca||s.vis||s.orig==='cnce')
  if(!s.fuori&&!d._inPD)return false
""", 'pass')

# 5. i comuni del selettore: solo quelli visibili; e la casella dopo «Includi chiusi»
sost("""  const comuni=_dedupComuni(rows.map(r=>r.zona_key||r.comune_nome))
  const tOpe=[...new Set(rows.map(r=>r.cantiere_tip_ope).filter(v=>v!=null))].sort((a,b)=>a-b)""",
     """  const comuni=_dedupComuni(rows.filter(r=>_clState.fuori||r._inPD||r._segn).map(r=>r.zona_key||r.comune_nome))
  const tOpe=[...new Set(rows.map(r=>r.cantiere_tip_ope).filter(v=>v!=null))].sort((a,b)=>a-b)""", 'comuni')
sost("""  if(_lblChiusi)fdiv.appendChild(_lblChiusi)  // «Includi chiusi» dopo Visite (23/09/2026)
}""", """  if(_lblChiusi)fdiv.appendChild(_lblChiusi)  // «Includi chiusi» dopo Visite (23/09/2026)
  // «Includi fuori provincia» (23/09/2026): filtro sui dati gia' letti, niente nuova lettura
  const nFuori=rows.filter(r=>!r._segn&&!r._inPD).length
  const lf=document.createElement('label');lf.id='lbl-cant-fuori'
  lf.style.cssText='display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border,#ddd);border-radius:20px;font-size:12px;cursor:pointer;background:#fff;white-space:nowrap;flex:0 0 auto;width:auto'
  lf.title='Di norma elenco e mappa mostrano solo i cantieri in provincia di Padova'
  lf.innerHTML='<input type="checkbox" id="chk-cant-fuori" style="width:auto;margin:0"'+(_clState.fuori?' checked':'')+'> Includi fuori provincia'+(nFuori?' ('+nFuori+')':'')
  lf.querySelector('input').onchange=e=>{_clState.fuori=e.target.checked;_clBuildFilters(_clRows||[]);_clRender()}
  fdiv.appendChild(lf)
}""", 'casella fuori')

# 6. «Mostra tutti» riporta anche questa casella al default
sost("""_clState.orig='';_clState.vis=''}loadCantieri('')}""",
     """_clState.orig='';_clState.vis='';_clState.fuori=false}loadCantieri('')}""", 'mostra tutti')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
