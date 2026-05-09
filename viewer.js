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
  
  return {
    total: data.total,
    today: data.today,
    online: 1 // Simple online count
  };
}

// Increment visitor count
function incrementVisitor() {
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
  
  saveVisitorData(data);
  
  return {
    total: data.total,
    today: data.today
  };
}

// Save visitor data
function saveVisitorData(data) {
  fs.writeFileSync(VISITOR_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  getVisitorStats,
  incrementVisitor
};