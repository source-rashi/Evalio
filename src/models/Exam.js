const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema({
  title: String,
  subject: String,
  teacher_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher',
    index: true  // Optimize queries filtering by teacher
  },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  isPublic: { 
    type: Boolean, 
    default: true,
    index: true  // Optimize queries filtering by public/private exams
  }, // If true, all students can see it (default: true for MVP)
}, { timestamps: true });

module.exports = mongoose.model('Exam', ExamSchema);
