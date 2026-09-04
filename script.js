/* =========================================================================
   PORTFOLIO — COMPORTEMENTS
   -------------------------------------------------------------------------
   Le contenu (textes, images, projets, statistiques…) est injecté avant
   l'initialisation par assets/hydrate.js depuis l'API d'administration.
   Ce fichier ne contient donc que des comportements, plus de contenu.
   ========================================================================= */
function initPortfolio(){
  /* ---------- Lien vers la boutique ---------- */
  // L'URL vient de l'administration (Paramètres → Boutique → « URL de la
  // boutique »). La valeur ci-dessous n'est qu'un repli si l'API est
  // injoignable (ex. site statique seul sur GitHub Pages).
  const SHOP_URL = window.CALEB_SHOP_URL || './boutique/index.html';
  document.querySelectorAll('[data-shop-link]').forEach(link => {
    link.setAttribute('href', SHOP_URL);
  });

  /* ---------- Theme toggle (dark / light) ---------- */
  const themeBtn = document.getElementById('themeBtn');
  const themeIcon = document.getElementById('themeIcon');
  const sunPath = '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8"/>';
  const moonPath = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>';
  themeBtn.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
    themeIcon.innerHTML = isLight ? sunPath : moonPath;
  });

  /* ---------- Hamburger + nav overlay ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const navOverlay = document.getElementById('navOverlay');
  function closeNav(){
    menuBtn.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Ouvrir le menu');
    navOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  menuBtn.addEventListener('click', () => {
    const opening = !navOverlay.classList.contains('open');
    menuBtn.classList.toggle('open', opening);
    menuBtn.setAttribute('aria-expanded', String(opening));
    menuBtn.setAttribute('aria-label', opening ? 'Fermer le menu' : 'Ouvrir le menu');
    navOverlay.classList.toggle('open', opening);
    document.body.style.overflow = opening ? 'hidden' : '';
  });

  /* ---------- Header stays fixed & visible at all times; just add a deeper shadow once scrolled ---------- */
  const siteHeader = document.getElementById('siteHeader');
  function updateHeaderShadow(){
    siteHeader.classList.toggle('scrolled', window.scrollY > 8);
  }
  document.addEventListener('scroll', updateHeaderShadow, { passive:true });
  updateHeaderShadow();
  navOverlay.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', closeNav);
  });

  /* ---------- Typewriter headline ---------- */
  const twEl = document.getElementById('tw');
  const BR = '\u0001', EM_S = '\u0002', EM_E = '\u0003';
  // Titre administrable : le texte entre *astérisques* est mis en évidence.
  const rawTitle = window.CALEB_HERO_TITLE || 'DES IDÉES BRUTES, DES RENDUS QUI *CLAQUENT*';
  const fullText = rawTitle.replace(/\*([^*]+)\*/g, (m, inner) => EM_S + inner + EM_E);
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderTyped(n){
    const slice = fullText.slice(0, n);
    const emStart = slice.indexOf(EM_S);
    let html;
    if (emStart === -1){
      html = slice.split(BR).join('<br>');
    } else {
      const before = slice.slice(0, emStart).split(BR).join('<br>');
      const emEnd = slice.indexOf(EM_E);
      const emContent = emEnd === -1 ? slice.slice(emStart + 1) : slice.slice(emStart + 1, emEnd);
      const after = emEnd === -1 ? '' : slice.slice(emEnd + 1);
      html = before + '<em>' + emContent + '</em>' + after;
    }
    twEl.innerHTML = html;
  }

  if (prefersReduced){
    renderTyped(fullText.length);
  } else {
    let n = 0;
    function step(){
      n++;
      renderTyped(n);
      if (n < fullText.length){
        setTimeout(step, 42);
      }
    }
    step();
  }

  /* ---------- Timecode discret (hero) ---------- */
  let frames = 24 * 60 + 7;
  const tc = document.getElementById('tc');
  function fmt(n){ return String(n).padStart(2,'0'); }
  setInterval(() => {
    frames++;
    let f = frames % 30;
    let totalSec = Math.floor(frames/30);
    let s = totalSec % 60;
    let m = Math.floor(totalSec/60);
    tc.textContent = `00:${fmt(m)}:${fmt(s)}:${fmt(f)}`;
  }, 1000/30);

  /* ---------- Scroll progress bar ---------- */
  const progress = document.getElementById('progress');
  function updateProgress(){
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const max = h.scrollHeight - h.clientHeight;
    progress.style.width = (max > 0 ? (scrolled / max) * 100 : 0) + '%';
  }
  document.addEventListener('scroll', updateProgress, { passive:true });
  updateProgress();

  /* ---------- Scroll reveal with stagger ---------- */
  const revealTargets = document.querySelectorAll(
    '.sec-head, .stat, .service, .p-card, .card, .contact-item, .faq-item, .empty-state, .audience-item, .tool-chip, .p-row, .hero-photo'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));

  // stagger delay based on position among siblings sharing the same parent
  const groups = new Map();
  revealTargets.forEach(el => {
    const parent = el.parentElement;
    if(!groups.has(parent)) groups.set(parent, 0);
    const idx = groups.get(parent);
    el.style.transitionDelay = Math.min(idx * 70, 420) + 'ms';
    groups.set(parent, idx + 1);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealTargets.forEach(el => io.observe(el));

  /* ---------- Compteurs animés (système réutilisable) ---------- */
  function animateCounter(el, { minDuration = 900, maxDuration = 1800 } = {}){
    const target = parseInt(el.dataset.count, 10);
    if (!Number.isFinite(target)) return;

    // Respecte la préférence de mouvement réduit : valeur finale quasi immédiate
    if (prefersReduced){
      el.textContent = target;
      return;
    }

    // Durée proportionnelle à l'ampleur du nombre, bornée pour rester agréable (~0.9s à 1.8s)
    const duration = Math.min(maxDuration, Math.max(minDuration, 500 + target * 9));
    const start = performance.now();
    let raf = null;

    function tick(now){
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic : accélère puis ralentit naturellement
      const value = Math.min(target, Math.round(eased * target));
      el.textContent = value;
      if (p < 1){
        raf = requestAnimationFrame(tick);
      } else {
        el.textContent = target; // ne jamais dépasser / toujours finir pile sur la valeur
      }
    }
    raf = requestAnimationFrame(tick);
  }

  const counters = document.querySelectorAll('.num');
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      counterIO.unobserve(entry.target); // ne se déclenche qu'une seule fois par compteur
    });
  }, { threshold: 0.6 });
  counters.forEach(el => counterIO.observe(el));

  /* ---------- FAQ accordion (animated) ---------- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const panel = item.querySelector('.faq-panel');
    if (item.classList.contains('open')){
      panel.style.maxHeight = panel.scrollHeight + 'px';
    }
    item.querySelector('.faq-q').addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(other => {
        other.classList.remove('open');
        other.querySelector('.faq-panel').style.maxHeight = null;
      });
      if (!isOpen){
        item.classList.add('open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });

  /* ---------- Portfolio: jump pills scroll to matching row ---------- */
  const jumpButtons = document.querySelectorAll('.filter-btn');
  jumpButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      jumpButtons.forEach(b => b.classList.toggle('active', b === btn));
      const target = document.getElementById(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });

  /* ---------- Drag-to-scroll on each horizontal portfolio row ---------- */
  document.querySelectorAll('.p-row-scroll').forEach(row => {
    let isDown = false, startX = 0, startScroll = 0, moved = false;
    row.addEventListener('pointerdown', (e) => {
      isDown = true; moved = false;
      startX = e.clientX; startScroll = row.scrollLeft;
      row.classList.add('dragging');
    });
    row.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      row.scrollLeft = startScroll - dx;
    });
    function stopDrag(){ isDown = false; row.classList.remove('dragging'); }
    row.addEventListener('pointerup', stopDrag);
    row.addEventListener('pointerleave', stopDrag);
    row.addEventListener('pointercancel', stopDrag);
    // prevent the click that opens the lightbox from firing right after a drag
    row.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
  });

  /* ---------- Fullscreen lightbox viewer ---------- */
  const allCards = Array.from(document.querySelectorAll('.p-card'));
  const lightbox = document.getElementById('lightbox');
  const lightboxThumb = document.getElementById('lightboxThumb');
  const lightboxCat = document.getElementById('lightboxCat');
  const lightboxTitle = document.getElementById('lightboxTitle');
  let lightboxIndex = 0;

  function openLightbox(index){
    lightboxIndex = (index + allCards.length) % allCards.length;
    const card = allCards[lightboxIndex];
    const thumb = card.querySelector('.p-thumb');
    const videoUrl = card.dataset.video;
    if (videoUrl && card.dataset.videoFile){
      // Vidéo hébergée par le backend (fichier importé depuis /admin)
      lightboxThumb.style.background = '#000';
      lightboxThumb.innerHTML = `<video src="${videoUrl}" controls autoplay playsinline style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain; background:#000;"></video>`;
    } else if (videoUrl){
      lightboxThumb.style.background = '#000';
      lightboxThumb.innerHTML = `<iframe src="${videoUrl}" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="position:absolute; inset:0;"></iframe>`;
    } else {
      lightboxThumb.style.background = thumb.style.background;
      lightboxThumb.innerHTML = '';
    }
    lightboxCat.textContent = card.querySelector('.p-cat').textContent;
    lightboxTitle.textContent = card.dataset.title || card.querySelector('.p-title').textContent;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    lightbox.classList.remove('open');
    lightboxThumb.innerHTML = ''; // stoppe la lecture de la vidéo en coupant l'iframe
    document.body.style.overflow = '';
  }
  allCards.forEach((card, i) => {
    card.addEventListener('click', () => openLightbox(i));
  });
  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrev').addEventListener('click', () => openLightbox(lightboxIndex - 1));
  document.getElementById('lightboxNext').addEventListener('click', () => openLightbox(lightboxIndex + 1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') openLightbox(lightboxIndex - 1);
    if (e.key === 'ArrowRight') openLightbox(lightboxIndex + 1);
  });

  /* ---------- Hero chapters: quick scrub animation, then jump to matching section ---------- */
  const chapterBtns = document.querySelectorAll('.chapter');
  const scrubTrack = document.querySelector('.scrub-track');
  const scrubFill = document.querySelector('.scrub-fill');
  const scrubHead = document.querySelector('.scrub-head');
  const stops = [0, 100/3, 200/3, 100];

  function goToChapter(i, { jump = true } = {}){
    const pos = stops[i];
    scrubFill.style.width = pos + '%';
    scrubHead.style.left = pos + '%';
    chapterBtns.forEach((c, ci) => c.classList.toggle('active', ci === i));
    const btn = chapterBtns[i];
    if (!btn) return;
    if (jump){
      const target = document.getElementById(btn.dataset.target);
      setTimeout(() => {
        if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
      }, 320);
    }
  }

  chapterBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => goToChapter(i));
  });

  /* Draggable scrubber (mouse + touch via Pointer Events) */
  function nearestStopIndex(pct){
    let best = 0, bestDist = Infinity;
    stops.forEach((s, i) => { const d = Math.abs(s - pct); if (d < bestDist){ bestDist = d; best = i; } });
    return best;
  }
  function pctFromEvent(e){
    const rect = scrubTrack.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 100;
    return Math.min(100, Math.max(0, x));
  }
  let dragging = false;
  function startDrag(e){
    dragging = true;
    scrubTrack.classList.add('dragging');
    scrubHead.setPointerCapture && e.pointerId != null && scrubHead.setPointerCapture(e.pointerId);
    onDrag(e);
  }
  function onDrag(e){
    if (!dragging) return;
    const pct = pctFromEvent(e);
    scrubFill.style.width = pct + '%';
    scrubHead.style.left = pct + '%';
  }
  function endDrag(e){
    if (!dragging) return;
    dragging = false;
    scrubTrack.classList.remove('dragging');
    const pct = pctFromEvent(e);
    goToChapter(nearestStopIndex(pct));
  }
  scrubHead.addEventListener('pointerdown', startDrag);
  scrubTrack.addEventListener('pointerdown', (e) => {
    if (e.target === scrubHead) return;
    startDrag(e);
  });
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  /* ---------- Subtle 3D tilt on cards (pointer devices only) ---------- */
  if (window.matchMedia('(pointer:fine)').matches){
    document.querySelectorAll('.p-card, .service, .card, .tool-chip').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `translateY(-4px) rotateX(${(-y*4).toFixed(2)}deg) rotateY(${(x*4).toFixed(2)}deg)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }
}

/* Démarrage : on attend l'hydratation (contenu venant de l'API) pour que les
   animations, la lightbox et les compteurs s'appliquent au contenu réel. */
if (window.CalebHydrate && window.CalebHydrate.ready && typeof window.CalebHydrate.ready.then === 'function'){
  window.CalebHydrate.ready.then(initPortfolio).catch(initPortfolio);
} else {
  initPortfolio();
}
