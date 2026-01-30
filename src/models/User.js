const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const ROLES = require('../constants/roles');

/**
 * Unified User model for authentication
 * Replaces separate Teacher/Student models internally
 * Supports role-based access control (RBAC)
 */
const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    required: [true, 'Role is required'],
    default: ROLES.STUDENT
  }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
