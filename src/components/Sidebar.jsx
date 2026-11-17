import { makeT, pick } from '../lib/i18n.js'

const ORGAS = [
  ['https://www.audax-club-parisien.com/organisation/paris-brest-paris-randonneur/', 'Paris-Brest-Paris Randonneur'],
  ['https://www.audax-club-parisien.com/organisation/bordeaux-paris-bordeaux/', 'Bordeaux-Paris-Bordeaux'],
  ['https://www.audax-club-parisien.com/organisation/paris-brest-paris-1200/', 'Paris-Brest-Paris 1200'],
  ['https://www.audax-club-parisien.com/organisation/les-brevets/', 'Les Brevets', 'The Brevets'],
  ['https://www.audax-club-parisien.com/organisation/les-relais-de-france/', 'Les Relais de France', 'The Relais de France'],
  ['https://www.audax-club-parisien.com/organisation/les-fleches-de-france/', 'Les Flèches de France', 'The Flèches de France'],
]

const SOCIALS = [
  ['https://www.facebook.com/audaxclubparisien/', 'Facebook'],
  ['https://www.instagram.com/audaxclubparisien/', 'Instagram'],
  ['https://www.strava.com/clubs/52187', 'Strava'],
]

export default function Sidebar({ lang, notes }) {
  const t = makeT(lang)
  const L = pick(lang)
  return (
    <aside className="sidebar" aria-label={L('Compléments', 'More')}>
      <div className="aside-block">
        <p className="aside-title">{t('nav.actualites')}</p>
        <ul className="aside-list">
          {notes.map((n) => (
            <li key={n.texte}>
              <b className="aside-date">{n.date}</b>
              <span>{lang === 'en' && n.en ? n.en : n.texte}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="aside-block">
        <p className="aside-title">{t('nav.orgas')}</p>
        <ul className="aside-list">
          {ORGAS.map(([href, nom, en]) => (
            <li key={nom}>
              <a href={href} target="_blank" rel="noreferrer">
                {L(nom, en)} <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="aside-block">
        <p className="aside-title">{L('Suivez-nous !', 'Follow us!')}</p>
        <div className="socials socials--text">
          {SOCIALS.map(([href, nom]) => (
            <a key={nom} className="link" href={href} target="_blank" rel="noreferrer">
              {nom} <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </div>

    </aside>
  )
}
