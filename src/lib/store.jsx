import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { loadAll, buildIndex } from './data.js'

const DataCtx = createContext(null)

/** Charge les 8 JSON une seule fois et les met à disposition de toutes les vues. */
export function DataProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  useEffect(() => {
    let alive = true
    loadAll()
      .then((data) => alive && setState({ status: 'ready', data, error: null }))
      .catch((error) => alive && setState({ status: 'error', data: null, error }))
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo(() => {
    if (state.status !== 'ready') return state
    const data = state.data
    // index participant → texte de recherche, et participant par id
    const searchIdx = buildIndex(data.participants)
    const byId = new Map(data.participants.map((p) => [p.id, p]))
    // flèche id → ligne d'homologations agrégées
    return { ...state, searchIdx, byId, flecheById: new Map(data.fleches.map((f) => [f.id, f])) }
  }, [state])

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export function useData() {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData hors DataProvider')
  return ctx
}

/* --- Routeur en hash : aucune dépendance, fonctionne en file:// ---------- */

const ROUTES = ['presentation', 'carte', 'annuaire', 'defis', 'clubs']

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [view, ...rest] = raw.split('/')
  return { view: ROUTES.includes(view) ? view : 'presentation', param: rest.join('/') || '' }
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (view, param = '') => {
    window.location.hash = `#/${view}${param ? `/${param}` : ''}`
    // remonte en haut sauf si l'on clique une ancre interne
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return [route, go]
}
