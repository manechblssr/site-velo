import { pick } from '../lib/i18n.js'

/* Texte « En savoir plus » repris du site de l'Audax Club Parisien. */

const PARAGRAPHES = [
  [
    'Les Flèches de France permettent de relier la capitale à 20 villes frontalières ou côtières : Dieppe, Le Havre, Calais, Lille, Charleville-Mézières, Strasbourg, Montbéliard, Bellegarde, Briançon, Nice, Marseille, Perpignan, Luchon, Hendaye, Bordeaux, La Rochelle, Nantes, Brest, Le Mont-Saint-Michel et Cherbourg.',
    'The Flèches de France link the capital to 20 border or coastal towns: Dieppe, Le Havre, Calais, Lille, Charleville-Mézières, Strasbourg, Montbéliard, Bellegarde, Briançon, Nice, Marseille, Perpignan, Luchon, Hendaye, Bordeaux, La Rochelle, Nantes, Brest, Le Mont-Saint-Michel and Cherbourg.',
  ],
  [
    'Les Flèches peuvent se faire aussi bien dans le sens Paris-Province que dans le sens Province-Paris. On peut même utiliser les Relais de France pour rentrer par une autre Flèche de France.',
    'The Flèches can be ridden from Paris to the regions as well as from the regions to Paris. You can even use the Relais de France to ride home along another Flèche de France.',
  ],
  [
    'Afin d’éviter la circulation aux abords de Paris, 2 points de départ ou d’arrivée sont proposés : une porte de Paris, ou une gare de banlieue située entre 10 et 25 km de cette porte.',
    'To avoid the traffic around Paris, 2 start or finish points are offered: a Paris city gate, or a suburban station 10 to 25 km from that gate.',
  ],
  [
    'Les parcours sont en cours de mise à jour depuis 2023. Les nouveaux parcours privilégient nettement les petites routes bucoliques et visent à éviter les axes de circulation trop intense. Anciens et nouveaux parcours font la part belle aux sites BPF (Brevets des Provinces Françaises), des lieux choisis pour leur haut intérêt patrimonial, historique, ou paysager. En parcourant les 20 Flèches de France, vous pourrez valider au passage 80% des BPF.',
    'The routes have been undergoing an update since 2023. The new routes clearly favour quiet country lanes and aim to avoid busy roads. Old and new routes alike give pride of place to BPF sites (Brevets des Provinces Françaises), places chosen for their outstanding heritage, historical or scenic interest. By riding the 20 Flèches de France, you can validate 80% of the BPF along the way.',
  ],
]

const FORMULES = [
  [
    'Chaque Flèche de France doit être réalisée dans un temps imparti, calculé selon la distance et le dénivelé.',
    'Each Flèche de France must be completed within a set time, calculated from its distance and elevation gain.',
  ],
  [
    'Pour chaque Flèche de France, il existe 3 délais maximum qui correspondent à 3 formules : Or, Argent et Bronze.',
    'For each Flèche de France there are 3 maximum time limits, matching 3 formulas: Gold, Silver and Bronze.',
  ],
]

const DELAIS = [
  [
    'Or',
    'Gold',
    'Les délais Or sont très serrés : ils conviennent aux cyclistes qui aiment les défis sportifs intenses et sont capables de rouler longtemps, vite et avec très peu de pauses.',
    'Gold limits are very tight: they suit cyclists who love intense sporting challenges and can ride long, fast and with very few breaks.',
  ],
  [
    'Argent',
    'Silver',
    'Les délais Argent sont moins élitistes mais restent exigeants car ils demandent à minima de parcourir plus de 200km par jour. Ils sont parfaits pour découvrir la longue distance, pour un entraînement hors- saison, ou tout simplement pour cumuler l’effort physique et un peu de cyclotourisme.',
    'Silver limits are less elitist but still demanding, as they require riding more than 200 km a day at the very least. They are perfect for discovering long-distance riding, for off-season training, or simply for combining physical effort with a little cycle touring.',
  ],
  [
    'Bronze',
    'Bronze',
    'Les délais Bronze seront choisis par les cyclistes plus hédonistes, avides de profiter de toutes les beautés proposées par les Flèches de France, tout en respectant quand même un minimum de 80 km par jour en moyenne.',
    'Bronze limits will be chosen by more hedonistic cyclists, keen to enjoy all the beauty the Flèches de France have to offer, while still keeping to a minimum average of 80 km a day.',
  ],
]

