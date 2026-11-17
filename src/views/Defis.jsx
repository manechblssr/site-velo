import { useEffect, useMemo, useState } from 'react'
import Badge from '../components/Badge.jsx'
import Icon from '../components/Icon.jsx'
import { makeT } from '../lib/i18n.js'
import { fmt, fmtDate, norm, downloadCSV } from '../lib/data.js'

const ONGLETS = [
  ['formules', 'Par formule', 'medal'],
  ['pionnier', 'Le pionnier', 'flag'],
  ['complete', 'La Complète', 'trophy'],
  ['express', 'La Complète express', 'zap'],
  ['combiné', 'Le combiné', 'layers'],
]

const NOMF = { O: 'Or', A: 'Argent', B: 'Bronze' }

/* Même cadence que l'annuaire et le classement des clubs : la liste des
   homologations se lit par pages, l'export CSV, lui, reste complet. */
const PAR_PAGE = 25

export default function Defis({ lang, data }) {
  const t = makeT(lang)
  const { defis, fleches, homologations, stats, participants } = data
  const [onglet, setOnglet] = useState('formules')

  return (
    <section className="section section--page" aria-labelledby="h-defis">
      <div className="wrap">
        <div className="section-head">
          <h1 id="h-defis" className="t-h2">
            {t('view.defis')}{' '}
            <span className="muted">formules homologuées, pionniers et grands défis</span>
          </h1>
        </div>

        <div className="tabs-app" role="tablist" aria-label="Défis et formules">
          {ONGLETS.map(([id, label, ico]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls={`pan-${id}`}
              aria-selected={onglet === id}
              className="tab-app"
              onClick={() => setOnglet(id)}
            >
              <Icon name={ico} size={15} /> {label}
            </button>
          ))}
        </div>

        <div id={`pan-${onglet}`} role="tabpanel" aria-labelledby={`tab-${onglet}`}>
          {onglet === 'formules' && (
            <ParFormule homologations={homologations} fleches={fleches} lang={lang} />
          )}
          {onglet === 'pionnier' && (
            <Pionnier defis={defis} fleches={fleches} homologations={homologations} />
          )}
          {onglet === 'complete' && (
            <Complete defis={defis} stats={stats} participants={participants} lang={lang} />
          )}
          {onglet === 'express' && <Express defis={defis} />}
          {onglet === 'combiné' && <Combiné />}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ formules */

function ParFormule({ homologations, fleches, lang }) {
  const t = makeT(lang)
  const [formule, setFormule] = useState('O')
  const [fleche, setFleche] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const lignes = useMemo(() => {
    const qq = norm(q)
    return homologations
      .filter((h) => h.formule === formule)
      .filter((h) => !fleche || h.dest === fleche)
      .filter((h) => !qq || norm(`${h.dest} ${h.club} ${h.num} ${h.annee}`).includes(qq))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [homologations, formule, fleche, q])

  useEffect(() => setPage(1), [formule, fleche, q])

  const pages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE))
  const pageSure = Math.min(page, pages)
  const visible = lignes.slice((pageSure - 1) * PAR_PAGE, pageSure * PAR_PAGE)

  const exportCSV = () =>
    downloadCSV(
      `formule-${formule}${fleche ? `-${fleche}` : ''}.csv`,
      [
        { label: 'Date', value: (h) => h.date },
        { label: 'Millésime', value: (h) => h.annee },
        { label: "N° d'homologation", value: (h) => h.num },
        { label: 'Flèche', value: (h) => h.dest },
        { label: 'Formule', value: (h) => h.formule },
        { label: 'Club', value: (h) => h.club },
        { label: 'Fédération', value: (h) => h.fede },
      ],
      lignes,
    )

  return (
    <>
      <div className="toolbar" role="group" aria-label="Filtres de formule">
        <div className="toolbar__field">
          <label htmlFor="pf-formule"><Icon name="medal" size={13} /> Formule</label>
          <select id="pf-formule" value={formule} onChange={(e) => setFormule(e.target.value)}>
            <option value="O">Or</option>
            <option value="A">Argent</option>
            <option value="B">Bronze</option>
          </select>
        </div>
        <div className="toolbar__field">
          <label htmlFor="pf-fleche"><Icon name="route" size={13} /> {t('f.fleche')}</label>
          <select id="pf-fleche" value={fleche} onChange={(e) => setFleche(e.target.value)}>
            <option value="">{t('f.all')}</option>
            {fleches.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar__field toolbar__field--wide">
          <label htmlFor="pf-q"><Icon name="search" size={13} /> Rechercher</label>
          <input
            id="pf-q"
            type="search"
            value={q}
            placeholder="Club, n° d'homologation…"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="toolbar__field toolbar__field--action">
          <span className="toolbar__count">
            <b>{fmt(lignes.length)}</b> homologations
          </span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={exportCSV}>
            <Icon name="download" size={15} /> {t('f.export')}
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table-app">
          <thead>
            <tr>
              <th scope="col">{t('t.date')}</th>
              <th scope="col">{t('t.year')}</th>
              <th scope="col" className="num">
                {t('t.num')}
              </th>
              <th scope="col">{t('f.fleche')}</th>
              <th scope="col">{t('t.club')}</th>
              <th scope="col">{t('f.fede')}</th>
              <th scope="col">{t('t.formule')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((h, i) => (
              <tr key={`${h.pid}-${h.num}-${(pageSure - 1) * PAR_PAGE + i}`}>
                <td>{fmtDate(h.date)}</td>
                <td>{h.annee}</td>
                <td className="num">{h.num ?? '—'}</td>
                <th scope="row">{h.dest}</th>
                <td>{h.club || '—'}</td>
                <td>{h.fede || '—'}</td>
                <td>
                  <Badge code={h.formule} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="pager" aria-label="Pagination des homologations">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={pageSure === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Icon name="chevron-left" size={15} /> Précédent
          </button>
          <span className="muted">
            Page {pageSure} / {pages} — {fmt(lignes.length)} homologations au total
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
    </>
  )
}

/* ------------------------------------------------------------------ pionnier */

function Pionnier({ defis, fleches, homologations }) {
  const { pioneer, vierges } = defis

  const totalAvant = useMemo(
    () => homologations.filter((h) => h.annee >= 1997 && h.annee <= 2025).length,
    [homologations],
  )

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <b className="kpi__v">{fmt(totalAvant)}</b>
          <span className="kpi__l">Flèches homologuées entre 1997 et 2025</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{vierges.filter((v) => v.vierge1997_2025).length}</b>
          <span className="kpi__l">Formules vierges sur la période</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{fleches.length * 3}</b>
          <span className="kpi__l">Duos flèche × formule suivis</span>
        </div>
      </div>

      <h3 className="t-h3 fiche-h">Les 5 formules réputées vierges (1997 → 2025)</h3>
      <div className="table-scroll">
        <table className="table-app">
          <thead>
            <tr>
              <th scope="col">Flèche</th>
              <th scope="col">Formule</th>
              <th scope="col">Vierge 1997-2025</th>
              <th scope="col">Premier lauréat</th>
              <th scope="col" className="num">
                Homologations après 2025
              </th>
            </tr>
          </thead>
          <tbody>
            {vierges.map((v) => (
              <tr key={`${v['flèche']}-${v.formule}`}>
                <th scope="row">{v['flèche']}</th>
                <td>
                  <Badge code={v.formule} />
                </td>
                <td>{v.vierge1997_2025 ? <span className="chip">vierge</span> : <span className="chip chip--actif">attribuée</span>}</td>
                <td>{v.premier ? `${v.premier.nom} (${v.premier.annee})` : '—'}</td>
                <td className="num">{v.apres2025 ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="t-h3 fiche-h">Premier lauréat de chaque duo flèche × formule</h3>
      <div className="table-scroll">
        <table className="table-app">
          <thead>
            <tr>
              <th scope="col">Flèche</th>
              <th scope="col">
                <Badge code="O" /> Or
              </th>
              <th scope="col">
                <Badge code="A" /> Argent
              </th>
              <th scope="col">
                <Badge code="B" /> Bronze
              </th>
            </tr>
          </thead>
          <tbody>
            {fleches.map((f) => {
              const cell = pioneer[f.id] || {}
              return (
                <tr key={f.id}>
                  <th scope="row">{f.nom}</th>
                  {['O', 'A', 'B'].map((fo) => (
                    <td key={fo}>
                      {cell[fo] ? (
                        <>
                          <b>{cell[fo].nom}</b>{' '}
                          <span className="muted">
                            {cell[fo].annee}
                            {cell[fo].club ? ` · ${cell[fo].club}` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="muted">aucun</span>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="t-small muted">
        Le pionnier est le premier participant homologué dans la base pour chaque combinaison.
        Une formule « aucune » n'a jamais été attribuée depuis l'ouverture des Flèches.
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ complète */

function Complete({ defis, stats, participants, lang }) {
  const t = makeT(lang)
  const [sexe, setSexe] = useState('')
  const [q, setQ] = useState('')

  const officiels = useMemo(() => {
    const m = new Map()
    for (const x of stats.tcdPalmares.complete20) m.set(x.nom, x.nb)
    return m
  }, [stats])

  const liste = useMemo(() => {
    const qq = norm(q)
    return defis.complete
      .filter((c) => !sexe || c.sexe === sexe)
      .filter((c) => !qq || norm(`${c.nom} ${c.club}`).includes(qq))
      .sort((a, b) => b.nb - a.nb)
  }, [defis.complete, sexe, q])

  const parNom = useMemo(() => {
    const m = new Map()
    for (const p of participants) m.set(norm(`${p.nom} ${p.prenom}`), p)
    return m
  }, [participants])

  const croisement = useMemo(() => {
    let croise = 0
    for (const c of defis.complete) if (officiels.has(c.nom)) croise += 1
    return croise
  }, [defis.complete, officiels])

  const exportCSV = () =>
    downloadCSV(
      'la-complete.csv',
      [
        { label: 'Nom', value: (c) => c.nom },
        { label: 'Sexe', value: (c) => c.sexe },
        { label: 'Club', value: (c) => c.club },
        { label: 'Flèches', value: (c) => c.nb },
        { label: 'Première', value: (c) => c.premiere },
        { label: 'Dernière', value: (c) => c.derniere },
        { label: 'Onglet « 20 flèches »', value: (c) => (officiels.has(c.nom) ? 'oui' : 'non') },
      ],
      liste,
    )

  return (
    <>
      <div className="toolbar" role="group" aria-label="Filtres de La Complète">
        <div className="toolbar__field">
          <label htmlFor="cp-sexe"><Icon name="user" size={13} /> {t('f.sexe')}</label>
          <select id="cp-sexe" value={sexe} onChange={(e) => setSexe(e.target.value)}>
            <option value="">{t('f.all')}</option>
            <option value="H">Hommes</option>
            <option value="F">Femmes</option>
          </select>
        </div>
        <div className="toolbar__field toolbar__field--wide">
          <label htmlFor="cp-q"><Icon name="search" size={13} /> Rechercher</label>
          <input
            id="cp-q"
            type="search"
            value={q}
            placeholder="Nom, club…"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="toolbar__field toolbar__field--action">
          <span className="toolbar__count">
            <b>{fmt(liste.length)}</b> lauréats
          </span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={exportCSV}>
            <Icon name="download" size={15} /> {t('f.export')}
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <b className="kpi__v">{defis.complete.length}</b>
          <span className="kpi__l">Lauréats calculés dans le journal</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{stats.tcdPalmares.complete20.length}</b>
          <span className="kpi__l">Lauréats de l'onglet « 20 flèches »</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{croisement}</b>
          <span className="kpi__l">Présents dans les deux listes</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">
            {defis.complete.filter((c) => c.sexe === 'F').length}
          </b>
          <span className="kpi__l">Femmes La Complète</span>
        </div>
      </div>

      <div className="rows-app">
        {liste.map((c) => {
          const p = parNom.get(norm(c.nom))
          const officiel = officiels.get(c.nom)
          return (
            <div className="row-app" key={`${c.nom}-${c.id}`}>
              <span className="row-app__main">
                {p ? (
                  <a className="link" href={`#/annuaire/pid=${p.id}`}>
                    <b>{c.nom}</b>
                  </a>
                ) : (
                  <b>{c.nom}</b>
                )}
                <span className="muted">{c.sexe === 'F' ? '♀' : '♂'}</span>
                <span className="row-app__meta">{c.club || 'Sans club'}</span>
              </span>
              <span className="row-app__meta">
                {c.nb} flèches · {fmtDate(c.premiere)} → {fmtDate(c.derniere)}
                {officiel !== undefined && officiel !== c.nb && (
                  <span className="muted"> · onglet : {officiel}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <p className="t-small muted">
        Croisement du journal détaillé (20 destinations distinctes) et de l'onglet historique
        « Les 20 flèches » du classeur. Les écarts éventuels sont signalés.
      </p>
    </>
  )
}

/* ------------------------------------------------------------------- express */

function Express({ defis }) {
  const connus = [
    { nom: 'Guy LANNES', annee: 2004 },
    { nom: 'Jacques MARIE', annee: 2009 },
  ]
  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <b className="kpi__v">{defis.express.length}</b>
          <span className="kpi__l">Complètes express détectées</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">≈ 11 200</b>
          <span className="kpi__l">Kilomètres sur une seule année</span>
        </div>
      </div>

      <div className="rows-app">
        {defis.express.map((e) => (
          <div className="row-app" key={`${e.nom}-${e.annee}`}>
            <span className="row-app__main">
              <a className="link" href={`#/annuaire/pid=${e.id}`}>
                <b>{e.nom}</b>
              </a>
              <span className="muted">{e.sexe === 'F' ? '♀' : '♂'}</span>
              <span className="row-app__meta">{e.club || 'Sans club'}</span>
            </span>
            <span className="row-app__meta">
              <b>{e.annee}</b> · 20 flèches en une année
            </span>
          </div>
        ))}
      </div>

      <div className="note">
        <b>Références du club :</b>{' '}
        {connus.map((c, i) => (
          <span key={c.nom}>
            {i > 0 && ' · '}
            {c.nom} en {c.annee}
          </span>
        ))}
        . La détection automatique ci-dessus recalcule le défi sur l'intégralité du journal
        (toutes années confondues).
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ combiné */

function Combiné() {
  return (
    <div className="prose">
      <h3 className="t-h3">Le combiné des Flèches et des Relais</h3>
      <p>
        Le combiné couplage deux défis du club : réaliser les <b>20 Flèches de France</b> et
        participer aux <b>Relais de France</b>, deux randonnées permanentes qui se répondent sur
        le territoire. Les deux carnets se valident séparément ; le combiné récompense ceux qui
        mènent les deux à bien sur le même cycle.
      </p>
      <p>
        Les Relais de France sont organisés par les mêmes bénévoles que les Flèches : retrouvez
        leur règlement et leurs parcours sur la page des organisations du club.
      </p>
      <p>
        <a
          className="btn btn--secondary"
          href="https://www.audax-club-parisien.com/organisation/les-relais-de-france/"
          target="_blank"
          rel="noreferrer"
        >
          Les Relais de France ↗
        </a>
      </p>
    </div>
  )
}
