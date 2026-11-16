"""Diag5 : trouve l'element qui provoque le debordement en le masquant un par un."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/"

JS = r"""
() => {
  const base = document.documentElement.scrollWidth;
  const vw = document.documentElement.clientWidth;
  const results = [];
  // candidats : tous les elements dont le rect depasse vw, OU scrollWidth>clientWidth
  const cands = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || el.scrollWidth > el.clientWidth + 1) cands.push(el);
  });
  for (const el of cands) {
    const prev = el.style.display;
    el.style.display = 'none';
    const sw = document.documentElement.scrollWidth;
    const bsw = document.body.scrollWidth;
    el.style.display = prev;
    if (sw < base || bsw < base) {
      results.push({
        tag: el.tagName, cls: String(el.className).slice(0,70),
        rectRight: Math.round(el.getBoundingClientRect().right),
        swAfter: sw, bswAfter: bsw,
        pos: getComputedStyle(el).position,
        parent: el.parentElement ? el.parentElement.tagName + '.' + String(el.parentElement.className).slice(0,50) : ''
      });
    }
  }
  return { vw, base, bbase: document.body.scrollWidth, nCand: cands.length, results };
}
"""

def run(url, label):
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.goto(url, wait_until="domcontentloaded")
        pg.wait_for_timeout(3500)
        r = pg.evaluate(JS)
        print(f"=== {label} === vw={r['vw']} docSW={r['base']} bodySW={r['bbase']} cands={r['nCand']}")
        for x in r["results"]:
            print("   CULPRIT", x)
        if not r["results"]:
            print("   aucun element masquant ne reduit le debordement")
        b.close()

if __name__ == "__main__":
    run(BASE + (sys.argv[1] if len(sys.argv) > 1 else "#/annuaire"),
        sys.argv[1] if len(sys.argv) > 1 else "annuaire")
