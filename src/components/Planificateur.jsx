import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { fmt } from '../lib/data.js'
import { useLang, pick } from '../lib/i18n.js'

/* Planificateur de flèche — la page qui se superpose à la fenêtre ouverte.
   Tout est calculé dans le navigateur à partir de fleches.json (délais
   officiels Or / Argent / Bronze, contrôles et km de l'onglet Etapes du
   calculateur officiel) : aucun classeur Excel à télécharger. */

const FORMULES = [
  { code: 'O', nom: 'Or', en: 'Gold' },
  { code: 'A', nom: 'Argent', en: 'Silver' },
  { code: 'B', nom: 'Bronze', en: 'Bronze' },
]

/** « 15h15 », « 12h », « 307h » → minutes. */
function parseDelai(s) {
  const m = /^(\d+)h(?:(\d+))?$/.exec(String(s ?? '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2] || 0)
}

function fmtDuree(min, lang) {
  const j = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (j > 0) return lang === 'en' ? `${j} d ${h} h` : `${j} j ${h} h`
  if (m > 0) return `${h} h ${String(m).padStart(2, '0')}`
  return `${h} h`
}

const OPTS_DATE = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}
const FORMATS = {
  fr: {
    date: new Intl.DateTimeFormat('fr-FR', OPTS_DATE),
    heure: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  },
  en: {
    date: new Intl.DateTimeFormat('en-GB', OPTS_DATE),
    heure: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }),
  },
}

