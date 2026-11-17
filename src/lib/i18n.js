/* Traduction bilingue de tout le site (interface et contenus éditoriaux).
   - makeT(lang)(clé) : libellés partagés du dictionnaire ci-dessous ;
   - useL() → L(fr, en) : texte en ligne, choisi selon la langue courante. */

import { createContext, useContext } from 'react'

export const LANGS = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'English' },
]

const DICT = {
  // navigation
  'nav.presentation': ['Présentation & Règlement', 'Presentation & rules'],
  'nav.carte': ['Carte interactive', 'Interactive map'],
  'nav.annuaire': ['Palmarès individuel', 'Individual records'],
  'nav.defis': ['Défis & Formules', 'Challenges & formulas'],
  'nav.clubs': ['Palmarès club', 'Club records'],
  'nav.club': ['Notre club', 'Our club'],
  'nav.orgas': ['Nos organisations', 'Our events'],
  'nav.pbrp': ['Paris-Brest-Paris Randonneur', 'Paris-Brest-Paris Randonneur'],
  'nav.calendrier': ['Calendrier', 'Calendar'],
  'nav.actualites': ['Actualités', 'News'],
  'nav.partenaires': ['Partenaires', 'Partners'],
  'nav.search': ['Rechercher', 'Search'],
  'nav.skip': ['Aller au contenu', 'Skip to content'],
  'nav.menu': ['Menu', 'Menu'],
  'nav.close': ['Fermer', 'Close'],

  // vues
  'view.title': ['Flèches de France', 'Flèches de France'],
  'view.annuaire': ['Palmarès individuel', 'Individual records'],
  'view.defis': ['Les défis', 'The challenges'],
  'view.clubs': ['Palmarès club', 'Club records'],
  'view.carte': ['La carte des 20 Flèches', 'Map of the 20 Flèches'],

  // filtres
  'f.search': ['Rechercher un nom, une commune, un n°', 'Search a name, a town, a number'],
  'f.year': ['Année', 'Year'],
  'f.club': ['Club', 'Club'],
  'f.fede': ['Fédération', 'Federation'],
  'f.fleche': ['Flèche', 'Flèche'],
  'f.formule': ['Formule', 'Formula'],
  'f.sexe': ['Sexe', 'Gender'],
  'f.age': ["Tranche d'âge", 'Age band'],
  'f.dept': ['Département', 'Department'],
  'f.pays': ['Pays', 'Country'],
  'f.neo': ['Néophytes', 'First-timers'],
  'f.complete': ['La Complète', 'The Complete'],
  'f.all': ['Tous', 'All'],
  'f.none': ['Sans club', 'No club'],
  'f.reset': ['Réinitialiser', 'Reset'],
  'f.results': ['résultats', 'results'],
  'f.advanced': ['Filtres avancés', 'Advanced filters'],
  'f.showing': [
    'Affichage de {a} à {b} sur {n} résultats',
    'Showing {a} to {b} of {n} results',
  ],
  'f.sort': ['Trier par', 'Sort by'],
  'f.export': ['Exporter en CSV', 'Export CSV'],
  'f.manager': ['Mode gestionnaire local', 'Local manager mode'],
  'f.managerNote': [
    'Coordonnées complètes visibles (usage local uniquement).',
    'Full contact details shown (local use only).',
  ],

  // tableau annuaire
  't.name': ['Nom', 'Name'],
  't.club': ['Club', 'Club'],
  't.fede': ['Fédération', 'Federation'],
  't.place': ['Commune', 'Town'],
  't.sexe': ['Sexe', 'Gender'],
  't.age': ['Âge', 'Age'],
  't.nb': ['Flèches', 'Flèches'],
  't.distinctes': ['Distinctes', 'Distinct'],
  't.km': ['Km', 'Km'],
  't.first': ['Première', 'First'],
  't.last': ['Dernière', 'Last'],
  't.status': ['Statut', 'Status'],
  't.formule': ['Formule', 'Formula'],
  't.date': ['Date', 'Date'],
  't.num': ["N° homologation", 'Record no.'],
  't.year': ['Millésime', 'Year'],
  't.dplus': ['D+', 'D+'],
  't.med': ['Médaille', 'Medal'],
  't.view': ['Voir le palmarès', 'View records'],
  't.viewShort': ['Voir', 'View'],

  // états
  'e.loading': ['Chargement des données…', 'Loading data…'],
  'e.error': ['Impossible de charger les données du classeur.', 'Could not load the workbook data.'],
  'e.empty': ['Aucun résultat avec ces filtres.', 'No result with these filters.'],
  'e.retry': ['Réessayer', 'Retry'],
}

const CACHE = new Map()

export function makeT(lang) {
  const idx = lang === 'en' ? 1 : 0
  if (CACHE.has(lang)) return CACHE.get(lang)
  const t = (key) => {
    const row = DICT[key]
    return row ? row[idx] : key
  }
  CACHE.set(lang, t)
  return t
}

/** En-tête d'une colonne de tableau, traduit si la clé existe. */
export function col(t, key, fallback) {
  const v = t(key)
  return v === key ? fallback : v
}

/* --- Langue courante partagée par tout l'arbre ------------------------- */

export const LangContext = createContext('fr')

export function useLang() {
  return useContext(LangContext)
}

/** Choisit entre une version française et anglaise : L('Bonjour', 'Hello'). */
export function pick(lang) {
  return (fr, en) => (lang === 'en' && en !== undefined ? en : fr)
}

export function useL() {
  return pick(useLang())
}

/** Libellé de club traduit quand le classeur emploie une mention générique
   (« Sans licence 77 », « Non licencié 51 », « Membre individuel FFCT »). */
export function nomClub(club, lang) {
  if (!club || lang !== 'en') return club
  return club
    .replace(/^sans licence\b/i, 'No licence')
    .replace(/^non licenci[ée]e?(?=\s|$)/i, 'Unlicensed')
    .replace(/^membre individuel\b/i, 'Individual member')
    .replace(/\(old\)/i, '(former)')
}

/** Pluriel simple : plural(n, 'flèche', 'flèches'). */
export function plural(n, one, many) {
  return Math.abs(n) > 1 ? many : one
}
