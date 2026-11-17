// utils/faceRecognition.js
const axios = require('axios');

// Base URL for Face++ API
const BASE_URL = 'https://api-us.faceplusplus.com/facepp/v3';

/**
 * Helper function to interpret Face++ confidence score into a match strength.
 * @param {number} confidence The confidence score from the API (0-100).
 * @returns {string} Match strength string.
 */
function getMatchStrength(confidence) {
  if (confidence >= 80) return 'Strong Match';
  if (confidence >= 50) return 'Moderate Match';
  return 'Weak Match';
}

/**
 * Compares two faces using the Face++ Compare API.
 * @param {string} url1 The photo URL from the MissingReport (target image).
 * @param {string} url2 The photo URL from the FoundReport (image to compare).
 * @returns {Promise<{confidence: number, strength: string, message: string}>}
 */
async function compareFaces(url1, url2) {
  const apiKey = process.env.FACEPLUSPLUS_API_KEY;
  const apiSecret = process.env.FACEPLUSPLUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('⚠️ Face++ API keys are not set in environment variables. Skipping comparison.');
    return {
      confidence: 0,
      strength: 'No Comparison',
      message: 'Face comparison skipped: API keys missing.'
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('api_key', apiKey);
    formData.append('api_secret', apiSecret);
    formData.append('image_url1', url1);
    formData.append('image_url2', url2);

    const response = await axios.post(`${BASE_URL}/compare`, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const result = response.data;

    // Check if faces were detected in both images
    if (result.faces1.length === 0 || result.faces2.length === 0) {
      return {
        confidence: 0,
        strength: 'No Face Detected',
        message: 'Face comparison failed: One or both photos do not contain a detectable face.'
      };
    }

    // Get the confidence score and format it
    const confidence = parseFloat(result.confidence.toFixed(2));
    const strength = getMatchStrength(confidence);

    return {
      confidence,
      strength,
      message: `Match confidence: ${confidence}%. Strength: ${strength}.`
    };

  } catch (error) {
    console.error('❌ Face++ API Comparison Error:', error.response ? error.response.data : error.message);
    const errorMessage = error.response && error.response.data ? (error.response.data.error_message || 'Unknown API error') : 'Network or configuration error';
    return {
      confidence: 0,
      strength: 'Error',
      message: `Face comparison failed: ${errorMessage}`
    };
  }
}

// 🎯 CRITICAL FIX: Export the function, not a router.
module.exports = { compareFaces };
