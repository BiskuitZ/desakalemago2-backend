const fs = require('fs');
const path = require('path');

const VISITOR_FILE = path.join(__dirname, 'visitors.json');

// Initialize visitor data
function initVisitorData() {
  if (!fs.existsSync(VISITOR_FILE)) {
    const initialData = {
      total: 0,
      today: 0,
      lastDate: new Date().toISOString().split('T')[0],
      history: []
    };
    fs.writeFileSync(VISITOR_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(VISITOR_FILE, 'utf8'));
}

// Get current visitor stats
function getVisitorStats() {
  const data = initVisitorData();
  const today = new Date().toISOString().split('T')[0];
  
  // Reset daily count if new day
  if (data.lastDate !== today) {
    data.today = 0;
    data.lastDate = today;
    saveVisitorData(data);
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

// Increment visitor count
function incrementVisitor(req = null) {
  const data = initVisitorData();
  const today = new Date().toISOString().split('T')[0];
  
  // Reset if new day
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
  
  saveVisitorData(data);
  
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

// Save visitor data
function saveVisitorData(data) {
  fs.writeFileSync(VISITOR_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  getVisitorStats,
  incrementVisitor
};