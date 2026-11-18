"""Diagnostic ciblé : débordement mobile, tuiles hors-ligne, comptage clubs."""
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import json  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://localhost:5173/"

def main():
    data_dir = Path(__file__).resolve().parent.parent / "public" / "data"
    clubs = json.loads((data_dir / "clubs.json").read_text(encoding="utf-8"))
    index = json.loads((data_dir / "index.json").read_text(encoding="utf-8"))
    print(f"clubs.json rows={len(clubs['rows'])}  index.meta={index['meta']}")

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)

        # tuiles : état réseau du navigateur
        ctx = b.new_context(viewport={"width": 1440, "height": 960})
        pg = ctx.new_page()
        pg.goto(BASE + "#/carte", wait_until="domcontentloaded")
        pg.wait_for_load_state("networkidle")
        print("navigator.onLine =", pg.evaluate("navigator.onLine"))

        # débordement mobile
        ctx2 = b.new_context(viewport={"width": 390, "height": 844})
        pg2 = ctx2.new_page()
        pg2.goto(BASE + "#/annuaire", wait_until="domcontentloaded")
        pg2.wait_for_load_state("networkidle")
        pg2.wait_for_selector("h1")
        pg2.wait_for_timeout(800)
        culprits = pg2.evaluate(
            """() => {
              const vw = document.documentElement.clientWidth;
              const out = [];
              document.querySelectorAll('*').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.right > vw + 1 || r.width > vw + 1) {
                  out.push({
                    tag: el.tagName.toLowerCase(),
                    cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().slice(0,70),
                    w: Math.round(r.width), right: Math.round(r.right)
                  });
                }
              });
              return out.slice(0, 25);
            }"""
        )
        print("scrollWidth-vw =", pg2.evaluate(
            "document.documentElement.scrollWidth - document.documentElement.clientWidth"))
        for c in culprits:
            print("  overflow:", c)

        b.close()

if __name__ == "__main__":
    main()
