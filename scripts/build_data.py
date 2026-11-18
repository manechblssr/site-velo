"""
build_data.py — parse « Tableau de Bord Flèches.xlsx » et génère les JSON normalisés
du site local « Flèches de France » (Audax Club Parisien) dans public/data/.

Usage :
    python scripts/build_data.py            # génère public/data/*.json
    python scripts/build_data.py --verify   # affiche le bilan volumétrique

Colonnes du journal DATA (46) décodées — voir rapport/audit_xlsx.txt :
  1 clef | 2 Nom Prénom | 3 Saison | 4 N° homologation | 5 Epreuve | 6 Date réalisation
  7 Formule (O/A/B) | 8 Nom | 9 Prénom | 10 Date de naissance | 11 Sexe | 12 Téléphone
  13 Adresse | 14 Ville | 15 Code postal | 16 Pays | 17 CodeACP | 18 Club | 19 Fédération
  20 Médaille (0 pas de médaille / 1 retrait / 2 envoi / vide) | 21 Groupée ('x' si flèche groupée)
  22 Age (à aujourd'hui) | 23 Destination | 24 km | 25 D+ | 26 TH | 27 1/TH | 28 THA | 29 1/THA
  30 Date max | 31 Est>2023 (0/1) | 32 >2023 (cumul participant) | 33 Est>2024 | 34 >2024
  35 Cat km (a/b/c) | 36 Cat D+ (a/b) | 37 THF | 38 1/THF | 39 THUP (flèches distinctes)
  40 année numérique | 41 age au moment de la flèche | 42 catégorie d'âge (a/b/c/d/e)
  43 date min | 44 Première (1/N) | 45 OPF (1/N par formule+flèche) | 46 Departement
"""
import os
import sys
import io
import json
import math
import datetime as dt
from collections import Counter, defaultdict

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "Tableau de Bord Flèches.xlsx")
OUT = os.path.join(ROOT, "public", "data")

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

TODAY = dt.date(2026, 11, 12)          # date de référence des âges (colonne V du classeur)
BUILD_DATE = dt.date(2026, 11, 14)

