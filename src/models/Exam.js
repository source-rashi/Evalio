const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema({
  title: String,
  subject: String,
  teacher_id: { 
    type: String,  // Clerk user ID
    required: true,
    index: true  // Optimize queries filtering by teacher
  },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  assignedStudents: [{ type: String }],  // Array of Clerk user IDs
  isPublic: { 
    type: Boolean, 
    default: true,
    index: true  // Optimize queries filtering by public/private exams
  }, // If true, all students can see it (default: true for MVP)
}, { timestamps: true });

module.exports = mongoose.model('Exam', ExamSchema);
