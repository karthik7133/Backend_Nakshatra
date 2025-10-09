const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You can use environment variables for the service account key
// or download the service account key file from Firebase Console
const initializeFirebase = () => {
  try {
    // Option 1: Using service account key file (recommended for production)
    // Download the service account key from Firebase Console > Project Settings > Service Accounts
    // and place it in the config folder
    
    // Option 2: Using environment variables (for development)
    // You can set these in your .env file
    
    // Parse private key - handle both escaped and non-escaped newlines
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('FIREBASE_PRIVATE_KEY environment variable is not set');
    }
    
    // Replace escaped newlines with actual newlines
    // This handles cases where the key is stored as a single line with \n
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID || "your-project-id",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    };

    // Validate required fields
    if (!serviceAccount.project_id || serviceAccount.project_id === "your-project-id") {
      throw new Error('FIREBASE_PROJECT_ID environment variable is not set');
    }
    if (!serviceAccount.client_email) {
      throw new Error('FIREBASE_CLIENT_EMAIL environment variable is not set');
    }

    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      console.log('✅ Firebase Admin initialized successfully');
    }

    return admin;
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    
    // Fallback: Initialize without credentials for development
    // This will work for token verification but not for other admin operations
    if (!admin.apps.length) {
      try {
        admin.initializeApp();
        console.log('⚠️ Firebase Admin initialized without credentials (limited functionality)');
      } catch (fallbackError) {
        console.error('❌ Firebase Admin fallback initialization failed:', fallbackError);
      }
    }
    
    return admin;
  }
};

module.exports = { admin: initializeFirebase() };
