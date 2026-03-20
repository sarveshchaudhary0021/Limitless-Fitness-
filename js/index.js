// Nav scroll
window.addEventListener('scroll', () => {
  document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 40);
});

// Stat counter
document.querySelectorAll('.stat__num').forEach(el => {
  const target = parseInt(el.dataset.target);
  if (isNaN(target)) return;
  const duration = 2000;
  const start = performance.now();
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(ease * target) + (el.nextElementSibling?.textContent.includes('%') ? '' : '+');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
});

// Exercise data
const exercises = [
  {name:'Barbell Squat',cat:'strength',muscle:'Quadriceps, Glutes'},
  {name:'Deadlift',cat:'strength',muscle:'Hamstrings, Lower Back'},
  {name:'Bench Press',cat:'strength',muscle:'Chest, Triceps'},
  {name:'Pull-Up',cat:'strength',muscle:'Lats, Biceps'},
  {name:'Overhead Press',cat:'strength',muscle:'Shoulders, Triceps'},
  {name:'Romanian Deadlift',cat:'strength',muscle:'Hamstrings, Glutes'},
  {name:'Running 5K',cat:'cardio',muscle:'Full Body Cardio'},
  {name:'Cycling',cat:'cardio',muscle:'Legs, Cardiovascular'},
  {name:'Jump Rope',cat:'cardio',muscle:'Calves, Coordination'},
  {name:'Box Jumps',cat:'cardio',muscle:'Legs, Explosive Power'},
  {name:'Plank',cat:'core',muscle:'Abs, Obliques'},
  {name:'Hanging Leg Raise',cat:'core',muscle:'Lower Abs, Hip Flexors'},
  {name:'Russian Twist',cat:'core',muscle:'Obliques, Core'},
  {name:'Ab Wheel Rollout',cat:'core',muscle:'Full Core'},
  {name:'Sun Salutation',cat:'yoga',muscle:'Full Body Flexibility'},
  {name:'Warrior II',cat:'yoga',muscle:'Hips, Legs, Shoulders'},
  {name:'Downward Dog',cat:'yoga',muscle:'Hamstrings, Shoulders'},
  {name:'Pigeon Pose',cat:'yoga',muscle:'Hip Flexors, Glutes'},
];
function renderExercises(filter) {
  const grid = document.getElementById('exercise-grid');
  if(!grid) return;
  grid.innerHTML = exercises
    .filter(e => filter === 'all' || e.cat === filter)
    .map(e => `<div class="exercise-card"><div class="exercise-card__cat">${e.cat}</div><div class="exercise-card__name">${e.name}</div><div class="exercise-card__muscle">${e.muscle}</div></div>`)
    .join('');
}
renderExercises('all');
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderExercises(btn.dataset.filter);
  });
});

// BMI override
window.updateBMIArc = function(bmi) {
  const arc = document.getElementById('bmi-arc-fill');
  const display = document.getElementById('bmi-display');
  const label = document.getElementById('bmi-label');
  const result = document.getElementById('bmi-result');
  if(!arc || !display || !label || !result) return;
  result.style.display = 'block';
  display.textContent = bmi.toFixed(1);
  const pct = Math.min(Math.max((bmi - 10) / 30, 0), 1);
  arc.style.strokeDashoffset = 251 - (pct * 251);
  if (bmi < 18.5) { arc.style.stroke = '#378ADD'; label.textContent = 'Underweight'; label.style.color = '#378ADD'; }
  else if (bmi < 25) { arc.style.stroke = '#E8FF47'; label.textContent = 'Normal Weight'; label.style.color = '#E8FF47'; }
  else if (bmi < 30) { arc.style.stroke = '#EF9F27'; label.textContent = 'Overweight'; label.style.color = '#EF9F27'; }
  else { arc.style.stroke = '#E24B4A'; label.textContent = 'Obese'; label.style.color = '#E24B4A'; }
};

// Check if original BMI calc exists and patch it
if (window.calculateBMI || true) {
  // We can't easily intercept the event if it's already bound,
  // but looking at script.js it mostly logs or sets HTML.
  const oldBtn = document.getElementById('calcBmi');
  if (oldBtn) {
    oldBtn.addEventListener('click', () => {
      // Just grab inputs manually and call our arc logic after a tiny delay giving original logic time to run
      setTimeout(()=> {
         const w = parseFloat(document.getElementById('bmiWeight').value);
         const h = parseFloat(document.getElementById('bmiHeight').value);
         if(w && h) updateBMIArc(w / ((h/100)*(h/100)));
      }, 50);
    });
  }
}

// Char counter
document.querySelector('.contact-form textarea')?.addEventListener('input', function() {
  const counter = this.parentNode.querySelector('.char-counter') || (() => {
    const c = document.createElement('div'); c.className = 'char-counter'; this.after(c); return c;
  })();
  counter.textContent = this.value.length + ' / 2000';
  counter.style.color = this.value.length > 1800 ? '#E24B4A' : 'var(--text-lo)';
});
