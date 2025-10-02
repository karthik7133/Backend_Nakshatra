# Missing Person Finder - Backend API

A comprehensive Node.js/Express backend API for a missing person finder application (NAKSHATRA). This system helps reunite families by enabling users to report missing children and allowing community members to report found children.

## Features

- **User Authentication**: Secure JWT-based authentication with role management (user/admin)
- **Missing Reports**: Create, view, update, and manage missing person reports
- **Found Reports**: Submit and verify found person reports with photo evidence
- **Real-time Notifications**: Notify parents when someone reports finding their missing child
- **Location-based Search**: Find missing reports and nearby users using geospatial queries
- **Image Upload**: Cloudinary integration for profile and report photos
- **FCM Push Notifications**: Firebase Cloud Messaging support for mobile notifications

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Image Storage**: Cloudinary
- **Security**: Helmet, CORS, bcryptjs, express-rate-limit
- **Validation**: express-validator

## Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB instance
- Cloudinary account (for image uploads)
- Firebase project (optional, for push notifications)

## Installation

1. **Clone the repository**
   ```bash
   cd C:\Users\chipi\OneDrive\Desktop\backend\MissingPerson-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`
   ```bash
   copy .env.example .env
   ```
   - Update the `.env` file with your actual credentials:
     - MongoDB connection string
     - JWT secret key
     - Cloudinary credentials
     - Other configuration values

4. **Start the server**
   
   Development mode (with nodemon):
   ```bash
   npm run dev
   ```
   
   Production mode:
   ```bash
   npm start
   ```

The server will start on `http://localhost:5000` (or the PORT specified in .env)

## API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | User login | No |
| POST | `/logout` | User logout | Yes |
| GET | `/verify` | Verify JWT token | Yes |
| POST | `/upload-profile` | Upload profile photo | No |
| POST | `/update-fcm-token` | Update FCM token | Yes |

### User Routes (`/api/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/:userId` | Get user profile | Yes |
| PUT | `/:userId` | Update user profile | Yes (Owner) |
| DELETE | `/:userId` | Delete user account | Yes (Owner) |
| POST | `/update-location` | Update user location | Yes |
| POST | `/nearby` | Find nearby users | Yes |

### Missing Report Routes (`/api/missing`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create missing report | Yes |
| GET | `/` | Get all missing reports (paginated) | Yes |
| GET | `/:missingId` | Get specific missing report | Yes |
| GET | `/user/:userId` | Get user's missing reports | Yes |
| PUT | `/:missingId` | Update missing report | Yes (Owner) |
| DELETE | `/:missingId` | Delete missing report | Yes (Owner) |

### Found Report Routes (`/api/found`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Submit found report | Yes |
| GET | `/` | Get all found reports (paginated) | Yes |
| GET | `/:foundId` | Get specific found report | Yes |
| GET | `/missing/:missingId` | Get found reports for missing case | Yes |
| PATCH | `/:foundId/verify` | Verify found report (parent only) | Yes |
| DELETE | `/:foundId` | Delete found report | Yes (Owner) |

### Notification Routes (`/api/notifications`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get user notifications (paginated) | Yes |
| GET | `/:notificationId` | Get specific notification | Yes |
| GET | `/count/unread` | Get unread notification count | Yes |
| POST | `/` | Create notification (system/admin) | Yes |
| DELETE | `/:notificationId` | Delete notification | Yes |

## Data Models

### User
- name, email, phoneNumber, passwordHash
- role (user/admin)
- profilePhotoUrl, fcmToken
- location (GeoJSON Point with address)

### MissingReport
- name, age, gender, photoUrl
- description, contactNumber
- lastSeenLocation (GeoJSON Point)
- reportedBy (User reference)
- status (active/found/closed)

### FoundReport
- missingId (MissingReport reference)
- photoUrl, description, contactNumber
- locationFound (GeoJSON Point)
- foundBy (User reference)
- verifiedByParent, verificationNotes
- status (pending/verified/rejected)

### Notification
- type (missing_alert/found_alert/verification_request/system_update)
- title, message, priority
- targetUsers (array of User references)
- relatedMissingId, relatedFoundId
- isRead (array of userId and readAt)

## Security Features

- Password hashing with bcryptjs (12 salt rounds)
- JWT token-based authentication
- Rate limiting (100 requests per 15 minutes)
- Helmet for security headers
- CORS configuration
- Input validation with express-validator
- Ownership verification for sensitive operations

## Environment Variables

See `.env.example` for all required environment variables.

## Project Structure

```
MissingPerson-main/
├── models/
│   ├── User.js
│   ├── MissingReport.js
│   ├── FoundReport.js
│   ├── Notification.js
│   └── Admin.js
├── routes/
│   ├── auth.js
│   ├── user.js
│   ├── missing.js
│   ├── found.js
│   ├── notification.js
│   └── admin.js
├── middleware/
│   └── auth.js
├── .env
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Error Handling

All endpoints return consistent JSON responses:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ]
}
```

## Contributing

This is a humanitarian project aimed at helping reunite families. Contributions are welcome!

## License

MIT License

## Author

Karthik

## Support

For issues or questions, please create an issue in the repository.
