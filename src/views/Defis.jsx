import { useEffect, useMemo, useState } from 'react'
import Badge from '../components/Badge.jsx'
import Icon from '../components/Icon.jsx'
import { makeT, useL, useLang, nomClub } from '../lib/i18n.js'
import { fmt, fmtDate, norm, downloadCSV } from '../lib/data.js'

const ONGLETS = [
  ['formules', 'Par formule', 'By formula', 'medal'],
  ['pionnier', 'Le pionnier', 'The pioneer', 'flag'],
  ['complete', 'La Complète', 'The Complete', 'trophy'],
  ['express', 'La Complète express', 'The Express Complete', 'zap'],
  ['combiné', 'Le combiné', 'The combined', 'layers'],
]

/* Même cadence que l'annuaire et le classement des clubs : la liste des
   homologations se lit par pages, l'export CSV, lui, reste complet. */
const PAR_PAGE = 25

export default function Defis({ lang, data }) {
  const t = makeT(lang)
  const L = useL()
  const { defis, fleches, homologations, stats, participants } = data
  const [onglet, setOnglet] = useState('formules')

  return (
    <section className="section section--page" aria-labelledby="h-defis">
      <div className="wrap">
        <div className="section-head">
          <h1 id="h-defis" className="t-h2">
            {t('view.defis')}{' '}
            <span className="muted">
              {L('formules homologuées, pionniers et grands défis', 'validated formulas, pioneers and great challenges')}
            </span>
          </h1>
        </div>

        <div className="tabs-app" role="tablist" aria-label={L('Défis et formules', 'Challenges and formulas')}>
          {ONGLETS.map(([id, label, en, ico]) => (
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
              <Icon name={ico} size={15} /> {L(label, en)}
            </button>
          ))}
        </div>

        <div id={`pan-${onglet}`} role="tabpanel" aria-labelledby={`tab-${onglet}`}>
          {onglet === 'formules' && (
            <ParFormule homologations={homologations} fleches={fleches} lang={lang} />
          )}
          {onglet === 'pionnier' && (
            <Pionnier fleches={fleches} homologations={homologations} participants={participants} />
          )}
          {onglet === 'complete' && (
            <Complete
              defis={defis}
              stats={stats}
              participants={participants}
              homologations={homologations}
              fleches={fleches}
              lang={lang}
            />
          )}
          {onglet === 'express' && <Express defis={defis} />}
          {onglet === 'combiné' && <Combine />}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ formules */

function ParFormule({ homologations, fleches, lang }) {
  const t = makeT(lang)
  const L = useL()
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
        { label: L('Date', 'Date'), value: (h) => h.date },
        { label: L('Millésime', 'Season'), value: (h) => h.annee },
        { label: L("N° d'homologation", 'Record no.'), value: (h) => h.num },
        { label: L('Flèche', 'Flèche'), value: (h) => h.dest },
        { label: L('Formule', 'Formula'), value: (h) => h.formule },
        { label: L('Club', 'Club'), value: (h) => h.club },
        { label: L('Fédération', 'Federation'), value: (h) => h.fede },
      ],
      lignes,
    )

  return (
    <>
      <div className="toolbar" role="group" aria-label={L('Filtres de formule', 'Formula filters')}>
        <div className="toolbar__field">
          <label htmlFor="pf-formule"><Icon name="medal" size={13} /> {t('f.formule')}</label>
          <select id="pf-formule" value={formule} onChange={(e) => setFormule(e.target.value)}>
            <option value="O">{L('Or', 'Gold')}</option>
            <option value="A">{L('Argent', 'Silver')}</option>
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
          <label htmlFor="pf-q"><Icon name="search" size={13} /> {t('nav.search')}</label>
          <input
            id="pf-q"
            type="search"
            value={q}
            placeholder={L("Club, n° d'homologation…", 'Club, record no.…')}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="toolbar__field toolbar__field--action">
          <span className="toolbar__count">
            <b>{fmt(lignes.length)}</b> {L('homologations', 'validated rides')}
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
        <nav className="pager" aria-label={L('Pagination des homologations', 'Validated rides pagination')}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={pageSure === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Icon name="chevron-left" size={15} /> {L('Précédent', 'Previous')}
          </button>
          <span className="muted">
            {L(
              `Page ${pageSure} / ${pages} — ${fmt(lignes.length)} homologations au total`,
              `Page ${pageSure} / ${pages} — ${fmt(lignes.length)} validated rides in total`,
            )}
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
    </>
  )
}

/* ------------------------------------------------------------------ pionnier */

/* Le pionnier d'un duo Flèche × Formule est le premier à l'avoir réalisé :
   on classe les homologations par date de réalisation (puis n°
   d'homologation à date égale), et non par millésime. Les éditions
   anciennes n'ont que l'année : leur date est ramenée au 1er janvier. */
function datePionnier(h) {
  return h.date || `${h.annee}-12-31`
}

function plusTot(a, b) {
  const da = datePionnier(a)
  const db = datePionnier(b)
  if (da !== db) return da < db
  return (a.num ?? Infinity) < (b.num ?? Infinity)
}

/** Date lisible : l'année seule quand le classeur n'a que l'année. */
function dateCourte(iso) {
  if (!iso) return '—'
  return iso.endsWith('-01-01') ? iso.slice(0, 4) : fmtDate(iso)
}

const VIERGES = [
  ['BRIANCON', 'O'],
  ['HENDAYE', 'O'],
  ['LUCHON', 'O'],
  ['MARSEILLE', 'O'],
  ['MARSEILLE', 'A'],
]

function Pionnier({ fleches, homologations, participants }) {
  const L = useL()
  const lang = useLang()

  const byId = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants])

  /* premier lauréat de chaque duo, recalculé sur tout le journal */
  const pioneer = useMemo(() => {
    const m = new Map()
    for (const h of homologations) {
      if (!['O', 'A', 'B'].includes(h.formule)) continue
      const k = `${h.dest}|${h.formule}`
      const cur = m.get(k)
      if (!cur || plusTot(h, cur)) m.set(k, h)
    }
    return m
  }, [homologations])

  const vierges = useMemo(
    () =>
      VIERGES.map(([dest, fo]) => {
        const rows = homologations.filter((h) => h.dest === dest && h.formule === fo)
        return {
          dest,
          formule: fo,
          vierge: !rows.some((h) => h.annee >= 1997 && h.annee <= 2025),
          premier: pioneer.get(`${dest}|${fo}`) ?? null,
          apres2025: rows.filter((h) => h.annee > 2025).length,
        }
      }),
    [homologations, pioneer],
  )

  const totalAvant = useMemo(
    () => homologations.filter((h) => h.annee >= 1997 && h.annee <= 2025).length,
    [homologations],
  )

  const nomFleche = (id) => fleches.find((f) => f.id === id)?.nom ?? id

  const Laureat = ({ h }) => {
    const p = byId.get(h.pid)
    const nom = p ? `${p.nom} ${p.prenom}` : '—'
    return (
      <>
        {p ? (
          <a className="link" href={`#/annuaire/pid=${p.id}`}>
            <b>{nom}</b>
          </a>
        ) : (
          <b>{nom}</b>
        )}{' '}
        <span className="muted">
          {dateCourte(h.date)}
          {h.num != null ? ` · ${L('n°', 'no.')} ${h.num}` : ''}
          {h.club ? ` · ${nomClub(h.club, lang)}` : ''}
        </span>
      </>
    )
  }

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <b className="kpi__v">{fmt(totalAvant)}</b>
          <span className="kpi__l">{L('Flèches homologuées entre 1997 et 2025', 'Flèches validated between 1997 and 2025')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{vierges.filter((v) => v.vierge).length}</b>
          <span className="kpi__l">{L('Formules vierges sur la période', 'Formulas never achieved in that period')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{fleches.length * 3}</b>
          <span className="kpi__l">{L('Duos flèche × formule suivis', 'Flèche × formula pairs tracked')}</span>
        </div>
      </div>

      <h3 className="t-h3 fiche-h">
        {L('Les 5 formules réputées vierges (1997 → 2025)', 'The 5 formulas reported as never achieved (1997 → 2025)')}
      </h3>
      <div className="table-scroll">
        <table className="table-app">
          <thead>
            <tr>
              <th scope="col">{L('Flèche', 'Flèche')}</th>
              <th scope="col">{L('Formule', 'Formula')}</th>
              <th scope="col">{L('Vierge 1997-2025', 'Unachieved 1997-2025')}</th>
              <th scope="col">{L('Premier lauréat', 'First achiever')}</th>
              <th scope="col" className="num">
                {L('Homologations après 2025', 'Validated rides after 2025')}
              </th>
            </tr>
          </thead>
          <tbody>
            {vierges.map((v) => (
              <tr key={`${v.dest}-${v.formule}`}>
                <th scope="row">{nomFleche(v.dest)}</th>
                <td>
                  <Badge code={v.formule} />
                </td>
                <td>
                  {v.vierge ? (
                    <span className="chip">{L('vierge', 'unachieved')}</span>
                  ) : (
                    <span className="chip chip--actif">{L('attribuée', 'achieved')}</span>
                  )}
                </td>
                <td>{v.premier ? <Laureat h={v.premier} /> : '—'}</td>
                <td className="num">{v.apres2025}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="t-h3 fiche-h">{L('Premier lauréat de chaque duo flèche × formule', 'First achiever of each Flèche × formula pair')}</h3>
      <div className="table-scroll">
        <table className="table-app">
          <thead>
            <tr>
              <th scope="col">{L('Flèche', 'Flèche')}</th>
              <th scope="col">
                <Badge code="O" />
              </th>
              <th scope="col">
                <Badge code="A" />
              </th>
              <th scope="col">
                <Badge code="B" />
              </th>
            </tr>
          </thead>
          <tbody>
            {fleches.map((f) => (
              <tr key={f.id}>
                <th scope="row">{f.nom}</th>
                {['O', 'A', 'B'].map((fo) => {
                  const h = pioneer.get(`${f.id}|${fo}`)
                  return (
                    <td key={fo}>
                      {h ? <Laureat h={h} /> : <span className="muted">{L('aucun', 'none')}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="t-small muted">
        {L(
          "Le pionnier est le premier participant à avoir réalisé la combinaison, d'après la date de réalisation (à date égale, le plus petit n° d'homologation). Pour les éditions anciennes, seule l'année est connue. « aucun » : formule jamais attribuée depuis l'ouverture des Flèches.",
          'The pioneer is the first rider to have completed the combination, based on the ride date (same date: lowest record number). For older editions only the year is known. “none”: formula never achieved since the Flèches began.',
        )}
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ complète */

const METAUX = [
  ['O', 'Or', 'Gold', 'en or', 'in gold'],
  ['A', 'Argent', 'Silver', 'en argent', 'in silver'],
  ['B', 'Bronze', 'Bronze', 'en bronze', 'in bronze'],
]

function Complete({ defis, stats, participants, homologations, fleches, lang }) {
  const t = makeT(lang)
  const L = useL()
  const [sexe, setSexe] = useState('')
  const [metal, setMetal] = useState('')
  const [q, setQ] = useState('')
  const total = fleches.length

  /* Pour chaque participant : nombre de Flèches distinctes homologuées dans
     chaque formule. « La Complète en or » = les 20 Flèches faites en or. */
  const parFormule = useMemo(() => {
    const m = new Map()
    for (const h of homologations) {
      if (!h.formule) continue
      let e = m.get(h.pid)
      if (!e) m.set(h.pid, (e = { O: new Set(), A: new Set(), B: new Set() }))
      e[h.formule]?.add(h.dest)
    }
    const out = new Map()
    for (const [pid, e] of m) out.set(pid, { O: e.O.size, A: e.A.size, B: e.B.size })
    return out
  }, [homologations])

  const compte = (id, f) => parFormule.get(id)?.[f] ?? 0

  const parMetal = useMemo(() => {
    const r = { O: 0, A: 0, B: 0 }
    for (const c of defis.complete) for (const [f] of METAUX) if (compte(c.id, f) >= total) r[f] += 1
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defis.complete, parFormule, total])

  const officiels = useMemo(() => {
    const m = new Map()
    for (const x of stats.tcdPalmares.complete20) m.set(x.nom, x.nb)
    return m
  }, [stats])

  const liste = useMemo(() => {
    const qq = norm(q)
    return defis.complete
      .filter((c) => !sexe || c.sexe === sexe)
      .filter((c) => !metal || compte(c.id, metal) >= total)
      .filter((c) => !qq || norm(`${c.nom} ${c.club}`).includes(qq))
      .sort((a, b) => (metal ? compte(b.id, metal) - compte(a.id, metal) : 0) || b.nb - a.nb)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defis.complete, sexe, metal, q, parFormule, total])

  /* Quand personne n'a encore la Complète dans ce métal : les plus proches. */
  const plusProches = useMemo(() => {
    if (!metal) return []
    return participants
      .map((p) => ({ p, n: compte(p.id, metal) }))
      .filter((x) => x.n > 0 && (!sexe || x.p.sexe === sexe))
      .sort((a, b) => b.n - a.n || a.p.nom.localeCompare(b.p.nom))
      .slice(0, 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, metal, sexe, parFormule])

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
        { label: L('Nom', 'Name'), value: (c) => c.nom },
        { label: L('Sexe', 'Gender'), value: (c) => c.sexe },
        { label: L('Club', 'Club'), value: (c) => c.club },
        { label: L('Flèches', 'Flèches'), value: (c) => c.nb },
        ...METAUX.map(([f, fr, en]) => ({ label: L(`Flèches ${fr}`, `${en} Flèches`), value: (c) => compte(c.id, f) })),
        { label: L('Première', 'First'), value: (c) => c.premiere },
        { label: L('Dernière', 'Last'), value: (c) => c.derniere },
        {
          label: L('Onglet « 20 flèches »', '“20 Flèches” sheet'),
          value: (c) => (officiels.has(c.nom) ? L('oui', 'yes') : L('non', 'no')),
        },
      ],
      liste,
    )

  return (
    <>
      <div className="toolbar" role="group" aria-label={L('Filtres de La Complète', 'The Complete filters')}>
        <div className="toolbar__field">
          <label htmlFor="cp-sexe"><Icon name="user" size={13} /> {t('f.sexe')}</label>
          <select id="cp-sexe" value={sexe} onChange={(e) => setSexe(e.target.value)}>
            <option value="">{t('f.all')}</option>
            <option value="H">{L('Hommes', 'Men')}</option>
            <option value="F">{L('Femmes', 'Women')}</option>
          </select>
        </div>
        <div className="toolbar__field">
          <label htmlFor="cp-metal"><Icon name="medal" size={13} /> {L('Médaille', 'Medal')}</label>
          <select id="cp-metal" value={metal} onChange={(e) => setMetal(e.target.value)}>
            <option value="">{L('Toutes', 'All')}</option>
            {METAUX.map(([f, fr, en, dfr, den]) => (
              <option key={f} value={f}>
                {L(`Complète ${dfr} (20 ${fr.toLowerCase()})`, `Complete ${den} (20 ${en.toLowerCase()})`)}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar__field toolbar__field--wide">
          <label htmlFor="cp-q"><Icon name="search" size={13} /> {t('nav.search')}</label>
          <input
            id="cp-q"
            type="search"
            value={q}
            placeholder={L('Nom, club…', 'Name, club…')}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="toolbar__field toolbar__field--action">
          <span className="toolbar__count">
            <b>{fmt(liste.length)}</b> {L('lauréats', 'finishers')}
          </span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={exportCSV}>
            <Icon name="download" size={15} /> {t('f.export')}
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <b className="kpi__v">{defis.complete.length}</b>
          <span className="kpi__l">{L('Lauréats calculés dans le journal', 'Finishers computed from the log')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{stats.tcdPalmares.complete20.length}</b>
          <span className="kpi__l">{L("Lauréats de l'onglet « 20 flèches »", 'Finishers in the “20 Flèches” sheet')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{croisement}</b>
          <span className="kpi__l">{L('Présents dans les deux listes', 'In both lists')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">
            {defis.complete.filter((c) => c.sexe === 'F').length}
          </b>
          <span className="kpi__l">{L('Femmes La Complète', 'Women finishers')}</span>
        </div>
      </div>

      <div className="kpis">
        {METAUX.map(([f, fr, en, dfr, den]) => (
          <button
            key={f}
            type="button"
            className={`kpi kpi--metal${metal === f ? ' is-active' : ''}`}
            aria-pressed={metal === f}
            onClick={() => setMetal(metal === f ? '' : f)}
          >
            <b className="kpi__v">{parMetal[f]}</b>
            <span className="kpi__l">
              <Badge code={f} /> {L(`La Complète ${dfr} : les ${total} Flèches ${dfr}`, `The Complete ${den}: all ${total} Flèches ${den}`)}
            </span>
          </button>
        ))}
      </div>

      {metal && liste.length === 0 && (
        <div className="empty-metal">
          <p>
            <b>
              {L(
                `Personne n'a encore réalisé la Complète ${METAUX.find((m) => m[0] === metal)[3]}.`,
                `Nobody has achieved the Complete ${METAUX.find((m) => m[0] === metal)[4]} yet.`,
              )}
            </b>{' '}
            {L('Les plus proches :', 'Closest riders:')}
          </p>
          <div className="rows-app">
            {plusProches.map(({ p, n }) => (
              <div className="row-app" key={p.id}>
                <span className="row-app__main">
                  <a className="link" href={`#/annuaire/pid=${p.id}`}>
                    <b>{p.nom} {p.prenom}</b>
                  </a>
                  <span className="muted">{p.sexe === 'F' ? '♀' : '♂'}</span>
                  <span className="row-app__meta">{nomClub(p.club, lang) || t('f.none')}</span>
                </span>
                <span className="row-app__meta">
                  <Badge code={metal} /> {n}/{total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <span className="row-app__meta">{nomClub(c.club, lang) || t('f.none')}</span>
              </span>
              <span className="row-app__meta">
                <span className="metal-counts">
                  {METAUX.map(([f]) => (
                    <span key={f} className={compte(c.id, f) >= total ? 'metal-count is-full' : 'metal-count'}>
                      <Badge code={f} /> {compte(c.id, f)}/{total}
                    </span>
                  ))}
                </span>{' '}
                · {c.nb} {L('flèches', 'Flèches')} · {fmtDate(c.premiere)} → {fmtDate(c.derniere)}
                {officiel !== undefined && officiel !== c.nb && (
                  <span className="muted"> · {L('onglet', 'sheet')} : {officiel}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <p className="t-small muted">
        {L(
          "Croisement du journal détaillé (20 destinations distinctes) et de l'onglet historique « Les 20 flèches » du classeur. Les écarts éventuels sont signalés.",
          'Cross-check of the detailed log (20 distinct destinations) against the historical “Les 20 flèches” sheet of the workbook. Any discrepancies are flagged.',
        )}
      </p>
    </>
  )
}

/* ------------------------------------------------------------------- express */

function Express({ defis }) {
  const L = useL()
  const lang = useLang()
  const liste = [...defis.express].sort((a, b) => a.annee - b.annee)
  const kmMax = Math.max(0, ...liste.map((e) => e.km || 0))
  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <b className="kpi__v">{liste.length}</b>
          <span className="kpi__l">{L('Complètes express vérifiées', 'Verified Express Completes')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{fmt(kmMax)}</b>
          <span className="kpi__l">{L('Kilomètres sur une seule saison (record)', 'Kilometres in a single season (record)')}</span>
        </div>
      </div>

      <div className="rows-app">
        {liste.map((e) => (
          <div className="row-app" key={`${e.nom}-${e.annee}`}>
            <span className="row-app__main">
              <a className="link" href={`#/annuaire/pid=${e.id}`}>
                <b>{e.nom}</b>
              </a>
              <span className="muted">{e.sexe === 'F' ? '♀' : '♂'}</span>
              <span className="row-app__meta">{nomClub(e.club, lang) || L('Sans club', 'No club')}</span>
            </span>
            <span className="row-app__meta">
              <b>{L(`Saison ${e.annee}`, `${e.annee} season`)}</b> ·{' '}
              {L(`${e.nbDest} flèches distinctes`, `${e.nbDest} distinct Flèches`)} · {fmt(e.km)} km
              {e.debut && e.fin && (
                <span className="muted">
                  {' '}
                  · {fmtDate(e.debut)} → {fmtDate(e.fin)}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="note">
        {L(
          "Chaque cas est vérifié sur le journal : les 20 destinations distinctes sont homologuées dans un même millésime. L'année des Flèches court du 1er octobre au 30 septembre suivant (règlement, article 3) : la saison 2026 commence donc le 1er octobre 2025. Pour les éditions anciennes, seule l'année est connue.",
          'Each case is checked against the log: all 20 distinct destinations are validated within one and the same season. The Flèches year runs from 1 October to 30 September of the following year (rules, article 3), so the 2026 season starts on 1 October 2025. For older editions only the year is known.',
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ combiné */

function Combine() {
  const L = useL()
  return (
    <div className="prose">
      <h3 className="t-h3">{L('Le combiné des Flèches et des Relais', 'The Flèches and Relais combined')}</h3>
      <p>
        {L(
          'Le combiné associe deux défis du club : réaliser les ',
          'The combined challenge pairs two of the club’s challenges: riding the ',
        )}
        <b>{L('20 Flèches de France', '20 Flèches de France')}</b>
        {L(' et participer aux ', ' and taking part in the ')}
        <b>Relais de France</b>
        {L(
          ', deux randonnées permanentes qui se répondent sur le territoire. Les deux carnets se valident séparément ; le combiné récompense ceux qui mènent les deux à bien sur le même cycle.',
          ', two permanent rides that echo each other across France. Both route books are validated separately; the combined award goes to those who complete both over the same cycle.',
        )}
      </p>
      <p>
        {L(
          'Les Relais de France sont organisés par les mêmes bénévoles que les Flèches : retrouvez leur règlement et leurs parcours sur la page des organisations du club.',
          'The Relais de France are run by the same volunteers as the Flèches: find their rules and routes on the club’s events page.',
        )}
      </p>
      <p>
        <a
          className="btn btn--secondary"
          href="https://www.audax-club-parisien.com/organisation/les-relais-de-france/"
          target="_blank"
          rel="noreferrer"
        >
          {L('Les Relais de France', 'The Relais de France')} ↗
        </a>
      </p>
    </div>
  )
}
