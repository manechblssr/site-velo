"""Captures d'écran par vue, avec marqueur de vue vérifié avant déclenchement.

Usage : python scripts/shots.py [--mobile]
Écrit rapport/screens/vues/<vue>-<format>.png et imprime le h1 + marqueur vus.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173/"
OUT = Path(__file__).resolve().parent.parent / "rapport" / "screens" / "vues"

# vue → (fragment, marqueur CSS attendu, fragment de h1 attendu)
VUES = [
    ("presentation", "#/presentation", ".hero, .en-bref, main", "Les Flèches de France"),
    ("carte", "#/carte", ".map-canvas", "La carte des 20 Flèches"),
    ("annuaire", "#/annuaire", "table.table-app--lite", "Palmarès individuel"),
    ("defis", "#/defis", "table.table-app, .tabs, main", "Les défis"),
    ("clubs", "#/clubs", "table.table-app, main", "Palmarès club"),
]

VIEWPORTS = [
    ("desktop", {"width": 1440, "height": 960}),
    ("mobile", {"width": 390, "height": 844}),
]


def run(only_mobile=False):
    OUT.mkdir(parents=True, exist_ok=True)
    erreurs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for nom_vp, vp in VIEWPORTS:
            if only_mobile and nom_vp != "mobile":
                continue
            ctx = b.new_context(viewport=vp)
            pg = ctx.new_page()
            for vue, frag, marqueur, h1_attendu in VUES:
                # recharge complète : pas de navigation par simple changement de hash
                pg.goto(f"{BASE}?v={vue}&vp={nom_vp}{frag}", wait_until="domcontentloaded")
                pg.wait_for_selector(marqueur, timeout=15000)
                pg.wait_for_selector(f"h1:has-text('{h1_attendu}')", timeout=15000)
                pg.wait_for_timeout(1200)
                h1 = pg.locator("h1").first.inner_text().replace("\n", " ")[:70]
                vu = pg.evaluate(
                    "() => ({ v: location.hash, largeur: document.documentElement.scrollWidth,"
                    " vw: document.documentElement.clientWidth })"
                )
                deborde = vu["largeur"] > vu["vw"] + 1
                if deborde:
                    erreurs.append(f"[{nom_vp}/{vue}] debordement {vu['largeur']} > {vu['vw']}")
                pg.screenshot(path=str(OUT / f"{vue}-{nom_vp}.png"), full_page=True)
                print(f"  {nom_vp:8} {vue:13} h1={h1!r} deborde={deborde}")
                if h1_attendu not in h1:
                    erreurs.append(f"[{nom_vp}/{vue}] h1 inattendu: {h1}")
            ctx.close()
        b.close()
    print("\nERREURS:" if erreurs else "\nAucune erreur de vue.")
    for e in erreurs:
        print(" !", e)
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(run(only_mobile="--mobile" in sys.argv))
