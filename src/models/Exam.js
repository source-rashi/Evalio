const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema({
  title: String,
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }]
}, { timestamps: true });

module.exports = mongoose.model('Exam', ExamSchema);
