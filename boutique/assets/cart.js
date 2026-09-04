/* =========================================================================
   PANIER — CALEB CREATIVE BOUTIQUE
   -------------------------------------------------------------------------
   Panier stocké dans le navigateur du visiteur (localStorage). Aucune
   donnée n'est envoyée à un serveur : il n'y a pas de backend derrière
   cette boutique. La commande finale se conclut via WhatsApp (voir
   commande.html).
   ========================================================================= */

const CART_KEY = "caleb_boutique_cart_v1";
const LAST_ORDER_KEY = "caleb_boutique_last_order_v1";

function cartRead() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function cartWrite(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (e) {
    /* stockage indisponible (navigation privée, quota...) : on ignore silencieusement */
  }
  cartUpdateBadges();
}

function cartAdd(productId, planId, qty) {
  qty = Math.max(1, parseInt(qty, 10) || 1);
  const items = cartRead();
  const existing = items.find((it) => it.productId === productId && it.planId === planId);
  if (existing) {
    existing.qty += qty;
  } else {
    items.push({ productId, planId, qty });
  }
  cartWrite(items);
}

function cartUpdateQty(productId, planId, qty) {
  qty = parseInt(qty, 10);
  let items = cartRead();
  if (!qty || qty < 1) {
    items = items.filter((it) => !(it.productId === productId && it.planId === planId));
  } else {
    const existing = items.find((it) => it.productId === productId && it.planId === planId);
    if (existing) existing.qty = qty;
  }
  cartWrite(items);
}

function cartRemove(productId, planId) {
  const items = cartRead().filter((it) => !(it.productId === productId && it.planId === planId));
  cartWrite(items);
}

function cartClear() {
  cartWrite([]);
}

/* Fusionne le panier stocké avec les données produits actuelles (nom, prix, image...) */
function cartDetails() {
  return cartRead()
    .map((it) => {
      const product = shopFindProduct(it.productId);
      if (!product) return null;
      const plan = shopFindPlan(product, it.planId);
      if (!plan) return null;
      return {
        productId: product.id,
        planId: plan.id,
        name: product.name,
        planLabel: plan.label,
        avatar: product.avatar,
        gradient: product.gradient,
        unitPrice: plan.price,
        qty: it.qty,
        lineTotal: plan.price * it.qty,
      };
    })
    .filter(Boolean);
}

function cartCount() {
  return cartRead().reduce((sum, it) => sum + it.qty, 0);
}

function cartTotal() {
  return cartDetails().reduce((sum, line) => sum + line.lineTotal, 0);
}

/* Met à jour tous les badges de compteur panier présents sur la page (icône header) */
function cartUpdateBadges() {
  const count = cartCount();
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });
}

document.addEventListener("DOMContentLoaded", cartUpdateBadges);
