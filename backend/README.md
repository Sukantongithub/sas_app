# Attendance Management System - Backend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your MongoDB connection string:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/attendance_db
```

For MongoDB Atlas (cloud):
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/attendance_db
```

4. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get single student
- `POST /api/students` - Create new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Attendance
- `GET /api/attendance` - Get all attendance records (with optional query params)
- `GET /api/attendance/today` - Get today's attendance
- `GET /api/attendance/student/:studentId` - Get student's attendance history with stats
- `POST /api/attendance` - Mark attendance for a student
- `POST /api/attendance/bulk` - Mark attendance for multiple students
- `DELETE /api/attendance/:id` - Delete attendance record
- `GET /api/attendance/stats/all` - Get statistics for all students

## Request Examples

### Create Student
```json
POST /api/students
{
  "name": "John Doe",
  "rollNumber": "CS001",
  "email": "john@example.com",
  "phone": "1234567890",
  "class": "Computer Science"
}
```

### Mark Attendance
```json
POST /api/attendance
{
  "studentId": "65f1234567890abcdef12345",
  "date": "2026-01-21",
  "status": "present",
  "remarks": "On time"
}
```

### Bulk Mark Attendance
```json
POST /api/attendance/bulk
{
  "records": [
    {
      "studentId": "65f1234567890abcdef12345",
      "date": "2026-01-21",
      "status": "present"
    },
    {
      "studentId": "65f1234567890abcdef12346",
      "date": "2026-01-21",
      "status": "absent",
      "remarks": "Sick leave"
    }
  ]
}
```
