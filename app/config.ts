// Environment-specific configuration
const config = {
  development: {
    apiUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000',
  },
  test: {
    apiUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001',
  },
  production: {
    apiUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://meditracker-pro-api.onrender.com',
  },
};

// Get current environment
const environment = process.env.NODE_ENV || 'development';

// Export configuration for current environment
export const currentConfig = config[environment as keyof typeof config];

// Helper function to get API URL
export const getApiUrl = () => currentConfig.apiUrl; 