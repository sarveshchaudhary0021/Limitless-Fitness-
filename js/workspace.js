// ═══════════════════════════════════════════════════
//  LIMITLESS WORKSPACE — Data Engine  (workspace.js)
//  Saves workout logs → localStorage
//  Analytics page reads from the same store
// ═══════════════════════════════════════════════════

const LimitlessDB = {
  KEY: 'limitless_workouts',

  getAll() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },

  save(entry) {
    const all = this.getAll();
    all.push(entry);
    localStorage.setItem(this.KEY, JSON.stringify(all));
  },

  clear() { localStorage.removeItem(this.KEY); },

  getToday() {
    const today = new Date().toISOString().split('T')[0];
    return this.getAll().filter(e => e.date === today);
  },
};

// ───────────────────────────────────────────────────
//  WEEKLY ROUTINE CONFIG
// ───────────────────────────────────────────────────

const WEEKLY_ROUTINE = {
  0: { day: 'Sunday',    type: 'REST & RECOVERY',  target: 'Mobility & Stretching',      sets: 0, reps: 0 },
  1: { day: 'Monday',   type: 'CHEST & TRICEPS',   target: 'Push Day — Hypertrophy',     sets: 4, reps: 10 },
  2: { day: 'Tuesday',  type: 'BACK & BICEPS',     target: 'Pull Day — Strength Focus',  sets: 4, reps: 8  },
  3: { day: 'Wednesday',type: 'LEGS & GLUTES',     target: 'Lower Body — Power Phase',   sets: 4, reps: 12 },
  4: { day: 'Thursday', type: 'SHOULDERS & CORE',  target: 'Press Day — Stability Work', sets: 3, reps: 12 },
  5: { day: 'Friday',   type: 'FULL BODY HIIT',    target: 'Metabolic Conditioning',     sets: 5, reps: 15 },
  6: { day: 'Saturday', type: 'ACTIVE RECOVERY',   target: 'Yoga & Foam Rolling',        sets: 2, reps: 0  },
};

const EXERCISES = {
  'CHEST & TRICEPS':   ['Bench Press', 'Incline Dumbbell Press', 'Cable Flye', 'Tricep Pushdown', 'Skull Crusher', 'Dips'],
  'BACK & BICEPS':     ['Deadlift', 'Pull-Up', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Barbell Curl', 'Hammer Curl'],
  'LEGS & GLUTES':     ['Squat', 'Romanian Deadlift', 'Leg Press', 'Lunges', 'Leg Curl', 'Calf Raise', 'Hip Thrust'],
  'SHOULDERS & CORE':  ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Face Pull', 'Plank', 'Cable Crunch', 'Russian Twist'],
  'FULL BODY HIIT':    ['Burpees', 'Box Jump', 'Kettlebell Swing', 'Battle Rope', 'Mountain Climbers', 'Jump Squat'],
  'ACTIVE RECOVERY':   ['Foam Roll', 'Cat-Cow Stretch', 'Hip Flexor Stretch', 'Pigeon Pose', "Child's Pose"],
  'REST & RECOVERY':   ['Foam Roll', 'Light Walk', 'Stretching', 'Meditation'],
};

const MUSCLE_MAP = {
  'Bench Press': 'Chest', 'Incline Dumbbell Press': 'Chest', 'Cable Flye': 'Chest',
  'Tricep Pushdown': 'Triceps', 'Skull Crusher': 'Triceps', 'Dips': 'Triceps',
  'Deadlift': 'Back', 'Pull-Up': 'Back', 'Barbell Row': 'Back',
  'Lat Pulldown': 'Back', 'Seated Cable Row': 'Back',
  'Barbell Curl': 'Biceps', 'Hammer Curl': 'Biceps',
  'Squat': 'Quads', 'Leg Press': 'Quads', 'Lunges': 'Quads',
  'Romanian Deadlift': 'Hamstrings', 'Leg Curl': 'Hamstrings',
  'Hip Thrust': 'Glutes', 'Calf Raise': 'Calves',
  'Overhead Press': 'Shoulders', 'Lateral Raise': 'Shoulders',
  'Front Raise': 'Shoulders', 'Face Pull': 'Shoulders',
  'Plank': 'Core', 'Cable Crunch': 'Core', 'Russian Twist': 'Core',
  'Burpees': 'Cardio', 'Box Jump': 'Cardio', 'Kettlebell Swing': 'Cardio',
  'Battle Rope': 'Cardio', 'Mountain Climbers': 'Cardio', 'Jump Squat': 'Cardio',
};

// ───────────────────────────────────────────────────
//  BUILD TODAY'S ROUTINE CARD
// ───────────────────────────────────────────────────

function buildTodayRoutine() {
  const today    = new Date();
  const dow      = today.getDay();
  const routine  = WEEKLY_ROUTINE[dow];
  const exercises = EXERCISES[routine.type] || [];

  const dayEl  = document.getElementById('routine-day');
  const typeEl = document.getElementById('routine-type');
  const targEl = document.getElementById('routine-target');
  const volEl  = document.getElementById('routine-volume');

  if (dayEl)  dayEl.textContent  = routine.day.toUpperCase();
  if (typeEl) typeEl.textContent = routine.type;
  if (targEl) targEl.textContent = `Target: ${routine.target}`;
  if (volEl)  volEl.textContent  =
    routine.sets > 0
      ? `${routine.sets} Sets × ${routine.reps} Reps per exercise.`
      : 'Rest Day — focus on recovery.';

  // Populate exercise dropdown
  const select = document.getElementById('exercise-select');
  if (select) {
    select.innerHTML = '<option value="">Select Exercise...</option>';
    exercises.forEach(ex => {
      const opt = document.createElement('option');
      opt.value = ex;
      opt.textContent = ex;
      select.appendChild(opt);
    });
  }

  // Show today's log count
  const todayLogs = LimitlessDB.getToday();
  const todayCountEl = document.getElementById('today-log-count');
  if (todayCountEl) {
    todayCountEl.textContent =
      todayLogs.length > 0
        ? `${todayLogs.length} exercise${todayLogs.length > 1 ? 's' : ''} logged today`
        : 'No exercises logged yet today';
  }

  renderTodayLogs(todayLogs);
}

// ───────────────────────────────────────────────────
//  RENDER TODAY'S LOGS
// ───────────────────────────────────────────────────

function renderTodayLogs(logs) {
  const container = document.getElementById('today-logs-list');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `
      <p style="color:#666;font-size:13px;text-align:center;padding:16px 0">
        No workouts logged yet. Start logging above!
      </p>`;
    return;
  }

  container.innerHTML = logs.map(log => `
    <div style="
      display:flex; justify-content:space-between; align-items:center;
      padding:10px 14px; margin-bottom:8px;
      background:rgba(0,0,0,0.2); border:1px solid var(--border);
      border-radius:10px; animation:fadeIn 0.3s ease;
    ">
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--text-hi)">${log.exercise}</div>
        <div style="font-size:12px;color:var(--text-mid);margin-top:2px">${log.muscle || 'General'} · ${log.dateDisplay}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;color:var(--accent);font-weight:700">
          ${log.sets} × ${log.reps} reps
        </div>
        <div style="font-size:12px;color:var(--text-mid)">${log.weight}kg · Vol: ${log.volume}kg</div>
      </div>
    </div>
  `).join('');
}

