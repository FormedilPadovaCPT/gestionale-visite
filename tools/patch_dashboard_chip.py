# -*- coding: utf-8 -*-
"""23/09/2026 - Caselle IPC sopra la mappa della Dashboard compatte anche sul telefono:
le regole generali di label e input (maiuscolo, larghezza piena) le allargavano."""
import io
P = 'index.html'
src = io.open(P, encoding='utf-8', newline='').read()
v = """#view-dashboard .card h3::after,#view-statistiche .card h3::after{"""
assert src.count(v) == 1
src = src.replace(v, """#dash-map-filters label{text-transform:none;letter-spacing:normal;font-size:12px;font-weight:500;color:#333;white-space:nowrap;margin:0}
#dash-map-filters input[type=checkbox]{width:auto!important;min-width:0!important;margin:0!important;padding:0!important}
#dash-map-filters select{width:auto!important}
""" + v)
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('ok')
