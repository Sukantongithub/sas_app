# Testing Student-to-Class Mapping

## Quick Start - Create Test Data

### Step 1: Verify Classes Exist in Database

First, make sure you have classes created. Check via API:

```bash
curl http://localhost:5000/api/classes -H "Authorization: Bearer TOKEN"
```

Expected classes (sample):
- CSE-A, CSE-B (Computer Science)
- ECE-A, ECE-B (Electronics)
- ME-A, ME-B (Mechanical)

If no classes exist, create one first:
```bash
curl -X POST http://localhost:5000/api/classes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CSE-B",
    "code": "CSE4B",
    "department": "Computer Science",
    "semester": 4,
    "academicYear": "2025-26"
  }'
```

---

### Step 2: Create Individual Students

Create a student properly mapped to a class:

```bash
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rajesh Kumar",
    "rollNumber": "CSE2001",
    "email": "rajesh@example.com",
    "phone": "9876543210",
    "class": "CSE-B",
    "section": "B",
    "year": 2,
    "department": "CSE"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Student created and mapped to class successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Rajesh Kumar",
    "rollNumber": "CSE2001",
    "class": "CSE-B",
    "classId": "507f1f77bcf86cd799439012",  // ✅ Now has classId!
    "email": "rajesh@example.com",
    "phone": "9876543210",
    ...
  }
}
```

---

### Step 3: Bulk Import Students

Import multiple students at once:

```bash
curl -X POST http://localhost:5000/api/students/bulk-import \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "students": [
      {
        "name": "Priya Singh",
        "rollNumber": "CSE2002",
        "email": "priya@example.com",
        "phone": "9876543211",
        "class": "CSE-B"
      },
      {
        "name": "Arjun Patel",
        "rollNumber": "CSE2003",
        "email": "arjun@example.com",
        "phone": "9876543212",
        "class": "CSE-B"
      },
      {
        "name": "Neha Sharma",
        "rollNumber": "ECE2001",
        "email": "neha@example.com",
        "phone": "9876543213",
        "class": "ECE-A"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "status": "completed",
  "message": "Imported 3 students successfully, 0 failed",
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0
  },
  "results": [
    {
      "status": "success",
      "rollNumber": "CSE2002",
      "data": { ... }
    },
    {
      "status": "success",
      "rollNumber": "CSE2003",
      "data": { ... }
    },
    {
      "status": "success",
      "rollNumber": "ECE2001",
      "data": { ... }
    }
  ]
}
```

---

### Step 4: Verify Student-Class Mapping

Check that students were properly mapped:

```bash
# Get all students in CSE-B class
curl http://localhost:5000/api/classes/CSE-B/students \
  -H "Authorization: Bearer TOKEN"
```

Or fetch a specific student to verify classId is set:

```bash
curl http://localhost:5000/api/students/CSE2001 \
  -H "Authorization: Bearer TOKEN"
```

Should return:
```json
{
  "_id": "...",
  "name": "Rajesh Kumar",
  "rollNumber": "CSE2001",
  "class": "CSE-B",
  "classId": "...",  // ✅ Has reference to Class._id
  ...
}
```

---

## UI Testing - Staff Mark Attendance

### Before (Broken ❌)
1. Staff logs in
2. Navigates to "Mark Attendance"
3. Screen says: "No students found"
4. Staff cannot mark any attendance

**Root cause:** Students had class="CSE-B" but classId=null

### After (Fixed ✅)
1. Staff logs in
2. Navigates to "Mark Attendance"
3. Screen shows: "CSE-B [3 students]"
   - Rajesh Kumar (CSE2001)
   - Priya Singh (CSE2002)
   - Arjun Patel (CSE2003)
4. Staff can mark attendance for each student

**How it works:**
1. System fetches staff's assigned classes
2. Finds all students with matching classId
3. Displays them grouped by class
4. Allows marking attendance with auto-filled class info

---

## Testing Checklist

✅ **Student Creation Tests**
- [ ] Create student with valid class name
  - Verify: classId is set, student added to Class.students
- [ ] Create student with non-existent class
  - Verify: Returns 404 with helpful message
- [ ] Create student with duplicate rollNumber
  - Verify: Returns 409 conflict error
- [ ] Create student with only required fields
  - Verify: Optional fields have defaults (section='A', year=1, etc.)

