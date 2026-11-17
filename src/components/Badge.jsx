import { FORMULES } from '../lib/data.js'
import { useLang } from '../lib/i18n.js'

const NOM = { O: 'Or', A: 'Argent', B: 'Bronze' }
const NOM_EN = { O: 'Gold', A: 'Silver', B: 'Bronze' }

export default function Badge({ code, titre }) {
  const lang = useLang()
  if (!code || !NOM[code]) return <span className="formule formule--vide">—</span>
  const nom = lang === 'en' ? NOM_EN[code] : NOM[code]
  return (
    <span
      className={`formule formule--${code}`}
      title={titre ?? (lang === 'en' ? `${nom} formula` : `Formule ${nom}`)}
    >
      {nom}
    </span>
  )
}

export { FORMULES, NOM, NOM_EN }
