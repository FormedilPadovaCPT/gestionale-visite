/* ============================================================
   LE MIE FIRME — il riquadro «✍️ Da firmare», per chiunque firmi nell'app
   (13/10/2026, lotto 1 del fascicolo corso digitale)

   Nato il 04/10/2026 dentro direzione.js per il solo Presidente (le
   lettere di incarico). Dal 13/10 lo stesso riquadro serve al Direttore,
   al responsabile del progetto formativo e ai docenti dei corsi: la
   tabella `s_firme` (prima `s_firme_presidente`) ha una riga per
   firmatario, e la RLS dà a ciascuno le proprie righe. Qui si legge il
   PDF e si preme «Firmo»: la firma scansionata (se c'è) e il testo
   «Firmato nell'app il … alle … - Nome» si appongono su QUEL PDF, dopo
   che la funzione `firma-documenti` ne ha ricontrollato l'impronta;
   oppure «Rimando» con due righe di motivo, che tornano alla segreteria.
   «Firmo» si accende solo dopo aver aperto il documento. Documenti a più
   firme: la riga dice «2ª firma, dopo …», e il PDF che si legge porta
   già la firma di chi è venuto prima.

   Chi vede i pulsanti: solo il firmatario collegato. La segreteria,
   nell'anteprima «Vedi come… Presidenza», vede l'elenco del Presidente
   senza i pulsanti, che il server le rifiuterebbe.

   Script classico come direzione.js: usa window.sb, window.S e
   window.toast del modulo principale; espone window.firmeApp.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oraIt = (ts) => (ts ? new Date(ts).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const oggi = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const giorni = (d) => (d ? Math.max(0, Math.floor((new Date(oggi()) - new Date(String(d).slice(0, 10))) / 864e5)) : null);
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));
  const BUCKET = 'firme-presidente';   // il nome del bucket resta quello del 04/10
  const RUOLI = { presidente: 'Presidente', direttore: 'Direttore', rpf: 'responsabile del progetto formativo', docente: 'docente', incaricato: 'tecnico incaricato, per accettazione' };
  const TIPI = { incarico_assev: 'lettera di incarico (asseverazione)', incarico_docenza: 'lettera di incarico di docenza', accettazione_incarico: 'accettazione dell\'incarico', scheda_formativa: 'scheda formativa', progetto_formativo: 'progetto formativo', registro_giornata: 'registro della giornata', registro_corso: 'registro del corso', verbale_verifica: 'verbale di verifica finale', documento: 'documento' };

  const _letti = new Set();   // i documenti aperti con «Leggi» in questa sessione: solo dopo si accende «Firmo»

  /* chiama la funzione delle firme e restituisce il messaggio vero in caso di errore */
  async function chiama(corpo) {
    const { data: out, error: e } = await window.sb.functions.invoke('firma-documenti', { body: corpo });
    if (e || out?.error) {
      let msg = out?.error; try { msg = msg || (await e.context.json()).error; } catch (_x) { /* niente */ }
      throw new Error(msg || e?.message || 'richiesta non riuscita');
    }
    return out;
  }

  /* apre un PDF del bucket in una scheda nuova (link a tempo, 10 minuti) */
  async function apri(percorso) {
    /* la scheda si apre subito (sul telefono una finestra aperta dopo un'attesa viene bloccata), poi prende l'indirizzo */
    const w = window.open('', '_blank');
    const { data: u, error: e } = await window.sb.storage.from(BUCKET).createSignedUrl(percorso, 600);
    if (e || !u?.signedUrl) { if (w) w.close(); avviso('Non riesco ad aprire il documento: ' + (e?.message || ''), 'err'); return false; }
    if (w) w.location.href = u.signedUrl; else window.location.href = u.signedUrl;
    return true;
  }

  /* quante firme aspettano chi è collegato (per i numeri sui pulsanti del menu) */
  async function conta() {
    const email = String((window.S && window.S.user && window.S.user.email) || '').toLowerCase();
    if (!email) return 0;
    const { count, error } = await window.sb.from('s_firme').select('id', { count: 'exact', head: true })
      .eq('stato', 'in_attesa').ilike('firmatario_email', email.replace(/[\\%_]/g, (c) => '\\' + c));
    if (error) { console.warn('conta firme:', error.message); return 0; }
    return count || 0;
  }

  /* Il riquadro. opzioni:
       mie: true        → le righe di chi è collegato (la RLS gliele dà)
       ruolo: 'presidente' → nell'anteprima della segreteria: le righe di quel ruolo, senza pulsanti
       pulsanti: bool   → se chi guarda può firmare (è il firmatario)
       titolo           → intestazione del riquadro
       vuoto            → testo quando non c'è niente */
  async function box(host, opzioni) {
    if (!host) return;
    const o = Object.assign({ mie: true, pulsanti: true, titolo: '✍️ Da firmare', vuoto: 'Niente da firmare.' }, opzioni || {});
    const sb = window.sb;
    const email = String((window.S && window.S.user && window.S.user.email) || '').toLowerCase();
    let q = sb.from('s_firme')
      .select('id, tipo, rif, titolo, stato, ordine, firmatario_email, firmatario_ruolo, corso_id, richiesta_il, firmata_il, rimandata_il, rimandata_motivo, file_originale, file_firmato, file_precedente')
      .in('stato', ['in_attesa', 'firmata', 'rimandata']).order('richiesta_il', { ascending: false }).limit(60);
    if (o.ruolo) q = q.eq('firmatario_ruolo', o.ruolo);
    else if (o.mie && email) q = q.ilike('firmatario_email', email.replace(/[\\%_]/g, (c) => '\\' + c));
    const { data, error } = await q;
    if (error) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>${esc(o.titolo)}</h3><p style="font-size:13px;color:#c0392b;margin:0">Non sono riuscito a leggere i documenti da firmare: ${esc(error.message)}</p></div>`;
      return;
    }
    const attesa = (data || []).filter((r) => r.stato === 'in_attesa').reverse();
    const recenti = (data || []).filter((r) => r.stato !== 'in_attesa').slice(0, 5);
    const bottoni = !!o.pulsanti;
    const catena = (r) => (r.firmatario_ruolo === 'incaricato' ? ' · da firmare per accettazione, sotto il tuo nome: il Presidente ha già firmato'
      : r.ordine > 1 ? ` · ${r.ordine}ª firma: il documento porta già ${r.ordine - 1 === 1 ? 'la firma di chi è venuto prima' : 'le firme di chi è venuto prima'}` : '');
    const riga = (r) => {
      const g = giorni(r.richiesta_il);
      const letto = _letti.has(r.id);
      return `<div data-firma="${r.id}" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:9px 0;border-top:1px solid #f0e6dd">
        <span style="font-size:13px;flex:1;min-width:220px"><strong>${esc(r.titolo)}</strong><br><span style="font-size:11.5px;color:#888">${esc(TIPI[r.tipo] || r.tipo)} · chiesta il ${dIt(r.richiesta_il)}${g ? ' · in attesa da ' + g + ' g' : ''}${esc(catena(r))}</span></span>
        <button class="btn-secondary btn-sm" type="button" data-firma-leggi="${r.id}" data-aiuto="Apre il documento da firmare in una scheda nuova. Dopo averlo letto si accende «Firmo».">📄 Leggi</button>
        ${bottoni ? `<button class="btn-primary btn-sm" type="button" data-firma-si="${r.id}" ${letto ? '' : 'disabled title="Prima apri il documento con «Leggi»"'} data-aiuto="Appone la tua firma su questo documento, con data e ora, e lo restituisce firmato alla segreteria. Non si torna indietro.">✍ Firmo</button>
        <button class="btn-secondary btn-sm" type="button" data-firma-no="${r.id}" data-aiuto="Non firmi: scrivi in due righe perché, e il documento torna alla segreteria col tuo motivo.">↩ Rimando</button>` : ''}
      </div>`;
    };
    const rigaFatta = (r) => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid #f4f4f4;font-size:12px;color:#666">
        <span style="flex:1;min-width:220px">${r.stato === 'firmata' ? '✅' : '↩'} ${esc(r.titolo)} — ${r.stato === 'firmata' ? 'firmata il ' + oraIt(r.firmata_il) : 'rimandata il ' + dIt(r.rimandata_il) + ': «' + esc(r.rimandata_motivo || '') + '»'}</span>
        ${r.stato === 'firmata' && r.file_firmato ? `<a href="#" data-firma-apri="${esc(r.file_firmato)}" style="color:var(--orange,#e7500f);font-weight:600">apri firmata</a>` : ''}
      </div>`;
    host.innerHTML = `<div class="card" style="border-left:4px solid ${attesa.length ? 'var(--orange,#e7500f)' : '#95C22F'}">
      <h3>${esc(o.titolo)}${attesa.length ? ` — <span style="color:#b35c00">${attesa.length} ${attesa.length === 1 ? 'documento' : 'documenti'}</span>` : ''}</h3>
      ${attesa.length
        ? `<p style="font-size:12.5px;color:#555;margin:0 0 4px">I documenti a tua firma preparati dalla segreteria. Apri il documento con «Leggi», poi «Firmo»: la firma si appone sul documento che hai letto, con data e ora.${!bottoni ? ' <em>(anteprima: i pulsanti li vede solo chi deve firmare)</em>' : ''}</p>${attesa.map(riga).join('')}`
        : `<p style="font-size:13px;color:#555;margin:0">${esc(o.vuoto)}</p>`}
      ${recenti.length ? `<div style="font-size:11px;color:#999;margin-top:10px">Ultimi firmati o rimandati:</div>${recenti.map(rigaFatta).join('')}` : ''}
    </div>`;
    const di = (id) => (data || []).find((r) => r.id === id);
    host.querySelectorAll('[data-firma-leggi]').forEach((b) => b.addEventListener('click', async () => {
      const r = di(Number(b.dataset.firmaLeggi)); if (!r) return;
      if (await apri(r.file_originale)) {
        _letti.add(r.id);
        const si = host.querySelector(`[data-firma-si="${r.id}"]`);
        if (si) { si.disabled = false; si.removeAttribute('title'); }
      }
    }));
    host.querySelectorAll('[data-firma-apri]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); apri(a.dataset.firmaApri); }));
    host.querySelectorAll('[data-firma-si]').forEach((b) => b.addEventListener('click', async () => {
      const r = di(Number(b.dataset.firmaSi)); if (!r) return;
      if (!confirm(`Firmo «${r.titolo}»?\n\nLa tua firma viene apposta sul documento che hai letto, con la data e l'ora di adesso, e il documento firmato torna alla segreteria.`)) return;
      b.disabled = true; b.textContent = 'Firmo…';
      try {
        const out = await chiama({ azione: 'firma', id: r.id });
        avviso(out?.seguente ? 'Firmato. Il documento passa a chi firma dopo di te.' : 'Firmato. La segreteria trova il documento firmato.', 'ok');
      } catch (e) {
        b.disabled = false; b.textContent = '✍ Firmo';
        avviso('Firma non riuscita: ' + e.message, 'err'); return;
      }
      box(host, o); if (o.dopo) o.dopo();
    }));
    host.querySelectorAll('[data-firma-no]').forEach((b) => b.addEventListener('click', async () => {
      const r = di(Number(b.dataset.firmaNo)); if (!r) return;
      const motivo = prompt(`Non firmi «${r.titolo}».\n\nScrivi in due righe perché: lo legge la segreteria.`);
      if (motivo === null) return;
      if (motivo.trim().length < 3) { avviso('Scrivi il motivo: torna alla segreteria.', 'err'); return; }
      try { await chiama({ azione: 'rimanda', id: r.id, motivo: motivo.trim() }); }
      catch (e) { avviso('Non riuscito: ' + e.message, 'err'); return; }
      avviso('Rimandato alla segreteria col tuo motivo.', 'ok');
      box(host, o); if (o.dopo) o.dopo();
    }));
  }

  window.firmeApp = { box, conta, RUOLI, TIPI };
})();
