# Caleb Creative — Portfolio & Boutique administrables

Portfolio + boutique e-commerce **entièrement pilotables depuis une interface
d'administration** (`/admin`) : projets, images, vidéos, logos, textes,
statistiques, produits, formules, prix, commandes, messages et paramètres se
modifient sans jamais toucher au code.

```
Frontend (portfolio + boutique)      →  HTML / CSS / JS (inchangé, hydraté par l'API)
        ↓  fetch /api/public/*
API / Backend                        →  Node.js + Express
        ↓
Base de données                      →  SQLite (fichier, volume persistant)
        ↓
Stockage des médias                  →  disque (ou S3/R2 via STORAGE_DRIVER=s3)
```

---

## Démarrage rapide (local)

```bash
cd server
cp .env.example .env          # renseigner JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm start
```

* Site : <http://localhost:4000/>
* Boutique : <http://localhost:4000/boutique/>
* Administration : <http://localhost:4000/admin/login>
* API publique : <http://localhost:4000/api/public/site>

Au **premier démarrage**, la base est créée et **tout le contenu qui était
codé en dur** (textes, statistiques, 9 services, 13 outils, 5 questions FAQ,
16 projets, 3 produits et leurs formules, photo de profil) est importé
automatiquement. Si `ADMIN_PASSWORD` n'est pas défini, un mot de passe est
généré et affiché **une seule fois** dans la console.

Créer / réinitialiser un administrateur :

```bash
cd server
node src/scripts/create-admin.js caleb@exemple.com "MotDePasseFort123"
```

---

## Ce qui est administrable depuis `/admin`

| Section | Contenu géré |
|---|---|
| **Tableau de bord** | compteurs (projets, produits, commandes, messages), activité récente |
| **Projets** | titre, description, catégorie, image principale, galerie, vidéo (fichier ou Vimeo/YouTube), lien externe, date, outils, statut, ordre, mise en avant |
| **Catégories** | catégories de projets et de la boutique |
| **Compétences / Outils** | nom, groupe, initiales ou **logo importé**, ordre, visibilité |
| **Services** | titre, description, icône SVG ou image |
| **Témoignages** | modération des avis envoyés depuis le site |
| **FAQ** | questions / réponses |
| **Médias** | images, vidéos, logos, fichiers : import, **remplacement sans casser les liens**, suppression, métadonnées |
| **Statistiques** | valeurs des compteurs animés (projets réalisés, clients, outils, années…) |
| **Boutique** | produits, images, galerie, disponibilité, mise en avant, **formules et prix** |
| **Commandes** | statut commande + statut paiement, référence de transaction, notes internes |
| **Clients** | fiches créées automatiquement à la commande |
| **Messages** | messages du formulaire de contact : lire, archiver, supprimer |
| **Paramètres** | nom du site, logo, favicon, photo de profil, textes du hero et des sections, coordonnées, réseaux sociaux, **URL de la boutique**, SEO |

> **Changer un prix** : Admin → Boutique → Produits → *Formules* → modifier → Enregistrer.
> La boutique affiche le nouveau prix immédiatement, sans redéploiement.

---

## Arborescence

```
├── index.html, style.css, script.js   → portfolio (comportements uniquement)
├── assets/
│   ├── site-config.js                 → où se trouve l'API (seul réglage frontend)
│   └── hydrate.js                     → injecte le contenu venant de l'API
├── boutique/                          → boutique (catalogue, panier, commande)
│   └── assets/products.js             → charge le catalogue depuis l'API (+ secours statique)
├── admin/                             → interface d'administration (SPA sans build)
└── server/                            → API Express + SQLite
    ├── src/
    │   ├── index.js                   → application (sécurité, routes, statique)
    │   ├── config.js                  → variables d'environnement
    │   ├── db/{schema.sql, seed.js}   → schéma + import du contenu existant
    │   ├── lib/{crud,storage,payments,util}.js
    │   ├── middleware/{auth,errors}.js
    │   └── routes/{auth,public,content,shop,media,messages,dashboard,payments}.js
    ├── tests/                         → tests API, admin et frontend
    ├── Dockerfile
    └── .env.example
```

Documentation détaillée :
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
[`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) ·
[`docs/GUIDE-ADMIN.md`](docs/GUIDE-ADMIN.md)

---

## Tests

Serveur démarré, puis :

```bash
cd server
npm test          # 53 tests API + 12 tests interface admin + 12 tests frontend
```

Couvre : connexion/déconnexion, protection des routes, CSRF, CRUD projets,
upload et **remplacement** d'image/vidéo/logo, statistiques, paramètres,
produits, formules, prix, commandes (prix recalculés côté serveur),
messages, avis, et récupération des données par le frontend.

---

## Sécurité

* Mots de passe **hachés (bcrypt, coût 12)** — jamais stockés en clair.
* Session par **JWT dans un cookie httpOnly** + **jeton CSRF** (double submit).
* Toutes les routes `/api/admin/*` exigent une session valide.
* Limitation de débit sur la connexion (10 tentatives / 10 min) et sur les
  formulaires publics.
* Uploads : type MIME contrôlé, taille limitée, **nom de fichier régénéré**,
  médias servis avec `nosniff` + CSP restrictive.
* Requêtes SQL **toutes préparées** (aucune concaténation).
* Secrets uniquement côté serveur, via variables d'environnement.
* Le statut « payé » ne peut venir que d'un webhook signé du prestataire de
  paiement ou d'une confirmation manuelle dans l'admin — **jamais** d'un clic
  du client.

---

## Paiement

Aucun prestataire n'est branché et **aucune API de paiement n'est simulée**.
L'architecture est prête : ajouter un adaptateur dans
`server/src/lib/payments.js`, puis définir `PAYMENT_PROVIDER`,
`PAYMENT_PUBLIC_KEY`, `PAYMENT_SECRET_KEY` et `PAYMENT_WEBHOOK_SECRET`.
Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#paiement).

---

## Le site fonctionne toujours sans backend

Si l'API est injoignable (par exemple portfolio publié seul sur GitHub Pages),
le portfolio et la boutique **retombent automatiquement sur leur contenu
statique de secours** : aucune page blanche, aucun script cassé.
