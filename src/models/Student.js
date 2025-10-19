const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  classCode: String,
}, { timestamps: true });

module.exports = mongoose.model('Student', StudentSchema);
