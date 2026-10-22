# Fluvia — fichiers de travail

Le site en ligne (`../index.html`) est **généré** à partir de ces fichiers. Pour modifier le jeu, on modifie ici, puis on régénère.

## Contenu
- `src/style.css` : toute la mise en forme (couleurs, tailles, animations CSS).
- `src/body.html` : la structure de la page et tous les textes fixes (règles, titres, boutons).
- `src/app.js` : la logique du jeu (dessin des cartes et des boosters, ouverture, effets, tirage, album, duel).
- `site/data/cards.json` : les 128 cartes (122 rivières + 6 phénomènes), déjà préparées à partir des données du concours.
- `build/assemble.py` : assemble les trois fichiers de `src/` et les données en un seul `index.html`.
- `build/prep_cards.py` : script qui a produit `cards.json` à partir des données préparées du projet 1 « Les rivières du Grand Est » (non incluses ici ; inutile de le relancer pour modifier le jeu).

## Régénérer et mettre en ligne
```
python3 sources/build/assemble.py --publish
git add -A && git commit -m "…" && git push
```
`--publish` écrit la nouvelle version à la racine du dépôt ; GitHub Pages la met en ligne environ une minute après le push.
Sans `--publish`, le script produit seulement `sources/dist/index.html` (version autonome, à tester en double-cliquant) et `sources/site/index.html` (version qui charge `data/cards.json`).

## Repères
- Taux de tirage : constante `SLOTS` et fonction `rollPack` dans `app.js` (coup de pouce aux cartes manquantes : variable `boost`).
- Seuils de rareté : `prep_cards.py` (débit médian de la plus grande station).
- La collection est enregistrée dans le navigateur sous la clé `rivieres-tcg-v1` : ne pas la changer, sinon les joueurs perdent leur album.
- Test automatisé : ajouter `?test` à l'adresse expose `window.__tcg` (ouvrir un booster, tirer des cartes…).
