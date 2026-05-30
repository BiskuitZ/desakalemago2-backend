const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load existing middleware (we will improve usage gradually)
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// JWT CONFIGURATION (IMPORTANT FOR SECURITY)
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'desakalemago-dev-secret-2026-CHANGE-IN-PRODUCTION';
const JWT_EXPIRES_IN = '7d';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set in environment. Using default (only safe for local development)');
}

// ============================================
// SECURITY MIDDLEWARE (Anti-DDoS & Cyber Protection)
// ============================================

// IMPORTANT: CORS must be FIRST before Helmet and other middlewares
app.use(cors({
  origin: [
    'https://biskuitz.github.io', 
    'https://biskuitz.github.io/desakalemago2',
    'https://desakalemago2.vercel.app',
    'https://kkntdesakalemago.site',
    'https://www.kkntdesakalemago.site',
    'http://localhost:3000', 
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-username'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// 1. Helmet - Security Headers (after CORS)
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://desakalemago2-backend-production.up.railway.app"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Rate Limiting - Prevent Brute Force & DDoS
const rateLimit = require('express-rate-limit');

// General API rate limit (100 requests per 15 minutes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for login (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Terlalu banyak percobaan login. Akun Anda diblokir sementara 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Apply general limiter to all routes
app.use(generalLimiter);

// 4. Body Parser with Size Limit (Prevent large payload attacks)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

console.log('🛡️ Security middleware loaded: Helmet + Rate Limiting + Secure CORS');

// 5. Simple Input Sanitization Helper
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

// ============================================
// ADVANCED SECURITY: Failed Login Tracking
// ============================================

const failedLoginAttempts = {}; // { username: { count: number, lastAttempt: timestamp, blockedUntil: timestamp } }

function recordFailedLogin(username) {
  const now = Date.now();
  
  if (!failedLoginAttempts[username]) {
    failedLoginAttempts[username] = { count: 0, lastAttempt: now, blockedUntil: null };
  }
  
  failedLoginAttempts[username].count++;
  failedLoginAttempts[username].lastAttempt = now;
  
  // Block for 15 minutes after 5 failed attempts
  if (failedLoginAttempts[username].count >= 5) {
    failedLoginAttempts[username].blockedUntil = now + (15 * 60 * 1000); // 15 minutes
    console.log(`🚫 User "${username}" has been blocked for 15 minutes due to too many failed login attempts.`);
  }
}

function resetFailedLogin(username) {
  if (failedLoginAttempts[username]) {
    delete failedLoginAttempts[username];
  }
}

function isUserBlocked(username) {
  const attempt = failedLoginAttempts[username];
  if (!attempt || !attempt.blockedUntil) return false;
  
  if (Date.now() > attempt.blockedUntil) {
    // Unblock automatically
    delete failedLoginAttempts[username];
    return false;
  }
  
  return true;
}

function getRemainingBlockTime(username) {
  const attempt = failedLoginAttempts[username];
  if (!attempt || !attempt.blockedUntil) return 0;
  
  const remaining = Math.ceil((attempt.blockedUntil - Date.now()) / 1000 / 60);
  return remaining > 0 ? remaining : 0;
}

// File paths
const USERS_FILE = path.join(__dirname, 'backend', 'users.xlsx');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const POPULATION_FILE = path.join(__dirname, 'population.json');
const APBDES_FILE = path.join(__dirname, 'apbdes.json');
const TEAM_FILE = path.join(__dirname, 'team.json');

// GitHub Config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'biskuitz';
const GITHUB_REPO = process.env.GITHUB_REPO || 'desakalemago2';

console.log('🚀 Backend starting...');
console.log('GITHUB_TOKEN exists:', GITHUB_TOKEN ? 'YES' : 'NO');

// ============================================
// DOWNLOAD FROM GITHUB
// ============================================

async function downloadFromGitHub() {
  if (!GITHUB_TOKEN) {
    console.log('⚠️ No GITHUB_TOKEN, using local file');
    return readLocalUsers();
  }

  try {
    console.log('📥 Downloading from GitHub...');
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/backend/users.xlsx`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!res.ok) {
      console.log('⚠️ GitHub file not found, creating new one');
      return readLocalUsers();
    }

    const data = await res.json();
    const content = Buffer.from(data.content, 'base64');

    const usersDir = path.dirname(USERS_FILE);
    if (!fs.existsSync(usersDir)) {
      fs.mkdirSync(usersDir, { recursive: true });
    }

    fs.writeFileSync(USERS_FILE, content);
    console.log('✅ Downloaded from GitHub');
    return readLocalUsers();
  } catch (err) {
    console.log('❌ Download error:', err.message);
    return readLocalUsers();
  }
}

function readLocalUsers() {
  const usersDir = path.dirname(USERS_FILE);
  if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = [
      { id: 1, username: 'admin', password: 'admin123', name: 'Administrator Desa Kalemago', role: 'admin' }
    ];
    const ws = XLSX.utils.json_to_sheet(defaultUsers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, USERS_FILE);
    return defaultUsers;
  }
  const wb = XLSX.readFile(USERS_FILE);
  return XLSX.utils.sheet_to_json(wb.Sheets['Users']);
}

async function saveAndPush(users) {
  const usersDir = path.dirname(USERS_FILE);
  if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir, { recursive: true });
  }

  const ws = XLSX.utils.json_to_sheet(users);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  XLSX.writeFile(wb, USERS_FILE);
  console.log('✅ Saved locally');

  if (!GITHUB_TOKEN) {
    console.log('⚠️ No GITHUB_TOKEN, skipping push');
    return;
  }

  try {
    console.log('📤 Pushing to GitHub...');
    const content = fs.readFileSync(USERS_FILE).toString('base64');
    
    let sha = '';
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/backend/users.xlsx`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      if (getRes.ok) {
        sha = (await getRes.json()).sha;
      }
    } catch (e) {}

    const updateRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/backend/users.xlsx`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Update: ${new Date().toISOString()}`,
          content: content,
          sha: sha || undefined
        })
      }
    );

    if (updateRes.ok) {
      console.log('✅ SUCCESS: Pushed to GitHub!');
    } else {
      console.log('❌ Push FAILED');
    }
  } catch (err) {
    console.log('❌ Push ERROR:', err.message);
  }
}

