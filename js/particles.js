/* ═══════════════════════════════════════════════════════
   js/particles.js — Limitless Fitness Hero
   10,000 particles · Pattern morphing · Mouse repulsion
   ImageData rendering for 60fps performance
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
  const N   = 10000;

  /* ── Struct-of-arrays (cache-friendly) ─────────── */
  const px  = new Float32Array(N);   // position x
  const py  = new Float32Array(N);   // position y
  const pvx = new Float32Array(N);   // velocity x
  const pvy = new Float32Array(N);   // velocity y
  const ptx = new Float32Array(N);   // target x
  const pty = new Float32Array(N);   // target y
  const pR  = new Uint8Array(N);     // colour R
  const pG  = new Uint8Array(N);     // colour G
  const pB  = new Uint8Array(N);     // colour B
  const pA  = new Uint8Array(N);     // base alpha (0–220)
  const pSz = new Uint8Array(N);     // size 1|2|3

  /* ── Physics constants ──────────────────────────── */
  const SPRING       = 0.042;
  const DAMPING      = 0.865;
  const DRIFT        = 0.07;   // antigravity float
  const MOUSE_R      = 130;
  const MOUSE_F      = 24;
  const PATTERN_MS   = 5200;   // ms per pattern

  /* ── Colours — electric blue / indigo / violet ── */
  const PALETTE = [
    [56,  189, 248, 160],   // sky-blue     (most common)
    [56,  189, 248, 200],
    [125, 211, 252, 140],   // lighter blue
    [129, 140, 248, 150],   // indigo
    [129, 140, 248, 190],
    [192, 132, 252, 130],   // violet
    [248, 250, 252, 210],   // sparkle white
    [56,  189, 248,  90],   // dim blue
    [165, 180, 252, 120],   // lavender
  ];

  /* ── State ──────────────────────────────────────── */
  let W = 0, H = 0;
  let patterns  = [];
  let patIdx    = 0;
  let lastSwitch = 0;
  let mouse     = { x: -9999, y: -9999 };
  let imgData   = null;      // reused ImageData buffer
  let buf       = null;      // Uint8ClampedArray view

  /* ════════════════════════════════════════════════
     PATTERN GENERATORS
  ════════════════════════════════════════════════ */

  /* Clamp + trim/pad array to exactly N points */
  function toN(pts) {
    if (pts.length > N) return pts.slice(0, N);
    while (pts.length < N) {
      pts.push(pts[Math.floor(Math.random() * pts.length)].slice());
    }
    return pts;
  }

  /* Sample text rendered on offscreen canvas */
  function sampleText(text, size) {
    const oc  = document.createElement('canvas');
    oc.width  = W; oc.height = H;
    const oc2 = oc.getContext('2d');
    const fs  = size || Math.min(W / Math.max(text.length, 4) * 1.6, H * 0.52);
    oc2.font           = `900 ${fs}px 'Bebas Neue', cursive`;
    oc2.fillStyle      = '#fff';
    oc2.textAlign      = 'center';
    oc2.textBaseline   = 'middle';
    oc2.fillText(text, W / 2, H / 2);
    const d    = oc2.getImageData(0, 0, W, H).data;
    const pts  = [];
    const step = Math.max(3, Math.floor(Math.sqrt((W * H * 0.07) / N * step)));
    const stp  = 4;
    for (let y = 0; y < H; y += stp) {
      for (let x = 0; x < W; x += stp) {
        if (d[(y * W + x) * 4 + 3] > 100) {
          pts.push([
            x + (Math.random() - .5) * 2,
            y + (Math.random() - .5) * 2,
          ]);
        }
      }
    }
    return toN(pts);
  }

  /* Dumbbell — two mass circles + bar */
  function sampleDumbbell() {
    const pts = [];
    const cx  = W / 2, cy = H / 2;
    const arm = Math.min(W * 0.22, 170);
    const pR  = Math.min(H * 0.26, 105);
    const bR  = Math.min(H * 0.05, 20);

    const addCircle = (cx2, cy2, r, n) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = r * Math.sqrt(Math.random());
        pts.push([cx2 + Math.cos(a) * d, cy2 + Math.sin(a) * d]);
      }
    };
    const addRect = (x0, y0, w2, h2, n) => {
      for (let i = 0; i < n; i++) {
        pts.push([x0 + Math.random() * w2, y0 + (Math.random() - .5) * h2]);
      }
    };

    addCircle(cx - arm - pR * 0.35, cy, pR,       Math.floor(N * 0.33));
    addCircle(cx + arm + pR * 0.35, cy, pR,       Math.floor(N * 0.33));
    addRect(cx - arm, cy, arm * 2,  bR * 2,       Math.floor(N * 0.26));
    /* Collars */
    addCircle(cx - arm * 0.68, cy, bR * 1.8,     Math.floor(N * 0.04));
    addCircle(cx + arm * 0.68, cy, bR * 1.8,     Math.floor(N * 0.04));

    return toN(pts);
  }

  /* Lightning bolt — polygon fill */
  function sampleLightning() {
    const pts  = [];
    const cx   = W / 2, cy = H / 2;
    const sc   = Math.min(W, H) * 0.36;
    const poly = [
      [ 0.22, -1.0],
      [ 0.52, -0.08],
      [ 0.95, -0.08],
      [-0.22,  1.0],
      [-0.52,  0.08],
      [-0.95,  0.08],
    ];

    const inPoly = (x, y) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi)
          inside = !inside;
      }
      return inside;
    };

    let tries = 0;
    while (pts.length < N && tries < N * 12) {
      tries++;
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      if (inPoly(x, y)) pts.push([cx + x * sc, cy + y * sc]);
    }
    return toN(pts);
  }

  /* EKG heartbeat line */
  function sampleHeartbeat() {
    const pts  = [];
    const cx   = W / 2, cy = H / 2;
    const sx   = Math.min(W * 0.44, 320);
    const sy   = Math.min(H * 0.24, 100);
    const segs = [
      [-1.00,  0.00],[-0.62,  0.00],[-0.52, -0.22],
      [-0.42,  0.00],[-0.22,  0.00],[-0.12, -1.00],
      [ 0.00,  0.85],[ 0.10, -0.32],[ 0.22,  0.00],
      [ 0.42,  0.00],[ 0.52, -0.26],[ 0.62,  0.00],
      [ 1.00,  0.00],
    ];
    const thick = 14;
    for (let i = 0; i < N; i++) {
      const t   = i / N;
      const si  = Math.floor(t * (segs.length - 1));
      const sf  = t * (segs.length - 1) - si;
      const a   = segs[Math.min(si, segs.length - 1)];
      const b   = segs[Math.min(si + 1, segs.length - 1)];
      pts.push([
        cx + (a[0] + (b[0] - a[0]) * sf) * sx + (Math.random() - .5) * thick,
        cy + (a[1] + (b[1] - a[1]) * sf) * sy + (Math.random() - .5) * thick,
      ]);
    }
    return toN(pts);
  }

  /* Infinity / lemniscate */
  function sampleInfinity() {
    const pts = [];
    const cx  = W / 2, cy = H / 2;
    const a   = Math.min(W * 0.28, 195);
    const thick = 15;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const d = 1 + Math.sin(t) ** 2;
      const x = a * Math.cos(t) / d;
      const y = a * Math.sin(t) * Math.cos(t) / d;
      const nx = -Math.sin(t); const ny = Math.cos(t);
      const off = (Math.random() - .5) * thick;
      pts.push([cx + x + nx * off, cy + y + ny * off]);
    }
    return toN(pts);
  }

  /* Running figure — simplified SVG points */
  function sampleRunner() {
    const pts  = [];
    const cx   = W / 2, cy = H / 2;
    const sc   = Math.min(H * 0.38, 150);

    /* Head */
    const headN = Math.floor(N * 0.08);
    for (let i = 0; i < headN; i++) {
      const r = 0.12 * sc * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      pts.push([cx + 0.15 * sc + Math.cos(a) * r, cy - 0.85 * sc + Math.sin(a) * r]);
    }

    /* Body segments — torso, arms, legs as thick lines */
    const addLine = (x0, y0, x1, y1, thick2, n) => {
      for (let i = 0; i < n; i++) {
        const t = Math.random();
        const perp = (Math.random() - .5) * thick2;
        const dx = x1 - x0; const dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        pts.push([
          cx + x0 + dx * t + (-dy / len) * perp,
          cy + y0 + dy * t + ( dx / len) * perp,
        ]);
      }
    };

    const seg = Math.floor(N * 0.12);
    const thi = 0.035 * sc;

    /* Torso */
    addLine(0.10 * sc, -0.70 * sc,  0.05 * sc, -0.25 * sc, thi * 1.5, seg);
    /* Forward arm */
    addLine(0.08 * sc, -0.55 * sc,  0.45 * sc, -0.30 * sc, thi, seg);
    /* Back arm */
    addLine(0.08 * sc, -0.55 * sc, -0.30 * sc, -0.70 * sc, thi, seg);
    /* Front thigh */
    addLine(0.05 * sc, -0.25 * sc,  0.35 * sc,  0.20 * sc, thi, seg);
    /* Front shin */
    addLine(0.35 * sc,  0.20 * sc,  0.20 * sc,  0.70 * sc, thi, seg);
    /* Back thigh */
    addLine(0.05 * sc, -0.25 * sc, -0.35 * sc,  0.10 * sc, thi, seg);
    /* Back shin */
    addLine(-0.35 * sc, 0.10 * sc, -0.15 * sc,  0.70 * sc, thi, seg);

    return toN(pts);
  }

  /* Spiral / galaxy */
  function sampleSpiral() {
    const pts = [];
    const cx  = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) * 0.38;
    const arms  = 3;
    for (let i = 0; i < N; i++) {
      const arm  = i % arms;
      const t    = (i / N) * Math.PI * 6;
      const r    = (t / (Math.PI * 6)) * maxR;
      const ang  = t + (arm / arms) * Math.PI * 2;
      const noise = (Math.random() - .5) * r * 0.35;
      pts.push([
        cx + Math.cos(ang) * r + noise,
        cy + Math.sin(ang) * r + noise,
      ]);
    }
    return toN(pts);
  }

  /* ── Build pattern set ───────────────────────────── */
  function buildPatterns() {
    patterns = [
      sampleText('LIMITLESS'),
      sampleDumbbell(),
      sampleLightning(),
      sampleHeartbeat(),
      sampleRunner(),
      sampleInfinity(),
      sampleSpiral(),
      sampleText('NO LIMITS'),
    ];
  }

  /* ── Assign targets for a pattern ───────────────── */
  function assignPattern(idx) {
    const p = patterns[idx % patterns.length];
    /* Shuffle for organic morphing */
    const ord = new Uint16Array(N);
    for (let i = 0; i < N; i++) ord[i] = i;
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = ord[i]; ord[i] = ord[j]; ord[j] = tmp;
    }
    for (let i = 0; i < N; i++) {
      const pt = p[ord[i]];
      ptx[i] = pt[0]; pty[i] = pt[1];
    }
  }

  /* ── Initialise particles ────────────────────────── */
  function init() {
    for (let i = 0; i < N; i++) {
      px[i]  = Math.random() * W;
      py[i]  = Math.random() * H;
      pvx[i] = (Math.random() - .5) * 3;
      pvy[i] = (Math.random() - .5) * 3;

      const c  = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      pR[i] = c[0]; pG[i] = c[1]; pB[i] = c[2]; pA[i] = c[3];
      pSz[i] = Math.random() < 0.04 ? 3 : Math.random() < 0.18 ? 2 : 1;
    }
  }

  /* ── Resize ──────────────────────────────────────── */
  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    imgData = ctx.createImageData(W, H);
    buf     = imgData.data;
    buildPatterns();
    assignPattern(patIdx);
  }

  /* ════════════════════════════════════════════════
     PHYSICS UPDATE (inner loop — keep lean)
  ════════════════════════════════════════════════ */
  function update() {
    const mx  = mouse.x, my = mouse.y;
    const mr2 = MOUSE_R * MOUSE_R;

    for (let i = 0; i < N; i++) {
      /* Spring toward target */
      pvx[i] += (ptx[i] - px[i]) * SPRING;
      pvy[i] += (pty[i] - py[i]) * SPRING;

      /* Mouse repulsion */
      const mdx = px[i] - mx;
      const mdy = py[i] - my;
      const md2 = mdx * mdx + mdy * mdy;
      if (md2 < mr2 && md2 > 0.01) {
        const md = Math.sqrt(md2);
        const f  = MOUSE_F * (1 - md / MOUSE_R);
        pvx[i] += (mdx / md) * f;
        pvy[i] += (mdy / md) * f;
      }

      /* Antigravity micro-drift */
      pvx[i] += (Math.random() - .5) * DRIFT;
      pvy[i] += (Math.random() - .5) * DRIFT;

      /* Damping */
      pvx[i] *= DAMPING;
      pvy[i] *= DAMPING;

      /* Integrate */
      px[i] += pvx[i];
      py[i] += pvy[i];
    }
  }

  /* ════════════════════════════════════════════════
     RENDER — ImageData pixel writing (fastest)
  ════════════════════════════════════════════════ */
  function render() {
    /* Zero out buffer */
    buf.fill(0);

    for (let i = 0; i < N; i++) {
      const xi = px[i] | 0;
      const yi = py[i] | 0;
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) continue;

      const sz = pSz[i];
      const r  = pR[i], g = pG[i], b = pB[i];
      /* Boost alpha when moving fast — gives energy feel */
      const speed  = Math.min(Math.abs(pvx[i]) + Math.abs(pvy[i]), 4);
      const alpha  = Math.min(255, pA[i] + (speed * 15) | 0);

      if (sz === 1) {
        const idx = (yi * W + xi) << 2;
        buf[idx]     = Math.min(255, buf[idx]     + r);
        buf[idx + 1] = Math.min(255, buf[idx + 1] + g);
        buf[idx + 2] = Math.min(255, buf[idx + 2] + b);
        buf[idx + 3] = Math.min(255, buf[idx + 3] + alpha);
      } else {
        /* 2×2 or 3×3 block for larger sparkle particles */
        const half = sz >> 1;
        for (let dy = -half; dy <= half; dy++) {
          const yy = yi + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -half; dx <= half; dx++) {
            const xx = xi + dx;
            if (xx < 0 || xx >= W) continue;
            const idx = (yy * W + xx) << 2;
            buf[idx]     = Math.min(255, buf[idx]     + r);
            buf[idx + 1] = Math.min(255, buf[idx + 1] + g);
            buf[idx + 2] = Math.min(255, buf[idx + 2] + b);
            buf[idx + 3] = Math.min(255, buf[idx + 3] + alpha);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  /* ════════════════════════════════════════════════
     MAIN LOOP
  ════════════════════════════════════════════════ */
  let lastTs = 0;

  function loop(ts) {
    const dt = Math.min(ts - lastTs, 32);
    lastTs = ts;

    /* Pattern switching */
    if (ts - lastSwitch > PATTERN_MS) {
      patIdx     = (patIdx + 1) % patterns.length;
      lastSwitch = ts;
      assignPattern(patIdx);
    }

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  /* ════════════════════════════════════════════════
     BOOTSTRAP
  ════════════════════════════════════════════════ */
  const parent = canvas.parentElement;

  /* Mouse tracking on the hero section */
  parent.addEventListener('mousemove', (e) => {
    const r  = canvas.getBoundingClientRect();
    mouse.x  = e.clientX - r.left;
    mouse.y  = e.clientY - r.top;
  }, { passive: true });

  parent.addEventListener('mouseleave', () => {
    mouse.x = mouse.y = -9999;
  });

  /* Touch tracking */
  parent.addEventListener('touchmove', (e) => {
    const r  = canvas.getBoundingClientRect();
    const t  = e.touches[0];
    mouse.x  = t.clientX - r.left;
    mouse.y  = t.clientY - r.top;
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  /* Pause when tab hidden for battery */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lastTs = 0;
  });

  resize();
  init();
  assignPattern(0);
  lastSwitch = performance.now();
  requestAnimationFrame(loop);
})();
