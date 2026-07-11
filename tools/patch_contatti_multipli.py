# -*- coding: utf-8 -*-
"""Patch: contatti multipli — 2026-07-11
- persone: telefono2, email2, email3 (campo 1 = predefinito)
- imprese: impresa_telefono2, impresa_email2, impresa_email3
- schede rubrica (persona + impresa) e modale nuova impresa con i nuovi campi
- fix: il modale nuova impresa ora salva anche il telefono
- invio verbale: per ogni destinatario con più email compare una tendina (default = email 1)
- autocomplete persone: datalist con tutte le email/telefoni sul campo compilato
Uso: python tools/patch_contatti_multipli.py
"""
import io, os, shutil, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'index.html')
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
BAK = os.path.join(BASE, f'index_pre_contatti_{ts}.html.bak')
shutil.copy2(SRC, BAK)
print('Backup:', BAK)

with io.open(BAK, 'r', encoding='utf-8') as f:
    html = f.read()

def rep(old, new, label, expected=1):
    global html
    n = html.count(old)
    assert n == expected, f'{label}: attese {expected} occorrenze, trovate {n}'
    html = html.replace(old, new)
    print('OK:', label)

# ── 1. modal-persona: campi extra ──
rep('''    <div class="row">
      <div class="field" style="flex:1"><label>Email</label><input type="email" id="mp-email"></div>
      <div class="field" style="flex:1"><label>Telefono</label><input type="text" id="mp-telefono"></div>
    </div>''',
    '''    <div class="row">
      <div class="field" style="flex:1"><label>Email (predefinita)</label><input type="email" id="mp-email"></div>
      <div class="field" style="flex:1"><label>Telefono (predefinito)</label><input type="text" id="mp-telefono"></div>
    </div>
    <div class="row">
      <div class="field" style="flex:1"><label>Email 2</label><input type="email" id="mp-email2"></div>
      <div class="field" style="flex:1"><label>Email 3</label><input type="email" id="mp-email3"></div>
      <div class="field" style="flex:1"><label>Telefono 2</label><input type="text" id="mp-telefono2"></div>
    </div>''',
    'modal persona campi')

# ── 2. editPersona: carica i nuovi campi ──
rep("  vSet('mp-cf',r.cf||'');vSet('mp-qualifica',r.qualifica||'');vSet('mp-email',r.email||'');vSet('mp-telefono',r.telefono||'')",
    "  vSet('mp-cf',r.cf||'');vSet('mp-qualifica',r.qualifica||'');vSet('mp-email',r.email||'');vSet('mp-telefono',r.telefono||'')\n  vSet('mp-email2',r.email2||'');vSet('mp-email3',r.email3||'');vSet('mp-telefono2',r.telefono2||'')",
    'editPersona load')

# ── 3. mp-salva: salva i nuovi campi ──
rep("    qualifica:vGet('mp-qualifica').trim()||null,email:vGet('mp-email').trim()||null,telefono:vGet('mp-telefono').trim()||null,",
    "    qualifica:vGet('mp-qualifica').trim()||null,email:vGet('mp-email').trim()||null,telefono:vGet('mp-telefono').trim()||null,\n    email2:vGet('mp-email2').trim()||null,email3:vGet('mp-email3').trim()||null,telefono2:vGet('mp-telefono2').trim()||null,",
    'mp-salva campi')

# ── 4. merge duplicati: unisce anche i nuovi campi ──
rep(";['titolo','cf','email','telefono','qualifica'].forEach(f=>{",
    ";['titolo','cf','email','email2','email3','telefono','telefono2','qualifica'].forEach(f=>{",
    'merge esteso')

