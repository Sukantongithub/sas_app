const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Staff = require('../models/Staff');
const User = require('../models/User');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');

const STAFF_ROLES = ['super_admin', 'admin', 'hod', 'faculty', 'teacher', 'staff'];

// Allow staff roles, student self, and parent linked to the requested student.
const requireStudentAttendanceAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const targetStudentId = String(req.params.studentId || req.body.studentId || '').trim();
    if (!targetStudentId) {
      return res.status(400).json({ message: 'studentId is required' });
    }

    if (STAFF_ROLES.includes(req.user.role)) {
      return next();
    }

    if (req.user.role === 'student') {
      const userIdStr = String(req.user._id);
      const userStudentIdStr = req.user.studentId ? String(req.user.studentId._id || req.user.studentId) : null;
      if (targetStudentId === userIdStr || (userStudentIdStr && targetStudentId === userStudentIdStr)) {
        return next();
      }
      return res.status(403).json({ message: 'Forbidden: insufficient permission' });
    }

    if (req.user.role === 'parent') {
      let student = await Student.findById(targetStudentId).select('_id parentIds userId');
      if (!student) {
        student = await Student.findOne({ userId: targetStudentId }).select('_id parentIds userId');
      }

      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      const isLinkedParent = Array.isArray(student.parentIds)
        && student.parentIds.some((pid) => String(pid) === String(req.user._id));

      if (!isLinkedParent) {
        return res.status(403).json({ message: 'Forbidden: insufficient permission' });
      }

      // Normalize downstream handlers to always query by Student._id.
      req.params.studentId = String(student._id);
      return next();
    }

    return res.status(403).json({ message: 'Forbidden: insufficient permission' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Enforce period-specific access: verify faculty can only mark attendance during their assigned timetable periods for the class.
const requirePeriodSpecificAccess = async (req, res, next) => {
  try {
    // Only enforce for non-admin roles (admin can mark anytime)
    if (['super_admin', 'admin'].includes(req.user.role)) {
      return next();
    }

    // Get classId from request
    const classId = String(req.body.classId || '').trim();
    if (!classId) {
      return res.status(400).json({ 
        message: 'classId is required for attendance marking',
        code: 'MISSING_CLASS_ID'
      });
    }

    // Get staff record for the logged-in user
    const staff = await Staff.findOne({ userId: req.user._id }).select('_id assignedClassIds employeeId');
    if (!staff) {
      return res.status(403).json({ 
        message: 'Unauthorized: staff member record not found',
        code: 'STAFF_NOT_FOUND'
      });
    }

    // Verify class is assigned to this staff
    const isClassAssigned = staff.assignedClassIds.some(
      (acId) => String(acId) === String(classId)
    );
    
    if (!isClassAssigned) {
      return res.status(403).json({ 
        message: 'Forbidden: this class is not assigned to your timetable',
        code: 'CLASS_NOT_ASSIGNED',
        details: {
          staffId: staff._id,
          requestedClassId: classId,
          assignedClasses: staff.assignedClassIds.length,
          hint: 'Contact your HOD to be assigned to this class'
        }
      });
    }

    // Get the marking date (from request body)
    const markingDate = new Date(req.body.date || new Date());
    const dateStr = markingDate.toISOString().split('T')[0];
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      markingDate.getDay()
    ];

    // Get timetable for this class on this day
    const timetable = await Timetable.findOne({
      classId,
      dayOfWeek,
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }]
    });

    if (!timetable || !timetable.periods || timetable.periods.length === 0) {
      return res.status(403).json({ 
        message: 'Forbidden: no active timetable found for this class on this day',
        code: 'NO_TIMETABLE',
        details: {
          classId,
          date: dateStr,
          dayOfWeek,
          hint: 'Contact your HOD to set up the timetable for this class'
        }
      });
    }

    // Verify this faculty teaches any period in the timetable
    const facultyTeachesToday = timetable.periods.some(
      (period) => String(period.teacherId) === String(req.user._id)
    );

    if (!facultyTeachesToday) {
      const teacherIds = timetable.periods.map(p => p.teacherId).filter(Boolean);
      return res.status(403).json({ 
        message: 'Forbidden: you are not assigned to teach this class on this day',
        code: 'NOT_SCHEDULED_TODAY',
        details: {
          classId,
          date: dateStr,
          dayOfWeek,
          scheduledTeachers: teacherIds.length,
          hint: 'Check your timetable or contact your HOD'
        }
      });
    }

    // Get current time for time window check
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Find the faculty's assigned periods for today and check time windows
    const facultyPeriods = timetable.periods.filter(
      (period) => String(period.teacherId) === String(req.user._id)
    );

    // Check if current time is within 15 minutes before or 30 minutes after any of the faculty's periods
    const isWithinTimeWindow = facultyPeriods.some((period) => {
      const [startHour, startMin] = period.startTime.split(':').map(Number);
      const [endHour, endMin] = period.endTime.split(':').map(Number);

      const periodStartMinutes = startHour * 60 + startMin;
      const periodEndMinutes = endHour * 60 + endMin;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Allow marking 15 minutes before period start through 30 minutes after period end
      const windowStart = periodStartMinutes - 15;
      const windowEnd = periodEndMinutes + 30;

      return currentMinutes >= windowStart && currentMinutes <= windowEnd;
    });

    if (!isWithinTimeWindow) {
      const periodTimes = facultyPeriods
        .map((p) => `${p.periodNumber}: ${p.startTime}-${p.endTime}`)
        .join(', ');
      
      return res.status(403).json({ 
        message: 'Forbidden: attendance marking is only allowed during your scheduled periods',
        code: 'OUTSIDE_PERIOD_TIME',
        details: {
          classId,
          date: dateStr,
          dayOfWeek,
          currentTime: currentTimeStr,
          scheduledPeriods: periodTimes,
          allowedWindow: '15 min before to 30 min after period',
          hint: 'Please mark attendance during your assigned teaching time'
        }
      });
    }

    // All checks passed - attach audit info to request for logging
    req.markingContext = {
      staffId: staff._id,
      classId,
      date: dateStr,
      facultyCode: `${dayOfWeek.toUpperCase()}-${facultyPeriods.map(p => p.periodNumber).join(',')}`,
      timestamp: new Date()
    };

    return next();
  } catch (error) {
    console.error('Period-specific access validation error:', error);
    return res.status(500).json({ 
      message: 'Error validating period-specific access',
      code: 'VALIDATION_ERROR',
      error: error.message 
    });
  }
};

