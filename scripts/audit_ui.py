# -*- coding: utf-8 -*-
"""Audit fonctionnel du site local « Flèches de France ».

Lance chaque vue, capte les erreurs console / réseau, exerce les interactions
principales et produit des captures d'écran dans rapport/screens/.

Usage :
    python scripts/with_server.py --server "npm run dev" --port 5173 -- \
        python scripts/audit_ui.py
"""
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://localhost:5173/"
OUT = Path(__file__).resolve().parent.parent / "rapport" / "screens"
OUT.mkdir(parents=True, exist_ok=True)

VUES = ["presentation", "carte", "annuaire", "defis", "clubs"]

notes = []      # observations non bloquantes (titres, compteurs, états)
problems = []   # défauts de l'application : code, ressources locales, mise en page
env = []        # réseau externe : CDN injoignable, requête annulée par la navigation


def est_local(url):
    return url.startswith(BASE.rstrip("/"))


def watch(page, tag):
    # Un message du type « Failed to load resource: net::… » est émis par le
    # navigateur pour une ressource EXTERNE (ici : DNS de tile.openfreemap.org
    # injoignable) — ce n'est pas une erreur du code applicatif.
    page.on(
        "console",
        lambda m: (env if m.text.startswith("Failed to load resource: net::") else problems).append(
            f"[{tag}] console.{m.type}: {m.text}"
        )
        if m.type in ("error", "warning")
        else None,
    )
    page.on("pageerror", lambda e: problems.append(f"[{tag}] pageerror: {e}"))
    page.on(
        "requestfailed",
        lambda r: (env if not est_local(r.url) else problems).append(
            f"[{tag}] requestfailed: {r.url} :: {r.failure}"
        ),
    )
    page.on(
        "response",
        lambda r: problems.append(f"[{tag}] HTTP {r.status} {r.url}")
        if r.status >= 400 and est_local(r.url)
        else None,
    )


