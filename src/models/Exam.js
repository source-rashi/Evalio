const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema({
  title: String,
  subject: String,
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  isPublic: { type: Boolean, default: true }, // If true, all students can see it (default: true for MVP)
}, { timestamps: true });

module.exports = mongoose.model('Exam', ExamSchema);
