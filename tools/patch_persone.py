# -*- coding: utf-8 -*-
"""Patch: anagrafica persone in rubrica — 2026-07-10
- Rubrica: categoria "Figure di cantiere" (persona presente, RL, CSP, CSE) con ricerca
- Scheda persona modificabile (CF solo coordinatore) + dettaglio
- Trova/unisci duplicati per nome+cognome (anche invertiti), solo coordinatore
- Form visita: autocomplete persone su presente/RL/CSP/CSE + upsert al salvataggio
Uso: python tools/patch_persone.py
"""
import io, os, shutil, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'index.html')
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
BAK = os.path.join(BASE, f'index_pre_persone_{ts}.html.bak')
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

# ── 1. Rubrica: categoria persone + pulsante duplicati ──
rep('''            <option value="tecnico">👷 Tecnici</option>
          </select>''',
    '''            <option value="persona">👥 Figure di cantiere</option>
            <option value="tecnico">👷 Tecnici</option>
          </select>
          <button class="btn-outline btn-sm" id="rub-dedup-btn" style="display:none" onclick="apriDedupPersone()">🧹 Duplicati persone</button>''',
    'categoria + pulsante dedup')

# ── 2. Modali persona + dedup ──
rep('<!-- ── MODAL SEGNALA CANTIERE (mobile GPS) ── -->',
    '''<!-- ── MODAL MODIFICA PERSONA (rubrica) ── -->
<div class="modal-overlay hidden" id="modal-persona">
  <div class="modal-box" style="max-width:540px">
    <h3>👥 Scheda persona</h3>
    <div class="row">
      <div class="field" style="flex:1"><label>Titolo</label><select id="mp-titolo"><option value="">–</option><option>Sig.</option><option>Sig.ra</option><option>Dott.</option><option>Dott.ssa</option><option>Geom.</option><option>P.I.</option><option>Ing.</option><option>Arch.</option><option>Avv.</option><option>Prof.</option><option>Rag.</option></select></div>
      <div class="field" style="flex:2"><label>Nome</label><input type="text" id="mp-nome"></div>
      <div class="field" style="flex:2"><label>Cognome *</label><input type="text" id="mp-cognome"></div>
    </div>
    <div class="row">
      <div class="field" style="flex:1"><label>Codice fiscale <span id="mp-cf-note" style="font-weight:400;font-size:10px;color:#aaa"></span></label><input type="text" id="mp-cf" maxlength="16" style="text-transform:uppercase"></div>
      <div class="field" style="flex:1"><label>Qualifica</label><input type="text" id="mp-qualifica"></div>
    </div>
    <div class="row">
      <div class="field" style="flex:1"><label>Email</label><input type="email" id="mp-email"></div>
      <div class="field" style="flex:1"><label>Telefono</label><input type="text" id="mp-telefono"></div>
    </div>
    <div id="mp-ruoli" style="font-size:12px;color:#888;margin:4px 0 10px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn-secondary btn-sm" onclick="hide('modal-persona')">Annulla</button>
      <button class="btn-primary btn-sm" id="mp-salva">Salva</button>
    </div>
  </div>
</div>
<!-- ── MODAL DUPLICATI PERSONE (coordinatore) ── -->
<div class="modal-overlay hidden" id="modal-dedup">
  <div class="modal-box" style="max-width:720px">
    <h3>🧹 Duplicati persone</h3>
    <p style="font-size:12px;color:#888;margin-bottom:10px">Gruppi con lo stesso nome e cognome (anche invertiti). Scegli la scheda principale e premi Unisci: i contatti mancanti vengono recuperati dalle altre schede, che finiscono nel cestino.</p>
    <div id="dedup-list" style="max-height:420px;overflow:auto"></div>
    <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn-secondary btn-sm" onclick="hide('modal-dedup')">Chiudi</button></div>
  </div>
</div>
<!-- ── MODAL SEGNALA CANTIERE (mobile GPS) ── -->''',
    'modali persona/dedup')

# ── 3. loadRubrica: pulsante dedup visibile al coordinatore ──
rep('''async function loadRubrica(){
  const q=($('rub-search')?.value||'').trim().toLowerCase()''',
    '''async function loadRubrica(){
  const _db=$('rub-dedup-btn');if(_db)_db.style.display=window.__isCoord?'':'none'
  const q=($('rub-search')?.value||'').trim().toLowerCase()''',
    'dedup btn visibilità')

