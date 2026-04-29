const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.xlsx');

// === GITHUB CONFIG ===
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'biskuitz';
const GITHUB_REPO = process.env.GITHUB_REPO || 'desakalemago2';
const GITHUB_PATH = 'backend/users.xlsx';

console.log('🚀 Backend starting...');
console.log('GITHUB_TOKEN exists:', GITHUB_TOKEN ? 'YES' : 'NO');

// Fungsi download dari GitHub
async function downloadFromGitHub() {
  if (!GITHUB_TOKEN) {
    console.log('⚠️ No GITHUB_TOKEN, using local file');
    return readLocal();
  }

  try {
    console.log('📥 Downloading from GitHub...');
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!res.ok) {
      console.log('⚠️ GitHub file not found, creating new one');
      return readLocal();
    }

    const data = await res.json();
    const content = Buffer.from(data.content, 'base64');
    fs.writeFileSync(USERS_FILE, content);
    console.log('✅ Downloaded from GitHub');
    return readLocal();
  } catch (err) {
    console.log('❌ Download error:', err.message);
    return readLocal();
  }
}

// Fungsi baca lokal
function readLocal() {
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

// Fungsi simpan + push ke GitHub
async function saveAndPush(users) {
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
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
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
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
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

let users = [];

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// AUTH ENDPOINTS
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, message: 'Username, password, dan nama wajib diisi' });
    }
    
    users = await downloadFromGitHub();
    
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
    }
    
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      username,
      password: password,
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
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
    }
    
    users = await downloadFromGitHub();
    
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.' 
      });
    }
    
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Password salah' });
    }
    
    res.json({
      success: true,
      message: 'Login berhasil',
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// Profile
app.get('/api/auth/profile', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ success: false, message: 'Username diperlukan' });
  
  users = await downloadFromGitHub();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

// ============================================
// DEVELOPER / ADMIN FEATURES
// ============================================

function requireDeveloper(req, res, next) {
  const username = req.headers['x-username'];
  if (!username) return res.status(401).json({ success: false, message: 'Unauthorized' });
  
  const user = users.find(u => u.username === username);
  if (!user || user.role !== 'developer') {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya developer.' });
  }
  next();
}

// Get semua user
app.get('/api/admin/users', requireDeveloper, (req, res) => {
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role
  }));
  res.json({ success: true, users: safeUsers });
});

// Update user
app.put('/api/admin/users/:id', requireDeveloper, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { username, password, name, role } = req.body;
  
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }
  
  if (username) users[userIndex].username = username;
  if (password) users[userIndex].password = password;
  if (name) users[userIndex].name = name;
  if (role) users[userIndex].role = role;
  
  await saveAndPush(users);
  
  res.json({ 
    success: true, 
    message: 'User berhasil diupdate',
    user: users[userIndex]
  });
});

// Delete user
app.delete('/api/admin/users/:id', requireDeveloper, async (req, res) => {
  const userId = parseInt(req.params.id);
  
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

// Visitor Stats
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

// Pre-create Developer Account
setTimeout(() => {
  const devExists = users.find(u => u.username === 'developer');
  if (!devExists) {
    users.push({
      id: 999,
      username: 'developer',
      password: 'dev123',
      name: 'Developer Account',
      role: 'developer'
    });
    saveAndPush(users);
    console.log('✅ Developer account created: developer / dev123');
  }
}, 2000);

// Startup
downloadFromGitHub().then(data => {
  users = data;
  console.log('✅ Loaded', users.length, 'users');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
