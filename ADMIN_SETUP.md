# Mise en place du backend (Supabase) et du compte admin

Suis ces étapes dans l'ordre. Ça prend environ 10-15 minutes, tout se fait
depuis un navigateur, aucune installation nécessaire.

## 1. Créer le projet Supabase

1. Va sur https://supabase.com → **Start your project** → connecte-toi (GitHub fonctionne).
2. **New project** → choisis un nom (ex. `caleb-creative`), un mot de passe
   de base de données (garde-le de côté, tu n'en auras normalement plus
   besoin après), une région proche de toi.
3. Attends ~2 minutes que le projet soit prêt.

## 2. Exécuter le schéma de base de données

1. Dans le menu de gauche : **SQL Editor** → **New query**.
2. Ouvre le fichier `supabase/schema.sql` (dans le zip que je t'ai donné),
   copie tout son contenu, colle-le dans l'éditeur.
3. Clique **Run**. Tu dois voir "Success. No rows returned" (normal).
4. Vérifie dans **Table Editor** (menu de gauche) que les tables sont bien
   là : `admins`, `settings`, `media`, `categories`, `services`,
   `statistics`, `projects`, `products`, `orders`, `messages`, etc.

## 3. Créer ton compte administrateur

1. Menu de gauche : **Authentication → Users → Add user → Create new user**.
2. Renseigne ton email et un mot de passe solide. Décoche/ignore l'envoi
   d'email de confirmation si l'option apparaît (ou confirme-le
   manuellement ensuite via le bouton "Confirm email" à côté de
   l'utilisateur créé — sinon la connexion échouera).
3. Une fois créé, clique sur l'utilisateur pour copier son **UID**
   (identifiant, format `xxxxxxxx-xxxx-xxxx-...`).
4. Retourne dans **SQL Editor → New query**, colle et exécute :
   ```sql
   insert into admins (id, name) values ('COLLE-L-UID-ICI', 'Caleb');
   ```
   Sans cette étape, ton compte peut se connecter mais le dashboard le
   refusera (c'est voulu : la connexion seule ne suffit pas, il faut aussi
   figurer dans `admins`).

## 4. Créer le bucket de stockage pour les médias

1. Menu de gauche : **Storage → New bucket**.
2. Nom : `media`. Coche **Public bucket** (les images du site doivent être
   accessibles publiquement en lecture — c'est normal, il n'y a rien de
   confidentiel dans des photos de projets/produits).
3. Crée le bucket. Les règles de sécurité (qui peut uploader/supprimer)
   seront branchées quand on construira l'écran de gestion des médias.

## 5. Récupérer les clés API

1. Menu de gauche : **Settings → API**.
2. Copie **Project URL** et la clé **anon public** (⚠️ pas `service_role`,
   qui ne doit jamais apparaître dans du code frontend).

## 6. Connecter le dashboard

Ouvre `admin/assets/config.js` et remplace :
```js
window.SUPABASE_URL = "https://TON-PROJET.supabase.co";
window.SUPABASE_ANON_KEY = "TA_CLE_ANON_PUBLIQUE";
```
par tes vraies valeurs copiées à l'étape 5.

## 7. Tester

1. Ouvre `admin/login.html` (en local, ou une fois déployé).
2. Connecte-toi avec l'email/mot de passe créés à l'étape 3.
3. Tu dois arriver sur le dashboard avec les compteurs à 0 (normal, les
   tables sont vides pour l'instant — les écrans pour y ajouter du contenu
   arrivent dans les prochaines étapes).

Si la connexion échoue avec "Ce compte n'a pas les droits
d'administration", vérifie l'étape 3.4 (l'insertion dans `admins`).

## 8. Déploiement

`admin/` est un dossier statique comme `boutique/` : il peut vivre dans le
même repo GitHub et être servi par GitHub Pages, à
`.../admin/login.html`. Aucune configuration serveur supplémentaire n'est
nécessaire — toute la sécurité repose sur Supabase (RLS) et non sur
l'endroit où les fichiers sont hébergés.

⚠️ Le dashboard n'est pas cité dans la navigation publique du portfolio —
c'est volontaire (il ne doit être connu que de toi). L'URL reste néanmoins
techniquement accessible à qui la devine ; c'est l'authentification qui
protège les données, pas le secret de l'URL.

## Et après ?

Le schéma et l'authentification sont maintenant en place. Prochaine étape :
construire, un par un, les écrans de gestion (Projets, Produits, Médias,
Statistiques, Commandes, Messages, Paramètres) qui remplaceront les liens
« bientôt » du menu — dis-moi par lequel tu veux commencer.