# Référentiel officiel 2026 (site ACP) — CONSIGNES.md, section ÉTAPE 2.C
OFFICIAL = [
    # nom, km, d+, or, argent, bronze, départ décalé: (commune, km, d+, or, argent, bronze), openrunner, pdf
    ("DIEPPE", 192, 1025, "7h40", "9h35", "58h",
     ("Cormeilles", 177, 1005, "7h05", "8h50", "53h"),
     "https://www.openrunner.com/route-details/16059614",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/20-FF_Paris_Dieppe-1.pdf"),
    ("CHARLEVILLE", 245, 2000, "10h40", "13h35", "73h",
     ("Tremblay", 230, None, "10h", "12h45", "69h"),
     "https://www.openrunner.com/route-details/18001619",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/03-FF_iti_Paris-Charleville.pdf"),
    ("LE HAVRE", 256, 1782, "11h05", "14h10", "76h",
     ("La Frette", 240, 1657, "10h20", "13h30", "72h"),
     "https://www.openrunner.com/route-details/19863360",
     "https://www.audax-club-parisien.com/wp-content/uploads/2025/01/19-FF_iti_Paris-Le-Havre_2025.pdf"),
    ("LILLE", 275, 1778, "12h", "15h15", "82h",
     ("Villiers-le-Bel", 260, None, "11h15", "14h25", "78h"),
     "https://www.openrunner.com/route-details/18054639",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/02_FF_iti_Paris-Lille.pdf"),
    ("CALAIS", 324, 2775, "14h", "18h", "97h",
     ("Eaubonne", 309, None, "13h20", "17h10", "96h"),
     "https://www.openrunner.com/route-details/23096359",
     "https://www.audax-club-parisien.com/wp-content/uploads/2026/04/Paris-Calais-2026.pdf"),
    ("MONT ST MICHEL", 326, 3101, "15h15", "19h40", "98h",
     ("Noisy-le-Roi", 309, None, "14h", "18h10", "93h"),
     "https://www.openrunner.com/route-details/18054362",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/17_FF_iti_Paris-Mont-St-Michel.pdf"),
    ("CHERBOURG", 406, 3562, "20h", "36h", "122h",
     ("Le Pecq", 392, None, "19h", "35h", "118h"),
     "https://www.openrunner.com/route-details/18054505",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/18_FF_iti_Paris-Cherbourg.pdf"),
    ("NANTES", 431, 2482, "20h", "36h", "129h",
     ("Versailles", 420, 2320, "19h30", "35h20", "126h"),
     "https://www.openrunner.com/route-details/16123846",
     "https://www.audax-club-parisien.com/wp-content/uploads/2025/01/15-FF_iti_Paris-Nantes_2025.pdf"),
    ("MONTBELIARD", 465, 4458, "23h15", "40h", "140h",
     ("Pontault-Combault", 447, None, "22h20", "38h", "134h"),
     "https://www.openrunner.com/route-details/18054694",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/05_FF_iti_Paris-Montbeliard.pdf"),
    ("LA ROCHELLE", 488, 3590, "24h25", "40h", "146h",
     ("Jouy-en-Josas", 472, None, "23h35", "38h", "141h"),
     "https://www.openrunner.com/route-details/17793209",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/14-FF_iti_Paris-La-Rochelle.pdf"),
    ("STRASBOURG", 515, 3839, "28h", "45h", "155h",
     ("Gournay-sur-Marne", 499, None, "27h40", "44h15", "155h"),
     "https://www.openrunner.com/route-details/21361439",
     "https://www.audax-club-parisien.com/wp-content/uploads/2026/04/Paris-Strasbourg-2026.pdf"),
    ("BELLEGARDE", 600, 5429, "37h", "60h", "180h",
     ("Montgeron", 584, None, "36h30", "59h15", "179h"),
     "https://www.openrunner.com/route-details/25336566",
     "https://www.audax-club-parisien.com/wp-content/uploads/2026/04/Paris-Bellegarde-2026.pdf"),
    ("BREST", 616, 5607, "36h15", "61h", "185h",
     ("Versailles", 605, None, "35h35", "60h", "181h"),
     "https://www.openrunner.com/route-details/18054224",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/16_FF_iti_Paris-Brest.pdf"),
    ("BORDEAUX", 659, 4437, "35h", "63h", "186h",
     ("Massy", 645, 4319, "34h10", "62h", "181h30"),
     "https://www.openrunner.com/route-details/20763473",
     "https://www.audax-club-parisien.com/wp-content/uploads/2025/02/13-FF_iti_Paris-Bordeaux_2025_v2.pdf"),
    ("BRIANCON", 783, 8666, "51h", "83h", "235h",
     ("Villeneuve-Saint-Georges", 765, 8580, "50h10", "82h", "230h"),
     "https://www.openrunner.com/route-details/21686262",
     "https://www.audax-club-parisien.com/wp-content/uploads/2025/11/07-FF_iti_Paris-Briancon_2025.pdf"),
    ("LUCHON", 861, 8311, "62h", "86h", "258h",
     ("Palaiseau", 848, None, "58h45", "84h30", "234h"),
     "https://www.openrunner.com/route-details/18160243",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/11_FF_iti_Paris-Luchon.pdf"),
    ("HENDAYE", 902, 7221, "60h", "86h", "270h",
     ("Bièvres", 890, None, "58h45", "84h30", "267h"),
     "https://www.openrunner.com/route-details/18160138",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/12_FF_iti_Paris-Hendaye.pdf"),
    ("MARSEILLE", 910, 9588, "64h", "100h", "273h",
     ("Athis-Mons", 898, None, "62h45", "98h30", "269h"),
     "https://www.openrunner.com/route-details/18160576",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/09_FF_iti_Paris-Marseille.pdf"),
    ("PERPIGNAN", 983, 11288, "78h", "120h", "295h",
     ("Savigny-sur-Orge", 968, None, "76h30", "118h", "290h"),
     "https://www.openrunner.com/route-details/18160636",
     "https://www.audax-club-parisien.com/wp-content/uploads/2024/03/10_FF_iti_Paris-Perpignan.pdf"),
    ("NICE", 1024, 10400, "80h", "120h", "307h",
     ("Montgeron", 1006, 10315, "79h", "118h30", "301h"),
     "https://www.openrunner.com/route-details/21226330",
     "https://www.audax-club-parisien.com/wp-content/uploads/2025/11/08-FF_iti_Paris-Nice_2025.pdf"),
]

# Coordonnées (lat, lon) — villes d'arrivée et communes de départ décalé (Île-de-France)
COORDS_ARRIVEE = {
    "DIEPPE": (49.9253, 1.0778), "CHARLEVILLE": (49.9500, 4.7242), "LE HAVRE": (49.4944, 0.1079),
    "LILLE": (50.6292, 3.0573), "CALAIS": (50.9513, 1.8587), "MONT ST MICHEL": (48.6361, -1.5115),
    "CHERBOURG": (49.6339, -1.6221), "NANTES": (47.2184, -1.5536), "MONTBELIARD": (47.5139, 6.7839),
    "LA ROCHELLE": (46.1603, -1.1511), "STRASBOURG": (48.5734, 7.7521), "BELLEGARDE": (46.4233, 5.8264),
    "BREST": (48.3904, -4.4861), "BORDEAUX": (44.8378, -0.5792), "BRIANCON": (44.9028, 6.6339),
    "LUCHON": (42.7944, 0.6017), "HENDAYE": (43.3517, -1.7778), "MARSEILLE": (43.2965, 5.3698),
    "PERPIGNAN": (42.6887, 2.8948), "NICE": (43.7102, 7.2620),
}
COORDS_DEPART = {
    "Cormeilles": (48.9708, 2.1947), "Tremblay": (48.9497, 2.5684), "La Frette": (48.9056, 2.1775),
    "Villiers-le-Bel": (48.9956, 2.3931), "Eaubonne": (48.9914, 2.2444), "Noisy-le-Roi": (48.7856, 2.0681),
    "Le Pecq": (48.8619, 2.0925), "Versailles": (48.8014, 2.1301), "Pontault-Combault": (48.7028, 2.6119),
    "Jouy-en-Josas": (48.6986, 2.1714), "Gournay-sur-Marne": (48.8644, 2.5611),
    "Montgeron": (48.7072, 2.4503), "Massy": (48.7306, 2.2714),
    "Villeneuve-Saint-Georges": (48.7328, 2.4625), "Palaiseau": (48.7147, 2.2417),
    "Bièvres": (48.7567, 2.2156), "Athis-Mons": (48.7106, 2.3789), "Savigny-sur-Orge": (48.6839, 2.3483),
}
PARIS = (48.8566, 2.3522)

FORMULE_NOM = {"O": "Or", "A": "Argent", "B": "Bronze"}
AGE_BANDS = [(65, "a"), (50, "b"), (35, "c"), (20, "d"), (0, "e")]

# Codes département admis par l'onglet Departements du classeur
DEPT_CODES = ({f"{i:02d}" for i in range(1, 20)} | {f"{i:02d}" for i in range(21, 96)}
              | {"2A", "2B", "971", "972", "973", "974", "976"})

def s(v):
    """Normalise une valeur de cellule en chaîne propre."""
    if v is None:
        return ""
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float):
        if abs(v - round(v)) < 1e-9:
            return str(int(round(v)))
        return ("%.6g" % v)
    return str(v).strip()

def num(v, default=None):
    """Conversion numérique tolérante : 'x', '1 234', '' → default."""
    if v is None:
        return default
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (int, float)):
        return v
    t = str(v).strip().replace("\xa0", "").replace(" ", "").replace(",", ".")
    if t in ("", "-", "x", "X", "n/a", "NA", "?"):
        return default
    try:
        f = float(t)
    except (ValueError, TypeError):
        return default
    if abs(f - round(f)) < 1e-9:
        return int(round(f))
    return f

def derive_dept(cp, pays=""):
    """Département depuis un code postal + pays (codes admis : 01-95, 2A/2B, 971-976, ETR)."""
    d = s(cp)
    if d and d[0].isdigit():
        if d[:2] == "20":                      # Corse : 20xxx → 2A / 2B
            n = int(d[:3]) if d[:3].isdigit() else 0
            return "2A" if (n < 202 or 205 <= n <= 206) else "2B"
        if d[:3] in DEPT_CODES:                # DOM : 971..976
            return d[:3]
        if d[:2] in DEPT_CODES:                # métropole
            return d[:2]
    p = s(pays).upper()
    if p and p not in ("FRANCE", "FR"):
        return "ETR"
    return ""

def norm_key(name):
    """Clé de rapprochement flèche : sans article, sans accent ni espace."""
    import unicodedata
    t = s(name).upper()
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
    for art in ("PARIS-", "LE ", "LA ", "LES ", "L'", "-"):
        t = t.replace(art, "")
    t = t.replace("SAINT", "ST")   # MONT ST MICHEL ↔ LE MONT SAINT MICHEL
    return t.replace(" ", "")

def age_band(age):
    for seuil, code in AGE_BANDS:
        if age is None:
            return ""
        if age >= seuil:
            return code
    return "e"

def load_sheets():
    print(f"Lecture de {XLSX} …")
    wb = openpyxl.load_workbook(XLSX, data_only=True, read_only=True)
    return wb

def read_tab(ws, header_row=1, max_col=None):
    """Lit un onglet en listes de chaînes, sautant les lignes vides de tête."""
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        if i < header_row:
            continue
        vals = [s(v) for v in row]
        if max_col:
            vals = vals[:max_col]
        rows.append(vals)
    return rows

def parse_parcours(wb):
    """Onglet Parcours : Flèche, km, D+, ratio, niveau, cat km, cat D+, mise à jour."""
    rows = read_tab(wb["Parcours"])
    out = {}
    for r in rows[1:]:
        if not r or not r[0] or not norm_key(r[0]):
            continue
        name = r[0].upper()
        if name not in {o[0] for o in OFFICIAL} and norm_key(name) not in {norm_key(o[0]) for o in OFFICIAL}:
            # bloc de légende à droite : on s'arrête dès qu'on sort des flèches
            if len(r) > 1 and r[1] and not r[1].replace(".", "").isdigit():
                continue
        try:
            km = float(r[1]) if r[1] else None
        except ValueError:
            continue
        try:
            dp = float(r[2]) if len(r) > 2 and r[2] else None
        except ValueError:
            dp = None
        out[norm_key(name)] = {
            "km": km, "dplus": dp,
            "ratio": float(r[3]) if len(r) > 3 and r[3] else None,
            "niveau": r[4] if len(r) > 4 else "",
            "catKm": r[5] if len(r) > 5 else "",
            "catDplus": r[6] if len(r) > 6 else "",
            "maj": r[7] if len(r) > 7 else "",
        }
    return out

def parse_adresses(wb):
    """Onglet Adresses (en-tête ligne 3) : ville, CP, pays, département par Nom Prénom."""
    rows = read_tab(wb["Adresses"], header_row=3)
    out = {}
    for r in rows[1:]:
        if not r or not r[0]:
            continue
        key = r[0]
        if key in out:            # XLOOKUP prend la première correspondance
            continue
        out[key] = {
            "adresse": r[1] if len(r) > 1 else "",
            "ville": r[2] if len(r) > 2 else "",
            "cp": r[3] if len(r) > 3 else "",
            "pays": (r[4] if len(r) > 4 else ""),
            "dept": (r[5] if len(r) > 5 else ""),
        }
    return out

def parse_departements(wb):
    rows = read_tab(wb["Departements"])
    deps = []
    for r in rows[1:]:
        if not r or not r[0] or not r[0].isdigit():
            continue
        deps.append({"num": r[0].zfill(2), "nom": r[1], "region": r[2],
                     "homologations": int(r[3]) if len(r) > 3 and r[3].isdigit() else 0,
                     "participants": int(r[4]) if len(r) > 4 and r[4].isdigit() else 0})
    return deps

def parse_clubs(wb):
    """Onglet Clubs : bloc principal A:J + blocs juxtaposés (top km / top nb / par année)."""
    ws = wb["Clubs"]
    rows = read_tab(ws, max_col=18)
    clubs = {}
    tops = {"km": [], "nb": [], "kmAnnee": [], "nbAnnee": []}
    annee_km = defaultdict(dict)   # bloc « club × année (km) »
    annee_nb = defaultdict(dict)
    mode = None
    for i, r in enumerate(rows):
        if i == 0:
            continue
        # --- bloc principal (colonnes A..J) ---
        if len(r) > 1 and r[0] and r[1]:
            try:
                km = int(float(r[1]))
                nb = int(float(r[5])) if len(r) > 5 and r[5] else 0
            except ValueError:
                km, nb = None, None
            if km is not None:
                clubs[r[0]] = {
                    "nom": r[0], "km": km,
                    "rangKm": num(r[2]) if len(r) > 2 else None,
                    "kmAnnee": num(r[3], 0) if len(r) > 3 else 0,
                    "rangKmAnnee": num(r[4]) if len(r) > 4 else None,
                    "nb": nb,
                    "rangNb": num(r[6]) if len(r) > 6 else None,
                    "nbAnnee": num(r[7], 0) if len(r) > 7 else 0,
                    "rangNbAnnee": num(r[8]) if len(r) > 8 else None,
                }
        # --- blocs juxtaposés (M..S) : en-têtes repérés pour basculer de mode ---
        head_km = r[12] if len(r) > 12 else ""
        if head_km == "Club" and (r[13] if len(r) > 13 else "") == "km":
            mode = "top"
        if head_km == "année":
            mode = "annee"
        if mode == "top" and len(r) > 14 and r[12] and r[13]:
            rk, tk = num(r[12]), num(r[14])
            if rk is not None and tk is not None:
                tops["km"].append({"rang": rk, "club": r[13], "km": tk})
            if len(r) > 18 and r[16] and r[17]:
                rn, tn = num(r[16]), num(r[18])
                if rn is not None and tn is not None:
                    tops["nb"].append({"rang": rn, "club": r[17], "nb": tn})
        if mode == "annee" and len(r) > 14 and r[12] and r[13]:
            v1, v2 = num(r[14]), num(r[18]) if len(r) > 18 else None
            if v1 is not None:
                annee_km[r[13]][r[12]] = v1
            if v2 is not None and len(r) > 17 and r[16]:
                annee_nb[r[17]][r[16]] = v2
    for c in clubs.values():
        c["parAnnee"] = annee_km.get(c["nom"], {})
        c["parAnneeNb"] = annee_nb.get(c["nom"], {})
    return clubs, tops, dict(annee_km), dict(annee_nb)

def parse_recap_participants(wb):
    """Onglet Participants (récapitulatif) : Nom Prénom, Km, nb, rangs, H/F, catégories."""
    rows = read_tab(wb["Participants"], max_col=14)
    out = {}
    for r in rows[2:]:
        if not r or not r[0] or r[0] == "Nom Prénom":
            continue
        km = num(r[1], 0)
        if km is None:
            continue
        nb = num(r[5], 0) or 0
        out[r[0]] = {"km": km, "nb": nb,
                     "rangKm": num(r[2]) if len(r) > 2 else None,
                     "rangNb": num(r[6]) if len(r) > 6 else None,
                     "sexe": r[11] if len(r) > 11 and isinstance(r[11], str) else "",
                     "categAnnee": r[12] if len(r) > 12 and isinstance(r[12], str) else "",
                     "categTotal": r[13] if len(r) > 13 and isinstance(r[13], str) else ""}
    return out

def parse_palmares20(wb):
    """Onglet « 2 Palmares » : lauréats des 20 flèches + Palmarès « en Or » (3 et plus).

    Mise en page réelle (indices 0-based) :
      Femmes   : B=rang(1) C=nom(2)                 — lignes 4..19 (16)
      Hommes   : E/F(4,5), G/H(6,7), I/J(8,9), K/L(10,11) — 116
      Or femmes  : O=#(14) P=nom(15) Q=nb(16)
      Or hommes  : S=#(18) T=nom(19) U=nb(20)
    """
    ws = wb["2 Palmares"]
    rows = read_tab(ws, max_col=21)
    femmes, hommes, or_f, or_h = [], [], [], []

    def is_rank(v):
        n = num(v)
        return n is not None and float(n).is_integer() and n >= 1

    for r in rows[3:]:
        if len(r) > 2 and is_rank(r[1]) and r[2]:
            femmes.append({"rang": int(num(r[1])), "nom": s(r[2])})
        for ci in (4, 6, 8, 10):
            if len(r) > ci + 1 and is_rank(r[ci]) and r[ci + 1]:
                hommes.append({"rang": int(num(r[ci])), "nom": s(r[ci + 1])})
        if len(r) > 16 and r[14] not in (None, "", "#") and r[15]:
            nb = num(r[16])
            if nb is not None:
                or_f.append({"rang": r[14], "nom": s(r[15]), "opf": nb})
        if len(r) > 20 and r[18] not in (None, "", "#") and r[19]:
            nb = num(r[20])
            if nb is not None:
                or_h.append({"rang": r[18], "nom": s(r[19]), "opf": nb})
    femmes.sort(key=lambda x: x["rang"])
    hommes.sort(key=lambda x: x["rang"])
    return {"femmes": femmes, "hommes": hommes,
            "orFemmes": or_f, "orHommes": or_h, "palmaresOr": or_f + or_h}

def parse_tcd_palmares(wb):
    """Onglet « Tcd Palamrès » : 4 blocs juxtaposés, alignés sur leurs propres en-têtes.

      A:B   Nom Prénom / Nb            → lauréats des « 20 flèches »
      E:J   Destination / km / O / A / B / TOTAL
      M:S   Annuel / Nom Prénom / Cumul / Défi / O / A / B
      V:W   Nom Prénom / Somme de OPF  → palmarès Or
    """
    rows = read_tab(wb["Tcd Palamrès"], max_col=35)
    complete20, par_fleche, par_annee, palmares_or = [], {}, [], []
    for r in rows[6:]:
        # bloc A : lauréats des 20 flèches
        if len(r) > 1 and r[0] and r[0] != "Nom Prénom":
            nb = num(r[1])
            if nb is not None:
                complete20.append({"nom": s(r[0]), "nb": nb})
        # bloc E : par flèche
        if len(r) > 9 and r[4] and r[4] != "Destination":
            km = num(r[5])
            if km is not None:
                par_fleche[norm_key(r[4])] = {
                    "km": km,
                    "O": num(r[6], 0) or 0, "A": num(r[7], 0) or 0, "B": num(r[8], 0) or 0,
                    "total": num(r[9], 0) or 0,
                }
        # bloc M : palmarès par année (Annuel = flèches de l'année, Cumul = carrière)
        if len(r) > 14 and r[13] and r[13] != "Nom Prénom":
            an = num(r[12])
            cumul = num(r[14])
            if an is not None and cumul is not None:
                par_annee.append({
                    "nbAnnee": int(an), "nom": s(r[13]), "cumul": int(cumul),
                    "defi": num(r[15]) or 0,
                    "O": num(r[16], 0) or 0, "A": num(r[17], 0) or 0, "B": num(r[18], 0) or 0,
                })
        # bloc V : palmarès Or
        if len(r) > 22 and r[21] and r[21] != "Nom Prénom":
            opf = num(r[22])
            if opf is not None:
                palmares_or.append({"nom": s(r[21]), "opf": round(opf, 2)})
    return {"complete20": complete20, "parFleche": par_fleche,
            "parAnnee": par_annee, "palmaresOr": palmares_or}

def main():
    verify = "--verify" in sys.argv
    wb = load_sheets()

    print("Parsing des onglets de référence …")
    parcours = parse_parcours(wb)
    adresses = parse_adresses(wb)
    departements = parse_departements(wb)
    clubs_sheet, tops, clubs_annee_km, clubs_annee_nb = parse_clubs(wb)
    recap = parse_recap_participants(wb)
    palmares20 = parse_palmares20(wb)
    tcd_pal = parse_tcd_palmares(wb)

    # JOURNAL
    print("Parsing du journal DATA (17 094 lignes) …")
    ws = wb["DATA"]
    records = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[0]:
            continue
        fleche_ep = s(row[4])                       # PARIS-LUCHON
        dest = s(row[22]) or (fleche_ep.split("-", 1)[1] if "-" in fleche_ep else fleche_ep)
        naiss = row[9]
        naissance = naiss.strftime("%Y-%m-%d") if isinstance(naiss, (dt.datetime, dt.date)) else s(naiss)
        date = row[5]
        date_s = date.strftime("%Y-%m-%d") if isinstance(date, (dt.datetime, dt.date)) else s(date)
        age_f = num(row[40])
        records.append({
            "clef": s(row[0]), "np": s(row[1]), "annee": num(row[2], 0), "num": num(row[3]),
            "epreuve": fleche_ep, "dest": dest, "date": date_s, "formule": s(row[6]).upper(),
            "nom": s(row[7]), "prenom": s(row[8]), "naissance": naissance, "sexe": s(row[10]),
            "tel": s(row[11]), "rue": s(row[12]), "ville": s(row[13]), "cp": s(row[14]), "pays": s(row[15]),
            "code": s(row[16]), "club": s(row[17]), "fede": s(row[18]),
            "medaille": s(row[19]), "groupee": s(row[20]),
            "destW": dest, "km": num(row[23]), "dplus": num(row[24]),
            "th": num(row[25]), "tha": num(row[27]), "dateMax": s(row[29]),
            "est2023": num(row[30], 0), "nb2023": num(row[31], 0),
            "est2024": num(row[32], 0), "nb2024": num(row[33], 0),
            "catKm": s(row[34]), "catDplus": s(row[35]), "thf": num(row[36]), "thup": num(row[38]),
            "ageF": age_f, "catAge": s(row[41]), "dateMin": s(row[42]), "premiere": num(row[43], 0),
            "opf": num(row[44]), "dept": s(row[45]),
        })
    print(f"  {len(records)} homologations lues")

    # km / D+ : depuis le journal (VLOOKUP Parcours) ; complétion par l'onglet Parcours
    for r in records:
        if not isinstance(r["km"], (int, float)) or not isinstance(r["dplus"], (int, float)):
            p = parcours.get(norm_key(r["dest"]), {})
            r["km"] = p.get("km")
            r["dplus"] = p.get("dplus")

    # Dept (col 46) : le cache du classeur est obsolète (10 895 « ? » alors que la
    # ligne correspondante existe dans Adresses). On rejoue la formule du classeur
    # XLOOKUP([Nom Prénom] ; Adresses!A:A ; Adresses!F:F ; "" ; 0) et, si elle renvoie
    # « ? » ou reste vide, on dérive le département depuis le code postal / le pays.
    n_cache = n_cp_adr = n_cp_jr = n_et = n_vid = n_ville = 0
    # Index ville → département (majorité) pour les lignes sans CP exploitable
    ville_dept = defaultdict(Counter)
    for a in adresses.values():
        d, v = s(a.get("dept")), s(a.get("ville")).upper()
        if d in DEPT_CODES and v:
            ville_dept[v][d] += 1
    ville_dept = {v: c.most_common(1)[0][0] for v, c in ville_dept.items()}

    def ville_key(v):
        import unicodedata
        t = s(v).upper()
        return "".join(c for c in unicodedata.normalize("NFD", t)
                       if unicodedata.category(c) != "Mn").strip()

    ville_idx = {ville_key(v): d for v, d in ville_dept.items()}

    for r in records:
        a = adresses.get(r["np"]) or {}
        d = s(a.get("dept"))
        if d in DEPT_CODES:
            n_cache += 1
        else:
            d = derive_dept(a.get("cp") or r["cp"], a.get("pays") or r["pays"])
            if d:
                if s(a.get("cp")):
                    n_cp_adr += 1
                else:
                    n_cp_jr += 1
                if d == "ETR":
                    n_et += 1
            else:
                # dernier recours : ville connue du classeur
                v = ville_key(a.get("ville") or r["ville"])
                d = ville_idx.get(v, "")
                if d:
                    n_ville += 1
                else:
                    n_vid += 1
        r["dept"] = d
    print(f"  Dept : {n_cache} (Adresses) · {n_cp_adr} (CP Adresses) · {n_cp_jr} (CP journal) "
          f"· {n_ville} (ville) · {n_et} étranger · {n_vid} inconnu")

    # PARTICIPANTS (regroupés)
    print("Regroupement des participants par (Nom, Prénom, Date de naissance) …")
    parts = {}
    for r in records:
        key = (r["nom"].upper(), r["prenom"], r["naissance"])
        p = parts.get(key)
        if p is None:
            addr = adresses.get(r["np"], {})
            p = parts[key] = {
                "id": len(parts), "nom": r["nom"], "prenom": r["prenom"], "sexe": r["sexe"],
                "ville": r["ville"] or addr.get("ville", ""), "cp": r["cp"] or addr.get("cp", ""),
                "pays": r["pays"] or addr.get("pays", ""),
                "dept": r["dept"],
                "code": r["code"], "club": r["club"], "fede": r["fede"],
                "tel": r["tel"], "rue": r["rue"],
                "rows": [],
            }
        p["rows"].append(r)
        # coordonnées / club / fédération : dernière valeur non vide observée
        for fld in ("ville", "cp", "pays", "dept", "code", "club", "fede", "tel", "rue"):
            if r[fld] and r[fld] not in ("?",):
                if not p[fld] or fld in ("club", "fede", "dept", "ville", "cp"):
                    p[fld] = r[fld]

    participants = []
    for p in parts.values():
        rows = sorted(p.pop("rows"), key=lambda x: (x["date"], x["annee"]))
        # club / fédération : ceux de la dernière homologation (ordre chronologique)
        for fld in ("club", "fede"):
            vals = [x[fld] for x in rows if x[fld] and x[fld] != "?"]
            if vals:
                p[fld] = vals[-1]
        dests = sorted({x["dest"] for x in rows})
        km = sum(x["km"] for x in rows if isinstance(x["km"], (int, float)))
        dp = sum(x["dplus"] for x in rows if isinstance(x["dplus"], (int, float)))
        fo = Counter(x["formule"] for x in rows)
        try:
            naiss = dt.date.fromisoformat(rows[0]["naissance"])
        except Exception:
            naiss = None
        age = round((TODAY - naiss).days / 365, 1) if naiss else None
        premiere = rows[0]["date"]
        derniere = rows[-1]["date"]
        tranche = age_band(age)
        # âge par homologation (col AO) / tranche par homologation (col AP)
        for x in rows:
            try:
                x["ageF"] = round((dt.date.fromisoformat(x["date"]) - naiss).days / 365, 1) if naiss else None
            except Exception:
                x["ageF"] = None
            x["catAge"] = age_band(x["ageF"]) if x["ageF"] is not None else ""
        participants.append({
            "id": p["id"], "nom": p["nom"], "prenom": p["prenom"], "sexe": p["sexe"],
            "ville": p["ville"], "cp": p["cp"], "pays": p["pays"], "dept": p["dept"],
            "code": p["code"], "club": p["club"], "fede": p["fede"],
            "tel": p["tel"], "rue": p["rue"],
            "naissance": rows[0]["naissance"],
            "age": age, "tranche": tranche,
            "nb": len(rows), "km": round(km), "dplus": round(dp),
            "distinctes": len(dests), "dests": dests,
            "O": fo.get("O", 0), "A": fo.get("A", 0), "B": fo.get("B", 0),
            "premiere": premiere, "premiereAnnee": int(premiere[:4]) if premiere else None,
            "derniere": derniere, "derniereAnnee": int(derniere[:4]) if derniere else None,
            "complete": len(dests) >= 20,
            "groupees": sum(1 for x in rows if x["groupee"] == "x"),
            "medailles": sum(1 for x in rows if x["medaille"] in ("1", "2")),
        })
    participants.sort(key=lambda p: (p["nom"], p["prenom"]))

    # HOMOLOGATIONS (JSON)
    print("Écriture des homologations …")
    # index participant par (Nom, Prénom, Naissance) — la clé de regroupement exacte
    idx_part = {k: v["id"] for k, v in parts.items()}
    # l'âge / la tranche par ligne sont recalculés ici (naissances connues)
    homos = []
    for r in records:
        pid = idx_part.get((r["nom"].upper(), r["prenom"], r["naissance"]))
        homos.append({
            "pid": pid, "annee": r["annee"], "num": r["num"], "dest": r["dest"],
            "date": r["date"], "formule": r["formule"], "km": r["km"], "dplus": r["dplus"],
            "med": r["medaille"], "grp": 1 if r["groupee"] == "x" else 0,
            "age": r["ageF"], "cat": r["catAge"], "opf": round(r["opf"], 4) if isinstance(r["opf"], float) else r["opf"],
            "dept": r["dept"], "club": r["club"], "fede": r["fede"],
        })

    # FLÈCHES (20)
    print("Assemblage des 20 Flèches …")
    stats_fleche = defaultdict(lambda: Counter())
    km_fleche = defaultdict(lambda: {"km": 0, "dplus": 0})
    for r in records:
        k = norm_key(r["dest"])
        stats_fleche[k]["total"] += 1
        stats_fleche[k][r["formule"] or "?"] += 1
        stats_fleche[k][f"y{r['annee']}"] += 1
        if isinstance(r["km"], (int, float)):
            km_fleche[k]["km"] += r["km"]
        if isinstance(r["dplus"], (int, float)):
            km_fleche[k]["dplus"] += r["dplus"]
    dest_participants = defaultdict(set)
    for r in records:
        dest_participants[norm_key(r["dest"])].add((r["nom"], r["prenom"], r["naissance"]))

    fleches = []
    for (nom, km, dp, or_, arg, brz, dec, openr, pdf) in OFFICIAL:
        k = norm_key(nom)
        hist = parcours.get(k, {})
        st = stats_fleche.get(k, Counter())
        fleches.append({
            "id": nom, "epreuve": f"PARIS-{nom}", "nom": nom.title(),
            "km": km, "dplus": dp,
            "delais": {"O": or_, "A": arg, "B": brz},
            "depart": {"commune": dec[0], "km": dec[1], "dplus": dec[2],
                       "delais": {"O": dec[3], "A": dec[4], "B": dec[5]},
                       "coords": list(COORDS_DEPART.get(dec[0], (None, None)))},
            "openrunner": openr, "pdf": pdf,
            "coords": list(COORDS_ARRIVEE[nom]),
            "hist": {"km": hist.get("km"), "dplus": hist.get("dplus"), "maj": hist.get("maj"),
                     "catKm": hist.get("catKm"), "catDplus": hist.get("catDplus"),
                     "niveau": hist.get("niveau"), "ratio": hist.get("ratio")},
            "stats": {"total": st.get("total", 0), "O": st.get("O", 0), "A": st.get("A", 0),
                      "B": st.get("B", 0), "participants": len(dest_participants.get(k, ())),
                      "kmCumules": km_fleche.get(k, {}).get("km", 0),
                      "dplusCumules": km_fleche.get(k, {}).get("dplus", 0)},
            "palmares": tcd_pal["parFleche"].get(k),
        })

    # CLUBS
    print("Agrégation des clubs …")
    club_agg = defaultdict(lambda: {"km": 0, "nb": 0, "parts": set(), "O": 0, "A": 0, "B": 0,
                                    "parAnnee": defaultdict(int), "parAnneeNb": defaultdict(int)})
    for r in records:
        c = r["club"] or "(sans club)"
        a = club_agg[c]
        a["nb"] += 1
        a["parts"].add((r["nom"], r["prenom"], r["naissance"]))
        if isinstance(r["km"], (int, float)):
            a["km"] += r["km"]
        a[r["formule"] or "B"] += 1
        a["parAnnee"][r["annee"]] += 1
        if isinstance(r["km"], (int, float)):
            a["parAnneeKm"] = a.get("parAnneeKm", defaultdict(int))
            a["parAnneeKm"][r["annee"]] += r["km"]
    clubs = []
    for nom, a in club_agg.items():
        sheet = clubs_sheet.get(nom, {})
        clubs.append({
            "nom": nom, "km": a["km"], "nb": a["nb"], "participants": len(a["parts"]),
            "O": a["O"], "A": a["A"], "B": a["B"],
            "parAnnee": {str(k): v for k, v in sorted(a["parAnnee"].items())},
            "parAnneeKm": {str(k): v for k, v in sorted(a.get("parAnneeKm", {}).items())},
            "rangKm": sheet.get("rangKm"), "rangNb": sheet.get("rangNb"),
            "code": "",
        })
    clubs.sort(key=lambda c: -c["km"])
    # codes club (CodeACP → libellé) observés dans le journal
    code_map = {}
    for r in records:
        if r["code"] and r["club"]:
            code_map.setdefault(r["club"], r["code"])
    for c in clubs:
        c["code"] = code_map.get(c["nom"], "")

    # STATS ANNUELLES
    print("Statistiques annuelles …")
    years = sorted({r["annee"] for r in records})
    stats_year = []
    for y in years:
        rows = [r for r in records if r["annee"] == y]
        fo = Counter(r["formule"] for r in rows)
        parts_y = {(r["nom"], r["prenom"], r["naissance"]) for r in rows}
        f_y = sum(1 for r in rows if r["sexe"] == "F")
        stats_year.append({
            "annee": y, "nb": len(rows), "femmes": f_y, "hommes": len(rows) - f_y,
            "km": round(sum(r["km"] for r in rows if isinstance(r["km"], (int, float)))),
            "participants": len(parts_y),
            "O": fo.get("O", 0), "A": fo.get("A", 0), "B": fo.get("B", 0),
            "nouveaux": 0,
        })
    first_year = {}
    for p in participants:
        first_year.setdefault(p["premiereAnnee"], set()).add((p["nom"], p["prenom"]))
    for st in stats_year:
        st["nouveaux"] = len(first_year.get(st["annee"], ()))

    # DÉFIS
    print("Défis : La Complète, express, pionnier, groupées …")
    complete = [p for p in participants if p["complete"]]
    express = []
    homos_by_pid = defaultdict(list)
    for h in homos:
        homos_by_pid[h["pid"]].append(h)
    for p in participants:
        mine = homos_by_pid[p["id"]]
        by_year_dests = defaultdict(set)
        by_year_n = Counter()
        for h in mine:
            by_year_dests[h["annee"]].add(h["dest"])
            by_year_n[h["annee"]] += 1
        for y, dests_y in by_year_dests.items():
            if len(dests_y) >= 20:
                express.append({"nom": f"{p['nom']} {p['prenom']}", "annee": y,
                                "sexe": p["sexe"], "club": p["club"], "id": p["id"]})
    # Pionnier : premier lauréat connu pour chaque (Flèche × Formule)
    pioneer = {}
    for fleche in fleches:
        k = norm_key(fleche["id"])
        cell = {}
        for f in ("O", "A", "B"):
            rows_f = [r for r in records if norm_key(r["dest"]) == k and r["formule"] == f]
            # premier lauréat = plus ancienne date de réalisation (puis n° d'homologation)
            rows_f.sort(key=lambda r: (r["date"] or f"{r['annee']}-12-31", r["num"] or 0))
            if rows_f:
                r0 = rows_f[0]
                cell[f] = {"nom": f"{r0['nom']} {r0['prenom']}", "annee": r0["annee"],
                           "date": r0["date"], "club": r0["club"]}
            else:
                cell[f] = None
        pioneer[fleche["id"]] = cell
    # 5 formules réputées vierges entre 1997 et 2025 (CONSIGNES) — vérification dynamique
    vierges = [("BRIANCON", "O"), ("HENDAYE", "O"), ("LUCHON", "O"), ("MARSEILLE", "O"), ("MARSEILLE", "A")]
    vierges_check = []
    for fl, fo in vierges:
        rows_f = [r for r in records if norm_key(r["dest"]) == norm_key(fl) and r["formule"] == fo
                  and 1997 <= r["annee"] <= 2025]
        rows_f.sort(key=lambda r: (r["annee"] or 0, r["date"] or ""))
        vierges_check.append({
            "flèche": fl, "formule": fo,
            "vierge1997_2025": len(rows_f) == 0,
            "premier": ({"nom": f"{rows_f[0]['nom']} {rows_f[0]['prenom']}", "annee": rows_f[0]["annee"],
                         "date": rows_f[0]["date"]} if rows_f else None),
            "apres2025": sum(1 for r in records if norm_key(r["dest"]) == norm_key(fl)
                             and r["formule"] == fo and r["annee"] > 2025),
        })
    # Flèches groupées (onglet « 3 Flèches groupées »)
    grp_rows = [r for r in records if r["groupee"] == "x"]
    groupes = {
        "homologations": len(grp_rows),
        "participants": len({(r["nom"], r["prenom"]) for r in grp_rows}),
        "parDestination": dict(Counter(r["dest"] for r in grp_rows)),
        "parAnnee": {str(k): v for k, v in sorted(Counter(r["annee"] for r in grp_rows).items())},
    }

    # JSON
    os.makedirs(OUT, exist_ok=True)
    payload = {
        "meta": {
            "source": "Tableau de Bord Flèches.xlsx",
            "build": BUILD_DATE.isoformat(),
            "homologations": len(homos),
            "participants": len(participants),
            "clubs": len(clubs),
            "annees": [years[0], years[-1]],
            "ageRef": TODAY.isoformat(),
        },
        "fleches": fleches,
        "homologations": homos,
        "participants": participants,
        "clubs": clubs,
        "stats": {"annees": stats_year, "palmares20": palmares20,
                  "tcdPalmares": tcd_pal, "tops": tops},
        "defis": {"complete": [{"id": p["id"], "nom": f"{p['nom']} {p['prenom']}", "sexe": p["sexe"],
                                "club": p["club"], "nb": p["nb"], "premiere": p["premiere"],
                                "derniere": p["derniere"]} for p in sorted(complete, key=lambda x: (x["nom"], x["prenom"]))],
                  "express": express, "pioneer": pioneer, "vierges": vierges_check,
                  "groupes": groupes},
        "departements": departements,
    }
    for name, obj in (("fleches.json", {"meta": payload["meta"], "fleches": fleches}),
                      ("homologations.json", {"meta": payload["meta"], "rows": homos}),
                      ("participants.json", {"meta": payload["meta"], "rows": participants}),
                      ("clubs.json", {"meta": payload["meta"], "rows": clubs}),
                      ("stats.json", {"meta": payload["meta"], **payload["stats"]}),
                      ("defis.json", {"meta": payload["meta"], **payload["defis"]}),
                      ("departements.json", {"meta": payload["meta"], "rows": departements}),
                      ("index.json", {"meta": payload["meta"],
                                      "files": ["fleches.json", "homologations.json", "participants.json",
                                                "clubs.json", "stats.json", "defis.json", "departements.json"]})):
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
        print(f"  {name:26s} {os.path.getsize(path):>10,} octets")

    # BILAN
    print("\n" + "=" * 90)
    print("BILAN VOLUMÉTRIQUE")
    print("=" * 90)
    print(f"  Onglets lus           : {len(wb.sheetnames)} ({', '.join(wb.sheetnames)})")
    print(f"  Homologations (DATA)  : {len(records)} lignes × 46 colonnes")
    print(f"  Participants uniques  : {len(participants)} (clé Nom+Prénom+Naissance)")
    print(f"  Clubs distincts       : {len(clubs)}")
    print(f"  Années                : {years[0]} → {years[-1]} ({len(years)} millésimes)")
    print(f"  Formules              : {dict(Counter(r['formule'] for r in records))}")
    print(f"  Fédérations           : {dict(Counter(r['fede'] or '(vide)' for r in records))}")
    print(f"  Flèches distinctes    : {len({norm_key(r['dest']) for r in records})}")
    print(f"  La Complète (20/20)   : {len(complete)} participants")
    print(f"  Complète express      : {len(express)} cas (une année = 20 flèches)")
    print(f"  Flèches groupées      : {len(grp_rows)} homologations / "
          f"{len({(r['nom'], r['prenom']) for r in grp_rows})} participants")
    print(f"  Participants récap    : {len(recap)} lignes · Club sheet: {len(clubs_sheet)}")
    print(f"  Départements          : {len(departements)} · Adresses: {len(adresses)}")
    print(f"  Palmarès 20 flèches   : {len(palmares20['femmes'])} femmes / {len(palmares20['hommes'])} hommes")
    print(f"  Formules vierges 1997-2025 : "
          + ", ".join(f"{v['flèche']} {v['formule']}={'vierge' if v['vierge1997_2025'] else 'ATTRIBUÉE'}"
                      for v in vierges_check))
    # contrôle de cohérence avec le classeur
    dash = None
    print(f"  Contrôle dashboard    : participants aux 20 flèches (classeur) = 132 ; calcul = "
          f"{len(palmares20['femmes']) + len(palmares20['hommes'])} (palmarès) / {len(complete)} (journal)")
    if verify:
        print("\nVérifications supplémentaires :")
        miss_dest = [r for r in records if r["km"] is None]
        print(f"  Lignes sans km        : {len(miss_dest)}")
        print(f"  Formule hors O/A/B    : {sum(1 for r in records if r['formule'] not in ('O','A','B'))}")
        print(f"  Médaille (col 20)     : {dict(Counter(r['medaille'] or '(vide)' for r in records))}")
        print(f"  Groupée (col 21)      : {dict(Counter(r['groupee'] or '(vide)' for r in records))}")
        print(f"  Département (col 46)  : {dict(Counter(r['dept'] or '(vide)' for r in records).most_common(6))}")
        print(f"  Tranches d'âge        : {dict(Counter(p['tranche'] for p in participants))}")
        print(f"  OPF (col 45) somme    : {round(sum(r['opf'] for r in records if isinstance(r['opf'], (int, float))), 2)}")
        print(f"  Dept final (post-XLOOKUP) : {dict(Counter(r['dept'] or '(inconnu)' for r in records).most_common(8))}")
    print(f"\nDonnées écrites dans {OUT}")

if __name__ == "__main__":
    main()
