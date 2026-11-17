const admin = require('firebase-admin');
const User = require('../models/User');

class FCMService {
  constructor() {
    // Firebase Admin should already be initialized in your app
    this.messaging = admin.messaging();
  }

  // Send call notification to a user
  async sendCallNotification(targetUserId, callerInfo, callData) {
    try {
      // Get target user's FCM token
      const targetUser = await User.findById(targetUserId).select('fcmToken name');
      
      if (!targetUser || !targetUser.fcmToken) {
        console.log(`❌ No FCM token found for user: ${targetUserId}`);
        return { success: false, message: 'User not available for notifications' };
      }

      const isVideoCall = callData.isVideo || false;
      
      // Prepare notification payload
      const message = {
        token: targetUser.fcmToken,
        notification: {
          title: `📞 Incoming ${isVideoCall ? 'Video' : 'Voice'} Call`,
          body: `${callerInfo.name} is calling you`,
        },
        data: {
          type: 'incoming_call',
          callId: callData.callId,
          callerName: callerInfo.name || 'Unknown',
          callerProfilePicture: callerInfo.profilePicture || '',
          callerPhone: callerInfo.phone || '',
          isVideoCall: isVideoCall.toString(),
          offer: JSON.stringify(callData.offer || {}),
          timestamp: Date.now().toString(),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'nakshatra_calls',
            priority: 'max',
            defaultSound: true,
            defaultVibrateTimings: true,
            category: 'call',
            visibility: 'public',
          },
          ttl: 30000, // 30 seconds TTL for call notifications
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-expiration': Math.floor(Date.now() / 1000) + 30, // 30 seconds
          },
          payload: {
            aps: {
              alert: {
                title: `📞 Incoming ${isVideoCall ? 'Video' : 'Voice'} Call`,
                body: `${callerInfo.name} is calling you`,
              },
              sound: 'call_ringtone.wav',
              category: 'CALL_CATEGORY',
              'content-available': 1,
            },
          },
        },
      };

      // Send the notification
      const response = await this.messaging.send(message);
      
      console.log(`✅ Call notification sent successfully to ${targetUser.name}:`, response);
      
      return { 
        success: true, 
        messageId: response,
        message: 'Call notification sent successfully' 
      };

    } catch (error) {
      console.error('❌ Error sending call notification:', error);
      
      // Handle invalid FCM token
      if (error.code === 'messaging/registration-token-not-registered' || 
          error.code === 'messaging/invalid-registration-token') {
        
        // Remove invalid FCM token from user
        await User.findByIdAndUpdate(targetUserId, { $unset: { fcmToken: 1 } });
        console.log(`🗑️ Removed invalid FCM token for user: ${targetUserId}`);
      }
      
      return { 
        success: false, 
        message: 'Failed to send call notification',
        error: error.message 
      };
    }
  }

  // Send call ended notification
  async sendCallEndedNotification(targetUserId, callerName) {
    try {
      const targetUser = await User.findById(targetUserId).select('fcmToken name');
      
      if (!targetUser || !targetUser.fcmToken) {
        return { success: false, message: 'User not available for notifications' };
      }

      const message = {
        token: targetUser.fcmToken,
        notification: {
          title: 'Call Ended',
          body: `Call with ${callerName} has ended`,
        },
        data: {
          type: 'call_ended',
          callerName: callerName,
          timestamp: Date.now().toString(),
        },
        android: {
          priority: 'normal',
          notification: {
            channelId: 'nakshatra_alerts',
          },
        },
      };

      const response = await this.messaging.send(message);
      console.log(`✅ Call ended notification sent:`, response);
      
      return { success: true, messageId: response };

    } catch (error) {
      console.error('❌ Error sending call ended notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send missed call notification
  async sendMissedCallNotification(targetUserId, callerInfo, isVideoCall = false) {
    try {
      const targetUser = await User.findById(targetUserId).select('fcmToken name');
      
      if (!targetUser || !targetUser.fcmToken) {
        return { success: false, message: 'User not available for notifications' };
      }

      const message = {
        token: targetUser.fcmToken,
        notification: {
          title: `📞 Missed ${isVideoCall ? 'Video' : 'Voice'} Call`,
          body: `You missed a call from ${callerInfo.name}`,
        },
        data: {
          type: 'missed_call',
          callerName: callerInfo.name || 'Unknown',
          callerPhone: callerInfo.phone || '',
          isVideoCall: isVideoCall.toString(),
          timestamp: Date.now().toString(),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'nakshatra_alerts',
          },
        },
      };

      const response = await this.messaging.send(message);
      console.log(`✅ Missed call notification sent:`, response);
      
      return { success: true, messageId: response };

    } catch (error) {
      console.error('❌ Error sending missed call notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new FCMService();
