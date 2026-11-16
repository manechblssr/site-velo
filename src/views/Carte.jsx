import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { makeT } from '../lib/i18n.js'
import { fmt, norm } from '../lib/data.js'

const PARIS = [48.8566, 2.3522]
const CENTRE_FRANCE = [46.6, 2.5]

/* Chaîne de repli des fonds de carte (sans clé) : OpenFreeMap → OpenStreetMap →
   contour local de la France, afin que la carte reste lisible hors connexion. */
const SOURCES_TUILES = [
  {
    url: 'https://tile.openfreemap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · fond <a href="https://openfreemap.org/">OpenFreeMap</a>',
  },
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
]

const STYLE_FRANCE = {
  color: '#0048a8',
  weight: 1.6,
  opacity: 0.7,
  fillColor: '#d7e3f6',
  fillOpacity: 0.55,
  interactive: false,
}

const TRANCHES_KM = [
  { id: 'toutes', label: 'Toutes les distances', test: () => true },
  { id: 'court', label: '≤ 300 km', test: (f) => f.km <= 300 },
  { id: 'moyen', label: '300 – 600 km', test: (f) => f.km > 300 && f.km <= 600 },
  { id: 'long', label: '> 600 km', test: (f) => f.km > 600 },
]

const COULEUR = {
  realisee: '#0f7a3d',   // vert : flèche validée par le participant
  manquante: '#9aa1ab',  // gris : pas encore
  base: '#0048a8',       // bleu ACP : tracé de référence
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ligneFiche(f) {
  const h = f.hist
  const ecart =
    h?.km && h.km !== f.km
      ? `<p class="pop-ecart">Valeur enregistrée dans le classeur : ${fmt(h.km)} km / ${fmt(h.dplus)} m</p>`
      : ''
  return `
    <div class="pop">
      <h3 class="pop__titre">${esc(f.nom)}</h3>
      <p class="pop__chiffres"><b>${fmt(f.km)} km</b> · <b>${fmt(f.dplus)} m</b> de D+</p>
      <ul class="pop__delais">
        <li><span class="formule formule--O">Or</span> ${esc(f.delais.O)}</li>
        <li><span class="formule formule--A">Argent</span> ${esc(f.delais.A)}</li>
        <li><span class="formule formule--B">Bronze</span> ${esc(f.delais.B)}</li>
      </ul>
      <p class="pop__depart">Départ décalé : <b>${esc(f.depart.commune)}</b> · ${fmt(
        f.depart.km,
      )} km${f.depart.dplus ? ` · ${fmt(f.depart.dplus)} m` : ''}</p>
      ${ecart}
      <p class="pop__stats">${fmt(f.stats.total)} homologations — Or ${fmt(
        f.stats.O,
      )} · Argent ${fmt(f.stats.A)} · Bronze ${fmt(f.stats.B)}</p>
      <p class="pop__liens">
        <a href="${esc(f.openrunner)}" target="_blank" rel="noreferrer">OpenRunner ↗</a>
        <a href="${esc(f.pdf)}" target="_blank" rel="noreferrer">Feuille de route ↗</a>
      </p>
      <button type="button" class="btn btn--secondary btn--sm pop__btn">Voir les lauréats</button>
    </div>`
}

export default function Carte({ lang, data, routeParam, onOpenFleche, onOpenParticipant }) {
  const t = makeT(lang)
  const { fleches, participants, homologations, meta } = data

  const [tranche, setTranche] = useState('toutes')
  const [formule, setFormule] = useState('')
  const [quest, setQuest] = useState('')
  const [sel, setSel] = useState(null) // participant choisi
  const [calque, setCalque] = useState({ arrivees: true, departs: true, traces: true })
  const [tuilesOk, setTuilesOk] = useState(true)

  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const couches = useRef({})
  const markers = useRef(new Map()) // id de flèche → marqueur d'arrivée
  const popupHandler = useRef(null)
  popupHandler.current = onOpenFleche

  /* --- candidats à la recherche de participant / club -------------------- */
  const resultats = useMemo(() => {
    const q = norm(quest)
    if (q.length < 3) return []
    return participants
      .filter((p) => norm(`${p.nom} ${p.prenom} ${p.ville} ${p.club}`).includes(q))
      .slice(0, 8)
  }, [quest, participants])

  /* --- flèches du participant sélectionné ------------------------------- */
  const parParticipant = useMemo(() => {
    if (!sel) return null
    const mes = new Map()
    for (const h of homologations) {
      if (h.pid !== sel.id) continue
      const cur = mes.get(h.dest)
      if (!cur || formuleRang(h.formule) > formuleRang(cur.formule)) mes.set(h.dest, h)
    }
    return mes
  }, [sel, homologations])

  function formuleRang(f) {
    return f === 'O' ? 3 : f === 'A' ? 2 : f === 'B' ? 1 : 0
  }

  const visibles = useMemo(
    () => fleches.filter((f) => TRANCHES_KM.find((x) => x.id === tranche).test(f)),
    [fleches, tranche],
  )

  /* --- initialisation de la carte --------------------------------------- */
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const map = L.map(mapEl.current, {
      center: CENTRE_FRANCE,
      zoom: 6,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    })
    mapRef.current = map

    /* fond de carte : chaîne de repli si le premier réseau ne répond pas */
    let source = 0
    let echecs = 0
    const monterFond = () => {
      if (source >= SOURCES_TUILES.length) {
        setTuilesOk(false)
        return
      }
      const s = SOURCES_TUILES[source]
      const tuile = L.tileLayer(s.url, { maxZoom: 18, attribution: s.attribution })
      tuile.on('tileerror', () => {
        echecs += 1
        if (echecs < 6) return
        echecs = 0
        source += 1
        map.removeLayer(tuile)
        monterFond()
      })
      tuile.addTo(map)
    }
    monterFond()

    /* contour local de la France : la carte reste nette même sans tuiles */
    let contour = null
    fetch(`${import.meta.env.BASE_URL}data/france.geojson`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('geojson'))))
      .then((geo) => {
        if (!mapRef.current) return
        contour = L.geoJSON(geo, { style: STYLE_FRANCE }).addTo(map)
        contour.bringToBack()
      })
      .catch(() => {})

    couches.current = {
      paris: L.layerGroup().addTo(map),
      departs: L.layerGroup().addTo(map),
      arrivees: L.layerGroup().addTo(map),
      traces: L.layerGroup().addTo(map),
    }

    // point central Paris
    L.circleMarker(PARIS, {
      radius: 8,
      color: '#14171c',
      weight: 3,
      fillColor: '#fbfaf8',
      fillOpacity: 1,
    })
      .bindPopup('<div class="pop"><h3 class="pop__titre">Paris</h3><p class="pop__stats">Point central des 20 Flèches.</p></div>')
      .addTo(couches.current.paris)

    L.marker(PARIS, {
      icon: L.divIcon({
        className: 'map-label',
        html: '<span class="map-label__txt">Paris</span>',
        iconAnchor: [0, 26],
      }),
      interactive: false,
    }).addTo(couches.current.paris)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  /* --- dimension : le conteneur peut changer (menu, onglet, redimensionnement) */
  useEffect(() => {
    const map = mapRef.current
    const el = mapEl.current
    if (!map || !el) return

    let frame = 0
    const recalculer = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => mapRef.current?.invalidateSize({ animate: false }))
    }
    const t = setTimeout(recalculer, 80)
    window.addEventListener('resize', recalculer)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recalculer) : null
    ro?.observe(el)

    return () => {
      clearTimeout(t)
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', recalculer)
      ro?.disconnect()
    }
  }, [])

  /* --- redessin des calques à chaque changement de filtres -------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !couches.current.arrivees) return
    const c = couches.current

    ;[c.departs, c.arrivees, c.traces].forEach((g) => g.clearLayers())
    markers.current.clear()

    // communes de départ décalé (18)
    if (calque.departs) {
      const vus = new Set()
      for (const f of fleches) {
        const [la, lo] = f.depart.coords || []
        if (la === null || vus.has(f.depart.commune)) continue
        vus.add(f.depart.commune)
        L.circleMarker([la, lo], {
          radius: 6,
          color: '#0048a8',
          weight: 2,
          fillColor: '#4d9aff',
          fillOpacity: 0.9,
        })
          .bindPopup(
            `<div class="pop"><h3 class="pop__titre">${esc(
              f.depart.commune,
            )}</h3><p class="pop__stats">Départ décalé de la flèche ${esc(
              f.nom,
            )} · ${fmt(f.depart.km)} km</p></div>`,
          )
          .addTo(c.departs)
      }
    }

    // tracés + villes d'arrivée
    for (const f of visibles) {
      const etat = parParticipant?.get(f.id)
      const manquant = parParticipant ? !etat : false
      const cacheParFormule = parParticipant && formule && etat?.formule !== formule

      const couleur = parParticipant
        ? manquant || cacheParFormule
          ? COULEUR.manquante
          : COULEUR.realisee
        : COULEUR.base
      const opacite = parParticipant && (manquant || cacheParFormule) ? 0.35 : 0.85

      if (calque.traces) {
        const pts = [PARIS, f.coords]
        if (f.depart.coords?.[0]) pts.splice(1, 0, f.depart.coords)
        L.polyline(pts, {
          color: couleur,
          weight: manquant || cacheParFormule ? 1.5 : 2.5,
          opacity: opacite,
          dashArray: manquant || cacheParFormule ? '6 8' : null,
        })
          .bindPopup(ligneFiche(f))
          .addTo(c.traces)
      }

      if (calque.arrivees) {
        const m = L.circleMarker(f.coords, {
          radius: manquant || cacheParFormule ? 5 : 8,
          color: couleur,
          weight: 2.5,
          fillColor: couleur,
          fillOpacity: manquant || cacheParFormule ? 0.35 : 0.85,
        })
        m.bindPopup(ligneFiche(f))
        m.addTo(c.arrivees)
        markers.current.set(f.id, m)
        if (!manquant && !cacheParFormule && f.coords) {
          L.marker(f.coords, {
            icon: L.divIcon({
              className: 'map-label',
              html: `<span class="map-label__txt">${esc(f.nom)}</span>`,
              iconAnchor: [-6, 12],
            }),
            interactive: false,
          }).addTo(c.arrivees)
        }
      }
    }

    // bouton « Voir les lauréats » dans les popups
    map.off('popupopen')
    map.on('popupopen', (e) => {
      const btn = e.popup.getElement()?.querySelector('.pop__btn')
      if (!btn) return
      const nom = e.popup.getElement()?.querySelector('.pop__titre')?.textContent
      const f = fleches.find((x) => x.nom === nom)
      if (f) btn.addEventListener('click', () => popupHandler.current?.(f.id), { once: true })
    })
  }, [visibles, parParticipant, formule, calque, fleches])

  /* --- arrivée par lien (#/carte/DIEPPE ou #/carte/fleche=DIEPPE) -------- */
  useEffect(() => {
    if (!routeParam || !mapRef.current) return
    const brut = routeParam.includes('=')
      ? new URLSearchParams(routeParam).get('fleche')
      : routeParam
    const id = decodeURIComponent(brut || '')
    const f = fleches.find((x) => x.id === id)
    if (!f?.coords) return
    mapRef.current.invalidateSize({ animate: false })
    mapRef.current.flyTo(f.coords, 9, { animate: true })
    window.setTimeout(() => markers.current.get(id)?.openPopup(), 420)
  }, [routeParam, fleches])

  /* --- calques : afficher / masquer ------------------------------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !couches.current.arrivees) return
    const toggle = (layer, on) => {
      if (on && !map.hasLayer(layer)) layer.addTo(map)
      if (!on && map.hasLayer(layer)) map.removeLayer(layer)
    }
    toggle(couches.current.departs, calque.departs)
    toggle(couches.current.arrivees, calque.arrivees)
    toggle(couches.current.traces, calque.traces)
  }, [calque])

  /* --- cadrage sur le participant --------------------------------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sel) return
    const pts = fleches.filter((f) => parParticipant?.has(f.id)).map((f) => f.coords)
    if (pts.length) map.fitBounds(L.latLngBounds([PARIS, ...pts]).pad(0.18), { animate: true })
    else map.setView(PARIS, 7, { animate: true })
  }, [sel, parParticipant, fleches])

  const realises = parParticipant ? parParticipant.size : null

  return (
    <section className="section section--page" aria-labelledby="h-carte">
      <div className="wrap">
        <div className="section-head section-head--row">
          <h1 id="h-carte" className="t-h2">
            {t('view.carte')} <span className="muted">Paris et les 18 départs décalés</span>
          </h1>
          <p className="result-line">
            <strong>{visibles.length}</strong> {t('f.results')}
          </p>
        </div>

        <div className="toolbar toolbar--map" role="group" aria-label="Filtres de la carte">
          <div className="toolbar__field toolbar__field--wide">
            <label htmlFor="map-q">Participant ou club</label>
            <input
              id="map-q"
              type="search"
              value={quest}
              placeholder="Nom, prénom, commune…"
              onChange={(e) => setQuest(e.target.value)}
            />
            {resultats.length > 0 && (
              <ul className="ac-results">
                {resultats.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSel(p)
                        setQuest('')
                      }}
                    >
                      <b>
                        {p.nom} {p.prenom}
                      </b>
                      <span>
                        {p.club || 'Sans club'} · {p.nb} flèches
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <fieldset className="toolbar__chips">
            <legend className="sr-only">Distance</legend>
            {TRANCHES_KM.map((x) => (
              <button
                key={x.id}
                type="button"
                className={`chip${tranche === x.id ? ' chip--actif' : ''}`}
                aria-pressed={tranche === x.id}
                onClick={() => setTranche(x.id)}
              >
                {x.label}
              </button>
            ))}
          </fieldset>

          <div className="toolbar__field">
            <label htmlFor="map-formule">Formule obtenue</label>
            <select
              id="map-formule"
              value={formule}
              disabled={!sel}
              onChange={(e) => setFormule(e.target.value)}
            >
              <option value="">{sel ? 'Toutes' : 'Choisir un participant'}</option>
              <option value="O">Or</option>
              <option value="A">Argent</option>
              <option value="B">Bronze</option>
            </select>
          </div>

          <fieldset className="toolbar__chips">
            <legend className="sr-only">Calques</legend>
            {[
              ['arrivees', 'Villes d’arrivée'],
              ['departs', 'Départs décalés'],
              ['traces', 'Tracés'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`chip${calque[k] ? ' chip--actif' : ''}`}
                aria-pressed={calque[k]}
                onClick={() => setCalque((c) => ({ ...c, [k]: !c[k] }))}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>

        {sel && (
          <div className="map-selection" role="status">
            <span>
              <b>
                {sel.nom} {sel.prenom}
              </b>{' '}
              — {realises} flèche{realises > 1 ? 's' : ''} validée
              {realises > 1 ? 's' : ''} sur {fleches.length}
              {formule && ` · formule ${formule === 'O' ? 'Or' : formule === 'A' ? 'Argent' : 'Bronze'}`}
            </span>
            <button type="button" className="row-link" onClick={() => setSel(null)}>
              Retirer
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => onOpenParticipant(sel.id)}
            >
              Ouvrir sa fiche palmarès
            </button>
          </div>
        )}

        <div className="map-shell">
          <div ref={mapEl} className="map-canvas" role="application" aria-label="Carte des 20 Flèches de France" />
          {!tuilesOk && (
            <p className="map-offline" role="status">
              Fond de carte hors ligne : le contour de la France, les tracés et les repères restent
              affichés. Les tuiles reviendront à la reconnexion.
            </p>
          )}
          <div className="map-legend">
            <span>
              <i className="map-dot" style={{ background: COULEUR.base }} /> Référence
            </span>
            {sel && (
              <>
                <span>
                  <i className="map-dot" style={{ background: COULEUR.realisee }} /> Validée
                </span>
                <span>
                  <i className="map-dot" style={{ background: COULEUR.manquante }} /> À réaliser
                </span>
              </>
            )}
            <span>
              <i className="map-dot" style={{ background: '#4d9aff' }} /> Départ décalé
            </span>
          </div>
        </div>

        <p className="t-small muted map-note">
          {meta.homologations.toLocaleString('fr-FR')} homologations rattachées aux 20
          destinations · les tracés sont schématiques (Paris → départ décalé → ville d'arrivée).
        </p>
      </div>
    </section>
  )
}
