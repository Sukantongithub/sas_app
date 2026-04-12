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
//          - Staff/HOD        → see all staff, admin, super_admin, and students (assigned)
//          - Admin/SuperAdmin → see all staff and admin users (for oversight/coordination)
// @access  Private (Authenticated)
// ============================================================================
router.get('/users', requireAuth, asyncHandler(async (req, res) => {
  const role = req.user.role;
  const search = req.query.search ? new RegExp(req.query.search, 'i') : null;

  const query = { _id: { $ne: req.user._id }, isActive: true };

  if (role === 'student' || role === 'parent') {
    // Students/Parents can message staff and admin
    query.role = { $in: ['staff', 'hod', 'admin', 'super_admin'] };
  } else if (role === 'staff' || role === 'hod') {
    // Staff can message admin, super_admin, and other staff
    query.role = { $in: ['staff', 'hod', 'admin', 'super_admin', 'student'] };
  } else if (role === 'admin' || role === 'super_admin') {
    // Admins can see all staff and other admin users for coordination and oversight
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
// Permission Rules:
// - Students/Parents can message: Staff, HOD, Admin only
// - Staff/HOD can message: Admin, Super Admin, other Staff, HO, Students
// - Admin can message: Anyone (especially staff members for oversight)
// - Super Admin: Can message anyone
router.post('/send', requireAuth, asyncHandler(async (req, res) => {
  const { recipientId, content, subject, attachments = [] } = req.body;
  const sender = req.user;

  console.log(`[MESSAGE.SEND] Sender: ${sender.name} (${sender.role}) -> Recipient ID: ${recipientId}`);

  if (!recipientId || !content?.trim()) {
    console.warn('[MESSAGE.SEND] Missing recipientId or content:', { recipientId: !!recipientId, content: !!content?.trim() });
    return res.status(400).json({ message: 'Recipient and message content are required' });
  }

  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    console.warn('[MESSAGE.SEND] Invalid recipientId format:', recipientId);
    return res.status(400).json({ message: 'Invalid recipient ID format' });
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    console.warn('[MESSAGE.SEND] Recipient not found:', recipientId);
    return res.status(404).json({ message: 'Recipient not found' });
  }

  console.log(`[MESSAGE.SEND] Recipient found: ${recipient.name} (${recipient.role})`);

  // Prevent messaging self
  if (String(sender._id) === String(recipientId)) {
    console.warn('[MESSAGE.SEND] User tried to message themselves');
    return res.status(400).json({ message: 'Cannot message yourself' });
  }

  // Permission Check: Ensure sender can message this recipient
  // Positive permission model - explicitly allow based on roles
  const canMessage = () => {
    const senderRole = sender.role;
    const recipientRole = recipient.role;
    
    console.log(`[MESSAGE.SEND] Checking permission: ${senderRole} -> ${recipientRole}`);
    
    // Super Admin can message anyone
    if (senderRole === 'super_admin') {
      console.log('[MESSAGE.SEND] Permission: ALLOW (super_admin)');
      return true;
    }
    
    // Admin can message anyone
    if (senderRole === 'admin') {
      console.log('[MESSAGE.SEND] Permission: ALLOW (admin can message anyone)');
      return true;
    }
    
    // Staff/HOD can message: admin, super_admin, other staff, hod, and students
    if (senderRole === 'staff' || senderRole === 'hod') {
      const allowedRoles = ['admin', 'super_admin', 'staff', 'hod', 'student'];
      const allowed = allowedRoles.includes(recipientRole);
      console.log(`[MESSAGE.SEND] Permission: ${allowed ? 'ALLOW' : 'DENY'} (staff/hod can message: ${JSON.stringify(allowedRoles)})`);
      return allowed;
    }
    
    // Students/Parents can only message staff, HOD, admin
    if (senderRole === 'student' || senderRole === 'parent') {
      const allowedRoles = ['staff', 'hod', 'admin', 'super_admin'];
      const allowed = allowedRoles.includes(recipientRole);
      console.log(`[MESSAGE.SEND] Permission: ${allowed ? 'ALLOW' : 'DENY'} (student/parent can message: ${JSON.stringify(allowedRoles)})`);
      return allowed;
    }
    
    console.log('[MESSAGE.SEND] Permission: DENY (unknown sender role)');
    return false;
  };

  if (!canMessage()) {
    const roleMessages = {
      student: 'Students can only message staff members',
      parent: 'Parents can only message staff members',
      staff: 'Staff cannot message this user type',
      hod: 'HOD cannot message this user type'
    };
    const errorMsg = roleMessages[sender.role] || 'You do not have permission to message this user';
    console.warn(`[MESSAGE.SEND] Permission denied: ${errorMsg}`);
    return res.status(403).json({ message: errorMsg });
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
    subject: subject?.trim() || null,
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

// @route   POST /api/messages/admin/message-staff
// @desc    Admin sends message to staff member(s)
// @access  Private (Admin/Super Admin only)
// Convenience endpoint for admin to message staff members
router.post('/admin/message-staff', requireAuth, asyncHandler(async (req, res) => {
  const sender = req.user;
  
  // Only admin and super_admin can use this endpoint
  if (!['admin', 'super_admin'].includes(sender.role)) {
    return res.status(403).json({ message: 'Only admins can use this endpoint' });
  }

  const { staffIds, content, subject, attachments = [] } = req.body;

  if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
    return res.status(400).json({ message: 'At least one staff ID is required' });
  }

  if (!content?.trim()) {
    return res.status(400).json({ message: 'Message content is required' });
  }

  // Validate all IDs
  const invalidIds = staffIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    return res.status(400).json({ message: 'Invalid staff IDs provided' });
  }

  // Fetch staff members and verify they exist and are valid recipients
  const Staff = require('../models/Staff');
  const staffMembers = await Staff.find({ userId: { $in: staffIds } }).populate('userId');

  if (staffMembers.length === 0) {
    return res.status(404).json({ message: 'No staff members found with the provided IDs' });
  }

  const messages = [];
  const failedStaff = [];

  // Send message to each staff member
  for (const staff of staffMembers) {
    try {
      const recipientId = staff.userId._id;

      // Find or create conversation
      let conversation = await Conversation.findOne({
        $and: [
          { participants: sender._id },
          { participants: recipientId }
        ]
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [sender._id, recipientId],
          createdBy: sender._id
        });
      }

      // Create message
      const message = await Message.create({
        conversationId: conversation._id,
        senderId: sender._id,
        content: content.trim(),
        subject: subject || 'Admin Message',
        attachments
      });

      // Update conversation
      conversation.lastMessage = message._id;
      conversation.updatedAt = new Date();
      const currentUnread = conversation.unreadBy.get(String(recipientId)) || 0;
      conversation.unreadBy.set(String(recipientId), currentUnread + 1);
      await conversation.save();

      // Create notification
      try {
        await Notification.create({
          userId: recipientId,
          type: 'admin_message',
          title: subject || 'Message from Administration',
          message: `${sender.name}: ${content.substring(0, 100)}...`,
          priority: 'high',
          relatedId: conversation._id
        });
      } catch (notifError) {
        console.warn('[ADMIN_MESSAGE] Notification creation failed:', notifError.message);
      }

      await message.populate('senderId', 'name email');
      messages.push({
        staffId: staff._id,
        staffName: staff.userId.name,
        messageId: message._id,
        status: 'sent'
      });
    } catch (error) {
      console.error(`[ADMIN_MESSAGE] Failed to message staff ${staff._id}:`, error.message);
      failedStaff.push({
        staffId: staff._id,
        staffName: staff.userId.name,
        error: error.message
      });
    }
  }

  sendSuccess(res, {
    sent: messages.length,
    failed: failedStaff.length,
    messages,
    failedStaff: failedStaff.length > 0 ? failedStaff : undefined
  }, 201, `Messages sent to ${messages.length}/${staffMembers.length} staff members`);
}));

// @route   GET /api/messages/admin/staff-list
// @desc    Get list of staff members for admin to message
// @access  Private (Admin/Super Admin only)
router.get('/admin/staff-list', requireAuth, asyncHandler(async (req, res) => {
  // Only admin and super_admin can access
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only admins can access this endpoint' });
  }

  const { search, department, isActive = true } = req.query;
  const Staff = require('../models/Staff');

  const query = { isActive: isActive === 'false' ? false : true };
  
  if (department) {
    query.department = department;
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { 'userId.name': searchRegex },
      { 'userId.email': searchRegex },
      { employeeId: searchRegex }
    ];
  }

  const staff = await Staff.find(query)
    .populate('userId', 'name email role')
    .select('userId employeeId designation department isActive phone')
    .sort({ 'userId.name': 1 })
    .limit(100);

  sendSuccess(res, staff, 200, 'Staff list retrieved');
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

// ============================================================================
// @route   GET /api/messages/check-permission/:recipientId
// @desc    Check if current user can message a specific recipient (for debugging)
// @access  Private (Authenticated)
// ============================================================================
router.get('/check-permission/:recipientId', requireAuth, asyncHandler(async (req, res) => {
  const { recipientId } = req.params;
  const sender = req.user;

  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    return res.status(400).json({ message: 'Invalid recipient ID format' });
  }

  const recipient = await User.findById(recipientId).select('name email role isActive');
  if (!recipient) {
    return res.status(404).json({ message: 'Recipient not found' });
  }

  // Run same permission check as send endpoint
  const canMessage = () => {
    const senderRole = sender.role;
    const recipientRole = recipient.role;
    
    if (senderRole === 'super_admin') return true;
    if (senderRole === 'admin') return true;
    if (senderRole === 'staff' || senderRole === 'hod') {
      const allowedRoles = ['admin', 'super_admin', 'staff', 'hod', 'student'];
      return allowedRoles.includes(recipientRole);
    }
    if (senderRole === 'student' || senderRole === 'parent') {
      const allowedRoles = ['staff', 'hod', 'admin', 'super_admin'];
      return allowedRoles.includes(recipientRole);
    }
    return false;
  };

  const allowed = canMessage();

  res.json({
    sender: {
      id: sender._id,
      name: sender.name,
      role: sender.role
    },
    recipient: {
      id: recipient._id,
      name: recipient.name,
      role: recipient.role
    },
    canMessage: allowed,
    message: allowed ? 'Permission granted' : 'Permission denied'
  });
}));

module.exports = router;
