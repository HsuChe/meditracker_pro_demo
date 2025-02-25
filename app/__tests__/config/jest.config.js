const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: '../../',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/config/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../$1',
  },
  rootDir: '../',
  testMatch: [
    '<rootDir>/unit/**/*.test.ts',
    '<rootDir>/unit/**/*.test.tsx',
    '<rootDir>/integration/**/*.test.ts',
    '<rootDir>/integration/**/*.test.tsx',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/../../'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    '../../app/**/*.{js,jsx,ts,tsx}',
    '!../../app/**/*.d.ts',
    '!../../app/**/_*.{js,jsx,ts,tsx}',
    '!../../app/**/*.stories.{js,jsx,ts,tsx}',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig); 