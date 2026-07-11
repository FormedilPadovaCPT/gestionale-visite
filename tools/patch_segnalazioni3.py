# -*- coding: utf-8 -*-
"""Patch 3 — 2026-07-10: spostamento card obiettivo anche dentro loadTargetCard
(belt & braces: qualunque percorso mostri la card, per il tecnico finisce
sopra i selettori della dashboard).
Uso: python tools/patch_segnalazioni3.py
"""
import io, os, shutil, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'index.html')
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
BAK = os.path.join(BASE, f'index_pre_segnalazioni3_{ts}.html.bak')

shutil.copy2(SRC, BAK)
print('Backup:', BAK)

with io.open(BAK, 'r', encoding='utf-8') as f:
    html = f.read()

def rep(old, new, label):
    global html
    n = html.count(old)
    assert n == 1, f'{label}: attese 1 occorrenza, trovate {n}'
    html = html.replace(old, new)
    print('OK:', label)

rep("""async function loadTargetCard(){
  const card=$('card-target-mese')
  if(!card)return""",
    """async function loadTargetCard(){
  const card=$('card-target-mese')
  if(!card)return
  // per il tecnico (non coordinatore) la card va sopra i selettori della dashboard
  if(S.tecnico&&!window.__isCoord){
    const _df=$('dash-filtri')
    if(_df&&_df.parentNode&&card.nextElementSibling!==_df)_df.parentNode.insertBefore(card,_df)
  }""",
    'move in loadTargetCard')

with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

ok_end = html.rstrip().endswith('</html>')
print(f'Scritto {SRC}: {os.path.getsize(SRC)} byte, termina con </html>: {ok_end}')
assert ok_end
print('PATCH 3 COMPLETATA')
