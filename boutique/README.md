# Boutique Caleb Creative

Boutique e-commerce statique (HTML / CSS / JS, sans framework, sans backend), pensée pour être indépendante du portfolio.

## Structure

```
boutique/
  index.html        → accueil boutique
  catalogue.html     → liste des produits + filtres par catégorie
  produit.html        → fiche produit dynamique (?id=nom-du-produit)
  panier.html          → panier (stocké dans le navigateur du visiteur)
  commande.html         → informations client + récapitulatif
  confirmation.html      → référence de commande + lien WhatsApp pré-rempli
  assets/
    products.js    → catalogue des produits et formules (à éditer pour ajouter/modifier)
    cart.js         → logique du panier (localStorage)
    shop.css         → styles partagés
    shop.js           → comportements partagés (menu, animations, toasts)
```

## Ajouter ou modifier un produit

Tout se passe dans `assets/products.js`. Chaque produit est un objet dans le
tableau `CALEB_SHOP_PRODUCTS` :

```js
{
  id: "mon-produit",
  name: "Mon Produit",
  category: "ia", // ou "logiciels", ou une nouvelle catégorie
  plans: [
    { id: "1mois", label: "1 mois", price: 5000 },
  ],
}
```

Un prix à `0` affiche automatiquement « Prix sur demande » — c'est le cas
actuellement pour Gemini Pro, CapCut Pro et Canva Pro : les tarifs indiqués
dans la demande initiale n'étaient pas fournis, remplace simplement les `0`
par les prix réels en FCFA.

## ⚠️ Important : il n'y a pas de vrai système de paiement

Cette boutique **ne traite aucun paiement**. Il n'y a pas de backend, pas de
base de données, pas d'intégration Stripe/PayPal/Kkiapay/FedaPay. C'est un
choix assumé pour rester compatible avec un hébergement 100 % statique
(GitHub Pages) sans jamais simuler un paiement qui n'existe pas réellement.

Le parcours actuel est donc :
1. Le visiteur ajoute des produits au panier (stocké localement dans son
   navigateur, `localStorage`).
2. Il renseigne ses coordonnées à l'étape « Commande ».
3. Une référence de commande est générée et une page de confirmation
   s'affiche avec un bouton **« Finaliser sur WhatsApp »**, qui pré-remplit
   un message avec le détail de la commande.
4. C'est toi (Caleb) qui donnes ensuite les coordonnées de paiement
   (Mobile Money / virement) et confirmes la commande manuellement, comme
   déjà décrit dans la FAQ du portfolio.

Si tu veux un jour un vrai paiement en ligne automatisé, il faudra :
- un backend (ou une fonction serverless) pour créer les transactions,
- un compte marchand chez un prestataire de paiement compatible avec le
  Bénin (ex. Kkiapay, FedaPay, ou Mobile Money via API),
- une base de données pour stocker les commandes côté serveur (le
  `localStorage` actuel n'est visible que par le navigateur du client,
  ce n'est pas une base de données partagée).

## Déploiement

### Option A — même repo que le portfolio (par défaut)
Aucune configuration nécessaire : la boutique est accessible directement à
`.../boutique/index.html` une fois le repo publié sur GitHub Pages. C'est
la configuration actuelle (le bouton « Boutique » du portfolio pointe vers
`./boutique/index.html`).

### Option B — déploiement séparé (sous-domaine ou repo dédié)
1. Copie le dossier `boutique/` (avec son contenu) dans un nouveau repo, ou
   dans un dossier servi séparément (ex. `boutique.tonsite.com`).
2. Dans `../script.js` (le portfolio), remplace la valeur de `SHOP_URL` par
   la nouvelle adresse complète, par exemple :
   ```js
   const SHOP_URL = 'https://boutique.calebcreative.com/';
   ```
3. Republie le portfolio.

Aucune autre modification n'est nécessaire : tous les liens internes de la
boutique (`index.html`, `catalogue.html`, etc.) sont relatifs, donc elle
fonctionne à l'identique quel que soit son emplacement.
