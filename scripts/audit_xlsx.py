# -*- coding: utf-8 -*-
"""
Audit programmatique de « Tableau de Bord Flèches.xlsx » (Audax Club Parisien — Flèches de France).

Produit un rapport détaillé (stdout + rapport/audit_xlsx.txt) :
  1. Inventaire complet du classeur (onglets, dimensions, lignes d'en-tête, formules)
  2. Journal détaillé des homologations (feuille DATA, 46 colonnes) + décodage des
     colonnes « sans en-tête » (20, 21, 31-34, 45, 46) via en-têtes et formules Excel
  3. Autres tables / onglets (récapitulatif participants, « Les 20 flèches », clubs)
  4. Assets web et fichiers locaux

Usage :  python scripts/audit_xlsx.py
"""
import os
import sys
import io
import json
import datetime as dt

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "Tableau de Bord Flèches.xlsx")
OUT_DIR = os.path.join(ROOT, "rapport")

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

LINES = []


def log(s=""):
    LINES.append(s)
    print(s)


def col_letter(n):
    return openpyxl.utils.get_column_letter(n)


def fmt(v):
    if v is None:
        return ""
    if isinstance(v, (dt.datetime, dt.date)):
        return v.isoformat()[:10]
    if isinstance(v, float):
        if abs(v - round(v)) < 1e-9:
            return str(int(round(v)))
        return ("%.6g" % v)
    return str(v)


# ---------------------------------------------------------------- 1. INVENTAIRE
def inventory(wbf, wbv):
    log("=" * 100)
    log("1. INVENTAIRE DU CLASSEUR")
    log("=" * 100)
    log(f"Fichier : {XLSX}  ({os.path.getsize(XLSX):,} octets)")
    log(f"Onglets : {len(wbf.sheetnames)}")
    log("")
    hdr = f"{'Onglet':<24}{'lignes':>8}{'colonnes':>10}{'formules':>10}  première ligne non vide"
    log(hdr)
    log("-" * 100)
    for name in wbf.sheetnames:
        wsf, wsv = wbf[name], wbv[name]
        nform = 0
        first_nonempty = None
        for row in wsf.iter_rows(min_row=1, max_row=min(wsf.max_row, 30)):
            vals = [c.value for c in row]
            if any(v not in (None, "") for v in vals) and first_nonempty is None:
                first_nonempty = row[0].row
            for c in row:
                if isinstance(c.value, str) and c.value.startswith("="):
                    nform += 1
        log(f"{name:<24}{wsf.max_row:>8}{wsf.max_column:>10}{nform:>10}  ligne {first_nonempty}")
    log("")
    log("Note : le comptage de formules ne porte que sur les 30 premières lignes de chaque onglet.")
    log("")


# ---------------------------------------------------------------- 2. JOURNAL DATA
MYSTERY = [20, 21, 31, 32, 33, 34, 45, 46]


