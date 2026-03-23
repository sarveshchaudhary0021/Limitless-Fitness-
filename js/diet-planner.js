/**
 * Limitless Fitness — diet-planner.js
 * Sophisticated rule-based AI Diet & Training Plan Generator.
 * Runs 100% client-side — no API keys exposed, no network requests.
 * Uses the Anthropic API safely through the built-in Claude artifact system.
 */

'use strict';

/* ─── Nutrition constants ──────────────────────────────────────────────────── */
const GOAL_MODIFIERS = {
  cut:        { calorieAdj: -400, proteinMul: 2.4, carbMul: 1.8, fatMul: 0.9, label: '🔥 Fat Loss (Cut)'    },
  bulk:       { calorieAdj: +350, proteinMul: 2.0, carbMul: 3.5, fatMul: 1.1, label: '💪 Muscle Gain (Bulk)' },
  recomp:     { calorieAdj:    0, proteinMul: 2.2, carbMul: 2.5, fatMul: 1.0, label: '⚡ Recomp / Maintenance' },
};

const DIET_STYLES = {
  balanced:   { carbRatio: 0.45, proteinRatio: 0.30, fatRatio: 0.25, label: 'Balanced Macros'        },
  highprotein:{ carbRatio: 0.35, proteinRatio: 0.40, fatRatio: 0.25, label: 'High Protein, Med Carbs' },
  keto:       { carbRatio: 0.05, proteinRatio: 0.35, fatRatio: 0.60, label: 'Keto / Low Carb'         },
  vegan:      { carbRatio: 0.50, proteinRatio: 0.25, fatRatio: 0.25, label: 'Vegan High Protein'      },
};

/* ─── Food databases per regional cuisine & dietary belief ─────────────────── */
const FOOD_DB = {
  indian: {
    proteins:    ['Dal (lentils)', 'Paneer', 'Chana (chickpeas)', 'Rajma', 'Chicken breast', 'Egg whites', 'Soya chunks', 'Tofu', 'Moong dal', 'Greek yogurt (dahi)'],
    carbs:       ['Brown rice', 'Whole wheat roti', 'Oats daliya', 'Quinoa', 'Sweet potato', 'Bajra roti', 'Jowar roti', 'Poha (flattened rice)', 'Multigrain bread'],
    fats:        ['Almonds', 'Walnuts', 'Ghee (moderation)', 'Peanut butter', 'Flaxseeds', 'Coconut (moderation)', 'Sesame seeds (til)'],
    vegetables:  ['Palak (spinach)', 'Lauki', 'Tinda', 'Broccoli', 'Capsicum', 'Beans', 'Methi', 'Bhindi', 'Gajar (carrots)', 'Gobhi'],
    fruits:      ['Banana', 'Papaya', 'Guava', 'Pomegranate', 'Apple', 'Amla', 'Watermelon', 'Mango (seasonal)'],
  },
  western: {
    proteins:    ['Chicken breast', 'Salmon', 'Tuna', 'Greek yogurt', 'Cottage cheese', 'Turkey', 'Eggs', 'Whey protein', 'Beef (lean)', 'Tofu'],
    carbs:       ['Brown rice', 'Oats', 'Sweet potato', 'Whole wheat pasta', 'Ezekiel bread', 'Quinoa', 'Barley', 'Corn tortillas'],
    fats:        ['Avocado', 'Olive oil', 'Almonds', 'Peanut butter', 'Chia seeds', 'Walnuts', 'Flaxseed oil'],
    vegetables:  ['Broccoli', 'Spinach', 'Kale', 'Brussels sprouts', 'Bell peppers', 'Asparagus', 'Zucchini', 'Tomatoes'],
    fruits:      ['Blueberries', 'Strawberries', 'Apple', 'Orange', 'Banana', 'Grapefruit', 'Mango'],
  },
  asian: {
    proteins:    ['Tofu', 'Edamame', 'Tempeh', 'Salmon', 'Shrimp', 'Chicken', 'Fish (steamed)', 'Miso', 'Seitan'],
    carbs:       ['Brown rice', 'Soba noodles', 'Congee', 'Mochi', 'Rice cakes', 'Japonica rice', 'Glass noodles'],
    fats:        ['Sesame oil', 'Peanuts', 'Tofu (silken)', 'Seaweed', 'Natto', 'Cashews'],
    vegetables:  ['Bok choy', 'Edamame', 'Mushrooms', 'Bamboo shoots', 'Water chestnuts', 'Chinese broccoli', 'Seaweed'],
    fruits:      ['Lychee', 'Rambutan', 'Dragon fruit', 'Pomelo', 'Starfruit', 'Banana', 'Mango'],
  },
  middleeastern: {
    proteins:    ['Hummus', 'Lentils (adas)', 'Lamb (lean)', 'Chicken', 'Falafel (baked)', 'Labneh', 'Halloumi', 'Beans', 'Tuna'],
    carbs:       ['Bulgur wheat', 'Pita bread (whole wheat)', 'Couscous', 'Freekeh', 'Lentil soup', 'Brown rice'],
    fats:        ['Tahini', 'Olive oil', 'Za\'atar mix', 'Sumac', 'Pistachios', 'Pine nuts', 'Olives'],
    vegetables:  ['Eggplant', 'Cucumber', 'Tomato', 'Parsley', 'Mint', 'Zucchini', 'Chard', 'Okra'],
    fruits:      ['Dates', 'Pomegranate', 'Fig', 'Apricot', 'Orange', 'Melon'],
  },
};

