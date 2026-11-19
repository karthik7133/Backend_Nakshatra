const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let serviceAccount;
const keyFileName = 'nakshatra-c9c16-firebase-adminsdk-fbsvc-691de49bae.json';
const keyPath = path.join(__dirname, '..', 'config', keyFileName);
const oldKeyPath = path.join(__dirname, '..', 'config', 'nakshatra-c9c16-firebase-adminsdk-fbsvc-c924afd3f2.json');

if (fs.existsSync(keyPath)) {
    serviceAccount = require(keyPath);
    console.log('🔑 Firebase: loaded key from file:', keyPath);
} else if (fs.existsSync(oldKeyPath)) {
    serviceAccount = require(oldKeyPath);
    console.log('🔑 Firebase: loaded key from old file:', oldKeyPath);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('🔑 Firebase: loaded key from FIREBASE_SERVICE_ACCOUNT env var');
    } catch (e) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e.message);
    }
} else {
    console.error('❌ Firebase: NO service account found! Key file missing and FIREBASE_SERVICE_ACCOUNT env not set.');
    console.error('   Expected key at:', keyPath);
    console.error('   Set FIREBASE_SERVICE_ACCOUNT env var on Render with the JSON content.');
}

try {
    if (!admin.apps.length) {
        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('✅ Firebase Admin SDK initialized successfully.');
        } else {
            console.error('❌ No Firebase service account file found.');
        }
    }
} catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
}

module.exports = admin;
