const CALEB_SHOP_PRODUCTS = [
  {
    id: 'gemini-pro',
    title: 'Gemini Pro',
    category: 'ia',
    desc: 'L\'IA la plus avancée de Google pour le texte, le code et l\'analyse.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg',
    variants: [
      { id: 'gemini-4m', title: 'Abonnement 4 mois', price: 2000 },
      { id: 'gemini-12m', title: 'Abonnement 12 mois', price: 4000 },
      { id: 'gemini-18m', title: 'Abonnement 18 mois', price: 6000 }
    ],
    details: 'Accédez à Gemini Pro avec une activation rapide. Idéal pour les professionnels, les développeurs et les créateurs de contenu.'
  },
  {
    id: 'capcut-pro',
    title: 'CapCut Pro',
    category: 'logiciels',
    desc: 'Montage vidéo professionnel et fonctionnalités avancées.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/CapCut_logo.svg',
    variants: [
      { id: 'capcut-life', title: 'Licence à vie (Lifetime)', price: 1500 }
    ],
    details: 'Débloquez toutes les fonctionnalités premium de CapCut : modèles exclusifs, effets avancés et exportations haute qualité sans filigrane.'
  },
  {
    id: 'canva-pro',
    title: 'Canva Pro',
    category: 'logiciels',
    desc: 'La suite de conception graphique complète avec des millions de ressources.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Canva_App_icon.svg',
    variants: [
      { id: 'canva-1y', title: 'Abonnement 1 an', price: 2000 }
    ],
    details: 'Créez des designs professionnels avec un accès illimité aux photos, vidéos, modèles et polices premium de Canva.'
  }
];

// Helper to find a product by ID
function getProductById(id) {
  return CALEB_SHOP_PRODUCTS.find(p => p.id === id);
}

// Ensure products are available globally
window.CALEB_SHOP_PRODUCTS = CALEB_SHOP_PRODUCTS;
window.getProductById = getProductById;