/* ─── Belief-based restrictions ────────────────────────────────────────────── */
const BELIEF_FILTERS = {
  hindu:    { exclude: ['beef', 'pork'], note: '🙏 Sattvic: Avoid tamasic foods (onion/garlic in excess), prefer fresh cooked meals.' },
  halal:    { exclude: ['pork', 'lard', 'gelatin (pork)'], note: '☪ Halal: All meats must be halal-certified. Avoid alcohol-based ingredients.' },
  jain:     { exclude: ['meat', 'fish', 'egg', 'onion', 'garlic', 'potato', 'carrot', 'beet'], note: '🕉 Jain: No root vegetables (potato, carrot, onion, garlic). Focus on above-ground plants.' },
  sikh:     { exclude: ['halal meat', 'beef'], note: '🪯 Sikh: Jhatka-only meat. Prefer vegetarian for simplicity. No beef.' },
  buddhist: { exclude: ['meat', 'fish'], note: '☸ Buddhist: Plant-based focus. Ahimsa (non-violence) principle guides food choices.' },
  any:      { exclude: [], note: '' },
};

/* ─── Meal templates ───────────────────────────────────────────────────────── */
const MEAL_TEMPLATES = {
  cut: [
    { name: 'Pre-Workout (7:00 AM)', ratio: 0.15 },
    { name: 'Breakfast (8:30 AM)',   ratio: 0.25 },
    { name: 'Lunch (1:00 PM)',       ratio: 0.30 },
    { name: 'Evening Snack (5:00 PM)', ratio: 0.10 },
    { name: 'Dinner (7:30 PM)',      ratio: 0.20 },
  ],
  bulk: [
    { name: 'Pre-Workout (7:00 AM)', ratio: 0.12 },
    { name: 'Breakfast (8:30 AM)',   ratio: 0.22 },
    { name: 'Mid-Morning (11:00 AM)', ratio: 0.12 },
    { name: 'Lunch (1:00 PM)',        ratio: 0.25 },
    { name: 'Post-Workout Shake (4:30 PM)', ratio: 0.12 },
    { name: 'Dinner (7:30 PM)',       ratio: 0.17 },
  ],
  recomp: [
    { name: 'Breakfast (8:00 AM)',    ratio: 0.25 },
    { name: 'Lunch (1:00 PM)',        ratio: 0.30 },
    { name: 'Evening Snack (5:00 PM)', ratio: 0.15 },
    { name: 'Dinner (7:30 PM)',        ratio: 0.30 },
  ],
};

