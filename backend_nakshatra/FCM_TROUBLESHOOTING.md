# Firebase Cloud Messaging (FCM) Troubleshooting Guide

## ❌ Error: 404 - The requested URL /batch was not found

This error occurs when Firebase Cloud Messaging API is not enabled or configured properly.

## ✅ Solution Steps:

### Step 1: Enable Firebase Cloud Messaging API

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com
   - Select your project: `nakshatra-c9c16`

2. **Enable FCM API:**
   - Go to "APIs & Services" → "Library"
   - Search for "Firebase Cloud Messaging API"
   - Click on it and click "ENABLE"

3. **Also enable (if not already):**
   - "Cloud Messaging" (legacy)
   - "Firebase Cloud Messaging API" (new)

### Step 2: Verify Service Account Permissions

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com
   - Select project: `nakshatra-c9c16`

2. **Check Service Account:**
   - Go to Project Settings → Service Accounts
   - Verify the service account email: `firebase-adminsdk-fbsvc@nakshatra-c9c16.iam.gserviceaccount.com`
   - It should have "Firebase Admin SDK Administrator Service Agent" role

### Step 3: Verify FCM Tokens are Valid

The FCM tokens in your database should be from the same Firebase project.

**Current tokens in DB:**
- User 1: `ehTEW-2hQyyojiRP3udiX1:APA91bEspSvJfBtqVPPQfyJAoia2_2z3lChSEd-fmXr48yT_KbMBdz-RTGy3s04aWvs0gumoE5I2vsPMA4rO53bV8mnlUDgYyfz4sT7YNHGTYl4AQ05WRrg`
- User 2: `d7kqFlpYTQi3DwQ1g-QJKX:APA91bEbvjl68DNdYN5N_vrq6iykebFsBkjlVrS-EZ4vd68iIOwrosvx4mL_gW-mon7VhmaV1bhXxDRP0SPHyweO3mlwMg6Z9bMWRAq_oLkAZbPBjZawFb0`

### Step 4: Check Flutter App Firebase Configuration

1. **Verify `google-services.json` (Android):**
   - File location: `android/app/google-services.json`
   - Project ID should be: `nakshatra-c9c16`

2. **Verify `GoogleService-Info.plist` (iOS):**
   - File location: `ios/Runner/GoogleService-Info.plist`
   - Project ID should be: `nakshatra-c9c16`

### Step 5: Test with Simple FCM Send

Create a test endpoint to verify FCM is working:

```javascript
// Add to routes/debug.js
router.post('/test-fcm', authenticate, async (req, res) => {
  const { token, title, body } = req.body;
  
  try {
    const message = {
      notification: { title, body },
      token: token
    };
    
    const response = await admin.messaging().send(message);
    
    res.json({
      success: true,
      messageId: response
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});
```

**Test it:**
```bash
POST http://localhost:5000/api/debug/test-fcm
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "token": "YOUR_FCM_TOKEN",
  "title": "Test Notification",
  "body": "Testing FCM from backend"
}
```

## 🔍 Common Error Codes:

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `404` | FCM API not enabled | Enable Firebase Cloud Messaging API in Google Cloud Console |
| `messaging/invalid-registration-token` | Token is malformed | Regenerate FCM token in Flutter app |
| `messaging/registration-token-not-registered` | Token expired or deleted | User needs to login again to get new token |
| `messaging/invalid-argument` | Message payload invalid | Check notification structure |
| `messaging/authentication-error` | Service account invalid | Re-download service account JSON |

## ✅ Quick Fix Checklist:

- [ ] Firebase Cloud Messaging API enabled in Google Cloud Console
- [ ] Service account has proper permissions
- [ ] `google-services.json` matches Firebase project
- [ ] FCM tokens are from the same Firebase project
- [ ] Flutter app has latest Firebase dependencies
- [ ] Users have logged in after FCM setup (to get valid tokens)

## 🎯 Expected Behavior After Fix:

When a missing report is created, you should see:

```
📲 SENDING PUSH NOTIFICATIONS:
   Attempting to send to 1 devices...
   ✅ Token 1: Sent successfully

📊 Notification Summary: 1 successful, 0 failed
```

## 📱 Flutter App - Regenerate FCM Token

If tokens are invalid, users need to:
1. Logout from the app
2. Login again
3. This will generate a new FCM token and save it to backend

## 🆘 Still Not Working?

1. **Check Firebase Console Logs:**
   - Go to Firebase Console → Cloud Messaging
   - Check for any error messages

2. **Verify Project ID:**
   - Backend service account: `nakshatra-c9c16`
   - Flutter app config: Should match

3. **Test with Firebase Console:**
   - Go to Firebase Console → Cloud Messaging → Send test message
   - Use one of the FCM tokens from your database
   - If this works, backend should work too

## 📞 Need Help?

Check the backend logs for detailed error messages. The updated code now shows:
- Exact error code
- Which token failed
- Helpful troubleshooting steps
