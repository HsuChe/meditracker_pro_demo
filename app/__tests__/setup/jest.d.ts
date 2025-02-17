/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBe(expected: any): R;
      toHaveClass(...classNames: string[]): R;
      toHaveValue(value: string | number | string[]): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toHaveLength(length: number): R;
      toEqual(expected: any): R;
      toMatch(pattern: string | RegExp): R;
      toBeTruthy(): R;
      toHaveProperty(key: string, value?: unknown): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toHaveStyle(css: Record<string, any>): R;
      toHaveAttribute(attr: string, value?: string): R;
    }
  }
}

declare module '@testing-library/jest-dom' {
  export interface Matchers<R> {
    toBeInTheDocument(): R;
    toBe(expected: any): R;
    toHaveClass(...classNames: string[]): R;
    toHaveValue(value: string | number | string[]): R;
    toHaveBeenCalled(): R;
    toHaveBeenCalledWith(...args: any[]): R;
    toHaveLength(length: number): R;
    toEqual(expected: any): R;
    toMatch(pattern: string | RegExp): R;
    toBeTruthy(): R;
    toHaveProperty(key: string, value?: unknown): R;
    toHaveTextContent(text: string | RegExp): R;
    toBeVisible(): R;
    toBeDisabled(): R;
    toHaveStyle(css: Record<string, any>): R;
    toHaveAttribute(attr: string, value?: string): R;
  }
}

export {}; 