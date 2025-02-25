// Common Clerk mocks for tests
export const mockClerk = {
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SignedIn: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-in">{children}</div>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-out">{children}</div>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  UserButton: () => <button>User Profile</button>,
  useAuth: jest.fn(() => ({
    isSignedIn: true,
    userId: 'test-user-id',
  })),
};

// Helper to set up Clerk mocks in tests
export function setupClerkMocks(isSignedIn = true) {
  jest.mock('@clerk/nextjs', () => ({
    ...mockClerk,
    useAuth: jest.fn(() => ({
      isSignedIn,
      userId: isSignedIn ? 'test-user-id' : null,
    })),
  }));
} 