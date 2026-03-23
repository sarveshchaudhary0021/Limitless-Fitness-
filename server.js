const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { spawn } = require('child_process');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET is not set in .env — refusing to start.');
  process.exit(1);
}

// Startup security warnings
if (!process.env.GROQ_API_KEY) console.warn('⚠️  WARNING: GROQ_API_KEY not set — AI chat will fail.');
if (!process.env.CLAUDE_API_KEY) console.warn('⚠️  WARNING: CLAUDE_API_KEY not set — Claude fallback disabled.');
if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === 'your_razorpay_secret_here') {
  console.warn('⚠️  WARNING: RAZORPAY_KEY_SECRET is not configured — payments will fail signature verification.');
}

// Setup Razorpay instance (using env variables)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

const app = express();
const PORT = process.env.PORT || 5000;

// Expose the standalone Public Chatbot Sandbox UI directly to the router
app.use('/public', express.static(path.join(__dirname, 'public')));

// ─── DATABASE SETUP ───────────────────────────────────────────────────────────

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'limitless_fitness',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    const dbName = process.env.DB_NAME || 'limitless_fitness';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        goal VARCHAR(255) NOT NULL DEFAULT 'general',
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        subscription_plan VARCHAR(50) DEFAULT 'free',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Added check for subscription_plan column if table already exists
    try {
      await pool.query('ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(50) DEFAULT "free"');
    } catch (e) {
      // Column might already exist
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_id VARCHAR(255) NOT NULL,
        payment_id VARCHAR(255) NOT NULL,
        signature VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        plan_name VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        exercise VARCHAR(255) NOT NULL,
        sets INT NOT NULL,
        reps INT NOT NULL,
        weight DECIMAL(5,2) NOT NULL,
        logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ MySQL database connected — ' + dbName);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
}
initDB();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

// ─── CORS: Whitelist allowed origins ────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5500',  // VS Code Live Server
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman in dev)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// ─── STATIC DATA ──────────────────────────────────────────────────────────────

const workouts = [
  {
    id: 1,
    level: 'beginner',
    title: 'Foundation Builder',
    duration: '30 min',
    calories: '200–300 kcal',
    icon: '🌱',
    color: '#00c896',
    exercises: ['Bodyweight Squats', 'Push-Ups', 'Plank Hold', 'Jumping Jacks', 'Mountain Climbers'],
    description: 'Perfect starting point. Build strength, flexibility, and stamina with simple yet effective movements.'
  },
  {
    id: 2,
    level: 'intermediate',
    title: 'Power Surge',
    duration: '45 min',
    calories: '350–500 kcal',
    icon: '⚡',
    color: '#ff6b35',
    exercises: ['Dumbbell Lunges', 'Pull-Ups', 'Burpees', 'Kettlebell Swings', 'Box Jumps'],
    description: 'Step up your game. A balanced blend of strength and cardio to break plateaus and build real power.'
  },
  {
    id: 3,
    level: 'advanced',
    title: 'Elite Shred',
    duration: '60 min',
    calories: '600–800 kcal',
    icon: '🔥',
    color: '#e63946',
    exercises: ['Barbell Deadlifts', 'Muscle-Ups', 'Sprint Intervals', 'Weighted Dips', 'Clean & Press'],
    description: 'For the serious athlete. High-intensity, compound movements to maximise muscle growth and fat burn.'
  }
];

