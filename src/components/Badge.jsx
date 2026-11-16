import { FORMULES } from '../lib/data.js'

const NOM = { O: 'Or', A: 'Argent', B: 'Bronze' }

export default function Badge({ code, titre }) {
  if (!code || !NOM[code]) return <span className="formule formule--vide">—</span>
  return (
    <span className={`formule formule--${code}`} title={titre ?? `Formule ${NOM[code]}`}>
      {NOM[code]}
    </span>
  )
}

export { FORMULES, NOM }
