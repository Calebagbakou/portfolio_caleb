'use strict';
/**
 * Tests de bout en bout de l'API (le serveur doit tourner).
 *   node tests/api.test.js
 * Couvre la check-list de la mission : authentification, protection des
 * routes, CRUD projets/produits/formules/prix, médias, statistiques,
 * paramètres, messages, commandes.
 */
const BASE = process.env.TEST_BASE || 'http://localhost:4000';
const EMAIL = process.env.TEST_EMAIL || process.env.ADMIN_EMAIL || 'caleb@calebcreative.local';
const PASSWORD = process.env.TEST_PASSWORD || process.env.ADMIN_PASSWORD || 'CalebAdmin2026!';

let cookies = '';
let csrf = '';
let passed = 0; let failed = 0;

function check(label, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label} ${extra ? '→ ' + extra : ''}`); }
}

async function call(method, path, body, { auth = true, raw = false } = {}) {
  const headers = {};
  if (auth && cookies) headers.Cookie = cookies;
  if (auth && csrf && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = csrf;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (setCookie.length) {
    const jar = {};
    cookies.split('; ').filter(Boolean).forEach((c) => { const [k, ...v] = c.split('='); jar[k] = v.join('='); });
    setCookie.forEach((c) => { const [pair] = c.split(';'); const [k, ...v] = pair.split('='); jar[k] = v.join('='); });
    cookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (jar.caleb_csrf) csrf = jar.caleb_csrf;
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = { raw: text }; }
  return raw ? { res, json, text } : { status: res.status, data: json };
}

function pngBuffer(r, g, b) {
  const zlib = require('zlib');
  const chunk = (type, data) => {
    const buf = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(buf) : require('zlib').crc32(buf));
    return Buffer.concat([len, buf, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(4, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < 4; y++) rows.push(Buffer.concat([Buffer.from([0]), Buffer.concat(Array(4).fill(Buffer.from([r, g, b])))]));
  const idat = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  console.log('\n════════ TESTS API — CALEB CREATIVE ════════');

  /* ---------------------- 1. SÉCURITÉ / AUTH ---------------------- */
  console.log('\n▶ Authentification & protection des routes');
  check('API en ligne', (await call('GET', '/api/health', null, { auth: false })).status === 200);
  check('dashboard protégé sans session', (await call('GET', '/api/admin/dashboard', null, { auth: false })).status === 401);
  check('création de projet refusée sans session', (await call('POST', '/api/admin/projects', { title: 'X' }, { auth: false })).status === 401);
  check('mauvais mot de passe rejeté', (await call('POST', '/api/auth/login', { email: EMAIL, password: 'mauvais' }, { auth: false })).status === 401);

  const login = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD }, { auth: false });
  check('connexion admin', login.status === 200, JSON.stringify(login.data));
  if (login.status !== 200) { console.log('\nImpossible de continuer sans session.\n'); process.exit(1); }
  check('session valide (/me)', (await call('GET', '/api/auth/me')).status === 200);

  const savedCsrf = csrf;
  csrf = 'faux-jeton';
  check('CSRF invalide rejeté', (await call('POST', '/api/admin/projects', { title: 'CSRF' })).status === 403);
  csrf = savedCsrf;

  /* ------------------------- 2. MÉDIAS ---------------------------- */
  console.log('\n▶ Médias (upload / remplacement / suppression)');
  const fd = new FormData();
  fd.append('file', new Blob([pngBuffer(255, 0, 0)], { type: 'image/png' }), 'rouge.png');
  fd.append('kind', 'image');
  fd.append('folder', 'tests');
  const up = await call('POST', '/api/admin/media', fd);
  check('upload image', up.status === 201, JSON.stringify(up.data));
  const mediaId = up.data?.data?.id;
  const firstUrl = up.data?.data?.url;

  const fetched = await fetch(`${BASE}/media/${mediaId}`);
  check('image servie publiquement', fetched.status === 200 && fetched.headers.get('content-type') === 'image/png');

  const fd2 = new FormData();
  fd2.append('file', new Blob([pngBuffer(0, 0, 255)], { type: 'image/png' }), 'bleu.png');
  const rep = await call('POST', `/api/admin/media/${mediaId}/file`, fd2);
  check('remplacement du fichier (même id)', rep.status === 200 && rep.data.data.id === mediaId);
  check('URL de référence conservée', rep.data.data.url.split('?')[0] === firstUrl.split('?')[0]);

  const fdBad = new FormData();
  fdBad.append('file', new Blob(['#!/bin/sh\nrm -rf /'], { type: 'application/x-sh' }), 'malveillant.sh');
  check('type de fichier interdit refusé', (await call('POST', '/api/admin/media', fdBad)).status === 415);

  const fdVideo = new FormData();
  fdVideo.append('file', new Blob([Buffer.alloc(2048, 1)], { type: 'video/mp4' }), 'demo.mp4');
  fdVideo.append('kind', 'video');
  const upVideo = await call('POST', '/api/admin/media', fdVideo);
  check('upload vidéo', upVideo.status === 201, JSON.stringify(upVideo.data));
  const videoId = upVideo.data?.data?.id;

  const fdLogo = new FormData();
  fdLogo.append('file', new Blob([pngBuffer(0, 255, 0)], { type: 'image/png' }), 'logo.png');
  fdLogo.append('kind', 'logo');
  const upLogo = await call('POST', '/api/admin/media', fdLogo);
  check('upload logo', upLogo.status === 201);
  const logoId = upLogo.data?.data?.id;

  /* ------------------------- 3. PROJETS --------------------------- */
  console.log('\n▶ Projets (CRUD complet)');
  const created = await call('POST', '/api/admin/projects', {
    title: 'Projet automatisé', description: 'Créé par les tests',
    cover_media_id: mediaId, video_media_id: videoId,
    gallery_ids: [mediaId], tools: ['Photoshop', 'Midjourney'],
    status: 'published', featured: 1, position: 99,
  });
  check('création de projet', created.status === 201, JSON.stringify(created.data));
  const projectId = created.data?.data?.id;
  check('galerie enregistrée', created.data?.data?.gallery?.length === 1);
  check('image principale liée', created.data?.data?.cover?.id === mediaId);

  const updated = await call('PUT', `/api/admin/projects/${projectId}`, { title: 'Projet automatisé (modifié)', status: 'draft' });
  check('modification de projet', updated.status === 200 && updated.data.data.title === 'Projet automatisé (modifié)');

  const publicProjects = await call('GET', '/api/public/projects', null, { auth: false });
  check('projet en brouillon absent du site', !publicProjects.data.data.some((p) => p.id === projectId));
  await call('PUT', `/api/admin/projects/${projectId}`, { status: 'published' });
  const publicProjects2 = await call('GET', '/api/public/projects', null, { auth: false });
  check('projet publié visible sur le site', publicProjects2.data.data.some((p) => p.id === projectId));

  /* ---------------------- 4. STATISTIQUES ------------------------- */
  console.log('\n▶ Statistiques');
  const statList = await call('GET', '/api/admin/stats');
  const firstStat = statList.data.data[0];
  const newValue = (firstStat.value || 0) + 7;
  await call('PUT', `/api/admin/stats/${firstStat.id}`, { value: newValue });
  const site = await call('GET', '/api/public/site', null, { auth: false });
  check('statistique modifiée visible côté site', site.data.data.stats.some((s) => s.key === firstStat.key && s.value === newValue));

  /* ------------------------ 5. PARAMÈTRES ------------------------- */
  console.log('\n▶ Paramètres, logos et URL de la boutique');
  await call('PUT', '/api/admin/settings', { values: { logo: String(logoId), shop_url: 'https://boutique.exemple.com/', hero_subtitle: 'Sous-titre de test' } });
  const site2 = await call('GET', '/api/public/site', null, { auth: false });
  check('logo administrable renvoyé en URL', /^\/media\/\d+/.test(site2.data.data.settings.logo || ''), site2.data.data.settings.logo);
  check('URL de la boutique modifiable', site2.data.data.settings.shop_url === 'https://boutique.exemple.com/');
  check('texte du site modifiable', site2.data.data.settings.hero_subtitle === 'Sous-titre de test');
  await call('PUT', '/api/admin/settings', { values: { shop_url: './boutique/index.html', hero_subtitle: "Le visuel fait tout. Ne laisse plus tes idées au brouillon. Laisse l'IA et le design exploser ton potentiel." } });

  /* -------------------------- 6. BOUTIQUE ------------------------- */
  console.log('\n▶ Boutique : produits, formules, prix');
  const prod = await call('POST', '/api/admin/shop/products', {
    name: 'Produit de test', tagline: 'Test', description: 'Produit créé par les tests',
    highlights: ['Avantage 1'], image_media_id: mediaId, status: 'published', featured: 1,
  });
  check('création de produit', prod.status === 201, JSON.stringify(prod.data));
  const productId = prod.data?.data?.id;
  const productSlug = prod.data?.data?.slug;

  const v1 = await call('POST', `/api/admin/shop/products/${productId}/variants`, { label: '3 mois', price: 3000 });
  const v2 = await call('POST', `/api/admin/shop/products/${productId}/variants`, { label: '12 mois', price: 9000 });
  check('ajout de formules', v1.status === 201 && v2.status === 201);

  await call('PUT', `/api/admin/shop/variants/${v2.data.data.id}`, { label: '12 mois', price: 10000 });
  const shopPublic = await call('GET', '/api/public/shop', null, { auth: false });
  const publicProduct = shopPublic.data.data.products.find((p) => p.id === productSlug);
  check('produit visible sur la boutique', !!publicProduct);
  check('nouveau prix appliqué immédiatement', publicProduct?.plans.find((p) => p.label === '12 mois')?.price === 10000);
  check('image produit exposée', !!publicProduct?.image?.url);

  /* -------------------------- 7. COMMANDES ------------------------ */
  console.log('\n▶ Commandes & paiement');
  const order = await call('POST', '/api/public/orders', {
    customer: { name: 'Testeur Auto', email: 'test@auto.local', phone: '+22900000001' },
    items: [{ productId: productSlug, planId: publicProduct.plans[1].id, qty: 3 }],
    paymentMethod: 'mtn',
  }, { auth: false });
  check('création de commande', order.status === 201, JSON.stringify(order.data));
  check('total calculé par le serveur', order.data?.data?.total === 30000, String(order.data?.data?.total));
  check('commande non payée par défaut', order.data?.data?.payment_status === 'unpaid');
  check('aucun paiement simulé', order.data?.payment?.configured === false);
  check('paiement sans prestataire → 501', (await call('POST', '/api/payments/intents', { ref: order.data.data.ref }, { auth: false })).status === 501);

  const badOrder = await call('POST', '/api/public/orders', {
    customer: { name: 'Fraude', phone: '+22900000002' },
    items: [{ productId: productSlug, planId: 'inexistant', qty: 1 }],
  }, { auth: false });
  check('formule inexistante refusée', badOrder.status === 422);

  const orders = await call('GET', '/api/admin/shop/orders');
  const createdOrder = orders.data.data.find((o) => o.ref === order.data.data.ref);
  check('commande visible dans l’admin', !!createdOrder);
  const upd = await call('PUT', `/api/admin/shop/orders/${createdOrder.id}`, { status: 'paid', payment_status: 'paid', payment_reference: 'MANUEL-1' });
  check('confirmation manuelle du paiement', upd.data.data.payment_status === 'paid' && !!upd.data.data.paid_at);
  check('client créé automatiquement', (await call('GET', '/api/admin/shop/customers')).data.data.some((c) => c.email === 'test@auto.local'));

  /* --------------------------- 8. MESSAGES ------------------------ */
  console.log('\n▶ Messages de contact');
  const msg = await call('POST', '/api/public/messages', { name: 'Visiteur Test', email: 'visiteur@test.local', message: 'Bonjour, ceci est un test.' }, { auth: false });
  check('envoi depuis le formulaire', msg.status === 201);
  const msgs = await call('GET', '/api/admin/messages');
  const lastMsg = msgs.data.data.find((m) => m.email === 'visiteur@test.local');
  check('message enregistré en base', !!lastMsg);
  check('marquer comme lu', (await call('PUT', `/api/admin/messages/${lastMsg.id}`, { status: 'read' })).data.data.status === 'read');
  check('archiver', (await call('PUT', `/api/admin/messages/${lastMsg.id}`, { status: 'archived' })).data.data.status === 'archived');
  check('supprimer', (await call('DELETE', `/api/admin/messages/${lastMsg.id}`)).status === 200);

  const spam = await call('POST', '/api/public/messages', { name: 'Bot', email: 'bot@spam.local', message: 'spam spam spam', company: 'rempli' }, { auth: false });
  check('honeypot anti-spam', spam.status === 201 && !(await call('GET', '/api/admin/messages')).data.data.some((m) => m.email === 'bot@spam.local'));

  /* --------------------------- 9. AVIS ---------------------------- */
  console.log('\n▶ Témoignages');
  await call('POST', '/api/public/testimonials', { author: 'Client Test', content: 'Super travail, merci !' }, { auth: false });
  const tests = await call('GET', '/api/admin/testimonials');
  const pending = tests.data.data.find((t) => t.author === 'Client Test');
  check('avis en attente de validation', pending && pending.status === 'pending');
  const sitePub = await call('GET', '/api/public/site', null, { auth: false });
  check('avis non publié invisible', !sitePub.data.data.testimonials.some((t) => t.author === 'Client Test'));
  await call('PUT', `/api/admin/testimonials/${pending.id}`, { status: 'published' });
  const sitePub2 = await call('GET', '/api/public/site', null, { auth: false });
  check('avis publié visible', sitePub2.data.data.testimonials.some((t) => t.author === 'Client Test'));
  await call('DELETE', `/api/admin/testimonials/${pending.id}`);

  /* --------------------------- 10. MÉNAGE ------------------------- */
  console.log('\n▶ Suppressions & déconnexion');
  check('suppression du produit', (await call('DELETE', `/api/admin/shop/products/${productId}`)).status === 200);
  check('produit retiré de la boutique', !(await call('GET', '/api/public/shop', null, { auth: false })).data.data.products.some((p) => p.id === productSlug));
  check('suppression du projet', (await call('DELETE', `/api/admin/projects/${projectId}`)).status === 200);
  check('suppression des médias de test', (await call('DELETE', `/api/admin/media/${mediaId}`)).status === 200
    && (await call('DELETE', `/api/admin/media/${videoId}`)).status === 200
    && (await call('DELETE', `/api/admin/media/${logoId}`)).status === 200);
  await call('PUT', '/api/admin/settings', { values: { logo: '' } });
  await call('PUT', `/api/admin/stats/${firstStat.id}`, { value: firstStat.value });

  check('déconnexion', (await call('POST', '/api/auth/logout', {})).status === 200);
  cookies = ''; csrf = '';
  check('accès refusé après déconnexion', (await call('GET', '/api/admin/dashboard')).status === 401);

  console.log(`\n${failed ? '❌ ÉCHEC' : '✅ SUCCÈS'} — ${passed} test(s) réussi(s), ${failed} échec(s)\n`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('\nErreur inattendue :', e); process.exit(1); });
