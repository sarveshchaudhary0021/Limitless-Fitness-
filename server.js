const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { spawn } = require('child_process');

const JWT_SECRET = process.env.JWT_SECRET || 'limitless_super_secret_key_123';

// Setup Razorpay instance (using env variables)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

const app = express();
const PORT = 3000;

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

app.use(cors());
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

app.post('/api/generate-plan', async (req, res) => {
  try {
    const { age, weight, goal, dietParams } = req.body;
    
    // Algorithmic Calorie Calculation
    let calories = weight * (goal === 'muscle-gain' ? 35 : goal === 'fat-loss' ? 22 : 28);
    let diet = [];
    
    // Demographic / Region based Diet assignment
    if (dietParams.region === 'indian' || dietParams.region === 'jain') {
      if (dietParams.preference === 'veg' || dietParams.region === 'jain') {
        diet = ['Breakfast: Poha with Peanuts & Protein Shake', 'Lunch: Dal Makhani, Mixed Sabzi & 3 Rotis', 'Dinner: Paneer Bhurji & Brown Rice', 'Snack: Roasted Makhana & Almonds'];
      } else if (dietParams.preference === 'vegan') {
        diet = ['Breakfast: Oats Chilla & Tofu Scramble', 'Lunch: Chana Masala & Quinoa', 'Dinner: Soya Chunk Curry & Roti', 'Snack: Mixed Seeds & Black Coffee'];
      } else {
        diet = ['Breakfast: 4 Whole Eggs Bhurji & Toast', 'Lunch: Chicken Curry (200g) & Rice', 'Dinner: Grilled Fish & Veggies', 'Snack: Whey Protein & Banana'];
      }
    } else {
      // Western / Halal
      if (dietParams.preference === 'veg') {
        diet = ['Breakfast: Greek Yogurt, Honey & Berries', 'Lunch: Quinoa, Black Bean & Avocado Salad', 'Dinner: Cottage Cheese Stir Fry', 'Snack: Whey Isolate & Almonds'];
      } else if (dietParams.preference === 'vegan') {
        diet = ['Breakfast: Acai Smoothie Bowl with Hemp Seeds', 'Lunch: Lentil Soup & Sweet Potato', 'Dinner: Beyond Meat Burger (No Bun)', 'Snack: Peanut Butter Rice Cakes'];
      } else {
        diet = ['Breakfast: Scrambled Eggs & Turkey Bacon', 'Lunch: Grilled Chicken Salad (250g)', 'Dinner: Lean Steak & Asparagus', 'Snack: Protein Bar & Apple'];
      }
    }

    // Routine Based on Goal
    let routine = goal === 'muscle-gain' 
      ? ['Day 1: Push (Chest, Shoulders, Triceps)', 'Day 2: Pull (Back, Biceps, Rear Delts)', 'Day 3: Rest', 'Day 4: Legs & Core Focus', 'Day 5: Upper Body Hypertrophy']
      : ['Day 1: Full Body HIIT & Core', 'Day 2: LISS Cardio & Mobility', 'Day 3: Heavy Compound Lifts', 'Day 4: Rest', 'Day 5: Sprints & Conditioning'];

    const plan = {
      targetCalories: Math.round(calories),
      dailyDiet: diet,
      weeklyRoutine: routine
    };

    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate smart plan.' });
  }
});

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
    res.status(201).json({ token, user: { id: result.insertId, name, email } });
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
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, subscription_plan: user.subscription_plan } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ─── INTERACTIVE TRACKER ROUTES ──────────────────────────────────────────────

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
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
    await pool.query(
      'INSERT INTO workout_logs (user_id, exercise, sets, reps, weight) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, exercise, sets, reps, weight]
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
    
    const pythonProcess = spawn('python', ['analytics.py']);
    
    let result = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python Error:', errorOutput);
        return res.status(500).json({ error: 'Python Analytics failed' });
      }
      try {
        const parsedData = JSON.parse(result);
        res.json(parsedData);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse python output' });
      }
    });
    
    pythonProcess.stdin.write(JSON.stringify(logs));
    pythonProcess.stdin.end();
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics.' });
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

// GET all clients
app.get('/api/clients', async (req, res) => {
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

// GET single client by ID
app.get('/api/clients/:id', async (req, res) => {
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

// DELETE a client by ID
app.delete('/api/clients/:id', async (req, res) => {
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

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🏋️  FUAAK Fitness Server running at http://localhost:${PORT}`);
  console.log(`📊  Admin clients API: http://localhost:${PORT}/api/clients\n`);
});
