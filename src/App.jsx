import { useState } from 'react'
import { DataProvider, useData, useRoute } from './lib/store.jsx'
import { makeT } from './lib/i18n.js'
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
  const [lang, setLang] = useState('fr')
  const t = makeT(lang)

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
          <p className="muted">Régénérez les données : python scripts/build_data.py</p>
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
    defis: <Defis lang={lang} data={data} />,
    clubs: <Clubs lang={lang} data={data} />,
  }

  return (
    <>
      <Header lang={lang} setLang={setLang} onSearch={onSearch} />
      <main id="top" key={route.view}>
        {vues[route.view]}
      </main>
      <Footer lang={lang} meta={meta} />
      {lang === 'en' && (
        <p className="lang-note">
          Editorial texts keep their official French wording; interface labels are translated.
        </p>
      )}
    </>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}
