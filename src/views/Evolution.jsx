import { useMemo, useState } from 'react'
import PalmaresNav from '../components/PalmaresNav.jsx'
import { fmt, fmtKm } from '../lib/data.js'
import { useL } from '../lib/i18n.js'

/* ------------------------------------------------------------------ */
/*  Vue « Évolution annuelle » : une ligne par saison, triable par     */
/*  colonne, et les têtes de classement des saisons.                   */
/* ------------------------------------------------------------------ */

const COLS = [
  { key: 'annee', fr: 'Année', en: 'Year' },
  { key: 'nb', fr: 'Homologations', en: 'Validated rides' },
  { key: 'participants', fr: 'Fléchards', en: 'Riders' },
  { key: 'nouveaux', fr: 'Nouveaux', en: 'Newcomers' },
  { key: 'femmes', fr: 'Femmes', en: 'Women' },
  { key: 'hommes', fr: 'Hommes', en: 'Men' },
  { key: 'km', fr: 'Km', en: 'Km' },
  { key: 'O', fr: 'Or', en: 'Gold' },
  { key: 'A', fr: 'Argent', en: 'Silver' },
  { key: 'B', fr: 'Bronze', en: 'Bronze' },
]

export default function Evolution({ data }) {
  const L = useL()
  const annees = data.stats?.annees ?? []
  const [tri, setTri] = useState('annee')
  const [sens, setSens] = useState(1) // 1 : année croissante / nombre décroissant

  const liste = useMemo(() => {
    const out = [...annees]
    out.sort((a, b) => {
      const c = tri === 'annee' ? a.annee - b.annee : (b[tri] ?? 0) - (a[tri] ?? 0)
      return c * sens || a.annee - b.annee
    })
    return out
  }, [annees, tri, sens])

  /* Clic sur un en-tête : trie sur la colonne ; second clic : inverse. */
  const trierPar = (cle) => {
    if (cle === tri) setSens((x) => -x)
    else {
      setTri(cle)
      setSens(1)
    }
  }
  const enTete = ({ key, fr, en }) => {
    const actif = tri === key
    const croissant = key === 'annee' ? sens > 0 : sens < 0
    return (
      <th
        key={key}
        scope="col"
        className={`th-click${key === 'annee' ? ' th-click--left' : ' num'}${actif ? ' is-sorted' : ''}`}
        aria-sort={actif ? (croissant ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          className={`th-sort${actif ? ' is-active' : ''}`}
          onClick={() => trierPar(key)}
          title={L('Cliquer pour trier', 'Click to sort')}
        >
          {L(fr, en)}
          <span className="th-sort__ico" aria-hidden="true">
            {actif ? (croissant ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  /* Têtes de classement : les 3 meilleures saisons pour chaque mesure. */
  const tetes = useMemo(() => {
    const top = (key) =>
      [...annees]
        .filter((a) => a[key])
        .sort((a, b) => b[key] - a[key] || a.annee - b.annee)
        .slice(0, 3)
        .map((a) => ({ nom: String(a.annee), v: a[key] }))
    return [
      [L('Plus d’homologations', 'Most validated rides'), top('nb'), fmt],
      [L('Plus de fléchards', 'Most riders'), top('participants'), fmt],
      [L('Plus de kilomètres', 'Most kilometres'), top('km'), fmtKm],
      [L('Plus de nouveaux', 'Most newcomers'), top('nouveaux'), fmt],
      [L('Plus de femmes', 'Most women'), top('femmes'), fmt],
      [L('Plus de flèches en or', 'Most gold Flèches'), top('O'), fmt],
    ]
  }, [annees, L])

  const premiere = annees.length ? Math.min(...annees.map((a) => a.annee)) : null
  const derniere = annees.length ? Math.max(...annees.map((a) => a.annee)) : null
  const total = (key) => annees.reduce((s, a) => s + (a[key] || 0), 0)

  return (
    <section className="section section--page" aria-labelledby="h-evolution">
      <div className="wrap">
        <PalmaresNav actif="evolution" />

        <div className="section-head section-head--row">
          <h1 id="h-evolution" className="t-h2">
            {L('Évolution annuelle', 'Year by year')}{' '}
            <span className="muted">
              {annees.length} {L('saisons', 'seasons')}
              {premiere && ` · ${premiere} – ${derniere}`}
            </span>
          </h1>
        </div>

        {/* ------------------------------------------- têtes de classement */}
        <div className="section-head">
          <h2 className="t-h3 palmares-h3">{L('Têtes de classement', 'Top of the table')}</h2>
        </div>
        <div className="kpis kpis--records kpis--records-6">
          {tetes.map(([titre, top, format]) => (
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

        {/* ------------------------------------------------ tableau annuel */}
        <div className="section-head">
          <h2 className="t-h3 palmares-h3">{L('Saison par saison', 'Season by season')}</h2>
          <p className="muted palmares-hint">
            {L('Cliquez sur le haut d’une colonne pour la trier ; un second clic inverse l’ordre.', 'Click a column header to sort; click again to reverse.')}
          </p>
        </div>

        <div className="table-scroll">
          <table className="table-app table-app--evolution">
            <caption className="sr-only">{L('Statistiques annuelles des Flèches de France', 'Flèches de France yearly statistics')}</caption>
            <thead>
              <tr>{COLS.map(enTete)}</tr>
            </thead>
            <tbody>
              {liste.map((a) => (
                <tr key={a.annee}>
                  <th scope="row" className={tri === 'annee' ? 'is-sorted' : ''}>
                    {a.annee}
                  </th>
                  {COLS.slice(1).map(({ key }) => (
                    <td key={key} className={`num${tri === key ? ' is-sorted' : ''}`}>
                      {fmt(a[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{L('Total', 'Total')}</th>
                {COLS.slice(1).map(({ key }) => (
                  <td key={key} className="num">
                    {['participants', 'femmes', 'hommes'].includes(key) ? '—' : fmt(total(key))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="note">
          {L(
            'Fléchards, femmes et hommes ne sont pas totalisés : un même cycliste roule souvent plusieurs saisons. Le total des nouveaux donne le nombre de cyclistes différents.',
            'Riders, women and men are not totalled: the same rider often rides several seasons. The newcomers total gives the number of distinct riders.',
          )}
        </p>
      </div>
    </section>
  )
}