// ───────────────────────────────────────────────────
//  SAVE WORKOUT HANDLER
// ───────────────────────────────────────────────────

function saveWorkout() {
  const exercise = document.getElementById('exercise-select')?.value?.trim();
  const sets     = parseInt(document.getElementById('sets-input')?.value);
  const reps     = parseInt(document.getElementById('reps-input')?.value);
  const weight   = parseFloat(document.getElementById('weight-input')?.value);

  if (!exercise)                    return showToast('Please select an exercise', 'error');
  if (!sets || sets < 1)            return showToast('Enter valid sets (min 1)', 'error');
  if (!reps || reps < 1)            return showToast('Enter valid reps (min 1)', 'error');
  if (isNaN(weight) || weight < 0)  return showToast('Enter valid weight (0 for bodyweight)', 'error');

  const dow     = new Date().getDay();
  const routine = WEEKLY_ROUTINE[dow];
  const today   = new Date();

  const entry = {
    id:          Date.now(),
    date:        today.toISOString().split('T')[0],
    dateDisplay: today.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }),
    time:        today.toTimeString().split(' ')[0],
    hour:        today.getHours(),
    dayOfWeek:   dow,
    dayName:     routine.day,
    routineType: routine.type,
    exercise,
    muscle:      MUSCLE_MAP[exercise] || 'Other',
    sets,
    reps,
    weight,
    volume:      +(sets * reps * weight).toFixed(1),
    oneRepMax:   +(weight * (1 + reps / 30)).toFixed(1),
  };

  LimitlessDB.save(entry);
  showToast(`✓ ${exercise} logged! Volume: ${entry.volume}kg`, 'success');

  // Clear form
  document.getElementById('exercise-select').value = '';
  document.getElementById('sets-input').value      = '';
  document.getElementById('reps-input').value      = '';
  document.getElementById('weight-input').value    = '';

  renderTodayLogs(LimitlessDB.getToday());

  const countEl = document.getElementById('today-log-count');
  if (countEl) {
    const n = LimitlessDB.getToday().length;
    countEl.textContent = `${n} exercise${n > 1 ? 's' : ''} logged today`;
  }
}

// ───────────────────────────────────────────────────
//  TOAST NOTIFICATION
// ───────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const existing = document.getElementById('lf-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'lf-toast';
  toast.style.cssText = `
    position:fixed; bottom:28px; right:28px; z-index:9999;
    background:${type === 'success' ? '#cbf04b' : '#ef4444'};
    color:${type === 'success' ? '#0a0a0f' : '#fff'};
    padding:12px 22px; border-radius:10px;
    font-weight:700; font-size:14px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    animation:slideUp 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ───────────────────────────────────────────────────
//  CSS ANIMATIONS
// ───────────────────────────────────────────────────

(function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(style);
})();

// ───────────────────────────────────────────────────
//  INIT
// ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  buildTodayRoutine();

  const saveBtn = document.getElementById('save-workout-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveWorkout);

  document.getElementById('weight-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveWorkout();
  });
});
