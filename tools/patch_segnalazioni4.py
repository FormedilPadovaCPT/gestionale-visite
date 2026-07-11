# -*- coding: utf-8 -*-
"""Patch 4 — 2026-07-10:
1. Il tecnico loggato entra nelle tendine tecnico anche se non è in TECNICI_LIST
   (es. account di prova o futuri assunti) → nuova visita con tecnico preselezionato.
2. Scadenze: filtro preimpostato sul proprio tecnico anche se non ha scadenze
   (lista vuota, ma coerente con la vista personale).
Uso: python tools/patch_segnalazioni4.py
"""
import io, os, shutil, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'index.html')
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
BAK = os.path.join(BASE, f'index_pre_segnalazioni4_{ts}.html.bak')

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

# ── 1. Tecnico loggato aggiunto a TECNICI_LIST se mancante ──
rep("""function populateTecnicoSelect(){
  const sel=$('f-tec-select'); if(!sel)return""",
    """function populateTecnicoSelect(){
  const sel=$('f-tec-select'); if(!sel)return
  // il tecnico loggato entra in tendina anche se non è nell'elenco ufficiale
  // (es. account di prova o nuovi assunti non ancora in TECNICI_LIST)
  if(S.tecnico&&S.tecnico.email&&!TECNICI_LIST.some(t=>t.email===S.tecnico.email)){
    TECNICI_LIST.push({nome:`${S.tecnico.tecnico_nome||''} ${S.tecnico.tecnico_cognome||''}`.trim()||S.tecnico.email,email:S.tecnico.email})
  }""",
    'tecnico loggato in TECNICI_LIST')

# ── 2. Scadenze: preseleziona il proprio tecnico anche senza scadenze ──
rep("""    if(prev&&idsConScad.includes(prev))sel.value=prev
    else if(S.user&&S.user.email!==ADMIN_EMAIL&&S.tecnico&&idsConScad.includes(S.tecnico.tecnico_id))sel.value=S.tecnico.tecnico_id""",
    """    if(prev&&idsConScad.includes(prev))sel.value=prev
    else if(S.user&&S.user.email!==ADMIN_EMAIL&&S.tecnico){
      // il proprio tecnico è sempre selezionabile, anche se oggi non ha scadenze
      if(!idsConScad.includes(S.tecnico.tecnico_id)){
        const _nm=((S.tecnico.tecnico_cognome||'')+' '+(S.tecnico.tecnico_nome||'')).trim()||S.tecnico.tecnico_id
        sel.innerHTML+=`<option value="${S.tecnico.tecnico_id}">${_nm}</option>`
      }
      sel.value=S.tecnico.tecnico_id
    }""",
    'scadenze default proprio tecnico')

with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

ok_end = html.rstrip().endswith('</html>')
print(f'Scritto {SRC}: {os.path.getsize(SRC)} byte, termina con </html>: {ok_end}')
assert ok_end
print('PATCH 4 COMPLETATA')