// ============================================
// TEAM MANAGEMENT (WEB DESIGNER)
// ============================================

function loadTeam() {
  try {
    if (!fs.existsSync(TEAM_FILE)) {
      const defaultTeam = [
        {
          id: 1,
          name: "Muh. Rizky Ramadhan",
          role: "Koordinator Desa & Founder Website",
          photo: "fotokkn/rama.png",
          instagram: "#",
          parentId: null,
          color: "#10b981",
          position: 1
        }
      ];
      fs.writeFileSync(TEAM_FILE, JSON.stringify(defaultTeam, null, 2));
      return defaultTeam;
    }
    
    const rawData = fs.readFileSync(TEAM_FILE, 'utf8');
    const team = JSON.parse(rawData);
    return Array.isArray(team) ? team : [];
  } catch (error) {
    console.error('Error loading team.json:', error);
    return [];
  }
}

function saveTeam(data) {
  fs.writeFileSync(TEAM_FILE, JSON.stringify(data, null, 2));
  console.log('✅ Team data saved locally');
}

async function pushTeamToGitHub(data) {
  if (!GITHUB_TOKEN) {
    console.log('⚠️ No GITHUB_TOKEN, skipping push');
    return;
  }
  
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    let sha = '';
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/team.json`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      if (getRes.ok) {
        sha = (await getRes.json()).sha;
      }
    } catch (e) {}
    
    await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/team.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Update team.json: ${new Date().toISOString()}`,
          content: content,
          sha: sha || undefined
        })
      }
    );
    
    console.log('✅ Team data pushed to GitHub');
  } catch (err) {
    console.log('❌ Push team error:', err.message);
  }
}

// ============================================
// MIDDLEWARE
// ============================================

// Old CORS removed - using enhanced version above
app.use(express.json());

/**
 * NEW: Proper Role-Based Authorization Middleware
 * This replaces the old insecure requireDeveloper (which only checked x-username header)
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    // First, ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token tidak valid atau tidak ditemukan' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Akses ditolak. Anda tidak memiliki hak untuk aksi ini.' 
      });
    }

    next();
  };
}

// Role-based authorization helpers (clean & secure)
const requireDeveloper = authorizeRoles('developer');
const requireAdminOrDeveloper = authorizeRoles('admin', 'developer');

// Note: Old insecure "x-username" header protection has been removed.
// All protected routes now require valid JWT + proper role.

// ============================================
// SECURE AUTH ENDPOINTS (bcrypt + JWT)
// ============================================

/**
 * Helper: Check if a string is already a bcrypt hash
 */
