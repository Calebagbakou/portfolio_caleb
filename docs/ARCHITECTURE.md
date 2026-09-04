# Architecture

## 1. Analyse du projet existant (point de départ)

| Élément | Constat |
|---|---|
| Stack | HTML / CSS / JavaScript **sans framework ni build** (pas de npm, pas de bundler) |
| Déploiement | dépôt GitHub publié en site statique (workflow Jekyll présent) |
| Portfolio | `index.html` (~520 lignes) + `style.css` + `script.js` |
| Boutique | `boutique/` : 6 pages statiques + `products.js` (catalogue en dur), panier en `localStorage` |
| Contenu codé en dur | textes du hero, à propos, 9 services, 13 outils, 5 FAQ, 4 statistiques, 16 projets (dégradés + 1 lien Vimeo), coordonnées, réseaux sociaux, 3 produits et 5 formules/prix, URL de la boutique |
| Médias | `assets/profile.jpg`, `assets/profile.png` — tout le reste : dégradés CSS |
| Fonctionnalités | thème clair/sombre, menu plein écran, machine à écrire, compteurs animés, lightbox, drag-scroll, FAQ accordéon, panier localStorage, commande → WhatsApp |

**Conséquence :** inutile de réécrire l'application. Le choix retenu est une
**intégration progressive** : on garde le HTML/CSS/JS existant (donc tous les
comportements et le design), et on remplace uniquement les *données* par un
appel à l'API. Chaque section conserve son contenu statique comme **secours**.

## 2. Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Backend | **Node.js + Express** | même langage que le frontend, zéro build, démarrage instantané, hébergement simple |
| Base de données | **SQLite** (`better-sqlite3`) | volumétrie d'un portfolio, sauvegarde = 1 fichier, zéro service à gérer ; migration vers Postgres possible (couche d'accès isolée) |
| Médias | **stockage fichier** (disque/volume) derrière une interface `storage.js` | la base ne stocke jamais les binaires ; passage à S3/R2 par variable d'environnement |
| Admin | **SPA en JavaScript natif** servie par le backend | cohérent avec le reste du projet, aucun build, chargement instantané sur mobile |
| Auth | **JWT en cookie httpOnly + CSRF double-submit** | pas de token accessible au JS, protection XSS/CSRF |
| Validation | **zod** côté routes publiques + typage strict des champs CRUD | rejette toute donnée mal formée |

## 3. Schéma d'ensemble

```
┌────────────────────────────────────────────────────────────┐
│ NAVIGATEUR                                                 │
│  portfolio (index.html)   boutique (/boutique)   /admin    │
└─────────┬─────────────────────┬────────────────────┬───────┘
          │ GET /api/public/*   │ GET /api/public/shop│ /api/admin/* (session)
          ▼                     ▼                    ▼
┌────────────────────────────────────────────────────────────┐
│ EXPRESS                                                    │
│  helmet · CORS · rate-limit · cookies · validation         │
│  /api/auth  /api/public  /api/admin  /api/payments  /media │
└─────────┬──────────────────────────────┬───────────────────┘
          ▼                              ▼
   SQLite (caleb.db)             Stockage médias
   16 tables                     local:/uploads ou S3
```

## 4. Modèle de données

```
admins                              media ─────────┐
categories (scope: project|product) │              │
projects ──< project_media >────────┘  services ───┤ (media_id)
   └─ category_id                      skills ─────┤
products ──< product_media >───────────┘           │
   ├─ category_id                      testimonials┘
   └──< product_variants (label, price, old_price)   ← les PRIX vivent ici
orders ──< order_items                  stats
   ├─ customer_id → customers           faqs
   └──< payment_intents                 settings (clé/valeur typée)
messages                                activity_log
```

Principes :

* **Les prix ne sont jamais dans le frontend** : `product_variants.price`.
* **Les fichiers ne sont jamais dans la base** : `media` conserve
  `storage`, `storage_key`, `mime`, `size`, `alt`… et le frontend référence
  toujours `/media/:id`.
* `settings` est un magasin clé/valeur **typé** (`text`, `textarea`, `media`,
  `json`, `url`…), ce qui permet à l'admin de générer les formulaires
  automatiquement : ajouter un réglage ne demande aucun code d'interface.

## 5. Médias : remplacer un fichier sans rien casser

L'URL publique d'un média est **`/media/:id`** — jamais le nom du fichier.

```
Admin → Remplacer          media.id = 12 (inchangé)
   ancien fichier  ✗       storage_key : a1b2… .jpg  →  f9e8… .webp
   nouveau fichier ✓       updated_at  : mis à jour  →  /media/12?v=… (cache cassé)
```

Tous les projets, produits, logos ou réglages qui pointaient sur le média 12
affichent immédiatement le nouveau fichier. L'ancien binaire est supprimé du
stockage. Le même mécanisme fonctionne à l'identique en S3 (redirection 302
vers l'URL publique de l'objet).

