const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.xlsx');

// Git config
const GIT_USERNAME = process.env.GIT_USERNAME || 'biskuitz';
const GIT_TOKEN = process.env.GIT_TOKEN || '';

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

// ... (rest of the code remains the same)
