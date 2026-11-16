# CONSIGNES DE DÉVELOPPEMENT — SITE LOCAL « FLÈCHES DE FRANCE » (AUDAX CLUB PARISIEN)

## CONSIGNE PRIORITAIRE — À EXÉCUTER AVANT TOUTE AUTRE ACTION

1. **Lire tous les skills `.opencode` du projet** :
   - Commence impérativement par lister l'intégralité du dossier `.opencode/` (en particulier tous les fichiers `.opencode/skills/*/SKILL.md` ainsi que leurs sous-dossiers éventuels `references/`, `scripts/`, `assets/` et tout fichier `AGENTS.md` ou `opencode.json` présent à la racine).
   - Charge et lis intégralement chaque skill pertinent via l'outil `skill` (et/ou par lecture directe des fichiers) avant de rédiger la moindre ligne de code.
   - Respecte scrupuleusement toutes les directives de ces skills (esthétique, ergonomie, architecture, conventions de code et qualité logicielle).
2. **Inspecter tous les fichiers fournis dans le projet** :
   - Liste l'ensemble des fichiers présents dans le répertoire du projet, notamment `Tableau de Bord Flèches.xlsx`, `https---www.audax-club-parisien.com-organisation-fleches-de-france-.url`, `https---fleches.ndlr.net-fleches-.url`, ainsi que toute éventuelle archive HTML/CSS, GPX, PDF ou image présente localement.

---

## OBJECTIF GÉNÉRAL

Reconstruis un site web exécutable **100 % en local** reproduisant fidèlement la page et l'univers des **Flèches de France de l'Audax Club Parisien** (`https://www.audax-club-parisien.com/organisation/fleches-de-france/`), dans son contenu éditorial, son arborescence, ses tableaux officiels, ses règlements et son identité Audax Club Parisien, tout en apportant :

