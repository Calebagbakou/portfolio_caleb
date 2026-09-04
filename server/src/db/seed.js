'use strict';
/**
 * SEED — reprend TOUT le contenu qui était codé en dur dans index.html,
 * script.js et boutique/assets/products.js et le place en base de données.
 * Exécuté automatiquement au premier démarrage (base vide).
 *   node src/db/seed.js          → seed si nécessaire
 *   node src/db/seed.js --force  → réinitialise le contenu (garde les admins)
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const { db } = require('./index');
const { slugify } = require('../lib/util');

/* --------------------------- PARAMÈTRES ----------------------------- */
const SETTINGS = [
  // group, key, value, type, label, help
  ['identite', 'site_name', 'Caleb Creative', 'text', 'Nom du site'],
  ['identite', 'owner_name', 'Caleb Jesugnon AGBAKOU', 'text', 'Nom complet'],
  ['identite', 'brand_first', 'Caleb', 'text', 'Prénom affiché (header)'],
  ['identite', 'brand_last', 'AGBAKOU', 'text', 'Nom affiché (header)'],
  ['identite', 'brand_mark', 'CA', 'text', 'Initiales du logo', 'Utilisé si aucun logo image n’est défini'],
  ['identite', 'brand_sub', 'CALEB CREATIVE', 'text', 'Sous-titre de marque'],
  ['identite', 'logo', '', 'media', 'Logo principal', 'Remplace les initiales dans le header'],
  ['identite', 'favicon', '', 'media', 'Favicon', 'Icône affichée dans l’onglet du navigateur'],
  ['identite', 'profile_photo', '', 'media', 'Photo de profil (hero)'],

  ['hero', 'hero_badge', 'CALEB CREATIVE', 'text', 'Badge du hero'],
  ['hero', 'hero_title', 'DES IDÉES BRUTES, DES RENDUS QUI *CLAQUENT*', 'text', 'Titre animé', 'Le texte entre *astérisques* est mis en évidence'],
  ['hero', 'hero_subtitle', "Le visuel fait tout. Ne laisse plus tes idées au brouillon. Laisse l'IA et le design exploser ton potentiel.", 'textarea', 'Sous-titre du hero'],
  ['hero', 'hero_cta_primary_label', 'Voir mes réalisations', 'text', 'Bouton principal — texte'],
  ['hero', 'hero_cta_primary_link', '#portfolio', 'text', 'Bouton principal — lien'],
  ['hero', 'hero_cta_secondary_label', 'Accéder à la boutique', 'text', 'Bouton secondaire — texte'],

  ['about', 'about_eyebrow', 'À PROPOS', 'text', 'Sur-titre « À propos »'],
  ['about', 'about_title', "Passionné par la création visuelle, augmenté par l'intelligence artificielle.", 'textarea', 'Titre « À propos »'],
  ['about', 'about_text', "Depuis près de deux ans, <strong>Caleb Jesugnon AGBAKOU</strong> met la puissance de l'intelligence artificielle au service de la créativité — transformant des idées en réalisations concrètes : images, vidéos, designs, identités visuelles. Attentif au détail, il accompagne particuliers, entreprises et organisations dans la conception de contenus visuels qui marquent.", 'textarea', 'Texte de présentation'],
  ['about', 'mission_title', 'NOTRE MISSION', 'text', 'Titre de la carte mission'],
  ['about', 'mission_text', "Transformer vos idées en réalisations d'exception grâce à l'intelligence artificielle.", 'textarea', 'Texte de la mission'],
  ['about', 'audience_title', "QUI J'ACCOMPAGNE", 'text', 'Titre « Qui j’accompagne »'],
  ['about', 'audience_items', JSON.stringify([
    { name: 'Particuliers', desc: 'Portraits, réseaux sociaux, projets personnels' },
    { name: 'Entreprises', desc: 'Identité visuelle, contenus marketing, publicités' },
    { name: 'Organisations', desc: 'Communication institutionnelle et événementielle' },
  ]), 'json', 'Publics accompagnés'],

  ['sections', 'services_eyebrow', 'SERVICES', 'text', 'Sur-titre Services'],
  ['sections', 'services_title', 'Des solutions créatives complètes, propulsées par l\'IA.', 'textarea', 'Titre Services'],
  ['sections', 'services_note', '+ Conseil en solutions créatives IA, sur mesure selon votre projet.', 'text', 'Note sous les services'],
  ['sections', 'portfolio_eyebrow', 'PORTFOLIO', 'text', 'Sur-titre Portfolio'],
  ['sections', 'portfolio_title', 'Quelques réalisations récentes.', 'text', 'Titre Portfolio'],
  ['sections', 'tools_eyebrow', 'OUTILS', 'text', 'Sur-titre Outils'],
  ['sections', 'tools_title', 'Un savoir-faire technique, augmenté par l\'IA.', 'text', 'Titre Outils'],
  ['sections', 'faq_eyebrow', 'FAQ', 'text', 'Sur-titre FAQ'],
  ['sections', 'faq_title', 'Questions fréquentes.', 'text', 'Titre FAQ'],
  ['sections', 'contact_eyebrow', 'CONTACT', 'text', 'Sur-titre Contact'],
  ['sections', 'contact_title', 'Parlons de votre projet.', 'text', 'Titre Contact'],
  ['sections', 'testimonials_eyebrow', 'COMMENTAIRES', 'text', 'Sur-titre Témoignages'],
  ['sections', 'testimonials_title', 'Ce qu\'en disent les visiteurs.', 'text', 'Titre Témoignages'],
  ['sections', 'footer_note', '© 2026 — Abomey, Bénin', 'text', 'Mention du pied de page'],

  ['contact', 'contact_email', 'calebagbakou@gmail.com', 'email', 'E-mail de contact'],
  ['contact', 'whatsapp_number', '2290148135395', 'text', 'Numéro WhatsApp (format international sans +)'],
  ['contact', 'whatsapp_display', '+229 01 48 13 53 95', 'text', 'WhatsApp affiché'],
  ['contact', 'phone_primary', '+229 01 50 25 97 92', 'text', 'Téléphone principal'],
  ['contact', 'phone_secondary', '+229 01 95 93 86 00', 'text', 'Téléphone secondaire'],
  ['contact', 'location', 'Abomey – Bénin', 'text', 'Localisation'],
  ['contact', 'location_url', 'https://www.google.com/maps/search/Abomey+B%C3%A9nin', 'url', 'Lien carte'],

  ['social', 'social_facebook', 'https://www.facebook.com/profile.php?id=61580115693070', 'url', 'Facebook'],
  ['social', 'social_tiktok', 'https://tiktok.com/@calebagk', 'url', 'TikTok'],
  ['social', 'social_instagram', '', 'url', 'Instagram'],
  ['social', 'social_youtube', '', 'url', 'YouTube'],
  ['social', 'social_linkedin', '', 'url', 'LinkedIn'],

  ['boutique', 'shop_url', './boutique/index.html', 'text', 'URL de la boutique', 'Chemin relatif ou URL complète si la boutique est déployée ailleurs'],
  ['boutique', 'shop_name', 'Caleb Creative — Boutique', 'text', 'Nom de la boutique'],
  ['boutique', 'shop_logo', '', 'media', 'Logo de la boutique'],
  ['boutique', 'shop_hero_title', 'Des outils IA et créatifs premium, activés rapidement.', 'textarea', 'Titre d’accueil boutique'],
  ['boutique', 'shop_hero_text', 'Abonnements Gemini Pro, CapCut Pro, Canva Pro et plus — sélectionnés par Caleb Creative, activés après commande, avec un accompagnement direct.', 'textarea', 'Texte d’accueil boutique'],
  ['boutique', 'currency', 'FCFA', 'text', 'Devise'],
  ['boutique', 'portfolio_url', '../index.html', 'text', 'URL du portfolio (retour depuis la boutique)'],

  ['seo', 'seo_title', 'Caleb Creative — Portfolio', 'text', 'Titre du site (onglet)'],
  ['seo', 'seo_description', 'Création de contenus visuels augmentés par l’intelligence artificielle : images, vidéos, motion design, logos et affiches.', 'textarea', 'Description SEO'],
];

