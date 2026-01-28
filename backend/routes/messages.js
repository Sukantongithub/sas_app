const express = require('express');
const router = express.Router();
const { asyncHandler, handleError, sendSuccess, findOrFail, ROLE_GROUPS } = require('../utils/routeHelpers');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');

// Models
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ============================================================================
// MESSAGING & COMMUNICATION SYSTEM
// ============================================================================

// @route   GET /api/messages/:userId/conversations
// @desc    Get all conversations for a user
// @access  Private (Self or Admin)
router.get('/:userId/conversations', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin'] }), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const conversations = await Conversation.find({
    participants: req.params.userId
  })
    .populate('participants', 'name email role')
    .populate('lastMessage')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Conversation.countDocuments({
    participants: req.params.userId
  });

  // Get unread count
  const unreadConversations = await Conversation.find({
    participants: req.params.userId,
    [`unreadBy.${req.params.userId}`]: { $gt: 0 }
  }).countDocuments();

  const enrichedConversations = conversations.map(conv => {
    const otherParticipant = conv.participants.find(p => !p._id.equals(req.params.userId));
    return {
      _id: conv._id,
      participantId: otherParticipant._id,
      participantName: otherParticipant.name,
      lastMessage: conv.lastMessage?.content || 'No messages yet',
      lastMessageTime: conv.lastMessage?.createdAt || conv.updatedAt,
      unreadCount: conv.unreadBy?.[req.params.userId] || 0,
      createdAt: conv.createdAt
    };
  });

  sendSuccess(res, {
    conversations: enrichedConversations,
    totalRecords: total,
    totalUnread: unreadConversations,
    page: page * 1,
    totalPages: Math.ceil(total / limit)
  }, 200, 'Conversations retrieved');
}));

// @route   GET /api/messages/conversation/:conversationId/messages
// @desc    Get messages in a conversation
// @access  Private (Conversation participant or Admin)
router.get('/conversation/:conversationId/messages', requireAuth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 30 } = req.query;

  const conversation = await Conversation.findById(req.params.conversationId);
  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  // Check if user is participant
  if (!conversation.participants.some(id => id.equals(req.user._id)) && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to view this conversation' });
  }

  const messages = await Message.find({ conversationId: req.params.conversationId })
    .populate('senderId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Message.countDocuments({ conversationId: req.params.conversationId });

  // Mark messages as read
  await Message.updateMany(
    {
      conversationId: req.params.conversationId,
      senderId: { $ne: req.user._id },
      readBy: { $ne: req.user._id }
    },
    { $push: { readBy: req.user._id } }
  );

  // Update unread count in conversation
  await Conversation.findByIdAndUpdate(
    req.params.conversationId,
    { $set: { [`unreadBy.${req.user._id}`]: 0 } }
  );

  sendSuccess(res, {
    messages: messages.reverse(),
    totalRecords: total,
    page: page * 1,
    totalPages: Math.ceil(total / limit)
  }, 200, 'Messages retrieved');
}));

// @route   POST /api/messages/send
// @desc    Send a message
// @access  Private (Authenticated)
router.post('/send', requireAuth, asyncHandler(async (req, res) => {
  const { recipientId, content, attachments = [] } = req.body;

  if (!recipientId || !content?.trim()) {
    return res.status(400).json({ message: 'Recipient and message content are required' });
  }

  // Check if recipient exists
  const recipient = await User.findById(recipientId);
  if (!recipient) {
    return res.status(404).json({ message: 'Recipient not found' });
  }

  // Find or create conversation
  let conversation = await Conversation.findOne({
    $and: [
      { participants: req.user._id },
      { participants: recipientId }
    ]
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, recipientId],
      createdBy: req.user._id
    });
  }

  // Create message
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: req.user._id,
    content: content.trim(),
    attachments
  });

  // Update conversation
  conversation.lastMessage = message._id;
  conversation.updatedAt = new Date();
  conversation[`unreadBy.${recipientId}`] = (conversation.unreadBy?.[recipientId] || 0) + 1;
  await conversation.save();

  // Notify recipient
  await Notification.create({
    userId: recipientId,
    type: 'new_message',
    message: `New message from ${req.user.name}`,
    relatedId: conversation._id
  });

  await message.populate('senderId', 'name email');

  sendSuccess(res, message, 201, 'Message sent');
}));

