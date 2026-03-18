/* ═══════════════════════════════════════════════
   FUAAK FITNESS — Main JavaScript
   Handles: API calls, animations, interactivity
   ═══════════════════════════════════════════════ */

const API = 'http://localhost:3000/api';

// ─── LOADER ──────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
    initCounters();
    updateStreak();
  }, 2000);
});

// ─── CUSTOM CURSOR ────────────────────────────────────────────────────────────
// The cursor has been abstracted into cursor.js for global deployment.

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// Mobile menu
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });
}

// ─── THEME TOGGLE (GLOBAL) ────────────────────────────────────────────────────
const html = document.documentElement;

// Apply saved theme (Default to dark)
const savedTheme = localStorage.getItem('limitless_theme') || 'dark';
applyTheme(savedTheme);

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  localStorage.setItem('limitless_theme', theme);
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    const icon = btn.querySelector('.theme-icon');
    const label = btn.querySelector('.theme-label');
    if (theme === 'light') {
      if (icon) icon.textContent = '☀️';
      if (label) label.textContent = 'Light';
    } else {
      if (icon) icon.textContent = '🌙';
      if (label) label.textContent = 'Dark';
    }
  });
}

document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
});

// ─── PARTICLE CANVAS ─────────────────────────────────────────────────────────
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let particles = [];
const NUM_PARTICLES = 2000;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const shapes = ['\uf44b', '\uf21e', '\uf0e7', 'LIMITLESS']; // Dumbbell, Heartbeat, Bolt, Text
let currentShapeIndex = 0;

function getShapePoints(text) {
  const offCanvas = document.createElement('canvas');
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
  offCanvas.width = canvas.width;
  offCanvas.height = canvas.height;

  offCtx.fillStyle = 'white';
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';

  if (text === 'LIMITLESS') {
    offCtx.font = `bold ${Math.min(canvas.width / 6, 180)}px "Inter", sans-serif`;
    offCtx.fillText(text, offCanvas.width / 2, offCanvas.height / 2);
  } else {
    offCtx.font = `900 ${Math.min(canvas.width / 3, 300)}px "Font Awesome 6 Free"`;
    offCtx.fillText(text, offCanvas.width / 2, offCanvas.height / 2);
  }

  const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
  const data = imageData.data;
  const points = [];

  const step = Math.max(2, Math.floor(canvas.width / 300));

  for (let y = 0; y < offCanvas.height; y += step) {
    for (let x = 0; x < offCanvas.width; x += step) {
      const alpha = data[(y * offCanvas.width + x) * 4 + 3];
      if (alpha > 128) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.baseX = this.x;
    this.baseY = this.y;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = (Math.random() - 0.5) * 10;
    this.size = Math.random() * 1.5 + 0.5;
    this.color = Math.random() > 0.6 ? '#00c896' : (Math.random() > 0.5 ? '#3b82f6' : '#a259ff');
    this.friction = 0.95 + Math.random() * 0.02;
    this.ease = 0.01 + Math.random() * 0.01;
    this.isScattered = true;
  }
  update() {
    if (this.isScattered) {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.99;
      this.vy *= 0.99;

      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    } else {
      const dx = this.baseX - this.x;
      const dy = this.baseY - this.y;
      this.vx += dx * this.ease;
      this.vy += dy * this.ease;
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.x += this.vx;
      this.y += this.vy;
    }
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

for (let i = 0; i < NUM_PARTICLES; i++) {
  particles.push(new Particle());
}

function morphToShape() {
  const points = getShapePoints(shapes[currentShapeIndex]);
  if (points.length === 0) {
    setTimeout(morphToShape, 500);
    return;
  }

  particles.forEach(p => {
    p.isScattered = false;
    const target = points[Math.floor(Math.random() * points.length)];
    p.baseX = target.x + (Math.random() - 0.5) * 6;
    p.baseY = target.y + (Math.random() - 0.5) * 6;
  });

  currentShapeIndex = (currentShapeIndex + 1) % shapes.length;
}

function scatterParticles() {
  particles.forEach(p => {
    p.isScattered = true;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 2;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
  });
}

function animateParticles() {
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'light') {
    ctx.fillStyle = 'rgba(250, 250, 250, 0.4)';
  } else {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.4)';
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    p.update();
    p.draw();
  });

  requestAnimationFrame(animateParticles);
}

document.fonts.ready.then(() => {
  scatterParticles();
  animateParticles();

  setTimeout(morphToShape, 500);

  setInterval(() => {
    scatterParticles();
    setTimeout(morphToShape, 1000);
  }, 5000);
});

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.12 });
revealEls.forEach(el => revealObserver.observe(el));

// ─── ANIMATED COUNTERS ────────────────────────────────────────────────────────
function initCounters() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = parseInt(el.dataset.target);
    let current = 0;
    const increment = target / 80;
    const timer = setInterval(() => {
      current = Math.min(current + increment, target);
      el.textContent = Math.floor(current).toLocaleString();
      if (current >= target) clearInterval(timer);
    }, 20);
  });
}

