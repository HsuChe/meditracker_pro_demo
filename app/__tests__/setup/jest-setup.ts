import '@testing-library/jest-dom';
import type { expect } from '@jest/globals';

declare global {
  namespace jest {
    interface Expect extends jest.Expect {
      any(expectedType: any): any;
      objectContaining(expected: any): any;
    }
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveValue(value: string | number | string[]): R;
      toBeDisabled(): R;
      toHaveClass(...classNames: string[]): R;
      toHaveProperty(key: string, value?: unknown): R;
      toBe(expected: unknown): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toContain(item: any): R;
      toEqual(expected: any): R;
      toMatch(pattern: string | RegExp): R;
      toBeTruthy(): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
      toHaveStyle(css: Record<string, any>): R;
      toHaveAttribute(attr: string, value?: string): R;
      not: {
        toBeInTheDocument(): R;
        toBeDisabled(): R;
        toHaveClass(...classNames: string[]): R;
        toHaveValue(value: string | number | string[]): R;
        toHaveProperty(key: string, value?: unknown): R;
        toBe(expected: unknown): R;
        toHaveBeenCalled(): R;
        toHaveBeenCalledWith(...args: any[]): R;
        toContain(item: any): R;
        toEqual(expected: any): R;
        toMatch(pattern: string | RegExp): R;
        toBeTruthy(): R;
        toHaveTextContent(text: string | RegExp): R;
        toBeVisible(): R;
        toHaveStyle(css: Record<string, any>): R;
        toHaveAttribute(attr: string, value?: string): R;
      };
    }
  }
}

// Mock fetch globally
global.fetch = jest.fn();

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); 