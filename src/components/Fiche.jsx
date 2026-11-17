import { useEffect, useMemo, useRef, useState } from 'react'
import Badge from './Badge.jsx'
import Icon from './Icon.jsx'
import { makeT } from '../lib/i18n.js'
import { fmt, fmtDate, downloadCSV } from '../lib/data.js'

/* ---------------------------------------------------------------------------
   Fiche palmarès d'un cycliste — tiroir latéral.
   En-tête d'identité + anneau de progression, chiffres clés, répartition
   des formules, puis deux onglets : la grille des 20 Flèches et la
   chronologie des homologations groupée par année.
--------------------------------------------------------------------------- */

const RANG = { O: 3, A: 2, B: 1 }
const NOM = { O: 'Or', A: 'Argent', B: 'Bronze' }
const TRANCHE = {
  a: '65 ans et plus',
  b: '50 – 65 ans',
  c: '35 – 50 ans',
  d: '20 – 35 ans',
  e: 'moins de 20 ans',
}

function Anneau({ n, total }) {
  const r = 34
  const c = 2 * Math.PI * r
  const pct = Math.min(1, n / total)
  return (
    <div className="fx-ring" role="img" aria-label={`${n} flèches distinctes sur ${total}`}>
      <svg viewBox="0 0 80 80" width="88" height="88" aria-hidden="true">
        <circle cx="40" cy="40" r={r} className="fx-ring__bg" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className="fx-ring__fg"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ '--c': c }}
        />
      </svg>
      <span className="fx-ring__txt">
        <b>{n}</b>
        <i>/ {total}</i>
      </span>
    </div>
  )
}