const exercises = [
  { id: 1, name: 'Push-Up', category: 'strength', muscle: 'Chest', difficulty: 'Easy', sets: '3×15', image: '/images/push_up.png', posture: 'Hands shoulder-width apart, body in a straight line. Lower until chest nearly touches floor.' },
  { id: 2, name: 'Squat', category: 'strength', muscle: 'Legs', difficulty: 'Easy', sets: '4×12', image: '/images/squat.png', posture: 'Feet shoulder-width apart. Keep chest up, push hips back and down as if sitting.' },
  { id: 3, name: 'Plank', category: 'core', muscle: 'Core', difficulty: 'Medium', sets: '3×45s', image: '/images/plank.png', posture: 'Rest on forearms, elbows directly under shoulders. Keep body straight from head to heels.' },
  { id: 4, name: 'Burpee', category: 'cardio', muscle: 'Full Body', difficulty: 'Hard', sets: '3×10', image: '/images/burpee.png', posture: 'Squat, thrust feet back to plank, push-up, jump feet forward, jump up reaching high.' },
  { id: 5, name: 'Pull-Up', category: 'strength', muscle: 'Back', difficulty: 'Hard', sets: '3×8', image: '/images/pull_up.png', posture: 'Overhand grip slightly wider than shoulders. Pull chin above bar without swinging.' },
  { id: 6, name: 'Deadlift', category: 'strength', muscle: 'Back & Legs', difficulty: 'Hard', sets: '4×6', image: '/images/deadlift.png', posture: 'Bar over mid-foot. Hinge at hips, keep back straight, lift by driving through heels.' },
  { id: 7, name: 'Mountain Climber', category: 'cardio', muscle: 'Core & Cardio', difficulty: 'Medium', sets: '3×30s', image: '/images/mountain_climber.png', posture: 'Plank position. Alternately drive knees toward chest quickly while keeping hips low.' },
  { id: 8, name: 'Russian Twist', category: 'core', muscle: 'Obliques', difficulty: 'Medium', sets: '3×20', image: '/images/russian_twist.png', posture: 'Sit, lean back slightly, feet off floor. Twist torso side to side touching hand to floor.' },
  { id: 9, name: 'Jumping Jacks', category: 'cardio', muscle: 'Full Body', difficulty: 'Easy', sets: '3×60s', image: '/images/jumping_jacks.png', posture: 'Jump while spreading legs and raising arms above head, then return to start.' },
  { id: 10, name: 'Lunge', category: 'strength', muscle: 'Legs', difficulty: 'Easy', sets: '3×12', image: '/images/lunge.png', posture: 'Step forward, drop back knee until both knees are at 90 degrees. Keep torso upright.' },
  { id: 11, name: 'Bicycle Crunch', category: 'core', muscle: 'Abs', difficulty: 'Medium', sets: '3×20', image: '/images/bicycle_crunch.png', posture: 'Lie on back. Bring opposite elbow to opposite knee while extending other leg.' },
  { id: 12, name: 'Box Jump', category: 'cardio', muscle: 'Legs & Explosive', difficulty: 'Hard', sets: '3×8', image: '/images/box_jump.png', posture: 'Stand a foot from box. Swing arms back, jump forcefully, land softly on both feet.' },
  { id: 13, name: "Child's Pose", category: 'yoga', muscle: 'Relaxation', difficulty: 'Easy', sets: '2×60s', image: '/images/childs_pose.png', posture: 'Kneel, touch big toes together, sit on heels, and stretch arms forward.' },
  { id: 14, name: 'Downward Dog', category: 'yoga', muscle: 'Hamstrings & Back', difficulty: 'Medium', sets: '3×30s', image: '/images/downward_dog.png', posture: 'Hands shoulder-width, feet hip-width. Lift hips up and back, press chest toward thighs.' },
  { id: 15, name: 'Crow Pose', category: 'yoga', muscle: 'Core & Arms', difficulty: 'Hard', sets: '3×15s', image: '/images/crow_pose.png', posture: 'Squat down, place hands flat on floor. Rest knees on triceps and slowly lift feet.' },
  { id: 16, name: 'Warrior II', category: 'yoga', muscle: 'Legs & Core', difficulty: 'Medium', sets: '3×45s', image: '/images/warrior_two.png', posture: 'Step one foot back, turn it 90 degrees. Bend front knee, extend arms parallel to floor.' }
];

const testimonials = [
  { name: 'Arjun Mehta', role: 'Lost 18kg in 4 months', avatar: 'AM', text: 'Limitless completely changed my approach. The AI Smart Generator gave me a diet that actually fit my Indian cuisine preferences, making consistency effortless.', rating: 5 },
  { name: 'Priya Singh', role: 'Corporate Professional', avatar: 'PS', text: 'I love the Interactive Tracker. Logging my sets and watching the volume chart climb on my dashboard keeps me hooked. The daily UI is absolutely beautiful.', rating: 5 },
  { name: 'Rahul Verma', role: 'Powerlifter', avatar: 'RV', text: 'The Momentum Pro subscription is worth every penny. The 1-on-1 coaching completely fixed my deadlift form. My strength gains have exploded.', rating: 5 },
  { name: 'Neha Kapoor', role: 'Yoga & Wellbeing Coach', avatar: 'NK', text: 'I recommend Limitless to all my clients. The yoga library with detailed postures is comprehensive, and the medical guidelines for BP ensure safety first.', rating: 5 }
];

// ─── ROUTES — PUBLIC ──────────────────────────────────────────────────────────

// GET all workout plans
app.get('/api/workouts', (req, res) => {
  const { level } = req.query;
  if (level) {
    return res.json(workouts.filter(w => w.level === level));
  }
  res.json(workouts);
});

// GET exercise library
app.get('/api/exercises', (req, res) => {
  const { category } = req.query;
  if (category && category !== 'all') {
    return res.json(exercises.filter(e => e.category === category));
  }
  res.json(exercises);
});

// GET testimonials
app.get('/api/testimonials', (req, res) => {
  res.json(testimonials);
});

// POST BMI calculator
app.post('/api/bmi', (req, res) => {
  const { weight, height, unit } = req.body;

  if (!weight || !height) {
    return res.status(400).json({ error: 'Weight and height are required.' });
  }

  let weightKg = parseFloat(weight);
  let heightM = parseFloat(height);
  let bmi;

  if (unit === 'imperial') {
    bmi = (703 * weightKg) / (heightM * heightM);
  } else {
    heightM = heightM / 100;
    bmi = weightKg / (heightM * heightM);
  }

  bmi = parseFloat(bmi.toFixed(1));

  let category, advice, color;
  if (bmi < 18.5) {
    category = 'Underweight';
    advice = 'Focus on strength training and increase your caloric intake with nutrient-dense foods.';
    color = '#4fc3f7';
  } else if (bmi < 25) {
    category = 'Normal Weight';
    advice = 'Excellent! Maintain your current routine with balanced cardio and strength training.';
    color = '#00c896';
  } else if (bmi < 30) {
    category = 'Overweight';
    advice = 'Increase cardio sessions and monitor your diet. Small consistent changes yield big results.';
    color = '#ff9800';
  } else {
    category = 'Obese';
    advice = 'Start with low-impact cardio and consult a healthcare professional for a personalised plan.';
    color = '#e63946';
  }

  res.json({ bmi, category, advice, color });
});

