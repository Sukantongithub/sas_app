const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

/**
 * Script to create initial users for the system
 * Usage: Set environment variables for user credentials before running:
 * - ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 * - TEACHER_EMAIL, TEACHER_PASSWORD, TEACHER_NAME
 * - STUDENT_EMAIL, STUDENT_PASSWORD, STUDENT_NAME
 */

const createInitialUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    // Get credentials from environment variables
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const teacherEmail = process.env.TEACHER_EMAIL;
    const teacherPassword = process.env.TEACHER_PASSWORD;
    const studentEmail = process.env.STUDENT_EMAIL;
    const studentPassword = process.env.STUDENT_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log('⚠️  Admin credentials not provided in environment variables');
      console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD to create admin user');
      process.exit(1);
    }

    // Check if users already exist
    const existingAdmin = await User.findOne({ email: adminEmail });
    const existingTeacher = teacherEmail ? await User.findOne({ email: teacherEmail }) : null;
    const existingStudent = studentEmail ? await User.findOne({ email: studentEmail }) : null;

    if (existingAdmin && (!teacherEmail || existingTeacher) && (!studentEmail || existingStudent)) {
      console.log('ℹ️  Users already exist in the database');
      process.exit(0);
    }

    // Create admin user
    if (!existingAdmin) {
      const admin = new User({
        name: process.env.ADMIN_NAME || 'System Administrator',
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Admin user created');
    }

    // Create teacher user if credentials provided
    if (teacherEmail && teacherPassword && !existingTeacher) {
      const teacher = new User({
        name: process.env.TEACHER_NAME || 'Teacher User',
        email: teacherEmail,
        password: teacherPassword,
        role: 'teacher'
      });
      await teacher.save();
      console.log('✅ Teacher user created');
    }

    // Create student user if credentials provided
    if (studentEmail && studentPassword && !existingStudent) {
      const student = new User({
        name: process.env.STUDENT_NAME || 'Student User',
        email: studentEmail,
        password: studentPassword,
        role: 'student'
      });
      await student.save();
      console.log('✅ Student user created');
    }

    console.log('\n✅ Initial users created successfully!');
    console.log('ℹ️  Use the credentials you provided in environment variables to login');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating users:', error.message);
    process.exit(1);
  }
};

createInitialUsers();
