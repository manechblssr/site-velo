"""Probe : qui porte un fond en dégradé-grille, et contraste des placeholders."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/"

JS = r"""
() => {
  const out = { grille: [], placeholder: [] };
  const lum = (c) => {
    const m = c.match(/[\d.]+/g).map(Number);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(m[0]) + 0.7152*f(m[1]) + 0.0722*f(m[2]);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)).toFixed(2); };
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.backgroundImage.includes('gradient')) {
      out.grille.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} :: ${cs.backgroundImage.slice(0, 70)}`);
    }
  }
  for (const el of document.querySelectorAll('input, textarea')) {
    const cs = getComputedStyle(el, '::placeholder');
    const bgEl = el;
    let bg = 'rgb(251, 250, 248)';
    let n = bgEl;
    while (n && n !== document.documentElement) {
      const b = getComputedStyle(n).backgroundColor;
      if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { bg = b; break; }
      n = n.parentElement;
    }
    out.placeholder.push(`${el.id || el.name || el.type}: ${cs.color} sur ${bg} -> ${ratio(cs.color, bg)}`);
  }
  return out;
}
"""


def run():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 960})
        pg.goto(f"{BASE}#/carte", wait_until="domcontentloaded")
        pg.wait_for_timeout(3000)
        res = pg.evaluate(JS)
        print("=== elements avec fond en gradient ===")
        for g in res["grille"]:
            print("  -", g)
        if not res["grille"]:
            print("  (aucun)")
        print("=== placeholders ===")
        for p in res["placeholder"]:
            print("  -", p)
        b.close()


if __name__ == "__main__":
    run()
