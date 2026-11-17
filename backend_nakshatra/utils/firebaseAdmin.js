const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let serviceAccount;
const keyFileName = 'nakshatra-c9c16-firebase-adminsdk-fbsvc-691de49bae.json';
const keyPath = path.join(__dirname, '..', 'config', keyFileName);
const oldKeyPath = path.join(__dirname, '..', 'config', 'nakshatra-c9c16-firebase-adminsdk-fbsvc-c924afd3f2.json');

if (fs.existsSync(keyPath)) {
    serviceAccount = require(keyPath);
} else if (fs.existsSync(oldKeyPath)) {
    serviceAccount = require(oldKeyPath);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env:', e);
    }
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
