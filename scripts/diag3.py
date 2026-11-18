"""Diagnostic 3 : localiser précisément la fuite de largeur en mobile."""
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://localhost:5173/"

JS = """() => {
  const vw = document.documentElement.clientWidth;
  const res = { vw, bodySW: document.body.scrollWidth, docSW: document.documentElement.scrollWidth, leaks: [], widest: [] };
  const info = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: (el.className || '').toString().slice(0, 60),
    w: Math.round(el.getBoundingClientRect().width),
    right: Math.round(el.getBoundingClientRect().right),
    sw: el.scrollWidth, cw: el.clientWidth,
    ox: getComputedStyle(el).overflowX
  });
  document.querySelectorAll('*').forEach(el => {
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && s.overflowX === 'visible') res.leaks.push(info(el));
  });
  const all = [...document.querySelectorAll('*')].map(el => ({ el, r: el.getBoundingClientRect() }))
    .sort((a, b) => b.r.right - a.r.right).slice(0, 8)
    .map(x => info(x.el));
  res.widest = all;
  return res;
}"""

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        for view in ["annuaire", "presentation", "defis", "clubs"]:
            pg.goto(f"{BASE}#/{view}", wait_until="domcontentloaded")
            pg.wait_for_load_state("networkidle")
            pg.wait_for_selector("h1")
            pg.wait_for_timeout(700)
            r = pg.evaluate(JS)
            print(f"\n=== {view} === vw={r['vw']} bodySW={r['bodySW']} docSW={r['docSW']}")
            print("  fuites (overflow visible dont scrollWidth > clientWidth):")
            for x in r["leaks"][:6]:
                print("   ", x)
            print("  éléments les plus larges:")
            for x in r["widest"][:5]:
                print("   ", x)
        b.close()

if __name__ == "__main__":
    main()
