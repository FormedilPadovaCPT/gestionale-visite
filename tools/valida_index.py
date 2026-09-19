#!/usr/bin/env python3
"""
Validatore d'integrita' di index.html per il Gestionale Visite.

Nasce per prevenire l'incidente del 02/06/2026 (upload di un index.html
troncato -> app in crash). Da eseguire SEMPRE prima di caricare il file
sul repo, e in automatico via GitHub Actions (vedi .github/workflows/valida-index.yml).

Uso:
    python tools/valida_index.py [percorso_index.html]

Esce con codice 0 se il file e' integro, 1 se trova problemi.
"""
import re
import sys
import pathlib

def sintassi_script(s: str, base: pathlib.Path) -> list:
    """Controlla con `node --check` ogni <script> scritto dentro la pagina."""
    import shutil, subprocess, tempfile
    node = shutil.which("node")
    if not node:
        # Dire «OK» senza aver controllato sarebbe il guasto che questo punto vuole evitare.
        return ["Node non trovato: la sintassi degli script NON e' stata controllata."]
    problemi = []
    blocchi = re.findall(r"<script\b([^>]*)>(.*?)</script>", s, flags=re.S | re.I)
    with tempfile.TemporaryDirectory() as d:
        n = 0
        for attr, corpo in blocchi:
            if re.search(r"\bsrc\s*=", attr, re.I) or not corpo.strip():
                continue
            tipo = re.search(r"\btype\s*=\s*[\"']?([^\"'\s>]+)", attr, re.I)
            tipo = (tipo.group(1).lower() if tipo else "")
            if tipo and tipo not in ("module", "text/javascript", "application/javascript"):
                continue  # json, template e simili non sono JavaScript
            n += 1
            f = pathlib.Path(d) / f"blocco_{n}.{'mjs' if tipo == 'module' else 'cjs'}"
            f.write_text(corpo, encoding="utf-8")
            r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode != 0:
                riga_pagina = s[: s.index(corpo)].count("\n")
                m = re.search(r":(\d+)\s*\n(.*)\n", r.stderr)
                dove = f" (riga {riga_pagina + int(m.group(1))} di index.html)" if m else ""
                righe = [x for x in r.stderr.strip().splitlines() if x.strip()]
                errore = next((x for x in righe if "Error" in x), righe[-1] if righe else "errore")
                problemi.append(f"Errore di sintassi nello script n. {n}{dove}: {errore.strip()}")
                if m:
                    problemi.append("      " + m.group(2).strip()[:160])
        if n == 0:
            problemi.append("Nessuno script in pagina trovato da controllare.")

        # i file .js accanto alla pagina (notifiche.js, mappa.js, ...): stesso controllo
        for attr, _ in blocchi:
            m = re.search(r"\bsrc\s*=\s*[\"']([^\"'?#]+\.js)", attr, re.I)
            if not m or re.match(r"(https?:)?//", m.group(1)):
                continue
            sorgente = base / m.group(1)
            if not sorgente.exists():
                problemi.append(f"La pagina carica {m.group(1)}, che non esiste accanto a index.html.")
                continue
            modulo = bool(re.search(r"\btype\s*=\s*[\"']?module", attr, re.I))
            f = pathlib.Path(d) / (sorgente.stem + (".mjs" if modulo else ".cjs"))
            f.write_text(sorgente.read_text(encoding="utf-8"), encoding="utf-8")
            r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode != 0:
                righe = [x for x in r.stderr.strip().splitlines() if x.strip()]
                errore = next((x for x in righe if "Error" in x), righe[-1] if righe else "errore")
                problemi.append(f"Errore di sintassi in {m.group(1)}: {errore.strip()}")
    return problemi


def valida(path: str) -> int:
    p = pathlib.Path(path)
    if not p.exists():
        print(f"ERRORE: file non trovato: {path}")
        return 1

    s = p.read_text(encoding="utf-8")
    problemi = []

    # 1) Il file deve chiudersi correttamente (il troncamento taglia proprio la coda)
    if not s.rstrip().endswith("</html>"):
        problemi.append("Il file NON termina con </html> -> probabile troncamento.")

    # 2) Tag <script> bilanciati
    ap = len(re.findall(r"<script\b", s, re.I))
    ch = len(re.findall(r"</script>", s, re.I))
    if ap != ch:
        problemi.append(f"Tag <script> sbilanciati: {ap} aperti / {ch} chiusi.")

    # 3) Tag <style> bilanciati
    sa = len(re.findall(r"<style\b", s, re.I))
    sc = len(re.findall(r"</style>", s, re.I))
    if sa != sc:
        problemi.append(f"Tag <style> sbilanciati: {sa} aperti / {sc} chiusi.")

    # 4) Parentesi graffe del JS bilanciate (controllo grezzo ma efficace sui troncamenti)
    g_ap, g_ch = s.count("{"), s.count("}")
    if g_ap != g_ch:
        problemi.append(f"Parentesi graffe sbilanciate: {{ {g_ap} vs }} {g_ch} (diff {g_ap - g_ch}).")

    # 5) Il client Supabase deve essere presente (marcatore che l'app e' completa)
    if "createClient" not in s:
        problemi.append("Manca 'createClient' -> il file potrebbe essere incompleto.")

    # 6) Dimensione minima di sanita' (un index.html valido supera ampiamente i 400 KB)
    if len(s) < 400_000:
        problemi.append(f"Dimensione sospetta: {len(s)} byte (< 400 KB).")

    # 7) SINTASSI VERA degli script in pagina (19/09/2026).
    #    I controlli qui sopra vedono un file troncato, NON un errore di sintassi:
    #    un apostrofo non protetto lascia le graffe bilanciate e passa — ma nel
    #    browser lo script principale non parte e il gestionale resta bianco per
    #    tutti. Ogni blocco si da' a `node --check`.
    #    ⚠️ I blocchi <script type="module"> si salvano come .mjs: con l'estensione
    #    .js Node, davanti a un `import`, esce con 0 SENZA controllare niente
    #    (provato: lo stesso file rotto da' 0 come .js e 1 come .mjs).
    problemi += sintassi_script(s, p.resolve().parent)

    if problemi:
        print("VALIDAZIONE FALLITA:")
        for x in problemi:
            print("  - " + x)
        return 1

    print(f"OK: index.html integro ({len(s):,} byte, {ap} script, graffe {g_ap} bilanciate).")
    return 0

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "index.html"
    sys.exit(valida(target))
