const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.xlsx');

// === GITHUB CONFIG (PASTIKAN SUDAH DISET DI RAILWAY) ===
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'biskuitz';
const GITHUB_REPO = process.env.GITHUB_REPO || 'desakalemago2';
const GITHUB_PATH = 'backend/users.xlsx';

console.log('🔧 GitHub Config:');
console.log('   Owner:', GITHUB_OWNER);
console.log('   Repo:', GITHUB_REPO);
console.log('   Path:', GITHUB_PATH);
console.log('   Token exists:', GITHUB_TOKEN ? 'YES' : 'NO');

function readUsers() {
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

async function saveUsers(users) {
  const ws = XLSX.utils.json_to_sheet(users);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  XLSX.writeFile(wb, USERS_FILE);
  console.log('✅ Excel saved locally');

  // === UPDATE KE GITHUB ===
  if (!GITHUB_TOKEN) {
    console.log('⚠️ GITHUB_TOKEN tidak ditemukan! Data hanya tersimpan di Railway.');
    return;
  }

  try {
    const fileContent = fs.readFileSync(USERS_FILE);
    const contentBase64 = fileContent.toString('base64');

    // Dapatkan SHA
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
        const data = await getRes.json();
        sha = data.sha;
      }
    } catch (e) {}

    // Update file
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
          message: `Auto-update: New user registered - ${new Date().toISOString()}`,
          content: contentBase64,
          sha: sha || undefined
        })
      }
    );

    if (updateRes.ok) {
      console.log('✅ SUCCESS: File users.xlsx updated on GitHub!');
    } else {
      const errorText = await updateRes.text();
      console.log('❌ GitHub update FAILED:', errorText);
    }
  } catch (err) {
    console.log('❌ GitHub API ERROR:', err.message);
  }
}

let users = readUsers();

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
    
    users = readUsers();
    
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

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
    }
    
    users = readUsers();
    const user = users.find(u => u.username === username);
    
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
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
app.get('/api/auth/profile', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ success: false, message: 'Username diperlukan' });
  
  users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
