/* persone-omonimi.js — omonimi in anagrafica e codice fiscale scritto dal tecnico
   (11/11/2026, chiesto dall'utente dal verbale CPT/26_27/0093 di Caon: «Geom. Marco Carraro» e
   «Ing. Marco Carraro» sono due persone diverse, e il gestionale non permetteva di avere la seconda).

   Prima la persona si riconosceva dal solo nome e cognome: «Nuova persona» rimandava sempre alla scheda
   già esistente, e al salvataggio del verbale i recapiti scritti nel riquadro finivano sulla PRIMA scheda
   con quel nome — con due omonimi, quelli dell'uno sulla scheda dell'altro.
   Ora:
   - la scheda scelta dall'elenco (o creata, o aperta col doppio clic) resta legata al riquadro;
   - senza scelta, fra più schede con lo stesso nome decidono e-mail e telefono, poi il titolo;
   - se non si capisce quale sia, NON si scrive su nessuna scheda (meglio niente che la persona sbagliata);
   - una sola scheda con un titolo diverso da quello scritto (Geom. / Ing.) può essere un omonimo non
     ancora in anagrafica: anche lì non si scrive niente, e si chiede.
   Codice fiscale: il tecnico lo scrive dove manca (scheda nuova o scheda senza); cambiarne uno già
   scritto resta della segreteria (lo garantisce anche il database, trg_persone_0z_cf_solo_se_vuoto).
   Funzioni pure: le prova test/persone-omonimi.test.cjs. */
