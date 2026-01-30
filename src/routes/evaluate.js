const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Question = require('../models/Question');
const { gradeAnswer } = require('../services/grading');
const { evalLimiter } = require('../middleware/rateLimit');
const { param, validationResult } = require('express-validator');
const { SUBMISSION_STATUS } = require('../constants/submissionStatus');

// Get evaluation for a submission
router.get('/:submissionId', param('submissionId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid submissionId' });
  try {
    const evaluation = await Evaluation.findOne({ submission_id: req.params.submissionId });
    if (!evaluation) {
      return res.json({ ok: true, evaluation: null }); // No evaluation yet
    }
    
    // Calculate maxScore from results
    const questionScores = evaluation.results?.map(r => ({
      questionId: r.questionId,
      score: r.score,
      maxScore: r.maxScore || 5, // Use stored maxScore or default to 5
      feedback: r.feedback
    })) || [];
    
    const maxScore = questionScores.reduce((sum, q) => sum + q.maxScore, 0);
    
    res.json({ 
      ok: true, 
      evaluation: {
        _id: evaluation._id,
        totalScore: evaluation.totalScore,
        maxScore,
        questionScores,
        createdAt: evaluation.createdAt
      }
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Evaluate a submission by id (placeholder - integrate AI here)
router.post('/:submissionId', evalLimiter, param('submissionId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid submissionId' });
  try {
  const submission = await Submission.findById(req.params.submissionId).populate('answers.questionId');
    if (!submission) return res.status(404).json({ ok: false, error: 'Not found' });
  if (submission.status === SUBMISSION_STATUS.DRAFT) return res.status(400).json({ ok: false, error: 'Finalize submission before evaluation' });

    const qIds = submission.answers.map(a => a.questionId?._id).filter(Boolean);
    const qDocs = await Question.find({ _id: { $in: qIds } });
    const qMap = new Map(qDocs.map(q => [String(q._id), q]));

    const results = [];
    let maxScore = 0;
    
    for (const a of submission.answers) {
      const q = qMap.get(String(a.questionId?._id || a.questionId));
      if (!q) {
        console.warn(`Question not found for answer: ${a.questionId}`);
        continue;
      }
      
      const questionMaxScore = q.marks || 5;
      maxScore += questionMaxScore;
      
      const model = q.modelAnswer || '';
      const keypoints = q.keypoints || [];
      const student = a.extractedText || '';
      
      console.log(`Grading question ${q._id}: max=${questionMaxScore}, model length=${model.length}, student length=${student.length}`);
      
      const r = await gradeAnswer({ 
        modelAnswer: model, 
        studentAnswer: student, 
        maxScore: questionMaxScore, 
        keypoints 
      });
      
      results.push({ 
        questionId: a.questionId, 
        score: r.score, 
        feedback: r.feedback,
        maxScore: questionMaxScore
      });
    }
    
    const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
    
    console.log(`Evaluation complete: ${totalScore}/${maxScore} (${results.length} questions)`);
    
    const evalDoc = new Evaluation({ submission_id: submission._id, results, totalScore });
    await evalDoc.save();
    
    // Update submission status to 'evaluated'
    submission.status = SUBMISSION_STATUS.EVALUATED;
    await submission.save();
    
    console.log(`✓ Submission ${submission._id} evaluated. Total score: ${totalScore}/${maxScore}`);
    
    res.json({ 
      ok: true, 
      evaluation: {
        _id: evalDoc._id,
        submission_id: evalDoc.submission_id,
        totalScore,
        maxScore,
        results,
        createdAt: evalDoc.createdAt
      }
    });
  } catch (err) {
    console.error('❌ Evaluation POST error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
