AVANT TOUTE ACTION ET AVANT D'ÉCRIRE LA MOINDRE LIGNE DE CODE :
1. Relis intégralement tous les skills présents dans `.opencode/skills/` (tous les fichiers `SKILL.md` ainsi que leurs sous-dossiers `references/`, `scripts/`, `assets/`) et charge-les via ton outil `skill` — de nouveaux skills ont été ajoutés et doivent impérativement guider ton travail.
2. Inspecte la configuration du projet (`opencode.json` et `.opencode/`) pour lister tous les serveurs et outils **MCP** disponibles (de nouveaux MCP ont également été ajoutés), lis leur documentation/capacités et utilise-les dès qu'ils sont pertinents pour concevoir, inspecter et tester l'application.
3. Relis `CONSIGNES.md` ainsi que l'état actuel du code et des données (`public/data/*.json` issues de `Tableau de Bord Flèches.xlsx`).

---

MISSION : RÉIMAGINER LE GUI (ÉPURÉ, LISIBLE, FIDÈLE À L'ESPRIT ACP) ET FIABILISER 100 % DES FONCTIONNALITÉS

1. REFONTE ESTHÉTIQUE & ERGONOMIQUE (GUI) :
- Réimagine l'interface du site pour qu'elle soit moderne, aérée, claire et épurée, tout en respectant l'identité prestigieuse et cyclotouriste de l'Audax Club Parisien — Flèches de France (palette institutionnelle sobre bleu marine / ardoise, fonds clairs très lisibles, accents Or / Argent / Bronze élégants, typographie hiérarchisée, respiration généreuse entre les blocs).
- Applique strictement toutes les recommandations UI/UX des nouveaux skills `.opencode`.
- Élimine toute surcharge visuelle (« pas trop chargé, épuré ») :
  * Navigation principale claire et structurée en vues dédiées : « Présentation & Règlement », « Carte interactive », « Annuaire & Palmarès », « Défis & Formules », « Clubs & Statistiques ».
  * Divulgation progressive : n'affiche au premier plan que les informations essentielles ; déplace les détails secondaires dans des panneaux latéraux/modales propres, des onglets ou des panneaux de filtres repliables.
  * Tableaux et cartes harmonisés, lisibles sur ordinateur comme sur mobile, sans colonnes tassées ni murs de texte.

2. AUDIT ET CORRECTION DE TOUTES LES FONCTIONNALITÉS :
Passe en revue chaque module existant, corrige tous les bugs et vérifie que chaque interaction fonctionne parfaitement :
- **Carte interactive des 20 Flèches** :
  * Assure un affichage immédiat et fiable de la France (import CSS cartographique vérifié, hauteur explicite du conteneur, appel à `invalidateSize()` / `resize()` au montage et au changement d'onglet, fond de tuiles OpenStreetMap/OpenFreeMap fonctionnel + contour GeoJSON local de la France en repli hors-ligne).
  * Affiche Paris, les 20 villes d'arrivée, les 18 communes de Départ Décalé (calque activable) et les tracés des flèches.
  * Vérifie les filtres sur la carte, la synchronisation avec un participant ou un club sélectionné (flèches réalisées vs manquantes) et les popups/fiches au clic (distance et D+ officiels 2026, délais Or/Argent/Bronze, liens OpenRunner et Feuille de route PDF, compteurs d'homologations et accès aux lauréats).
- **Annuaire des participants & Fiche Palmarès** :
  * Vue principale épurée (Nom & Prénom, Club, Ville/Pays, progression `X/20`, badges Or/Argent/Bronze, bouton « Voir le palmarès ») avec pagination fluide (ex. 25 lignes par page) et protection RGPD par défaut des données sensibles.
  * Au clic, ouverture d'une fiche Palmarès complète et lisible : compteurs synthétiques, grille visuelle des 20 Flèches (validées vs restantes) et historique chronologique détaillé.
- **Recherche multicritères & Clubs / Statistiques** :
  * Barre de recherche instantanée insensible aux accents + filtres principaux visibles et panneau « Filtres avancés » repliable (Année, Club, Fédération, Flèche, Formule, Sexe, Tranche d'âge, Néophytes, statut *La Complète*), export CSV fonctionnel, et classement/statistiques des clubs exacts.
- **Explorateur des Défis & des Formules (Or, Argent, Bronze)** :
  * Sélection fonctionnelle d'une formule (`Or`, `Argent`, `Bronze`) et/ou d'une flèche pour retrouver nominativement tous ceux qui l'ont obtenue.
  * Onglets/vues opérationnels pour *Le Pionnier* (premier titulaire par duo Flèche × Formule + vérification dynamique des 5 formules historiquement vierges), *La Complète* & *La Complète express* (Femmes / Hommes) et *Le Combiné*.
- **Contenus éditoriaux & Référentiel officiel ACP** :
  * Présentation du règlement, des tarifs, du lien vers le calculateur v2.3 et du tableau officiel complet des 20 Flèches présenté de façon claire et scannable.

3. VÉRIFICATION TECHNIQUE AVANT DE TERMINER :
- Vérifie que le build et le typage passent sans erreur.
- Lance le serveur local et teste chaque onglet, filtre, popup de carte et fiche palmarès (en utilisant tes outils MCP de navigation/inspection s'ils sont disponibles) pour garantir zéro erreur console, zéro lien ou asset cassé et une mise en page irréprochable. 