# Attendance Management System - Setup Guide

## Complete Setup Instructions

### 1. Backend Setup (MongoDB + Express)

#### Install MongoDB
**Option A: Local MongoDB**
1. Download MongoDB from https://www.mongodb.com/try/download/community
2. Install and start MongoDB service
3. MongoDB will run on `mongodb://localhost:27017`

**Option B: MongoDB Atlas (Cloud - Recommended)**
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/attendance_db`

#### Setup Backend Server
```bash
cd backend

# Install dependencies
npm install

# Configure environment
# .env file is already created with local MongoDB
# For MongoDB Atlas, edit .env and update MONGODB_URI

# Start server
npm run dev
```

Server will run on http://localhost:5000

### 2. React Native App Setup

#### Update API URL for Your Device

Edit `sas/services/api.ts` and update the API_BASE_URL:

- **Android Emulator**: `http://10.0.2.2:5000/api`
- **iOS Simulator**: `http://localhost:5000/api`
- **Physical Device**: `http://YOUR_COMPUTER_IP:5000/api`

To find your computer's IP:
- Windows: Run `ipconfig` in terminal, look for IPv4 Address
- Mac/Linux: Run `ifconfig` or `ip addr`

Example for physical device:
```typescript
const API_BASE_URL = 'http://192.168.1.100:5000/api';
```

#### Install App Dependencies
```bash
cd sas
npm install axios
```

#### Run the App
```bash
# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

### 3. Testing the Setup

1. **Start Backend**:
   ```bash
   cd backend
   npm run dev
   ```
   You should see:
   ```
   ✅ MongoDB connected successfully
   🚀 Server running on http://localhost:5000
   ```

2. **Test API** (in browser or Postman):
   - Visit http://localhost:5000
   - Should show API documentation

3. **Run React Native App**:
   ```bash
   cd sas
   npm start
   ```

4. **Test Features**:
   - Add a student
   - Mark attendance
   - View history
   - Check MongoDB Compass or Atlas to see data persisted

### 4. Troubleshooting

#### Cannot connect to backend from app
- Check firewall settings allow port 5000
- Ensure backend server is running
- Verify API_BASE_URL matches your setup
- For physical device, ensure phone and computer are on same WiFi

#### MongoDB connection failed
- Check MongoDB service is running
- Verify MONGODB_URI in .env file
- For Atlas: check network access whitelist

#### "Network Error" in app
- Backend not running
- Wrong API URL
- Firewall blocking connection

### 5. API Endpoints Reference

**Students:**
- `GET /api/students` - Get all students
- `POST /api/students` - Create student
- `DELETE /api/students/:id` - Delete student

**Attendance:**
- `GET /api/attendance/today` - Get today's attendance
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance/student/:id` - Get student history
- `GET /api/attendance/stats/all` - Get all statistics

### 6. MongoDB Data Structure

**Students Collection:**
```json
{
  "_id": "ObjectId",
  "name": "John Doe",
  "rollNumber": "CS001",
  "email": "john@example.com",
  "class": "Computer Science",
  "createdAt": "2026-01-21T...",
  "updatedAt": "2026-01-21T..."
}
```

**Attendance Collection:**
```json
{
  "_id": "ObjectId",
  "studentId": "ObjectId (ref: Student)",
  "date": "2026-01-21",
  "status": "present|absent|late",
  "remarks": "Optional note",
  "markedAt": "2026-01-21T10:30:00Z"
}
```

### 7. Next Steps

- Configure MongoDB for production
- Add authentication (JWT)
- Setup cloud deployment (Heroku/Railway for backend)
- Add data backup/export features
- Implement push notifications
