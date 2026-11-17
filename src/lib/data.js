/* Chargement et exploration des JSON produits par scripts/build_data.py.
   Tout est servi depuis ./public/data : aucune requête réseau externe. */

const BASE = new URL('data/', document.baseURI)

const cache = new Map()

export function loadJSON(file) {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(new URL(file, BASE))
        .then((r) => {
          if (!r.ok) throw new Error(`${file} : HTTP ${r.status}`)
          return r.json()
        })
        .catch((e) => {
          cache.delete(file)
          throw e
        }),
    )
  }
  return cache.get(file)
}

/** Toutes les tables nécessaires aux vues, chargées une seule fois. */
export function loadAll() {
  return Promise.all([
    loadJSON('index.json'),
    loadJSON('fleches.json'),
    loadJSON('participants.json'),
    loadJSON('homologations.json'),
    loadJSON('clubs.json'),
    loadJSON('stats.json'),
    loadJSON('defis.json'),
    loadJSON('departements.json'),
  ]).then(
    ([index, fleches, participants, homologations, clubs, stats, defis, departements]) => {
      normaliserDestinations(fleches.fleches, participants.rows, homologations.rows)
      licenceDerniere(participants.rows, homologations.rows, defis)
      const express = calculerExpress(participants.rows, fleches.fleches, homologations.rows)
      defis.express = express.laureats
      defis.expressAVerifier = express.aVerifier
      return {
      meta: index.meta,
      fleches: fleches.fleches,
      participants: participants.rows,
      homologations: homologations.rows,
      clubs: clubs.rows,
      stats,
      defis,
      departements: departements.rows,
      }
    },
  )
}

/* Le classeur source nomme parfois une destination autrement que le
   référentiel (« LE MONT SAINT MICHEL » contre « MONT ST MICHEL ») : sans
   cet alignement, la flèche n'apparaissait jamais validée dans les fiches,
   la carte d'un participant ni le filtre par flèche de l'annuaire. */
const ALIAS_DEST = { 'LE MONT SAINT MICHEL': 'MONT ST MICHEL', 'MONT SAINT MICHEL': 'MONT ST MICHEL' }

function normaliserDestinations(fleches, participants, homologations) {
  const ids = new Set(fleches.map((f) => f.id))
  const canon = (d) => (ids.has(d) ? d : (ALIAS_DEST[d] ?? d))
  for (const h of homologations) h.dest = canon(h.dest)
  for (const p of participants) if (Array.isArray(p.dests)) p.dests = [...new Set(p.dests.map(canon))]
}

/* Club et fédération d'un participant = ceux de sa DERNIÈRE homologation
   (date de réalisation, puis n° d'homologation), et non la dernière valeur
   lue dans le classeur, qui n'est pas dans l'ordre chronologique. Les
   listes des défis reprennent la même licence. */
function licenceDerniere(participants, homologations, defis) {
  const cle = (h) => `${h.date || `${h.annee}-12-31`}|${String(h.num ?? 0).padStart(6, '0')}`
  const dernier = new Map()
  for (const h of homologations) {
    if (!h.club) continue
    const cur = dernier.get(h.pid)
    if (!cur || cle(h) > cle(cur)) dernier.set(h.pid, h)
  }
  const byId = new Map()
  for (const p of participants) {
    byId.set(p.id, p)
    const h = dernier.get(p.id)
    if (!h) continue
    p.club = h.club
    if (h.fede) p.fede = h.fede
  }
  for (const liste of [defis.complete ?? [], defis.express ?? []]) {
    for (const c of liste) {
      const p = byId.get(c.id)
      if (p) c.club = p.club
    }
  }
}

/* --- La Complète express ------------------------------------------------
   Défi : les 20 Flèches homologuées en 12 mois au plus. Le calcul est fait
   sur tout le journal, cycliste par cycliste, et ne dépend plus de la liste
   du classeur :
   - dates connues (depuis 2022) : fenêtre glissante de 12 mois — de la
     première Flèche à la 20e destination distincte, la plus courte trouvée ;
   - éditions anciennes (seule l'année est connue) : les 20 destinations
     dans un même millésime, qui couvre une année des Flèches (art. 3 :
     du 1er octobre au 30 septembre) ;
   - 20 destinations réparties sur deux millésimes consécutifs sans dates :
     impossible de savoir si cela tient en 12 mois, le cas est signalé
     « à vérifier » sans être compté. */

const datePrecise = (h) => Boolean(h.date) && !h.date.endsWith('-01-01')

function plus12Mois(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const fin = new Date(Date.UTC(y + 1, m - 1, d))
  // 29 février + 1 an → 28 février
  if (fin.getUTCMonth() !== m - 1) fin.setUTCDate(0)
  return fin.toISOString().slice(0, 10)
}

const jours = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

