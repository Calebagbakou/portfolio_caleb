/* =========================================================================
   COMPORTEMENTS PARTAGÉS — CALEB CREATIVE BOUTIQUE
   ========================================================================= */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Échappement HTML (anti-XSS) ---------- */
/* À utiliser systématiquement autour de toute donnée venant de Supabase,
   d'un formulaire, de localStorage ou de l'URL, avant de l'insérer dans du
   HTML via innerHTML/template literal. */
function escapeHtml(value){
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

/* ---------- Toast de confirmation / erreur ---------- */
let toastTimer = null;
function showToast(message, type = 'success'){
  let toast = document.querySelector('.toast');
  if (!toast){
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = type === 'error'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg><span></span>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12l5 5L20 7"/></svg><span></span>';
  toast.querySelector('span').textContent = message;
  toast.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function setBtnLoading(btn, isLoading, loadingText = 'Chargement...'){
  if (isLoading){
    btn.dataset.originalText = btn.innerHTML;
    btn.textContent = loadingText;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

/* ---------- Validation basique de formulaire (checkout) ---------- */
function isValidPhone(value){
  const digits = value.replace(/[^0-9]/g, '');
  return digits.length >= 8;
}
function isValidEmail(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* ---------- Rendu d'une carte produit (utilisé sur l'accueil et le catalogue) ---------- */
function productCardHTML(product){
  const firstPlan = product.plans[0];
  const priceLabel = product.plans.length > 1
    ? `<small>dès&nbsp;</small>${shopFormatPrice(Math.min(...product.plans.map(p => p.price || Infinity)) === Infinity ? 0 : Math.min(...product.plans.filter(p=>p.price>0).map(p=>p.price) ) || 0)}`
    : shopFormatPrice(firstPlan.price);
  return `
  <a class="product-card reveal product-card-link" href="produit.html?id=${encodeURIComponent(product.id)}">
    <div class="product-thumb" style="background:${product.gradient}">
      ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ''}
      <span class="product-thumb-avatar">${escapeHtml(product.avatar)}</span>
    </div>
    <div class="product-body">
      <span class="product-cat">${escapeHtml(product.categoryLabel)}</span>
      <h3 class="product-name">${escapeHtml(product.name)}</h3>
      <p class="product-tagline">${escapeHtml(product.tagline)}</p>
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