def audit_data(wbf, wbv):
    log("=" * 100)
    log("2. JOURNAL DÉTAILLÉ DES HOMOLOGATIONS — onglet « DATA » (46 colonnes)")
    log("=" * 100)
    wsf, wsv = wbf["DATA"], wbv["DATA"]

    # en-têtes réels : on cherche la première ligne dont >= 80 % des cellules sont du texte
    header_row = None
    for r in range(1, 8):
        vals = [wsv.cell(row=r, column=c).value for c in range(1, 47)]
        texts = sum(1 for v in vals if isinstance(v, str) and v.strip())
        if texts >= 30:
            header_row = r
            break
    if header_row is None:
        header_row = 1
    log(f"En-têtes trouvés ligne {header_row} ; données à partir de la ligne {header_row + 1}.")
    log("")
    log(f"{'Col':>4}  {'Lettre':<7}{'En-tête / décodage':<52}{'Exemple (1re ligne data)':<40}")
    log("-" * 100)
    headers = {}
    for c in range(1, 47):
        h = wsv.cell(row=header_row, column=c).value
        ex = wsv.cell(row=header_row + 1, column=c).value
        headers[c] = fmt(h)
        log(f"{c:>4}  {col_letter(c):<7}{fmt(h)[:50]:<52}{fmt(ex)[:38]:<40}")
    log("")

    # formules : première ligne de données (et éventuellement la 2e) pour chaque colonne
    log("Formules Excel de la première ligne de données (feuille FORMULES) :")
    log("-" * 100)
    dr = header_row + 1
    for c in range(1, 47):
        f = wsf.cell(row=dr, column=c).value
        if isinstance(f, str) and f.startswith("="):
            log(f"  {col_letter(c)}{dr} (col {c}, « {headers[c]} ») = {f}")
    log("")

    # décodage spécialisé des colonnes mystères
    log("DÉCODAGE DES COLONNES INITIALEMENT SANS EN-TÊTE UTILE (20, 21, 31-34, 45, 46)")
    log("-" * 100)
    sample_rows = list(range(dr, min(dr + 6, wsv.max_row + 1)))
    for c in MYSTERY:
        log(f"Col {c} ({col_letter(c)}) — en-tête : « {headers[c]} »")
        fv = wsf.cell(row=dr, column=c).value
        log(f"   formule ligne {dr} : {fv if isinstance(fv, str) and fv.startswith('=') else '(valeur littérale) ' + fmt(fv)}")
        # formule sur 3 lignes supplémentaires pour voir la régularité
        for r in sample_rows[1:4]:
            ff = wsf.cell(row=r, column=c).value
            vv = wsv.cell(row=r, column=c).value
            log(f"   ligne {r}: formule={fmt(ff)[:70]:<70} valeur={fmt(vv)}")
        # distribution des valeurs (toutes lignes pour 20/21, 2000 sinon)
        from collections import Counter
        cnt = Counter()
        stop = wsv.max_row + 1 if c in (20, 21) else min(dr + 2000, wsv.max_row + 1)
        for r in range(dr, stop):
            cnt[fmt(wsv.cell(row=r, column=c).value)] += 1
        scope = "toutes lignes" if c in (20, 21) else "2000 lignes"
        top = ", ".join(f"{k!r}×{v}" for k, v in cnt.most_common(12))
        log(f"   top valeurs ({scope}) : {top}")
        log("")

    # statistiques clés du journal
    from collections import Counter
    log("STATISTIQUES DU JOURNAL")
    log("-" * 100)
    nrows = wsv.max_row - header_row
    log(f"Lignes de données : {nrows} (lignes {header_row+1} → {wsv.max_row})")
    formule = Counter()
    fede = Counter()
    annees = Counter()
    fleches = Counter()
    for r in range(dr, wsv.max_row + 1):
        formule[fmt(wsv.cell(row=r, column=7).value)] += 1
        fede[fmt(wsv.cell(row=r, column=19).value)] += 1
        annees[fmt(wsv.cell(row=r, column=3).value)] += 1
        fleches[fmt(wsv.cell(row=r, column=5).value)] += 1
    log(f"Col 7 Formule       : {dict(formule.most_common())}")
    log(f"Col 19 Fédération   : {dict(fede.most_common())}")
    log(f"Col 3 Millésime     : {dict(sorted(annees.items()))}")
    log(f"Col 5 Flèche ({len(fleches)} distinctes) : {dict(fleches.most_common())}")
    log("")


# ---------------------------------------------------------------- 3. AUTRES ONGLETS
def audit_other(wbv):
    log("=" * 100)
    log("3. AUTRES TABLES / ONGLETS")
    log("=" * 100)
    for name in wbv.sheetnames:
        if name == "DATA":
            continue
        ws = wbv[name]
        log("-" * 100)
        log(f"ONGLET « {name} » — {ws.max_row} lignes × {ws.max_column} colonnes")
        log("-" * 100)
        maxr = min(ws.max_row, 14)
        for r in range(1, maxr + 1):
            vals = [fmt(ws.cell(row=r, column=c).value) for c in range(1, ws.max_column + 1)]
            while vals and vals[-1] == "":
                vals.pop()
            if vals:
                log(f"  L{r:>3} | " + " | ".join(v[:24] for v in vals))
        if ws.max_row > maxr:
            log(f"  … ({ws.max_row - maxr} lignes supplémentaires)")
        log("")


