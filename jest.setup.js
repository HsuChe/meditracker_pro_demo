import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn()
    };
  },
  useSearchParams() {
    return {
      get: jest.fn()
    };
  }
}));

// Set up global fetch mock
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true
  })
);

// Extend Jest matchers
expect.extend({
  toHaveBeenCalledWith(received, ...expected) {
    const pass = this.equals(received.mock.calls[0], expected);
    return {
      pass,
      message: () =>
        `expected ${received} to have been called with ${expected}`,
    };
  },
  toBeInTheDocument(received) {
    const pass = received !== null;
    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be in the document`,
    };
  },
  toHaveLength(received, length) {
    const pass = received.length === length;
    return {
      pass,
      message: () =>
        `expected ${received} to have length ${length}`,
    };
  },
  toEqual(received, expected) {
    const pass = this.equals(received, expected);
    return {
      pass,
      message: () =>
        `expected ${received} to equal ${expected}`,
    };
  },
  toMatch(received, pattern) {
    const pass = pattern.test(received);
    return {
      pass,
      message: () =>
        `expected ${received} to match ${pattern}`,
    };
  },
  toBeTruthy(received) {
    const pass = Boolean(received);
    return {
      pass,
      message: () =>
        `expected ${received} to be truthy`,
    };
  },
  toHaveProperty(received, property, value) {
    const pass = value === undefined
      ? property in received
      : this.equals(received[property], value);
    return {
      pass,
      message: () =>
        `expected ${received} to have property ${property}${
          value === undefined ? '' : ` with value ${value}`
        }`,
    };
  },
  toHaveBeenCalled(received) {
    const pass = received.mock.calls.length > 0;
    return {
      pass,
      message: () =>
        `expected ${received} to have been called`,
    };
  },
  toHaveValue(received, value) {
    const pass = received.value === value;
    return {
      pass,
      message: () =>
        `expected ${received} to have value ${value}`,
    };
  },
});

// Extend Jest globals
global.expect.objectContaining = (obj) => ({
  asymmetricMatch: (actual) => {
    if (!actual || typeof actual !== 'object') return false;
    return Object.entries(obj).every(([key, value]) =>
      Object.prototype.hasOwnProperty.call(actual, key) && actual[key] === value
    );
  }
});

global.expect.any = (constructor) => ({
  asymmetricMatch: (actual) =>
    actual instanceof constructor || typeof actual === constructor.name.toLowerCase(),
}); 