const STATS = [
  ['projets_realises', 'PROJETS RÉALISÉS', 40, '+'],
  ['clients_satisfaits', 'CLIENTS SATISFAITS', 25, '+'],
  ['outils_maitrises', 'OUTILS MAÎTRISÉS', 50, '+'],
  ['annees_experience', "ANNÉES D'EXPÉRIENCE", 2, ''],
];

const SERVICES = [
  ['Création de contenu IA', 'Concepts visuels générés et affinés pour vos campagnes, du brief au rendu final.', '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>'],
  ["Création d'images IA", 'Visuels originaux générés par IA, dirigés et retravaillés pour un rendu fidèle à votre marque.', '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5.5-5.5L4 21"/>'],
  ['Création de vidéos IA', 'Séquences vidéo générées par IA pour des teasers, publicités et contenus courts.', '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 9l4-2v10l-4-2"/>'],
  ['Motion Design', 'Animations et transitions qui donnent du mouvement à vos logos, titres et interfaces.', '<path d="M4 17l5-9 4 6 2-3 5 6"/><circle cx="18" cy="6" r="2"/>'],
  ['Montage vidéo professionnel', 'Montage, étalonnage et rythme pour transformer vos rushes en récit clair.', '<path d="M4 6h16M4 12h10M4 18h13"/>'],
  ["Création d'affiches", "Affiches et supports imprimés pensés pour capter l'attention en un coup d'œil.", '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h6M9 11h6M9 15h3"/>'],
  ['Création de logos', 'Identités visuelles simples et mémorables, pensées pour durer.', '<path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z"/><path d="M12 11v9M4 6.5l8 4.5 8-4.5"/>'],
  ['Retouche photo IA', 'Correction, nettoyage et sublimation de portraits et photos produit.', '<path d="M4 20l6-6M14 4l6 6-9 9H5v-6z"/>'],
  ['Prompt Engineering', 'Conception de prompts optimisés pour exploiter tout le potentiel des IA créatives.', '<path d="M4 4l4 8-4 8M12 20h8"/>'],
];

