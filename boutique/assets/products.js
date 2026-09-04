/* =========================================================================
   PRODUITS DE LA BOUTIQUE — CALEB CREATIVE
   -------------------------------------------------------------------------
   Pour ajouter un produit : copie un bloc { ... } et modifie ses valeurs.
   Pour ajouter une formule à un produit existant : ajoute une ligne dans
   son tableau "plans".
   Un prix à 0 affiche automatiquement "Prix sur demande" — remplace juste
   le 0 par le tarif réel (en FCFA, sans espace ni symbole) quand il est
   connu.
   ========================================================================= */

const CALEB_SHOP_PRODUCTS = [
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    category: "ia",
    categoryLabel: "Intelligence artificielle",
    badge: "Populaire",
    avatar: "Ge",
    gradient: "linear-gradient(135deg,#4285F4,#34A853)",
    tagline: "L'assistant IA avancé de Google, en illimité.",
    description:
      "Accès complet à Gemini Pro : génération de texte, d'images, d'analyses et d'assistance avancée. Idéal pour la création de contenu, la recherche et la productivité au quotidien.",
    highlights: [
      "Accès aux modèles Gemini les plus avancés",
      "Utilisation illimitée pendant la durée choisie",
      "Activation rapide après commande",
    ],
    plans: [
      { id: "4mois", label: "4 mois", price: 2000, priceEur: "≈ 3,1 €" },
      { id: "12mois", label: "12 mois", price: 4000, priceEur: "≈ 6,1 €" },
      { id: "18mois", label: "18 mois", price: 6000, priceEur: "≈ 9,15 €" },
    ],
  },
  {
    id: "capcut-pro",
    name: "CapCut Pro",
    category: "logiciels",
    categoryLabel: "Logiciels créatifs",
    badge: "À vie",
    avatar: "Cc",
    gradient: "linear-gradient(135deg,#000000,#333333)",
    tagline: "Montage vidéo pro, sans filigrane ni limites — à vie.",
    description:
      "Débloque toutes les fonctionnalités premium de CapCut, à vie : effets, modèles, suppression du filigrane et export en haute qualité pour tes vidéos et contenus réseaux sociaux.",
    highlights: [
      "Toutes les fonctionnalités premium débloquées",
      "Export sans filigrane",
      "Accès à vie, sans renouvellement",
    ],
    plans: [{ id: "avie", label: "À vie", price: 1500 }],
  },
  {
    id: "canva-pro",
    name: "Canva Pro",
    category: "logiciels",
    categoryLabel: "Logiciels créatifs",
    badge: null,
    avatar: "Ca",
    gradient: "linear-gradient(135deg,#8B3DFF,#00C4CC)",
    tagline: "Toute la puissance de Canva Pro pendant 1 an.",
    description:
      "Accède à l'ensemble des outils Canva Pro : modèles premium, suppression d'arrière-plan, kit de marque, redimensionnement magique et bien plus, pour créer des visuels professionnels rapidement.",
    highlights: [
      "Modèles et éléments premium illimités",
      "Suppression d'arrière-plan en un clic",
      "Kit de marque et redimensionnement magique",
    ],
    plans: [{ id: "1an", label: "1 an", price: 2000 }],
  },
];

/* Liste des catégories affichées dans les filtres du catalogue */
const CALEB_SHOP_CATEGORIES = [
  { id: "tous", label: "Tous les produits" },
  { id: "ia", label: "Intelligence artificielle" },
  { id: "logiciels", label: "Logiciels créatifs" },
];

/* ---------- Fonctions utilitaires partagées ---------- */
function shopFormatPrice(price) {
  if (!price || price <= 0) return "Prix sur demande";
  return price.toLocaleString("fr-FR") + " FCFA";
}

function shopFindProduct(id) {
  return CALEB_SHOP_PRODUCTS.find((p) => p.id === id) || null;
}

function shopFindPlan(product, planId) {
  if (!product) return null;
  return product.plans.find((pl) => pl.id === planId) || product.plans[0] || null;
}
