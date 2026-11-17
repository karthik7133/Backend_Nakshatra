const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
// Removed: const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const http = require('http');
const { spawn } = require('child_process');
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

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Removed all rate limiting logic for testing
// ... (Lines 22-43 are removed/commented out)

// === CORS ===
const allowedOrigins = [
  'https://nakshatra-adminpanel.netlify.app',
  'https://nakshatra-km-73.onrender.com', 
  process.env.CLIENT_URL, 
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
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

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
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

// ⚠️ CRITICAL: Define analyzer route BEFORE other routes
// ✅ Text Analyzer endpoint
app.post('/api/analyze', (req, res) => {
  // Log only text
  console.log('📥 Analyzer request received:', { text: req.body.text?.substring(0, 50) });
  
  const { text } = req.body; // Only destructure text
  
  if (!text) { // Only check if text is present
    return res.status(400).json({ 
      success: false, 
      message: 'Text is required' // Updated message
    });
  }

  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    // Only pass 'text' argument to the Python script
    const python = spawn(pythonCmd, ['analyzer.py', text]); 

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('⚠️ Python stderr:', data.toString());
    });

    python.on('error', (error) => {
      console.error('❌ Failed to start Python process:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to start analyzer. Ensure Python is installed.',
        error: error.message 
      });
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Python process exited with code:', code);
        console.error('Error output:', errorOutput);
        return res.status(500).json({ 
          success: false, 
          message: 'Analyzer execution failed',
          error: errorOutput || 'Unknown error'
        });
      }

      output = output.trim();
      console.log('✅ Analysis result:', output);
      
      return res.json({ 
        success: true, 
        result: output
      });
    });
  } catch (err) {
    console.error('❌ Analyzer execution error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Analyzer failed to execute',
      error: err.message 
    });
  }
});

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running properly',
    timestamp: new Date().toISOString()
  });
});

// All other routes AFTER analyzer
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/missing', missingRoutes);
app.use('/api/found', foundRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/debug', require('./routes/debug'));

// ⚠️ IMPORTANT: 404 handler MUST be AFTER all routes
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler (MUST be last)
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
    origin: allowedOrigins, 
    methods: ["GET", "POST"]
  }
});

// Store active users and their socket connections
const activeUsers = new Map();
const activeCalls = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('register-user', (userId) => {
    activeUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`👤 User registered: ${userId} with socket ${socket.id}`);
  });

  socket.on('call-user', async (data) => {
    const { targetUserId, callerInfo, offer } = data;
    const targetSocketId = activeUsers.get(targetUserId);
    
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
      io.to(targetSocketId).emit('incoming-call', callData);
      console.log(`📞 Call initiated from ${socket.userId} to ${targetUserId} (online)`);
    } else {
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

    setTimeout(() => {
      const call = activeCalls.get(callId);
      if (call && call.status === 'ringing') {
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

  socket.on('disconnect', () => {
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      
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
  console.log(`🔍 Text analyzer service is enabled at POST /api/analyze (Simple meaningfulness check)`);
});
