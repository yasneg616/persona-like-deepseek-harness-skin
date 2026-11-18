"""Inline the original capsule + headphones art into the P3 UI concept page.

    python -I design/build-p3-ui.py
"""
import re
from pathlib import Path

here = Path(__file__).resolve().parent
assets = here.parent / 'assets'


def art(name: str) -> str:
    svg = (assets / name).read_text(encoding='utf-8')
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S)
    return re.sub(r'\s*\n\s*', ' ', svg).strip().replace('<svg ', '<svg aria-hidden="true" ', 1)


src = (here / 'p3-ui.src.html').read_text(encoding='utf-8')
out = src.replace('{{CAPSULE}}', art('p3-capsule.svg')).replace('{{HEADPHONES}}', art('p3-headphones.svg'))
(here / 'p3-ui.html').write_text(out, encoding='utf-8')
print('wrote', here / 'p3-ui.html')
