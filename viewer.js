const fs = require('fs');
const path = require('path');

const VISITOR_FILE = path.join(__dirname, 'visitors.json');

// GitHub Config (for persistence across restarts)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'biskuitz';
const GITHUB_REPO = process.env.GITHUB_REPO || 'desakalemago2';

// Download visitors.json from GitHub if local file missing (for Railway persistence)
async function downloadVisitorsFromGitHub() {
  if (!GITHUB_TOKEN) return null;

  try {
    console.log('📥 Downloading visitors.json from GitHub...');
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/backend/visitors.json`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!res.ok) {
      console.log('⚠️ visitors.json not found on GitHub, will create new');
      return null;
    }

    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    fs.writeFileSync(VISITOR_FILE, content);
    console.log('✅ Downloaded visitors.json from GitHub');
    return JSON.parse(content);
  } catch (err) {
    console.log('❌ Download visitors.json error:', err.message);
    return null;
  }
}

// Initialize visitor data (with GitHub fallback for persistence)
async function initVisitorData() {
  if (!fs.existsSync(VISITOR_FILE)) {
    const downloaded = await downloadVisitorsFromGitHub();
    if (downloaded) return downloaded;

    const initialData = {
      total: 0,
      today: 0,
      lastDate: new Date().toISOString().split('T')[0],
      history: [],
      visitors: []
    };
    fs.writeFileSync(VISITOR_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(VISITOR_FILE, 'utf8'));
}

// Save visitor data (with GitHub push for persistence)
async function saveVisitorData(data) {
  fs.writeFileSync(VISITOR_FILE, JSON.stringify(data, null, 2));

  if (!GITHUB_TOKEN) return;

  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

    let sha = '';
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/backend/visitors.json`,
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
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/backend/visitors.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Update visitors.json: ${new Date().toISOString()}`,
          content: content,
          sha: sha || undefined
        })
      }
    );

    console.log('✅ visitors.json pushed to GitHub');
  } catch (err) {
    console.log('❌ Push visitors.json error:', err.message);
  }
}

// Get current visitor stats
async function getVisitorStats() {
  const data = await initVisitorData();
  const today = new Date().toISOString().split('T')[0];

  // Reset daily count if new day (total never resets)
  if (data.lastDate !== today) {
    data.today = 0;
    data.lastDate = today;
    await saveVisitorData(data);
  }

  // Get last 7 days history
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const entry = data.history.find(h => h.date === dateStr);
    last7Days.push({
      date: dateStr,
      count: entry ? entry.count : 0
    });
  }

  return {
    total: data.total,
    today: data.today,
    online: 1,
    history: last7Days,
    visitors: data.visitors || []
  };
}

// Increment visitor count (total persists, only today resets on new day)
async function incrementVisitor(req = null) {
  const data = await initVisitorData();
  const today = new Date().toISOString().split('T')[0];

  // Reset if new day (total never resets)
  if (data.lastDate !== today) {
    data.today = 0;
    data.lastDate = today;
  }

  data.total++;
  data.today++;

  // Add to history (keep last 30 days)
  const dateStr = today;
  const existingEntry = data.history.find(h => h.date === dateStr);

  if (existingEntry) {
    existingEntry.count = data.today;
  } else {
    data.history.push({ date: dateStr, count: data.today });
    // Keep only last 30 days
    if (data.history.length > 30) {
      data.history = data.history.slice(-30);
    }
  }

  // Log detailed visitor info (if request available)
  if (req) {
    if (!data.visitors) data.visitors = [];

    const visitorInfo = {
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      device: getDeviceName(req.get('User-Agent'))
    };

    data.visitors.unshift(visitorInfo); // Add to beginning

    // Keep only last 100 visitors
    if (data.visitors.length > 100) {
      data.visitors = data.visitors.slice(0, 100);
    }
  }

  await saveVisitorData(data);

  return {
    total: data.total,
    today: data.today
  };
}

// Simple device name detection
function getDeviceName(userAgent) {
  if (!userAgent) return 'Unknown Device';

  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) return 'Android Device';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Macintosh')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux PC';
  if (userAgent.includes('Mobile')) return 'Mobile Device';

  return 'Desktop/Laptop';
}

module.exports = {
  getVisitorStats,
  incrementVisitor
};
