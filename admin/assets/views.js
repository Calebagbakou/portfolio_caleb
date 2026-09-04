/* =====================================================================
   VUES DE L'ADMINISTRATION
   Chaque vue reçoit son conteneur et se dessine elle-même.
   ===================================================================== */
(function () {
  const { el, toast, confirmDialog, formModal, table, actions, statusBadge, fmtPrice, fmtDate, fmtBytes, mediaThumb, mediaPicker } = UI;

  const STATUS_OPTS = [{ value: 'published', label: 'Publié' }, { value: 'hidden', label: 'Masqué' }];
  const STATUS_DRAFT = [{ value: 'published', label: 'Publié' }, { value: 'draft', label: 'Brouillon' }];

  function pageHead(title, subtitle, right) {
    return el('div', { class: 'card-head' }, [
      el('div', {}, [el('h2', { text: title }), subtitle ? el('small', { text: subtitle }) : null]),
      el('div', { class: 'spacer' }),
      right || null,
    ]);
  }

  function loader() { return el('div', { class: 'loader' }, [el('span', { class: 'spinner' })]); }

  /* =====================================================================
     Vue générique de ressource (liste + création + édition + suppression)
     ===================================================================== */
  function resourceView(cfg) {
    return async function render(root) {
      root.innerHTML = '';
      const card = el('div', { class: 'card' });
      const body = el('div', {});
      const searchInput = cfg.search === false ? null : el('input', { type: 'search', placeholder: 'Rechercher…' });
      const addBtn = el('button', {
        class: 'btn btn-primary', type: 'button', text: cfg.addLabel || '＋ Ajouter',
        onclick: () => openForm(null),
      });

      card.appendChild(pageHead(cfg.title, cfg.subtitle, addBtn));
      if (searchInput) {
        const toolbar = el('div', { class: 'toolbar' }, [searchInput]);
        (cfg.filters || []).forEach((f) => {
          const sel = el('select', {}, [el('option', { value: '', text: f.label })].concat(
            f.options.map((o) => el('option', { value: o.value, text: o.label }))
          ));
          sel.addEventListener('change', () => { state.filters[f.name] = sel.value; load(); });
          toolbar.appendChild(sel);
        });
        card.appendChild(toolbar);
      }
      card.appendChild(body);
      root.appendChild(card);

      const state = { rows: [], q: '', filters: {}, ctx: {} };
      let timer = null;
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          clearTimeout(timer);
          timer = setTimeout(() => { state.q = searchInput.value.trim(); load(); }, 250);
        });
      }

      async function load() {
        body.innerHTML = '';
        body.appendChild(loader());
        try {
          const params = new URLSearchParams();
          if (state.q) params.set('q', state.q);
          Object.entries(state.filters).forEach(([k, v]) => { if (v) params.set(k, v); });
          const qs = params.toString();
          const res = await API.get(cfg.endpoint + (qs ? `?${qs}` : ''));
          state.rows = res.data;
          if (cfg.context) state.ctx = await cfg.context();
          body.innerHTML = '';
          const cols = cfg.columns(openForm, remove, load, state);
          body.appendChild(table(cols, state.rows, { empty: cfg.empty || 'Aucun élément pour l’instant.' }));
        } catch (e) {
          body.innerHTML = '';
          body.appendChild(el('div', { class: 'empty', text: e.message }));
        }
      }

      async function openForm(row) {
        if (cfg.context && !Object.keys(state.ctx).length) state.ctx = await cfg.context();
        const values = cfg.toForm ? cfg.toForm(row || {}, state.ctx) : { ...(row || {}) };
        formModal({
          title: row ? `${cfg.editLabel || 'Modifier'} — ${cfg.rowLabel ? cfg.rowLabel(row) : ''}` : (cfg.createLabel || 'Nouvel élément'),
          fields: cfg.fields(row, state.ctx),
          values,
          wide: cfg.wideForm,
          onSubmit: async (v) => {
            const payload = cfg.fromForm ? cfg.fromForm(v, row) : v;
            if (row) await API.put(`${cfg.endpoint}/${row.id}`, payload);
            else await API.post(cfg.endpoint, payload);
            toast(row ? 'Modifications enregistrées.' : 'Élément créé.');
            await load();
            if (cfg.afterSave) cfg.afterSave();
          },
        });
      }

      async function remove(row) {
        const ok = await confirmDialog(`Supprimer « ${cfg.rowLabel ? cfg.rowLabel(row) : row.id} » ? Cette action est définitive.`);
        if (!ok) return;
        try {
          await API.del(`${cfg.endpoint}/${row.id}`);
          toast('Élément supprimé.');
          await load();
        } catch (e) { toast(e.message, 'err'); }
      }

      await load();
    };
  }

  /* ------------------------ options de catégories -------------------- */
  async function categoryOptions(scope) {
    const { data } = await API.get('/api/admin/categories');
    return data.filter((c) => c.scope === scope).map((c) => ({ value: c.id, label: c.label }));
  }

  /* =====================================================================
     TABLEAU DE BORD
     ===================================================================== */
  async function dashboard(root) {
    root.innerHTML = '';
    root.appendChild(loader());
    const { data } = await API.get('/api/admin/dashboard');
    const s = data.stats;
    root.innerHTML = '';

    const cards = [
      ['Projets', s.projects, `${s.projectsPublished} publiés`, true],
      ['Produits', s.products, `${s.variants} formules`, true],
      ['Commandes', s.orders, `${s.ordersPending} en attente`, true],
      ['Messages', s.messages, `${s.messagesNew} non lus`, true],
      ['Clients', s.customers, 'enregistrés'],
      ['Médias', s.media, `${s.images} images · ${s.videos} vidéos`],
      ['Chiffre encaissé', `${Number(s.revenue).toLocaleString('fr-FR')}`, 'FCFA (commandes payées)'],
      ['Stockage', fmtBytes(s.storageBytes), 'fichiers médias'],
    ];

    root.appendChild(el('div', { class: 'grid grid-stats' }, cards.map(([l, v, sub, accent]) =>
      el('div', { class: `stat-card${accent ? ' accent' : ''}` }, [
        el('div', { class: 'v', text: v }),
        el('div', { class: 'l', text: l }),
        el('small', { text: sub }),
      ])
    )));

    const twoCol = el('div', { class: 'two-col', style: 'margin-top:16px' });

    const ordersCard = el('div', { class: 'card' }, [pageHead('Dernières commandes')]);
    ordersCard.appendChild(table([
      { key: 'ref', label: 'Réf.' },
      { key: 'customer_name', label: 'Client' },
      { label: 'Total', render: (r) => fmtPrice(r.total, r.currency) },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
    ], data.recentOrders, { empty: 'Aucune commande.' }));

    const msgCard = el('div', { class: 'card' }, [pageHead('Derniers messages')]);
    msgCard.appendChild(table([
      { key: 'name', label: 'De' },
      { key: 'email', label: 'E-mail' },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: 'Reçu', render: (r) => fmtDate(r.created_at) },
    ], data.recentMessages, { empty: 'Aucun message.' }));

    twoCol.appendChild(ordersCard);
    twoCol.appendChild(msgCard);
    root.appendChild(twoCol);

    const statsCard = el('div', { class: 'card', style: 'margin-top:16px' }, [
      pageHead('Statistiques affichées sur le site', 'Modifiables dans « Statistiques »'),
    ]);
    statsCard.appendChild(el('div', { class: 'grid grid-stats' }, data.publicStats.map((st) =>
      el('div', { class: 'stat-card' }, [
        el('div', { class: 'v', text: `${st.value}${st.suffix || ''}` }),
        el('div', { class: 'l', text: st.label }),
      ])
    )));
    root.appendChild(statsCard);

    const actCard = el('div', { class: 'card', style: 'margin-top:16px' }, [pageHead('Activité récente')]);
    actCard.appendChild(el('div', { class: 'list' }, data.activity.length ? data.activity.map((a) =>
      el('div', { class: 'list-item' }, [
        el('span', { class: 'badge', text: a.action }),
        el('div', { class: 'grow' }, [
          el('div', { class: 't', text: `${a.entity}${a.label ? ' — ' + a.label : ''}` }),
          el('div', { class: 's', text: `${a.admin_name} · ${fmtDate(a.created_at)}` }),
        ]),
      ])
    ) : [el('div', { class: 'empty', text: 'Aucune activité enregistrée.' })]));
    root.appendChild(actCard);
  }

  /* =====================================================================
     PORTFOLIO
     ===================================================================== */
  const projects = resourceView({
    title: 'Projets / Réalisations',
    subtitle: 'Images, vidéos, catégorie, ordre d’affichage et visibilité',
    endpoint: '/api/admin/projects',
    addLabel: '＋ Nouveau projet',
    wideForm: true,
    rowLabel: (r) => r.title,
    context: async () => ({ categories: await categoryOptions('project') }),
    columns: (edit, remove) => [
      { label: '', render: (r) => mediaThumb(r.cover, { small: true }) },
      { key: 'title', label: 'Titre' },
      { label: 'Catégorie', render: (r) => r.category?.label || '' },
      { label: 'Médias', render: (r) => `${r.gallery.length} img${r.video || r.video_url ? ' + vidéo' : ''}` },
      { label: 'À la une', render: (r) => (r.featured ? el('span', { class: 'badge green', text: '★' }) : '') },
      { key: 'position', label: 'Ordre' },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      {
        label: '', align: 'right', render: (r) => actions([
          { label: r.status === 'published' ? 'Masquer' : 'Publier', onClick: async () => {
            await API.put(`/api/admin/projects/${r.id}`, { status: r.status === 'published' ? 'draft' : 'published' });
            toast('Statut mis à jour.');
            document.dispatchEvent(new CustomEvent('admin:refresh'));
          } },
          { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
          { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
        ]),
      },
    ],
    toForm: (r) => ({
      ...r,
      cover_media_id_object: r.cover || null,
      video_media_id_object: r.video || null,
      gallery_ids_object: r.gallery || [],
      tools: r.tools || [],
    }),
    fields: (row, ctx) => [
      { name: 'title', label: 'Titre du projet', type: 'text', required: true },
      { name: 'category_id', label: 'Catégorie', type: 'select', options: [{ value: '', label: '— Aucune —' }].concat(ctx.categories || []) },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'cover_media_id', label: 'Image principale', type: 'media', kind: 'image', folder: 'projets' },
      { name: 'gallery_ids', label: 'Galerie d’images', type: 'gallery', kind: 'image', folder: 'projets' },
      { name: 'video_media_id', label: 'Vidéo (fichier importé)', type: 'media', kind: 'video', folder: 'projets' },
      { name: 'video_url', label: 'Vidéo (lien Vimeo / YouTube)', type: 'text', help: 'Utilisé si aucun fichier vidéo n’est importé. Colle l’URL d’intégration (embed).' },
      { name: 'external_url', label: 'Lien externe', type: 'text' },
      { name: 'tools', label: 'Outils utilisés', type: 'tags', placeholder: 'Photoshop, Midjourney…' },
      { name: 'project_date', label: 'Date', type: 'text', placeholder: '2026-01' },
      { name: 'gradient', label: 'Dégradé de secours', type: 'text', help: 'Affiché si aucune image. Ex : linear-gradient(135deg,#1F3350,#4ADE80)' },
      { name: 'status', label: 'Statut', type: 'select', options: STATUS_DRAFT },
      { name: 'featured', label: 'Mettre en avant', type: 'checkbox' },
      { name: 'position', label: 'Ordre d’affichage', type: 'number' },
    ],
  });

  const projectCategories = resourceView({
    title: 'Catégories de projets',
    endpoint: '/api/admin/categories',
    addLabel: '＋ Nouvelle catégorie',
    rowLabel: (r) => r.label,
    columns: (edit, remove) => [
      { key: 'label', label: 'Libellé' },
      { key: 'slug', label: 'Identifiant' },
      { key: 'short_label', label: 'Étiquette courte' },
      { key: 'position', label: 'Ordre' },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: '', align: 'right', render: (r) => actions([
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    fields: () => [
      { name: 'label', label: 'Libellé', type: 'text', required: true },
      { name: 'short_label', label: 'Étiquette courte (sur les cartes)', type: 'text' },
      { name: 'scope', label: 'Type', type: 'select', options: [{ value: 'project', label: 'Projets' }, { value: 'product', label: 'Produits (boutique)' }] },
      { name: 'position', label: 'Ordre', type: 'number' },
      { name: 'status', label: 'Statut', type: 'select', options: STATUS_OPTS },
    ],
    toForm: (r) => ({ scope: 'project', ...r }),
  });

  const services = resourceView({
    title: 'Services',
    endpoint: '/api/admin/services',
    addLabel: '＋ Nouveau service',
    rowLabel: (r) => r.title,
    columns: (edit, remove) => [
      { key: 'title', label: 'Service' },
      { key: 'description', label: 'Description' },
      { key: 'position', label: 'Ordre' },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: '', align: 'right', render: (r) => actions([
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    fields: () => [
      { name: 'title', label: 'Titre', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'media_id', label: 'Illustration (optionnel)', type: 'media', kind: 'image', folder: 'services' },
      { name: 'icon', label: 'Icône SVG (contenu interne)', type: 'textarea', rows: 2, help: 'Ex : <path d="M12 3l2.5 5…"/> — laisse vide pour l’icône par défaut.' },
      { name: 'position', label: 'Ordre', type: 'number' },
      { name: 'status', label: 'Statut', type: 'select', options: STATUS_OPTS },
    ],
    toForm: (r) => ({ ...r, media_id_object: r.media || null }),
  });

  const skills = resourceView({
    title: 'Compétences / Outils',
    subtitle: 'Logiciels et IA affichés dans la section « Outils »',
    endpoint: '/api/admin/skills',
    addLabel: '＋ Nouvel outil',
    rowLabel: (r) => r.name,
    columns: (edit, remove) => [
      { label: '', render: (r) => (r.media ? mediaThumb(r.media, { small: true }) : el('span', { class: 'badge', text: r.avatar || '—' })) },
      { key: 'name', label: 'Nom' },
      { key: 'group_label', label: 'Groupe' },
      { key: 'position', label: 'Ordre' },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: '', align: 'right', render: (r) => actions([
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    fields: () => [
      { name: 'name', label: 'Nom de l’outil', type: 'text', required: true },
      { name: 'group_label', label: 'Groupe', type: 'text', help: 'Ex : LOGICIELS ou INTELLIGENCE ARTIFICIELLE' },
      { name: 'avatar', label: 'Initiales', type: 'text', help: '2 lettres affichées si aucun logo' },
      { name: 'media_id', label: 'Logo de l’outil', type: 'media', kind: 'image', folder: 'logos' },
      { name: 'position', label: 'Ordre', type: 'number' },
      { name: 'status', label: 'Statut', type: 'select', options: STATUS_OPTS },
    ],
    toForm: (r) => ({ ...r, media_id_object: r.media || null }),
  });

  const testimonials = resourceView({
    title: 'Témoignages',
    subtitle: 'Les avis envoyés depuis le site arrivent « En attente »',
    endpoint: '/api/admin/testimonials',
    addLabel: '＋ Nouveau témoignage',
    rowLabel: (r) => r.author,
    columns: (edit, remove) => [
      { key: 'author', label: 'Auteur' },
      { key: 'content', label: 'Commentaire' },
      { label: 'Note', render: (r) => '★'.repeat(r.rating || 0) },
      { label: 'Reçu', render: (r) => fmtDate(r.created_at) },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: '', align: 'right', render: (r) => actions([
        r.status !== 'published' ? { label: 'Publier', onClick: async () => { await API.put(`/api/admin/testimonials/${r.id}`, { status: 'published' }); toast('Témoignage publié.'); document.dispatchEvent(new CustomEvent('admin:refresh')); } } : null,
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    fields: () => [
      { name: 'author', label: 'Auteur', type: 'text', required: true },
      { name: 'role', label: 'Rôle / entreprise', type: 'text' },
      { name: 'content', label: 'Commentaire', type: 'textarea', required: true },
      { name: 'rating', label: 'Note (1-5)', type: 'number' },
      { name: 'status', label: 'Statut', type: 'select', options: [{ value: 'pending', label: 'En attente' }].concat(STATUS_OPTS) },
      { name: 'position', label: 'Ordre', type: 'number' },
    ],
  });

  const faqs = resourceView({
    title: 'FAQ',
    endpoint: '/api/admin/faqs',
    addLabel: '＋ Nouvelle question',
    rowLabel: (r) => r.question,
    columns: (edit, remove) => [
      { key: 'question', label: 'Question' },
      { key: 'position', label: 'Ordre' },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: '', align: 'right', render: (r) => actions([
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    fields: () => [
      { name: 'question', label: 'Question', type: 'text', required: true },
      { name: 'answer', label: 'Réponse', type: 'textarea', required: true },
      { name: 'position', label: 'Ordre', type: 'number' },
      { name: 'status', label: 'Statut', type: 'select', options: STATUS_OPTS },
    ],
  });

  const stats = resourceView({
    title: 'Statistiques',
    subtitle: 'Compteurs animés affichés sur la page d’accueil',
    endpoint: '/api/admin/stats',
    addLabel: '＋ Nouvelle statistique',
    rowLabel: (r) => r.label,
    columns: (edit, remove) => [
      { key: 'label', label: 'Libellé' },
      { label: 'Valeur', render: (r) => `${r.value}${r.suffix || ''}` },
      { key: 'key', label: 'Clé' },
      { key: 'position', label: 'Ordre' },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: '', align: 'right', render: (r) => actions([
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    fields: (row) => [
      { name: 'label', label: 'Libellé affiché', type: 'text', required: true },
      { name: 'value', label: 'Valeur', type: 'number', required: true },
      { name: 'suffix', label: 'Suffixe', type: 'text', help: 'Ex : + ou %' },
      { name: 'key', label: 'Clé technique', type: 'text', required: true, help: 'Sans espace, ex : projets_realises' },
      { name: 'position', label: 'Ordre', type: 'number' },
      { name: 'status', label: 'Statut', type: 'select', options: STATUS_OPTS },
    ],
    toForm: (r) => ({ suffix: '', value: 0, position: 0, status: 'published', ...r }),
  });

  /* =====================================================================
     MÉDIATHÈQUE
     ===================================================================== */
  function mediaView(kind, title, subtitle) {
    return async function render(root) {
      root.innerHTML = '';
      const card = el('div', { class: 'card' });
      const grid = el('div', { class: 'media-grid' });
      const fileInput = el('input', {
        type: 'file', multiple: true, style: 'display:none',
        accept: kind === 'video' ? 'video/*' : (kind === 'file' ? '*/*' : 'image/*'),
      });
      const status = el('span', { class: 'muted', style: 'font-size:13px' });

      card.appendChild(pageHead(title, subtitle, el('button', {
        class: 'btn btn-primary', type: 'button', text: '＋ Importer', onclick: () => fileInput.click(),
      })));
      card.appendChild(el('div', { class: 'toolbar' }, [status, fileInput]));
      card.appendChild(grid);
      root.appendChild(card);

      fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files || []);
        for (const file of files) {
          status.textContent = `Import de ${file.name}…`;
          try { await UI.uploadFile(file, { kind, folder: kind === 'logo' ? 'logos' : 'general' }); }
          catch (e) { toast(`${file.name} : ${e.message}`, 'err'); }
        }
        status.textContent = '';
        fileInput.value = '';
        toast('Import terminé.');
        load();
      });

      async function load() {
        grid.innerHTML = '';
        grid.appendChild(loader());
        const { data } = await API.get(`/api/admin/media?kind=${encodeURIComponent(kind)}`);
        grid.innerHTML = '';
        if (!data.length) { grid.appendChild(el('div', { class: 'empty', text: 'Aucun fichier pour l’instant.' })); return; }
        data.forEach((m) => {
          const item = el('div', { class: 'media-item' }, [
            el('div', { class: 'box' }, [
              m.kind === 'video'
                ? el('video', { src: API.mediaUrl(m), controls: true, preload: 'metadata' })
                : (m.kind === 'file'
                  ? el('span', { class: 'muted', text: (m.original_name || '').split('.').pop().toUpperCase() })
                  : el('img', { src: API.mediaUrl(m), alt: m.alt || '', loading: 'lazy' })),
            ]),
            el('div', { class: 'meta', title: m.original_name, text: m.title || m.original_name }),
            el('div', { class: 'meta', style: 'display:flex;gap:5px;flex-wrap:wrap' }, [
              el('button', { class: 'btn btn-sm', type: 'button', text: 'Infos', onclick: () => editMeta(m) }),
              el('button', { class: 'btn btn-sm', type: 'button', text: 'Remplacer', onclick: () => replace(m) }),
              el('button', { class: 'btn btn-sm btn-danger', type: 'button', text: '✕', onclick: () => remove(m) }),
            ]),
          ]);
          grid.appendChild(item);
        });
      }

      function editMeta(m) {
        formModal({
          title: 'Informations du média',
          fields: [
            { name: 'title', label: 'Titre', type: 'text' },
            { name: 'alt', label: 'Texte alternatif (accessibilité / SEO)', type: 'text' },
            { name: 'folder', label: 'Dossier', type: 'text' },
            { name: 'infos', label: 'Détails', type: 'static' },
          ],
          values: { ...m, infos: `${m.mime} · ${fmtBytes(m.size)} · importé le ${fmtDate(m.created_at)} · URL stable ${m.url}` },
          onSubmit: async (v) => {
            await API.put(`/api/admin/media/${m.id}`, { title: v.title, alt: v.alt, folder: v.folder });
            toast('Média mis à jour.');
            load();
          },
        });
      }

      function replace(m) {
        const input = el('input', { type: 'file', style: 'display:none', accept: m.kind === 'video' ? 'video/*' : 'image/*' });
        document.body.appendChild(input);
        input.addEventListener('change', async () => {
          const file = input.files[0];
          if (file) {
            try {
              const fd = new FormData();
              fd.append('file', file);
              await API.post(`/api/admin/media/${m.id}/file`, fd);
              toast('Fichier remplacé — le site utilise automatiquement le nouveau.');
              load();
            } catch (e) { toast(e.message, 'err'); }
          }
          input.remove();
        });
        input.click();
      }

      async function remove(m) {
        const ok = await confirmDialog(`Supprimer « ${m.title || m.original_name} » ? Les éléments qui l’utilisent perdront cette image.`);
        if (!ok) return;
        await API.del(`/api/admin/media/${m.id}`);
        toast('Média supprimé.');
        load();
      }

      await load();
    };
  }

  /* =====================================================================
     BOUTIQUE
     ===================================================================== */
  function variantsModal(product, onDone) {
    const list = el('div', {});
    const body = el('div', {}, [
      el('p', { class: 'muted', style: 'margin-top:0', text: `Formules et prix de « ${product.name} ». Les prix affichés sur la boutique viennent d’ici.` }),
      list,
      el('button', {
        class: 'btn btn-primary', type: 'button', style: 'margin-top:12px', text: '＋ Ajouter une formule',
        onclick: () => editVariant(null),
      }),
    ]);

    async function load() {
      list.innerHTML = '';
      list.appendChild(loader());
      const { data } = await API.get(`/api/admin/shop/products/${product.id}/variants`);
      list.innerHTML = '';
      if (!data.length) list.appendChild(el('div', { class: 'empty', text: 'Aucune formule. Ajoute par exemple « 12 mois ».' }));
      data.forEach((v) => {
        list.appendChild(el('div', { class: 'list-item' }, [
          el('div', { class: 'grow' }, [
            el('div', { class: 't', text: v.label }),
            el('div', { class: 's', text: `${fmtPrice(v.price, v.currency)}${v.old_price ? ` · ancien prix ${fmtPrice(v.old_price, v.currency)}` : ''} · ${v.slug}` }),
          ]),
          statusBadge(v.status),
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Modifier', onclick: () => editVariant(v) }),
          el('button', { class: 'btn btn-sm btn-danger', type: 'button', text: '✕', onclick: async () => {
            if (!(await confirmDialog(`Supprimer la formule « ${v.label} » ?`))) return;
            await API.del(`/api/admin/shop/variants/${v.id}`);
            toast('Formule supprimée.');
            load(); if (onDone) onDone();
          } }),
        ]));
      });
    }

    function editVariant(v) {
      formModal({
        title: v ? `Modifier la formule — ${v.label}` : 'Nouvelle formule',
        fields: [
          { name: 'label', label: 'Formule (durée)', type: 'text', required: true, placeholder: '12 mois' },
          { name: 'price', label: 'Prix', type: 'number', required: true, help: 'En FCFA, sans espace. 0 = « Prix sur demande ».' },
          { name: 'old_price', label: 'Ancien prix (barré)', type: 'number' },
          { name: 'currency', label: 'Devise', type: 'text' },
          { name: 'note', label: 'Note', type: 'text' },
          { name: 'position', label: 'Ordre', type: 'number' },
          { name: 'status', label: 'Statut', type: 'select', options: STATUS_OPTS },
        ],
        values: v || { currency: 'FCFA', price: 0, old_price: 0, position: 0, status: 'published' },
        onSubmit: async (values) => {
          if (v) await API.put(`/api/admin/shop/variants/${v.id}`, values);
          else await API.post(`/api/admin/shop/products/${product.id}/variants`, values);
          toast('Formule enregistrée — la boutique est à jour.');
          load(); if (onDone) onDone();
        },
      });
    }

    modal({ title: `Formules & prix — ${product.name}`, body, wide: true });
    load();
  }
  const modal = UI.modal;

  const products = resourceView({
    title: 'Produits',
    subtitle: 'Boutique : fiches produits, images, disponibilité',
    endpoint: '/api/admin/shop/products',
    addLabel: '＋ Nouveau produit',
    wideForm: true,
    rowLabel: (r) => r.name,
    context: async () => ({ categories: await categoryOptions('product') }),
    columns: (edit, remove, reload) => [
      { label: '', render: (r) => (r.image ? mediaThumb(r.image, { small: true }) : el('span', { class: 'badge', text: r.avatar || '—' })) },
      { key: 'name', label: 'Produit' },
      { label: 'Catégorie', render: (r) => r.category?.label || '' },
      { label: 'Prix', render: (r) => {
        const prices = r.variants.filter((v) => v.price > 0).map((v) => v.price);
        return prices.length ? `dès ${fmtPrice(Math.min(...prices))}` : 'Sur demande';
      } },
      { label: 'Formules', render: (r) => el('button', {
        class: 'btn btn-sm', type: 'button', text: `${r.variants.length} formule(s)`,
        onclick: () => variantsModal(r, reload),
      }) },
      { label: 'Dispo.', render: (r) => statusBadge(r.availability) },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: '', align: 'right', render: (r) => actions([
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    toForm: (r) => ({
      ...r,
      image_media_id_object: r.image || null,
      gallery_ids_object: r.gallery || [],
      highlights: r.highlights || [],
    }),
    fields: (row, ctx) => [
      { name: 'name', label: 'Nom du produit', type: 'text', required: true },
      { name: 'category_id', label: 'Catégorie', type: 'select', options: [{ value: '', label: '— Aucune —' }].concat(ctx.categories || []) },
      { name: 'tagline', label: 'Accroche', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'highlights', label: 'Points forts', type: 'tags', placeholder: 'Un avantage puis Entrée…' },
      { name: 'image_media_id', label: 'Image principale', type: 'media', kind: 'image', folder: 'produits' },
      { name: 'gallery_ids', label: 'Galerie', type: 'gallery', kind: 'image', folder: 'produits' },
      { name: 'badge', label: 'Badge', type: 'text', placeholder: 'Populaire, À vie…' },
      { name: 'avatar', label: 'Initiales', type: 'text', help: 'Affichées si aucune image' },
      { name: 'gradient', label: 'Dégradé', type: 'text' },
      { name: 'availability', label: 'Disponibilité', type: 'select', options: [
        { value: 'in_stock', label: 'Disponible' }, { value: 'out_of_stock', label: 'Épuisé' }, { value: 'on_request', label: 'Sur demande' },
      ] },
      { name: 'status', label: 'Statut', type: 'select', options: STATUS_DRAFT },
      { name: 'featured', label: 'Produit mis en avant', type: 'checkbox' },
      { name: 'position', label: 'Ordre d’affichage', type: 'number' },
    ],
  });

  const shopCategories = resourceView({
    title: 'Catégories de la boutique',
    endpoint: '/api/admin/categories',
    addLabel: '＋ Nouvelle catégorie',
    rowLabel: (r) => r.label,
    columns: (edit, remove) => [
      { key: 'label', label: 'Libellé' },
      { key: 'slug', label: 'Identifiant' },
      { key: 'position', label: 'Ordre' },
      { label: 'Statut', render: (r) => statusBadge(r.status) },
      { label: '', align: 'right', render: (r) => actions([
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    fields: () => [
      { name: 'label', label: 'Libellé', type: 'text', required: true },
      { name: 'position', label: 'Ordre', type: 'number' },
      { name: 'status', label: 'Statut', type: 'select', options: STATUS_OPTS },
      { name: 'scope', label: 'Type', type: 'hidden' },
    ],
    toForm: (r) => ({ scope: 'product', ...r }),
    fromForm: (v) => ({ ...v, scope: 'product' }),
  });

  async function orders(root) {
    root.innerHTML = '';
    const card = el('div', { class: 'card' });
    const body = el('div', {});
    const filterSel = el('select', {}, [
      el('option', { value: '', text: 'Tous les statuts' }),
      ...['pending', 'paid', 'processing', 'completed', 'cancelled'].map((s) => el('option', { value: s, text: s })),
    ]);
    const search = el('input', { type: 'search', placeholder: 'Référence, client…' });
    card.appendChild(pageHead('Commandes', 'Le paiement n’est jamais confirmé automatiquement par un clic client'));
    card.appendChild(el('div', { class: 'toolbar' }, [search, filterSel]));
    card.appendChild(body);
    root.appendChild(card);

    filterSel.addEventListener('change', load);
    let t = null;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });

    async function load() {
      body.innerHTML = '';
      body.appendChild(loader());
      const params = new URLSearchParams();
      if (filterSel.value) params.set('status', filterSel.value);
      if (search.value.trim()) params.set('q', search.value.trim());
      const { data } = await API.get(`/api/admin/shop/orders${params.toString() ? `?${params}` : ''}`);
      body.innerHTML = '';
      body.appendChild(table([
        { key: 'ref', label: 'Référence' },
        { label: 'Client', render: (r) => `${r.customer_name}${r.customer_phone ? ' · ' + r.customer_phone : ''}` },
        { label: 'Articles', render: (r) => r.items.map((i) => `${i.product_name} (${i.variant_label}) ×${i.qty}`).join(', ') },
        { label: 'Total', render: (r) => fmtPrice(r.total, r.currency) },
        { label: 'Date', render: (r) => fmtDate(r.created_at) },
        { label: 'Commande', render: (r) => statusBadge(r.status) },
        { label: 'Paiement', render: (r) => statusBadge(r.payment_status) },
        { label: '', align: 'right', render: (r) => actions([
          { label: 'Détails', class: 'btn-ghost', onClick: () => detail(r) },
          { label: 'Suppr.', class: 'btn-danger', onClick: async () => {
            if (!(await confirmDialog(`Supprimer la commande ${r.ref} ?`))) return;
            await API.del(`/api/admin/shop/orders/${r.id}`);
            toast('Commande supprimée.'); load();
          } },
        ]) },
      ], data, { empty: 'Aucune commande.' }));
    }

    function detail(order) {
      formModal({
        title: `Commande ${order.ref}`,
        wide: true,
        fields: [
          { name: 'recap', label: 'Récapitulatif', type: 'static' },
          { name: 'client', label: 'Client', type: 'static' },
          { name: 'note', label: 'Note du client', type: 'static' },
          { name: 'status', label: 'Statut de la commande', type: 'select', options: [
            { value: 'pending', label: 'En attente' }, { value: 'paid', label: 'Payée' },
            { value: 'processing', label: 'Traitement' }, { value: 'completed', label: 'Terminée' },
            { value: 'cancelled', label: 'Annulée' },
          ] },
          { name: 'payment_status', label: 'Statut du paiement', type: 'select', options: [
            { value: 'unpaid', label: 'Non payé' }, { value: 'pending', label: 'En attente' },
            { value: 'paid', label: 'Payé (confirmé)' }, { value: 'failed', label: 'Échec' }, { value: 'refunded', label: 'Remboursé' },
          ], help: 'À confirmer manuellement tant qu’aucun prestataire de paiement n’est branché.' },
          { name: 'payment_method', label: 'Moyen de paiement', type: 'text' },
          { name: 'payment_reference', label: 'Référence de transaction', type: 'text' },
          { name: 'admin_note', label: 'Note interne', type: 'textarea' },
        ],
        values: {
          ...order,
          recap: order.items.map((i) => `${i.product_name} — ${i.variant_label} ×${i.qty} = ${fmtPrice(i.line_total)}`).join(' | ') + ` → Total ${fmtPrice(order.total, order.currency)}`,
          client: `${order.customer_name} · ${order.customer_phone || '—'} · ${order.customer_email || '—'}`,
          note: order.note || '—',
        },
        onSubmit: async (v) => {
          await API.put(`/api/admin/shop/orders/${order.id}`, v);
          toast('Commande mise à jour.');
          load();
        },
      });
    }

    await load();
  }

  const customers = resourceView({
    title: 'Clients',
    subtitle: 'Créés automatiquement à la première commande',
    endpoint: '/api/admin/shop/customers',
    addLabel: '＋ Nouveau client',
    rowLabel: (r) => r.name || r.email,
    columns: (edit, remove) => [
      { key: 'name', label: 'Nom' },
      { key: 'phone', label: 'Téléphone' },
      { key: 'email', label: 'E-mail' },
      { key: 'orders_count', label: 'Commandes' },
      { label: 'Total payé', render: (r) => fmtPrice(r.total_spent) },
      { label: 'Depuis', render: (r) => fmtDate(r.created_at) },
      { label: '', align: 'right', render: (r) => actions([
        { label: 'Modifier', class: 'btn-ghost', onClick: () => edit(r) },
        { label: 'Suppr.', class: 'btn-danger', onClick: () => remove(r) },
      ]) },
    ],
    fields: () => [
      { name: 'name', label: 'Nom', type: 'text' },
      { name: 'phone', label: 'Téléphone', type: 'text' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'note', label: 'Note interne', type: 'textarea' },
    ],
  });

  /* =====================================================================
     MESSAGES
     ===================================================================== */
  async function messages(root) {
    root.innerHTML = '';
    const card = el('div', { class: 'card' });
    const body = el('div', {});
    const filterSel = el('select', {}, [
      el('option', { value: '', text: 'Tous' }),
      el('option', { value: 'new', text: 'Non lus' }),
      el('option', { value: 'read', text: 'Lus' }),
      el('option', { value: 'archived', text: 'Archivés' }),
    ]);
    card.appendChild(pageHead('Messages', 'Formulaire de contact du portfolio'));
    card.appendChild(el('div', { class: 'toolbar' }, [filterSel]));
    card.appendChild(body);
    root.appendChild(card);
    filterSel.addEventListener('change', load);

    async function load() {
      body.innerHTML = '';
      body.appendChild(loader());
      const { data } = await API.get(`/api/admin/messages${filterSel.value ? `?status=${filterSel.value}` : ''}`);
      body.innerHTML = '';
      body.appendChild(el('div', { class: 'list' }, data.length ? data.map((m) => el('div', { class: 'list-item' }, [
        statusBadge(m.status),
        el('div', { class: 'grow' }, [
          el('div', { class: 't', text: `${m.name} — ${m.email}` }),
          el('div', { class: 's', text: m.message.slice(0, 120) + (m.message.length > 120 ? '…' : '') }),
          el('div', { class: 's', text: fmtDate(m.created_at) }),
        ]),
        el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Lire', onclick: () => read(m) }),
        el('button', { class: 'btn btn-sm btn-danger', type: 'button', text: '✕', onclick: async () => {
          if (!(await confirmDialog('Supprimer ce message ?'))) return;
          await API.del(`/api/admin/messages/${m.id}`); toast('Message supprimé.'); load();
        } }),
      ])) : [el('div', { class: 'empty', text: 'Aucun message.' })]));
    }

    async function read(m) {
      if (m.status === 'new') { await API.put(`/api/admin/messages/${m.id}`, { status: 'read' }); }
      UI.modal({
        title: `Message de ${m.name}`,
        body: el('div', {}, [
          el('p', { class: 'muted', text: `${m.email}${m.phone ? ' · ' + m.phone : ''} · ${fmtDate(m.created_at)}` }),
          m.subject ? el('p', { html: `<strong>${UI.esc(m.subject)}</strong>` }) : null,
          el('p', { text: m.message, style: 'white-space:pre-wrap' }),
        ]),
        actions: [
          { label: 'Archiver', class: 'btn-ghost', onClick: async (close) => { await API.put(`/api/admin/messages/${m.id}`, { status: 'archived' }); close(); toast('Message archivé.'); load(); } },
          { label: 'Répondre par e-mail', class: 'btn-primary', onClick: (close) => { window.open(`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Votre message'))}`, '_blank'); close(); load(); } },
        ],
      });
      load();
    }

    await load();
  }

  /* =====================================================================
     PARAMÈTRES
     ===================================================================== */
  const GROUP_LABELS = {
    identite: 'Identité & logos', hero: 'Section d’accueil (hero)', about: 'À propos',
    sections: 'Titres des sections', contact: 'Coordonnées', social: 'Réseaux sociaux',
    boutique: 'Boutique', seo: 'SEO', general: 'Divers',
  };

  async function settings(root) {
    root.innerHTML = '';
    root.appendChild(loader());
    const { data } = await API.get('/api/admin/settings');
    const mediaCache = {};
    await Promise.all(data.filter((s) => s.type === 'media' && s.value).map(async (s) => {
      try { mediaCache[s.value] = (await API.get(`/api/admin/media/${s.value}`)).data; } catch (_) { /* média supprimé */ }
    }));

    root.innerHTML = '';
    const groups = {};
    data.forEach((s) => { (groups[s.group_name] = groups[s.group_name] || []).push(s); });

    Object.entries(groups).forEach(([group, items]) => {
      const card = el('div', { class: 'card' });
      card.appendChild(pageHead(GROUP_LABELS[group] || group));
      const fields = items.map((s) => {
        const base = { name: s.key, label: s.label || s.key, help: s.help };
        if (s.type === 'media') {
          const isLogo = /logo|favicon/.test(s.key);
          return { ...base, type: 'media', kind: 'image', uploadKind: isLogo ? 'logo' : 'image', folder: isLogo ? 'logos' : group };
        }
        if (s.type === 'textarea') return { ...base, type: 'textarea' };
        if (s.type === 'json') return { ...base, type: 'textarea', help: (s.help || '') + ' (format JSON)' };
        if (s.type === 'number') return { ...base, type: 'number' };
        if (s.type === 'boolean') return { ...base, type: 'checkbox' };
        return { ...base, type: 'text' };
      });
      const values = {};
      items.forEach((s) => {
        values[s.key] = s.value;
        if (s.type === 'media' && mediaCache[s.value]) values[`${s.key}_object`] = mediaCache[s.value];
      });
      const built = UI.buildForm(fields, values);
      card.appendChild(built.node);
      const saveBtn = el('button', { class: 'btn btn-primary', type: 'button', style: 'margin-top:14px', text: 'Enregistrer' });
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement…';
        try {
          await API.put('/api/admin/settings', { values: built.values() });
          toast('Paramètres enregistrés — le site est à jour.');
        } catch (e) { toast(e.message, 'err'); }
        saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer';
      });
      card.appendChild(saveBtn);
      root.appendChild(card);
    });
  }

  /* =====================================================================
     COMPTE
     ===================================================================== */
  async function account(root) {
    root.innerHTML = '';
    const { data: me } = await API.get('/api/auth/me');

    const profileCard = el('div', { class: 'card' }, [pageHead('Mon profil')]);
    const profile = UI.buildForm([
      { name: 'name', label: 'Nom', type: 'text' },
      { name: 'email', label: 'E-mail de connexion', type: 'email' },
    ], me);
    profileCard.appendChild(profile.node);
    profileCard.appendChild(el('button', { class: 'btn btn-primary', style: 'margin-top:14px', type: 'button', text: 'Enregistrer', onclick: async (e) => {
      try { await API.put('/api/auth/profile', profile.values()); toast('Profil mis à jour.'); }
      catch (err) { toast(err.message, 'err'); }
    } }));

    const pwdCard = el('div', { class: 'card' }, [pageHead('Mot de passe', 'Minimum 10 caractères, avec majuscule, minuscule et chiffre')]);
    const pwd = UI.buildForm([
      { name: 'currentPassword', label: 'Mot de passe actuel', type: 'password' },
      { name: 'newPassword', label: 'Nouveau mot de passe', type: 'password' },
    ], {});
    pwdCard.appendChild(pwd.node);
    pwdCard.appendChild(el('button', { class: 'btn btn-primary', style: 'margin-top:14px', type: 'button', text: 'Changer le mot de passe', onclick: async () => {
      try {
        await API.post('/api/auth/change-password', pwd.values());
        toast('Mot de passe modifié. Reconnexion nécessaire.');
        setTimeout(() => window.location.reload(), 1200);
      } catch (e) { toast(e.message + (e.details ? ' ' + e.details.map((d) => d.message).join(' ') : ''), 'err'); }
    } }));

    const payCard = el('div', { class: 'card' }, [pageHead('Paiement en ligne', 'État de l’intégration')]);
    const { data: pay } = await API.get('/api/payments/config');
    payCard.appendChild(el('p', {
      class: 'muted',
      text: pay.configured
        ? `Prestataire actif : ${pay.provider}. Les paiements confirmés par webhook passent automatiquement les commandes en « Payée ».`
        : "Aucun prestataire de paiement n'est branché. Les commandes sont enregistrées puis confirmées manuellement. Pour activer un vrai paiement (Kkiapay, FedaPay, Stripe…), ajoute un adaptateur dans server/src/lib/payments.js et renseigne les variables d'environnement PAYMENT_*.",
    }));

    root.appendChild(profileCard);
    root.appendChild(pwdCard);
    root.appendChild(payCard);
  }

  window.VIEWS = {
    dashboard,
    projects,
    'project-categories': projectCategories,
    services,
    skills,
    testimonials,
    faqs,
    stats,
    'media-images': mediaView('image', 'Images', 'Photos et visuels du site'),
    'media-videos': mediaView('video', 'Vidéos', 'Fichiers vidéo hébergés sur le serveur'),
    'media-logos': mediaView('logo', 'Logos', 'Logo principal, logo boutique, favicon, logos d’outils'),
    'media-files': mediaView('file', 'Fichiers', 'PDF et autres documents'),
    products,
    'shop-categories': shopCategories,
    orders,
    customers,
    messages,
    settings,
    account,
  };
})();