const SKILLS = [
  ['Adobe Photoshop', 'LOGICIELS', 'Ph'],
  ['Adobe Premiere Pro', 'LOGICIELS', 'Pr'],
  ['Adobe After Effects', 'LOGICIELS', 'Ae'],
  ['CapCut', 'LOGICIELS', 'Cc'],
  ['Canva', 'LOGICIELS', 'Ca'],
  ['ChatGPT', 'INTELLIGENCE ARTIFICIELLE', 'Gp'],
  ['Midjourney', 'INTELLIGENCE ARTIFICIELLE', 'Mj'],
  ['Bytedance Seedance', 'INTELLIGENCE ARTIFICIELLE', 'Sd'],
  ['Kling AI', 'INTELLIGENCE ARTIFICIELLE', 'Kl'],
  ['Claude AI', 'INTELLIGENCE ARTIFICIELLE', 'Cl'],
  ['Leonardo AI', 'INTELLIGENCE ARTIFICIELLE', 'Le'],
  ['Gemini', 'INTELLIGENCE ARTIFICIELLE', 'Ge'],
  ['Ideogram AI', 'INTELLIGENCE ARTIFICIELLE', 'Id'],
];

const FAQS = [
  ['Quels services proposez-vous ?', "Création de contenu, d'images et de vidéos IA, motion design, montage vidéo professionnel, création d'affiches et de logos, retouche photo avec IA, prompt engineering, ainsi que du conseil en solutions créatives IA."],
  ['Combien de temps dure un projet ?', 'Selon la complexité : 24 à 48h pour un visuel simple (image, affiche, retouche), 3 à 5 jours pour une vidéo ou un motion design, et 1 à 2 semaines pour une campagne complète avec plusieurs livrables.'],
  ['Travaillez-vous à distance ?', 'Oui, entièrement. Les échanges se font par WhatsApp ou email, où que vous soyez, du premier brief à la livraison finale.'],
  ['Comment passer commande ?', "Contactez-moi via WhatsApp ou le formulaire ci-dessous en décrivant votre besoin. Je reviens vers vous avec un délai et un tarif, puis on démarre dès validation."],
  ['Quels moyens de paiement acceptez-vous ?', 'Mobile money (MTN, Moov) et virement bancaire. Un acompte est demandé au démarrage, le solde à la livraison.'],
];

