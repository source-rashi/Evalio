const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');

// One-time migration to set all existing exams to public
router.post('/make-exams-public', async (req, res) => {
  try {
    const result = await Exam.updateMany(
      { isPublic: { $ne: true } }, // Find exams where isPublic is not true
      { $set: { isPublic: true } }  // Set them to public
    );
    
    res.json({ 
      ok: true, 
      message: `Updated ${result.modifiedCount} exams to public`,
      result 
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
