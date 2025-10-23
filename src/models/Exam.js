const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema({
  title: String,
  subject: String,
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  isPublic: { type: Boolean, default: false }, // If true, all students can see it
}, { timestamps: true });

module.exports = mongoose.model('Exam', ExamSchema);