// @route   POST /api/messages/conversation/create
// @desc    Start a new conversation
// @access  Private (Authenticated)
router.post('/conversation/create', requireAuth, asyncHandler(async (req, res) => {
  const { participantIds } = req.body;

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ message: 'Participant IDs are required' });
  }

  // Ensure requester is included
  const allParticipants = [req.user._id, ...participantIds.filter(id => !id.equals(req.user._id))];

  // Check for existing conversation (for 1-on-1)
  if (allParticipants.length === 2) {
    let existing = await Conversation.findOne({
      $and: [
        { participants: allParticipants[0] },
        { participants: allParticipants[1] }
      ]
    });

    if (existing) {
      return sendSuccess(res, existing, 200, 'Conversation already exists');
    }
  }

  const conversation = await Conversation.create({
    participants: allParticipants,
    createdBy: req.user._id
  });

  await conversation.populate('participants', 'name email role');

  sendSuccess(res, conversation, 201, 'Conversation created');
}));

// @route   DELETE /api/messages/:conversationId
// @desc    Delete a conversation (soft delete)
// @access  Private (Conversation participant or Admin)
router.delete('/:conversationId', requireAuth, asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.conversationId);
  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  if (!conversation.participants.some(id => id.equals(req.user._id)) && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  // Add to deletedBy list instead of hard delete
  if (!conversation.deletedBy) conversation.deletedBy = [];
  conversation.deletedBy.push(req.user._id);
  await conversation.save();

  sendSuccess(res, null, 200, 'Conversation deleted');
}));

// @route   PUT /api/messages/:messageId/react
// @desc    React to a message
// @access  Private (Authenticated)
router.put('/:messageId/react', requireAuth, asyncHandler(async (req, res) => {
  const { reaction } = req.body; // e.g., 'like', 'love', 'laugh', 'sad', 'angry'

  if (!reaction) {
    return res.status(400).json({ message: 'Reaction is required' });
  }

  const message = await Message.findById(req.params.messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  // Check if user already reacted
  const existingReaction = message.reactions.find(r => r.userId.equals(req.user._id));

  if (existingReaction) {
    existingReaction.type = reaction;
  } else {
    message.reactions.push({
      userId: req.user._id,
      type: reaction,
      createdAt: new Date()
    });
  }

  await message.save();
  await message.populate('senderId', 'name email');

  sendSuccess(res, message, 200, 'Reaction added');
}));

// @route   GET /api/messages/search/:query
// @desc    Search messages
// @access  Private (Authenticated)
router.get('/search/:query', requireAuth, asyncHandler(async (req, res) => {
  const { conversationId } = req.query;
  const searchRegex = new RegExp(req.params.query, 'i');

  let query = {
    senderId: req.user._id,
    content: searchRegex
  };

  if (conversationId) {
    query.conversationId = conversationId;
  }

  const messages = await Message.find(query)
    .populate('senderId', 'name email')
    .sort({ createdAt: -1 })
    .limit(50);

  sendSuccess(res, messages, 200, 'Search results');
}));

// @route   POST /api/messages/:messageId/pin
// @desc    Pin/unpin a message
// @access  Private (Conversation participant or Admin)
router.post('/:messageId/pin', requireAuth, asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  message.isPinned = !message.isPinned;
  if (message.isPinned) {
    message.pinnedBy = req.user._id;
    message.pinnedAt = new Date();
  } else {
    message.pinnedBy = null;
    message.pinnedAt = null;
  }

  await message.save();

  sendSuccess(res, message, 200, message.isPinned ? 'Message pinned' : 'Message unpinned');
}));

// @route   GET /api/messages/:conversationId/pinned
// @desc    Get pinned messages in a conversation
// @access  Private (Conversation participant or Admin)
router.get('/:conversationId/pinned', requireAuth, asyncHandler(async (req, res) => {
  const pinnedMessages = await Message.find({
    conversationId: req.params.conversationId,
    isPinned: true
  })
    .populate('senderId', 'name email')
    .populate('pinnedBy', 'name email')
    .sort({ pinnedAt: -1 });

  sendSuccess(res, pinnedMessages, 200, 'Pinned messages retrieved');
}));

module.exports = router;
