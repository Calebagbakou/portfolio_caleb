/* =====================================================================
   Application d'administration : authentification, navigation, routeur.
   ===================================================================== */
(function () {
  const { el, toast } = UI;

  const NAV = [
    { group: null, items: [{ id: 'dashboard', label: 'Tableau de bord', icon: '▦' }] },
    {
      group: 'Portfolio',
      items: [
        { id: 'projects', label: 'Projets', icon: '◆' },
        { id: 'project-categories', label: 'Catégories', icon: '❏' },
        { id: 'skills', label: 'Compétences', icon: '✦' },
        { id: 'services', label: 'Services', icon: '⚙' },
        { id: 'testimonials', label: 'Témoignages', icon: '❝' },
        { id: 'faqs', label: 'FAQ', icon: '?' },
      ],
    },
    {
      group: 'Médias',
      items: [
        { id: 'media-images', label: 'Images', icon: '▣' },
        { id: 'media-videos', label: 'Vidéos', icon: '▶' },
        { id: 'media-logos', label: 'Logos', icon: '✧' },
        { id: 'media-files', label: 'Fichiers', icon: '⛁' },
      ],
    },
    { group: 'Statistiques', items: [{ id: 'stats', label: 'Statistiques', icon: '↗' }] },
    {
      group: 'Boutique',
      items: [
        { id: 'products', label: 'Produits & prix', icon: '🛍' },
        { id: 'shop-categories', label: 'Catégories', icon: '❏' },
        { id: 'orders', label: 'Commandes', icon: '🧾' },
        { id: 'customers', label: 'Clients', icon: '☺' },
      ],
    },
    {
      group: 'Communication',
      items: [
        { id: 'messages', label: 'Messages', icon: '✉' },
        { id: 'settings', label: 'Paramètres', icon: '⚒' },
        { id: 'account', label: 'Mon compte', icon: '🔒' },
      ],
    },
  ];

  const TITLES = {};
  NAV.forEach((g) => g.items.forEach((i) => { TITLES[i.id] = i.label; }));

  const loginScreen = document.getElementById('loginScreen');
  const app = document.getElementById('app');
  const view = document.getElementById('view');
  const nav = document.getElementById('nav');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  /* ------------------------------ session ---------------------------- */
  async function checkSession() {
    try {
      const { data } = await API.get('/api/auth/me', { silent: true });
      showApp(data);
      return true;
    } catch (_) {
      showLogin();
      return false;
    }
  }

  function showLogin() {
    if (!/\/admin\/login\/?$/.test(window.location.pathname)) {
      window.history.replaceState(null, '', '/admin/login');
    }
    app.hidden = true;
    loginScreen.hidden = false;
    document.getElementById('loginEmail').focus();
  }

  function showApp(me) {
    if (/\/admin\/login\/?$/.test(window.location.pathname)) {
      window.history.replaceState(null, '', '/admin/' + (window.location.hash || ''));
    }
    loginScreen.hidden = true;
    app.hidden = false;
    document.getElementById('userName').textContent = me.name || me.email;
    document.getElementById('userAvatar').textContent = (me.name || me.email || '?').trim().charAt(0).toUpperCase();
    buildNav();
    route();
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errBox = document.getElementById('loginError');
    errBox.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Connexion…';
    try {
      const { data } = await API.post('/api/auth/login', {
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
      }, { silent: true });
      document.getElementById('loginPassword').value = '';
      showApp(data);
      toast(`Bienvenue ${data.name || ''} !`);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
    }
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await API.post('/api/auth/logout', {}); } catch (_) { /* ignore */ }
    window.location.hash = '';
    showLogin();
    toast('Déconnecté.');
  });

  document.addEventListener('admin:unauthorized', () => {
    showLogin();
    toast('Session expirée, reconnecte-toi.', 'err');
  });
  document.addEventListener('admin:refresh', () => route());

  /* ---------------------------- navigation --------------------------- */
  function buildNav() {
    nav.innerHTML = '';
    NAV.forEach((section) => {
      if (section.group) nav.appendChild(el('div', { class: 'nav-group', text: section.group }));
      section.items.forEach((item) => {
        nav.appendChild(el('a', {
          href: `#/${item.id}`, dataset: { view: item.id },
        }, [el('span', { text: item.icon, style: 'width:18px;display:inline-block' }), el('span', { text: item.label })]));
      });
    });
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
  }
  document.getElementById('menuBtn').addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
  });
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  /* ------------------------------ routeur ---------------------------- */
  async function route() {
    const id = (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
    const render = VIEWS[id] || VIEWS.dashboard;
    document.getElementById('pageTitle').textContent = TITLES[id] || 'Tableau de bord';
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.view === id));
    closeSidebar();
    view.innerHTML = '<div class="loader"><span class="spinner"></span></div>';
    try {
      await render(view);
    } catch (e) {
      view.innerHTML = '';
      view.appendChild(el('div', { class: 'card' }, [el('div', { class: 'empty', text: e.message })]));
    }
    window.scrollTo({ top: 0 });
  }

  window.addEventListener('hashchange', route);
  checkSession();
})();
