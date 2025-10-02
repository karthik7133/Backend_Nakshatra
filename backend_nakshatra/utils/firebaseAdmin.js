const admin = require('firebase-admin');

// 🎯 Ensure the path is correct relative to the execution context (or relative to this file)
const serviceAccount = require('../config/nakshatra-c9c16-firebase-adminsdk-fbsvc-c924afd3f2.json'); 

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized successfully.');
} catch (error) {
    // This handles cases where the app is initialized multiple times (common in dev environments)
    if (!admin.apps.length) {
        console.error('❌ Firebase Admin SDK initialization failed:', error);
    }
}

module.exports = admin;