// ─── SMART GENERATOR ROUTES ──────────────────────────────────────────────────



// ─── AUTHENTICATION ROUTES ───────────────────────────────────────────────────

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Valid name, email, and 6+ char password required.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hash]
    );

    const token = jwt.sign({ id: result.insertId, email }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ token, user: { id: result.insertId, name, email, subscription_plan: 'free' } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already in use.' });
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);

    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials.' });
    const user = rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, subscription_plan: user.subscription_plan } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check auth state (Me)
app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });

    try {
      const [rows] = await pool.query('SELECT id, name, email, subscription_plan FROM users WHERE id = ?', [decoded.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ user: rows[0] });
    } catch (dbErr) {
      res.status(500).json({ error: 'Database error' });
    }
  });
});

// ─── INTERACTIVE TRACKER ROUTES ──────────────────────────────────────────────

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token expired' });
    req.user = user;
    next();
  });
};

app.post('/api/workouts/log', authenticateToken, async (req, res) => {
  try {
    const { exercise, sets, reps, weight } = req.body;

    // ── Input Validation ────────────────────────────────────────────────────
    if (!exercise || typeof exercise !== 'string' || exercise.trim().length < 2 || exercise.trim().length > 100) {
      return res.status(400).json({ error: 'Exercise name must be 2–100 characters.' });
    }
    const parsedSets   = parseInt(sets, 10);
    const parsedReps   = parseInt(reps, 10);
    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedSets)   || parsedSets   < 1 || parsedSets   > 100)  return res.status(400).json({ error: 'Sets must be a number between 1 and 100.' });
    if (isNaN(parsedReps)   || parsedReps   < 1 || parsedReps   > 1000) return res.status(400).json({ error: 'Reps must be a number between 1 and 1000.' });
    if (isNaN(parsedWeight) || parsedWeight < 0 || parsedWeight > 1000) return res.status(400).json({ error: 'Weight must be a number between 0 and 1000 kg.' });

    await pool.query(
      'INSERT INTO workout_logs (user_id, exercise, sets, reps, weight) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, exercise.trim(), parsedSets, parsedReps, parsedWeight]
    );
    res.json({ success: true, message: 'Workout logged successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log workout.' });
  }
});

