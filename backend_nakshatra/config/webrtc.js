// WebRTC Configuration with STUN/TURN servers
const webrtcConfig = {
  iceServers: [
    // Google STUN servers (free)
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    },
    // Additional free STUN servers for redundancy
    {
      urls: 'stun:stun.stunprotocol.org:3478'
    },
    {
      urls: 'stun:stun.voiparound.com'
    },
    {
      urls: 'stun:stun.voipbuster.com'
    },
    // TURN server configuration (uncomment and configure when you set up coturn)
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'your-username',
    //   credential: 'your-password'
    // }
  ],
  iceCandidatePoolSize: 10
};

// Media constraints for video/audio calls
const mediaConstraints = {
  video: {
    width: { min: 320, ideal: 640, max: 1280 },
    height: { min: 240, ideal: 480, max: 720 },
    frameRate: { min: 15, ideal: 30, max: 30 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

// Audio-only constraints
const audioOnlyConstraints = {
  video: false,
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

module.exports = {
  webrtcConfig,
  mediaConstraints,
  audioOnlyConstraints
};
