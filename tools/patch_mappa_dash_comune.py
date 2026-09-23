# -*- coding: utf-8 -*-
"""23/09/2026 - Mappa della Dashboard: filtri Tecnico e Comune visibili, contatore.

Chiesto dall'utente: «nella dashboard tecnico la mappa deve poter avere
selezione tecnico oltre IPC e magari comune». Il menu tecnico c'era gia' ma
senza etichetta non si notava; si aggiunge il menu Comune (con il numero di
cantieri per comune), le etichette e «N cantieri sulla mappa». Le scelte di
tecnico e comune restano quando si torna alla Dashboard.
"""
import io

P = 'index.html'
src = io.open(P, encoding='utf-8', newline='').read()
n0 = len(src)


def sost(vecchio, nuovo, nome):
    global src
    c = src.count(vecchio)
    assert c == 1, '%s: trovate %d occorrenze' % (nome, c)
    src = src.replace(vecchio, nuovo)


sost("""_dashMapIpcOn={NR:true,BASSO:true,MEDIO:true,ALTO:true}, _dashMapTec=''""",
     """_dashMapIpcOn={NR:true,BASSO:true,MEDIO:true,ALTO:true}, _dashMapTec='', _dashMapCom=''""", 'stato')

sost("""  _dashMapTec=$('dash-map-tec')?.value||''
""", """  _dashMapTec=$('dash-map-tec')?.value||''
  _dashMapCom=$('dash-map-com')?.value||''
""", 'rilettura')

sost("""    // Menu tecnico
    const tecs=[...new Set(rows.map(d=>d.tecnico).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'))
    const sel=document.createElement('select')
    sel.id='dash-map-tec'
    sel.style.cssText='padding:4px 9px;border:1px solid var(--line,#e3e3e6);border-radius:20px;font-size:12px;margin-left:4px;cursor:pointer'
    sel.innerHTML='<option value="">👷 Tutti i tecnici</option>'+tecs.map(t=>`<option value="${t.replace(/"/g,'&quot;')}">${t}</option>`).join('')
    if(_dashMapTec&&tecs.includes(_dashMapTec))sel.value=_dashMapTec
    sel.addEventListener('change',()=>{_dashMapTec=sel.value;renderDashMapMarkers()})
    fdiv.appendChild(sel)
  }""", """    // Menu tecnico e comune (23/09/2026: con etichetta, prima il tecnico non si notava)
    const _q=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
    const _conta=k=>{const m={};rows.forEach(d=>{const v=d[k];if(v)m[v]=(m[v]||0)+1});return m}
    const _menu=(id,etich,tutti,conti,val,su)=>{
      const lab=document.createElement('label')
      lab.style.cssText='display:inline-flex;align-items:center;gap:5px'
      lab.innerHTML=etich+' '
      const sel=document.createElement('select')
      sel.id=id
      sel.style.cssText='padding:4px 9px;border:1px solid var(--line,#e3e3e6);border-radius:20px;font-size:12px;cursor:pointer;max-width:210px'
      const chiavi=Object.keys(conti).sort((a,b)=>a.localeCompare(b,'it'))
      sel.innerHTML='<option value="">'+tutti+'</option>'+chiavi.map(t=>`<option value="${_q(t)}">${_q(t)} (${conti[t]})</option>`).join('')
      if(val&&chiavi.includes(val))sel.value=val
      sel.addEventListener('change',()=>{su(sel.value);renderDashMapMarkers()})
      lab.appendChild(sel);fdiv.appendChild(lab)
      return sel
    }
    const _st=_menu('dash-map-tec','👷 Tecnico','Tutti',_conta('tecnico'),_dashMapTec,v=>{_dashMapTec=v})
    if(_dashMapTec&&!_st.value)_dashMapTec=''
    const _sc=_menu('dash-map-com','🏘️ Comune','Tutti',_conta('comune_nome'),_dashMapCom,v=>{_dashMapCom=v})
    if(_dashMapCom&&!_sc.value)_dashMapCom=''
    const cnt=document.createElement('span')
    cnt.id='dash-map-conta';cnt.style.cssText='color:#888;font-size:12px'
    fdiv.appendChild(cnt)
    renderDashMapMarkers(!!(_dashMapTec||_dashMapCom))
  }""", 'menu')

sost("""    if(_dashMapTec&&d.tecnico!==_dashMapTec)return
""", """    if(_dashMapTec&&d.tecnico!==_dashMapTec)return
    if(_dashMapCom&&d.comune_nome!==_dashMapCom)return
""", 'filtro comune')

sost("""  if(fit&&bounds.length)_dashMap.fitBounds(bounds,{padding:[30,30]})
}""", """  if(fit&&bounds.length)_dashMap.fitBounds(bounds,{padding:[30,30],maxZoom:15})
  const _cn=$('dash-map-conta');if(_cn)_cn.textContent=bounds.length+(bounds.length===1?' cantiere':' cantieri')+' sulla mappa'
}""", 'contatore')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
