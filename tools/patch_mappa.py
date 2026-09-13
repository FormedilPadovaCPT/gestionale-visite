"""Mappa sul telefono (13/09/2026): toglie i temi e collega mappa.css e mappa.js.

L'11/09 erano entrati i temi Scrivania, Mappa e Taccuino (temi.css, temi.js,
patch_temi.py). Il 13/09 l'utente ha scelto di tenere la grafica Attuale e di
conservare solo due funzioni della Mappa, utili sul telefono: «Cantieri vicino
a te» nella Nuova visita e «Rientri sulla mappa» nelle Scadenze.

Solo agganci: le funzioni stanno in mappa.js. Restano i tre eventi che servono
(cantiere, tab, form), rinominati mappaEvento; spariscono zona e dots, che
usavano solo Scrivania e Taccuino.
Backup index_pre_mappa_<data>.html.bak; ogni sostituzione deve trovare
UNA sola occorrenza (regola del file grande: mai Edit diretto).
"""
import pathlib, shutil, datetime, sys

D = pathlib.Path(__file__).resolve().parent.parent
P = D / "index.html"
raw = P.read_bytes()
crlf = b"\r\n" in raw[:5000]
s = raw.decode("utf-8")
if crlf:
    s = s.replace("\r\n", "\n")

if "mappa.js" in s:
    print("gia' applicata"); sys.exit(0)

bak = D / f"index_pre_mappa_{datetime.datetime.now():%Y%m%d_%H%M%S}.html.bak"
shutil.copy2(P, bak)

def rep(old, new):
    global s
    n = s.count(old)
    assert n == 1, (n, old[:90])
    s = s.replace(old, new)

rep('<!-- temi scelti dal tecnico (Scrivania, Mappa, Taccuino): senza data-tema non cambia niente -->\n'
    '<link rel="stylesheet" href="temi.css?v=2"/>\n',
    '<!-- mappa sul telefono: cantieri vicino a te e rientri sulla mappa (mappa.js) -->\n'
    '<link rel="stylesheet" href="mappa.css?v=1"/>\n')

rep("if(id==='f-cant-id'&&window.temaEvento)window.temaEvento('cantiere',v)}",
    "if(id==='f-cant-id'&&window.mappaEvento)window.mappaEvento('cantiere',v)}")

rep("  if(window.temaEvento)window.temaEvento('tab',n)\n",
    "  if(window.mappaEvento)window.mappaEvento('tab',n)\n")

rep("  if(window.temaEvento)window.temaEvento('zona',ti)\n", "")

rep("  if(window.temaEvento)window.temaEvento('dots')\n", "")

rep("  if(window.temaEvento)window.temaEvento('form')\n",
    "  if(window.mappaEvento)window.mappaEvento('form')\n")

rep("/* temi.js (Mappa, Taccuino) riempie il modulo con le stesse funzioni che\n"
    "   usa l'app: si espongono qui, senza copiarle. */\n"
    "window.__app={vSet,vGet,initForm,applySnap,buildSnap,rebuildSnapFromDB,autoAccCant,renderCantCard,\n"
    "  proponiImportoCantiere,caricaProposteImprese,proponiCommittenteCantiere,saveTabData,renderImpreseAccordion,calcIPC}\n",
    "/* mappa.js («Inizia qui» dai cantieri vicini e dai rientri) riempie il modulo\n"
    "   con le stesse funzioni che usa l'app: si espongono qui, senza copiarle.\n"
    "   Chi rinomina una di queste funzioni aggiorna anche questa riga. */\n"
    "window.__app={vSet,vGet,initForm,autoAccCant,renderCantCard,\n"
    "  proponiImportoCantiere,caricaProposteImprese,proponiCommittenteCantiere}\n")

rep('<!-- temi: pulsante 🎨 nella testata; Scrivania, Mappa e Taccuino (temi.css) -->\n'
    '<script src="temi.js?v=2"></script>\n',
    '<!-- mappa sul telefono: cantieri vicino a te (Nuova visita) e rientri sulla mappa (Scadenze) -->\n'
    '<script src="mappa.js?v=1"></script>\n')

assert "temaEvento" not in s and "temi.js" not in s and "temi.css" not in s

out = s.replace("\n", "\r\n") if crlf else s
P.write_bytes(out.encode("utf-8"))
print("ok", bak.name, len(raw), "->", len(out.encode("utf-8")), "crlf" if crlf else "lf")