# ── 4. loadRubrica: blocco PERSONE prima dei tecnici ──
rep('''  // ── TECNICI ──''',
    '''  // ── PERSONE (figure di cantiere) ──
  if(!cat||cat==='persona'){
    let qb=sb.from('persone').select('*').eq('elimina',0).order('cognome',{ascending:true,nullsFirst:false}).limit(60)
    if(q)qb=qb.or(`nome.ilike.*${q}*,cognome.ilike.*${q}*,cf.ilike.*${q}*,email.ilike.*${q}*,telefono.ilike.*${q}*,qualifica.ilike.*${q}*`)
    const{data}=await qb
    ;(data||[]).forEach(r=>{
      const nomev=[r.titolo,r.nome,r.cognome].filter(Boolean).join(' ')
      const sub=[(r.ruoli||[]).map(x=>_PERS_RUOLI[x]||x).join(', '),r.cf].filter(Boolean).join(' · ')
      const extra=[
        r.qualifica?esc(r.qualifica):'',
        r.email?`<a href="mailto:${esc(r.email)}" style="color:var(--orange)">${esc(r.email)}</a>`:'',
        r.telefono?`<a href="tel:${esc(r.telefono)}" style="color:var(--orange)">${esc(r.telefono)}</a>`:'',
        `<a href="javascript:void(0)" onclick="event.stopPropagation();editPersona('${r.persona_id}')" style="color:var(--grey)">✏️ Modifica</a>`
      ].filter(Boolean)
      cards.push(rubCard('👥','persona',r.persona_id,esc(nomev||'–'),esc(sub),extra))
    })
  }

  // ── TECNICI ──''',
    'blocco persone in rubrica')

# ── 5. showRubricaDetail: ramo persona ──
rep('''  try{
    if(tipo==='impresa'){''',
    '''  try{
    if(tipo==='persona'){
      const{data:r,error}=await sb.from('persone').select('*').eq('persona_id',id).single()
      if(error||!r){toast('Persona non trovata','err');hide('modal-rub-detail');return}
      $('rub-detail-title').textContent=`👥 ${[r.titolo,r.nome,r.cognome].filter(Boolean).join(' ')}`
      $('rub-detail-badge').innerHTML=`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:#f3e8f8;color:#8e44ad">PERSONA</span>`
      let html=qdSec('Anagrafica')
      html+=qdDl([
        ['Titolo',r.titolo],['Nome',r.nome],['Cognome',r.cognome],['Codice fiscale',r.cf],
        ['Qualifica',r.qualifica],
        ['Ruoli',(r.ruoli||[]).map(x=>_PERS_RUOLI[x]||x).join(', ')],
        ['Email',r.email?`<a href="mailto:${esc(r.email)}" style="color:var(--orange)">${esc(r.email)}</a>`:''],
        ['Telefono',r.telefono?`<a href="tel:${esc(r.telefono)}" style="color:var(--orange)">${esc(r.telefono)}</a>`:''],
      ])
      $('rub-detail-body').innerHTML=html
      const be=document.createElement('button');be.className='btn-primary btn-sm';be.textContent='✏️ Modifica'
      be.onclick=()=>{hide('modal-rub-detail');editPersona(id)}
      $('rub-detail-actions').appendChild(be)
      return
    }
    if(tipo==='impresa'){''',
    'dettaglio persona')

# ── 6. saveVisita: upsert anagrafica persone ──
rep("    toast(`Visita salvata come ${stato==='bozza'?'bozza':'definitivo'}`, 'ok')",
    """    upsertPersoneVisita().catch(_e=>console.warn('upsertPersone:',_e))
    toast(`Visita salvata come ${stato==='bozza'?'bozza':'definitivo'}`, 'ok')""",
    'hook upsert su salvataggio')