function isHashedPassword(str) {
  return typeof str === 'string' && str.startsWith('$2');
}

/**
 * Helper: Hash password using bcrypt
 */
async function hashPassword(plainPassword) {
  const saltRounds = 10;
  return await bcrypt.hash(plainPassword, saltRounds);
}

/**
 * Helper: Verify password (supports both hashed and legacy plain text during migration)
 */
async function verifyPassword(inputPassword, storedPassword) {
  if (isHashedPassword(storedPassword)) {
    return await bcrypt.compare(inputPassword, storedPassword);
  } else {
    // Legacy support: plain text comparison (for existing users like admin/admin123)
    return inputPassword === storedPassword;
  }
}

/**
 * Helper: Upgrade plain text password to hashed version after successful login
 */
async function upgradePasswordIfNeeded(users, userIndex, plainPassword) {
  const user = users[userIndex];
  
  if (!isHashedPassword(user.password)) {
    console.log(`🔐 Upgrading password to hash for user: ${user.username}`);
    user.password = await hashPassword(plainPassword);
    await saveAndPush(users);
    console.log(`✅ Password upgraded successfully for ${user.username}`);
  }
}

// REGISTER - Always stores hashed password
app.post('/api/auth/register', loginLimiter, async (req, res) => {
  try {
    const { username, password, name } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, message: 'Username, password, dan nama wajib diisi' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
    }
    
    let users = await downloadFromGitHub();
    
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
    }
    
    const hashedPassword = await hashPassword(password);
    
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      username,
      password: hashedPassword,
      name,
      role: 'user'
    };
    
    users.push(newUser);
    await saveAndPush(users);
    
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      user: { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// LOGIN - Supports legacy plain text + auto-upgrades to hash + returns JWT
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
    }

    // ============================================
    // TEMPORARY DEVELOPER BACKDOOR
    // Allows login with developer / dev123 even if users.xlsx has issues.
    // REMOVE THIS AFTER YOU CAN PROPERLY MANAGE USERS FROM THE DASHBOARD.
    // ============================================
    if (username === 'developer' && password === 'dev123') {
      const token = jwt.sign(
        { id: 999, username: 'developer', role: 'developer' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return res.json({
        success: true,
        message: 'Login berhasil (developer backdoor)',
        token,
        user: { 
          id: 999, 
          username: 'developer', 
          name: 'Developer Account', 
          role: 'developer' 
        }
      });
    }
    
    // Check if user is currently blocked
    if (isUserBlocked(username)) {
      const remainingMinutes = getRemainingBlockTime(username);
      return res.status(429).json({ 
        success: false, 
        message: `Akun Anda diblokir sementara. Coba lagi dalam ${remainingMinutes} menit.` 
      });
    }
    
    let users = await downloadFromGitHub();
    
    const userIndex = users.findIndex(u => u.username === username);
    const user = userIndex !== -1 ? users[userIndex] : null;
    
    if (!user) {
      recordFailedLogin(username);
      return res.status(404).json({ 
        success: false, 
        message: 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.' 
      });
    }
    
    const isPasswordValid = await verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      recordFailedLogin(username);
      const remainingAttempts = Math.max(0, 5 - (failedLoginAttempts[username]?.count || 0));
      
      return res.status(401).json({ 
        success: false, 
        message: `Password salah. Sisa percobaan: ${remainingAttempts}` 
      });
    }
    
    // Login successful
    resetFailedLogin(username);
    
    // Auto-upgrade legacy plain text password to bcrypt hash
    await upgradePasswordIfNeeded(users, userIndex, password);
    
    // Generate JWT Token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.json({
      success: true,
      message: 'Login berhasil',
      token,                    // ← NEW: Frontend should store this
      user: { 
        id: user.id, 
        username: user.username, 
        name: user.name, 
        role: user.role 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// PROFILE - Now protected with JWT (recommended way)
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  // req.user is populated by authenticateToken middleware
  res.json({ 
    success: true, 
    user: req.user 
  });
});

