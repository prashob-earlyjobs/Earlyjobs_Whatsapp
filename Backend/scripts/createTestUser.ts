import mongoose from 'mongoose';
import User from '../models/User';
import { hashPassword } from '../utils/password';
import dotenv from 'dotenv';

dotenv.config();

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('🔗 Connected to MongoDB');

    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'admin@earlyjobs.com' });
    if (existingUser) {
      console.log('✅ Test user already exists');
      return;
    }

    // Create test user
    const hashedPassword = await hashPassword('admin123');
    const testUser = new User({
      name: 'Admin User',
      email: 'admin@earlyjobs.com',
      password: hashedPassword,
      role: 'admin',
      department: 'IT',
      isActive: true,
      permissions: ['all']
    });

    await testUser.save();
    console.log('✅ Test user created successfully');

    // Create additional test users
    const testUsers = [
      {
        name: 'BDE Manager',
        email: 'bde@earlyjobs.com',
        password: await hashPassword('bde123'),
        role: 'bde',
        department: 'Sales',
        isActive: true,
        permissions: ['contacts', 'conversations']
      },
      {
        name: 'HR Manager',
        email: 'hr@earlyjobs.com',
        password: await hashPassword('hr123'),
        role: 'hr',
        department: 'Human Resources',
        isActive: true,
        permissions: ['users', 'reports']
      },
      {
        name: 'Tech Lead',
        email: 'tech@earlyjobs.com',
        password: await hashPassword('tech123'),
        role: 'tech',
        department: 'Technology',
        isActive: true,
        permissions: ['templates', 'system']
      }
    ];

    for (const userData of testUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        console.log(`✅ Created user: ${userData.name}`);
      }
    }

    console.log('🎉 All test users created successfully');
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createTestUser(); 