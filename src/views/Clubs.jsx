import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useData, useRoute } from '../lib/store.jsx'
import { fmt, fmtKm, norm, downloadCSV } from '../lib/data.js'
import { useL } from '../lib/i18n.js'

/* ------------------------------------------------------------------ */
/*  Vue « Clubs & Statistiques » : classement, fiche club, saison       */
/* ------------------------------------------------------------------ */

/* 455 clubs sur une seule page donnerait ~27 000 px de défilement : le
   classement se lit par pages, comme l'annuaire. */
const PAR_PAGE = 25

const COLS = [
  { key: 'km', label: 'Km', en: 'Km' },
  { key: 'nb', label: 'Flèches', en: 'Flèches' },
  { key: 'participants', label: 'Fléchards', en: 'Riders' },
  { key: 'O', label: 'Or', en: 'Gold' },
  { key: 'A', label: 'Argent', en: 'Silver' },
  { key: 'B', label: 'Bronze', en: 'Bronze' },
]

export default function Clubs() {
  const { data } = useData()
  const L = useL()
  const [, go] = useRoute()
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState('km')
  const [sens, setSens] = useState(-1) // -1 : du plus grand au plus petit
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
    out.sort((a, b) => ((a[sortBy] ?? 0) - (b[sortBy] ?? 0)) * sens || a.nom.localeCompare(b.nom, 'fr'))
    return out
  }, [clubs, q, sortBy, sens])

  useEffect(() => setPage(1), [q, sortBy, sens])

  /* Clic sur une colonne : trie dessus (du plus grand au plus petit) ;
     second clic sur la même colonne : inverse l'ordre. */
  const trierPar = (key) => {
    if (key === sortBy) setSens((x) => -x)
    else {
      setSortBy(key)
      setSens(-1)
    }
  }
  const enTete = (key, libelle) => {
    const actif = sortBy === key
    return (
      <th key={key} scope="col" className={`num th-click${actif ? ' is-sorted' : ''}`} aria-sort={actif ? (sens > 0 ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className={`th-sort${actif ? ' is-active' : ''}`}
          onClick={() => trierPar(key)}
          title={L('Cliquer pour trier', 'Click to sort')}
        >
          {libelle}
          <span className="th-sort__ico" aria-hidden="true">
            {actif ? (sens > 0 ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

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
        { label: L('Rang km', 'Km rank'), value: (c) => c.rangKm },
        { label: L('Rang flèches', 'Flèches rank'), value: (c) => c.rangNb },
        { label: 'Club', value: (c) => c.nom },
        { label: L('Code club', 'Club code'), value: (c) => c.code },
        { label: 'Km', value: (c) => c.km },
        { label: 'Flèches', value: (c) => c.nb },
        { label: L('Fléchards', 'Riders'), value: (c) => c.participants },
        { label: L('Or', 'Gold'), value: (c) => c.O },
        { label: L('Argent', 'Silver'), value: (c) => c.A },
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
            {L('Clubs & statistiques', 'Clubs & statistics')}{' '}
            <span className="muted">
              {fmt(clubs.length)} clubs · {fmt(meta(clubs, 'km'))} {L('km cumulés', 'km in total')}
            </span>
          </h1>
        </div>

        <div className="toolbar" role="search" aria-label={L('Filtres du classement des clubs', 'Club ranking filters')}>
          <div className="toolbar__field toolbar__field--wide">
            <label htmlFor="cl-q"><Icon name="search" size={13} /> {L('Rechercher un club', 'Search a club')}</label>
            <input
              id="cl-q"
              type="search"
              value={q}
              placeholder={L('Nom du club ou code (FR783635…)', 'Club name or code (FR783635…)')}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="toolbar__field toolbar__field--action">
            <span className="toolbar__count">
              <b>{fmt(liste.length)}</b> clubs
            </span>
            <button type="button" className="btn btn--secondary btn--sm" onClick={exporter}>
              <Icon name="download" size={15} /> {L('Exporter en CSV', 'Export CSV')}
            </button>
          </div>
        </div>

        <div className="result-line">
          <span>
            {L('Classement par ', 'Ranked by ')}
            <strong>
              {(() => {
                const c = COLS.find((x) => x.key === sortBy)
                return c ? L(c.label, c.en).toLowerCase() : ''
              })()}
            </strong>
            {sens > 0 ? L(' (ordre croissant)', ' (ascending)') : ''}
            {L(
              ' — cliquez en haut d’une colonne (Km, Flèches, Fléchards…) pour classer selon elle, une seconde fois pour inverser.',
              ' — click the top of a column (Km, Flèches, Riders…) to rank by it, once more to reverse.',
            )}
          </span>
        </div>

        <div className="table-scroll">
          <table className="table-app">
            <caption className="sr-only">{L('Classement des clubs des Flèches de France', 'Flèches de France club ranking')}</caption>
            <thead>
              <tr>
                <th scope="col" className="num">
                  {L('Rang', 'Rank')}
                </th>
                <th scope="col">Club</th>
                <th scope="col">Code</th>
                {COLS.map((c) => enTete(c.key, c.key === 'km' || c.key === 'B' ? c.label : L(c.label, c.en)))}
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
                  {COLS.map((col) => (
                    <td key={col.key} className={`num${sortBy === col.key ? ' is-sorted' : ''}`}>
                      {fmt(c[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
              {liste.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    {L(`Aucun club ne correspond à « ${q} ».`, `No club matches “${q}”.`)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav className="pager" aria-label={L('Pagination du classement des clubs', 'Club ranking pagination')}>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={pageSure === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Icon name="chevron-left" size={15} /> {L('Précédent', 'Previous')}
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
              {L('Suivant', 'Next')} <Icon name="chevron-right" size={15} />
            </button>
          </nav>
        )}

        {club && (
          <FicheClub club={club} parClub={parClub} onClose={() => setOuvert(null)} onGo={go} L={L} />
        )}

        {/* --------------------------------------------- statistiques annuelles */}
        <div className="section-head section-head--row">
          <h2 className="t-h2">{L('Évolution annuelle', 'Year by year')}</h2>
          <p className="result-line">
            <strong>{annees.length}</strong> {L('saisons de 1997 à 2026', 'seasons from 1997 to 2026')}
          </p>
        </div>

        <div className="table-scroll">
          <table className="table-app">
            <caption className="sr-only">{L('Statistiques annuelles des Flèches de France', 'Flèches de France yearly statistics')}</caption>
            <thead>
              <tr>
                <th scope="col">{L('Année', 'Year')}</th>
                <th scope="col" className="num">
                  {L('Homologations', 'Validated rides')}
                </th>
                <th scope="col" className="num">
                  {L('Fléchards', 'Riders')}
                </th>
                <th scope="col" className="num">
                  {L('Nouveaux', 'Newcomers')}
                </th>
                <th scope="col" className="num">
                  {L('Femmes', 'Women')}
                </th>
                <th scope="col" className="num">
                  {L('Hommes', 'Men')}
                </th>
                <th scope="col" className="num">
                  Km
                </th>
                <th scope="col" className="num">
                  {L('Or', 'Gold')}
                </th>
                <th scope="col" className="num">
                  {L('Argent', 'Silver')}
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
          <h2 className="t-h2">{L('Têtes de classement', 'Top of the table')}</h2>
        </div>
        <div className="kpis kpis--records">
          {[
            [L('Plus gros cumul de km', 'Most kilometres'), records.km, (v) => fmtKm(v)],
            [L('Plus de flèches homologuées', 'Most validated Flèches'), records.nb, (v) => fmt(v)],
            [L('Plus de fléchards', 'Most riders'), records.participants, (v) => fmt(v)],
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

function FicheClub({ club, parClub, onClose, onGo, L }) {
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
    <section className="fiche-club" aria-label={L(`Fiche du club ${club.nom}`, `Club profile: ${club.nom}`)}>
      <div className="section-head section-head--row">
        <h3 className="t-h3">
          {club.nom} <span className="muted">code {club.code || '—'}</span>
        </h3>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onClose}>
          {L('Fermer la fiche', 'Close profile')}
        </button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <b className="kpi__v">{fmt(club.km)}</b>
          <span className="kpi__l">{L('Kilomètres cumulés', 'Total kilometres')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{fmt(club.nb)}</b>
          <span className="kpi__l">{L('Flèches homologuées', 'Validated Flèches')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{fmt(club.participants)}</b>
          <span className="kpi__l">{L('Fléchards du club', 'Club riders')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">
            {fmt(club.O)} · {fmt(club.A)} · {fmt(club.B)}
          </b>
          <span className="kpi__l">{L('Or · Argent · Bronze', 'Gold · Silver · Bronze')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">#{club.rangKm}</b>
          <span className="kpi__l">{L(`Rang km (#${club.rangNb} flèches)`, `Km rank (#${club.rangNb} by Flèches)`)}</span>
        </div>
      </div>

      <div className="split-pair">
        <div>
          <h3 className="t-h3 fiche-h">{L('Flèches par saison', 'Flèches per season')}</h3>
          <div className="table-scroll table-scroll--short">
            <table className="table-app">
              <caption className="sr-only">{L('Flèches du club par saison', 'Club Flèches per season')}</caption>
              <thead>
                <tr>
                  <th scope="col">{L('Année', 'Year')}</th>
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
          <h3 className="t-h3 fiche-h">{L('Meilleurs fléchards', 'Top riders')}</h3>
          {membres.length === 0 ? (
            <p className="muted">{L("Aucun fléchard rattaché à ce club dans l'annuaire.", 'No rider linked to this club in the directory.')}</p>
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
                    {fmt(p.nb)} {L('flèches', 'Flèches')} · {fmt(p.km)} km · {L('O', 'G')} {fmt(p.O)} · {L('A', 'S')}{' '}
                    {fmt(p.A)} · B {fmt(p.B)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {membres.length === 40 && (
            <p className="t-small muted">
              {L(
                "40 premiers fléchards affichés — ouvrez l'annuaire pour la liste complète.",
                'Top 40 riders shown — open the directory for the full list.',
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