# ── 5. dettaglio persona: tutti i contatti ──
rep('''        ['Ruoli',(r.ruoli||[]).map(x=>_PERS_RUOLI[x]||x).join(', ')],
        ['Email',r.email?`<a href="mailto:${esc(r.email)}" style="color:var(--orange)">${esc(r.email)}</a>`:''],
        ['Telefono',r.telefono?`<a href="tel:${esc(r.telefono)}" style="color:var(--orange)">${esc(r.telefono)}</a>`:''],''',
    '''        ['Ruoli',(r.ruoli||[]).map(x=>_PERS_RUOLI[x]||x).join(', ')],
        ['Email (predef.)',r.email?`<a href="mailto:${esc(r.email)}" style="color:var(--orange)">${esc(r.email)}</a>`:''],
        ['Email 2',r.email2?`<a href="mailto:${esc(r.email2)}" style="color:var(--orange)">${esc(r.email2)}</a>`:''],
        ['Email 3',r.email3?`<a href="mailto:${esc(r.email3)}" style="color:var(--orange)">${esc(r.email3)}</a>`:''],
        ['Telefono (predef.)',r.telefono?`<a href="tel:${esc(r.telefono)}" style="color:var(--orange)">${esc(r.telefono)}</a>`:''],
        ['Telefono 2',r.telefono2?`<a href="tel:${esc(r.telefono2)}" style="color:var(--orange)">${esc(r.telefono2)}</a>`:''],''',
    'dettaglio persona')

# ── 6. dettaglio impresa: tutti i contatti ──
rep('''        ['Email',r.impresa_email_ref?`<a href="mailto:${esc(r.impresa_email_ref)}" style="color:var(--orange)">${esc(r.impresa_email_ref)}</a>`:''],
        ['Telefono',r.impresa_telefono?`<a href="tel:${esc(r.impresa_telefono)}" style="color:var(--orange)">${esc(r.impresa_telefono)}</a>`:''],''',
    '''        ['Email (predef.)',r.impresa_email_ref?`<a href="mailto:${esc(r.impresa_email_ref)}" style="color:var(--orange)">${esc(r.impresa_email_ref)}</a>`:''],
        ['Email 2',r.impresa_email2?`<a href="mailto:${esc(r.impresa_email2)}" style="color:var(--orange)">${esc(r.impresa_email2)}</a>`:''],
        ['Email 3',r.impresa_email3?`<a href="mailto:${esc(r.impresa_email3)}" style="color:var(--orange)">${esc(r.impresa_email3)}</a>`:''],
        ['Telefono (predef.)',r.impresa_telefono?`<a href="tel:${esc(r.impresa_telefono)}" style="color:var(--orange)">${esc(r.impresa_telefono)}</a>`:''],
        ['Telefono 2',r.impresa_telefono2?`<a href="tel:${esc(r.impresa_telefono2)}" style="color:var(--orange)">${esc(r.impresa_telefono2)}</a>`:''],''',
    'dettaglio impresa')

# ── 7. modale modifica impresa (rubrica): campi extra ──
rep('''    <div class="row">
      <div class="field">
        <label>Email</label>
        <input type="email" id="ei-email" placeholder="info@…">
      </div>
      <div class="field">
        <label>Telefono</label>
        <input type="tel" id="ei-tel" placeholder="+39…">
      </div>
    </div>''',
    '''    <div class="row">
      <div class="field">
        <label>Email (predefinita)</label>
        <input type="email" id="ei-email" placeholder="info@…">
      </div>
      <div class="field">
        <label>Telefono (predefinito)</label>
        <input type="tel" id="ei-tel" placeholder="+39…">
      </div>
    </div>
    <div class="row">
      <div class="field"><label>Email 2</label><input type="email" id="ei-email2"></div>
      <div class="field"><label>Email 3</label><input type="email" id="ei-email3"></div>
      <div class="field"><label>Telefono 2</label><input type="tel" id="ei-tel2"></div>
    </div>''',
    'modale ei campi')

rep("    vSet('ei-email',imp.impresa_email_ref || '')\n    vSet('ei-tel',  imp.impresa_telefono || '')",
    "    vSet('ei-email',imp.impresa_email_ref || '')\n    vSet('ei-tel',  imp.impresa_telefono || '')\n    vSet('ei-email2',imp.impresa_email2 || '')\n    vSet('ei-email3',imp.impresa_email3 || '')\n    vSet('ei-tel2', imp.impresa_telefono2 || '')",
    'ei load')

