# Déploiement

Rappel : **GitHub Pages ne sait servir que des fichiers statiques**. Il ne peut
donc pas héberger l'API, la base de données ni les uploads. Deux scénarios
réalistes, au choix.

---

## Scénario A — tout au même endroit (recommandé, le plus simple)

Un seul service héberge l'API **et** le site (portfolio + boutique + admin).

```
https://caleb-creative.onrender.com/            → portfolio
https://caleb-creative.onrender.com/boutique/   → boutique
https://caleb-creative.onrender.com/admin       → administration
https://caleb-creative.onrender.com/api/…       → API
```

### Render (exemple, `render.yaml` fourni)

1. Pousser le dépôt sur GitHub.
2. Render → **New +** → *Blueprint* → sélectionner le dépôt (il lit `render.yaml`).
3. Renseigner les variables non synchronisées :
   * `ADMIN_EMAIL`, `ADMIN_PASSWORD` (première connexion),
   * `CORS_ORIGINS` seulement si un autre domaine appelle l'API.
4. Déployer. Le **disque persistant** monté sur `/var/data` contient la base
   (`caleb.db`) et les médias (`/var/data/uploads`) : ils survivent aux
   redéploiements.
5. Ouvrir `/admin/login`, se connecter, changer le mot de passe.

Équivalents : Railway, Fly.io, Koyeb, un VPS avec Docker… Points de vigilance
identiques : **un volume persistant** et les variables d'environnement.

### Docker (VPS, Coolify, Dokku…)

```bash
docker build -t caleb-api -f server/Dockerfile .
docker run -d --name caleb \
  -p 4000:4000 \
  -e JWT_SECRET="$(openssl rand -hex 48)" \
  -e ADMIN_EMAIL=caleb@exemple.com -e ADMIN_PASSWORD='MotDePasseFort123' \
  -e COOKIE_SECURE=true \
  -v caleb_data:/data -v caleb_uploads:/uploads \
  caleb-api
```

Placer un reverse proxy HTTPS devant (Caddy, Nginx, Traefik).

---

## Scénario B — portfolio sur GitHub Pages, API ailleurs

Le site reste publié par GitHub Pages ; seules les **données** viennent de
l'API hébergée sur Render/Railway/VPS.

1. Déployer le backend (scénario A) — noter son URL, ex.
   `https://caleb-creative.onrender.com`.
2. Sur le backend, autoriser l'origine du site :

   ```
   CORS_ORIGINS=https://<utilisateur>.github.io
   COOKIE_SAMESITE=none
   COOKIE_SECURE=true
   ```

3. Dans `assets/site-config.js`, renseigner :

   ```js
   const REMOTE_API_BASE = 'https://caleb-creative.onrender.com';
   ```

4. Committer, GitHub Pages se met à jour. Le portfolio et la boutique
   consomment l'API distante ; les médias sont servis par le backend.
5. L'administration reste sur le domaine du backend :
   `https://caleb-creative.onrender.com/admin`.

> Si le backend est éteint ou injoignable, le site **continue de fonctionner**
> avec son contenu statique de secours.

---

## Scénario C — boutique déployée séparément

La boutique est autonome (liens internes relatifs) :

1. Publier le dossier `boutique/` où l'on veut (sous-domaine, autre dépôt…)
   en gardant `assets/site-config.js` accessible (ou en y recopiant le fichier
   et en ajustant le chemin `../assets/site-config.js`).
2. Dans **Admin → Paramètres → Boutique → URL de la boutique**, saisir la
   nouvelle adresse : tous les boutons « Boutique » du portfolio la
   reprennent immédiatement. Aucun redéploiement du portfolio n'est nécessaire.

---

## Variables d'environnement

Voir `server/.env.example`. Les indispensables en production :

| Variable | Rôle |
|---|---|
| `NODE_ENV=production` | active les protections de production |
| `JWT_SECRET` | **obligatoire** — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `COOKIE_SECURE=true` | cookies envoyés uniquement en HTTPS |
| `COOKIE_SAMESITE` | `lax` (même domaine) ou `none` (admin/API sur des domaines différents) |
| `DATABASE_FILE` | chemin de la base sur le volume persistant |
| `UPLOAD_DIR` | dossier des médias sur le volume persistant |
| `CORS_ORIGINS` | origines autorisées, séparées par des virgules |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | compte créé au premier démarrage |
| `STORAGE_DRIVER` | `local` (défaut) ou `s3` |
| `PAYMENT_*` | à remplir seulement lorsqu'un prestataire réel est branché |

---

## Stockage objet (optionnel, pour beaucoup de vidéos)

```bash
cd server && npm i @aws-sdk/client-s3
```

```
STORAGE_DRIVER=s3
S3_BUCKET=caleb-medias
S3_REGION=auto
S3_ENDPOINT=https://<compte>.r2.cloudflarestorage.com   # R2 / Spaces / MinIO
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_PUBLIC_BASE_URL=https://medias.calebcreative.com
```

Les médias déjà importés en local restent servis en local : le driver est
enregistré **par fichier** (`media.storage`), la bascule est donc progressive
et sans rupture.

---

## Sauvegardes

```bash
# base de données (SQLite en mode WAL : utiliser .backup)
sqlite3 /var/data/caleb.db ".backup '/var/data/backup-$(date +%F).db'"

# médias
tar czf /var/data/uploads-$(date +%F).tar.gz -C /var/data uploads
```

À planifier (cron / tâche de l'hébergeur) et à copier hors du serveur.

---

## Mise en production — check-list

- [ ] `JWT_SECRET` généré aléatoirement et gardé secret
- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`, site en HTTPS
- [ ] mot de passe administrateur changé après la première connexion
- [ ] volume persistant monté pour la base **et** les uploads
- [ ] `CORS_ORIGINS` limité aux domaines réellement utilisés
- [ ] `/api/health` répond `{"ok":true}`
- [ ] sauvegardes planifiées
- [ ] `.env` **jamais** committé
