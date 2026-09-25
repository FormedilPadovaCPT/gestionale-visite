# -*- coding: utf-8 -*-
"""25/09/2026 - Il blocco «formazione mancante» (casella ufficio corsi, quale
formazione manca, nota) passa dal passo Note al passo «10. Formazione» della
checklist, in fondo alle voci: è lì che il tecnico la constata. Nel passo Note
resta la sola «Propongo segnalazione a SPISAL / ITL».
Il blocco sta nel sorgente HTML del passo Note (i passi 3-12 nascono dal codice)
e buildTabs lo sposta nella card della zona 10 appena la crea: gli id non
cambiano, quindi salvataggio, caricamento e anteprima restano quelli.
Manuale tecnici: 1.62 -> 1.63. Lo script si può rilanciare: salta ciò che è già fatto.
"""
import io
def leggi(p): return io.open(p, encoding='utf-8', newline='').read()
def scrivi(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def sost(s, v, n, nome):
    NL = '\r\n' if '\r\n' in s else '\n'; v = v.replace('\n', NL); n = n.replace('\n', NL)
    assert s.count(v) == 1, '%s: %d occorrenze' % (nome, s.count(v)); return s.replace(v, n)
def riga(s, i):
    """(inizio, fine) della riga che contiene i: la fine è dopo il \n, qualunque sia il fine riga."""
    a = s.rfind('\n', 0, i) + 1; b = s.find('\n', i) + 1
    return a, (b if b > 0 else len(s))

# ── index.html ──
P = 'index.html'; s = leggi(P)
if 'blk-formazione-mancante' in s:
    print('index.html: già fatto')
else:
    s = sost(s, """          <div class="sect-title">Formazione e segnalazioni</div>
          <div class="field"><label><span class="check-inline"><input type="checkbox" id="f-note-for-sn"> Contattare l'ufficio corsi per regolarizzare la formazione mancante</span></label></div>
          <!-- quale formazione manca (25/09/2026): elenco breve da formazione_tipi. Con la casella
               spuntata, la mail del verbale propone le date dei corsi e l'ufficio corsi riceve la segnalazione -->
          <div class="field" id="fld-note-for-tipi"><label>Quale formazione manca? <span style="font-weight:400;text-transform:none;letter-spacing:0">(spunta una o più voci: con la casella qui sopra, l'impresa riceve nella mail del verbale le prossime date dei corsi e l'ufficio corsi viene avvisato)</span></label>
            <div id="f-note-for-tipi" class="chips-tipi"><span style="font-size:12px;color:#888">Carico l'elenco…</span></div></div>
          <div class="field"><label>Note sulla formazione mancante</label><textarea id="f-note-for-m" rows="2" placeholder="Es. solo il titolare ha il primo soccorso, e non sta in cantiere"></textarea></div>
          <div class="field"><label><span class="check-inline"><input type="checkbox" id="f-segnalazione"> Propongo segnalazione a SPISAL / ITL</span></label></div>
""", """          <div class="sect-title">Segnalazioni</div>
          <div class="field"><label><span class="check-inline"><input type="checkbox" id="f-segnalazione"> Propongo segnalazione a SPISAL / ITL</span></label></div>
          <!-- formazione mancante (25/09/2026): il blocco sta qui nel sorgente perché i passi della
               checklist nascono dal codice, ma VIVE nel passo «10. Formazione», in fondo alle voci:
               ce lo sposta buildTabs. Elenco breve da formazione_tipi; con la casella spuntata la mail
               del verbale propone le date dei corsi e l'ufficio corsi riceve la segnalazione -->
          <div id="blk-formazione-mancante" style="margin-top:16px;padding-top:12px;border-top:1px solid #e6e6e6">
            <div class="sect-title">Formazione mancante: che cosa fare</div>
            <div class="field"><label><span class="check-inline"><input type="checkbox" id="f-note-for-sn"> Contattare l'ufficio corsi per regolarizzare la formazione mancante</span></label></div>
            <div class="field" id="fld-note-for-tipi"><label>Quale formazione manca? <span style="font-weight:400;text-transform:none;letter-spacing:0">(spunta una o più voci: con la casella qui sopra, l'impresa riceve nella mail del verbale le prossime date dei corsi e l'ufficio corsi viene avvisato)</span></label>
              <div id="f-note-for-tipi" class="chips-tipi"><span style="font-size:12px;color:#888">Carico l'elenco…</span></div></div>
            <div class="field"><label>Note sulla formazione mancante</label><textarea id="f-note-for-m" rows="2" placeholder="Es. solo il titolare ha il primo soccorso, e non sta in cantiere"></textarea></div>
          </div>
""", 'blocco note')
    s = sost(s, """      d.innerHTML=`<div class="card"><h3>${ZONE_LBL[z]}</h3><div id="zi-${z}"></div></div>`
      tabArea.insertBefore(d,ref)
""", """      d.innerHTML=`<div class="card"><h3>${ZONE_LBL[z]}</h3><div id="zi-${z}"></div></div>`
      tabArea.insertBefore(d,ref)
      // 25/09/2026: il blocco «formazione mancante» vive in fondo alla zona 10 (Formazione), non nel passo Note
      if(z===10){const blk=$('blk-formazione-mancante');if(blk)d.querySelector('.card').appendChild(blk)}
""", 'spostamento in zona 10')
    scrivi(P, s); print('index.html ok')

# ── manuale tecnici (il file ha fine riga misti: le righe si tagliano sul solo \n) ──
P = '../gen_manuale.mjs'; m = leggi(P)
if 'Versione 1.63 — 25 settembre 2026' in m:
    print('manuale: già fatto')
else:
    NL = '\r\n'
    m = sost(m, 'Versione 1.62 — 25 settembre 2026', 'Versione 1.63 — 25 settembre 2026', 'versione')
    # il riquadro: lo tolgo dal passo Note e lo tengo da parte
    i = m.find("c.push(box('Formazione mancante: che cosa succede quando spunti la casella'"); assert i > 0, 'box'
    a, b = riga(m, i); box = m[a:b].rstrip('\r\n'); m = m[:a] + m[b:]
    # il bullet del passo Note: diventa «Segnalazioni» e rimanda al 6.5
    i = m.find("c.push(bullet([b('Formazione e segnalazioni')"); assert i > 0, 'bullet'
    a, b = riga(m, i)
    m = m[:a] + "c.push(bullet([b('Segnalazioni'), tx(' — la casella “Propongo segnalazione a SPISAL / ITL”. La formazione mancante non sta più qui: la trovi in fondo alla macroarea 10. Formazione (paragrafo 6.5).')]))" + NL + m[b:]
    m = sost(m, "c.push(caption('Osservazioni, formazione, segnalazioni e data di ritorno'))", "c.push(caption('Osservazioni, segnalazione e data di ritorno'))", 'caption note')
    # ...e vanno in fondo alla macroarea 10, nel paragrafo 6.5, prima del 6.6
    anc = "c.push(h2('6.6 Passo Note'))"; assert m.count(anc) == 1, 'ancora 6.6'
    nuovo = ("c.push(p([tx('In fondo alla macroarea '), b('10. Formazione'), tx(', sotto le voci della checklist, c’è il riquadro '), b('«Formazione mancante: che cosa fare»'), tx(': la casella “Contattare l’ufficio corsi per regolarizzare la formazione mancante”, le voci “Quale formazione manca?” (elenco breve: base lavoratori, preposto, primo soccorso, antincendio, lavori in quota, ponteggi, macchine e attrezzature, ambienti confinati, datore di lavoro, RLS) e una nota. Sta lì perché è lì che la constati, mentre spunti le voci. Dal 25 settembre 2026 la casella fa due cose da sola, vedi il riquadro.')]))" + NL
             + box + NL + NL)
    m = m.replace(anc, nuovo + anc)
    scrivi(P, m); print('manuale tecnici v1.63 pronto')
