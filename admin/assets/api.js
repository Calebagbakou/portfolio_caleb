/* =====================================================================
   Client API de l'administration.
   - cookie httpOnly pour la session (invisible au JS)
   - jeton CSRF envoyé en en-tête pour toute requête mutante
   ===================================================================== */
(function () {
  function cookie(name) {
    return document.cookie.split('; ').reduce((acc, part) => {
      const [k, ...v] = part.split('=');
      return k === name ? decodeURIComponent(v.join('=')) : acc;
    }, null);
  }

  // L'admin est servi par le backend → même origine. Peut être surchargé
  // (localStorage.apiBase) si l'admin est hébergé séparément.
  const BASE = (localStorage.getItem('apiBase') || '').replace(/\/$/, '');

  async function request(method, path, body, opts = {}) {
    const headers = {};
    const init = { method, credentials: 'include', headers };

    if (!['GET', 'HEAD'].includes(method)) {
      const csrf = cookie('caleb_csrf');
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }
    if (body instanceof FormData) {
      init.body = body;                     // le navigateur pose le boundary
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const res = await fetch(BASE + path, init);
    let payload = null;
    const text = await res.text();
    if (text) { try { payload = JSON.parse(text); } catch (_) { payload = { raw: text }; } }

    if (res.status === 401 && !opts.silent) {
      document.dispatchEvent(new CustomEvent('admin:unauthorized'));
    }
    if (!res.ok) {
      const err = new Error(payload?.error || `Erreur ${res.status}`);
      err.status = res.status;
      err.details = payload?.details;
      throw err;
    }
    return payload;
  }

  window.API = {
    base: BASE,
    get: (p, o) => request('GET', p, undefined, o),
    post: (p, b, o) => request('POST', p, b, o),
    put: (p, b, o) => request('PUT', p, b, o),
    del: (p, o) => request('DELETE', p, undefined, o),
    mediaUrl(m) {
      if (!m) return '';
      const url = typeof m === 'string' ? m : m.url;
      return url && url.startsWith('/') ? BASE + url : url;
    },
  };
})();
