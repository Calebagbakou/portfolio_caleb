/* =========================================================================
   COMPORTEMENTS PARTAGÉS — CALEB CREATIVE BOUTIQUE
   ========================================================================= */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Menu mobile ---------- */
function initMobileNav(){
  const openBtn = document.querySelector('[data-mobile-nav-open]');
  const closeBtn = document.querySelector('[data-mobile-nav-close]');
  const panel = document.querySelector('.mobile-nav');
  if (!openBtn || !panel) return;
  function open(){
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close(){
    panel.classList.remove('open');
    document.body.style.overflow = '';
  }
  openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
}

/* ---------- Apparition progressive au scroll (léger, avec léger décalage) ---------- */
function initReveal(root = document){
  const targets = root.querySelectorAll('.reveal:not(.reveal-bound)');
  if (!targets.length) return;
  targets.forEach(el => el.classList.add('reveal-bound'));

  if (prefersReducedMotion){
    targets.forEach(el => el.classList.add('in'));
    return;
  }

  const groups = new Map();
  targets.forEach(el => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, 0);
    const idx = groups.get(parent);
    el.style.transitionDelay = Math.min(idx * 60, 360) + 'ms';
    groups.set(parent, idx + 1);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  targets.forEach(el => io.observe(el));
}

/* ---------- Toast de confirmation (ex: "Ajouté au panier") ---------- */
let toastTimer = null;
function showToast(message){
  let toast = document.querySelector('.toast');
  if (!toast){
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12l5 5L20 7"/></svg><span></span>';
    document.body.appendChild(toast);
  }
  toast.querySelector('span').textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ---------- Rendu d'une carte produit (utilisé sur l'accueil et le catalogue) ---------- */
function productCardHTML(product){
  const firstPlan = product.plans[0];
  const priceLabel = product.plans.length > 1
    ? `<small>dès&nbsp;</small>${shopFormatPrice(Math.min(...product.plans.map(p => p.price || Infinity)) === Infinity ? 0 : Math.min(...product.plans.filter(p=>p.price>0).map(p=>p.price) ) || 0)}`
    : shopFormatPrice(firstPlan.price);
  return `
  <a class="product-card reveal product-card-link" href="produit.html?id=${product.id}">
    <div class="product-thumb" style="background:${product.gradient}">
      ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
      <span class="product-thumb-avatar">${product.avatar}</span>
    </div>
    <div class="product-body">
      <span class="product-cat">${product.categoryLabel}</span>
      <h3 class="product-name">${product.name}</h3>
      <p class="product-tagline">${product.tagline}</p>
      <div class="product-price-row">
        <span class="product-price">${priceLabel}</span>
      </div>
    </div>
  </a>`;
}

function renderProductGrid(container, products){
  if (!container) return;
  container.innerHTML = products.map(productCardHTML).join('');
  initReveal(container.ownerDocument);
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initReveal();
});
