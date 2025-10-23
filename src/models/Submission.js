const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  answerImage: String,
  extractedText: String
});

const SubmissionSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  status: { type: String, enum: ['draft', 'finalized', 'evaluated'], default: 'draft' },
  answers: [AnswerSchema]
}, { timestamps: true });

module.exports = mongoose.model('Submission', SubmissionSchema);