def goto(page, route):
    page.goto(f"{BASE}#/{route}", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("h1", timeout=15000)
    page.wait_for_timeout(400)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 960})
        page = ctx.new_page()
        watch(page, "boot")

        # ---------------------------------------------------------- accueil
        goto(page, "presentation")
        notes.append(f"title={page.title()}")
        for v in VUES:
            goto(page, v)
            page.screenshot(path=str(OUT / f"{v}-desktop.png"), full_page=True)
            notes.append(f"[{v}] h1={page.locator('h1').first.inner_text()[:80]}")

        # --------------------------------------------------------- annuaire
        goto(page, "annuaire")
        rows = page.locator("table.table-app--lite tbody tr")
        notes.append(f"[annuaire] lignes page1={rows.count()}")
        before = page.locator(".result-line__count").inner_text()

        page.fill("#an-q", "luchon")
        page.wait_for_timeout(350)
        after = page.locator(".result-line__count").inner_text()
        notes.append(f"[annuaire] recherche 'luchon': {before!r} -> {after!r}")
        if before == after:
            problems.append("[annuaire] la recherche texte ne change pas les résultats")
        page.fill("#an-q", "")
        page.wait_for_timeout(300)

        # accents
        page.fill("#an-q", "école")
        page.wait_for_timeout(300)
        notes.append(
            f"[annuaire] recherche accentuée 'école' -> "
            f"{page.locator('.result-line__count').inner_text()}"
        )
        page.fill("#an-q", "")
        page.wait_for_timeout(250)

        # filtres avancés
        page.click("button:has-text('Filtres avancés')")
        page.wait_for_timeout(250)
        if page.locator("#an-avances").count() == 0:
            problems.append("[annuaire] panneau « Filtres avancés » ne s'ouvre pas")
        page.select_option("#an-annee", "2024")
        page.wait_for_timeout(350)
        notes.append(
            f"[annuaire] filtre 2024 -> {page.locator('.result-line__count').inner_text()}"
        )
        page.select_option("#an-annee", "")
        page.wait_for_timeout(250)

        # pagination
        page.click("button:has-text('Suivant')")
        page.wait_for_timeout(300)
        notes.append(
            f"[annuaire] page2 -> {page.locator('.pager .muted').inner_text()}"
        )

        # fiche palmarès
        page.locator("table.table-app--lite tbody tr .row-link").first.click()
        page.wait_for_timeout(400)
        if page.locator(".drawer").count() == 0:
            problems.append("[annuaire] la fiche palmarès ne s'ouvre pas")
        else:
            cells = page.locator(".drawer .grid-20 .cell-20").count()
            hist = page.locator(".drawer .table-app tbody tr").count()
            notes.append(f"[annuaire] fiche: grille20={cells} lignes palmarès={hist}")
            if cells != 20:
                problems.append(f"[annuaire] grille des 20 flèches = {cells} cellules")
            page.screenshot(path=str(OUT / "fiche-palmares.png"))
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            if page.locator(".drawer").count() != 0:
                problems.append("[annuaire] Échap ne referme pas la fiche")

        # ------------------------------------------------------------- carte
        goto(page, "carte")
        page.wait_for_timeout(2500)
        panes = page.locator(".map-canvas .leaflet-pane").count()
        markers = page.locator(".map-canvas path.leaflet-interactive").count()
        labels = page.locator(".map-canvas .map-label__txt").count()
        notes.append(f"[carte] panes={panes} paths={markers} labels={labels}")
        if panes == 0:
            problems.append("[carte] Leaflet non monté (aucun panneau)")
        if labels < 15:
            problems.append(f"[carte] seulement {labels} étiquettes de villes affichées")

        # popup au clic sur une ville d'arrivée
        opened = False
        for i in range(min(markers, 40)):
            el = page.locator(".map-canvas path.leaflet-interactive").nth(i)
            try:
                el.click(timeout=1500)
                page.wait_for_timeout(350)
                if page.locator(".leaflet-popup .pop__titre").count():
                    opened = True
                    titre = page.locator(".leaflet-popup .pop__titre").inner_text()
                    notes.append(f"[carte] popup ouverte: {titre}")
                    if page.locator(".leaflet-popup .pop__btn").count() == 0:
                        problems.append("[carte] popup sans bouton « Voir les lauréats »")
                    break
            except Exception:
                continue
        if not opened:
            problems.append("[carte] aucune popup ne s'ouvre au clic")

        # calques
        page.click("button:has-text('Tracés')")
        page.wait_for_timeout(300)
        page.click("button:has-text('Tracés')")
        page.wait_for_timeout(300)

        # liste latérale + recentrage
        items = page.locator(".map-list .map-item")
        notes.append(f"[carte] liste latérale={items.count()}")
        if items.count() < 15:
            problems.append(f"[carte] liste latérale incomplète ({items.count()} flèches)")
        if page.locator(".map-recentrer").count() == 0:
            problems.append("[carte] bouton « Recentrer » absent")
        else:
            page.click(".map-recentrer")
            page.wait_for_timeout(500)
        items.first.click()
        page.wait_for_timeout(1200)
        if page.locator(".leaflet-popup .pop__titre").count() == 0:
            problems.append("[carte] le clic dans la liste n'ouvre pas la popup")
        else:
            notes.append(
                f"[carte] popup via la liste: "
                f"{page.locator('.leaflet-popup .pop__titre').inner_text()}"
            )
            if page.locator(".map-item.is-active").count() == 0:
                problems.append("[carte] la flèche ouverte n'est pas signalée dans la liste")
            if page.locator(".leaflet-popup .pop__grid span").count() < 2:
                problems.append("[carte] popup sans bloc de statistiques")
            if page.locator(".leaflet-popup .pop__liens a").count() < 2:
                problems.append("[carte] popup sans liens OpenRunner / feuille de route")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # synchronisation participant
        page.fill("#map-q", "lannes")
        page.wait_for_timeout(500)
        res = page.locator(".ac-results button")
        notes.append(f"[carte] résultats participant={res.count()}")
        if res.count() == 0:
            problems.append("[carte] la recherche participant ne propose aucun résultat")
        else:
            res.first.click()
            page.wait_for_timeout(700)
            notes.append(f"[carte] sélection: {page.locator('.civ').inner_text()[:90]}")
            page.screenshot(path=str(OUT / "carte-participant.png"))
        page.wait_for_timeout(800)

        # ------------------------------------------------------------- défis
        goto(page, "defis")
        for tab in ["Par formule", "Le pionnier", "La Complète", "La Complète express", "Le combiné"]:
            page.click(f'[role="tab"]:has-text("{tab}")')
            page.wait_for_timeout(350)
            panel = page.locator('[role="tabpanel"]')
            if panel.locator("*").count() < 3:
                problems.append(f"[defis] onglet « {tab} » vide")
            notes.append(f"[defis] onglet {tab}: {panel.inner_text()[:60]!r}")
        page.screenshot(path=str(OUT / "defis.png"), full_page=True)

        # sélection formule + flèche
        page.click('[role="tab"]:has-text("Par formule")')
        page.wait_for_timeout(300)
        page.select_option("#pf-formule", "O")
        page.wait_for_timeout(400)
        n_or = page.locator(".toolbar__count").inner_text()
        page.select_option("#pf-fleche", "Luchon")
        page.wait_for_timeout(400)
        n_or_luchon = page.locator(".toolbar__count").inner_text()
        notes.append(f"[defis] Or={n_or!r} Or×Luchon={n_or_luchon!r}")
        if n_or == n_or_luchon:
            problems.append("[defis] le filtre flèche n'affine pas la sélection")

        # ------------------------------------------------------------- clubs
        goto(page, "clubs")
        nclubs = page.locator("table.table-app tbody tr").count()
        notes.append(f"[clubs] lignes={nclubs}")
        page.fill("#cl-q", "audax")
        page.wait_for_timeout(350)
        notes.append(
            f"[clubs] recherche 'audax' -> {page.locator('.toolbar__count').inner_text()}"
        )
        page.fill("#cl-q", "")
        page.wait_for_timeout(300)
        page.locator("table.table-app tbody .row-link").first.click()
        page.wait_for_timeout(400)
        if page.locator(".fiche-club").count() == 0:
            problems.append("[clubs] la fiche club ne s'ouvre pas")
        else:
            notes.append(f"[clubs] fiche: {page.locator('.fiche-club h3').first.inner_text()}")
        page.screenshot(path=str(OUT / "clubs-fiche.png"), full_page=True)

        # ------------------------------------------------------- présentation
        goto(page, "presentation")
        lien = page.locator('a[href^="#/carte/"]').first
        if lien.count():
            lien.click()
            page.wait_for_timeout(2500)
            notes.append(f"[presentation] lien flèche -> hash={page.evaluate('location.hash')}")
            if "carte" not in page.evaluate("location.hash"):
                problems.append("[presentation] le lien d'une flèche n'ouvre pas la carte")
            if page.locator(".leaflet-popup .pop__titre").count() == 0:
                notes.append("[presentation] (info) popup carte non ouverte depuis le lien")

        # ------------------------------------- présentation : refonte rond 2
        goto(page, "presentation")

        # invite à défiler dans le vide du hero
        if page.locator(".hero-scroll").count() == 0:
            problems.append("[presentation] invite à défiler absente du hero")
        else:
            page.click(".hero-scroll")
            page.wait_for_timeout(1000)
            y = page.evaluate("window.scrollY")
            notes.append(f"[presentation] « Défiler » -> scrollY={y}")
            if y < 200:
                problems.append(f"[presentation] le bouton « Défiler » ne descend pas ({y}px)")

        # « En bref » : un seul panneau de cinq entrées, sans zoom au survol
        nencarts = page.locator(".en-bref__item").count()
        notes.append(f"[presentation] « En bref » = {nencarts} entrées")
        if nencarts != 5:
            problems.append(f"[presentation] « En bref » = {nencarts} entrées (5 attendues)")
        if page.locator(".encart.lift").count():
            problems.append("[presentation] les anciens encarts zoomables subsistent")

        # défis : les quatre cartes ne sont plus quatre liens
        ncartes = page.locator(".defi-card").count()
        cta = page.locator('.defi-panel a[href="#/defis"]')
        notes.append(f"[presentation] défis: cartes={ncartes} bouton={cta.count()}")
        if ncartes:
            problems.append("[presentation] les 4 cartes de défi sont toujours cliquables")
        if cta.count() != 1:
            problems.append(f"[presentation] {cta.count()} entrées vers les défis (1 attendue)")

        # planificateur superposé (remplace le seul lien Excel)
        page.click("button:has-text('Ouvrir le planificateur')")
        page.wait_for_timeout(600)
        if page.locator(".planif").count() == 0:
            problems.append("[presentation] le planificateur ne s'ouvre pas")
        else:
            kpi = page.locator(".planif .kpi__v").first.inner_text()
            etapes = page.locator(".planif__steps li").count()
            notes.append(f"[presentation] planificateur: délai={kpi!r} repères={etapes}")
            if etapes != 5:
                problems.append(f"[presentation] planificateur : {etapes} repères (5 attendus)")
            page.select_option("#planif-fleche", "NICE")
            page.wait_for_timeout(400)
            kpi2 = page.locator(".planif .kpi__v").first.inner_text()
            notes.append(f"[presentation] planificateur NICE: {kpi2!r}")
            if kpi2 == kpi:
                problems.append("[presentation] changer de flèche ne recalcule pas le délai")
            page.click('.planif__formules .chip:has-text("Bronze")')
            page.wait_for_timeout(300)
            notes.append(
                f"[presentation] planificateur Bronze: "
                f"{page.locator('.planif .kpi__v').first.inner_text()!r}"
            )
            page.screenshot(path=str(OUT / "planificateur.png"))
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            if page.locator(".planif").count() != 0:
                problems.append("[presentation] Échap ne referme pas le planificateur")

        # invite à défiler : elle s'estompe en fondu avec le défilement
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(350)
        op_haut = float(
            page.locator(".hero-scroll").evaluate("el => el.style.opacity || '1'")
        )
        page.evaluate("window.scrollTo(0, 500)")
        page.wait_for_timeout(450)
        op_bas = float(
            page.locator(".hero-scroll").evaluate("el => el.style.opacity || '1'")
        )
        notes.append(f"[presentation] fondu « Défiler »: {op_haut} -> {op_bas}")
        if op_haut < 0.9:
            problems.append(
                f"[presentation] l'invite à défiler est déjà atténuée en haut ({op_haut})"
            )
        if op_bas > 0.1:
            problems.append(
                f"[presentation] l'invite à défiler ne s'efface pas au défilement ({op_bas})"
            )

        # en-tête : plus de titre au-dessus du champ, champ centré
        lab = page.locator(".acp-search label")
        if lab.count():
            bb = lab.bounding_box()
            if bb and (bb["width"] > 4 or bb["height"] > 4):
                problems.append(
                    f"[header] un titre est encore rendu au-dessus de la recherche "
                    f"({bb['width']:.0f}×{bb['height']:.0f}px)"
                )
        b_in = page.locator(".acp-search input").bounding_box()
        b_row = page.locator(".acp-main").bounding_box()
        if b_in and b_row:
            ecart = abs(
                (b_in["y"] + b_in["height"] / 2) - (b_row["y"] + b_row["height"] / 2)
            )
            notes.append(f"[header] écart de centrage de la recherche: {ecart:.1f}px")
            if ecart > 3:
                problems.append(
                    f"[header] le champ de recherche n'est pas centré ({ecart:.1f}px)"
                )

        # référentiel : cliquer la case d'une flèche ouvre la carte avec sa fiche
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(250)
        page.locator(".table--20 tbody tr").nth(2).click()
        page.wait_for_timeout(2400)
        hsh = page.evaluate("location.hash")
        pop = page.locator(".leaflet-popup .pop__titre")
        notes.append(
            f"[presentation] ligne du référentiel -> {hsh} popup="
            f"{pop.inner_text() if pop.count() else 'ABSENTE'}"
        )
        if "/carte/" not in hsh:
            problems.append(
                "[presentation] cliquer une ligne du référentiel n'ouvre pas la carte"
            )
        if pop.count() == 0:
            problems.append(
                "[presentation] la flèche cliquée n'affiche pas sa fiche sur la carte"
            )

        # navigation par hash direct : la page doit remonter en haut (bug rond 1)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(300)
        bas = page.evaluate("window.scrollY")
        page.evaluate("location.hash = '#/annuaire'")
        page.wait_for_timeout(700)
        y = page.evaluate("window.scrollY")
        hashv = page.evaluate("location.hash")
        notes.append(f"[presentation] hash direct depuis {bas}px -> {hashv} scrollY={y}")
        if "annuaire" not in hashv:
            problems.append("[presentation] la navigation par hash direct ne change pas de vue")
        if y != 0:
            problems.append(f"[presentation] navigation par hash direct : la page reste à {y}px")

        # lien d'évitement : il ne doit pas faire changer de vue
        goto(page, "clubs")
        page.locator(".skip-link").focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(400)
        hsh = page.evaluate("location.hash")
        if "clubs" not in hsh:
            problems.append(f"[clubs] le lien d'évitement change de vue ({hsh})")
        if page.locator("main#top").evaluate(
            "el => document.activeElement === el"
        ) is not True:
            notes.append("[clubs] (info) le lien d'évitement n'a pas déplacé le focus sur <main>")

        # ------------------------------------------------------------ mobile
        ctx2 = browser.new_context(viewport={"width": 390, "height": 844})
        page2 = ctx2.new_page()
        watch(page2, "mobile")
        for v in VUES:
            page2.goto(f"{BASE}#/{v}", wait_until="domcontentloaded")
            page2.wait_for_load_state("networkidle")
            page2.wait_for_selector("h1", timeout=15000)
            page2.wait_for_timeout(600)
            page2.screenshot(path=str(OUT / f"{v}-mobile.png"), full_page=True)
            overflow = page2.evaluate(
                "document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            if overflow > 4:
                problems.append(f"[mobile/{v}] débordement horizontal de {overflow}px")

        browser.close()

    report = {"notes": notes, "problems": problems, "env": env}
    Path(OUT.parent / "audit_ui.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("\n=== NOTES ===")
    for n in notes:
        print(" -", n)
    print("\n=== PROBLEMES (application) ===")
    if not problems:
        print(" (aucun)")
    for x in problems:
        print(" !", x)
    print("\n=== RESEAU EXTERNE (environnement) ===")
    if not env:
        print(" (aucun)")
    for x in env:
        print(" ~", x)
    print(
        f"\nBilan : {len(problems)} defaut(s) application, "
        f"{len(env)} requete(s) externe en echec."
    )
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
