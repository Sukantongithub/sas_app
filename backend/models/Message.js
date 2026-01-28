const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'document']
    },
    url: String,
    name: String,
    size: Number
  }],
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['like', 'love', 'laugh', 'sad', 'angry', 'wow'],
      default: 'like'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  pinnedAt: Date,
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  editHistory: [{
    oldContent: String,
    editedAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Index for efficient querying
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