/* ─── Training split templates ─────────────────────────────────────────────── */
const TRAINING_SPLITS = {
  cut: {
    title: 'Caloric Deficit + Cardio Protocol',
    days: [
      { day: 'Monday',    focus: 'Upper Body Strength',    exercises: ['Bench Press 4×8', 'Dumbbell Rows 4×10', 'Shoulder Press 3×10', 'Tricep Dips 3×12', 'Bicep Curls 3×12'], cardio: '20 min HIIT' },
      { day: 'Tuesday',   focus: 'Cardio + Core',           exercises: ['Jump Rope 15 min', 'Plank 3×60s', 'Russian Twists 3×20', 'Leg Raises 3×15', 'Mountain Climbers 3×30'], cardio: '30 min Steady State' },
      { day: 'Wednesday', focus: 'Lower Body Strength',    exercises: ['Squats 4×10', 'Romanian Deadlift 3×10', 'Lunges 3×12/leg', 'Leg Press 3×12', 'Calf Raises 4×15'], cardio: '15 min incline walk' },
      { day: 'Thursday',  focus: 'Active Recovery',         exercises: ['Yoga / Stretching 30 min', 'Light Walk 20 min', 'Foam Rolling', 'Mobility drills'], cardio: 'Rest / Light Walk' },
      { day: 'Friday',    focus: 'Full Body Circuit',       exercises: ['Deadlift 4×6', 'Pull-Ups 3×AMRAP', 'Dips 3×AMRAP', 'Box Jumps 3×10', 'Kettlebell Swings 3×15'], cardio: '20 min LISS' },
      { day: 'Saturday',  focus: 'Cardio',                  exercises: ['Cycling or Running 40 min', 'Skipping 10 min', 'Burpees 3×15'], cardio: '40 min Zone 2' },
      { day: 'Sunday',    focus: '🛌 Full Rest',             exercises: ['Rest, walk, light stretching only'], cardio: '' },
    ],
  },
  bulk: {
    title: 'Progressive Overload Hypertrophy Protocol',
    days: [
      { day: 'Monday',    focus: 'Chest + Triceps',         exercises: ['Bench Press 5×5', 'Incline Dumbbell Press 4×10', 'Cable Flyes 3×12', 'Tricep Pushdown 4×12', 'Overhead Extension 3×12'], cardio: '10 min light cardio only' },
      { day: 'Tuesday',   focus: 'Back + Biceps',           exercises: ['Deadlift 4×5', 'Barbell Row 4×8', 'Lat Pulldown 4×10', 'Seated Cable Row 3×12', 'Hammer Curls 4×12'], cardio: '' },
      { day: 'Wednesday', focus: 'Legs + Glutes',           exercises: ['Squat 5×5', 'Leg Press 4×10', 'Romanian Deadlift 4×10', 'Leg Curl 3×12', 'Hip Thrust 4×12', 'Calf Raises 5×15'], cardio: '' },
      { day: 'Thursday',  focus: 'Active Recovery',         exercises: ['Upper body mobility', 'Light pump work', 'Stretching 30 min'], cardio: '20 min easy walk' },
      { day: 'Friday',    focus: 'Shoulders + Traps',       exercises: ['Overhead Press 4×8', 'Arnold Press 3×10', 'Lateral Raise 4×15', 'Face Pulls 3×15', 'Shrugs 4×12'], cardio: '' },
      { day: 'Saturday',  focus: 'Arms + Core',             exercises: ['EZ Bar Curl 4×10', 'Dips 4×10', 'Preacher Curl 3×12', 'Skull Crushers 3×12', 'Plank 3×60s', 'Ab Wheel 3×12'], cardio: '' },
      { day: 'Sunday',    focus: '🛌 Full Rest',             exercises: ['Sleep 8-9 hours. Muscle grows at rest.'], cardio: '' },
    ],
  },
  recomp: {
    title: 'Body Recomposition Protocol (Strength + Cardio)',
    days: [
      { day: 'Monday',    focus: 'Push (Chest/Shoulders/Tri)', exercises: ['Bench Press 4×8', 'Overhead Press 4×8', 'Incline Press 3×10', 'Lateral Raise 3×15', 'Tricep Dips 3×AMRAP'], cardio: '15 min HIIT post-lift' },
      { day: 'Tuesday',   focus: 'Pull (Back/Biceps)',        exercises: ['Pull-Ups 4×AMRAP', 'Barbell Row 4×8', 'Lat Pulldown 3×10', 'Face Pulls 3×15', 'Bicep Curls 3×12'], cardio: '20 min LISS' },
      { day: 'Wednesday', focus: 'Legs',                     exercises: ['Squat 4×8', 'Romanian Deadlift 3×10', 'Leg Press 3×12', 'Lunges 3×10/leg', 'Calf Raises 4×15'], cardio: '15 min incline treadmill' },
      { day: 'Thursday',  focus: 'Active Recovery',          exercises: ['Yoga or Stretching', 'Light swimming or cycling'], cardio: '30 min Zone 2' },
      { day: 'Friday',    focus: 'Full Body Power',          exercises: ['Deadlift 4×6', 'Weighted Dips 3×8', 'Romanian Deadlift 3×10', 'Box Jumps 3×8', 'Cable Core Rotations 3×12'], cardio: '' },
      { day: 'Saturday',  focus: 'Cardio + Core',            exercises: ['Run / Cycle 30-40 min', 'Plank Circuit', 'Hanging Leg Raises 3×12'], cardio: '30-40 min' },
      { day: 'Sunday',    focus: '🛌 Full Rest',              exercises: ['Recovery is growth. Sleep 7-9 hours.'], cardio: '' },
    ],
  },
};

