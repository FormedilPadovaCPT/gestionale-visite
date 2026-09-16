/* ============================================================
   ACCESSO NEGATO AL CANTIERE (16/09/2026, chiesto dall'utente)

   Quando al tecnico viene negato l'accesso a un cantiere, lo
   segnala da qui: la segnalazione arriva alla segreteria, che la
   gestisce dall'app segreteria (cruscotto).

   Essenziali, come chiesto: DATA, IMPRESA, CANTIERE e NOTE.
   Impresa e cantiere si cercano nell'anagrafica; se non ci sono,
   si scrivono a mano e vanno bene lo stesso. Chi segnala e il
   tecnico non si scelgono: li mette il database dall'accesso.

   Tabella s_dinieghi_accesso (SQL in segreteria-app/supabase/sql/
   2026_09_16_dinieghi_accesso_cantiere.sql): il tecnico inserisce
   e rilegge le proprie, la segreteria gestisce. Una segnalazione
   non si cancella: la segreteria la chiude.

   Script classico, come stage-relazione.js: usa window.sb, window.S
   e window.toast esposti dal modulo principale di index.html.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oggi = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  /* nei filtri or() di PostgREST virgole e parentesi spezzano la condizione */
  const pulito = (q) => String(q || '').replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim();
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));

  const STATI = { nuovo: ['#e7500f', 'inviata'], in_gestione: ['#D9A400', 'in gestione'], chiuso: ['#27ae60', 'gestita'] };

  let impresa = null;   // { impresa_id, impresa_nome, ... } scelta dall'anagrafica
  let cantiere = null;  // { cantiere_id, ... } scelto dall'anagrafica
  let timerImp = null, timerCant = null, reqImp = 0, reqCant = 0;

  function modale() {
    if ($('modal-diniego')) return;
    const div = document.createElement('div');
    div.className = 'modal-overlay hidden';
    div.id = 'modal-diniego';
    div.innerHTML = `
  <div class="modal-box" style="max-width:560px">
    <h3>&#128683; Accesso negato al cantiere</h3>
    <p style="font-size:12px;color:#666;margin:0 0 12px">La segnalazione arriva alla segreteria, che la gestisce. Impresa e cantiere si cercano in anagrafica; se non li trovi, scrivili come li hai visti.</p>
    <div class="field" style="max-width:190px"><label>Data *</label><input type="date" id="din-data"></div>

    <div class="field" style="position:relative"><label>Impresa *</label>
      <input type="text" id="din-imp" autocomplete="off" placeholder="Nome, codice fiscale o P.IVA">
      <div id="din-imp-ris" class="din-ris"></div>
      <div id="din-imp-sel" class="din-sel"></div>
    </div>

    <div class="field" style="position:relative"><label>Cantiere *</label>
      <input type="text" id="din-cant" autocomplete="off" placeholder="Indirizzo, comune o CNCE">
      <div id="din-cant-ris" class="din-ris"></div>
      <div id="din-cant-sel" class="din-sel"></div>
    </div>

    <div class="field"><label>Note *</label>
      <textarea id="din-note" rows="4" maxlength="2000" style="width:100%" placeholder="Chi ha negato l'accesso e con quale motivo, cosa hai visto, se hai lasciato recapiti…"></textarea></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap">
      <button class="btn-secondary btn-sm" id="din-annulla">Annulla</button>
      <button class="btn-primary btn-sm" id="din-salva">Invia alla segreteria</button>
    </div>

    <div id="din-mie" style="margin-top:16px"></div>
  </div>`;
    document.body.appendChild(div);

    const stile = document.createElement('style');
    stile.textContent = `
      .din-ris{display:none;position:absolute;left:0;right:0;z-index:5;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.12);max-height:230px;overflow:auto;margin-top:2px}
      .din-ris div{padding:8px 10px;font-size:13px;cursor:pointer;border-bottom:1px solid #f0f0f0}
      .din-ris div:hover{background:#fff4ee}
      .din-ris small{color:#888}
      .din-sel{font-size:12px;margin-top:4px}
      .din-sel b{color:#27ae60}
      .din-mia{font-size:12px;padding:6px 0;border-top:1px solid #f0f0f0}
      .din-stato{display:inline-block;padding:1px 7px;border-radius:10px;color:#fff;font-size:11px}`;
    document.head.appendChild(stile);

    $('din-annulla').onclick = () => div.classList.add('hidden');
    $('din-salva').onclick = salva;
    $('din-imp').addEventListener('input', () => {
      impresa = null; mostraScelta();
      clearTimeout(timerImp); timerImp = setTimeout(cercaImprese, 300);
    });
    $('din-cant').addEventListener('input', () => {
      cantiere = null; mostraScelta();
      clearTimeout(timerCant); timerCant = setTimeout(cercaCantieri, 300);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#din-imp, #din-imp-ris')) $('din-imp-ris').style.display = 'none';
      if (!e.target.closest('#din-cant, #din-cant-ris')) $('din-cant-ris').style.display = 'none';
    });
  }

  function etichettaCantiere(c) {
    const via = [c.cantiere_indirizzo, c.cantiere_civico].filter(Boolean).join(' ');
    return [c.cantiere_etichetta && c.cantiere_etichetta !== via ? c.cantiere_etichetta : '', via, c.comune_nome]
      .filter(Boolean).join(', ') + (c.cantiere_cnce ? ` — ${c.cantiere_cnce}` : '');
  }

  function mostraScelta() {
    $('din-imp-sel').innerHTML = impresa
      ? `<b>&#10003; dall'anagrafica</b> ${esc(impresa.impresa_nome)}${impresa.impresa_cf ? ` <span style="color:#888">(${esc(impresa.impresa_cf)})</span>` : ''}`
      : ($('din-imp').value.trim() ? '<span style="color:#888">Scritta a mano: va bene anche così.</span>' : '');
    $('din-cant-sel').innerHTML = cantiere
      ? `<b>&#10003; dall'anagrafica</b> ${esc(etichettaCantiere(cantiere))}`
      : ($('din-cant').value.trim() ? '<span style="color:#888">Scritto a mano: va bene anche così.</span>' : '');
  }

  async function cercaImprese() {
    const q = pulito($('din-imp').value);
    const box = $('din-imp-ris');
    if (q.length < 3) { box.style.display = 'none'; return; }
    const req = ++reqImp;
    try {
      let { data, error } = await window.sb.from('imprese')
        .select('impresa_id, impresa_nome, impresa_cf, comune, elimina')
        .or(`impresa_nome.ilike.%${q}%,impresa_cf.ilike.${q}%,impresa_id.ilike.${q}%`)
        .order('impresa_nome').limit(25);
      if (req !== reqImp) return;
      if (error) throw error;
      data = (data || []).filter((r) => !r.elimina).slice(0, 12);
      box.innerHTML = (data || []).map((r, i) => `<div data-i="${i}">${esc(r.impresa_nome)} <small>${esc([r.impresa_cf, r.comune].filter(Boolean).join(' · '))}</small></div>`).join('')
        || '<div style="cursor:default;color:#888">Nessuna impresa trovata: lascia il nome come l\'hai scritto.</div>';
      box.style.display = 'block';
      box.querySelectorAll('[data-i]').forEach((el) => el.onclick = () => {
        impresa = data[+el.dataset.i];
        $('din-imp').value = impresa.impresa_nome;
        box.style.display = 'none';
        mostraScelta();
      });
    } catch (e) { console.warn('diniego: ricerca imprese', e); box.style.display = 'none'; }
  }

  async function cercaCantieri() {
    const q = pulito($('din-cant').value);
    const box = $('din-cant-ris');
    if (q.length < 3) { box.style.display = 'none'; return; }
    const req = ++reqCant;
    try {
      let { data, error } = await window.sb.from('cantieri')
        .select('cantiere_id, cantiere_etichetta, cantiere_indirizzo, cantiere_civico, comune_nome, cantiere_cnce, elimina')
        .or(`cantiere_indirizzo.ilike.%${q}%,comune_nome.ilike.%${q}%,cantiere_cnce.ilike.%${q}%,cantiere_etichetta.ilike.%${q}%`)
        .order('data_ult', { ascending: false, nullsFirst: false }).limit(25);
      if (req !== reqCant) return;
      if (error) throw error;
      data = (data || []).filter((r) => !r.elimina).slice(0, 12);
      box.innerHTML = (data || []).map((r, i) => `<div data-i="${i}">${esc(etichettaCantiere(r))}</div>`).join('')
        || '<div style="cursor:default;color:#888">Nessun cantiere trovato: lascia l\'indirizzo come l\'hai scritto.</div>';
      box.style.display = 'block';
      box.querySelectorAll('[data-i]').forEach((el) => el.onclick = () => {
        cantiere = data[+el.dataset.i];
        $('din-cant').value = etichettaCantiere(cantiere);
        box.style.display = 'none';
        mostraScelta();
      });
    } catch (e) { console.warn('diniego: ricerca cantieri', e); box.style.display = 'none'; }
  }

  async function mieSegnalazioni() {
    const box = $('din-mie');
    try {
      const email = String(window.S?.user?.email || '').toLowerCase();
      const { data, error } = await window.sb.from('s_dinieghi_accesso')
        .select('id, created_at, data_diniego, impresa_nome, cantiere_desc, stato, gestione_note')
        .eq('segnalato_da', email).order('created_at', { ascending: false }).limit(5);
      if (error) throw error;
      if (!data?.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<div style="font-size:12px;font-weight:600;color:#565c66;margin-bottom:4px">Le tue ultime segnalazioni</div>'
        + data.map((r) => {
          const [col, lbl] = STATI[r.stato] || ['#888', r.stato];
          return `<div class="din-mia"><span class="din-stato" style="background:${col}">${esc(lbl)}</span>
            <b>${dIt(r.data_diniego)}</b> — ${esc(r.impresa_nome)} · ${esc(r.cantiere_desc)}
            ${r.gestione_note ? `<div style="color:#666;margin-top:2px">Segreteria: ${esc(r.gestione_note)}</div>` : ''}</div>`;
        }).join('');
    } catch (e) { box.innerHTML = ''; /* elenco di cortesia: se non si legge non si allarma nessuno */ }
  }

  function apri() {
    if (!window.sb || !window.S?.user) return avviso('Accedi prima di segnalare.', 'err');
    modale();
    impresa = null; cantiere = null;
    $('din-data').value = oggi();
    $('din-data').max = oggi();
    ['din-imp', 'din-cant', 'din-note'].forEach((id) => { $(id).value = ''; });
    $('din-imp-ris').style.display = 'none';
    $('din-cant-ris').style.display = 'none';
    mostraScelta();
    $('modal-diniego').classList.remove('hidden');
    mieSegnalazioni();
  }

  async function salva(ev) {
    const btn = ev.currentTarget;
    const data = $('din-data').value;
    const impNome = $('din-imp').value.trim();
    const cantDesc = $('din-cant').value.trim();
    const note = $('din-note').value.trim();
    if (!data) return avviso('Indica la data.', 'err');
    if (data > oggi()) return avviso('La data non può essere nel futuro.', 'err');
    if (!impNome) return avviso('Indica l\'impresa.', 'err');
    if (!cantDesc) return avviso('Indica il cantiere.', 'err');
    if (!note) return avviso('Scrivi nelle note che cosa è successo.', 'err');
    btn.disabled = true;
    const testo = btn.textContent;
    btn.textContent = 'Invio…';
    try {
      const { data: r, error } = await window.sb.from('s_dinieghi_accesso').insert({
        data_diniego: data,
        impresa_id: impresa && impresa.impresa_nome === impNome ? impresa.impresa_id : null,
        impresa_nome: impNome,
        cantiere_id: cantiere && etichettaCantiere(cantiere) === cantDesc ? cantiere.cantiere_id : null,
        cantiere_desc: cantDesc,
        note,
      }).select('id').single();
      if (error) throw error;
      avviso(`Segnalazione n° ${r.id} inviata alla segreteria.`, 'ok');
      $('modal-diniego').classList.add('hidden');
    } catch (e) {
      avviso('Segnalazione non inviata: ' + (e.message || e), 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = testo;
    }
  }

  window.apriDiniegoAccesso = apri;
  document.addEventListener('click', (e) => { if (e.target.closest('#btn-diniego-dash')) apri(); });
})();
