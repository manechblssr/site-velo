"""Probe : opacite effective de CHAQUE img (element + ascendants)."""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/"

JS = r"""
() => {
  const out = [];
  const eff = (el) => {
    let o = 1, n = el;
    while (n && n !== document.documentElement) {
      o *= parseFloat(getComputedStyle(n).opacity || '1');
      n = n.parentElement;
    }
    return o;
  };
  for (const el of document.querySelectorAll('img')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out.push({
      src: (el.currentSrc || el.src || '').slice(0, 90),
      cls: (el.className || '').toString().slice(0, 40),
      op: cs.opacity, eff: Number(eff(el).toFixed(3)),
      vis: cs.visibility,
      w: Math.round(r.width), h: Math.round(r.height),
      nat: el.naturalWidth,
      parent: `${el.parentElement.tagName}.${(el.parentElement.className||'').toString().split(' ')[0]}`,
    });
  }
  return out;
}
"""

def run():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 960})
        pg.goto(f"{BASE}#/carte", wait_until="domcontentloaded")
        pg.wait_for_timeout(3500)
        res = pg.evaluate(JS)
        print(f"=== {len(res)} img au total ===")
        for r in sorted(res, key=lambda x: x["eff"]):
            if r["eff"] < 1 or r["op"] != "1":
                print("  !", r)
        print("--- 5 premieres (par opacite croissante) ---")
        for r in sorted(res, key=lambda x: x["eff"])[:5]:
            print("   ", r)
        b.close()

if __name__ == "__main__":
    run()
