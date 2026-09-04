'use strict';
/**
 * Test d'interface de l'administration (DOM simulé) :
 * connexion → tableau de bord → navigation → liste des produits →
 * protection après déconnexion.
 *   node tests/admin.test.js
 */
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.TEST_BASE || 'http://localhost:4000';
const EMAIL = process.env.TEST_EMAIL || process.env.ADMIN_EMAIL || 'caleb@calebcreative.local';
const PASSWORD = process.env.TEST_PASSWORD || process.env.ADMIN_PASSWORD || 'CalebAdmin2026!';

let passed = 0; let failed = 0;
const check = (label, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label} ${extra}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('\n▶ Interface d’administration');
  const jar = {};
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => console.error('   jsdom:', e.message));

  const dom = await JSDOM.fromURL(`${BASE}/admin/login`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // fetch avec gestion manuelle des cookies (jsdom ne le fait pas)
      window.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? (input.startsWith('/') ? BASE + input : input) : input;
        const headers = new Headers(init.headers || {});
        const cookieStr = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookieStr) headers.set('Cookie', cookieStr);
        const res = await fetch(url, { ...init, headers });
        (res.headers.getSetCookie?.() || []).forEach((c) => {
          const [pair] = c.split(';');
          const [k, ...v] = pair.split('=');
          jar[k] = v.join('=');
          if (k === 'caleb_csrf') window.document.cookie = `caleb_csrf=${jar[k]}`;
        });
        return res;
      };
      window.scrollTo = () => {};
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    },
  });

  const { window } = dom;
  const doc = window.document;
  await wait(700);

  check('écran de connexion affiché', !doc.getElementById('loginScreen').hidden);
  check('application masquée avant connexion', doc.getElementById('app').hidden);

  // Mauvais mot de passe
  doc.getElementById('loginEmail').value = EMAIL;
  doc.getElementById('loginPassword').value = 'mauvais-mot-de-passe';
  doc.getElementById('loginForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(600);
  check('erreur affichée si identifiants faux', !doc.getElementById('loginError').hidden);

  // Bonne connexion
  doc.getElementById('loginEmail').value = EMAIL;
  doc.getElementById('loginPassword').value = PASSWORD;
  doc.getElementById('loginForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(1200);

  check('connexion réussie → dashboard visible', !doc.getElementById('app').hidden);
  check('cartes de statistiques affichées', doc.querySelectorAll('.stat-card').length >= 6, String(doc.querySelectorAll('.stat-card').length));
  check('navigation construite', doc.querySelectorAll('#nav a').length >= 15);

  // Navigation vers les produits
  window.location.hash = '#/products';
  window.dispatchEvent(new window.Event('hashchange'));
  await wait(900);
  check('vue Produits chargée', /Produits/.test(doc.getElementById('pageTitle').textContent));
  check('tableau des produits rempli', doc.querySelectorAll('#view table tbody tr').length >= 3, String(doc.querySelectorAll('#view table tbody tr').length));

  // Navigation vers les commandes puis les médias
  window.location.hash = '#/orders';
  window.dispatchEvent(new window.Event('hashchange'));
  await wait(800);
  check('vue Commandes chargée', /Commandes/.test(doc.getElementById('pageTitle').textContent));

  window.location.hash = '#/media-images';
  window.dispatchEvent(new window.Event('hashchange'));
  await wait(800);
  check('médiathèque chargée', /Images/.test(doc.getElementById('pageTitle').textContent));

  window.location.hash = '#/settings';
  window.dispatchEvent(new window.Event('hashchange'));
  await wait(1000);
  check('paramètres chargés (formulaires par groupe)', doc.querySelectorAll('#view .card form').length >= 5, String(doc.querySelectorAll('#view .card form').length));

  // Déconnexion
  doc.getElementById('logoutBtn').dispatchEvent(new window.Event('click', { bubbles: true }));
  await wait(700);
  check('déconnexion → écran de connexion', !doc.getElementById('loginScreen').hidden);

  window.close();
  console.log(`\n${failed ? '❌' : '✅'} ${passed} test(s) OK, ${failed} échec(s)\n`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
