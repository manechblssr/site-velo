import { makeT } from '../lib/i18n.js'

const ORGAS = [
  ['https://www.audax-club-parisien.com/organisation/paris-brest-paris-randonneur/', 'Paris-Brest-Paris Randonneur'],
  ['https://www.audax-club-parisien.com/nos-organisations/', 'Toutes nos organisations'],
  ['https://www.audax-club-parisien.com/calendrier/', 'Calendrier'],
  ['https://www.audax-club-parisien.com/actualites/', 'Actualités'],
]

const SOCIALS = [
  ['https://www.facebook.com/audaxclubparisien/', 'Facebook'],
  ['https://www.instagram.com/audaxclubparisien/', 'Instagram'],
  ['https://www.strava.com/clubs/52187', 'Strava'],
]

export default function Footer({ lang, meta }) {
  const t = makeT(lang)
  return (
    <footer className="footer footer--dark ground-inverse">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <img src="./assets/logo-acp-blanc.png" alt="" width="150" height="89" />
          <p className="footer__lede">
            Audax Club Parisien Randonneur — organisme de randonnées et brevets de cyclotourisme
            depuis 1929.
          </p>
          <div className="socials socials--text">
            {SOCIALS.map(([href, nom]) => (
              <a key={nom} className="link" href={href} target="_blank" rel="noreferrer">
                {nom} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>

        <nav aria-label="Nos organisations" className="footer-col">
          <h3>{t('nav.orgas')}</h3>
          <ul>
            {ORGAS.map(([href, nom]) => (
              <li key={nom}>
                <a href={href} target="_blank" rel="noreferrer">
                  {nom}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Les Flèches de France" className="footer-col">
          <h3>Flèches de France</h3>
          <ul>
            <li>
              <a href="#/presentation">{t('nav.presentation')}</a>
            </li>
            <li>
              <a href="#/carte">{t('nav.carte')}</a>
            </li>
            <li>
              <a href="#/annuaire">{t('nav.annuaire')}</a>
            </li>
            <li>
              <a href="#/defis">{t('nav.defis')}</a>
            </li>
            <li>
              <a href="#/clubs">{t('nav.clubs')}</a>
            </li>
          </ul>
        </nav>

        <div className="footer-col">
          <h3>Règlement & contact</h3>
          <ul>
            <li>
              <a href="./assets/Reglement-Fleches-de-France-20251223.pdf" target="_blank" rel="noreferrer">
                Règlement des Flèches de France (PDF)
              </a>
            </li>
            <li>
              <a href="./assets/Calculateur-fleches-v2.3.xlsx" download>
                Calculateur de flèche (XLSX)
              </a>
            </li>
            <li>
              <a href="mailto:fleches-et-relais-de-france@audax-club-parisien.com">
                fleches-et-relais-de-france@audax-club-parisien.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="wrap footer__legal">
        <span>Copyright © 2026 Audax Club Parisien Randonneur</span>
        <span className="footer-meta">
          {meta ? `${meta.homologations.toLocaleString('fr-FR')} homologations · ${meta.participants.toLocaleString('fr-FR')} fléchards · base du ${meta.build}` : ''}
        </span>
      </div>
    </footer>
  )
}
