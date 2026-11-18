import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar.jsx'
import Icon from '../components/Icon.jsx'
import Planificateur from '../components/Planificateur.jsx'
import { makeT, pick } from '../lib/i18n.js'
import { fmt, fmtDate } from '../lib/data.js'

/* Les 5 encarts de la page officielle + le texte « En savoir plus »,
   dans la rédaction du site de l'Audax Club Parisien. */

const ENCARTS = [
  {
    i: 'map',
    q: "C'est quoi ?",
    qe: 'What is it?',
    r: "20 parcours 100 % route, au départ ou à l'arrivée de Paris.",
    re: '20 all-road routes, starting from or finishing in Paris.',
  },
  {
    i: 'calendar',
    q: 'Quand ?',
    qe: 'When?',
    r: "Des randonnées permanentes : vous partez quand vous voulez, la flèche est ouverte toute l'année.",
    re: 'Permanent rides: set off whenever you like, every Flèche is open all year round.',
  },
  {
    i: 'timer',
    q: 'Quel délai ?',
    qe: 'Time limits?',
    r: 'Trois formules pour valider votre flèche : Or, Argent ou Bronze.',
    re: 'Three formulas to validate your Flèche: Gold, Silver or Bronze.',
  },
  {
    i: 'euro',
    q: "C'est combien ?",
    qe: 'How much?',
    r: 'Un tarif tout doux, et gratuit pour les mineurs.',
    re: 'A gentle fee, and free for under-18s.',
  },
  {
    i: 'mail',
    q: "Où s'inscrire ?",
    qe: 'Where to sign up?',
    r: 'Uniquement en ligne sur myaccount.audax-club-parisien.com.',
    re: 'Online only, at myaccount.audax-club-parisien.com.',
  },
]

const TARIFS = [
  ['Licenciés FFCT', 'FFCT members', '6 €'],
  ['Non licenciés FFCT', 'Non-FFCT members', '9 €'],
  ['Mineurs', 'Under-18s', ['Gratuit', 'Free']],
  ['Envoi de la carte par la poste', 'Route card sent by post', '+3 €'],
]

const DEFS_CARDS = [
  {
    i: 'trophy',
    titre: 'La Complète',
    titreEn: 'The Complete',
    texte:
      'Valider les 20 Flèches de France. Depuis 1997, une centaine de cyclotouristes y sont parvenus sur le cycle complet.',
    texteEn:
      'Validate all 20 Flèches de France. Since 1997, over a hundred riders have completed the full cycle.',
    vue: 'defis',
  },
  {
    i: 'timer',
    titre: 'La Complète express',
    titreEn: 'The Express Complete',
    texte:
      "Les 20 Flèches en une seule année des Flèches (du 1er octobre au 30 septembre), soit près de 11 200 km en douze mois.",
    texteEn:
      'All 20 Flèches within a single Flèches year (1 October to 30 September): nearly 11,200 km in twelve months.',
    vue: 'defis',
  },
  {
    i: 'medal',
    titre: 'Le combiné',
    titreEn: 'The combined',
    texte:
      'Couplage des Flèches de France avec les Relais de France : deux défis, un même carnet.',
    texteEn: 'The Flèches de France paired with the Relais de France: two challenges, one record book.',
    vue: 'defis',
  },
  {
    i: 'flag',
    titre: 'Le pionnier',
    titreEn: 'The pioneer',
    texte:
      'Être le premier à homologuer une formule sur une flèche. Certaines combinaisons restent vierges depuis 1997.',
    texteEn:
      'Be the first to validate a given formula on a Flèche. Some combinations have stayed unachieved since 1997.',
    vue: 'defis',
  },
]