// ─── STREAK TRACKER ───────────────────────────────────────────────────────────
function updateStreak() {
  const streakEl = document.getElementById('streakNav');
  const countEl = document.getElementById('streakNavCount');
  if (!streakEl || !countEl) return;

  let streak = parseInt(localStorage.getItem('limitless_streak') || '0', 10);
  const lastActive = localStorage.getItem('limitless_last_active');

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (lastActive === yesterday) {
    streak++;
    localStorage.setItem('limitless_last_active', today);
    localStorage.setItem('limitless_streak', streak);
  } else if (lastActive !== today) {
    streak = 1;
    localStorage.setItem('limitless_last_active', today);
    localStorage.setItem('limitless_streak', streak);
  }

  countEl.textContent = streak;
  streakEl.classList.remove('hidden');
}

// ─── FETCH WORKOUTS ───────────────────────────────────────────────────────────
async function loadWorkouts() {
  const grid = document.getElementById('workoutsGrid');
  try {
    const res = await fetch(`${API}/workouts`);
    const workouts = await res.json();
    grid.innerHTML = '';
    workouts.forEach((w, i) => {
      const card = document.createElement('div');
      card.className = 'workout-card reveal';
      card.style.setProperty('--accent', w.color);
      card.style.transitionDelay = `${i * 0.12}s`;
      card.innerHTML = `
        <div class="workout-card-icon">${w.icon}</div>
        <div class="workout-badge" style="background:${w.color}22;border:1px solid ${w.color}44;color:${w.color}">
          <i class="fas fa-signal"></i> ${w.level.charAt(0).toUpperCase() + w.level.slice(1)}
        </div>
        <h3>${w.title}</h3>
        <p>${w.description}</p>
        <div class="workout-meta">
          <div class="workout-meta-item"><i class="fas fa-clock"></i> ${w.duration}</div>
          <div class="workout-meta-item"><i class="fas fa-fire"></i> ${w.calories}</div>
        </div>
        <div class="workout-exercises">
          <h4>Exercises</h4>
          <div class="exercise-pill-list">
            ${w.exercises.map(e => `<span class="exercise-pill">${e}</span>`).join('')}
          </div>
        </div>
        <button class="workout-btn" style="background:${w.color}" onclick="showToast('${w.title} plan selected! 🔥', 'success')">
          <i class="fas fa-dumbbell"></i> Start This Plan
        </button>
      `;
      grid.appendChild(card);
      // Re-observe new cards
      revealObserver.observe(card);
    });
  } catch (err) {
    grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem">Unable to load workouts. Make sure the server is running on port 3000.</p>';
  }
}

// ─── FETCH EXERCISES ──────────────────────────────────────────────────────────
let allExercises = [];

async function loadExercises(category = 'all') {
  const grid = document.getElementById('exercisesGrid');
  try {
    if (!allExercises.length) {
      const res = await fetch(`${API}/exercises`);
      allExercises = await res.json();
    }
    const filtered = category === 'all' ? allExercises : allExercises.filter(e => e.category === category);
    grid.innerHTML = '';
    filtered.forEach((ex, i) => {
      const card = document.createElement('div');
      card.className = 'exercise-card';
      card.style.animationDelay = `${i * 0.06}s`;
      const diff = ex.difficulty.toLowerCase();
      card.innerHTML = `
        <div class="exercise-img-wrapper" style="width:100%; height:180px; overflow:hidden; border-radius:var(--radius-sm); margin-bottom:1.2rem; background:var(--bg-2);">
          <img src="${ex.image}" alt="${ex.name}" style="width:100%; height:100%; object-fit:cover; display:block;" loading="lazy" />
        </div>
        <h4>${ex.name}</h4>
        <div class="exercise-muscle">${ex.muscle}</div>
        <p class="exercise-posture" style="font-size:0.8rem; color:var(--text-2); margin-bottom:1rem; text-align:left; line-height:1.5;"><strong>Posture:</strong> ${ex.posture}</p>
        <div class="exercise-meta">
          <span class="exercise-tag">${ex.sets}</span>
          <span class="exercise-tag difficulty-${diff}">${ex.difficulty}</span>
          <span class="exercise-tag">${ex.category}</span>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem">Unable to load exercises. Make sure the server is running.</p>';
  }
}

// Filter tab click
document.getElementById('filterTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadExercises(btn.dataset.cat);
});

// ─── BMI CALCULATOR ───────────────────────────────────────────────────────────
let bmiUnit = 'metric';

document.getElementById('btnMetric').addEventListener('click', () => {
  bmiUnit = 'metric';
  document.getElementById('btnMetric').classList.add('active');
  document.getElementById('btnImperial').classList.remove('active');
  document.getElementById('weightUnit').textContent = 'kg';
  document.getElementById('heightUnit').textContent = 'cm';
  document.getElementById('bmiHeight').placeholder = '175';
  document.getElementById('bmiWeight').placeholder = '70';
});
document.getElementById('btnImperial').addEventListener('click', () => {
  bmiUnit = 'imperial';
  document.getElementById('btnImperial').classList.add('active');
  document.getElementById('btnMetric').classList.remove('active');
  document.getElementById('weightUnit').textContent = 'lbs';
  document.getElementById('heightUnit').textContent = 'in';
  document.getElementById('bmiHeight').placeholder = '69';
  document.getElementById('bmiWeight').placeholder = '154';
});

document.getElementById('calcBmi').addEventListener('click', async () => {
  const weight = document.getElementById('bmiWeight').value;
  const height = document.getElementById('bmiHeight').value;
  if (!weight || !height) {
    showToast('Please enter both weight and height!', 'error');
    return;
  }
  try {
    const res = await fetch(`${API}/bmi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight, height, unit: bmiUnit })
    });
    const data = await res.json();
    showBmiResult(data);
  } catch (err) {
    showToast('Error connecting to server. Is it running on port 3000?', 'error');
  }
});

