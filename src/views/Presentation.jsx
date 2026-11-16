import { useMemo } from 'react'
import Sidebar from '../components/Sidebar.jsx'
import { makeT } from '../lib/i18n.js'
import { fmt, fmtDate } from '../lib/data.js'

/* Les 5 encarts de la page officielle + le texte « En savoir plus »,
   dans la rédaction du site de l'Audax Club Parisien. */

const ENCARTS = [
  {
    q: 'C\'est quoi ?',
    r: '20 parcours 100 % route, au départ ou à l\'arrivée de Paris.',
  },
  {
    q: 'Quand ?',
    r: 'Des randonnées permanentes : vous partez quand vous voulez, la flèche est ouverte toute l\'année.',
  },
  {
    q: 'Quel délai ?',
    r: 'Trois formules pour valider votre flèche : Or, Argent ou Bronze.',
  },
  {
    q: 'C\'est combien ?',
    r: 'Un tarif tout doux, et gratuit pour les mineurs.',
  },
  {
    q: 'Où s\'inscrire ?',
    r: 'Uniquement en ligne sur myaccount.audax-club-parisien.com.',
  },
]

const TARIFS = [
  ['Licenciés FFCT', '6 €'],
  ['Non licenciés FFCT', '9 €'],
  ['Mineurs', 'Gratuit'],
  ['Envoi de la carte par la poste', '+3 €'],
]

const DEFS_CARDS = [
  {
    titre: 'La Complète',
    texte:
      'Valider les 20 Flèches de France. Depuis 1997, une centaine de cyclotouristes y sont parvenus sur le cycle complet.',
    vue: 'defis',
  },
  {
    titre: 'La Complète express',
    texte:
      'Les 20 Flèches en une seule année, soit près de 11 200 km à réaliser en douze mois.',
    vue: 'defis',
  },
  {
    titre: 'Le combiné',
    texte:
      'Couplage des Flèches de France avec les Relais de France : deux défis, un même carnet.',
    vue: 'defis',
  },
  {
    titre: 'Le pionnier',
    texte:
      'Être le premier à homologuer une formule sur une flèche. Certaines combinaisons restent vierges depuis 1997.',
    vue: 'defis',
  },
]