1. **Une légère amélioration esthétique** (mise en page plus contemporaine, hiérarchie visuelle claire, responsive, badges Or / Argent / Bronze soignés, tout en conservant l'esprit institutionnel et sobre du club et en appliquant strictement les skills `.opencode`).
2. **Un Annuaire des participants (Fléchards)** alimenté par `Tableau de Bord Flèches.xlsx`, avec fiche complète du palmarès individuel de chaque personne.
3. **Un moteur de recherche et des filtres multicritères** (année, club participant, fédération, flèche, formule, sexe, tranche d'âge, néophytes, statut *La Complète*) accompagnés d'une vue **Clubs & Statistiques**.
4. **Une carte interactive** des 20 Flèches de France, des villes d'arrivée et des points de départ décalés.
5. **Un explorateur des Défis et des Formules (Or, Argent, Bronze)** permettant de retrouver nominativement toutes les personnes ayant obtenu chaque formule et chaque défi.

---

## ÉTAPE 1 : AUDIT PROGRAMMATIQUE DE `Tableau de Bord Flèches.xlsx` ET DES RESSOURCES LOCALES

Avant de concevoir l'interface, écris et exécute un script Python (`openpyxl` / `pandas`) inspectant **l'intégralité du classeur `Tableau de Bord Flèches.xlsx`** :

1. **Inventaire complet du classeur** : liste tous les onglets, leurs dimensions exactes, leurs ligne(s) d'en-tête réelles et les formules Excel présentes.
2. **Journal détaillé des homologations (46 colonnes)** :
   - **Clés & flèche** : Col 1 (`Flèche-Année-Numéro`), Col 2 (`NOM Prénom`), Col 3 (Millésime/Année d'homologation), Col 4 (N° d'homologation), Col 5 (Nom de la Flèche), Col 6 (Date de réalisation `YYYY-MM-DD`, parfois normalisée au `01-01` pour les anciennes éditions), Col 7 (Formule homologuée : `O` = Or, `A` = Argent, `B` = Bronze — nettoie et documente toute autre valeur comme `Randonneurs` ou cellule vide).
   - **Identité & club** : Col 8 (Nom), Col 9 (Prénom), Col 10 (Date de naissance), Col 11 (Sexe `H`/`F`), Col 12–16 (Téléphone, Rue, Ville, Code postal, Pays), Col 17 (Code club, ex. `FR92Z999` pour sans licence), Col 18 (Libellé club / statut individuel), Col 19 (Fédération : `FFCT`, `FFC`, `FFTri`, vide pour sans licence/étrangers).
   - **Parcours & indicateurs** : Col 22 (âge au `2026-11-12`), Col 23 (Ville d'arrivée), Col 24 (Distance enregistrée en km), Col 25 (Dénivelé D+ enregistré en m), Col 26–29 (totaux cumulés/annuels de flèches du participant et inverses `1/N`), Col 30 (dernière date connue du participant), Col 35–36 (classes de distance `a/b/c` et `a/b`), Col 37–39 (répétitions sur cette flèche, poids `1/N` et nombre de **flèches distinctes sur 20** pour *La Complète*), Col 40 (année de référence), Col 41–44 (âge exact le jour de la flèche, tranche d'âge `a/b/c/d`, date de première flèche, indicateur néophyte `0`/`0.5`/`1`).
   - **Colonnes à décoder impérativement via les en-têtes/formules du `.xlsx`** : inspecte les titres et formules Excel des **colonnes 20, 21, 31 à 34, 45 et 46** (valeurs `0`, `1`, `2`, `x`, `?`, `27..91`) afin d'en établir le sens exact et de les exploiter correctement.
3. **Autres tables / onglets du classeur** :
   - Extrais la **table récapitulative des participants** (avec compteurs de flèches par cyclotouriste).
   - Extrais la section/onglet **« Les 20 flèches »** listant séparément **Femmes** et **Hommes**.
   - Extrais les **tables juxtaposées des clubs** (liste des clubs + compteurs et matrice pluriannuelle des distances par club). Attention : ces blocs placés côte à côte ne sont pas alignés ligne à ligne sur un même club ; parse chaque bloc selon ses propres colonnes et en-têtes.
4. **Assets web et fichiers locaux** :
   - Vérifie d'abord si des sauvegardes locales (HTML/CSS/images/GPX) de `audax-club-parisien.com` ou de `fleches.ndlr.net/fleches/` existent dans le dossier.
   - Si ta machine dispose d'un accès réseau au moment de la génération, tu peux télécharger localement les médias et documents publics du site ACP (voir la section « Ressources officielles » ci-dessous) dans `/public/assets/`, tout en sachant que `fleches.ndlr.net` est inaccessible en ligne et doit donc être suppléé par une carte interactive autonome et nos specs ci-dessous.

---

## ÉTAPE 2 : FIDÉLITÉ AU SITE AUDAX CLUB PARISIEN

### A. Structure éditoriale, en-tête, barre latérale et pied de page
Reproduis fidèlement l'ossature et les contenus de la page **Flèches de France** :
- **En-tête** : Lien d'évitement (« Aller au contenu »), logo ACP, sélecteur de langue (`Français` / `English`), champ « Rechercher », et menu principal (`Notre club`, `Nos organisations`, `Paris-Brest-Paris Randonneur`, `Calendrier`, `Actualités`, `Partenaires`) complété par une navigation claire vers les vues locales interactives (`Présentation & Règlement`, `Carte interactive`, `Annuaire & Palmarès`, `Défis & Formules`, `Clubs & Statistiques`).
- **Contenu principal de la page Flèches de France** :
  - Slogan : *« Elles sortent du carquois de l'imagination, elles fusent à travers toute la France et piquent le sentiment de la découverte ! »*
  - Les 5 encarts synthétiques : *C'est quoi ?* (20 parcours 100% route au départ ou à l'arrivée de Paris), *Quand ?* (randonnées permanentes), *Quel délai ?* (Or, Argent ou Bronze), *C'est combien ?* (un tarif tout doux), *Où s'inscrire ?* (uniquement en ligne sur `https://myaccount.audax-club-parisien.com`).
  - **Tableau officiel des 20 Flèches** (données officielles ci-dessous).
  - **Les tarifs** : Licenciés FFCT `6 €`, Non licenciés FFCT `9 €`, Mineurs `Gratuit`, Envoi Carte `+3 €` (avec possibilité de mentionner en note les tarifs 2025/médaille facultative issus des brochures du club).
  - **Planifiez votre Flèche** : lien vers le classeur `Calculateur-fleches-v2.3.xlsx`.
  - **Les défis** : *La Complète* (129 participants depuis 1997 ; près de 800 cyclotouristes au total sur le cycle complet), *La Complète express* (20 flèches / 11 200 km en une année : Guy LANNES en 2004, Jacques MARIE en 2009), *Le combiné* (couplage avec les Relais de France), *Le pionnier* (16 859 Flèches entre 1997 et 2025 ; 5 formules signalées vierges : Briançon Or, Hendaye Or, Luchon Or, Marseille Or, Marseille Argent).
  - **En savoir plus** : historique depuis 1954 (plus de 45 000 Flèches réalisées, cycle de plus de 11 000 km donnant droit à une plaquette offerte), sens Paris-Province ou Province-Paris, 2 points de départ/arrivée (porte de Paris ou gare de banlieue entre 10 et 25 km), sites BPF (validation possible de 80% des BPF), explication détaillée des formules Or / Argent (plus de 200 km/jour) / Bronze (minimum 80 km/jour), carte de route à tamponner, remise des récompenses en janvier à Paris ou envoi postal, et commande facultative de médaille.
  - **Règlement & Contacts** : lien vers `Reglement-Fleches-de-France-20251223.pdf` et contact `fleches-et-relais-de-france@audax-club-parisien.com`.
- **Barre latérale & Pied de page** : *Dernières actualités*, accès rapide *Nos organisations*, *Suivez-nous !* (Facebook `https://www.facebook.com/audaxclubparisien/`, Instagram `https://www.instagram.com/audaxclubparisien/`, Strava `https://www.strava.com/clubs/52187`), logo monochrome blanc ACP et `Copyright © 2026 Audax Club Parisien Randonneur`.

### B. Ressources officielles ACP (URL à héberger localement si possible ou prévoir repli propre)
- Logo en-tête : `https://www.audax-club-parisien.com/wp-content/uploads/2023/01/LogoAudax-2022-150x85.png`
- Illustration carte : `https://www.audax-club-parisien.com/wp-content/uploads/2026/04/f9b1ffcf-9fa6-4cd2-852c-ccda0da81439-1024x858.png`
- Visuel médaille : `https://www.audax-club-parisien.com/wp-content/uploads/2021/02/fle_france_med20-300x295.jpeg`
- Logo pied de page blanc : `https://www.audax-club-parisien.com/wp-content/uploads/2026/09/ACP-Logo-tout-blanc-300x179.png`
- Calculateur Excel v2.3 : `https://www.audax-club-parisien.com/wp-content/uploads/2026/06/Calculateur-fleches-v2.3.xlsx`
- Règlement officiel : `https://www.audax-club-parisien.com/wp-content/uploads/2026/01/Reglement-Fleches-de-France-20251223.pdf`

### C. Référentiel officiel des 20 Flèches (site ACP 2026)
Important : plusieurs parcours ont été actualisés entre 2023 et 2026 (Calais, Strasbourg, Bellegarde, etc.), donc les distances/D+ historiques présents dans certaines lignes de l'Excel peuvent différer de ce tableau officiel 2026. Affiche ce tableau officiel dans la page de présentation tout en conservant les valeurs historiques enregistrées sur chaque fiche d'homologation :

| Flèche | Distance | D+ | Délai Or | Délai Argent | Délai Bronze | Départ décalé (commune / km / D+ / Or / Argent / Bronze) | OpenRunner | Feuille de route PDF |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DIEPPE | 192 km | 1025 m | 7h40 | 9h35 | 58h | Cormeilles / 177 km / 1005 m / 7h05 / 8h50 / 53h | `https://www.openrunner.com/route-details/16059614` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/20-FF_Paris_Dieppe-1.pdf` |
| CHARLEVILLE | 245 km | 2000 m | 10h40 | 13h35 | 73h | Tremblay / 230 km / — / 10h / 12h45 / 69h | `https://www.openrunner.com/route-details/18001619` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/03-FF_iti_Paris-Charleville.pdf` |
| LE HAVRE | 256 km | 1782 m | 11h05 | 14h10 | 76h | La Frette / 240 km / 1657 m / 10h20 / 13h30 / 72h | `https://www.openrunner.com/route-details/19863360` | `https://www.audax-club-parisien.com/wp-content/uploads/2025/01/19-FF_iti_Paris-Le-Havre_2025.pdf` |
| LILLE | 275 km | 1778 m | 12h | 15h15 | 82h | Villiers-le-Bel / 260 km / — / 11h15 / 14h25 / 78h | `https://www.openrunner.com/route-details/18054639` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/02_FF_iti_Paris-Lille.pdf` |
| CALAIS | 324 km | 2775 m | 14h | 18h | 97h | Eaubonne / 309 km / — / 13h20 / 17h10 / 96h | `https://www.openrunner.com/route-details/23096359` | `https://www.audax-club-parisien.com/wp-content/uploads/2026/04/Paris-Calais-2026.pdf` |
| MONT ST MICHEL | 326 km | 3101 m | 15h15 | 19h40 | 98h | Noisy-le-Roi / 309 km / — / 14h / 18h10 / 93h | `https://www.openrunner.com/route-details/18054362` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/17_FF_iti_Paris-Mont-St-Michel.pdf` |
| CHERBOURG | 406 km | 3562 m | 20h | 36h | 122h | Le Pecq / 392 km / — / 19h / 35h / 118h | `https://www.openrunner.com/route-details/18054505` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/18_FF_iti_Paris-Cherbourg.pdf` |
| NANTES | 431 km | 2482 m | 20h | 36h | 129h | Versailles / 420 km / 2320 m / 19h30 / 35h20 / 126h | `https://www.openrunner.com/route-details/16123846` | `https://www.audax-club-parisien.com/wp-content/uploads/2025/01/15-FF_iti_Paris-Nantes_2025.pdf` |
| MONTBELIARD | 465 km | 4458 m | 23h15 | 40h | 140h | Pontault-Combault / 447 km / — / 22h20 / 38h / 134h | `https://www.openrunner.com/route-details/18054694` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/05_FF_iti_Paris-Montbeliard.pdf` |
| LA ROCHELLE | 488 km | 3590 m | 24h25 | 40h | 146h | Jouy-en-Josas / 472 km / — / 23h35 / 38h / 141h | `https://www.openrunner.com/route-details/17793209` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/14-FF_iti_Paris-La-Rochelle.pdf` |
| STRASBOURG | 515 km | 3839 m | 28h | 45h | 155h | Gournay-sur-Marne / 499 km / — / 27h40 / 44h15 / 155h | `https://www.openrunner.com/route-details/21361439` | `https://www.audax-club-parisien.com/wp-content/uploads/2026/04/Paris-Strasbourg-2026.pdf` |
| BELLEGARDE | 600 km | 5429 m | 37h | 60h | 180h | Montgeron / 584 km / — / 36h30 / 59h15 / 179h | `https://www.openrunner.com/route-details/25336566` | `https://www.audax-club-parisien.com/wp-content/uploads/2026/04/Paris-Bellegarde-2026.pdf` |
| BREST | 616 km | 5607 m | 36h15 | 61h | 185h | Versailles / 605 km / — / 35h35 / 60h / 181h | `https://www.openrunner.com/route-details/18054224` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/16_FF_iti_Paris-Brest.pdf` |
| BORDEAUX | 659 km | 4437 m | 35h | 63h | 186h | Massy / 645 km / 4319 m / 34h10 / 62h / 181h30 | `https://www.openrunner.com/route-details/20763473` | `https://www.audax-club-parisien.com/wp-content/uploads/2025/02/13-FF_iti_Paris-Bordeaux_2025_v2.pdf` |
| BRIANCON | 783 km | 8666 m | 51h | 83h | 235h | Villeneuve-Saint-Georges / 765 km / 8580 m / 50h10 / 82h / 230h | `https://www.openrunner.com/route-details/21686262` | `https://www.audax-club-parisien.com/wp-content/uploads/2025/11/07-FF_iti_Paris-Briancon_2025.pdf` |
| LUCHON | 861 km | 8311 m | 62h | 86h | 258h | Palaiseau / 848 km / — / 58h45 / 84h30 / 234h | `https://www.openrunner.com/route-details/18160243` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/11_FF_iti_Paris-Luchon.pdf` |
| HENDAYE | 902 km | 7221 m | 60h | 86h | 270h | Bièvres / 890 km / — / 58h45 / 84h30 / 267h | `https://www.openrunner.com/route-details/18160138` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/12_FF_iti_Paris-Hendaye.pdf` |
| MARSEILLE | 910 km | 9588 m | 64h | 100h | 273h | Athis-Mons / 898 km / — / 62h45 / 98h30 / 269h | `https://www.openrunner.com/route-details/18160576` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/09_FF_iti_Paris-Marseille.pdf` |
| NICE | 1024 km | 10400 m | 80h | 120h | 307h | Montgeron / 1006 km / 10315 m / 79h / 118h30 / 301h | `https://www.openrunner.com/route-details/21226330` | `https://www.audax-club-parisien.com/wp-content/uploads/2025/11/08-FF_iti_Paris-Nice_2025.pdf` |
| PERPIGNAN | 983 km | 11288 m | 78h | 120h | 295h | Savigny-sur-Orge / 968 km / — / 76h30 / 118h / 290h | `https://www.openrunner.com/route-details/18160636` | `https://www.audax-club-parisien.com/wp-content/uploads/2024/03/10_FF_iti_Paris-Perpignan.pdf` |

---

## ÉTAPE 3 : MODIFICATIONS ET FONCTIONNALITÉS INTERACTIVES À DÉVELOPPER

### 1. Annuaire des participants et palmarès individuel
- **Annuaire consultable** de toutes les personnes inscrites dans `Tableau de Bord Flèches.xlsx` (regroupement des participations d'une même personne par clé `(Nom, Prénom, Date de naissance)` pour gérer les éventuels homonymes, et rapprochement avec l'onglet récapitulatif / « Les 20 flèches »).
- **Confidentialité / RGPD** : dans l'affichage standard, masque les données privées sensibles (pas de téléphone Col 12, pas d'adresse de rue Col 13, pas de date de naissance exacte Col 10). Affiche : Nom, Prénom, Club, Code club, Fédération, Commune / Département / Pays, Sexe, Tranche d'âge (`a/b/c/d`) ou âge indicatif, date de première flèche et dernière participation. Ajoute éventuellement un interrupteur « Mode gestionnaire local » désactivé par défaut si l'administrateur local souhaite consulter les coordonnées complètes.
- **Fiche Palmarès individuelle** (modale ou vue dédiée) :
  - Compteurs synthétiques : nombre total d'homologations, nombre de flèches distinctes validées (`X / 20`), distance et D+ cumulés, répartition par formule (Or / Argent / Bronze), statut *La Complète* et liste des flèches manquantes.
  - **Tableau chronologique** complet des flèches validées (n° d'homologation, date, flèche, distance/D+ enregistrés, badge Formule Or / Argent / Bronze, millésime, club).
  - **Grille visuelle des 20 Flèches du participant** mettant en évidence les destinations déjà validées (colorées selon la meilleure formule obtenue) et celles restant à réaliser.

### 2. Recherches multicritères et vue Clubs & Statistiques
- **Filtres combinables en temps réel** : recherche texte insensible aux accents et à la casse (nom, prénom, n° d'homologation, commune), **année / millésime**, **club participant** (avec autocomplétion et code club), **fédération** (`FFCT`, `FFC`, `FFTri`, sans licence / étrangers), **flèche / ville d'arrivée**, **formule** (`Or`, `Argent`, `Bronze`), **sexe**, **tranche d'âge**, **pays / département**, **néophytes** (première flèche cette année-là) et **statut La Complète** (`20/20`).
- **Vue Clubs & Statistiques** croisant les agrégations du journal d'homologations et des tables clubs de l'Excel : classement des clubs par nombre de flèches homologuées, participants uniques, kilomètres cumulés, évolution annuelle et répartition Or / Argent / Bronze, avec export CSV des résultats filtrés.

### 3. Carte interactive des Flèches de France
- Remplace l'image statique par une **carte interactive** réalisée avec **MapLibre GL JS** (dans la lignée de la carte BRM de l'ACP) ou **Leaflet** sur fond **OpenStreetMap / OpenFreeMap**, sans clé API payante.
- Éléments affichés et pilotables par calques/filtres :
  - Point central **Paris** + calque activable pour les **18 communes de Départ Décalé** en Île-de-France (Cormeilles, Tremblay, La Frette, Villiers-le-Bel, Eaubonne, Noisy-le-Roi, Le Pecq, Versailles, Pontault-Combault, Jouy-en-Josas, Gournay-sur-Marne, Montgeron, Massy, Villeneuve-Saint-Georges, Palaiseau, Bièvres, Athis-Mons, Savigny-sur-Orge).
  - Les **20 villes d'arrivée** et les **20 tracés/flèches** depuis Paris (filtrables par distance, par formule, ou **synchronisables avec un participant ou un club sélectionné** pour visualiser ses flèches réalisées vs manquantes).
  - **Popup / fiche latérale au clic** sur une ville ou flèche : distance et D+ officiels 2026 (avec rappel si des valeurs historiques diffèrent), délais Or / Argent / Bronze, départ décalé associé, lien vers la trace **OpenRunner** et la **Feuille de route PDF**, nombre total d'homologations de la base ventilées par Or / Argent / Bronze et bouton pour afficher directement la liste des lauréats de cette flèche.

### 4. Explorateur des Défis et des Formules (Or, Argent, Bronze)
- Fais de la section **Les défis** un module interactif directement alimenté par les données Excel :
  - **Par Formule (Or, Argent, Bronze)** : sélectionne une formule (`Or`, `Argent`, `Bronze`) et/ou une flèche pour **retrouver immédiatement toutes les personnes qui l'ont eue** (avec année, date, club et n° d'homologation).
  - **Le Pionnier** : affiche le premier lauréat connu dans la base pour chaque duo `(Flèche × Formule)` et vérifie dynamiquement si les 5 formules réputées vierges entre 1997 et 2025 (*Briançon Or*, *Hendaye Or*, *Luchon Or*, *Marseille Or*, *Marseille Argent*) le restent dans les données du classeur (notamment en 2026) ou ont désormais un premier titulaire.
  - **La Complète & La Complète express** : affiche la liste complète et filtrable (Femmes / Hommes) des lauréats des **20 flèches** en croisant l'onglet historique « Les 20 flèches » du classeur et les participants atteignant `20` flèches distinctes dans le journal détaillé, tout en mettant en avant *La Complète express* (Guy Lannes 2004, Jacques Marie 2009, et détection automatique de tout éventuel autre cas sur une seule année).
  - **Le Combiné** : conserve la présentation du couplage avec les Relais de France.

---

## ÉTAPE 4 : ARCHITECTURE LOCALE ET LIVRABLES ATTENDUS

- Construis une architecture locale simple, rapide et autonome :
  - Un script Python `scripts/build_data.py` qui parse `Tableau de Bord Flèches.xlsx` et génère des fichiers JSON normalisés dans `public/data/`.
  - Une application web moderne (ex. **React + Vite + Tailwind CSS + MapLibre GL JS / Leaflet**, ou pile conforme aux skills `.opencode` du projet).
- **En fin d'exécution, présente-moi clairement** :
  1. Le décodage vérifié des colonnes initialement sans en-tête (Col 20, 21, 31–34, 45, 46) et le bilan volumétrique complet de tous les onglets/années importés ;
  2. Les commandes exactes pour régénérer les données depuis l'Excel et lancer le site en local.