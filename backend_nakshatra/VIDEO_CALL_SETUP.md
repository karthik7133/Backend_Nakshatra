# 🎥 Video Call Service Setup Guide for Nakshatra

## 📋 Overview
This guide provides complete setup instructions for the video/voice calling feature in your Nakshatra app, allowing parents to directly contact finders through WebRTC technology.

## 🚀 Backend Setup

### 1. Install Dependencies
```bash
cd C:\Users\chipi\OneDrive\Desktop\backend\backend_nakshatra
npm install socket.io
```

### 2. Start the Server
```bash
npm start
# or for development
npm run dev
```

The signaling server is now running with Socket.IO on your existing port (5000 or your configured PORT).

### 3. WebRTC Configuration
- **STUN Servers**: Google STUN servers are configured for free NAT traversal
- **TURN Servers**: Optional - set up coturn server for better connectivity behind firewalls
- Configuration file: `config/webrtc.js`

## 📱 Flutter Setup

### 1. Install Dependencies
```bash
cd d:\AndroidStudioProjects\Nakshatra
flutter pub get
```

### 2. Required Permissions
The following permissions have been added:

**Android** (`android/app/src/main/AndroidManifest.xml`):
- `CAMERA` - For video calls
- `RECORD_AUDIO` - For voice communication
- `MODIFY_AUDIO_SETTINGS` - For audio control
- `WAKE_LOCK` - Keep screen awake during calls

**iOS** (`ios/Runner/Info.plist`):
- `NSCameraUsageDescription` - Camera access
- `NSMicrophoneUsageDescription` - Microphone access

### 3. Build and Run
```bash
flutter clean
flutter pub get
flutter run
```

## 🎯 How It Works

### Call Flow:
1. **Parent** views found report details
2. **Parent** taps "Voice Call" or "Video Call" button
3. **Permission check** - Camera/microphone permissions requested
4. **Call initiation** - Outgoing call screen appears
5. **Signaling** - WebRTC offer sent through Socket.IO
6. **Finder receives** - Incoming call notification (if online)
7. **Connection** - WebRTC peer-to-peer connection established
8. **Communication** - Direct audio/video communication

### Key Components:

#### Backend Services:
- **Socket.IO Signaling Server** (`server.js`)
- **WebRTC Configuration** (`config/webrtc.js`)

#### Flutter Services:
- **SocketService** - Handles signaling communication
- **WebRTCService** - Manages peer connections and media
- **CallService** - Orchestrates call flow
- **PermissionService** - Handles camera/microphone permissions

#### UI Screens:
- **IncomingCallScreen** - WhatsApp-style incoming call UI
- **OutgoingCallScreen** - Calling animation and controls
- **VideoCallScreen** - Full-screen video call interface

## 🔧 Configuration

### Backend URL Configuration
Update the server URL in `lib/services/socket_service.dart`:
```dart
const String serverUrl = 'https://nakshatra-km-73.onrender.com';
```

### STUN/TURN Servers
Modify `config/webrtc.js` to add your TURN server:
```javascript
{
  urls: 'turn:your-turn-server.com:3478',
  username: 'your-username',
  credential: 'your-password'
}
```

## 🎨 UI Features

### WhatsApp/Instagram Inspired Design:
- **Incoming Call**: Pulse animations, slide transitions
- **Video Call**: Picture-in-picture, tap-to-hide controls
- **Outgoing Call**: Loading rings, pulse effects
- **Controls**: Mute, video toggle, camera switch, end call

### Professional Animations:
- Smooth page transitions
- Pulse effects for incoming calls
- Loading animations
- Professional easing curves

## 🔒 Security Features

### Permission Handling:
- Runtime permission requests
- User-friendly permission dialogs
- Settings redirect for denied permissions
- Graceful fallbacks

### WebRTC Security:
- Peer-to-peer encryption
- STUN server validation
- Connection timeout handling
- Proper cleanup on disconnect

## 🧪 Testing

### Test Call Flow:
1. **Two devices** with the app installed
2. **Both users** logged in and online
3. **One user** views found report and initiates call
4. **Other user** should receive incoming call notification
5. **Accept call** to establish connection
6. **Test controls** - mute, video toggle, camera switch

### Debug Information:
- Check browser console for WebRTC logs
- Monitor Socket.IO connection status
- Verify permissions are granted
- Check network connectivity

## 🚨 Troubleshooting

### Common Issues:

#### 1. Call Not Connecting
- Check internet connection
- Verify Socket.IO server is running
- Ensure both users are online
- Check firewall settings

#### 2. No Audio/Video
- Verify permissions are granted
- Check device camera/microphone
- Test with different devices
- Check WebRTC constraints

#### 3. Poor Call Quality
- Check network bandwidth
- Consider adding TURN server
- Optimize video resolution
- Test on different networks

### Debug Commands:
```bash
# Check server logs
npm start

# Flutter debug
flutter run --verbose

# Check permissions
adb shell dumpsys package com.example.nakshatra | grep permission
```

## 📈 Future Enhancements

### Planned Features:
1. **Push Notifications** - FCM for offline call notifications ✅ COMPLETED
2. **Call History** - Track call logs and duration
3. **Screen Sharing** - Share screen during calls
4. **Group Calls** - Multiple participants
5. **Call Recording** - Record important conversations
6. **Chat Integration** - Text messages during calls

### Performance Optimizations:
1. **Adaptive Bitrate** - Adjust quality based on network
2. **Echo Cancellation** - Improved audio processing
3. **Background Mode** - Continue calls when app backgrounded
4. **Battery Optimization** - Reduce power consumption

## 📞 Support

### Contact Information:
- **Developer**: Karthik
- **Project**: Nakshatra - Missing Person Finder
- **Purpose**: Reunite families through technology

### Resources:
- [WebRTC Documentation](https://webrtc.org/)
- [Socket.IO Guide](https://socket.io/docs/)
- [Flutter WebRTC Plugin](https://pub.dev/packages/flutter_webrtc)

---

**Note**: This video calling feature is designed specifically to help reunite families with missing persons. The technology enables direct, secure communication between parents and finders, facilitating faster and more effective reunification processes.

## 🎯 Success Metrics

### Key Performance Indicators:
- **Call Success Rate**: >95% connection success
- **Audio Quality**: Clear voice communication
- **Video Quality**: Smooth video at 30fps
- **User Experience**: Intuitive, WhatsApp-like interface
- **Response Time**: <3 seconds call initiation
- **Reliability**: 24/7 availability

The implementation is now complete and ready for testing! 🚀
