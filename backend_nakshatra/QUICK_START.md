# ⚡ Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1️⃣ Install Dependencies (1 min)
```bash
cd C:\Users\chipi\OneDrive\Desktop\backend\MissingPerson-main
npm install
```

### 2️⃣ Setup Firebase (2 min)
1. Go to https://console.firebase.google.com
2. Project Settings → Service Accounts
3. Generate New Private Key
4. Save as `config/nakshatra-service-account.json`

### 3️⃣ Setup Cloudinary (1 min)
1. Sign up at https://cloudinary.com
2. Copy Cloud Name, API Key, API Secret from dashboard
3. Add to `.env` file

### 4️⃣ Configure .env (1 min)
Create `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb+srv://karthik7133:Ch.karthik.7@cluster7133.yzxk6k4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster7133
JWT_SECRET=nakshatra_secret_key_2024_change_in_production
JWT_EXPIRE=30d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLIENT_URL=http://localhost:3000
```

### 5️⃣ Start Server
```bash
npm run dev
```

✅ Server running on http://localhost:5000

---

## 🧪 Quick Test

```bash
# Test health
curl http://localhost:5000/api/health

# Expected: {"success":true,"message":"Server is running properly"}
```

---

## 📱 Connect Flutter App

Update `D:\AndroidStudioProjects\Nakshatra\lib\constants\api_constants.dart`:

```dart
class ApiConstants {
  static const String baseUrl = 'http://10.0.2.2:5000/api';  // Emulator
  // static const String baseUrl = 'http://YOUR_PC_IP:5000/api';  // Physical device
}
```

Find your IP:
```bash
ipconfig
```

---

## 🎯 What's Working

✅ **28 API Endpoints** - All functional
✅ **Authentication** - JWT-based
✅ **Push Notifications** - FCM integrated
✅ **Image Upload** - Cloudinary
✅ **Location Search** - Geospatial queries
✅ **Security** - Rate limiting, helmet, CORS

---

## 📚 Full Documentation

- `COMPLETE_SETUP_SUMMARY.md` - Complete guide
- `README.md` - API documentation
- `SETUP_GUIDE.md` - Detailed setup
- `API_VERIFICATION.md` - Frontend verification

---

## 🆘 Common Issues

**Port already in use:**
```bash
# Change PORT in .env to 5001 or 3000
```

**MongoDB connection error:**
```bash
# Use the URI already in server.js (line 38)
```

**Firebase error:**
```bash
# Ensure nakshatra-service-account.json is in config/ folder
```

---

## ✨ You're All Set!

Backend is ready to reunite families! 🎉
