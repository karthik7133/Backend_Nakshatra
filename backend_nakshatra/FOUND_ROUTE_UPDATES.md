# Found Routes - Push Notification Updates

## Update 1: Send Notification to Parent (After Found Report Submission)

**File:** `routes/found.js`
**Location:** After line 72 (after `await notification.save();`)

### Add this code:

```javascript
await notification.save();

// 🔔 Send Push Notification to Parent
const parent = await User.findById(missingReport.reportedBy._id);
if (parent && parent.fcmToken) {
  try {
    await admin.messaging().send({
      notification: {
        title: `Possible Match Found for ${missingReport.name}`,
        body: `Someone reported finding a child matching your description. Please verify immediately!`
      },
      data: {
        type: 'found_alert',
        foundId: foundReport._id.toString(),
        missingId: missingId.toString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      token: parent.fcmToken
    });
    console.log('✅ Push notification sent to parent');
  } catch (fcmError) {
    console.error('❌ FCM Error sending to parent:', fcmError);
  }
}
```

---

## Update 2: Send Notification to Finder (After Verification)

**File:** `routes/found.js`
**Location:** After line 238 (after `await notification.save();` in the verification section)

### Add this code:

```javascript
await notification.save();

// 🔔 Send Push Notification to Finder
const finder = await User.findById(foundReport.foundBy);
if (finder && finder.fcmToken) {
  try {
    await admin.messaging().send({
      notification: {
        title: 'Your Found Report Verified!',
        body: `Thank you for your help! The family confirmed you found their missing child. You've helped reunite a family!`
      },
      data: {
        type: 'verification_confirmed',
        foundId: foundReport._id.toString(),
        missingId: foundReport.missingId._id.toString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      token: finder.fcmToken
    });
    console.log('✅ Verification notification sent to finder');
  } catch (fcmError) {
    console.error('❌ FCM Error sending to finder:', fcmError);
  }
}
```

---

## Complete Updated Section (For Reference)

Here's how the complete found report submission section should look:

```javascript
// Submit found report
router.post('/', authenticate, [
  body('missingId').isMongoId().withMessage('Valid missing report ID required'),
  body('photoUrl').isURL().withMessage('Valid photo URL required'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('locationFound.coordinates').isArray({ min: 2, max: 2 }).withMessage('Coordinates required [longitude, latitude]'),
  body('locationFound.address').trim().isLength({ min: 5, max: 200 }).withMessage('Address must be 5-200 characters'),
  body('contactNumber').matches(/^[0-9]{10}$/).withMessage('Valid 10-digit contact number required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { missingId, photoUrl, description, locationFound, contactNumber } = req.body;

    // Verify missing report exists and is active
    const missingReport = await MissingReport.findById(missingId)
      .populate('reportedBy', 'name email fcmToken');

    if (!missingReport) {
      return res.status(404).json({
        success: false,
        message: 'Missing report not found'
      });
    }

    if (missingReport.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This missing case is no longer active'
      });
    }

    const foundReport = new FoundReport({
      missingId,
      photoUrl,
      description,
      locationFound,
      foundBy: req.user._id,
      contactNumber
    });

    await foundReport.save();

    // Create notification for the family
    const notification = new Notification({
      type: 'found_alert',
      title: `Possible Match Found for ${missingReport.name}`,
      message: `Someone has reported finding a child matching ${missingReport.name}'s description. Please check the found report and verify if this is your child.`,
      targetUsers: [missingReport.reportedBy._id],
      relatedMissingId: missingId,
      relatedFoundId: foundReport._id,
      priority: 'urgent'
    });

    await notification.save();

    // 🔔 Send Push Notification to Parent
    const parent = await User.findById(missingReport.reportedBy._id);
    if (parent && parent.fcmToken) {
      try {
        await admin.messaging().send({
          notification: {
            title: `Possible Match Found for ${missingReport.name}`,
            body: `Someone reported finding a child matching your description. Please verify immediately!`
          },
          data: {
            type: 'found_alert',
            foundId: foundReport._id.toString(),
            missingId: missingId.toString(),
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          token: parent.fcmToken
        });
        console.log('✅ Push notification sent to parent');
      } catch (fcmError) {
        console.error('❌ FCM Error sending to parent:', fcmError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Found report submitted successfully. The family has been notified.',
      foundId: foundReport._id
    });

  } catch (error) {
    console.error('Create found report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit found report',
      error: error.message
    });
  }
});
```

---

## Testing Push Notifications

### Test 1: Found Report Submission
```bash
POST http://localhost:5000/api/found
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "missingId": "VALID_MISSING_REPORT_ID",
  "photoUrl": "https://cloudinary.com/image.jpg",
  "description": "Found a child matching the description",
  "locationFound": {
    "coordinates": [73.8120, 15.5937],
    "address": "Near City Center"
  },
  "contactNumber": "9876543210"
}
```

**Expected Result:**
- Found report created
- Database notification created
- FCM push notification sent to parent's device

### Test 2: Verification
```bash
PATCH http://localhost:5000/api/found/FOUND_REPORT_ID/verify
Authorization: Bearer PARENT_TOKEN
Content-Type: application/json

{
  "verifiedByParent": true,
  "verificationNotes": "Yes, this is my child. Thank you!"
}
```

**Expected Result:**
- Found report status updated to 'verified'
- Missing report status updated to 'found'
- Database notification created for finder
- FCM push notification sent to finder's device

---

## Troubleshooting

### Issue: FCM Error - Invalid Token
**Cause:** User's FCM token is invalid or expired
**Solution:** Token will be automatically refreshed on next app login

### Issue: FCM Error - Service Account
**Cause:** Firebase service account not configured
**Solution:** Ensure `config/nakshatra-service-account.json` exists

### Issue: No Notification Received
**Cause:** User doesn't have FCM token saved
**Solution:** Ensure user logs in after FCM setup to save token

---

## Notification Data Structure

All FCM notifications include:

```javascript
{
  notification: {
    title: "...",  // Shown in notification tray
    body: "..."    // Notification message
  },
  data: {
    type: "...",              // missing_alert | found_alert | verification_confirmed
    foundId: "...",           // MongoDB ObjectId
    missingId: "...",         // MongoDB ObjectId
    click_action: "FLUTTER_NOTIFICATION_CLICK"
  },
  token: "..."  // User's FCM token
}
```

The Flutter app handles these in `firebase_message.dart` and navigates accordingly.