const SUITE = [
  [
    'Même si on vous demande quel est le délai envisagé lors de l’inscription, c’est à titre indicatif : le temps mis pour parcourir votre Flèche de France déterminera la catégorie sous laquelle elle sera finalement homologuée.',
    'Although you are asked for your intended time limit when registering, this is only indicative: the time you actually take to ride your Flèche de France will determine the category under which it is finally validated.',
  ],
  [
    'Lors de votre inscription, vous recevrez ou imprimerez une carte de route, que vous ferez tamponner dans un commerce de votre choix à chaque ville-contrôle, pour preuve de votre passage. C’est cette carte de route que vous enverrez à notre Responsable des Flèches de France après votre périple et qui permettra votre homologation. Vous pourrez venir la récupérer en mains propres lors de la Remise des Récompenses, habituellement à Paris en janvier ; si vous ne pouvez pas vous y déplacer, votre carte de route homologuée vous sera renvoyée par la Poste.',
    'When you register, you will receive or print a route card, to be stamped in a shop of your choice in each checkpoint town as proof of your passage. You send this route card to our Flèches de France coordinator after your ride, and it is what allows your ride to be validated. You can collect it in person at the Awards Ceremony, usually held in Paris in January; if you cannot attend, your validated route card will be posted back to you.',
  ],
  [
    'Lors de votre inscription, vous pouvez également commander une médaille que vous recevrez aussi lors de la Remise des Récompenses ou par la Poste.',
    'When you register, you can also order a medal, which you will likewise receive at the Awards Ceremony or by post.',
  ],
  [
    'Les Flèches de France existent depuis 1954 et ont acquis une notoriété immense qui font d’elles les randonnées permanentes les plus importantes de l’Hexagone avec plus de 45000 Flèches réalisées.',
    'The Flèches de France have existed since 1954 and have earned an immense reputation, making them the most important permanent rides in France, with more than 45,000 Flèches completed.',
  ],
  [
    'Le cycle complet des Flèches de France représente plus de 11000 km et permet de recevoir une plaquette offerte, quel que soit le délai de réalisation et la catégorie choisie. A ce jour, près de 800 cyclotouristes ont terminé le cycle complet.',
    'The full cycle of the Flèches de France covers more than 11,000 km and earns a complimentary plaque, whatever the time taken and the category chosen. To date, nearly 800 cycle tourists have completed the full cycle.',
  ],
  [
    'Alors à votre tour, suivez la flèche, ou plutôt les Flèches qui vous permettront de découvrir la France par ses plus belles petites routes.',
    'So now it is your turn: follow the arrow, or rather the Flèches, which will let you discover France along its most beautiful small roads.',
  ],
]

export default function EnSavoirPlus({ lang }) {
  const L = pick(lang)
  return (
    <section className="section section--page" aria-labelledby="h-savoir">
      <div className="wrap">
        <div className="section-head">
          <h1 id="h-savoir" className="t-h2">
            {L('En savoir plus', 'Learn more')}
          </h1>
        </div>
        <div className="prose savoir">
          {[...PARAGRAPHES, ...FORMULES, ...DELAIS.map(([, , fr, en]) => [fr, en]), ...SUITE].map(([fr, en]) => (
            <p key={fr}>{L(fr, en)}</p>
          ))}
          <p className="savoir__fin">
            <a href="./assets/Reglement-Fleches-de-France-20251223.pdf" target="_blank" rel="noreferrer">
              {L('Avant de vous inscrire, lisez attentivement le règlement !', 'Before registering, read the rules carefully!')}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
