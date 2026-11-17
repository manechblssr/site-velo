import { useEffect, useState } from 'react'
import { DataProvider, useData, useRoute } from './lib/store.jsx'
import { makeT, LangContext } from './lib/i18n.js'
import { setLocale } from './lib/data.js'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Presentation from './views/Presentation.jsx'
import Carte from './views/Carte.jsx'
import Annuaire from './views/Annuaire.jsx'
import Defis from './views/Defis.jsx'
import Clubs from './views/Clubs.jsx'

function Shell() {
  const { status, data, error } = useData()
  const [route, go] = useRoute()
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('ff-lang') === 'en' ? 'en' : 'fr'
    } catch {
      return 'fr'
    }
  })
  setLocale(lang)
  const t = makeT(lang)
  const setLang = (l) => {
    setLangState(l)
    try {
      localStorage.setItem('ff-lang', l)
    } catch {
      /* stockage indisponible : la langue reste valable pour la session */
    }
  }
  useEffect(() => {
    document.documentElement.lang = lang
    document.title =
      lang === 'en'
        ? 'Flèches de France: the 20 permanent rides of the Audax Club Parisien'
        : "Flèches de France : les 20 randonnées permanentes de l'Audax Club Parisien"
  }, [lang])

  // recherche de l'en-tête → annuaire pré-rempli (#/annuaire/q=…)
  const onSearch = (q) => go('annuaire', q ? `q=${encodeURIComponent(q)}` : '')

  // carte → fiche d'une flèche dans l'annuaire (#/annuaire/fleche=…)
  const onOpenFleche = (id) => go('annuaire', `fleche=${encodeURIComponent(id)}`)

  // carte → fiche palmarès d'un participant (#/annuaire/pid=…)
  const onOpenParticipant = (pid) => go('annuaire', `pid=${pid}`)

  if (status === 'loading') {
    return (
      <div className="boot" role="status">
        <div className="boot__in">
          <span className="skeleton" style={{ width: 220 }} />
          <span className="skeleton" style={{ width: 320 }} />
          <p className="muted">{t('e.loading')}</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="boot" role="alert">
        <div className="boot__in">
          <h1>{t('e.error')}</h1>
          <p className="muted">{String(error?.message ?? error)}</p>
          <p className="muted">
            {lang === 'en' ? 'Rebuild the data:' : 'Régénérez les données :'} python scripts/build_data.py
          </p>
        </div>
      </div>
    )
  }

  const meta = data.meta
  const vues = {
    presentation: <Presentation lang={lang} data={data} />,
    carte: (
      <Carte
        lang={lang}
        data={data}
        routeParam={route.param}
        onOpenFleche={onOpenFleche}
        onOpenParticipant={onOpenParticipant}
      />
    ),
    annuaire: <Annuaire lang={lang} data={data} routeParam={route.param} />,
    defis: <Defis lang={lang} data={data} routeParam={route.param} />,
    clubs: <Clubs lang={lang} data={data} />,
  }

  return (
    <LangContext.Provider value={lang}>
      <Header lang={lang} setLang={setLang} onSearch={onSearch} />
      <main id="top" key={route.view} tabIndex={-1}>
        {vues[route.view]}
      </main>
      <Footer lang={lang} meta={meta} />
    </LangContext.Provider>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}
