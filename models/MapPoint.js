const mongoose = require('mongoose');

const MapPointSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'fa-map-marker-alt' }
}, { timestamps: true });

module.exports = mongoose.model('MapPoint', MapPointSchema);