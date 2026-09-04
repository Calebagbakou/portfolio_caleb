# Guide d'utilisation de l'administration

Adresse : **`/admin/login`** (ex. `https://mon-site.com/admin/login`).
L'interface est pensée **mobile d'abord** : tout se fait depuis un téléphone.

---

## Se connecter

1. Ouvrir `/admin/login`.
2. Saisir l'e-mail et le mot de passe administrateur.
3. Première connexion → **Mon compte → Mot de passe** pour le changer.

La session dure 7 jours. « Déconnexion » (en bas du menu) la ferme
immédiatement. Après 10 tentatives ratées, l'adresse IP est bloquée 10 minutes.

---

## Recettes courantes

### Changer un prix
**Boutique → Produits** → ligne du produit → bouton **« n formule(s) »** →
*Modifier* la formule → champ **Prix** → **Enregistrer**.
→ La boutique affiche le nouveau prix immédiatement.

### Ajouter une formule (durée)
Même écran → **＋ Ajouter une formule** → libellé (`18 mois`), prix →
**Enregistrer**.

### Ajouter un produit
**Boutique → Produits → ＋ Nouveau produit** : nom, catégorie, accroche,
description, points forts, image, disponibilité, statut, mise en avant.
Puis ajouter ses formules (sans formule, le produit s'affiche
« Prix sur demande »).

### Ajouter un projet
**Portfolio → Projets → ＋ Nouveau projet** : titre, catégorie, description,
**image principale**, **galerie**, **vidéo** (fichier importé *ou* lien
Vimeo/YouTube), outils, ordre, statut.
*Brouillon* = invisible sur le site ; *Publié* = visible.

### Remplacer une image (ou une vidéo, ou un logo)
**Médias → Images / Vidéos / Logos** → sous la vignette : **Remplacer** →
choisir le nouveau fichier.
→ Toutes les pages qui utilisaient ce fichier affichent le nouveau,
**sans rien modifier ailleurs** (la référence ne change jamais).

### Changer le logo, le favicon ou la photo de profil
**Paramètres → Identité & logos** → champ concerné → *Importer* (ou *Choisir*
un média existant) → **Enregistrer**.

### Modifier un texte du site
**Paramètres** : les réglages sont regroupés (Identité, Hero, À propos, Titres
des sections, Coordonnées, Réseaux sociaux, Boutique, SEO). Modifier, puis
**Enregistrer** le groupe.
Astuce : dans le titre du hero, le texte entre `*astérisques*` est mis en
évidence, comme `DES IDÉES BRUTES, DES RENDUS QUI *CLAQUENT*`.

### Modifier les statistiques
**Statistiques** → *Modifier* → valeur (et suffixe `+`) → **Enregistrer**.
Les compteurs animés du site reprennent ces valeurs.

### Changer l'adresse de la boutique
**Paramètres → Boutique → URL de la boutique**. Tous les boutons
« Boutique » du portfolio pointent vers cette adresse.

### Traiter une commande
**Boutique → Commandes → Détails** : voir les articles, le total, le client.
Régler **Statut de la commande** (En attente / Payée / Traitement / Terminée /
Annulée) et **Statut du paiement**.

> ⚠️ Une commande n'est **jamais** marquée « payée » parce que le client a
> cliqué. Tant qu'aucun prestataire de paiement n'est branché, c'est
> l'administrateur qui confirme après réception réelle de l'argent
> (Mobile Money, virement). Une fois un prestataire connecté, son webhook
> signé fera passer la commande en « payée » automatiquement.

### Lire les messages
**Messages** → *Lire* (marque automatiquement comme lu) → *Archiver*,
*Supprimer* ou *Répondre par e-mail*.

### Modérer les avis
Les avis déposés sur le site arrivent en **Portfolio → Témoignages** avec le
statut *En attente* : cliquer **Publier** pour les afficher.

---

## Bonnes pratiques

* **Ordre d'affichage** : plus le nombre est petit, plus l'élément apparaît tôt.
* **Texte alternatif** des images (Médias → Infos) : utile pour le référencement
  et l'accessibilité.
* **Poids des fichiers** : 10 Mo max par image, 200 Mo par vidéo. Pour les
  vidéos longues, préférer un lien Vimeo/YouTube dans le champ prévu.
* **Suppression** : supprimer un média ne supprime pas les projets qui
  l'utilisaient, ils perdent simplement leur visuel (le dégradé de secours
  reprend la main).
* **Mot de passe** : 10 caractères minimum, avec majuscule, minuscule et
  chiffre. Le changer déconnecte tous les appareils.
