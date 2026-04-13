/**
 * Motion ML Prediction Middleware
 * Integrates with Python ML API Server for real-time motion prediction
 * Used in Express backend routes
 */

const axios = require('axios');
const logger = require('winston') || console;

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001';
const ML_API_TIMEOUT = parseInt(process.env.ML_API_TIMEOUT || '5000', 10);

class MotionMLMiddleware {
  constructor(apiUrl = ML_API_URL, timeout = ML_API_TIMEOUT) {
    this.apiUrl = apiUrl;
    this.timeout = timeout;
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.isHealthy = false;
    this.checkHealth();
  }

  /**
   * Check if ML API server is healthy
   */
  async checkHealth() {
    try {
      const response = await this.client.get('/health');
      this.isHealthy = response.status === 200;
      if (this.isHealthy) {
        console.log('✅ ML API Server is healthy');
        return true;
      }
    } catch (error) {
      this.isHealthy = false;
      console.warn('⚠️  ML API Server is not responding:', error.message);
      return false;
    }
  }

  /**
   * Make single prediction
   * @param {number} ax - X-axis acceleration
   * @param {number} ay - Y-axis acceleration
   * @param {number} az - Z-axis acceleration
   * @param {number} rssi - Signal strength
   * @param {string} model - Model name (default: random_forest)
   * @returns {Promise<Object>} Prediction result
   */
  async predict(ax, ay, az, rssi, model = 'random_forest') {
    try {
      if (!this.isHealthy) {
        // Attempt reconnection
        await this.checkHealth();
        if (!this.isHealthy) {
          throw new Error('ML API Server is not available');
        }
      }

      const response = await this.client.post('/api/motion/predict', {
        ax: parseFloat(ax),
        ay: parseFloat(ay),
        az: parseFloat(az),
        rssi: parseInt(rssi, 10),
        timestamp: new Date().toISOString(),
        model
      });

      return {
        success: true,
        data: response.data.data,
        error: null
      };
    } catch (error) {
      console.error('❌ Prediction error:', error.message);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  /**
   * Make ensemble prediction (all models)
   * @param {number} ax - X-axis acceleration
   * @param {number} ay - Y-axis acceleration
   * @param {number} az - Z-axis acceleration
   * @param {number} rssi - Signal strength
   * @returns {Promise<Object>} Ensemble prediction result
   */
  async predictEnsemble(ax, ay, az, rssi) {
    try {
      if (!this.isHealthy) {
        await this.checkHealth();
        if (!this.isHealthy) {
          throw new Error('ML API Server is not available');
        }
      }

      const response = await this.client.post('/api/motion/predict/ensemble', {
        ax: parseFloat(ax),
        ay: parseFloat(ay),
        az: parseFloat(az),
        rssi: parseInt(rssi, 10),
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        data: response.data.data,
        error: null
      };
    } catch (error) {
      console.error('❌ Ensemble prediction error:', error.message);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }

  /**
   * Make batch predictions
   * @param {Array} samples - Array of motion samples [{ax, ay, az, rssi}, ...]
   * @param {string} model - Model name
   * @returns {Promise<Object>} Batch prediction results
   */
  async predictBatch(samples, model = 'random_forest') {
    try {
      if (!this.isHealthy) {
        await this.checkHealth();
        if (!this.isHealthy) {
          throw new Error('ML API Server is not available');
        }
      }

      if (!Array.isArray(samples) || samples.length === 0) {
        throw new Error('Samples must be a non-empty array');
      }

      if (samples.length > 100) {
        throw new Error('Maximum 100 samples per batch');
      }

      const formattedSamples = samples.map(s => ({
        ax: parseFloat(s.ax),
        ay: parseFloat(s.ay),
        az: parseFloat(s.az),
        rssi: parseInt(s.rssi, 10),
        timestamp: s.timestamp || new Date().toISOString()
      }));

      const response = await this.client.post('/api/motion/predict/batch', {
        samples: formattedSamples,
        model
      });

      return {
        success: response.data.success,
        predictions: response.data.predictions,
        summary: {
          total: response.data.total_processed,
          successful: response.data.successful,
          failed: response.data.failed
        },
        errors: response.data.errors,
        error: null
      };
    } catch (error) {
      console.error('❌ Batch prediction error:', error.message);
      return {
        success: false,
        predictions: null,
        error: error.message
      };
    }
  }

  /**
   * Get API server status
   * @returns {Promise<Object>} Status information
   */
  async getStatus() {
    try {
      const response = await this.client.get('/api/motion/status');
      return response.data;
    } catch (error) {
      console.error('❌ Status check error:', error.message);
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

// Create middleware function for Express
const createMotionMLMiddleware = (req, res, next) => {
  req.motionML = new MotionMLMiddleware();
  next();
};

module.exports = {
  MotionMLMiddleware,
  createMotionMLMiddleware
};
