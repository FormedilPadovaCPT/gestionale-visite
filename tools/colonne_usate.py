#!/usr/bin/env python3
"""
Elenca le COLONNE che il gestionale chiede al database, tabella per tabella.

Nasce il 19/09/2026: la scheda di un'impresa cercava i cantieri con
`cantieri.impresa_id`, una colonna che non esiste. La ricerca falliva sempre,
l'errore veniva ignorato e per OGNI impresa usciva «Nessun cantiere collegato».
Nessun controllo lo vedeva: la sintassi era giusta, era il NOME a essere falso.

Uso:   python tools/colonne_usate.py colonne.json
Il file si confronta poi con information_schema.columns (la query sta nel log
del vault, 19/09/2026): cio' che il codice chiede e il database non ha.
E' un setaccio: legge .from('t').select('...') e i filtri subito dopo; le
ricerche costruite a pezzi non le vede.
"""
import io, re, json, glob, sys
file = ['index.html'] + [f for f in glob.glob('*.js') if f != 'sw.js']
coppie = {}
for f in file:
    s = io.open(f, encoding='utf-8', errors='replace').read()
    for m in re.finditer(r"\.from\(\s*['\"]([a-z_0-9]+)['\"]\s*\)", s):
        t = m.group(1); coda = s[m.end(): m.end() + 900]
        fine = re.search(r"\n\s*\n|;\s*\n|\bawait\b|\.from\(", coda)
        coda = coda[: fine.start()] if fine else coda
        cols = set()
        sel = re.search(r"\.select\(\s*(['\"`])(.*?)\1", coda, re.S)
        if sel and '${' not in sel.group(2):
            testo = sel.group(2)
            # togli le relazioni incorporate: nome!fk(...) o nome(...)
            prev = None
            while prev != testo:
                prev = testo; testo = re.sub(r"[a-zA-Z_0-9:!]+\s*\([^()]*\)", "", testo)
            for c in testo.split(','):
                c = c.strip()
                if not c or c == '*' or '(' in c or ')' in c: continue
                if ':' in c: c = c.split(':', 1)[1].strip()
                c = c.split('->')[0].split('::')[0].strip()
                if re.fullmatch(r"[a-z_0-9]+", c): cols.add(c)
        for fm in re.finditer(r"\.(?:eq|neq|in|is|gt|gte|lt|lte|like|ilike|order|not)\(\s*['\"]([a-z_0-9]+)['\"]", coda):
            cols.add(fm.group(1))
        if cols: coppie.setdefault(t, set()).update(cols)
out = {t: sorted(c) for t, c in sorted(coppie.items())}
io.open(sys.argv[1], 'w', encoding='utf-8').write(json.dumps(out, separators=(',', ':')))
print(len(out), 'tabelle,', sum(len(c) for c in out.values()), 'colonne,', len(json.dumps(out, separators=(',', ':'))), 'caratteri')
