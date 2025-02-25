// Test configuration helper
export const TEST_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

export const getTestApiUrl = () => TEST_API_URL; 