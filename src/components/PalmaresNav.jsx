import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'
import { useRoute } from '../lib/store.jsx'
import { useL } from '../lib/i18n.js'

/* Les trois sous-pages de l'onglet « Palmarès ». Chacune garde sa propre
   adresse (#/annuaire, #/clubs, #/evolution) : les liens existants vers une
   fiche (#/annuaire/pid=…) continuent de fonctionner. */
export const SOUS_PALMARES = [
  ['annuaire', 'Palmarès individuel', 'Individual records', 'user'],
  ['clubs', 'Palmarès club', 'Club records', 'building'],
  ['evolution', 'Évolution annuelle', 'Year by year', 'bar-chart'],
]
export const VUES_PALMARES = SOUS_PALMARES.map((s) => s[0])

export default function PalmaresNav({ actif }) {
  const L = useL()
  const [, go] = useRoute()
  const ref = useRef(null)
  /* sur mobile la barre défile : la sous-page active reste visible */
  useEffect(() => {
    const bar = ref.current
    const tab = bar?.querySelector('[aria-current="page"]')
    if (bar && tab && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = tab.offsetLeft - bar.offsetLeft - 16
  }, [actif])
  return (
    <nav ref={ref} className="tabs-app tabs-app--defis palmares-nav" aria-label={L('Palmarès', 'Records')}>
      <span className="palmares-nav__titre" aria-hidden="true">
        <Icon name="trophy" size={16} /> {L('Palmarès', 'Records')}
      </span>
      {SOUS_PALMARES.map(([vue, fr, en, ico]) => (
        <a
          key={vue}
          href={`#/${vue}`}
          className="tab-app"
          aria-current={actif === vue ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault()
            if (actif !== vue) go(vue)
          }}
        >
          <Icon name={ico} size={15} /> {L(fr, en)}
        </a>
      ))}
    </nav>
  )
}