function calculerExpress(participants, fleches, homologations) {
  const total = fleches.length
  const ids = new Set(fleches.map((f) => f.id))
  const parPid = new Map()
  for (const h of homologations) {
    if (!ids.has(h.dest)) continue
    let a = parPid.get(h.pid)
    if (!a) parPid.set(h.pid, (a = []))
    a.push(h)
  }

  const laureats = []
  const aVerifier = []
  for (const p of participants) {
    const mes = parPid.get(p.id)
    if (!mes || new Set(mes.map((h) => h.dest)).size < total) continue
    const ident = { id: p.id, nom: `${p.nom} ${p.prenom}`, sexe: p.sexe, club: p.club }

    // 1. fenêtre glissante de 12 mois sur les dates connues
    const precises = mes.filter(datePrecise).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    let best = null
    for (let i = 0; i < precises.length; i++) {
      const debut = precises[i].date
      const limite = plus12Mois(debut)
      const vues = new Set()
      for (let j = i; j < precises.length && precises[j].date < limite; j++) {
        vues.add(precises[j].dest)
        if (vues.size === total) {
          const fin = precises[j].date
          if (!best || jours(debut, fin) < jours(best.debut, best.fin)) best = { debut, fin }
          break
        }
      }
    }
    if (best) {
      const dans = precises.filter((h) => h.date >= best.debut && h.date <= best.fin)
      laureats.push({
        ...ident,
        mode: 'dates',
        debut: best.debut,
        fin: best.fin,
        jours: jours(best.debut, best.fin),
        annee: Number(best.fin.slice(0, 4)),
        nb: dans.length,
        nbDest: new Set(dans.map((h) => h.dest)).size,
        km: dans.reduce((a, h) => a + (h.km || 0), 0),
      })
      continue
    }

    // 2. éditions anciennes : un millésime complet
    const parAn = new Map()
    for (const h of mes) {
      let s = parAn.get(h.annee)
      if (!s) parAn.set(h.annee, (s = []))
      s.push(h)
    }
    const saison = [...parAn.entries()]
      .filter(([, hs]) => new Set(hs.map((h) => h.dest)).size >= total)
      .sort((a, b) => a[0] - b[0])[0]
    if (saison) {
      const [annee, hs] = saison
      laureats.push({
        ...ident,
        mode: 'saison',
        annee,
        saisonDebut: `${annee - 1}-10-01`,
        saisonFin: `${annee}-09-30`,
        nb: hs.length,
        nbDest: new Set(hs.map((h) => h.dest)).size,
        km: hs.reduce((a, h) => a + (h.km || 0), 0),
      })
      continue
    }

    // 3. deux millésimes consécutifs sans dates : à vérifier
    for (const [annee, hs] of parAn) {
      const suiv = parAn.get(annee + 1)
      if (!suiv) continue
      const tout = [...hs, ...suiv]
      if (tout.some(datePrecise)) continue
      if (new Set(tout.map((h) => h.dest)).size >= total) {
        aVerifier.push({ ...ident, annees: [annee, annee + 1] })
        break
      }
    }
  }
  laureats.sort((a, b) => (a.debut || `${a.annee}`).localeCompare(b.debut || `${b.annee}`))
  return { laureats, aVerifier }
}

/* --- Recherche sans accent ni casse ------------------------------------- */

export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Index de recherche pré-compilé : nom, prénom, commune, n° d'homologation. */
export function buildIndex(participants) {
  const map = new Map()
  for (const p of participants) {
    map.set(p.id, norm(`${p.nom} ${p.prenom} ${p.ville} ${p.club} ${p.code}`))
  }
  return map
}

/* --- Formats ------------------------------------------------------------- */

/* Langue d'affichage des nombres : réglée par l'application au changement
   de langue (espace fine en français, virgule en anglais). */
let LOCALE = 'fr-FR'
export function setLocale(lang) {
  LOCALE = lang === 'en' ? 'en-GB' : 'fr-FR'
}

export function fmt(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(LOCALE).format(n)
}

export function fmtKm(n) {
  return n === null || n === undefined ? '—' : `${fmt(n)} km`
}

export function fmtDate(iso) {
  if (!iso || typeof iso !== 'string') return '—'
  const [y, m, d] = iso.split('-')
  if (!y) return '—'
  return m && d ? `${d}/${m}/${y}` : y
}

export const FORMULES = [
  { code: 'O', nom: 'Or', en: 'Gold' },
  { code: 'A', nom: 'Argent', en: 'Silver' },
  { code: 'B', nom: 'Bronze', en: 'Bronze' },
]

export const TRANCHES = [
  { code: 'a', nom: '65 ans et plus', en: '65 and over' },
  { code: 'b', nom: '50 à 65 ans', en: '50 to 65' },
  { code: 'c', nom: '35 à 50 ans', en: '35 to 50' },
  { code: 'd', nom: '20 à 35 ans', en: '20 to 35' },
  { code: 'e', nom: 'moins de 20 ans', en: 'under 20' },
]

/** Nom d'une formule dans la langue courante. */
export function nomFormule(code, lang) {
  const f = FORMULES.find((x) => x.code === code)
  return f ? (lang === 'en' ? f.en : f.nom) : null
}

/** Libellé d'une tranche d'âge dans la langue courante. */
export function nomTranche(code, lang) {
  const t = TRANCHES.find((x) => x.code === code)
  return t ? (lang === 'en' ? t.en : t.nom) : null
}

/* --- Export CSV (RFC 4180, séparateur ; pour Excel FR) -------------------- */

function cell(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCSV(filename, columns, rows) {
  const head = columns.map((c) => cell(c.label)).join(';')
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(';')).join('\r\n')
  const blob = new Blob(['\ufeff', head, '\r\n', body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