rep("    impresa_email_ref: vGet('ei-email').trim() || null,\n    impresa_telefono:  vGet('ei-tel').trim() || null,",
    "    impresa_email_ref: vGet('ei-email').trim() || null,\n    impresa_telefono:  vGet('ei-tel').trim() || null,\n    impresa_email2: vGet('ei-email2').trim() || null,\n    impresa_email3: vGet('ei-email3').trim() || null,\n    impresa_telefono2: vGet('ei-tel2').trim() || null,",
    'ei save')

# ── 8. modale nuova impresa: campi extra + fix telefono non salvato ──
rep('''      <div class="field"><label>Email</label><input type="email" id="mi-email" placeholder="info@…"></div>
      <div class="field"><label>Telefono</label><input type="tel" id="mi-tel" placeholder="+39…"></div>
    </div>''',
    '''      <div class="field"><label>Email (predefinita)</label><input type="email" id="mi-email" placeholder="info@…"></div>
      <div class="field"><label>Telefono (predefinito)</label><input type="tel" id="mi-tel" placeholder="+39…"></div>
    </div>
    <div class="row">
      <div class="field"><label>Email 2</label><input type="email" id="mi-email2"></div>
      <div class="field"><label>Email 3</label><input type="email" id="mi-email3"></div>
      <div class="field"><label>Telefono 2</label><input type="tel" id="mi-tel2"></div>
    </div>''',
    'modale mi campi')

rep("    impresa_email_ref:vGet('mi-email').trim()||null,",
    "    impresa_email_ref:vGet('mi-email').trim()||null,\n    impresa_telefono:vGet('mi-tel').trim()||null,\n    impresa_email2:vGet('mi-email2').trim()||null,\n    impresa_email3:vGet('mi-email3').trim()||null,\n    impresa_telefono2:vGet('mi-tel2').trim()||null,",
    'mi save (+fix telefono)')

rep(";['mi-piva','mi-cf','mi-ind','mi-com','mi-email','mi-tel','mi-badge','mi-pat','mi-ceiv','mi-tipo-ccia','mi-ccnl','mi-ccnl-altro'].forEach(",
    ";['mi-piva','mi-cf','mi-ind','mi-com','mi-email','mi-email2','mi-email3','mi-tel','mi-tel2','mi-badge','mi-pat','mi-ceiv','mi-tipo-ccia','mi-ccnl','mi-ccnl-altro'].forEach(",
    'mi reset')

# ── 9. ricerca rubrica sui nuovi campi ──
rep("if(q)qb=qb.or(`impresa_nome.ilike.*${q}*,piva.ilike.*${q}*,impresa_cf.ilike.*${q}*,impresa_email_ref.ilike.*${q}*,impresa_telefono.ilike.*${q}*,comune.ilike.*${q}*`)",
    "if(q)qb=qb.or(`impresa_nome.ilike.*${q}*,piva.ilike.*${q}*,impresa_cf.ilike.*${q}*,impresa_email_ref.ilike.*${q}*,impresa_email2.ilike.*${q}*,impresa_email3.ilike.*${q}*,impresa_telefono.ilike.*${q}*,impresa_telefono2.ilike.*${q}*,comune.ilike.*${q}*`)",
    'ricerca imprese')

rep("if(q)qb=qb.or(`nome.ilike.*${q}*,cognome.ilike.*${q}*,cf.ilike.*${q}*,email.ilike.*${q}*,telefono.ilike.*${q}*,qualifica.ilike.*${q}*`)",
    "if(q)qb=qb.or(`nome.ilike.*${q}*,cognome.ilike.*${q}*,cf.ilike.*${q}*,email.ilike.*${q}*,email2.ilike.*${q}*,email3.ilike.*${q}*,telefono.ilike.*${q}*,telefono2.ilike.*${q}*,qualifica.ilike.*${q}*`)",
    'ricerca persone')