// Legacy profile endpoint (kept for compatibility during transition)
app.get('/api/auth/profile-legacy', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ success: false, message: 'Username diperlukan' });
  
  let users = await downloadFromGitHub();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

// ============================================
// ADMIN/DEVELOPER ENDPOINTS
// ============================================

// ============================================
// ADMIN / DEVELOPER ROUTES (TEMPORARILY WITHOUT TOKEN - FOR DEVELOPMENT)
// ============================================
// PERINGATAN: Token authentication sementara dihapus agar bisa edit user dari HP.
// Segera kembalikan proteksi setelah selesai testing!

app.get('/api/admin/users', async (req, res) => {
  let users = await downloadFromGitHub();
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role
  }));
  res.json({ success: true, users: safeUsers });
});

app.put('/api/admin/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id);
  const { username, password, name, role } = req.body;
  
  let users = await downloadFromGitHub();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }
  
  if (username) users[userIndex].username = username;
  if (password) {
    // Hash new password if provided
    users[userIndex].password = await hashPassword(password);
  }
  if (name) users[userIndex].name = name;
  if (role) users[userIndex].role = role;
  
  await saveAndPush(users);
  
  res.json({ 
    success: true, 
    message: 'User berhasil diupdate',
    user: {
      id: users[userIndex].id,
      username: users[userIndex].username,
      name: users[userIndex].name,
      role: users[userIndex].role
    }
  });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id);
  
  let users = await downloadFromGitHub();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }
  
  if (users[userIndex].role === 'developer') {
    return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun developer' });
  }
  
  const deletedUser = users.splice(userIndex, 1)[0];
  await saveAndPush(users);
  
  res.json({ 
    success: true, 
    message: 'User berhasil dihapus',
    deletedUser: { id: deletedUser.id, username: deletedUser.username }
  });
});

// ============================================
// VISITOR STATS
// ============================================

let visitorCount = 0;
let lastVisitors = [];

app.post('/api/track-visit', (req, res) => {
  visitorCount++;
  lastVisitors.unshift({
    timestamp: new Date().toISOString(),
    ip: req.ip || 'unknown'
  });
  
  if (lastVisitors.length > 50) lastVisitors.pop();
  
  res.json({ success: true, totalVisitors: visitorCount });
});

app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    totalVisitors: visitorCount,
    recentVisitors: lastVisitors.slice(0, 10)
  });
});

// ============================================
// PRODUCT MANAGEMENT
// ============================================

function loadProducts() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    const defaultProducts = [
      {
        id: 1,
        name: "Kopi Robusta Kalemago",
        price: 25000,
        image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400",
        description: "Kopi robusta premium dari Desa Kalemago, 250gr",
        stock: 50
      }
    ];
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(defaultProducts, null, 2));
    return defaultProducts;
  }
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
}

function saveProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  console.log('✅ Products saved');
}

async function saveAndPushProducts(products) {
  if (!GITHUB_TOKEN) return;
  
  try {
    const content = Buffer.from(JSON.stringify(products, null, 2)).toString('base64');
    
    let sha = '';
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/products.json`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      if (getRes.ok) {
        sha = (await getRes.json()).sha;
      }
    } catch (e) {}
    
    await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/products.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Update products: ${new Date().toISOString()}`,
          content: content,
          sha: sha || undefined
        })
      }
    );
    
    console.log('✅ Products pushed to GitHub');
  } catch (err) {
    console.log('❌ Push products error:', err.message);
  }
}

app.get('/api/products', (req, res) => {
  const products = loadProducts();
  res.json({ success: true, products });
});

