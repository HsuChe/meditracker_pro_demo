import React from 'react';

interface ChildrenProps {
  children: React.ReactNode;
}

// Common Clerk mocks for tests
export const mockClerk = {
  ClerkProvider: ({ children }: ChildrenProps) => <div>{children}</div>,
  SignedIn: ({ children }: ChildrenProps) => <div data-testid="signed-in">{children}</div>,
  SignedOut: ({ children }: ChildrenProps) => <div data-testid="signed-out">{children}</div>,
  SignInButton: ({ children }: ChildrenProps) => <div>{children}</div>,
  UserButton: () => <button>User Profile</button>,
  useAuth: jest.fn(() => ({
    isSignedIn: true,
    userId: 'test-user-id',
  })),
};

// Helper to set up Clerk mocks in tests
export function setupClerkMocks(isSignedIn = true): void {
  jest.mock('@clerk/nextjs', () => ({
    ...mockClerk,
    useAuth: jest.fn(() => ({
      isSignedIn,
      userId: isSignedIn ? 'test-user-id' : null,
    })),
  }));
} 