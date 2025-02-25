// Environment-specific configuration
const config = {
  development: {
    apiUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001',
  },
  test: {
    apiUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001',
  },
  production: {
    apiUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://accuratiohealth.com/api',
  },
};

// Get current environment
const environment = process.env.NODE_ENV || 'development';

// Validate environment
if (!['development', 'test', 'production'].includes(environment)) {
  console.warn(`Invalid NODE_ENV: ${environment}, defaulting to development`);
}

// Export configuration for current environment
export const currentConfig = config[environment as keyof typeof config] || config.development;

// Helper function to get API URL with validation
export const getApiUrl = () => {
  const url = currentConfig.apiUrl;
  if (!url) {
    console.error('API URL is not configured properly');
    return 'http://localhost:5001'; // Fallback for safety
  }
  return url;
}; 