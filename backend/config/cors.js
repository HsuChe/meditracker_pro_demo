/**
 * CORS configuration for different environments
 */

const corsConfig = {
  // Production environment allowed origins
  production: {
    origin: [
      'https://meditracker-pro-demo.vercel.app',  // Production frontend
      'https://meditracker-pro.vercel.app',       // Alternative production domain
      'https://www.accuratiohealth.com',          // Accuratio Health domain
      'https://accuratiohealth.com',              // Accuratio Health domain without www
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control'],
    exposedHeaders: ['Content-Type', 'Transfer-Encoding', 'Accept-Ranges', 'Content-Range'],
    maxAge: 86400 // 24 hours
  },
  
  // Test environment allowed origins
  test: {
    origin: [
      'http://localhost:3000',                    // Local development
      'http://localhost:3001',                    // Alternative local port
      'https://test-meditracker-pro-demo.vercel.app', // Test frontend on Vercel
      'https://test-meditracker-pro-demo.onrender.com', // Test backend on Render
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control'],
    exposedHeaders: ['Content-Type', 'Transfer-Encoding', 'Accept-Ranges', 'Content-Range'],
    maxAge: 86400 // 24 hours
  },
  
  // Development environment allowed origins
  development: {
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control'],
    exposedHeaders: ['Content-Type', 'Transfer-Encoding', 'Accept-Ranges', 'Content-Range'],
    maxAge: 86400 // 24 hours
  }
};

// Get CORS configuration based on environment
const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return corsConfig[env] || corsConfig.development;
};

module.exports = { getConfig }; 