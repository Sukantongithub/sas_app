const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      // Attendance
      'attendance_marked', 'absent_alert', 'late_alert', 'low_attendance',
      'attendance_modification_request', 'sensitive_data_modification',
      'low_attendance_alert',
      // Leave
      'leave_approved', 'leave_rejected', 'leave_submitted',
      'leave_approval_requested', 'leave_approved_parent', 'leave_rejected_parent',
      // On-Duty
      'on_duty_approval', 'on_duty_rejection',
      // Absence Reason
      'absence_reason_review', 'absence_reason_approved', 'absence_reason_rejected',
      'absence_reason_approved_parent',
      // Attendance edit/verify
      'attendance_rejected', 'attendance_edited',
      // General
      'general'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed // Additional data (studentId, sessionId, etc.)
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  channels: [{
    type: String,
    enum: ['app', 'sms', 'email', 'push']
  }],
  sentVia: [{
    channel: String,
    sentAt: Date,
    status: { type: String, enum: ['pending', 'sent', 'failed'] }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1 });

// Mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return await this.save();
};

// Get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ userId, isRead: false });
};

// Get user notifications
notificationSchema.statics.getUserNotifications = function(userId, limit = 50, skip = 0) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Create and send notification
notificationSchema.statics.createAndSend = async function(userId, type, title, message, data = {}, channels = ['app']) {
  const notification = await this.create({
    userId,
    type,
    title,
    message,
    data,
    channels,
    sentVia: channels.map(ch => ({ channel: ch, status: 'pending' }))
  });
  
  // TODO: Integrate with actual notification services (FCM, SMS, Email)
  // For now, mark app notification as sent
  notification.sentVia.forEach(sv => {
    if (sv.channel === 'app') {
      sv.status = 'sent';
      sv.sentAt = new Date();
    }
  });
  await notification.save();
  
  return notification;
};

// Bulk create for multiple users
notificationSchema.statics.bulkCreate = async function(userIds, type, title, message, data = {}, channels = ['app']) {
  const notifications = userIds.map(userId => ({
    userId,
    type,
    title,
    message,
    data,
    channels,
    sentVia: channels.map(ch => ({ channel: ch, status: 'sent', sentAt: new Date() }))
  }));
  
  return await this.insertMany(notifications);
};

module.exports = mongoose.model('Notification', notificationSchema);
