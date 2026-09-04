/* =====================================================================
   Composants d'interface réutilisables : toasts, modales, formulaires,
   sélecteur de médias, tableaux. Aucune dépendance externe.
   ===================================================================== */
(function () {
  /* ------------------------------ helpers --------------------------- */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => { node.dataset[dk] = dv; });
      else node.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtPrice = (n, c = 'FCFA') => (!n || n <= 0 ? 'Prix sur demande' : `${Number(n).toLocaleString('fr-FR')} ${c}`);
  const fmtDate = (d) => {
    if (!d) return '—';
    const date = new Date(d.includes('T') ? d : d.replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? d : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  };
  const fmtBytes = (b) => {
    if (!b) return '0 o';
    const u = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
  };

  /* ------------------------------ toasts ---------------------------- */
  function toast(message, type = 'ok') {
    const box = document.getElementById('toasts');
    const t = el('div', { class: `toast ${type}`, text: message });
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 3200);
  }

  /* ------------------------------ modales --------------------------- */
  function modal({ title, body, actions = [], wide = false, onClose }) {
    const root = document.getElementById('modalRoot');
    const backdrop = el('div', { class: 'modal-backdrop' });
    const closeBtn = el('button', { class: 'icon-btn', text: '✕', title: 'Fermer' });
    const foot = el('div', { class: 'modal-foot' });
    const box = el('div', { class: `modal${wide ? ' wide' : ''}` }, [
      el('div', { class: 'modal-head' }, [el('h3', { text: title }), el('div', { class: 'spacer' }), closeBtn]),
      el('div', { class: 'modal-body' }, [body]),
      foot,
    ]);
    const wrapper = el('div', {}, [backdrop, box]);

    function close() {
      wrapper.remove();
      if (!root.children.length) root.classList.remove('open');
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    actions.forEach((a) => {
      const b = el('button', { class: `btn ${a.class || ''}`, text: a.label, type: 'button' });
      b.addEventListener('click', () => a.onClick(close, b));
      foot.appendChild(b);
    });
    if (!actions.length) foot.remove();

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    root.appendChild(wrapper);
    root.classList.add('open');
    return { close, box };
  }

  function confirmDialog(message, { title = 'Confirmer', danger = true, confirmLabel = 'Supprimer' } = {}) {
    return new Promise((resolve) => {
      modal({
        title,
        body: el('p', { text: message, style: 'margin:0' }),
        actions: [
          { label: 'Annuler', class: 'btn-ghost', onClick: (close) => { close(); resolve(false); } },
          { label: confirmLabel, class: danger ? 'btn-danger' : 'btn-primary', onClick: (close) => { close(); resolve(true); } },
        ],
        onClose: () => resolve(false),
      });
    });
  }

  /* --------------------------- sélecteur média ---------------------- */
  async function uploadFile(file, { kind, folder = 'general' } = {}) {
    const fd = new FormData();
    fd.append('file', file);
    if (kind) fd.append('kind', kind);
    fd.append('folder', folder);
    const res = await API.post('/api/admin/media', fd);
    return res.data;
  }

  function mediaThumb(m, { small = false } = {}) {
    if (!m) return el('div', { class: small ? 'thumb-ph' : 'media-preview-ph', text: 'vide' });
    if (m.kind === 'video') {
      return el('video', { src: API.mediaUrl(m), class: small ? 'thumb' : 'media-preview', muted: true, playsinline: true });
    }
    return el('img', { src: API.mediaUrl(m), class: small ? 'thumb' : 'media-preview', alt: m.alt || '' });
  }

  function mediaPicker({ kind = null, folder = 'general' } = {}) {
    return new Promise((resolve) => {
      const grid = el('div', { class: 'media-grid' });
      const fileInput = el('input', { type: 'file', style: 'display:none', accept: kind === 'video' ? 'video/*' : (kind ? 'image/*' : 'image/*,video/*') });
      const status = el('div', { class: 'muted', style: 'font-size:13px' });
      let selected = null;

      async function load() {
        grid.innerHTML = '<div class="loader"><span class="spinner"></span></div>';
        try {
          // « image » inclut aussi les logos (ce sont des images)
          const wanted = kind === 'image' ? 'image,logo' : kind;
          const q = wanted ? `?kind=${encodeURIComponent(wanted)}` : '';
          const { data } = await API.get(`/api/admin/media${q}`);
          grid.innerHTML = '';
          if (!data.length) grid.appendChild(el('div', { class: 'empty', text: 'Aucun média. Importe ton premier fichier.' }));
          data.forEach((m) => {
            const item = el('div', { class: 'media-item' }, [
              el('div', { class: 'box' }, [mediaThumb(m)]),
              el('div', { class: 'meta', text: m.title || m.original_name }),
            ]);
            item.addEventListener('click', () => {
              grid.querySelectorAll('.media-item').forEach((n) => n.classList.remove('selected'));
              item.classList.add('selected');
              selected = m;
            });
            item.addEventListener('dblclick', () => { selected = m; done(); });
            grid.appendChild(item);
          });
        } catch (e) {
          grid.innerHTML = '';
          grid.appendChild(el('div', { class: 'empty', text: e.message }));
        }
      }

      let closeFn = () => {};
      function done() { closeFn(); resolve(selected); }

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        status.textContent = `Import de ${file.name}…`;
        try {
          const m = await uploadFile(file, { kind: kind || undefined, folder });
          status.textContent = '';
          toast('Fichier importé.');
          selected = m;
          await load();
        } catch (e) {
          status.textContent = '';
          toast(e.message, 'err');
        }
        fileInput.value = '';
      });

      const body = el('div', {}, [
        el('div', { class: 'toolbar' }, [
          el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '＋ Importer un fichier', onclick: () => fileInput.click() }),
          status, fileInput,
        ]),
        grid,
      ]);

      const m = modal({
        title: kind === 'video' ? 'Choisir une vidéo' : 'Choisir un média',
        body, wide: true,
        actions: [
          { label: 'Annuler', class: 'btn-ghost', onClick: (close) => { selected = null; close(); resolve(null); } },
          { label: 'Utiliser ce média', class: 'btn-primary', onClick: () => done() },
        ],
        onClose: () => resolve(selected),
      });
      closeFn = m.close;
      load();
    });
  }

  /* ---------------------------- formulaires ------------------------- */
  /**
   * fields: [{name, label, type, help, options, required, placeholder, folder, kind, cols}]
   * types : text | textarea | number | email | url | password | select | checkbox | tags | media | static
   */
  function buildForm(fields, values = {}) {
    const form = el('form', { class: 'form', autocomplete: 'off' });
    const getters = {};

    fields.forEach((f) => {
      if (f.type === 'hidden') { getters[f.name] = () => values[f.name]; return; }

      const row = el('div', { class: 'form-row' });
      const id = `f_${f.name}_${Math.random().toString(36).slice(2, 6)}`;
      const value = values[f.name] !== undefined && values[f.name] !== null ? values[f.name] : (f.default ?? '');

      if (f.type !== 'checkbox') row.appendChild(el('label', { for: id, text: f.label + (f.required ? ' *' : '') }));

      if (f.type === 'textarea') {
        const ta = el('textarea', { id, placeholder: f.placeholder || '', rows: f.rows || 4 });
        ta.value = value;
        row.appendChild(ta);
        getters[f.name] = () => ta.value;
      } else if (f.type === 'select') {
        const sel = el('select', { id });
        (typeof f.options === 'function' ? f.options() : f.options).forEach((o) => {
          const opt = el('option', { value: o.value, text: o.label });
          if (String(o.value) === String(value)) opt.selected = true;
          sel.appendChild(opt);
        });
        row.appendChild(sel);
        getters[f.name] = () => sel.value;
      } else if (f.type === 'checkbox') {
        const input = el('input', { type: 'checkbox', id });
        input.checked = !!value && value !== '0';
        row.appendChild(el('label', { class: 'switch', for: id }, [input, el('span', { text: f.label })]));
        getters[f.name] = () => (input.checked ? 1 : 0);
      } else if (f.type === 'tags') {
        const list = Array.isArray(value) ? value.slice() : (value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : []);
        const box = el('div', { class: 'tags-field' });
        const input = el('input', { type: 'text', placeholder: f.placeholder || 'Ajouter puis Entrée…' });
        function render() {
          box.innerHTML = '';
          list.forEach((tag, i) => {
            box.appendChild(el('span', { class: 'tag-chip' }, [
              el('span', { text: tag }),
              el('button', { type: 'button', text: '✕', onclick: () => { list.splice(i, 1); render(); } }),
            ]));
          });
          box.appendChild(input);
        }
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const v = input.value.trim();
            if (v) { list.push(v); input.value = ''; render(); }
          } else if (e.key === 'Backspace' && !input.value && list.length) {
            list.pop(); render();
          }
        });
        render();
        row.appendChild(box);
        getters[f.name] = () => list.slice();
      } else if (f.type === 'media') {
        let current = values[`${f.name}_object`] || null;
        const wrap = el('div', { class: 'media-field' });
        const fileInput = el('input', { type: 'file', style: 'display:none', accept: f.kind === 'video' ? 'video/*' : 'image/*' });
        function render() {
          wrap.innerHTML = '';
          wrap.appendChild(mediaThumb(current));
          wrap.appendChild(el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
            el('button', { class: 'btn btn-sm', type: 'button', text: 'Choisir', onclick: async () => {
              const m = await mediaPicker({ kind: f.kind || null, folder: f.folder || 'general' });
              if (m) { current = m; render(); }
            } }),
            el('button', { class: 'btn btn-sm', type: 'button', text: 'Importer', onclick: () => fileInput.click() }),
            current ? el('button', { class: 'btn btn-sm btn-danger', type: 'button', text: 'Retirer', onclick: () => { current = null; render(); } }) : null,
          ]));
          wrap.appendChild(fileInput);
        }
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files[0];
          if (!file) return;
          try {
            current = await uploadFile(file, { kind: f.uploadKind || f.kind || undefined, folder: f.folder || 'general' });
            toast('Fichier importé.');
            render();
          } catch (e) { toast(e.message, 'err'); }
          fileInput.value = '';
        });
        render();
        row.appendChild(wrap);
        getters[f.name] = () => (current ? current.id : '');
      } else if (f.type === 'gallery') {
        let items = (values[`${f.name}_object`] || []).slice();
        const wrap = el('div', { class: 'media-grid' });
        function render() {
          wrap.innerHTML = '';
          items.forEach((m, i) => {
            wrap.appendChild(el('div', { class: 'media-item' }, [
              el('div', { class: 'box' }, [mediaThumb(m)]),
              el('div', { class: 'meta', style: 'display:flex;gap:6px;align-items:center' }, [
                el('span', { text: `#${i + 1}`, style: 'flex:1' }),
                el('button', { class: 'btn btn-sm', type: 'button', text: '↑', onclick: () => { if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; render(); } } }),
                el('button', { class: 'btn btn-sm btn-danger', type: 'button', text: '✕', onclick: () => { items.splice(i, 1); render(); } }),
              ]),
            ]));
          });
          const add = el('div', { class: 'media-item', style: 'display:grid;place-items:center;min-height:110px' }, [
            el('span', { text: '＋ Ajouter', class: 'muted' }),
          ]);
          add.addEventListener('click', async () => {
            const m = await mediaPicker({ kind: f.kind || null, folder: f.folder || 'general' });
            if (m) { items.push(m); render(); }
          });
          wrap.appendChild(add);
        }
        render();
        row.appendChild(wrap);
        getters[f.name] = () => items.map((m) => m.id);
      } else if (f.type === 'static') {
        row.appendChild(el('div', { class: 'help', text: String(value) }));
        getters[f.name] = () => value;
      } else {
        const input = el('input', { type: f.type || 'text', id, placeholder: f.placeholder || '' });
        input.value = value;
        if (f.required) input.required = true;
        row.appendChild(input);
        getters[f.name] = () => input.value;
      }

      if (f.help) row.appendChild(el('div', { class: 'help', text: f.help }));
      form.appendChild(row);
    });

    return {
      node: form,
      values() {
        const out = {};
        Object.entries(getters).forEach(([k, fn]) => { out[k] = fn(); });
        return out;
      },
    };
  }

  /** Modale de formulaire prête à l'emploi. */
  function formModal({ title, fields, values = {}, submitLabel = 'Enregistrer', onSubmit, wide = false }) {
    const built = buildForm(fields, values);
    const m = modal({
      title, body: built.node, wide,
      actions: [
        { label: 'Annuler', class: 'btn-ghost', onClick: (close) => close() },
        {
          label: submitLabel,
          class: 'btn-primary',
          onClick: async (close, btn) => {
            btn.disabled = true;
            btn.textContent = 'Enregistrement…';
            try {
              await onSubmit(built.values());
              close();
            } catch (e) {
              toast(e.message + (e.details ? ` (${e.details.map((d) => d.message || d).join(', ')})` : ''), 'err');
              btn.disabled = false;
              btn.textContent = submitLabel;
            }
          },
        },
      ],
    });
    built.node.addEventListener('submit', (e) => e.preventDefault());
    return m;
  }

  /* ------------------------------ tableau --------------------------- */
  function table(columns, rows, { empty = 'Aucun élément.' } = {}) {
    if (!rows.length) return el('div', { class: 'empty', text: empty });
    const thead = el('thead', {}, [el('tr', {}, columns.map((c) => el('th', { text: c.label, style: c.align ? `text-align:${c.align}` : null })))]);
    const tbody = el('tbody', {}, rows.map((row) => el('tr', {}, columns.map((c) => {
      const td = el('td', { style: c.align ? `text-align:${c.align}` : null });
      const content = c.render ? c.render(row) : row[c.key];
      if (content instanceof Node) td.appendChild(content);
      else td.innerHTML = content === undefined || content === null || content === '' ? '<span class="muted">—</span>' : esc(content);
      return td;
    }))));
    return el('div', { class: 'table-wrap' }, [el('table', {}, [thead, tbody])]);
  }

  function actions(list) {
    return el('div', { class: 'row-actions' }, list.filter(Boolean).map((a) =>
      el('button', { class: `btn btn-sm ${a.class || ''}`, type: 'button', text: a.label, title: a.title || a.label, onclick: a.onClick })
    ));
  }

  const statusBadge = (status) => {
    const map = {
      published: ['green', 'Publié'], draft: ['amber', 'Brouillon'], hidden: ['', 'Masqué'],
      pending: ['amber', 'En attente'], paid: ['green', 'Payée'], processing: ['blue', 'Traitement'],
      completed: ['green', 'Terminée'], cancelled: ['red', 'Annulée'],
      unpaid: ['', 'Non payé'], failed: ['red', 'Échec'], refunded: ['blue', 'Remboursé'],
      new: ['green', 'Nouveau'], read: ['blue', 'Lu'], archived: ['', 'Archivé'],
      in_stock: ['green', 'Disponible'], out_of_stock: ['red', 'Épuisé'], on_request: ['amber', 'Sur demande'],
    };
    const [cls, label] = map[status] || ['', status || '—'];
    return el('span', { class: `badge ${cls}`, text: label });
  };

  window.UI = { el, esc, toast, modal, confirmDialog, mediaPicker, uploadFile, mediaThumb, buildForm, formModal, table, actions, statusBadge, fmtPrice, fmtDate, fmtBytes };
})();
