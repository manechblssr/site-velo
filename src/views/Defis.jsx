import { useEffect, useMemo, useRef, useState } from 'react'
import Badge from '../components/Badge.jsx'
import Icon from '../components/Icon.jsx'
import { makeT, useL, useLang, nomClub } from '../lib/i18n.js'
import { fmt, fmtDate, norm, downloadCSV } from '../lib/data.js'

/* id · libellé FR · libellé EN · icône · phrase d'introduction FR · EN */
const ONGLETS = [
  [
    'formules', 'Par formule', 'By formula', 'medal',
    "Toutes les homologations d'une formule, de la plus récente à la plus ancienne. Choisissez Or, Argent ou Bronze, puis filtrez par Flèche ou cherchez un club.",
    'Every validated ride of one formula, newest first. Pick Gold, Silver or Bronze, then filter by Flèche or search a club.',
  ],
  [
    'pionnier', 'Le pionnier', 'The pioneer', 'flag',
    'Le premier cycliste à avoir réalisé chaque Flèche dans chaque formule, et les formules restées vierges jusqu’en 2025.',
    'The first rider to complete each Flèche in each formula, and the formulas nobody achieved until 2025.',
  ],
  [
    'complete', 'La Complète', 'The Complete', 'trophy',
    'Les cyclistes qui ont homologué les 20 Flèches. Cochez Or, Argent ou Bronze pour ne garder que ceux qui ont fait les 20 dans cette formule.',
    'Riders who have validated all 20 Flèches. Tick Gold, Silver or Bronze to keep only those who did all 20 in that formula.',
  ],
  [
    'express', 'La Complète express', 'The Express Complete', 'zap',
    'Les 20 Flèches homologuées au cours d’une seule et même saison.',
    'All 20 Flèches validated within one single season.',
  ],
  [
    'combine', 'Le combiné', 'The combined', 'layers',
    'Le défi qui réunit les Flèches de France et les Relais de France.',
    'The challenge that joins the Flèches de France and the Relais de France.',
  ],
]
const IDS = ONGLETS.map((o) => o[0])

const METAUX = [
  ['O', 'Or', 'Gold', 'en or', 'in gold'],
  ['A', 'Argent', 'Silver', 'en argent', 'in silver'],
  ['B', 'Bronze', 'Bronze', 'en bronze', 'in bronze'],
]

/* Même cadence que l'annuaire et le classement des clubs : les listes se
   lisent par pages, l'export CSV, lui, reste complet. */
const PAR_PAGE = 25

