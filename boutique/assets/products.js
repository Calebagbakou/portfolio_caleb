/* =========================================================================
   PRODUITS DE LA BOUTIQUE — CALEB CREATIVE
   -------------------------------------------------------------------------
   Les produits, formules et PRIX viennent maintenant de l'API
   (/api/public/shop) et se modifient depuis /admin → Boutique.
   Le tableau ci-dessous n'est qu'un CONTENU DE SECOURS utilisé si l'API
   n'est pas joignable (par exemple boutique publiée seule, sans backend).
   ========================================================================= */

const CALEB_SHOP_FALLBACK_PRODUCTS = [
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
      "Accès complet à Gemini Pro : génération de texte, d'images, d'analyses et d'assistance avancée.",
    highlights: [
      "Accès aux modèles Gemini les plus avancés",
      "Utilisation illimitée pendant la durée choisie",
      "Activation rapide après commande",
    ],
    image: null,
    plans: [
      { id: "4mois", label: "4 mois", price: 2000 },
      { id: "12mois", label: "12 mois", price: 4000 },
      { id: "18mois", label: "18 mois", price: 6000 },
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
    description: "Débloque toutes les fonctionnalités premium de CapCut, à vie.",
    highlights: ["Toutes les fonctionnalités premium débloquées", "Export sans filigrane", "Accès à vie"],
    image: null,
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
    description: "Accède à l'ensemble des outils Canva Pro : modèles premium, kit de marque…",
    highlights: ["Modèles et éléments premium illimités", "Suppression d'arrière-plan", "Kit de marque"],
    image: null,
    plans: [{ id: "1an", label: "1 an", price: 2000 }],
  },
];

const CALEB_SHOP_FALLBACK_CATEGORIES = [
  { id: "tous", label: "Tous les produits" },
  { id: "ia", label: "Intelligence artificielle" },
  { id: "logiciels", label: "Logiciels créatifs" },
];

/* Données vivantes (remplacées par l'API dès qu'elle répond) */
let CALEB_SHOP_PRODUCTS = CALEB_SHOP_FALLBACK_PRODUCTS.slice();
let CALEB_SHOP_CATEGORIES = CALEB_SHOP_FALLBACK_CATEGORIES.slice();
let CALEB_SHOP_SETTINGS = {
  shop_name: "Caleb Creative — Boutique",
  whatsapp_number: "2290148135395",
  currency: "FCFA",
  portfolio_url: "../index.html",
};
let CALEB_SHOP_SOURCE = "static";

/* ---------- Chargement depuis l'API ---------- */
const shopReady = (function () {
  const promise = (async () => {
    try {
      const res = await window.CALEB.apiGet("/api/public/shop");
      const data = res.data || {};
      if (Array.isArray(data.products) && data.products.length) {
        CALEB_SHOP_PRODUCTS = data.products.map((p) => ({
          ...p,
          categoryLabel: p.categoryLabel || "",
          highlights: p.highlights || [],
          plans: (p.plans || []).map((pl) => ({ ...pl })),
        }));
      }
      if (Array.isArray(data.categories) && data.categories.length) CALEB_SHOP_CATEGORIES = data.categories;
      CALEB_SHOP_SETTINGS = { ...CALEB_SHOP_SETTINGS, ...(data.settings || {}) };
      CALEB_SHOP_SOURCE = "api";
    } catch (e) {
      window.CALEB.available = false;
      CALEB_SHOP_SOURCE = "static";
      console.info("[Boutique] Catalogue statique utilisé (API indisponible).", e.message);
    }
    applyShopSettings();
    const state = { source: CALEB_SHOP_SOURCE, products: CALEB_SHOP_PRODUCTS, categories: CALEB_SHOP_CATEGORIES, settings: CALEB_SHOP_SETTINGS };
    window.CALEB_SHOP_STATE = state;   // pratique pour le débogage / les tests
    return state;
  })();
  return () => promise;
})();

/* Applique les réglages administrables (nom, logo, liens) à la page */
function applyShopSettings() {
  const s = CALEB_SHOP_SETTINGS;
  document.querySelectorAll("[data-shop-name]").forEach((n) => { if (s.shop_name) n.textContent = s.shop_name; });
  document.querySelectorAll("[data-portfolio-link]").forEach((a) => { if (s.portfolio_url) a.setAttribute("href", s.portfolio_url); });
  document.querySelectorAll("[data-whatsapp-link]").forEach((a) => {
    if (s.whatsapp_number) a.setAttribute("href", `https://wa.me/${s.whatsapp_number}`);
  });
  if (s.shop_logo) {
    document.querySelectorAll(".shop-brand-mark").forEach((n) => {
      n.innerHTML = `<img src="${window.CALEB.assetUrl(s.shop_logo)}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">`;
    });
  }
  if (s.favicon) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = window.CALEB.assetUrl(s.favicon);
  }
}

/* ---------- Fonctions utilitaires partagées ---------- */
function shopFormatPrice(price) {
  if (!price || price <= 0) return "Prix sur demande";
  return price.toLocaleString("fr-FR") + " " + (CALEB_SHOP_SETTINGS.currency || "FCFA");
}

function shopFindProduct(id) {
  return CALEB_SHOP_PRODUCTS.find((p) => p.id === id) || null;
}

function shopFindPlan(product, planId) {
  if (!product) return null;
  return product.plans.find((pl) => pl.id === planId) || product.plans[0] || null;
}

function shopProductImage(product) {
  return product && product.image ? window.CALEB.assetUrl(product.image.url) : "";
}
