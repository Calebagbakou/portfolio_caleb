// Basic cart functionality
let cart = JSON.parse(localStorage.getItem('caleb_cart')) || [];

function saveCart() {
  localStorage.setItem('caleb_cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId, variantId, quantity = 1) {
  const existing = cart.find(item => item.productId === productId && item.variantId === variantId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, variantId, quantity });
  }
  saveCart();
}

function removeFromCart(productId, variantId) {
  cart = cart.filter(item => !(item.productId === productId && item.variantId === variantId));
  saveCart();
}

function updateQuantity(productId, variantId, quantity) {
  const item = cart.find(i => i.productId === productId && i.variantId === variantId);
  if (item) {
    item.quantity = quantity;
    if (item.quantity <= 0) removeFromCart(productId, variantId);
    else saveCart();
  }
}

function clearCart() {
  cart = [];
  saveCart();
}

function getCartTotal() {
  return cart.reduce((total, item) => {
    const product = getProductById(item.productId);
    if (!product) return total;
    const variant = product.variants.find(v => v.id === item.variantId);
    if (!variant) return total;
    return total + (variant.price * item.quantity);
  }, 0);
}

function updateCartBadge() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

// Initialize badge on load
document.addEventListener('DOMContentLoaded', updateCartBadge);

window.cart = cart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.clearCart = clearCart;
window.getCartTotal = getCartTotal;
