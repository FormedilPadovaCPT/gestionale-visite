"""Temi del Gestionale Visite (11/09/2026): collega temi.css e temi.js a index.html.

Solo agganci: la grafica sta in temi.css, le funzioni in temi.js.
Backup index_pre_temi_<data>.html.bak; ogni sostituzione deve trovare
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

if "temi.js" in s:
    print("gia' applicata"); sys.exit(0)

bak = D / f"index_pre_temi_{datetime.datetime.now():%Y%m%d_%H%M%S}.html.bak"
shutil.copy2(P, bak)

def rep(old, new):
    global s
    n = s.count(old)
    assert n == 1, (n, old[:90])
    s = s.replace(old, new)

rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>\n',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>\n'
    '<!-- temi scelti dal tecnico (Scrivania, Mappa, Taccuino): senza data-tema non cambia niente -->\n'
    '<link rel="stylesheet" href="temi.css"/>\n')

rep("function vSet(id,v){if($(id))$(id).value=v??''}",
    "function vSet(id,v){if($(id))$(id).value=v??'';if(id==='f-cant-id'&&window.temaEvento)window.temaEvento('cantiere',v)}")

rep("  if(n===13)suggerisciDataRientro()\n}",
    "  if(n===13)suggerisciDataRientro()\n  if(window.temaEvento)window.temaEvento('tab',n)\n}")

rep("  con.querySelectorAll('input[data-nota]').forEach(i=>{\n    i.oninput=()=>S.noteChk[i.dataset.nota]=i.value\n  })\n}\n\nfunction setGruppoVer",
    "  con.querySelectorAll('input[data-nota]').forEach(i=>{\n    i.oninput=()=>S.noteChk[i.dataset.nota]=i.value\n  })\n  if(window.temaEvento)window.temaEvento('zona',ti)\n}\n\nfunction setGruppoVer")

rep("    if(btn)btn.classList.toggle('has-rilievi',hr)\n  }\n}",
    "    if(btn)btn.classList.toggle('has-rilievi',hr)\n  }\n  if(window.temaEvento)window.temaEvento('dots')\n}")

rep("  activateTab(0)\n  updateIPCLive()\n}\n\nasync function nextVerbale",
    "  activateTab(0)\n  updateIPCLive()\n  if(window.temaEvento)window.temaEvento('form')\n}\n\nasync function nextVerbale")

rep("window.SB_URL=SB_URL; window.SB_KEY=SB_KEY\n",
    "window.SB_URL=SB_URL; window.SB_KEY=SB_KEY\n"
    "/* temi.js (Mappa, Taccuino) riempie il modulo con le stesse funzioni che\n"
    "   usa l'app: si espongono qui, senza copiarle. */\n"
    "window.__app={vSet,vGet,initForm,applySnap,buildSnap,rebuildSnapFromDB,autoAccCant,renderCantCard,\n"
    "  proponiImportoCantiere,caricaProposteImprese,proponiCommittenteCantiere,saveTabData,renderImpreseAccordion,calcIPC}\n")

rep('<script src="manuali.js"></script>\n',
    '<script src="manuali.js"></script>\n'
    '<!-- temi: pulsante 🎨 nella testata; Scrivania, Mappa e Taccuino (temi.css) -->\n'
    '<script src="temi.js"></script>\n')

out = s.replace("\n", "\r\n") if crlf else s
P.write_bytes(out.encode("utf-8"))
print("ok", bak.name, len(raw), "->", len(out.encode("utf-8")), "crlf" if crlf else "lf")
