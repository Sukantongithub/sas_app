const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    trim: true
    // For group conversations
  },
  avatar: String,
  // For tracking unread messages per user
  unreadBy: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  deletedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isGroup: {
    type: Boolean,
    default: false
  },
  description: String,
  settings: {
    muteNotifications: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    pinnedMessages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Index for efficient querying
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ 'participants': 1, 'updatedAt': -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