(function (root) {
  'use strict';
  const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  /* nome e cognome ordinati: «Carraro Marco» e «Marco Carraro» sono la stessa chiave */
  const chiave = (nome, cognome) => [norm(nome), norm(cognome)].sort().join('|');
  const normTitolo = (t) => norm(t).replace(/\s+/g, '');
  /* due titoli scritti e incompatibili: «Geom.» / «Ing.» sì; «Ing.» / «Dott. Ing.» e «geom.» / «Geom.» no */
  function titoliDiversi(a, b) {
    const x = normTitolo(a), y = normTitolo(b);
    return !!(x && y && x !== y && !x.includes(y) && !y.includes(x));
  }
  const emailDi = (r) => [r.email, r.email2, r.email3].map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
  const telDi = (r) => [r.telefono, r.telefono2].map((x) => String(x || '').replace(/\D/g, '')).filter(Boolean);
  const etichetta = (r) => [r.titolo, r.nome, r.cognome].filter(Boolean).join(' ');
  function descrivi(r) {
    const contatti = [...emailDi(r), ...[r.telefono, r.telefono2].filter(Boolean)].join(' · ');
    return [etichetta(r), r.cf ? 'CF ' + r.cf : null, contatti || 'senza recapiti'].filter(Boolean).join(' — ');
  }

  /* Quale scheda è la persona scritta nel riquadro del verbale.
     dati: { nome, cognome, titolo, email, tel, sceltaId }; schede: le persone con quel nome.
     Esito: { persona } | { nessuna: true } (si può creare) | { ambigua: true, motivo, candidati } */
  function scegli(dati, schede) {
    const tutte = (schede || []).filter((r) => r && r.elimina !== 1);
    if (dati.sceltaId) {
      const s = tutte.find((r) => r.persona_id === dati.sceltaId);
      if (s) return { persona: s };
    }
    const k = chiave(dati.nome, dati.cognome);
    const c = tutte.filter((r) => chiave(r.nome, r.cognome) === k);
    if (!c.length) return { nessuna: true };
    const em = String(dati.email || '').trim().toLowerCase();
    const tl = String(dati.tel || '').replace(/\D/g, '');
    const perContatto = c.filter((r) => (em && emailDi(r).includes(em)) || (tl && telDi(r).includes(tl)));
    if (perContatto.length === 1) return { persona: perContatto[0] };
    const gruppo = perContatto.length > 1 ? perContatto : c;
    const compatibili = gruppo.filter((r) => !titoliDiversi(dati.titolo, r.titolo));
    if (gruppo.length === 1) {
      if (compatibili.length === 1) return { persona: gruppo[0] };
      return { ambigua: true, motivo: 'titolo', candidati: gruppo };
    }
    if (compatibili.length === 1) return { persona: compatibili[0] };
    return { ambigua: true, motivo: 'omonimi', candidati: gruppo };
  }

  /* «Nuova persona» con un omonimo già in anagrafica: la scheda nuova si crea solo se qualcosa la
     distingue da ciascuna delle esistenti. '' = si può creare; altrimenti il motivo. */
  function percheNonCreare(nuova, esistenti) {
    const cf = String(nuova.cf || '').trim().toUpperCase();
    for (const r of esistenti || []) {
      if (cf && r.cf && String(r.cf).toUpperCase() === cf) {
        return 'Il codice fiscale è quello di «' + etichetta(r) + '»: è la stessa persona.';
      }
      const em = String(nuova.email || '').trim().toLowerCase();
      const tl = String(nuova.telefono || '').replace(/\D/g, '');
      const distingue =
        (cf && r.cf && String(r.cf).toUpperCase() !== cf) ||
        titoliDiversi(nuova.titolo, r.titolo) ||
        (em && emailDi(r).length && !emailDi(r).includes(em)) ||
        (tl && telDi(r).length && !telDi(r).includes(tl));
      if (!distingue) {
        return 'Niente la distingue da «' + etichetta(r) + '». Per creare un omonimo scrivi il titolo, '
          + 'l\'e-mail, il telefono o il codice fiscale che la distinguono.';
      }
    }
    return '';
  }

  /* ── codice fiscale ── */
  function cfValido(x) {
    const c = String(x || '').replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9]{15}[A-Z]$/.test(c)) return false;
    const DISPARI = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];
    let t = 0;
    for (let i = 0; i < 15; i++) {
      const ch = c[i], k = /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 65;
      t += (i % 2 === 0) ? DISPARI[k] : k;
    }
    return String.fromCharCode(65 + t % 26) === c[15];
  }
  const lettere = (s, voc) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z]/g, '').split('').filter((c) => 'AEIOU'.includes(c) === voc).join('');
  const triCognome = (c) => (lettere(c, false) + lettere(c, true) + 'XXX').slice(0, 3);
  function triNome(n) {
    const c = lettere(n, false);
    return c.length >= 4 ? c[0] + c[2] + c[3] : (c + lettere(n, true) + 'XXX').slice(0, 3);
  }
  /* '' se il codice va bene; altrimenti { motivo, grave }.
     grave = il codice è sbagliato in sé (lunghezza, carattere di controllo): non si salva mai.
     non grave = le lettere non tornano col nome scritto: il tecnico corregge, la segreteria può confermare. */
  function cfProblema(cf, nome, cognome) {
    const c = String(cf || '').replace(/\s+/g, '').toUpperCase();
    if (!c) return '';
    if (c.length !== 16) return { grave: true, motivo: 'Il codice fiscale ha 16 caratteri: qui ce ne sono ' + c.length + '.' };
    if (!cfValido(c)) return { grave: true, motivo: 'Il carattere di controllo non torna: ricontrolla il codice fiscale.' };
    if (!cognome && !nome) return '';
    const diritto = triCognome(cognome) === c.slice(0, 3) && triNome(nome) === c.slice(3, 6);
    const rovescio = triCognome(nome) === c.slice(0, 3) && triNome(cognome) === c.slice(3, 6);
    if (diritto || rovescio) return '';
    return { grave: false, motivo: 'Le lettere del codice fiscale (' + c.slice(0, 6) + ') non tornano con «'
      + [nome, cognome].filter(Boolean).join(' ') + '» (' + triCognome(cognome) + triNome(nome) + '): è la persona giusta?' };
  }
  /* chi può scrivere il codice fiscale della scheda: la segreteria sempre, gli altri solo dove manca */
  const cfScrivibile = (segreteria, cfAttuale) => !!segreteria || !String(cfAttuale || '').trim();

  const api = { norm, chiave, titoliDiversi, etichetta, descrivi, scegli, percheNonCreare, cfValido, cfProblema, cfScrivibile, triCognome, triNome };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PersOmonimi = api;
})(typeof window !== 'undefined' ? window : globalThis);
