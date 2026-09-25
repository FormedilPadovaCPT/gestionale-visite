/* ============================================================
   DIREZIONE E CONSIGLIO — la pagina del Direttore e il registro delle
   questioni in attesa di decisione (25/09/2026, deciso dall'utente)

   Un ingresso solo per il Direttore, nel gestionale (stessa scelta fatta
   per il coordinatore il 17/09: chi non è segreteria lavora da qui).
   La pagina «🏛️ Direzione» ha tre riquadri:
     · le AUTORIZZAZIONI dei servizi CPT in attesa del suo visto (le
       riempie loadAutorizzazioni di index.html; il collegamento apre la
       maschera dell'app Segreteria già collegata, perché le due app
       stanno sulla stessa origine e condividono l'accesso);
     · le CONFERME richieste sui cantieri critici: qui il Direttore legge
       il caso, i verbali e la cronologia, e preme «Confermo» o «Non
       confermo» (funzione s_critico_conferma_direttore, che accetta solo
       lui — la stessa maschera dell'app Segreteria, portata qui);
     · il REGISTRO delle questioni in attesa: le righe automatiche (ciò che
       il database sa già: autorizzazioni e conferme) e quelle scritte a
       mano da coordinatore e segreteria. Una colonna sola per tutte: i
       GIORNI di attesa. Niente giudizio di urgenza, si ordina per anzianità.
       Il Direttore risponde qui (s_decisione_rispondi): decide, oppure
       rinvia a una data, e il promemoria tace fino a quel giorno.
   La Presidenza (presidente e vicepresidente) vede lo stesso registro per
   le sole questioni che spettano a lei. Coordinatore e segreteria hanno
   il registro nella Zona Coordinatore: aprono, ritirano, prendono in
   carico le decisioni.

   Nella Zona Segreteria c'è l'obiettivo di visite dell'esercizio (regola
   CEIV: 100 visite ogni 50.000 euro di contributi), che le Statistiche
   mostrano a tutti, Consiglio compreso.

   Script classico come cantieri-critici-coord.js: usa window.sb, window.S
   e window.toast del modulo principale. Tabelle s_decisioni,
   s_decisioni_eventi, visite_obiettivo_esercizio (SQL in
   segreteria-app/supabase/sql/2026_09_25_direzione_decisioni.sql).
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oraIt = (ts) => (ts ? new Date(ts).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const oggi = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const giorni = (d) => (d ? Math.max(0, Math.floor((new Date(oggi()) - new Date(String(d).slice(0, 10))) / 864e5)) : null);
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));
  const S = () => window.S || {};
  const SEGRETERIA_URL = 'https://formedilpadovacpt.github.io/segreteria/';

  const DECISORI = { direttore: 'Direttore', presidenza: 'Presidenza', commissione: 'Commissione Sicurezza' };
  const EVENTI = { apertura: 'Aperta', modifica: 'Modificata', decisione: 'Decisione', rinvio: 'Rinvio', presa_in_carico: 'Presa in carico', ritiro: 'Ritirata', riapertura: 'Riaperta' };
  const EV_CRIT = { apertura: 'Apertura', nota: 'Nota', lettera_impresa: "Comunicazione all'impresa", sollecito: 'Sollecito', pec_richiesta: 'PEC chiesta all\'Amministrazione',
    contatto_impresa: "L'impresa ha ricontattato", visita_riprogrammata: 'Visita riprogrammata', visita_successiva: 'Verbale successivo', decisione: 'Decisione',
    risposta_tecnico: 'Risposta al tecnico', conferenza_proposta: 'Proposta di conferenza', demandata: 'Demandata', decisione_organo: 'Decisione di Presidenza / Commissione',
    autorizzazione_direttore: 'Conferma del Direttore', segnalazione_organi: 'Segnalazione a SPISAL / ITL', riscontro_organo: "Riscontro dell'organo di vigilanza" };

  /* ── chi sono: lo dice il database, non un elenco di indirizzi ── */
  let _ruoli = null;
  async function ruoli() {
    if (_ruoli) return _ruoli;
    const sb = window.sb;
    const chiedi = async (f) => { try { const { data, error } = await sb.rpc(f); return !error && data === true; } catch (_e) { return false; } };
    const [direttore, presidenza, coord, segr] = await Promise.all(['is_direttore', 'is_presidenza', 'is_coordinatore', 'is_segreteria'].map(chiedi));
    _ruoli = { direttore, presidenza, coord, segr };
    return _ruoli;
  }
  window.addEventListener('gestionale-logout', () => { _ruoli = null; });

  /* ── piccola finestra sovrapposta (per il caso critico e la cronologia) ── */
  function finestra(titolo, html) {
    chiudi();
    const f = document.createElement('div');
    f.id = 'dir-finestra';
    f.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9500;display:flex;align-items:center;justify-content:center;padding:16px';
    f.innerHTML = `<div style="background:#fff;border-radius:10px;max-width:760px;width:100%;max-height:92vh;overflow:auto;border-top:5px solid #e7500f;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;color:#222">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 6px;gap:10px">
        <strong style="font-size:16px;color:#565c66">${titolo}</strong>
        <button type="button" data-chiudi style="background:none;border:0;font-size:20px;cursor:pointer;color:#888">✕</button></div>
      <div style="padding:6px 18px 16px">${html}</div></div>`;
    f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('[data-chiudi]')) chiudi(); });
    document.body.appendChild(f);
    return f;
  }
  function chiudi() { const f = $('dir-finestra'); if (f) f.remove(); }

  function con(btn, fn) {
    return (async () => {
      const t = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Un attimo…'; }
      try { await fn(); } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = t; } }
    })();
  }

  /* ════════════════════════════════════════════════════════════
     1. CANTIERI CRITICI — le conferme che aspettano il Direttore
     ════════════════════════════════════════════════════════════ */
  async function inAttesa() {
    const { data, error } = await window.sb.rpc('s_direzione_in_attesa');
    if (error) throw new Error(error.message);
    return data || { autorizzazioni: [], critici: [] };
  }

  function boxCritici(host, critici, errore) {
    if (!host) return;
    if (errore) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>⚠️ Cantieri critici — conferme richieste</h3><p style="font-size:13px;color:#c0392b;margin:0">Non sono riuscito a leggere le conferme richieste: ${esc(errore)}</p></div>`;
      return;
    }
    if (!critici.length) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #95C22F"><h3>⚠️ Cantieri critici — conferme richieste</h3><p style="font-size:13px;color:#555;margin:0">Nessuna conferma in attesa.</p></div>`;
      return;
    }
    host.innerHTML = `<div class="card" style="border-left:4px solid #8e44ad"><h3>⚠️ Cantieri critici — <span style="color:#8e44ad">${critici.length} ${critici.length === 1 ? 'conferma richiesta' : 'conferme richieste'}</span></h3>
      <p style="font-size:12.5px;color:#555;margin:0 0 6px">Segnalazioni agli organi di vigilanza su cui la segreteria ha chiesto la tua conferma. Tocca la riga: vedi caso, verbali e cronologia, e rispondi.</p>
      ${critici.map((c) => { const g = giorni(c.dal); return `<div data-crit="${c.id}" data-aiuto="Apre il caso con i verbali del cantiere e la cronologia: da lì premi «Confermo» o «Non confermo». La risposta resta in cronologia col tuo nome, data e ora." style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0e6dd;cursor:pointer">
        <strong style="font-size:12px">n° ${c.id}</strong>
        <span style="font-size:13px;flex:1;min-width:220px"><strong>${esc(c.impresa || '—')}</strong> — ${esc(c.cantiere || '')}</span>
        <span style="font-size:11.5px;color:#888">evento del ${dIt(c.data_evento)}</span>
        <span style="background:#f3e8f8;color:#8e44ad;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">${g == null ? 'in attesa' : 'in attesa da ' + g + ' g'}</span>
        <button class="btn-primary btn-sm" type="button">Apri</button></div>`; }).join('')}</div>`;
    host.querySelectorAll('[data-crit]').forEach((r) => r.addEventListener('click', () => apriCritico(Number(r.dataset.crit))));
  }

  async function apriCritico(id) {
    const sb = window.sb;
    const [{ data: d, error }, { data: eventi }] = await Promise.all([
      sb.from('s_cantieri_critici').select('*').eq('id', id).maybeSingle(),
      sb.from('s_cantieri_critici_eventi').select('*').eq('critico_id', id).order('created_at'),
    ]);
    if (error || !d) { avviso('Caso non trovato' + (error ? ': ' + error.message : '.'), 'err'); return; }
    let verbali = [];
    if (d.cantiere_id) {
      const r = await sb.from('visite').select('nr_verbale,data_visita,ipc,segnalazione,elimina').eq('cantiere_id', d.cantiere_id).order('data_visita');
      verbali = (r.data || []).filter((v) => !v.elimina);
    }
    const fermo = ['chiuso', 'annullato'].includes(d.stato);
    const gia = [...(eventi || [])].reverse().find((e) => e.tipo === 'autorizzazione_direttore');
    const riga = (k, v) => `<div style="padding:4px 0;border-bottom:1px solid #f2f2f2;font-size:13px"><strong>${k}:</strong> ${v}</div>`;
    finestra(`⚠️ Cantiere critico n° ${d.id} — conferma della segnalazione`, `
      ${riga('Cantiere', esc(d.cantiere_desc))}
      ${riga('Impresa', esc(d.impresa_nome))}
      ${riga('Evento', dIt(d.data_evento) + ' · tecnico: ' + esc(d.tecnico_nome || '—'))}
      <div style="padding:4px 0;border-bottom:1px solid #f2f2f2;font-size:13px;white-space:pre-wrap"><strong>Note del tecnico:</strong>\n${esc(d.note)}</div>
      ${verbali.length ? riga('Verbali sul cantiere', '<br>' + verbali.map((v) => `${esc(v.nr_verbale)} del ${dIt(v.data_visita)}${v.ipc ? ` — IPC ${esc(v.ipc)}` : ''}${v.segnalazione ? ' — <strong>il tecnico propone la segnalazione</strong>' : ''}`).join('<br>')) : ''}
      <div style="font-weight:600;margin:10px 0 4px">Cronologia</div>
      ${(eventi || []).filter((e) => e.tipo !== 'stato').map((e) => `<div style="font-size:12.5px;padding:3px 0;white-space:pre-wrap"><span style="color:#888">${oraIt(e.created_at)}</span> <strong>${esc(EV_CRIT[e.tipo] || e.tipo)}</strong>${e.testo ? ' — ' + esc(e.testo) : ''}</div>`).join('') || '<p style="color:#888;font-size:12.5px">Ancora niente.</p>'}
      <hr style="margin:10px 0;border:0;border-top:1px solid #eee">
      ${fermo ? `<p style="font-size:13px;color:#555">Il caso è ${esc(d.stato)}: non c'è niente da confermare.</p>` : `
        ${gia ? `<p style="font-size:12.5px;color:#555">Hai già risposto: ${esc(gia.testo || '')} Puoi rispondere di nuovo: vale l'ultima.</p>` : ''}
        <p style="font-size:12.5px;color:#555">Se segnalare lo decidono la Presidenza e la Commissione Sicurezza; qui dai la tua conferma. Resta in cronologia col tuo nome, data e ora. La segnalazione la prepara poi la segreteria.</p>
        <label style="font-size:12px">Una nota (facoltativa)</label><textarea id="dir-cd-nota" rows="3" style="width:100%;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">
          <button type="button" class="btn-outline btn-sm" id="dir-cd-no" data-aiuto="Registra in cronologia che NON confermi la segnalazione agli organi di vigilanza. La segreteria lo vede nel caso.">⛔ Non confermo</button>
          <button type="button" class="btn-primary btn-sm" id="dir-cd-si" data-aiuto="Registra in cronologia che CONFERMI la segnalazione a SPISAL / ITL. Da qui la segreteria prepara e protocolla la lettera.">✅ Confermo la segnalazione</button></div>`}`);
    const rispondi = (btn, cosa) => con(btn, async () => {
      if (!confirm(cosa === 'segnalare' ? 'CONFERMI la segnalazione agli organi di vigilanza per questo cantiere?' : 'NON confermi la segnalazione?')) return;
      const { error: e } = await sb.rpc('s_critico_conferma_direttore', { p_id: d.id, p_cosa: cosa, p_nota: ($('dir-cd-nota').value || '').trim() || null });
      if (e) throw new Error(e.message);
      avviso('Registrato in cronologia. La segreteria lo vede nel caso.', 'ok');
      chiudi();
      carica();
    });
    const si = $('dir-cd-si'), no = $('dir-cd-no');
    if (si) si.addEventListener('click', (ev) => rispondi(ev.currentTarget, 'segnalare'));
    if (no) no.addEventListener('click', (ev) => rispondi(ev.currentTarget, 'non_segnalare'));
  }

  /* ════════════════════════════════════════════════════════════
     2. IL REGISTRO DELLE QUESTIONI IN ATTESA DI DECISIONE
     modo: 'direzione' (chi decide risponde) | 'coord' (chi apre gestisce)
     ════════════════════════════════════════════════════════════ */
  async function decisioniBox(host, modo) {
    if (!host) return { attesa: 0, daPrendere: 0 };
    const sb = window.sb;
    const R = await ruoli();
    let righe = [], auto = { autorizzazioni: [], critici: [] }, errore = null;
    try {
      const { data, error } = await sb.from('s_decisioni').select('*').in('stato', ['aperta', 'rinviata', 'decisa']).order('aperta_il');
      if (error) throw new Error(error.message);
      righe = data || [];
      if (R.direttore || R.coord || R.segr) { try { auto = await inAttesa(); } catch (e) { console.warn('in attesa:', e); } }
    } catch (e) { errore = e.message || String(e); }
    if (errore) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>📋 Questioni in attesa di decisione</h3><p style="font-size:13px;color:#c0392b;margin:0">Non sono riuscito a leggere il registro: ${esc(errore)}</p></div>`;
      return { attesa: 0, daPrendere: 0 };
    }
    const T = oggi();
    // una lista sola: automatiche + manuali, ordinate per giorni di attesa
    const lista = [];
    (auto.autorizzazioni || []).forEach((a) => lista.push({ k: 'auto', gg: giorni(a.dal), testo: `Autorizzazione: ${a.tipo} n° ${a.progressivo != null ? a.progressivo : 'm' + a.id} · ${a.chi}`, chi: 'segreteria', decisore: 'direttore', link: a.link, dal: a.dal }));
    (auto.critici || []).forEach((c) => lista.push({ k: 'auto', gg: giorni(c.dal), testo: `Conferma della segnalazione agli organi di vigilanza: ${c.impresa || '—'} — ${c.cantiere || ''}`, chi: 'segreteria', decisore: 'direttore', critico: c.id, dal: c.dal }));
    const aperte = righe.filter((r) => r.stato === 'aperta' || (r.stato === 'rinviata' && r.rinviata_al && r.rinviata_al <= T));
    const rinviate = righe.filter((r) => r.stato === 'rinviata' && r.rinviata_al && r.rinviata_al > T);
    const decise = righe.filter((r) => r.stato === 'decisa');
    aperte.forEach((r) => lista.push({ k: 'man', gg: giorni(r.aperta_il), r, testo: r.questione, chi: r.aperta_da_nome || r.aperta_da, decisore: r.decisore, link: r.link, dal: r.aperta_il }));
    lista.sort((a, b) => (b.gg || 0) - (a.gg || 0));

    const puoRispondere = (dec) => (dec === 'direttore' && R.direttore) || (dec === 'presidenza' && R.presidenza) || (dec === 'commissione' && (R.coord || R.segr));
    const gestisce = R.coord || R.segr;
    const eta = (gg) => `<span style="display:inline-block;min-width:74px;text-align:center;border-radius:6px;padding:2px 8px;font-size:11.5px;font-weight:700;background:${gg == null ? '#f0f0f3' : gg >= 30 ? '#fdeaea' : gg >= 10 ? '#fff3e0' : '#eef7e6'};color:${gg == null ? '#666' : gg >= 30 ? '#c0392b' : gg >= 10 ? '#b35c00' : '#2d7a06'}" title="giorni di attesa">${gg == null ? '—' : gg + ' g'}</span>`;
    const decBadge = (d) => `<span style="font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;color:#888">${esc(DECISORI[d] || d)}</span>`;

    const rigaHtml = (x, i) => {
      const r = x.r;
      const apri = x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;color:#e7500f;text-decoration:none" data-aiuto="Apre la pratica nell'app che la gestisce, con lo stesso accesso.">apri ↗</a>` : '';
      const critico = x.critico ? `<button type="button" class="btn-primary btn-sm" data-crit-apri="${x.critico}" data-aiuto="Apre il caso critico: verbali, cronologia e i pulsanti «Confermo» / «Non confermo».">Apri il caso</button>` : '';
      const azioni = [];
      if (r && puoRispondere(r.decisore)) azioni.push(`<button type="button" class="btn-primary btn-sm" data-rispondi="${r.id}" data-aiuto="Apre due righe per scrivere la decisione, oppure per rinviare a una data: fino a quel giorno la questione non compare fra quelle in attesa. Chi l'ha aperta riceve un avviso.">✍️ Rispondi</button>`);
      if (r && gestisce) azioni.push(`<button type="button" class="btn-outline btn-sm" data-ritira="${r.id}" data-aiuto="Toglie la questione dal registro scrivendo perché (superata, risolta altrove). Non si cancella: resta in cronologia come ritirata.">Ritira</button>`);
      const entro = r && r.entro_il ? ` <span style="font-size:11.5px;color:${r.entro_il < T ? '#c0392b' : '#888'}">entro il ${dIt(r.entro_il)}</span>` : '';
      const riservata = r && r.riservata ? ' <span title="riservata: la vedono Direttore e coordinatore" style="font-size:11px">🔒</span>' : '';
      const rinv = r && r.stato === 'rinviata' ? ` <span style="font-size:11.5px;color:#8e44ad">rinviata al ${dIt(r.rinviata_al)}${r.decisione ? ': ' + esc(r.decisione) : ''}</span>` : '';
      return `<div data-dec-attesa="1" style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0e6dd">
        ${eta(x.gg)}
        <div style="flex:1;min-width:240px;font-size:13px;line-height:1.4">
          <div>${x.k === 'auto' ? '<span style="font-size:10.5px;background:#eef2f7;color:#456;border-radius:4px;padding:1px 5px;margin-right:4px" title="riga che il database ricava da sola dalle pratiche">automatica</span>' : ''}${esc(x.testo)}${riservata}${entro}${rinv}</div>
          <div style="font-size:11.5px;color:#888">${decBadge(x.decisore)} · aperta ${x.dal ? 'il ' + dIt(x.dal) : ''} da ${esc(x.chi || '—')}${r && r.riguarda ? ' · riguarda: ' + esc(r.riguarda) : ''}${r && r.dettaglio ? `<div style="white-space:pre-wrap;color:#666;margin-top:2px">${esc(r.dettaglio)}</div>` : ''}${r ? ` · <a href="#" data-cron="${r.id}" style="color:#888">cronologia</a>` : ''}</div>
          <div id="dir-risp-${r ? r.id : 'a' + i}"></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${apri}${critico}${azioni.join('')}</div></div>`;
    };
    const rigaDecisa = (r) => `<div data-dec-decisa="1" style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0e6dd">
        <span style="background:#e8f5e0;color:#2d7a06;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">DECISA</span>
        <div style="flex:1;min-width:240px;font-size:13px;line-height:1.4"><div>${esc(r.questione)}${r.riservata ? ' 🔒' : ''}</div>
          <div style="white-space:pre-wrap;color:#333;margin-top:2px"><strong>${esc(r.decisa_da || '')}</strong> il ${oraIt(r.decisa_il)}: ${esc(r.decisione || '')}</div>
          <div style="font-size:11.5px;color:#888">${decBadge(r.decisore)} · aperta il ${dIt(r.aperta_il)} da ${esc(r.aperta_da_nome || r.aperta_da)} · <a href="#" data-cron="${r.id}" style="color:#888">cronologia</a></div></div>
        ${gestisce ? `<button type="button" class="btn-primary btn-sm" data-presa="${r.id}" data-aiuto="Dichiara che la decisione è stata letta e messa in pratica: la riga esce dal registro e resta in cronologia con chi l'ha presa in carico e quando.">✓ Presa in carico</button>` : ''}</div>`;

    const nuova = gestisce && modo === 'coord' ? `<div style="margin:6px 0 10px"><button type="button" class="btn-primary btn-sm" id="dir-nuova" data-aiuto="Apre il modulo per scrivere una questione che aspetta una decisione del Direttore, della Presidenza o della Commissione. Da quel momento conta i giorni di attesa.">➕ Nuova questione</button><div id="dir-nuova-form"></div></div>` : '';
    const intro = modo === 'coord'
      ? 'Quello che aspetta una decisione di Direttore, Presidenza o Commissione Sicurezza. Le righe <em>automatiche</em> vengono dalle pratiche (autorizzazioni, conferme sui cantieri critici); le altre le scrivete voi. Si ordina per giorni di attesa.'
      : 'Quello che aspetta una tua decisione, ordinato per giorni di attesa. Le righe <em>automatiche</em> vengono dalle pratiche; le altre le hanno scritte coordinatore e segreteria. Rispondi qui: decidi, oppure rinvia a una data.';
    host.innerHTML = `<div class="card" style="border-left:4px solid #e7500f">
      <h3>📋 Questioni in attesa di decisione ${lista.length ? `<span style="color:#b35c00">— ${lista.length} in attesa</span>` : '<span style="color:#2d7a06">— niente in attesa</span>'}</h3>
      <p style="font-size:12.5px;color:#555;margin:0 0 6px">${intro}</p>
      ${nuova}
      ${lista.map(rigaHtml).join('') || '<p style="font-size:13px;color:#555;margin:6px 0 0">Nessuna questione aperta.</p>'}
      ${decise.length ? `<div style="font-size:12px;font-weight:600;color:#565c66;margin-top:12px">Decise, ${gestisce ? 'da prendere in carico' : 'in attesa che l\'ufficio le prenda in carico'} (${decise.length})</div>${decise.map(rigaDecisa).join('')}` : ''}
      ${rinviate.length ? `<div style="font-size:12px;font-weight:600;color:#565c66;margin-top:12px">Rinviate (${rinviate.length})</div>${rinviate.map((r) => `<div style="font-size:12.5px;color:#666;padding:5px 0;border-top:1px solid #f0e6dd">⏳ <strong>al ${dIt(r.rinviata_al)}</strong> — ${esc(r.questione)}${r.decisione ? ` <span style="color:#888">(${esc(r.decisione)})</span>` : ''} · ${decBadge(r.decisore)}</div>`).join('')}` : ''}
    </div>`;

    host.querySelectorAll('[data-crit-apri]').forEach((b) => b.addEventListener('click', () => apriCritico(Number(b.dataset.critApri))));
    host.querySelectorAll('[data-cron]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); cronologia(Number(a.dataset.cron)); }));
    host.querySelectorAll('[data-rispondi]').forEach((b) => b.addEventListener('click', () => formRisposta(Number(b.dataset.rispondi), host, modo)));
    host.querySelectorAll('[data-ritira]').forEach((b) => b.addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const motivo = prompt('Perché la ritiri? (resta in cronologia)');
      if (motivo == null) return;
      const { error } = await sb.from('s_decisioni').update({ stato: 'ritirata', ritirata_motivo: motivo.trim() || null }).eq('id', Number(b.dataset.ritira));
      if (error) throw new Error(error.message);
      avviso('Questione ritirata.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    })));
    host.querySelectorAll('[data-presa]').forEach((b) => b.addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const { error } = await sb.from('s_decisioni').update({ stato: 'chiusa' }).eq('id', Number(b.dataset.presa));
      if (error) throw new Error(error.message);
      avviso('Presa in carico: la decisione resta in cronologia.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    })));
    const bn = $('dir-nuova'); if (bn) bn.addEventListener('click', () => formNuova(host, modo, R));
    return { attesa: lista.length, daPrendere: decise.length };
  }

  function formRisposta(id, host, modo) {
    const slot = $('dir-risp-' + id); if (!slot) return;
    if (slot.innerHTML) { slot.innerHTML = ''; return; }
    const min = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    slot.innerHTML = `<div style="margin-top:6px;padding:8px;border:1px solid #f0e6dd;border-radius:8px;background:#fffaf6">
      <label style="font-size:12px">La decisione (o due righe sul rinvio)</label><textarea id="dir-rt-${id}" rows="3" style="width:100%;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
        <button type="button" class="btn-primary btn-sm" data-decido="${id}" data-aiuto="Registra la decisione col tuo nome, data e ora. Chi ha aperto la questione riceve un avviso e la prende in carico.">✅ Decido</button>
        <span style="font-size:12px;color:#666">oppure</span>
        <input type="date" id="dir-rd-${id}" min="${min}" style="width:auto;font-size:12px">
        <button type="button" class="btn-outline btn-sm" data-rinvio="${id}" data-aiuto="Rinvia la questione alla data scelta: fino a quel giorno non compare fra quelle in attesa, poi torna con i giorni contati da quando è stata aperta.">⏳ Rinvio a questa data</button>
        <button type="button" class="btn-outline btn-sm" data-annulla="${id}">Annulla</button></div></div>`;
    slot.querySelector('[data-annulla]').addEventListener('click', () => { slot.innerHTML = ''; });
    slot.querySelector('[data-decido]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const testo = ($('dir-rt-' + id).value || '').trim();
      if (!testo) { avviso('Scrivi la decisione.', 'warn'); return; }
      if (!confirm('Registro la decisione col tuo nome, data e ora?')) return;
      const { error } = await window.sb.rpc('s_decisione_rispondi', { p_id: id, p_esito: 'decisa', p_testo: testo });
      if (error) throw new Error(error.message);
      avviso('Decisione registrata.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    }));
    slot.querySelector('[data-rinvio]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const al = $('dir-rd-' + id).value;
      if (!al) { avviso('Scegli la data a cui rinviare.', 'warn'); return; }
      const { error } = await window.sb.rpc('s_decisione_rispondi', { p_id: id, p_esito: 'rinviata', p_testo: ($('dir-rt-' + id).value || '').trim() || null, p_rinvio_al: al });
      if (error) throw new Error(error.message);
      avviso('Rinviata al ' + dIt(al) + '.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    }));
  }

  function formNuova(host, modo, R) {
    const slot = $('dir-nuova-form'); if (!slot) return;
    if (slot.innerHTML) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<div style="margin-top:8px;padding:10px;border:1px solid #f0e6dd;border-radius:8px;background:#fffaf6;color:#222">
      <label style="font-size:12px">La questione, in una riga *</label><input id="dn-q" maxlength="240" style="width:100%;box-sizing:border-box" placeholder="Es. Si rinnova il contratto del tecnico X per il 2027?">
      <label style="font-size:12px;margin-top:6px">Contesto (facoltativo)</label><textarea id="dn-d" rows="3" style="width:100%;box-sizing:border-box" placeholder="Quello che serve sapere per decidere: fatti, numeri, alternative."></textarea>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:6px">
        <div><label style="font-size:12px">Riguarda</label><input id="dn-r" maxlength="120" style="width:100%;box-sizing:border-box" placeholder="impresa, tecnico, pratica…"></div>
        <div><label style="font-size:12px">Decide</label><select id="dn-dec" style="width:100%"><option value="direttore">Direttore</option><option value="presidenza">Presidenza</option><option value="commissione">Commissione Sicurezza</option></select></div>
        <div><label style="font-size:12px">Entro il (solo se c'è un termine vero)</label><input type="date" id="dn-e" style="width:100%;box-sizing:border-box"></div>
        <div><label style="font-size:12px">Collegamento (facoltativo)</label><input id="dn-l" style="width:100%;box-sizing:border-box" placeholder="link alla pratica"></div>
      </div>
      ${R.coord ? '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;margin-top:8px;text-transform:none"><input type="checkbox" id="dn-ris" style="width:auto"> 🔒 Riservata (questione sul personale: la vedono solo Direttore e coordinatore)</label>' : ''}
      <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn-primary btn-sm" id="dn-salva" data-aiuto="Mette la questione nel registro: da oggi conta i giorni di attesa e chi decide la vede nella sua pagina.">Apri la questione</button><button type="button" class="btn-outline btn-sm" id="dn-annulla">Annulla</button></div></div>`;
    $('dn-annulla').addEventListener('click', () => { slot.innerHTML = ''; });
    $('dn-salva').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const q = ($('dn-q').value || '').trim();
      if (!q) { avviso('Scrivi la questione.', 'warn'); return; }
      const riga = { questione: q, dettaglio: ($('dn-d').value || '').trim() || null, riguarda: ($('dn-r').value || '').trim() || null,
        decisore: $('dn-dec').value, entro_il: $('dn-e').value || null, link: ($('dn-l').value || '').trim() || null,
        riservata: !!($('dn-ris') && $('dn-ris').checked) };
      const { error } = await window.sb.from('s_decisioni').insert(riga);
      if (error) throw new Error(error.message);
      avviso('Questione aperta: da oggi conta i giorni.', 'ok');
      await decisioniBox(host, modo); dopoCambio();
    }));
  }

  async function cronologia(id) {
    const { data, error } = await window.sb.from('s_decisioni_eventi').select('*').eq('decisione_id', id).order('created_at');
    if (error) { avviso('Non sono riuscito a leggere la cronologia: ' + error.message, 'err'); return; }
    finestra('Cronologia della questione n° ' + id, (data || []).map((e) => `<div style="font-size:13px;padding:5px 0;border-bottom:1px solid #f2f2f2;white-space:pre-wrap"><span style="color:#888">${oraIt(e.created_at)}</span> <strong>${esc(EVENTI[e.tipo] || e.tipo)}</strong>${e.autore ? ` <span style="color:#888">(${esc(e.autore)})</span>` : ''}${e.testo ? ' — ' + esc(e.testo) : ''}</div>`).join('') || '<p style="color:#888">Ancora niente.</p>');
  }

  /* dopo una modifica al registro: numeri nel menu e nella Zona Coordinatore */
  function dopoCambio() {
    badge().catch(() => {});
    if (typeof window.aggiornaZonaCoord === 'function' && !S().viewer) window.aggiornaZonaCoord().catch(() => {});
  }

  /* ════════════════════════════════════════════════════════════
     3. LA PAGINA «DIREZIONE» (Direttore) / «PRESIDENZA»
     ════════════════════════════════════════════════════════════ */
  async function carica() {
    const R = await ruoli();
    const nome = $('dir-nome'); if (nome) nome.textContent = S().viewerNome || '';
    const intro = $('dir-intro');
    if (intro) intro.textContent = R.direttore
      ? 'Quello che aspetta te: autorizzazioni dei servizi CPT, conferme sui cantieri critici e le questioni aperte da coordinatore e segreteria. La mappa e le statistiche sono nelle altre due schede.'
      : 'Le questioni che coordinatore e segreteria hanno aperto per la Presidenza. La mappa e le statistiche sono nelle altre due schede.';
    const aut = $('dir-autorizzazioni'), cri = $('dir-critici');
    if (R.direttore) {
      if (typeof window.loadAutorizzazioni === 'function') window.loadAutorizzazioni().catch((e) => console.warn('autorizzazioni:', e));
      try { const a = await inAttesa(); boxCritici(cri, a.critici || []); } catch (e) { boxCritici(cri, [], e.message || String(e)); }
    } else { if (aut) aut.innerHTML = ''; if (cri) cri.innerHTML = ''; }
    await decisioniBox($('dir-decisioni'), 'direzione');
    badge().catch(() => {});
  }

  /* il numero sul pulsante «Direzione»: tutto ciò che aspetta chi è collegato */
  async function badge() {
    const b = $('nav-dir-badge'); if (!b) return;
    const R = await ruoli();
    if (!(R.direttore || R.presidenza)) { b.style.display = 'none'; return; }
    let n = 0;
    try {
      const T = oggi();
      const { data } = await window.sb.from('s_decisioni').select('id,stato,rinviata_al,decisore').in('stato', ['aperta', 'rinviata']);
      n += (data || []).filter((r) => (r.stato === 'aperta' || (r.rinviata_al && r.rinviata_al <= T)) && ((r.decisore === 'direttore' && R.direttore) || (r.decisore === 'presidenza' && R.presidenza))).length;
      if (R.direttore) { const a = await inAttesa(); n += (a.autorizzazioni || []).length + (a.critici || []).length; }
    } catch (e) { console.warn('badge direzione:', e); }
    b.textContent = n; b.style.display = n ? '' : 'none';
  }

  /* il registro nella Zona Coordinatore (coordinatore e segreteria) */
  async function zonaCoord() {
    const host = $('adm-decisioni'); if (!host) return { attesa: 0, daPrendere: 0 };
    const R = await ruoli();
    if (!(R.coord || R.segr)) { host.innerHTML = ''; return { attesa: 0, daPrendere: 0 }; }
    return decisioniBox(host, 'coord');
  }

  /* ════════════════════════════════════════════════════════════
     4. L'OBIETTIVO DI VISITE DELL'ESERCIZIO (regola CEIV)
     ════════════════════════════════════════════════════════════ */
  let _voe = null;
  async function obiettiviLeggi() {
    const { data, error } = await window.sb.from('visite_obiettivo_esercizio').select('*').order('esercizio');
    if (error) throw new Error(error.message);
    _voe = {}; (data || []).forEach((r) => { _voe[r.esercizio] = r; });
    return _voe;
  }

  /* nella scheda Statistiche: fatte / minimo dell'esercizio scelto */
  async function kpiCeiv(esercizio, fatte) {
    const num = $('k-ceivmin'), pct = $('k-ceivmin-pct'); if (!num) return;
    if (!esercizio) { num.textContent = '–'; pct.textContent = 'scegli un esercizio'; return; }
    try {
      if (!_voe) await obiettiviLeggi();
      const r = _voe[esercizio];
      const min = r ? (r.visite_minime_manuali != null ? r.visite_minime_manuali : r.visite_minime) : null;
      if (min == null) { num.textContent = fatte != null ? String(fatte) : '–'; pct.textContent = 'minimo da impostare (segreteria)'; num.style.color = '#888'; return; }
      const p = fatte != null ? Math.round(fatte / min * 100) : null;
      num.textContent = (fatte != null ? fatte : '–') + ' / ' + min;
      num.style.color = p == null ? '#888' : p >= 100 ? '#2d7a06' : p >= 75 ? '#95C22F' : '#b35c00';
      pct.textContent = (p != null ? p + '% del minimo' : '') + (r.contributi_ceiv != null ? ' · ' + Number(r.contributi_ceiv).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) + ' di contributi' : '');
    } catch (e) { num.textContent = '–'; pct.textContent = 'non sono riuscito a leggere il minimo'; console.warn('kpi ceiv:', e); }
  }

  /* nella Zona Segreteria: i contributi per esercizio */
  async function obiettivi() {
    const host = $('sgr-obiettivi'); if (!host) return;
    const ae = typeof window.annoEdile === 'function' ? window.annoEdile().label : null;
    const [a1, a2] = ae ? ae.split('-').map(Number) : [null, null];
    const eserc = ae ? [`${a1 - 1}-${a2 - 1}`, ae, `${a1 + 1}-${a2 + 1}`] : [];
    let dati = {};
    try { dati = await obiettiviLeggi(); } catch (e) {
      host.innerHTML = `<div class="adm-section"><div class="adm-section-title">🎯 Obiettivo visite dell'esercizio (regola CEIV)</div><p style="font-size:12px;color:#f88">Non sono riuscito a leggere gli obiettivi: ${esc(e.message)}</p></div>`;
      return;
    }
    Object.keys(dati).forEach((k) => { if (!eserc.includes(k)) eserc.push(k); });
    eserc.sort();
    host.innerHTML = `<div class="adm-section">
      <div class="adm-section-title">🎯 Obiettivo visite dell'esercizio (regola CEIV)</div>
      <p style="font-size:12px;color:rgba(255,255,255,.6);margin-bottom:10px">Il numero minimo di visite dell'esercizio (1/10 – 30/9) si calcola sui contributi Cassa Edile: <b>100 visite ogni 50.000 €</b> (quota CPT). Scrivi i contributi e il minimo si calcola da solo; se il CdA fissa un numero diverso, mettilo nella colonna «minimo deciso». Il dato compare nelle Statistiche, anche a Direzione e Consiglio.</p>
      <div style="overflow-x:auto"><table style="font-size:12.5px;border-collapse:collapse;min-width:520px;color:#fff">
        <tr style="text-align:left;color:rgba(255,255,255,.6)"><th style="padding:4px 8px">Esercizio</th><th style="padding:4px 8px">Contributi CEIV (€)</th><th style="padding:4px 8px">Minimo calcolato</th><th style="padding:4px 8px">Minimo deciso dal CdA</th><th style="padding:4px 8px">Note</th><th></th></tr>
        ${eserc.map((e) => { const r = dati[e] || {}; return `<tr data-voe="${esc(e)}">
          <td style="padding:4px 8px;font-weight:600">${esc(e)}${e === ae ? ' <span style="font-size:10px;color:#95C22F">in corso</span>' : ''}</td>
          <td style="padding:4px 8px"><input type="number" step="0.01" min="0" data-c value="${r.contributi_ceiv != null ? r.contributi_ceiv : ''}" style="width:130px;color:#222"></td>
          <td style="padding:4px 8px" data-min>${r.visite_minime != null ? r.visite_minime : '—'}</td>
          <td style="padding:4px 8px"><input type="number" step="1" min="0" data-m value="${r.visite_minime_manuali != null ? r.visite_minime_manuali : ''}" style="width:90px;color:#222"></td>
          <td style="padding:4px 8px"><input data-n value="${esc(r.note || '')}" style="width:180px;color:#222"></td>
          <td style="padding:4px 8px"><button type="button" class="btn-primary btn-sm" data-salva data-aiuto="Salva i contributi dell'esercizio: il minimo di visite si ricalcola da solo e compare nelle Statistiche di tutti.">Salva</button></td></tr>`; }).join('')}
      </table></div></div>`;
    host.querySelectorAll('tr[data-voe]').forEach((tr) => {
      const c = tr.querySelector('[data-c]');
      c.addEventListener('input', () => { const v = parseFloat(c.value); tr.querySelector('[data-min]').textContent = isFinite(v) ? Math.floor(v / 50000 * 100) : '—'; });
      tr.querySelector('[data-salva]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
        const v = c.value === '' ? null : parseFloat(c.value);
        const m = tr.querySelector('[data-m]').value; const n = tr.querySelector('[data-n]').value.trim();
        const { error } = await window.sb.from('visite_obiettivo_esercizio').upsert({ esercizio: tr.dataset.voe, contributi_ceiv: v, visite_minime_manuali: m === '' ? null : parseInt(m, 10), note: n || null }, { onConflict: 'esercizio' });
        if (error) throw new Error(error.message);
        _voe = null; avviso('Obiettivo salvato per ' + tr.dataset.voe + '.', 'ok'); obiettivi();
      }));
    });
  }

  window.direzione = { carica, badge, zonaCoord, decisioniBox, obiettivi, kpiCeiv, apriCritico };
})();