Contrôles à l'upload : type MIME sur liste blanche (JPEG, PNG, WebP, GIF,
AVIF, SVG, ICO / MP4, WebM, MOV, MKV / PDF, ZIP, TXT), taille maximale par
type (10 Mo image, 200 Mo vidéo, 20 Mo fichier), **nom de fichier régénéré**
(aléatoire + extension déduite du MIME), en-têtes `nosniff` et CSP `sandbox`
au service du fichier.

Pour de très grosses vidéos, activer `STORAGE_DRIVER=s3` : les fichiers ne
transitent plus par le disque du serveur et sont servis directement par le CDN
du stockage objet (l'ajout d'URL pré-signées d'upload direct est possible sans
changer le modèle de données).

## 6. API

### Public (lecture, sans authentification)

| Route | Contenu |
|---|---|
| `GET /api/public/site` | paramètres, statistiques, services, compétences, FAQ, témoignages publiés, catégories |
| `GET /api/public/projects` | projets publiés (image, galerie, vidéo, outils…) |
| `GET /api/public/shop` | produits publiés + formules + prix + catégories + réglages boutique |
| `POST /api/public/messages` | formulaire de contact (limité en débit, honeypot) |
| `POST /api/public/testimonials` | dépôt d'un avis → statut « en attente » |
| `POST /api/public/orders` | création de commande, **prix recalculés côté serveur** |
| `GET /api/public/orders/:ref` | suivi d'une commande |

### Administration (session obligatoire)

`/api/admin/dashboard`, `/api/admin/projects`, `/categories`, `/services`,
`/skills`, `/testimonials`, `/faqs`, `/stats`, `/settings`, `/media`,
`/messages`, `/shop/products`, `/shop/products/:id/variants`,
`/shop/variants/:id`, `/shop/orders`, `/shop/customers`
— toutes en `GET / POST / PUT / DELETE` (+ `POST /reorder`).

### Authentification

`POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` ·
`POST /api/auth/change-password` · `PUT /api/auth/profile`

## 7. Paiement

Aucune fausse API. `server/src/lib/payments.js` définit un registre
d'adaptateurs vide ; tant que `PAYMENT_PROVIDER` n'est pas défini,
`POST /api/payments/intents` répond **501** avec un message explicite et la
commande reste « en attente ».

Pour brancher un prestataire (Kkiapay, FedaPay, Stripe…) :

```js
// server/src/lib/providers/kkiapay.js
module.exports = {
  async createIntent({ amount, currency, reference, customer, secretKey }) { /* appel réel */ },
  verifyWebhook(rawBody, headers, webhookSecret) { /* vérification de signature */ },
  parseWebhook(rawBody, headers) {
    return { reference, transactionId, amount, status: 'succeeded' | 'failed' | 'pending', raw };
  },
};
```

puis l'enregistrer dans `providers` et renseigner les variables `PAYMENT_*`.
Le webhook `POST /api/payments/webhook/:provider` est la **seule** voie
automatique pour passer une commande en « payée » ; l'autre voie est la
confirmation manuelle de l'administrateur.

## 8. Frontend dynamique

1. `assets/site-config.js` détermine l'adresse de l'API (même origine par
   défaut, `REMOTE_API_BASE` si le site est hébergé ailleurs).
2. `assets/hydrate.js` récupère `/api/public/site` et `/api/public/projects`
   et remplace : marque, logo, favicon, hero, photo, statistiques, à propos,
   services, projets (+ filtres et chapitres), outils, FAQ, contacts, réseaux
   sociaux, témoignages, textes de sections, pied de page, lien boutique.
3. `script.js` n'exécute ses comportements (machine à écrire, compteurs,
   lightbox, révélations, accordéon…) **qu'après** l'hydratation, pour
   s'appliquer au contenu réel.
4. Boutique : `boutique/assets/products.js` charge le catalogue via
   `shopReady()`, les pages attendent cette promesse.
5. **Repli** : toute erreur réseau conserve le contenu statique et
   `document.documentElement.dataset.hydrated = 'static'`.

## 9. Sécurité — récapitulatif

| Risque | Mesure |
|---|---|
| Vol de session (XSS) | cookie `httpOnly`, `SameSite`, `Secure` en production |
| CSRF | jeton double-submit obligatoire sur toute requête mutante par cookie |
| Force brute | 10 tentatives / 10 min par IP sur `/api/auth/login` |
| Énumération de comptes | message unique + comparaison bcrypt systématique |
| Injection SQL | requêtes préparées partout, noms de tables jamais dynamiques |
| Upload malveillant | liste blanche MIME, taille max, nom régénéré, `nosniff`, CSP `sandbox` |
| Fuite de secrets | `.env` ignoré par Git, aucune clé secrète exposée au frontend |
| Spam | limitation de débit + honeypot sur contact/avis, avis modérés |
| Falsification de prix | total recalculé côté serveur à partir de la base |
| Session compromise | `token_version` : changer de mot de passe invalide tous les jetons |
