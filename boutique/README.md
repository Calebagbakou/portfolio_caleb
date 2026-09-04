# Boutique Caleb Creative

Boutique e-commerce (HTML / CSS / JS, sans framework) **alimentée par l'API
d'administration**. Les produits, formules et prix ne sont plus écrits dans le
code : ils viennent de la base de données et se modifient depuis `/admin`.

## Structure

```
boutique/
  index.html        → accueil (produits mis en avant, catégories)
  catalogue.html     → liste des produits + filtres par catégorie
  produit.html        → fiche produit (?id=slug-du-produit)
  panier.html          → panier (navigateur du visiteur)
  commande.html         → coordonnées client → commande enregistrée en base
  confirmation.html      → référence de commande + lien WhatsApp pré-rempli
  assets/
    products.js    → charge le catalogue depuis /api/public/shop (+ secours statique)
    cart.js         → logique du panier (localStorage)
    shop.css         → styles partagés
    shop.js           → comportements partagés (menu, animations, toasts)
```

## Ajouter ou modifier un produit / un prix

**Ne plus toucher au code.** Tout se fait dans l'administration :

* `/admin` → **Boutique → Produits** → ＋ Nouveau produit / Modifier
* `/admin` → **Boutique → Produits** → bouton **« n formule(s) »** pour les
  durées et les **prix** (ex. Gemini Pro : 4 mois, 12 mois, 18 mois).

Le tableau `CALEB_SHOP_FALLBACK_PRODUCTS` de `assets/products.js` n'est qu'un
**contenu de secours**, utilisé uniquement si l'API est injoignable (boutique
publiée seule, sans backend). Un prix à `0` affiche « Prix sur demande ».

## Commandes et paiement

* À la validation, la commande est envoyée à `POST /api/public/orders` :
  elle est **enregistrée en base** avec des **prix recalculés par le serveur**
  (le panier du navigateur ne peut donc pas être trafiqué).
* Statut initial : commande *en attente*, paiement *non payé*.
* Le client est ensuite redirigé vers la confirmation avec sa référence et un
  bouton **WhatsApp** pré-rempli.
* **Aucun paiement n'est simulé.** Le passage en « payée » se fait soit
  manuellement dans `/admin → Boutique → Commandes`, soit automatiquement via
  le webhook signé d'un prestataire réel une fois celui-ci configuré
  (voir `docs/ARCHITECTURE.md`, section Paiement).
* Si l'API n'est pas joignable, l'ancien parcours 100 % local (référence
  générée côté navigateur + WhatsApp) prend le relais.

## Déploiement

### Option A — servie par le backend (par défaut)
Accessible à `/boutique/` sur le même domaine que l'API : rien à configurer.

### Option B — publiée séparément (sous-domaine ou dépôt dédié)
1. Copier le dossier `boutique/` **et** `assets/site-config.js` (le fichier est
   chargé via `../assets/site-config.js`).
2. Y renseigner `REMOTE_API_BASE` avec l'URL du backend, et ajouter l'origine
   de la boutique dans `CORS_ORIGINS` côté serveur.
3. Dans `/admin → Paramètres → Boutique → URL de la boutique`, saisir la
   nouvelle adresse : les boutons « Boutique » du portfolio suivent
   automatiquement.
