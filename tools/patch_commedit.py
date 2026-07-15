# -*- coding: utf-8 -*-
"""Patch: (A) modifica committente selezionato nel form visita, (B) coordinamento spuntato di default."""
import shutil, datetime, io, sys, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "index.html")
BAK = os.path.join(BASE, f"index_pre_commedit_{datetime.datetime.now():%Y%m%d_%H%M%S}.html.bak")

t = io.open(SRC, encoding="utf-8").read()
orig_len = len(t)

def rep(old, new, label):
    global t
    n = t.count(old)
    assert n == 1, f"[{label}] occorrenze attese 1, trovate {n}"
    t = t.replace(old, new)
    print(f"ok: {label}")

# ---------- B1: checkbox coordinamento checked di default (HTML) ----------
rep('<input type="checkbox" id="f-coord"> Presenza di coordinamento in cantiere',
    '<input type="checkbox" id="f-coord" checked> Presenza di coordinamento in cantiere',
    "B1 html checked")

# ---------- B2: reset form -> coord true ----------
rep(";['f-privacy','f-coord','f-note-for-sn','f-segnalazione'].forEach(id=>cSet(id,false))",
    ";['f-privacy','f-note-for-sn','f-segnalazione'].forEach(id=>cSet(id,false))\n  cSet('f-coord',true) // coordinamento presente di default",
    "B2 reset default true")

# ---------- A1: pulsanti Modifica e Salva accanto a Deseleziona ----------
rep('title="Deseleziona committente">✕ Deseleziona</button>',
    'title="Deseleziona committente">✕ Deseleziona</button>\n'
    '              <button class="btn-outline btn-sm" id="btn-edit-comm" type="button" onclick="editCommittente()" style="white-space:nowrap;margin-top:1px;display:none" title="Completa o correggi i dati del committente">✏️ Modifica</button>\n'
    '              <button class="btn-outline btn-sm" id="btn-save-comm" type="button" onclick="salvaCommittente()" style="white-space:nowrap;margin-top:1px;display:none;color:#1e8449;border-color:#1e8449" title="Salva le modifiche al committente">💾 Salva</button>',
    "A1 pulsanti html")

# ---------- A2: visibilita' pulsanti in setCommFieldsReadonly ----------
rep("""  const btnNew=$('btn-new-comm'),btnClear=$('btn-clear-comm')
  if(btnNew)btnNew.style.display=on?'none':'inline-flex'
  if(btnClear)btnClear.style.display=on?'inline-flex':'none'""",
    """  const btnNew=$('btn-new-comm'),btnClear=$('btn-clear-comm')
  if(btnNew)btnNew.style.display=on?'none':'inline-flex'
  if(btnClear)btnClear.style.display=on?'inline-flex':'none'
  const btnEdit=$('btn-edit-comm'),btnSave=$('btn-save-comm')
  if(btnEdit)btnEdit.style.display=(on&&vGet('f-comm-id'))?'inline-flex':'none'
  if(btnSave)btnSave.style.display='none'""",
    "A2 visibilita pulsanti")

# ---------- A3: funzioni editCommittente / salvaCommittente ----------
ANCHOR = "{const btnClear=$('btn-clear-comm');if(btnClear)btnClear.onclick=()=>{clearCommittente()}}"
NUOVO = ANCHOR + """

// ── MODIFICA COMMITTENTE SELEZIONATO (completa i dati mancanti) ──
function editCommittente(){
  if(!vGet('f-comm-id')){toast('Nessun committente selezionato','err');return}
  setCommFieldsReadonly(false)
  const btnNew=$('btn-new-comm'); if(btnNew)btnNew.style.display='none'
  const btnEdit=$('btn-edit-comm'); if(btnEdit)btnEdit.style.display='none'
  const btnSave=$('btn-save-comm'); if(btnSave)btnSave.style.display='inline-flex'
  toast('Completa i campi mancanti e premi 💾 Salva','ok')
}
async function salvaCommittente(){
  const cid=vGet('f-comm-id')
  if(!cid){toast('Nessun committente selezionato','err');return}
  const isPG=!!($('comm-radio-pg')&&$('comm-radio-pg').checked)
  let nome,email,tel,piva
  if(isPG){
    nome=vGet('f-comm-rag-soc').trim()
    piva=vGet('f-comm-piva').replace(/\\D/g,'')
    email=vGet('f-comm-email-pg').trim()
    tel=vGet('f-comm-tel-pg').trim()
  }else{
    nome=[vGet('f-comm-nome').trim(),vGet('f-comm-cog').trim()].filter(Boolean).join(' ')
    piva=''
    email=vGet('f-comm-email').trim()
    tel=vGet('f-comm-tel').trim()
  }
  if(!nome){toast(isPG?'Ragione sociale obbligatoria':'Nome e cognome obbligatori','err');return}
  // NB: committente_id e cf_piva NON si toccano (sono la chiave del committente)
  const upd={committente_nome:nome,email:email||null,telefono:tel||null,tipo_sogg:isPG?'PG':'PF',updated_at:new Date().toISOString()}
  if(piva&&piva.length===11)upd.piva=piva
  const tipoNum=parseInt(vGet('f-comm-tipo'),10)
  if(tipoNum===1||tipoNum===2)upd.committente_tipo=tipoNum
  const{error}=await sb.from('committenti').update(upd).eq('committente_id',cid)
  if(error){toast('Errore salvataggio: '+error.message,'err');return}
  const{data:c}=await sb.from('committenti').select('committente_id,committente_nome,committente_tipo,cf_piva,piva,email,telefono,tipo_sogg').eq('committente_id',cid).maybeSingle()
  if(c){renderCommCard(c);vSet('f-comm-search',c.committente_nome||'')}
  setCommFieldsReadonly(true)
  toast('Dati committente aggiornati','ok')
}
window.editCommittente=editCommittente
window.salvaCommittente=salvaCommittente"""
rep(ANCHOR, NUOVO, "A3 funzioni edit/salva")

# ---------- salvataggio con backup ----------
shutil.copy2(SRC, BAK)
io.open(SRC, "w", encoding="utf-8", newline="").write(t)
print(f"\nbackup: {os.path.basename(BAK)}")
print(f"dimensione: {orig_len} -> {len(t)} (+{len(t)-orig_len})")
