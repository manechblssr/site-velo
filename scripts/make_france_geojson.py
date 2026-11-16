#!/usr/bin/env python3
"""Génère public/data/france.geojson — contour de la France métropolitaine.

Source : Natural Earth 50m (ne_50m_admin_0_countries.geojson, domaine public),
téléchargée une fois puis extraite ici : la carte du site reste 100 % locale.

Usage :
    python scripts/make_france_geojson.py [chemin/vers/ne_50m_admin_0_countries.geojson]

Sortie : public/data/france.geojson  (FeatureCollection, 1 Feature MultiPolygon)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Bounding box de la France métropolitaine (métropole + Corse)
LON_MIN, LON_MAX = -5.9, 9.95
LAT_MIN, LAT_MAX = 40.9, 51.8

# Le point éloigné du précédent doit être retenu (sinon on décime la courbe)
MIN_STEP = 0.012  # ~1,3 km


def metro(ring):
    """True si l'anneau touche la France métropolitaine."""
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return not (
        max(lons) < LON_MIN
        or min(lons) > LON_MAX
        or max(lats) < LAT_MIN
        or min(lats) > LAT_MAX
    )


def clean(ring):
    """Écarte les points trop proches et arrondi à 4 décimales."""
    out = []
    for lon, lat in ring:
        lon = round(lon, 4)
        lat = round(lat, 4)
        if out and abs(lon - out[-1][0]) + abs(lat - out[-1][1]) < MIN_STEP:
            continue
        out.append((lon, lat))
    if len(out) > 3 and out[0] == out[-1]:
        out[-1] = out[0]
    return out if len(out) > 3 else ring


def main() -> int:
    src = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path.home() / "AppData/Local/Temp/ne50.geojson"
    )
    if not src.exists():
        print(f"introuvable : {src}", file=sys.stderr)
        return 1

    data = json.loads(src.read_text(encoding="utf-8"))
    cible = None
    for feat in data.get("features", []):
        p = feat.get("properties", {})
        if p.get("ISO_A3") == "FRA" or p.get("ADMIN") == "France":
            cible = feat
            break
    if cible is None:
        print("France introuvable dans le fichier source", file=sys.stderr)
        return 1

    geom = cible["geometry"]
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]

    keep = []
    for poly in polys:
        if not metro(poly[0]):
            continue
        rings = []
        for ring in poly:
            if metro(ring):
                rings.append([list(pt) for pt in clean(ring)])
        if rings:
            keep.append(rings)

    if not keep:
        print("aucun anneau métropolitain conservé", file=sys.stderr)
        return 1

    out = {
        "type": "FeatureCollection",
        "name": "France métropolitaine",
        "features": [
            {
                "type": "Feature",
                "properties": {"nom": "France métropolitaine", "source": "Natural Earth 50m"},
                "geometry": {"type": "MultiPolygon", "coordinates": keep},
            }
        ],
    }

    dest = Path(__file__).resolve().parent.parent / "public" / "data" / "france.geojson"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        f"{dest.name} : {len(keep)} polygone(s), "
        f"{sum(len(r) for p in keep for r in p)} points, {dest.stat().st_size} octets"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