export default function Presentation({ lang, data }) {
  const t = makeT(lang)
  const L = pick(lang)
  const { fleches, meta, defis, homologations } = data
  const [planif, setPlanif] = useState(false)
  const cue = useRef(null)

  const pionnier = useMemo(
    () => homologations.filter((h) => h.annee >= 1997 && h.annee <= 2025).length,
    [homologations],
  )

  /* Invite à défiler : elle s'efface en fondu au fil du défilement (320 px
     suffisent) et redevient pleine quand on remonte. Opacité pilotée en
     rAF sur le nœud lui-même : aucun rendu React à chaque frame. */
  useEffect(() => {
    const el = cue.current
    if (!el) return
    let raf = 0
    const maj = () => {
      raf = 0
      const y = window.scrollY
      const o = Math.min(1, Math.max(0, 1 - y / 320))
      el.style.opacity = o.toFixed(3)
      el.style.visibility = o <= 0.02 ? 'hidden' : 'visible'
      el.style.pointerEvents = o < 0.15 ? 'none' : ''
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(maj)
    }
    maj()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  /* Invite à défiler : descente douce vers le premier bloc, sans changer
     de hash (l'ancre resterait dans la route) et sans animation pour qui
     a demandé un système réduit. */
  const descendre = () => {
    const cible = document.getElementById('h-encarts')
    if (!cible) return
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    cible.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' })
  }

  const notes = [
    {
      date: '2026',
      texte: `${fmt(meta.homologations)} homologations dans la base, ${fmt(meta.participants)} fléchards.`,
      en: `${fmt(meta.homologations)} validated rides in the database, ${fmt(meta.participants)} riders.`,
    },
    {
      date: L('Défi', 'Challenge'),
      texte: `${defis.complete.length} lauréats de La Complète (20 flèches sur le cycle complet).`,
      en: `${defis.complete.length} finishers of The Complete (all 20 Flèches over the full cycle).`,
    },
    {
      date: L('Règlement', 'Rules'),
      texte: 'Version en vigueur au 23 décembre 2025 (PDF ci-dessous).',
      en: 'Version in force as of 23 December 2025 (PDF below, in French).',
    },
    {
      date: L('Vierges', 'Unachieved'),
      texte: '5 formules sans lauréat entre 1997 et 2025 : Briançon, Hendaye, Luchon et Marseille.',
      en: '5 formulas with no finisher between 1997 and 2025: Briançon, Hendaye, Luchon and Marseille.',
    },
  ]

  return (
    <>
      <section className="hero hero-split" data-enter>
        <div className="wrap hero-split__in">
          <div className="hero-copy">
            <p className="hero-kicker">Audax Club Parisien · {L('depuis 1954', 'since 1954')}</p>
            <h1 className="t-h1">{L('Les Flèches de France', 'The Flèches de France')}</h1>
            <p className="t-lead hero-slogan">
              {L(
                "« Elles sortent du carquois de l'imagination, elles fusent à travers toute la France et piquent le sentiment de la découverte ! »",
                '“They fly from the quiver of the imagination, shoot across the whole of France and spark the thrill of discovery!”',
              )}
            </p>
            <p className="hero-facts">
              <b>{L(`${fleches.length} parcours`, `${fleches.length} routes`)}</b> ·{' '}
              {L(
                `${fmt(meta.homologations)} homologations depuis ${meta.annees[0]}`,
                `${fmt(meta.homologations)} validated rides since ${meta.annees[0]}`,
              )}{' '}
              · {defis.complete.length} {L('La Complète', 'Complete finishers')}
            </p>
            <div className="btn-row">
              <a
                className="btn btn--primary"
                href="#/annuaire"
                onClick={(e) => {
                  e.preventDefault()
                  window.location.hash = '#/annuaire'
                }}
              >
                {L('Consulter le palmarès', 'Browse the records')}
              </a>
              <a
                className="btn btn--secondary"
                href="#/carte"
                onClick={(e) => {
                  e.preventDefault()
                  window.location.hash = '#/carte'
                }}
              >
                {L('Voir la carte', 'View the map')}
              </a>
            </div>
          </div>
          <div className="hero-stage">
            <img
              className="visuel hero-img"
              src="./assets/carte-fleches.png"
              alt={L(
                "Carte des 20 Flèches de France au départ ou à l'arrivée de Paris",
                'Map of the 20 Flèches de France starting from or finishing in Paris',
              )}
              width="1024"
              height="858"
            />
          </div>
        </div>

        {/* invitation à défiler dans le vide sous le hero */}
        <button
          type="button"
          className="hero-scroll"
          onClick={descendre}
          ref={cue}
          aria-label={L('Faire défiler vers la suite de la page', 'Scroll to the rest of the page')}
        >
          <span className="hero-scroll__mouse" aria-hidden="true">
            <i />
          </span>
          <span className="hero-scroll__txt">{L('Défilez pour découvrir', 'Scroll to explore')}</span>
          <span className="hero-scroll__chev" aria-hidden="true">
            <Icon name="chevron-down" size={18} strokeWidth={2.5} />
            <Icon name="chevron-down" size={18} strokeWidth={2.5} />
          </span>
        </button>
      </section>

      <div className="wrap page-cols">
        <div className="page-main">
          <section className="section section--dense" aria-labelledby="h-encarts">
            <div className="section-head">
              <h2 id="h-encarts" className="t-h2">
                {L('En bref', 'At a glance')}{' '}
                <span className="muted">{L("ce qu'il faut savoir avant de partir", 'what to know before you set off')}</span>
              </h2>
            </div>
            <div className="en-bref">
              {ENCARTS.map((e) => (
                <div className="en-bref__item" key={e.q}>
                  <span className="en-bref__ico" aria-hidden="true">
                    <Icon name={e.i} size={17} />
                  </span>
                  <div>
                    <h3>{L(e.q, e.qe)}</h3>
                    <p>{L(e.r, e.re)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="section section--dense" aria-labelledby="h-tableau">
            <div className="section-head">
              <h2 id="h-tableau" className="t-h2">
                {L('Les 20 Flèches', 'The 20 Flèches')}{' '}
                <span className="muted">{L('référentiel officiel 2026', 'official 2026 reference')}</span>
              </h2>
            </div>
            <p className="ref-astuce">
              <Icon name="map" size={15} />{' '}
              {L(
                'Cliquez sur une flèche pour l’ouvrir sur la carte avec sa fiche détaillée.',
                'Click a Flèche to open it on the map with its detailed profile.',
              )}
            </p>
            <div className="table-scroll">
              <table className="table-app table--20">
                <caption className="sr-only">
                  {L('Tableau officiel des 20 Flèches de France 2026', 'Official table of the 20 Flèches de France 2026')}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Flèche</th>
                    <th scope="col" className="num">
                      Distance
                    </th>
                    <th scope="col" className="num">
                      D+
                    </th>
                    <th scope="col">{L('Délai Or', 'Gold limit')}</th>
                    <th scope="col">{L('Délai Argent', 'Silver limit')}</th>
                    <th scope="col">{L('Délai Bronze', 'Bronze limit')}</th>
                    <th scope="col">{L('Départ décalé', 'Alternative start')}</th>
                    <th scope="col">{L('Ressources', 'Resources')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fleches.map((f) => {
                    /* toute la ligne mène à la carte avec la fiche de la flèche
                       ouverte ; les liens de ressources gardent leur action */
                    const versCarte = (e) => {
                      if (e.target.closest('a')) return
                      window.location.hash = `#/carte/${f.id}`
                    }
                    return (
                      <tr key={f.id} onClick={versCarte}>
                        <th scope="row">
                          <a
                            className="ref-nom"
                            href={`#/carte/${f.id}`}
                            title={L(`Voir ${f.nom} sur la carte`, `View ${f.nom} on the map`)}
                            onClick={(e) => {
                              e.preventDefault()
                              window.location.hash = `#/carte/${f.id}`
                            }}
                          >
                            <span className="ref-nom__ico" aria-hidden="true">
                              <Icon name="map-pin" size={14} />
                            </span>
                            {f.nom}
                          </a>
                        </th>
                        <td className="num">{fmt(f.km)} km</td>
                        <td className="num">{fmt(f.dplus)} m</td>
                        <td>{f.delais.O}</td>
                        <td>{f.delais.A}</td>
                        <td>{f.delais.B}</td>
                        <td>
                          {f.depart.commune}
                          <span className="hist"> {fmt(f.depart.km)} km</span>
                        </td>
                        <td className="res res--ico">
                          <a
                            href={f.openrunner}
                            target="_blank"
                            rel="noreferrer"
                            title={L('Tracé OpenRunner', 'OpenRunner route')}
                            aria-label={L(`Tracé OpenRunner de ${f.nom}`, `OpenRunner route for ${f.nom}`)}
                          >
                            <Icon name="route" size={15} />
                          </a>
                          <a
                            href={f.pdf}
                            target="_blank"
                            rel="noreferrer"
                            title={L('Feuille de route (PDF)', 'Route sheet (PDF)')}
                            aria-label={L(`Feuille de route de ${f.nom} (PDF)`, `Route sheet for ${f.nom} (PDF)`)}
                          >
                            <Icon name="file-text" size={15} />
                          </a>
                          <span className="ref-go" aria-hidden="true">
                            <Icon name="chevron-right" size={16} />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section section--dense" aria-labelledby="h-tarifs">
            <div className="section-head">
              <h2 id="h-tarifs" className="t-h2">
                {L('Les tarifs', 'Fees')} <span className="muted">{L('et la carte de route', 'and the route card')}</span>
              </h2>
            </div>
            <div className="split-pair">
              <div>
                <ul className="rows">
                  {TARIFS.map(([libelle, en, prix]) => (
                    <li key={libelle}>
                      <span className="rows__name">{L(libelle, en)}</span>
                      <span className="rows__value">{Array.isArray(prix) ? L(...prix) : prix}</span>
                    </li>
                  ))}
                </ul>
                <p className="t-small muted tarif-note">
                  {L(
                    'Tarifs 2025 publiés par le club ; médaille facultative disponible auprès du secrétariat.',
                    '2025 fees published by the club; an optional medal is available from the secretariat.',
                  )}
                </p>
              </div>
              <div className="encart encart--action">
                <h3>{L('Planifiez votre Flèche', 'Plan your Flèche')}</h3>
                <p>
                  {L(
                    "Choisissez une flèche et une formule : délais, allure minimale et repères horaires s'affichent directement sur cette page, sans classeur.",
                    'Pick a Flèche and a formula: time limits, minimum pace and timing checkpoints appear right on this page, no spreadsheet needed.',
                  )}
                </p>
                <div className="btn-row">
                  <button type="button" className="btn btn--primary" onClick={() => setPlanif(true)}>
                    <Icon name="calculator" size={16} /> {L('Ouvrir le planificateur', 'Open the planner')}
                  </button>
                  <a
                    className="link"
                    href="./assets/Calculateur-fleches-v2.3.xlsx"
                    download
                  >
                    <Icon name="download" size={14} /> {L('Classeur Excel v2.3', 'Excel workbook v2.3')}
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="section section--dense" aria-labelledby="h-defis">
            <div className="section-head">
              <h2 id="h-defis" className="t-h2">
                {L('Les défis', 'The challenges')} <span className="muted">{L('au-delà des 20 flèches', 'beyond the 20 Flèches')}</span>
              </h2>
            </div>
            <div className="defi-panel">
              <ul className="defi-list">
                {DEFS_CARDS.map((d) => (
                  <li key={d.titre}>
                    <span className="defi-list__ico" aria-hidden="true">
                      <Icon name={d.i} size={17} />
                    </span>
                    <div>
                      <b>{L(d.titre, d.titreEn)}</b>
                      <p>{L(d.texte, d.texteEn)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="defi-panel__cta">
                <a
                  className="btn btn--primary"
                  href="#/defis"
                  onClick={(e) => {
                    e.preventDefault()
                    window.location.hash = '#/defis'
                  }}
                >
                  <Icon name="trophy" size={16} /> {L("Ouvrir l'explorateur des défis", 'Open the challenge explorer')}
                </a>
                <p className="t-small muted defi-figures">
                  {L(
                    `${fmt(pionnier)} flèches homologuées entre ${meta.annees[0]} et 2025 dans la base · ${defis.express.length} Complètes express vérifiées · ${defis.vierges.filter((v) => v.vierge1997_2025).length} formules encore vierges sur la période.`,
                    `${fmt(pionnier)} Flèches validated between ${meta.annees[0]} and 2025 in the database · ${defis.express.length} verified Express Completes · ${defis.vierges.filter((v) => v.vierge1997_2025).length} formulas still unachieved over the period.`,
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="section section--dense" aria-labelledby="h-savoir">
            <div className="section-head">
              <h2 id="h-savoir" className="t-h2">
                {L('En savoir plus', 'Learn more')} <span className="muted">{L('le fonctionnement', 'how it works')}</span>
              </h2>
            </div>
            <div className="prose">
              <p>
                {L(
                  'Depuis 1954, plus de 45 000 Flèches ont été réalisées. Un cycle complet de plus de 11 000 km donne droit à une plaquette offerte par le club.',
                  'Since 1954, more than 45,000 Flèches have been ridden. A full cycle of over 11,000 km earns a plaque offered by the club.',
                )}
              </p>
              <p>
                {L(
                  "Le sens du parcours est libre : Paris-Province ou Province-Paris. Deux points de départ ou d'arrivée sont ouverts à votre choix : la porte de Paris ou une gare de banlieue située entre 10 et 25 km du centre.",
                  'You choose the direction: Paris to the regions or the regions to Paris. Two start or finish points are open to you: a Paris city gate or a suburban station 10 to 25 km from the centre.',
                )}
              </p>
              <p>
                {L(
                  'Les points Brevets de France font foi sur une grande partie du parcours : la validation de 80 % des BPF suffit à homologuer votre flèche.',
                  'Brevets de France (BPF) checkpoints serve as proof along much of the route: validating 80% of the BPF is enough to have your Flèche validated.',
                )}
              </p>
              <h3>{L('Les formules', 'The formulas')}</h3>
              <ul>
                <li>
                  <b>{L('Or', 'Gold')}</b>
                  {L(
                    ' : le délai le plus exigeant, à réaliser sans dormir sur le parcours.',
                    ': the toughest time limit, ridden without sleeping along the way.',
                  )}
                </li>
                <li>
                  <b>{L('Argent', 'Silver')}</b>
                  {L(' : plus de 200 km par jour à maintenir.', ': more than 200 km a day to sustain.')}
                </li>
                <li>
                  <b>Bronze</b>
                  {L(
                    ' : un minimum de 80 km par jour, avec dormées autorisées.',
                    ': at least 80 km a day, with overnight stops allowed.',
                  )}
                </li>
              </ul>
              <p>
                {L(
                  'Vous partez avec une carte de route à tamponner chez les organisateurs. Les récompenses sont remises en janvier à Paris, ou envoyées par la poste ; la médaille est commandable en supplément.',
                  'You set off with a route card to be stamped along the way. Awards are presented in January in Paris, or sent by post; the medal can be ordered as an extra.',
                )}
              </p>
            </div>
          </section>

          <section className="section section--dense" aria-labelledby="h-reglement">
            <div className="section-head">
              <h2 id="h-reglement" className="t-h2">
                {L('Règlement & contacts', 'Rules & contacts')}{' '}
                <span className="muted">{L('documents officiels', 'official documents')}</span>
              </h2>
            </div>
            <div className="split-pair">
              <div className="encart encart--doc">
                <h3>{L('Règlement des Flèches de France', 'Flèches de France rules')}</h3>
                <p>
                  {L(
                    'Version du 23 décembre 2025 : délais, homologations, médailles et défis.',
                    'Version of 23 December 2025: time limits, validation, medals and challenges (in French).',
                  )}
                </p>
                <a
                  className="btn btn--primary"
                  href="./assets/Reglement-Fleches-de-France-20251223.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  {L('Ouvrir le règlement (PDF)', 'Open the rules (PDF)')}
                </a>
              </div>
              <div className="encart">
                <h3>Contact</h3>
                <p>
                  {L(
                    'Une question sur une homologation, une formule ou une commande de médaille ?',
                    'A question about a validation, a formula or a medal order?',
                  )}
                </p>
                <a className="link" href="mailto:fleches-et-relais-de-france@audax-club-parisien.com">
                  fleches-et-relais-de-france@audax-club-parisien.com
                </a>
                <p className="t-small muted">
                  {L('Inscriptions uniquement en ligne sur', 'Registration online only at')}{' '}
                  <a
                    className="link"
                    href="https://myaccount.audax-club-parisien.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    myaccount.audax-club-parisien.com
                  </a>
                  .
                </p>
              </div>
            </div>
            <p className="t-small muted build-note">
              {L(
                `Base du ${fmtDate(meta.build)} · ${fmt(meta.homologations)} homologations · ${fmt(meta.participants)} participants · ${fmt(meta.clubs)} clubs.`,
                `Data as of ${fmtDate(meta.build)} · ${fmt(meta.homologations)} validated rides · ${fmt(meta.participants)} riders · ${fmt(meta.clubs)} clubs.`,
              )}
            </p>
          </section>
        </div>

        <Sidebar lang={lang} notes={notes} />
      </div>

      {/* bouton d'inscription fixé en bas à gauche de l'écran */}
      <a
        className="btn btn--primary cta-float"
        href="https://myaccount.audax-club-parisien.com"
        target="_blank"
        rel="noreferrer"
      >
        {L("S'inscrire aux Flèches", 'Sign up for the Flèches')} <span aria-hidden="true">↗</span>
      </a>

      {planif && <Planificateur fleches={fleches} onClose={() => setPlanif(false)} />}
    </>
  )
}