export default function Presentation({ lang, data }) {
  const t = makeT(lang)
  const { fleches, meta, defis, homologations } = data

  const pionnier = useMemo(
    () => homologations.filter((h) => h.annee >= 1997 && h.annee <= 2025).length,
    [homologations],
  )

  const notes = [
    { date: '2026', texte: `${meta.homologations.toLocaleString('fr-FR')} homologations dans la base, ${meta.participants.toLocaleString('fr-FR')} fléchards.` },
    { date: 'Défi', texte: `${defis.complete.length} lauréats de La Complète (20 flèches sur le cycle complet).` },
    { date: 'Règlement', texte: 'Version en vigueur au 23 décembre 2025 (PDF ci-dessous).' },
    { date: 'Vierges', texte: '5 formules sans lauréat entre 1997 et 2025 : Briançon, Hendaye, Luchon et Marseille.' },
  ]

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="hero hero-split" data-enter>
        <div className="wrap hero-split__in">
          <div className="hero-copy">
            <p className="hero-kicker">Audax Club Parisien · depuis 1954</p>
            <h1 className="t-h1">Les Flèches de France</h1>
            <p className="t-lead hero-slogan">
              « Elles sortent du carquois de l'imagination, elles fusent à travers toute la
              France et piquent le sentiment de la découverte ! »
            </p>
            <p className="hero-facts">
              <b>{fleches.length} parcours</b> · {fmt(meta.homologations)} homologations depuis{' '}
              {meta.annees[0]} · {defis.complete.length} La Complète
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
                Consulter l'annuaire
              </a>
              <a
                className="btn btn--secondary"
                href="#/carte"
                onClick={(e) => {
                  e.preventDefault()
                  window.location.hash = '#/carte'
                }}
              >
                Voir la carte
              </a>
            </div>
          </div>
          <div className="hero-stage">
            <img
              className="visuel hero-img"
              src="./assets/carte-fleches.png"
              alt="Carte des 20 Flèches de France au départ ou à l'arrivée de Paris"
              width="1024"
              height="858"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- corps */}
      <div className="wrap page-cols">
        <div className="page-main">
          {/* encarts */}
          <section className="section section--dense" aria-labelledby="h-encarts">
            <div className="section-head">
              <h2 id="h-encarts" className="t-h2">
                En bref <span className="muted">ce qu'il faut savoir avant de partir</span>
              </h2>
            </div>
            <div className="encarts">
              {ENCARTS.map((e) => (
                <article className="encart lift" key={e.q}>
                  <h3>{e.q}</h3>
                  <p>{e.r}</p>
                </article>
              ))}
            </div>
          </section>

          {/* tableau officiel */}
          <section className="section section--dense" aria-labelledby="h-tableau">
            <div className="section-head">
              <h2 id="h-tableau" className="t-h2">
                Les 20 Flèches <span className="muted">référentiel officiel 2026</span>
              </h2>
            </div>
            <p className="note">
              Les distances et dénivelés ci-dessous font foi pour l'édition 2026. Les valeurs
              historiques enregistrées sur chaque homologation restent consultables sur la fiche
              de chaque flèche et dans l'annuaire.
            </p>
            <div className="table-scroll">
              <table className="table-app table--20">
                <caption className="sr-only">
                  Tableau officiel des 20 Flèches de France 2026
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
                    <th scope="col">Délai Or</th>
                    <th scope="col">Délai Argent</th>
                    <th scope="col">Délai Bronze</th>
                    <th scope="col">Départ décalé</th>
                    <th scope="col">Ressources</th>
                  </tr>
                </thead>
                <tbody>
                  {fleches.map((f) => {
                    const ecart = f.hist?.km && f.hist.km !== f.km
                    return (
                      <tr key={f.id}>
                        <th scope="row">
                          <a
                            href="#/carte"
                            onClick={(e) => {
                              e.preventDefault()
                              window.location.hash = `#/carte/${f.id}`
                            }}
                          >
                            {f.nom}
                          </a>
                        </th>
                        <td className="num">
                          {fmt(f.km)} km
                          {ecart && (
                            <span className="hist"> {fmt(f.hist.km)} km avant</span>
                          )}
                        </td>
                        <td className="num">
                          {fmt(f.dplus)} m
                          {f.hist?.dplus && f.hist.dplus !== f.dplus && (
                            <span className="hist"> {fmt(f.hist.dplus)} m avant</span>
                          )}
                        </td>
                        <td>{f.delais.O}</td>
                        <td>{f.delais.A}</td>
                        <td>{f.delais.B}</td>
                        <td>
                          {f.depart.commune}
                          <span className="hist"> {fmt(f.depart.km)} km</span>
                        </td>
                        <td className="res">
                          <a href={f.openrunner} target="_blank" rel="noreferrer">
                            OpenRunner ↗
                          </a>
                          <a href={f.pdf} target="_blank" rel="noreferrer">
                            Feuille de route ↗
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* tarifs + calculateur */}
          <section className="section section--dense" aria-labelledby="h-tarifs">
            <div className="section-head">
              <h2 id="h-tarifs" className="t-h2">
                Les tarifs <span className="muted">et la carte de route</span>
              </h2>
            </div>
            <div className="split-pair">
              <div>
                <ul className="rows">
                  {TARIFS.map(([libelle, prix]) => (
                    <li key={libelle}>
                      <span className="rows__name">{libelle}</span>
                      <span className="rows__value">{prix}</span>
                    </li>
                  ))}
                </ul>
                <p className="t-small muted tarif-note">
                  Tarifs 2025 publiés par le club ; médaille facultative disponible auprès du
                  secrétariat.
                </p>
              </div>
              <div className="encart encart--action">
                <h3>Planifiez votre Flèche</h3>
                <p>
                  Le classeur officiel calcule vos délais, vos étapes et votre carte de route à
                  partir de la formule choisie.
                </p>
                <a className="btn btn--secondary" href="./assets/Calculateur-fleches-v2.3.xlsx" download>
                  Télécharger le Calculateur v2.3
                </a>
              </div>
            </div>
          </section>

          {/* défis */}
          <section className="section section--dense" aria-labelledby="h-defis">
            <div className="section-head section-head--row">
              <h2 id="h-defis" className="t-h2">
                Les défis <span className="muted">au-delà des 20 flèches</span>
              </h2>
              <a
                className="link"
                href="#/defis"
                onClick={(e) => {
                  e.preventDefault()
                  window.location.hash = '#/defis'
                }}
              >
                Ouvrir l'explorateur des défis
              </a>
            </div>
            <div className="defi-cards">
              {DEFS_CARDS.map((d) => (
                <a
                  key={d.titre}
                  className="defi-card lift"
                  href={`#/${d.vue}`}
                  onClick={(e) => {
                    e.preventDefault()
                    window.location.hash = `#/${d.vue}`
                  }}
                >
                  <h3>{d.titre}</h3>
                  <p>{d.texte}</p>
                  <span className="defi-card__go">Découvrir →</span>
                </a>
              ))}
            </div>
            <p className="t-small muted defi-figures">
              {pionnier.toLocaleString('fr-FR')} flèches homologuées entre {meta.annees[0]} et
              2025 dans la base · {defis.express.length} Complètes express détectées ·{' '}
              {defis.vierges.filter((v) => v.vierge1997_2025).length} formules encore vierges
              sur la période.
            </p>
          </section>

          {/* en savoir plus */}
          <section className="section section--dense" aria-labelledby="h-savoir">
            <div className="section-head">
              <h2 id="h-savoir" className="t-h2">
                En savoir plus <span className="muted">le fonctionnement</span>
              </h2>
            </div>
            <div className="prose">
              <p>
                Depuis 1954, plus de 45 000 Flèches ont été réalisées. Un cycle complet de plus
                de 11 000 km donne droit à une plaquette offerte par le club.
              </p>
              <p>
                Le sens du parcours est libre : Paris-Province ou Province-Paris. Deux points de
                départ ou d'arrivée sont ouverts à votre choix : la porte de Paris ou une gare de
                banlieue située entre 10 et 25 km du centre.
              </p>
              <p>
                Les points Brevets de France font foi sur une grande partie du parcours : la
                validation de 80 % des BPF suffit à homologuer votre flèche.
              </p>
              <h3>Les formules</h3>
              <ul>
                <li>
                  <b>Or</b> : le délai le plus exigeant, à réaliser sans dormir sur le parcours.
                </li>
                <li>
                  <b>Argent</b> : plus de 200 km par jour à maintenir.
                </li>
                <li>
                  <b>Bronze</b> : un minimum de 80 km par jour, avec dormées autorisées.
                </li>
              </ul>
              <p>
                Vous partez avec une carte de route à tamponner chez les organisateurs. Les
                récompenses sont remises en janvier à Paris, ou envoyées par la poste ; la
                médaille est commandable en supplément.
              </p>
            </div>
          </section>

          {/* règlement */}
          <section className="section section--dense" aria-labelledby="h-reglement">
            <div className="section-head">
              <h2 id="h-reglement" className="t-h2">
                Règlement & contacts <span className="muted">documents officiels</span>
              </h2>
            </div>
            <div className="split-pair">
              <div className="encart encart--doc">
                <h3>Règlement des Flèches de France</h3>
                <p>
                  Version du 23 décembre 2025 : délais, homologations, médailles et défis.
                </p>
                <a
                  className="btn btn--primary"
                  href="./assets/Reglement-Fleches-de-France-20251223.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir le règlement (PDF)
                </a>
              </div>
              <div className="encart">
                <h3>Contact</h3>
                <p>
                  Une question sur une homologation, une formule ou une commande de médaille ?
                </p>
                <a className="link" href="mailto:fleches-et-relais-de-france@audax-club-parisien.com">
                  fleches-et-relais-de-france@audax-club-parisien.com
                </a>
                <p className="t-small muted">
                  Inscriptions uniquement en ligne sur{' '}
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
              Base du {fmtDate(meta.build)} · {fmt(meta.homologations)} homologations ·{' '}
              {fmt(meta.participants)} participants · {fmt(meta.clubs)} clubs.
            </p>
          </section>
        </div>

        <Sidebar lang={lang} notes={notes} />
      </div>
    </>
  )
}
