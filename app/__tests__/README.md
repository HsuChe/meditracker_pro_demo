# Testing Documentation

This document provides guidelines for writing and running tests in the MediTracker Pro project.

## Table of Contents
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)

## Test Structure

# Test Directory Structure

```
__tests__/
├── config/               # Test configuration files
│   ├── jest.config.js   # Jest configuration
│   └── jest.setup.js    # Jest setup and global configuration
├── helpers/             # Test helper functions and utilities
│   ├── db.ts           # Database test helpers
│   └── mocks/          # Mock implementations
├── unit/               # Unit tests
│   ├── components/     # Component tests
│   ├── db/            # Database tests
│   └── lib/           # Library/utility tests
├── integration/        # Integration tests
├── e2e/               # End-to-end tests
└── types/             # Test-specific type definitions
```

## Test Categories

- **Unit Tests**: Individual component and function tests
- **Integration Tests**: API and service integration tests
- **E2E Tests**: Full user flow tests using Cypress
- **Database Tests**: Database operations and integrity tests

## Running Tests

### Available Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Configuration

All test configuration is kept in the `config` directory:
- `jest.config.js`: Main Jest configuration
- `jest.setup.js`: Global test setup and configuration

## Helper Functions

The `helpers` directory contains reusable test utilities:
- Database setup and teardown
- Mock implementations
- Test data generators

## Writing Tests

### Adding Tests for Existing Components

1. Create a test file in `app/__tests__/unit/` with the naming convention `ComponentName.test.tsx`
2. Import required dependencies:
   ```typescript
   import React from 'react';
   import { render, screen, fireEvent } from '@testing-library/react';
   import '@testing-library/jest-dom';
   import ComponentName from '@/app/path/to/component';
   ```
3. Write your tests following this structure:
   ```typescript
   describe('ComponentName', () => {
     // Setup common test data
     const defaultProps = {
       // ... your props
     };

     beforeEach(() => {
       jest.clearAllMocks();
     });

     it('should render correctly', () => {
       render(<ComponentName {...defaultProps} />);
       // Add your assertions
     });
   });
   ```

### Example Test Structure

```typescript
// Example test for a form component
describe('FormComponent', () => {
  const mockSubmit = jest.fn();
  const defaultProps = {
    onSubmit: mockSubmit,
    initialData: { name: '' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form fields', () => {
    render(<FormComponent {...defaultProps} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('handles form submission', () => {
    render(<FormComponent {...defaultProps} />);
    const input = screen.getByLabelText('Name');
    const submitButton = screen.getByText('Submit');

    fireEvent.change(input, { target: { value: 'John Doe' } });
    fireEvent.click(submitButton);

    expect(mockSubmit).toHaveBeenCalledWith({ name: 'John Doe' });
  });
});
```

### Adding Tests for New Pages

1. Create a new test file in the appropriate directory:
   - Unit tests: `app/__tests__/unit/`
   - Integration tests: `app/__tests__/integration/`
   - E2E tests: `app/__tests__/e2e/`

2. For page components, include tests for:
   - Initial rendering
   - Data fetching (if applicable)
   - User interactions
   - Error states
   - Loading states

Example:
```typescript
describe('NewPage', () => {
  it('shows loading state', () => {
    render(<NewPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('displays error message when fetch fails', async () => {
    // Mock failed API call
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'));
    
    render(<NewPage />);
    expect(await screen.findByText('Error loading data')).toBeInTheDocument();
  });
});
```

## Pre-commit Hooks

Tests are automatically run before each commit using Husky. The configuration is in `.husky/pre-commit`.

To modify which tests run on pre-commit:
1. Edit `.husky/pre-commit`
2. Modify the test command as needed:
   ```bash
   #!/usr/bin/env sh
   . "$(dirname -- "$0")/_/husky.sh"

   # Run specific tests
   npm test -- path/to/specific/test

   # Or run all tests
   npm test
   ```

## Test Coverage

Coverage requirements:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

To view coverage:
1. Run `npm run test:coverage`
2. Open `coverage/lcov-report/index.html` in your browser

## Best Practices

1. **Component Testing**
   - Test component rendering
   - Test user interactions
   - Test error states
   - Test loading states
   - Test edge cases

2. **Mocking**
   ```typescript
   // Mock external dependencies
   jest.mock('external-module', () => ({
     useExternalHook: jest.fn()
   }));

   // Mock API calls
   jest.spyOn(global, 'fetch').mockResolvedValue({
     json: () => Promise.resolve({ data: 'mocked' })
   });
   ```

3. **Testing User Interactions**
   ```typescript
   // Click events
   fireEvent.click(screen.getByText('Submit'));

   // Form inputs
   fireEvent.change(screen.getByLabelText('Username'), {
     target: { value: 'testuser' }
   });

   // Select options
   fireEvent.click(screen.getByRole('combobox'));
   fireEvent.click(screen.getByText('Option 1'));
   ```

4. **Async Testing**
   ```typescript
   it('loads data asynchronously', async () => {
     render(<AsyncComponent />);
     expect(screen.getByText('Loading...')).toBeInTheDocument();
     expect(await screen.findByText('Data loaded')).toBeInTheDocument();
   });
   ```

5. **Test Data**
   - Use factory functions for test data
   - Keep test data realistic
   - Avoid testing implementation details
   ```typescript
   const createMockData = (overrides = {}) => ({
     id: '1',
     name: 'Test Item',
     status: 'active',
     ...overrides
   });
   ```

Remember to:
- Write meaningful test descriptions
- Test both success and failure cases
- Keep tests focused and isolated
- Use meaningful test data
- Follow the Arrange-Act-Assert pattern 