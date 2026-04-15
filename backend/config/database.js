const mongoose = require('mongoose');
const path = require('path');

// Always resolve env file relative to backend folder, not current terminal cwd.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_db';
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    // Cleanup legacy index from older Session schema to avoid duplicate null token errors.
    try {
      const sessionsCollection = mongoose.connection.db.collection('sessions');
      const indexes = await sessionsCollection.indexes();
      const hasLegacyTokenIndex = indexes.some((idx) => idx.name === 'token_1');

      if (hasLegacyTokenIndex) {
        await sessionsCollection.dropIndex('token_1');
        console.log('Dropped legacy sessions index: token_1');
      }
    } catch (indexError) {
      console.warn('Session index cleanup skipped:', indexError.message);
    }

    // Cleanup legacy unique Attendance index that incorrectly enforces one record per day.
    try {
      const attendanceCollection = mongoose.connection.db.collection('attendances');
      const attendanceIndexes = await attendanceCollection.indexes();
      const legacyDailyUnique = attendanceIndexes.find(
        (idx) => idx.name === 'studentId_1_date_1' && idx.unique === true
      );

      if (legacyDailyUnique) {
        await attendanceCollection.dropIndex('studentId_1_date_1');
        console.log('Dropped legacy attendances unique index: studentId_1_date_1');
      }
    } catch (indexError) {
      console.warn('Attendance index cleanup skipped:', indexError.message);
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
