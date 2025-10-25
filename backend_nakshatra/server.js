const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const missingRoutes = require('./routes/missing');
const foundRoutes = require('./routes/found');
const notificationRoutes = require('./routes/notification');
const adminRoutes = require('./routes/admin');
const fcmService = require('./services/fcm_service');

const app = express();
const server = http.createServer(app);

// Trust proxy - required when running behind a reverse proxy (like Render, Heroku, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// === CRITICAL CORS FIX ===
const allowedOrigins = [
  // 1. Your Netlify Admin Panel URL
  'https://extraordinary-madeleine-c66704.netlify.app',
  // 2. Your Render API URL (Required if the API makes requests to itself or if used as a secondary access point)
  'https://nakshatra-km-73.onrender.com', 
  // 3. Environment variable (your Flutter app client)
  process.env.CLIENT_URL, 
  // 4. Local development fallbacks
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Clean up origin check for better reliability
    const isAllowed = !origin || allowedOrigins.includes(origin) || allowedOrigins.includes(origin.replace(/\/$/, ''));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked:', origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true
}));
// === END CRITICAL CORS FIX ===


// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection (Using hardcoded URI is generally discouraged, but kept for context)
const MONGODB_URI = 'mongodb+srv://karthik7133:Ch.karthik.7@cluster7133.yzxk6k4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster7133';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/missing', missingRoutes);
app.use('/api/found', foundRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/debug', require('./routes/debug'));

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running properly',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

// Socket.IO setup for video calling
const io = new Server(server, {
  cors: {
    // Using the same list of origins for Socket.IO is safer than "*"
    origin: allowedOrigins, 
    methods: ["GET", "POST"]
  }
});

// Store active users and their socket connections
const activeUsers = new Map();
const activeCalls = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // User registration
  socket.on('register-user', (userId) => {
    activeUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`👤 User registered: ${userId} with socket ${socket.id}`);
  });

  // Initiate call
  socket.on('call-user', async (data) => {
    const { targetUserId, callerInfo, offer } = data;
    const targetSocketId = activeUsers.get(targetUserId);
    
    // Store call information
    const callId = `${socket.userId}_${targetUserId}_${Date.now()}`;
    activeCalls.set(callId, {
      caller: socket.userId,
      receiver: targetUserId,
      status: 'ringing',
      startTime: Date.now()
    });

    const callData = {
      callId,
      caller: callerInfo,
      offer,
      isVideo: callerInfo.isVideo || false
    };
    
    if (targetSocketId) {
      // User is online - send real-time notification
      io.to(targetSocketId).emit('incoming-call', callData);
      console.log(`📞 Call initiated from ${socket.userId} to ${targetUserId} (online)`);
    } else {
      // User is offline - send FCM push notification
      console.log(`📞 Call initiated from ${socket.userId} to ${targetUserId} (offline - sending FCM)`);
      
      try {
        const fcmResult = await fcmService.sendCallNotification(
          targetUserId,
          callerInfo,
          {
            callId,
            offer,
            isVideo: callerInfo.isVideo || false
          }
        );
        
        if (!fcmResult.success) {
          socket.emit('call-failed', { message: 'User not available for calls' });
          activeCalls.delete(callId);
          return;
        }
      } catch (error) {
        console.error('❌ FCM notification failed:', error);
        socket.emit('call-failed', { message: 'Failed to notify user' });
        activeCalls.delete(callId);
        return;
      }
    }

    // Set call timeout (30 seconds)
    setTimeout(() => {
      const call = activeCalls.get(callId);
      if (call && call.status === 'ringing') {
        // Call timed out - send missed call notification
        fcmService.sendMissedCallNotification(
          targetUserId,
          callerInfo,
          callerInfo.isVideo || false
        );
        
        activeCalls.delete(callId);
        socket.emit('call-timeout', { message: 'Call timed out' });
        console.log(`⏰ Call timed out: ${callId}`);
      }
    }, 30000);
  });

  // Answer call
  socket.on('answer-call', (data) => {
    const { callId, answer } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      const callerSocketId = activeUsers.get(call.caller);
      if (callerSocketId) {
        call.status = 'connected';
        activeCalls.set(callId, call);
        
        io.to(callerSocketId).emit('call-answered', { answer });
        console.log(`✅ Call answered: ${callId}`);
      }
    }
  });

  // Reject call
  socket.on('reject-call', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      const callerSocketId = activeUsers.get(call.caller);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-rejected');
        activeCalls.delete(callId);
        console.log(`❌ Call rejected: ${callId}`);
      }
    }
  });

  // End call
  socket.on('end-call', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      const otherUserId = call.caller === socket.userId ? call.receiver : call.caller;
      const otherSocketId = activeUsers.get(otherUserId);
      
      if (otherSocketId) {
        io.to(otherSocketId).emit('call-ended');
      }
      
      activeCalls.delete(callId);
      console.log(`📴 Call ended: ${callId}`);
    }
  });

  // ICE candidate exchange
  socket.on('ice-candidate', (data) => {
    const { targetUserId, candidate } = data;
    const targetSocketId = activeUsers.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate,
        from: socket.userId
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      
      // End any active calls
      for (const [callId, call] of activeCalls.entries()) {
        if (call.caller === socket.userId || call.receiver === socket.userId) {
          const otherUserId = call.caller === socket.userId ? call.receiver : call.caller;
          const otherSocketId = activeUsers.get(otherUserId);
          
          if (otherSocketId) {
            io.to(otherSocketId).emit('call-ended');
          }
          
          activeCalls.delete(callId);
        }
      }
      
      console.log(`🔌 User disconnected: ${socket.userId}`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Missing Person API is ready to help reunite families`);
  console.log(`🎥 Video calling service is active`);
});