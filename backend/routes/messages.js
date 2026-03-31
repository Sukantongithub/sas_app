const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { asyncHandler, sendSuccess } = require('../utils/routeHelpers');
const { requireAuth, requireSelfOrRoles } = require('../middleware/auth');

// Models
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ============================================================================
// @route   GET /api/messages/users
// @desc    Get list of users the current user can message
//          - Students/Parents → see only staff / HOD / admin
//          - Staff/HOD/Admin  → see everyone
// @access  Private (Authenticated)
// ============================================================================
router.get('/users', requireAuth, asyncHandler(async (req, res) => {
  const role = req.user.role;
  const search = req.query.search ? new RegExp(req.query.search, 'i') : null;

  const query = { _id: { $ne: req.user._id }, isActive: true };

  if (role === 'student' || role === 'parent') {
    query.role = { $in: ['staff', 'hod', 'admin', 'super_admin'] };
  }

  if (search) {
    query.$or = [{ name: search }, { email: search }];
  }

  const users = await User.find(query)
    .select('name email role')
    .sort({ role: 1, name: 1 })
    .limit(100);

  sendSuccess(res, users, 200, 'Users retrieved');
}));

// ============================================================================
// MESSAGING & COMMUNICATION SYSTEM
// ============================================================================

// @route   GET /api/messages/:userId/conversations
// @desc    Get all conversations for a user
// @access  Private (Self or Admin)
router.get('/:userId/conversations', requireAuth, requireSelfOrRoles({ studentParam: 'userId', roles: ['super_admin', 'admin'] }), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const conversations = await Conversation.find({ participants: req.params.userId })
    .populate('participants', 'name email role')
    .populate('lastMessage')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Conversation.countDocuments({ participants: req.params.userId });

  const unreadConversations = await Conversation.countDocuments({
    participants: req.params.userId,
    [`unreadBy.${req.params.userId}`]: { $gt: 0 }
  });

  const enrichedConversations = conversations.map(conv => {
    const otherParticipant = conv.participants.find(p => !p._id.equals(req.params.userId));
    return {
      _id: conv._id,
      participantId: otherParticipant?._id,
      participantName: otherParticipant?.name,
      participantRole: otherParticipant?.role,
      lastMessage: conv.lastMessage?.content || 'No messages yet',
      lastMessageTime: conv.lastMessage?.createdAt || conv.updatedAt,
      unreadCount: conv.unreadBy?.get(req.params.userId) || 0,
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

  if (!conversation.participants.some(id => id.equals(req.user._id)) && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to view this conversation' });
  }

  const messages = await Message.find({ conversationId: req.params.conversationId })
    .populate('senderId', 'name email role')
    .sort({ createdAt: 1 })
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

  // Reset unread count using Map.set()
  conversation.unreadBy.set(String(req.user._id), 0);
  await conversation.save();

  sendSuccess(res, {
    messages: messages,
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
    console.warn('[MESSAGE] Missing recipientId or content:', { recipientId: !!recipientId, content: !!content?.trim() });
    return res.status(400).json({ message: 'Recipient and message content are required' });
  }

  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    console.warn('[MESSAGE] Invalid recipientId format:', recipientId);
    return res.status(400).json({ message: 'Invalid recipient ID format' });
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    console.warn('[MESSAGE] Recipient not found:', recipientId);
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

  // Update conversation — use Map.set() for Mongoose Map fields
  conversation.lastMessage = message._id;
  conversation.updatedAt = new Date();
  const currentUnread = conversation.unreadBy.get(String(recipientId)) || 0;
  conversation.unreadBy.set(String(recipientId), currentUnread + 1);
  await conversation.save();

  // Notify recipient
  try {
    await Notification.create({
      userId: recipientId,
      type: 'new_message',
      message: `New message from ${req.user.name}`,
      relatedId: conversation._id
    });
  } catch (notifError) {
    console.warn('[MESSAGE] Notification creation failed (non-blocking):', notifError.message);
    // Continue - notification failure should not block message send
  }

  await message.populate('senderId', 'name email');

  sendSuccess(res, message, 201, 'Message sent successfully');
}));

// @route   POST /api/messages/conversation/create
// @desc    Start a new conversation
// @access  Private (Authenticated)
router.post('/conversation/create', requireAuth, asyncHandler(async (req, res) => {
  const { participantIds } = req.body;

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ message: 'Participant IDs are required' });
  }

  const myId = String(req.user._id);
  const uniqueParticipants = [req.user._id, ...participantIds.filter(id => String(id) !== myId)];

  // Check for existing 1-on-1 conversation
  if (uniqueParticipants.length === 2) {
    const existing = await Conversation.findOne({
      $and: [
        { participants: uniqueParticipants[0] },
        { participants: uniqueParticipants[1] }
      ]
    });
    if (existing) {
      return sendSuccess(res, existing, 200, 'Conversation already exists');
    }
  }

  const conversation = await Conversation.create({
    participants: uniqueParticipants,
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

  if (!conversation.deletedBy) conversation.deletedBy = [];
  conversation.deletedBy.push(req.user._id);
  await conversation.save();

  sendSuccess(res, null, 200, 'Conversation deleted');
}));

// @route   PUT /api/messages/:messageId/react
// @desc    React to a message
// @access  Private (Authenticated)
router.put('/:messageId/react', requireAuth, asyncHandler(async (req, res) => {
  const { reaction } = req.body;

  if (!reaction) {
    return res.status(400).json({ message: 'Reaction is required' });
  }

  const message = await Message.findById(req.params.messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  const existingReaction = message.reactions.find(r => r.userId.equals(req.user._id));
  if (existingReaction) {
    existingReaction.type = reaction;
  } else {
    message.reactions.push({ userId: req.user._id, type: reaction, createdAt: new Date() });
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

  const query = { senderId: req.user._id, content: searchRegex };
  if (conversationId) query.conversationId = conversationId;

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
