# -*- coding: utf-8 -*-
"""Diagnostic 2 : origine du débordement mobile + bruit console des tuiles."""
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://localhost:5173/"

CLIPPED = ("auto", "scroll", "hidden", "clip")


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)

        # --- 1. d'où vient le débordement horizontal ? --------------------
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        pg.goto(BASE + "#/annuaire", wait_until="domcontentloaded")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_selector("h1")
        pg.wait_for_timeout(800)
        out = pg.evaluate(
            """() => {
              const vw = document.documentElement.clientWidth;
              const res = [];
              const clipped = (el) => {
                for (let a = el.parentElement; a; a = a.parentElement) {
                  const s = getComputedStyle(a);
                  if (['auto','scroll','hidden','clip'].includes(s.overflowX)) return true;
                }
                return false;
              };
              document.querySelectorAll('*').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.right > vw + 1 && !clipped(el)) {
                  res.push({
                    tag: el.tagName.toLowerCase(),
                    cls: (el.className || '').toString().slice(0, 60),
                    w: Math.round(r.width), right: Math.round(r.right),
                    parent: el.parentElement ? el.parentElement.tagName.toLowerCase() + '.' + (el.parentElement.className||'').toString().slice(0,40) : ''
                  });
                }
              });
              return res.slice(0, 20);
            }"""
        )
        print("=== éléments non-clippés qui débordent (mobile 390) ===")
        for c in out:
            print("  ", c)
        if not out:
            print("   (aucun — le débordement vient d'un conteneur à overflow visible)")
        print("  body.scrollWidth =", pg.evaluate("document.body.scrollWidth"),
              " doc.scrollWidth =", pg.evaluate("document.documentElement.scrollWidth"),
              " vw =", pg.evaluate("document.documentElement.clientWidth"))
        ctx.close()

        # --- 2. une Image / fetch en échec logue-t-il en console ? ---------
        ctx2 = b.new_context(viewport={"width": 800, "height": 600})
        pg2 = ctx2.new_page()
        logs = []
        pg2.on("console", lambda m: logs.append(f"{m.type}: {m.text[:110]}"))
        pg2.goto("about:blank")
        print("\n=== test Image() sur hôte inexistant ===")
        pg2.evaluate(
            """() => new Promise(res => {
                 const i = new Image();
                 i.onload = () => res('load');
                 i.onerror = () => res('error');
                 i.src = 'https://nonexistent-host-xyz.invalid/1/2/3.png';
                 setTimeout(() => res('timeout'), 4000);
               })"""
        )
        pg2.wait_for_timeout(500)
        print("  logs:", logs)

        logs.clear()
        print("=== test fetch() no-cors sur hôte inexistant ===")
        pg2.evaluate(
            """() => fetch('https://nonexistent-host-xyz.invalid/x', {mode:'no-cors'})
                 .then(() => 'ok').catch(e => 'ko:' + e.name)"""
        )
        pg2.wait_for_timeout(1500)
        print("  logs:", logs)

        b.close()


if __name__ == "__main__":
    main()
