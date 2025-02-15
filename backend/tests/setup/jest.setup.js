require('dotenv').config({ path: '.env.test' });
const { Pool } = require('pg');

// Global beforeAll and afterAll hooks
beforeAll(async () => {
  // Create a new pool for the test database
  global.testPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD || " ",
    port: process.env.DB_PORT
  });

  try {
    await global.testPool.query('SELECT NOW()');
    console.log('\x1b[34m%s\x1b[0m', '🔌 Test database connected successfully');
  } catch (error) {
    console.error('Test database connection failed:', error);
    throw error;
  }
});

afterAll(async () => {
  await global.testPool.end();
});

// Global test timeout
jest.setTimeout(30000);

// Custom test environment setup
process.env.NODE_ENV = 'test';

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
}); 