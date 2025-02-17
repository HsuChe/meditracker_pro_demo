import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBe(expected: any): R;
      toHaveClass(...classNames: string[]): R;
    }
  }
}

export {}; 