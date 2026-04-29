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

console.log('🚀 Starting backend with GitHub sync...');

// Fungsi download users dari GitHub
async function downloadUsersFromGitHub() {
  if (!GITHUB_TOKEN) {
    console.log('⚠️ GITHUB_TOKEN tidak ditemukan, pakai data lokal');
    return readUsersLocal();
  }

  try {
    console.log('📥 Downloading users from GitHub...');
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
      console.log('⚠️ GitHub file not found, using local data');
      return readUsersLocal();
    }

    const data = await res.json();
    const content = Buffer.from(data.content, 'base64');
    fs.writeFileSync(USERS_FILE, content);
    console.log('✅ Downloaded latest users from GitHub');
    return readUsersLocal();
  } catch (err) {
    console.log('❌ Download failed:', err.message);
    return readUsersLocal();
  }
}

// Fungsi baca users lokal
function readUsersLocal() {
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
  const ws = wb.Sheets['Users'];
  return XLSX.utils.sheet_to_json(ws);
}

// Fungsi simpan + push ke GitHub
async function saveUsers(users) {
  const ws = XLSX.utils.json_to_sheet(users);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  XLSX.writeFile(wb, USERS_FILE);
  console.log('✅ Saved locally');

  // Push ke GitHub
  if (!GITHUB_TOKEN) return;

  try {
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
          message: `Auto-update: ${new Date().toISOString()}`,
          content: content,
          sha: sha || undefined
        })
      }
    );

    if (updateRes.ok) {
      console.log('✅ Pushed to GitHub!');
    } else {
      console.log('❌ Push failed');
    }
  } catch (err) {
    console.log('❌ Push error:', err.message);
  }
}

let users = [];

// Middleware
app.use(cors());
app.use(express.json());

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, message: 'Username, password, dan nama wajib diisi' });
    }
    
    users = await downloadUsersFromGitHub();
    
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
    await saveUsers(users);
    
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      user: { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// Login (dengan sinkronisasi)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
    }
    
    // Download data terbaru dari GitHub
    users = await downloadUsersFromGitHub();
    
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
  
  users = await downloadUsersFromGitHub();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

// Download users saat startup
downloadUsersFromGitHub().then(data => {
  users = data;
  console.log('✅ Loaded', users.length, 'users from GitHub');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
