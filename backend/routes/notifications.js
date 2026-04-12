const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { requireAuth, requireRoles } = require('../middleware/auth');

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    
    const notifications = await Notification.getUserNotifications(
      req.user._id,
      parseInt(limit),
      parseInt(skip)
    );
    
    const unreadCount = await Notification.getUnreadCount(req.user._id);
    
    res.json({
      notifications,
      unreadCount,
      total: notifications.length
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// @route   GET /api/notifications/unread
// @desc    Get unread notifications count
// @access  Private
router.get('/unread', requireAuth, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    if (!notification.userId.equals(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await notification.markAsRead();
    
    res.json({
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Error marking notification', error: error.message });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Error marking notifications', error: error.message });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    if (!notification.userId.equals(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await notification.deleteOne();
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
});

// ============================================================================
// ADMIN ALERT ENDPOINTS
// ============================================================================

// @route   POST /api/notifications/admin/send-alert
// @desc    Admin sends alert to staff members
// @access  Private (Admin/Super Admin only)
// @body    { recipientIds[], title, message, priority, type }
router.post('/admin/send-alert', requireAuth, requireRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { recipientIds, title, message, priority = 'high', type = 'general' } = req.body;
    const sender = req.user;

    console.log(`[ALERT.SEND] Admin ${sender.name} sending alert to ${recipientIds?.length || 0} recipients`);

    // Validate input
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ message: 'At least one recipient ID is required' });
    }

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Alert title is required' });
    }

    if (!message?.trim()) {
      return res.status(400).json({ message: 'Alert message is required' });
    }

    // Validate all IDs
    const invalidIds = recipientIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ message: 'Invalid recipient IDs provided' });
    }

    // Verify recipients exist
    const recipients = await User.find({ _id: { $in: recipientIds }, isActive: true });
    if (recipients.length === 0) {
      return res.status(404).json({ message: 'No active recipients found with the provided IDs' });
    }

    console.log(`[ALERT.SEND] Found ${recipients.length} active recipients`);

    // Create notifications for each recipient
    const sentAlerts = [];
    const failedAlerts = [];

    for (const recipient of recipients) {
      try {
        const notification = await Notification.create({
          userId: recipient._id,
          type,
          title: title.trim(),
          message: message.trim(),
          priority,
          channels: ['app']
        });

        console.log(`[ALERT.SEND] Alert sent to ${recipient.name}`);

        sentAlerts.push({
          userId: recipient._id,
          userName: recipient.name,
          notificationId: notification._id,
          status: 'sent'
        });
      } catch (error) {
        console.error(`[ALERT.SEND] Failed to send alert to ${recipient._id}:`, error.message);
        failedAlerts.push({
          userId: recipient._id,
          userName: recipient.name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      sent: sentAlerts.length,
      failed: failedAlerts.length,
      total: recipients.length,
      sentAlerts,
      failedAlerts: failedAlerts.length > 0 ? failedAlerts : undefined,
      message: `Alert sent to ${sentAlerts.length}/${recipients.length} recipients`
    });
  } catch (error) {
    console.error('[ALERT.SEND] Error:', error);
    res.status(500).json({ message: 'Error sending alert', error: error.message });
  }
});

// @route   POST /api/notifications/admin/alert-types
// @desc    Get available alert types
// @access  Private (Admin/Super Admin only)
router.get('/admin/alert-types', requireAuth, requireRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const alertTypes = [
      { value: 'general', label: 'General Alert' },
      { value: 'urgent', label: 'Urgent Alert' },
      { value: 'attendance_alert', label: 'Attendance Alert' },
      { value: 'system_alert', label: 'System Alert' },
      { value: 'meeting_alert', label: 'Meeting Alert' },
      { value: 'policy_alert', label: 'Policy Alert' },
      { value: 'security_alert', label: 'Security Alert' },
      { value: 'maintenance_alert', label: 'Maintenance Alert' }
    ];

    const priorities = [
      { value: 'low', label: 'Low', color: '#4CAF50' },
      { value: 'medium', label: 'Medium', color: '#2196F3' },
      { value: 'high', label: 'High', color: '#FF9800' },
      { value: 'urgent', label: 'Urgent', color: '#F44336' }
    ];

    res.json({
      alertTypes,
      priorities
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alert types', error: error.message });
  }
});

// @route   GET /api/notifications/admin/send-history
// @desc    Get admin's sent alerts history
// @access  Private (Admin/Super Admin only)
router.get('/admin/send-history', requireAuth, requireRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    // Get notifications created by other admins (where message matches pattern or use a dedicated admin_alert type)
    // For now, we'll get alerts with high/urgent priority and 'general' type as proxy for admin alerts
    const alerts = await Notification.find({
      priority: { $in: ['high', 'urgent'] },
      type: { $in: ['general', 'system_alert', 'meeting_alert', 'policy_alert'] },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('userId', 'name email');

    const total = await Notification.countDocuments({
      priority: { $in: ['high', 'urgent'] },
      type: { $in: ['general', 'system_alert', 'meeting_alert', 'policy_alert'] },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      alerts,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get alert history error:', error);
    res.status(500).json({ message: 'Error fetching alert history', error: error.message });
  }
});

// @route   GET /api/notifications/admin/recipients
// @desc    Get list of staff members who can receive alerts
// @access  Private (Admin/Super Admin only)
router.get('/admin/recipients', requireAuth, requireRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { role = 'staff', department, search } = req.query;

    const query = {
      isActive: true,
      role: role || 'staff'
    };

    if (department) {
      const Staff = require('../models/Staff');
      const staffByDept = await Staff.find({ department }).select('userId');
      query._id = { $in: staffByDept.map(s => s.userId) };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const recipients = await User.find(query)
      .select('_id name email role')
      .sort({ name: 1 })
      .limit(100);

    res.json({
      recipients,
      total: recipients.length
    });
  } catch (error) {
    console.error('Get recipients error:', error);
    res.status(500).json({ message: 'Error fetching recipients', error: error.message });
  }
});

module.exports = router;