app.get('/api/workouts/history', authenticateToken, async (req, res) => {
  try {
    const [logs] = await pool.query(
      'SELECT exercise, sets, reps, weight, DATE_FORMAT(logged_at, "%Y-%m-%d") as date FROM workout_logs WHERE user_id = ? ORDER BY logged_at ASC',
      [req.user.id]
    );
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

app.get('/api/dashboard/today', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT subscription_plan FROM users WHERE id = ?', [req.user.id]);
    const plan = rows[0]?.subscription_plan || 'free';

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    const dayName = days[today];

    const routines = {
      0: { title: "Rest & Recovery", target: "Mobility & Stretching", sets: 0, reps: 0 },
      1: { title: "Day 1 - Push Day", target: "Chest, Shoulders & Triceps", sets: 4, reps: 10 },
      2: { title: "Day 2 - Pull Day", target: "Back & Biceps", sets: 4, reps: 10 },
      3: { title: "Day 3 - Leg Day", target: "Quads, Hamstrings & Calves", sets: 4, reps: 12 },
      4: { title: "Day 4 - Upper Body", target: "Shoulders, Chest & Core", sets: 3, reps: 15 },
      5: { title: "Day 5 - Full Body", target: "Compound Movements", sets: 3, reps: 8 },
      6: { title: "Active Rest", target: "Light Cardio", sets: 0, reps: 0 }
    };

    res.json({ success: true, dayName, routine: routines[today], plan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily routine.' });
  }
});

app.get('/api/dashboard/analytics', authenticateToken, async (req, res) => {
  try {
    const [logs] = await pool.query(
      'SELECT exercise, sets, reps, weight, DATE_FORMAT(logged_at, "%Y-%m-%d") as date FROM workout_logs WHERE user_id = ? ORDER BY logged_at ASC',
      [req.user.id]
    );

    // Pure JS Aggregation (Replacing python script dependency)
    const heatmapMap = {};
    const pieMap = {};

    logs.forEach(log => {
      // Heatmap volume score per day
      if (!heatmapMap[log.date]) heatmapMap[log.date] = 0;
      heatmapMap[log.date] += (log.sets || 1) * 10; // score multiplier

      // Categorize exercises for Pie Chart
      const ex = log.exercise.toLowerCase();
      let category = 'Other';
      if (ex.includes('bench') || ex.includes('chest') || ex.includes('pec') || ex.includes('fly')) category = 'Chest';
      else if (ex.includes('row') || ex.includes('pull') || ex.includes('lat') || ex.includes('back')) category = 'Back';
      else if (ex.includes('squat') || ex.includes('leg') || ex.includes('calf') || ex.includes('press') && ex.includes('leg')) category = 'Legs';
      else if (ex.includes('curl') || ex.includes('extension') || ex.includes('tri') || ex.includes('bi')) category = 'Arms';
      else if (ex.includes('press') || ex.includes('shoulder') || ex.includes('delt')) category = 'Shoulders';
      else if (ex.includes('core') || ex.includes('crunch') || ex.includes('plank')) category = 'Core';
      else if (ex.includes('run') || ex.includes('treadmill') || ex.includes('cardio')) category = 'Cardio';

      if (!pieMap[category]) pieMap[category] = 0;
      pieMap[category] += (log.sets || 1);
    });

    const heatmap = Object.keys(heatmapMap).map(date => ({ date, count: heatmapMap[date] }));
    const pieChart = {
      labels: Object.keys(pieMap),
      data: Object.values(pieMap)
    };

    res.json({ success: true, heatmap, pieChart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

app.post('/api/generate-plan', authenticateToken, async (req, res) => {
  try {
    const { weight, goal, dietPref, religion, geography } = req.body;
    let w = parseFloat(weight) || 70;

    let calTarget = 2200;
    if (goal === 'cut') calTarget = Math.max(1500, w * 22);
    else if (goal === 'bulk') calTarget = w * 30 + 500;
    else calTarget = w * 24;

    // Customize phrasing based on religion and geography constraints
    let limits = [];
    if (religion === 'jain') limits.push('strictly avoiding onions, garlic, and root vegetables');
    else if (religion === 'hindu') limits.push('focusing on Sattvic / vegetarian-friendly sources (no beef)');
    else if (religion === 'halal') limits.push('ensuring all meat is strictly Halal certified (no pork)');
    else if (religion === 'sikh') limits.push('incorporating Jhatka or pure vegetarian guidelines');
    else if (religion === 'buddha') limits.push('following mindful, primarily plant-based consumption');

    let spiceMsg = "balanced seasonings";
    if (geography === 'indian') spiceMsg = "rich South Asian spices (turmeric, cumin, garam masala)";
    else if (geography === 'western') spiceMsg = "light Continental herbs (rosemary, thyme, olive oil)";
    else if (geography === 'asian') spiceMsg = "East Asian flavor profiles (soy, ginger, sesame)";
    else if (geography === 'middle-eastern') spiceMsg = "Middle Eastern aromatics (za'atar, sumac, tahini)";

    const limitStr = limits.length > 0 ? `, ${limits.join(' and ')}` : '';

    const diet = `${Math.round(calTarget)} kcal/day. Focus on high protein (${Math.round(w * 2.2)}g), moderate carbs, and healthy fats. Structure meals around a ${dietPref || 'balanced'} template using ${spiceMsg}${limitStr}.`;

    // Construct the Daily Meal Plan
    let mealOptions = [];
    if (geography === 'indian') {
      if (dietPref === 'vegan' || religion === 'jain' || religion === 'buddha') {
        mealOptions = [
          'Breakfast: Oats Chilla & Tofu Scramble',
          'Lunch: Dal Makhani (No Onion/Garlic for Jain), Mixed Sabzi & 3 Rotis',
          'Dinner: Soya Chunk Curry & Brown Rice',
          'Snack: Roasted Makhana & Almonds'
        ];
      } else if (religion === 'hindu' || dietPref === 'balanced' || dietPref === 'keto') {
        mealOptions = [
          'Breakfast: Poha with Peanuts & Whey Protein Shake',
          'Lunch: Paneer Butter Masala, Rice & 2 Rotis',
          'Dinner: Grilled Paneer Tikka & Seasonal Salad',
          'Snack: Mixed Nuts & Greek Yogurt'
        ];
      } else {
        mealOptions = [
          'Breakfast: 4 Whole Eggs Bhurji & Multigrain Toast',
          'Lunch: Chicken Tikka Masala (200g meat) & Basmati Rice',
          'Dinner: Grilled Fish & Stir-fried Veggies',
          'Snack: Whey Protein & Banana'
        ];
      }
    } else {
      // Western / Middle Eastern / Asian / Default
      if (dietPref === 'vegan' || religion === 'jain' || religion === 'buddha') {
        mealOptions = [
          'Breakfast: Acai Smoothie Bowl with Hemp Seeds & Chia',
          'Lunch: Lentil Soup & Baked Sweet Potato',
          'Dinner: Beyond Meat Patty & Grilled Asparagus',
          'Snack: Peanut Butter Rice Cakes'
        ];
      } else if (religion === 'hindu' || dietPref === 'balanced') {
        mealOptions = [
          'Breakfast: Greek Yogurt, Honey & Berries',
          'Lunch: Quinoa, Black Bean & Avocado Salad',
          'Dinner: Cottage Cheese Stir Fry',
          'Snack: Whey Isolate & Almonds'
        ];
      } else {
        mealOptions = [
          'Breakfast: Scrambled Eggs & Lean Turkey Bacon',
          'Lunch: Grilled Chicken Salad (250g breast)',
          'Dinner: Lean Steak & Broccoli (Substitute with Halal Chicken if desired)',
          'Snack: Protein Bar & Apple'
        ];
      }
    }

    const routine = [
      "Day 1: Heavy Push (Chest, Shoulders, Triceps)",
      "Day 2: Heavy Pull (Back, Biceps, Rear Delts)",
      "Day 3: Legs (Quads, Hamstrings, Calves)",
      "Day 4: Rest / Active Recovery",
      "Day 5: Upper Body Hypertrophy",
      "Day 6: Lower Body Hypertrophy",
      "Day 7: Rest"
    ];

    res.json({ success: true, diet, routine, dailyMeals: mealOptions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate plan.' });
  }
});

// ─── PAYMENTS ROUTES (Razorpay) ──────────────────────────────────────────────

app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, plan } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Valid amount is required.' });
    }

    if (process.env.RAZORPAY_KEY_ID === 'dummy_key') {
      console.warn('⚠️ Warning: Razorpay Key ID is set to dummy_key. Payments will not work.');
    }

    const options = {
      amount: Math.round(amount * 100), // Ensure it is an integer
      currency: 'INR',
      receipt: `rcpt_${req.user.id}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key' });
  } catch (err) {
    console.error('❌ Razorpay Order Error:', err.message);
    res.status(500).json({ error: 'Failed to create Razorpay secure order. ' + (err.description || err.message) });
  }
});

app.post('/api/payment/verify', authenticateToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_name, amount } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification details.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      await pool.query(
        'INSERT INTO payments (user_id, order_id, payment_id, signature, amount, plan_name) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, plan_name]
      );

      await pool.query(
        'UPDATE users SET subscription_plan = ? WHERE id = ?',
        [plan_name, req.user.id]
      );

      res.json({ success: true, message: 'Payment verified and status updated.' });
    } else {
      console.error('❌ Signature Verification Failed for user ID:', req.user.id);
      res.status(400).json({ success: false, error: 'Invalid security signature.' });
    }
  } catch (err) {
    console.error('❌ Verification Error:', err.message);
    res.status(500).json({ error: 'Server error during verification. Please contact support.' });
  }
});

// GET user status
app.get('/api/user/status', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name, email, subscription_plan FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user status.' });
  }
});

// POST contact form — saves client to MySQL
app.post('/api/contact', async (req, res) => {
  const { name, email, goal, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  // Name and message length limits
  if (name.trim().length > 100) return res.status(400).json({ error: 'Name too long (max 100 chars).' });
  if (message.trim().length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
  if (message.trim().length < 10) return res.status(400).json({ error: 'Message too short (min 10 chars).' });

  try {
    const [result] = await pool.query(
      'INSERT INTO clients (name, email, goal, message) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), goal || 'general', message.trim()]
    );

    console.log(`📩 New client saved — ID ${result.insertId}: ${name} <${email}> | Goal: ${goal}`);

    res.json({
      success: true,
      clientId: result.insertId,
      message: `Thanks ${name}! We'll get back to you at ${email} within 24 hours.`
    });
  } catch (err) {
    console.error('❌ DB insert error:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already registered.' });
    }
    res.status(500).json({ error: 'Failed to save your message. Please try again.' });
  }
});

// ─── ROUTES — ADMIN (Client Management) ──────────────────────────────────────

// GET all clients — PROTECTED: requires admin JWT
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;
    let clients;

    if (search) {
      const q = `%${search}%`;
      [clients] = await pool.query(
        'SELECT * FROM clients WHERE name LIKE ? OR email LIKE ? OR goal LIKE ? ORDER BY created_at DESC',
        [q, q, q]
      );
    } else {
      [clients] = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    }

    res.json({ count: clients.length, clients });
  } catch (err) {
    console.error('❌ DB query error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve clients.' });
  }
});

