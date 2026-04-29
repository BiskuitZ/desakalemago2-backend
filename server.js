const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();

// ✅ PORT DINAMIS (WAJIB UNTUK RAILWAY)
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.xlsx');

// Git config untuk auto commit
const GIT_USERNAME = process.env.GIT_USERNAME || 'biskuitz';
const GIT_TOKEN = process.env.GIT_TOKEN || '';

// Fungsi baca users dari Excel
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

// Fungsi simpan users ke Excel + Auto Commit ke GitHub
function saveUsers(users) {
  const ws = XLSX.utils.json_to_sheet(users);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  XLSX.writeFile(wb, USERS_FILE);

  // === AUTO COMMIT KE GITHUB ===
  if (GIT_TOKEN) {
    try {
      const remoteUrl = `https://${GIT_USERNAME}:${GIT_TOKEN}@github.com/biskuitz/desakalemago2.git`;
      
      execSync(`git remote set-url origin ${remoteUrl}`);
      execSync('git config user.email "bot@desakalemago.com"');
      execSync('git config user.name "Desa Kalemago Bot"');
      execSync('git add users.xlsx');
      execSync('git commit -m "Auto-update: New user registered at ' + new Date().toISOString() + '"');
      execSync('git push origin main');
      console.log('✅ Excel updated & pushed to GitHub');
    } catch (err) {
      console.log('⚠️ Git push failed:', err.message);
    }
  }
}

let users = readUsers();

// Middleware
app.use(cors());
app.use(express.json());

// Register
app.post('/api/auth/register', (req, res) => {
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
    saveUsers(users);
    
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
