

# Barber Pole 3D interactif dans le Hero

## Concept
Remplacer le bloc logo actuel (qui rend mal sur fond sombre) par un **barber pole 3D** animé en rotation continue, comme ceux qu'on voit a l'entree des barbershops. Le pole sera interactif : l'utilisateur pourra le faire tourner plus vite en passant la souris dessus ou en cliquant.

## Approche technique

On va utiliser **React Three Fiber** (r3f) pour creer le barber pole en 3D directement dans le navigateur. Le pole sera modélisé avec des formes geometriques simples (cylindres + texture en spirale bleu/blanc/rouge).

### Packages a installer
- `three` (moteur 3D)
- `@react-three/fiber@^8.18` (React wrapper)
- `@react-three/drei@^9.122.0` (helpers : Environment, OrbitControls)

### Nouveau composant : `src/components/BarberPole3D.tsx`
- Un cylindre avec une texture procedurale (shader ou canvas) qui dessine les spirales bleu, blanc, rouge
- Rotation automatique continue sur l'axe Y
- Effet hover : acceleration de la rotation
- Deux spheres/domes metalliques en haut et en bas du pole
- Eclairage doux avec reflets pour un rendu premium
- Taille responsive

### Modifications de `src/pages/Home.tsx`
- Remplacer le bloc logo (le `div` avec `bg-white/10`) par le composant `BarberPole3D`
- Garder le logo en plus petit a cote ou au-dessus du texte hero
- Le pole 3D occupe environ 40-50% de la section hero (a droite ou centre)
- Le texte hero reste a gauche

### Layout Hero revu
```text
+------------------------------------------+
|  [Logo petit]                            |
|                                          |
|  "Ton style,          [  BARBER POLE  ]  |
|   notre expertise."   [    3D rotatif ]  |
|                       [               ]  |
|  [Boutons CTA]                           |
+------------------------------------------+
```

### Details du Barber Pole
- Cylindre principal : blanc avec spirales bleu (`#0099FF`) et rouge (`#FF4433`)
- Caps metalliques (chrome) en haut et en bas
- Rotation auto ~1 tour / 3 secondes
- Au hover : rotation x2, leger glow
- Support en bas (petit socle sombre)

## Fichiers impactes
1. **Nouveau** : `src/components/BarberPole3D.tsx` - composant 3D complet
2. **Modifie** : `src/pages/Home.tsx` - integration dans le hero
3. **Modifie** : `package.json` - ajout des deps three/r3f/drei

