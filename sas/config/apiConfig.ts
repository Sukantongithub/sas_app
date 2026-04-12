/**
 * API Configuration
 * 
 * For React Native/Expo, environment variables must be configured here directly.
 * 
 * Setup Instructions:
 * 1. Update API_BASE_URL below based on your environment:
 *    - Local (web/simulator): http://localhost:5000/api
 *    - Android Emulator: http://10.0.2.2:5000/api
 *    - Physical Device (ngrok): https://YOUR_NGROK_URL/api
 *    - Physical Device (local IP): http://YOUR_COMPUTER_IP:5000/api
 * 2. Restart Expo: npm start -- --reset-cache
 */

// Configuration - UPDATE THIS BASED ON YOUR SETUP
const API_BASE_URL = 'http://localhost:5000/api';
const API_TIMEOUT = 10000; // Localhost is faster
const API_ENV = 'development';

export { API_BASE_URL, API_TIMEOUT, API_ENV };

console.log(`[API Config] env=${API_ENV} url=${API_BASE_URL} timeout=${API_TIMEOUT}ms`);