function showBmiResult(data) {
  const result = document.getElementById('bmiResult');
  result.classList.remove('hidden');

  // Animate BMI number
  const numEl = document.getElementById('bmiNumber');
  let cur = 0;
  const inc = data.bmi / 60;
  const t = setInterval(() => {
    cur = Math.min(cur + inc, data.bmi);
    numEl.textContent = cur.toFixed(1);
    if (cur >= data.bmi) clearInterval(t);
  }, 16);

  // Gauge arc animation
  const arc = document.getElementById('gaugeArc');
  const maxBmi = 40;
  const pct = Math.min(data.bmi / maxBmi, 1);
  const totalLen = 283;
  const offset = totalLen - pct * totalLen;
  arc.style.strokeDashoffset = totalLen;
  arc.style.stroke = data.color;
  arc.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
  setTimeout(() => { arc.style.strokeDashoffset = offset; }, 100);

  // Category & advice
  const catEl = document.getElementById('bmiCategory');
  catEl.textContent = data.category;
  catEl.style.color = data.color;

  document.getElementById('bmiAdvice').textContent = data.advice;
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
let currentSlide = 0;
let totalSlides = 0;
let autoSlideTimer;

async function loadTestimonials() {
  const track = document.getElementById('testimonialTrack');
  const dotsContainer = document.getElementById('sliderDots');
  try {
    const res = await fetch(`${API}/testimonials`);
    const data = await res.json();
    totalSlides = data.length;

    track.innerHTML = data.map(t => `
      <div class="testimonial-card">
        <div class="testimonial-inner">
          <div class="test-stars">${'★'.repeat(t.rating)}</div>
          <p class="test-text">"${t.text}"</p>
          <div class="test-author">
            <div class="test-avatar">${t.avatar}</div>
            <div>
              <div class="test-name">${t.name}</div>
              <div class="test-role">${t.role}</div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    dotsContainer.innerHTML = data.map((_, i) =>
      `<div class="slider-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></div>`
    ).join('');

    dotsContainer.addEventListener('click', (e) => {
      const dot = e.target.closest('.slider-dot');
      if (dot) goToSlide(parseInt(dot.dataset.i));
    });

    startAutoSlide();
  } catch (err) {
    track.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem">Unable to load testimonials.</p>';
  }
}

function goToSlide(n) {
  currentSlide = (n + totalSlides) % totalSlides;
  document.getElementById('testimonialTrack').style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === currentSlide));
}

function startAutoSlide() {
  clearInterval(autoSlideTimer);
  autoSlideTimer = setInterval(() => goToSlide(currentSlide + 1), 4000);
}

document.getElementById('prevBtn').addEventListener('click', () => { goToSlide(currentSlide - 1); startAutoSlide(); });
document.getElementById('nextBtn').addEventListener('click', () => { goToSlide(currentSlide + 1); startAutoSlide(); });

// ─── CONTACT FORM ─────────────────────────────────────────────────────────────
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const feedback = document.getElementById('formFeedback');

  const body = {
    name: document.getElementById('cName').value,
    email: document.getElementById('cEmail').value,
    goal: document.getElementById('cGoal').value,
    message: document.getElementById('cMessage').value
  };

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';

  try {
    const res = await fetch(`${API}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    feedback.classList.remove('hidden', 'error');
    feedback.classList.add('success');
    feedback.textContent = '✅ ' + data.message;
    e.target.reset();
    showToast('Message sent! We\'ll be in touch soon 💪', 'success');
  } catch (err) {
    feedback.classList.remove('hidden', 'success');
    feedback.classList.add('error');
    feedback.textContent = '❌ Could not send. Please check the server is running.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
  }
});

// ─── TOAST NOTIFICATION ───────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
  toast.className = `toast ${type} show`;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 3500);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadWorkouts();
loadExercises();
loadTestimonials();
