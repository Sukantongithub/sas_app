# Database Schema (MongoDB)

Notation: `PK` primary key (_id), `FK` references collection, `IDX` index, `TTL` time-to-live, `SD` soft delete flag.

## Core Collections

### users
- PK: _id
- Fields: name, email (unique), passwordHash, role (enum: super_admin, admin, faculty, student), departmentId (FK departments), studentProfileId (FK students, optional), isActive, lastLogin, createdAt, updatedAt, mfaEnabled?, phone?, metadata{}.
- Indexes: email unique; role; departmentId; isActive.

### roles (optional if we decouple permissions)
- name (unique), description, scope (global/org), permissions [string].
- Indexes: name unique.

### permissions (optional granular store)
- key (e.g., attendance.mark, attendance.override), description, category.
- Indexes: key unique.

### role_permissions (optional)
- roleId, permissionKey.
- Indexes: roleId, permissionKey, compound unique (roleId, permissionKey).

### user_roles (optional multi-role)
- userId, roleId, departmentId?, classId?.
- Indexes: userId, roleId, compound unique (userId, roleId, departmentId).

### departments
- name, code, parentId?, managerId?, locationId?, isActive, createdAt, updatedAt.
- Indexes: code unique; parentId; managerId.

### students
- PK: _id
- Fields: name, rollNumber (unique), email, phone, class, departmentId (FK), guardianContact?, isActive, createdAt, updatedAt.
- Indexes: rollNumber unique; departmentId; class.

### shifts
- name, code, type (fixed|rotating), startTime, endTime, breakMinutes, graceMinutes, halfDayThresholdMinutes, overtimePolicy {enabled, thresholdMinutes, maxMinutes}, rotationPattern?, isActive.
- Indexes: code unique; isActive.

### user_shifts
- userId, shiftId, effectiveFrom, effectiveTo?, rotationGroup?, assignedBy.
- Indexes: userId, shiftId, effectiveFrom; active window query.

### holidays
- date (ISO string), name, scope (global|department|location), departmentId?, locationId?, isWorkingDayOverride?, createdBy, createdAt.
- Indexes: date, scope, departmentId.

### geofences
- name, type (circle|polygon), center{lat,lng}, radiusMeters, vertices[], allowedRoles[], locationId?, activeHours?, createdBy, createdAt.
- Indexes: locationId; allowedRoles; geo 2dsphere if needed.

### devices (biometric/IP anchors)
- name, type (biometric|kiosk|qr_display), deviceId, secret/signingKey, ipAllowlist[], geofenceId?, locationId?, lastSeenAt, isActive.
- Indexes: deviceId unique; locationId.

## Attendance & Time Data

### attendance_sessions
- userId, shiftId, date (YYYY-MM-DD), checkIn {time, source, deviceId, geo, ip}, checkOut {time, source, deviceId, geo, ip}, workMinutes, overtimeMinutes, lateMinutes, earlyExitMinutes, status (present|absent|leave|holiday), flags {autoAbsent, manualOverride, geoMismatch, ipMismatch}, remarks, createdBy?, updatedBy?, auditIds[]
- Indexes: userId+date unique; shiftId; status; flags.autoAbsent.

### attendance_events (raw stream)
- userId, occurredAt, type (check_in|check_out|qr_scan|biometric_ping), source (qr|gps|biometric|ip|manual), deviceId?, geo?, ip?, payload{}, sessionId?, createdAt.
- Indexes: userId+occurredAt; type; source; deviceId.

### attendance_overrides
- sessionId, previousValues{}, newValues{}, reasonCode, requestedBy, approvedBy, approvedAt, status (pending|approved|rejected), auditTrail[]
- Indexes: sessionId; status.

### correction_requests
- userId, sessionId?, date, requestedChanges{}, reason, attachments[], status (pending|approved|rejected), approverId, decidedAt, comments, auditTrail[]
- Indexes: userId; date; status; approverId.

## Leave Management

### leave_types
- name, code, paid (bool), maxPerYear?, maxContinuousDays?, requiresDocument?, carryForward?, color?, priority?
- Indexes: code unique.

### leave_balances
- userId, leaveTypeId, balanceDays, accruedDays, usedDays, carryForwardDays, effectiveYear, lastUpdated.
- Indexes: userId+leaveTypeId unique; effectiveYear.

### leave_requests
- userId, leaveTypeId, startDate, endDate, durationDays, reason, status (pending|approved|rejected|cancelled), approverId, decidedAt, overlapSessionIds[], attachmentIds[], auditTrail[]
- Indexes: userId; status; approverId; startDate; endDate.

## Configuration & Rules

### attendance_rules
- scope (global|department|shift), shiftId?, departmentId?, graceMinutes, lateAfterMinutes, autoAbsentCutoff (time), shortLeaveMinutes, halfDayMinutes, ipAllowlist[], geoFenceIds[], faceVerifyRequired?, qrWindowMinutes, maxDailyCheckIns, createdAt, updatedAt.
- Indexes: scope; shiftId; departmentId.

### bulk_upload_jobs
- type (attendance|roster|leave), status (pending|processing|completed|failed), filePath, stats {total, success, failed}, errors[], createdBy, createdAt, completedAt.
- Indexes: status; createdBy; createdAt.

### notifications
- userId, channel (email|sms|push), templateKey, payload, status (pending|sent|failed), error?, scheduledFor?, sentAt, createdAt.
- Indexes: userId; status; scheduledFor.

### audit_logs
- actorId, action, resource {type, id}, changes {from,to}, ip, userAgent, geo?, createdAt, correlationId.
- Indexes: actorId; resource.id; action; createdAt; correlationId.

## Reporting Support
- **Materialized views (optional)**: daily aggregates per user (`attendance_daily_rollup`) with totals: presentDays, absentDays, lateCount, overtimeMinutes.
- **Indexes**: date range queries on attendance_sessions and leave_requests; compound userId+date for fast calendar queries.

## Soft Delete Strategy
- Add `isDeleted` and `deletedAt` where logical deletes are needed (users, students, shifts, geofences, devices). Compound indexes should include `isDeleted: false` where appropriate.

## Data Integrity Notes
- Validate shift assignment windows to avoid overlaps.
- Enforce non-overlapping leave with attendance sessions; auto-create leave status on approval.
- Use transactions for multi-document updates (e.g., leave approval + balance deduction + attendance session update).
- Use TTL on ephemeral tokens/QR sessions.

## Sample Derived Metrics
- workMinutes = checkout - checkin - breaks.
- lateMinutes = max(0, checkInTime - shiftStart - graceMinutes).
- earlyExitMinutes = max(0, shiftEnd - checkOutTime).
- overtimeMinutes = max(0, workMinutes - shiftContractedMinutes).
