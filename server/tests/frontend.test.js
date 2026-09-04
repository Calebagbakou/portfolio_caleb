'use strict';
/**
 * Test de bout en bout du frontend : charge index.html et les pages de la
 * boutique dans un DOM simulé (jsdom), exécute les scripts réels et vérifie
 * que le contenu affiché vient bien de l'API.
 *   node tests/frontend.test.js            (le serveur doit tourner sur :4000)
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.TEST_BASE || 'http://localhost:4000';
const ROOT = path.join(__dirname, '..', '..');

let passed = 0; let failed = 0;
function check(label, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label} ${extra}`); }
}

async function loadPage(url) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => { if (!/Could not load/.test(e.message)) console.error('   jsdom:', e.message); });
  const dom = await JSDOM.fromURL(url, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // jsdom n'implémente ni fetch ni IntersectionObserver : on les fournit.
      window.fetch = (input, init) => fetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init);
      window.IntersectionObserver = class {
        constructor(cb) { this.cb = cb; }
        observe(el) { this.cb([{ isIntersecting: true, target: el }], this); }
        unobserve() {}
        disconnect() {}
      };
      window.scrollTo = () => {};
      if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    },
  });
  return dom;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('\n▶ Frontend — portfolio');
  const dom = await loadPage(`${BASE}/index.html`);
  await wait(1500);
  const doc = dom.window.document;

  check('hydratation via API', doc.documentElement.dataset.hydrated === 'api', doc.documentElement.dataset.hydrated);
  check('statistiques injectées', doc.querySelectorAll('.stats .stat').length >= 4);
  check('services injectés', doc.querySelectorAll('.services-grid .service').length >= 5);
  check('projets injectés', doc.querySelectorAll('.p-card').length >= 10);
  check('outils injectés', doc.querySelectorAll('.tool-chip').length >= 10);
  check('FAQ injectée', doc.querySelectorAll('.faq-item').length >= 3);
  check('contact injecté', doc.querySelectorAll('.contact-item').length >= 3);
  check('lien boutique configuré', !!doc.querySelector('[data-shop-link]').getAttribute('href'));
  check('titre hero animé', (doc.querySelector('#tw')?.textContent || '').length > 3);
  dom.window.close();

  console.log('\n▶ Frontend — boutique');
  const shop = await loadPage(`${BASE}/boutique/index.html`);
  await wait(1200);
  const sdoc = shop.window.document;
  check('produits affichés', sdoc.querySelectorAll('#featuredGrid .product-card').length >= 1);
  check('catalogue depuis l’API', shop.window.CALEB_SHOP_STATE?.source === 'api', shop.window.CALEB_SHOP_STATE?.source);
  const priceTxt = sdoc.querySelector('.product-price')?.textContent || '';
  check('prix affiché', /\d/.test(priceTxt), priceTxt);
  shop.window.close();

  console.log(`\n${failed ? '❌' : '✅'} ${passed} test(s) OK, ${failed} échec(s)\n`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