# ── 7. Blocco JS persone (dopo il blocco segnalazioni) ──
rep('''window.segnApriAggancio=segnApriAggancio
window.segnAggancia=segnAggancia
window.segnScarta=segnScarta''',
    '''window.segnApriAggancio=segnApriAggancio
window.segnAggancia=segnAggancia
window.segnScarta=segnScarta

// ══════════════════════════════════════════════════════════════
// ── ANAGRAFICA PERSONE (rubrica + autocomplete form) ──
// ══════════════════════════════════════════════════════════════
const _PERS_RUOLI={presente:'Presente in visita',rl:'Resp. lavori',csp:'CSP',cse:'CSE'}

// ── scheda persona (modifica) ──
let _mpId=null
async function editPersona(id){
  const{data:r,error}=await sb.from('persone').select('*').eq('persona_id',id).single()
  if(error||!r){toast('Persona non trovata','err');return}
  _mpId=id
  vSet('mp-titolo',r.titolo||'');vSet('mp-nome',r.nome||'');vSet('mp-cognome',r.cognome||'')
  vSet('mp-cf',r.cf||'');vSet('mp-qualifica',r.qualifica||'');vSet('mp-email',r.email||'');vSet('mp-telefono',r.telefono||'')
  const coord=!!window.__isCoord
  $('mp-cf').disabled=!coord
  $('mp-cf-note').textContent=coord?'':'(modificabile solo dal coordinatore)'
  $('mp-ruoli').textContent='Ruoli visti nelle visite: '+((r.ruoli||[]).map(x=>_PERS_RUOLI[x]||x).join(', ')||'–')
  show('modal-persona')
}
$('mp-salva').onclick=async()=>{
  if(!_mpId)return
  const cog=vGet('mp-cognome').trim()
  if(!cog){toast('Il cognome è obbligatorio','warn');return}
  const upd={titolo:vGet('mp-titolo')||null,nome:vGet('mp-nome').trim()||null,cognome:cog,
    qualifica:vGet('mp-qualifica').trim()||null,email:vGet('mp-email').trim()||null,telefono:vGet('mp-telefono').trim()||null,
    updated_at:new Date().toISOString(),updated_by:S.user?.email||null}
  if(window.__isCoord)upd.cf=vGet('mp-cf').trim().toUpperCase()||null
  const{error}=await sb.from('persone').update(upd).eq('persona_id',_mpId)
  if(error){toast('Errore salvataggio: '+error.message,'err');return}
  hide('modal-persona');toast('Persona aggiornata ✓','ok')
  loadRubrica()
}

// ── duplicati (solo coordinatore) ──
let _dedupData=null
window._dedupKeys={}
async function apriDedupPersone(){
  if(!window.__isCoord){toast('Funzione riservata al coordinatore','err');return}
  const{data,error}=await sb.from('persone').select('*').eq('elimina',0).limit(5000)
  if(error){toast('Errore: '+error.message,'err');return}
  const groups={}
  ;(data||[]).forEach(r=>{
    const a=(r.nome||'').trim().toLowerCase(),b=(r.cognome||'').trim().toLowerCase()
    if(!a&&!b)return
    const k=[a,b].sort().join('|')
    ;(groups[k]=groups[k]||[]).push(r)
  })
  const dupli=Object.entries(groups).filter(([,v])=>v.length>1)
  _dedupData={};window._dedupKeys={}
  const box=$('dedup-list')
  if(!dupli.length){
    box.innerHTML='<div style="color:#27ae60;padding:14px">✅ Nessun duplicato trovato (stesso nome e cognome).</div>'
  }else{
    box.innerHTML=dupli.map(([k,rows],gi)=>{
      const kid='g'+gi
      _dedupData[kid]=rows;window._dedupKeys[kid]=k
      return `<div style="border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:10px">
        <div style="font-weight:700;margin-bottom:6px">${esc((rows[0].cognome||'')+' '+(rows[0].nome||''))} <span style="color:#888;font-weight:400">(${rows.length} schede)</span></div>
        ${rows.map(r=>`<label style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:12px;cursor:pointer">
          <input type="radio" name="ded-${kid}" value="${r.persona_id}" style="margin-top:2px">
          <span style="flex:1">${esc([r.titolo,r.nome,r.cognome].filter(Boolean).join(' '))} · ${esc(r.qualifica||'–')} · ${esc(r.email||'no email')} · ${esc(r.telefono||'no tel')} · CF: ${esc(r.cf||'–')} · ${(r.ruoli||[]).map(x=>_PERS_RUOLI[x]||x).join(', ')}</span>
        </label>`).join('')}
        <button class="btn-primary btn-sm" style="margin-top:6px" onclick="dedupMerge('${kid}')">Unisci sul selezionato</button>
      </div>`
    }).join('')
  }
  show('modal-dedup')
}
async function dedupMerge(kid){
  const rows=(_dedupData&&_dedupData[kid])||[]
  const sel=document.querySelector(`input[name="ded-${kid}"]:checked`)
  if(!sel){toast('Seleziona prima la scheda principale del gruppo','warn');return}
  const master=rows.find(r=>r.persona_id===sel.value)
  const others=rows.filter(r=>r.persona_id!==sel.value)
  if(!master||!others.length)return
  if(!confirm(`Unire ${others.length} sched${others.length===1?'a':'e'} su "${[master.titolo,master.nome,master.cognome].filter(Boolean).join(' ')}"?`))return
  const upd={}
  ;['titolo','cf','email','telefono','qualifica'].forEach(f=>{
    if(!master[f]){const v=others.map(o=>o[f]).find(Boolean);if(v)upd[f]=v}
  })
  const ruoli=new Set(master.ruoli||[]);others.forEach(o=>(o.ruoli||[]).forEach(x=>ruoli.add(x)))
  if(ruoli.size!==(master.ruoli||[]).length)upd.ruoli=[...ruoli]
  if(Object.keys(upd).length){
    upd.updated_at=new Date().toISOString();upd.updated_by=S.user?.email||null
    const{error}=await sb.from('persone').update(upd).eq('persona_id',master.persona_id)
    if(error){toast('Errore aggiornamento: '+error.message,'err');return}
  }
  const{error:e2}=await sb.from('persone').update({elimina:1,updated_at:new Date().toISOString(),updated_by:S.user?.email||null}).in('persona_id',others.map(o=>o.persona_id))
  if(e2){toast('Errore eliminazione doppioni: '+e2.message,'err');return}
  toast('Schede unite ✓','ok')
  apriDedupPersone()
}

// ── autocomplete persone nel form visita ──
function attachPersonAC(cfg){
  const list=document.createElement('div')
  list.className='hidden'
  list.style.cssText='position:absolute;z-index:9999;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.15);max-height:220px;overflow:auto;min-width:260px;font-size:13px'
  document.body.appendChild(list)
  let items=[]
  const hideL=()=>list.classList.add('hidden')
  const showAt=el=>{const r=el.getBoundingClientRect();list.style.left=(r.left+window.scrollX)+'px';list.style.top=(r.bottom+window.scrollY+2)+'px';list.classList.remove('hidden')}
  const pick=r=>{
    const set=(id,v)=>{const el=$(id);if(el&&v)el.value=v}
    if(cfg.titolo&&r.titolo){const s=$(cfg.titolo);if(s&&[...s.options].some(o=>o.value===r.titolo||o.text===r.titolo))s.value=r.titolo}
    set(cfg.nome,r.nome);set(cfg.cog,r.cognome)
    if(cfg.email)set(cfg.email,r.email)
    if(cfg.tel)set(cfg.tel,r.telefono)
    if(cfg.qual&&r.qualifica){const s=$(cfg.qual);if(s&&[...s.options].some(o=>o.value===r.qualifica||o.text===r.qualifica))s.value=r.qualifica}
    hideL()
  }
  const onInput=async ev=>{
    const q=ev.target.value.trim()
    if(q.length<2){hideL();return}
    let data=null
    try{const r=await sb.from('persone').select('*').eq('elimina',0).or(`nome.ilike.*${q}*,cognome.ilike.*${q}*`).order('cognome',{ascending:true,nullsFirst:false}).limit(8);data=r.data}catch(_e){}
    items=data||[]
    if(!items.length){hideL();return}
    list.innerHTML=items.map((r,i)=>`<div data-i="${i}" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid #f2f2f2" onmouseenter="this.style.background='#fff3ee'" onmouseleave="this.style.background=''">${esc([r.titolo,r.nome,r.cognome].filter(Boolean).join(' '))}${r.qualifica?' <span style="color:#999;font-size:11px">('+esc(r.qualifica)+')</span>':''}${r.telefono||r.email?'<br><span style="color:#999;font-size:11px">'+esc([r.telefono,r.email].filter(Boolean).join(' · '))+'</span>':''}</div>`).join('')
    ;[...list.children].forEach(d=>d.onmousedown=e=>{e.preventDefault();pick(items[+d.dataset.i])})
    showAt(ev.target)
  }
  ;[cfg.nome,cfg.cog].forEach(id=>{
    const el=$(id);if(!el)return
    el.addEventListener('input',onInput)
    el.addEventListener('blur',()=>setTimeout(hideL,180))
    el.setAttribute('autocomplete','off')
  })
}
attachPersonAC({nome:'f-ppre-nome',cog:'f-ppre-cog',titolo:'f-ppre-titolo',tel:'f-tel-ppre',qual:'f-qual-ppre'})
attachPersonAC({nome:'f-rl-nome',cog:'f-rl-cog',titolo:'f-rl-titolo',email:'f-rl-email',tel:'f-rl-tel'})
attachPersonAC({nome:'f-csp-nome',cog:'f-csp-cog',titolo:'f-csp-titolo',email:'f-csp-email',tel:'f-csp-tel'})
attachPersonAC({nome:'f-cse-nome',cog:'f-cse-cog',titolo:'f-cse-titolo',email:'f-cse-email',tel:'f-cse-tel'})

// ── aggiorna l'anagrafica quando si salva una visita ──
async function upsertPersoneVisita(){
  const specs=[
    {t:'f-ppre-titolo',n:'f-ppre-nome',c:'f-ppre-cog',tel:'f-tel-ppre',q:'f-qual-ppre',ruolo:'presente'},
    {t:'f-rl-titolo',n:'f-rl-nome',c:'f-rl-cog',em:'f-rl-email',tel:'f-rl-tel',ruolo:'rl'},
    {t:'f-csp-titolo',n:'f-csp-nome',c:'f-csp-cog',em:'f-csp-email',tel:'f-csp-tel',ruolo:'csp'},
    {t:'f-cse-titolo',n:'f-cse-nome',c:'f-cse-cog',em:'f-cse-email',tel:'f-cse-tel',ruolo:'cse'}
  ]
  for(const s of specs){
    const nome=(vGet(s.n)||'').trim(),cog=(vGet(s.c)||'').trim()
    if(!nome&&!cog)continue
    if((nome+cog).length<4)continue
    const titolo=(vGet(s.t)||'').trim()||null
    const email=s.em?(vGet(s.em)||'').trim()||null:null
    const tel=s.tel?(vGet(s.tel)||'').trim()||null:null
    const qual=s.q?(vGet(s.q)||'').trim()||null:null
    try{
      let qb=sb.from('persone').select('persona_id,titolo,email,telefono,qualifica,ruoli').eq('elimina',0).limit(1)
      qb=nome?qb.ilike('nome',nome):qb.is('nome',null)
      qb=cog?qb.ilike('cognome',cog):qb.is('cognome',null)
      const{data:ex}=await qb
      if(ex&&ex.length){
        const r=ex[0],upd={}
        if(titolo&&!r.titolo)upd.titolo=titolo
        if(email&&!r.email)upd.email=email
        if(tel&&!r.telefono)upd.telefono=tel
        if(qual&&!r.qualifica)upd.qualifica=qual
        if(!(r.ruoli||[]).includes(s.ruolo))upd.ruoli=[...(r.ruoli||[]),s.ruolo]
        if(Object.keys(upd).length){
          upd.updated_at=new Date().toISOString();upd.updated_by=S.user?.email||null
          await sb.from('persone').update(upd).eq('persona_id',r.persona_id)
        }
      }else{
        await sb.from('persone').insert({titolo,nome:nome||null,cognome:cog||null,email,telefono:tel,qualifica:qual,ruoli:[s.ruolo],updated_by:S.user?.email||null})
      }
    }catch(_e){console.warn('upsertPersone:',_e)}
  }
}
window.editPersona=editPersona
window.apriDedupPersone=apriDedupPersone
window.dedupMerge=dedupMerge''',
    'blocco js persone')

with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

ok_end = html.rstrip().endswith('</html>')
print(f'Scritto {SRC}: {os.path.getsize(SRC)} byte, termina con </html>: {ok_end}')
assert ok_end
print('PATCH PERSONE COMPLETATA')