✅ **Student Update Tests**
- [ ] Update student name only
  - Verify: Name updated, classId unchanged
- [ ] Change student's class
  - Verify: Removed from old Class.students, added to new
- [ ] Try to move student to non-existent class
  - Verify: Returns 404 error

✅ **Bulk Import Tests**
- [ ] Import 10 students to same class
  - Verify: All added with classId, Class.students has 10 entries
- [ ] Import 5 students to different classes
  - Verify: Each added to correct class
- [ ] Import with some duplicate rollNumbers
  - Verify: Duplicates reported in errors, valid ones imported
- [ ] Import with class names that don't exist
  - Verify: Those records fail with clear error

✅ **Integration Tests**
- [ ] GET /api/attendance/staff/:staffId/unmarked-students
  - Verify: Returns all students from staff's classes
- [ ] POST /api/attendance (mark attendance)
  - Verify: Works without providing classId (auto-fetched)
- [ ] POST /api/attendance/bulk (bulk mark)
  - Verify: Marks attendance for multiple students
- [ ] GET /api/students/attendance/mark
  - Verify: Shows students with attendance status

✅ **UI Tests**
- [ ] Staff Mark Attendance screen
  - Verify: Shows student list grouped by class
  - Verify: Can select and mark attendance
  - Verify: Attendance saved correctly to database

---

## Troubleshooting

### "Class not found" Error
**Problem:** Creating student with class name that doesn't exist
```json
{
  "status": "error",
  "message": "Class not found: CSE-B. Please create the class first."
}
```

**Solution:** 
1. Create the class first via API
2. Or provide classId in request body (if you know the ObjectId)

---

### "Duplicate roll number" Error
**Problem:** Trying to create student with existing rollNumber
```json
{
  "status": "error",
  "message": "Student with roll number CSE2001 already exists"
}
```

**Solution:**
- Use unique rollNumbers
- Or use PUT to update existing student

---

### Student has classId=null
**Problem:** Existing students in database lack classId mappings

**Solution:** Run migration script:
```javascript
// Run in MongoDB shell
db.students.updateMany(
  { classId: null, class: { $exists: true, $ne: "" } },
  [
    {
      $lookup: {
        from: "classes",
        localField: "class",
        foreignField: "name",
        as: "classData"
      }
    },
    {
      $set: { classId: { $arrayElemAt: ["$classData._id", 0] } }
    },
    {
      $unset: "classData"
    }
  ]
);
```

Or use this Node.js script:
```javascript
const Student = require('./models/Student');
const Class = require('./models/Class');

async function migrateStudents() {
  const students = await Student.find({ classId: null });
  
  for (const student of students) {
    if (student.class) {
      const classRecord = await Class.findOne({ name: student.class });
      if (classRecord) {
        student.classId = classRecord._id;
        await student.save();
        
        // Add to class.students
        await Class.findByIdAndUpdate(
          classRecord._id,
          { $addToSet: { students: student._id } }
        );
      }
    }
  }
  
  console.log('Migration complete');
}

migrateStudents();
```

---

## API Reference

### Endpoints Updated/Added

| Method | Endpoint | Changes |
|--------|----------|---------|
| POST | `/api/students` | ✅ Now handles class mapping |
| PUT | `/api/students/:id` | ✅ Now handles class remapping |
| DELETE | `/api/students/:id` | ✅ Now removes from class |
| POST | `/api/students/bulk-import` | ✨ NEW - Bulk import with mapping |
| GET | `/api/attendance/staff/:staffId/unmarked-students` | ✅ Works with proper classId |
| POST | `/api/attendance` | ✅ Auto-uses classId from student |
| POST | `/api/attendance/bulk` | ✅ Auto-uses classId per record |

---

## Expected Outcome

After testing, you should see:

1. ✅ **Students properly mapped** - All students have classId set
2. ✅ **Bidirectional references** - Class.students contains all class members
3. ✅ **Staff Mark Attendance works** - Staff can see and mark attendance
4. ✅ **Attendance filtering by class** - Attendance endpoints filter correctly
5. ✅ **No "No students found"** - Staff screen shows all assigned students

---

## Backend Status

```
✅ Server running: http://localhost:5000
✅ MongoDB connected
✅ API endpoints live
✅ Swagger docs: http://localhost:5000/api/docs
```

Test any endpoint with Authorization header containing a valid JWT token.
