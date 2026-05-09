const express = require('express');
const router = express.Router();
const petaService = require('../peta');

// GET semua titik peta
router.get('/', (req, res) => {
  try {
    const points = petaService.getAllPoints();
    res.json(points);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST titik baru
router.post('/', (req, res) => {
  try {
    const newPoint = petaService.addPoint(req.body);
    res.status(201).json(newPoint);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT update titik
router.put('/:id', (req, res) => {
  try {
    const updatedPoint = petaService.updatePoint(req.params.id, req.body);
    if (!updatedPoint) {
      return res.status(404).json({ success: false, message: 'Titik tidak ditemukan' });
    }
    res.json(updatedPoint);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE titik
router.delete('/:id', (req, res) => {
  try {
    const success = petaService.deletePoint(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Titik tidak ditemukan' });
    }
    res.json({ success: true, message: 'Titik berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;