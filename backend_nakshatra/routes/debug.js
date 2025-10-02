const express = require('express');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Debug endpoint to test geospatial queries
router.post('/test-nearby', authenticate, async (req, res) => {
  try {
    const { coordinates, radius = 20 } = req.body; // [longitude, latitude], radius in km

    if (!coordinates || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide coordinates as [longitude, latitude]'
      });
    }

    console.log('\n🔍 ===== TESTING GEOSPATIAL QUERY =====');
    console.log(`📍 Test Location: [${coordinates[0]}, ${coordinates[1]}]`);
    console.log(`📏 Search Radius: ${radius} km`);

    // Get all users with locations
    const allUsers = await User.find({
      'location.coordinates': { $exists: true, $ne: [0, 0] }
    }).select('name location');

    console.log(`\n📊 All Users in Database:`);
    allUsers.forEach((user, index) => {
      const distance = calculateDistance(
        coordinates[1], coordinates[0],
        user.location.coordinates[1], user.location.coordinates[0]
      );
      console.log(`   ${index + 1}. ${user.name}`);
      console.log(`      Location: [${user.location.coordinates[0]}, ${user.location.coordinates[1]}]`);
      console.log(`      Distance: ${distance.toFixed(2)} km`);
      console.log(`      Within ${radius}km? ${distance <= radius ? '✅ YES' : '❌ NO'}`);
    });

    // Test geospatial query
    const nearbyUsers = await User.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      }
    }).select('name location');

    console.log(`\n📊 Geospatial Query Results:`);
    console.log(`   Found ${nearbyUsers.length} users within ${radius}km`);

    const response = {
      success: true,
      testLocation: {
        coordinates,
        radius: `${radius} km`
      },
      allUsers: allUsers.map(user => ({
        name: user.name,
        location: user.location.coordinates,
        distance: calculateDistance(
          coordinates[1], coordinates[0],
          user.location.coordinates[1], user.location.coordinates[0]
        ).toFixed(2) + ' km',
        withinRadius: calculateDistance(
          coordinates[1], coordinates[0],
          user.location.coordinates[1], user.location.coordinates[0]
        ) <= radius
      })),
      nearbyUsers: nearbyUsers.map(user => ({
        name: user.name,
        location: user.location.coordinates,
        distance: calculateDistance(
          coordinates[1], coordinates[0],
          user.location.coordinates[1], user.location.coordinates[0]
        ).toFixed(2) + ' km'
      })),
      geospatialQueryWorking: true
    };

    console.log('========================================\n');

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Debug test error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug test failed',
      error: error.message
    });
  }
});

// Get all users with their locations
router.get('/all-users-locations', authenticate, async (req, res) => {
  try {
    const users = await User.find({}).select('name email location fcmToken');

    const usersWithDistance = users.map(user => {
      let hasValidLocation = false;
      let locationInfo = 'No location set';

      if (user.location && user.location.coordinates && 
          user.location.coordinates.length === 2 &&
          (user.location.coordinates[0] !== 0 || user.location.coordinates[1] !== 0)) {
        hasValidLocation = true;
        locationInfo = `[${user.location.coordinates[0]}, ${user.location.coordinates[1]}]`;
      }

      return {
        name: user.name,
        email: user.email,
        hasValidLocation,
        location: locationInfo,
        address: user.location?.address || 'N/A',
        hasFCMToken: !!user.fcmToken
      };
    });

    res.status(200).json({
      success: true,
      totalUsers: users.length,
      usersWithLocation: usersWithDistance.filter(u => u.hasValidLocation).length,
      usersWithFCM: usersWithDistance.filter(u => u.hasFCMToken).length,
      users: usersWithDistance
    });

  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: error.message
    });
  }
});

module.exports = router;
