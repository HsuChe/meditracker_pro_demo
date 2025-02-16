import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeDisabled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toBe(expected: any): R;
    }
  }
} 