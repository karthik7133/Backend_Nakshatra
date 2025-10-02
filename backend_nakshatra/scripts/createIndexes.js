// Script to manually create MongoDB indexes
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const MissingReport = require('../models/MissingReport');
const FoundReport = require('../models/FoundReport');
const Notification = require('../models/Notification');

async function createIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://karthik7133:Ch.karthik.7@cluster7133.yzxk6k4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster7133');
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 Creating indexes...\n');

    // User indexes
    console.log('Creating User indexes...');
    await User.collection.createIndex({ location: '2dsphere' });
    console.log('✅ User location 2dsphere index created');
    
    // MissingReport indexes
    console.log('\nCreating MissingReport indexes...');
    await MissingReport.collection.createIndex({ lastSeenLocation: '2dsphere' });
    console.log('✅ MissingReport lastSeenLocation 2dsphere index created');
    await MissingReport.collection.createIndex({ status: 1 });
    console.log('✅ MissingReport status index created');
    await MissingReport.collection.createIndex({ createdAt: -1 });
    console.log('✅ MissingReport createdAt index created');
    await MissingReport.collection.createIndex({ reportedBy: 1 });
    console.log('✅ MissingReport reportedBy index created');

    // FoundReport indexes
    console.log('\nCreating FoundReport indexes...');
    await FoundReport.collection.createIndex({ locationFound: '2dsphere' });
    console.log('✅ FoundReport locationFound 2dsphere index created');
    await FoundReport.collection.createIndex({ missingId: 1 });
    console.log('✅ FoundReport missingId index created');
    await FoundReport.collection.createIndex({ foundBy: 1 });
    console.log('✅ FoundReport foundBy index created');
    await FoundReport.collection.createIndex({ verifiedByParent: 1 });
    console.log('✅ FoundReport verifiedByParent index created');
    await FoundReport.collection.createIndex({ createdAt: -1 });
    console.log('✅ FoundReport createdAt index created');

    // Notification indexes
    console.log('\nCreating Notification indexes...');
    await Notification.collection.createIndex({ targetUsers: 1 });
    console.log('✅ Notification targetUsers index created');
    await Notification.collection.createIndex({ type: 1 });
    console.log('✅ Notification type index created');
    await Notification.collection.createIndex({ timestamp: -1 });
    console.log('✅ Notification timestamp index created');
    await Notification.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log('✅ Notification expiresAt TTL index created');

    console.log('\n🎉 All indexes created successfully!');

    // List all indexes
    console.log('\n📋 Verifying indexes:\n');
    
    const userIndexes = await User.collection.indexes();
    console.log('User indexes:', userIndexes.map(i => i.name).join(', '));
    
    const missingIndexes = await MissingReport.collection.indexes();
    console.log('MissingReport indexes:', missingIndexes.map(i => i.name).join(', '));
    
    const foundIndexes = await FoundReport.collection.indexes();
    console.log('FoundReport indexes:', foundIndexes.map(i => i.name).join(', '));
    
    const notificationIndexes = await Notification.collection.indexes();
    console.log('Notification indexes:', notificationIndexes.map(i => i.name).join(', '));

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();