export default function Defis({ lang, data, routeParam = '' }) {
  const t = makeT(lang)
  const L = useL()
  const { defis, fleches, homologations, stats, participants } = data
  /* L'onglet vit dans l'adresse (#/defis/complete) : il survit au
     rechargement et se partage. replaceState évite le hashchange, donc pas
     de retour en haut de page à chaque changement d'onglet. */
  const [onglet, setOnglet] = useState(IDS.includes(routeParam) ? routeParam : 'formules')
  const tabsRef = useRef(null)

  const choisir = (id, focus = false) => {
    setOnglet(id)
    try {
      window.history.replaceState(null, '', `#/defis/${id}`)
    } catch {
      /* file:// ou bac à sable : l'onglet reste simplement en mémoire */
    }
    if (focus) tabsRef.current?.querySelector(`#tab-${id}`)?.focus()
  }

  /* flèches gauche/droite, Début, Fin : navigation clavier du motif « onglets » */
  const onKeyDown = (e) => {
    const i = IDS.indexOf(onglet)
    const cible = {
      ArrowRight: IDS[(i + 1) % IDS.length],
      ArrowLeft: IDS[(i - 1 + IDS.length) % IDS.length],
      Home: IDS[0],
      End: IDS[IDS.length - 1],
    }[e.key]
    if (!cible) return
    e.preventDefault()
    choisir(cible, true)
  }

  /* l'onglet actif reste visible quand la barre défile (mobile) */
  useEffect(() => {
    const bar = tabsRef.current
    const tab = bar?.querySelector(`#tab-${onglet}`)
    if (!bar || !tab) return
    const gauche = tab.offsetLeft - bar.offsetLeft
    if (gauche < bar.scrollLeft || gauche + tab.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollLeft = gauche - 16
    }
  }, [onglet])

  const actif = ONGLETS.find((o) => o[0] === onglet)

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

        <div
          className="tabs-app tabs-app--defis"
          role="tablist"
          aria-label={L('Défis et formules', 'Challenges and formulas')}
          ref={tabsRef}
          onKeyDown={onKeyDown}
        >
          {ONGLETS.map(([id, label, en, ico]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls={`pan-${id}`}
              aria-selected={onglet === id}
              tabIndex={onglet === id ? 0 : -1}
              className="tab-app"
              onClick={() => choisir(id)}
            >
              <Icon name={ico} size={15} /> {L(label, en)}
            </button>
          ))}
        </div>

        <div id={`pan-${onglet}`} role="tabpanel" aria-labelledby={`tab-${onglet}`} className="defis-pan">
          <p className="defis-intro">{L(actif[4], actif[5])}</p>
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
          {onglet === 'combine' && <Combine />}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- pagination */

function Pager({ page, pages, total, unite, onPage, label }) {
  const L = useL()
  if (pages <= 1) return null
  return (
    <nav className="pager" aria-label={label}>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        disabled={page === 1}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        <Icon name="chevron-left" size={15} /> {L('Précédent', 'Previous')}
      </button>
      <span className="muted">
        {L(`Page ${page} / ${pages} · ${fmt(total)} ${unite[0]}`, `Page ${page} / ${pages} · ${fmt(total)} ${unite[1]}`)}
      </span>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        disabled={page === pages}
        onClick={() => onPage(Math.min(pages, page + 1))}
      >
        {L('Suivant', 'Next')} <Icon name="chevron-right" size={15} />
      </button>
    </nav>
  )
}

/* Change de page et remonte au début de la liste si on l'a dépassé. */
function useChangerPage(ref, setPage) {
  return (n) => {
    setPage(n)
    const el = ref.current
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 120
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'auto' })
  }
}