// GET single client by ID — PROTECTED
app.get('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [parseInt(req.params.id, 10)]);
    const client = rows[0];
    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    res.json(client);
  } catch (err) {
    console.error('❌ DB query error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve client.' });
  }
});

// DELETE a client by ID — PROTECTED
app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM clients WHERE id = ?', [parseInt(req.params.id, 10)]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    res.json({ success: true, message: `Client ${req.params.id} deleted.` });
  } catch (err) {
    console.error('❌ DB delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete client.' });
  }
});

// ─────────────────────────────────────────────────
// API CONFIGS
// ─────────────────────────────────────────────────

const GROQ = {
  url:   'https://api.groq.com/openai/v1/chat/completions',
  key:   process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile', // Specifically mapped to the available Versatile model
};

const CLAUDE = {
  url:     'https://api.anthropic.com/v1/messages',
  key:     process.env.CLAUDE_API_KEY,
  version: '2023-06-01',
  model:   'claude-sonnet-4-20250514',
};

// ─────────────────────────────────────────────────
// FITNESS SYSTEM PROMPTS — ALL INDIAN LANGUAGES
// ─────────────────────────────────────────────────

const PROMPTS = {
  'hi-IN': `आप "Limitless Fitness" के AI पर्सनल ट्रेनर हैं।
आप इन विषयों में मदद करते हैं: वर्कआउट प्लान, डाइट, न्यूट्रिशन, वजन कम करना, मसल बनाना, योगा, HIIT, कार्डियो, एक्सरसाइज की सही तकनीक, रिकवरी और मोटिवेशन।
हमेशा हिंदी में, सरल और स्पष्ट भाषा में जवाब दें। जवाब छोटे और उपयोगी रखें।
गंभीर बीमारी के लिए डॉक्टर से मिलने की सलाह दें।`,

  'bn-IN': `আপনি "Limitless Fitness"-এর AI পার্সোনাল ট্রেইনার।
আপনি সাহায্য করেন: ওয়ার্কআউট প্ল্যান, ডায়েট, পুষ্টি, ওজন কমানো, পেশী গঠন, যোগব্যায়াম, HIIT, কার্ডিও, ব্যায়ামের সঠিক কৌশল, রিকভারি এবং মোটিভেশন।
সবসময় বাংলায় সহজ ও স্পষ্ট ভাষায় উত্তর দিন। উত্তর সংক্ষিপ্ত ও কার্যকর রাখুন।`,

  'te-IN': `మీరు "Limitless Fitness" యొక్క AI పర్సనల్ ట్రెయినర్.
మీరు సహాయం చేస్తారు: వర్కౌట్ ప్లాన్లు, డైట్, న్యూట్రిషన్, బరువు తగ్గించుకోవడం, కండరాల పెంపు, యోగా, HIIT, కార్డియో, సరైన వ్యాయామ పద్ధతులు, రికవరీ మరియు మోటివేషన్.
ఎల్లప్పుడూ తెలుగులో సులభమైన మరియు స్పష్టమైన భాషలో సమాధానం ఇవ్వండి.`,

  'ta-IN': `நீங்கள் "Limitless Fitness"-இன் AI தனிப்பட்ட பயிற்சியாளர்.
நீங்கள் உதவுவீர்கள்: உடற்பயிற்சி திட்டங்கள், உணவு முறை, ஊட்டச்சத்து, எடை குறைப்பு, தசை வளர்ச்சி, யோகா, HIIT, கார்டியோ, சரியான உடற்பயிற்சி நுட்பங்கள், மீட்பு மற்றும் உந்துதல்.
எப்போதும் தமிழில் எளிமையான மற்றும் தெளிவான மொழியில் பதில் சொல்லுங்கள்.`,

  'mr-IN': `तुम्ही "Limitless Fitness" चे AI पर्सनल ट्रेनर आहात.
तुम्ही मदत करता: वर्कआउट प्लान, डाएट, न्यूट्रिशन, वजन कमी करणे, स्नायू बांधणे, योगा, HIIT, कार्डियो, योग्य व्यायाम तंत्र, रिकव्हरी आणि मोटिव्हेशन.
नेहमी मराठीत सोप्या आणि स्पष्ट भाषेत उत्तर द्या.`,

  'gu-IN': `તમે "Limitless Fitness"ના AI પર્સનલ ટ્રેનર છો.
તમે મદદ કરો છો: વર્કઆઉટ પ્લાન, ડાયેટ, ન્યુટ્રિશન, વજન ઘટાડવું, સ્નાયુ બનાવવા, યોગ, HIIT, કાર્ડિયો, યોગ્ય વ્યાયામ તકનીક, રિકવરી અને મોટિવેશન.
હંમેશા ગુજરાતીમાં સરળ અને સ્પષ્ટ ભાષામાં જવાબ આપો.`,

  'kn-IN': `ನೀವು "Limitless Fitness"ನ AI ವೈಯಕ್ತಿಕ ತರಬೇತಿಗಾರರು.
ನೀವು ಸಹಾಯ ಮಾಡುತ್ತೀರಿ: ವರ್ಕೌಟ್ ಯೋಜನೆಗಳು, ಆಹಾರ ಪದ್ಧತಿ, ಪೋಷಣೆ, ತೂಕ ಇಳಿಸುವುದು, ಸ್ನಾಯು ನಿರ್ಮಾಣ, ಯೋಗ, HIIT, ಕಾರ್ಡಿಯೊ, ಸರಿಯಾದ ವ್ಯಾಯಾಮ ತಂತ್ರ, ಚೇತರಿಕೆ ಮತ್ತು ಪ್ರೇರಣೆ.
ಯಾವಾಗಲೂ ಕನ್ನಡದಲ್ಲಿ ಸರಳ ಮತ್ತು ಸ್ಪಷ್ಟ ಭಾಷೆಯಲ್ಲಿ ಉತ್ತರಿಸಿ.`,

  'ml-IN': `നിങ്ങൾ "Limitless Fitness"-ന്റെ AI വ്യക്തിഗത പരിശീലകനാണ്.
നിങ്ങൾ സഹായിക്കുന്നു: വർക്കൗട്ട് പ്ലാൻ, ഡയറ്റ്, പോഷകാഹാരം, ഭാരം കുറയ്ക്കൽ, പേശി നിർമ്മാണം, യോഗ, HIIT, കാർഡിയോ, ശരിയായ വ്യായാമ രീതികൾ, വീണ്ടെടുക്കൽ, പ്രേരണ.
എല്ലായ്പ്പോഴും മലയാളത്തിൽ ലളിതമായും വ്യക്തമായും മറുപടി നൽകുക.`,

  'pa-IN': `ਤੁਸੀਂ "Limitless Fitness" ਦੇ AI ਨਿੱਜੀ ਟ੍ਰੇਨਰ ਹੋ।
ਤੁਸੀਂ ਮਦਦ ਕਰਦੇ ਹੋ: ਵਰਕਆਊਟ ਪਲਾਨ, ਡਾਇਟ, ਪੋਸ਼ਣ, ਭਾਰ ਘਟਾਉਣਾ, ਮਾਸਪੇਸ਼ੀ ਬਣਾਉਣਾ, ਯੋਗਾ, HIIT, ਕਾਰਡੀਓ, ਸਹੀ ਕਸਰਤ ਤਕਨੀਕ, ਰਿਕਵਰੀ ਅਤੇ ਪ੍ਰੇਰਣਾ।
ਹਮੇਸ਼ਾ ਪੰਜਾਬੀ ਵਿੱਚ ਸਰਲ ਅਤੇ ਸਪੱਸ਼ਟ ਭਾਸ਼ਾ ਵਿੱਚ ਜਵਾਬ ਦਿਓ।`,

  'or-IN': `ଆପଣ "Limitless Fitness"ର AI ବ୍ୟକ୍ତିଗତ ପ୍ରଶିକ୍ଷକ।
ଆପଣ ସାହାଯ୍ୟ କରନ୍ତି: ୱାର୍କଆଉଟ୍ ଯୋଜନା, ଡାଏଟ, ପୋଷଣ, ଓଜନ ହ୍ରାସ, ମାଂସପେଶୀ ନିର୍ମାଣ, ଯୋଗ, HIIT, କାର୍ଡିଓ, ସଠିକ ବ୍ୟାୟାମ ଟେକ୍ନିକ୍, ରିକଭରି ଏବଂ ମୋଟିଭେସନ୍।
ସର୍ବଦା ଓଡ଼ିଆରେ ସରଳ ଓ ସ୍ପଷ୍ଟ ଭାଷାରେ ଉତ୍ତର ଦିଅନ୍ତୁ।`,

  'ur-IN': `آپ "Limitless Fitness" کے AI پرسنل ٹرینر ہیں۔
آپ مدد کرتے ہیں: ورک آؤٹ پلان، ڈائیٹ، نیوٹریشن، وزن کم کرنا، پٹھے بنانا، یوگا، HIIT، کارڈیو، صحیح ورزش کی تکنیک، ریکوری اور حوصلہ افزائی۔
ہمیشہ اردو میں سادہ اور واضح زبان میں جواب دیں۔`,

  'as-IN': `আপুনি "Limitless Fitness"ৰ AI ব্যক্তিগত প্ৰশিক্ষক।
আপুনি সহায় কৰে: ৱৰ্কআউট পৰিকল্পনা, ডায়েট, পুষ্টি, ওজন হ্ৰাস, পেশী নিৰ্মাণ, যোগ, HIIT, কাৰ্ডিঅ', সঠিক ব্যায়ামৰ কৌশল, পুনৰুদ্ধাৰ আৰু প্ৰেৰণা।
সদায় অসমীয়াত সহজ আৰু স্পষ্ট ভাষাত উত্তৰ দিয়ক।`,

  'en-IN': `You are the AI personal trainer for "Limitless Fitness".
You help with: workout plans, diet, nutrition, weight loss, muscle building, yoga, HIIT, cardio, correct exercise technique, recovery and motivation.
Always reply in simple, clear Indian English. Keep answers short and actionable.
For serious health issues, always advise consulting a doctor.`,
};