export default function Fiche({ lang, data, participant, manager, onFleche, onClose }) {
  const t = makeT(lang)
  const box = useRef(null)
  const retour = useRef(null)
  const [onglet, setOnglet] = useState('fleches')

  const { homologations, fleches, defis, meta } = data
  const p = participant

  const mes = useMemo(
    () =>
      homologations
        .filter((h) => h.pid === p.id)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.num ?? 0) - (b.num ?? 0))),
    [homologations, p.id],
  )

  const s = useMemo(() => {
    const parDest = new Map()
    const nbDest = new Map()
    let km = 0
    let dplus = 0
    const fo = { O: 0, A: 0, B: 0 }
    let medailles = 0
    for (const h of mes) {
      km += h.km || 0
      dplus += h.dplus || 0
      if (fo[h.formule] !== undefined) fo[h.formule] += 1
      if (h.med === '1' || h.med === '2') medailles += 1
      nbDest.set(h.dest, (nbDest.get(h.dest) ?? 0) + 1)
      const cur = parDest.get(h.dest)
      if (!cur || (RANG[h.formule] ?? 0) > (RANG[cur.formule] ?? 0)) parDest.set(h.dest, h)
    }
    const annees = [...new Set(mes.map((h) => h.annee))].sort()
    const parAnnee = new Map()
    for (const h of [...mes].reverse()) {
      if (!parAnnee.has(h.annee)) parAnnee.set(h.annee, [])
      parAnnee.get(h.annee).push(h)
    }
    return { km, dplus, fo, medailles, parDest, nbDest, nb: mes.length, annees, parAnnee }
  }, [mes])

  const manquantes = fleches.filter((f) => !s.parDest.has(f.id))
  const laComplete = defis.complete.find((c) => c.id === p.id)
  const express = defis.express?.find?.((c) => c.id === p.id)
  const initiales = `${(p.prenom || '?')[0]}${(p.nom || '')[0]}`.toUpperCase()
  const maxFo = Math.max(1, s.fo.O, s.fo.A, s.fo.B)

  /* modale : focus piégé, Escape, défilement de fond suspendu */
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
      `palmares-${p.nom}-${p.prenom}.csv`,
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

  const voirCarte = () => {
    onClose()
    window.location.hash = `#/carte/pid=${p.id}`
  }

  const nomFleche = (id) => fleches.find((f) => f.id === id)?.nom ?? id

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="drawer fx"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fiche-titre"
        tabIndex={-1}
        ref={box}
      >
        {/* ------------------------------------------------------ identité */}
        <header className="fx-hero">
          <button type="button" className="fx-close" onClick={onClose} aria-label={t('nav.close')}>
            <Icon name="x" size={18} />
          </button>
          <div className="fx-hero__id">
            <span className="fx-avatar" aria-hidden="true">
              {initiales}
            </span>
            <div className="fx-hero__txt">
              <p className="fx-kicker">
                <Icon name="bike" size={14} />
                {p.sexe === 'F' ? 'Flécharde' : 'Fléchard'}
                {p.premiereAnnee ? ` depuis ${p.premiereAnnee}` : ''}
              </p>
              <h2 id="fiche-titre" className="fx-nom">
                {p.prenom} <span>{p.nom}</span>
              </h2>
              <div className="fx-tags">
                {laComplete && (
                  <span className="fx-tag fx-tag--or">
                    <Icon name="trophy" size={13} /> La Complète
                  </span>
                )}
                {express && (
                  <span className="fx-tag fx-tag--or">
                    <Icon name="zap" size={13} /> Complète express
                  </span>
                )}
                {s.medailles > 0 && (
                  <span className="fx-tag">
                    <Icon name="award" size={13} /> {s.medailles} médaille{s.medailles > 1 ? 's' : ''}
                  </span>
                )}
                {s.nb === 1 && (
                  <span className="fx-tag">
                    <Icon name="sparkles" size={13} /> Néophyte
                  </span>
                )}
              </div>
            </div>
            <Anneau n={s.parDest.size} total={fleches.length} />
          </div>

          <ul className="fx-infos">
            <li>
              <Icon name="building" size={15} />
              <span>{p.club || 'Sans club'}</span>
            </li>
            {(p.ville || p.pays) && (
              <li>
                <Icon name="map-pin" size={15} />
                <span>
                  {[p.ville, p.dept && `(${p.dept})`, p.pays && p.pays !== 'FRANCE' ? p.pays : null]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </li>
            )}
            {(p.fede || p.code) && (
              <li>
                <Icon name="hash" size={15} />
                <span>{[p.fede, p.code].filter(Boolean).join(' · ')}</span>
              </li>
            )}
            {p.tranche && TRANCHE[p.tranche] && (
              <li>
                <Icon name="users" size={15} />
                <span>{TRANCHE[p.tranche]}</span>
              </li>
            )}
          </ul>

          <div className="fx-actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={voirCarte}>
              <Icon name="map" size={15} /> Voir son parcours sur la carte
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={exportCSV}>
              <Icon name="download" size={15} /> {t('f.export')}
            </button>
          </div>
        </header>

        <div className="fx-body">
          {manager && (
            <dl className="fx-contacts">
              <div>
                <dt>
                  <Icon name="phone" size={14} /> Téléphone
                </dt>
                <dd>{p.tel || '—'}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="home" size={14} /> Adresse
                </dt>
                <dd>{[p.rue, p.cp, p.ville].filter(Boolean).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="cake" size={14} /> Naissance
                </dt>
                <dd>{fmtDate(p.naissance)}</dd>
              </div>
            </dl>
          )}

          {/* ------------------------------------------------ chiffres clés */}
          <div className="fx-kpis">
            <div className="fx-kpi">
              <Icon name="medal" size={18} />
              <b>{fmt(s.nb)}</b>
              <span>homologation{s.nb > 1 ? 's' : ''}</span>
            </div>
            <div className="fx-kpi">
              <Icon name="ruler" size={18} />
              <b>{fmt(s.km)}</b>
              <span>kilomètres</span>
            </div>
            <div className="fx-kpi">
              <Icon name="mountain" size={18} />
              <b>{fmt(s.dplus)}</b>
              <span>mètres de D+</span>
            </div>
            <div className="fx-kpi">
              <Icon name="calendar" size={18} />
              <b>
                {s.annees.length > 1
                  ? `${s.annees[0]}–${String(s.annees[s.annees.length - 1]).slice(2)}`
                  : s.annees[0] ?? '—'}
              </b>
              <span>
                {s.annees.length} saison{s.annees.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* --------------------------------------------------- formules */}
          <div className="fx-fo" aria-label="Répartition des formules">
            {['O', 'A', 'B'].map((c) => (
              <div key={c} className={`fx-fo__row fx-fo__row--${c}`}>
                <Badge code={c} />
                <span className="fx-fo__bar">
                  <i style={{ width: `${(s.fo[c] / maxFo) * 100}%` }} />
                </span>
                <b>{s.fo[c]}</b>
              </div>
            ))}
          </div>

          {/* ---------------------------------------------------- onglets */}
          <div className="fx-tabs" role="tablist" aria-label="Palmarès">
            <button
              type="button"
              role="tab"
              id="fx-tab-fleches"
              aria-selected={onglet === 'fleches'}
              aria-controls="fx-panel"
              onClick={() => setOnglet('fleches')}
            >
              <Icon name="grid" size={15} /> Les 20 Flèches
              <span className="fx-tabs__n">{s.parDest.size}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="fx-tab-chrono"
              aria-selected={onglet === 'chrono'}
              aria-controls="fx-panel"
              onClick={() => setOnglet('chrono')}
            >
              <Icon name="history" size={15} /> Chronologie
              <span className="fx-tabs__n">{s.nb}</span>
            </button>
          </div>

          <div
            id="fx-panel"
            role="tabpanel"
            aria-labelledby={onglet === 'fleches' ? 'fx-tab-fleches' : 'fx-tab-chrono'}
            className="fx-panel"
            key={onglet}
          >
            {onglet === 'fleches' ? (
              <>
                <div className="fx-grid">
                  {fleches.map((f, i) => {
                    const h = s.parDest.get(f.id)
                    const n = s.nbDest.get(f.id) ?? 0
                    return (
                      <button
                        key={f.id}
                        type="button"
                        style={{ '--i': i }}
                        className={`fx-cell${h ? ` fx-cell--ok fx-cell--${h.formule}` : ''}`}
                        onClick={() => h && onFleche(f.id)}
                        disabled={!h}
                        title={
                          h
                            ? `${f.nom} — meilleure formule ${NOM[h.formule] ?? '—'}, ${n} fois`
                            : `${f.nom} — à réaliser`
                        }
                      >
                        <span className="fx-cell__ico">
                          <Icon name={h ? 'check' : 'circle'} size={13} strokeWidth={h ? 3 : 2} />
                        </span>
                        <b>{f.nom}</b>
                        <span className="fx-cell__meta">
                          {h ? (
                            <>
                              {NOM[h.formule] ?? '—'} · {h.annee}
                              {n > 1 && <em>×{n}</em>}
                            </>
                          ) : (
                            `${fmt(f.km)} km`
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {manquantes.length > 0 ? (
                  <p className="fx-note">
                    <Icon name="flag" size={14} /> Encore {manquantes.length} flèche
                    {manquantes.length > 1 ? 's' : ''} pour La Complète.
                  </p>
                ) : (
                  <p className="fx-note fx-note--ok">
                    <Icon name="trophy" size={14} /> Les 20 Flèches sont validées.
                  </p>
                )}
              </>
            ) : (
              <ol className="fx-chrono">
                {[...s.parAnnee.entries()].map(([annee, liste]) => (
                  <li key={annee} className="fx-year">
                    <p className="fx-year__h">
                      <b>{annee}</b>
                      <span>
                        {liste.length} flèche{liste.length > 1 ? 's' : ''} ·{' '}
                        {fmt(liste.reduce((a, h) => a + (h.km || 0), 0))} km
                      </span>
                    </p>
                    <ul>
                      {liste.map((h, i) => (
                        <li key={`${h.date}-${h.num}-${i}`} className={`fx-ev fx-ev--${h.formule}`}>
                          <span className="fx-ev__dot" aria-hidden="true" />
                          <div className="fx-ev__main">
                            <button type="button" className="fx-ev__nom" onClick={() => onFleche(h.dest)}>
                              {nomFleche(h.dest)}
                            </button>
                            <span className="fx-ev__meta">
                              <Icon name="ruler" size={12} /> {fmt(h.km)} km
                              <Icon name="mountain" size={12} /> {fmt(h.dplus)} m
                              {h.num != null && (
                                <>
                                  <Icon name="hash" size={12} /> {h.num}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="fx-ev__side">
                            <Badge code={h.formule} />
                            {h.grp ? <span className="fx-ev__grp">groupée</span> : null}
                            <time dateTime={h.date}>{fmtDate(h.date)}</time>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="fx-foot">
            <Icon name="info" size={13} /> Première flèche : {fmtDate(p.premiere)} · dernière
            participation : {fmtDate(p.derniere)} · base du {fmtDate(meta.build)}.
          </p>
        </div>
      </div>
    </>
  )
}