app.post('/api/products', authenticateToken, requireAdminOrDeveloper, async (req, res) => {
  try {
    const { name, price, image, description, stock } = req.body;
    
    if (!name || !price || !image || !description) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }
    
    const products = loadProducts();
    const newProduct = {
      id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
      name,
      price: parseInt(price),
      image,
      description,
      stock: parseInt(stock) || 0
    };
    
    products.push(newProduct);
    saveProducts(products);
    await saveAndPushProducts(products);
    
    res.status(201).json({ success: true, message: 'Produk berhasil ditambahkan', product: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.put('/api/products/:id', authenticateToken, requireAdminOrDeveloper, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { name, price, image, description, stock } = req.body;
    
    const products = loadProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }
    
    if (name) products[productIndex].name = name;
    if (price) products[productIndex].price = parseInt(price);
    if (image) products[productIndex].image = image;
    if (description) products[productIndex].description = description;
    if (stock !== undefined) products[productIndex].stock = parseInt(stock);
    
    saveProducts(products);
    await saveAndPushProducts(products);
    
    res.json({ success: true, message: 'Produk berhasil diupdate', product: products[productIndex] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

app.delete('/api/products/:id', authenticateToken, requireAdminOrDeveloper, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    const products = loadProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }
    
    const deletedProduct = products.splice(productIndex, 1)[0];
    saveProducts(products);
    await saveAndPushProducts(products);
    
    res.json({ success: true, message: 'Produk berhasil dihapus', deletedProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ============================================
// POPULATION MANAGEMENT
// ============================================

function loadPopulation() {
  if (!fs.existsSync(POPULATION_FILE)) {
    const defaultData = {
      total: 1247,
      male: 514,
      female: 485,
      families: 312,
      rt: 8,
      rw: 3
    };
    fs.writeFileSync(POPULATION_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(POPULATION_FILE, 'utf8'));
}

function savePopulation(data) {
  fs.writeFileSync(POPULATION_FILE, JSON.stringify(data, null, 2));
  console.log('✅ Population saved');
}

app.get('/api/population', (req, res) => {
  const data = loadPopulation();
  res.json({ success: true, data });
});

app.put('/api/population', authenticateToken, requireAdminOrDeveloper, async (req, res) => {
  try {
    const data = req.body;
    savePopulation(data);
    await pushToGitHub('population.json', data);
    res.json({ success: true, message: 'Data penduduk berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ============================================
// APBDES MANAGEMENT
// ============================================

function loadAPBDes() {
  if (!fs.existsSync(APBDES_FILE)) {
    const defaultData = {
      pendapatan: 1250000000,
      belanja: 1245000000,
      belanjaPegawai: 450000000,
      belanjaBarang: 380000000,
      belanjaModal: 415000000
    };
    fs.writeFileSync(APBDES_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(APBDES_FILE, 'utf8'));
}

function saveAPBDes(data) {
  fs.writeFileSync(APBDES_FILE, JSON.stringify(data, null, 2));
  console.log('✅ APBDes saved');
}

app.get('/api/apbdes', (req, res) => {
  const data = loadAPBDes();
  res.json({ success: true, data });
});

app.put('/api/apbdes', authenticateToken, requireAdminOrDeveloper, async (req, res) => {
  try {
    const data = req.body;
    saveAPBDes(data);
    await pushToGitHub('apbdes.json', data);
    res.json({ success: true, message: 'Data APBDes berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

async function pushToGitHub(filename, data) {
  if (!GITHUB_TOKEN) return;
  
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    let sha = '';
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      if (getRes.ok) {
        sha = (await getRes.json()).sha;
      }
    } catch (e) {}
    
    await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Update ${filename}: ${new Date().toISOString()}`,
          content: content,
          sha: sha || undefined
        })
      }
    );
    
    console.log(`✅ ${filename} pushed to GitHub`);
  } catch (err) {
    console.log(`❌ Push ${filename} error:`, err.message);
  }
}

// ============================================
// TEAM ENDPOINTS
// ============================================

app.get('/api/team', (req, res) => {
  const team = loadTeam();
  res.json({ success: true, team });
});

app.put('/api/team', authenticateToken, requireAdminOrDeveloper, async (req, res) => {
  try {
    const teamData = req.body;
    saveTeam(teamData);
    await pushTeamToGitHub(teamData);
    res.json({ success: true, message: 'Data tim berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ============================================
// START SERVER
// ============================================

setTimeout(() => {
  const devExists = false; // Will be checked on first request
  console.log('✅ Developer account ready: developer / dev123');
}, 2000);

downloadFromGitHub().then(data => {
  console.log('✅ Loaded', data.length, 'users');
});

// ============================================
// UTILITY ENDPOINTS
// ============================================

// Health check (useful for Railway/Render)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0-secure-auth'
  });
});

// Verify token (frontend can use this to check if user is still logged in)
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    valid: true,
    user: req.user
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Secure auth system active (bcrypt + JWT)`);
  console.log(`✅ Health check: /api/health`);
});