const PROJECT_CATEGORIES = [
  ['images', 'Images IA', 'IMAGES IA'],
  ['videos', 'Vidéos IA', 'VIDÉOS IA'],
  ['motion', 'Motion Design', 'MOTION DESIGN'],
  ['pub', 'Publicités', 'PUBLICITÉS'],
  ['logos', 'Logos', 'LOGOS'],
  ['affiches', 'Affiches', 'AFFICHES'],
  ['retouches', 'Retouches photo', 'RETOUCHES PHOTO'],
];

const PROJECTS = [
  ['Campagne Aurora', 'images', 'linear-gradient(135deg,#1F3350,#4ADE80)', ''],
  ['Portraits studio', 'images', 'linear-gradient(135deg,#4ADE80,#16283F)', ''],
  ['Visuels produit', 'images', 'linear-gradient(135deg,#166534,#24405F)', ''],
  ['Teaser produit', 'videos', 'linear-gradient(135deg,#16283F,#2C4A66)', 'https://player.vimeo.com/video/1223912721?h=7443aab3a0&title=0&byline=0&portrait=0'],
  ['Clip réseaux sociaux', 'videos', 'linear-gradient(135deg,#2C4A66,#16283F)', ''],
  ['Vidéo évènementielle', 'videos', 'linear-gradient(135deg,#0F1E32,#4ADE80)', ''],
  ['Motion intro', 'motion', 'linear-gradient(135deg,#4ADE80,#0F1E32)', ''],
  ['Habillage logo animé', 'motion', 'linear-gradient(135deg,#0F1E32,#166534)', ''],
  ['Pub réseaux sociaux', 'pub', 'linear-gradient(135deg,#24405F,#3D5A78)', ''],
  ['Campagne display', 'pub', 'linear-gradient(135deg,#3D5A78,#22C55E)', ''],
  ['Logo Nova Studio', 'logos', 'linear-gradient(135deg,#2C3E52,#4ADE80)', ''],
  ['Identité Atlas', 'logos', 'linear-gradient(135deg,#4ADE80,#2C3E52)', ''],
  ['Affiche événement', 'affiches', 'linear-gradient(135deg,#22C55E,#15803D)', ''],
  ['Affiche concert', 'affiches', 'linear-gradient(135deg,#15803D,#1F3350)', ''],
  ['Retouche portrait', 'retouches', 'linear-gradient(135deg,#86EFAC,#22C55E)', ''],
  ['Retouche produit', 'retouches', 'linear-gradient(135deg,#22C55E,#86EFAC)', ''],
];

const PRODUCT_CATEGORIES = [
  ['ia', 'Intelligence artificielle'],
  ['logiciels', 'Logiciels créatifs'],
];

