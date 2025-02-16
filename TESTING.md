# Testing Quick Start Guide

## Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Adding New Tests

1. Create test file in appropriate directory:
   - Unit tests: `app/__tests__/unit/ComponentName.test.tsx`
   - Integration tests: `app/__tests__/integration/`
   - E2E tests: `app/__tests__/e2e/`

2. Basic test structure:
   ```typescript
   import { render, screen } from '@testing-library/react';
   import '@testing-library/jest-dom';
   import YourComponent from '@/app/path/to/component';

   describe('YourComponent', () => {
     it('renders correctly', () => {
       render(<YourComponent />);
       expect(screen.getByText('Expected Text')).toBeInTheDocument();
     });
   });
   ```

## Coverage Requirements

- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

View detailed coverage report:
```bash
npm run test:coverage
# Open coverage/lcov-report/index.html in browser
```

## Documentation

For detailed testing documentation, see:
- [Testing Documentation](app/__tests__/README.md)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/) 