def audit_targeted(wbv):
    """Extraction ciblée demandée par les consignes."""
    log("=" * 100)
    log("3bis. EXTRAIT CIBLÉ : récapitulatif participants, « Les 20 flèches », clubs")
    log("=" * 100)

    # Participants (récapitulatif)
    if "Participants" in wbv.sheetnames:
        ws = wbv["Participants"]
        log("\n--- Onglet « Participants » (table récapitulatif) : 12 premières lignes ---")
        for r in range(1, 13):
            vals = [fmt(ws.cell(row=r, column=c).value) for c in range(1, ws.max_column + 1)]
            while vals and vals[-1] == "":
                vals.pop()
            log(f"  L{r:>3} | " + " | ".join(v[:26] for v in vals))

    # « Les 20 flèches » : recherché dans tous les onglets
    log("\n--- Recherche de la section « Les 20 flèches » (Femmes / Hommes) ---")
    found = False
    for name in wbv.sheetnames:
        ws = wbv[name]
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=ws.max_column, values_only=True):
            for v in row:
                if isinstance(v, str) and "flèche" in v.lower() and "20" in v:
                    log(f"  « {name} » : {v!r}")
                    found = True
    if not found:
        log("  (aucune cellule littérale « 20 flèches » — inspection des onglets thématiques)")

    for name in ("2 Palmares", "3 Flèches groupées", "1 Tableau de Bord"):
        if name not in wbv.sheetnames:
            continue
        ws = wbv[name]
        log(f"\n--- Onglet « {name} » : contenu complet (max {min(ws.max_row, 60)} lignes) ---")
        for r in range(1, min(ws.max_row, 60) + 1):
            vals = [fmt(ws.cell(row=r, column=c).value) for c in range(1, ws.max_column + 1)]
            while vals and vals[-1] == "":
                vals.pop()
            if vals:
                log(f"  L{r:>3} | " + " | ".join(v[:22] for v in vals))

    # Clubs : blocs juxtaposés
    if "Clubs" in wbv.sheetnames:
        ws = wbv["Clubs"]
        log(f"\n--- Onglet « Clubs » : 25 premières lignes (blocs juxtaposés) ---")
        for r in range(1, 26):
            vals = [fmt(ws.cell(row=r, column=c).value) for c in range(1, ws.max_column + 1)]
            while vals and vals[-1] == "":
                vals.pop()
            if vals:
                log(f"  L{r:>3} | " + " | ".join(v[:20] for v in vals))
    log("")


# ---------------------------------------------------------------- 4. ASSETS LOCAUX
def audit_assets():
    log("=" * 100)
    log("4. ASSETS WEB ET FICHIERS LOCAUX")
    log("=" * 100)
    exts = {".html", ".htm", ".css", ".gpx", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".zip", ".json"}
    skip_dirs = {".opencode", "_skills", "node_modules", ".git", "rapport", "scripts", "public"}
    found = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in exts:
                p = os.path.join(dirpath, fn)
                found.append((os.path.relpath(p, ROOT), os.path.getsize(p)))
    if found:
        for rel, size in sorted(found):
            log(f"  {rel}  ({size:,} octets)")
    else:
        log("  Aucune sauvegarde locale HTML/CSS/GPX/PDF/image hors compétences/.opencode.")
    log("")
    log("Fichiers .url présents :")
    for fn in os.listdir(ROOT):
        if fn.endswith(".url"):
            with open(os.path.join(ROOT, fn), encoding="utf-8", errors="replace") as fh:
                content = fh.read()
            url = next((l.split("=", 1)[1].strip() for l in content.splitlines() if l.startswith("URL=")), "?")
            log(f"  {fn} → {url}")
    log("")


def main():
    part = sys.argv[1] if len(sys.argv) > 1 else "all"
    log("AUDIT XLSX — Tableau de Bord Flèches.xlsx — Audax Club Parisien")
    log(f"Généré le {dt.datetime.now().isoformat(timespec='seconds')}  (partie : {part})")
    log("")
    wbf = openpyxl.load_workbook(XLSX, data_only=False)
    wbv = openpyxl.load_workbook(XLSX, data_only=True)

    def flush():
        os.makedirs(OUT_DIR, exist_ok=True)
        with open(os.path.join(OUT_DIR, "audit_xlsx.txt"), "a", encoding="utf-8") as fh:
            fh.write("\n".join(LINES) + "\n")
        del LINES[:]

    if part in ("all", "inv"):
        inventory(wbf, wbv); flush()
    if part in ("all", "data"):
        audit_data(wbf, wbv); flush()
    if part in ("all", "other"):
        audit_other(wbv); flush()
    if part in ("all", "targeted"):
        audit_targeted(wbv); flush()
    if part in ("all", "assets"):
        audit_assets(); flush()
    print(f"\nRapport écrit : {os.path.join(OUT_DIR, 'audit_xlsx.txt')}")


if __name__ == "__main__":
    main()