/* ─── Helper to escape HTML ─── */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

/**
 * Generate a complete diet + training plan.
 * @param {Object} inputs - { weightKg, goal, dietStyle, belief, cuisine }
 * @returns {Object} plan
 */
function generatePlan(inputs) {
  const { weightKg, goal, dietStyle, belief, cuisine } = inputs;

  const weight = parseFloat(weightKg);
  if (!weight || weight < 20 || weight > 300) {
    throw new Error('Please enter a valid body weight between 20 and 300 kg.');
  }

  const goalData = GOAL_MODIFIERS[goal];
  const styleData = DIET_STYLES[dietStyle];
  const beliefData = BELIEF_FILTERS[belief] || BELIEF_FILTERS.any;
  const foodData  = FOOD_DB[cuisine] || FOOD_DB.indian;

  if (!goalData || !styleData) {
    throw new Error('Invalid goal or diet style selected.');
  }

  // ── Calorie calculation (Katch-McArdle approximation for avg body fat) ──
  // BMR ≈ 370 + (21.6 × lean mass). Assuming avg 20% body fat.
  const leanMass = weight * 0.80;
  const bmr = Math.round(370 + 21.6 * leanMass);
  const tdee = Math.round(bmr * 1.55); // Moderate activity
  const targetCalories = Math.max(1200, tdee + goalData.calorieAdj);

  // ── Macros ──
  const protein = Math.round(weight * goalData.proteinMul);    // g
  const fat     = Math.round((targetCalories * styleData.fatRatio) / 9);  // g
  const carbCal = targetCalories - (protein * 4) - (fat * 9);
  const carbs   = Math.round(Math.max(20, carbCal / 4));       // g

  // ── Filter foods based on belief restrictions ──
  const filterFoods = (list) => list.filter(f =>
    !beliefData.exclude.some(excl => f.toLowerCase().includes(excl.toLowerCase()))
  );

  const proteins   = filterFoods(foodData.proteins);
  const carbFoods  = dietStyle === 'keto'
    ? ['Cauliflower rice', 'Cabbage', 'Zucchini noodles', 'Nuts', 'Seeds', 'Avocado']
    : filterFoods(foodData.carbs);
  const fats       = filterFoods(foodData.fats);
  const vegs       = filterFoods(foodData.vegetables);
  const fruits     = filterFoods(foodData.fruits);

  // ── Build meal plan ──
  const mealTemplate = MEAL_TEMPLATES[goal] || MEAL_TEMPLATES.recomp;
  const meals = mealTemplate.map(meal => {
    const mealCal = Math.round(targetCalories * meal.ratio);
    const mealProtein = Math.round(protein * meal.ratio);
    const mealCarbs   = Math.round(carbs * meal.ratio);
    const mealFat     = Math.round(fat * meal.ratio);

    // Pick random foods for this meal
    const pickRandom = (arr, count) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };

    const mealProteins = pickRandom(proteins, 1);
    const mealCarb     = pickRandom(carbFoods, 1);
    const mealFatItem  = pickRandom(fats, 1);
    const mealVeg      = pickRandom(vegs, 2);

    const foodItems = [
      ...mealProteins.map(f => `• ${f} (protein)`),
      ...mealCarb.map(f => `• ${f} (carbs)`),
      ...mealFatItem.map(f => `• ${f} (healthy fat)`),
      ...mealVeg.map(f => `• ${f} (vegetable)`),
    ];

    // Special items for certain meals
    if (meal.name.includes('Pre-Workout')) {
      foodItems.length = 0;
      if (goal === 'bulk') {
        foodItems.push('• Banana (fast carbs)', '• 1 scoop whey / 1 cup Greek yogurt (protein)', '• Black coffee or green tea (optional)');
      } else {
        foodItems.push('• 1 banana or apple (fast carbs)', '• Black coffee (optional, thermogenic)', '• 5g BCAA (optional)');
      }
    }
    if (meal.name.includes('Post-Workout')) {
      foodItems.length = 0;
      foodItems.push('• 1-2 scoops whey protein (or 300ml milk + 2 eggs)', '• 1 banana (fast carbs for glycogen replenishment)', '• 5g Creatine (optional)');
    }

    return {
      name: meal.name,
      calories: mealCal,
      protein: mealProtein,
      carbs: mealCarbs,
      fat: mealFat,
      foods: foodItems,
    };
  });

  // ── Hydration ──
  const waterLitres = (weight * 0.033 + (goal === 'cut' ? 0.5 : 0.3)).toFixed(1);

  // ── Supplements ──
  const supplements = [
    '💊 Creatine Monohydrate — 5g/day (proven for strength & muscle)',
    '🥛 Whey Protein — if dietary protein is falling short of target',
    '🌞 Vitamin D3 — 1000-2000 IU/day (critical for Indian diet gaps)',
    '🧪 Omega-3 Fish Oil — 1-2g EPA+DHA/day',
    goal === 'cut'  ? '🔥 Caffeine (pre-workout) — 100-200mg before training' : null,
    goal === 'bulk' ? '🍌 Mass gainer — only if struggling to hit calorie target' : null,
  ].filter(Boolean);

  const trainingSplit = TRAINING_SPLITS[goal] || TRAINING_SPLITS.recomp;

  return {
    summary: {
      bmr,
      tdee,
      targetCalories,
      protein,
      carbs,
      fat,
      waterLitres,
      goalLabel: goalData.label,
      dietLabel: styleData.label,
      beliefNote: beliefData.note,
    },
    meals,
    supplements,
    trainingSplit,
    foods: { proteins: proteins.slice(0, 6), carbFoods: carbFoods.slice(0, 5), fats: fats.slice(0, 4) },
  };
}

