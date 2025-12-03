const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['login', 'logout', 'password_change', 'terms_accepted'],
    required: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Hızlı sorgu için indeks
logSchema.index({ user: 1, timestamp: -1 });
logSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Log', logSchema);