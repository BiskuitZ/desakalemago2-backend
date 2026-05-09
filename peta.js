const fs = require('fs');
const path = require('path');

const MAP_POINTS_FILE = path.join(__dirname, 'map-points.json');

// Load all map points from file
function loadMapPoints() {
  try {
    if (!fs.existsSync(MAP_POINTS_FILE)) {
      fs.writeFileSync(MAP_POINTS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(MAP_POINTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading map points:', error);
    return [];
  }
}

// Save all map points to file
function saveMapPoints(points) {
  try {
    fs.writeFileSync(MAP_POINTS_FILE, JSON.stringify(points, null, 2));
    console.log('✅ Map points saved to file');
    return true;
  } catch (error) {
    console.error('Error saving map points:', error);
    return false;
  }
}

// Get all points
function getAllPoints() {
  return loadMapPoints();
}

// Add new point
function addPoint(pointData) {
  const points = loadMapPoints();
  const newPoint = {
    id: Date.now(),
    name: pointData.name,
    lat: parseFloat(pointData.lat),
    lng: parseFloat(pointData.lng),
    description: pointData.description || '',
    icon: pointData.icon || 'fa-map-marker-alt',
    createdAt: new Date().toISOString()
  };
  
  points.push(newPoint);
  saveMapPoints(points);
  return newPoint;
}

// Update point
function updatePoint(id, pointData) {
  const points = loadMapPoints();
  const index = points.findIndex(p => p.id === parseInt(id));
  
  if (index === -1) return null;
  
  points[index] = {
    ...points[index],
    name: pointData.name || points[index].name,
    lat: pointData.lat ? parseFloat(pointData.lat) : points[index].lat,
    lng: pointData.lng ? parseFloat(pointData.lng) : points[index].lng,
    description: pointData.description !== undefined ? pointData.description : points[index].description,
    icon: pointData.icon || points[index].icon,
    updatedAt: new Date().toISOString()
  };
  
  saveMapPoints(points);
  return points[index];
}

// Delete point
function deletePoint(id) {
  const points = loadMapPoints();
  const index = points.findIndex(p => p.id === parseInt(id));
  
  if (index === -1) return false;
  
  points.splice(index, 1);
  saveMapPoints(points);
  return true;
}

module.exports = {
  getAllPoints,
  addPoint,
  updatePoint,
  deletePoint,
  loadMapPoints,
  saveMapPoints
};