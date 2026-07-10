# -*- coding: utf-8 -*-
"""Patch 2 — 2026-07-10: segnalazione da dashboard per tutti (viewer inclusi)
+ vista tecnico personalizzata (dashboard/visite filtrate sul proprio tecnico,
obiettivo mensile in alto per il tecnico).
Uso: python tools/patch_segnalazioni2.py
"""
import io, os, shutil, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'index.html')
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
BAK = os.path.join(BASE, f'index_pre_segnalazioni2_{ts}.html.bak')

shutil.copy2(SRC, BAK)
print('Backup:', BAK)

with io.open(BAK, 'r', encoding='utf-8') as f:
    html = f.read()

def rep(old, new, label):
    global html
    n = html.count(old)
    assert n == 1, f'{label}: attese 1 occorrenza, trovate {n}'
    html = html.replace(old, new)
    print('OK:', label)

# ── 1. Pulsante "Segnala cantiere" in cima alla dashboard (tutti, viewer inclusi) ──
rep('<div id="avvisi-banner"></div>',
    '''<div id="dash-segnala-wrap" style="margin-bottom:14px"><button class="btn-primary" id="btn-segnala-dash" style="width:100%;padding:12px;font-size:15px;border-radius:10px">&#128205; Segnala cantiere (GPS)</button></div>
      <div id="avvisi-banner"></div>''',
    'pulsante dashboard')

# ── 2. Bind del nuovo pulsante ──
rep("$('btn-segnala-cant').onclick=apriSegnalaCantiere",
    """$('btn-segnala-cant').onclick=apriSegnalaCantiere
if($('btn-segnala-dash'))$('btn-segnala-dash').onclick=apriSegnalaCantiere""",
    'bind pulsante dashboard')

# ── 3. Nome del viewer per la segnalazione ──
rep("    $('lbl-user').textContent=(_roleRow.nome||user.email)+' — sola lettura'",
    """    S.viewerNome=_roleRow.nome||null
    $('lbl-user').textContent=(_roleRow.nome||user.email)+' — sola lettura'""",
    'nome viewer')

# ── 4. salvaSegnalazione: nome anche per viewer + reload mappa solo se esiste ──
rep("    const tecNome=S.tecnico?`${S.tecnico.tecnico_nome||''} ${S.tecnico.tecnico_cognome||''}`.trim():null",
    "    const tecNome=S.tecnico?`${S.tecnico.tecnico_nome||''} ${S.tecnico.tecnico_cognome||''}`.trim():(S.viewerNome||null)",
    'nome segnalante')

rep("""    hide('modal-segn')
    toast('Segnalazione salvata ✓','ok')
    loadCantMap().catch(()=>{})""",
    """    hide('modal-segn')
    toast('Segnalazione salvata ✓','ok')
    if(_cmMap)loadCantMap().catch(()=>{})""",
    'reload mappa condizionale')

# ── 5. Dashboard: filtro tecnico preimpostato sul proprio per i tecnici ──
rep("    selT.dataset.init='1';selT.onchange=applyDashFilters",
    """    if(S.tecnico&&!window.__isCoord&&tids.includes(S.tecnico.tecnico_id))selT.value=S.tecnico.tecnico_id
    selT.dataset.init='1';selT.onchange=applyDashFilters""",
    'default tecnico dashboard')

# ── 6. Per il tecnico: obiettivo mensile subito in alto (sotto avvisi, prima dei filtri) ──
rep("""  // card obiettivo mensile (non blocca la dashboard se fallisce)
  loadTargetCard&&loadTargetCard().catch(e=>console.warn('loadTargetCard:',e))""",
    """  // per il tecnico la card obiettivo va in alto: sotto gli avvisi, prima dei filtri
  if(S.tecnico&&!window.__isCoord){
    const _ct=$('card-target-mese'),_df=$('dash-filtri')
    if(_ct&&_df&&_df.parentNode&&_ct.nextElementSibling!==_df)_df.parentNode.insertBefore(_ct,_df)
  }
  // card obiettivo mensile (non blocca la dashboard se fallisce)
  loadTargetCard&&loadTargetCard().catch(e=>console.warn('loadTargetCard:',e))""",
    'obiettivo in alto per tecnico')

# ── 7. Elenco visite: filtro tecnico (select) ──
rep('<select id="q-stato"><option value="">Tutti stati</option><option value="bozza">Bozza</option><option value="definitivo">Definitivo</option></select>',
    '<select id="q-stato"><option value="">Tutti stati</option><option value="bozza">Bozza</option><option value="definitivo">Definitivo</option></select>\n          <select id="q-tec"><option value="">Tutti i tecnici</option></select>',
    'select tecnico elenco')

rep("  const _showElim=_coord&&_qe&&_qe.checked",
    """  const _showElim=_coord&&_qe&&_qe.checked
  // filtro tecnico: popolato una volta, preimpostato sul proprio per i tecnici
  const _qt=$('q-tec')
  if(_qt&&!_qt.dataset.init){
    _qt.dataset.init='1'
    try{
      const{data:tt}=await sb.from('tecnici').select('tecnico_id,tecnico_nome,tecnico_cognome').order('tecnico_cognome')
      _qt.innerHTML='<option value="">Tutti i tecnici</option>'+(tt||[]).map(t=>`<option value="${t.tecnico_id}">${((t.tecnico_cognome||'')+' '+(t.tecnico_nome||'')).trim()||t.tecnico_id}</option>`).join('')
      if(S.tecnico&&!_coord&&(tt||[]).some(t=>t.tecnico_id===S.tecnico.tecnico_id))_qt.value=S.tecnico.tecnico_id
    }catch(_e){}
    _qt.onchange=loadLista
  }""",
    'init filtro tecnico elenco')

rep("  if(fs)qb=qb.eq('stato',fs)",
    """  if(fs)qb=qb.eq('stato',fs)
  const _ft=_qt?_qt.value:''
  if(_ft)qb=qb.or(`tecnico_id.eq.${_ft},tecnico2_id.eq.${_ft}`)""",
    'query filtro tecnico')

# ── Scrittura ──
with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

size = os.path.getsize(SRC)
ok_end = html.rstrip().endswith('</html>')
print(f'Scritto {SRC}: {size} byte, termina con </html>: {ok_end}')
assert ok_end, 'file non termina con </html>!'
print('PATCH 2 COMPLETATA')
