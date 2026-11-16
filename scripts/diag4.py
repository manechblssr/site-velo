"""Diag4 : element qui deborde reellement (sans ancetre clip)."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/"

JS = r"""
() => {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => {
    let n = el.parentElement;
    while (n) {
      const s = getComputedStyle(n);
      if (['auto','scroll','hidden','clip'].includes(s.overflowX)) return true;
      n = n.parentElement;
    }
    return false;
  };
  const out = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    if (r.right > vw + 1 && !clipped(el)) {
      out.push({
        tag: el.tagName, cls: String(el.className).slice(0, 60),
        w: Math.round(r.width), right: Math.round(r.right),
        parent: el.parentElement ? el.parentElement.tagName + '.' + String(el.parentElement.className).slice(0,40) : ''
      });
    }
  });
  const ts = document.querySelector('.table-scroll');
  const info = ts ? {
    w: Math.round(ts.getBoundingClientRect().width),
    sw: ts.scrollWidth, cw: ts.clientWidth,
    ox: getComputedStyle(ts).overflowX, oy: getComputedStyle(ts).overflowY,
    display: getComputedStyle(ts).display
  } : null;
  return { vw, bodySW: document.body.scrollWidth, docSW: document.documentElement.scrollWidth,
           nLeak: out.length, leaks: out.slice(0, 12), tableScroll: info };
}
"""

def run(url, label):
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.goto(url, wait_until="domcontentloaded")
        pg.wait_for_timeout(3500)
        r = pg.evaluate(JS)
        print(f"=== {label} === vw={r['vw']} bodySW={r['bodySW']} docSW={r['docSW']} nLeak={r['nLeak']}")
        print("  table-scroll:", r["tableScroll"])
        for x in r["leaks"]:
            print("   LEAK", x)
        b.close()

if __name__ == "__main__":
    run(BASE + (sys.argv[1] if len(sys.argv) > 1 else "#/annuaire"),
        sys.argv[1] if len(sys.argv) > 1 else "annuaire")
