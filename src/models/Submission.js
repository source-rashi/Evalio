const mongoose = require('mongoose');
const { SUBMISSION_STATUS_VALUES, SUBMISSION_STATUS } = require('../constants/submissionStatus');

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  answerImage: String,
  extractedText: String
});

const SubmissionSchema = new mongoose.Schema({
  student_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student',
    index: true  // Optimize queries filtering by student
  },
  exam_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exam',
    index: true  // Optimize queries filtering by exam
  },
  status: { 
    type: String, 
    enum: SUBMISSION_STATUS_VALUES, 
    default: SUBMISSION_STATUS.DRAFT,
    index: true  // Optimize queries filtering by submission status
  },
  answers: [AnswerSchema]
}, { timestamps: true });

module.exports = mongoose.model('Submission', SubmissionSchema);