// ─────────────────────────────────────────────────
// STREAM FROM GROQ  (OpenAI-compatible SSE)
// ─────────────────────────────────────────────────

async function streamGroq(messages, res) {
  const response = await fetch(GROQ.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ.key}`,
    },
    body: JSON.stringify({
      model: GROQ.model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) throw new Error(`Groq error: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const raw = line.slice(6);
      if (raw === '[DONE]') { res.write('data: [DONE]\n\n'); return; }
      try {
        const token = JSON.parse(raw).choices?.[0]?.delta?.content;
        if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
      } catch {}
    }
  }
}

// ─────────────────────────────────────────────────
// STREAM FROM CLAUDE  (Anthropic SSE)
// ─────────────────────────────────────────────────

async function streamClaude(messages, systemPrompt, res) {
  const response = await fetch(CLAUDE.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE.key,
      'anthropic-version': CLAUDE.version,
    },
    body: JSON.stringify({
      model: CLAUDE.model,
      max_tokens: 1024,
      system: systemPrompt,
      stream: true,
      messages: messages.filter(m => m.role !== 'system'), // Claude uses system param separately
    }),
  });

  if (!response.ok) throw new Error(`Claude error: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const raw = line.slice(6);
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'content_block_delta') {
          const token = parsed.delta?.text;
          if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
        if (parsed.type === 'message_stop') {
          res.write('data: [DONE]\n\n');
          return;
        }
      } catch {}
    }
  }
}

// ─── CHATBOT ROUTE (OPENCLAW)  ───────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
    }

    // Spawn the bespoke Python AI Agent connected to Groq
    const pythonAgent = spawn('python', ['fuaak_agent.py', message.trim()]);
    let stdoutData = '';
    let stderrData = '';
    let finished = false;

    // ── Hard timeout: kill agent if it takes > 25 seconds ──────────────────
    const agentTimeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        pythonAgent.kill('SIGTERM');
        console.error('⏰ /api/chat: Python agent timed out after 25s');
        if (!res.headersSent) {
          res.status(504).json({ error: 'AI agent timed out. Please try again.' });
        }
      }
    }, 25000);

    pythonAgent.stdout.on('data', data => { stdoutData += data.toString(); });
    pythonAgent.stderr.on('data', data => { stderrData += data.toString(); });

    pythonAgent.on('close', (code) => {
      if (finished) return;  // already handled by timeout
      finished = true;
      clearTimeout(agentTimeout);
      try {
        if (code !== 0 && !stdoutData.trim()) {
            return res.status(500).json({ error: stderrData.trim() || 'Internal agent error' });
        }
        res.json({ success: true, reply: stdoutData.trim() });
      } catch (err) {
        console.error('AI Bridge Parsing Error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to process AI response.' });
      }
    });

    pythonAgent.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(agentTimeout);
      console.error('Python spawn error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Could not start AI agent. Ensure Python is installed.' });
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to connect to the Chatbot service.' });
  }
});

// ─────────────────────────────────────────────────
// SSE STREAMING CHAT ENDPOINT
// ─────────────────────────────────────────────────

app.post('/api/chat/stream', async (req, res) => {
  const { message, language = 'hi-IN', chatHistory = [] } = req.body;

  const systemPrompt = PROMPTS[language] || PROMPTS['en-IN'];

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-8),
    { role: 'user', content: message },
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    if (process.env.PRIMARY_AI === 'claude') {
      await streamClaude(messages, systemPrompt, res);
    } else {
      await streamGroq(messages, res);
    }
  } catch (primaryError) {
    console.error('Primary AI failed:', primaryError.message);
    // Auto-fallback to the other AI
    try {
      console.log('Falling back to secondary AI...');
      if (process.env.PRIMARY_AI === 'claude') {
        await streamGroq(messages, res);
      } else {
        await streamClaude(messages, systemPrompt, res);
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError.message);
      res.write(`data: ${JSON.stringify({ token: 'Sorry, AI service is temporarily unavailable. Please try again.' })}\n\n`);
      res.write('data: [DONE]\n\n');
    }
  }

  res.end();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    primaryAI: process.env.PRIMARY_AI || 'groq',
    groqKey: !!process.env.GROQ_API_KEY,
    claudeKey: !!process.env.CLAUDE_API_KEY,
  });
});

// ─── RAZORPAY COMMERCE ROUTES ────────────────────────────────────────────────

// Strict Immutable Pricing Logic (Data Security: Never trust client amounts)
const SECURE_PRICING = {
  monthly: { initiate: 999, momentum: 4999, limitless: 8999 },
  yearly:  { initiate: 9588, momentum: 8499, limitless: 8999 }
};

app.get('/api/razorpay/key', (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID || 'dummy_key' });
});

app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    const { planId, cycle, currency = 'INR', receipt = 'receipt_' + Date.now() } = req.body;
    
    // Mathematically enforce Server-Side Pricing mapping.
    const strictAmount = SECURE_PRICING[cycle]?.[planId];
    if (!strictAmount) return res.status(400).json({ error: "Invalid plan or billing cycle detected. Access Denied." });

    const options = {
      amount: strictAmount * 100, // Securely converted to Paisa natively on server
      currency,
      receipt
    };

    const order = await razorpay.orders.create(options);
    if (!order) return res.status(500).json({ error: "Server failed to allocate gateway order ID." });
    
    res.json(order);
  } catch (error) {
    console.error("Razorpay Sub-process Error:", error);
    res.status(500).json({ error: "Failed to initialize external Razorpay transaction frame." });
  }
});

app.post('/api/razorpay/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Security null-guard: reject missing fields immediately
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification fields. Request rejected." });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
      .update(sign)
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      return res.status(200).json({ success: true, message: "Receipt Validated via SHA256 HMAC." });
    } else {
      return res.status(400).json({ success: false, message: "Invalid signature. Transaction blocked." });
    }
  } catch (error) {
    console.error("Razorpay Validation Error:", error);
    res.status(500).json({ success: false, message: "Runtime validation server error." });
  }
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🏋️  FUAAK Fitness Server running at http://localhost:${PORT}`);
  console.log(`📊  Admin clients API: http://localhost:${PORT}/api/clients\n`);
});