/* Barre de résultat : compteur à gauche, actions à droite. */
function Resultbar({ innerRef, children, actions }) {
  return (
    <div className="resultbar" ref={innerRef}>
      <span className="resultbar__count" aria-live="polite">
        {children}
      </span>
      <span className="resultbar__actions">{actions}</span>
    </div>
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
  const haut = useRef(null)
  const changerPage = useChangerPage(haut, setPage)

  const nomFleche = useMemo(() => new Map(fleches.map((f) => [f.id, f.nom])), [fleches])

  /* filtres hors formule : sert aussi aux compteurs des trois boutons */
  const base = useMemo(() => {
    const qq = norm(q)
    return homologations
      .filter((h) => !fleche || h.dest === fleche)
      .filter((h) => !qq || norm(`${h.dest} ${h.club} ${h.num} ${h.annee}`).includes(qq))
  }, [homologations, fleche, q])

  const parCode = useMemo(() => {
    const r = { O: 0, A: 0, B: 0 }
    for (const h of base) if (h.formule in r) r[h.formule] += 1
    return r
  }, [base])

  const lignes = useMemo(
    () => base.filter((h) => h.formule === formule).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [base, formule],
  )

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
        <div className="toolbar__field toolbar__field--seg">
          <span className="toolbar__lbl" id="pf-formule-l">
            <Icon name="medal" size={13} /> {t('f.formule')}
          </span>
          <div className="seg" role="radiogroup" aria-labelledby="pf-formule-l">
            {METAUX.map(([f, fr, en]) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={formule === f}
                className={`seg__btn seg__btn--${f}`}
                onClick={() => setFormule(f)}
              >
                <span className="seg__dot" aria-hidden="true" />
                {L(fr, en)} <span className="seg__n">{fmt(parCode[f])}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar__field">
          <label htmlFor="pf-fleche"><Icon name="route" size={13} /> {t('f.fleche')}</label>
          <select id="pf-fleche" value={fleche} onChange={(e) => setFleche(e.target.value)}>
            <option value="">{L('Toutes les Flèches', 'All Flèches')}</option>
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
            placeholder={L("Club, n° d'homologation, année…", 'Club, record no., year…')}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <Resultbar
        innerRef={haut}
        actions={
          <>
            {(fleche || q) && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  setFleche('')
                  setQ('')
                }}
              >
                {L('Effacer les filtres', 'Clear filters')}
              </button>
            )}
            <button type="button" className="btn btn--secondary btn--sm" onClick={exportCSV} disabled={!lignes.length}>
              <Icon name="download" size={15} /> {t('f.export')}
            </button>
          </>
        }
      >
        <b>{fmt(lignes.length)}</b> {L('homologations', 'validated rides')} <Badge code={formule} />
        {fleche && <span className="muted"> · {nomFleche.get(fleche) ?? fleche}</span>}
      </Resultbar>

      {lignes.length === 0 ? (
        <p className="empty">{L('Aucune homologation ne correspond à ces filtres.', 'No validated ride matches these filters.')}</p>
      ) : (
        <div className="table-scroll">
          <table className="table-app table-app--stack">
            <thead>
              <tr>
                <th scope="col">{t('f.fleche')}</th>
                <th scope="col">{t('t.date')}</th>
                <th scope="col">{t('t.year')}</th>
                <th scope="col" className="num">{t('t.num')}</th>
                <th scope="col">{t('t.club')}</th>
                <th scope="col">{t('f.fede')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((h, i) => (
                <tr key={`${h.pid}-${h.num}-${(pageSure - 1) * PAR_PAGE + i}`}>
                  <th scope="row">{nomFleche.get(h.dest) ?? h.dest}</th>
                  <td data-label={t('t.date')}>{fmtDate(h.date)}</td>
                  <td data-label={t('t.year')}>{h.annee}</td>
                  <td data-label={t('t.num')} className="num">{h.num ?? '—'}</td>
                  <td data-label={t('t.club')}>{nomClub(h.club, lang) || '—'}</td>
                  <td data-label={t('f.fede')}>{h.fede || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={pageSure}
        pages={pages}
        total={lignes.length}
        unite={['homologations', 'validated rides']}
        onPage={changerPage}
        label={L('Pagination des homologations', 'Validated rides pagination')}
      />
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
        <table className="table-app table-app--stack">
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
                <td data-label={L('Formule', 'Formula')}>
                  <Badge code={v.formule} />
                </td>
                <td data-label={L('1997-2025', '1997-2025')}>
                  {v.vierge ? (
                    <span className="chip">{L('vierge', 'unachieved')}</span>
                  ) : (
                    <span className="chip chip--actif">{L('attribuée', 'achieved')}</span>
                  )}
                </td>
                <td data-label={L('Premier lauréat', 'First achiever')} className="cell-wide">{v.premier ? <Laureat h={v.premier} /> : '—'}</td>
                <td data-label={L('Après 2025', 'After 2025')} className="num">{v.apres2025}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="t-h3 fiche-h">{L('Premier lauréat de chaque duo flèche × formule', 'First achiever of each Flèche × formula pair')}</h3>
      <div className="table-scroll">
        <table className="table-app table-app--stack">
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
                    <td key={fo} data-label={L(...{ O: ['Or', 'Gold'], A: ['Argent', 'Silver'], B: ['Bronze', 'Bronze'] }[fo])} className={`cell-fo cell-fo--${fo}`}>
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

/* Nombre de Flèches faites dans une formule : chiffre + barre de progression.
   Les 20 sur 20 prennent la couleur du métal. */
function Tally({ f, n, total }) {
  const L = useL()
  const m = METAUX.find((x) => x[0] === f)
  return (
    <span
      className={`tally tally--${f}${n >= total ? ' is-full' : ''}${n === 0 ? ' is-zero' : ''}`}
      title={L(`${n} Flèches sur ${total} en ${m[1].toLowerCase()}`, `${n} of ${total} Flèches in ${m[2].toLowerCase()}`)}
    >
      <span className="tally__n">
        {n}
        <small>/{total}</small>
      </span>
      <span className="tally__bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (n / total) * 100)}%` }} />
      </span>
    </span>
  )
}

function Complete({ defis, stats, participants, homologations, fleches, lang }) {
  const t = makeT(lang)
  const L = useL()
  const [sexe, setSexe] = useState('')
  const [metaux, setMetaux] = useState([])
  const [q, setQ] = useState('')
  const [tri, setTri] = useState({ cle: 'nb', sens: -1 })
  const [page, setPage] = useState(1)
  const haut = useRef(null)
  const changerPage = useChangerPage(haut, setPage)
  const total = fleches.length
  const basculer = (f) => setMetaux((m) => (m.includes(f) ? m.filter((x) => x !== f) : [...m, f]))

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
    const val = (c) => (tri.cle === 'nom' ? c.nom : tri.cle === 'nb' ? c.nb : compte(c.id, tri.cle))
    return defis.complete
      .filter((c) => !sexe || c.sexe === sexe)
      .filter((c) => !metaux.length || metaux.some((f) => compte(c.id, f) >= total))
      .filter((c) => !qq || norm(`${c.nom} ${c.club}`).includes(qq))
      .sort((a, b) => {
        const va = val(a)
        const vb = val(b)
        const d = typeof va === 'string' ? va.localeCompare(vb) : va - vb
        return d * tri.sens || b.nb - a.nb || a.nom.localeCompare(b.nom)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defis.complete, sexe, metaux, q, parFormule, total, tri])

  useEffect(() => setPage(1), [sexe, metaux, q, tri])

  const pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE))
  const pageSure = Math.min(page, pages)
  const visible = liste.slice((pageSure - 1) * PAR_PAGE, pageSure * PAR_PAGE)

  /* Métaux cochés que personne n'a encore réalisés : les 10 plus proches. */
  const plusProches = useMemo(() => {
    return metaux
      .filter((f) => !defis.complete.some((c) => (!sexe || c.sexe === sexe) && compte(c.id, f) >= total))
      .map((f) => ({
        f,
        riders: participants
          .map((p) => ({ p, n: compte(p.id, f) }))
          .filter((x) => x.n > 0 && (!sexe || x.p.sexe === sexe))
          .sort((a, b) => b.n - a.n || a.p.nom.localeCompare(b.p.nom))
          .slice(0, 10),
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, defis.complete, metaux, sexe, parFormule, total])

  const parNom = useMemo(() => {
    const m = new Map()
    for (const p of participants) m.set(norm(`${p.nom} ${p.prenom}`), p)
    return m
  }, [participants])


  const filtre = sexe || q || metaux.length > 0
  const effacer = () => {
    setSexe('')
    setQ('')
    setMetaux([])
  }

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

  /* En-tête de colonne triable : un clic trie, un second inverse. (Fonction
     appelée, pas composant : le bouton garde le focus après le tri.) */
  const th = (cle, children, className = '') => {
    const actif = tri.cle === cle
    return (
      <th
        key={cle}
        scope="col"
        className={className}
        aria-sort={actif ? (tri.sens > 0 ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          className={`th-sort${actif ? ' is-active' : ''}`}
          onClick={() =>
            setTri((s) => (s.cle === cle ? { cle, sens: -s.sens } : { cle, sens: cle === 'nom' ? 1 : -1 }))
          }
        >
          {children}
          <span className="th-sort__ico" aria-hidden="true">
            {actif ? (tri.sens > 0 ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  return (
    <>
      <div className="kpis kpis--complete">
        <div className="kpi">
          <b className="kpi__v">{defis.complete.length}</b>
          <span className="kpi__l">{L('Lauréats de La Complète', 'Complete finishers')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{defis.complete.filter((c) => c.sexe === 'H').length}</b>
          <span className="kpi__l">{L('Hommes', 'Men')}</span>
        </div>
        <div className="kpi">
          <b className="kpi__v">{defis.complete.filter((c) => c.sexe === 'F').length}</b>
          <span className="kpi__l">{L('Femmes', 'Women')}</span>
        </div>
      </div>

      <div className="toolbar" role="group" aria-label={L('Filtres de La Complète', 'The Complete filters')}>
        <div className="toolbar__field toolbar__field--seg">
          <span className="toolbar__lbl" id="cp-metal-l">
            <Icon name="medal" size={13} /> {L('Les 20 Flèches en…', 'All 20 Flèches in…')}
          </span>
          <div className="checks" role="group" aria-labelledby="cp-metal-l">
            {METAUX.map(([f, fr, en]) => (
              <label key={f} className={`check check--${f}${metaux.includes(f) ? ' is-on' : ''}`}>
                <input type="checkbox" checked={metaux.includes(f)} onChange={() => basculer(f)} />
                {L(fr, en)} <span className="check__n">{parMetal[f]}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="toolbar__field">
          <label htmlFor="cp-sexe"><Icon name="user" size={13} /> {t('f.sexe')}</label>
          <select id="cp-sexe" value={sexe} onChange={(e) => setSexe(e.target.value)}>
            <option value="">{t('f.all')}</option>
            <option value="H">{L('Hommes', 'Men')}</option>
            <option value="F">{L('Femmes', 'Women')}</option>
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
      </div>

      <Resultbar
        innerRef={haut}
        actions={
          <>
            {filtre && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={effacer}>
                {L('Effacer les filtres', 'Clear filters')}
              </button>
            )}
            <button type="button" className="btn btn--secondary btn--sm" onClick={exportCSV} disabled={!liste.length}>
              <Icon name="download" size={15} /> {t('f.export')}
            </button>
          </>
        }
      >
        <b>{fmt(liste.length)}</b> {liste.length > 1 ? L('lauréats', 'finishers') : L('lauréat', 'finisher')}
      </Resultbar>

      {plusProches.map(({ f, riders }) => {
        const m = METAUX.find((x) => x[0] === f)
        return (
          <div className="empty-metal" key={f}>
            <p>
              <b>{L(`Personne n'a encore réalisé la Complète ${m[3]}.`, `Nobody has achieved the Complete ${m[4]} yet.`)}</b>{' '}
              {L('Les plus proches :', 'Closest riders:')}
            </p>
            <ol className="proches">
              {riders.map(({ p, n }) => (
                <li key={p.id}>
                  <a className="link" href={`#/annuaire/pid=${p.id}`}>
                    <b>{p.nom} {p.prenom}</b>
                  </a>
                  <span className="muted proches__club">{nomClub(p.club, lang) || t('f.none')}</span>
                  <Tally f={f} n={n} total={total} />
                </li>
              ))}
            </ol>
          </div>
        )
      })}

      {liste.length > 0 && (
        <div className="table-scroll">
          <table className="table-app table-app--stack table-app--complete">
            <thead>
              <tr>
                {th('nom', L('Cycliste', 'Rider'))}
                {METAUX.map(([f, fr, en]) =>
                  th(
                    f,
                    <Badge code={f} titre={L(`Flèches faites en ${fr.toLowerCase()}`, `Flèches ridden in ${en.toLowerCase()}`)} />,
                    'col-metal',
                  ),
                )}
                {th('nb', L('Homologations', 'Validated rides'), 'num')}
                <th scope="col">{L('Période', 'Period')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const p = parNom.get(norm(c.nom))
                return (
                  <tr key={`${c.nom}-${c.id}`}>
                    <th scope="row">
                      <span className="cell-rider">
                        {p ? (
                          <a className="link" href={`#/annuaire/pid=${p.id}`}>
                            {c.nom}
                          </a>
                        ) : (
                          c.nom
                        )}
                        <span className="muted" aria-label={c.sexe === 'F' ? L('femme', 'woman') : L('homme', 'man')}>
                          {c.sexe === 'F' ? ' ♀' : ' ♂'}
                        </span>
                      </span>
                      <span className="cell-sub">{nomClub(c.club, lang) || t('f.none')}</span>
                    </th>
                    {METAUX.map(([f, fr, en]) => (
                      <td key={f} data-label={L(fr, en)} className="col-metal">
                        <Tally f={f} n={compte(c.id, f)} total={total} />
                      </td>
                    ))}
                    <td data-label={L('Homologations', 'Validated rides')} className="num">
                      {c.nb}
                    </td>
                    <td data-label={L('Période', 'Period')} className="cell-period">
                      {dateCourte(c.premiere)} → {dateCourte(c.derniere)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {liste.length === 0 && plusProches.length === 0 && (
        <p className="empty">{L('Aucun lauréat ne correspond à ces filtres.', 'No finisher matches these filters.')}</p>
      )}
      <Pager
        page={pageSure}
        pages={pages}
        total={liste.length}
        unite={['lauréats', 'finishers']}
        onPage={changerPage}
        label={L('Pagination des lauréats', 'Finishers pagination')}
      />
      <p className="t-small muted">
        {L(
          'Lauréats calculés sur le journal des homologations (20 destinations distinctes). Le club indiqué est celui de la dernière homologation de chaque cycliste.',
          'Finishers computed from the validated rides log (20 distinct destinations). The club shown is the one of each rider’s latest validated ride.',
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
