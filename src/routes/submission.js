const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const { body, param, validationResult } = require('express-validator');
const { clerkClient } = require('@clerk/express');

// Get submission details by ID
router.get('/:submissionId', param('submissionId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: 'Invalid submissionId' });
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .populate('exam_id', 'title subject');
    
    if (!submission) return res.status(404).json({ ok: false, error: 'Submission not found' });
    
    // Fetch student info from Clerk if student_id exists
    let studentInfo = null;
    if (submission.student_id) {
      try {
        const clerkUser = await clerkClient.users.getUser(submission.student_id);
        studentInfo = {
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Student',
          email: clerkUser.emailAddresses?.[0]?.emailAddress || 'No email',
          id: clerkUser.id
        };
      } catch (clerkError) {
        console.error('Error fetching student from Clerk:', clerkError.message);
        studentInfo = { name: 'Anonymous', email: '', id: submission.student_id };
      }
    }
    
    // Return submission with student info attached
    const submissionData = submission.toObject();
    submissionData.student_id = studentInfo;
    
    res.json({ ok: true, submission: submissionData });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Upload a submission (images should be uploaded to Cloudinary from client)
router.post('/upload',
  body('exam_id').isMongoId().withMessage('Valid exam_id required'),
  body('answers').isArray({ min: 1 }).withMessage('answers array required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
    try {
      const s = new Submission(req.body);
      await s.save();
      res.json({ ok: true, submission: s });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

module.exports = router;
