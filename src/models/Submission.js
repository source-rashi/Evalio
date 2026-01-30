const mongoose = require('mongoose');
const { SUBMISSION_STATUS_VALUES, SUBMISSION_STATUS } = require('../constants/submissionStatus');

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  answerImage: String,
  extractedText: String
});

const SubmissionSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  status: { type: String, enum: SUBMISSION_STATUS_VALUES, default: SUBMISSION_STATUS.DRAFT },
  answers: [AnswerSchema]
}, { timestamps: true });

module.exports = mongoose.model('Submission', SubmissionSchema);
