const express = require('express');
const router = express.Router();
const Evaluation = require('../models/Evaluation');

router.get('/results/:id', async (req, res) => {
  try {
    const evals = await Evaluation.find({ submission_id: req.params.id });
    res.json({ ok: true, evaluations: evals });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
