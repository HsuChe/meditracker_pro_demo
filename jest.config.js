const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: [
    '@testing-library/jest-dom',
    '<rootDir>/jest.setup.js',
    '<rootDir>/app/__tests__/setup/jest-setup.ts'
  ],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/app/__tests__/**/*.test.{js,jsx,ts,tsx}'
  ],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest']
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/api/**',
    '!app/lib/test/**',
    '!app/**/*.stories.{js,jsx,ts,tsx}',
    '!app/**/*.test.{js,jsx,ts,tsx}',
    '!app/__tests__/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 8,
      statements: 8
    }
  },
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'json',
    'html'
  ],
  reporters: process.env.CI 
    ? ['default', 'jest-junit']
    : ['default'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/cypress/'
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig); 