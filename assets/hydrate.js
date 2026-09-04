/* =====================================================================
   HYDRATATION DU PORTFOLIO
   ---------------------------------------------------------------------
   Récupère le contenu depuis l'API (/api/public/*) et remplace le contenu
   statique de la page. Si l'API n'est pas joignable, la page conserve son
   contenu de secours : rien ne casse.
   ===================================================================== */
(function () {
  const C = window.CALEB;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const EXPAND_ICON = '<span class="p-expand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg></span>';
  const PLAY_ICON = '<span class="p-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>';
  const CONTACT_ICONS = {
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.4-1.2a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.8 2z"/>',
    map: '<path d="M12 21s7-6.3 7-11.5A7 7 0 105 9.5C5 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
  };
  const DEFAULT_SERVICE_ICON = '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>';

  function setText(sel, value) {
    const node = $(sel);
    if (node && value) node.textContent = value;
  }

  /* ------------------------------ IDENTITÉ ---------------------------- */
  function applySettings(s) {
    if (s.seo_title) document.title = s.seo_title;
    if (s.seo_description) {
      let meta = $('meta[name="description"]');
      if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
      meta.content = s.seo_description;
    }
    if (s.favicon) {
      let link = $('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = C.assetUrl(s.favicon);
    }

    // Marque / logo du header
    const mark = $('.brand-mark');
    if (mark) {
      if (s.logo) {
        mark.innerHTML = `<img src="${esc(C.assetUrl(s.logo))}" alt="${esc(s.site_name || 'Logo')}" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">`;
        mark.style.padding = '4px';
      } else if (s.brand_mark) {
        mark.textContent = s.brand_mark;
      }
    }
    const brandName = $('.brand-name');
    if (brandName && (s.brand_first || s.brand_last)) {
      brandName.innerHTML = `${esc(s.brand_first || '')} <span class="brand-accent">${esc(s.brand_last || '')}</span><span class="brand-sub">${esc(s.brand_sub || '')}</span>`;
    }

    // Lien boutique (configurable depuis /admin)
    if (s.shop_url) {
      window.CALEB_SHOP_URL = s.shop_url;
      $$('[data-shop-link]').forEach((a) => a.setAttribute('href', s.shop_url));
    }

    // Hero
    setText('.hero-badge', '');
    const badge = $('.hero-badge');
    if (badge) badge.innerHTML = `<span class="dot"></span>${esc(s.hero_badge || 'CALEB CREATIVE')}`;
    if (s.hero_title) window.CALEB_HERO_TITLE = s.hero_title;
    setText('.hero-main .sub', s.hero_subtitle);
    const photo = $('.hero-photo-frame img');
    if (photo && s.profile_photo) {
      photo.src = C.assetUrl(s.profile_photo);
      photo.alt = `Photo de ${s.owner_name || 'profil'}`;
    }
    setText('.hero-photo-title', s.owner_name);
    const ctas = $$('.cta-row .btn');
    if (ctas[0] && s.hero_cta_primary_label) {
      ctas[0].childNodes[0].nodeValue = ` ${s.hero_cta_primary_label} `;
      if (s.hero_cta_primary_link) ctas[0].setAttribute('href', s.hero_cta_primary_link);
    }
    if (ctas[1] && s.hero_cta_secondary_label) ctas[1].childNodes[0].nodeValue = ` ${s.hero_cta_secondary_label} `;

    // À propos
    setText('#about .sec-eyebrow', s.about_eyebrow);
    setText('#about .sec-title', s.about_title);
    const aboutBody = $('.about-body');
    if (aboutBody && s.about_text) aboutBody.innerHTML = s.about_text;
    const missionCard = $('.mission-card');
    if (missionCard) {
      if (s.mission_title) missionCard.querySelector('.tag').textContent = s.mission_title;
      if (s.mission_text) missionCard.querySelector('p').textContent = s.mission_text;
    }
    const audienceCard = $('.accompagne');
    if (audienceCard) {
      if (s.audience_title) audienceCard.querySelector('.tag').textContent = s.audience_title;
      const items = Array.isArray(s.audience_items) ? s.audience_items : null;
      if (items && items.length) {
        const icons = $$('.audience-item .audience-ic', audienceCard).map((n) => n.innerHTML);
        audienceCard.querySelector('.audience-list').innerHTML = items.map((it, i) => `
          <div class="audience-item">
            <span class="audience-ic">${icons[i] || icons[0] || ''}</span>
            <div><div class="name">${esc(it.name)}</div><div class="desc">${esc(it.desc)}</div></div>
          </div>`).join('');
      }
    }

    // Titres de sections
    setText('#services .sec-eyebrow', s.services_eyebrow);
    setText('#services .sec-title', s.services_title);
    setText('.services-note', s.services_note);
    setText('#portfolio .sec-eyebrow', s.portfolio_eyebrow);
    setText('#portfolio .sec-title', s.portfolio_title);
    setText('#tools .sec-eyebrow', s.tools_eyebrow);
    setText('#tools .sec-title', s.tools_title);
    setText('#faq .sec-eyebrow', s.faq_eyebrow);
    setText('#faq .sec-title', s.faq_title);
    setText('#contact .sec-eyebrow', s.contact_eyebrow);
    setText('#contact .sec-title', s.contact_title);
    setText('#testimonials .sec-eyebrow', s.testimonials_eyebrow);
    setText('#testimonials .sec-title', s.testimonials_title);
    setText('.footer-brand', s.brand_sub || s.site_name);
    setText('footer .footer-note', s.footer_note);
  }

  /* ---------------------------- STATISTIQUES -------------------------- */
  function applyStats(stats) {
    const box = $('.stats');
    if (!box || !stats.length) return;
    box.innerHTML = stats.map((st) => `
      <div class="stat">
        <div class="stat-num"><span class="num" data-count="${Number(st.value) || 0}">0</span>${st.suffix ? `<span>${esc(st.suffix)}</span>` : ''}</div>
        <div class="stat-label">${esc(st.label)}</div>
      </div>`).join('');
  }

  /* ------------------------------ SERVICES ---------------------------- */
  function applyServices(services) {
    const grid = $('.services-grid');
    if (!grid || !services.length) return;
    grid.innerHTML = services.map((sv) => `
      <div class="service">
        <div class="service-icon">${sv.image
          ? `<img src="${esc(C.assetUrl(sv.image.url))}" alt="" style="width:100%;height:100%;object-fit:contain">`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${sv.icon || DEFAULT_SERVICE_ICON}</svg>`}</div>
        <div><h3>${esc(sv.title)}</h3><p>${esc(sv.description)}</p></div>
      </div>`).join('');
  }

  /* ------------------------------ PROJETS ----------------------------- */
  function projectCard(p) {
    const cover = p.cover ? C.assetUrl(p.cover.url) : '';
    const label = p.categoryShort || p.categoryLabel || '';
    const bg = cover
      ? `background:url('${esc(cover)}') center/cover no-repeat;`
      : `background:${esc(p.gradient || 'linear-gradient(135deg,#1F3350,#4ADE80)')};`;
    const isFile = !!(p.video && p.video.url) && !p.video_url;
    const videoSrc = p.videoUrl ? C.assetUrl(p.videoUrl) : '';
    return `
      <div class="p-card" data-cat="${esc(p.category)}" data-title="${esc(p.title)}"
        ${videoSrc ? `data-video="${esc(videoSrc)}"` : ''}
        ${videoSrc && isFile ? 'data-video-file="1"' : ''}
        ${p.description ? `data-desc="${esc(p.description)}"` : ''}>
        ${EXPAND_ICON}
        <div class="p-thumb" style="${bg}">
          ${cover ? '' : `<span>${esc(label)}</span>`}
          ${videoSrc ? PLAY_ICON : ''}
        </div>
        <div class="p-body">
          <div class="p-cat">${esc(label)}</div>
          <h3 class="p-title">${esc(p.title)}</h3>
        </div>
      </div>`;
  }

  function applyProjects(projects, categories) {
    const rows = $('.portfolio-rows');
    const filters = $('.filters');
    if (!rows || !projects.length) return;

    const used = categories.filter((c) => projects.some((p) => p.category === c.slug));
    const orphans = projects.filter((p) => !p.category);
    const groups = used.map((c) => ({
      slug: c.slug,
      label: c.label,
      items: projects.filter((p) => p.category === c.slug),
    }));
    if (orphans.length) groups.push({ slug: 'autres', label: 'Autres réalisations', items: orphans });

    rows.innerHTML = groups.map((g) => `
      <div class="p-row" id="row-${esc(g.slug)}">
        <div class="p-row-head"><h3>${esc(g.label)}</h3><span class="p-row-count">${g.items.length} réalisation${g.items.length > 1 ? 's' : ''}</span></div>
        <div class="p-row-scroll">${g.items.map(projectCard).join('')}</div>
      </div>`).join('');

    if (filters) {
      filters.innerHTML = groups.map((g, i) =>
        `<button class="filter-btn${i === 0 ? ' active' : ''}" data-target="row-${esc(g.slug)}">${esc(g.label)}</button>`
      ).join('');
    }

    // Chapitres du hero : 3 premières catégories + section Outils
    const chapters = $('.chapters');
    if (chapters) {
      const list = groups.slice(0, 3).map((g) => ({ target: `row-${g.slug}`, label: g.label.toUpperCase() }));
      list.push({ target: 'tools', label: 'IA' });
      chapters.innerHTML = list.map((c, i) =>
        `<button type="button" class="chapter${i === 0 ? ' active' : ''}" data-target="${esc(c.target)}">${esc(c.label)}</button>`
      ).join('');
    }
  }

  /* ------------------------------- OUTILS ----------------------------- */
  function applySkills(skills) {
    const section = $('#tools .wrap');
    if (!section || !skills.length) return;
    const groups = [];
    skills.forEach((sk) => {
      let g = groups.find((x) => x.label === sk.group_label);
      if (!g) { g = { label: sk.group_label, items: [] }; groups.push(g); }
      g.items.push(sk);
    });
    $$('.tool-group', section).forEach((n) => n.remove());
    const html = groups.map((g) => `
      <div class="tool-group">
        <span class="tool-group-label">${esc(g.label)}</span>
        <div class="tool-grid">
          ${g.items.map((sk) => `
            <div class="tool-chip">
              <span class="tool-avatar">${sk.logo
                ? `<img src="${esc(C.assetUrl(sk.logo.url))}" alt="${esc(sk.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
                : esc(sk.avatar || sk.name.slice(0, 2))}</span>${esc(sk.name)}
            </div>`).join('')}
        </div>
      </div>`).join('');
    section.insertAdjacentHTML('beforeend', html);
  }

  /* -------------------------------- FAQ ------------------------------- */
  function applyFaqs(faqs) {
    const list = $('.faq-list');
    if (!list || !faqs.length) return;
    list.innerHTML = faqs.map((f, i) => `
      <div class="faq-item${i === 0 ? ' open' : ''}">
        <button class="faq-q"><span>${esc(f.question)}</span><span class="plus">+</span></button>
        <div class="faq-panel"><p>${esc(f.answer)}</p></div>
      </div>`).join('');
  }

  /* ------------------------------ CONTACT ----------------------------- */
  function contactItem(href, icon, label, value, blank) {
    return `
      <a class="contact-item" href="${esc(href)}"${blank ? ' target="_blank" rel="noopener"' : ''}>
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${icon}</svg></div>
        <div><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>
      </a>`;
  }

  function applyContact(s) {
    const grid = $('.contact-grid');
    if (grid) {
      const items = [];
      if (s.contact_email) items.push(contactItem(`mailto:${s.contact_email}`, CONTACT_ICONS.email, 'EMAIL', s.contact_email));
      if (s.whatsapp_number) items.push(contactItem(`https://wa.me/${s.whatsapp_number}`, CONTACT_ICONS.whatsapp, 'WHATSAPP', s.whatsapp_display || s.whatsapp_number, true));
      if (s.phone_primary) items.push(contactItem(`tel:${s.phone_primary.replace(/\s/g, '')}`, CONTACT_ICONS.phone, 'TÉLÉPHONE', s.phone_primary));
      if (s.phone_secondary) items.push(contactItem(`tel:${s.phone_secondary.replace(/\s/g, '')}`, CONTACT_ICONS.phone, 'TÉLÉPHONE (ALT.)', s.phone_secondary));
      if (s.location) items.push(contactItem(s.location_url || '#', CONTACT_ICONS.map, 'LOCALISATION', s.location, true));
      if (items.length) grid.innerHTML = items.join('');
    }

    const social = $('.social-row');
    if (social) {
      const links = [
        ['social_facebook', 'FB', 'Facebook'],
        ['social_instagram', 'IG', 'Instagram'],
        ['social_tiktok', 'TT', 'TikTok'],
        ['social_youtube', 'YT', 'YouTube'],
        ['social_linkedin', 'IN', 'LinkedIn'],
      ].filter(([k]) => s[k]);
      if (links.length) {
        social.innerHTML = links.map(([k, short, name]) =>
          `<a href="${esc(s[k])}" target="_blank" rel="noopener" aria-label="${esc(name)}">${short}</a>`).join('');
      }
    }

    // Envoi du formulaire de contact vers l'API
    const form = $('.contact-form');
    if (form) {
      form.removeAttribute('onsubmit');
      const btn = form.querySelector('button[type="submit"]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!C.available) { notify(form, 'Le service de messagerie est momentanément indisponible. Écris-moi sur WhatsApp.', true); return; }
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Envoi…';
        try {
          await C.apiPost('/api/public/messages', {
            name: form.nom.value.trim(),
            email: form.email.value.trim(),
            message: form.message.value.trim(),
          });
          form.reset();
          notify(form, 'Message envoyé ! Je te réponds très vite.');
        } catch (err) {
          notify(form, err.message || "L'envoi a échoué. Réessaie.", true);
        }
        btn.disabled = false;
        btn.innerHTML = original;
      });
    }
  }

  function notify(form, message, isError) {
    let box = form.querySelector('.form-note');
    if (!box) {
      box = document.createElement('p');
      box.className = 'form-note';
      form.appendChild(box);
    }
    box.textContent = message;
    box.style.cssText = `margin:10px 0 0;font-size:14px;color:${isError ? '#F87171' : '#4ADE80'};`;
  }

  /* ---------------------------- TÉMOIGNAGES --------------------------- */
  function applyTestimonials(list) {
    const section = $('#testimonials .wrap');
    if (!section) return;
    const empty = $('.empty-state', section);
    if (list.length) {
      const html = `<div class="testimonial-list">${list.map((t) => `
        <div class="testimonial-card">
          <p>“${esc(t.content)}”</p>
          <div class="who"><strong>${esc(t.author)}</strong>${t.role ? `<span>${esc(t.role)}</span>` : ''}</div>
        </div>`).join('')}</div>`;
      if (empty) empty.outerHTML = html;
      else section.insertAdjacentHTML('beforeend', html);
    }

    const form = $('.testimonial-form');
    if (form) {
      form.removeAttribute('onsubmit');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!C.available) { notify(form, 'Service indisponible pour le moment.', true); return; }
        const btn = form.querySelector('button');
        btn.disabled = true;
        try {
          await C.apiPost('/api/public/testimonials', {
            author: form.nom.value.trim(),
            content: form.commentaire.value.trim(),
          });
          form.reset();
          notify(form, 'Merci ! Ton commentaire sera publié après validation.');
        } catch (err) {
          notify(form, err.message, true);
        }
        btn.disabled = false;
      });
    }
  }

  /* ------------------------------ CHARGEMENT -------------------------- */
  async function hydrate() {
    try {
      const [site, projects] = await Promise.all([
        C.apiGet('/api/public/site'),
        C.apiGet('/api/public/projects'),
      ]);
      const d = site.data;
      applySettings(d.settings || {});
      applyStats(d.stats || []);
      applyServices(d.services || []);
      applySkills(d.skills || []);
      applyFaqs(d.faqs || []);
      applyProjects(projects.data || [], d.categories || []);
      applyContact(d.settings || {});
      applyTestimonials(d.testimonials || []);
      document.documentElement.dataset.hydrated = 'api';
    } catch (e) {
      // Pas d'API joignable : le contenu statique de secours reste affiché.
      C.available = false;
      document.documentElement.dataset.hydrated = 'static';
      console.info('[Caleb] Contenu statique utilisé (API indisponible).', e.message);
      const form = $('.contact-form');
      if (form) applyContact({});
    }
  }

  window.CalebHydrate = { ready: hydrate() };
})();