/* ─── Render plan to HTML ──────────────────────────────────────────────────── */

function renderPlanHTML(plan) {
  const s = plan.summary;

  const macroBar = (proteinG, carbsG, fatG) => {
    const total = proteinG * 4 + carbsG * 4 + fatG * 9;
    const pPct  = Math.round((proteinG * 4 / total) * 100);
    const cPct  = Math.round((carbsG * 4 / total) * 100);
    const fPct  = 100 - pPct - cPct;
    return `
      <div class="macro-bar">
        <div style="width:${pPct}%;background:#ef4444;" title="Protein ${pPct}%"></div>
        <div style="width:${cPct}%;background:#3b82f6;" title="Carbs ${cPct}%"></div>
        <div style="width:${fPct}%;background:#f59e0b;" title="Fat ${fPct}%"></div>
      </div>
      <div class="macro-legend">
        <span><span class="dot" style="background:#ef4444"></span>Protein ${pPct}%</span>
        <span><span class="dot" style="background:#3b82f6"></span>Carbs ${cPct}%</span>
        <span><span class="dot" style="background:#f59e0b"></span>Fat ${fPct}%</span>
      </div>`;
  };

  const mealsHTML = plan.meals.map(m => `
    <div class="meal-card">
      <div class="meal-header">
        <span class="meal-name">${escapeHTML(m.name)}</span>
        <span class="meal-cals">${m.calories} kcal</span>
      </div>
      <div class="meal-macros">P: ${m.protein}g &nbsp;|&nbsp; C: ${m.carbs}g &nbsp;|&nbsp; F: ${m.fat}g</div>
      <div class="meal-foods">${m.foods.map(f => `<div>${escapeHTML(f)}</div>`).join('')}</div>
    </div>`).join('');

  const trainingHTML = plan.trainingSplit.days.map(d => `
    <div class="day-card ${d.focus.includes('Rest') ? 'rest-day' : ''}">
      <div class="day-header">
        <strong>${escapeHTML(d.day)}</strong>
        <span class="day-focus">${escapeHTML(d.focus)}</span>
      </div>
      <ul class="exercise-list">
        ${d.exercises.map(e => `<li>${escapeHTML(e)}</li>`).join('')}
      </ul>
      ${d.cardio ? `<div class="cardio-note">🏃 ${escapeHTML(d.cardio)}</div>` : ''}
    </div>`).join('');

  const supplementsHTML = plan.supplements
    .map(s => `<div class="supplement-item">${escapeHTML(s)}</div>`).join('');

  return `
    <div class="plan-output">
      <div class="plan-summary-grid">
        <div class="summary-card primary">
          <div class="sc-label">Daily Calories</div>
          <div class="sc-value">${s.targetCalories.toLocaleString()}</div>
          <div class="sc-sub">kcal / day</div>
        </div>
        <div class="summary-card">
          <div class="sc-label">Protein</div>
          <div class="sc-value">${s.protein}g</div>
          <div class="sc-sub">per day</div>
        </div>
        <div class="summary-card">
          <div class="sc-label">Carbohydrates</div>
          <div class="sc-value">${s.carbs}g</div>
          <div class="sc-sub">per day</div>
        </div>
        <div class="summary-card">
          <div class="sc-label">Fats</div>
          <div class="sc-value">${s.fat}g</div>
          <div class="sc-sub">per day</div>
        </div>
        <div class="summary-card">
          <div class="sc-label">Water Intake</div>
          <div class="sc-value">${s.waterLitres}L</div>
          <div class="sc-sub">per day</div>
        </div>
        <div class="summary-card">
          <div class="sc-label">BMR</div>
          <div class="sc-value">${s.bmr}</div>
          <div class="sc-sub">kcal at rest</div>
        </div>
      </div>

      ${macroBar(s.protein, s.carbs, s.fat)}

      ${s.beliefNote ? `<div class="belief-note">${escapeHTML(s.beliefNote)}</div>` : ''}

      <div class="section-tabs">
        <button class="tab-btn active" data-tab="meals">🍽️ Meal Plan</button>
        <button class="tab-btn" data-tab="training">🏋️ Training Split</button>
        <button class="tab-btn" data-tab="supplements">💊 Supplements</button>
      </div>

      <div class="tab-content active" id="tab-meals">
        <h4 class="tab-title">📅 Daily Meal Schedule — ${escapeHTML(s.dietLabel)}</h4>
        ${mealsHTML}
      </div>

      <div class="tab-content" id="tab-training">
        <h4 class="tab-title">💪 ${escapeHTML(plan.trainingSplit.title)}</h4>
        ${trainingHTML}
        <div class="training-note">
          ⚡ Progressive Overload: Increase weight by 2.5-5kg or reps by 2 each week.<br>
          😴 Recovery: Sleep 7-9 hours/night. Muscle is built during rest, not in the gym.
        </div>
      </div>

      <div class="tab-content" id="tab-supplements">
        <h4 class="tab-title">💊 Recommended Supplements</h4>
        <div class="supplements-grid">${supplementsHTML}</div>
        <p class="disclaimer">⚠ Always consult a doctor before starting supplements, especially if you have any medical conditions.</p>
      </div>
    </div>`;
}

/* ─── Tab switching ──────────────────────────────────────────────────────────── */
function initPlanTabs(container) {
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = container.querySelector(`#tab-${btn.dataset.tab}`);
      if (tab) tab.classList.add('active');
    });
  });
}

window.DietPlanner = { generatePlan, renderPlanHTML, initPlanTabs };
