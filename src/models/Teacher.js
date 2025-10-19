const mongoose = require('mongoose');

const bcrypt = require('bcrypt');

const TeacherSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
}, { timestamps: true });

TeacherSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

TeacherSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
}

module.exports = mongoose.model('Teacher', TeacherSchema);
