/* ═══════════════════════════════════════════════
   js/cursor.js — Custom cursor + Magnetic buttons
   Limitless Fitness
═══════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Skip on touch-primary devices */
  if (window.matchMedia('(hover: none)').matches) return;

  /* ── Elements ───────────────────────────────── */
  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.id  = 'cursor-dot';
  ring.id = 'cursor-ring';
  document.body.append(dot, ring);

  /* ── State ──────────────────────────────────── */
  let mx = -200, my = -200;         // mouse position
  let rx = -200, ry = -200;         // ring position (lagged)
  let raf;

  /* ── Track mouse ────────────────────────────── */
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
  }, { passive: true });

  /* ── Click flash ────────────────────────────── */
  document.addEventListener('mousedown', () => {
    document.body.classList.add('cursor-click');
  });
  document.addEventListener('mouseup', () => {
    document.body.classList.remove('cursor-click');
  });

  /* ── Hover detection ────────────────────────── */
  const HOVER_SELECTORS = 'a, button, [role=button], input, textarea, select, label, .filter-btn, .plan__btn, .goal-btn';

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(HOVER_SELECTORS)) {
      document.body.classList.add('cursor-hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(HOVER_SELECTORS)) {
      document.body.classList.remove('cursor-hover');
    }
  });

  /* ── Animate loop (ring lags mouse) ─────────── */
  const LERP = 0.11;

  function tick() {
    /* Dot follows exactly */
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';

    /* Ring lerps behind */
    rx += (mx - rx) * LERP;
    ry += (my - ry) * LERP;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';

    raf = requestAnimationFrame(tick);
  }
  tick();

  /* ── Hide when leaving window ───────────────── */
  document.addEventListener('mouseleave', () => {
    dot.style.opacity  = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity  = '1';
    ring.style.opacity = '1';
  });

  /* ════════════════════════════════════════════
     MAGNETIC BUTTONS
  ════════════════════════════════════════════ */
  const MAGNETIC_RADIUS = 80;
  const MAGNETIC_PULL   = 0.38;

  function initMagnetic() {
    document.querySelectorAll('.btn, .nav__cta, .auth-submit, .plan__btn, .bmi-submit, .contact-form__submit').forEach((el) => {
      const wrap = document.createElement('span');
      wrap.className = 'magnetic';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);

      let animId;
      let elX = 0, elY = 0;

      wrap.addEventListener('mousemove', (e) => {
        const rect  = wrap.getBoundingClientRect();
        const cx    = rect.left + rect.width  / 2;
        const cy    = rect.top  + rect.height / 2;
        const dx    = e.clientX - cx;
        const dy    = e.clientY - cy;
        const dist  = Math.sqrt(dx * dx + dy * dy);

        if (dist < MAGNETIC_RADIUS) {
          const tx = dx * MAGNETIC_PULL;
          const ty = dy * MAGNETIC_PULL;
          elX += (tx - elX) * 0.18;
          elY += (ty - elY) * 0.18;
          el.style.transform = `translate(${elX}px, ${elY}px)`;
          el.style.transition = 'transform 0s';
        }
      });

      wrap.addEventListener('mouseleave', () => {
        el.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
        el.style.transform  = 'translate(0,0)';
        elX = 0; elY = 0;
      });
    });
  }

  /* Run after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMagnetic);
  } else {
    initMagnetic();
  }

})();
