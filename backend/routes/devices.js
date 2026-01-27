const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const ProxyLog = require('../models/ProxyLog');
const { requireAuth, requireRoles } = require('../middleware/auth');
const crypto = require('crypto');

// AES encryption for device ID
function encryptDeviceId(deviceId, secretKey = process.env.DEVICE_ENCRYPTION_KEY || 'default-secret-key-change-in-production') {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(secretKey.slice(0, 16)), Buffer.alloc(16, 0));
  let encrypted = cipher.update(deviceId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// @route   POST /api/devices/pair
// @desc    Pair a BLE device with user account
// @access  Private (Student/Faculty)
router.post('/pair', requireAuth, async (req, res) => {
  try {
    const { 
      deviceId, 
      hardwareModel = 'nRF52840',
      imuModel = 'LSM6DSO',
      firmwareVersion = '1.0.0',
      txPower = -59 
    } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ message: 'Device ID is required' });
    }
    
    // Normalize device ID (uppercase, remove separators)
    const normalizedDeviceId = deviceId.toUpperCase().replace(/[:-]/g, '');
    
    // Check if device already paired with another user
    const existingDevice = await Device.findOne({ 
      deviceId: normalizedDeviceId,
      isActive: true 
    });
    
    if (existingDevice && !existingDevice.userId.equals(req.user._id)) {
      return res.status(409).json({ 
        message: 'This device is already paired with another user',
        deviceId: normalizedDeviceId
      });
    }
    
    // Check if user already has a device
    const userDevice = await Device.findOne({
      userId: req.user._id,
      isActive: true
    });
    
    if (userDevice && userDevice.deviceId !== normalizedDeviceId) {
      return res.status(409).json({
        message: 'You already have a device paired. Please unpair it first.',
        existingDeviceId: userDevice.deviceId
      });
    }
    
    // Generate encrypted ID and encryption key
    const encryptionKey = crypto.randomBytes(16).toString('hex');
    const encryptedId = encryptDeviceId(normalizedDeviceId, encryptionKey);
    
    // Create or update device
    const device = await Device.findOneAndUpdate(
      { deviceId: normalizedDeviceId },
      {
        deviceId: normalizedDeviceId,
        encryptedId,
        userId: req.user._id,
        hardwareModel,
        imuModel,
        firmwareVersion,
        txPower,
        encryptionKey,
        isActive: true,
        lastSeen: new Date(),
        registeredAt: new Date(),
        pairedBy: req.user._id
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true 
      }
    );
    
    res.status(201).json({
      message: 'Device paired successfully',
      device: {
        id: device._id,
        deviceId: device.deviceId,
        encryptedId: device.encryptedId,
        hardwareModel: device.hardwareModel,
        batteryLevel: device.batteryLevel,
        firmwareVersion: device.firmwareVersion,
        registeredAt: device.registeredAt
      }
    });
  } catch (error) {
    console.error('Device pairing error:', error);
    res.status(500).json({ 
      message: 'Error pairing device', 
      error: error.message 
    });
  }
});

// @route   GET /api/devices/my-device
// @desc    Get user's paired device
// @access  Private
router.get('/my-device', requireAuth, async (req, res) => {
  try {
    const device = await Device.findOne({
      userId: req.user._id,
      isActive: true
    }).select('-encryptionKey -__v');
    
    if (!device) {
      return res.status(404).json({ message: 'No device paired' });
    }
    
    // Check if device needs battery replacement
    const needsReplacement = device.needsBatteryReplacement();
    
    res.json({
      device: {
        id: device._id,
        deviceId: device.deviceId,
        encryptedId: device.encryptedId,
        hardwareModel: device.hardwareModel,
        imuModel: device.imuModel,
        batteryLevel: device.batteryLevel,
        batteryHealth: device.batteryHealth,
        batteryVoltage: device.batteryVoltage,
        needsBatteryReplacement,
        firmwareVersion: device.firmwareVersion,
        lastSeen: device.lastSeen,
        isOnline: device.isOnline,
        registeredAt: device.registeredAt,
        suspiciousActivityCount: device.suspiciousActivityCount,
        isSuspended: device.isSuspended
      }
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ 
      message: 'Error fetching device', 
      error: error.message 
    });
  }
});

// @route   PUT /api/devices/:id/battery
// @desc    Update device battery level
// @access  Private
router.put('/:id/battery', requireAuth, async (req, res) => {
  try {
    const { batteryLevel, batteryVoltage } = req.body;
    
    if (batteryLevel === undefined || batteryLevel < 0 || batteryLevel > 100) {
      return res.status(400).json({ message: 'Invalid battery level (0-100)' });
    }
    
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    await device.updateBattery(batteryLevel, batteryVoltage);
    
    res.json({
      message: 'Battery level updated',
      batteryLevel: device.batteryLevel,
      batteryHealth: device.batteryHealth,
      lowBatteryAlert: device.lowBatteryAlertSent
    });
  } catch (error) {
    console.error('Update battery error:', error);
    res.status(500).json({ 
      message: 'Error updating battery', 
      error: error.message 
    });
  }
});

// @route   PUT /api/devices/:id/heartbeat
// @desc    Update device last seen timestamp (heartbeat)
// @access  Private
router.put('/:id/heartbeat', requireAuth, async (req, res) => {
  try {
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    await device.updateLastSeen();
    
    res.json({
      message: 'Device heartbeat updated',
      lastSeen: device.lastSeen,
      isOnline: device.isOnline
    });
  } catch (error) {
    console.error('Update heartbeat error:', error);
    res.status(500).json({ 
      message: 'Error updating heartbeat', 
      error: error.message 
    });
  }
});

