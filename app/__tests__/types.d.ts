import '@testing-library/jest-dom';
import { expect } from '@jest/globals';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAttribute(attr: string, value?: string): R;
      toBeDisabled(): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toHaveLength(length: number): R;
      toBe(value: any): R;
      toEqual(value: any): R;
    }
  }
}

export {}; 