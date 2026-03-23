/**
 * Limitless Fitness — auth.js
 * Secure client-side auth using Web Crypto (PBKDF2) for password hashing.
 * NO plaintext passwords are ever stored. All data lives in localStorage.
 *
 * Security model:
 *  - Passwords hashed with PBKDF2-SHA256 + random 16-byte salt, 200k iterations
 *  - Session token = random 32-byte hex, stored in sessionStorage (clears on tab close)
 *  - User profile stored in localStorage under hashed key, never raw email
 *  - XSS: all rendered strings escaped via escapeHTML()
 */

'use strict';

/* ── Utilities ─────────────────────────────────────────────────────────────── */

/**
 * Escape a string for safe HTML rendering (XSS prevention)
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Generate a cryptographically random hex string of `byteLen` bytes
 */
async function randomHex(byteLen = 16) {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password with PBKDF2-SHA256.
 * Returns { hash: hex, salt: hex }
 */
async function hashPassword(password, saltHex = null) {
  const salt = saltHex
    ? hexToUint8(saltHex)
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 200000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hash = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const saltOut = Array.from(salt)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return { hash, salt: saltOut };
}

function hexToUint8(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/**
 * Constant-time string comparison (avoid timing attacks)
 */
function safeCompare(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* ── Storage keys ───────────────────────────────────────────────────────────── */
const USERS_KEY  = '__lf_users_v2__';
const SESSION_KEY = '__lf_session__';   // sessionStorage only

/* ── User DB helpers ────────────────────────────────────────────────────────── */

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveUsers(db) {
  localStorage.setItem(USERS_KEY, JSON.stringify(db));
}

/**
 * Derive a storage key from an email (SHA-256 hex, truncated to 16 chars).
 * This means email addresses are never stored in plain text as keys.
 */
async function emailKey(email) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(email.toLowerCase().trim())
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/* ── Auth API ───────────────────────────────────────────────────────────────── */

const Auth = {
  /**
   * Register a new user. Returns { ok, error? }
   */
  async register({ name, email, password }) {
    // Validation
    if (!name || !email || !password) return { ok: false, error: 'All fields are required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Invalid email address.' };
    if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { ok: false, error: 'Password must contain at least one uppercase letter and one number.' };
    }

    const key  = await emailKey(email);
    const db   = loadUsers();

    if (db[key]) return { ok: false, error: 'An account with this email already exists.' };

    const { hash, salt } = await hashPassword(password);

    db[key] = {
      name: escapeHTML(name.trim()),
      emailHash: key,          // never store plain email
      emailHint: email.slice(0, 2) + '***' + email.slice(email.lastIndexOf('@')),
      hash,
      salt,
      createdAt: Date.now(),
      profile: {},
    };

    saveUsers(db);
    return { ok: true };
  },

  /**
   * Sign in. Returns { ok, user?, error? }
   */
  async login({ email, password }) {
    if (!email || !password) return { ok: false, error: 'Please enter your email and password.' };

    const key = await emailKey(email);
    const db  = loadUsers();
    const rec = db[key];

    // Deliberate delay to slow brute force (≈200ms added on top of PBKDF2 time)
    await new Promise(r => setTimeout(r, 200));

    if (!rec) return { ok: false, error: 'Invalid email or password.' };

    const { hash } = await hashPassword(password, rec.salt);

    if (!safeCompare(hash, rec.hash)) {
      return { ok: false, error: 'Invalid email or password.' };
    }

    // Create session token
    const token = await randomHex(32);
    const session = {
      token,
      emailHash: key,
      name: rec.name,
      createdAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return { ok: true, user: { name: rec.name, emailHint: rec.emailHint } };
  },

  /**
   * Get current session (null if not logged in or expired)
   */
  getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  /**
   * Returns true if a valid session exists
   */
  isLoggedIn() {
    return this.getSession() !== null;
  },

  /**
   * Sign out
   */
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  /**
   * Get profile data for logged-in user
   */
  getProfile() {
    const session = this.getSession();
    if (!session) return null;
    const db = loadUsers();
    const rec = db[session.emailHash];
    return rec ? rec.profile || {} : null;
  },

  /**
   * Save profile data (e.g. diet planner inputs)
   */
  saveProfile(profileData) {
    const session = this.getSession();
    if (!session) return false;
    const db  = loadUsers();
    const rec = db[session.emailHash];
    if (!rec) return false;
    rec.profile = { ...rec.profile, ...profileData };
    saveUsers(db);
    return true;
  },

  /**
   * Guard: redirect to login if not authenticated.
   * Call at top of any protected page.
   */
  guard(returnPath) {
    if (!this.isLoggedIn()) {
      const next = encodeURIComponent(returnPath || window.location.pathname);
      window.location.replace(`/Limitless-Fitness-/login.html?next=${next}`);
      return false;
    }
    return true;
  },

  /**
   * Redirect away from login/signup if already authenticated
   */
  redirectIfAuthed(defaultPath = '/Limitless-Fitness-/dashboard.html') {
    if (this.isLoggedIn()) {
      const params = new URLSearchParams(window.location.search);
      const next   = params.get('next');
      window.location.replace(next ? decodeURIComponent(next) : defaultPath);
      return true;
    }
    return false;
  },
};

/* ── Password strength meter ────────────────────────────────────────────────── */
function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
  return { score, label: labels[score] || 'Weak', color: colors[score] || '#ef4444' };
}

window.Auth = Auth;
window.escapeHTML = escapeHTML;
window.getPasswordStrength = getPasswordStrength;