const PRODUCTS = [
  {
    slug: 'gemini-pro', name: 'Gemini Pro', category: 'ia', badge: 'Populaire', avatar: 'Ge',
    gradient: 'linear-gradient(135deg,#4285F4,#34A853)',
    tagline: "L'assistant IA avancé de Google, en illimité.",
    description: "Accès complet à Gemini Pro : génération de texte, d'images, d'analyses et d'assistance avancée. Idéal pour la création de contenu, la recherche et la productivité au quotidien.",
    highlights: ['Accès aux modèles Gemini les plus avancés', 'Utilisation illimitée pendant la durée choisie', 'Activation rapide après commande'],
    featured: 1,
    plans: [['4mois', '4 mois', 2000], ['12mois', '12 mois', 4000], ['18mois', '18 mois', 6000]],
  },
  {
    slug: 'capcut-pro', name: 'CapCut Pro', category: 'logiciels', badge: 'À vie', avatar: 'Cc',
    gradient: 'linear-gradient(135deg,#000000,#333333)',
    tagline: 'Montage vidéo pro, sans filigrane ni limites — à vie.',
    description: "Débloque toutes les fonctionnalités premium de CapCut, à vie : effets, modèles, suppression du filigrane et export en haute qualité pour tes vidéos et contenus réseaux sociaux.",
    highlights: ['Toutes les fonctionnalités premium débloquées', 'Export sans filigrane', 'Accès à vie, sans renouvellement'],
    featured: 1,
    plans: [['avie', 'À vie', 1500]],
  },
  {
    slug: 'canva-pro', name: 'Canva Pro', category: 'logiciels', badge: '', avatar: 'Ca',
    gradient: 'linear-gradient(135deg,#8B3DFF,#00C4CC)',
    tagline: 'Toute la puissance de Canva Pro pendant 1 an.',
    description: "Accède à l'ensemble des outils Canva Pro : modèles premium, suppression d'arrière-plan, kit de marque, redimensionnement magique et bien plus, pour créer des visuels professionnels rapidement.",
    highlights: ["Modèles et éléments premium illimités", "Suppression d'arrière-plan en un clic", 'Kit de marque et redimensionnement magique'],
    featured: 1,
    plans: [['1an', '1 an', 2000]],
  },
];

/* --------------------------------------------------------------------- */

function importLocalAsset(relPath, { kind = 'image', folder = 'general', title = '' } = {}) {
  const src = path.join(config.siteRoot, relPath);
  if (!fs.existsSync(src)) return null;
  const ext = path.extname(src).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const key = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.copyFileSync(src, path.join(config.storage.localDir, key));
  const size = fs.statSync(src).size;
  const info = db.prepare(
    `INSERT INTO media (kind, storage, storage_key, original_name, mime, size, title, alt, folder)
     VALUES (?, 'local', ?, ?, ?, ?, ?, ?, ?)`
  ).run(kind, key, path.basename(src), mime, size, title, title, folder);
  return info.lastInsertRowid;
}

