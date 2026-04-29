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
console.log('GITHUB_OWNER:', GITHUB_OWNER);
console.log('GITHUB_REPO:', GITHUB_REPO);

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
  // Simpan lokal
  const ws = XLSX.utils.json_to_sheet(users);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  XLSX.writeFile(wb, USERS_FILE);
  console.log('✅ Saved locally');

  // Push ke GitHub
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
          message: `Register: ${new Date().toISOString()}`,
          content: content,
          sha: sha || undefined
        })
      }
    );

    if (updateRes.ok) {
      console.log('✅ SUCCESS: Pushed to GitHub!');
    } else {
      const error = await updateRes.text();
      console.log('❌ Push FAILED:', error);
    }
  } catch (err) {
    console.log('❌ Push ERROR:', err.message);
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
    
    console.log('✅ New user registered:', username);
    
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      user: { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role }
    });
  } catch (error) {
    console.error('❌ Register error:', error);
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

// Startup
downloadFromGitHub().then(data => {
  users = data;
  console.log('✅ Loaded', users.length, 'users');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
