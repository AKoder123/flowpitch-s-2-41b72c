(() => {
  const state = { slides: [], currentIndex: 0, observer: null };

  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  function updateTopOffset() {
    const bar = $('.topbar');
    if (!bar) return;
    const h = Math.ceil(bar.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--topOffset', h + 'px');
  }

  function setCompactMode() {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const compact = h < 680; // threshold for small viewports
    document.body.classList.toggle('compact', compact);
  }

  function createEl(tag, cls, attrs={}) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    for (const [k,v] of Object.entries(attrs)) {
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    }
    return el;
  }

  function animateify(el, idx) {
    el.setAttribute('data-animate', '');
    el.style.setProperty('--i', idx);
    return el;
  }

  function makeBullets(list) {
    const ul = createEl('ul', 'bullets');
    (list || []).forEach((txt, i) => {
      const li = createEl('li');
      li.textContent = txt;
      animateify(li, i+2);
      ul.appendChild(li);
    });
    return ul;
  }

  function slideSurface() {
    const surface = createEl('div', 'slide__surface');
    const chrome = createEl('div', 'slide__chrome');
    const inner = createEl('div', 'slide__inner');
    surface.appendChild(chrome);
    surface.appendChild(inner);
    return { surface, inner };
  }

  function buildSlide(s, idx) {
    const section = createEl('section', 'slide ' + (s.type || 'content'));
    section.dataset.type = s.type || 'content';
    section.setAttribute('role', 'group');
    section.setAttribute('aria-roledescription', 'slide');
    section.setAttribute('aria-label', (s.headline || 'Slide') + '');

    const { surface, inner } = slideSurface();

    if (s.type === 'title') {
      const h = createEl('h1', 'h1 grad'); h.textContent = s.headline || '';
      const sub = s.subheadline ? createEl('p', 'sub') : null; if (sub) sub.textContent = s.subheadline;
      animateify(h, 0); if (sub) animateify(sub, 1);
      inner.appendChild(h); if (sub) inner.appendChild(sub);
      if (s.bullets && s.bullets.length) {
        const ul = makeBullets(s.bullets);
        inner.appendChild(ul);
      }
    } else if (s.type === 'section') {
      const h = createEl('h2', 'h2 grad'); h.textContent = s.headline || '';
      animateify(h, 0);
      inner.appendChild(h);
      inner.appendChild(createEl('div', 'hr'));
    } else if (s.type === 'beforeAfter') {
      if (s.headline) {
        const h = createEl('h2', 'h2'); h.innerHTML = '<span class="grad">' + escapeHtml(s.headline) + '</span>';
        animateify(h, 0);
        inner.appendChild(h);
      }
      const cols = createEl('div', 'cols');
      if (s.left) {
        const colL = createEl('div', 'col');
        const th = createEl('h3', null, { text: s.left.title || 'Left' }); animateify(th, 1); colL.appendChild(th);
        colL.appendChild(makeBullets(s.left.bullets || []));
        cols.appendChild(colL);
      }
      if (s.right) {
        const colR = createEl('div', 'col');
        const th = createEl('h3', null, { text: s.right.title || 'Right' }); animateify(th, 1); colR.appendChild(th);
        colR.appendChild(makeBullets(s.right.bullets || []));
        cols.appendChild(colR);
      }
      animateify(cols, 2);
      inner.appendChild(cols);
    } else if (s.type === 'closing') {
      const h = createEl('h2', 'h2 grad'); h.textContent = s.headline || '';
      animateify(h, 0);
      inner.appendChild(h);
      if (s.subheadline) {
        const sub = createEl('p', 'sub'); sub.textContent = s.subheadline; animateify(sub, 1); inner.appendChild(sub);
      }
      if (s.bullets && s.bullets.length) inner.appendChild(makeBullets(s.bullets));
    } else { // content
      if (s.headline) { const h = createEl('h2', 'h2'); h.innerHTML = '<span class="grad">' + escapeHtml(s.headline) + '</span>'; animateify(h, 0); inner.appendChild(h); }
      if (s.subheadline) { const sub = createEl('p', 'sub', { text: s.subheadline }); animateify(sub, 1); inner.appendChild(sub); }
      if (s.bullets && s.bullets.length) inner.appendChild(makeBullets(s.bullets));
    }

    section.appendChild(surface);
    section.appendChild(inner);
    return section;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>\"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[m]));
  }

  function mountSlides(data) {
    const deck = $('#deck');
    if (!deck) return;
    deck.innerHTML = '';
    state.slides = (data.slides || []).map((s, i) => buildSlide(s, i));
    state.slides.forEach(sl => deck.appendChild(sl));
    // Activate first slide initially
    if (state.slides[0]) state.slides[0].classList.add('is-active');
  }

  function setupObserver() {
    const deck = $('#deck');
    if (!deck) return;
    if ('IntersectionObserver' in window) {
      state.observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('is-active');
          }
        });
      }, { root: deck, threshold: 0.5 });
      state.slides.forEach(sl => state.observer.observe(sl));
    } else {
      state.slides.forEach(sl => sl.classList.add('is-active'));
    }
  }

  function currentSlideIndex() {
    const deck = $('#deck');
    if (!deck || !state.slides.length) return 0;
    const top = deck.scrollTop;
    let best = 0; let bestDist = Infinity;
    state.slides.forEach((sl, i) => {
      const dist = Math.abs(sl.offsetTop - top);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }

  function goTo(index) {
    const deck = $('#deck');
    if (!deck) return;
    const clamped = Math.max(0, Math.min(index, state.slides.length - 1));
    state.currentIndex = clamped;
    const el = state.slides[clamped];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setupKeys() {
    window.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable);
      if (typing) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        goTo(currentSlideIndex() + dir);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goTo(currentSlideIndex() + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(currentSlideIndex() - 1);
      }
    });
  }

  async function setupPdfExport() {
    const btn = $('#exportPdfBtn');
    if (!btn) return;

    async function loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      });
    }

    async function ensureLibs() {
      if (!window.html2canvas) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      }
      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
    }

    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true; const old = btn.textContent; btn.textContent = 'Exporting…';
        await ensureLibs();

        document.body.classList.add('exportingPdf');
        // Ensure all slides appear active/entered
        state.slides.forEach(sl => sl.classList.add('is-active'));

        // Build PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080], compress: true });

        // Create (or reuse) off-screen stage
        let stage = document.getElementById('pdfStage');
        if (!stage) {
          stage = document.createElement('div');
          stage.id = 'pdfStage';
          document.body.appendChild(stage);
        }
        stage.innerHTML = '';

        // Clone background layers once
        const bg = document.querySelector('.bg-layers');
        if (bg) {
          const bgClone = bg.cloneNode(true);
          stage.appendChild(bgClone);
        }

        // Function to capture a given slide
        async function captureSlide(slideEl, isFirst) {
          // Replace any previous slide clone
          const oldClone = stage.querySelector('.slide'); if (oldClone) oldClone.remove();
          const clone = slideEl.cloneNode(true);
          clone.classList.add('is-active');
          stage.appendChild(clone);

          // Wait a frame to ensure layout
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

          const scale = Math.max(2, (window.devicePixelRatio || 1));
          const canvas = await window.html2canvas(stage, { backgroundColor: null, scale, width: 1920, height: 1080, windowWidth: 1920, windowHeight: 1080, useCORS: true });
          const img = canvas.toDataURL('image/png');
          if (!isFirst) pdf.addPage([1920,1080], 'landscape');
          pdf.addImage(img, 'PNG', 0, 0, 1920, 1080, undefined, 'FAST');
        }

        for (let i = 0; i < state.slides.length; i++) {
          // Ensure navbar/hints are hidden inside stage via CSS already
          await captureSlide(state.slides[i], i === 0);
        }

        pdf.save('FlowPitch.pdf');

        document.body.classList.remove('exportingPdf');
        btn.disabled = false; btn.textContent = old;
        // Clean up stage to free memory
        setTimeout(() => { if (stage && stage.parentNode) stage.parentNode.removeChild(stage); }, 50);
      } catch (err) {
        console.error(err);
        alert('PDF export failed. Please allow cdnjs.cloudflare.com for html2canvas and jsPDF, or self-host the libraries.');
        document.body.classList.remove('exportingPdf');
        const btn = document.getElementById('exportPdfBtn'); if (btn) { btn.disabled = false; btn.textContent = 'Export PDF'; }
      }
    });
  }

  async function init() {
    updateTopOffset();
    setCompactMode();
    window.addEventListener('resize', () => { updateTopOffset(); setCompactMode(); });
    window.addEventListener('orientationchange', () => { updateTopOffset(); setCompactMode(); });

    try {
      const res = await fetch('./content.json?ts=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      const deckTitle = data && data.meta ? (data.meta.title || 'Deck') : 'Deck';
      const titleEl = document.getElementById('deckTitle'); if (titleEl) titleEl.textContent = deckTitle;
      if (data && data.meta && data.meta.theme) { document.body.dataset.theme = data.meta.theme; }
      document.title = (data.meta && data.meta.title) ? (data.meta.title + ' — FlowPitch') : 'FlowPitch';

      mountSlides(data);
      setupObserver();
      setupKeys();
      setupPdfExport();
    } catch (e) {
      console.error('Failed to load content.json', e);
      const deck = document.getElementById('deck');
      if (deck) {
        const err = document.createElement('div');
        err.className = 'slide content';
        const surf = document.createElement('div'); surf.className = 'slide__surface';
        const inner = document.createElement('div'); inner.className = 'slide__inner';
        const h = document.createElement('h2'); h.className = 'h2'; h.textContent = 'Unable to load content.json';
        inner.appendChild(h); err.appendChild(surf); err.appendChild(inner); deck.appendChild(err);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
