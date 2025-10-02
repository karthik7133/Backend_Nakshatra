# Quick Setup Guide for Missing Person Backend

## Step-by-Step Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the root directory with the following configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration (Use the existing connection string from server.js)
MONGODB_URI=mongodb+srv://karthik7133:Ch.karthik.7@cluster7133.yzxk6k4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster7133

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_nakshatra_2024
JWT_EXPIRE=30d

# Cloudinary Configuration
# Sign up at https://cloudinary.com to get these credentials
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages:
- express
- mongoose
- bcryptjs
- jsonwebtoken
- cors
- dotenv
- multer
- cloudinary
- express-validator
- helmet
- express-rate-limit

### 3. Cloudinary Setup (Required for Image Uploads)

1. Go to https://cloudinary.com and create a free account
2. After logging in, go to Dashboard
3. Copy your:
   - Cloud Name
   - API Key
   - API Secret
4. Add these to your `.env` file

### 4. Start the Server

**Development Mode (with auto-restart):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

### 5. Test the API

You can test if the server is running by visiting:
```
http://localhost:5000/api/health
```

You should see:
```json
{
  "success": true,
  "message": "Server is running properly",
  "timestamp": "2025-10-02T07:24:29.000Z"
}
```

## Frontend Configuration

Update your Flutter app's API constant to point to your backend:

**File:** `D:\AndroidStudioProjects\Nakshatra\lib\constants\api_constants.dart`

```dart
class ApiConstants {
  // For local development (Android Emulator)
  static const String baseUrl = 'http://10.0.2.2:5000/api';
  
  // For local development (Physical Device - use your PC's IP)
  // static const String baseUrl = 'http://192.168.0.107:5000/api';
  
  // For production
  // static const String baseUrl = 'https://your-domain.com/api';
}
```

## API Testing with Postman/Thunder Client

### 1. Register a User
```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "phoneNumber": "1234567890",
  "password": "password123",
  "role": "user"
}
```

### 2. Login
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Copy the `token` from the response and use it in subsequent requests.

### 3. Get Missing Reports
```
GET http://localhost:5000/api/missing?status=active&page=1&limit=10
Authorization: Bearer YOUR_TOKEN_HERE
```

## Common Issues and Solutions

### Issue: MongoDB Connection Error
**Solution:** Make sure your MongoDB URI is correct and your IP is whitelisted in MongoDB Atlas (Network Access settings).

### Issue: Cloudinary Upload Fails
**Solution:** Verify your Cloudinary credentials in the `.env` file are correct.

### Issue: CORS Error from Frontend
**Solution:** Update `CLIENT_URL` in `.env` to match your frontend URL.

### Issue: JWT Token Invalid
**Solution:** Make sure `JWT_SECRET` is set in `.env` and matches between requests.

## Database Models Overview

### User Model
- Stores user authentication and profile information
- Includes location data for proximity-based features
- Supports FCM tokens for push notifications

### MissingReport Model
- Contains details about missing children
- Includes geospatial data for location-based searches
- Links to the user who reported

### FoundReport Model
- Stores reports of found children
- Links to the original missing report
- Includes verification status from parents

### Notification Model
- Manages all app notifications
- Supports targeting specific users
- Auto-expires after 30 days

## Security Notes

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Change JWT_SECRET** in production to a strong random string
3. **Use HTTPS** in production
4. **Keep dependencies updated** - Run `npm audit` regularly
5. **Whitelist IPs** in MongoDB Atlas for production

## Next Steps

1. Set up your `.env` file with all credentials
2. Start the backend server
3. Update the frontend API URL
4. Test the registration and login flow
5. Test creating a missing report
6. Test the found report submission

## Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure MongoDB connection is working
4. Check that all dependencies are installed

For additional help, refer to the main README.md file.
