// Common shop functionality
function formatPrice(price) {
  return price.toLocaleString('fr-FR') + ' FCFA';
}

function createProductCard(product) {
  const defaultVariant = product.variants[0];
  const priceRange = product.variants.length > 1
    ? `À partir de ${formatPrice(Math.min(...product.variants.map(v => v.price)))}`
    : formatPrice(defaultVariant.price);

  const card = document.createElement('a');
  card.href = `produit.html?id=${product.id}`;
  card.className = 'product-card reveal in';
  card.innerHTML = `
    <div class="product-img-wrap" style="background: white; padding: 20px; text-align: center;">
      <img src="${product.image}" alt="${product.title}" loading="lazy" style="max-height: 120px; object-fit: contain; margin: 0 auto;">
    </div>
    <div class="product-info">
      <div class="product-cat">${product.category === 'ia' ? 'Intelligence artificielle' : 'Logiciels créatifs'}</div>
      <h3 class="product-title">${product.title}</h3>
      <div class="product-price">${priceRange}</div>
    </div>
  `;
  return card;
}

function renderProductGrid(container, products) {
  if (!container) return;
  container.innerHTML = '';
  if (products.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--paper-dim);">Aucun produit trouvé dans cette catégorie.</p>';
    return;
  }
  products.forEach(p => {
    container.appendChild(createProductCard(p));
  });
}

// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const mobileNavBtn = document.querySelector('[data-mobile-nav-open]');
  const mobileNavClose = document.querySelector('[data-mobile-nav-close]');
  const mobileNav = document.querySelector('.mobile-nav');

  if (mobileNavBtn && mobileNav && mobileNavClose) {
    mobileNavBtn.addEventListener('click', () => mobileNav.classList.add('open'));
    mobileNavClose.addEventListener('click', () => mobileNav.classList.remove('open'));
  }
});

window.formatPrice = formatPrice;
window.renderProductGrid = renderProductGrid;