# ── 10. autocomplete: datalist con tutti i contatti ──
rep("""    if(cfg.email)set(cfg.email,r.email)
    if(cfg.tel)set(cfg.tel,r.telefono)""",
    """    if(cfg.email){
      set(cfg.email,r.email||r.email2||r.email3)
      const el=$(cfg.email)
      if(el){let dl=document.getElementById(cfg.email+'-dl');if(!dl){dl=document.createElement('datalist');dl.id=cfg.email+'-dl';document.body.appendChild(dl);el.setAttribute('list',dl.id)}
        dl.innerHTML=[r.email,r.email2,r.email3].filter(Boolean).map(x=>`<option value="${esc(x)}">`).join('')}
    }
    if(cfg.tel){
      set(cfg.tel,r.telefono||r.telefono2)
      const el=$(cfg.tel)
      if(el){let dl=document.getElementById(cfg.tel+'-dl');if(!dl){dl=document.createElement('datalist');dl.id=cfg.tel+'-dl';document.body.appendChild(dl);el.setAttribute('list',dl.id)}
        dl.innerHTML=[r.telefono,r.telefono2].filter(Boolean).map(x=>`<option value="${esc(x)}">`).join('')}
    }""",
    'autocomplete datalist')

# ── 11. upsert al salvataggio: slot liberi per contatti nuovi ──
rep("      let qb=sb.from('persone').select('persona_id,titolo,email,telefono,qualifica,ruoli').eq('elimina',0).limit(1)",
    "      let qb=sb.from('persone').select('persona_id,titolo,email,email2,email3,telefono,telefono2,qualifica,ruoli').eq('elimina',0).limit(1)",
    'upsert select')

rep("""        if(email&&!r.email)upd.email=email
        if(tel&&!r.telefono)upd.telefono=tel""",
    """        const _ems=[r.email,r.email2,r.email3].map(x=>(x||'').trim().toLowerCase())
        if(email&&!_ems.includes(email.toLowerCase())){
          if(!r.email)upd.email=email
          else if(!r.email2)upd.email2=email
          else if(!r.email3)upd.email3=email
        }
        const _tls=[r.telefono,r.telefono2].map(x=>(x||'').replace(/\\s/g,''))
        if(tel&&!_tls.includes(tel.replace(/\\s/g,''))){
          if(!r.telefono)upd.telefono=tel
          else if(!r.telefono2)upd.telefono2=tel
        }""",
    'upsert slot contatti')

# ── 12. invio verbale: impresa_id sui destinatari ──
rep("const{data:impRows}=await sb.from('visite_imprese_presenti').select('imprese(impresa_nome,impresa_email_ref)').eq('visita_id',vid).order('ordine')",
    "const{data:impRows}=await sb.from('visite_imprese_presenti').select('impresa_id,imprese(impresa_nome,impresa_email_ref)').eq('visita_id',vid).order('ordine')",
    'select imprese flow1')

rep("    if(ev)emails.push({ruolo:'Impresa',nome:im.imprese?.impresa_nome||`Impresa ${idx+1}`,email:ev})",
    "    if(ev)emails.push({ruolo:'Impresa',nome:im.imprese?.impresa_nome||`Impresa ${idx+1}`,email:ev,impresa_id:im.impresa_id||null})",
    'push impresa flow1')

rep("    if(ev) emails.push({ruolo:'Impresa',nome:im.impresa_nome||`Impresa ${idx+1}`,email:ev})",
    "    if(ev) emails.push({ruolo:'Impresa',nome:im.impresa_nome||`Impresa ${idx+1}`,email:ev,impresa_id:im.impresa_id||null})",
    'push impresa flow2')

# ── 13. invio verbale: render con tendina email alternative (2 flussi identici) ──
OLD_RENDER = """  $('email-verbale-list').innerHTML=emails.map(e=>`
    <div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid #eee;font-size:13px">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--grey);min-width:72px;letter-spacing:.4px">${e.ruolo}</span>
      <span style="flex:1;color:#333">${e.nome}</span>
      <span style="color:var(--orange);font-size:12px">${e.email}</span>
    </div>`).join('')"""
