import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useData, useRoute } from '../lib/store.jsx'
import { fmt, fmtKm, norm, downloadCSV } from '../lib/data.js'

/* ------------------------------------------------------------------ */
/*  Vue « Clubs & Statistiques » : classement, fiche club, saison       */
/* ------------------------------------------------------------------ */

/* 455 clubs sur une seule page donnerait ~27 000 px de défilement : le
   classement se lit par pages, comme l'annuaire. */
const PAR_PAGE = 25

const COLS = [
  { key: 'km', label: 'Km' },
  { key: 'nb', label: 'Flèches' },
  { key: 'participants', label: 'Fléchards' },
  { key: 'O', label: 'Or' },
  { key: 'A', label: 'Argent' },
  { key: 'B', label: 'Bronze' },
]

export default function Clubs() {
  const { data } = useData()
  const [, go] = useRoute()
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState('km')
  const [page, setPage] = useState(1)
  const [ouvert, setOuvert] = useState(null) // nom du club affiché en fiche

  const clubs = data.clubs ?? []
  const participants = data.participants ?? []

  /* index club normalisé → dévoilés (pour la fiche club) */
  const parClub = useMemo(() => {
    const m = new Map()
    for (const p of participants) {
      const k = norm(p.club)
      if (!k) continue
      let a = m.get(k)
      if (!a) {
        a = []
        m.set(k, a)
      }
      a.push(p)
    }
    return m
  }, [participants])

  const liste = useMemo(() => {
    const nq = norm(q)
    const out = clubs.filter((c) => !nq || norm(`${c.nom} ${c.code}`).includes(nq))
    out.sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0) || a.nom.localeCompare(b.nom, 'fr'))
    return out
  }, [clubs, q, sortBy])

  useEffect(() => setPage(1), [q, sortBy])

  const pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE))
  const pageSure = Math.min(page, pages)
  const visible = liste.slice((pageSure - 1) * PAR_PAGE, pageSure * PAR_PAGE)

  const records = useMemo(() => {
    const top = (key) =>
      [...clubs]
        .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
        .slice(0, 3)
        .map((c) => ({ nom: c.nom, v: c[key] }))
    return { km: top('km'), nb: top('nb'), participants: top('participants') }
  }, [clubs])

  const annees = data.stats?.annees ?? []

  const exporter = () =>
    downloadCSV(
      `clubs-fleches-de-france-${liste.length}.csv`,
      [
        { label: 'Rang km', value: (c) => c.rangKm },
        { label: 'Rang flèches', value: (c) => c.rangNb },
        { label: 'Club', value: (c) => c.nom },
        { label: 'Code club', value: (c) => c.code },
        { label: 'Km', value: (c) => c.km },
        { label: 'Flèches', value: (c) => c.nb },
        { label: 'Fléchards', value: (c) => c.participants },
        { label: 'Or', value: (c) => c.O },
        { label: 'Argent', value: (c) => c.A },
        { label: 'Bronze', value: (c) => c.B },
      ],
      liste,
    )

  const club = ouvert ? clubs.find((c) => c.nom === ouvert) : null

  return (
    <section className="section section--page" aria-labelledby="h-clubs">
      <div className="wrap">
        <div className="section-head section-head--row">
          <h1 id="h-clubs" className="t-h2">
            Clubs & statistiques{' '}
            <span className="muted">
              {fmt(clubs.length)} clubs · {fmt(meta(clubs, 'km'))} km cumulés
            </span>
          </h1>
        </div>

        <div className="toolbar" role="search" aria-label="Filtres du classement des clubs">
          <div className="toolbar__field toolbar__field--wide">
            <label htmlFor="cl-q"><Icon name="search" size={13} /> Rechercher un club</label>
            <input
              id="cl-q"
              type="search"
              value={q}
              placeholder="Nom du club ou code (FR783635…)"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="toolbar__field">
            <label htmlFor="cl-tri"><Icon name="list" size={13} /> Trier par</label>
            <select id="cl-tri" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {COLS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar__field toolbar__field--action">
            <span className="toolbar__count">
              <b>{fmt(liste.length)}</b> clubs
            </span>
            <button type="button" className="btn btn--secondary btn--sm" onClick={exporter}>
              <Icon name="download" size={15} /> Exporter en CSV
            </button>
          </div>
        </div>

        <div className="result-line">
          <span>
            Classement par <strong>{COLS.find((c) => c.key === sortBy)?.label.toLowerCase()}</strong> —
            cliquez sur un club pour ouvrir sa fiche.
          </span>
        </div>

        <div className="table-scroll">
          <table className="table-app">
            <caption className="sr-only">Classement des clubs des Flèches de France</caption>
            <thead>
              <tr>
                <th scope="col" className="num">
                  Rang
                </th>
                <th scope="col">Club</th>
                <th scope="col">Code</th>
                <th scope="col" className="num">
                  Km
                </th>
                <th scope="col" className="num">
                  Flèches
                </th>
                <th scope="col" className="num">
                  Fléchards
                </th>
                <th scope="col" className="num">
                  Or
                </th>
                <th scope="col" className="num">
                  Argent
                </th>
                <th scope="col" className="num">
                  Bronze
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c, i) => (
                <tr key={`${c.nom}-${c.code}`}>
                  <td className="num">{(pageSure - 1) * PAR_PAGE + i + 1}</td>
                  <th scope="row">
                    <button
                      type="button"
                      className="row-link"
                      onClick={() => setOuvert(ouvert === c.nom ? null : c.nom)}
                      aria-expanded={ouvert === c.nom}
                    >
                      {c.nom}
                    </button>
                  </th>
                  <td className="muted">{c.code || '—'}</td>
                  <td className="num">{fmt(c.km)}</td>
                  <td className="num">{fmt(c.nb)}</td>
                  <td className="num">{fmt(c.participants)}</td>
                  <td className="num">{fmt(c.O)}</td>
                  <td className="num">{fmt(c.A)}</td>
                  <td className="num">{fmt(c.B)}</td>
                </tr>
              ))}
              {liste.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    Aucun club ne correspond à « {q} ».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav className="pager" aria-label="Pagination du classement des clubs">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={pageSure === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Icon name="chevron-left" size={15} /> Précédent
            </button>
            <span className="muted">
              Page {pageSure} / {pages}
            </span>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={pageSure === pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Suivant <Icon name="chevron-right" size={15} />
            </button>
          </nav>
        )}

        {club && (
          <FicheClub club={club} parClub={parClub} onClose={() => setOuvert(null)} onGo={go} />
        )}

        {/* --------------------------------------------- statistiques annuelles */}
        <div className="section-head section-head--row">
          <h2 className="t-h2">Évolution annuelle</h2>
          <p className="result-line">
            <strong>{annees.length}</strong> saisons de 1997 à 2026
          </p>
        </div>

        <div className="table-scroll">
          <table className="table-app">
            <caption className="sr-only">Statistiques annuelles des Flèches de France</caption>
            <thead>
              <tr>
                <th scope="col">Année</th>
                <th scope="col" className="num">
                  Homologations
                </th>
                <th scope="col" className="num">
                  Fléchards
                </th>
                <th scope="col" className="num">
                  Nouveaux
                </th>
                <th scope="col" className="num">
                  Femmes
                </th>
                <th scope="col" className="num">
                  Hommes
                </th>
                <th scope="col" className="num">
                  Km
                </th>
                <th scope="col" className="num">
                  Or
                </th>
                <th scope="col" className="num">
                  Argent
                </th>
                <th scope="col" className="num">
                  Bronze
                </th>
              </tr>
            </thead>
            <tbody>
              {annees.map((a) => (
                <tr key={a.annee}>
                  <th scope="row">{a.annee}</th>
                  <td className="num">{fmt(a.nb)}</td>
                  <td className="num">{fmt(a.participants)}</td>
                  <td className="num">{fmt(a.nouveaux)}</td>
                  <td className="num">{fmt(a.femmes)}</td>
                  <td className="num">{fmt(a.hommes)}</td>
                  <td className="num">{fmt(a.km)}</td>
                  <td className="num">{fmt(a.O)}</td>
                  <td className="num">{fmt(a.A)}</td>
                  <td className="num">{fmt(a.B)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --------------------------------------------------------- records */}
        <div className="section-head">
          <h2 className="t-h2">Têtes de classement</h2>
        </div>
        <div className="kpis kpis--records">
          {[
            ['Plus gros cumul de km', records.km, (v) => fmtKm(v)],
            ['Plus de flèches homologuées', records.nb, (v) => fmt(v)],
            ['Plus de dévoilés', records.participants, (v) => fmt(v)],
          ].map(([titre, top, format]) => (
            <div className="kpi" key={titre}>
              <b className="kpi__l">{titre}</b>
              <ol className="record-list">
                {top.map((x, i) => (
                  <li key={x.nom}>
                    <span className="record-rang">{i + 1}</span>
                    <span className="record-nom">{x.nom}</span>
                    <b className="record-v">{format(x.v)}</b>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function meta(clubs, key) {
  return clubs.reduce((s, c) => s + (c[key] || 0), 0)
}

/* ------------------------------------------------------------------ */

function FicheClub({ club, parClub, onClose, onGo }) {
  const membres = useMemo(
    () =>
      (parClub.get(norm(club.nom)) ?? [])
        .slice()
        .sort((a, b) => b.nb - a.nb || a.nom.localeCompare(b.nom, 'fr'))
        .slice(0, 40),
    [parClub, club.nom],
  )

  const annees = useMemo(() => {
    const years = new Set([
      ...Object.keys(club.parAnnee ?? {}),
      ...Object.keys(club.parAnneeKm ?? {}),
    ])
    return [...years]
      .sort((a, b) => b - a)
      .map((y) => ({
        annee: y,
        nb: club.parAnnee?.[y] ?? 0,
        km: club.parAnneeKm?.[y] ?? 0,
      }))
  }, [club])

  return (
    <section className="fiche-club" aria-label={`Fiche du club ${club.nom}`}>
      <div className="section-head section-head--row">
        <h3 className="t-h3">
          {club.nom} <span className="muted">code {club.code || '—'}</span>
        </h3>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onClose}>
          Fermer la fiche
        </button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <b className="kpi__v">{fmt(club.km)}</b>
          <span className="kpi__l">Kilomètres cumulés</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{fmt(club.nb)}</b>
          <span className="kpi__l">Flèches homologuées</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{fmt(club.participants)}</b>
          <span className="kpi__l">Fléchards du club</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">
            {fmt(club.O)} · {fmt(club.A)} · {fmt(club.B)}
          </b>
          <span className="kpi__l">Or · Argent · Bronze</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">#{club.rangKm}</b>
          <span className="kpi__l">Rang km (#{club.rangNb} flèches)</span>
        </div>
      </div>

      <div className="split-pair">
        <div>
          <h3 className="t-h3 fiche-h">Flèches par saison</h3>
          <div className="table-scroll table-scroll--short">
            <table className="table-app">
              <caption className="sr-only">Flèches du club par saison</caption>
              <thead>
                <tr>
                  <th scope="col">Année</th>
                  <th scope="col" className="num">
                    Flèches
                  </th>
                  <th scope="col" className="num">
                    Km
                  </th>
                </tr>
              </thead>
              <tbody>
                {annees.map((a) => (
                  <tr key={a.annee}>
                    <th scope="row">{a.annee}</th>
                    <td className="num">{fmt(a.nb)}</td>
                    <td className="num">{fmt(a.km)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="t-h3 fiche-h">Meilleurs dévoilés</h3>
          {membres.length === 0 ? (
            <p className="muted">Aucun dévoilé rattaché à ce club dans l'annuaire.</p>
          ) : (
            <div className="rows-app">
              {membres.map((p) => (
                <div className="row-app" key={p.id}>
                  <span className="row-app__main">
                    <button
                      type="button"
                      className="row-link"
                      onClick={() => onGo('annuaire', `pid=${p.id}`)}
                    >
                      <b>
                        {p.nom} {p.prenom}
                      </b>
                    </button>
                    <span className="muted">{p.sexe}</span>
                    <span className="row-app__meta">{p.ville || '—'}</span>
                  </span>
                  <span className="row-app__meta">
                    {fmt(p.nb)} flèches · {fmt(p.km)} km · O {fmt(p.O)} · A {fmt(p.A)} · B{' '}
                    {fmt(p.B)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {membres.length === 40 && (
            <p className="t-small muted">
              40 premiers dévoilés affichés — ouvrez l'annuaire pour la liste complète.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
