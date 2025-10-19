const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: String,
  marks: Number,
  modelAnswer: String,
  keypoints: [{ text: String, weight: { type: Number, default: 1 } }],
  exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }
}, { timestamps: true });

module.exports = mongoose.model('Question', QuestionSchema);