// @route   DELETE /api/devices/:id/unpair
// @desc    Unpair device from user account
// @access  Private
router.delete('/:id/unpair', requireAuth, async (req, res) => {
  try {
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    device.isActive = false;
    await device.save();
    
    res.json({
      message: 'Device unpaired successfully',
      deviceId: device.deviceId
    });
  } catch (error) {
    console.error('Unpair device error:', error);
    res.status(500).json({ 
      message: 'Error unpairing device', 
      error: error.message 
    });
  }
});

// @route   GET /api/devices
// @desc    Get all devices (admin only)
// @access  Private (Admin)
router.get('/', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status = 'all', 
      batteryLevel = 'all',
      search = ''
    } = req.query;
    
    // Build query
    const query = {};
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    if (batteryLevel === 'low') {
      query.batteryLevel = { $lt: 20 };
    } else if (batteryLevel === 'critical') {
      query.batteryLevel = { $lt: 10 };
    }
    
    if (search) {
      query.$or = [
        { deviceId: { $regex: search, $options: 'i' } },
        { hardwareModel: { $regex: search, $options: 'i' } }
      ];
    }
    
    const total = await Device.countDocuments(query);
    const devices = await Device.find(query)
      .populate('userId', 'name email rollNumber role')
      .select('-encryptionKey -__v')
      .sort({ lastSeen: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    res.json({
      devices,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ 
      message: 'Error fetching devices', 
      error: error.message 
    });
  }
});

// @route   GET /api/devices/offline
// @desc    Get offline devices (not seen in > 24 hours)
// @access  Private (Admin/Faculty)
router.get('/offline', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const offlineDevices = await Device.findOfflineDevices(parseInt(hours));
    
    res.json({
      devices: offlineDevices,
      count: offlineDevices.length,
      threshold: `${hours} hours`
    });
  } catch (error) {
    console.error('Get offline devices error:', error);
    res.status(500).json({ 
      message: 'Error fetching offline devices', 
      error: error.message 
    });
  }
});

// @route   GET /api/devices/low-battery
// @desc    Get devices with low battery
// @access  Private (Admin/Faculty)
router.get('/low-battery', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
  try {
    const { threshold = 20 } = req.query;
    
    const lowBatteryDevices = await Device.findLowBatteryDevices(parseInt(threshold));
    
    res.json({
      devices: lowBatteryDevices,
      count: lowBatteryDevices.length,
      threshold: `${threshold}%`
    });
  } catch (error) {
    console.error('Get low battery devices error:', error);
    res.status(500).json({ 
      message: 'Error fetching low battery devices', 
      error: error.message 
    });
  }
});

// @route   GET /api/devices/stats
// @desc    Get device statistics (admin dashboard)
// @access  Private (Admin)
router.get('/stats', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const total = await Device.countDocuments({ isActive: true });
    const online = await Device.countDocuments({ 
      isActive: true, 
      isOnline: true 
    });
    const lowBattery = await Device.countDocuments({ 
      isActive: true, 
      batteryLevel: { $lt: 20 } 
    });
    const suspended = await Device.countDocuments({ 
      isActive: true, 
      isSuspended: true 
    });
    
    // Average battery level
    const avgBatteryResult = await Device.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          avgBattery: { $avg: '$batteryLevel' }
        }
      }
    ]);
    
    const avgBattery = avgBatteryResult.length > 0 
      ? Math.round(avgBatteryResult[0].avgBattery) 
      : 0;
    
    // Hardware model distribution
    const modelDistribution = await Device.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$hardwareModel',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      stats: {
        total,
        online,
        offline: total - online,
        lowBattery,
        suspended,
        avgBattery,
        modelDistribution
      }
    });
  } catch (error) {
    console.error('Get device stats error:', error);
    res.status(500).json({ 
      message: 'Error fetching device statistics', 
      error: error.message 
    });
  }
});

// @route   PUT /api/devices/:id/suspend
// @desc    Suspend a device (admin only)
// @access  Private (Admin)
router.put('/:id/suspend', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    
    const device = await Device.findById(req.params.id);
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    device.isSuspended = true;
    device.suspensionReason = reason || 'Suspicious activity detected';
    await device.save();
    
    res.json({
      message: 'Device suspended successfully',
      device: {
        deviceId: device.deviceId,
        isSuspended: device.isSuspended,
        suspensionReason: device.suspensionReason
      }
    });
  } catch (error) {
    console.error('Suspend device error:', error);
    res.status(500).json({ 
      message: 'Error suspending device', 
      error: error.message 
    });
  }
});

// @route   PUT /api/devices/:id/unsuspend
// @desc    Unsuspend a device (admin only)
// @access  Private (Admin)
router.put('/:id/unsuspend', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    device.isSuspended = false;
    device.suspensionReason = null;
    device.suspiciousActivityCount = 0; // Reset counter
    await device.save();
    
    res.json({
      message: 'Device unsuspended successfully',
      device: {
        deviceId: device.deviceId,
        isSuspended: device.isSuspended
      }
    });
  } catch (error) {
    console.error('Unsuspend device error:', error);
    res.status(500).json({ 
      message: 'Error unsuspending device', 
      error: error.message 
    });
  }
});

module.exports = router;
