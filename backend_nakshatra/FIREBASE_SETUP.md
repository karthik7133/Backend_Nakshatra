# Firebase Backend Setup Guide

## 1. Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one if you haven't)
3. Go to **Project Settings** (gear icon)
4. Click on **Service Accounts** tab
5. Click **Generate new private key**
6. Download the JSON file

## 2. Add Firebase Configuration to .env

Add these variables to your `.env` file using the values from the downloaded JSON:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com
```

**Important:** Make sure to escape the private key properly with `\n` for line breaks.

## 3. Alternative: Use Service Account File

Instead of environment variables, you can place the downloaded JSON file in the `config/` folder:

1. Rename the file to `firebase-service-account.json`
2. Update `config/firebase.js` to use the file instead of environment variables

## 4. Test the Setup

1. Restart your backend server
2. Check the console logs for "✅ Firebase Admin initialized successfully"
3. Test authentication with your Flutter app

## 5. Troubleshooting

If you see "Firebase Admin initialization failed":
- Check that all environment variables are set correctly
- Ensure the private key is properly escaped
- Verify the project ID matches your Firebase project

The backend will fall back to limited functionality if Firebase setup fails, but authentication won't work properly.
