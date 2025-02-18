// Add TextEncoder/TextDecoder for pg package
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Add testing library matchers
require('@testing-library/jest-dom');

// Mock fetch globally
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);

// Mock window.alert
global.alert = jest.fn();

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '',
}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  jest.resetAllMocks();
}); 