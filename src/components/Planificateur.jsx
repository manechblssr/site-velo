import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { fmt } from '../lib/data.js'

/* Planificateur de flèche — la page qui se superpose à la fenêtre ouverte.
   Tout est calculé dans le navigateur à partir de fleches.json (délais
   officiels Or / Argent / Bronze) : aucun classeur Excel à télécharger
   pour connaître son heure limite, son allure minimale et ses repères. */

const FORMULES = [
  { code: 'O', nom: 'Or' },
  { code: 'A', nom: 'Argent' },
  { code: 'B', nom: 'Bronze' },
]

/** « 15h15 », « 12h », « 307h » → minutes. */
function parseDelai(s) {
  const m = /^(\d+)h(?:(\d+))?$/.exec(String(s ?? '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2] || 0)
}

function fmtDuree(min) {
  const j = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (j > 0) return `${j} j ${h} h`
  if (m > 0) return `${h} h ${String(m).padStart(2, '0')}`
  return `${h} h`
}

const F_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const F_HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

function isoJour(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const ETAPES = [
  { pct: 0, label: 'Départ' },
  { pct: 0.25, label: '25 % du parcours' },
  { pct: 0.5, label: 'Mi-parcours' },
  { pct: 0.75, label: '75 % du parcours' },
  { pct: 1, label: 'Arrivée' },
]

export default function Planificateur({ fleches, onClose }) {
  const box = useRef(null)
  const retour = useRef(null)

  const [flecheId, setFlecheId] = useState(fleches[0]?.id ?? '')
  const [formule, setFormule] = useState('O')
  const [date, setDate] = useState(isoJour())
  const [heure, setHeure] = useState('07:00')

  /* Escape ferme, le focus reste piégé dans la page superposée,
     le défilement de la fenêtre derrière est suspendu. */
  useEffect(() => {
    retour.current = document.activeElement
    box.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && box.current) {
        const f = box.current.querySelectorAll(
          'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
        )
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      retour.current?.focus?.()
    }
  }, [onClose])

  const fleche = useMemo(
    () => fleches.find((f) => f.id === flecheId) ?? fleches[0],
    [fleches, flecheId],
  )

  const plan = useMemo(() => {
    const brut = fleche?.delais?.[formule]
    const duree = parseDelai(brut)
    if (duree === null) return null
    const debut = new Date(`${date}T${heure || '07:00'}`)
    if (Number.isNaN(debut.getTime())) return null
    const fin = new Date(debut.getTime() + duree * 60000)
    const heures = duree / 60
    const allure = fleche.km / heures
    const dplusH = fleche.dplus / heures
    const jours = Math.ceil(heures / 24)
    return {
      duree,
      debut,
      fin,
      allure,
      dplusH,
      jours,
      kmJour: fleche.km / jours,
      etapes: ETAPES.map((e) => ({
        ...e,
        km: Math.round(fleche.km * e.pct),
        heure: new Date(debut.getTime() + duree * e.pct * 60000),
      })),
    }
  }, [fleche, formule, date, heure])

  if (!fleche) return null

  const nomF = FORMULES.find((f) => f.code === formule)?.nom ?? ''

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="planif"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planif-titre"
        tabIndex={-1}
        ref={box}
      >
        <div className="drawer__head planif__head">
          <div>
            <p className="t-label muted">Sans classeur · calcul instantané</p>
            <h2 className="t-h3" id="planif-titre">
              <Icon name="calculator" size={20} className="planif__titre-ico" />
              Planifiez votre Flèche
            </h2>
            <p className="planif__intro">
              Choisissez une flèche, une formule et votre heure de départ : le plan de route
              s'écrit tout seul, délais officiels à l'appui.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="planif__fields">
          <div className="toolbar__field toolbar__field--wide">
            <label htmlFor="planif-fleche">
              <Icon name="map-pin" size={13} /> Flèche
            </label>
            <select
              id="planif-fleche"
              value={flecheId}
              onChange={(e) => setFlecheId(e.target.value)}
            >
              {fleches.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom} — {fmt(f.km)} km · {fmt(f.dplus)} m
                </option>
              ))}
            </select>
          </div>

          <div className="planif__formules" role="group" aria-labelledby="planif-formule-lbl">
            <span className="planif__legend" id="planif-formule-lbl">
              <Icon name="medal" size={13} /> Formule visée
            </span>
            {FORMULES.map((f) => (
              <button
                key={f.code}
                type="button"
                className={`chip${formule === f.code ? ' chip--actif' : ''}`}
                aria-pressed={formule === f.code}
                onClick={() => setFormule(f.code)}
              >
                {f.nom} · {fleche.delais[f.code]}
              </button>
            ))}
          </div>

          <div className="toolbar__field">
            <label htmlFor="planif-date">
              <Icon name="calendar" size={13} /> Date de départ
            </label>
            <input
              id="planif-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="toolbar__field">
            <label htmlFor="planif-heure">
              <Icon name="clock" size={13} /> Heure de départ
            </label>
            <input
              id="planif-heure"
              type="time"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
            />
          </div>
        </div>

        {!plan ? (
          <p className="note">Délai officiel illisible pour cette formule.</p>
        ) : (
          <>
            <div className="kpis planif__kpis">
              <div className="kpi">
                <b className="kpi__v">{fmtDuree(plan.duree)}</b>
                <span className="kpi__l">Délai {nomF} — {fleche.delais[formule]}</span>
              </div>
              <div className="kpi">
                <b className="kpi__v">{F_DATE.format(plan.fin)}</b>
                <span className="kpi__l">Arrivée au plus tard</span>
              </div>
              <div className="kpi">
                <b className="kpi__v">{plan.allure.toFixed(1)} km/h</b>
                <span className="kpi__l">Allure minimale moyenne</span>
              </div>
              <div className="kpi">
                <b className="kpi__v">{fmt(Math.round(plan.dplusH))} m/h</b>
                <span className="kpi__l">Dénivelé à l'heure</span>
              </div>
            </div>

            <div className="planif__cols">
              <section className="planif__bloc" aria-labelledby="planif-etape">
                <h3 className="t-label planif__h" id="planif-etape">
                  <Icon name="route" size={14} /> Repères horaires
                </h3>
                <ul className="planif__steps">
                  {plan.etapes.map((e) => (
                    <li key={e.label} className={e.pct === 0 || e.pct === 1 ? 'is-borne' : ''}>
                      <span className="planif__step-km">{fmt(e.km)} km</span>
                      <span className="planif__step-label">{e.label}</span>
                      <b className="planif__step-h">{F_HEURE.format(e.heure)}</b>
                    </li>
                  ))}
                </ul>
                <p className="planif__note">
                  Répartition indicative au rythme moyen : le contrôle se fait à l'arrivée.
                </p>
              </section>

              <section className="planif__bloc" aria-labelledby="planif-reperes">
                <h3 className="t-label planif__h" id="planif-reperes">
                  <Icon name="info" size={14} /> Le parcours
                </h3>
                <ul className="planif__rows">
                  <li>
                    <span>Distance</span>
                    <b>{fmt(fleche.km)} km</b>
                  </li>
                  <li>
                    <span>Dénivelé positif</span>
                    <b>{fmt(fleche.dplus)} m</b>
                  </li>
                  <li>
                    <span>
                      <Icon name="map-pin" size={13} /> Départ décalé
                    </span>
                    <b>
                      {fleche.depart.commune} · {fmt(fleche.depart.km)} km
                    </b>
                  </li>
                  <li>
                    <span>
                      <Icon name="bike" size={13} /> Formules attendues
                    </span>
                    <b>
                      Or {fmt(fleche.stats.O)} · Argent {fmt(fleche.stats.A)} · Bronze{' '}
                      {fmt(fleche.stats.B)}
                    </b>
                  </li>
                  {plan.jours > 1 && (
                    <li>
                      <span>
                        <Icon name="moon" size={13} /> Sur {plan.jours} journées
                      </span>
                      <b>{fmt(Math.round(plan.kmJour))} km/jour minimum</b>
                    </li>
                  )}
                </ul>
                <p className="planif__note">
                  {plan.jours > 1
                    ? 'Délai long : répartissez le parcours sur plusieurs journées avec dormées autorisées.'
                    : 'Délai court : parcours à réaliser en une traite, sans dormir sur le parcours.'}
                </p>
              </section>
            </div>

            <div className="planif__actions">
              <a
                className="btn btn--primary"
                href={fleche.openrunner}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="map" size={16} /> Ouvrir le tracé OpenRunner
              </a>
              <a className="btn btn--secondary" href={fleche.pdf} target="_blank" rel="noreferrer">
                <Icon name="file-text" size={16} /> Feuille de route PDF
              </a>
              <a
                className="link planif__xls"
                href="./assets/Calculateur-fleches-v2.3.xlsx"
                download
              >
                <Icon name="download" size={14} /> Classeur Excel (v2.3)
              </a>
            </div>
          </>
        )}
      </div>
    </>
  )
}