NEW_RENDER = """  window._evEmails=emails
  _evRenderList()
  _evArricchisciAlt(emails).then(()=>_evRenderList()).catch(()=>{})"""
rep(OLD_RENDER, NEW_RENDER, 'render destinatari (x2)', expected=2)

# ── 14. helper: render lista + ricerca email alternative ──
rep("window.editPersona=editPersona",
    """// ── invio verbale: destinatari con scelta email alternativa ──
function _evRenderList(){
  const emails=window._evEmails||[]
  const box=$('email-verbale-list');if(!box)return
  box.innerHTML=emails.map((e,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid #eee;font-size:13px">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--grey);min-width:72px;letter-spacing:.4px">${esc(e.ruolo)}</span>
      <span style="flex:1;color:#333">${esc(e.nome)}</span>
      ${(e.alt&&e.alt.length>1)
        ?`<select onchange="window._evEmails[${i}].email=this.value" title="Questo contatto ha più email: scegli a quale inviare" style="color:var(--orange);font-size:12px;max-width:240px;border:1px solid #f0d9cc;border-radius:6px;padding:2px 4px;background:#fffaf7">${e.alt.map(a=>`<option value="${esc(a)}"${a===e.email?' selected':''}>${esc(a)}</option>`).join('')}</select>`
        :`<span style="color:var(--orange);font-size:12px">${esc(e.email)}</span>`}
    </div>`).join('')
}
async function _evArricchisciAlt(emails){
  try{
    // imprese: email alternative dall'anagrafica
    const impIds=[...new Set(emails.filter(e=>e.ruolo==='Impresa'&&e.impresa_id).map(e=>e.impresa_id))]
    const impMap={}
    if(impIds.length){
      const{data}=await sb.from('imprese').select('impresa_id,impresa_email_ref,impresa_email2,impresa_email3').in('impresa_id',impIds)
      ;(data||[]).forEach(r=>{impMap[r.impresa_id]=[r.impresa_email_ref,r.impresa_email2,r.impresa_email3].map(x=>(x||'').trim()).filter(Boolean)})
    }
    // figure (RL/CSP/CSE): email alternative dalla rubrica persone (match su una delle 3 email)
    const figEmails=[...new Set(emails.filter(e=>['RL','CSP','CSE'].includes(e.ruolo)&&e.email).map(e=>e.email.trim().toLowerCase()))]
    const persAlt={}
    if(figEmails.length){
      const orExpr=figEmails.map(em=>`email.ilike.${em},email2.ilike.${em},email3.ilike.${em}`).join(',')
      const{data}=await sb.from('persone').select('email,email2,email3').eq('elimina',0).or(orExpr).limit(60)
      ;(data||[]).forEach(r=>{
        const set=[r.email,r.email2,r.email3].map(x=>(x||'').trim()).filter(Boolean)
        set.forEach(em=>{persAlt[em.toLowerCase()]=set})
      })
    }
    emails.forEach(e=>{
      let alt=null
      if(e.ruolo==='Impresa'&&e.impresa_id&&impMap[e.impresa_id])alt=impMap[e.impresa_id]
      else if(['RL','CSP','CSE'].includes(e.ruolo)&&e.email&&persAlt[e.email.trim().toLowerCase()])alt=persAlt[e.email.trim().toLowerCase()]
      if(alt&&alt.length){
        const uniq=[...new Set([e.email,...alt].map(x=>(x||'').trim()).filter(Boolean))]
        if(uniq.length>1)e.alt=uniq
      }
    })
  }catch(_e){console.warn('email alternative:',_e)}
  return emails
}
window.editPersona=editPersona""",
    'helper alt email')

with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

ok_end = html.rstrip().endswith('</html>')
print(f'Scritto {SRC}: {os.path.getsize(SRC)} byte, termina con </html>: {ok_end}')
assert ok_end
print('PATCH CONTATTI MULTIPLI COMPLETATA')
