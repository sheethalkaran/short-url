const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
  longUrl: {
    type: String,
    required: true,
    trim: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,  // Already creates index
    trim: true
  },
  customCode: {
    type: String,
    sparse: true,  // Already creates sparse index
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clicks: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// REMOVE duplicates:
// urlSchema.index({ shortCode: 1 });
// urlSchema.index({ customCode: 1 }, { sparse: true });

// ✅ Keep only compound/performance-specific indexes
urlSchema.index({ userId: 1, longUrl: 1 });
urlSchema.index({ userId: 1, createdAt: -1 });
urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Url', urlSchema);
