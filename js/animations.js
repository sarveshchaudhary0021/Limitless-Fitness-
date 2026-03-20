/* ═══════════════════════════════════════════════════
   js/animations.js — Limitless Fitness
   Scroll reveal · Stat counters · Parallax · Progress bar
   Card tilt · Active nav · Smooth anchors
═══════════════════════════════════════════════════ */

/* ── 1. Scroll reveal ─────────────────────────────── */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -56px 0px' }
  );

  els.forEach((el) => io.observe(el));
})();

/* ── 2. Stat counters ─────────────────────────────── */
(function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const run = (el) => {
    const target   = parseInt(el.dataset.count, 10);
    const suffix   = el.dataset.suffix || '';
    const duration = 1800;
    const start    = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString('en-IN') + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.6 }
  );

  counters.forEach((el) => io.observe(el));
})();

/* ── 3. Scroll progress bar ───────────────────────── */
(function initProgressBar() {
  const bar = document.createElement('div');
  bar.id = 'scroll-progress';
  Object.assign(bar.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    height:        '2px',
    width:         '0%',
    background:    'var(--accent)',
    zIndex:        '9999',
    transition:    'width 0.1s linear',
    pointerEvents: 'none',
  });
  document.body.prepend(bar);

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct       = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = Math.min(pct, 100).toFixed(1) + '%';
  }, { passive: true });
})();

/* ── 4. Parallax glow (hero only) ────────────────── */
(function initParallax() {
  const glow = document.querySelector('.hero__glow');
  if (!glow) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    requestAnimationFrame(() => {
      glow.style.transform = `translateX(-50%) translateY(${window.scrollY * 0.3}px)`;
      ticking = false;
    });
    ticking = true;
  }, { passive: true });
})();

/* ── 5. Card tilt on hover ────────────────────────── */
(function initCardTilt() {
  const cards = document.querySelectorAll('.feature-card, .plan-card, .testimonial-card');
  if (!cards.length || window.matchMedia('(hover: none)').matches) return;

  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const y    = e.clientY - rect.top;
      const rotX = ((y - rect.height / 2) / (rect.height / 2)) * -4;
      const rotY = ((x - rect.width  / 2) / (rect.width  / 2)) *  4;
      card.style.transform = `translateY(-5px) perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.4s var(--ease)';
      card.style.transform  = '';
      setTimeout(() => { card.style.transition = ''; }, 400);
    });
  });
})();

/* ── 6. Smooth anchor links ───────────────────────── */
(function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id     = a.getAttribute('href');
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

/* ── 7. Active nav link highlight ─────────────────── */
(function initActiveNav() {
  const links    = document.querySelectorAll('.nav__links a[href^="#"]');
  const sections = [...links]
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  if (!sections.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.remove('active'));
        const active = [...links].find(
          (a) => a.getAttribute('href') === '#' + entry.target.id
        );
        if (active) active.classList.add('active');
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );

  sections.forEach((s) => io.observe(s));
})();

/* ── 8. Overall Theme Toggle ─────────────────────── */
(function initThemeToggle() {
  const current = localStorage.getItem('limitless_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', current);

  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  btn.innerHTML = current === 'dark' ? '☀️' : '🌙';

  btn.addEventListener('click', function() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('limitless_theme', newTheme);
    this.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
  });
})();