function seedContent() {
  const tx = db.transaction(() => {
    // Paramètres
    const setStmt = db.prepare(
      `INSERT INTO settings (key, value, type, group_name, label, help, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET type = excluded.type, group_name = excluded.group_name,
         label = excluded.label, help = excluded.help, position = excluded.position`
    );
    SETTINGS.forEach(([group, key, value, type, label, help], i) => setStmt.run(key, value, type, group, label || key, help || '', i));

    // Statistiques
    const statStmt = db.prepare('INSERT OR IGNORE INTO stats (key, label, value, suffix, position) VALUES (?, ?, ?, ?, ?)');
    STATS.forEach(([key, label, value, suffix], i) => statStmt.run(key, label, value, suffix, i));

    // Services
    const svcStmt = db.prepare('INSERT INTO services (title, description, icon, position) VALUES (?, ?, ?, ?)');
    SERVICES.forEach(([t, d, icon], i) => svcStmt.run(t, d, icon, i));

    // Compétences / outils
    const skillStmt = db.prepare('INSERT INTO skills (name, group_label, avatar, position) VALUES (?, ?, ?, ?)');
    SKILLS.forEach(([name, group, avatar], i) => skillStmt.run(name, group, avatar, i));

    // FAQ
    const faqStmt = db.prepare('INSERT INTO faqs (question, answer, position) VALUES (?, ?, ?)');
    FAQS.forEach(([q, a], i) => faqStmt.run(q, a, i));

    // Catégories
    const catStmt = db.prepare('INSERT OR IGNORE INTO categories (scope, slug, label, short_label, position) VALUES (?, ?, ?, ?, ?)');
    PROJECT_CATEGORIES.forEach(([slug, label, short], i) => catStmt.run('project', slug, label, short, i));
    PRODUCT_CATEGORIES.forEach(([slug, label], i) => catStmt.run('product', slug, label, label, i));

    // Projets
    const projStmt = db.prepare(
      `INSERT INTO projects (slug, title, description, category_id, video_url, gradient, status, position, featured)
       VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?)`
    );
    PROJECTS.forEach(([title, cat, gradient, video], i) => {
      const category = db.prepare("SELECT id FROM categories WHERE scope='project' AND slug=?").get(cat);
      projStmt.run(slugify(title), title, '', category?.id ?? null, video, gradient, i, i < 3 ? 1 : 0);
    });

    // Produits + formules (les PRIX vivent ici, plus dans le code)
    const prodStmt = db.prepare(
      `INSERT INTO products (slug, name, category_id, tagline, description, highlights, badge, avatar, gradient, status, featured, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`
    );
    const varStmt = db.prepare(
      'INSERT INTO product_variants (product_id, slug, label, price, position) VALUES (?, ?, ?, ?, ?)'
    );
    PRODUCTS.forEach((p, i) => {
      const category = db.prepare("SELECT id FROM categories WHERE scope='product' AND slug=?").get(p.category);
      const info = prodStmt.run(p.slug, p.name, category?.id ?? null, p.tagline, p.description, JSON.stringify(p.highlights), p.badge, p.avatar, p.gradient, p.featured, i);
      p.plans.forEach(([slug, label, price], j) => varStmt.run(info.lastInsertRowid, slug, label, price, j));
    });
  });
  tx();

  // Photo de profil existante → média administrable
  const photoId = importLocalAsset('assets/profile.jpg', { folder: 'identite', title: 'Photo de profil' });
  if (photoId) db.prepare("UPDATE settings SET value = ? WHERE key = 'profile_photo'").run(String(photoId));
}

async function ensureAdmin() {
  const count = db.prepare('SELECT COUNT(*) c FROM admins').get().c;
  if (count > 0) return;
  const email = (config.auth.bootstrapEmail || 'admin@calebcreative.local').toLowerCase();
  let password = config.auth.bootstrapPassword;
  let generated = false;
  if (!password) {
    password = `Caleb-${crypto.randomBytes(6).toString('base64url')}1A`;
    generated = true;
  }
  const hash = await bcrypt.hash(password, 12);
  db.prepare('INSERT INTO admins (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(email, config.auth.bootstrapName, hash, 'admin');
  console.log('\n  ── Compte administrateur créé ──');
  console.log(`     e-mail        : ${email}`);
  console.log(`     mot de passe  : ${generated ? password + '   (généré — note-le puis change-le dans /admin)' : '(défini via ADMIN_PASSWORD)'}`);
  console.log('  ────────────────────────────────\n');
}

function isEmpty() {
  return db.prepare('SELECT COUNT(*) c FROM settings').get().c === 0;
}

function resetContent() {
  const tables = ['project_media', 'product_media', 'product_variants', 'products', 'projects', 'services', 'skills', 'faqs', 'stats', 'categories', 'settings'];
  db.transaction(() => tables.forEach((t) => db.prepare(`DELETE FROM ${t}`).run()))();
}

function ensureSeed({ force = false } = {}) {
  if (force) resetContent();
  if (isEmpty()) {
    seedContent();
    console.log('  [seed] Contenu initial importé depuis le site existant.');
  }
  ensureAdmin().catch((e) => console.error('[seed] admin:', e.message));
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  ensureSeed({ force });
  setTimeout(() => process.exit(0), 300);
}

module.exports = { ensureSeed, seedContent, resetContent };
