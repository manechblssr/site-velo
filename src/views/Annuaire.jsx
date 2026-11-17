import { useEffect, useMemo, useState } from 'react'
import PalmaresNav from '../components/PalmaresNav.jsx'
import Fiche from '../components/Fiche.jsx'
import Badge from '../components/Badge.jsx'
import Icon from '../components/Icon.jsx'
import { makeT, pick, nomClub } from '../lib/i18n.js'
import { fmt, norm, downloadCSV, TRANCHES } from '../lib/data.js'
import { useRoute } from '../lib/store.jsx'

const PAR_PAGE = 25
const RANG = { O: 3, A: 2, B: 1 }

const VIDE = {
  annee: '',
  club: '',
  fede: '',
  fleche: '',
  formule: '',
  sexe: '',
  tranche: '',
  dept: '',
  pays: '',
  neo: false,
  complete: false,
}

/* filtres regroupés dans le panneau « Filtres avancés » */
const CLES_AVANCEES = ['fede', 'fleche', 'sexe', 'tranche', 'dept', 'pays', 'neo', 'complete']

/* « (vide) » et « ? » du classeur = commune inconnue */
const commune = (v) => (v && !/^\s*(\(vide\)|\?)\s*$/i.test(v) ? v : '')

export default function Annuaire({ lang, data, routeParam }) {
  const t = makeT(lang)
  const L = pick(lang)
  const [, go] = useRoute()
  const { participants, homologations, fleches, clubs, meta } = data

  const [q, setQ] = useState('')
  const [f, setF] = useState(VIDE)
  const [tri, setTri] = useState('nb')
  const [sens, setSens] = useState(1) // 1 : ordre naturel de la colonne, -1 : inversé
  const [page, setPage] = useState(1)
  const [manager, setManager] = useState(false)
  const [avances, setAvances] = useState(false) // panneau « Filtres avancés »
  const [ouvert, setOuvert] = useState(null) // participant affiché en fiche

  /* --- paramètres venus d'une autre vue (#/annuaire/fleche=… ou pid=…) --- */
  useEffect(() => {
    if (!routeParam) return
    const p = new URLSearchParams(routeParam)
    if (p.has('q')) setQ(p.get('q'))
    if (p.has('fleche')) setF((v) => ({ ...v, fleche: p.get('fleche') }))
    if (p.has('pid')) {
      const id = Number(p.get('pid'))
      const pers = participants.find((x) => x.id === id)
      if (pers) setOuvert(pers)
    }
    if (p.has('club')) setF((v) => ({ ...v, club: p.get('club') }))
  }, [routeParam, participants])

  const set = (k, v) => {
    setF((old) => ({ ...old, [k]: v }))
    setPage(1)
  }

  /* --- options de filtre issues de la base ------------------------------ */
  const options = useMemo(() => {
    const annees = [...new Set(homologations.map((h) => h.annee))].sort((a, b) => b - a)
    const fedes = [...new Set(participants.map((p) => p.fede).filter(Boolean))].sort()
    const depts = [...new Set(participants.map((p) => p.dept).filter(Boolean))].sort()
    const pays = [...new Set(participants.map((p) => p.pays).filter(Boolean))].sort()
    const clubNames = [...new Set(clubs.map((c) => c.nom))].sort()
    return { annees, fedes, depts, pays, clubNames }
  }, [homologations, participants, clubs])

  /* --- filtrage ---------------------------------------------------------- */
  const liste = useMemo(() => {
    const qq = norm(q)

    // 1. périmètre sur les homologations (année, flèche, formule)
    const filtresH = []
    for (const h of homologations) {
      if (f.annee && h.annee !== Number(f.annee)) continue
      if (f.fleche && h.dest !== f.fleche) continue
      if (f.formule && h.formule !== f.formule) continue
      filtresH.push(h)
    }

    // 2. regroupement par participant dans ce périmètre
    const parId = new Map()
    for (const h of filtresH) {
      let a = parId.get(h.pid)
      if (!a) {
        a = { nb: 0, km: 0, dplus: 0, dests: new Set(), O: 0, A: 0, B: 0, premiere: null, derniere: null }
        parId.set(h.pid, a)
      }
      a.nb += 1
      a.km += h.km || 0
      a.dplus += h.dplus || 0
      a.dests.add(h.dest)
      if (a[h.formule] !== undefined) a[h.formule] += 1
      if (!a.premiere || h.date < a.premiere) a.premiere = h.date
      if (!a.derniere || h.date > a.derniere) a.derniere = h.date
    }

    // 3. filtres portant sur la personne
    const out = []
    for (const p of participants) {
      const a = parId.get(p.id)
      if (!a) continue
      if (f.sexe && p.sexe !== f.sexe) continue
      if (f.tranche && p.tranche !== f.tranche) continue
      if (f.club && norm(p.club) !== norm(f.club)) continue
      if (f.fede && (p.fede || '(vide)') !== f.fede) continue
      if (f.dept && p.dept !== f.dept) continue
      if (f.pays && p.pays !== f.pays) continue
      if (f.complete && !p.complete) continue
      if (f.neo && p.premiereAnnee !== Number(f.annee || p.premiereAnnee)) continue
      if (qq && !norm(`${p.nom} ${p.prenom} ${p.ville} ${p.club} ${p.code}`).includes(qq)) continue
      out.push({ p, a })
    }

    // 4. tri : ordre naturel de la colonne (A → Z pour le texte, du plus
    //    grand au plus petit pour les nombres), inversé si sens = -1. Les
    //    valeurs vides (club, commune) restent toujours en fin de liste.
    const txt = (a, b) => {
      if (!a && !b) return 0
      if (!a) return Infinity
      if (!b) return -Infinity
      return a.localeCompare(b, 'fr', { sensitivity: 'base' })
    }
    const parNom = (x, y) => x.p.nom.localeCompare(y.p.nom, 'fr') || x.p.prenom.localeCompare(y.p.prenom, 'fr')
    const cmp = {
      nb: (x, y) => y.a.nb - x.a.nb,
      km: (x, y) => y.a.km - x.a.km,
      nom: parNom,
      club: (x, y) => txt(nomClub(x.p.club, lang), nomClub(y.p.club, lang)),
      ville: (x, y) => txt(commune(x.p.ville), commune(y.p.ville)),
      recent: (x, y) => (y.a.derniere || '').localeCompare(x.a.derniere || ''),
      distinctes: (x, y) => y.a.dests.size - x.a.dests.size,
    }[tri]
    out.sort((x, y) => {
      const c = cmp(x, y)
      if (c === Infinity || c === -Infinity) return c > 0 ? 1 : -1
      return c * sens || y.a.nb - x.a.nb || parNom(x, y)
    })
    return out
  }, [q, f, tri, sens, participants, homologations, lang])

  useEffect(() => setPage(1), [q, f, tri, sens])

  /* Rang au nombre total de flèches homologuées, dans la sélection en cours :
     ex aequo au même rang (1, 2, 2, 4…), quel que soit l'ordre d'affichage. */
  const rangs = useMemo(() => {
    const nbs = liste.map((x) => x.a.nb).sort((a, b) => b - a)
    const premierRang = new Map()
    nbs.forEach((n, i) => {
      if (!premierRang.has(n)) premierRang.set(n, i + 1)
    })
    return premierRang
  }, [liste])

  /* Clic sur un en-tête : trie sur la colonne, un second clic inverse. */
  const trierPar = (cle) => {
    if (cle === tri) setSens((x) => -x)
    else {
      setTri(cle)
      setSens(1)
    }
  }
  const enTete = (cle, libelle, className = '') => {
    const actif = tri === cle
    const croissant = ['nom', 'club', 'ville'].includes(cle) ? sens > 0 : sens < 0
    return (
      <th
        scope="col"
        className={`th-click${className ? ` ${className}` : ''}${actif ? ' is-sorted' : ''}`}
        aria-sort={actif ? (croissant ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          className={`th-sort${actif ? ' is-active' : ''}`}
          onClick={() => trierPar(cle)}
          title={L('Cliquer pour trier', 'Click to sort')}
        >
          {libelle}
          <span className="th-sort__ico" aria-hidden="true">
            {actif ? (croissant ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  const pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE))
  const visible = liste.slice((page - 1) * PAR_PAGE, page * PAR_PAGE)

  const exporter = () =>
    downloadCSV(
      'annuaire-fleches-de-france.csv',
      [
        { label: L('Rang (flèches)', 'Rank (Flèches)'), value: (x) => rangs.get(x.a.nb) },
        { label: L('Nom', 'Last name'), value: (x) => x.p.nom },
        { label: L('Prénom', 'First name'), value: (x) => x.p.prenom },
        { label: L('Sexe', 'Gender'), value: (x) => x.p.sexe },
        { label: L('Club', 'Club'), value: (x) => x.p.club },
        { label: L('Code club', 'Club code'), value: (x) => x.p.code },
        { label: L('Fédération', 'Federation'), value: (x) => x.p.fede },
        { label: L('Commune', 'Town'), value: (x) => x.p.ville },
        { label: L('Département', 'Department'), value: (x) => x.p.dept },
        { label: L('Pays', 'Country'), value: (x) => x.p.pays },
        { label: L('Tranche âge', 'Age band'), value: (x) => x.p.tranche },
        { label: L('Homologations', 'Validated rides'), value: (x) => x.a.nb },
        { label: L('Flèches distinctes', 'Distinct Flèches'), value: (x) => x.a.dests.size },
        { label: 'Km', value: (x) => x.a.km },
        { label: L('D+ (m)', 'Elevation gain (m)'), value: (x) => x.a.dplus },
        { label: L('Or', 'Gold'), value: (x) => x.a.O },
        { label: L('Argent', 'Silver'), value: (x) => x.a.A },
        { label: 'Bronze', value: (x) => x.a.B },
        { label: L('Première flèche', 'First Flèche'), value: (x) => x.a.premiere },
        { label: L('Dernière flèche', 'Last Flèche'), value: (x) => x.a.derniere },
        ...(manager
          ? [
              { label: L('Téléphone', 'Phone'), value: (x) => x.p.tel },
              { label: L('Adresse', 'Address'), value: (x) => x.p.rue },
              { label: L('Code postal', 'Postcode'), value: (x) => x.p.cp },
            ]
          : []),
      ],
      liste,
    )

  const actifs = Object.entries(f).filter(([, v]) => v !== '' && v !== false)
  const nbAvances =
    CLES_AVANCEES.filter((k) => f[k] !== '' && f[k] !== false).length + (tri !== 'nb' ? 1 : 0)
  const premier = liste.length === 0 ? 0 : (page - 1) * PAR_PAGE + 1
  const dernier = Math.min(page * PAR_PAGE, liste.length)
  const range = t('f.showing')
    .replace('{a}', fmt(premier))
    .replace('{b}', fmt(dernier))
    .replace('{n}', fmt(liste.length))

  return (
    <section className="section section--page" aria-labelledby="h-annuaire">
      <div className="wrap">
        <PalmaresNav actif="annuaire" />
        <div className="section-head section-head--row">
          <h1 id="h-annuaire" className="t-h2">
            {t('view.annuaire')}{' '}
            <span className="muted">
              {L(
                `${fmt(meta.participants)} personnes · ${fmt(meta.homologations)} homologations`,
                `${fmt(meta.participants)} riders · ${fmt(meta.homologations)} validated rides`,
              )}
            </span>
          </h1>
        </div>

        {/* --- filtres principaux : recherche + Année + Club + Formule ----- */}
        <div className="toolbar toolbar--main" role="search" aria-label={L("Filtres de l'annuaire", 'Directory filters')}>
          <div className="toolbar__field toolbar__field--wide">
            <label htmlFor="an-q"><Icon name="search" size={13} /> {t('f.search')}</label>
            <input
              id="an-q"
              type="search"
              value={q}
              placeholder="Dupont, Luchon, 92100…"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="toolbar__field">
            <label htmlFor="an-annee"><Icon name="calendar" size={13} /> {t('f.year')}</label>
            <select id="an-annee" value={f.annee} onChange={(e) => set('annee', e.target.value)}>
              <option value="">{t('f.all')}</option>
              {options.annees.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar__field">
            <label htmlFor="an-club"><Icon name="building" size={13} /> {t('f.club')}</label>
            <input
              id="an-club"
              list="liste-clubs"
              value={f.club}
              placeholder={L('Tous les clubs', 'All clubs')}
              onChange={(e) => set('club', e.target.value)}
            />
            <datalist id="liste-clubs">
              {options.clubNames.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="toolbar__field">
            <label htmlFor="an-formule"><Icon name="medal" size={13} /> {t('f.formule')}</label>
            <select
              id="an-formule"
              value={f.formule}
              onChange={(e) => set('formule', e.target.value)}
            >
              <option value="">{t('f.all')}</option>
              <option value="O">{L('Or', 'Gold')}</option>
              <option value="A">{L('Argent', 'Silver')}</option>
              <option value="B">Bronze</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn--secondary toolbar__toggle"
            aria-expanded={avances}
            aria-controls="an-avances"
            onClick={() => setAvances((v) => !v)}
          >
            <Icon name="filter" size={15} /> {t('f.advanced')}
            {nbAvances > 0 && <span className="pill">{nbAvances}</span>}
          </button>
        </div>

        {/* --- filtres secondaires : repliés par défaut -------------------- */}
        {avances && (
          <div
            className="toolbar toolbar--adv"
            id="an-avances"
            role="group"
            aria-label={t('f.advanced')}
          >
            <div className="toolbar__field">
              <label htmlFor="an-fede"><Icon name="landmark" size={13} /> {t('f.fede')}</label>
              <select id="an-fede" value={f.fede} onChange={(e) => set('fede', e.target.value)}>
                <option value="">{t('f.all')}</option>
                {options.fedes.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
                <option value="(vide)">{L('Sans licence', 'No licence')}</option>
              </select>
            </div>

            <div className="toolbar__field">
              <label htmlFor="an-fleche"><Icon name="route" size={13} /> {t('f.fleche')}</label>
              <select id="an-fleche" value={f.fleche} onChange={(e) => set('fleche', e.target.value)}>
                <option value="">{t('f.all')}</option>
                {fleches.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom}
                  </option>
                ))}
              </select>
            </div>

            <div className="toolbar__field">
              <label htmlFor="an-sexe"><Icon name="user" size={13} /> {t('f.sexe')}</label>
              <select id="an-sexe" value={f.sexe} onChange={(e) => set('sexe', e.target.value)}>
                <option value="">{t('f.all')}</option>
                <option value="H">{L('Hommes', 'Men')}</option>
                <option value="F">{L('Femmes', 'Women')}</option>
              </select>
            </div>

            <div className="toolbar__field">
              <label htmlFor="an-tranche"><Icon name="users" size={13} /> {t('f.age')}</label>
              <select
                id="an-tranche"
                value={f.tranche}
                onChange={(e) => set('tranche', e.target.value)}
              >
                <option value="">{t('f.all')}</option>
                {TRANCHES.map((x) => (
                  <option key={x.code} value={x.code}>
                    {L(x.nom, x.en)}
                  </option>
                ))}
              </select>
            </div>

            <div className="toolbar__field">
              <label htmlFor="an-dept"><Icon name="map-pin" size={13} /> {t('f.dept')}</label>
              <select id="an-dept" value={f.dept} onChange={(e) => set('dept', e.target.value)}>
                <option value="">{t('f.all')}</option>
                {options.depts.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div className="toolbar__field">
              <label htmlFor="an-pays"><Icon name="globe" size={13} /> {t('f.pays')}</label>
              <select id="an-pays" value={f.pays} onChange={(e) => set('pays', e.target.value)}>
                <option value="">{t('f.all')}</option>
                {options.pays.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div className="toolbar__field toolbar__field--sort">
              <label htmlFor="an-tri"><Icon name="list" size={13} /> {t('f.sort')}</label>
              <select
                id="an-tri"
                value={tri}
                onChange={(e) => {
                  setTri(e.target.value)
                  setSens(1)
                }}
              >
                <option value="nb">{L('Nombre de flèches', 'Number of Flèches')}</option>
                <option value="club">{L('Club (A → Z)', 'Club (A → Z)')}</option>
                <option value="ville">{L('Commune (A → Z)', 'Town (A → Z)')}</option>
                <option value="distinctes">{L('Flèches distinctes', 'Distinct Flèches')}</option>
                <option value="km">{L('Kilomètres', 'Kilometres')}</option>
                <option value="recent">{L('Dernière participation', 'Most recent ride')}</option>
                <option value="nom">{L('Nom (A → Z)', 'Name (A → Z)')}</option>
              </select>
            </div>

            <div className="toolbar__checks">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={f.neo}
                  disabled={!f.annee}
                  onChange={(e) => set('neo', e.target.checked)}
                />
                {t('f.neo')}
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={f.complete}
                  onChange={(e) => set('complete', e.target.checked)}
                />
                {t('f.complete')}
              </label>
            </div>
          </div>
        )}

        <div className="result-line">
          <span className="result-line__count">
            <strong>{fmt(liste.length)}</strong> {t('f.results')}
            <span className="muted"> · {range}</span>
          </span>
          {actifs.length > 0 && (
            <button
              type="button"
              className="row-link"
              onClick={() => {
                setF(VIDE)
                setQ('')
              }}
            >
              {t('f.reset')}
            </button>
          )}
          <span className="result-line__actions">
            <label className="switch">
              <input type="checkbox" checked={manager} onChange={(e) => setManager(e.target.checked)} />
              {t('f.manager')}
            </label>
            <button type="button" className="btn btn--secondary btn--sm" onClick={exporter}>
              <Icon name="download" size={15} /> {t('f.export')}
            </button>
          </span>
        </div>

        {manager && (
          <p className="note">{t('f.managerNote')}</p>
        )}

        {visible.length === 0 ? (
          <p className="empty">{t('e.empty')}</p>
        ) : (
          <div className="table-scroll">
            <table className="table-app table-app--lite">
              <thead>
                <tr>
                  <th scope="col" className="num col-rang">
                    {L('Rang', 'Rank')}
                  </th>
                  {enTete('nom', t('t.name'), 'th-click--left')}
                  {enTete('club', t('t.club'), 'th-click--left')}
                  {enTete('ville', t('t.place'), 'th-click--left')}
                  {enTete('nb', t('t.nb'), 'num')}
                  <th scope="col" className="num">
                    {L('Distinctes', 'Distinct')}
                  </th>
                  <th scope="col">{t('t.formule')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('t.view')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ p, a }) => (
                  <tr key={p.id}>
                    <td className="num col-rang">{rangs.get(a.nb)}</td>
                    <th scope="row">
                      <button
                        type="button"
                        className="row-link"
                        onClick={() => setOuvert(p)}
                      >
                        {p.nom} {p.prenom}
                      </button>
                      {p.complete && (
                        <span className="chip chip--actif chip--sous">{t('f.complete')}</span>
                      )}
                      {manager && p.tel && <span className="tel"> · {p.tel}</span>}
                    </th>
                    <td className={tri === 'club' ? 'is-sorted' : ''}>{nomClub(p.club, lang) || '—'}</td>
                    <td className={tri === 'ville' ? 'is-sorted' : ''}>
                      {commune(p.ville) || '—'}
                      {p.dept ? <span className="muted"> ({p.dept})</span> : null}
                      {p.pays && !/^france$/i.test(p.pays) ? (
                        <span className="muted"> · {p.pays}</span>
                      ) : null}
                    </td>
                    <td className={`num${tri === 'nb' ? ' is-sorted' : ''}`}>
                      <b className="nb-dist">{a.nb}</b>
                    </td>
                    <td className="num">
                      {a.dests.size}
                      <span className="muted"> / {fleches.length}</span>
                    </td>
                    <td>
                      <span className="fo-mini">
                        <Badge code="O" />
                        <b>{a.O}</b>
                        <Badge code="A" />
                        <b>{a.A}</b>
                        <Badge code="B" />
                        <b>{a.B}</b>
                      </span>
                    </td>
                    <td className="cell-action">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        aria-label={`${t('t.view')} — ${p.nom} ${p.prenom}`}
                        onClick={() => setOuvert(p)}
                      >
                        <Icon name="user" size={15} /> {t('t.viewShort')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <nav className="pager" aria-label={L('Pagination', 'Pagination')}>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Icon name="chevron-left" size={15} /> {L('Précédent', 'Previous')}
            </button>
            <span className="muted">
              Page {page} / {pages}
            </span>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={page === pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              {L('Suivant', 'Next')} <Icon name="chevron-right" size={15} />
            </button>
          </nav>
        )}
      </div>

      {ouvert && (
        <Fiche
          lang={lang}
          data={data}
          participant={ouvert}
          manager={manager}
          onFleche={(dest) => {
            setOuvert(null)
            set('fleche', dest)
            go('annuaire', `fleche=${encodeURIComponent(dest)}`)
          }}
          onClose={() => setOuvert(null)}
        />
      )}
    </section>
  )
}
