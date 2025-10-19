const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: String,
  marks: Number,
  modelAnswer: String,
  exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }
}, { timestamps: true });

module.exports = mongoose.model('Question', QuestionSchema);
