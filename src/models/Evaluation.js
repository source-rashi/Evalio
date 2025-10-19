const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  score: Number,
  feedback: String
});

const EvaluationSchema = new mongoose.Schema({
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
  results: [ResultSchema],
  totalScore: Number
}, { timestamps: true });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
