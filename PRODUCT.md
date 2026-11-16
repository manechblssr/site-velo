# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Participants aux Flèches de France (« Fléchards »)** — cyclotouristes et randonneurs qui consultent leur palmarès, cherchent un club, une flèche ou une formule, et vérifient les délais officiels. Usage ponctuel de consultation, sur ordinateur comme sur mobile.
- **Organisation de l'Audax Club Parisien (mode gestionnaire local)** — besoin de consulter les coordonnées complètes (RGPD) et de vérifier les données du classeur.
- **Visiteur curieux** — découvre les Flèches de France : présentation, règlement, tarifs, défis.

## Product Purpose

Site web **100 % en local** qui reproduit fidèlement la page officielle « Flèches de France » de l'Audax Club Parisien et la fait vivre : annuaire complet des participants avec fiche palmarès, recherche multicritères, carte interactive des 20 Flèches, explorateur des Défis et des Formules, vue Clubs & Statistiques. Succès : chaque onglet, filtre, popup et fiche fonctionne sans erreur console, sans asset cassé, sans accès réseau obligatoire, avec un build et un typage propres.

## Positioning

Le seul annuaire intégral et autonome des Flèches de France — 17 094 homologations, 3 813 participants, 455 clubs, éditions 1997-2026 — consultable hors-ligne, croisant le journal d'homologations détaillé avec les tableaux officiels du club, et restituable flèche par flèche, formule par formule, club par club.

## Operating Context

- **Données** : `Tableau de Bord Flèches.xlsx` → `scripts/build_data.py` → JSON dans `public/data/` (régénération manuelle, commande documentée).
- **Application** : React 19 + Vite 7 + Tailwind CSS v4 + Leaflet, routeur par hash (`#/presentation|carte|annuaire|defis|clubs`), sans backend.
- **Carte** : tuiles OpenFreeMap/OSM avec chaîne de repli et contour GeoJSON local de la France hors-ligne.
- **Langue** : français par défaut ; libellés d'interface traduisibles en anglais, textes éditoriaux officiels conservés en français.
- **Ressources officielles ACP** hébergées dans `public/assets/` (logos, médaille, illustration, règlement PDF, calculateur).

## Capabilities and Constraints

- Cinq vues : **Présentation & Règlement**, **Carte interactive**, **Annuaire & Palmarès**, **Défis & Formules**, **Clubs & Statistiques**.
- Annuaire : pagination 25 lignes, recherche instantanée insensible aux accents, filtres principaux + « Filtres avancés » repliables, export CSV, fiche palmarès (compteurs, grille des 20 Flèches, historique chronologique).
- Carte : Paris, 20 villes d'arrivée, 18 communes de Départ Décalé (calque activable), tracés, popups avec délais officiels 2026, OpenRunner, PDF, compteurs d'homologations, lauréats ; synchronisation avec un participant ou un club sélectionné.
- Défis : sélection Flèche × Formule, Le Pionnier (vérification dynamique des 5 formules vierges), La Complète / express (F/H), Le Combiné.
- Contraintes : aucune clé API, aucune dépendance réseau obligatoire, RGPD par défaut (pas de téléphone, adresse rue ni date de naissance exacte), build sans erreur ni avertissement.
- Contrainte d'identité : le site reste fidèle à l'esprit institutionnel et sobre de l'ACP (cf. Brand Commitments).

## Brand Commitments

- **Identité Audax Club Parisien** : logo ACP, palette institutionnelle sobre (bleu marine / ardoise, fonds clairs, accents sémantiques Or / Argent / Bronze), ton officiel et prestigieux.
- **Contenus officiels** : slogan, 5 encarts, tableau des 20 Flèches 2026, tarifs, défis, règlement et contacts tels que publiés par le club — le wording français officiel n'est pas réécrit.
- **Lien d'évitement, accessibilité et structure de navigation** imposés par `CONSIGNES.md`.
- La refonte visuelle doit rester « épurée, lisible, aérée » — exigence explicite du commanditaire.

## Evidence on Hand

- `Tableau de Bord Flèches.xlsx` (source de vérité), `rapport/audit_xlsx.txt` (audit + décodage des colonnes 20, 21, 31-34, 45, 46).
- `public/data/*.json` générés (17 094 × 46 homologations, 3 813 participants, 455 clubs, 1997-2026), `public/data/france.geojson`.
- 6 médias officiels dans `public/assets/`, tableau officiel des 20 Flèches 2026 dans `CONSIGNES.md`.
- Absences à ne pas fabriquer : aucune photographie supplémentaire, aucun témoignage, aucun chiffre hors classeur ; l'accès aux tuiles cartographiques n'est pas garanti hors-ligne (d'où le repli GeoJSON).

## Product Principles

1. **Fidélité avant esthétique** : le contenu officiel ACP prime ; le habillage ne réécrit jamais une donnée.
2. **Autonomie totale** : le site fonctionne sans réseau, sans clé, sans backend.
3. **Divulgation progressive** : l'essentiel au premier plan, les détails en panneaux, onglets ou filtres repliables.
4. **Lisibilité et respect** : contraste AA, cibles tactiles 44 px, données sensibles masquées par défaut (RGPD).
5. **Zéro erreur** : build, console et interactions vérifiés avant livraison.

## Accessibility & Inclusion

- Contraste WCAG AA (4.5:1 texte courant, 3:1 grands textes et bordures de composants), navigation clavier avec anneau de focus visible, lien d'évitement « Aller au contenu ».
- `prefers-reduced-motion` respecté ; cibles tactiles ≥ 44 px sur mobile ; tableaux lisibles et défilables sur petite largeur.
- Protection RGPD par défaut ; « Mode gestionnaire local » explicite et désactivé.
