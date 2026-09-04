/* =====================================================================
   CONFIGURATION DU FRONTEND — Caleb Creative
   ---------------------------------------------------------------------
   Un seul endroit à modifier pour indiquer où vit l'API.
   - Si le site est servi par le backend (même domaine) : laisser vide.
   - Si le portfolio reste sur GitHub Pages et l'API ailleurs :
       REMOTE_API_BASE = 'https://mon-api.onrender.com';
   ===================================================================== */
(function () {
  const REMOTE_API_BASE = '';   // ← URL du backend si le site est hébergé ailleurs

  function detectBase() {
    // Surcharge temporaire pratique pour tester : localStorage.calebApiBase
    const override = window.localStorage && localStorage.getItem('calebApiBase');
    if (override) return override.replace(/\/$/, '');
    const host = window.location.hostname;
    const servedByBackend = !['github.io', ''].includes(host.split('.').slice(-2).join('.')) || host === 'localhost' || host === '127.0.0.1';
    if (window.location.protocol === 'file:' || host.endsWith('github.io')) return REMOTE_API_BASE.replace(/\/$/, '');
    return servedByBackend ? '' : REMOTE_API_BASE.replace(/\/$/, '');
  }

  const base = detectBase();

  async function apiGet(path) {
    const res = await fetch(base + path, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  }

  /** Transforme /media/12 en URL absolue vers le backend si nécessaire. */
  function assetUrl(url) {
    if (!url) return '';
    if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
    return url.startsWith('/') ? base + url : url;
  }

  window.CALEB = {
    apiBase: base,
    // `available` : false si aucune API n'est joignable → le site garde son
    // contenu statique de secours (aucune page cassée).
    available: true,
    apiGet,
    apiPost,
    assetUrl,
  };
})();
