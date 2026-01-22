const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const createTestUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    // Check if test users already exist
    const existingAdmin = await User.findOne({ email: 'admin@test.com' });
    const existingTeacher = await User.findOne({ email: 'teacher@test.com' });
    const existingStudent = await User.findOne({ email: 'student@test.com' });

    if (existingAdmin && existingTeacher && existingStudent) {
      console.log('ℹ️  Test users already exist');
      console.log('\nTest Credentials:');
      console.log('Admin: admin@test.com / password123');
      console.log('Teacher: teacher@test.com / password123');
      console.log('Student: student@test.com / password123');
      process.exit(0);
    }

    // Create admin user
    if (!existingAdmin) {
      const admin = new User({
        name: 'Admin User',
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Admin user created');
    }

    // Create teacher user
    if (!existingTeacher) {
      const teacher = new User({
        name: 'Teacher User',
        email: 'teacher@test.com',
        password: 'password123',
        role: 'teacher'
      });
      await teacher.save();
      console.log('✅ Teacher user created');
    }

    // Create student user
    if (!existingStudent) {
      const student = new User({
        name: 'Student User',
        email: 'student@test.com',
        password: 'password123',
        role: 'student'
      });
      await student.save();
      console.log('✅ Student user created');
    }

    console.log('\n✅ Test users created successfully!');
    console.log('\nTest Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin: admin@test.com / password123');
    console.log('Teacher: teacher@test.com / password123');
    console.log('Student: student@test.com / password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
    process.exit(1);
  }
};

createTestUsers();