// Get all attendance records
router.get('/', requireAuth, requireRoles('super_admin', 'admin', 'hod', 'faculty', 'teacher', 'staff'), async (req, res) => {
  try {
    const { date, studentId } = req.query;
    let query = {};
    
    if (date) query.date = date;
    if (studentId) query.studentId = studentId;

    const records = await Attendance.find(query)
      .populate('studentId', 'name rollNumber class')
      .sort({ date: -1, markedAt: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get today's attendance
router.get('/today', requireAuth, requireRoles('super_admin', 'admin', 'hod', 'faculty', 'teacher', 'staff'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({ date: today })
      .populate('studentId', 'name rollNumber class')
      .sort({ markedAt: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get student's attendance history

    const getFallbackSessionId = async ({ classId, date, userId, subject = 'General Attendance' }) => {
      const targetDate = new Date(date).toISOString().split('T')[0];
      let session = await Session.findOne({ classId, date: targetDate });

      if (!session) {
        const startTime = new Date(`${targetDate}T00:00:00.000Z`);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

        session = await Session.create({
          classId,
          facultyId: userId,
          subject,
          sessionType: 'other',
          date: targetDate,
          startTime,
          endTime,
          isActive: false,
          createdBy: userId,
        });
      }

      return session._id;
    };
router.get('/student/:studentId', requireAuth, requireStudentAttendanceAccess, async (req, res) => {
  try {
    const records = await Attendance.find({ studentId: req.params.studentId })
      .sort({ date: -1 });
    
    // Calculate statistics
    const totalClasses = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const percentage = totalClasses > 0 ? (present / totalClasses) * 100 : 0;

    res.json({
      records,
      stats: {
        totalClasses,
        present,
        absent,
        late,
        percentage: parseFloat(percentage.toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/student/:studentId/daily
// @desc    Get student's daily attendance status
// @access  Private (Student can view own, others as per auth)
router.get('/student/:studentId/daily', requireAuth, requireStudentAttendanceAccess, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const records = await Attendance.find({ 
      studentId: req.params.studentId,
      date: targetDate 
    })
      .populate('sessionId', 'subject startTime endTime periodNumber')
      .sort({ entryTime: 1 });
    
    res.json({
      date: targetDate,
      records,
      summary: {
        totalPeriods: records.length,
        present: records.filter(r => r.status === 'present').length,
        absent: records.filter(r => r.status === 'absent').length,
        late: records.filter(r => r.status === 'late').length
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/student/:studentId/subject-wise
// @desc    Get subject/period-wise attendance for a student
// @access  Private (Student can view own, others as per auth)
router.get('/student/:studentId/subject-wise', requireAuth, requireStudentAttendanceAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = { studentId: req.params.studentId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    const records = await Attendance.find(query)
      .populate('sessionId', 'subject startTime endTime periodNumber')
      .sort({ date: -1 });
    
    // Group by subject
    const subjectStats = {};
    records.forEach(record => {
      if (!record.sessionId) return;
      
      const subject = record.sessionId.subject || 'Unknown';
      if (!subjectStats[subject]) {
        subjectStats[subject] = {
          subject,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          percentage: 0
        };
      }
      
      subjectStats[subject].total++;
      if (record.status === 'present') subjectStats[subject].present++;
      if (record.status === 'absent') subjectStats[subject].absent++;
      if (record.status === 'late') subjectStats[subject].late++;
    });
    
    // Calculate percentages
    Object.values(subjectStats).forEach(stat => {
      stat.percentage = stat.total > 0 ? parseFloat(((stat.present / stat.total) * 100).toFixed(2)) : 0;
    });
    
    res.json({
      subjectWise: Object.values(subjectStats),
      records
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/student/:studentId/monthly
// @desc    Get monthly attendance percentage for a student
// @access  Private (Student can view own, others as per auth)
router.get('/student/:studentId/monthly', requireAuth, requireStudentAttendanceAccess, async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    
    // Create date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);
    
    const records = await Attendance.find({
      studentId: req.params.studentId,
      date: {
        $gte: startDate.toISOString().split('T')[0],
        $lte: endDate.toISOString().split('T')[0]
      }
    })
      .populate('sessionId', 'subject')
      .sort({ date: 1 });
    
    // Group by date
    const dailyStats = {};
    records.forEach(record => {
      const dateStr = record.date;
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = {
          date: dateStr,
          total: 0,
          present: 0,
          absent: 0,
          late: 0
        };
      }
      
      dailyStats[dateStr].total++;
      if (record.status === 'present') dailyStats[dateStr].present++;
      if (record.status === 'absent') dailyStats[dateStr].absent++;
      if (record.status === 'late') dailyStats[dateStr].late++;
    });
    
    // Calculate overall monthly stats
    const totalClasses = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const percentage = totalClasses > 0 ? parseFloat(((presentCount / totalClasses) * 100).toFixed(2)) : 0;
    
    res.json({
      month: targetMonth,
      year: targetYear,
      monthlyStats: {
        totalClasses,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        percentage
      },
      dailyBreakdown: Object.values(dailyStats),
      records
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/student/:studentId/time-records
// @desc    Get in-time and out-time records for a student
// @access  Private (Student can view own, others as per auth)
router.get('/student/:studentId/time-records', requireAuth, requireStudentAttendanceAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = { studentId: req.params.studentId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    const records = await Attendance.find(query)
      .populate('sessionId', 'subject startTime endTime')
      .sort({ date: -1, entryTime: -1 });
    
    // Format time records
    const timeRecords = records.map(record => ({
      _id: record._id,
      date: record.date,
      subject: record.sessionId ? record.sessionId.subject : 'N/A',
      scheduledStart: record.sessionId ? record.sessionId.startTime : null,
      scheduledEnd: record.sessionId ? record.sessionId.endTime : null,
      entryTime: record.entryTime,
      exitTime: record.exitTime,
      duration: record.duration,
      status: record.status,
      verificationMethod: record.verificationMethod
    }));
    
    res.json({
      records: timeRecords,
      totalRecords: timeRecords.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/staff/:staffId/unmarked-students
// @desc    Get all unmarked students in staff's assigned classes for today
// @access  Private (Staff, HOD, Admin - can view own or all)
router.get('/staff/:staffId/unmarked-students', requireAuth, requireRoles('super_admin', 'admin', 'hod', 'faculty', 'teacher', 'staff'), async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Find staff member
    const staff = await Staff.findOne({ userId: req.params.staffId })
      .populate('assignedClassIds', 'name students');
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Get all students from assigned classes
    const allStudentIds = [];
    const classDetails = [];
    
    for (const cls of staff.assignedClassIds) {
      classDetails.push({
        classId: cls._id,
        className: cls.name,
        studentCount: cls.students?.length || 0
      });
      allStudentIds.push(...(cls.students || []));
    }

    // Get unique student IDs
    const uniqueStudentIds = [...new Set(allStudentIds.map(id => id.toString()))];

    // Get attendance records for today
    const attendanceRecords = await Attendance.find({
      studentId: { $in: uniqueStudentIds },
      date: targetDate
    })
      .select('studentId status');

    // Find marked students
    const markedStudentIds = new Set(attendanceRecords.map(r => r.studentId.toString()));

    // Find unmarked students
    const unmarkedStudentIds = uniqueStudentIds.filter(id => !markedStudentIds.has(id));

    // Fetch unmarked student details from Student collection
    const unmarkedStudents = await Student.find({
      _id: { $in: unmarkedStudentIds }
    })
      .select('_id name rollNumber email class section classId')
      .sort({ rollNumber: 1 });

    // Group by class for better organization
    const studentsByClass = {};
    for (const cls of staff.assignedClassIds) {
      studentsByClass[cls.name] = unmarkedStudents.filter(student => 
        cls.students?.some(s => s.toString() === student._id.toString())
      );
    }

    res.json({
      status: 'success',
      date: targetDate,
      staffInfo: {
        staffId: staff._id,
        employeeId: staff.employeeId,
        department: staff.department,
        assignedClasses: staff.assignedClassIds.length
      },
      summary: {
        totalStudents: uniqueStudentIds.length,
        markedCount: markedStudentIds.size,
        unmarkedCount: unmarkedStudentIds.length,
        unmarkedPercentage: uniqueStudentIds.length > 0 
          ? ((unmarkedStudentIds.length / uniqueStudentIds.length) * 100).toFixed(2) 
          : 0
      },
      classes: classDetails,
      unmarkedStudents,
      studentsByClass
    });

  } catch (error) {
    console.error('Error fetching unmarked students:', error);
    res.status(500).json({ 
      message: 'Error fetching unmarked students',
      error: error.message 
    });
  }
});

// Mark attendance (create or update)
router.post('/', requireAuth, requireRoles('super_admin', 'admin', 'hod', 'faculty', 'teacher', 'staff'), requirePeriodSpecificAccess, async (req, res) => {
  try {
    const { studentId, date, status, remarks, classId, sessionId, entryTime } = req.body;

    // Validate required fields
    if (!studentId || !date || !status) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['studentId', 'date', 'status']
      });
    }

    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // If classId not provided, try to get it from student's class
    let finalClassId = classId;
    if (!finalClassId) {
      const classByName = await Class.findOne({ name: student.class });
      if (classByName) {
        finalClassId = classByName._id;
      }
    }

    // If classId still not available, return error
    if (!finalClassId) {
      return res.status(400).json({ 
        message: 'classId is required or student must have a valid class assigned',
        hint: 'Either provide classId in request body or ensure student has a class assigned'
      });
    }

    // Normalize date to date-only format (YYYY-MM-DD)
    const dateStr = new Date(date).toISOString().split('T')[0];

    // Get timetable period info for audit trail
    const markingDate = new Date(date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      markingDate.getDay()
    ];
    
    let periodInfo = null;
    const timetable = await Timetable.findOne({
      classId: finalClassId,
      dayOfWeek,
      isActive: true
    });

    if (timetable && timetable.periods && timetable.periods.length > 0) {
      const facultyPeriod = timetable.periods.find(
        (period) => String(period.teacherId) === String(req.user._id)
      );
      if (facultyPeriod) {
        periodInfo = {
          timetableId: timetable._id,
          periodNumber: facultyPeriod.periodNumber,
          dayOfWeek,
          scheduledStartTime: facultyPeriod.startTime,
          scheduledEndTime: facultyPeriod.endTime
        };
      }
    }

    // Check if attendance already exists for this student and date
    let attendance = await Attendance.findOne({ 
      studentId, 
      date: dateStr 
    });

    if (attendance) {
      // Update existing attendance
      attendance.status = status;
      attendance.remarks = remarks || attendance.remarks;
      attendance.verificationMethod = 'manual';
      attendance.markedAt = new Date();
      attendance.markedBy = req.user._id;
      if (periodInfo) {
        attendance.periodInfo = periodInfo;
      }

      if (!attendance.sessionId) {
        attendance.sessionId = await getFallbackSessionId({
          classId: finalClassId,
          date: dateStr,
          userId: req.user._id,
        });
      }
      
      await attendance.save();
      return res.json({
        status: 'success',
        message: 'Attendance updated successfully',
        data: attendance,
        audit: req.markingContext // Include audit context in response
      });
    } else {
      // Create new attendance record
      const resolvedSessionId = sessionId || await getFallbackSessionId({
        classId: finalClassId,
        date: dateStr,
        userId: req.user._id,
      });

      attendance = new Attendance({
        studentId,
        classId: finalClassId,
        sessionId: resolvedSessionId,
        date: dateStr,
        status,
        remarks,
        entryTime: entryTime ? new Date(entryTime) : new Date(),
        exitTime: null,
        verificationMethod: 'manual',
        markedBy: req.user._id,
        markedAt: new Date(),
        periodInfo: periodInfo // Include period audit info
      });

      const newAttendance = await attendance.save();
      return res.status(201).json({
        status: 'success',
        message: 'Attendance marked successfully',
        data: newAttendance,
        audit: req.markingContext // Include audit context in response
      });
    }
  } catch (error) {
    console.error('Attendance marking error:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error marking attendance',
      error: error.message 
    });
  }
});

// Mark attendance for multiple students
router.post('/bulk', requireAuth, requireRoles('super_admin', 'admin', 'hod', 'faculty', 'teacher', 'staff'), requirePeriodSpecificAccess, async (req, res) => {
  try {
    const { records, classId, sessionId } = req.body; // Array of { studentId, date, status, remarks, classId (optional) }
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ 
        message: 'Invalid request format',
        hint: 'Expected: { records: [{studentId, date, status, remarks}, ...], classId: "optional" }'
      });
    }

    const results = [];
    const errors = [];

    for (const record of records) {
      try {
        const { studentId, date, status, remarks } = record;
        
        if (!studentId || !date || !status) {
          errors.push({ record, error: 'Missing required fields: studentId, date, status' });
          continue;
        }

        // Get student to verify existence and get class if needed
        const student = await Student.findById(studentId);
        if (!student) {
          errors.push({ record, error: `Student not found: ${studentId}` });
          continue;
        }

        // Determine classId
        let finalClassId = record.classId || classId;
        if (!finalClassId && student.class) {
          const classByName = await Class.findOne({ name: student.class });
          if (classByName) {
            finalClassId = classByName._id;
          }
        }

        if (!finalClassId) {
          errors.push({ record, error: 'classId required but not provided and student has no class assigned' });
          continue;
        }

        // Normalize date to date-only format
        const dateStr = new Date(date).toISOString().split('T')[0];

        let attendance = await Attendance.findOne({ studentId, date: dateStr });
        
        if (attendance) {
          // Update existing
          attendance.status = status;
          attendance.remarks = remarks || attendance.remarks;
          attendance.verificationMethod = 'manual';
          attendance.markedAt = new Date();
          attendance.markedBy = req.user._id;
          if (!attendance.sessionId) {
            attendance.sessionId = await getFallbackSessionId({
              classId: finalClassId,
              date: dateStr,
              userId: req.user._id,
            });
          }
          const updated = await attendance.save();
          results.push({ status: 'updated', data: updated });
        } else {
          // Create new
          const newAttendance = new Attendance({
            studentId,
            classId: finalClassId,
            sessionId: record.sessionId || sessionId || await getFallbackSessionId({
              classId: finalClassId,
              date: dateStr,
              userId: req.user._id,
            }),
            date: dateStr,
            status,
            remarks,
            entryTime: new Date(),
            verificationMethod: 'manual',
            markedBy: req.user._id,
            markedAt: new Date()
          });

          const created = await newAttendance.save();
          results.push({ status: 'created', data: created });
        }
      } catch (error) {
        errors.push({ record, error: error.message });
      }
    }

    res.status(201).json({
      status: 'completed',
      message: `Processed ${records.length} records: ${results.length} successful, ${errors.length} failed`,
      summary: {
        total: records.length,
        successful: results.length,
        failed: errors.length,
        created: results.filter(r => r.status === 'created').length,
        updated: results.filter(r => r.status === 'updated').length
      },
      results,
      errors: errors.length > 0 ? errors : undefined,
      audit: req.markingContext // Include audit context in response
    });
  } catch (error) {
    console.error('Bulk attendance marking error:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error marking attendance in bulk',
      error: error.message 
    });
  }
});

// Delete attendance record
router.delete('/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get attendance statistics for all students
router.get('/stats/all', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
  try {
    const students = await Student.find();
    
    const statsPromises = students.map(async (student) => {
      const records = await Attendance.find({ studentId: student._id });
      const totalClasses = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const late = records.filter(r => r.status === 'late').length;
      const percentage = totalClasses > 0 ? (present / totalClasses) * 100 : 0;

      return {
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.class
        },
        stats: {
          totalClasses,
          present,
          absent,
          late,
          percentage: parseFloat(percentage.toFixed(2))
        }
      };
    });

    const allStats = await Promise.all(statsPromises);
    res.json(allStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/summary/daily
// @desc    Get daily attendance summary
// @access  Private (Teacher/Admin)
router.get('/summary/daily', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { date, classId, section } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    let studentQuery = {};
    if (classId) studentQuery.classId = classId;
    if (section) studentQuery.section = section;
    
    const students = await Student.find(studentQuery);
    const totalStudents = students.length;
    
    const attendanceQuery = { date: dateStr };
    if (classId) {
      const studentIds = students.map(s => s._id);
      attendanceQuery.studentId = { $in: studentIds };
    }
    
    const records = await Attendance.find(attendanceQuery)
      .populate('studentId', 'name rollNumber class section');
    
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const unmarkedCount = totalStudents - records.length;
    
    const presentStudents = records.filter(r => r.status === 'present').map(r => r.studentId);
    const absentStudents = records.filter(r => r.status === 'absent').map(r => r.studentId);
    const lateStudents = records.filter(r => r.status === 'late').map(r => r.studentId);
    
    const markedStudentIds = records.map(r => r.studentId._id.toString());
    const unmarkedStudents = students
      .filter(s => !markedStudentIds.includes(s._id.toString()))
      .map(s => ({ _id: s._id, name: s.name, rollNumber: s.rollNumber, class: s.class, section: s.section }));
    
    res.json({
      date: dateStr,
      summary: {
        total: totalStudents,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        unmarked: unmarkedCount,
        attendancePercentage: totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(2) : 0
      },
      details: {
        presentStudents,
        absentStudents,
        lateStudents,
        unmarkedStudents
      }
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/late-arrivals
// @desc    Get late arrival records with analysis
// @access  Private (Teacher/Admin)
router.get('/late-arrivals', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { startDate, endDate, studentId, classId } = req.query;
    
    let query = { status: 'late' };
    if (studentId) query.studentId = studentId;
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    const lateRecords = await Attendance.find(query)
      .populate('studentId', 'name rollNumber class section email')
      .populate('sessionId', 'subject startTime')
      .sort({ date: -1, entryTime: -1 });
    
    // Calculate late duration for each record
    const enrichedRecords = lateRecords.map(record => {
      let lateDuration = null;
      if (record.sessionId && record.sessionId.startTime && record.entryTime) {
        const sessionStart = new Date(record.date);
        const [hours, minutes] = record.sessionId.startTime.split(':');
        sessionStart.setHours(parseInt(hours), parseInt(minutes), 0);
        
        const entry = new Date(record.entryTime);
        lateDuration = Math.floor((entry - sessionStart) / (1000 * 60)); // minutes
      }
      
      return {
        ...record.toObject(),
        lateDuration
      };
    });
    
    // Group by student for summary
    const studentSummary = {};
    enrichedRecords.forEach(record => {
      const studentId = record.studentId._id.toString();
      if (!studentSummary[studentId]) {
        studentSummary[studentId] = {
          student: record.studentId,
          lateCount: 0,
          totalLateMinutes: 0,
          records: []
        };
      }
      studentSummary[studentId].lateCount++;
      if (record.lateDuration) {
        studentSummary[studentId].totalLateMinutes += record.lateDuration;
      }
      studentSummary[studentId].records.push(record);
    });
    
    res.json({
      records: enrichedRecords,
      summary: Object.values(studentSummary)
    });
  } catch (error) {
    console.error('Late arrivals error:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/by-class/:classId
// @desc    Get attendance filtered by class and section
// @access  Private (Teacher/Admin)
router.get('/by-class/:classId', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { section, startDate, endDate } = req.query;
    
    let studentQuery = { classId: req.params.classId };
    if (section) studentQuery.section = section;
    
    const students = await Student.find(studentQuery);
    const studentIds = students.map(s => s._id);
    
    let attendanceQuery = { studentId: { $in: studentIds } };
    if (startDate || endDate) {
      attendanceQuery.date = {};
      if (startDate) attendanceQuery.date.$gte = startDate;
      if (endDate) attendanceQuery.date.$lte = endDate;
    }
    
    const records = await Attendance.find(attendanceQuery)
      .populate('studentId', 'name rollNumber class section')
      .populate('sessionId', 'subject date startTime endTime')
      .sort({ date: -1 });
    
    res.json({
      students,
      records,
      totalStudents: students.length,
      totalRecords: records.length
    });
  } catch (error) {
    console.error('Get class attendance error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// STUDENT FEATURES: TIMETABLE & REPORTS
// ============================================

// @route   GET /api/attendance/student/:studentId/timetable
// @desc    Get student's timetable
// @access  Private (Student, Teacher, Admin)
router.get('/student/:studentId/timetable', requireAuth, requireSelfOrRoles(['student', 'teacher', 'admin']), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Try to find student by _id first, then by userId (in case frontend passes user.id)
    let student = await Student.findById(studentId).populate('classId');
    
    if (!student) {
      // If not found by _id, try looking up by userId
      student = await Student.findOne({ userId: studentId }).populate('classId');
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found. Please ensure you are logged in as a student.' });
    }

    // Get class information - either from classId reference or class name string
    let classDoc = student.classId;
    
    if (!classDoc && student.class) {
      // If classId reference doesn't exist, find by class name
      classDoc = await Class.findOne({ name: student.class });
    }

    if (!classDoc) {
      return res.json({
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.class,
        },
        timetable: {},
        totalPeriods: 0,
      });
    }

    // Get all timetable entries for this class
    const timetableEntries = await Timetable.find({ 
      classId: classDoc._id,
      isActive: true
    }).populate('periods.teacherId', 'name email');

    // Group by day (capitalize day names for frontend)
    const groupedTimetable = {};
    const dayMapping = {
      'monday': 'Monday',
      'tuesday': 'Tuesday',
      'wednesday': 'Wednesday',
      'thursday': 'Thursday',
      'friday': 'Friday',
      'saturday': 'Saturday',
      'sunday': 'Sunday'
    };

    // Initialize all days
    Object.values(dayMapping).forEach(day => {
      groupedTimetable[day] = [];
    });

    // Process each timetable entry and flatten periods
    let totalPeriods = 0;
    timetableEntries.forEach(entry => {
      const dayName = dayMapping[entry.dayOfWeek] || entry.dayOfWeek;
      if (entry.periods && Array.isArray(entry.periods)) {
        entry.periods.forEach(period => {
          groupedTimetable[dayName].push({
            periodNumber: period.periodNumber,
            subject: period.subject,
            startTime: period.startTime,
            endTime: period.endTime,
            room: period.room,
            isLab: period.isLab,
            teacherId: period.teacherId,
            period: period.periodNumber // For compatibility with frontend
          });
          totalPeriods += 1;
        });
      }
    });

    res.json({
      student: {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        class: student.class,
      },
      timetable: groupedTimetable,
      totalPeriods: totalPeriods,
    });
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ message: 'Error fetching timetable', error: error.message });
  }
});

// @route   GET /api/attendance/student/:studentId/report
// @desc    Generate attendance report (CSV format)
// @access  Private (Student, Teacher, Admin)
router.get('/student/:studentId/report', requireAuth, requireSelfOrRoles(['student', 'teacher', 'admin']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { format = 'csv' } = req.query; // csv or json

    // Get student details
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get attendance records
    const records = await Attendance.find({ studentId })
      .populate('sessionId', 'subject period')
      .sort({ date: 1 });

    // Calculate statistics
    const totalClasses = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const attendancePercentage = totalClasses > 0 ? ((presentCount / totalClasses) * 100).toFixed(2) : 0;

    // Subject-wise attendance
    const subjectWiseData = {};
    records.forEach(record => {
      const subject = record.sessionId?.subject || 'Unknown';
      if (!subjectWiseData[subject]) {
        subjectWiseData[subject] = { total: 0, present: 0, absent: 0, late: 0 };
      }
      subjectWiseData[subject].total++;
      if (record.status === 'present') subjectWiseData[subject].present++;
      else if (record.status === 'absent') subjectWiseData[subject].absent++;
      else if (record.status === 'late') subjectWiseData[subject].late++;
    });

    // Calculate subject percentages
    const subjectPercentages = {};
    Object.keys(subjectWiseData).forEach(subject => {
      const data = subjectWiseData[subject];
      subjectPercentages[subject] = {
        ...data,
        percentage: data.total > 0 ? ((data.present / data.total) * 100).toFixed(2) : 0,
      };
    });

    const reportData = {
      studentDetails: {
        name: student.name,
        rollNumber: student.rollNumber,
        email: student.email,
        phone: student.phone,
        class: student.class,
        generatedDate: new Date().toISOString().split('T')[0],
      },
      summary: {
        totalClasses,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        attendancePercentage: parseFloat(attendancePercentage),
      },
      subjectWiseAttendance: subjectPercentages,
      detailedRecords: records.map(r => ({
        date: r.date,
        subject: r.sessionId?.subject || 'N/A',
        status: r.status,
        markedAt: r.markedAt,
        remarks: r.remarks || '',
      })),
    };

    if (format === 'json') {
      return res.json(reportData);
    }

    // Generate CSV format
    let csv = 'ATTENDANCE REPORT\n';
    csv += `Student Name: ${reportData.studentDetails.name}\n`;
    csv += `Roll Number: ${reportData.studentDetails.rollNumber}\n`;
    csv += `Email: ${reportData.studentDetails.email}\n`;
    csv += `Class: ${reportData.studentDetails.class}\n`;
    csv += `Generated: ${reportData.studentDetails.generatedDate}\n\n`;

    csv += 'ATTENDANCE SUMMARY\n';
    csv += `Total Classes: ${reportData.summary.totalClasses}\n`;
    csv += `Present: ${reportData.summary.present}\n`;
    csv += `Absent: ${reportData.summary.absent}\n`;
    csv += `Late: ${reportData.summary.late}\n`;
    csv += `Overall Attendance: ${reportData.summary.attendancePercentage}%\n\n`;

    csv += 'SUBJECT-WISE ATTENDANCE\n';
    csv += 'Subject,Total,Present,Absent,Late,Percentage\n';
    Object.keys(reportData.subjectWiseAttendance).forEach(subject => {
      const data = reportData.subjectWiseAttendance[subject];
      csv += `${subject},${data.total},${data.present},${data.absent},${data.late},${data.percentage}%\n`;
    });

    csv += '\nDETAILED RECORDS\n';
    csv += 'Date,Subject,Status,Marked At,Remarks\n';
    reportData.detailedRecords.forEach(record => {
      csv += `${record.date},${record.subject},${record.status},${record.markedAt},${record.remarks}\n`;
    });

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Attendance_Report_${student.rollNumber}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
});

module.exports = router;
