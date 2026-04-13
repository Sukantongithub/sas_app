/**
 * Motion ML Prediction Routes
 * Integrates ML predictions with Express backend
 * 
 * Usage in server.js:
 * const mlRoutes = require('./routes/motion-ml');
 * app.use('/api/ml', mlRoutes);
 */

const express = require('express');
const router = express.Router();
const { MotionMLMiddleware } = require('../middleware/motionMLMiddleware');

// Initialize ML middleware for this router
const mlService = new MotionMLMiddleware();

/**
 * Endpoint: POST /api/ml/predict
 * Single motion prediction
 * 
 * Request Body:
 * {
 *   "ax": 10.5,
 *   "ay": 0.8,
 *   "az": 1.9,
 *   "rssi": -55,
 *   "model": "random_forest" (optional)
 * }
 */
router.post('/predict', async (req, res) => {
  try {
    const { ax, ay, az, rssi, model } = req.body;

    // Validate required fields
    if (ax === undefined || ay === undefined || az === undefined || rssi === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: ax, ay, az, rssi'
      });
    }

    // Call ML API
    const result = await mlService.predict(ax, ay, az, rssi, model);

    if (!result.success) {
      return res.status(500).json({
        error: result.error
      });
    }

    return res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error in /predict:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: POST /api/ml/predict/ensemble
 * Ensemble prediction using all 3 models
 * 
 * Request Body:
 * {
 *   "ax": 10.5,
 *   "ay": 0.8,
 *   "az": 1.9,
 *   "rssi": -55
 * }
 */
router.post('/predict/ensemble', async (req, res) => {
  try {
    const { ax, ay, az, rssi } = req.body;

    if (ax === undefined || ay === undefined || az === undefined || rssi === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: ax, ay, az, rssi'
      });
    }

    const result = await mlService.predictEnsemble(ax, ay, az, rssi);

    if (!result.success) {
      return res.status(500).json({
        error: result.error
      });
    }

    return res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error in /predict/ensemble:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: POST /api/ml/predict/batch
 * Batch predictions on multiple samples
 * 
 * Request Body:
 * {
 *   "samples": [
 *     {"ax": 10.5, "ay": 0.8, "az": 1.9, "rssi": -55},
 *     {"ax": 5.2, "ay": 12.5, "az": 8.9, "rssi": -70}
 *   ],
 *   "model": "random_forest" (optional)
 * }
 */
router.post('/predict/batch', async (req, res) => {
  try {
    const { samples, model } = req.body;

    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({
        error: 'Samples must be a non-empty array'
      });
    }

    const result = await mlService.predictBatch(samples, model);

    if (!result.success && result.predictions === null) {
      return res.status(500).json({
        error: result.error
      });
    }

    return res.json({
      success: result.success,
      predictions: result.predictions,
      summary: result.summary,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error in /predict/batch:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: GET /api/ml/status
 * Get ML service status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await mlService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error in /status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: POST /api/ml/motion/analyze
 * Analyze motion data and get predictions
 * Integrates with existing motion recording
 * 
 * Request Body:
 * {
 *   "deviceId": "abc123",
 *   "ax": 10.5,
 *   "ay": 0.8,
 *   "az": 1.9,
 *   "rssi": -55,
 *   "timestamp": "2026-04-13T12:00:00Z"
 * }
 */
router.post('/motion/analyze', async (req, res) => {
  try {
    const { deviceId, ax, ay, az, rssi, timestamp } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        error: 'deviceId is required'
      });
    }

    if (ax === undefined || ay === undefined || az === undefined || rssi === undefined) {
      return res.status(400).json({
        error: 'Missing motion sensor data: ax, ay, az, rssi'
      });
    }

    // Get ensemble prediction
    const prediction = await mlService.predictEnsemble(ax, ay, az, rssi);

    if (!prediction.success) {
      return res.status(500).json({
        error: prediction.error
      });
    }

    // Could integrate with database here
    // await Motion.create({
    //   deviceId,
    //   ax, ay, az, rssi,
    //   prediction: prediction.data.ensemble_prediction,
    //   confidence: prediction.data.ensemble_confidence,
    //   timestamp: timestamp || new Date()
    // });

    return res.json({
      success: true,
      deviceId,
      prediction: prediction.data.ensemble_prediction,
      confidence: prediction.data.ensemble_confidence,
      details: prediction.data,
      analyzedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in /motion/analyze:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: POST /api/ml/motion/stream
 * Stream predictions for a series of motion readings
 * Useful for real-time motion tracking
 * 
 * Request Body:
 * {
 *   "deviceId": "abc123",
 *   "readings": [
 *     {"ax": 10.5, "ay": 0.8, "az": 1.9, "rssi": -55},
 *     {"ax": 9.2, "ay": 1.1, "az": 2.3, "rssi": -56}
 *   ]
 * }
 */
router.post('/motion/stream', async (req, res) => {
  try {
    const { deviceId, readings } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        error: 'deviceId is required'
      });
    }

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        error: 'readings must be a non-empty array'
      });
    }

    // Get batch predictions
    const predictions = await mlService.predictBatch(readings, 'random_forest');

    if (!predictions.success && predictions.predictions === null) {
      return res.status(500).json({
        error: predictions.error
      });
    }

    // Analyze predictions
    const analysisResult = {
      deviceId,
      totalReadings: predictions.summary.total,
      successfulPredictions: predictions.summary.successful,
      failedPredictions: predictions.summary.failed,
      predictions: predictions.predictions,
      summary: {
        natural_count: predictions.predictions.filter(p => p.prediction === 'natural').length,
        artificial_count: predictions.predictions.filter(p => p.prediction === 'artificial').length,
        average_confidence: (
          predictions.predictions.reduce((sum, p) => sum + p.confidence, 0) /
          predictions.predictions.length
        ).toFixed(2)
      },
      processedAt: new Date().toISOString()
    };

    return res.json({
      success: true,
      data: analysisResult
    });
  } catch (error) {
    console.error('Error in /motion/stream:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
