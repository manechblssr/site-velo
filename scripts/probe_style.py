"""Sonde de styles calculés : couleur/typo des éléments clés, contraste WCAG."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/"

JS = r"""
(sel) => {
  const out = {};
  const parse = (c) => {
    const m = c.match(/[\d.]+/g).map(Number);
    return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 };
  };
  const lum = (c) => {
    const { r, g, b } = parse(c);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)).toFixed(2); };
  // Les fonds semi-transparents (color-mix) doivent être composés sur le papier
  // avant calcul : les traiter comme opaques fausse le ratio.
  const comp = (fg, bg) => {
    const f = parse(fg), b = parse(bg);
    const a = f.a;
    const mix = (x, y) => Math.round(x*a + y*(1-a));
    return `rgb(${mix(f.r, b.r)}, ${mix(f.g, b.g)}, ${mix(f.b, b.b)})`;
  };
  const bgDe = (el) => {
    const stack = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
        stack.push(bg);
        if (parse(bg).a >= 1) break;
      }
      n = n.parentElement;
    }
    let base = 'rgb(251, 250, 248)'; // --papier
    for (let i = stack.length - 1; i >= 0; i--) base = comp(stack[i], base);
    const m = base.match(/[\d.]+/g).map(Number);
    return `rgb(${Math.round(m[0])}, ${Math.round(m[1])}, ${Math.round(m[2])})`;
  };
  for (const [nom, s] of Object.entries(sel)) {
    const el = document.querySelector(s);
    if (!el) { out[nom] = 'ABSENT'; continue; }
    const cs = getComputedStyle(el);
    const bg = bgDe(el);
    out[nom] = {
      color: cs.color, bg, contraste: ratio(cs.color, bg),
      font: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      size: cs.fontSize, weight: cs.fontWeight, ls: cs.letterSpacing,
      text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 45),
    };
  }
  return out;
}
"""

CIBLES = {
    "clubs": {
        "h1": "h1",
        "cellule_km": "table.table-app tbody tr td.num:nth-of-type(3)",
        "entete_table": "table.table-app thead th",
        "ligne_resultats": ".toolbar__count, .result-line__count",
        "lien_club": "table.table-app tbody th button",
    },
    "annuaire": {
        "h1": "h1",
        "chip_formule": ".table-app--lite .formule",
        "progression": ".nb-dist",
        "filtre_label": ".toolbar label, .filters label",
        "bouton_voir": ".cell-action .btn",
    },
    "presentation": {
        "h1": "h1",
        "intro": ".hero p, .lead",
        "encart_titre": "h3",
        "note_bas": ".note, footer small",
    },
}

def run():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 960})
        for vue, sel in CIBLES.items():
            pg.goto(f"{BASE}?s={vue}#/{vue}", wait_until="domcontentloaded")
            pg.wait_for_timeout(2500)
            res = pg.evaluate(JS, sel)
            print(f"=== {vue} ===")
            for k, v in res.items():
                if isinstance(v, dict):
                    flag = " <== CONTRASTE FAIBLE" if float(v["contraste"]) < 4.5 else ""
                    print(f"  {k:16} {v['color']:22} ratio={v['contraste']:>5} "
                          f"{v['size']:>6} w{v['weight']:>3} {v['font']:14} {v['text']!r}{flag}")
                else:
                    print(f"  {k:16} {v}")
        b.close()

if __name__ == "__main__":
    run()
