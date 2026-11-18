import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Icon, { iconHtml } from '../components/Icon.jsx'
import Badge from '../components/Badge.jsx'
import Planificateur from '../components/Planificateur.jsx'
import { makeT, pick, nomClub } from '../lib/i18n.js'
import { fmt, norm } from '../lib/data.js'

/*
   Carte interactive des 20 Flèches.
   - Chaque flèche est un arc Paris → ville d'arrivée, tracé à l'affichage,
     coloré par tranche de distance, avec un chevron qui donne le sens.
   - Survol d'un arc, d'un repère ou d'une ligne de la liste : la flèche
     ressort, les autres s'estompent (et inversement).
   - La fiche (popup) reprend distance, D+, délais, liens et compteurs ;
     elle ouvre aussi le planificateur sur la flèche choisie.
*/

const PARIS = [48.8566, 2.3522]
const CENTRE_FRANCE = [46.6, 2.5]
const ZOOM_FRANCE = 6

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

/* Sonde de connectivité mémoïsée (une requête par source et par minute). */
const CACHE_SONDE = new Map()
const SONDE_TTL = 60_000

function sondeTuiles(url) {
  const entree = CACHE_SONDE.get(url)
  if (entree) {
    if (entree.valeur !== undefined && Date.now() - entree.quand < SONDE_TTL) {
      return Promise.resolve(entree.valeur)
    }
    if (entree.enCours) return entree.enCours
  }
  const cible = url.replace('{z}', '6').replace('{x}', '31').replace('{y}', '22')
  const ctrl = new AbortController()
  const garde = setTimeout(() => ctrl.abort(), 5000)
  const enCours = fetch(cible, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
    .then(
      () => true,
      () => false,
    )
    .finally(() => clearTimeout(garde))
    .then((v) => {
      CACHE_SONDE.set(url, { valeur: v, quand: Date.now() })
      return v
    })
  CACHE_SONDE.set(url, { enCours })
  return enCours
}

const STYLE_FRANCE = {
  color: '#0048a8',
  weight: 1.4,
  opacity: 0.55,
  fillColor: '#dbe6f6',
  fillOpacity: 0.5,
  interactive: false,
}

/* Tranches de distance : filtre + couleur des arcs (rampe du bleu ACP). */
const TRANCHES_KM = [
  { id: 'toutes', label: 'Toutes', en: 'All', test: () => true },
  { id: 'court', label: '≤ 300 km', test: (f) => f.km <= 300, couleur: '#5b93dc' },
  { id: 'moyen', label: '300 – 600 km', test: (f) => f.km > 300 && f.km <= 600, couleur: '#1f5cbf' },
  { id: 'long', label: '> 600 km', test: (f) => f.km > 600, couleur: '#0b2b66' },
]

function couleurDistance(km) {
  if (km <= 300) return TRANCHES_KM[1].couleur
  if (km <= 600) return TRANCHES_KM[2].couleur
  return TRANCHES_KM[3].couleur
}

const COULEUR = {
  realisee: '#0f7a3d',
  manquante: '#9aa1ab',
  depart: '#4d9aff',
}
const COULEUR_FORMULE = { O: '#b8892a', A: '#7b8594', B: '#a4602f' }
const NOM_FORMULE = { O: 'Or', A: 'Argent', B: 'Bronze' }
const NOM_FORMULE_EN = { O: 'Gold', A: 'Silver', B: 'Bronze' }
const RANG = { O: 3, A: 2, B: 1 }

const TRIS = [
  { id: 'km', label: 'Distance', en: 'Distance', icon: 'ruler' },
  { id: 'nom', label: 'A – Z', en: 'A – Z', icon: 'list' },
  { id: 'pop', label: 'Fréquentation', en: 'Popularity', icon: 'users' },
]

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const reduit = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const PROJ = L.Projection.SphericalMercator

function arc(a, b, bend = 0.17, n = 56) {
  const p0 = PROJ.project(L.latLng(a))
  const p1 = PROJ.project(L.latLng(b))
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const c = L.point((p0.x + p1.x) / 2 - dy * bend, (p0.y + p1.y) / 2 + dx * bend)
  const at = (t) =>
    L.point(
      (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t ** 2 * p1.x,
      (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t ** 2 * p1.y,
    )
  const pts = []
  for (let i = 0; i <= n; i += 1) pts.push(PROJ.unproject(at(i / n)))
  /* chevron de sens au 3/5 de l'arc, orienté selon la tangente */
  const t = 0.6
  const tx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x)
  const ty = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y)
  return {
    pts,
    tete: PROJ.unproject(at(t)),
    angle: (-Math.atan2(ty, tx) * 180) / Math.PI, // y projeté vers le haut, CSS vers le bas
  }
}

/* Cadre la fiche et son ancrage au centre du conteneur. */
function centrerBlocPopup(map, popup) {
  try {
    const anchor = popup.getLatLng?.()
    const el = popup.getElement()
    if (!anchor || !el) return
    const cont = map.getContainer().getBoundingClientRect()
    const box = el.getBoundingClientRect()
    if (!cont.width || !cont.height || !box.width) return
    const pt = map.latLngToContainerPoint(anchor)
    const g = Math.min(box.left - cont.left, pt.x)
    const d = Math.max(box.right - cont.left, pt.x)
    const h = Math.min(box.top - cont.top, pt.y)
    const b = Math.max(box.bottom - cont.top, pt.y)
    map.panTo(map.containerPointToLatLng([(g + d) / 2, (h + b) / 2]), {
      animate: !reduit(),
      duration: 0.45,
      easeLinearity: 0.22,
    })
  } catch {
    /* carte démontée pendant l'animation */
  }
}

function ficheHtml(f, kmMax, etat, lang) {
  const ic = iconHtml
  const tr = pick(lang)
  const NF = lang === 'en' ? NOM_FORMULE_EN : NOM_FORMULE
  const h = f.hist
  const ecart =
    h?.km && h.km !== f.km
      ? `<p class="pop-ecart">${ic('info', 12)} ${tr('Valeur historique du classeur :', 'Historical workbook value:')} ${fmt(h.km)} km / ${fmt(h.dplus)} m</p>`
      : ''
  const perso = etat
    ? `<p class="pop__perso">${ic('check', 13)} ${tr('Validée en', 'Validated in')} <b>${NF[etat.formule] ?? '—'}</b>${
        etat.annee ? ` · ${etat.annee}` : ''
      }</p>`
    : ''
  const pct = Math.max(6, Math.round((f.km / kmMax) * 100))
  return `
    <div class="pop" data-fid="${esc(f.id)}">
      <div class="pop__head">
        <span class="pop__ico" style="--c:${couleurDistance(f.km)}">${ic('route', 18)}</span>
        <div class="pop__id">
          <h2 class="pop__titre">${esc(f.nom)}</h2>
          <p class="pop__sub">${esc(f.epreuve || 'Flèche de France')}</p>
        </div>
      </div>
      ${perso}
      <div class="pop__dist" aria-hidden="true"><span style="width:${pct}%;background:${couleurDistance(
        f.km,
      )}"></span></div>
      <div class="pop__grid">
        <span>${ic('ruler', 14)}<b>${fmt(f.km)} km</b><i>distance</i></span>
        <span>${ic('gauge', 14)}<b>${fmt(f.dplus)} m</b><i>${tr('de D+', 'climbing')}</i></span>
        <span>${ic('medal', 14)}<b>${fmt(f.stats.total)}</b><i>${tr('homologations', 'validated rides')}</i></span>
      </div>
      <ul class="pop__delais">
        <li><span class="formule formule--O">${NF.O}</span><b>${esc(f.delais.O)}</b></li>
        <li><span class="formule formule--A">${NF.A}</span><b>${esc(f.delais.A)}</b></li>
        <li><span class="formule formule--B">${NF.B}</span><b>${esc(f.delais.B)}</b></li>
      </ul>
      <p class="pop__depart">${ic('flag', 13)} ${tr('Départ décalé :', 'Alternative start:')} <b>${esc(f.depart.commune)}</b> · ${fmt(
        f.depart.km,
      )} km${f.depart.dplus ? ` · ${fmt(f.depart.dplus)} m` : ''}</p>
      <p class="pop__meta">${ic('award', 13)} ${NF.O} ${fmt(f.stats.O)} · ${NF.A} ${fmt(f.stats.A)} · ${NF.B} ${fmt(
        f.stats.B,
      )}</p>
      ${ecart}
      <div class="pop__liens">
        <a href="${esc(f.openrunner)}" target="_blank" rel="noreferrer">${ic('external-link', 13)} OpenRunner</a>
        <a href="${esc(f.pdf)}" target="_blank" rel="noreferrer">${ic('file-text', 13)} ${tr('Feuille de route', 'Route sheet')}</a>
      </div>
      <div class="pop__actions">
        <button type="button" class="btn btn--primary btn--sm pop__plan">${ic('calculator', 14)} ${tr('Planifier', 'Plan')}</button>
        <button type="button" class="btn btn--secondary btn--sm pop__btn">${ic('trophy', 14)} ${tr('Lauréats', 'Finishers')}</button>
      </div>
    </div>`
}

/** Nombre qui défile jusqu'à sa valeur (ease-out), instantané si mouvement réduit. */
function Compteur({ v, ms = 1200 }) {
  const [aff, setAff] = useState(reduit() ? v : 0)
  const depuis = useRef(0)
  useEffect(() => {
    if (reduit()) {
      setAff(v)
      return
    }
    const de = depuis.current
    const t0 = performance.now()
    let raf = 0
    const pas = (t) => {
      const k = Math.min(1, (t - t0) / ms)
      const e = 1 - (1 - k) ** 3
      const x = Math.round(de + (v - de) * e)
      depuis.current = x
      setAff(x)
      if (k < 1) raf = requestAnimationFrame(pas)
    }
    raf = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(raf)
  }, [v, ms])
  return <span className="num-tab">{fmt(aff)}</span>
}

export default function Carte({ lang, data, routeParam, onOpenFleche, onOpenParticipant }) {
  const t = makeT(lang)
  const tr = pick(lang)
  const NF = lang === 'en' ? NOM_FORMULE_EN : NOM_FORMULE
  const { fleches, participants, homologations, meta } = data

  const [tranche, setTranche] = useState('toutes')
  const [formule, setFormule] = useState('')
  const [quest, setQuest] = useState('')
  const [sel, setSel] = useState(null)
  const [calque, setCalque] = useState({ arrivees: true, departs: true, traces: true })
  const [tuilesOk, setTuilesOk] = useState(true)
  const [offlineVu, setOfflineVu] = useState(false)
  const [actif, setActif] = useState(null) // popup ouverte
  const [survol, setSurvol] = useState(null) // flèche survolée
  const [filtre, setFiltre] = useState('')
  const [tri, setTri] = useState('km')
  const [plein, setPlein] = useState(false)
  const [molette, setMolette] = useState(false)
  const [planif, setPlanif] = useState(null)
  const [histo, setHisto] = useState(null) // année affichée par la chronologie (null = off)
  const [lecture, setLecture] = useState(false)
  /* animations de la carte (flux, zoom sur clic, fiche) : toujours actives */
  const animer = true
  useEffect(() => {
    try {
      localStorage.removeItem('ff-carte-anim') // ancien interrupteur retiré
    } catch {
      /* stockage indisponible */
    }
  }, [])

  const stageRef = useRef(null)
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const listeRef = useRef(null)
  const couches = useRef({})
  const refs = useRef(new Map()) // id → { path, hit, tete, pin }
  const handlers = useRef({})
  const zoomDeparts = useRef(null)
  const refParis = useRef(null)
  const animerRef = useRef(true)
  const vol = useRef({ timer: 0, secours: 0 })
  handlers.current = {
    ouvrir: (id) => zoomerSur(id),
    centrer: () => centrerEcran(),
    laureats: onOpenFleche,
    planifier: (id) => setPlanif(id),
    survol: (id) => setSurvol(id),
  }

  const kmMax = useMemo(() => Math.max(...fleches.map((f) => f.km)), [fleches])

  /* --- chronologie : homologations cumulées par flèche, saison après saison */
  const chrono = useMemo(() => {
    const annees = [...new Set(homologations.map((h) => h.annee))].filter(Boolean).sort((a, b) => a - b)
    const parAnnee = new Map(annees.map((y) => [y, new Map()]))
    for (const h of homologations) {
      const m = parAnnee.get(h.annee)
      if (m) m.set(h.dest, (m.get(h.dest) ?? 0) + 1)
    }
    const cumul = new Map()
    const courant = new Map()
    let total = 0
    for (const y of annees) {
      for (const [d, n] of parAnnee.get(y)) {
        courant.set(d, (courant.get(d) ?? 0) + n)
        total += n
      }
      cumul.set(y, { parFleche: new Map(courant), total, saison: parAnnee.get(y) })
    }
    const max = Math.max(1, ...courant.values())
    return { annees, cumul, max }
  }, [homologations])

  const resultats = useMemo(() => {
    const q = norm(quest)
    if (q.length < 3) return []
    return participants
      .filter((p) => norm(`${p.nom} ${p.prenom} ${p.ville} ${p.club}`).includes(q))
      .slice(0, 8)
  }, [quest, participants])

  const parParticipant = useMemo(() => {
    if (!sel) return null
    const mes = new Map()
    for (const h of homologations) {
      if (h.pid !== sel.id) continue
      const cur = mes.get(h.dest)
      if (!cur || (RANG[h.formule] ?? 0) > (RANG[cur.formule] ?? 0)) mes.set(h.dest, h)
    }
    return mes
  }, [sel, homologations])

  const fo = useMemo(() => {
    const c = { O: 0, A: 0, B: 0 }
    if (parParticipant) for (const h of parParticipant.values()) if (c[h.formule] !== undefined) c[h.formule] += 1
    return c
  }, [parParticipant])

  const visibles = useMemo(
    () => fleches.filter((f) => TRANCHES_KM.find((x) => x.id === tranche).test(f)),
    [fleches, tranche],
  )

  /* état d'une flèche pour le participant sélectionné */
  const etatDe = (f) => {
    if (!parParticipant) return { mode: 'base' }
    const e = parParticipant.get(f.id)
    if (!e) return { mode: 'manquante' }
    if (formule && e.formule !== formule) return { mode: 'manquante', e }
    return { mode: 'realisee', e }
  }

  const liste = useMemo(() => {
    const q = norm(filtre)
    const l = visibles.filter(
      (f) => !q || norm(`${f.nom} ${f.epreuve} ${f.depart.commune}`).includes(q),
    )
    if (tri === 'nom') l.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    else if (tri === 'pop') l.sort((a, b) => b.stats.total - a.stats.total)
    else l.sort((a, b) => a.km - b.km)
    return l
  }, [visibles, filtre, tri])

  function choisirFleche(f) {
    if (f.coords) zoomerSur(f.id)
  }

  /* Clic sur une flèche (arc, repère, liste ou lien) :
     1. la flèche passe en avant et se retrace de Paris vers la ville ;
     2. la caméra vole pour cadrer l'arc entier ;
     3. une fois posée, la fiche s'ouvre sur la ville d'arrivée.
     Interrupteur « Animation » coupé : cadrage et fiche immédiats. */
  /* Centre verticalement le bloc de la carte dans la fenêtre : autant de
     place au-dessus (sous l'en-tête fixe) qu'en dessous. Plus haute que
     l'espace visible, la carte se cale simplement sous l'en-tête. */
  function centrerEcran() {
    const bloc = mapEl.current?.closest('.cx-map')
    if (!bloc) return
    const r = bloc.getBoundingClientRect()
    const entete = document.querySelector('header.nav')?.getBoundingClientRect().bottom ?? 0
    const dispo = window.innerHeight - entete
    const ecart = r.height <= dispo ? r.top - entete - (dispo - r.height) / 2 : r.top - entete
    if (Math.abs(ecart) < 4) return
    window.scrollTo({ top: Math.max(0, window.scrollY + ecart), behavior: 'smooth' })
  }

  function zoomerSur(id) {
    const map = mapRef.current
    const r = refs.current.get(id)
    if (!map || !r?.pts) return
    centrerEcran()
    const anim = animerRef.current
    window.clearTimeout(vol.current.timer)
    window.clearTimeout(vol.current.secours)
    map.off('moveend', vol.current.fin)
    map.closePopup()
    setActif(id)

    const pinEl = r.pin?.getElement()?.querySelector('.fl-pin')
    if (anim) {
      const el = r.path?.getElement()
      if (el) {
        el.setAttribute('pathLength', '1')
        el.setAttribute('data-m-loop', '')
        el.classList.remove('fl-redraw')
        void el.getBoundingClientRect() // relance l'animation
        el.classList.add('fl-redraw')
        el.addEventListener(
          'animationend',
          () => {
            el.classList.remove('fl-redraw')
            el.removeAttribute('pathLength')
          },
          { once: true },
        )
      }
    }

    const ouvrirFiche = () => {
      window.clearTimeout(vol.current.secours)
      map.off('moveend', vol.current.fin)
      const cur = refs.current.get(id)
      if (!cur) return
      if (cur.pin && map.hasLayer(cur.pin)) cur.pin.openPopup()
      else cur.hit?.openPopup(cur.coords)
      if (anim && pinEl) {
        pinEl.setAttribute('data-m-loop', '')
        pinEl.classList.remove('fl-pin--ping')
        void pinEl.offsetWidth
        pinEl.classList.add('fl-pin--ping')
      }
    }

    const cadre = L.latLngBounds(r.pts)
    const marges = { paddingTopLeft: [60, 70], paddingBottomRight: [60, 60], maxZoom: 8 }
    if (!anim) {
      map.fitBounds(cadre, { ...marges, animate: false })
      ouvrirFiche()
      return
    }
    vol.current.fin = () => {
      vol.current.timer = window.setTimeout(ouvrirFiche, 180)
    }
    map.once('moveend', vol.current.fin)
    /* filet de sécurité (vol interrompu ou onglet en arrière-plan) : on se
       pose directement sur le cadrage final avant d'ouvrir la fiche */
    vol.current.secours = window.setTimeout(() => {
      map.off('moveend', vol.current.fin)
      map.stop()
      map.fitBounds(cadre, { ...marges, animate: false })
      ouvrirFiche()
    }, 2200)
    map.flyToBounds(cadre, { ...marges, duration: 1.25, easeLinearity: 0.18 })
  }

  function cadrageFrance() {
    return L.latLngBounds([PARIS, ...fleches.filter((f) => f.coords).map((f) => f.coords)]).pad(0.06)
  }

  function recentrer() {
    mapRef.current?.closePopup()
    mapRef.current?.flyToBounds(cadrageFrance(), { animate: !reduit(), duration: 0.6 })
  }

  function basculerPleinEcran() {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => setPlein((v) => !v))
    else setPlein((v) => !v) // repli : plein cadre CSS
  }

  useEffect(() => {
    const onFs = () => setPlein(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  /* Escape quitte le plein cadre de repli */
  useEffect(() => {
    if (!plein || document.fullscreenElement) return
    const onKey = (e) => e.key === 'Escape' && setPlein(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [plein])

  /* la flèche active reste visible dans la liste */
  useEffect(() => {
    const box = listeRef.current
    if (!actif || !box) return
    const el = box.querySelector(`[data-fid="${actif}"]`)
    if (!el) return
    const haut = el.offsetTop
    const bas = haut + el.offsetHeight
    if (haut < box.scrollTop) box.scrollTop = haut - 8
    else if (bas > box.scrollTop + box.clientHeight) box.scrollTop = bas - box.clientHeight + 8
  }, [actif])

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const map = L.map(mapEl.current, {
      center: CENTRE_FRANCE,
      zoom: ZOOM_FRANCE,
      minZoom: 5,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      zoomSnap: 0.5,
    })
    L.control
      .zoom({ position: 'bottomright', zoomInTitle: tr('Zoomer', 'Zoom in'), zoomOutTitle: tr('Dézoomer', 'Zoom out') })
      .addTo(map)
    mapRef.current = map
    /* cadrage initial : toute la France des 20 flèches, quelle que soit la hauteur */
    window.setTimeout(() => {
      if (mapRef.current !== map) return
      map.invalidateSize({ animate: false })
      if (routeParam) return
      if (reduit()) map.fitBounds(cadrageFrance(), { animate: false })
      else {
        /* entrée en scène : on part de plus haut et on plonge sur la France */
        map.setView(CENTRE_FRANCE, 5, { animate: false })
        map.flyToBounds(cadrageFrance(), { duration: 1.4, easeLinearity: 0.2 })
      }
    }, 60)

    let vivant = true
    let fondActif = false

    const monterFond = async (idx = 0) => {
      if (!vivant) return
      if (idx >= SOURCES_TUILES.length) {
        fondActif = false
        setTuilesOk(false)
        return
      }
      const s = SOURCES_TUILES[idx]
      if (!(await sondeTuiles(s.url))) return monterFond(idx + 1)
      if (!vivant) return
      const tuile = L.tileLayer(s.url, {
        maxZoom: 18,
        attribution: s.attribution,
        className: 'fl-tuiles',
      })
      let echecs = 0
      tuile.on('tileerror', () => {
        if (!vivant) return
        echecs += 1
        if (echecs < 6) return
        map.removeLayer(tuile)
        monterFond(idx + 1)
      })
      tuile.addTo(map)
      fondActif = true
    }
    monterFond()

    const surRetourEnLigne = () => {
      if (!vivant || fondActif) return
      CACHE_SONDE.clear()
      setTuilesOk(true)
      monterFond(0)
    }
    window.addEventListener('online', surRetourEnLigne)

    fetch(`${import.meta.env.BASE_URL}data/france.geojson`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('geojson'))))
      .then((geo) => {
        if (!vivant) return
        L.geoJSON(geo, { style: STYLE_FRANCE }).addTo(map).bringToBack()
      })
      .catch(() => {})

    couches.current = {
      traces: L.layerGroup().addTo(map),
      departs: L.layerGroup().addTo(map),
      arrivees: L.layerGroup().addTo(map),
      paris: L.layerGroup().addTo(map),
    }

    /* Paris : repère pulsant, toujours au-dessus */
    refParis.current = L.marker(PARIS, {
      icon: L.divIcon({
        className: 'fl-paris',
        html: '<span class="fl-paris__pulse"></span><span class="fl-paris__dot"></span><span class="fl-paris__lbl">Paris</span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      keyboard: false,
      zIndexOffset: 1000,
    })
      .bindTooltip(tr('Paris · point de départ ou d’arrivée des 20 Flèches', 'Paris · start or finish point of the 20 Flèches'), {
        direction: 'top',
        offset: [0, -12],
        className: 'fl-tip',
      })
      .addTo(couches.current.paris)

    /* molette : activée au clic dans la carte, coupée en la quittant */
    const activer = () => {
      map.scrollWheelZoom.enable()
      setMolette(true)
      handlers.current.centrer?.()
    }
    const couper = () => {
      map.scrollWheelZoom.disable()
      setMolette(false)
    }
    map.on('click', activer)
    map.on('focus', activer)
    const cont = map.getContainer()
    cont.addEventListener('mouseleave', couper)

    return () => {
      vivant = false
      window.removeEventListener('online', surRetourEnLigne)
      cont.removeEventListener('mouseleave', couper)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const cont = mapEl.current
    if (!cont) return
    cont.querySelector('.leaflet-control-zoom-in')?.setAttribute('title', tr('Zoomer', 'Zoom in'))
    cont.querySelector('.leaflet-control-zoom-out')?.setAttribute('title', tr('Dézoomer', 'Zoom out'))
    const paris = refParis.current
    paris?.setTooltipContent(
      tr('Paris · point de départ ou d’arrivée des 20 Flèches', 'Paris · start or finish point of the 20 Flèches'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  useEffect(() => {
    const el = mapEl.current
    if (!el) return
    let frame = 0
    const recalculer = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => mapRef.current?.invalidateSize({ animate: false }))
    }
    const t0 = setTimeout(recalculer, 80)
    window.addEventListener('resize', recalculer)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recalculer) : null
    ro?.observe(el)
    return () => {
      clearTimeout(t0)
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', recalculer)
      ro?.disconnect()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !couches.current.arrivees) return
    const c = couches.current
    ;[c.departs, c.arrivees, c.traces].forEach((g) => g.clearLayers())
    refs.current.clear()
    const anime = !reduit()

    /* départs décalés : petits repères clairs autour de Paris */
    const vus = new Set()
    const rayon = () => (map.getZoom() >= 8 ? 5.5 : map.getZoom() >= 7 ? 4 : 2.6)
    for (const f of fleches) {
      const [la, lo] = f.depart.coords || []
      if (la == null || vus.has(f.depart.commune)) continue
      vus.add(f.depart.commune)
      L.circleMarker([la, lo], {
        radius: rayon(),
        color: '#0048a8',
        weight: 1.5,
        fillColor: COULEUR.depart,
        fillOpacity: 0.95,
        className: 'fl-depart',
      })
        .bindTooltip(
          `<b>${esc(f.depart.commune)}</b><br>${tr('Départ décalé', 'Alternative start')} · ${esc(f.nom)} · ${fmt(f.depart.km)} km`,
          { direction: 'top', className: 'fl-tip' },
        )
        .addTo(c.departs)
    }

    visibles.forEach((f, i) => {
      if (!f.coords) return
      const { mode, e } = etatDe(f)
      const manquant = mode === 'manquante'
      const couleur =
        mode === 'base' ? couleurDistance(f.km) : manquant ? COULEUR.manquante : COULEUR.realisee
      const geo = arc(PARIS, f.coords)
      const delai = `${Math.min(i, 19) * 45}ms`
      const fiche = () => ficheHtml(f, kmMax, mode === 'realisee' ? e : null, lang)
      const tip = `<b>${esc(f.nom)}</b> · ${fmt(f.km)} km · ${fmt(f.dplus)} m D+${
        e ? ` · ${NF[e.formule] ?? ''}` : ''
      }`
      const r = { id: f.id }

      /* arc visible (non interactif) + zone de survol large et invisible */
      const path = L.polyline(geo.pts, {
        color: couleur,
        weight: manquant ? 1.6 : 2.8,
        opacity: manquant ? 0.55 : 0.92,
        dashArray: manquant ? '5 7' : null,
        lineCap: 'round',
        interactive: false,
        className: `fl-trace${manquant ? ' fl-trace--manquante' : ''}`,
      }).addTo(c.traces)
      r.path = path
      r.base = { weight: manquant ? 1.6 : 2.8, opacity: manquant ? 0.55 : 0.92, dashArray: manquant ? '5 7' : null }
      r.km = f.km

      /* flux : impulsions lumineuses qui partent de Paris le long de l'arc */
      if (!manquant) {
        const flux = L.polyline(geo.pts, {
          color: '#ffffff',
          weight: 3.2,
          opacity: 0.95,
          lineCap: 'round',
          interactive: false,
          className: 'fl-flux',
        }).addTo(c.traces)
        const el = flux.getElement()
        if (el) {
          el.setAttribute('pathLength', '1')
          /* exempté de la coupure globale « mouvement réduit » du kit :
             le flux reste animé sur la carte */
          el.setAttribute('data-m-loop', '')
          el.style.setProperty('--dur', `${(2.4 + f.km / 380).toFixed(2)}s`)
          el.style.setProperty('--d', `${Math.min(i, 19) * 45 + 1100 + ((i * 397) % 1400)}ms`)
        }
        r.flux = flux
      }

      const hit = L.polyline(geo.pts, {
        color: '#000',
        weight: 16,
        opacity: 0,
        className: 'fl-hit',
      })
        .bindPopup(fiche, { autoPan: false, maxWidth: 340, className: 'fl-popup' })
        .bindTooltip(tip, { sticky: true, direction: 'top', className: 'fl-tip', offset: [0, -8] })
        .on('mouseover', () => handlers.current.survol(f.id))
        .on('mouseout', () => handlers.current.survol(null))
        .addTo(c.traces)
      /* le clic ne déroule plus la fiche tout de suite : zoom d'abord */
      hit.off('click', hit._openPopup, hit)
      hit.on('click', (ev) => {
        L.DomEvent.stop(ev)
        handlers.current.ouvrir(f.id)
      })
      r.hit = hit
      r.pts = geo.pts
      r.coords = f.coords

      const tete = L.marker(geo.tete, {
        icon: L.divIcon({
          className: 'fl-tete-wrap',
          html: `<span class="fl-tete${anime ? ' fl-tete--anime' : ''}" style="--rot:${geo.angle.toFixed(
            1,
          )}deg;--c:${couleur};--d:${delai}"></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(c.traces)
      r.tete = tete

      if (anime && !manquant) {
        const el = path.getElement()
        if (el) {
          el.setAttribute('pathLength', '1')
          el.style.setProperty('--d', delai)
          el.classList.add('fl-draw')
          el.addEventListener(
            'animationend',
            () => {
              el.classList.remove('fl-draw')
              el.removeAttribute('pathLength')
            },
            { once: true },
          )
        }
      }

      /* repère d'arrivée : pastille + étiquette (nom + km) */
      const formuleCls = mode === 'realisee' && e?.formule ? ` fl-pin--${e.formule}` : ''
      const pin = L.marker(f.coords, {
        icon: L.divIcon({
          className: `fl-pin-wrap${manquant ? ' is-manquante' : ''}`,
          html: `<span class="fl-pin${formuleCls}${anime ? ' fl-pin--anime' : ''}" style="--c:${couleur};--d:${delai}${
            mode === 'realisee' && e?.formule ? `;--f:${COULEUR_FORMULE[e.formule]}` : ''
          }"></span><span class="fl-pin__lbl${anime ? ' fl-pin__lbl--anime' : ''}" style="--d:${delai}">${esc(
            f.nom,
          )}<em>${fmt(f.km)} km</em></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -8],
        }),
        title: `${f.nom} — ${fmt(f.km)} km`,
        alt: f.nom,
        riseOnHover: true,
      })
        .bindPopup(fiche, { autoPan: false, maxWidth: 340, className: 'fl-popup' })
        .on('mouseover', () => handlers.current.survol(f.id))
        .on('mouseout', () => handlers.current.survol(null))
      pin.off('click', pin._openPopup, pin)
      pin.on('click', (ev) => {
        L.DomEvent.stop(ev)
        handlers.current.ouvrir(f.id)
      })
      if (calque.arrivees) pin.addTo(c.arrivees)
      r.pin = pin

      refs.current.set(f.id, r)
    })

    /* au zoom France, les 18 départs sont collés à Paris : repères réduits */
    if (zoomDeparts.current) map.off('zoomend', zoomDeparts.current)
    zoomDeparts.current = () => c.departs.eachLayer((l) => l.setRadius?.(rayon()))
    map.on('zoomend', zoomDeparts.current)

    map.off('popupopen popupclose')
    map.on('popupopen', (ev) => {
      const el = ev.popup.getElement()
      const fid = el?.querySelector('.pop')?.dataset.fid || null
      setActif(fid)
      const titre = el?.querySelector('.pop__titre')?.textContent?.trim()
      if (el) {
        if (animerRef.current) el.setAttribute('data-m-loop', '')
        else el.removeAttribute('data-m-loop')
        el.setAttribute('role', 'dialog')
        el.setAttribute('aria-label', titre || tr('Fiche', 'Profile'))
      }
      el?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', tr('Fermer la fiche', 'Close profile'))
      centrerBlocPopup(map, ev.popup)
      if (fid) {
        el.querySelector('.pop__btn')?.addEventListener('click', () => handlers.current.laureats?.(fid), {
          once: true,
        })
        el.querySelector('.pop__plan')?.addEventListener('click', () => {
          map.closePopup()
          handlers.current.planifier(fid)
        })
      }
    })
    map.on('popupclose', () => setActif(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles, parParticipant, formule, fleches, kmMax, lang])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !couches.current.arrivees) return
    const toggle = (layer, on) => {
      if (on && !map.hasLayer(layer)) layer.addTo(map)
      if (!on && map.hasLayer(layer)) map.removeLayer(layer)
    }
    toggle(couches.current.departs, calque.departs)
    toggle(couches.current.traces, calque.traces)
    for (const r of refs.current.values()) {
      if (calque.arrivees && !couches.current.arrivees.hasLayer(r.pin)) r.pin.addTo(couches.current.arrivees)
      if (!calque.arrivees && couches.current.arrivees.hasLayer(r.pin)) couches.current.arrivees.removeLayer(r.pin)
    }
  }, [calque, visibles, parParticipant, formule])

  const focus = survol ?? actif
  useEffect(() => {
    const cont = mapEl.current
    if (!cont) return
    cont.classList.toggle('has-focus', Boolean(focus))
    for (const [id, r] of refs.current) {
      const on = id === focus
      r.path?.getElement()?.classList.toggle('is-focus', on)
      r.tete?.getElement()?.classList.toggle('is-focus', on)
      r.pin?.getElement()?.classList.toggle('is-focus', on)
      r.flux?.getElement()?.classList.toggle('is-focus', on)
      if (on) r.path?.bringToFront()
    }
  }, [focus, visibles, parParticipant, formule, calque])

  useEffect(() => {
    const cont = mapEl.current
    if (!cont) return
    cont.classList.toggle('is-histo', histo !== null)
    const etat = histo !== null ? chrono.cumul.get(histo) : null
    for (const [id, r] of refs.current) {
      const pinEl = r.pin?.getElement()
      const em = pinEl?.querySelector('.fl-pin__lbl em')
      if (!etat) {
        r.path?.setStyle(r.base)
        if (pinEl) pinEl.style.opacity = ''
        if (em) em.textContent = `${fmt(r.km)} km`
        continue
      }
      const n = etat.parFleche.get(id) ?? 0
      const ratio = Math.sqrt(n / chrono.max)
      r.path?.setStyle({
        weight: n ? 1.4 + 9 * ratio : 1,
        opacity: n ? 0.45 + 0.55 * ratio : 0.12,
        dashArray: n ? null : '3 6',
      })
      if (pinEl) {
        pinEl.style.opacity = n ? '1' : '0.35'
        const neuf = etat.saison.get(id) ?? 0
        const pin = pinEl.querySelector('.fl-pin')
        if (pin && neuf && animer) {
          pin.classList.remove('fl-pin--ping')
          void pin.offsetWidth // relance l'animation
          pin.classList.add('fl-pin--ping')
        }
      }
      if (em) em.textContent = fmt(n)
    }
  }, [histo, chrono, visibles, parParticipant, formule, lang, animer])

  /* lecture automatique, une saison toutes les 0,8 s */
  useEffect(() => {
    if (!lecture) return
    const dernier = chrono.annees[chrono.annees.length - 1]
    const id = window.setInterval(() => {
      setHisto((y) => {
        if (y === null || y >= dernier) {
          setLecture(false)
          return y ?? dernier
        }
        return chrono.annees.find((a) => a > y) ?? dernier
      })
    }, 800)
    return () => window.clearInterval(id)
  }, [lecture, chrono])

  /* la chronologie s'efface quand on suit un participant */
  useEffect(() => {
    if (sel) {
      setLecture(false)
      setHisto(null)
    }
  }, [sel])

  function rejouer() {
    mapRef.current?.closePopup()
    setHisto(chrono.annees[0])
    setLecture(true)
  }

  /* --- arrivée par lien : #/carte/DIEPPE, #/carte/fleche=…, #/carte/pid=… */
  useEffect(() => {
    if (!routeParam) return
    if (routeParam.includes('pid=')) {
      const id = Number(new URLSearchParams(routeParam).get('pid'))
      const p = participants.find((x) => x.id === id)
      if (p) setSel(p)
      return
    }
    if (!mapRef.current) return
    const brut = routeParam.includes('=') ? new URLSearchParams(routeParam).get('fleche') : routeParam
    const id = decodeURIComponent(brut || '')
    const f = fleches.find((x) => x.id === id)
    if (!f?.coords) return
    setTranche('toutes')
    mapRef.current.invalidateSize({ animate: false })
    const tm = window.setTimeout(() => handlers.current.ouvrir(id), 450)
    return () => window.clearTimeout(tm)
  }, [routeParam, fleches, participants])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !sel) return
    const pts = fleches.filter((f) => parParticipant?.has(f.id)).map((f) => f.coords)
    if (pts.length) map.flyToBounds(L.latLngBounds([PARIS, ...pts]).pad(0.15), { duration: 0.7 })
    else map.flyTo(PARIS, 7, { duration: 0.6 })
  }, [sel, parParticipant, fleches])

  useEffect(() => {
    if (!sel) setFormule('')
  }, [sel])

  const realises = parParticipant ? parParticipant.size : 0
  const nbDeparts = useMemo(() => new Set(fleches.map((f) => f.depart.commune)).size, [fleches])

  return (
    <section className="section section--page cx" aria-labelledby="h-carte">
      <div className="wrap">
        <header className="cx-head">
          <div>
            <p className="cx-kicker">
              <Icon name="map" size={14} /> {t('nav.carte')}
            </p>
            <h1 id="h-carte" className="cx-title">
              {t('view.carte')}
            </h1>
          </div>
          <ul className="cx-stats" aria-label={tr('Chiffres clés', 'Key figures')}>
            <li>
              <Icon name="route" size={16} />
              <b><Compteur v={fleches.length} /></b> {tr('flèches', 'Flèches')}
            </li>
            <li>
              <Icon name="flag" size={16} />
              <b><Compteur v={nbDeparts} /></b> {tr('départs décalés', 'alternative starts')}
            </li>
            <li>
              <Icon name="medal" size={16} />
              <b><Compteur v={meta.homologations} /></b> {tr('homologations', 'validated rides')}
            </li>
          </ul>
        </header>

        <div className="cx-bar" role="group" aria-label={tr('Filtres de la carte', 'Map filters')}>
          <div className="cx-search">
            <Icon name="user" size={16} className="cx-search__ico" />
            <label htmlFor="map-q" className="sr-only">
              {tr('Afficher le parcours d’un participant', 'Show a rider’s Flèches')}
            </label>
            <input
              id="map-q"
              type="search"
              value={quest}
              autoComplete="off"
              placeholder={tr('Afficher les flèches d’un participant…', 'Show a rider’s Flèches…')}
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
                        {nomClub(p.club, lang) || t('f.none')} · {p.distinctes ?? p.nb} / 20 {tr('flèches', 'Flèches')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="cx-seg" role="group" aria-label={tr('Distance', 'Distance')}>
            {TRANCHES_KM.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={tranche === x.id}
                onClick={() => setTranche(x.id)}
              >
                {x.couleur && <i style={{ background: x.couleur }} />}
                {tr(x.label, x.en)}
              </button>
            ))}
          </div>

          <div className="cx-toggles" role="group" aria-label={tr('Calques', 'Layers')}>
            {[
              ['traces', 'route', tr('Flèches', 'Flèches')],
              ['arrivees', 'map-pin', tr('Arrivées', 'Finishes')],
              ['departs', 'flag', tr('Départs décalés', 'Alternative starts')],
            ].map(([k, ico, label]) => (
              <button
                key={k}
                type="button"
                className="cx-toggle"
                aria-pressed={calque[k]}
                onClick={() => setCalque((c) => ({ ...c, [k]: !c[k] }))}
              >
                <Icon name={calque[k] ? 'eye' : 'eye-off'} size={14} />
                <Icon name={ico} size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        {sel && (
          <div className="civ cx-civ" role="group" aria-label={tr('Participant sélectionné', 'Selected rider')}>
            <div className="civ__id">
              <span className="civ__avatar" aria-hidden="true">
                {(sel.prenom || '?')[0]}
                {(sel.nom || '')[0]}
              </span>
              <div className="civ__who">
                <p className="civ__nom">
                  {sel.prenom} {sel.nom}
                </p>
                <p className="civ__meta">
                  <Icon name="building" size={13} />
                  {sel.club || t('f.none')}
                  {sel.ville ? ` · ${sel.ville}` : ''}
                </p>
              </div>
            </div>
            <div className="civ__prog">
              <div className="civ__bar" role="img" aria-label={tr(`${realises} flèches validées sur ${fleches.length}`, `${realises} of ${fleches.length} Flèches validated`)}>
                <span style={{ width: `${Math.round((realises / fleches.length) * 100)}%` }} />
              </div>
              <p className="civ__chiffres">
                <b>
                  {realises} / {fleches.length}
                </b>{' '}
                {tr('flèches validées', 'Flèches validated')} · <b>{fmt(sel.nb)}</b> {tr('homologations', 'validated rides')}
              </p>
            </div>
            <div className="cx-seg cx-seg--formule" role="group" aria-label={tr('Formule obtenue', 'Formula achieved')}>
              <button type="button" aria-pressed={!formule} onClick={() => setFormule('')}>
                {tr('Toutes', 'All')}
              </button>
              {['O', 'A', 'B'].map((c) => (
                <button key={c} type="button" aria-pressed={formule === c} onClick={() => setFormule(c)}>
                  <i style={{ background: COULEUR_FORMULE[c] }} />
                  {NF[c]} <b>{fo[c]}</b>
                </button>
              ))}
            </div>
            <div className="civ__actions">
              <button type="button" className="btn btn--primary btn--sm" onClick={() => onOpenParticipant(sel.id)}>
                <Icon name="trophy" size={14} /> {tr('Fiche palmarès', 'Rider record')}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSel(null)}
                aria-label={tr('Retirer le participant', 'Remove the rider')}
                title={tr('Retirer', 'Remove')}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
        )}

        <div className={`cx-stage${plein ? ' is-plein' : ''}`} ref={stageRef}>
          <aside className="cx-list" aria-label={tr('Liste des flèches', 'List of Flèches')}>
            <div className="cx-list__head">
              <div className="cx-list__filtre">
                <Icon name="search" size={14} />
                <label htmlFor="cx-filtre" className="sr-only">
                  {tr('Filtrer les flèches', 'Filter the Flèches')}
                </label>
                <input
                  id="cx-filtre"
                  type="search"
                  value={filtre}
                  placeholder={tr('Filtrer les flèches', 'Filter the Flèches')}
                  onChange={(e) => setFiltre(e.target.value)}
                />
              </div>
              <div className="cx-tri" role="group" aria-label={tr('Trier', 'Sort')}>
                {TRIS.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={tri === x.id}
                    onClick={() => setTri(x.id)}
                    title={tr(`Trier par ${x.label.toLowerCase()}`, `Sort by ${x.en.toLowerCase()}`)}
                  >
                    <Icon name={x.icon} size={13} /> {tr(x.label, x.en)}
                  </button>
                ))}
              </div>
            </div>
            <ul className="cx-items" ref={listeRef}>
              {liste.map((f) => {
                const { mode, e } = etatDe(f)
                const couleur =
                  mode === 'base'
                    ? couleurDistance(f.km)
                    : mode === 'manquante'
                      ? COULEUR.manquante
                      : COULEUR.realisee
                const on = focus === f.id
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      data-fid={f.id}
                      className={`cx-item${on ? ' is-focus' : ''}${actif === f.id ? ' is-active' : ''}${
                        mode === 'manquante' ? ' is-manquante' : ''
                      }`}
                      aria-current={actif === f.id || undefined}
                      onClick={() => choisirFleche(f)}
                      onMouseEnter={() => setSurvol(f.id)}
                      onMouseLeave={() => setSurvol(null)}
                      onFocus={() => setSurvol(f.id)}
                      onBlur={() => setSurvol(null)}
                    >
                      <span className="cx-item__ico" style={{ '--c': couleur }}>
                        <Icon name={mode === 'realisee' ? 'check' : 'arrow-up-right'} size={14} />
                      </span>
                      <span className="cx-item__txt">
                        <b>{f.nom}</b>
                        <span>
                          {fmt(f.km)} km · {fmt(f.dplus)} m D+
                        </span>
                        <span className="cx-item__bar" aria-hidden="true">
                          <i style={{ width: `${(f.km / kmMax) * 100}%`, background: couleur }} />
                        </span>
                      </span>
                      <span className="cx-item__side">
                        {mode === 'realisee' ? (
                          <Badge code={e.formule} />
                        ) : mode === 'manquante' ? (
                          <span className="cx-item__todo">{tr('à faire', 'to do')}</span>
                        ) : (
                          <span className="cx-item__nb" title={tr('Homologations', 'Validated rides')}>
                            <Icon name="medal" size={12} /> {fmt(f.stats.total)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
              {liste.length === 0 && <li className="cx-empty">{tr('Aucune flèche ne correspond.', 'No Flèche matches.')}</li>}
            </ul>
          </aside>

          <div className="cx-map">
            <div
              ref={mapEl}
              className="map-canvas cx-canvas"
              role="application"
              aria-label={tr('Carte des 20 Flèches de France', 'Map of the 20 Flèches de France')}
            />

            <div className="cx-tools">
              {!sel && (
                <button
                  type="button"
                  className="cx-tool cx-tool--accent"
                  onClick={histo === null ? rejouer : () => (setLecture(false), setHisto(null))}
                  aria-pressed={histo !== null}
                  title={tr("Rejouer l'histoire des Flèches saison par saison", 'Replay the Flèches history season by season')}
                >
                  <Icon name={histo === null ? 'history' : 'x'} size={16} />
                  <span>{histo === null ? tr("Rejouer l'histoire", 'Replay history') : tr('Quitter', 'Exit')}</span>
                </button>
              )}
              <button type="button" className="cx-tool" onClick={recentrer} title={tr('Recentrer sur la France', 'Recentre on France')}>
                <Icon name="crosshair" size={16} />
                <span>{tr('Recentrer', 'Recentre')}</span>
              </button>
              <button
                type="button"
                className="cx-tool"
                onClick={basculerPleinEcran}
                aria-pressed={plein}
                title={plein ? tr('Quitter le plein écran', 'Exit full screen') : tr('Plein écran', 'Full screen')}
              >
                <Icon name={plein ? 'minimize' : 'maximize'} size={16} />
                <span>{plein ? tr('Réduire', 'Exit') : tr('Plein écran', 'Full screen')}</span>
              </button>
            </div>

            {!molette && (
              <p className="cx-hint" aria-hidden="true">
                <Icon name="mouse" size={14} />{' '}
                {tr('Cliquez sur la carte pour zoomer à la molette', 'Click the map to zoom with the scroll wheel')}
              </p>
            )}

            {!tuilesOk && !offlineVu && (
              <p className="cx-offline" role="status">
                <Icon name="info" size={14} />{' '}
                {tr('Fond de carte indisponible : contour local affiché.', 'Base map unavailable: showing local outline.')}
                <button type="button" onClick={() => setOfflineVu(true)} aria-label={tr('Masquer', 'Hide')}>
                  <Icon name="x" size={13} />
                </button>
              </p>
            )}

            {histo !== null && (
              <div className="cx-histo" role="group" aria-label={tr('Chronologie des homologations', 'Validated rides timeline')}>
                <button
                  type="button"
                  className="cx-histo__play"
                  onClick={() => {
                    const dernier = chrono.annees[chrono.annees.length - 1]
                    if (!lecture && histo >= dernier) setHisto(chrono.annees[0])
                    setLecture((v) => !v)
                  }}
                  aria-label={lecture ? tr('Pause', 'Pause') : tr('Lecture', 'Play')}
                >
                  <Icon name={lecture ? 'pause' : 'play'} size={18} />
                </button>
                <div className="cx-histo__body">
                  <div className="cx-histo__top">
                    <b className="cx-histo__an" key={histo}>
                      {histo}
                    </b>
                    <span className="cx-histo__tot">
                      <Compteur v={chrono.cumul.get(histo)?.total ?? 0} ms={600} />{' '}
                      {tr('homologations cumulées', 'validated rides so far')}
                      <em>
                        {' '}
                        · +{fmt([...(chrono.cumul.get(histo)?.saison.values() ?? [])].reduce((a, n) => a + n, 0))}{' '}
                        {tr('cette saison', 'this season')}
                      </em>
                    </span>
                  </div>
                  <label className="sr-only" htmlFor="cx-histo-an">
                    {tr('Saison', 'Season')}
                  </label>
                  <input
                    id="cx-histo-an"
                    type="range"
                    min={chrono.annees[0]}
                    max={chrono.annees[chrono.annees.length - 1]}
                    step={1}
                    value={histo}
                    style={{
                      '--p': `${
                        ((histo - chrono.annees[0]) /
                          Math.max(1, chrono.annees[chrono.annees.length - 1] - chrono.annees[0])) *
                        100
                      }%`,
                    }}
                    onChange={(e) => {
                      setLecture(false)
                      const v = Number(e.target.value)
                      setHisto(chrono.annees.reduce((a, y) => (y <= v ? y : a), chrono.annees[0]))
                    }}
                  />
                  <div className="cx-histo__bornes" aria-hidden="true">
                    <span>{chrono.annees[0]}</span>
                    <span>{tr("épaisseur de l'arc = nombre d'homologations", 'arc thickness = number of validated rides')}</span>
                    <span>{chrono.annees[chrono.annees.length - 1]}</span>
                  </div>
                </div>
              </div>
            )}

            <div className={`cx-legend${histo !== null ? ' is-hidden' : ''}`}>
              {sel ? (
                <>
                  <span>
                    <i style={{ background: COULEUR.realisee }} /> {tr('Validée', 'Validated')}
                  </span>
                  <span>
                    <i className="is-dash" style={{ borderColor: COULEUR.manquante }} /> {tr('À réaliser', 'To ride')}
                  </span>
                </>
              ) : (
                TRANCHES_KM.slice(1).map((x) => (
                  <span key={x.id}>
                    <i style={{ background: x.couleur }} /> {x.label}
                  </span>
                ))
              )}
              <span>
                <i className="is-dot" style={{ background: COULEUR.depart }} /> {tr('Départ décalé', 'Alternative start')}
              </span>
            </div>
          </div>
        </div>

        <p className="t-small muted map-note">
          <Icon name="info" size={13} />{' '}
          {tr(
            'Arcs schématiques Paris → ville d’arrivée ; le sens du parcours reste libre (Paris-Province ou Province-Paris). Survolez une flèche pour la mettre en avant, cliquez pour sa fiche.',
            'Schematic arcs from Paris → finish town; you are free to ride in either direction (Paris to the regions or back). Hover a Flèche to highlight it, click it for its profile.',
          )}
        </p>
      </div>

      {planif && (
        <Planificateur fleches={fleches} initialId={planif} onClose={() => setPlanif(null)} />
      )}
    </section>
  )
}
