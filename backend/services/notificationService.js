// Notification Service - handles automated notifications
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * Send absent alert to parents when student is marked absent
 */
async function sendAbsentAlert(attendance) {
  try {
    const student = await Student.findById(attendance.studentId).populate('parentIds');
    if (!student || !student.parentIds || student.parentIds.length === 0) {
      console.log('No parent found for student:', student?.name);
      return;
    }
    
    const session = await Session.findById(attendance.sessionId);
    const dateStr = new Date(attendance.date).toLocaleDateString();
    
    const title = `${student.name} Marked Absent`;
    const message = `Your child ${student.name} (Roll: ${student.rollNumber}) was marked absent on ${dateStr}${session ? ' for ' + session.subject : ''}.`;
    
    // Send to all parents
    for (const parent of student.parentIds) {
      await Notification.createAndSend(
        parent._id,
        'absent_alert',
        title,
        message,
        {
          studentId: student._id,
          attendanceId: attendance._id,
          sessionId: attendance.sessionId,
          date: attendance.date
        },
        ['app', 'sms'] // Send via app and SMS
      );
    }
    
    console.log(`Absent alert sent to ${student.parentIds.length} parent(s) for ${student.name}`);
  } catch (error) {
    console.error('Error sending absent alert:', error);
  }
}

/**
 * Send late arrival alert to parents
 */
async function sendLateAlert(attendance) {
  try {
    const student = await Student.findById(attendance.studentId).populate('parentIds');
    if (!student || !student.parentIds || student.parentIds.length === 0) {
      return;
    }
    
    const session = await Session.findById(attendance.sessionId);
    const dateStr = new Date(attendance.date).toLocaleDateString();
    const timeStr = attendance.entryTime ? new Date(attendance.entryTime).toLocaleTimeString() : '';
    
    const title = `${student.name} Arrived Late`;
    const message = `Your child ${student.name} (Roll: ${student.rollNumber}) arrived late on ${dateStr} at ${timeStr}${session ? ' for ' + session.subject : ''}.`;
    
    for (const parent of student.parentIds) {
      await Notification.createAndSend(
        parent._id,
        'late_alert',
        title,
        message,
        {
          studentId: student._id,
          attendanceId: attendance._id,
          sessionId: attendance.sessionId,
          date: attendance.date,
          entryTime: attendance.entryTime
        },
        ['app', 'sms']
      );
    }
    
    console.log(`Late alert sent to ${student.parentIds.length} parent(s) for ${student.name}`);
  } catch (error) {
    console.error('Error sending late alert:', error);
  }
}

/**
 * Send attendance marked confirmation
 */
async function sendAttendanceMarkedAlert(attendance) {
  try {
    const student = await Student.findById(attendance.studentId).populate('parentIds');
    if (!student || !student.parentIds || student.parentIds.length === 0) {
      return;
    }
    
    const session = await Session.findById(attendance.sessionId);
    const dateStr = new Date(attendance.date).toLocaleDateString();
    
    const title = `Attendance Marked for ${student.name}`;
    const message = `${student.name} (Roll: ${student.rollNumber}) was marked ${attendance.status} on ${dateStr}${session ? ' for ' + session.subject : ''}.`;
    
    for (const parent of student.parentIds) {
      await Notification.createAndSend(
        parent._id,
        'attendance_marked',
        title,
        message,
        {
          studentId: student._id,
          attendanceId: attendance._id,
          status: attendance.status,
          sessionId: attendance.sessionId,
          date: attendance.date
        },
        ['app']
      );
    }
  } catch (error) {
    console.error('Error sending attendance marked alert:', error);
  }
}

/**
 * Check for low attendance and send alerts
 * Run this daily or weekly
 */
async function checkAndSendLowAttendanceAlerts(threshold = 75) {
  try {
    const students = await Student.find().populate('parentIds');
    
    for (const student of students) {
      // Calculate attendance percentage for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const records = await Attendance.find({
        studentId: student._id,
        date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
      });
      
      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const percentage = total > 0 ? (present / total) * 100 : 100;
      
      if (percentage < threshold && student.parentIds && student.parentIds.length > 0) {
        const title = `Low Attendance Alert - ${student.name}`;
        const message = `${student.name}'s attendance is ${percentage.toFixed(2)}% (last 30 days), which is below the required ${threshold}%. Present: ${present}/${total} days.`;
        
        for (const parent of student.parentIds) {
          await Notification.createAndSend(
            parent._id,
            'low_attendance',
            title,
            message,
            {
              studentId: student._id,
              percentage: percentage.toFixed(2),
              threshold,
              present,
              total,
              period: '30 days'
            },
            ['app', 'sms']
          );
        }
        
        console.log(`Low attendance alert sent for ${student.name}: ${percentage.toFixed(2)}%`);
      }
    }
  } catch (error) {
    console.error('Error checking low attendance:', error);
  }
}

/**
 * Batch send absent alerts for a session
 * Call this after a session ends to notify all absent students' parents
 */
async function sendBatchAbsentAlerts(sessionId) {
  try {
    const session = await Session.findById(sessionId).populate('classId');
    if (!session) return;
    
    const students = await Student.find({ classId: session.classId._id }).populate('parentIds');
    const attendance = await Attendance.find({ sessionId });
    
    const presentStudentIds = attendance
      .filter(a => a.status === 'present')
      .map(a => a.studentId.toString());
    
    const absentStudents = students.filter(s => !presentStudentIds.includes(s._id.toString()));
    
    for (const student of absentStudents) {
      if (!student.parentIds || student.parentIds.length === 0) continue;
      
      const dateStr = new Date(session.date).toLocaleDateString();
      const title = `${student.name} Absent from ${session.subject}`;
      const message = `${student.name} (Roll: ${student.rollNumber}) was absent from ${session.subject} class on ${dateStr}.`;
      
      for (const parent of student.parentIds) {
        await Notification.createAndSend(
          parent._id,
          'absent_alert',
          title,
          message,
          {
            studentId: student._id,
            sessionId: session._id,
            date: session.date,
            subject: session.subject
          },
          ['app', 'sms']
        );
      }
    }
    
    console.log(`Batch absent alerts sent for ${absentStudents.length} students in session ${sessionId}`);
  } catch (error) {
    console.error('Error sending batch absent alerts:', error);
  }
}

module.exports = {
  sendAbsentAlert,
  sendLateAlert,
  sendAttendanceMarkedAlert,
  checkAndSendLowAttendanceAlerts,
  sendBatchAbsentAlerts
};
