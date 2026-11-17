import { useEffect, useRef, useState } from 'react'
import { useRoute } from '../lib/store.jsx'
import { makeT, LANGS } from '../lib/i18n.js'
import Icon from './Icon.jsx'

/** Lien externe vers la page d'origine du club (contenu du site hôte). */
const LIENS_ACP = [
  ['https://www.audax-club-parisien.com/notre-club/', 'nav.club'],
  ['https://www.audax-club-parisien.com/nos-organisations/', 'nav.orgas'],
  ['https://www.audax-club-parisien.com/organisation/paris-brest-paris-randonneur/', 'nav.pbrp'],
  ['https://www.audax-club-parisien.com/calendrier/', 'nav.calendrier'],
  ['https://www.audax-club-parisien.com/actualites/', 'nav.actualites'],
  ['https://www.audax-club-parisien.com/partenaires/', 'nav.partenaires'],
]

const VUES = [
  ['presentation', 'nav.presentation', 'book-open'],
  ['carte', 'nav.carte', 'map'],
  ['annuaire', 'nav.annuaire', 'users'],
  ['defis', 'nav.defis', 'trophy'],
  ['clubs', 'nav.clubs', 'bar-chart'],
]

export default function Header({ lang, setLang, onSearch }) {
  const [route, go] = useRoute()
  const t = makeT(lang)
  const [open, setOpen] = useState(false)
  const sheetRef = useRef(null)
  const toggleRef = useRef(null)

  // Escape referme le panneau, le focus revient sur son bouton
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    sheetRef.current?.querySelector('a')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => setOpen(false), [route.view])

  const submit = (e) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')
    onSearch(String(q ?? '').trim())
  }

  return (
    <header className="nav" style={{ '--nav': 'var(--nav-h)' }}>
      {/* une seule barre : liaison d'évitement, rangée hôte, rangée rubrique */}
      <div className="acp-bar">
        <a
          className="skip-link"
          href="#top"
          onClick={(e) => {
            // on ne touche pas au hash : il porte la route (#/vue)
            e.preventDefault()
            const cible = document.getElementById('top')
            cible?.focus?.()
            cible?.scrollIntoView({ block: 'start' })
          }}
        >
          {t('nav.skip')}
        </a>

        {/* rangée hôte : menu principal du site Audax Club Parisien */}
        <div className="acp-bar__top">
          <div className="wrap acp-bar__in">
          <nav aria-label="Menu principal Audax Club Parisien" className="acp-bar__links">
            {LIENS_ACP.map(([href, key]) => (
              <a key={key} href={href} target="_blank" rel="noreferrer">
                {t(key)}
              </a>
            ))}
          </nav>
          <label className="lang">
            <span className="sr-only">Langue</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nom}
                </option>
              ))}
            </select>
          </label>
          </div>
        </div>

        {/* rangée rubrique : logo, vues locales, recherche */}
        <div className="wrap acp-main">
        <a
          className="acp-logo"
          href="#/presentation"
          onClick={(e) => {
            e.preventDefault()
            go('presentation')
          }}
        >
          <img src="./assets/logo-acp.png" alt="" width="66" height="37" />
          <span className="acp-logo__txt">
            <b>Flèches de France</b>
            <i>Audax Club Parisien</i>
          </span>
        </a>

        <nav aria-label="Sections des Flèches de France" className="acp-tabs">
          {VUES.map(([view, key, ico]) => (
            <a
              key={view}
              href={`#/${view}`}
              aria-current={route.view === view ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                go(view)
              }}
            >
              <Icon name={ico} size={15} className="acp-tabs__ico" />
              {t(key)}
            </a>
          ))}
        </nav>

        <form className="acp-search" role="search" onSubmit={submit}>
          <label className="sr-only" htmlFor="q-header">
            {t('nav.search')}
          </label>
          <Icon name="search" size={16} className="acp-search__ico" />
          <input
            id="q-header"
            name="q"
            type="search"
            placeholder="Rechercher…"
            autoComplete="off"
          />
        </form>

        <button
          ref={toggleRef}
          type="button"
          className="acp-burger"
          aria-expanded={open}
          aria-controls="nav-sheet"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t('nav.close') : t('nav.menu')}
        </button>
        </div>
      </div>

      {open && (
        <div className="nav-sheet" id="nav-sheet" ref={sheetRef}>
          <nav aria-label="Sections" className="wrap nav-sheet__list">
            {VUES.map(([view, key, ico]) => (
              <a
                key={view}
                href={`#/${view}`}
                aria-current={route.view === view ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  go(view)
                }}
              >
                <Icon name={ico} size={17} />
                {t(key)}
              </a>
            ))}
            <hr />
            {LIENS_ACP.map(([href, key]) => (
              <a key={key} href={href} target="_blank" rel="noreferrer">
                {t(key)} ↗
              </a>
            ))}
            <hr />
            <label className="lang lang--sheet">
              <span className="sr-only">Langue</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nom}
                  </option>
                ))}
              </select>
            </label>
          </nav>
        </div>
      )}
    </header>
  )
}
