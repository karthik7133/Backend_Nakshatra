# Firebase Service Account Configuration

## Setup Instructions

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project (or create a new one)
3. Go to Project Settings (gear icon) → Service Accounts
4. Click "Generate New Private Key"
5. Save the downloaded JSON file as `nakshatra-service-account.json` in this directory

**IMPORTANT:** Never commit this file to version control. It's already in .gitignore.

## File Structure

Place your service account file here:
```
config/
  └── nakshatra-service-account.json  (your Firebase credentials)
```

The file should look like this:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```
