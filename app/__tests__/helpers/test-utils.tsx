import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { ClerkProvider } from '@clerk/nextjs';
import { mockClerk } from './mocks/clerk';

// Re-export everything
export * from '@testing-library/react';

interface RenderOptions {
  isAuthenticated?: boolean;
  theme?: string;
  [key: string]: any;
}

// Override render method
export function render(
  ui: React.ReactElement,
  { 
    isAuthenticated = true,
    theme = 'light',
    ...renderOptions 
  }: RenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ClerkProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme={theme}
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </ClerkProvider>
    );
  }

  return {
    ...rtlRender(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Custom test utilities
export function mockConsoleError() {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  
  afterAll(() => {
    console.error = originalError;
  });
}

export function mockConsoleWarn() {
  const originalWarn = console.warn;
  beforeAll(() => {
    console.warn = jest.fn();
  });
  
  afterAll(() => {
    console.warn = originalWarn;
  });
}

// Helper to wait for all promises to resolve
export const flushPromises = () => new Promise(resolve => setImmediate(resolve)); 