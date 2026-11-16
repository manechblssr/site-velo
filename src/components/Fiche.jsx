import { useEffect, useMemo, useRef } from 'react'
import Badge from './Badge.jsx'
import { makeT } from '../lib/i18n.js'
import { fmt, fmtDate, fmtKm, downloadCSV } from '../lib/data.js'

const RANG = { O: 3, A: 2, B: 1 }

export default function Fiche({ lang, data, participant, manager, onFleche, onClose }) {
  const t = makeT(lang)
  const box = useRef(null)
  const retour = useRef(null)

  const { homologations, fleches, defis, meta } = data

  const mes = useMemo(
    () => homologations.filter((h) => h.pid === participant.id).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [homologations, participant.id],
  )

  const synthese = useMemo(() => {
    const parDest = new Map()
    let km = 0
    let dplus = 0
    const fo = { O: 0, A: 0, B: 0 }
    let medailles = 0
    let groupees = 0
    for (const h of mes) {
      km += h.km || 0
      dplus += h.dplus || 0
      if (fo[h.formule] !== undefined) fo[h.formule] += 1
      if (h.med === '1' || h.med === '2') medailles += 1
      if (h.grp) groupees += 1
      const cur = parDest.get(h.dest)
      if (!cur || RANG[h.formule] > RANG[cur.formule]) parDest.set(h.dest, h)
    }
    return { km, dplus, fo, medailles, groupees, parDest, nb: mes.length }
  }, [mes])

  const complet = synthese.parDest.size >= fleches.length
  const manquantes = fleches.filter((f) => !synthese.parDest.has(f.id))
  const laComplete = defis.complete.find((c) => c.id === participant.id)

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

  const exportCSV = () =>
    downloadCSV(
      `palmares-${participant.nom}-${participant.prenom}.csv`,
      [
        { label: 'Date', value: (h) => h.date },
        { label: "N° d'homologation", value: (h) => h.num },
        { label: 'Millésime', value: (h) => h.annee },
        { label: 'Flèche', value: (h) => h.dest },
        { label: 'Distance (km)', value: (h) => h.km },
        { label: 'D+ (m)', value: (h) => h.dplus },
        { label: 'Formule', value: (h) => h.formule },
        { label: 'Club', value: (h) => h.club },
      ],
      mes,
    )

  const trancheNom = { a: '65 ans et plus', b: '50-65 ans', c: '35-50 ans', d: '20-35 ans', e: 'moins de 20 ans' }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fiche-titre"
        tabIndex={-1}
        ref={box}
      >
        <div className="drawer__head">
          <div>
            <p className="t-label muted">{participant.sexe === 'F' ? 'Flécharde' : 'Fléchard'}</p>
            <h2 className="t-h3" id="fiche-titre">
              {participant.nom} {participant.prenom}
            </h2>
            <p className="fiche-meta">
              {participant.club || 'Sans club'}
              {participant.code ? ` · ${participant.code}` : ''}
              {participant.fede ? ` · ${participant.fede}` : ''}
            </p>
            <p className="fiche-meta muted">
              {[participant.ville, participant.dept, participant.pays].filter(Boolean).join(' · ')}
              {participant.tranche ? ` · ${trancheNom[participant.tranche] ?? ''}` : ''}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('nav.close')}>
            ✕
          </button>
        </div>

        {manager && (
          <dl className="fiche-contacts">
            <dt>Téléphone</dt>
            <dd>{participant.tel || '—'}</dd>
            <dt>Adresse</dt>
            <dd>
              {[participant.rue, participant.cp, participant.ville].filter(Boolean).join(', ') ||
                '—'}
            </dd>
            <dt>Date de naissance</dt>
            <dd>{fmtDate(participant.naissance)}</dd>
          </dl>
        )}

        <div className="kpis fiche-kpis">
          <div className="kpi">
            <b className="kpi__v">{fmt(synthese.nb)}</b>
            <span className="kpi__l">Homologations</span>
          </div>
          <div className="kpi">
            <b className="kpi__v">
              {synthese.parDest.size} / {fleches.length}
            </b>
            <span className="kpi__l">Flèches distinctes</span>
          </div>
          <div className="kpi">
            <b className="kpi__v">{fmt(synthese.km)}</b>
            <span className="kpi__l">Kilomètres</span>
          </div>
          <div className="kpi">
            <b className="kpi__v">{fmt(synthese.dplus)}</b>
            <span className="kpi__l">Mètres de D+</span>
          </div>
        </div>

        <p className="fiche-formules">
          <Badge code="O" titre="Or" /> <b>{synthese.fo.O}</b>
          <Badge code="A" titre="Argent" /> <b>{synthese.fo.A}</b>
          <Badge code="B" titre="Bronze" /> <b>{synthese.fo.B}</b>
          {synthese.medailles > 0 && (
            <span className="chip">
              Médailles <b>{synthese.medailles}</b>
            </span>
          )}
          {laComplete && (
            <span className="chip chip--actif">
              La Complète · {laComplete.nb} flèches
            </span>
          )}
        </p>

        <h3 className="t-h3 fiche-h">Les 20 Flèches</h3>
        <div className="grid-20">
          {fleches.map((f) => {
            const h = synthese.parDest.get(f.id)
            return (
              <button
                key={f.id}
                type="button"
                className={`cell-20 lift${h ? ` cell-20--${h.formule}` : ''}`}
                onClick={() => h && onFleche(f.id)}
                title={h ? `${f.nom} — ${fmtDate(h.date)}` : `${f.nom} — à réaliser`}
              >
                <b>{f.nom}</b>
                {h ? (
                  <span>
                    {fmtDate(h.date)} · {fmt(h.km)} km
                  </span>
                ) : (
                  <span>à réaliser</span>
                )}
              </button>
            )
          })}
        </div>

        {!complet && manquantes.length > 0 && (
          <p className="t-small muted fiche-manquantes">
            Il manque {manquantes.length} flèche{manquantes.length > 1 ? 's' : ''} pour La Complète :{' '}
            {manquantes.map((f) => f.nom).join(', ')}.
          </p>
        )}

        <div className="fiche-actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={exportCSV}>
            {t('f.export')}
          </button>
        </div>

        <h3 className="t-h3 fiche-h">Palmarès chronologique</h3>
        <div className="table-scroll">
          <table className="table-app">
            <thead>
              <tr>
                <th scope="col">{t('t.date')}</th>
                <th scope="col" className="num">
                  {t('t.num')}
                </th>
                <th scope="col">{t('f.fleche')}</th>
                <th scope="col" className="num">
                  Km
                </th>
                <th scope="col" className="num">
                  {t('t.dplus')}
                </th>
                <th scope="col">{t('t.formule')}</th>
                <th scope="col">{t('t.year')}</th>
              </tr>
            </thead>
            <tbody>
              {mes.map((h, i) => (
                <tr key={`${h.date}-${h.num}-${i}`}>
                  <td>{fmtDate(h.date)}</td>
                  <td className="num">{h.num ?? '—'}</td>
                  <th scope="row">
                    <button type="button" className="row-link" onClick={() => onFleche(h.dest)}>
                      {h.dest}
                    </button>
                  </th>
                  <td className="num">{fmt(h.km)}</td>
                  <td className="num">{fmt(h.dplus)}</td>
                  <td>
                    <Badge code={h.formule} />
                    {h.grp ? <span className="chip chip--mini"> groupée</span> : null}
                  </td>
                  <td>{h.annee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="t-small muted fiche-note">
          Première flèche : {fmtDate(participant.premiere)} · dernière participation :{' '}
          {fmtDate(participant.derniere)} · base du {fmtDate(meta.build)}.
        </p>
      </div>
    </>
  )
}
