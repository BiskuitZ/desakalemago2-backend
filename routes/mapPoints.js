const express = require('express');
const router = express.Router();
const MapPoint = require('../models/MapPoint');

// GET semua titik peta
router.get('/', async (req, res) => {
  try {
    const points = await MapPoint.find().sort({ createdAt: -1 });
    res.json(points);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST titik baru
router.post('/', async (req, res) => {
  try {
    const point = new MapPoint(req.body);
    await point.save();
    res.status(201).json(point);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT update titik
router.put('/:id', async (req, res) => {
  try {
    const point = await MapPoint.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!point) return res.status(404).json({ success: false, message: 'Titik tidak ditemukan' });
    res.json(point);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE titik
router.delete('/:id', async (req, res) => {
  try {
    const point = await MapPoint.findByIdAndDelete(req.params.id);
    if (!point) return res.status(404).json({ success: false, message: 'Titik tidak ditemukan' });
    res.json({ success: true, message: 'Titik berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;