function isoJour(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function Planificateur({ fleches, initialId, onClose }) {
  const lang = useLang()
  const L = pick(lang)
  const F_DATE = FORMATS[lang === 'en' ? 'en' : 'fr'].date
  const F_HEURE = FORMATS[lang === 'en' ? 'en' : 'fr'].heure
  const box = useRef(null)
  const retour = useRef(null)

  const [flecheId, setFlecheId] = useState(initialId ?? fleches[0]?.id ?? '')
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
    const points = [
      { nom: 'Paris', km: 0, depart: true },
      ...(fleche.controles ?? []).map((c) => (c.arrivee ? { ...c, nom: fleche.nom, km: fleche.km } : c)),
    ]
    if (!points.at(-1).arrivee) points.push({ nom: fleche.nom, km: fleche.km, arrivee: true })
    return {
      duree,
      debut,
      fin,
      allure,
      dplusH,
      jours,
      kmJour: fleche.km / jours,
      etapes: points.map((e, i) => ({
        ...e,
        pct: Math.min(1, e.km / fleche.km),
        troncon: i ? e.km - points[i - 1].km : 0,
        heure: new Date(debut.getTime() + duree * Math.min(1, e.km / fleche.km) * 60000),
      })),
    }
  }, [fleche, formule, date, heure])

  if (!fleche) return null

  const fo = FORMULES.find((f) => f.code === formule)
  const nomF = fo ? L(fo.nom, fo.en) : ''

  const pctEtape = (pct) => `${pct * 100}%`
  const nuits = plan ? Math.max(0, plan.jours - 1) : 0

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="planif pl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planif-titre"
        tabIndex={-1}
        ref={box}
      >
        <header className="pl-head">
          <span className="pl-head__ico" aria-hidden="true">
            <Icon name="calculator" size={22} />
          </span>
          <div>
            <p className="pl-kicker">{L('Sans classeur · calcul instantané', 'No spreadsheet · instant calculation')}</p>
            <h2 id="planif-titre" className="pl-title">
              {L('Planifiez votre Flèche', 'Plan your Flèche')}
            </h2>
            <p className="pl-intro">
              {L(
                'Choisissez une flèche, une formule et votre départ : le plan de route s’écrit tout seul, délais officiels à l’appui.',
                'Pick a Flèche, a formula and your start time: the ride plan writes itself, based on the official time limits.',
              )}
            </p>
          </div>
          <button type="button" className="pl-close" onClick={onClose} aria-label={L('Fermer', 'Close')}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="pl-body">
          <div className="pl-form">
            <div className="pl-field pl-field--wide">
              <label htmlFor="planif-fleche">
                <Icon name="map-pin" size={14} /> Flèche
              </label>
              <div className="pl-select">
                <select id="planif-fleche" value={flecheId} onChange={(e) => setFlecheId(e.target.value)}>
                  {fleches.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom} — {fmt(f.km)} km · {fmt(f.dplus)} m D+
                    </option>
                  ))}
                </select>
                <Icon name="chevron-down" size={16} />
              </div>
            </div>

            <div className="pl-field pl-field--wide" role="group" aria-labelledby="planif-formule-lbl">
              <span className="pl-label" id="planif-formule-lbl">
                <Icon name="medal" size={14} /> {L('Formule visée', 'Target formula')}
              </span>
              <div className="pl-formules">
                {FORMULES.map((f) => (
                  <button
                    key={f.code}
                    type="button"
                    className={`pl-formule pl-formule--${f.code}`}
                    aria-pressed={formule === f.code}
                    onClick={() => setFormule(f.code)}
                  >
                    <span className="pl-formule__nom">{L(f.nom, f.en)}</span>
                    <b>{fleche.delais[f.code]}</b>
                  </button>
                ))}
              </div>
            </div>

            <div className="pl-field">
              <label htmlFor="planif-date">
                <Icon name="calendar" size={14} /> {L('Date de départ', 'Start date')}
              </label>
              <input id="planif-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="pl-field">
              <label htmlFor="planif-heure">
                <Icon name="clock" size={14} /> {L('Heure de départ', 'Start time')}
              </label>
              <input id="planif-heure" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
            </div>
          </div>

          {!plan ? (
            <p className="note">{L('Délai officiel illisible pour cette formule.', 'The official time limit for this formula could not be read.')}</p>
          ) : (
            <div className="pl-result" key={`${fleche.id}-${formule}`}>
              <div className="pl-hero">
                <div>
                  <p className="pl-hero__lbl">
                    <Icon name="flag" size={14} /> {L('Arrivée au plus tard', 'Latest finish')}
                  </p>
                  <p className="pl-hero__v">{F_DATE.format(plan.fin)}</p>
                  <p className="pl-hero__sub">
                    {L(
                      `Départ ${F_DATE.format(plan.debut)} · délai ${nomF} ${fleche.delais[formule]}`,
                      `Start ${F_DATE.format(plan.debut)} · ${nomF} limit ${fleche.delais[formule]}`,
                    )}
                  </p>
                </div>
                <ul className="pl-kpis">
                  <li>
                    <Icon name="timer" size={16} />
                    <b>{fmtDuree(plan.duree, lang)}</b>
                    <span>{L('délai', 'time limit')}</span>
                  </li>
                  <li>
                    <Icon name="gauge" size={16} />
                    <b>{plan.allure.toFixed(1)} km/h</b>
                    <span>{L('allure minimale', 'minimum pace')}</span>
                  </li>
                  <li>
                    <Icon name="mountain" size={16} />
                    <b>{fmt(Math.round(plan.dplusH))} m/h</b>
                    <span>{L('de D+', 'climbing')}</span>
                  </li>
                </ul>
              </div>

              <section className="pl-frise" aria-labelledby="planif-etape">
                <h3 className="pl-h" id="planif-etape">
                  <Icon name="route" size={15} /> {L('Contrôles et heures limites', 'Checkpoints and cut-off times')}
                  <span>{L('au rythme moyen minimal, km depuis Paris', 'at the minimum average pace, km from Paris')}</span>
                </h3>
                <div className="pl-track" aria-hidden="true">
                  <span className="pl-track__fill" />
                  <span className="pl-track__bike" style={{ '--to': '100%' }}>
                    <Icon name="bike" size={16} />
                  </span>
                  {plan.etapes.map((e) => (
                    <i key={`${e.nom}-${e.km}`} style={{ left: pctEtape(e.pct) }} />
                  ))}
                </div>
                <ol className="pl-steps">
                  {plan.etapes.map((e) => {
                    const memeJour = e.heure.toDateString() === plan.debut.toDateString()
                    return (
                      <li key={`${e.nom}-${e.km}`} className={e.depart || e.arrivee ? 'is-end' : ''}>
                        <b className="pl-steps__h">{memeJour ? F_HEURE.format(e.heure) : F_DATE.format(e.heure)}</b>
                        <span className="pl-steps__km">{fmt(e.km)} km</span>
                        <span className="pl-steps__nom">
                          {e.nom}
                          {e.depart && <em>{L('départ', 'start')}</em>}
                          {e.decale && <em>{L('départ décalé', 'alternative start')}</em>}
                          {e.arrivee && <em>{L('arrivée', 'finish')}</em>}
                        </span>
                        <span className="pl-steps__tr">{e.troncon ? `+${fmt(e.troncon)} km` : ''}</span>
                      </li>
                    )
                  })}
                </ol>
                <p className="pl-note">
                  <Icon name="info" size={13} />{' '}
                  {plan.jours > 1
                    ? L(
                        `Délai long : ${nuits} nuit${nuits > 1 ? 's' : ''} possible${nuits > 1 ? 's' : ''}, soit au moins ${fmt(
                          Math.round(plan.kmJour),
                        )} km par jour sur ${plan.jours} journées.`,
                        `Long limit: ${nuits} night${nuits > 1 ? 's' : ''} possible, i.e. at least ${fmt(
                          Math.round(plan.kmJour),
                        )} km a day over ${plan.jours} days.`,
                      )
                    : L(
                        'Délai court : parcours à réaliser d’une traite, sans dormir sur le parcours. Seule l’heure d’arrivée est contrôlée.',
                        'Short limit: the route is ridden in one go, without sleeping along the way. Only the finish time is checked.',
                      )}
                </p>
              </section>

              <ul className="pl-facts">
                <li>
                  <Icon name="ruler" size={15} />
                  <span>Distance</span>
                  <b>{fmt(fleche.km)} km</b>
                </li>
                <li>
                  <Icon name="mountain" size={15} />
                  <span>{L('Dénivelé', 'Elevation gain')}</span>
                  <b>{fmt(fleche.dplus)} m</b>
                </li>
                <li>
                  <Icon name="flag" size={15} />
                  <span>{L('Départ décalé', 'Alternative start')}</span>
                  <b>
                    {fleche.depart.commune} · {fmt(fleche.depart.km)} km
                  </b>
                </li>
                <li>
                  <Icon name="users" size={15} />
                  <span>{L('Déjà homologuées', 'Already validated')}</span>
                  <b>{fmt(fleche.stats.total)}</b>
                </li>
              </ul>

              <div className="pl-actions">
                <a className="btn btn--primary" href={fleche.openrunner} target="_blank" rel="noreferrer">
                  <Icon name="route" size={16} /> {L('Tracé OpenRunner', 'OpenRunner route')}
                </a>
                <a className="btn btn--secondary" href={fleche.pdf} target="_blank" rel="noreferrer">
                  <Icon name="file-text" size={16} /> {L('Feuille de route PDF', 'Route sheet PDF')}
                </a>
                <a className="link pl-xls" href="./assets/Calculateur-fleches-v2.3.xlsx" download>
                  <Icon name="download" size={14} /> {L('Classeur Excel v2.3', 'Excel workbook v2.3')}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
