const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

class MotionPatternAnalyzer {
  /**
   * Analyze a motion sequence to detect artificial patterns
   * @param {Array<number>} motionSequence - Array of motion sensor values
   * @returns {Promise<Object>} Prediction result
   */
  static async analyzePattern(motionSequence) {
    try {
      const response = await axios.post(
        `${ML_SERVICE_URL}/api/predict`,
        { motion_sequence: motionSequence },
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('ML Service Error:', error.message);
      // Fallback to simple heuristic if ML service unavailable
      return this._fallbackAnalysis(motionSequence);
    }
  }

  /**
   * Analyze a single motion value
   * @param {number} motionValue - Single motion sensor value
   * @returns {Promise<Object>} Prediction result
   */
  static async analyzeSingleMotion(motionValue) {
    try {
      const response = await axios.post(
        `${ML_SERVICE_URL}/api/predict-single`,
        { motion_value: motionValue },
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('ML Service Error:', error.message);
      return this._fallbackAnalysis([motionValue]);
    }
  }

  /**
   * Fallback heuristic analysis if ML service is unavailable
   * @private
   */
  static _fallbackAnalysis(motionSequence) {
    const arr = motionSequence.map(v => parseFloat(v));
    
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    const std = Math.sqrt(variance);
    
    // Detect artificial patterns through heuristics
    const diffs = [];
    for (let i = 1; i < arr.length; i++) {
      diffs.push(Math.abs(arr[i] - arr[i - 1]));
    }
    
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const diffStd = Math.sqrt(
      diffs.reduce((sum, val) => sum + Math.pow(val - avgDiff, 2), 0) / diffs.length
    );
    
    // Count spikes (artificial patterns have many sudden changes)
    const threshold = avgDiff + 2 * diffStd;
    const spikeCount = diffs.filter(d => d > threshold).length;
    
    // Artificial patterns have high variability and frequent spikes
    const isArtificial = (std > 8000 || spikeCount > arr.length / 3);
    const confidence = Math.min(0.95, Math.max(0.5, (spikeCount / arr.length) * 1.5));
    
    return {
      prediction: isArtificial ? 1 : 0,
      label: isArtificial ? 'Artificial' : 'Genuine',
      confidence: confidence,
      genuine_probability: isArtificial ? 1 - confidence : confidence,
      artificial_probability: isArtificial ? confidence : 1 - confidence,
      features: {
        motion_value: mean,
        motion_variance: variance,
        motion_std: std,
        spike_count: spikeCount
      }
    };
  }

  /**
   * Check ML service health
   */
  static async checkHealth() {
    try {
      const response = await axios.get(`${ML_SERVICE_URL}/api/health`, {
        timeout: 3000
      });
      return response.data;
    } catch (error) {
      return {
        status: 'unavailable',
        error: error.message
      };
    }
  }
}

module.exports = MotionPatternAnalyzer;
