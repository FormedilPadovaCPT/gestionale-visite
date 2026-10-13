/* ============================================================
   📚 FORMAZIONE — la pagina del responsabile del progetto formativo e
   dei docenti (13/10/2026, lotto 1 del fascicolo corso digitale)

   Progetto: 2_AREE/Formazione/2026_10_13_REL_Area-Sicurezza_fascicolo-
   corso-digitale_progetto-tecnico.md. Qui crescono, lotto dopo lotto:
     1. ✍️ Le mie firme (oggi): i documenti che aspettano la firma di
        chi è collegato — RPF, tecnico docente, docente esterno — letti
        e firmati con lo stesso riquadro del Presidente (firme.js).
     2. la scheda formativa delle tipologie di corso (lotto 2);
     3. il progetto formativo dell'edizione e il verbale di verifica
        finale (lotto 3);
     5. la pagina del docente per il corso: accettazione dell'incarico,
        conferma delle firme di presenza arrivate dal QR, aggiunta di un
        allievo in aula, firma del registro della giornata (lotto 5).

   Chi la vede: i tecnici (fra cui Balladore, RPF), i docenti esterni col
   ruolo «docente» (che non vedono nient'altro) e la segreteria. Chi è di
   sola lettura (Direzione, Consiglio) no: le sue firme stanno in
   Direzione/Presidenza.

   Script classico come direzione.js: usa window.sb, window.S,
   window.toast e window.firmeApp; espone window.formazione.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const S = () => window.S || {};

  async function ruoli() {
    const sb = window.sb;
    const chiedi = async (f) => { try { const { data, error } = await sb.rpc(f); return !error && data === true; } catch (_e) { return false; } };
    const [rpf, docente, segr] = await Promise.all(['is_rpf', 'is_docente', 'is_segreteria'].map(chiedi));
    return { rpf, docente, segr, tecnico: !!S().tecnico };
  }

  async function carica() {
    const R = await ruoli();
    const intro = $('form-intro');
    if (intro) {
      intro.textContent = R.rpf
        ? 'Sei il responsabile del progetto formativo: qui trovi i documenti dei corsi che aspettano la tua firma. Scheda formativa, progetto formativo e verbale di verifica arriveranno nei prossimi lotti.'
        : R.docente
          ? 'Qui trovi i documenti dei corsi che aspettano la tua firma. La pagina del corso (presenze, allievi, registro) arriverà nei prossimi lotti.'
          : 'I documenti della formazione che aspettano la tua firma (incarichi, registri, verbali). Il resto della pagina arriverà nei prossimi lotti.';
    }
    if (window.firmeApp) {
      await window.firmeApp.box($('form-firme'), {
        mie: true, pulsanti: true, titolo: '✍️ Le mie firme',
        vuoto: 'Nessun documento aspetta la tua firma.',
        dopo: () => badge().catch(() => {}),
      });
    } else {
      const h = $('form-firme');
      if (h) h.innerHTML = '<div class="card" style="border-left:4px solid #c0392b"><p style="font-size:13px;color:#c0392b;margin:0">Il modulo delle firme non si è caricato: ricarica la pagina.</p></div>';
    }
    badge().catch(() => {});
  }

  /* il numero sul pulsante del menu: le firme in attesa di chi è collegato */
  async function badge() {
    const b = $('nav-form-badge'); if (!b) return;
    const n = window.firmeApp ? await window.firmeApp.conta() : 0;
    b.textContent = n; b.style.display = n ? '' : 'none';
  }

  window.formazione = { carica, badge };
})();
