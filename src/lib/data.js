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

export function fmt(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('fr-FR').format(n)
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
  { code: 'O', nom: 'Or' },
  { code: 'A', nom: 'Argent' },
  { code: 'B', nom: 'Bronze' },
]

export const TRANCHES = [
  { code: 'a', nom: '65 ans et plus' },
  { code: 'b', nom: '50 à 65 ans' },
  { code: 'c', nom: '35 à 50 ans' },
  { code: 'd', nom: '20 à 35 ans' },
  { code: 'e', nom: 'moins de 20 ans' },
]

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
